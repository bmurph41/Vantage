import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { reportOpenAIQuotaExhausted, shouldSkipAIFeatures } from "./ai-quota-manager";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) 
  : null;

interface DealMetadata {
  isDeal: boolean;
  dealType?: 'acquisition' | 'm&a' | 'financing' | 'partnership' | 'expansion' | 'ipo';
  parties?: string[];
  dealValue?: string;
  currency?: string;
  operators?: string[];
  marinas?: string[];
  metrics?: {
    type: string;
    value: string;
  }[];
}

interface DetailedDealInfo {
  transactionType: 'ma' | 'financing' | 'partnership' | 'asset_sale' | 'other';
  dealStatus: 'rumored' | 'announced' | 'pending' | 'closed' | 'failed';
  buyer?: string;
  seller?: string;
  transactionSize?: string;
  valuation?: string;
  equityStake?: string;
  closingDate?: string;
  announcedDate?: string;
  dealSummary?: string;
  confidence: number;
}

interface ExtractedEntity {
  name: string;
  type: 'company' | 'person' | 'location' | 'asset';
  context?: string;
  confidence?: number;
}

interface EnrichmentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  dealMetadata: DealMetadata | null;
  dealInfo: DetailedDealInfo | null;
  geography: string[];
  entities: ExtractedEntity[];
}

export async function enrichArticle(title: string, summary: string, content: string): Promise<EnrichmentResult> {
  if (shouldSkipAIFeatures()) {
    return {
      sentiment: detectSentimentFallback(title, summary),
      dealMetadata: detectDealFallback(title, summary),
      dealInfo: null,
      geography: extractGeographyFallback(title, summary, content),
      entities: extractEntitiesFallback(title, summary, content)
    };
  }
  
  try {
    const prompt = `Analyze this marina industry article and extract structured data:

Title: ${title}
Summary: ${summary}
Content: ${content?.substring(0, 2000) || 'N/A'}

Extract the following information in JSON format:
1. sentiment: Is this positive, neutral, or negative for marina industry investors/operators?
2. dealMetadata: 
   - isDeal: boolean (is this about a transaction, acquisition, financing, partnership, expansion, or business development?)
   - dealType: 'acquisition' | 'm&a' | 'financing' | 'partnership' | 'expansion' | 'ipo' (if isDeal is true)
   - parties: array of companies/entities involved
   - dealValue: transaction amount as string (e.g., "$50M", "€25M")
   - currency: currency code if mentioned
   - operators: marina operators mentioned
   - marinas: specific marina names mentioned
   - metrics: array of key metrics mentioned (e.g., {type: "slip_count", value: "500"}, {type: "occupancy", value: "95%"})
3. dealInfo: If this is a transaction, extract detailed deal structure (null if not a deal):
   - transactionType: 'ma' (M&A/acquisition) | 'financing' (debt/equity raise) | 'partnership' | 'asset_sale' | 'other'
   - dealStatus: 'rumored' | 'announced' | 'pending' | 'closed' | 'failed'
   - buyer: Name of acquiring/investing entity
   - seller: Name of seller/target entity
   - transactionSize: Total deal value (e.g., "$100 million", "€50M")
   - valuation: Enterprise/equity valuation if mentioned separately from transaction size
   - equityStake: Percentage ownership acquired (e.g., "majority stake", "40%", "controlling interest")
   - closingDate: Expected or actual closing date (ISO format YYYY-MM-DD if parseable)
   - announcedDate: Date deal was announced (ISO format YYYY-MM-DD if parseable)
   - dealSummary: One-sentence summary of the transaction
   - confidence: 0-100 confidence score on deal extraction accuracy
4. geography: array of geographic locations mentioned (countries, states, cities, regions)
5. entities: array of extracted entities with:
   - name: entity name (e.g., "Safe Harbor Marinas", "John Smith", "Miami Beach Marina")
   - type: 'company' | 'person' | 'location' | 'asset'
   - context: brief context where entity appears (optional)
   - confidence: 0-100 confidence score (optional, default 100)

ENTITY EXTRACTION RULES:
- company: Marina operators, real estate firms, PE firms, boat manufacturers, service providers
- person: CEOs, executives, analysts, quoted individuals
- location: Specific marinas, ports, harbors, cities, regions (beyond general geography)
- asset: Specific facilities, properties, vessels

MAJOR MARINA OPERATORS TO RECOGNIZE:
When extracting entities and deals, pay special attention to these key industry consolidators and investment firms:
- Marina Operators: Safe Harbor Marinas, Suntex Marinas, Grove Point Marinas, Southern Marinas, VIP Marinas, Port 32 Marinas, ACME Marinas, Integra Marinas, Windward Marina Group, Bowline Marinas, Topside Marinas, MarineMax, IGY Marinas
- PE Firms & Investment Groups: Allied Strategic Capital Partners, Blackstone, KKR, Brookfield, Apollo Global, Carlyle Group, Sun Communities
These entities are frequently involved in M&A transactions, consolidations, and marina portfolio acquisitions. If mentioned in the article, always extract them as high-confidence company entities.

DEAL EXTRACTION RULES:
- Only set dealInfo if this is clearly a transaction (M&A, financing, asset sale, partnership)
- transactionType 'ma' includes acquisitions, mergers, buyouts, take-privates
- transactionType 'financing' includes equity raises, debt financing, IPOs, recapitalizations
- dealStatus 'announced' = officially confirmed, 'pending' = regulatory approval needed, 'closed' = completed
- Extract buyer/seller from context (e.g., "Company A acquires Company B" → buyer: Company A, seller: Company B)
- Parse dates carefully, return null if uncertain

Respond ONLY with valid JSON matching this schema:
{
  "sentiment": "positive" | "neutral" | "negative",
  "dealMetadata": {...} | null,
  "dealInfo": {...} | null,
  "geography": string[],
  "entities": [{name: string, type: string, context?: string, confidence?: number}]
}`;

    // Try OpenAI GPT-4 first
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a financial analyst specializing in marina industry M&A and investment intelligence. Extract structured data from articles accurately." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return {
        sentiment: result.sentiment || 'neutral',
        dealMetadata: result.dealMetadata || null,
        dealInfo: result.dealInfo || null,
        geography: result.geography || [],
        entities: result.entities || []
      };
    } catch (openaiError) {
      
      // Fallback to Anthropic Claude if available
      if (!anthropic) {
        console.warn("AI enrichment: OpenAI failed and Anthropic not configured, using fallback");
        throw openaiError;
      }
      
      const message = await anthropic.messages.create({
        model: "claude-sonnet-3-5-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const textContent = message.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error("No text content in Anthropic response");
      }

      const result = JSON.parse(textContent.text);
      return {
        sentiment: result.sentiment || 'neutral',
        dealMetadata: result.dealMetadata || null,
        dealInfo: result.dealInfo || null,
        geography: result.geography || [],
        entities: result.entities || []
      };
    }
  } catch (error: any) {
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      reportOpenAIQuotaExhausted();
    }
    console.error("AI enrichment failed:", error?.message || error?.code || 'Unknown error');
    
    // Return basic analysis as fallback
    return {
      sentiment: detectSentimentFallback(title, summary),
      dealMetadata: detectDealFallback(title, summary),
      dealInfo: null,
      geography: extractGeographyFallback(title, summary, content),
      entities: extractEntitiesFallback(title, summary, content)
    };
  }
}

// Fallback entity extraction using simple pattern matching
function extractEntitiesFallback(title: string, summary: string, content: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const text = `${title} ${summary} ${content?.substring(0, 1000) || ''}`;
  
  // Known marina operators and companies
  const knownCompanies = [
    // Major U.S. Marina Consolidators & Operators
    'Safe Harbor', 'Suntex', 'IGY', 'Westrec', 'Freedom Boat Club',
    'Sun Communities', 'MarineMax', 'OneWater',
    'Grove Point', 'Southern Marinas', 'VIP Marinas', 
    'Port 32', 'ACME Marinas', 'Integra Marinas',
    'Windward Marina Group', 'Bowline Marinas', 'Topside Marinas',
    // PE Firms & Investment Groups
    'Allied Strategic Capital', 'Blackstone', 'KKR', 'Brookfield', 
    'Apollo', 'Carlyle',
    // Other Notable Players
    'RVezy', 'Malibu'
  ];
  
  knownCompanies.forEach(company => {
    if (text.includes(company)) {
      entities.push({
        name: company,
        type: 'company',
        confidence: 80
      });
    }
  });
  
  return entities;
}

// Fallback sentiment detection using keywords
function detectSentimentFallback(title: string, summary: string): 'positive' | 'neutral' | 'negative' {
  const text = `${title} ${summary}`.toLowerCase();
  
  const positiveKeywords = ['growth', 'expands', 'record', 'success', 'award', 'investment', 'acquisition', 'partnership', 'opens', 'new', 'innovative', 'advanced', 'improvement'];
  const negativeKeywords = ['decline', 'closes', 'bankrupt', 'lawsuit', 'violation', 'damage', 'loss', 'concern', 'risk', 'emergency', 'accident', 'closure'];
  
  const positiveCount = positiveKeywords.filter(word => text.includes(word)).length;
  const negativeCount = negativeKeywords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Fallback deal detection using patterns
function detectDealFallback(title: string, summary: string): DealMetadata | null {
  const text = `${title} ${summary}`.toLowerCase();
  
  const dealKeywords = ['acquisition', 'acquires', 'purchased', 'merger', 'acquired', 'bought', 'financing', 'investment', 'funding', 'deal', 'partnership', 'expands', 'opens'];
  
  const isDeal = dealKeywords.some(keyword => text.includes(keyword));
  
  if (!isDeal) return null;
  
  let dealType: DealMetadata['dealType'] = 'partnership';
  if (text.includes('acquisition') || text.includes('acquires') || text.includes('acquired')) dealType = 'acquisition';
  if (text.includes('merger')) dealType = 'm&a';
  if (text.includes('financing') || text.includes('funding')) dealType = 'financing';
  if (text.includes('expands') || text.includes('opens')) dealType = 'expansion';
  if (text.includes('ipo') || text.includes('public offering')) dealType = 'ipo';
  
  // Extract potential deal value
  const valueMatch = text.match(/\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i);
  const dealValue = valueMatch ? `$${valueMatch[1]}${valueMatch[2].charAt(0).toUpperCase()}` : undefined;
  
  return {
    isDeal: true,
    dealType,
    dealValue,
    currency: dealValue ? 'USD' : undefined,
    parties: [],
    operators: [],
    marinas: [],
    metrics: []
  };
}

// Fallback geography extraction
function extractGeographyFallback(title: string, summary: string, content: string): string[] {
  const text = `${title} ${summary} ${content?.substring(0, 1000) || ''}`.toLowerCase();
  const locations: string[] = [];
  
  // US States
  const states = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'];
  
  // Regions
  const regions = ['northeast', 'southeast', 'midwest', 'southwest', 'west coast', 'east coast', 'gulf coast', 'pacific northwest', 'new england', 'mid-atlantic'];
  
  // Major marina markets
  const cities = ['miami', 'fort lauderdale', 'tampa', 'charleston', 'newport', 'san diego', 'seattle', 'boston', 'new york', 'chicago', 'los angeles', 'san francisco'];
  
  states.forEach(state => {
    if (text.includes(state)) locations.push(state);
  });
  
  regions.forEach(region => {
    if (text.includes(region)) locations.push(region);
  });
  
  cities.forEach(city => {
    if (text.includes(city)) locations.push(city);
  });
  
  return Array.from(new Set(locations)); // Remove duplicates
}

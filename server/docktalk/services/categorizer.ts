import OpenAI from "openai";
import { db } from "../db";
import { articles as articlesTable } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { analyzeLearningPatterns, buildEnhancedTrainingContext } from "./ai-learning";
import { reportOpenAIQuotaExhausted, shouldSkipAIFeatures, reportOpenAISuccess } from "./ai-quota-manager";

export interface CategoryResult {
  categories: string[];
  tags: string[];
  confidence: number;
  region: string;
}

interface AiCategorizationResult {
  categories: string[];
  tags: string[];
  confidence: number;
  reasoning: string;
  region: string;
}

let enhancedTrainingContextCache: string = "";
let enhancedContextCacheExpiry = 0;

async function getEnhancedTrainingContext(): Promise<string> {
  const now = Date.now();
  if (enhancedContextCacheExpiry > now && enhancedTrainingContextCache) {
    return enhancedTrainingContextCache;
  }

  try {
    const insights = await analyzeLearningPatterns();
    enhancedTrainingContextCache = buildEnhancedTrainingContext(insights);
    enhancedContextCacheExpiry = now + 15 * 60 * 1000;
    return enhancedTrainingContextCache;
  } catch (error) {
    console.error("Error building enhanced training context:", error);
    return "";
  }
}

export function invalidateCategorizerCache(): void {
  enhancedContextCacheExpiry = 0;
  enhancedTrainingContextCache = "";
}

// Use Replit AI Integrations if available (billed to Replit credits), otherwise fall back to user's OpenAI key
const openai = new OpenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

async function aiCategorizeAndTag(title: string, content: string): Promise<CategoryResult> {
  if (shouldSkipAIFeatures()) {
    return legacyCategorizeAndTag(title, content);
  }
  
  try {
    const trainingContext = await getEnhancedTrainingContext();
    
    const prompt = `You are an expert in the marina and marine industry. Analyze this article and assign 1-4 most relevant categories.

ARTICLE TITLE: ${title}

ARTICLE CONTENT: ${content.substring(0, 2000)} ${content.length > 2000 ? '...' : ''}
${trainingContext}

CATEGORIES (choose 1-4 that apply):
- Macro: Federal Reserve, interest rates, inflation, economic indicators, GDP, recession, macro economic trends
- M&A: Mergers, acquisitions, buyouts, deals, transactions, valuations, transaction multiples
- Marina Sale: Marina sales, marina acquisitions, marina buyouts, marina deals, marina purchases, marina valuations, marina transaction multiples
- Development: Marina construction, renovation, permitting, zoning, new projects, infrastructure expansion
- Operations: Day-to-day marina operations, dock management, fuel systems, storage, automation, software, dealer operations
- Regulatory: Government regulations, compliance, zoning laws, permits, legal requirements
- Environmental: Climate change, sea level rise, sustainability, storm resilience, green initiatives, environmental impact
- Technology: IoT, sensors, digital platforms, AI, smart marina tech, automation systems, software solutions
- Boat Sales: Boat sales data, brokerage, yacht sales, dealer sales, market trends, sales statistics
- Boat Show: Boat shows, marine trade shows, boat exhibitions, industry events, boat expos
- Manufacturing: Boat manufacturing, shipbuilding, production, manufacturing facilities, OEM, factory operations
- Industry Trends: Market analysis, statistical reports, industry forecasts, trend analysis, research studies
- Education: Training programs, certifications, courses, workshops, marine education, boating safety education, professional development
- Insurance: Insurance coverage, risk management, climate risk, liability, underwriting
- Legal: Legal disputes, lawsuits, compliance requirements, regulatory filings, legal frameworks
- People Moves: Executive appointments, hirings, promotions, retirements, board changes, personnel announcements, new hires, leadership changes
- Company Earnings: Quarterly earnings, financial results, revenue reports, profit announcements, earnings calls, financial performance
- Awards: Industry awards, recognition, honors, prizes, achievements, excellence awards, best marina, top-ranked facilities, accolades
- Business Planning: Strategic planning, business strategy, expansion plans, growth strategy, market entry, business models, strategic initiatives, long-term planning
- General: Articles that don't clearly fit other categories

RULES:
1. Assign 1-4 categories based on article content
2. If article covers multiple topics (e.g., an acquisition involving new marina development), assign both relevant categories
3. Prioritize categories by relevance - most important first
4. Don't over-tag - only include truly relevant categories

TAGS: Generate 3-8 relevant tags that capture specific aspects, locations, vessel types, company names, or technical details mentioned.

CONFIDENCE: Rate your confidence 0.0-1.0 based on how clearly the article fits the chosen categories.

REGION: Determine the primary geographic focus of the article:
- US/Domestic: Articles about US marinas, boats, regulations, companies, markets, or industry news (default for marina industry news without clear international focus)
- International: Articles specifically about non-U.S. countries, international markets, global trends, or multiple countries outside the U.S.

Default to "US/Domestic" unless the article explicitly focuses on international locations or global markets.

Respond with JSON in this exact format:
{
  "categories": ["category1", "category2"],
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.85,
  "reasoning": "Brief explanation of why these categories and tags were chosen",
  "region": "US/Domestic"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert marina industry analyst. Categorize articles accurately based on their content and provide relevant tags. Articles can have multiple categories if they cover multiple topics."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const result: AiCategorizationResult = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      categories: result.categories && result.categories.length > 0 ? result.categories : ["General"],
      tags: result.tags || [],
      confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
      region: result.region || "US/Domestic"
    };
    
  } catch (error: any) {
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      reportOpenAIQuotaExhausted();
    }
    console.error("AI categorization failed, falling back to regex:", error?.message || error?.code || 'Unknown error');
    return legacyCategorizeAndTag(title, content);
  }
}

// Main async function that uses AI by default, with fallback to regex
export async function categorizeAndTag(title: string, content: string): Promise<CategoryResult> {
  return await aiCategorizeAndTag(title, content);
}

// Synchronous version for backward compatibility (uses legacy regex)
export function categorizeAndTagSync(title: string, content: string): CategoryResult {
  return legacyCategorizeAndTag(title, content);
}

// Legacy regex-based categorization as fallback
function legacyCategorizeAndTag(title: string, content: string): CategoryResult {
  const text = `${title} ${content}`.toLowerCase();
  const tags: Set<string> = new Set();
  const categories: Set<string> = new Set();
  let confidence = 0.5;

  // Macro Economics
  if (/(fed|federal reserve|cpi|inflation|interest|treasury|sofr|macro|gdp|recession|economy)/i.test(text)) {
    categories.add("Macro");
    confidence = Math.max(confidence, 0.8);
    tags.add("Rates");
    tags.add("Macro");
    if (/interest|rate/i.test(text)) tags.add("Interest Rates");
    if (/inflation/i.test(text)) tags.add("Inflation");
    if (/recession|gdp/i.test(text)) tags.add("Economic Indicators");
  }

  // M&A
  if (/(acquisition|acquires|acquired|merger|buyout|deal|transaction|valuation|multiple)/i.test(text)) {
    categories.add("M&A");
    confidence = Math.max(confidence, 0.9);
    tags.add("M&A");
    tags.add("Valuation");
    if (/acquisition|acquires|acquired|merger|buyout/i.test(text)) tags.add("M&A");
    if (/valuation|cap rate|NOI|EBITDA|multiple/i.test(text)) tags.add("Valuation");
  }

  // Investment (strategic, PE, financing - separate from M&A)
  if (/(private equity|strategic investment|fund raising|financing round|capex|capital)/i.test(text)) {
    categories.add("Investment");
    confidence = Math.max(confidence, 0.8);
    tags.add("Capital");
    if (/private equity|portfolio/i.test(text)) tags.add("Private Equity");
    if (/financing|fund/i.test(text)) tags.add("Capital");
  }

  // Boat Sales
  if (/(boat sales|yacht sales|brokerage|dealer sales|sales data|units sold|sales growth)/i.test(text)) {
    categories.add("Boat Sales");
    confidence = Math.max(confidence, 0.85);
    tags.add("Sales");
    if (/yacht sales|brokerage/i.test(text)) tags.add("Yacht Sales");
    if (/dealer/i.test(text)) tags.add("Dealer");
  }

  // Boat Show
  if (/(boat show|marine show|trade show|exhibition|expo|boat expo|marine expo|industry event)/i.test(text)) {
    categories.add("Boat Show");
    confidence = Math.max(confidence, 0.9);
    tags.add("Trade Show");
    if (/exhibition|expo/i.test(text)) tags.add("Exhibition");
    if (/award|ceremony/i.test(text)) tags.add("Awards");
  }

  // Manufacturing
  if (/(manufacturing|production|factory|shipyard|shipbuilding|OEM|manufacturer|facility|plant)/i.test(text)) {
    categories.add("Manufacturing");
    confidence = Math.max(confidence, 0.85);
    tags.add("Manufacturing");
    if (/shipyard|shipbuilding/i.test(text)) tags.add("Shipbuilding");
    if (/factory|plant|facility/i.test(text)) tags.add("Production");
    if (/OEM/i.test(text)) tags.add("OEM");
  }

  // Industry Trends
  if (/(market analysis|industry forecast|trend|statistical report|research study|market data)/i.test(text)) {
    categories.add("Industry Trends");
    confidence = Math.max(confidence, 0.8);
    tags.add("Trends");
    if (/forecast|prediction/i.test(text)) tags.add("Forecast");
    if (/report|study/i.test(text)) tags.add("Research");
  }

  // Education
  if (/(training|certification|course|workshop|education|safety education|professional development|seminar|academy)/i.test(text)) {
    categories.add("Education");
    confidence = Math.max(confidence, 0.8);
    tags.add("Education");
    if (/training|course|workshop/i.test(text)) tags.add("Training");
    if (/certification|certified/i.test(text)) tags.add("Certification");
    if (/safety|USCG|Coast Guard/i.test(text)) tags.add("Safety");
  }

  // Insurance
  if (/(insurance|coverage|underwriting|climate risk|liability|risk management)/i.test(text)) {
    categories.add("Insurance");
    confidence = Math.max(confidence, 0.8);
    tags.add("Insurance");
    if (/climate risk|hurricane|flood/i.test(text)) tags.add("Climate Risk");
    if (/liability|coverage/i.test(text)) tags.add("Coverage");
  }

  // Development
  if (/(renovation|permitting|construction|development|building|project|expansion|expands)/i.test(text)) {
    categories.add("Development");
    confidence = Math.max(confidence, 0.7);
    tags.add("Development");
    tags.add("CapEx");
    if (/construction|building/i.test(text)) tags.add("Construction");
    if (/permit|zoning/i.test(text)) tags.add("Permitting");
    if (/expansion|expands/i.test(text)) tags.add("Expansion");
  }

  // Operations
  if (/(dock|slip|storage|haul|fuel|operations|management|marina management)/i.test(text)) {
    categories.add("Operations");
    confidence = Math.max(confidence, 0.7);
    tags.add("Ops");
    if (/fuel|gas|diesel/i.test(text)) tags.add("Fuel");
    if (/storage|dry stack|haul/i.test(text)) tags.add("Storage");
    if (/management|operations/i.test(text)) tags.add("Operations");
    if (/(slip|dock|berth|mooring)/i.test(text)) tags.add("Berths");
  }

  // Regulatory
  if (/(regulation|regulatory|compliance|permit|law|zoning|coastal|fema)/i.test(text)) {
    categories.add("Regulatory");
    confidence = Math.max(confidence, 0.8);
    if (/zoning|permit/i.test(text)) tags.add("Zoning");
    if (/(regulation|regulatory|compliance)/i.test(text)) tags.add("Compliance");
  }

  // Environmental
  if (/(resilience|sea level|environment|sustainability|green|climate change|hurricane|storm)/i.test(text)) {
    categories.add("Environmental");
    confidence = Math.max(confidence, 0.8);
    tags.add("Resilience");
    if (/(sustainability|green|renewable)/i.test(text)) tags.add("Sustainability");
    if (/(hurricane|storm|flood|climate)/i.test(text)) tags.add("Climate Risk");
    if (/(resilience|adaptation)/i.test(text)) tags.add("Resilience");
  }

  // Technology
  if (/(IoT|sensor|automation|digital|app|platform|smart|AI|artificial intelligence|software)/i.test(text)) {
    categories.add("Technology");
    confidence = Math.max(confidence, 0.7);
    tags.add("Technology");
    if (/(IoT|sensor|smart)/i.test(text)) tags.add("IoT");
    if (/(digital|app|platform)/i.test(text)) tags.add("Digital");
    if (/(AI|artificial intelligence|automation)/i.test(text)) tags.add("AI");
  }

  // People Moves
  if (/(appoint|appointment|hire|hired|hiring|promote|promoted|promotion|resign|retirement|retire|joins|joined|names|named|executive|CEO|CFO|president|vice president|director|board|personnel|leadership)/i.test(text)) {
    categories.add("People Moves");
    confidence = Math.max(confidence, 0.85);
    tags.add("People");
    if (/CEO|president|executive/i.test(text)) tags.add("Executive");
    if (/hire|hired|hiring|appointment|appoint/i.test(text)) tags.add("Hiring");
    if (/promotion|promoted/i.test(text)) tags.add("Promotion");
    if (/resign|retirement|retire/i.test(text)) tags.add("Departure");
  }

  // Company Earnings
  if (/(earnings|quarterly results|financial results|revenue|profit|Q1|Q2|Q3|Q4|fiscal year|net income|earnings call|financial performance|reports earnings)/i.test(text)) {
    categories.add("Company Earnings");
    confidence = Math.max(confidence, 0.9);
    tags.add("Earnings");
    if (/revenue|sales/i.test(text)) tags.add("Revenue");
    if (/profit|net income|EBITDA/i.test(text)) tags.add("Profit");
    if (/Q1|Q2|Q3|Q4|quarterly/i.test(text)) tags.add("Quarterly");
  }

  // Awards
  if (/(award|awards|recognition|honor|honors|prize|winner|accolade|achievement|excellence|named best|top-rated|ranked|top marina|best marina|marina of the year)/i.test(text)) {
    categories.add("Awards");
    confidence = Math.max(confidence, 0.85);
    tags.add("Awards");
    if (/winner|won|received/i.test(text)) tags.add("Winner");
    if (/excellence|best|top/i.test(text)) tags.add("Excellence");
  }

  // Business Planning
  if (/(strategic plan|business plan|expansion plan|growth strategy|business strategy|market entry|strategic initiative|long-term plan|five-year plan|business model|strategic goal)/i.test(text)) {
    categories.add("Business Planning");
    confidence = Math.max(confidence, 0.8);
    tags.add("Strategy");
    if (/expansion|growth|expand/i.test(text)) tags.add("Expansion");
    if (/strategic|strategy/i.test(text)) tags.add("Strategic");
  }

  // Add location-based tags
  if (/(florida|miami|fort lauderdale)/i.test(text)) tags.add("Florida");
  if (/(california|san diego|los angeles|san francisco)/i.test(text)) tags.add("California");
  if (/(mediterranean|monaco|france|italy|spain|greece)/i.test(text)) tags.add("Mediterranean");
  if (/(caribbean|bahamas|bermuda)/i.test(text)) tags.add("Caribbean");
  if (/(northeast|new england|new york|connecticut)/i.test(text)) tags.add("Northeast US");

  // Add vessel type tags
  if (/(superyacht|megayacht|yacht)/i.test(text)) tags.add("Superyacht");
  if (/(sailboat|sailing)/i.test(text)) tags.add("Sailing");
  if (/(powerboat|motor)/i.test(text)) tags.add("Powerboat");

  // Add size/scale tags
  if (/(luxury|high-end|premium)/i.test(text)) tags.add("Luxury");
  if (/(budget|affordable|economy)/i.test(text)) tags.add("Budget");
  if (/(large|major|significant)/i.test(text)) tags.add("Large Scale");

  // Default to General if no categories matched
  const categoryArray = Array.from(categories);
  
  return {
    categories: categoryArray.length > 0 ? categoryArray : ["General"],
    tags: Array.from(tags),
    confidence,
    region: "US/Domestic"
  };
}

export function getTopCategories(): string[] {
  return [
    "Macro",
    "M&A",
    "Marina Sale",
    "Development",
    "Operations",
    "Regulatory",
    "Environmental",
    "Technology",
    "Boat Sales",
    "Boat Show",
    "Manufacturing",
    "Industry Trends",
    "Education",
    "Insurance",
    "People Moves",
    "Company Earnings",
    "Awards",
    "Business Planning",
    "General"
  ];
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Macro": "bg-yellow-100 text-yellow-800",
    "M&A": "bg-orange-100 text-orange-800",
    "Marina Sale": "bg-emerald-100 text-emerald-800",
    "Development": "bg-purple-100 text-purple-800",
    "Operations": "bg-blue-100 text-blue-800",
    "Regulatory": "bg-red-100 text-red-800",
    "Environmental": "bg-teal-100 text-teal-800",
    "Technology": "bg-indigo-100 text-indigo-800",
    "Boat Sales": "bg-cyan-100 text-cyan-800",
    "Boat Show": "bg-pink-100 text-pink-800",
    "Manufacturing": "bg-slate-100 text-slate-800",
    "Industry Trends": "bg-amber-100 text-amber-800",
    "Education": "bg-lime-100 text-lime-800",
    "Insurance": "bg-rose-100 text-rose-800",
    "People Moves": "bg-teal-100 text-teal-800",
    "Company Earnings": "bg-green-100 text-green-800",
    "Awards": "bg-amber-100 text-amber-800",
    "Business Planning": "bg-violet-100 text-violet-800",
    "General": "bg-gray-100 text-gray-800"
  };
  
  return colors[category] || colors["General"];
}

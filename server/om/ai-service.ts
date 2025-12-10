import OpenAI from "openai";

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured. Please ensure the OpenAI integration is set up.");
  }
  
  return new OpenAI({ baseURL, apiKey });
}

export interface PropertyContext {
  propertyName?: string;
  propertyType?: string;
  location?: string;
  size?: string;
  yearBuilt?: string;
  occupancy?: string;
  askingPrice?: string;
  noi?: string;
  capRate?: string;
  tenants?: string[];
  amenities?: string[];
  additionalNotes?: string;
}

export interface MarketContext {
  location?: string;
  medianRent?: number;
  vacancyRate?: number;
  population?: number;
  employmentGrowth?: number;
  medianIncome?: number;
  marketTrends?: string;
}

export interface GenerateRequest {
  type: 'executive_summary' | 'investment_highlights' | 'market_commentary' | 'financial_analysis' | 'property_description' | 'marina_overview' | 'custom';
  propertyContext?: PropertyContext;
  marketContext?: MarketContext;
  customPrompt?: string;
  existingContent?: string;
  tone?: 'professional' | 'compelling' | 'conservative';
}

const SYSTEM_PROMPT = `You are an expert commercial real estate analyst and copywriter specializing in creating professional Offering Memorandums (OMs) for marina properties. Your writing is:
- Clear, concise, and professional
- Data-driven when numbers are provided
- Compelling but not hyperbolic
- Appropriate for institutional investors and lenders

When given property data, incorporate the specifics naturally. If data is missing, write general but relevant content that can be customized later.`;

function buildExecutiveSummaryPrompt(context: PropertyContext): string {
  const parts = [];
  if (context.propertyName) parts.push(`Property: ${context.propertyName}`);
  if (context.propertyType) parts.push(`Type: ${context.propertyType}`);
  if (context.location) parts.push(`Location: ${context.location}`);
  if (context.size) parts.push(`Size: ${context.size}`);
  if (context.yearBuilt) parts.push(`Year Built: ${context.yearBuilt}`);
  if (context.occupancy) parts.push(`Occupancy: ${context.occupancy}`);
  if (context.askingPrice) parts.push(`Asking Price: ${context.askingPrice}`);
  if (context.noi) parts.push(`NOI: ${context.noi}`);
  if (context.capRate) parts.push(`Cap Rate: ${context.capRate}`);
  if (context.tenants?.length) parts.push(`Tenants: ${context.tenants.join(', ')}`);
  if (context.additionalNotes) parts.push(`Notes: ${context.additionalNotes}`);

  const contextStr = parts.length > 0 ? `\n\nProperty Information:\n${parts.join('\n')}` : '';

  return `Write a compelling executive summary paragraph (150-200 words) for a marina investment Offering Memorandum.${contextStr}

The executive summary should:
1. Open with the investment opportunity
2. Highlight key property attributes (slips, fuel sales, amenities)
3. Emphasize value drivers and upside potential
4. Close with a call to action or investment thesis

Write in third person, professional tone. Do not use bullet points - write in flowing paragraphs.`;
}

function buildInvestmentHighlightsPrompt(context: PropertyContext): string {
  const parts = [];
  if (context.propertyType) parts.push(`Property Type: ${context.propertyType}`);
  if (context.location) parts.push(`Location: ${context.location}`);
  if (context.occupancy) parts.push(`Occupancy: ${context.occupancy}`);
  if (context.noi) parts.push(`NOI: ${context.noi}`);
  if (context.capRate) parts.push(`Cap Rate: ${context.capRate}`);
  if (context.amenities?.length) parts.push(`Amenities: ${context.amenities.join(', ')}`);
  if (context.additionalNotes) parts.push(`Additional Info: ${context.additionalNotes}`);

  const contextStr = parts.length > 0 ? `\n\nProperty Details:\n${parts.join('\n')}` : '';

  return `Generate 5-7 compelling investment highlights as bullet points for a marina investment Offering Memorandum.${contextStr}

Each bullet should:
- Start with a strong action word or key metric
- Be concise (one line each)
- Focus on value, stability, or growth potential
- Be data-driven when numbers are available

Format as a simple bulleted list with each point on its own line starting with "• ".`;
}

function buildMarketCommentaryPrompt(context: MarketContext): string {
  const parts = [];
  if (context.location) parts.push(`Location: ${context.location}`);
  if (context.medianRent) parts.push(`Median Slip Rate: $${context.medianRent.toLocaleString()}`);
  if (context.vacancyRate) parts.push(`Vacancy Rate: ${context.vacancyRate}%`);
  if (context.population) parts.push(`Population: ${context.population.toLocaleString()}`);
  if (context.employmentGrowth) parts.push(`Employment Growth: ${context.employmentGrowth}%`);
  if (context.medianIncome) parts.push(`Median Household Income: $${context.medianIncome.toLocaleString()}`);
  if (context.marketTrends) parts.push(`Trends: ${context.marketTrends}`);

  const contextStr = parts.length > 0 ? `\n\nMarket Data:\n${parts.join('\n')}` : '';

  return `Write a market overview section (150-200 words) for a marina investment Offering Memorandum.${contextStr}

The market commentary should:
1. Describe the local/regional marina market conditions
2. Highlight positive boating and watercraft ownership trends
3. Discuss supply/demand dynamics for marina slips
4. Position the property favorably within the market context

Write in flowing paragraphs with a professional, analytical tone.`;
}

function buildFinancialAnalysisPrompt(context: PropertyContext): string {
  const parts = [];
  if (context.askingPrice) parts.push(`Asking Price: ${context.askingPrice}`);
  if (context.noi) parts.push(`NOI: ${context.noi}`);
  if (context.capRate) parts.push(`Cap Rate: ${context.capRate}`);
  if (context.occupancy) parts.push(`Occupancy: ${context.occupancy}`);
  if (context.additionalNotes) parts.push(`Additional Financial Info: ${context.additionalNotes}`);

  const contextStr = parts.length > 0 ? `\n\nFinancial Data:\n${parts.join('\n')}` : '';

  return `Write a financial analysis narrative (100-150 words) for a marina investment Offering Memorandum.${contextStr}

The analysis should:
1. Summarize the investment metrics
2. Explain the income stability from slip rentals, fuel sales, and ancillary revenue
3. Discuss potential for value enhancement
4. Maintain a factual, analytical tone

Do not make specific projections unless data supports them. Write in flowing paragraphs.`;
}

function buildPropertyDescriptionPrompt(context: PropertyContext): string {
  const parts = [];
  if (context.propertyName) parts.push(`Name: ${context.propertyName}`);
  if (context.propertyType) parts.push(`Type: ${context.propertyType}`);
  if (context.location) parts.push(`Location: ${context.location}`);
  if (context.size) parts.push(`Size: ${context.size}`);
  if (context.yearBuilt) parts.push(`Year Built: ${context.yearBuilt}`);
  if (context.amenities?.length) parts.push(`Amenities: ${context.amenities.join(', ')}`);
  if (context.additionalNotes) parts.push(`Notes: ${context.additionalNotes}`);

  const contextStr = parts.length > 0 ? `\n\nProperty Information:\n${parts.join('\n')}` : '';

  return `Write a property description (150-200 words) for a marina investment Offering Memorandum.${contextStr}

The description should:
1. Describe the physical attributes including slips, docks, buildings
2. Highlight key features and amenities (fuel dock, ship store, dry storage)
3. Discuss water access and visibility
4. Create a vivid picture for potential investors

Write in flowing paragraphs with descriptive but professional language.`;
}

function buildMarinaOverviewPrompt(context: PropertyContext): string {
  const parts = [];
  if (context.propertyName) parts.push(`Marina Name: ${context.propertyName}`);
  if (context.location) parts.push(`Location: ${context.location}`);
  if (context.size) parts.push(`Total Slips/Capacity: ${context.size}`);
  if (context.occupancy) parts.push(`Occupancy: ${context.occupancy}`);
  if (context.amenities?.length) parts.push(`Amenities & Services: ${context.amenities.join(', ')}`);
  if (context.additionalNotes) parts.push(`Notes: ${context.additionalNotes}`);

  const contextStr = parts.length > 0 ? `\n\nMarina Details:\n${parts.join('\n')}` : '';

  return `Write a comprehensive marina overview (200-250 words) for an Offering Memorandum.${contextStr}

The overview should cover:
1. Marina operations and services (wet slips, dry storage, fuel sales, ship store)
2. Location advantages (waterway access, proximity to attractions, boating routes)
3. Customer base and occupancy characteristics
4. Revenue streams and operational highlights

Write in flowing paragraphs with an investor-focused perspective.`;
}

export async function generateOmContent(request: GenerateRequest): Promise<string> {
  let userPrompt: string;

  switch (request.type) {
    case 'executive_summary':
      userPrompt = buildExecutiveSummaryPrompt(request.propertyContext || {});
      break;
    case 'investment_highlights':
      userPrompt = buildInvestmentHighlightsPrompt(request.propertyContext || {});
      break;
    case 'market_commentary':
      userPrompt = buildMarketCommentaryPrompt(request.marketContext || {});
      break;
    case 'financial_analysis':
      userPrompt = buildFinancialAnalysisPrompt(request.propertyContext || {});
      break;
    case 'property_description':
      userPrompt = buildPropertyDescriptionPrompt(request.propertyContext || {});
      break;
    case 'marina_overview':
      userPrompt = buildMarinaOverviewPrompt(request.propertyContext || {});
      break;
    case 'custom':
      if (!request.customPrompt || request.customPrompt.trim().length === 0) {
        userPrompt = 'Write a professional paragraph for a marina investment offering memorandum describing an investment opportunity.';
      } else {
        userPrompt = request.customPrompt;
      }
      break;
    default:
      userPrompt = 'Write a professional executive summary paragraph for a marina investment offering memorandum.';
  }

  if (request.existingContent) {
    userPrompt += `\n\nExisting content to improve or expand upon:\n${request.existingContent}`;
  }

  if (request.tone) {
    const toneDescriptions = {
      professional: 'Use a formal, professional tone appropriate for institutional investors.',
      compelling: 'Use an engaging, persuasive tone that highlights opportunities.',
      conservative: 'Use a measured, conservative tone that focuses on stability and risk mitigation.',
    };
    userPrompt += `\n\nTone: ${toneDescriptions[request.tone]}`;
  }

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || '';
}

export async function improveContent(content: string, instruction: string): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Improve the following content for a marina investment Offering Memorandum.

Instruction: ${instruction}

Content to improve:
${content}

Provide only the improved content without explanations or commentary.` }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || content;
}

export async function suggestLayout(contentDescription: string): Promise<{
  suggestedTemplate: string;
  reasoning: string;
  blocks: { type: string; content: string }[];
}> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert at designing professional document layouts for marina investment Offering Memorandums." },
      { role: "user", content: `Based on the following content description, suggest an optimal page layout.

Content description: ${contentDescription}

Respond in JSON format with:
{
  "suggestedTemplate": "cover" | "hero-with-body" | "single-column" | "two-column",
  "reasoning": "Brief explanation of why this layout works",
  "blocks": [
    { "type": "text" | "chart" | "table" | "image" | "kpi", "content": "Brief description of what goes here" }
  ]
}` }
    ],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: "json_object" }
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    return {
      suggestedTemplate: 'single-column',
      reasoning: 'Default layout',
      blocks: [{ type: 'text', content: contentDescription }]
    };
  }
}

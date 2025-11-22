import Anthropic from '@anthropic-ai/sdk';
import { ComparativeAnalysis, AnalyticsFilters } from './analyticsService';

const anthropic = new Anthropic({
  apiKey: process.env.OPENAI_API_KEY, // Replit's integration uses this key name
});

export interface AIInsight {
  category: 'trend' | 'opportunity' | 'risk' | 'anomaly' | 'strategic';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number; // 1-5, where 5 is highest priority
}

function formatFiltersForPrompt(filters: AnalyticsFilters): string {
  const parts: string[] = [];
  
  if (filters.states && filters.states.length > 0) {
    parts.push(`States: ${filters.states.join(', ')}`);
  }
  if (filters.yearSoldMin || filters.yearSoldMax) {
    const range = [];
    if (filters.yearSoldMin) range.push(`from ${filters.yearSoldMin}`);
    if (filters.yearSoldMax) range.push(`to ${filters.yearSoldMax}`);
    parts.push(`Years: ${range.join(' ')}`);
  }
  if (filters.priceMin || filters.priceMax) {
    const range = [];
    if (filters.priceMin) range.push(`from $${(filters.priceMin / 1000000).toFixed(1)}M`);
    if (filters.priceMax) range.push(`to $${(filters.priceMax / 1000000).toFixed(1)}M`);
    parts.push(`Price Range: ${range.join(' ')}`);
  }
  if (filters.waterTypes && filters.waterTypes.length > 0) {
    parts.push(`Water Types: ${filters.waterTypes.join(', ')}`);
  }
  if (filters.capacityMin || filters.capacityMax) {
    const range = [];
    if (filters.capacityMin) range.push(`from ${filters.capacityMin} slips`);
    if (filters.capacityMax) range.push(`to ${filters.capacityMax} slips`);
    parts.push(`Capacity: ${range.join(' ')}`);
  }
  
  return parts.length > 0 ? parts.join('\n') : 'No filters applied (analyzing all comps)';
}

function formatMetricsForPrompt(analysis: ComparativeAnalysis): string {
  const { overall, byState, byYear, byWaterType, byPriceRange, trends } = analysis;
  
  let prompt = `### Overall Market Statistics (${overall.count} properties)
- Average Sale Price: $${(overall.avgPrice / 1000000).toFixed(2)}M (Median: $${(overall.medianPrice / 1000000).toFixed(2)}M)
- Average Price Per Slip: $${overall.avgPricePerSlip.toLocaleString()} (Median: $${overall.medianPricePerSlip.toLocaleString()})
- Average Cap Rate: ${(overall.avgCapRate * 100).toFixed(2)}% (Median: ${(overall.medianCapRate * 100).toFixed(2)}%)
- Average Capacity: ${overall.avgCapacity.toFixed(0)} slips
- Total Market Value: $${(overall.totalValue / 1000000).toFixed(2)}M
`;

  if (byState && Object.keys(byState).length > 0) {
    const stateData = Object.entries(byState)
      .map(([state, metrics]) => ({
        state,
        avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
        count: metrics.find(m => m.metric === 'count')?.value || 0,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 5);
    
    prompt += `\n### Top 5 States by Average Price:\n`;
    stateData.forEach(s => {
      prompt += `- ${s.state}: $${(s.avgPrice / 1000000).toFixed(2)}M (${s.count} properties)\n`;
    });
  }

  if (trends && trends.priceOverTime.length > 1) {
    const sortedYears = [...trends.priceOverTime].sort((a, b) => a.year - b.year);
    const first = sortedYears[0];
    const last = sortedYears[sortedYears.length - 1];
    const cagr = Math.pow(last.avgPrice / first.avgPrice, 1 / (last.year - first.year)) - 1;
    
    prompt += `\n### Price Trends:
- CAGR (${first.year}-${last.year}): ${(cagr * 100).toFixed(2)}%
- Recent Year (${last.year}): $${(last.avgPrice / 1000000).toFixed(2)}M avg price (${last.count} sales)
- Earliest Year (${first.year}): $${(first.avgPrice / 1000000).toFixed(2)}M avg price (${first.count} sales)
`;
  }

  if (byWaterType && Object.keys(byWaterType).length > 0) {
    prompt += `\n### By Water Type:\n`;
    Object.entries(byWaterType).forEach(([type, metrics]) => {
      const count = metrics.find(m => m.metric === 'count')?.value || 0;
      const avgPrice = metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0;
      prompt += `- ${type}: $${avgPrice.toLocaleString()} per slip (${count} properties)\n`;
    });
  }

  if (byPriceRange && Object.keys(byPriceRange).length > 0) {
    prompt += `\n### By Price Range:\n`;
    Object.entries(byPriceRange).forEach(([range, metrics]) => {
      const count = metrics.find(m => m.metric === 'count')?.value || 0;
      const avgCapRate = metrics.find(m => m.metric === 'avgCapRate')?.value || 0;
      prompt += `- ${range}: ${count} properties, avg cap rate ${(avgCapRate * 100).toFixed(2)}%\n`;
    });
  }

  return prompt;
}

export async function generateAIInsights(
  analysis: ComparativeAnalysis,
  filters: AnalyticsFilters
): Promise<AIInsight[]> {
  try {
    const filtersText = formatFiltersForPrompt(filters);
    const metricsText = formatMetricsForPrompt(analysis);

    const prompt = `You are a marina industry analyst for a private equity firm analyzing marina sales comparables. Based on the filtered dataset and metrics below, generate 5-8 institutional-grade insights for investment decision-making.

## Applied Filters:
${filtersText}

## Market Data:
${metricsText}

## Instructions:
Generate insights that would be valuable for a PE firm evaluating marina acquisitions. Focus on:
1. Market trends and pricing dynamics
2. Investment opportunities (undervalued markets, growth potential)
3. Risks and anomalies worth investigating
4. Strategic recommendations for portfolio optimization
5. Comparative advantages across geographies or property types

For each insight, provide:
- category: One of: trend, opportunity, risk, anomaly, strategic
- title: A concise headline (max 10 words)
- description: A detailed 2-3 sentence explanation with specific numbers from the data
- confidence: high, medium, or low based on data quality and sample size
- priority: 1-5 (5 being highest priority for decision-making)

Return ONLY a valid JSON array of insights, with no additional text. Example format:
[
  {
    "category": "trend",
    "title": "Accelerating Price Growth in Southeast Markets",
    "description": "Marina sale prices in FL and GA have shown a 12.5% CAGR from 2020-2024, significantly outpacing the national average of 8.2%. This trend is driven by strong demographic tailwinds and limited new supply in coastal markets.",
    "confidence": "high",
    "priority": 5
  }
]`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the JSON response
    const insights: AIInsight[] = JSON.parse(content.text);
    
    // Validate and sort by priority
    return insights
      .filter(insight => 
        insight.category && 
        insight.title && 
        insight.description &&
        insight.confidence &&
        typeof insight.priority === 'number'
      )
      .sort((a, b) => b.priority - a.priority);

  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Fallback to basic insights if AI fails
    return [
      {
        category: 'trend',
        title: 'Market Overview Available',
        description: `Analyzed ${analysis.overall.count} marina sales with an average price of $${(analysis.overall.avgPrice / 1000000).toFixed(2)}M. AI analysis temporarily unavailable - basic statistics shown above.`,
        confidence: 'high',
        priority: 3,
      },
    ];
  }
}

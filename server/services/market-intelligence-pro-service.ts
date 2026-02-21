/**
 * Market Intelligence Pro Service
 * 
 * Provides AI-powered cross-module analysis and investor-grade insights
 * by aggregating data from CRM, Due Diligence, Modeling, and Docket.
 * 
 * Requires analytics_pro pack subscription.
 */

import OpenAI from 'openai';
import { db } from '../db';
import { 
  crmDeals, 
  projects, 
  modelingProjects, 
  articles,
  salesComps
} from '@shared/schema';
import { eq, and, gte, desc, sql, count } from 'drizzle-orm';
import { createChildLogger } from '../lib/logger';

const logger = createChildLogger({ module: 'market-intelligence-pro' });

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface CrossModuleInsight {
  id: string;
  category: 'market_trend' | 'deal_opportunity' | 'risk_alert' | 'strategic_recommendation' | 'competitive_intel';
  title: string;
  summary: string;
  details: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number;
  relatedModules: string[];
  actionItems?: string[];
  generatedAt: Date;
}

export interface MarketIntelligenceProReport {
  executiveSummary: string;
  insights: CrossModuleInsight[];
  marketOverview: {
    totalDealsInPipeline: number;
    totalDealValue: number;
    activeDdProjects: number;
    modelingProjectsCount: number;
    recentNewsCount: number;
    avgDealProgress: number;
  };
  trends: {
    dealVelocity: string;
    marketSentiment: string;
    competitiveActivity: string;
  };
  generatedAt: Date;
}

interface ModuleData {
  deals: any[];
  ddProjects: any[];
  modelingProjects: any[];
  newsArticles: any[];
  salesComps: any[];
}

async function fetchCrossModuleData(orgId: string, daysBack: number = 30): Promise<ModuleData> {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - daysBack);

  const [deals, ddProjectsData, modelingProjectsData, newsArticlesData, salesCompsData] = await Promise.all([
    db.select({
      id: crmDeals.id,
      title: crmDeals.title,
      stage: crmDeals.stage,
      amount: crmDeals.amount,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
    })
    .from(crmDeals)
    .where(eq(crmDeals.ownerId, orgId))
    .orderBy(desc(crmDeals.updatedAt))
    .limit(50),

    db.select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      progress: projects.progress,
      priority: projects.priority,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .orderBy(desc(projects.createdAt))
    .limit(30),

    db.select({
      id: modelingProjects.id,
      marinaName: modelingProjects.marinaName,
      purchasePrice: modelingProjects.purchasePrice,
      ebitda: modelingProjects.ebitda,
      year1CapRate: modelingProjects.year1CapRate,
      dealOutcome: modelingProjects.dealOutcome,
      createdAt: modelingProjects.createdAt,
    })
    .from(modelingProjects)
    .where(eq(modelingProjects.orgId, orgId))
    .orderBy(desc(modelingProjects.createdAt))
    .limit(20),

    db.select({
      id: articles.id,
      title: articles.title,
      category: articles.category,
      summary: articles.summary,
      sentiment: articles.sentiment,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(gte(articles.publishedAt, dateThreshold))
    .orderBy(desc(articles.publishedAt))
    .limit(50),

    db.select({
      id: salesComps.id,
      marina: salesComps.marina,
      salePrice: salesComps.salePrice,
      saleYear: salesComps.saleYear,
      state: salesComps.state,
      wetSlips: salesComps.wetSlips,
      dryRacks: salesComps.dryRacks,
    })
    .from(salesComps)
    .where(eq(salesComps.orgId, orgId))
    .orderBy(desc(salesComps.createdAt))
    .limit(30),
  ]);

  return {
    deals,
    ddProjects: ddProjectsData,
    modelingProjects: modelingProjectsData,
    newsArticles: newsArticlesData,
    salesComps: salesCompsData,
  };
}

function formatDataForPrompt(data: ModuleData): string {
  const sections: string[] = [];

  if (data.deals.length > 0) {
    const totalValue = data.deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const avgProbability = data.deals.reduce((sum, d) => sum + (d.probability || 0), 0) / data.deals.length;
    const stageDistribution: Record<string, number> = {};
    data.deals.forEach(d => {
      stageDistribution[d.stage || 'unknown'] = (stageDistribution[d.stage || 'unknown'] || 0) + 1;
    });

    sections.push(`## CRM PIPELINE DATA
- Total Deals: ${data.deals.length}
- Total Pipeline Value: $${(totalValue / 1000000).toFixed(2)}M
- Average Win Probability: ${(avgProbability * 100).toFixed(1)}%
- Stage Distribution: ${Object.entries(stageDistribution).map(([s, c]) => `${s}(${c})`).join(', ')}
- Recent Deals: ${data.deals.slice(0, 5).map(d => d.title).join(', ')}`);
  }

  if (data.ddProjects.length > 0) {
    const avgProgress = data.ddProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / data.ddProjects.length;
    const statusDistribution: Record<string, number> = {};
    data.ddProjects.forEach(p => {
      statusDistribution[p.status || 'unknown'] = (statusDistribution[p.status || 'unknown'] || 0) + 1;
    });

    sections.push(`## DUE DILIGENCE PROJECTS
- Total Projects: ${data.ddProjects.length}
- Average Progress: ${avgProgress.toFixed(1)}%
- Status Distribution: ${Object.entries(statusDistribution).map(([s, c]) => `${s}(${c})`).join(', ')}`);
  }

  if (data.modelingProjects.length > 0) {
    const totalPurchaseValue = data.modelingProjects.reduce((sum, p) => sum + (Number(p.purchasePrice) || 0), 0);
    const avgCapRate = data.modelingProjects
      .filter(p => p.year1CapRate)
      .reduce((sum, p) => sum + (Number(p.year1CapRate) || 0), 0) / 
      (data.modelingProjects.filter(p => p.year1CapRate).length || 1);

    sections.push(`## MODELING & VALUATION
- Total Projects: ${data.modelingProjects.length}
- Combined Purchase Value: $${(totalPurchaseValue / 1000000).toFixed(2)}M
- Average Cap Rate: ${(avgCapRate * 100).toFixed(2)}%
- Projects: ${data.modelingProjects.slice(0, 5).map(p => p.marinaName).join(', ')}`);
  }

  if (data.newsArticles.length > 0) {
    const categoryDistribution: Record<string, number> = {};
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    data.newsArticles.forEach(a => {
      categoryDistribution[a.category || 'General'] = (categoryDistribution[a.category || 'General'] || 0) + 1;
      if (a.sentiment) {
        if (a.sentiment > 0.2) sentimentCounts.positive++;
        else if (a.sentiment < -0.2) sentimentCounts.negative++;
        else sentimentCounts.neutral++;
      }
    });

    sections.push(`## MARKET NEWS & DOCKET
- Recent Articles: ${data.newsArticles.length}
- Categories: ${Object.entries(categoryDistribution).slice(0, 5).map(([c, n]) => `${c}(${n})`).join(', ')}
- Sentiment: Positive(${sentimentCounts.positive}), Neutral(${sentimentCounts.neutral}), Negative(${sentimentCounts.negative})
- Recent Headlines: ${data.newsArticles.slice(0, 3).map(a => a.title).join('; ')}`);
  }

  if (data.salesComps.length > 0) {
    const avgPrice = data.salesComps
      .filter(c => c.salePrice)
      .reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0) / 
      (data.salesComps.filter(c => c.salePrice).length || 1);
    const stateDistribution: Record<string, number> = {};
    data.salesComps.forEach(c => {
      if (c.state) stateDistribution[c.state] = (stateDistribution[c.state] || 0) + 1;
    });

    sections.push(`## SALES COMPARABLES
- Total Comps: ${data.salesComps.length}
- Average Sale Price: $${(avgPrice / 1000000).toFixed(2)}M
- Geographic Distribution: ${Object.entries(stateDistribution).slice(0, 5).map(([s, c]) => `${s}(${c})`).join(', ')}`);
  }

  return sections.join('\n\n');
}

export async function generateCrossModuleInsights(orgId: string): Promise<MarketIntelligenceProReport> {
  try {
    const data = await fetchCrossModuleData(orgId);

    const marketOverview = {
      totalDealsInPipeline: data.deals.length,
      totalDealValue: data.deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
      activeDdProjects: data.ddProjects.filter(p => p.status !== 'completed').length,
      modelingProjectsCount: data.modelingProjects.length,
      recentNewsCount: data.newsArticles.length,
      avgDealProgress: data.deals.length > 0 
        ? data.deals.reduce((sum, d) => sum + (d.probability || 0), 0) / data.deals.length * 100 
        : 0,
    };

    const formattedData = formatDataForPrompt(data);

    if (!formattedData || formattedData.trim().length === 0) {
      return {
        executiveSummary: "No data available for analysis. Add deals, projects, and market data to generate insights.",
        insights: [],
        marketOverview,
        trends: {
          dealVelocity: "Insufficient data",
          marketSentiment: "Neutral",
          competitiveActivity: "Unknown",
        },
        generatedAt: new Date(),
      };
    }

    const systemPrompt = `You are an institutional-grade marina acquisition analyst providing strategic insights for private equity firms. Analyze the cross-module data and provide actionable intelligence.

Your analysis should identify:
1. Market trends and opportunities
2. Deal pipeline health and velocity
3. Risk factors and red flags
4. Strategic recommendations
5. Competitive intelligence

Respond in JSON format with:
{
  "executiveSummary": "2-3 sentence summary for executives",
  "insights": [
    {
      "category": "market_trend|deal_opportunity|risk_alert|strategic_recommendation|competitive_intel",
      "title": "Brief title",
      "summary": "One sentence summary",
      "details": "2-3 sentence explanation",
      "confidence": "high|medium|low",
      "priority": 1-5 (5 is highest),
      "relatedModules": ["CRM", "DD", "Modeling", "The Docket", "SalesComps"],
      "actionItems": ["Action 1", "Action 2"]
    }
  ],
  "trends": {
    "dealVelocity": "description of deal flow speed",
    "marketSentiment": "bullish|neutral|bearish with brief reasoning",
    "competitiveActivity": "description of competitive landscape"
  }
}

Limit to 5-7 highest priority insights.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Analyze this cross-module marina acquisition data and provide strategic insights:\n\n${formattedData}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Unexpected response format from AI');
    }

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.error({ error: parseError }, 'Failed to parse AI response');
      return {
        executiveSummary: "Analysis in progress. Please try again.",
        insights: [],
        marketOverview,
        trends: {
          dealVelocity: "Analysis pending",
          marketSentiment: "Neutral",
          competitiveActivity: "Unknown",
        },
        generatedAt: new Date(),
      };
    }

    const insights: CrossModuleInsight[] = (parsed.insights || []).map((i: any, idx: number) => ({
      id: `insight-${Date.now()}-${idx}`,
      category: i.category || 'strategic_recommendation',
      title: i.title || 'Insight',
      summary: i.summary || '',
      details: i.details || '',
      confidence: i.confidence || 'medium',
      priority: i.priority || 3,
      relatedModules: i.relatedModules || [],
      actionItems: i.actionItems || [],
      generatedAt: new Date(),
    }));

    return {
      executiveSummary: parsed.executiveSummary || "Analysis complete.",
      insights: insights.sort((a, b) => b.priority - a.priority),
      marketOverview,
      trends: {
        dealVelocity: parsed.trends?.dealVelocity || "Normal",
        marketSentiment: parsed.trends?.marketSentiment || "Neutral",
        competitiveActivity: parsed.trends?.competitiveActivity || "Unknown",
      },
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to generate cross-module insights');
    throw error;
  }
}

export async function getMarketIntelligenceProSummary(orgId: string): Promise<{
  hasData: boolean;
  dealCount: number;
  ddProjectCount: number;
  modelingProjectCount: number;
  newsCount: number;
  compsCount: number;
}> {
  const data = await fetchCrossModuleData(orgId, 30);
  
  return {
    hasData: data.deals.length > 0 || data.ddProjects.length > 0 || data.modelingProjects.length > 0,
    dealCount: data.deals.length,
    ddProjectCount: data.ddProjects.length,
    modelingProjectCount: data.modelingProjects.length,
    newsCount: data.newsArticles.length,
    compsCount: data.salesComps.length,
  };
}

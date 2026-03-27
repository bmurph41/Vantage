/**
 * server/services/exit-ai-insights-service.ts
 *
 * AI-powered exit strategy insights using Claude.
 * Loads exit scenario data for a project and generates
 * institutional-grade analysis and recommendations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  exitScenarios,
  exitScenarioKpis,
  modelingProjects,
  capitalStacks,
} from '@shared/schema';
import { checkAISpendingLimit, trackAIUsage } from './ai/spending-guard';

const anthropic = new Anthropic({
  apiKey: process.env.OPENAI_API_KEY, // Replit integration key
});

export interface ExitAIInsight {
  category: 'market_timing' | 'tax_strategy' | 'risk_factor' | 'value_enhancement' | 'strategic';
  title: string;
  description: string;
  confidence: 'High' | 'Medium' | 'Low';
  impact: 'Positive' | 'Caution' | 'Neutral';
  priority: number;
}

export interface ExitAIAnalysisResult {
  insights: ExitAIInsight[];
  recommendations: string[];
  strategyComparison: {
    strategy: string;
    liquidity: string;
    taxEfficiency: string;
    complexity: string;
    bestFor: string;
    recommended?: boolean;
  }[];
}

async function loadProjectExitData(projectId: string) {
  const [project] = await db.select()
    .from(modelingProjects)
    .where(eq(modelingProjects.id, projectId))
    .limit(1);

  if (!project) return null;

  const scenarios = await db.select()
    .from(exitScenarios)
    .where(eq(exitScenarios.modelingProjectId, projectId));

  const scenarioIds = scenarios.map(s => s.id);
  let kpis: any[] = [];
  if (scenarioIds.length > 0) {
    for (const sid of scenarioIds) {
      const [kpi] = await db.select()
        .from(exitScenarioKpis)
        .where(eq(exitScenarioKpis.scenarioId, sid))
        .limit(1);
      if (kpi) kpis.push({ ...kpi, scenarioId: sid });
    }
  }

  const [stack] = await db.select()
    .from(capitalStacks)
    .where(eq(capitalStacks.modelingProjectId, projectId))
    .limit(1);

  return { project, scenarios, kpis, stack };
}

function formatExitDataForPrompt(data: NonNullable<Awaited<ReturnType<typeof loadProjectExitData>>>): string {
  const { project, scenarios, kpis, stack } = data;

  let prompt = `### Property: ${project.propertyName || 'Unknown'}
- Asset Class: ${project.assetClass || 'marina'}
- Purchase Price: $${Number(project.purchasePrice || 0).toLocaleString()}
- Estimated Value: $${Number(project.estimatedValue || 0).toLocaleString()}
- Cap Rate: ${project.capRate || 'N/A'}%
`;

  if (stack) {
    prompt += `- Hold Period: ${stack.holdPeriodYears || 5} years
- Total Debt: $${Number(stack.totalDebt || 0).toLocaleString()}
- Exit Cap Rate: ${stack.exitCapRate || 'N/A'}%
`;
  }

  if (scenarios.length > 0) {
    prompt += `\n### Exit Scenarios (${scenarios.length} modeled):\n`;
    for (const s of scenarios) {
      const kpi = kpis.find((k: any) => k.scenarioId === s.id);
      prompt += `\n**${s.scenarioName || s.scenarioType}** (${s.scenarioType}, status: ${s.status})
- Exit Cap Rate: ${s.exitCapRate || 'N/A'}%
- Hold Period: ${s.holdingPeriodYears || 'N/A'} years
- Projected Sale Price: $${Number(s.projectedSalePrice || 0).toLocaleString()}
- Exit NOI: $${Number(s.exitNoi || 0).toLocaleString()}
- Net Proceeds: $${Number(s.netProceeds || 0).toLocaleString()}
`;
      if (kpi) {
        prompt += `- After-Tax Cash (Now): $${Number(kpi.afterTaxCashNow || 0).toLocaleString()}
- After-Tax Cash (Total): $${Number(kpi.afterTaxCashTotal || 0).toLocaleString()}
- LP IRR: ${kpi.lpIrr || 'N/A'}%
- LP Equity Multiple: ${kpi.lpEquityMultiple || 'N/A'}x
- Strategies Active: ${(kpi.strategiesActive as string[] || []).join(', ') || 'cash_sale'}
`;
      }
    }
  } else {
    prompt += `\n### No exit scenarios modeled yet.\n`;
  }

  return prompt;
}

export async function generateExitAIInsights(
  projectId: string,
  customPrompt?: string,
  context?: { orgId: string; userId: string },
): Promise<ExitAIAnalysisResult> {
  // Check spending limit
  if (context?.orgId) {
    const limitCheck = await checkAISpendingLimit(context.orgId, 15);
    if (!limitCheck.allowed) {
      return {
        insights: [{
          category: 'risk_factor',
          title: 'AI Analysis Limit Reached',
          description: 'Monthly AI spending limit reached. Contact support to increase your limit.',
          confidence: 'High',
          impact: 'Caution',
          priority: 5,
        }],
        recommendations: ['Upgrade your AI analysis quota to continue receiving insights.'],
        strategyComparison: [],
      };
    }
  }

  const data = await loadProjectExitData(projectId);
  if (!data) {
    return {
      insights: [],
      recommendations: ['Create a modeling project first to receive AI exit insights.'],
      strategyComparison: [],
    };
  }

  const exitDataText = formatExitDataForPrompt(data);

  const systemPrompt = `You are an expert CRE exit strategy analyst working for an institutional real estate private equity firm. You specialize in marina, hospitality, and commercial real estate disposition strategies including outright sales, 1031 exchanges, DST investments, seller financing, and earnout structures. Provide data-driven, actionable insights.`;

  const userPrompt = `Analyze the following exit scenario data and provide institutional-grade insights.

## Property & Exit Data:
${exitDataText}

${customPrompt ? `## Additional Analysis Request:\n${customPrompt}\n` : ''}

## Instructions:
Generate a comprehensive exit analysis with:

1. **insights** — 4-6 insights covering market timing, tax strategy, risk factors, and value enhancement opportunities. Each insight must have:
   - category: "market_timing" | "tax_strategy" | "risk_factor" | "value_enhancement" | "strategic"
   - title: concise headline (max 10 words)
   - description: 2-3 sentences with specific numbers from the data where possible
   - confidence: "High" | "Medium" | "Low"
   - impact: "Positive" | "Caution" | "Neutral"
   - priority: 1-5 (5 = highest)

2. **recommendations** — 5 actionable bullet points for optimizing the exit

3. **strategyComparison** — compare 3 exit strategies relevant to this property:
   - strategy: name (e.g., "Outright Sale", "1031 Exchange", "DST Investment")
   - liquidity: "High" | "Medium" | "Low"
   - taxEfficiency: "High" | "Medium" | "Low"
   - complexity: "High" | "Medium" | "Low"
   - bestFor: one-line description of ideal use case
   - recommended: true for the single best option

Return ONLY valid JSON matching the structure above. No markdown, no extra text.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
      ],
    });

    if (context?.orgId && context?.userId && message.usage) {
      await trackAIUsage({
        orgId: context.orgId,
        userId: context.userId,
        operationType: 'insights',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        metadata: { projectId },
      });
    }

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON — strip markdown fences if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(jsonText) as ExitAIAnalysisResult;
    return result;
  } catch (error: any) {
    console.error('Exit AI insights generation failed:', error);

    // Return fallback insights based on actual data
    return buildFallbackInsights(data);
  }
}

function buildFallbackInsights(
  data: NonNullable<Awaited<ReturnType<typeof loadProjectExitData>>>,
): ExitAIAnalysisResult {
  const { project, scenarios, kpis, stack } = data;
  const purchasePrice = Number(project.purchasePrice || 0);
  const estimatedValue = Number(project.estimatedValue || 0);
  const appreciation = purchasePrice > 0
    ? ((estimatedValue - purchasePrice) / purchasePrice * 100).toFixed(1)
    : '0';

  const insights: ExitAIInsight[] = [
    {
      category: 'market_timing',
      title: 'Property Appreciation Assessment',
      description: `The property has appreciated approximately ${appreciation}% from its purchase price of $${purchasePrice.toLocaleString()} to an estimated value of $${estimatedValue.toLocaleString()}. ${Number(appreciation) > 20 ? 'This significant gain suggests favorable exit timing.' : 'Consider value-add strategies to maximize exit proceeds.'}`,
      confidence: 'Medium',
      impact: Number(appreciation) > 10 ? 'Positive' : 'Neutral',
      priority: 4,
    },
    {
      category: 'tax_strategy',
      title: '1031 Exchange Consideration',
      description: `With embedded gains of approximately $${(estimatedValue - purchasePrice).toLocaleString()}, a 1031 exchange could defer substantial capital gains tax. Evaluate DST options for passive income while maintaining tax-deferred status.`,
      confidence: 'High',
      impact: 'Positive',
      priority: 5,
    },
    {
      category: 'risk_factor',
      title: 'Interest Rate Environment',
      description: 'Current interest rate volatility may impact exit cap rates. Stress-test scenarios with 50-100bps cap rate expansion to understand downside exposure on net proceeds.',
      confidence: 'Medium',
      impact: 'Caution',
      priority: 3,
    },
    {
      category: 'value_enhancement',
      title: 'Pre-Exit NOI Optimization',
      description: 'Maximizing NOI before exit directly impacts terminal value at any cap rate. Review operational efficiency and revenue enhancement opportunities to boost exit valuation.',
      confidence: 'Medium',
      impact: 'Positive',
      priority: 4,
    },
  ];

  return {
    insights,
    recommendations: [
      'Model multiple exit strategies to compare after-tax proceeds across scenarios',
      'Engage a specialized broker to maximize competitive tension in the sale process',
      'Complete all deferred maintenance and environmental assessments before marketing',
      'Document capital improvements for basis step-up calculations',
      'Consider seller financing options to expand the buyer pool and potentially achieve a premium',
    ],
    strategyComparison: [
      {
        strategy: 'Outright Sale',
        liquidity: 'High',
        taxEfficiency: 'Low',
        complexity: 'Low',
        bestFor: 'Immediate liquidity needs, estate planning',
      },
      {
        strategy: '1031 Exchange',
        liquidity: 'Medium',
        taxEfficiency: 'High',
        complexity: 'Medium',
        bestFor: 'Continued RE investment, tax deferral',
        recommended: true,
      },
      {
        strategy: 'DST Investment',
        liquidity: 'Low',
        taxEfficiency: 'High',
        complexity: 'Low',
        bestFor: 'Passive income, estate planning, diversification',
      },
    ],
  };
}

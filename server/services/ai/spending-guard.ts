/**
 * AI Spending Guard
 * Tracks and enforces AI API spending limits
 * Default limit: $100/month per organization
 */

import { db } from '../../db';
import { aiUsageTracking, aiSpendingLimits } from '../../../shared/schema';
import { eq, sql } from 'drizzle-orm';

// Pricing per 1M tokens (in cents)
const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    'gpt-4o': { input: 250, output: 1000 },
    'gpt-4o-mini': { input: 15, output: 60 },
    'gpt-4-turbo': { input: 1000, output: 3000 },
    'gpt-3.5-turbo': { input: 50, output: 150 }
  },
  anthropic: {
    'claude-opus-4': { input: 1500, output: 7500 },
    'claude-sonnet-4': { input: 300, output: 1500 },
    'claude-3-5-sonnet-20241022': { input: 300, output: 1500 },
    'claude-sonnet-3.5': { input: 300, output: 1500 },
    'claude-haiku-3.5': { input: 100, output: 500 }
  }
};

/**
 * Calculate cost in cents for an AI API call
 */
export function calculateAICost(params: {
  provider: 'openai' | 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const modelPricing = PRICING[params.provider]?.[params.model];
  
  if (!modelPricing) {
    console.warn(`Unknown model pricing: ${params.provider}/${params.model}`);
    return Math.ceil((params.inputTokens / 1_000_000) * 1500 + (params.outputTokens / 1_000_000) * 7500);
  }
  
  const inputCost = (params.inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (params.outputTokens / 1_000_000) * modelPricing.output;
  
  return Math.ceil(inputCost + outputCost);
}

/**
 * Check if organization can make an AI call
 */
export async function checkAISpendingLimit(
  orgId: string,
  estimatedCostCents: number = 10
): Promise<{
  allowed: boolean;
  reason?: string;
  currentSpend?: number;
  limit?: number;
  remainingBudget?: number;
}> {
  try {
    let [limit] = await db.select()
      .from(aiSpendingLimits)
      .where(eq(aiSpendingLimits.orgId, orgId))
      .limit(1);
    
    if (!limit) {
      // Create default limit
      const defaultLimit = parseInt(process.env.AI_SPENDING_LIMIT_CENTS || '10000');
      [limit] = await db.insert(aiSpendingLimits).values({
        orgId,
        monthlyLimitCents: defaultLimit,
        currentMonthSpendCents: 0,
        lastResetAt: new Date()
      }).returning();
    }
    
    // Check if we need to reset for new month
    const now = new Date();
    const lastReset = new Date(limit.lastResetAt);
    
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await db.update(aiSpendingLimits)
        .set({
          currentMonthSpendCents: 0,
          lastResetAt: now,
          hardLimitReachedAt: null
        })
        .where(eq(aiSpendingLimits.orgId, orgId));
      
      return {
        allowed: true,
        currentSpend: 0,
        limit: limit.monthlyLimitCents,
        remainingBudget: limit.monthlyLimitCents
      };
    }
    
    // Check if adding this cost would exceed limit
    const newTotal = limit.currentMonthSpendCents + estimatedCostCents;
    
    if (newTotal > limit.monthlyLimitCents) {
      if (!limit.hardLimitReachedAt) {
        await db.update(aiSpendingLimits)
          .set({ hardLimitReachedAt: now })
          .where(eq(aiSpendingLimits.orgId, orgId));
      }
      
      return {
        allowed: false,
        reason: `AI spending limit reached ($${(limit.monthlyLimitCents / 100).toFixed(2)}/month)`,
        currentSpend: limit.currentMonthSpendCents,
        limit: limit.monthlyLimitCents,
        remainingBudget: 0
      };
    }
    
    return {
      allowed: true,
      currentSpend: limit.currentMonthSpendCents,
      limit: limit.monthlyLimitCents,
      remainingBudget: limit.monthlyLimitCents - newTotal
    };
  } catch (error) {
    console.error('Error checking AI spending limit:', error);
    return { allowed: true };
  }
}

/**
 * Track an AI API call
 */
export async function trackAIUsage(params: {
  orgId: string;
  userId: string;
  operationType: 'chat' | 'rag' | 'document_parse' | 'summary' | 'embedding' | 'comp_matching' | 'insights';
  provider: 'openai' | 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const costCents = calculateAICost({
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens
    });
    
    await db.insert(aiUsageTracking).values({
      orgId: params.orgId,
      userId: params.userId,
      operationType: params.operationType,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostCents: costCents,
      metadata: params.metadata || {}
    });
    
    await db.update(aiSpendingLimits)
      .set({
        currentMonthSpendCents: sql`${aiSpendingLimits.currentMonthSpendCents} + ${costCents}`
      })
      .where(eq(aiSpendingLimits.orgId, params.orgId));
    
  } catch (error) {
    console.error('Error tracking AI usage:', error);
  }
}

/**
 * Get AI usage stats for an organization
 */
export async function getAIUsageStats(orgId: string): Promise<{
  currentSpendCents: number;
  limitCents: number;
  percentUsed: number;
}> {
  try {
    const [limit] = await db.select()
      .from(aiSpendingLimits)
      .where(eq(aiSpendingLimits.orgId, orgId))
      .limit(1);
    
    if (!limit) {
      return { currentSpendCents: 0, limitCents: 10000, percentUsed: 0 };
    }
    
    return {
      currentSpendCents: limit.currentMonthSpendCents,
      limitCents: limit.monthlyLimitCents,
      percentUsed: (limit.currentMonthSpendCents / limit.monthlyLimitCents) * 100
    };
  } catch (error) {
    console.error('Error getting AI usage stats:', error);
    return { currentSpendCents: 0, limitCents: 10000, percentUsed: 0 };
  }
}

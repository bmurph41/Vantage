/**
 * AI Spending Guard
 * Tracks and enforces AI API spending limits
 * 
 * Default limit: $100/month per organization
 */

import { db } from '../db';
import { aiUsageTracking, aiSpendingLimits } from '../../shared/schema';
import { eq, and, sql, gte } from 'drizzle-orm';

// Pricing per 1M tokens (in cents)
const PRICING = {
  openai: {
    'gpt-4o': { input: 250, output: 1000 }, // $2.50 / $10.00 per 1M tokens
    'gpt-4o-mini': { input: 15, output: 60 }, // $0.15 / $0.60 per 1M tokens
    'gpt-4-turbo': { input: 1000, output: 3000 }, // $10.00 / $30.00 per 1M tokens
    'gpt-3.5-turbo': { input: 50, output: 150 } // $0.50 / $1.50 per 1M tokens
  },
  anthropic: {
    'claude-opus-4': { input: 1500, output: 7500 }, // $15.00 / $75.00 per 1M tokens
    'claude-sonnet-4': { input: 300, output: 1500 }, // $3.00 / $15.00 per 1M tokens
    'claude-sonnet-3.5': { input: 300, output: 1500 }, // $3.00 / $15.00 per 1M tokens
    'claude-haiku-3.5': { input: 100, output: 500 } // $1.00 / $5.00 per 1M tokens
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
  const modelPricing = PRICING[params.provider]?.[params.model as keyof typeof PRICING['openai']];
  
  if (!modelPricing) {
    console.warn(`Unknown model pricing: ${params.provider}/${params.model}`);
    // Default to highest cost to be conservative
    return Math.ceil((params.inputTokens / 1_000_000) * 1500 + (params.outputTokens / 1_000_000) * 7500);
  }
  
  const inputCost = (params.inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (params.outputTokens / 1_000_000) * modelPricing.output;
  
  return Math.ceil(inputCost + outputCost); // Round up to nearest cent
}

/**
 * Check if organization can make an AI call
 * Returns false if spending limit reached
 */
export async function checkAISpendingLimit(
  orgId: number,
  estimatedCostCents: number
): Promise<{
  allowed: boolean;
  reason?: string;
  currentSpend?: number;
  limit?: number;
  remainingBudget?: number;
}> {
  try {
    // Get or create spending limit for org
    let limit = await db.select()
      .from(aiSpendingLimits)
      .where(eq(aiSpendingLimits.orgId, orgId))
      .limit(1);
    
    if (limit.length === 0) {
      // Create default limit
      const defaultLimit = parseInt(process.env.AI_SPENDING_LIMIT_CENTS || '10000'); // $100 default
      await db.insert(aiSpendingLimits).values({
        orgId,
        monthlyLimitCents: defaultLimit,
        currentMonthSpendCents: 0,
        lastResetAt: new Date()
      });
      
      return {
        allowed: true,
        currentSpend: 0,
        limit: defaultLimit,
        remainingBudget: defaultLimit
      };
    }
    
    const spendingLimit = limit[0];
    
    // Check if we need to reset for new month
    const now = new Date();
    const lastReset = new Date(spendingLimit.lastResetAt);
    
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      // New month - reset counter
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
        limit: spendingLimit.monthlyLimitCents,
        remainingBudget: spendingLimit.monthlyLimitCents
      };
    }
    
    // Check if adding this cost would exceed limit
    const newTotal = spendingLimit.currentMonthSpendCents + estimatedCostCents;
    
    if (newTotal > spendingLimit.monthlyLimitCents) {
      // Mark limit reached if not already marked
      if (!spendingLimit.hardLimitReachedAt) {
        await db.update(aiSpendingLimits)
          .set({ hardLimitReachedAt: now })
          .where(eq(aiSpendingLimits.orgId, orgId));
        
        // Send notification email
        await sendAILimitReachedNotification(orgId, spendingLimit.monthlyLimitCents);
      }
      
      return {
        allowed: false,
        reason: `AI spending limit reached ($${(spendingLimit.monthlyLimitCents / 100).toFixed(2)}/month). Please contact support to increase your limit.`,
        currentSpend: spendingLimit.currentMonthSpendCents,
        limit: spendingLimit.monthlyLimitCents,
        remainingBudget: 0
      };
    }
    
    return {
      allowed: true,
      currentSpend: spendingLimit.currentMonthSpendCents,
      limit: spendingLimit.monthlyLimitCents,
      remainingBudget: spendingLimit.monthlyLimitCents - newTotal
    };
  } catch (error) {
    console.error('Error checking AI spending limit:', error);
    // Fail open - allow the request but log the error
    return {
      allowed: true,
      reason: 'Error checking spending limit'
    };
  }
}

/**
 * Track an AI API call
 */
export async function trackAIUsage(params: {
  orgId: number;
  userId: number;
  operationType: 'chat' | 'rag' | 'document_parse' | 'summary' | 'embedding' | 'other';
  provider: 'openai' | 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    // Calculate cost
    const costCents = calculateAICost({
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens
    });
    
    // Record usage
    await db.insert(aiUsageTracking).values({
      orgId: params.orgId,
      userId: params.userId,
      operationType: params.operationType,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostCents: costCents,
      metadata: params.metadata || {},
      createdAt: new Date()
    });
    
    // Update running total
    await db.update(aiSpendingLimits)
      .set({
        currentMonthSpendCents: sql`current_month_spend_cents + ${costCents}`
      })
      .where(eq(aiSpendingLimits.orgId, params.orgId));
    
  } catch (error) {
    console.error('Error tracking AI usage:', error);
    // Don't throw - tracking failure shouldn't break the app
  }
}

/**
 * Get current month's AI usage for an organization
 */
export async function getAIUsageStats(orgId: number): Promise<{
  currentSpendCents: number;
  limitCents: number;
  percentUsed: number;
  callsByType: Record<string, number>;
  callsByModel: Record<string, number>;
  limitReachedAt: Date | null;
}> {
  try {
    // Get spending limit
    const limit = await db.select()
      .from(aiSpendingLimits)
      .where(eq(aiSpendingLimits.orgId, orgId))
      .limit(1);
    
    if (limit.length === 0) {
      return {
        currentSpendCents: 0,
        limitCents: 10000,
        percentUsed: 0,
        callsByType: {},
        callsByModel: {},
        limitReachedAt: null
      };
    }
    
    const spendingLimit = limit[0];
    
    // Get this month's usage breakdown
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const usage = await db.select()
      .from(aiUsageTracking)
      .where(
        and(
          eq(aiUsageTracking.orgId, orgId),
          gte(aiUsageTracking.createdAt, startOfMonth)
        )
      );
    
    // Aggregate by type and model
    const callsByType: Record<string, number> = {};
    const callsByModel: Record<string, number> = {};
    
    usage.forEach(call => {
      callsByType[call.operationType] = (callsByType[call.operationType] || 0) + 1;
      callsByModel[call.model] = (callsByModel[call.model] || 0) + 1;
    });
    
    return {
      currentSpendCents: spendingLimit.currentMonthSpendCents,
      limitCents: spendingLimit.monthlyLimitCents,
      percentUsed: (spendingLimit.currentMonthSpendCents / spendingLimit.monthlyLimitCents) * 100,
      callsByType,
      callsByModel,
      limitReachedAt: spendingLimit.hardLimitReachedAt
    };
  } catch (error) {
    console.error('Error getting AI usage stats:', error);
    return {
      currentSpendCents: 0,
      limitCents: 10000,
      percentUsed: 0,
      callsByType: {},
      callsByModel: {},
      limitReachedAt: null
    };
  }
}

/**
 * Send notification when AI spending limit is reached
 */
async function sendAILimitReachedNotification(orgId: number, limitCents: number): Promise<void> {
  try {
    // TODO: Implement email notification
    // For now, just log
    console.warn('AI spending limit reached', {
      orgId,
      limitCents,
      limitDollars: (limitCents / 100).toFixed(2),
      timestamp: new Date().toISOString()
    });
    
    // In production, send email:
    // await sendEmail({
    //   to: org.ownerEmail,
    //   subject: 'AI Spending Limit Reached',
    //   body: `Your organization has reached its AI spending limit of $${(limitCents / 100).toFixed(2)} for this month. 
    //          Please contact support to increase your limit.`
    // });
  } catch (error) {
    console.error('Error sending AI limit notification:', error);
  }
}

/**
 * Increase spending limit for an organization (admin only)
 */
export async function updateSpendingLimit(
  orgId: number,
  newLimitCents: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(aiSpendingLimits)
      .set({
        monthlyLimitCents: newLimitCents,
        hardLimitReachedAt: null // Reset limit reached flag
      })
      .where(eq(aiSpendingLimits.orgId, orgId));
    
    return { success: true };
  } catch (error) {
    console.error('Error updating spending limit:', error);
    return {
      success: false,
      error: 'Failed to update spending limit'
    };
  }
}

/**
 * Get detailed usage history
 */
export async function getAIUsageHistory(
  orgId: number,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  date: string;
  operationType: string;
  model: string;
  calls: number;
  totalTokens: number;
  totalCostCents: number;
}>> {
  try {
    const usage = await db.select()
      .from(aiUsageTracking)
      .where(
        and(
          eq(aiUsageTracking.orgId, orgId),
          gte(aiUsageTracking.createdAt, startDate),
          sql`${aiUsageTracking.createdAt} <= ${endDate}`
        )
      )
      .orderBy(aiUsageTracking.createdAt);
    
    // Group by date, type, model
    const grouped: Record<string, {
      operationType: string;
      model: string;
      calls: number;
      totalTokens: number;
      totalCostCents: number;
    }> = {};
    
    usage.forEach(call => {
      const dateKey = call.createdAt.toISOString().split('T')[0];
      const key = `${dateKey}|${call.operationType}|${call.model}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          operationType: call.operationType,
          model: call.model,
          calls: 0,
          totalTokens: 0,
          totalCostCents: 0
        };
      }
      
      grouped[key].calls++;
      grouped[key].totalTokens += call.inputTokens + call.outputTokens;
      grouped[key].totalCostCents += call.estimatedCostCents;
    });
    
    return Object.entries(grouped).map(([key, data]) => ({
      date: key.split('|')[0],
      ...data
    }));
  } catch (error) {
    console.error('Error getting usage history:', error);
    return [];
  }
}

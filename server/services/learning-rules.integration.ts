/**
 * Learning Rules Integration Helpers
 * Easy drop-in helpers for integrating learning rules
 */

import { learningRulesService, type UpsertLearningRuleInput } from './learning-rules.service';

interface LineItemConfirmationContext {
  tenantId: string;
  marinaId?: string | null;
  userId?: string | null;
  lineItem: {
    id: string;
    name: string;
    category?: string;
    subcategory?: string | null;
    department?: string | null;
  };
}

export async function onLineItemConfirmed(
  context: LineItemConfirmationContext
): Promise<void> {
  const { tenantId, marinaId, userId, lineItem } = context;
  
  if (!lineItem.category) {
    return;
  }
  
  try {
    await learningRulesService.upsertLearningRule({
      tenantId,
      marinaId: marinaId ?? null,
      originalLineItem: lineItem.name,
      category: lineItem.category,
      subcategory: lineItem.subcategory ?? null,
      department: lineItem.department ?? null,
      confidenceTier: 'high',
      source: 'user_confirmed',
      createdByUserId: userId ?? null,
    });
    
    console.log(`[LearningRules] Created/updated rule for: "${lineItem.name}" → ${lineItem.category}`);
  } catch (error) {
    console.error('[LearningRules] Failed to save learning rule:', error);
  }
}

interface BaseLineItem {
  id: string;
  name: string;
  value?: number;
  status?: 'pending' | 'confirmed' | 'rejected';
  category?: string;
  subcategory?: string;
  department?: string;
}

interface EnhancedLineItem<T extends BaseLineItem> extends T {
  autoConfirmed: boolean;
  confidence?: 'high' | 'medium' | 'low';
  ruleId?: string;
  learningRuleApplied: boolean;
}

interface LineItemRetrievalContext<T> {
  tenantId: string;
  marinaId?: string | null;
  lineItems: T[];
}

export async function applyLearningRulesOnRetrieval<T extends BaseLineItem>(
  context: LineItemRetrievalContext<T>
): Promise<EnhancedLineItem<T>[]> {
  const { tenantId, marinaId, lineItems } = context;
  
  try {
    const enhancedItems = await learningRulesService.applyLearningRules(
      tenantId,
      marinaId,
      lineItems
    );
    
    const autoConfirmedCount = enhancedItems.filter(i => i.autoConfirmed).length;
    if (autoConfirmedCount > 0) {
      console.log(`[LearningRules] Auto-confirmed ${autoConfirmedCount}/${lineItems.length} line items`);
    }
    
    return enhancedItems;
  } catch (error) {
    console.error('[LearningRules] Failed to apply learning rules:', error);
    return lineItems.map(item => ({
      ...item,
      autoConfirmed: false,
      confidence: undefined,
      ruleId: undefined,
      learningRuleApplied: false,
    }));
  }
}

export type { LineItemConfirmationContext, LineItemRetrievalContext, BaseLineItem, EnhancedLineItem };

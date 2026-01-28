/**
 * Line Item Learning Rules Service
 * Handles learning rules for auto-categorization
 */

import { eq, and, sql, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import {
  lineItemLearningRules,
  type LineItemLearningRule,
  type NewLineItemLearningRule,
  type ConfidenceTier,
  type RuleSource,
} from '@shared/schema';
import { normalizeLineItem } from '../utils/normalize-line-item';

export interface UpsertLearningRuleInput {
  tenantId: string;
  marinaId?: string | null;
  originalLineItem: string;
  category: string;
  subcategory?: string | null;
  department?: string | null;
  confidenceTier?: ConfidenceTier;
  source?: RuleSource;
  createdByUserId?: string | null;
}

export interface ParsedLineItem {
  id: string;
  name: string;
  value?: number;
  status?: 'pending' | 'confirmed' | 'rejected';
  category?: string;
  subcategory?: string;
  department?: string;
  [key: string]: unknown;
}

export interface EnhancedLineItem<T extends ParsedLineItem = ParsedLineItem> extends T {
  autoConfirmed: boolean;
  confidence?: ConfidenceTier;
  ruleId?: string;
  learningRuleApplied: boolean;
}

export interface RulesStats {
  totalRules: number;
  totalUsage: number;
  uniqueCategories: number;
}

export class LearningRulesService {
  async upsertLearningRule(input: UpsertLearningRuleInput): Promise<LineItemLearningRule> {
    const normalizedItem = normalizeLineItem(input.originalLineItem);
    
    if (!normalizedItem) {
      throw new Error('Cannot create learning rule: line item normalizes to empty string');
    }

    const now = new Date();
    
    const ruleData: NewLineItemLearningRule = {
      tenantId: input.tenantId,
      marinaId: input.marinaId ?? null,
      normalizedLineItem: normalizedItem,
      originalLineItem: input.originalLineItem,
      category: input.category,
      subcategory: input.subcategory ?? null,
      department: input.department ?? null,
      confidenceTier: input.confidenceTier ?? 'high',
      source: input.source ?? 'user_confirmed',
      createdByUserId: input.createdByUserId ?? null,
      timesUsed: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const whereCondition = input.marinaId
      ? and(
          eq(lineItemLearningRules.tenantId, input.tenantId),
          eq(lineItemLearningRules.marinaId, input.marinaId),
          eq(lineItemLearningRules.normalizedLineItem, normalizedItem)
        )
      : and(
          eq(lineItemLearningRules.tenantId, input.tenantId),
          isNull(lineItemLearningRules.marinaId),
          eq(lineItemLearningRules.normalizedLineItem, normalizedItem)
        );

    const existing = await db
      .select()
      .from(lineItemLearningRules)
      .where(whereCondition)
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(lineItemLearningRules)
        .set({
          category: input.category,
          subcategory: input.subcategory ?? null,
          department: input.department ?? null,
          originalLineItem: input.originalLineItem,
          confidenceTier: input.confidenceTier ?? 'high',
          source: input.source ?? 'user_confirmed',
          createdByUserId: input.createdByUserId ?? existing[0].createdByUserId,
          updatedAt: now,
        })
        .where(eq(lineItemLearningRules.id, existing[0].id))
        .returning();
      
      return updated;
    }

    const [inserted] = await db
      .insert(lineItemLearningRules)
      .values(ruleData)
      .returning();

    return inserted;
  }

  async getRulesForTenant(
    tenantId: string,
    marinaId?: string | null
  ): Promise<LineItemLearningRule[]> {
    const whereCondition = marinaId
      ? and(
          eq(lineItemLearningRules.tenantId, tenantId),
          or(
            eq(lineItemLearningRules.marinaId, marinaId),
            isNull(lineItemLearningRules.marinaId)
          )
        )
      : and(
          eq(lineItemLearningRules.tenantId, tenantId),
          isNull(lineItemLearningRules.marinaId)
        );

    const rules = await db
      .select()
      .from(lineItemLearningRules)
      .where(whereCondition)
      .orderBy(lineItemLearningRules.normalizedLineItem);

    return rules;
  }

  buildRuleLookupMap(
    rules: LineItemLearningRule[],
    marinaId?: string | null
  ): Map<string, LineItemLearningRule> {
    const map = new Map<string, LineItemLearningRule>();

    for (const rule of rules) {
      if (rule.marinaId === null) {
        map.set(rule.normalizedLineItem, rule);
      }
    }

    if (marinaId) {
      for (const rule of rules) {
        if (rule.marinaId === marinaId) {
          map.set(rule.normalizedLineItem, rule);
        }
      }
    }

    return map;
  }

  async applyLearningRules<T extends ParsedLineItem>(
    tenantId: string,
    marinaId: string | null | undefined,
    lineItems: T[]
  ): Promise<EnhancedLineItem<T>[]> {
    const rules = await this.getRulesForTenant(tenantId, marinaId);
    
    if (rules.length === 0) {
      return lineItems.map(item => ({
        ...item,
        autoConfirmed: false,
        confidence: undefined,
        ruleId: undefined,
        learningRuleApplied: false,
      }));
    }

    const ruleMap = this.buildRuleLookupMap(rules, marinaId);
    const appliedRuleIds: string[] = [];
    
    const enhancedItems = lineItems.map(item => {
      const normalizedName = normalizeLineItem(item.name);
      const rule = ruleMap.get(normalizedName);
      
      if (rule && rule.confidenceTier === 'high') {
        appliedRuleIds.push(rule.id);
        
        return {
          ...item,
          category: rule.category,
          subcategory: rule.subcategory ?? item.subcategory,
          department: rule.department ?? item.department,
          status: 'confirmed' as const,
          autoConfirmed: true,
          confidence: rule.confidenceTier,
          ruleId: rule.id,
          learningRuleApplied: true,
        };
      }
      
      if (rule && rule.confidenceTier === 'medium') {
        return {
          ...item,
          category: rule.category,
          subcategory: rule.subcategory ?? item.subcategory,
          department: rule.department ?? item.department,
          autoConfirmed: false,
          confidence: rule.confidenceTier,
          ruleId: rule.id,
          learningRuleApplied: true,
        };
      }
      
      return {
        ...item,
        autoConfirmed: false,
        confidence: undefined,
        ruleId: undefined,
        learningRuleApplied: false,
      };
    });
    
    if (appliedRuleIds.length > 0) {
      this.updateRuleUsage(appliedRuleIds).catch(err => {
        console.error('Failed to update rule usage stats:', err);
      });
    }
    
    return enhancedItems;
  }

  async updateRuleUsage(ruleIds: string[]): Promise<void> {
    if (ruleIds.length === 0) return;

    const now = new Date();
    
    await db
      .update(lineItemLearningRules)
      .set({
        timesUsed: sql`${lineItemLearningRules.timesUsed} + 1`,
        lastUsedAt: now,
      })
      .where(
        sql`${lineItemLearningRules.id} = ANY(${ruleIds}::uuid[])`
      );
  }

  async getRuleById(ruleId: string): Promise<LineItemLearningRule | null> {
    const [rule] = await db
      .select()
      .from(lineItemLearningRules)
      .where(eq(lineItemLearningRules.id, ruleId))
      .limit(1);
    
    return rule ?? null;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const result = await db
      .delete(lineItemLearningRules)
      .where(eq(lineItemLearningRules.id, ruleId))
      .returning({ id: lineItemLearningRules.id });
    
    return result.length > 0;
  }

  async getRulesStats(tenantId: string): Promise<RulesStats> {
    const rules = await db
      .select({
        count: sql<number>`count(*)`,
        totalUsage: sql<number>`sum(${lineItemLearningRules.timesUsed})`,
        categories: sql<number>`count(distinct ${lineItemLearningRules.category})`,
      })
      .from(lineItemLearningRules)
      .where(eq(lineItemLearningRules.tenantId, tenantId));
    
    return {
      totalRules: Number(rules[0]?.count ?? 0),
      totalUsage: Number(rules[0]?.totalUsage ?? 0),
      uniqueCategories: Number(rules[0]?.categories ?? 0),
    };
  }
}

export function createLearningRulesService(): LearningRulesService {
  return new LearningRulesService();
}

export const learningRulesService = new LearningRulesService();

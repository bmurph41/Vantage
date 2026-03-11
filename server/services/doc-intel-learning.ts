/**
 * doc-intel-learning.ts
 * Unified learning service for the doc-intel review grid.
 *
 * Two responsibilities:
 *  1. recordConfirm()  — when a user confirms an item (single or bulk),
 *     upsert a lineItemLearningRule so the next upload pre-classifies it.
 *  2. applyLearningRules() — given a list of pending extracted items,
 *     look up learned rules and patch category/department in-place,
 *     marking them autoConfirmed + learningRuleApplied = true.
 */

import { db } from '../db';
import { lineItemLearningRules, docIntelExtractedItems } from '../../shared/schema';
import { eq, and, or, isNull, sql, inArray } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmedItemUpdate {
  rawText: string;
  categoryTierConfirmed?: string | null;
  revenueCogsDeptConfirmed?: string | null;
  expenseDeptConfirmed?: string | null;
}

interface ExtractedItemRow {
  id: string;
  rawText: string;
  status: string;
  categoryTierConfirmed?: string | null;
  categoryTierSuggested?: string | null;
  revenueCogsDeptConfirmed?: string | null;
  revenueCogsDeptSuggested?: string | null;
  expenseDeptConfirmed?: string | null;
  expenseDeptSuggested?: string | null;
  autoConfirmed?: boolean;
  learningRuleApplied?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Record learning on confirm ───────────────────────────────────────────────

/**
 * Called after a user confirms one or more items.
 * For each item with a complete classification, upserts a learning rule.
 */
export async function recordConfirm(
  orgId: string,
  items: ConfirmedItemUpdate[],
): Promise<number> {
  let upserted = 0;

  for (const item of items) {
    const { rawText, categoryTierConfirmed, revenueCogsDeptConfirmed, expenseDeptConfirmed } = item;
    if (!rawText || !categoryTierConfirmed) continue;

    const dept = categoryTierConfirmed === 'expense'
      ? expenseDeptConfirmed
      : revenueCogsDeptConfirmed;

    if (!dept) continue;

    const normalized = normalizeLabel(rawText);

    try {
      // Check for existing rule (org-wide)
      const existing = await db
        .select({ id: lineItemLearningRules.id, timesUsed: lineItemLearningRules.timesUsed })
        .from(lineItemLearningRules)
        .where(
          and(
            eq(lineItemLearningRules.tenantId, orgId),
            eq(lineItemLearningRules.normalizedLineItem, normalized),
            eq(lineItemLearningRules.category, categoryTierConfirmed),
            eq(lineItemLearningRules.department, dept),
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(lineItemLearningRules)
          .set({
            timesUsed: sql`${lineItemLearningRules.timesUsed} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
            confidenceTier: 'high',
          })
          .where(eq(lineItemLearningRules.id, existing[0].id));
      } else {
        await db.insert(lineItemLearningRules).values({
          tenantId: orgId,
          normalizedLineItem: normalized,
          originalLineItem: rawText,
          category: categoryTierConfirmed,
          department: dept,
          confidenceTier: 'high',
          source: 'user_confirmed',
          timesUsed: 1,
          lastUsedAt: new Date(),
        });
      }
      upserted++;
    } catch (e) {
      // Don't fail the confirm if learning write fails
      console.warn('[Learning] Failed to record rule for:', normalized, e);
    }
  }

  if (upserted > 0) {
    console.log(`[Learning] Recorded ${upserted} rule(s) for org ${orgId}`);
  }

  return upserted;
}

// ─── Apply learning rules to pending items ────────────────────────────────────

/**
 * Given a list of extracted items (from GET /items), look up learned rules
 * for pending/needs_review items and apply category + department in-place.
 *
 * Returns the enriched list (same array, mutated).
 * Also persists the auto-classification to the DB if confidence is high.
 */
export async function applyLearningRules(
  orgId: string,
  items: ExtractedItemRow[],
): Promise<{ items: ExtractedItemRow[]; appliedCount: number }> {
  const pending = items.filter(i => i.status === 'pending' || i.status === 'needs_review');
  if (pending.length === 0) return { items, appliedCount: 0 };

  // Load all rules for this org once
  const rules = await db
    .select()
    .from(lineItemLearningRules)
    .where(
      and(
        eq(lineItemLearningRules.tenantId, orgId),
        eq(lineItemLearningRules.confidenceTier, 'high'),
      )
    );

  if (rules.length === 0) return { items, appliedCount: 0 };

  // Build lookup map: normalizedLabel → rule
  const ruleMap = new Map<string, typeof rules[0]>();
  for (const rule of rules) {
    ruleMap.set(rule.normalizedLineItem, rule);
  }

  const toUpdate: Array<{ id: string; category: string; dept: string; ruleId: string }> = [];

  for (const item of pending) {
    // Skip items that already have confirmed classification
    if (item.categoryTierConfirmed && (item.revenueCogsDeptConfirmed || item.expenseDeptConfirmed)) continue;

    const normalized = normalizeLabel(item.rawText);
    const rule = ruleMap.get(normalized);
    if (!rule) continue;

    // Apply in-place
    item.categoryTierSuggested = rule.category as any;
    item.categoryTierConfirmed = rule.category as any;
    if (rule.category === 'expense') {
      item.expenseDeptConfirmed = rule.department ?? undefined;
    } else {
      item.revenueCogsDeptConfirmed = rule.department ?? undefined;
    }
    item.autoConfirmed = true;
    item.learningRuleApplied = true;

    toUpdate.push({ id: item.id, category: rule.category, dept: rule.department ?? '', ruleId: rule.id });
  }

  if (toUpdate.length === 0) return { items, appliedCount: 0 };

  // Persist to DB in batches of 50
  const BATCH = 50;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await Promise.all(batch.map(async ({ id, category, dept, ruleId }) => {
      try {
        const updatePayload: any = {
          categoryTierConfirmed: category,
          autoConfirmed: true,
          learningRuleApplied: true,
          ruleId,
        };
        if (category === 'expense') {
          updatePayload.expenseDeptConfirmed = dept;
        } else {
          updatePayload.revenueCogsDeptConfirmed = dept;
        }
        await db
          .update(docIntelExtractedItems)
          .set(updatePayload)
          .where(eq(docIntelExtractedItems.id, id));

        // Increment timesUsed on the rule
        await db
          .update(lineItemLearningRules)
          .set({
            timesUsed: sql`${lineItemLearningRules.timesUsed} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(lineItemLearningRules.id, ruleId));
      } catch (e) {
        console.warn('[Learning] Failed to persist auto-classification for item', id, e);
      }
    }));
  }

  console.log(`[Learning] Auto-classified ${toUpdate.length} item(s) for org ${orgId}`);
  return { items, appliedCount: toUpdate.length };
}

import { db } from '../../db';
import {
  pnlFacts,
  pnlDocuments,
  pnlParsedStatements,
} from '@shared/pnl-pipeline-schema';
import { modelingActuals, modelingProjects, pnlCanonicalLineItems, pnlJobs } from '@shared/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { MARINA_COA_SEED } from '@shared/coa/marina-coa-seed';
import { sectionToCategory, majorGroupToCategory, inferDepartment, normalizeDepartment } from '../../utils/department-mapping';

const coaLookup: Record<string, typeof MARINA_COA_SEED[0]> = {};
for (const item of MARINA_COA_SEED) {
  coaLookup[item.canonicalKey] = item;
}

/**
 * Transaction-aware DB handle — either the root `db` or a `tx` from
 * db.transaction(). The tx type is derived from db.transaction's callback so
 * a PgTransaction is accepted without an unsound widening to `typeof db`.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export interface PromoteResult {
  promoted: number;
  skipped: number;
  errors: string[];
  years: number[];
  /** Number of modeling_actuals rows written (one per canonical × period). */
  actualsWritten: number;
  /** Distinct canonical line items represented in the written actuals. */
  distinctCanonicals: number;
  /** The project the actuals were written to (echoed for observability). */
  projectId: string;
}

export async function promotePnlFactsToActuals(
  orgId: string,
  modelingProjectId: string,
  documentId?: string,
  dbh: DbOrTx = db,
): Promise<PromoteResult> {
  const result: PromoteResult = {
    promoted: 0, skipped: 0, errors: [], years: [],
    actualsWritten: 0, distinctCanonicals: 0, projectId: modelingProjectId,
  };

  const docs = await dbh.select()
    .from(pnlDocuments)
    .where(eq(pnlDocuments.modelingProjectId, modelingProjectId));

  if (docs.length === 0) {
    result.errors.push('No P&L documents found linked to this modeling project.');
    return result;
  }

  const docIds = documentId ? [documentId] : docs.map(d => d.id);

  const canonicalItems = await dbh.select().from(pnlCanonicalLineItems);
  const canonicalMap: Record<string, typeof canonicalItems[0]> = {};
  for (const item of canonicalItems) {
    canonicalMap[item.id] = item;
  }

  // Load the project's asset class so department inference routes by the deal's
  // real taxonomy (WS4 C2) instead of always running the marina cascade.
  const [project] = await dbh.select({ assetClass: modelingProjects.assetClass })
    .from(modelingProjects)
    .where(eq(modelingProjects.id, modelingProjectId))
    .limit(1);
  const assetClass = project?.assetClass ?? undefined;

  const yearsSet = new Set<number>();
  const distinctCanonicalSet = new Set<string>();

  for (const docId of docIds) {
    const facts = await dbh.select()
      .from(pnlFacts)
      .where(eq(pnlFacts.documentId, docId));

    if (facts.length === 0) {
      result.skipped++;
      continue;
    }

    // ========================================
    // FIX: Build lookup maps for BOTH resolvedDepartment AND resolvedBucket
    // from the user-confirmed parsedStatements data. These represent
    // what the user explicitly approved during the review step and
    // MUST take priority over COA seed defaults.
    // ========================================
    const parsedStmts = await dbh.select()
      .from(pnlParsedStatements)
      .where(eq(pnlParsedStatements.documentId, docId));

    const resolvedDeptMap: Record<string, string> = {};
    const resolvedBucketMap: Record<string, string> = {};

    for (const ps of parsedStmts) {
      const pj = ps.parsedJson as any;
      if (pj?.rows) {
        for (const row of pj.rows) {
          if (row.mapping?.canonicalLineItemId) {
            if (row.mapping.resolvedDepartment) {
              resolvedDeptMap[row.mapping.canonicalLineItemId] = row.mapping.resolvedDepartment;
            }
            if (row.mapping.resolvedBucket) {
              resolvedBucketMap[row.mapping.canonicalLineItemId] = row.mapping.resolvedBucket;
            }
          }
        }
      }
    }

    // ========================================
    // Phase 3 Session 2 (Defect A): SUM across source_labels. pnl_facts now
    // holds one row per (canonical × period × source_label); modeling_actuals
    // wants one CLEAN canonical-level row per (canonical × period) for the
    // engine. Aggregate the doc's facts by (canonical, year, month, periodType)
    // and sum the values. Sub-line detail stays queryable on pnl_facts for
    // drill-down / audit.
    // ========================================
    interface ActualCell {
      canonicalLineItemId: string;
      year: number;
      month: number;
      periodType: 'month' | 'year' | 'quarter';
      amount: number;
      category: string;
      subcategory: string;
      department: string;
    }
    const cellByKey = new Map<string, ActualCell>();

    for (const fact of facts) {
      const canonical = canonicalMap[fact.canonicalLineItemId];
      if (!canonical) {
        result.skipped++;
        continue;
      }

      const year = fact.fiscalYear;
      const periodType = (fact.periodType as 'month' | 'year' | 'quarter') || 'month';
      const isAnnual = periodType === 'year';
      const month = isAnnual ? 1 : (fact.fiscalPeriod || 1);
      const cellKey = `${fact.canonicalLineItemId}|${year}|${month}|${periodType}`;

      const existing = cellByKey.get(cellKey);
      if (existing) {
        // Another source_label under the same canonical+period — sum it in.
        existing.amount += Number(fact.value);
        yearsSet.add(year);
        continue;
      }

      const coaEntry = canonical.coaCode ? coaLookup[canonical.coaCode] : undefined;

      // ========================================
      // FIX: User-confirmed bucket (resolvedBucket) is FIRST priority for category.
      // Fallback chain: resolvedBucket → COA seed section → canonical majorGroup.
      // ========================================
      const pipelineBucket = resolvedBucketMap[fact.canonicalLineItemId];
      const category = pipelineBucket
        ? normalizeBucketToCategory(pipelineBucket)
        : coaEntry
          ? sectionToCategory(coaEntry.section)
          : majorGroupToCategory(canonical.majorGroup);

      const subcategory = canonical.displayName;

      // ========================================
      // FIX: User-confirmed resolvedDepartment is FIRST priority for department.
      // Fallback chain: resolvedDepartment → COA seed dept → canonical
      // subcategoryGroup → inferDepartment() heuristic. Keyed on the canonical
      // displayName (not a single source_label) since this row is now the
      // canonical-level aggregate.
      // ========================================
      const pipelineDept = resolvedDeptMap[fact.canonicalLineItemId];
      const rawDepartment = pipelineDept
        || coaEntry?.department
        || canonical.subcategoryGroup
        || inferDepartment(subcategory, category, assetClass);
      const department = normalizeDepartment(rawDepartment);

      cellByKey.set(cellKey, {
        canonicalLineItemId: fact.canonicalLineItemId,
        year, month, periodType,
        amount: Number(fact.value),
        category, subcategory, department,
      });
      yearsSet.add(year);
      distinctCanonicalSet.add(fact.canonicalLineItemId);
    }

    const cells = [...cellByKey.values()];
    if (cells.length === 0) continue;

    // DEDUP (idempotency): clear this project's prior pipeline-sourced actuals
    // for the (year) cells this document covers, so a re-run after a
    // reclassification leaves no orphans (e.g. when a line's department or
    // category changed). Scoped to data_source='doc_intel'/source 'pnl_fact'
    // so manual entries and other sources are untouched. NOTE: assumes one
    // document per (project, year); a future multi-doc-same-year scenario
    // would need (year, month) scoping — flagged, out of scope for this fix.
    const docYears = [...new Set(cells.map(c => c.year))];
    await dbh.delete(modelingActuals).where(
      and(
        eq(modelingActuals.modelingProjectId, modelingProjectId),
        eq(modelingActuals.orgId, orgId),
        eq(modelingActuals.dataSource, 'doc_intel'),
        eq(modelingActuals.sourceRecordType, 'pnl_fact'),
        inArray(modelingActuals.year, docYears),
      )
    );

    for (const cell of cells) {
      try {
        // Canonical-level line description — NO source_label, so there is
        // exactly one row per (canonical × period).
        const lineDesc = `${cell.department}: ${cell.subcategory}`;

        await dbh.insert(modelingActuals)
          .values({
            orgId,
            modelingProjectId,
            year: cell.year,
            month: cell.month,
            periodType: cell.periodType,
            category: cell.category,
            subcategory: cell.subcategory,
            department: cell.department,
            lineItemDescription: lineDesc,
            amount: String(cell.amount),
            dataSource: 'doc_intel',
            // Stable across re-runs (canonical id is stable; fact ids are not),
            // so idempotent re-promotes update in place rather than orphan.
            sourceRecordId: cell.canonicalLineItemId,
            sourceRecordType: 'pnl_fact',
          })
          .onConflictDoUpdate({
            target: [
              modelingActuals.modelingProjectId,
              modelingActuals.year,
              modelingActuals.month,
              modelingActuals.periodType,
              modelingActuals.category,
              modelingActuals.subcategory,
              modelingActuals.lineItemDescription,
            ],
            set: {
              amount: sql`EXCLUDED.amount`,
              department: sql`EXCLUDED.department`,
              dataSource: sql`EXCLUDED.data_source`,
              sourceRecordId: sql`EXCLUDED.source_record_id`,
              updatedAt: sql`NOW()`,
            },
          });

        result.promoted++;
      } catch (err: any) {
        result.errors.push(`Cell ${cell.canonicalLineItemId} ${cell.year}-${cell.month}: ${err.message}`);
      }
    }
  }

  result.years = Array.from(yearsSet).sort();
  result.actualsWritten = result.promoted;
  result.distinctCanonicals = distinctCanonicalSet.size;
  return result;
}

/**
 * Normalize a resolvedBucket string (from the review pipeline) into
 * the canonical category values used in modelingActuals.
 * 
 * The review pipeline stores buckets as "Revenue", "COGS", "Expense"
 * but modelingActuals needs consistent casing.
 */
function normalizeBucketToCategory(bucket: string): string {
  const lower = bucket.toLowerCase().trim();
  if (lower === 'revenue') return 'Revenue';
  if (lower === 'cogs' || lower === 'cost of goods sold' || lower === 'cost_of_goods_sold') return 'COGS';
  if (lower === 'expense' || lower === 'expenses' || lower === 'opex' || lower === 'operating expenses') return 'Expenses';
  if (lower === 'payroll') return 'Expenses'; // Payroll → Expenses for consistency with waterfall
  return bucket; // Return as-is if no match
}

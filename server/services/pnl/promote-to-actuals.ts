import { db } from '../../db';
import {
  pnlFacts,
  pnlDocuments,
  pnlParsedStatements,
} from '@shared/pnl-pipeline-schema';
import { modelingActuals, pnlCanonicalLineItems, pnlJobs } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { MARINA_COA_SEED } from '../../scripts/seedMarinaCoa';
import { sectionToCategory, majorGroupToCategory, inferDepartment, normalizeDepartment } from '../../utils/department-mapping';

const coaLookup: Record<string, typeof MARINA_COA_SEED[0]> = {};
for (const item of MARINA_COA_SEED) {
  coaLookup[item.canonicalKey] = item;
}

export interface PromoteResult {
  promoted: number;
  skipped: number;
  errors: string[];
  years: number[];
}

export async function promotePnlFactsToActuals(
  orgId: string,
  modelingProjectId: string,
  documentId?: string
): Promise<PromoteResult> {
  const result: PromoteResult = { promoted: 0, skipped: 0, errors: [], years: [] };

  const docs = await db.select()
    .from(pnlDocuments)
    .where(eq(pnlDocuments.modelingProjectId, modelingProjectId));

  if (docs.length === 0) {
    result.errors.push('No P&L documents found linked to this modeling project.');
    return result;
  }

  const docIds = documentId ? [documentId] : docs.map(d => d.id);

  const canonicalItems = await db.select().from(pnlCanonicalLineItems);
  const canonicalMap: Record<string, typeof canonicalItems[0]> = {};
  for (const item of canonicalItems) {
    canonicalMap[item.id] = item;
  }

  const yearsSet = new Set<number>();

  // DEDUP: Clear existing actuals for these documents before re-promoting
  for (const docId of docIds) {
    try {
      await db.execute(
        sql`DELETE FROM modeling_actuals 
             WHERE modeling_project_id = ${modelingProjectId} 
             AND org_id = ${orgId}
             AND source = 'pnl_pipeline'
             AND notes LIKE '%' || ${docId} || '%'`
      );
    } catch (e) {
      console.warn('[Promote] Dedup cleanup skipped:', (e as Error).message);
    }
  }

  for (const docId of docIds) {
    const facts = await db.select()
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
    const parsedStmts = await db.select()
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

    for (const fact of facts) {
      try {
        const canonical = canonicalMap[fact.canonicalLineItemId];
        if (!canonical) {
          result.skipped++;
          continue;
        }

        const coaEntry = coaLookup[canonical.coaCode];
        
        // ========================================
        // FIX: User-confirmed bucket (resolvedBucket) is FIRST priority for category.
        // This ensures that what the user saw and approved during document review
        // is exactly what appears in Historical P&L and Pro Forma.
        //
        // Fallback chain:
        //   1. User-confirmed resolvedBucket from review
        //   2. COA seed section → category mapping
        //   3. Canonical majorGroup → category mapping
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
        //
        // Fallback chain:
        //   1. User-confirmed resolvedDepartment from review
        //   2. COA seed department
        //   3. Canonical subcategoryGroup
        //   4. inferDepartment() heuristic
        // ========================================
        const pipelineDept = resolvedDeptMap[fact.canonicalLineItemId];
        const rawDepartment = pipelineDept
          || coaEntry?.department
          || canonical.subcategoryGroup
          || inferDepartment(fact.sourceLabel || subcategory, category);
        const department = normalizeDepartment(rawDepartment);

        const year = fact.fiscalYear;
        const month = fact.fiscalPeriod || 1;
        const amount = fact.value;

        yearsSet.add(year);

        const lineDesc = `${department}: ${fact.sourceLabel || subcategory}`;

        await db.insert(modelingActuals)
          .values({
            orgId,
            modelingProjectId,
            year,
            month,
            category,
            subcategory,
            department,
            lineItemDescription: lineDesc,
            amount: String(amount),
            dataSource: 'doc_intel',
            sourceRecordId: fact.id,
            sourceRecordType: 'pnl_fact',
          })
          .onConflictDoUpdate({
            target: [
              modelingActuals.modelingProjectId,
              modelingActuals.year,
              modelingActuals.month,
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
        result.errors.push(`Fact ${fact.id}: ${err.message}`);
      }
    }
  }

  result.years = Array.from(yearsSet).sort();
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

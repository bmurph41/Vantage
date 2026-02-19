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

  for (const docId of docIds) {
    const facts = await db.select()
      .from(pnlFacts)
      .where(eq(pnlFacts.documentId, docId));

    if (facts.length === 0) {
      result.skipped++;
      continue;
    }

    const parsedStmts = await db.select()
      .from(pnlParsedStatements)
      .where(eq(pnlParsedStatements.documentId, docId));
    const resolvedDeptMap: Record<string, string> = {};
    for (const ps of parsedStmts) {
      const pj = ps.parsedJson as any;
      if (pj?.rows) {
        for (const row of pj.rows) {
          if (row.mapping?.resolvedDepartment && row.mapping?.canonicalLineItemId) {
            resolvedDeptMap[row.mapping.canonicalLineItemId] = row.mapping.resolvedDepartment;
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
        const category = coaEntry
          ? sectionToCategory(coaEntry.section)
          : majorGroupToCategory(canonical.majorGroup);
        const subcategory = canonical.displayName;
        const pipelineDept = resolvedDeptMap[fact.canonicalLineItemId];
        const rawDepartment = coaEntry?.department
          || pipelineDept
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

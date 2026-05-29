import { db } from '../../db';
import {
  pnlFacts,
  pnlJobs,
  pnlParsedStatements,
  type ParsedStatementPayload,
  type InsertPnlFact,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { periodToFactKeys } from './timeAlign';

/**
 * Transaction-aware DB handle — either the root `db` or a `tx` from
 * db.transaction(). The tx type is derived from db.transaction's callback so
 * a PgTransaction is accepted without an unsound widening to `typeof db`.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export interface StoreFactsMetrics {
  /** Number of pnl_facts rows written (post in-memory aggregation). */
  factsWritten: number;
  /** Distinct canonical line items represented in the written facts. */
  distinctCanonicals: number;
  /** Distinct source_labels represented (sub-line provenance preserved). */
  distinctSourceLabels: number;
  /** Distinct periods (year×period×type) represented. */
  periods: number;
}

/**
 * Materialize the auto-mapped rows of a parsed statement into pnl_facts.
 *
 * Grain (Phase 3 Session 2 — Defect B): one fact per
 * (canonical_line_item_id × period × source_label). Sibling parser rows that
 * classify to the SAME canonical (e.g. several bank-fee lines → one "Bank/
 * Merchant Fees" canonical) each keep their own source_label and coexist.
 * Rows that share canonical + period + source_label are summed in memory
 * BEFORE insert so a single batch can never collide on the unique key
 * (pnl_facts_doc_line_period_label_unique).
 *
 * Transactional safety (Defect B): the DELETE-then-INSERT is atomic. If the
 * insert throws, the delete rolls back and the prior facts survive — the table
 * is never left wiped. When called with a caller-supplied `dbh` (a tx), the
 * writes join that outer transaction instead of opening a nested one, so the
 * whole map→store→promote chain commits or rolls back as one unit.
 *
 * @param jobId  the pnl_jobs id to materialize
 * @param dbh    transaction handle; defaults to root `db` (opens its own tx)
 */
export async function storeMappedFacts(
  jobId: string,
  dbh: DbOrTx = db,
): Promise<{ storedCount: number } & StoreFactsMetrics> {
  const job = await dbh.query.pnlJobs.findFirst({ where: eq(pnlJobs.id, jobId) });
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const parsed = await dbh.query.pnlParsedStatements.findFirst({
    where: eq(pnlParsedStatements.jobId, jobId),
  });
  if (!parsed) throw new Error(`No parsed statement for job ${jobId}`);

  const pj = parsed.parsedJson as ParsedStatementPayload;
  const periods = pj.periods ?? [];
  const rows = pj.rows ?? [];

  // Build the fact set in memory, keyed by the full grain. Same
  // (canonical, period, sourceLabel) → values summed so the batch insert can
  // never violate pnl_facts_doc_line_period_label_unique.
  const factByKey = new Map<string, InsertPnlFact>();

  for (const row of rows) {
    const m = row.mapping ?? {};
    const canonicalLineItemId = m.canonicalLineItemId;
    const mappingMethod = m.mappingMethod ?? 'none';
    const mappingConfidence = Number(m.mappingConfidence ?? 0);

    if (!canonicalLineItemId) continue;

    const sourceLabel = row.label ?? '';

    for (const v of row.values ?? []) {
      const p = periods[v.periodIndex];
      if (!p) continue;

      const keys = periodToFactKeys(p);

      // Fail-loud guard against year-corruption defects upstream. Range
      // 1900-2099 matches parseColumnHeaderToPeriod (timeAlign.ts:136)
      // + inferYearFromText (excel-extractor.ts). If any new derivation
      // path produces out-of-range years, this prevents persistence and
      // surfaces the bug as a job failure instead of silently corrupting
      // modeling_actuals (which would then be masked by the engine's
      // year-filter — see project_year_corruption_parse_layer.md).
      if (keys.fiscalYear < 1900 || keys.fiscalYear > 2099) {
        throw new Error(
          `[storeMappedFacts] Refusing to persist pnl_fact with out-of-range ` +
          `fiscalYear=${keys.fiscalYear} (canonical range 1900-2099). ` +
          `Period: ${JSON.stringify(p)}. ` +
          `Document: ${job.documentId}, job: ${jobId}. ` +
          `This indicates a parser-layer year-derivation bug — see ` +
          `project_year_corruption_parse_layer.md.`
        );
      }

      const value = v.value;

      if (value === null || value === undefined) continue;

      const dedupKey = `${canonicalLineItemId}|${keys.fiscalYear}|${keys.fiscalPeriod}|${keys.periodType}|${sourceLabel}`;
      const existing = factByKey.get(dedupKey);
      if (existing) {
        // Same canonical + period + source_label encountered twice (e.g. a
        // statement with two identically-labelled lines under one canonical):
        // sum the values so the unique key holds and no row is silently lost.
        existing.value = String(Number(existing.value) + Number(value));
        continue;
      }

      factByKey.set(dedupKey, {
        orgId: job.orgId,
        assetId: job.assetId ?? null,
        documentId: job.documentId,
        canonicalLineItemId,
        ...keys,
        value: String(value),
        sourceLabel,
        sourceTrace: v.trace ?? {},
        extractionConfidence: String(pj.confidence ?? 0),
        mappingConfidence: String(mappingConfidence),
        mappingMethod,
      });
    }
  }

  const inserts = [...factByKey.values()];

  // Atomic refresh: delete the document's prior facts, then insert the new
  // set. Either both happen or neither does. If `dbh` is already a tx (the
  // map→store→promote chain), reuse it; otherwise open a dedicated tx.
  const writeFacts = async (tx: DbOrTx) => {
    await tx.delete(pnlFacts).where(eq(pnlFacts.documentId, job.documentId));
    if (inserts.length) {
      await tx.insert(pnlFacts).values(inserts);
    }
  };

  if (dbh === db) {
    await db.transaction(writeFacts);
  } else {
    await writeFacts(dbh);
  }

  const distinctCanonicals = new Set(inserts.map(i => i.canonicalLineItemId)).size;
  const distinctSourceLabels = new Set(inserts.map(i => i.sourceLabel)).size;
  const periodCount = new Set(inserts.map(i => `${i.fiscalYear}|${i.fiscalPeriod}|${i.periodType}`)).size;

  return {
    storedCount: inserts.length,
    factsWritten: inserts.length,
    distinctCanonicals,
    distinctSourceLabels,
    periods: periodCount,
  };
}

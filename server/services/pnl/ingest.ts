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

export async function storeMappedFacts(jobId: string): Promise<{ storedCount: number }> {
  const job = await db.query.pnlJobs.findFirst({ where: eq(pnlJobs.id, jobId) });
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const parsed = await db.query.pnlParsedStatements.findFirst({
    where: eq(pnlParsedStatements.jobId, jobId),
  });
  if (!parsed) throw new Error(`No parsed statement for job ${jobId}`);

  const pj = parsed.parsedJson as ParsedStatementPayload;
  const periods = pj.periods ?? [];
  const rows = pj.rows ?? [];

  await db.delete(pnlFacts).where(eq(pnlFacts.documentId, job.documentId));

  const inserts: InsertPnlFact[] = [];

  for (const row of rows) {
    const m = row.mapping ?? {};
    const canonicalLineItemId = m.canonicalLineItemId;
    const mappingMethod = m.mappingMethod ?? 'none';
    const mappingConfidence = Number(m.mappingConfidence ?? 0);

    if (!canonicalLineItemId) continue;

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

      inserts.push({
        orgId: job.orgId,
        assetId: job.assetId ?? null,
        documentId: job.documentId,
        canonicalLineItemId,
        ...keys,
        value: String(value),
        sourceLabel: row.label ?? '',
        sourceTrace: v.trace ?? {},
        extractionConfidence: String(pj.confidence ?? 0),
        mappingConfidence: String(mappingConfidence),
        mappingMethod,
      });
    }
  }

  if (inserts.length) {
    await db.insert(pnlFacts).values(inserts);
  }

  return { storedCount: inserts.length };
}

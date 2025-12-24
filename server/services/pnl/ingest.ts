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

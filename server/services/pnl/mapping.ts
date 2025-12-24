import { db } from '../../db';
import {
  pnlCanonicalLineItems,
  pnlLineItemAliases,
  pnlParsedStatements,
  pnlReviewItems,
  pnlJobs,
  type PnlMappingMethod,
  type ParsedRow,
  type ParsedStatementPayload,
} from '@shared/schema';
import { and, eq } from 'drizzle-orm';

interface MapResult {
  canonicalLineItemId?: string;
  mappingMethod: PnlMappingMethod;
  confidence: number;
  suggestion?: any;
}

const CONFIDENCE_THRESHOLD = 0.75;

export function normalizeLabel(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 %&/()\-.]/g, '');
}

async function tryAliasMatch(orgId: string, normalized: string): Promise<MapResult> {
  const alias = await db.query.pnlLineItemAliases.findFirst({
    where: and(
      eq(pnlLineItemAliases.orgId, orgId),
      eq(pnlLineItemAliases.aliasText, normalized)
    ),
  });
  
  if (!alias) return { mappingMethod: 'none', confidence: 0 };
  
  return {
    canonicalLineItemId: alias.canonicalLineItemId,
    mappingMethod: 'alias',
    confidence: Math.min(0.95, 0.6 + (alias.weight ?? 10) / 50),
  };
}

async function tryRegexMatch(orgId: string, normalized: string): Promise<MapResult> {
  const aliases = await db.query.pnlLineItemAliases.findMany({
    where: eq(pnlLineItemAliases.orgId, orgId),
  });
  
  for (const a of aliases) {
    if (!a.aliasRegex) continue;
    try {
      const r = new RegExp(a.aliasRegex, 'i');
      if (r.test(normalized)) {
        return {
          canonicalLineItemId: a.canonicalLineItemId,
          mappingMethod: 'regex',
          confidence: Math.min(0.9, 0.55 + (a.weight ?? 10) / 60),
        };
      }
    } catch {
      // Ignore invalid regex
    }
  }
  
  return { mappingMethod: 'none', confidence: 0 };
}

async function tryRuleMatch(orgId: string, normalized: string): Promise<MapResult> {
  const canonicals = await db.query.pnlCanonicalLineItems.findMany({
    where: and(
      eq(pnlCanonicalLineItems.orgId, orgId),
      eq(pnlCanonicalLineItems.isActive, true)
    ),
  });
  
  for (const c of canonicals) {
    const canonicalNormalized = normalizeLabel(c.displayName);
    if (canonicalNormalized === normalized) {
      return {
        canonicalLineItemId: c.id,
        mappingMethod: 'rule',
        confidence: 0.85,
      };
    }
    
    const words = normalized.split(' ');
    const canonicalWords = canonicalNormalized.split(' ');
    const matchingWords = words.filter(w => canonicalWords.includes(w));
    
    if (matchingWords.length >= 2 && matchingWords.length / words.length >= 0.6) {
      return {
        canonicalLineItemId: c.id,
        mappingMethod: 'rule',
        confidence: 0.5 + (matchingWords.length / words.length) * 0.3,
      };
    }
  }
  
  return { mappingMethod: 'none', confidence: 0 };
}

export async function mapParsedStatement(jobId: string): Promise<{ reviewCount: number }> {
  const parsed = await db.query.pnlParsedStatements.findFirst({
    where: eq(pnlParsedStatements.jobId, jobId),
  });
  
  if (!parsed) throw new Error(`No parsed statement for job ${jobId}`);
  
  const orgId = parsed.orgId;
  const canonical = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });
  const canonicalById = new Map(canonical.map(c => [c.id, c]));
  
  const existingApproved = await db.query.pnlReviewItems.findMany({
    where: and(eq(pnlReviewItems.jobId, jobId), eq(pnlReviewItems.status, 'approved')),
  });
  const approvedLabels = new Set(existingApproved.map(r => r.normalizedLabel));
  
  const pj = parsed.parsedJson as ParsedStatementPayload;
  const rows = pj.rows ?? [];
  
  const reviewInserts: any[] = [];
  
  for (const row of rows) {
    const rawLabel = row.label ?? '';
    const normalized = row.normalizedLabel ?? normalizeLabel(rawLabel);
    
    let res = await tryAliasMatch(orgId, normalized);
    
    if (!res.canonicalLineItemId) {
      res = await tryRegexMatch(orgId, normalized);
    }
    
    if (!res.canonicalLineItemId) {
      res = await tryRuleMatch(orgId, normalized);
    }
    
    const needsReview = !res.canonicalLineItemId || res.confidence < CONFIDENCE_THRESHOLD || !canonicalById.has(res.canonicalLineItemId);
    
    if (needsReview && !approvedLabels.has(normalized)) {
      reviewInserts.push({
        orgId,
        jobId: parsed.jobId,
        documentId: parsed.documentId,
        extractedLabel: rawLabel,
        normalizedLabel: normalized,
        suggestedCanonicalLineItemId: res.canonicalLineItemId ?? null,
        suggestionJson: {
          mappingMethod: res.mappingMethod,
          suggestion: res.suggestion ?? null,
        },
        confidence: String(res.confidence ?? 0),
        status: 'needs_review',
      });
    }
    
    row.mapping = {
      canonicalLineItemId: res.canonicalLineItemId ?? null,
      mappingMethod: res.mappingMethod,
      mappingConfidence: res.confidence,
      normalizedLabel: normalized,
    };
  }
  
  await db
    .update(pnlParsedStatements)
    .set({ parsedJson: pj })
    .where(eq(pnlParsedStatements.id, parsed.id));
  
  if (reviewInserts.length) {
    await db.delete(pnlReviewItems).where(
      and(eq(pnlReviewItems.jobId, parsed.jobId), eq(pnlReviewItems.status, 'needs_review'))
    );
    await db.insert(pnlReviewItems).values(reviewInserts);
  }
  
  await db
    .update(pnlJobs)
    .set({ status: 'mapped', stage: 'store', updatedAt: new Date() })
    .where(eq(pnlJobs.id, jobId));
  
  return { reviewCount: reviewInserts.length };
}

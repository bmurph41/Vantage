import { db } from '../../db';
import {
  pnlCanonicalLineItems,
  pnlLineItemAliases,
  pnlParsedStatements,
  pnlReviewItems,
  pnlJobs,
  pnlKeywordRules,
  type PnlMappingMethod,
  type ParsedRow,
  type ParsedStatementPayload,
  type PnlKeywordRule,
} from '@shared/schema';
import { and, eq, or, isNull, sql, desc, asc } from 'drizzle-orm';

interface MapResult {
  canonicalLineItemId?: string;
  mappingMethod: PnlMappingMethod;
  confidence: number;
  suggestion?: any;
  matchedKeywordRuleId?: string;
  department?: string;
  bucket?: string;
}

interface KeywordMatch {
  rule: PnlKeywordRule;
  matchType: 'exact' | 'phrase' | 'token';
  score: number;
}

const CONFIDENCE_THRESHOLD = 0.75;

export function normalizeLabel(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 %/()\-.]/g, '');
}

function tokenize(s: string): string[] {
  return s.split(/\s+/).filter(t => t.length >= 2);
}

function scoreKeywordMatch(normalized: string, rule: PnlKeywordRule): KeywordMatch | null {
  const keyword = rule.keyword.toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  
  if (rule.matchType === 'exact' || normalizedLower === keyword) {
    if (normalizedLower === keyword) {
      return { rule, matchType: 'exact', score: 0.98 };
    }
  }
  
  if (rule.matchType === 'phrase' || rule.matchType === 'exact') {
    if (normalizedLower.includes(keyword)) {
      const lengthRatio = keyword.length / normalizedLower.length;
      const phraseScore = 0.80 + (lengthRatio * 0.12);
      return { rule, matchType: 'phrase', score: Math.min(0.92, phraseScore) };
    }
  }
  
  if (rule.matchType === 'token') {
    const normalizedTokens = tokenize(normalizedLower);
    const keywordTokens = tokenize(keyword);
    
    if (keywordTokens.length === 0) return null;
    
    const matchedTokens = keywordTokens.filter(kt => 
      normalizedTokens.some(nt => nt.includes(kt) || kt.includes(nt))
    );
    
    if (matchedTokens.length >= 1) {
      const tokenScore = 0.60 + (matchedTokens.length / keywordTokens.length) * 0.20;
      return { rule, matchType: 'token', score: Math.min(0.80, tokenScore) };
    }
  }
  
  return null;
}

async function tryKeywordMatch(orgId: string, normalized: string): Promise<MapResult> {
  const rules = await db.query.pnlKeywordRules.findMany({
    where: and(
      or(eq(pnlKeywordRules.orgId, orgId), isNull(pnlKeywordRules.orgId)),
      eq(pnlKeywordRules.isActive, true)
    ),
    orderBy: [asc(pnlKeywordRules.priority)],
  });
  
  if (rules.length === 0) {
    return { mappingMethod: 'none', confidence: 0 };
  }
  
  const matches: KeywordMatch[] = [];
  
  for (const rule of rules) {
    const match = scoreKeywordMatch(normalized, rule);
    if (match) {
      const isOrgSpecific = rule.orgId === orgId;
      const adjustedScore = match.score + (isOrgSpecific ? 0.03 : 0) - (rule.priority / 1000);
      matches.push({ ...match, score: adjustedScore });
    }
  }
  
  if (matches.length === 0) {
    return { mappingMethod: 'none', confidence: 0 };
  }
  
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  
  await db
    .update(pnlKeywordRules)
    .set({ 
      timesMatched: sql`${pnlKeywordRules.timesMatched} + 1`,
      updatedAt: new Date() 
    })
    .where(eq(pnlKeywordRules.id, best.rule.id));
  
  return {
    canonicalLineItemId: best.rule.canonicalLineItemId ?? undefined,
    mappingMethod: 'rule',
    confidence: best.score,
    matchedKeywordRuleId: best.rule.id,
    department: best.rule.department,
    bucket: best.rule.bucket,
    suggestion: {
      matchType: best.matchType,
      keyword: best.rule.keyword,
      department: best.rule.department,
      bucket: best.rule.bucket,
    },
  };
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
    confidence: Math.min(0.98, 0.70 + (alias.weight ?? 10) / 50),
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
          confidence: Math.min(0.92, 0.60 + (a.weight ?? 10) / 60),
        };
      }
    } catch {
      // Ignore invalid regex
    }
  }
  
  return { mappingMethod: 'none', confidence: 0 };
}

async function tryCanonicalMatch(orgId: string, normalized: string): Promise<MapResult> {
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
        confidence: 0.90,
        department: c.department,
      };
    }
    
    const words = normalized.split(' ');
    const canonicalWords = canonicalNormalized.split(' ');
    const matchingWords = words.filter(w => canonicalWords.includes(w));
    
    if (matchingWords.length >= 2 && matchingWords.length / words.length >= 0.6) {
      return {
        canonicalLineItemId: c.id,
        mappingMethod: 'rule',
        confidence: 0.55 + (matchingWords.length / words.length) * 0.25,
        department: c.department,
      };
    }
  }
  
  return { mappingMethod: 'none', confidence: 0 };
}

export async function mapParsedStatement(jobId: string): Promise<{ reviewCount: number; autoMappedCount: number }> {
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
  let autoMappedCount = 0;
  
  for (const row of rows) {
    const rawLabel = row.label ?? '';
    const normalized = row.normalizedLabel ?? normalizeLabel(rawLabel);
    
    let res = await tryAliasMatch(orgId, normalized);
    
    if (!res.canonicalLineItemId) {
      res = await tryRegexMatch(orgId, normalized);
    }
    
    if (!res.canonicalLineItemId || res.confidence < CONFIDENCE_THRESHOLD) {
      const keywordRes = await tryKeywordMatch(orgId, normalized);
      if (keywordRes.confidence > (res.confidence || 0)) {
        res = keywordRes;
      }
    }
    
    if (!res.canonicalLineItemId || res.confidence < CONFIDENCE_THRESHOLD) {
      const canonicalRes = await tryCanonicalMatch(orgId, normalized);
      if (canonicalRes.confidence > (res.confidence || 0)) {
        res = canonicalRes;
      }
    }
    
    const hasValidCanonical = res.canonicalLineItemId && canonicalById.has(res.canonicalLineItemId);
    const needsReview = !hasValidCanonical || res.confidence < CONFIDENCE_THRESHOLD;
    
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
          department: res.department ?? null,
          bucket: res.bucket ?? null,
        },
        confidence: String(res.confidence ?? 0),
        status: 'needs_review',
      });
    } else if (!needsReview) {
      autoMappedCount++;
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
  
  console.log(`[P&L Mapping] Job ${jobId}: ${autoMappedCount} auto-mapped, ${reviewInserts.length} need review`);
  
  return { reviewCount: reviewInserts.length, autoMappedCount };
}

export async function addToKeywordBank(
  orgId: string,
  normalized: string,
  department: string,
  bucket: string,
  canonicalLineItemId?: string
): Promise<void> {
  const existing = await db.query.pnlKeywordRules.findFirst({
    where: and(
      eq(pnlKeywordRules.orgId, orgId),
      eq(pnlKeywordRules.keyword, normalized),
      eq(pnlKeywordRules.department, department),
      eq(pnlKeywordRules.bucket, bucket)
    ),
  });

  if (existing) {
    await db
      .update(pnlKeywordRules)
      .set({ 
        timesMatched: sql`${pnlKeywordRules.timesMatched} + 1`,
        updatedAt: new Date(),
        isActive: true,
      })
      .where(eq(pnlKeywordRules.id, existing.id));
  } else {
    await db.insert(pnlKeywordRules).values({
      orgId,
      department,
      bucket,
      keyword: normalized,
      matchType: 'exact',
      priority: 25,
      canonicalLineItemId: canonicalLineItemId ?? null,
      isActive: true,
      source: 'learned',
      timesMatched: 1,
    });
  }
}

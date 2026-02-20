import { db } from '../db';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import {
  taxonomyPacks,
  coaProfitCenters,
  coaSubCenters,
  coaCanonicalAccounts,
  coaGlobalAliases,
  coaUserAliases,
  coaMappingRules,
  coaMappedLineItems,
  coaMappingAuditLog,
  docIntelExtractedItems,
  docIntelUploads,
  type TaxonomyPack,
  type CoaProfitCenter,
  type CoaSubCenter,
  type CoaCanonicalAccount,
  type CoaGlobalAlias,
  type CoaMappingRule,
  type CoaMappedLineItem,
} from '@shared/schema';

function normalizeLabel(raw: string): string {
  return raw.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalizeLabel(s).split(' ').filter(Boolean);
}

export interface MappingCandidate {
  canonicalAccountId: string;
  canonicalAccountCode: string;
  canonicalAccountName: string;
  profitCenterId: string;
  profitCenterName: string;
  subCenterId: string | null;
  subCenterName: string | null;
  confidence: number;
  method: 'EXACT_ALIAS' | 'RULES' | 'EMBEDDING' | 'LLM' | 'MANUAL';
  explanation: string;
}

export interface MappingResult {
  extractedItemId: string;
  rawLabel: string;
  winner: MappingCandidate | null;
  candidates: MappingCandidate[];
  reviewStatus: 'AUTO_MAPPED' | 'NEEDS_REVIEW';
}

export interface BatchMappingResult {
  total: number;
  autoMapped: number;
  needsReview: number;
  results: MappingResult[];
}

const AUTO_APPROVE_THRESHOLD = 0.90;
const KEYWORD_MATCH_BASE = 0.80;
const MULTI_KEYWORD_BOOST = 0.05;

interface CachedPack {
  pack: TaxonomyPack;
  profitCenters: CoaProfitCenter[];
  subCenters: CoaSubCenter[];
  accounts: CoaCanonicalAccount[];
  globalAliases: CoaGlobalAlias[];
  rules: CoaMappingRule[];
  pcMap: Map<string, CoaProfitCenter>;
  scMap: Map<string, CoaSubCenter>;
  acctMap: Map<string, CoaCanonicalAccount>;
  aliasIndex: Map<string, { alias: CoaGlobalAlias; account: CoaCanonicalAccount }>;
}

let packCache: CachedPack | null = null;
let packCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadActivePack(): Promise<CachedPack> {
  if (packCache && (Date.now() - packCacheTime < CACHE_TTL_MS)) {
    return packCache;
  }

  const [pack] = await db.select().from(taxonomyPacks)
    .where(and(eq(taxonomyPacks.assetClass, 'MARINA'), eq(taxonomyPacks.isActive, true)))
    .limit(1);

  if (!pack) throw new Error('No active marina taxonomy pack found');

  const [profitCenters, subCenters, accounts, globalAliases, rules] = await Promise.all([
    db.select().from(coaProfitCenters).where(eq(coaProfitCenters.packId, pack.id)).orderBy(asc(coaProfitCenters.sortOrder)),
    db.select().from(coaSubCenters).where(eq(coaSubCenters.packId, pack.id)).orderBy(asc(coaSubCenters.sortOrder)),
    db.select().from(coaCanonicalAccounts).where(and(eq(coaCanonicalAccounts.packId, pack.id), eq(coaCanonicalAccounts.isActive, true))).orderBy(asc(coaCanonicalAccounts.sortOrder)),
    db.select().from(coaGlobalAliases).where(eq(coaGlobalAliases.packId, pack.id)),
    db.select().from(coaMappingRules).where(and(eq(coaMappingRules.packId, pack.id), eq(coaMappingRules.isActive, true))).orderBy(asc(coaMappingRules.priority)),
  ]);

  const pcMap = new Map<string, CoaProfitCenter>();
  for (const pc of profitCenters) pcMap.set(pc.id, pc);

  const scMap = new Map<string, CoaSubCenter>();
  for (const sc of subCenters) scMap.set(sc.id, sc);

  const acctMap = new Map<string, CoaCanonicalAccount>();
  for (const a of accounts) acctMap.set(a.id, a);

  const aliasIndex = new Map<string, { alias: CoaGlobalAlias; account: CoaCanonicalAccount }>();
  for (const alias of globalAliases) {
    const account = acctMap.get(alias.canonicalAccountId);
    if (account) {
      aliasIndex.set(alias.normalizedLabel, { alias, account });
    }
  }

  packCache = { pack, profitCenters, subCenters, accounts, globalAliases, rules, pcMap, scMap, acctMap, aliasIndex };
  packCacheTime = Date.now();
  return packCache;
}

export function invalidatePackCache() {
  packCache = null;
  packCacheTime = 0;
}

function buildCandidate(
  account: CoaCanonicalAccount,
  cached: CachedPack,
  confidence: number,
  method: MappingCandidate['method'],
  explanation: string,
): MappingCandidate {
  const pc = cached.pcMap.get(account.profitCenterId);
  const sc = account.subCenterId ? cached.scMap.get(account.subCenterId) : null;
  return {
    canonicalAccountId: account.id,
    canonicalAccountCode: account.code,
    canonicalAccountName: account.name,
    profitCenterId: account.profitCenterId,
    profitCenterName: pc?.name || 'Unknown',
    subCenterId: account.subCenterId,
    subCenterName: sc?.name || null,
    confidence: Math.min(confidence, 1.0),
    method,
    explanation,
  };
}

function resolveViaAlias(
  normalizedLabel: string,
  cached: CachedPack,
  userAliases: Map<string, { canonicalAccountId: string; profitCenterId: string; subCenterId: string | null }>,
): MappingCandidate | null {
  const userHit = userAliases.get(normalizedLabel);
  if (userHit) {
    const account = cached.acctMap.get(userHit.canonicalAccountId);
    if (account) {
      return buildCandidate(account, cached, 0.98, 'EXACT_ALIAS', 'Matched user-specific alias (org-level learning)');
    }
  }

  const globalHit = cached.aliasIndex.get(normalizedLabel);
  if (globalHit) {
    const conf = parseFloat(String(globalHit.alias.confidenceHint ?? '0.95'));
    return buildCandidate(globalHit.account, cached, conf, 'EXACT_ALIAS', `Matched global alias: "${globalHit.alias.rawLabel}"`);
  }

  return null;
}

function resolveViaRules(
  normalizedLabel: string,
  rawLabel: string,
  categoryTier: string | null,
  classLocation: string | null,
  cached: CachedPack,
): MappingCandidate[] {
  const candidates: MappingCandidate[] = [];
  const labelLower = normalizedLabel;
  const tierLower = (categoryTier || '').toLowerCase();
  const classLower = (classLocation || '').toLowerCase();

  for (const rule of cached.rules) {
    if (rule.ruleType === 'CLASS_LOCATION') {
      if (!classLower) continue;
      const patterns = rule.pattern.split('|').map(p => p.trim().toLowerCase());
      const matched = patterns.some(p => classLower.includes(p));
      if (!matched) continue;

      const account = cached.acctMap.get(rule.outputCanonicalAccountId);
      if (!account) continue;

      const conf = parseFloat(String(rule.baseConfidence ?? '0.90'));
      candidates.push(buildCandidate(account, cached, conf, 'RULES',
        rule.explanationTemplate || `CLASS_LOCATION rule "${rule.name}" matched class/location "${classLocation}"`
      ));
      continue;
    }

    if (rule.ruleType === 'KEYWORD') {
      const patterns = rule.pattern.split('|').map(p => p.trim().toLowerCase());
      const excludePatterns = rule.excludes ? rule.excludes.split('|').map(p => p.trim().toLowerCase()) : [];

      const matchCount = patterns.filter(p => labelLower.includes(p)).length;
      if (matchCount === 0) continue;

      const excluded = excludePatterns.some(p => labelLower.includes(p));

      if (excluded && tierLower) {
        const isCost = ['cogs', 'cost', 'expense'].some(t => tierLower.includes(t));
        const isRevenue = ['revenue', 'income', 'sale'].some(t => tierLower.includes(t));

        const ruleExcludesExpense = excludePatterns.some(p => ['expense', 'cost', 'cogs'].includes(p));
        const ruleExcludesRevenue = excludePatterns.some(p => ['revenue', 'income', 'sale'].includes(p));

        if (ruleExcludesExpense && isCost) continue;
        if (ruleExcludesRevenue && isRevenue) continue;
        if (ruleExcludesExpense && isRevenue) { /* category tier overrides exclude */ }
        else if (ruleExcludesRevenue && isCost) { /* category tier overrides exclude */ }
        else continue;
      } else if (excluded) {
        continue;
      }

      const account = cached.acctMap.get(rule.outputCanonicalAccountId);
      if (!account) continue;

      const baseConf = parseFloat(String(rule.baseConfidence ?? '0.85'));
      const boost = Math.min((matchCount - 1) * MULTI_KEYWORD_BOOST, 0.10);
      const conf = baseConf + boost;

      candidates.push(buildCandidate(account, cached, conf, 'RULES',
        rule.explanationTemplate || `KEYWORD rule "${rule.name}" matched ${matchCount} pattern(s)`
      ));
    }

    if (rule.ruleType === 'REGEX') {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (!re.test(rawLabel)) continue;

        if (rule.excludes) {
          const exRe = new RegExp(rule.excludes, 'i');
          if (exRe.test(rawLabel)) continue;
        }

        const account = cached.acctMap.get(rule.outputCanonicalAccountId);
        if (!account) continue;

        const conf = parseFloat(String(rule.baseConfidence ?? '0.85'));
        candidates.push(buildCandidate(account, cached, conf, 'RULES',
          rule.explanationTemplate || `REGEX rule "${rule.name}" matched`
        ));
      } catch {
        continue;
      }
    }
  }

  return candidates;
}

function resolveViaKeywordSimilarity(
  normalizedLabel: string,
  categoryTier: string | null,
  cached: CachedPack,
): MappingCandidate[] {
  const candidates: MappingCandidate[] = [];
  const labelTokens = new Set(tokenize(normalizedLabel));
  if (labelTokens.size === 0) return candidates;

  const tierLower = (categoryTier || '').toLowerCase();
  const isExpenseContext = ['cogs', 'cost', 'expense'].some(t => tierLower.includes(t));
  const isRevenueContext = ['revenue', 'income', 'sale'].some(t => tierLower.includes(t));

  for (const account of cached.accounts) {
    if (!account.keywords || account.keywords.length === 0) continue;

    if (isExpenseContext && account.statementType === 'REVENUE') continue;
    if (isRevenueContext && (account.statementType === 'OPEX' || account.statementType === 'COGS')) continue;

    let totalMatchWeight = 0;
    let matchCount = 0;

    for (const kw of account.keywords) {
      const kwLower = kw.toLowerCase();
      if (normalizedLabel.includes(kwLower)) {
        const kwTokens = tokenize(kwLower);
        totalMatchWeight += kwTokens.length;
        matchCount++;
      }
    }

    if (matchCount === 0) continue;

    const keywordCoverage = matchCount / account.keywords.length;
    const labelCoverage = totalMatchWeight / Math.max(labelTokens.size, 1);
    const confidence = KEYWORD_MATCH_BASE + (keywordCoverage * 0.08) + (labelCoverage * 0.08);

    candidates.push(buildCandidate(account, cached, confidence, 'RULES',
      `Keyword similarity: ${matchCount}/${account.keywords.length} keywords matched, coverage ${(labelCoverage * 100).toFixed(0)}%`
    ));
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}

async function mapSingleItem(
  item: {
    id: string;
    rawLabel: string;
    categoryTier?: string | null;
    qboClass?: string | null;
    qboLocation?: string | null;
  },
  cached: CachedPack,
  userAliases: Map<string, { canonicalAccountId: string; profitCenterId: string; subCenterId: string | null }>,
): Promise<MappingResult> {
  const rawLabel = item.rawLabel;
  const normalizedLabel = normalizeLabel(rawLabel);
  const candidates: MappingCandidate[] = [];

  const aliasResult = resolveViaAlias(normalizedLabel, cached, userAliases);
  if (aliasResult) {
    candidates.push(aliasResult);
  }

  const classLocation = item.qboClass || item.qboLocation || null;
  const ruleResults = resolveViaRules(normalizedLabel, rawLabel, item.categoryTier || null, classLocation, cached);
  for (const r of ruleResults) {
    if (!candidates.some(c => c.canonicalAccountId === r.canonicalAccountId)) {
      candidates.push(r);
    }
  }

  if (candidates.length < 3) {
    const simResults = resolveViaKeywordSimilarity(normalizedLabel, item.categoryTier || null, cached);
    for (const s of simResults) {
      if (!candidates.some(c => c.canonicalAccountId === s.canonicalAccountId)) {
        candidates.push(s);
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const topCandidates = candidates.slice(0, 5);

  const winner = topCandidates.length > 0 ? topCandidates[0] : null;
  const reviewStatus: 'AUTO_MAPPED' | 'NEEDS_REVIEW' =
    winner && winner.confidence >= AUTO_APPROVE_THRESHOLD ? 'AUTO_MAPPED' : 'NEEDS_REVIEW';

  return {
    extractedItemId: item.id,
    rawLabel,
    winner,
    candidates: topCandidates,
    reviewStatus,
  };
}

export async function mapExtractedItems(
  extractedItemIds: string[],
  orgId?: string,
  userId?: string,
): Promise<BatchMappingResult> {
  if (extractedItemIds.length === 0) {
    return { total: 0, autoMapped: 0, needsReview: 0, results: [] };
  }

  const cached = await loadActivePack();

  let userAliasMap = new Map<string, { canonicalAccountId: string; profitCenterId: string; subCenterId: string | null }>();
  if (orgId) {
    const orgAliases = await db.select().from(coaUserAliases)
      .where(and(eq(coaUserAliases.orgId, orgId), eq(coaUserAliases.packId, cached.pack.id)));
    for (const ua of orgAliases) {
      userAliasMap.set(ua.normalizedLabel, {
        canonicalAccountId: ua.canonicalAccountId,
        profitCenterId: ua.profitCenterId,
        subCenterId: ua.subCenterId,
      });
    }
  }

  const items = await db.select().from(docIntelExtractedItems)
    .where(inArray(docIntelExtractedItems.id, extractedItemIds));

  const results: MappingResult[] = [];
  let autoMapped = 0;
  let needsReview = 0;

  for (const item of items) {
    const rawLabel = item.accountName || item.lineLabel || '';
    if (!rawLabel.trim()) {
      results.push({
        extractedItemId: item.id,
        rawLabel: '',
        winner: null,
        candidates: [],
        reviewStatus: 'NEEDS_REVIEW',
      });
      needsReview++;
      continue;
    }

    const meta = item.metadata as Record<string, any> | null;
    const result = await mapSingleItem({
      id: item.id,
      rawLabel,
      categoryTier: item.categoryTier,
      qboClass: meta?.qboClass || null,
      qboLocation: meta?.qboLocation || null,
    }, cached, userAliasMap);

    results.push(result);
    if (result.reviewStatus === 'AUTO_MAPPED') autoMapped++;
    else needsReview++;
  }

  return { total: results.length, autoMapped, needsReview, results };
}

export async function persistMappingResults(
  results: MappingResult[],
  userId?: string,
  orgId?: string,
): Promise<number> {
  const cached = await loadActivePack();
  let persisted = 0;

  for (const result of results) {
    if (!result.winner) continue;

    const existing = await db.select({ id: coaMappedLineItems.id })
      .from(coaMappedLineItems)
      .where(eq(coaMappedLineItems.extractedItemId, result.extractedItemId))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(coaMappedLineItems).values({
      extractedItemId: result.extractedItemId,
      packId: cached.pack.id,
      canonicalAccountId: result.winner.canonicalAccountId,
      profitCenterId: result.winner.profitCenterId,
      subCenterId: result.winner.subCenterId,
      confidence: result.winner.confidence.toFixed(4),
      method: result.winner.method,
      explanation: result.winner.explanation,
      candidates: result.candidates as any,
      reviewedStatus: result.reviewStatus,
    });

    persisted++;
  }

  if (persisted > 0 && userId) {
    await db.insert(coaMappingAuditLog).values({
      userId: userId || null,
      orgId: orgId || null,
      action: 'AUTO_MAP',
      newMapping: { count: persisted, method: 'batch_auto_map' },
    });
  }

  return persisted;
}

async function verifyExtractedItemOrg(extractedItemId: string, orgId: string): Promise<boolean> {
  const result = await db.select({ id: docIntelExtractedItems.id })
    .from(docIntelExtractedItems)
    .innerJoin(docIntelUploads, eq(docIntelExtractedItems.uploadId, docIntelUploads.id))
    .where(and(eq(docIntelExtractedItems.id, extractedItemId), eq(docIntelUploads.orgId, orgId)))
    .limit(1);
  return result.length > 0;
}

export async function overrideMapping(
  extractedItemId: string,
  canonicalAccountId: string,
  profitCenterId: string,
  subCenterId: string | null,
  userId: string,
  orgId: string,
  createAlias: boolean = false,
): Promise<CoaMappedLineItem> {
  const ownsItem = await verifyExtractedItemOrg(extractedItemId, orgId);
  if (!ownsItem) throw new Error('Access denied: item does not belong to your organization');

  const cached = await loadActivePack();
  const account = cached.acctMap.get(canonicalAccountId);
  if (!account) throw new Error('Invalid canonical account ID');

  const existing = await db.select().from(coaMappedLineItems)
    .where(eq(coaMappedLineItems.extractedItemId, extractedItemId))
    .limit(1);

  const oldMapping = existing.length > 0 ? {
    canonicalAccountId: existing[0].canonicalAccountId,
    profitCenterId: existing[0].profitCenterId,
    subCenterId: existing[0].subCenterId,
    confidence: existing[0].confidence,
    method: existing[0].method,
  } : null;

  let updated: CoaMappedLineItem;
  if (existing.length > 0) {
    const [result] = await db.update(coaMappedLineItems)
      .set({
        canonicalAccountId,
        profitCenterId,
        subCenterId,
        confidence: '1.0000',
        method: 'MANUAL',
        explanation: `Manually overridden by user`,
        reviewedStatus: 'OVERRIDDEN',
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coaMappedLineItems.id, existing[0].id))
      .returning();
    updated = result;
  } else {
    const [result] = await db.insert(coaMappedLineItems).values({
      extractedItemId,
      packId: cached.pack.id,
      canonicalAccountId,
      profitCenterId,
      subCenterId,
      confidence: '1.0000',
      method: 'MANUAL',
      explanation: 'Manually mapped by user',
      reviewedStatus: 'OVERRIDDEN',
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    }).returning();
    updated = result;
  }

  await db.insert(coaMappingAuditLog).values({
    userId,
    orgId,
    extractedItemId,
    oldMapping: oldMapping as any,
    newMapping: { canonicalAccountId, profitCenterId, subCenterId } as any,
    action: 'OVERRIDE',
  });

  if (createAlias) {
    const item = await db.select().from(docIntelExtractedItems)
      .where(eq(docIntelExtractedItems.id, extractedItemId))
      .limit(1);

    if (item.length > 0) {
      const rawLabel = item[0].accountName || item[0].lineLabel || '';
      if (rawLabel.trim()) {
        const normalized = normalizeLabel(rawLabel);
        const existingAlias = await db.select().from(coaUserAliases)
          .where(and(
            eq(coaUserAliases.orgId, orgId),
            eq(coaUserAliases.normalizedLabel, normalized),
          ))
          .limit(1);

        if (existingAlias.length === 0) {
          await db.insert(coaUserAliases).values({
            userId,
            orgId,
            packId: cached.pack.id,
            rawLabel,
            normalizedLabel: normalized,
            canonicalAccountId,
            profitCenterId,
            subCenterId,
            createdFrom: 'USER_CONFIRMATION',
          });
        }
      }
    }
  }

  return updated;
}

async function verifyMappedItemOrg(mappedItemId: string, orgId: string): Promise<boolean> {
  const result = await db.select({ id: coaMappedLineItems.id })
    .from(coaMappedLineItems)
    .innerJoin(docIntelExtractedItems, eq(coaMappedLineItems.extractedItemId, docIntelExtractedItems.id))
    .innerJoin(docIntelUploads, eq(docIntelExtractedItems.uploadId, docIntelUploads.id))
    .where(and(eq(coaMappedLineItems.id, mappedItemId), eq(docIntelUploads.orgId, orgId)))
    .limit(1);
  return result.length > 0;
}

export async function approveMapping(
  mappedItemId: string,
  userId: string,
  orgId: string,
  createAlias: boolean = false,
): Promise<CoaMappedLineItem> {
  const ownsItem = await verifyMappedItemOrg(mappedItemId, orgId);
  if (!ownsItem) throw new Error('Access denied: mapped item does not belong to your organization');

  const [existing] = await db.select().from(coaMappedLineItems)
    .where(eq(coaMappedLineItems.id, mappedItemId))
    .limit(1);

  if (!existing) throw new Error('Mapped item not found');

  const [updated] = await db.update(coaMappedLineItems)
    .set({
      reviewedStatus: 'APPROVED',
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(coaMappedLineItems.id, mappedItemId))
    .returning();

  await db.insert(coaMappingAuditLog).values({
    userId,
    orgId,
    extractedItemId: existing.extractedItemId,
    newMapping: {
      canonicalAccountId: existing.canonicalAccountId,
      profitCenterId: existing.profitCenterId,
      status: 'APPROVED',
    } as any,
    action: 'APPROVE',
  });

  if (createAlias) {
    const item = await db.select().from(docIntelExtractedItems)
      .where(eq(docIntelExtractedItems.id, existing.extractedItemId))
      .limit(1);

    if (item.length > 0) {
      const rawLabel = item[0].accountName || item[0].lineLabel || '';
      if (rawLabel.trim()) {
        const cached = await loadActivePack();
        const normalized = normalizeLabel(rawLabel);

        const existingAlias = await db.select().from(coaUserAliases)
          .where(and(
            eq(coaUserAliases.orgId, orgId),
            eq(coaUserAliases.normalizedLabel, normalized),
          ))
          .limit(1);

        if (existingAlias.length === 0) {
          await db.insert(coaUserAliases).values({
            userId,
            orgId,
            packId: cached.pack.id,
            rawLabel,
            normalizedLabel: normalized,
            canonicalAccountId: existing.canonicalAccountId,
            profitCenterId: existing.profitCenterId,
            subCenterId: existing.subCenterId,
            createdFrom: 'USER_CONFIRMATION',
          });
        }
      }
    }
  }

  return updated;
}

export async function bulkApprove(
  mappedItemIds: string[],
  userId: string,
  orgId: string,
): Promise<number> {
  if (mappedItemIds.length === 0) return 0;

  let approved = 0;
  for (const id of mappedItemIds) {
    try {
      await approveMapping(id, userId, orgId, true);
      approved++;
    } catch {
      continue;
    }
  }

  return approved;
}

export async function dismissMapping(
  mappedItemId: string,
  userId: string,
  orgId: string,
  reason?: string,
): Promise<CoaMappedLineItem> {
  const ownsItem = await verifyMappedItemOrg(mappedItemId, orgId);
  if (!ownsItem) throw new Error('Access denied: mapped item does not belong to your organization');

  const [existing] = await db.select().from(coaMappedLineItems)
    .where(eq(coaMappedLineItems.id, mappedItemId))
    .limit(1);

  if (!existing) throw new Error('Mapped item not found');

  const [updated] = await db.update(coaMappedLineItems)
    .set({
      reviewedStatus: 'DISMISSED',
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      explanation: reason ? `Dismissed: ${reason}` : 'Dismissed by user',
    })
    .where(eq(coaMappedLineItems.id, mappedItemId))
    .returning();

  await db.insert(coaMappingAuditLog).values({
    userId,
    orgId,
    extractedItemId: existing.extractedItemId,
    oldMapping: {
      canonicalAccountId: existing.canonicalAccountId,
      profitCenterId: existing.profitCenterId,
      status: existing.reviewedStatus,
    } as any,
    newMapping: { status: 'DISMISSED', reason: reason || null } as any,
    action: 'DISMISS',
  });

  return updated;
}

export async function getTaxonomyTree() {
  const cached = await loadActivePack();
  return {
    pack: { id: cached.pack.id, name: cached.pack.name, assetClass: cached.pack.assetClass, version: cached.pack.version },
    profitCenters: cached.profitCenters.map(pc => ({
      ...pc,
      subCenters: cached.subCenters.filter(sc => sc.profitCenterId === pc.id),
      accounts: cached.accounts.filter(a => a.profitCenterId === pc.id),
    })),
  };
}

export async function getMappingQueue(
  uploadId?: string,
  status?: 'AUTO_MAPPED' | 'NEEDS_REVIEW' | 'APPROVED' | 'OVERRIDDEN',
  limit: number = 100,
  offset: number = 0,
  orgId?: string,
) {
  let conditions = [];
  if (status) {
    conditions.push(eq(coaMappedLineItems.reviewedStatus, status));
  }

  const query = db.select({
    mapping: coaMappedLineItems,
    extractedItem: docIntelExtractedItems,
    upload: { orgId: docIntelUploads.orgId },
  })
    .from(coaMappedLineItems)
    .innerJoin(docIntelExtractedItems, eq(coaMappedLineItems.extractedItemId, docIntelExtractedItems.id))
    .innerJoin(docIntelUploads, eq(docIntelExtractedItems.uploadId, docIntelUploads.id));

  if (orgId) {
    conditions.push(eq(docIntelUploads.orgId, orgId));
  }

  if (uploadId) {
    conditions.push(eq(docIntelExtractedItems.uploadId, uploadId));
  }

  let baseQuery;
  if (conditions.length > 0) {
    baseQuery = query.where(and(...conditions));
  } else {
    baseQuery = query;
  }

  const items = await baseQuery
    .orderBy(asc(coaMappedLineItems.reviewedStatus), desc(coaMappedLineItems.confidence))
    .limit(limit)
    .offset(offset);

  const cached = await loadActivePack();

  return items.map(({ mapping, extractedItem }) => {
    const account = cached.acctMap.get(mapping.canonicalAccountId);
    const pc = cached.pcMap.get(mapping.profitCenterId);
    const sc = mapping.subCenterId ? cached.scMap.get(mapping.subCenterId) : null;

    return {
      id: mapping.id,
      extractedItemId: mapping.extractedItemId,
      rawLabel: extractedItem.accountName || extractedItem.lineLabel || '',
      amount: extractedItem.amount,
      period: extractedItem.periodLabel,
      categoryTier: extractedItem.categoryTier,
      canonicalAccount: account ? { id: account.id, code: account.code, name: account.name, statementType: account.statementType } : null,
      profitCenter: pc ? { id: pc.id, code: pc.code, name: pc.name } : null,
      subCenter: sc ? { id: sc.id, code: sc.code, name: sc.name } : null,
      confidence: mapping.confidence,
      method: mapping.method,
      explanation: mapping.explanation,
      reviewedStatus: mapping.reviewedStatus,
      reviewedAt: mapping.reviewedAt,
      candidates: mapping.candidates,
    };
  });
}

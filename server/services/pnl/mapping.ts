import { db } from '../../db';
import {
  pnlCanonicalLineItems,
  pnlLineItemAliases,
  pnlParsedStatements,
  pnlReviewItems,
  pnlJobs,
  pnlKeywordRules,
  pnlDocuments,
  modelingProjects,
  type PnlMappingMethod,
  type ParsedRow,
  type ParsedStatementPayload,
  type PnlKeywordRule,
} from '@shared/schema';
import { and, eq, or, isNull, sql, desc, asc } from 'drizzle-orm';
import { getLlmClassifier, type ClassificationRequest } from '../../utils/llm';
import { normalizeDepartment, normalizeBucket } from '../../utils/department-mapping';
import { isMustReviewLabel } from './key-bank';
import { storeMappedFacts } from './ingest';
import { promotePnlFactsToActuals } from './promote-to-actuals';

interface AmbiguousDepartmentOption {
  department: string;
  bucket: string;
  description: string;
}

interface AmbiguousKeyword {
  keywords: string[];
  possibleDepartments: AmbiguousDepartmentOption[];
  reason: string;
}

const AMBIGUOUS_LINE_ITEMS: AmbiguousKeyword[] = [
  {
    keywords: ['cleaning labor', 'cleaning wages', 'cleaning staff', 'janitorial labor', 'janitorial wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house cleaning staff wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract cleaning service (third-party)' },
    ],
    reason: 'Cleaning labor could be in-house payroll or contracted services depending on your marina\'s arrangement.',
  },
  {
    keywords: ['dock labor', 'dock hand', 'dockhand wages', 'dock attendant'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Full-time dock employee wages' },
      { department: 'Storage', bucket: 'Expense', description: 'Dock operations labor cost' },
    ],
    reason: 'Dock labor may be classified under payroll or as a direct storage operations cost.',
  },
  {
    keywords: ['maintenance labor', 'repair labor', 'maintenance wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house maintenance staff wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract maintenance services' },
      { department: 'Service', bucket: 'Expense', description: 'Service department labor allocation' },
    ],
    reason: 'Maintenance labor could be payroll, contract services, or allocated to the service department.',
  },
  {
    keywords: ['fuel labor', 'fuel attendant', 'fuel dock labor'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Fuel dock staff wages' },
      { department: 'Fuel', bucket: 'Expense', description: 'Fuel operations labor cost' },
    ],
    reason: 'Fuel labor may be allocated to payroll or directly to fuel operations.',
  },
  {
    keywords: ['security labor', 'security wages', 'guard wages', 'night watch'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house security staff wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract security service' },
    ],
    reason: 'Security costs may be in-house payroll or contracted third-party services.',
  },
  {
    keywords: ['landscaping labor', 'grounds labor', 'groundskeeping'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house grounds crew wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract landscaping service' },
    ],
    reason: 'Landscaping may be performed by employees (payroll) or contracted out.',
  },
  {
    keywords: ['service labor', 'mechanic labor', 'technician labor', 'tech wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Service department payroll' },
      { department: 'Service', bucket: 'COGS', description: 'Direct labor cost of goods sold' },
    ],
    reason: 'Service technician labor could be classified as payroll expense or COGS depending on accounting method.',
  },
  {
    keywords: ['ship store labor', 'retail labor', 'store wages', 'retail wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Retail staff payroll' },
      { department: "Ship's Store", bucket: 'Expense', description: 'Ship store operations labor' },
    ],
    reason: 'Retail staff wages may be under general payroll or allocated to ship store department.',
  },
  {
    keywords: ['office labor', 'admin labor', 'administrative wages', 'office wages', 'clerical wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Administrative payroll' },
      { department: 'General', bucket: 'Expense', description: 'General & administrative expense' },
    ],
    reason: 'Office/admin wages may be classified under payroll or G&A expenses.',
  },
  {
    keywords: ['management fee', 'manager fee', 'management expense'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Manager salary/compensation' },
      { department: 'General', bucket: 'Expense', description: 'Third-party management fee' },
    ],
    reason: 'Management fees could be internal payroll or external management company fees.',
  },
  {
    keywords: ['contract labor', 'contracted labor', 'temp labor', 'temporary labor'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Temporary/seasonal employee wages' },
      { department: 'General', bucket: 'Expense', description: 'Third-party contract services' },
      { department: 'Service', bucket: 'Expense', description: 'Contracted service technicians' },
    ],
    reason: 'Contract labor classification depends on whether workers are on payroll or independent contractors.',
  },
  {
    keywords: ['trash removal', 'garbage service', 'waste disposal', 'dumpster service'],
    possibleDepartments: [
      { department: 'General', bucket: 'Expense', description: 'General facility expense' },
      { department: 'Marina & Amenities', bucket: 'Expense', description: 'Marina amenities operating cost' },
    ],
    reason: 'Waste services may be classified as general overhead or marina amenities.',
  },
  {
    keywords: ['credit card fees', 'merchant fees', 'processing fees', 'card fees'],
    possibleDepartments: [
      { department: 'General', bucket: 'Expense', description: 'General bank/CC fees' },
      { department: 'Fuel', bucket: 'COGS', description: 'Fuel sales processing fees' },
      { department: "Ship's Store", bucket: 'COGS', description: 'Retail processing fees' },
    ],
    reason: 'Credit card fees may be allocated to general expense or specific revenue departments.',
  },
];

interface MapResult {
  canonicalLineItemId?: string;
  mappingMethod: PnlMappingMethod;
  confidence: number;
  suggestion?: any;
  matchedKeywordRuleId?: string;
  department?: string;
  bucket?: string;
  isAmbiguous?: boolean;
  ambiguityInfo?: {
    reason: string;
    possibleDepartments: AmbiguousDepartmentOption[];
    matchedKeyword: string;
  };
}

interface KeywordMatch {
  rule: PnlKeywordRule;
  matchType: 'exact' | 'phrase' | 'token';
  score: number;
}

const CONFIDENCE_THRESHOLD = 0.75;

function checkAmbiguity(normalized: string): { isAmbiguous: boolean; ambiguityInfo?: MapResult['ambiguityInfo'] } {
  const normalizedLower = normalized.toLowerCase();
  
  for (const ambiguousItem of AMBIGUOUS_LINE_ITEMS) {
    for (const keyword of ambiguousItem.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (normalizedLower === keywordLower || 
          normalizedLower.includes(keywordLower) || 
          keywordLower.includes(normalizedLower)) {
        return {
          isAmbiguous: true,
          ambiguityInfo: {
            reason: ambiguousItem.reason,
            possibleDepartments: ambiguousItem.possibleDepartments,
            matchedKeyword: keyword,
          },
        };
      }
    }
  }
  
  return { isAmbiguous: false };
}

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

async function tryKeywordMatch(
  orgId: string,
  normalized: string,
  canonicalByKey: Map<string, { id: string }>,
): Promise<MapResult> {
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

  // B3 step 2: keyword rules can reference a canonical via either
  // canonical_line_item_id (per-org FK) OR canonical_coa_code (text key). For
  // global seeds (org_id IS NULL), the FK is null and we resolve the org's
  // canonical row by canonical_coa_code → pnl_canonical_line_items.canonical_key.
  let resolvedCanonicalId: string | undefined = best.rule.canonicalLineItemId ?? undefined;
  if (!resolvedCanonicalId && best.rule.canonicalCoaCode) {
    const hit = canonicalByKey.get(best.rule.canonicalCoaCode);
    if (hit) resolvedCanonicalId = hit.id;
  }

  return {
    canonicalLineItemId: resolvedCanonicalId,
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
      canonicalCoaCode: best.rule.canonicalCoaCode ?? null,
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

/**
 * B3 step 2: exact-match only. The previous ≥2-word fuzzy tier was the source
 * of the worst auto-map mismaps (e.g., "Sales Tax Expense" → property tax via
 * shared "tax" token). Fuzzy is removed; ambiguous-but-not-exact labels fall
 * through to the LLM stage where the closed-vocab prompt makes the call.
 */
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
        confidence: 0.95,
        department: c.department,
      };
    }
  }

  return { mappingMethod: 'none', confidence: 0 };
}

const LLM_PROVIDER = process.env.LLM_PROVIDER?.toLowerCase() ?? 'mock';
const IS_REAL_LLM = LLM_PROVIDER === 'openai' || LLM_PROVIDER === 'anthropic';

// B3 step 2: legacy fuzzy backstop is OFF by default. The old endsWith / display-
// name-includes path produced silent mis-maps (e.g., "Insurance Expense" → any
// canonical ending in 'expense'). Default behavior is: no exact match in
// canonicalById → route to needs_review. Setting the env var to 'true' restores
// the legacy fuzzy pass for one release while we observe behavior.
const PNL_LLM_FUZZY_BACKSTOP = process.env.PNL_LLM_FUZZY_BACKSTOP === 'true';

function sectionToBucketStr(section: string | undefined): string {
  if (section === 'cogs') return 'COGS';
  if (section === 'revenue') return 'Revenue';
  if (section === 'payroll') return 'Expense';
  return 'Expense';
}

async function tryLlmClassification(
  orgId: string,
  label: string,
  normalized: string,
  canonicalByKey: Map<string, { id: string; section: string; department: string }>,
  context?: { nearbyLabels?: string[]; vendorHint?: string; sectionHint?: string; assetClass?: string }
): Promise<MapResult> {
  try {
    const classifier = getLlmClassifier();
    const request: ClassificationRequest = {
      label,
      normalizedLabel: normalized,
      context,
    };

    const result = await classifier.classify(request);

    const isMockResult = classifier.name === 'mock';
    const confidenceAdjustment = isMockResult ? 0.5 : 1.0;
    const adjustedConfidence = result.confidence * confidenceAdjustment;
    const normalizedDept = normalizeDepartment(result.department);

    // Classifier explicitly returned no key (review sentinel or low confidence)
    // — pass straight to review with the classifier reasoning preserved.
    if (!result.canonicalKey || adjustedConfidence < 0.5) {
      return {
        mappingMethod: isMockResult ? 'rule' : 'ai',
        confidence: adjustedConfidence,
        department: normalizedDept,
        bucket: sectionToBucketStr(result.section),
        suggestion: {
          llmResponse: result,
          noCanonicalMatch: true,
          isMockClassifier: isMockResult,
          reason: 'classifier_returned_no_key',
        },
      };
    }

    // B3 step 2: exact-match only against the org's canonical bank. The
    // canonicalByKey map is keyed on canonical_key (exact, case-sensitive). No
    // suffix-split, no displayName.includes — those were the namespace-bridge
    // hacks that produced confident wrong matches across the snake_case ↔
    // camelCase divide.
    const exact = canonicalByKey.get(result.canonicalKey);

    if (exact) {
      return {
        canonicalLineItemId: exact.id,
        mappingMethod: isMockResult ? 'rule' : 'ai',
        confidence: adjustedConfidence,
        department: normalizedDept,
        bucket: sectionToBucketStr(result.section),
        suggestion: {
          llmResponse: result,
          matchedCanonical: result.canonicalKey,
          matchMode: 'exact',
          isMockClassifier: isMockResult,
        },
      };
    }

    // No exact match. Feature-flagged legacy fuzzy backstop — LOG every fire so
    // we can observe its impact before removing entirely next release.
    if (PNL_LLM_FUZZY_BACKSTOP) {
      const suffix = result.canonicalKey.split('.').pop() || '';
      const canonicals = Array.from(canonicalByKey.values());
      const fuzzy = canonicals.find(c => suffix && (c as any).canonicalKey?.endsWith(suffix));
      if (fuzzy) {
        console.warn('[PNL_LLM_FUZZY_BACKSTOP] fuzzy match fired', {
          orgId, normalized, llmKey: result.canonicalKey, matched: (fuzzy as any).canonicalKey,
        });
        return {
          canonicalLineItemId: fuzzy.id,
          mappingMethod: isMockResult ? 'rule' : 'ai',
          confidence: adjustedConfidence * 0.7,
          department: normalizedDept,
          bucket: sectionToBucketStr(result.section),
          suggestion: {
            llmResponse: result,
            matchedCanonical: (fuzzy as any).canonicalKey,
            matchMode: 'fuzzy_backstop',
            isMockClassifier: isMockResult,
          },
        };
      }
    }

    // Default: no exact match → REVIEW. Preserve the classifier suggestion so
    // the human reviewer sees what the model would have picked.
    console.log('[PNL classifier] no exact-match canonical for LLM key, routing to review', {
      orgId, normalized, llmKey: result.canonicalKey,
    });
    return {
      mappingMethod: isMockResult ? 'rule' : 'ai',
      confidence: 0,
      department: normalizedDept,
      bucket: sectionToBucketStr(result.section),
      suggestion: {
        llmResponse: result,
        noCanonicalMatch: true,
        attemptedKey: result.canonicalKey,
        isMockClassifier: isMockResult,
        reason: 'llm_key_not_in_canonical_bank',
      },
    };
  } catch (error) {
    console.error('[P&L LLM Classification] Error:', error);
    return { mappingMethod: 'none', confidence: 0 };
  }
}

/**
 * B3 step 2: resolve the asset class for a parsed statement. Threads through
 * pnl_documents.modeling_project_id → modeling_projects.asset_class. Returns
 * undefined if any link is missing — the classifier falls back to the
 * universal-only key bank in that case (still safe; just less granular).
 */
async function resolveAssetClassForJob(jobId: string): Promise<string | undefined> {
  try {
    const rows = await db
      .select({ assetClass: modelingProjects.assetClass })
      .from(pnlJobs)
      .innerJoin(pnlDocuments, eq(pnlJobs.documentId, pnlDocuments.id))
      .innerJoin(modelingProjects, eq(pnlDocuments.modelingProjectId, modelingProjects.id))
      .where(eq(pnlJobs.id, jobId))
      .limit(1);
    return rows[0]?.assetClass ?? undefined;
  } catch (e) {
    console.warn('[mapParsedStatement] asset class lookup failed', (e as Error).message);
    return undefined;
  }
}

export async function mapParsedStatement(jobId: string): Promise<{
  reviewCount: number;
  autoMappedCount: number;
  storedCount: number;
  promotedCount: number;
  status: 'completed' | 'stored';
}> {
  const parsed = await db.query.pnlParsedStatements.findFirst({
    where: eq(pnlParsedStatements.jobId, jobId),
  });

  if (!parsed) throw new Error(`No parsed statement for job ${jobId}`);

  const orgId = parsed.orgId;
  const assetClass = await resolveAssetClassForJob(jobId);

  const canonical = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });
  const canonicalById = new Map(canonical.map(c => [c.id, c]));
  // B3 step 2: key-indexed lookup for exact-match (no fuzzy split).
  // Used both by tryKeywordMatch's canonical_coa_code resolver and by the LLM
  // exact-match path.
  const canonicalByKey = new Map<string, { id: string; section: string; department: string; canonicalKey: string }>();
  for (const c of canonical) {
    canonicalByKey.set(c.canonicalKey, {
      id: c.id, section: c.section, department: c.department, canonicalKey: c.canonicalKey,
    });
  }

  const existingApproved = await db.query.pnlReviewItems.findMany({
    where: and(eq(pnlReviewItems.jobId, jobId), eq(pnlReviewItems.status, 'approved')),
  });
  const approvedLabels = new Set(existingApproved.map(r => r.normalizedLabel));

  const pj = parsed.parsedJson as ParsedStatementPayload;
  const rows = pj.rows ?? [];

  const reviewInserts: any[] = [];
  let autoMappedCount = 0;

  const sectionToBucket: Record<string, string> = {
    'revenue': 'Revenue',
    'cogs': 'COGS',
    'expense': 'Expense',
    'payroll': 'Expense',
    'non_operating': 'Expense',
    'business_income': 'Revenue',
  };

  for (const row of rows) {
    const rawLabel = row.label ?? '';
    const normalized = row.normalizedLabel ?? normalizeLabel(rawLabel);

    const structuralSection = row.sectionHint || null;
    const structuralBucket = structuralSection ? sectionToBucket[structuralSection] || null : null;

    // B3 step 2: MUST_REVIEW deny-list runs BEFORE any auto-map pass. "Sales
    // Tax" / "Ask My Accountant" / suspense / opening-balance labels never
    // auto-map even on a displayName fuzzy hit downstream.
    if (isMustReviewLabel(normalized)) {
      if (!approvedLabels.has(normalized)) {
        reviewInserts.push({
          orgId,
          jobId: parsed.jobId,
          documentId: parsed.documentId,
          extractedLabel: rawLabel,
          normalizedLabel: normalized,
          suggestedCanonicalLineItemId: null,
          suggestionJson: {
            mappingMethod: 'none',
            suggestion: { reason: 'must_review_deny_list' },
            department: null,
            bucket: structuralBucket,
            sectionHint: structuralSection,
            isAmbiguous: false,
            ambiguityInfo: null,
          },
          confidence: '0',
          status: 'needs_review',
        });
      }
      row.mapping = {
        canonicalLineItemId: null,
        mappingMethod: 'none',
        mappingConfidence: 0,
        normalizedLabel: normalized,
        resolvedDepartment: null,
        resolvedBucket: structuralBucket ? normalizeBucket(structuralBucket) : null,
        resolvedByKeywordBank: false,
      };
      continue;
    }

    let res = await tryAliasMatch(orgId, normalized);

    if (!res.canonicalLineItemId) {
      res = await tryRegexMatch(orgId, normalized);
    }

    if (!res.canonicalLineItemId || res.confidence < CONFIDENCE_THRESHOLD) {
      const keywordRes = await tryKeywordMatch(orgId, normalized, canonicalByKey);
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

    if (!res.canonicalLineItemId || res.confidence < CONFIDENCE_THRESHOLD) {
      const rowIdx = rows.indexOf(row);
      const nearbyLabels = rows
        .slice(Math.max(0, rowIdx - 3), rowIdx + 3)
        .filter(r => r !== row)
        .map(r => r.label);

      let sectionHint: string | undefined = structuralSection || undefined;
      if (!sectionHint) {
        const sectionKeywords: Record<string, string> = {
          'revenue': 'revenue', 'income': 'revenue', 'sales': 'revenue',
          'cost of goods': 'cogs', 'cogs': 'cogs', 'cost of sales': 'cogs',
          'operating expense': 'expense', 'expenses': 'expense', 'overhead': 'expense',
          'payroll': 'payroll', 'wages': 'payroll', 'salaries': 'payroll',
        };
        for (let si = rowIdx - 1; si >= Math.max(0, rowIdx - 15); si--) {
          const headerLabel = (rows[si].label ?? '').toLowerCase().trim();
          for (const [keyword, section] of Object.entries(sectionKeywords)) {
            if (headerLabel === keyword || headerLabel.startsWith(keyword + ' ') || headerLabel.startsWith('total ' + keyword)) {
              sectionHint = section;
              break;
            }
          }
          if (sectionHint) break;
        }
      }

      const llmRes = await tryLlmClassification(orgId, rawLabel, normalized, canonicalByKey as any, {
        nearbyLabels,
        vendorHint: pj.vendorHint || undefined,
        sectionHint,
        assetClass,
      });
      if (llmRes.confidence > (res.confidence || 0)) {
        res = llmRes;
      }
    }

    // B3 step 2: SECTION HARD GATE. The parser's structuralSection is
    // authoritative. If the resolved canonical's section conflicts with the
    // parser's structural section, FORCE review. This kills the worst class of
    // mismaps: COGS→revenue, income-tax→payroll, gas-utility→fuel-revenue —
    // all section/sign errors that silently corrupt NOI. The earlier soft
    // overlay (just rebucketing) was insufficient because it kept the wrong
    // canonical and only fixed the cosmetic bucket label.
    // B3 step 2: SECTION HARD GATE — income/cost equivalence-class check.
    // Equivalence classes (NO conflict within a class):
    //   INCOME = { revenue, business_income }
    //   COST   = { cogs, expense, payroll, non_operating }
    // Cross-class violations are forced to review. Same-class flips (e.g.,
    // parser=revenue, canonical=business_income for a "Used Boat Sales" line
    // segregated below NOI) are intentional design routings, not conflicts.
    // B3 step 2 + parser-fix 2026-05-28: SECTION HARD GATE — island-bucket
    // exemption.
    //
    // business_income canonicals are a SEGREGATED island bucket containing
    // their own revenue AND COGS subkeys (Phase A.1 — boat-sales gross profit
    // tracked below property NOI). A parser-cogs row landing in a
    // business_income COGS canonical is the segregation working CORRECTLY, not
    // a sign error. Same for parser-expense + business_income operating-expense
    // subkeys (e.g. Salesmen Commissions). Exempt the entire business_income
    // section from the cross-class check.
    //
    // Equivalence classes (NO conflict within a class):
    //   INCOME = { revenue }
    //   COST   = { cogs, expense, payroll, non_operating }
    //   ISLAND = { business_income }   ← exempt from gate
    let sectionConflict = false;
    const parserSec: string | null = structuralSection;
    if (parserSec && res.canonicalLineItemId) {
      const matched = canonicalById.get(res.canonicalLineItemId);
      if (matched && matched.section !== 'business_income') {
        const incomeClass: ReadonlySet<string> = new Set(['revenue']);
        const costClass: ReadonlySet<string> = new Set(['cogs', 'expense', 'payroll', 'non_operating']);
        const matchedSec: string = matched.section ?? '';
        const parserIncome = incomeClass.has(parserSec);
        const canonicalIncome = incomeClass.has(matchedSec);
        const parserCost = costClass.has(parserSec);
        const canonicalCost = costClass.has(matchedSec);
        if ((parserIncome && canonicalCost) || (parserCost && canonicalIncome)) {
          sectionConflict = true;
          console.log('[PNL section gate] forcing review on income/cost cross', {
            orgId, normalized,
            parserSection: structuralSection,
            canonicalSection: matched.section,
            canonicalKey: matched.canonicalKey,
          });
        }
      }
    }

    const hasValidCanonical = res.canonicalLineItemId && canonicalById.has(res.canonicalLineItemId);

    const wasResolvedByKeywordBank = res.mappingMethod === 'rule' &&
      res.matchedKeywordRuleId &&
      res.confidence >= 0.90;

    const ambiguityCheck = checkAmbiguity(normalized);
    if (ambiguityCheck.isAmbiguous && !wasResolvedByKeywordBank) {
      if (structuralBucket) {
        res.isAmbiguous = false;
      } else {
        res.isAmbiguous = true;
        res.ambiguityInfo = ambiguityCheck.ambiguityInfo;
      }
    }

    const needsReview = sectionConflict ||
      (!hasValidCanonical && !wasResolvedByKeywordBank) ||
      (res.confidence < CONFIDENCE_THRESHOLD && !wasResolvedByKeywordBank) ||
      res.isAmbiguous;

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
          department: res.department ? normalizeDepartment(res.department) : null,
          bucket: res.bucket ? normalizeBucket(res.bucket) : null,
          sectionHint: structuralSection,
          isAmbiguous: res.isAmbiguous ?? false,
          ambiguityInfo: res.ambiguityInfo ?? null,
          sectionConflict: sectionConflict || undefined,
        },
        confidence: String(res.confidence ?? 0),
        status: res.isAmbiguous ? 'ambiguous' : 'needs_review',
      });
    } else if (!needsReview) {
      autoMappedCount++;
    }

    // B3 step 2: if the row was forced to review by the section gate, null out
    // the canonicalLineItemId in row.mapping so downstream consumers
    // (storeMappedFacts → pnl_facts insert) don't accept the gate-rejected
    // canonical. The reviewInserts row still preserves the suggested canonical
    // for the human reviewer.
    const writeCanonicalId = sectionConflict ? null : (res.canonicalLineItemId ?? null);

    row.mapping = {
      canonicalLineItemId: writeCanonicalId,
      mappingMethod: res.mappingMethod,
      mappingConfidence: sectionConflict ? 0 : res.confidence,
      normalizedLabel: normalized,
      resolvedDepartment: res.department ? normalizeDepartment(res.department) : null,
      resolvedBucket: res.bucket ? normalizeBucket(res.bucket) : null,
      resolvedByKeywordBank: wasResolvedByKeywordBank,
    };
  }
  
  // ────────────────────────────────────────────────────────────────────────
  // Phase 3 Session 2 (Defect A): chain the WRITE path — persist parsedJson +
  // review items, materialize pnl_facts, promote to modeling_actuals, and set
  // the terminal job status — all inside ONE transaction. The job is either
  // fully advanced or not advanced at all; a failure anywhere rolls the whole
  // chain back to the pre-call state (no half-completed limbo, no wiped facts).
  //
  // This makes the previously-orphaned "mapped/store" resting state impossible:
  // mapping no longer stops one step short of the facts table. Re-running on an
  // already-completed job is safe and idempotent — facts and actuals are
  // delete-then-inserted within the same transaction.
  // ────────────────────────────────────────────────────────────────────────
  const reviewCount = reviewInserts.length;

  // Resolve the linked modeling project (promote target) and the existing
  // parser-layer metrics to preserve. Reads only — fine outside the tx.
  const [doc] = await db
    .select({ modelingProjectId: pnlDocuments.modelingProjectId })
    .from(pnlDocuments)
    .where(eq(pnlDocuments.id, parsed.documentId))
    .limit(1);
  const modelingProjectId = doc?.modelingProjectId ?? null;

  const jobRow = await db.query.pnlJobs.findFirst({ where: eq(pnlJobs.id, jobId) });
  const existingMetrics = (jobRow?.parseMetricsJson as Record<string, any>) ?? {};

  // Distinct canonical line items the mapper resolved (mapper-layer metric).
  const mappedCanonicals = new Set<string>();
  for (const row of rows) {
    if (row.mapping?.canonicalLineItemId) mappedCanonicals.add(row.mapping.canonicalLineItemId);
  }

  const isComplete = reviewCount === 0;
  const completedAtIso = new Date().toISOString();

  let storeMetrics: Awaited<ReturnType<typeof storeMappedFacts>> | null = null;
  let promoteMetrics: Awaited<ReturnType<typeof promotePnlFactsToActuals>> | null = null;

  await db.transaction(async (tx) => {
    // 1) Persist the mapping output.
    await tx
      .update(pnlParsedStatements)
      .set({ parsedJson: pj })
      .where(eq(pnlParsedStatements.id, parsed.id));

    // 2) Refresh review items.
    if (reviewInserts.length) {
      await tx.delete(pnlReviewItems).where(
        and(eq(pnlReviewItems.jobId, parsed.jobId), eq(pnlReviewItems.status, 'needs_review'))
      );
      await tx.insert(pnlReviewItems).values(reviewInserts);
    }

    // 3) Materialize pnl_facts for the auto-mapped lines (joins this tx).
    storeMetrics = await storeMappedFacts(jobId, tx);

    // 4) Promote facts → modeling_actuals (canonical-level, summed) if linked.
    if (modelingProjectId) {
      promoteMetrics = await promotePnlFactsToActuals(parsed.orgId, modelingProjectId, parsed.documentId, tx);
    }

    // 5) Honest, full-pipeline metrics — so a future trace never has to query
    //    three tables to learn what the pipeline actually did.
    const pipelineComplete = !!storeMetrics && (!modelingProjectId ? false : !!promoteMetrics);
    const parseMetricsJson = {
      ...existingMetrics,
      parser: existingMetrics.parser ?? existingMetrics,
      mapper: {
        autoMappedCount,
        reviewItemCount: reviewCount,
        distinctCanonicals: mappedCanonicals.size,
      },
      store: storeMetrics,
      promote: promoteMetrics ?? { skipped: true, reason: modelingProjectId ? 'promote-not-run' : 'no-linked-project' },
      pipelineComplete,
      completedAt: completedAtIso,
    };

    // 6) Terminal status — mirrors the orchestrator's existing semantics
    //    (parseOrchestrator.ts): no pending reviews → completed/done;
    //    otherwise stored/review (facts+actuals still populated for the
    //    auto-mapped subset). Either way the chain ran end-to-end.
    await tx
      .update(pnlJobs)
      .set(
        isComplete
          ? { status: 'completed', stage: 'done', completedAt: new Date(), parseMetricsJson, updatedAt: new Date() }
          : { status: 'stored', stage: 'review', parseMetricsJson, updatedAt: new Date() }
      )
      .where(eq(pnlJobs.id, jobId));
  });

  const storedCount = storeMetrics ? (storeMetrics as { storedCount: number }).storedCount : 0;
  const promotedCount = promoteMetrics ? (promoteMetrics as { actualsWritten: number }).actualsWritten : 0;

  console.log(
    `[P&L Mapping] Job ${jobId}: ${autoMappedCount} auto-mapped, ${reviewCount} need review, ` +
    `${storedCount} facts stored, ${promotedCount} actuals promoted → status=${isComplete ? 'completed' : 'stored'}`
  );

  return {
    reviewCount,
    autoMappedCount,
    storedCount,
    promotedCount,
    status: isComplete ? 'completed' : 'stored',
  };
}

export async function addToKeywordBank(
  orgId: string,
  normalized: string,
  department: string,
  bucket: string,
  canonicalLineItemId?: string
): Promise<void> {
  const normalizedDept = normalizeDepartment(department);
  const normalizedBkt = normalizeBucket(bucket);

  const existing = await db.query.pnlKeywordRules.findFirst({
    where: and(
      eq(pnlKeywordRules.orgId, orgId),
      eq(pnlKeywordRules.keyword, normalized),
      eq(pnlKeywordRules.department, normalizedDept),
      eq(pnlKeywordRules.bucket, normalizedBkt)
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
      department: normalizedDept,
      bucket: normalizedBkt,
      keyword: normalized,
      matchType: 'exact',
      priority: 25,
      canonicalLineItemId: canonicalLineItemId ?? null,
      isActive: true,
      source: 'learned',
      timesMatched: 1,
    });
  }

  await addGlobalKeywordRule(normalized, normalizedDept, normalizedBkt, canonicalLineItemId);
}

async function addGlobalKeywordRule(
  normalized: string,
  department: string,
  bucket: string,
  canonicalLineItemId?: string
): Promise<void> {
  try {
    const existingGlobal = await db.query.pnlKeywordRules.findFirst({
      where: and(
        isNull(pnlKeywordRules.orgId),
        eq(pnlKeywordRules.keyword, normalized),
        eq(pnlKeywordRules.department, department),
        eq(pnlKeywordRules.bucket, bucket)
      ),
    });

    if (existingGlobal) {
      await db
        .update(pnlKeywordRules)
        .set({
          timesMatched: sql`${pnlKeywordRules.timesMatched} + 1`,
          updatedAt: new Date(),
          isActive: true,
        })
        .where(eq(pnlKeywordRules.id, existingGlobal.id));
    } else {
      await db.insert(pnlKeywordRules).values({
        orgId: null,
        department,
        bucket,
        keyword: normalized,
        matchType: 'exact',
        priority: 50,
        canonicalLineItemId: canonicalLineItemId ?? null,
        isActive: true,
        source: 'global_learned',
        timesMatched: 1,
      });
    }
  } catch (error) {
    console.error('[Global Keyword Rule] Error creating global rule:', error);
  }
}

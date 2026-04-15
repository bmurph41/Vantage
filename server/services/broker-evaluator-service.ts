/**
 * Broker Evaluator Service
 *
 * Runs a broker's criteria rule set against a target (a marketplace listing
 * or a modeling project) and produces a pass/watch/pursue verdict. Results
 * are cached in `broker_evaluations` for 24h and surfaced via the feedback
 * endpoints.
 *
 * Rules engine: deterministic. Each criterion in BrokerCriteria that is set
 * becomes a gate; every gate contributes equally to the score. Score ≥ 80
 * → pursue, 50–79 → watch, < 50 → pass.
 *
 * Narrative: optional Claude Haiku call that turns the rule results into a
 * 2-sentence broker voice. Gated by the caller (Pro+ only) — the service
 * itself just generates on demand.
 *
 * RLS-safe: uses raw pool.query for broker_evaluations + broker_profiles
 * reads to avoid Drizzle empty-return footguns. Target reads go through
 * Drizzle since marina_listings and modeling_projects are not RLS-guarded.
 */

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { brokerProfiles, marinaListings, modelingProjects } from "@shared/schema";
import { eq } from "drizzle-orm";
import type {
  BrokerCriteria,
  CriterionResult,
  EvaluationResult,
  Verdict,
} from "@shared/broker/criteria";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const NARRATIVE_MODEL = "claude-haiku-4-5-20251001";

// ─── Target normalization ──────────────────────────────────────────────────

export interface NormalizedTarget {
  assetClass: string | null;
  market: string | null; // state code
  capRate: number | null;
  dscr: number | null;
  ltv: number | null;
  irr: number | null;
  holdYears: number | null;
  dealSize: number | null;
  title: string;
  raw: Record<string, unknown>;
}

async function loadListingTarget(listingId: string): Promise<NormalizedTarget | null> {
  const [row] = await db.select().from(marinaListings).where(eq(marinaListings.id, listingId));
  if (!row) return null;
  const creMetrics = (row.creMetrics as Record<string, any>) || {};
  const businessMetrics = (row.businessMetrics as Record<string, any>) || {};
  return {
    assetClass: row.assetClass || row.marinaType || null,
    market: row.state || null,
    capRate: row.capRate ? Number(row.capRate) : null,
    dscr: creMetrics.dscr ? Number(creMetrics.dscr) : null,
    ltv: creMetrics.ltv ? Number(creMetrics.ltv) : null,
    irr: creMetrics.irr ? Number(creMetrics.irr) : null,
    holdYears: creMetrics.holdYears ? Number(creMetrics.holdYears) : null,
    dealSize: row.askingPrice ? Number(row.askingPrice) : null,
    title: row.title || row.propertyName || "Untitled listing",
    raw: {
      city: row.city,
      state: row.state,
      noi: row.noi,
      ebitda: row.ebitda,
      listingCategory: row.listingCategory,
      businessMetrics,
    },
  };
}

async function loadModelingTarget(projectId: string): Promise<NormalizedTarget | null> {
  // Raw query — modeling_project_config is RLS-guarded per CLAUDE.md.
  const projRes = await pool.query(
    `SELECT id, org_id, marina_name, asset_class, purchase_price, year_1_cap_rate,
            ebitda, city, state, custom_metrics
       FROM modeling_projects
      WHERE id = $1`,
    [projectId],
  );
  if (projRes.rowCount === 0) return null;
  const p = projRes.rows[0];

  const cfgRes = await pool.query(
    `SELECT hold_period, ltv, target_irr, target_dscr
       FROM modeling_project_config
      WHERE project_id = $1
      LIMIT 1`,
    [projectId],
  ).catch(() => ({ rowCount: 0, rows: [] as any[] }));
  const cfg = cfgRes.rowCount ? cfgRes.rows[0] : ({} as any);

  const custom = (p.custom_metrics as Record<string, any>) || {};

  return {
    assetClass: p.asset_class || null,
    market: p.state || null,
    capRate: p.year_1_cap_rate != null ? Number(p.year_1_cap_rate) : null,
    dscr: cfg.target_dscr != null ? Number(cfg.target_dscr) : custom.dscr ?? null,
    ltv: cfg.ltv != null ? Number(cfg.ltv) : null,
    irr: cfg.target_irr != null ? Number(cfg.target_irr) : custom.irr ?? null,
    holdYears: cfg.hold_period != null ? Number(cfg.hold_period) : null,
    dealSize: p.purchase_price != null ? Number(p.purchase_price) : null,
    title: p.marina_name || "Untitled project",
    raw: { city: p.city, state: p.state, ebitda: p.ebitda },
  };
}

// ─── Rules engine ──────────────────────────────────────────────────────────

function runRules(criteria: BrokerCriteria, target: NormalizedTarget): EvaluationResult {
  const results: CriterionResult[] = [];

  const check = (key: string, label: string, passed: boolean, detail: string) => {
    results.push({ key, label, passed, detail });
  };

  // Asset class
  if (criteria.assetClasses && criteria.assetClasses.length > 0) {
    const ok = target.assetClass != null && criteria.assetClasses.includes(target.assetClass);
    check(
      "assetClass",
      "Asset class",
      ok,
      ok
        ? `${target.assetClass} is in focus list`
        : `${target.assetClass ?? "unknown"} is outside focus (${criteria.assetClasses.join(", ")})`,
    );
  }

  // Markets
  if (criteria.markets && criteria.markets.length > 0) {
    const ok = target.market != null && criteria.markets.includes(target.market);
    check(
      "market",
      "Market",
      ok,
      ok ? `${target.market} in coverage` : `${target.market ?? "unknown"} outside coverage`,
    );
  }

  // Cap rate floor
  if (criteria.capRateMin != null) {
    if (target.capRate == null) {
      check("capRateMin", "Cap rate floor", false, "cap rate not disclosed");
    } else {
      const ok = target.capRate >= criteria.capRateMin;
      check(
        "capRateMin",
        "Cap rate floor",
        ok,
        ok
          ? `${target.capRate.toFixed(2)}% ≥ ${criteria.capRateMin}% floor`
          : `${target.capRate.toFixed(2)}% below ${criteria.capRateMin}% floor`,
      );
    }
  }

  // DSCR floor
  if (criteria.dscrMin != null) {
    if (target.dscr == null) {
      check("dscrMin", "DSCR floor", false, "DSCR unknown");
    } else {
      const ok = target.dscr >= criteria.dscrMin;
      check(
        "dscrMin",
        "DSCR floor",
        ok,
        ok ? `${target.dscr.toFixed(2)}x ≥ ${criteria.dscrMin}x` : `${target.dscr.toFixed(2)}x below ${criteria.dscrMin}x`,
      );
    }
  }

  // LTV ceiling
  if (criteria.ltvMax != null) {
    if (target.ltv == null) {
      check("ltvMax", "LTV ceiling", false, "LTV unknown");
    } else {
      const ok = target.ltv <= criteria.ltvMax;
      check(
        "ltvMax",
        "LTV ceiling",
        ok,
        ok ? `${target.ltv}% ≤ ${criteria.ltvMax}% ceiling` : `${target.ltv}% above ${criteria.ltvMax}% ceiling`,
      );
    }
  }

  // IRR target
  if (criteria.irrTarget != null) {
    if (target.irr == null) {
      check("irrTarget", "IRR target", false, "IRR unknown");
    } else {
      const ok = target.irr >= criteria.irrTarget;
      check(
        "irrTarget",
        "IRR target",
        ok,
        ok
          ? `${target.irr.toFixed(1)}% ≥ ${criteria.irrTarget}% target`
          : `${target.irr.toFixed(1)}% below ${criteria.irrTarget}% target`,
      );
    }
  }

  // Hold period
  if (criteria.holdPeriodMinYears != null || criteria.holdPeriodMaxYears != null) {
    const min = criteria.holdPeriodMinYears ?? 0;
    const max = criteria.holdPeriodMaxYears ?? Number.POSITIVE_INFINITY;
    if (target.holdYears == null) {
      check("holdPeriod", "Hold period", false, "hold period unknown");
    } else {
      const ok = target.holdYears >= min && target.holdYears <= max;
      check(
        "holdPeriod",
        "Hold period",
        ok,
        ok
          ? `${target.holdYears}yr within ${min}-${max === Infinity ? "∞" : max}yr window`
          : `${target.holdYears}yr outside ${min}-${max === Infinity ? "∞" : max}yr window`,
      );
    }
  }

  // Deal size
  if (criteria.dealSizeMin != null || criteria.dealSizeMax != null) {
    const min = criteria.dealSizeMin ?? 0;
    const max = criteria.dealSizeMax ?? Number.POSITIVE_INFINITY;
    if (target.dealSize == null) {
      check("dealSize", "Deal size", false, "price not disclosed");
    } else {
      const ok = target.dealSize >= min && target.dealSize <= max;
      const fmt = (n: number) =>
        n === Infinity ? "∞" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}k`;
      check(
        "dealSize",
        "Deal size",
        ok,
        ok
          ? `${fmt(target.dealSize)} within ${fmt(min)}-${fmt(max)}`
          : `${fmt(target.dealSize)} outside ${fmt(min)}-${fmt(max)}`,
      );
    }
  }

  const matched = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const total = results.length;

  // No criteria set — neutral "watch" with 50
  let score = 50;
  if (total > 0) {
    score = Math.round((matched.length / total) * 100);
  }

  let verdict: Verdict;
  if (total === 0) verdict = "watch";
  else if (score >= 80) verdict = "pursue";
  else if (score >= 50) verdict = "watch";
  else verdict = "pass";

  return {
    verdict,
    score,
    matched,
    failed,
    criteriaSnapshot: criteria,
    targetSnapshot: {
      assetClass: target.assetClass,
      market: target.market,
      capRate: target.capRate,
      dscr: target.dscr,
      ltv: target.ltv,
      irr: target.irr,
      holdYears: target.holdYears,
      dealSize: target.dealSize,
      title: target.title,
    },
  };
}

// ─── LLM narrative ────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export async function generateNarrative(
  brokerDisplayName: string,
  criteria: BrokerCriteria,
  target: NormalizedTarget,
  result: EvaluationResult,
): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;

  const verdictLabel =
    result.verdict === "pursue"
      ? "would pursue"
      : result.verdict === "watch"
        ? "would watch"
        : "would pass on";

  const prompt = `You are ${brokerDisplayName}, a commercial real estate broker. Write a 2-sentence note to a subscriber explaining why you ${verdictLabel} this deal, in your own voice.

Deal: ${target.title}
Asset class: ${target.assetClass ?? "unknown"} · Market: ${target.market ?? "unknown"} · Price: ${
    target.dealSize ? `$${(target.dealSize / 1e6).toFixed(1)}M` : "not disclosed"
  } · Cap rate: ${target.capRate ? target.capRate + "%" : "n/a"}

Your criteria: ${JSON.stringify({
    assetClasses: criteria.assetClasses,
    markets: criteria.markets,
    capRateMin: criteria.capRateMin,
    riskTolerance: criteria.riskTolerance,
  })}
Your outlook: ${criteria.outlookNarrative || "(none set)"}

Matched: ${result.matched.map((m) => m.detail).join("; ") || "none"}
Failed: ${result.failed.map((m) => m.detail).join("; ") || "none"}

Respond with ONLY the 2-sentence note. No preamble, no sign-off.`;

  try {
    const resp = await client.messages.create({
      model: NARRATIVE_MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("[broker-evaluator] narrative generation failed:", err);
    return null;
  }
}

// ─── Cache + orchestration ────────────────────────────────────────────────

export interface CachedEvaluation {
  id: string;
  brokerProfileId: string;
  verdict: Verdict;
  score: number;
  matchedCriteria: CriterionResult[];
  failedCriteria: CriterionResult[];
  narrative: string | null;
  createdAt: string;
  expiresAt: string;
}

async function loadFromCache(
  brokerProfileId: string,
  targetType: string,
  targetId: string,
): Promise<CachedEvaluation | null> {
  const r = await pool.query(
    `SELECT id, broker_profile_id, verdict, score, matched_criteria, failed_criteria,
            narrative, created_at, expires_at
       FROM broker_evaluations
      WHERE broker_profile_id = $1 AND target_type = $2 AND target_id = $3
        AND expires_at > NOW()
      LIMIT 1`,
    [brokerProfileId, targetType, targetId],
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    brokerProfileId: row.broker_profile_id,
    verdict: row.verdict,
    score: row.score,
    matchedCriteria: row.matched_criteria,
    failedCriteria: row.failed_criteria,
    narrative: row.narrative,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

async function writeCache(
  brokerProfileId: string,
  orgId: string,
  targetType: string,
  targetId: string,
  result: EvaluationResult,
  narrative: string | null,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await pool.query(
    `INSERT INTO broker_evaluations (
       broker_profile_id, org_id, target_type, target_id, verdict, score,
       matched_criteria, failed_criteria, narrative, narrative_model,
       criteria_snapshot, target_snapshot, expires_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13)
     ON CONFLICT (broker_profile_id, target_type, target_id)
     DO UPDATE SET
       verdict = EXCLUDED.verdict,
       score = EXCLUDED.score,
       matched_criteria = EXCLUDED.matched_criteria,
       failed_criteria = EXCLUDED.failed_criteria,
       narrative = EXCLUDED.narrative,
       narrative_model = EXCLUDED.narrative_model,
       criteria_snapshot = EXCLUDED.criteria_snapshot,
       target_snapshot = EXCLUDED.target_snapshot,
       created_at = NOW(),
       expires_at = EXCLUDED.expires_at`,
    [
      brokerProfileId,
      orgId,
      targetType,
      targetId,
      result.verdict,
      result.score,
      JSON.stringify(result.matched),
      JSON.stringify(result.failed),
      narrative,
      narrative ? NARRATIVE_MODEL : null,
      JSON.stringify(result.criteriaSnapshot),
      JSON.stringify(result.targetSnapshot),
      expiresAt,
    ],
  );
}

export interface EvaluateOptions {
  /** If true, bypass cache and recompute. */
  force?: boolean;
  /** If true, generate the LLM narrative (gated by caller — Pro+ only). */
  includeNarrative?: boolean;
}

export async function evaluateTarget(params: {
  brokerProfileId: string;
  targetType: "marina_listing" | "modeling_project";
  targetId: string;
  options?: EvaluateOptions;
}): Promise<CachedEvaluation | { error: string; reason: "no_broker" | "no_criteria" | "no_target" }> {
  const { brokerProfileId, targetType, targetId, options = {} } = params;

  const [profile] = await db.select().from(brokerProfiles).where(eq(brokerProfiles.id, brokerProfileId));
  if (!profile) return { error: "Broker profile not found", reason: "no_broker" };
  const criteria = (profile.criteria as BrokerCriteria | null) || null;
  if (!criteria) {
    return { error: "Broker has not set evaluation criteria", reason: "no_criteria" };
  }

  if (!options.force) {
    const cached = await loadFromCache(brokerProfileId, targetType, targetId);
    if (cached) return cached;
  }

  const target =
    targetType === "marina_listing"
      ? await loadListingTarget(targetId)
      : await loadModelingTarget(targetId);
  if (!target) return { error: "Target not found", reason: "no_target" };

  const result = runRules(criteria, target);

  let narrative: string | null = null;
  if (options.includeNarrative) {
    narrative = await generateNarrative(profile.displayName, criteria, target, result);
  }

  await writeCache(brokerProfileId, profile.orgId, targetType, targetId, result, narrative);

  const fresh = await loadFromCache(brokerProfileId, targetType, targetId);
  return fresh!;
}

/**
 * Get verdicts from every broker a user follows, for a single target.
 * Used by the feedback panel on listing detail + modeling workspace.
 */
export async function getFeedbackForTarget(params: {
  userId: string;
  targetType: "marina_listing" | "modeling_project";
  targetId: string;
  includeNarrative: boolean;
}): Promise<CachedEvaluation[]> {
  const { userId, targetType, targetId, includeNarrative } = params;

  // Find followed broker profiles via broker_follow_history (active follows only).
  const followsRes = await pool.query(
    `SELECT bfh.broker_profile_id
       FROM broker_follow_history bfh
       JOIN broker_profiles bp ON bp.id = bfh.broker_profile_id
      WHERE bfh.user_id = $1
        AND bfh.currently_following = true
        AND bp.is_publishable = true
        AND bp.criteria IS NOT NULL`,
    [userId],
  );
  if (followsRes.rowCount === 0) return [];

  const out: CachedEvaluation[] = [];
  for (const row of followsRes.rows) {
    const result = await evaluateTarget({
      brokerProfileId: row.broker_profile_id,
      targetType,
      targetId,
      options: { includeNarrative },
    });
    if ("verdict" in result) out.push(result);
  }
  return out;
}

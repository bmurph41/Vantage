import { db } from "../../db";

// ---------------------------------------------------------------------------
// Typed row interfaces
// ---------------------------------------------------------------------------

export interface GlCashFlowRow {
  id: string;
  cashflow_type: string;
  amount: string;
  year: number;
  month: number;
  notes: string | null;
}

export interface GlAccountMatchRow {
  id: string;
  account_code: string;
  account_name: string;
  charge_type: string | null;
}

export interface AutoMatchResult {
  rentRoll: GlCashFlowRow;
  glEntry: GlAccountMatchRow;
  confidence: number;
  matchType: "cashflow_type" | "account_name_contains" | "account_code_prefix";
}

export interface AutoMatchSummary {
  matched: AutoMatchResult[];
  unmatchedRentRoll: GlCashFlowRow[];
  unmatchedGL: GlAccountMatchRow[];
  summary: {
    totalRentRoll: number;
    totalGL: number;
    matchedCount: number;
    matchPct: number;
    unmatchedRRCount: number;
    unmatchedGLCount: number;
  };
}

/**
 * Match rent roll cash flows against GL account type definitions.
 *
 * Note: this system stores GL account definitions (chart of accounts), not
 * live GL transaction entries. Matching is therefore category-to-account-type
 * rather than amount-to-transaction. The three tiers are:
 *   1. Exact charge_type mapping  (confidence 0.9)
 *   2. Account name keyword match (confidence 0.7)
 *   3. Account code prefix match  (confidence 0.4)
 */
export async function autoMatchGLEntries(params: {
  orgId: string;
  projectId?: string;
  periodMonth?: number;
  periodYear?: number;
}): Promise<AutoMatchSummary> {
  const { orgId, projectId, periodMonth, periodYear } = params;

  // -- Fetch rent roll cash flows --
  let query = `SELECT id, cashflow_type, amount, year, month, notes FROM rra_lease_cash_flows WHERE org_id = $1`;
  const qParams: (string | number)[] = [orgId];
  let idx = 2;
  if (projectId) { query += ` AND location_id = $${idx++}`; qParams.push(projectId); }
  if (periodMonth !== undefined) { query += ` AND month = $${idx++}`; qParams.push(periodMonth); }
  if (periodYear !== undefined) { query += ` AND year = $${idx++}`; qParams.push(periodYear); }

  const { rows: cfRows } = await db.execute(query, qParams);
  const cashFlows = cfRows as GlCashFlowRow[];

  // -- Fetch GL account definitions with optional charge_type mapping --
  const { rows: glRows } = await db.execute(
    `SELECT ga.id, ga.account_code, ga.account_name, gm.charge_type
     FROM gl_accounts ga
     LEFT JOIN gl_mappings gm ON gm.gl_account_id = ga.id
     WHERE ga.organization_id = $1 AND ga.is_active = true`,
    [orgId]
  );
  const glEntries = glRows as GlAccountMatchRow[];

  // -- Category-based matching (non-consuming) --
  // GL entries are account *definitions* (chart of accounts), not unique transactions.
  // Many rent roll cashflow rows of the same charge type must all be able to match
  // the same GL account definition — so we never remove entries from the candidate pool.
  // "unmatchedGL" = account definitions that no cashflow row could map to.

  const matched: AutoMatchResult[] = [];
  const unmatchedRentRoll: GlCashFlowRow[] = [];
  const matchedGlIds = new Set<string>();

  for (const cf of cashFlows) {
    const cfType = String(cf.cashflow_type || "");

    // Tier 1: exact charge_type match (confidence 0.9)
    let glMatch: GlAccountMatchRow | undefined = glEntries.find(g => g.charge_type === cfType);
    let confidence = 0.9;
    let matchType: AutoMatchResult["matchType"] = "cashflow_type";

    // Tier 2: account name contains cashflow_type keyword (confidence 0.7)
    if (!glMatch) {
      glMatch = glEntries.find(g =>
        (g.account_name || "").toLowerCase().includes(cfType.toLowerCase())
      );
      confidence = 0.7;
      matchType = "account_name_contains";
    }

    // Tier 3: account code prefix (≥2 chars) matches cashflow_type initial chars (confidence 0.4)
    if (!glMatch) {
      const prefix = cfType.slice(0, 3).toLowerCase();
      if (prefix.length >= 2) {
        glMatch = glEntries.find(g => (g.account_code || "").toLowerCase().startsWith(prefix));
      }
      confidence = 0.4;
      matchType = "account_code_prefix";
    }

    if (glMatch) {
      matchedGlIds.add(glMatch.id);
      matched.push({ rentRoll: cf, glEntry: glMatch, confidence, matchType });
    } else {
      unmatchedRentRoll.push(cf);
    }
  }

  // GL accounts that were never matched by any cashflow row
  const unmatchedGL = glEntries.filter(g => !matchedGlIds.has(g.id));

  return {
    matched,
    unmatchedRentRoll,
    unmatchedGL,
    summary: {
      totalRentRoll: cashFlows.length,
      totalGL: glEntries.length,
      matchedCount: matched.length,
      matchPct: cashFlows.length > 0 ? Math.round((matched.length / cashFlows.length) * 100) : 0,
      unmatchedRRCount: unmatchedRentRoll.length,
      unmatchedGLCount: unmatchedGL.length,
    },
  };
}

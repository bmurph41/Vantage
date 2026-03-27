/**
 * Token Resolver Service
 *
 * Resolves live {{TOKENS}} from MarinaMatch workspace data for Document Studio templates.
 * Takes a dealId + optional projectId and returns a map of token → resolved value.
 *
 * Uses raw pool.query() for modelingProjectConfig and modelingScenarioVersions
 * per project convention. Maps snake_case returns explicitly.
 */

import { pool, db } from '../../db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  crmDeals,
  crmProperties,
  modelingProjects,
  capitalStacks,
  exitScenarios,
  exitScenarioKpis,
  salesComps,
  targetDemographics,
} from '@shared/schema';
import { MASTER_TOKEN_MAP } from '@shared/document-builder/templates';

export interface ResolvedTokenMap {
  [tokenName: string]: string | number | null | object;
}

interface ResolverContext {
  dealId: string;
  projectId?: string;
  orgId: string;
}

/**
 * Resolve all live tokens for a deal/project workspace.
 * Returns a map of TOKEN_NAME → resolved value.
 * Manual tokens are returned as null (to be filled by user).
 */
export async function resolveTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const resolved: ResolvedTokenMap = {};

  // Initialize all tokens as null
  for (const token of MASTER_TOKEN_MAP) {
    resolved[token.token] = null;
  }

  // Resolve in parallel by source group
  const [dealData, propertyData, modelingData, capitalStackData, exitData, compsData, demoData, proformaData] = await Promise.all([
    resolveDealTokens(ctx),
    resolvePropertyTokens(ctx),
    resolveModelingTokens(ctx),
    resolveCapitalStackTokens(ctx),
    resolveExitTokens(ctx),
    resolveCompsTokens(ctx),
    resolveDemographicsTokens(ctx),
    resolveProformaTokens(ctx),
  ]);

  // Merge all resolved values
  Object.assign(resolved, dealData, propertyData, modelingData, capitalStackData, exitData, compsData, demoData, proformaData);

  return resolved;
}

// ─── Deal Tokens ────────────────────────────────────────────────────────────

async function resolveDealTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, ctx.dealId)).limit(1);
    if (!deal) return result;

    result.PROPERTY_NAME = deal.title || deal.name || null;
    result.PROPERTY_CITY = (deal as any).ddCity || (deal as any).city || null;
    result.PROPERTY_STATE = (deal as any).ddState || (deal as any).state || null;
  } catch (e) {
    console.error('[TokenResolver] Deal resolve error:', e);
  }
  return result;
}

// ─── Property Tokens ────────────────────────────────────────────────────────

async function resolvePropertyTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    // Find property linked to deal
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, ctx.dealId)).limit(1);
    const propertyId = (deal as any)?.propertyId;
    if (!propertyId) return result;

    const [property] = await db.select().from(crmProperties).where(eq(crmProperties.id, propertyId)).limit(1);
    if (!property) return result;

    result.PROPERTY_ADDRESS = property.address || null;
    result.PROPERTY_ZIP = property.zipCode || null;
    result.TOTAL_SLIPS = (property as any).totalSlips || null;
    result.LINEAR_FEET = (property as any).linearFeet || null;
    result.MAX_BOAT_LENGTH = (property as any).maxBoatLength || null;
  } catch (e) {
    console.error('[TokenResolver] Property resolve error:', e);
  }
  return result;
}

// ─── Modeling Tokens ────────────────────────────────────────────────────────

async function resolveModelingTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);
    if (!projectId) return result;

    const [project] = await db.select().from(modelingProjects).where(eq(modelingProjects.id, projectId)).limit(1);
    if (!project) return result;

    result.PURCHASE_PRICE = parseNum(project.purchasePrice) || parseNum(project.acquisitionPrice) || null;
    result.YEAR1_CAP_RATE = parseNum(project.capRate) || null;
  } catch (e) {
    console.error('[TokenResolver] Modeling resolve error:', e);
  }
  return result;
}

// ─── Capital Stack Tokens ───────────────────────────────────────────────────

async function resolveCapitalStackTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);
    if (!projectId) return result;

    const [stack] = await db.select().from(capitalStacks).where(eq(capitalStacks.modelingProjectId, projectId)).limit(1);
    if (!stack) return result;

    result.LOAN_AMOUNT = parseNum(stack.totalDebt) || null;
    result.LTV = stack.ltv ? parseNum(stack.ltv) : null;
    result.EQUITY_AMOUNT = parseNum(stack.totalEquity) || null;
    result.TOTAL_USES = parseNum(stack.totalBasis) || null;
    result.INTEREST_RATE = parseNum((stack as any).interestRate) || null;
    result.LOAN_TERM_YEARS = (stack as any).loanTermYears || null;
    result.AMORTIZATION_YEARS = (stack as any).amortizationYears || null;
    result.IO_PERIOD_MONTHS = (stack as any).ioPeriodMonths || null;
    result.PI_ADS = parseNum((stack as any).annualDebtService) || null;

    // Compute equity %
    const totalBasis = parseNum(stack.totalBasis);
    const totalEquity = parseNum(stack.totalEquity);
    if (totalBasis && totalEquity && totalBasis > 0) {
      result.EQUITY_PCT = Math.round((totalEquity / totalBasis) * 1000) / 10;
    }
  } catch (e) {
    console.error('[TokenResolver] CapitalStack resolve error:', e);
  }
  return result;
}

// ─── Exit Tokens ────────────────────────────────────────────────────────────

async function resolveExitTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);
    if (!projectId) return result;

    const scenarios = await db.select().from(exitScenarios)
      .where(eq(exitScenarios.modelingProjectId, projectId))
      .orderBy(desc(exitScenarios.updatedAt))
      .limit(1);

    if (scenarios.length === 0) return result;
    const scenario = scenarios[0];

    result.EXIT_YEAR = scenario.holdingPeriodYears ? new Date().getFullYear() + scenario.holdingPeriodYears : null;
    result.EXIT_CAP_RATE = parseNum(scenario.exitCapRate) || null;

    // Get KPIs
    const [kpi] = await db.select().from(exitScenarioKpis)
      .where(eq(exitScenarioKpis.scenarioId, scenario.id))
      .limit(1);

    if (kpi) {
      result.IRR_GROSS = parseNum((kpi as any).lpIrr) || null;
      result.EM_GROSS = parseNum((kpi as any).lpEquityMultiple) || null;
      result.EXIT_VALUE = parseNum(kpi.salePrice) || null;

      const goingInCap = parseNum(result.YEAR1_CAP_RATE as any);
      const exitCap = parseNum(scenario.exitCapRate);
      if (goingInCap && exitCap) {
        result.BPS_SPREAD = Math.round((exitCap - goingInCap) * 100);
      }
    }
  } catch (e) {
    console.error('[TokenResolver] Exit resolve error:', e);
  }
  return result;
}

// ─── Pro Forma Tokens (via raw pool.query) ──────────────────────────────────

async function resolveProformaTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);
    if (!projectId) return result;

    // Use raw pool.query for modelingScenarioVersions
    const { rows } = await pool.query(
      `SELECT revenue, noi, ebitda, ebitdam, cogs, operating_expenses,
              revenue_growth_rate, expense_growth_rate, exit_cap_rate,
              assumptions, cash_flows
       FROM modeling_scenario_versions
       WHERE modeling_project_id = $1 AND scenario_type = 'base' AND is_current_version = true
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (rows.length === 0) return result;
    const sv = rows[0];

    result.YEAR1_REVENUE = parseNum(sv.revenue) || null;
    result.YEAR1_NOI = parseNum(sv.noi) || null;
    result.YEAR1_EBITDA = parseNum(sv.ebitda) || null;
    result.YEAR1_EBITDAM = parseNum(sv.ebitdam) || null;
    result.YEAR1_COGS = parseNum(sv.cogs) || null;
    result.YEAR1_OPEX = parseNum(sv.operating_expenses) || null;
    result.FC_REVENUE = parseNum(sv.revenue) || null;
    result.FC_NOI = parseNum(sv.noi) || null;

    // Growth assumptions from JSONB
    const assumptions = sv.assumptions || {};
    result.REVENUE_CAGR = parseNum(sv.revenue_growth_rate) || null;
    result.EXPENSE_CAGR = parseNum(sv.expense_growth_rate) || null;
    result.STORAGE_RATE_CAGR = parseNum(assumptions.storageRateCagr) || null;
    result.PAYROLL_CAGR = parseNum(assumptions.payrollCagr) || null;
    result.INSURANCE_CAGR = parseNum(assumptions.insuranceCagr) || null;
    result.PROPERTY_TAX_CAGR = parseNum(assumptions.propertyTaxCagr) || null;
    result.NON_STORAGE_REV_CAGR = parseNum(assumptions.nonStorageRevCagr) || null;
    result.MGMT_FEE_PCT = parseNum(assumptions.mgmtFeePct) || null;
    result.CAPEX_RESERVE_PCT = parseNum(assumptions.capexReservePct) || null;

    // Cash flows for chart data
    const cashFlows = sv.cash_flows;
    if (Array.isArray(cashFlows) && cashFlows.length > 0) {
      result.PROFORMA_SUMMARY_TABLE = cashFlows;
      result.REVENUE_BY_YEAR_CHART = cashFlows.map((cf: any) => ({
        year: cf.year,
        revenue: parseNum(cf.revenue),
      }));
      result.EBITDAM_BY_YEAR_CHART = cashFlows.map((cf: any) => ({
        year: cf.year,
        ebitdam: parseNum(cf.ebitdam),
      }));
    }

    // DSCR from capital stack context
    const piAds = parseNum(result.PI_ADS as any);
    const noi = parseNum(sv.noi);
    if (piAds && noi && piAds > 0) {
      result.YEAR1_DSCR = Math.round((noi / piAds) * 10) / 10;
    }
  } catch (e) {
    console.error('[TokenResolver] ProForma resolve error:', e);
  }
  return result;
}

// ─── Comps Tokens ───────────────────────────────────────────────────────────

async function resolveCompsTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const comps = await db.select().from(salesComps)
      .where(eq(salesComps.orgId, ctx.orgId))
      .orderBy(desc(salesComps.updatedAt))
      .limit(10);

    if (comps.length > 0) {
      result.COMP_SET_TABLE = comps.map(c => ({
        name: c.marinaName,
        slipCount: c.totalSlips,
        salePrice: parseNum(c.salePrice),
        capRate: parseNum(c.capRate),
        city: c.city,
        state: c.state,
      }));
    }
  } catch (e) {
    console.error('[TokenResolver] Comps resolve error:', e);
  }
  return result;
}

// ─── Demographics Tokens ────────────────────────────────────────────────────

async function resolveDemographicsTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);
    if (!projectId) return result;

    const [demo] = await db.select().from(targetDemographics)
      .where(eq(targetDemographics.projectId, projectId))
      .limit(1);

    if (!demo) return result;

    result.POPULATION_5MI = parseNum((demo as any).population5mi) || null;
    result.POPULATION_10MI = parseNum((demo as any).population10mi) || null;
    result.POPULATION_25MI = parseNum((demo as any).population25mi) || null;
    result.AVG_HH_INCOME_5MI = parseNum((demo as any).avgHhIncome5mi) || null;
    result.MEDIAN_HH_INCOME_5MI = parseNum((demo as any).medianHhIncome5mi) || null;
  } catch (e) {
    console.error('[TokenResolver] Demographics resolve error:', e);
  }
  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNum(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? null : n;
}

async function findProjectForDeal(dealId: string, orgId: string): Promise<string | null> {
  try {
    const [project] = await db.select({ id: modelingProjects.id })
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.dealId, dealId),
      ))
      .orderBy(desc(modelingProjects.updatedAt))
      .limit(1);
    return project?.id || null;
  } catch {
    // dealId column may not exist on modelingProjects — try by name match
    return null;
  }
}

/**
 * Format a resolved token value for display based on its format type.
 */
export function formatTokenValue(value: any, format?: string): string {
  if (value === null || value === undefined) return '';
  switch (format) {
    case 'currency':
      return typeof value === 'number'
        ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : String(value);
    case 'percent':
      return typeof value === 'number'
        ? `${value.toFixed(1)}%`
        : String(value);
    case 'number':
      return typeof value === 'number'
        ? value.toLocaleString('en-US')
        : String(value);
    case 'date':
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Replace all {{TOKEN}} placeholders in a text string with resolved values.
 */
export function interpolateTokens(text: string, tokens: ResolvedTokenMap): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, tokenName) => {
    const value = tokens[tokenName];
    if (value === null || value === undefined) return match; // keep placeholder if unresolved
    const tokenDef = MASTER_TOKEN_MAP.find(t => t.token === tokenName);
    return formatTokenValue(value, tokenDef?.format);
  });
}

/**
 * Token Resolver Service
 *
 * Resolves live {{TOKENS}} from Vantage workspace data for Document Studio templates.
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

  // Resolve table tokens + system tokens + OM-specific tokens
  const [tableData, systemData, sourcesUsesData, omData] = await Promise.all([
    resolveTableTokens(ctx),
    resolveSystemTokens(),
    resolveSourcesUsesToken(ctx, capitalStackData, modelingData),
    resolveOmTokens(ctx),
  ]);

  // Merge all resolved values
  Object.assign(resolved, dealData, propertyData, modelingData, capitalStackData, exitData, compsData, demoData, proformaData, tableData, systemData, sourcesUsesData, omData);

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
    result.IO_ADS = parseNum((stack as any).ioAnnualDebtService) || null;
    result.CLOSING_COSTS = parseNum((stack as any).closingCosts) || null;
    result.TRANSITION_COSTS = parseNum((stack as any).transitionCosts) || null;

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
      result.IRR_NET = parseNum((kpi as any).netIrr) || null;
      result.EM_GROSS = parseNum((kpi as any).lpEquityMultiple) || null;
      result.EM_NET = parseNum((kpi as any).netEquityMultiple) || null;
      result.EXIT_VALUE = parseNum(kpi.salePrice) || null;

      // Unleveraged metrics
      result.UNLEVERAGED_IRR = parseNum((kpi as any).unleveragedIrr) || null;
      result.UNLEVERAGED_MOE = parseNum((kpi as any).unleveragedEquityMultiple) || null;

      // Compute gains
      const exitValue = parseNum(kpi.salePrice);
      const equityInvested = parseNum((kpi as any).equityInvested);
      if (exitValue && equityInvested) {
        result.LEVERAGED_GAIN = exitValue - equityInvested;
        result.UNLEVERAGED_GAIN = exitValue - equityInvested;
      }

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

// ─── System Tokens ─────────────────────────────────────────────────────────

async function resolveSystemTokens(): Promise<ResolvedTokenMap> {
  return {
    DOCUMENT_DATE: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

// ─── Sources & Uses Table ──────────────────────────────────────────────────

async function resolveSourcesUsesToken(
  ctx: ResolverContext,
  capitalStackData: ResolvedTokenMap,
  modelingData: ResolvedTokenMap
): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const purchasePrice = parseNum(modelingData.PURCHASE_PRICE as any);
    const loanAmount = parseNum(capitalStackData.LOAN_AMOUNT as any);
    const equityAmount = parseNum(capitalStackData.EQUITY_AMOUNT as any);
    const closingCosts = parseNum(capitalStackData.CLOSING_COSTS as any);
    const transitionCosts = parseNum(capitalStackData.TRANSITION_COSTS as any);
    const totalUses = parseNum(capitalStackData.TOTAL_USES as any);

    if (purchasePrice) {
      result.SOURCES_USES_TABLE = {
        uses: [
          { label: 'Purchase Price', amount: purchasePrice },
          { label: 'Closing Costs', amount: closingCosts || 0 },
          { label: 'Transition Costs', amount: transitionCosts || 0 },
          { label: 'Total Uses', amount: totalUses || purchasePrice, isTotal: true },
        ],
        sources: [
          { label: 'Senior Debt', amount: loanAmount || 0 },
          { label: 'Equity', amount: equityAmount || 0 },
          { label: 'Total Sources', amount: (loanAmount || 0) + (equityAmount || 0), isTotal: true },
        ],
      };
    }
  } catch (e) {
    console.error('[TokenResolver] SourcesUses resolve error:', e);
  }
  return result;
}

// ─── Table Token Builders ──────────────────────────────────────────────────

async function resolveTableTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);
    if (!projectId) return result;

    // Build pro forma tables from cash_flows and assumptions
    const { rows } = await pool.query(
      `SELECT revenue, noi, ebitda, ebitdam, cogs, operating_expenses,
              revenue_growth_rate, expense_growth_rate,
              assumptions, cash_flows
       FROM modeling_scenario_versions
       WHERE modeling_project_id = $1 AND scenario_type = 'base' AND is_current_version = true
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (rows.length === 0) return result;
    const sv = rows[0];
    const cashFlows = sv.cash_flows;
    const assumptions = sv.assumptions || {};

    if (Array.isArray(cashFlows) && cashFlows.length > 0) {
      // PROFORMA_DETAIL_TABLE — line-item detail
      result.PROFORMA_DETAIL_TABLE = cashFlows.map((cf: any) => ({
        year: cf.year,
        revenue: parseNum(cf.revenue),
        cogs: parseNum(cf.cogs),
        grossProfit: parseNum(cf.grossProfit),
        operatingExpenses: parseNum(cf.operatingExpenses),
        ebitdam: parseNum(cf.ebitdam),
        ebitda: parseNum(cf.ebitda),
        noi: parseNum(cf.noi),
        revenueBreakdown: cf.revenueBreakdown || null,
        expenseBreakdown: cf.expenseBreakdown || null,
      }));

      // OPERATING_PROJECTIONS_TABLE — condensed summary
      result.OPERATING_PROJECTIONS_TABLE = cashFlows.map((cf: any) => ({
        year: cf.year,
        revenue: parseNum(cf.revenue),
        noi: parseNum(cf.noi),
        ebitdam: parseNum(cf.ebitdam),
        capRate: parseNum(cf.capRate),
        dscr: parseNum(cf.dscr),
      }));

      // REVENUE_CAGR_CHART and EBITDAM_CAGR_CHART
      result.REVENUE_CAGR_CHART = cashFlows.map((cf: any) => ({
        year: cf.year,
        revenueMillions: (parseNum(cf.revenue) || 0) / 1_000_000,
      }));
      result.EBITDAM_CAGR_CHART = cashFlows.map((cf: any) => ({
        year: cf.year,
        ebitdamMillions: (parseNum(cf.ebitdam) || 0) / 1_000_000,
      }));

      // EBITDAM_CAGR derived from cash flows
      if (cashFlows.length >= 2) {
        const first = parseNum(cashFlows[0].ebitdam);
        const last = parseNum(cashFlows[cashFlows.length - 1].ebitdam);
        if (first && last && first > 0) {
          const years = cashFlows.length - 1;
          result.EBITDAM_CAGR = (Math.pow(last / first, 1 / years) - 1) * 100;
        }
      }
    }

    // Sensitivity tables — generate 3-scenario tables from assumptions
    const baseCagrs = {
      storageRate: parseNum(assumptions.storageRateCagr) || parseNum(sv.revenue_growth_rate) || 3,
      insurance: parseNum(assumptions.insuranceCagr) || 5,
      payroll: parseNum(assumptions.payrollCagr) || 3,
      propertyTax: parseNum(assumptions.propertyTaxCagr) || 2,
    };
    const baseIrr = parseNum(sv.assumptions?.baseIrr) || null;

    result.SENSITIVITY_RATE_GROWTH = buildSensitivityTable('Rate Growth', baseCagrs.storageRate, baseIrr);
    result.SENSITIVITY_INSURANCE = buildSensitivityTable('Insurance', baseCagrs.insurance, baseIrr);
    result.SENSITIVITY_PAYROLL = buildSensitivityTable('Payroll', baseCagrs.payroll, baseIrr);
    result.SENSITIVITY_PROPERTY_TAX = buildSensitivityTable('Property Tax', baseCagrs.propertyTax, baseIrr);
  } catch (e) {
    console.error('[TokenResolver] Table tokens resolve error:', e);
  }
  return result;
}

function buildSensitivityTable(label: string, baseCagr: number, baseIrr: number | null): object[] {
  const lowCagr = Math.max(0, baseCagr - 1.5);
  const highCagr = baseCagr + 1.5;
  return [
    { scenario: 'Low', cagr: lowCagr, irrGross: baseIrr ? baseIrr - 2.5 : null },
    { scenario: 'Base', cagr: baseCagr, irrGross: baseIrr, isBaseCase: true },
    { scenario: 'High', cagr: highCagr, irrGross: baseIrr ? baseIrr + 2.0 : null },
  ];
}

// ─── OM-Specific Tokens ───────────────────────────────────────────────────

async function resolveOmTokens(ctx: ResolverContext): Promise<ResolvedTokenMap> {
  const result: ResolvedTokenMap = {};
  try {
    const projectId = ctx.projectId || await findProjectForDeal(ctx.dealId, ctx.orgId);

    // LOCATION_TAGLINE — manual token, check om_document_sections or om_builder_documents metadata
    try {
      const { rows: docRows } = await pool.query(
        `SELECT metadata FROM om_builder_documents
         WHERE deal_id = $1 AND document_type = 'offering_memorandum'
         ORDER BY created_at DESC LIMIT 1`,
        [ctx.dealId]
      );
      if (docRows.length > 0 && docRows[0].metadata?.locationTagline) {
        result.LOCATION_TAGLINE = docRows[0].metadata.locationTagline;
      }
      if (docRows.length > 0 && docRows[0].metadata?.tourismFacts) {
        result.TOURISM_FACTS = docRows[0].metadata.tourismFacts;
      }
    } catch {
      // Non-critical — manual tokens may not exist yet
    }

    // BOATING_PARTICIPATION_PCT — from demographics
    if (projectId) {
      try {
        const [demo] = await db.select().from(targetDemographics)
          .where(eq(targetDemographics.projectId, projectId))
          .limit(1);
        if (demo && (demo as any).boatingParticipationPct) {
          result.BOATING_PARTICIPATION_PCT = parseNum((demo as any).boatingParticipationPct);
        }
      } catch {
        // Demographics may not have this field
      }
    }

    // OM_NOI_TABLE — structured table from pro forma (RLS)
    if (projectId) {
      try {
        const { rows } = await pool.query(
          `SELECT revenue, noi, cogs, operating_expenses, assumptions, cash_flows
           FROM modeling_scenario_versions
           WHERE modeling_project_id = $1 AND scenario_type = 'base' AND is_current_version = true
           ORDER BY created_at DESC LIMIT 1`,
          [projectId]
        );
        if (rows.length > 0) {
          const sv = rows[0];
          const cashFlows = sv.cash_flows;
          const assumptions = sv.assumptions || {};

          // Build OM_NOI_TABLE — Current year NOI with adjustments
          const revenue = parseNum(sv.revenue) || 0;
          const cogs = parseNum(sv.cogs) || 0;
          const opex = parseNum(sv.operating_expenses) || 0;
          const noi = parseNum(sv.noi) || 0;
          const grossProfit = revenue - cogs;

          result.OM_NOI_TABLE = {
            headers: ['Line Item', 'Owner F/C', 'Adjustment Amount', 'Adj F/C'],
            sections: [
              {
                title: 'Revenue',
                rows: [{ 'Line Item': 'Total Revenue', 'Owner F/C': revenue, 'Adjustment Amount': 0, 'Adj F/C': revenue }],
                subtotal: { 'Line Item': 'Total Revenue', 'Owner F/C': revenue, 'Adjustment Amount': 0, 'Adj F/C': revenue },
              },
              {
                title: 'COGS',
                rows: [{ 'Line Item': 'Cost of Goods Sold', 'Owner F/C': cogs, 'Adjustment Amount': 0, 'Adj F/C': cogs }],
                subtotal: { 'Line Item': 'Total COGS', 'Owner F/C': cogs, 'Adjustment Amount': 0, 'Adj F/C': cogs },
              },
              {
                title: 'Gross Profit',
                rows: [{ 'Line Item': 'Gross Profit', 'Owner F/C': grossProfit, 'Adjustment Amount': 0, 'Adj F/C': grossProfit }],
              },
              {
                title: 'Operating Expenses',
                rows: [{ 'Line Item': 'Total Operating Expenses', 'Owner F/C': opex, 'Adjustment Amount': 0, 'Adj F/C': opex }],
                subtotal: { 'Line Item': 'Total OpEx', 'Owner F/C': opex, 'Adjustment Amount': 0, 'Adj F/C': opex },
              },
            ],
            totals: { 'Line Item': 'Net Operating Income (NOI)', 'Owner F/C': noi, 'Adjustment Amount': 0, 'Adj F/C': noi },
          };

          // Build OM_PROFORMA_TABLE — multi-year projection
          if (Array.isArray(cashFlows) && cashFlows.length > 0) {
            const years = cashFlows.slice(0, 5);
            const pfHeaders = ['Line Item', 'F/C', ...years.map((_: any, i: number) => `Year ${i + 1}`)];
            const buildRow = (label: string, fcVal: number, field: string) => {
              const row: Record<string, string | number> = { 'Line Item': label, 'F/C': fcVal };
              years.forEach((cf: any, i: number) => {
                row[`Year ${i + 1}`] = parseNum(cf[field]) || 0;
              });
              return row;
            };

            result.OM_PROFORMA_TABLE = {
              headers: pfHeaders,
              sections: [
                {
                  title: 'Revenue',
                  rows: [buildRow('Total Revenue', revenue, 'revenue')],
                  subtotal: buildRow('Total Revenue', revenue, 'revenue'),
                },
                {
                  title: 'COGS',
                  rows: [buildRow('Cost of Goods Sold', cogs, 'cogs')],
                },
                {
                  title: 'Operating Expenses',
                  rows: [buildRow('Operating Expenses', opex, 'operatingExpenses')],
                },
              ],
              totals: buildRow('Net Operating Income', noi, 'noi'),
            };

            // Build OM_EXPENSE_ASSUMPTIONS_TABLE
            const expenseRows: Array<Record<string, string | number>> = [];
            if (assumptions.payrollCagr) {
              expenseRows.push({
                'Line Item': 'Payroll',
                'F/C Amount': 0,
                'Year 1 Amount': 0,
                'Comment / Methodology': `${assumptions.payrollCagr}% annual growth`,
              });
            }
            if (assumptions.insuranceCagr) {
              expenseRows.push({
                'Line Item': 'Insurance',
                'F/C Amount': 0,
                'Year 1 Amount': 0,
                'Comment / Methodology': `${assumptions.insuranceCagr}% annual growth`,
              });
            }
            if (assumptions.propertyTaxCagr) {
              expenseRows.push({
                'Line Item': 'Property Tax',
                'F/C Amount': 0,
                'Year 1 Amount': 0,
                'Comment / Methodology': `${assumptions.propertyTaxCagr}% annual growth`,
              });
            }
            if (assumptions.mgmtFeePct) {
              expenseRows.push({
                'Line Item': 'Management Fee',
                'F/C Amount': 0,
                'Year 1 Amount': 0,
                'Comment / Methodology': `${assumptions.mgmtFeePct}% of revenue`,
              });
            }
            if (assumptions.capexReservePct) {
              expenseRows.push({
                'Line Item': 'CapEx Reserve',
                'F/C Amount': 0,
                'Year 1 Amount': 0,
                'Comment / Methodology': `${assumptions.capexReservePct}% of revenue`,
              });
            }

            if (expenseRows.length > 0) {
              result.OM_EXPENSE_ASSUMPTIONS_TABLE = {
                headers: ['Line Item', 'F/C Amount', 'Year 1 Amount', 'Comment / Methodology'],
                rows: expenseRows,
              };
            }
          }
        }
      } catch (e) {
        console.error('[TokenResolver] OM table tokens resolve error:', e);
      }
    }
  } catch (e) {
    console.error('[TokenResolver] OM resolve error:', e);
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

/**
 * server/services/exit-integration-service.ts
 *
 * Bridges the Exit Engine (orchestrator-v2) with:
 *  - DCF Calculator / Financial Model
 *  - Deal Pricing
 *  - Capital Stack
 *  - Portfolio Rollup
 *
 * Handles bidirectional sync of exitCapRate, holdPeriod, terminal value,
 * and exit KPIs across all systems.
 */

import { db } from '../db';
import { eq, and, inArray, desc } from 'drizzle-orm';
import {
  exitScenarios,
  exitScenarioKpis,
  modelingProjects,
  modelingScenarioVersions,
  capitalStacks,
  modelingProjectConfig,
} from '@shared/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExitToFinancialModelSync {
  projectId: string;
  exitCapRate: number;        // decimal (e.g., 0.0725)
  holdPeriodYears: number;
  projectedSalePrice: number;
  exitNoi: number;
  terminalValue: number;      // NOI / exitCapRate
  netSaleProceeds: number;
  afterTaxProceeds: number;
  sellingCosts: number;
  debtPayoff: number;
}

export interface FinancialModelToExitSync {
  projectId: string;
  exitCapRate: number;        // decimal
  holdPeriodYears: number;
  terminalNoi: number;
  purchasePrice: number;
  totalDebt: number;
  noiProjections: number[];
}

export interface ExitDealPricingBridge {
  projectId: string;
  exitCapRate: number;
  holdPeriodYears: number;
  terminalValue: number;
  netExitProceeds: number;
  irr: number | null;
  equityMultiple: number | null;
}

export interface PortfolioExitKPIs {
  projectId: string;
  scenarioId: string;
  salePrice: number;
  afterTaxCashNow: number;
  afterTaxCashTotal: number;
  irr: number | null;
  equityMultiple: number | null;
  exitCapRate: number;
  holdPeriodYears: number;
  strategiesActive: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ExitIntegrationService {

  // ═══════════════════════════════════════════════════════════════════════════
  // Task #1: Financial Model ↔ Exit Engine bidirectional integration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Push exit scenario results INTO the financial model layer.
   * Updates scenario versions and capital stack with exit-derived values.
   */
  async syncExitToFinancialModel(
    projectId: string,
    scenarioId: string,
    orgId: string
  ): Promise<ExitToFinancialModelSync | null> {
    // 1. Load exit scenario + KPIs
    const [scenario] = await db.select()
      .from(exitScenarios)
      .where(and(
        eq(exitScenarios.id, scenarioId),
        eq(exitScenarios.modelingProjectId, projectId),
      ))
      .limit(1);

    if (!scenario) return null;

    const [kpis] = await db.select()
      .from(exitScenarioKpis)
      .where(eq(exitScenarioKpis.scenarioId, scenarioId))
      .limit(1);

    const exitCapRate = parseFloat(scenario.exitCapRate?.toString() || '0');
    const holdPeriodYears = scenario.holdingPeriodYears ?? 5;
    const exitNoi = parseFloat(scenario.exitNoi?.toString() || '0');
    const salePrice = parseFloat(kpis?.salePrice?.toString() || scenario.projectedSalePrice?.toString() || '0');
    const terminalValue = exitCapRate > 0 && exitNoi > 0 ? exitNoi / exitCapRate : salePrice;
    const afterTaxCash = parseFloat(kpis?.afterTaxCashNow?.toString() || '0');
    const netProceeds = parseFloat(scenario.netProceeds?.toString() || '0');

    // 2. Derive selling costs & debt
    const sellingCosts = terminalValue > 0 ? terminalValue - netProceeds - afterTaxCash : 0;
    const debtPayoff = parseFloat(scenario.exitNoi?.toString() || '0') > 0
      ? salePrice - netProceeds - sellingCosts
      : 0;

    const syncData: ExitToFinancialModelSync = {
      projectId,
      exitCapRate,
      holdPeriodYears,
      projectedSalePrice: salePrice,
      exitNoi,
      terminalValue,
      netSaleProceeds: netProceeds,
      afterTaxProceeds: afterTaxCash,
      sellingCosts: Math.max(0, sellingCosts),
      debtPayoff: Math.max(0, debtPayoff),
    };

    // 3. Update scenario versions with exit-derived values
    const [baseScenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, 'base'),
        eq(modelingScenarioVersions.isCurrentVersion, true),
      ))
      .limit(1);

    if (baseScenario && exitCapRate > 0) {
      await db.update(modelingScenarioVersions)
        .set({
          exitCapRate: String(exitCapRate * 100),  // stored as percent
          updatedAt: new Date(),
        } as any)
        .where(eq(modelingScenarioVersions.id, baseScenario.id));
    }

    // 4. Update capital stack with exit-derived hold period and cap rate
    const [stack] = await db.select()
      .from(capitalStacks)
      .where(eq(capitalStacks.modelingProjectId, projectId))
      .limit(1);

    if (stack) {
      await db.update(capitalStacks)
        .set({
          holdPeriodYears: holdPeriodYears,
          exitCapRate: String(exitCapRate),
          updatedAt: new Date(),
        } as any)
        .where(eq(capitalStacks.id, stack.id));
    }

    return syncData;
  }

  /**
   * Pull financial model assumptions INTO an exit scenario.
   * Reads DCF/scenario data and populates exit scenario fields.
   */
  async syncFinancialModelToExit(
    projectId: string,
    scenarioId: string,
    orgId: string
  ): Promise<FinancialModelToExitSync | null> {
    // Load scenario version for exit assumptions
    const [scenarioVersion] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, 'base'),
        eq(modelingScenarioVersions.isCurrentVersion, true),
      ))
      .limit(1);

    // Load capital stack for debt/purchase info
    const [stack] = await db.select()
      .from(capitalStacks)
      .where(eq(capitalStacks.modelingProjectId, projectId))
      .limit(1);

    // Load project for purchase price
    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId))
      .limit(1);

    if (!project) return null;

    const exitCapRate = parseFloat(scenarioVersion?.exitCapRate?.toString() || '7') / 100;
    const holdPeriodYears = stack?.holdPeriodYears ?? 5;
    const purchasePrice = parseFloat(stack?.purchasePrice?.toString() || project.purchasePrice?.toString() || '0');
    const totalDebt = parseFloat(stack?.totalDebt?.toString() || '0');
    const revenueGrowth = parseFloat(scenarioVersion?.revenueGrowthRate?.toString() || '3') / 100;

    // Compute NOI projections from base NOI
    const baseNoi = parseFloat(project.estimatedValue?.toString() || '0') *
      (parseFloat(project.capRate?.toString() || '7') / 100);
    const noiProjections: number[] = [];
    for (let y = 1; y <= holdPeriodYears; y++) {
      noiProjections.push(baseNoi * Math.pow(1 + revenueGrowth, y));
    }
    const terminalNoi = noiProjections[noiProjections.length - 1] || baseNoi;

    const syncData: FinancialModelToExitSync = {
      projectId,
      exitCapRate,
      holdPeriodYears,
      terminalNoi,
      purchasePrice,
      totalDebt,
      noiProjections,
    };

    // Update exit scenario with financial model data
    await db.update(exitScenarios)
      .set({
        exitCapRate: String(exitCapRate),
        holdingPeriodYears: holdPeriodYears,
        exitNoi: String(terminalNoi),
        projectedSalePrice: String(terminalNoi / exitCapRate),
        updatedAt: new Date(),
      } as any)
      .where(eq(exitScenarios.id, scenarioId));

    return syncData;
  }

  /**
   * Compute terminal value using the exit engine's approach.
   * This replaces the standalone NOI/exitCapRate calculations scattered
   * across rent-roll, deal pricing, and DCF services.
   */
  computeTerminalValue(
    exitNoi: number,
    exitCapRate: number,
    sellingCostPct: number = 0.03,
  ): { terminalValue: number; sellingCosts: number; netSaleProceeds: number } {
    if (exitCapRate <= 0 || exitNoi <= 0) {
      return { terminalValue: 0, sellingCosts: 0, netSaleProceeds: 0 };
    }
    const terminalValue = exitNoi / exitCapRate;
    const sellingCosts = terminalValue * sellingCostPct;
    const netSaleProceeds = terminalValue - sellingCosts;
    return { terminalValue, sellingCosts, netSaleProceeds };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Task #2: Deal Pricing → Exit Scenarios integration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sync deal pricing assumptions to/from exit scenarios.
   * Reads deal pricing exitCapRate and pushes to exit scenario,
   * or reads exit scenario and pushes back to deal pricing.
   */
  async syncDealPricingToExit(
    projectId: string,
    orgId: string
  ): Promise<ExitDealPricingBridge | null> {
    // Load scenario version (deal pricing source of truth for cap rates)
    const [scenarioVersion] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, 'base'),
        eq(modelingScenarioVersions.isCurrentVersion, true),
      ))
      .limit(1);

    const [stack] = await db.select()
      .from(capitalStacks)
      .where(eq(capitalStacks.modelingProjectId, projectId))
      .limit(1);

    const exitCapRate = parseFloat(scenarioVersion?.exitCapRate?.toString() || '7') / 100;
    const holdPeriodYears = stack?.holdPeriodYears ?? 5;

    // Find linked exit scenarios for this project
    const exitScenarioList = await db.select()
      .from(exitScenarios)
      .where(eq(exitScenarios.modelingProjectId, projectId));

    // Update all exit scenarios with deal pricing cap rate
    for (const es of exitScenarioList) {
      await db.update(exitScenarios)
        .set({
          exitCapRate: String(exitCapRate),
          holdingPeriodYears: holdPeriodYears,
          updatedAt: new Date(),
        } as any)
        .where(eq(exitScenarios.id, es.id));
    }

    // Get best exit scenario KPIs
    const scenarioIds = exitScenarioList.map(s => s.id);
    let bestKpis: any = null;
    if (scenarioIds.length > 0) {
      const allKpis = await db.select()
        .from(exitScenarioKpis)
        .where(inArray(exitScenarioKpis.scenarioId, scenarioIds));

      // Select scenario with highest after-tax cash
      bestKpis = allKpis.reduce((best, kpi) => {
        const current = parseFloat(kpi.afterTaxCashTotal?.toString() || '0');
        const bestVal = parseFloat(best?.afterTaxCashTotal?.toString() || '0');
        return current > bestVal ? kpi : best;
      }, allKpis[0]);
    }

    const exitNoi = parseFloat(exitScenarioList[0]?.exitNoi?.toString() || '0');
    const tv = this.computeTerminalValue(exitNoi, exitCapRate);

    return {
      projectId,
      exitCapRate,
      holdPeriodYears,
      terminalValue: tv.terminalValue,
      netExitProceeds: tv.netSaleProceeds,
      irr: bestKpis?.lpIrr ? parseFloat(bestKpis.lpIrr) : null,
      equityMultiple: bestKpis?.lpEquityMultiple ? parseFloat(bestKpis.lpEquityMultiple) : null,
    };
  }

  /**
   * Push exit scenario results back to deal pricing (scenario versions).
   */
  async syncExitToDealPricing(
    projectId: string,
    scenarioId: string,
    orgId: string
  ): Promise<boolean> {
    const [scenario] = await db.select()
      .from(exitScenarios)
      .where(eq(exitScenarios.id, scenarioId))
      .limit(1);

    if (!scenario) return false;

    const exitCapRate = parseFloat(scenario.exitCapRate?.toString() || '0');
    if (exitCapRate <= 0) return false;

    // Update base scenario version
    const [baseVersion] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, 'base'),
        eq(modelingScenarioVersions.isCurrentVersion, true),
      ))
      .limit(1);

    if (baseVersion) {
      await db.update(modelingScenarioVersions)
        .set({
          exitCapRate: String(exitCapRate * 100),
          updatedAt: new Date(),
        } as any)
        .where(eq(modelingScenarioVersions.id, baseVersion.id));
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Task #3: Hold Period auto-sync
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Synchronize hold period across all systems for a project.
   * Source of truth priority: capitalStack > exitScenario > projectConfig > default(5)
   */
  async syncHoldPeriod(
    projectId: string,
    holdPeriodYears: number,
    orgId: string
  ): Promise<{ updated: string[] }> {
    const updated: string[] = [];

    // 1. Update project config
    const [config] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    if (config) {
      await db.update(modelingProjectConfig)
        .set({ holdPeriod: holdPeriodYears } as any)
        .where(eq(modelingProjectConfig.id, config.id));
      updated.push('modelingProjectConfig');
    }

    // 2. Update capital stack
    const [stack] = await db.select()
      .from(capitalStacks)
      .where(eq(capitalStacks.modelingProjectId, projectId))
      .limit(1);

    if (stack) {
      await db.update(capitalStacks)
        .set({ holdPeriodYears, updatedAt: new Date() } as any)
        .where(eq(capitalStacks.id, stack.id));
      updated.push('capitalStacks');
    }

    // 3. Update all exit scenarios for this project
    const exitScenarioList = await db.select()
      .from(exitScenarios)
      .where(eq(exitScenarios.modelingProjectId, projectId));

    for (const es of exitScenarioList) {
      await db.update(exitScenarios)
        .set({ holdingPeriodYears: holdPeriodYears, updatedAt: new Date() } as any)
        .where(eq(exitScenarios.id, es.id));
    }
    if (exitScenarioList.length > 0) updated.push(`exitScenarios(${exitScenarioList.length})`);

    // 4. Update current scenario versions
    const versions = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.isCurrentVersion, true),
      ));

    for (const v of versions) {
      const assumptions = (v.assumptions as any) || {};
      assumptions.holdPeriodYears = holdPeriodYears;
      await db.update(modelingScenarioVersions)
        .set({ assumptions, updatedAt: new Date() } as any)
        .where(eq(modelingScenarioVersions.id, v.id));
    }
    if (versions.length > 0) updated.push(`scenarioVersions(${versions.length})`);

    return { updated };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Task #4: Portfolio Returns ← Exit KPIs automatic sync
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get exit KPIs for all projects in a portfolio, replacing hardcoded
   * cap rates in portfolio rollup with actual computed exit KPIs.
   */
  async getPortfolioExitKPIs(
    orgId: string,
    projectIds?: string[]
  ): Promise<PortfolioExitKPIs[]> {
    // Get all projects
    let projectQuery = db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    if (projectIds && projectIds.length > 0) {
      projectQuery = db.select()
        .from(modelingProjects)
        .where(and(
          eq(modelingProjects.orgId, orgId),
          inArray(modelingProjects.id, projectIds),
        ));
    }

    const projects = await projectQuery;
    const allProjectIds = projects.map(p => p.id);

    if (allProjectIds.length === 0) return [];

    // Get exit scenarios for all projects
    const allExitScenarios = await db.select()
      .from(exitScenarios)
      .where(inArray(exitScenarios.modelingProjectId, allProjectIds));

    const scenarioIds = allExitScenarios.map(s => s.id);
    if (scenarioIds.length === 0) return [];

    // Get all KPIs
    const allKpis = await db.select()
      .from(exitScenarioKpis)
      .where(inArray(exitScenarioKpis.scenarioId, scenarioIds));

    // Build map: projectId → best exit KPIs
    const scenarioByProject = new Map<string, typeof allExitScenarios[0][]>();
    for (const es of allExitScenarios) {
      const pid = es.modelingProjectId;
      if (pid) {
        if (!scenarioByProject.has(pid)) scenarioByProject.set(pid, []);
        scenarioByProject.get(pid)!.push(es);
      }
    }

    const kpiByScenario = new Map<string, typeof allKpis[0]>();
    for (const kpi of allKpis) {
      kpiByScenario.set(kpi.scenarioId, kpi);
    }

    const results: PortfolioExitKPIs[] = [];

    for (const project of projects) {
      const projectScenarios = scenarioByProject.get(project.id) || [];

      // Select best scenario by highest afterTaxCashTotal
      let bestScenario: typeof allExitScenarios[0] | null = null;
      let bestKpi: typeof allKpis[0] | null = null;
      let bestValue = -Infinity;

      for (const es of projectScenarios) {
        const kpi = kpiByScenario.get(es.id);
        if (kpi) {
          const val = parseFloat(kpi.afterTaxCashTotal?.toString() || '0');
          if (val > bestValue) {
            bestValue = val;
            bestScenario = es;
            bestKpi = kpi;
          }
        }
      }

      if (bestScenario && bestKpi) {
        results.push({
          projectId: project.id,
          scenarioId: bestScenario.id,
          salePrice: parseFloat(bestKpi.salePrice?.toString() || '0'),
          afterTaxCashNow: parseFloat(bestKpi.afterTaxCashNow?.toString() || '0'),
          afterTaxCashTotal: parseFloat(bestKpi.afterTaxCashTotal?.toString() || '0'),
          irr: bestKpi.lpIrr ? parseFloat(bestKpi.lpIrr.toString()) : null,
          equityMultiple: bestKpi.lpEquityMultiple ? parseFloat(bestKpi.lpEquityMultiple.toString()) : null,
          exitCapRate: parseFloat(bestScenario.exitCapRate?.toString() || '0'),
          holdPeriodYears: bestScenario.holdingPeriodYears ?? 5,
          strategiesActive: (bestKpi.strategiesActive as string[]) || ['cash_sale'],
        });
      }
    }

    return results;
  }

  /**
   * Compute portfolio-level IRR using actual exit KPIs instead of
   * hardcoded assumptions.
   */
  async computePortfolioIRRFromExitKPIs(
    orgId: string,
    projectIds?: string[]
  ): Promise<{ base: number; weighted: number; projectCount: number }> {
    const exitKPIs = await this.getPortfolioExitKPIs(orgId, projectIds);

    if (exitKPIs.length === 0) return { base: 0, weighted: 0, projectCount: 0 };

    // Simple average IRR
    const irrs = exitKPIs
      .filter(k => k.irr !== null && k.irr > 0)
      .map(k => k.irr!);

    const base = irrs.length > 0
      ? irrs.reduce((s, v) => s + v, 0) / irrs.length
      : 0;

    // Value-weighted IRR
    const totalValue = exitKPIs.reduce((s, k) => s + k.salePrice, 0);
    const weighted = totalValue > 0
      ? exitKPIs
          .filter(k => k.irr !== null && k.irr > 0)
          .reduce((s, k) => s + k.irr! * (k.salePrice / totalValue), 0)
      : 0;

    return { base, weighted, projectCount: exitKPIs.length };
  }
}

export const exitIntegrationService = new ExitIntegrationService();

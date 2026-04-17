/**
 * server/services/dcf-scenario-layer.ts
 *
 * Layer 3 — Deterministic scenario analysis.
 * Produces base/upside/downside results by applying controlled overrides
 * to the canonical Multi-Year Projection Engine.
 *
 * NOT a parallel model. All cash flows come from computeMultiYearProjection().
 */
import { DatedCashFlow } from '../../shared/finance/xirr';
export interface ScenarioDefinition {
    name: string;
    revenueGrowthRateDelta: number;
    exitCapRateDelta: number;
    saleCostRateDelta: number;
    weight: number;
}
export interface ScenarioResult {
    name: string;
    irr: number;
    leveredIrr: number;
    equityMultiple: number;
    npv: number;
    terminalValue: number;
    netSaleProceeds: number;
    cashFlows: DatedCashFlow[];
    overridesApplied: ScenarioDefinition;
}
export interface ExpectedCaseResult {
    expectedIRR: number;
    expectedEM: number;
    expectedNPV: number;
    expectedTerminalValue: number;
    expectedNetSaleProceeds: number;
    probIRRBelowHurdle: number;
    probLosingMoney: number;
    weights: {
        base: number;
        upside: number;
        downside: number;
    };
}
export interface ScenarioAnalysisResult {
    base: ScenarioResult;
    upside: ScenarioResult;
    downside: ScenarioResult;
    expectedCase: ExpectedCaseResult;
}
export declare const DEFAULT_SCENARIOS: Record<string, ScenarioDefinition>;
export declare function runScenarioAnalysis(year1: any, computeMultiYearProjection: (y1: any, config: any) => any, baseConfig: {
    holdPeriod: number;
    revenueGrowthRate: number;
    expenseGrowthRate: number;
    exitCapRate: number;
    sellingCostPct: number;
}, equity: {
    equityInvested: number;
    acquisitionDate: string;
    annualDebtService: number[];
    debtBalanceAtExit: number;
    purchasePrice: number;
}, discountRate: number, // percent
customScenarios?: Record<string, ScenarioDefinition>, hurdleIRR?: number): ScenarioAnalysisResult;

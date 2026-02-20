/**
 * shared/debt/index.ts — Barrel export
 */
export { computeLoanSchedule, computeLoanFeesAtClose, computeLoanPayoffAtExit, computeAnnualDebtService, computeDSCR, computeLTV, computeDebtYield, computeCapitalStackSummary } from './debt-engine';
export type { DebtEngineInput, MonthlyScheduleRow, LoanFeesResult, LoanPayoffResult, AnnualDebtSummary, CapitalStackSummary } from './debt-engine';
export { canonicalToLoanScheduleResult, computeProjectExitDebt, convertLoansToDebtSchedules } from './exit-adapter';
export type { ExitDebtPayoff } from './exit-adapter';
export { computeRefiPlan, compareRefiVsHold } from './refi-engine';
export type { RefiConfig, RefiResult, RefiComparison } from './refi-engine';
export { computeStressTest } from './stress-test-engine';
export type { StressTestConfig, StressScenario, StressResult, StressMatrix, BreachSummary, StressTestResult, YearMetrics } from './stress-test-engine';
export { buildWaterfallInput, computeSimpleWaterfall } from './fund-waterfall-adapter';
export type { FundDealCashflows, FundWaterfallConfig, FundWaterfallResult } from './fund-waterfall-adapter';
export { checkCovenants, buildCovenantTimeline, DEFAULT_THRESHOLDS } from './covenant-monitor';
export type { CovenantThresholds, CovenantCheckResult, CovenantTimeline, CovenantStatus } from './covenant-monitor';
export { projectForwardRates, computeLoanScheduleWithCurve, analyzeFloatingRateScenarios } from './forward-curve-engine';
export type { ForwardRatePoint, ForwardCurveConfig, FloatingRateScenario, FloatingRateAnalysis } from './forward-curve-engine';

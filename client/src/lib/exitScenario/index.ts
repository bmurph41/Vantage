export { buildExitScenarioInput, buildCashSaleBaseline } from './buildExitScenarioInput';
export type { ExitScenarioUIState } from './buildExitScenarioInput';
export { normalizeRate, ensurePercent } from './normalizeRate';
export {
  solveXIRR,
  calcNPV,
  calcNPVDated,
  runMonteCarlo,
  applyCorrelation,
  computeExpectedValue,
  estimateAMT,
  calcPrepaymentCurve,
  STATE_CAPITAL_GAINS_RATES,
} from './financeUtils';
export type {
  MonteCarloInput,
  MonteCarloResult,
  DistributionType,
  CorrelationPair,
  ScenarioBranch,
} from './financeUtils';

export type ScenarioType = 'base' | 'aggressive' | 'conservative';

export type ScenarioConfig = {
  name: string;
  description: string;
  revenueGrowth: number;
  expenseGrowth: number;
  exitCapRate: number;
};

export const defaultScenarios: Record<ScenarioType, ScenarioConfig> = {
  base: {
    name: 'Base Case',
    description: 'Manual assumptions as entered',
    revenueGrowth: 3,
    expenseGrowth: 2,
    exitCapRate: 7.5,
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Higher growth, lower expenses, cap rate compression',
    revenueGrowth: 5,
    expenseGrowth: 1.5,
    exitCapRate: 7.0,
  },
  conservative: {
    name: 'Conservative',
    description: 'Lower growth, higher expenses, cap rate expansion',
    revenueGrowth: 2,
    expenseGrowth: 3,
    exitCapRate: 8.0,
  },
};

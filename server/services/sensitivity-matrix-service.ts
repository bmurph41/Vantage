import { db } from '../db';
import { 
  modelingSensitivityMatrices,
  modelingScenarioVersions,
  modelingProjects,
  modelingProjectConfig
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { proFormaEngineService } from './pro-forma-engine-service';

export interface SensitivityConfig {
  xAxisVariable: string;
  xAxisMin: number;
  xAxisMax: number;
  xAxisStep: number;
  yAxisVariable: string;
  yAxisMin: number;
  yAxisMax: number;
  yAxisStep: number;
  targetMetric: string;
}

export interface SensitivityResult {
  id?: string;
  analysisType: string;
  config: SensitivityConfig;
  matrix: number[][];
  xAxisValues: number[];
  yAxisValues: number[];
  baselineValue: number;
  scenarioType: string;
  scenarioVersion: number;
  createdAt: string;
}

export class SensitivityMatrixService {
  async generateMatrix(
    projectId: string,
    orgId: string,
    scenarioType: string = 'base',
    config: SensitivityConfig
  ): Promise<SensitivityResult> {
    const xAxisValues = this.generateRange(config.xAxisMin, config.xAxisMax, config.xAxisStep);
    const yAxisValues = this.generateRange(config.yAxisMin, config.yAxisMax, config.yAxisStep);
    
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);

    const [projectConfig] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId))
      .limit(1);

    const holdPeriod = projectConfig?.holdPeriod || 5;
    const purchasePrice = parseFloat(project?.purchasePrice?.toString() || '0');
    const baseRevGrowth = parseFloat(scenario?.revenueGrowthRate?.toString() || '3') / 100;
    const baseExpGrowth = parseFloat(scenario?.expenseGrowthRate?.toString() || '2.5') / 100;
    const baseExitCap = parseFloat(scenario?.exitCapRate?.toString() || '7.5') / 100;

    const matrix: number[][] = [];
    
    for (const yValue of yAxisValues) {
      const row: number[] = [];
      for (const xValue of xAxisValues) {
        const revGrowth = config.xAxisVariable === 'revenue_growth' ? xValue / 100 : 
                         config.yAxisVariable === 'revenue_growth' ? yValue / 100 : baseRevGrowth;
        const expGrowth = config.xAxisVariable === 'expense_growth' ? xValue / 100 : 
                         config.yAxisVariable === 'expense_growth' ? yValue / 100 : baseExpGrowth;
        const exitCap = config.xAxisVariable === 'exit_cap_rate' ? xValue / 100 : 
                       config.yAxisVariable === 'exit_cap_rate' ? yValue / 100 : baseExitCap;

        const metric = this.calculateMetric(
          config.targetMetric,
          purchasePrice,
          revGrowth,
          expGrowth,
          exitCap,
          holdPeriod
        );
        
        row.push(metric);
      }
      matrix.push(row);
    }

    const baselineValue = this.calculateMetric(
      config.targetMetric,
      purchasePrice,
      baseRevGrowth,
      baseExpGrowth,
      baseExitCap,
      holdPeriod
    );

    return {
      analysisType: `${config.xAxisVariable}_vs_${config.yAxisVariable}`,
      config,
      matrix,
      xAxisValues,
      yAxisValues,
      baselineValue,
      scenarioType,
      scenarioVersion: scenario?.version || 1,
      createdAt: new Date().toISOString()
    };
  }

  async saveMatrix(
    projectId: string,
    orgId: string,
    userId: string,
    result: SensitivityResult,
    name?: string,
    description?: string
  ): Promise<string> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, result.scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);

    const [saved] = await db.insert(modelingSensitivityMatrices).values({
      orgId,
      modelingProjectId: projectId,
      scenarioVersionId: scenario?.id,
      analysisType: result.analysisType,
      name: name || `${result.config.targetMetric} Sensitivity`,
      description,
      xAxisVariable: result.config.xAxisVariable,
      xAxisMin: result.config.xAxisMin.toString(),
      xAxisMax: result.config.xAxisMax.toString(),
      xAxisStep: result.config.xAxisStep.toString(),
      yAxisVariable: result.config.yAxisVariable,
      yAxisMin: result.config.yAxisMin.toString(),
      yAxisMax: result.config.yAxisMax.toString(),
      yAxisStep: result.config.yAxisStep.toString(),
      targetMetric: result.config.targetMetric,
      matrixData: result.matrix,
      baselineValue: result.baselineValue.toString(),
      createdBy: userId,
    }).returning();

    return saved.id;
  }

  async getMatrices(projectId: string, orgId: string): Promise<SensitivityResult[]> {
    const matrices = await db.select()
      .from(modelingSensitivityMatrices)
      .where(and(
        eq(modelingSensitivityMatrices.modelingProjectId, projectId),
        eq(modelingSensitivityMatrices.orgId, orgId)
      ))
      .orderBy(desc(modelingSensitivityMatrices.createdAt));

    return matrices.map(m => ({
      id: m.id,
      analysisType: m.analysisType,
      config: {
        xAxisVariable: m.xAxisVariable,
        xAxisMin: parseFloat(m.xAxisMin?.toString() || '0'),
        xAxisMax: parseFloat(m.xAxisMax?.toString() || '0'),
        xAxisStep: parseFloat(m.xAxisStep?.toString() || '0'),
        yAxisVariable: m.yAxisVariable,
        yAxisMin: parseFloat(m.yAxisMin?.toString() || '0'),
        yAxisMax: parseFloat(m.yAxisMax?.toString() || '0'),
        yAxisStep: parseFloat(m.yAxisStep?.toString() || '0'),
        targetMetric: m.targetMetric
      },
      matrix: m.matrixData as number[][],
      xAxisValues: this.generateRange(
        parseFloat(m.xAxisMin?.toString() || '0'),
        parseFloat(m.xAxisMax?.toString() || '0'),
        parseFloat(m.xAxisStep?.toString() || '1')
      ),
      yAxisValues: this.generateRange(
        parseFloat(m.yAxisMin?.toString() || '0'),
        parseFloat(m.yAxisMax?.toString() || '0'),
        parseFloat(m.yAxisStep?.toString() || '1')
      ),
      baselineValue: parseFloat(m.baselineValue?.toString() || '0'),
      scenarioType: 'base',
      scenarioVersion: 1,
      createdAt: m.createdAt.toISOString()
    }));
  }

  private generateRange(min: number, max: number, step: number): number[] {
    const range: number[] = [];
    for (let value = min; value <= max; value += step) {
      range.push(Math.round(value * 100) / 100);
    }
    return range;
  }

  private calculateMetric(
    metric: string,
    purchasePrice: number,
    revGrowth: number,
    expGrowth: number,
    exitCap: number,
    holdPeriod: number
  ): number {
    const baseNoi = 400000;
    const cashFlows: number[] = [-purchasePrice];
    
    for (let year = 1; year <= holdPeriod; year++) {
      const yearRevenue = 1000000 * Math.pow(1 + revGrowth, year);
      const yearExpenses = 600000 * Math.pow(1 + expGrowth, year);
      const yearNoi = yearRevenue - yearExpenses;
      
      if (year === holdPeriod) {
        const exitValue = yearNoi / exitCap;
        cashFlows.push(yearNoi + exitValue);
      } else {
        cashFlows.push(yearNoi);
      }
    }

    switch (metric) {
      case 'irr':
        return this.calculateIRR(cashFlows);
      case 'equity_multiple':
        const totalReturn = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
        return purchasePrice > 0 ? Math.round((totalReturn / purchasePrice) * 100) / 100 : 0;
      case 'noi':
        return Math.round(baseNoi * Math.pow(1 + revGrowth - expGrowth, holdPeriod));
      case 'exit_value':
        const finalNoi = baseNoi * Math.pow(1 + revGrowth - expGrowth, holdPeriod);
        return Math.round(finalNoi / exitCap);
      default:
        return 0;
    }
  }

  private calculateIRR(cashFlows: number[], guess: number = 0.1): number {
    const maxIterations = 100;
    const precision = 0.00001;
    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        npv += cashFlows[j] / Math.pow(1 + rate, j);
        dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
      }

      if (Math.abs(dnpv) < precision) break;

      const newRate = rate - npv / dnpv;
      if (Math.abs(newRate - rate) < precision) {
        return Math.round(newRate * 10000) / 100;
      }
      rate = newRate;
    }

    return Math.round(rate * 10000) / 100;
  }
}

export const sensitivityMatrixService = new SensitivityMatrixService();

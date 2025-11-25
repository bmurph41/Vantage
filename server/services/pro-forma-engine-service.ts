import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  modelingProjectConfig
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface LineItem {
  name: string;
  category: string;
  subcategory?: string;
  baseAmount: number;
  growthRate: number;
  projections: number[];
  isRevenue: boolean;
}

export interface ProFormaData {
  projectId: string;
  scenarioType: string;
  scenarioVersion: number;
  holdPeriod: number;
  years: number[];
  baseYear: number;
  revenue: {
    lineItems: LineItem[];
    totals: number[];
  };
  expenses: {
    lineItems: LineItem[];
    totals: number[];
  };
  noi: number[];
  noiBelowLine: number[];
  capex: number[];
  cashFlow: number[];
  metrics: {
    goingInCapRate: number;
    exitCapRate: number;
    revenueGrowthRate: number;
    expenseGrowthRate: number;
    purchasePrice: number;
    exitValue: number;
    totalReturn: number;
    irr: number;
    equityMultiple: number;
  };
  lastUpdated: string;
}

export class ProFormaEngineService {
  async generateProForma(
    projectId: string, 
    orgId: string, 
    scenarioType: string = 'base'
  ): Promise<ProFormaData> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found');
    }

    const [config] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);

    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    const holdPeriod = config?.holdPeriod || 5;
    const baseYear = new Date().getFullYear();
    const years = Array.from({ length: holdPeriod }, (_, i) => baseYear + i);

    const revenueGrowthRate = parseFloat(scenario?.revenueGrowthRate?.toString() || '3') / 100;
    const expenseGrowthRate = parseFloat(scenario?.expenseGrowthRate?.toString() || '2.5') / 100;
    const exitCapRate = parseFloat(scenario?.exitCapRate?.toString() || '7.5') / 100;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');

    const revenueBySubcat: Record<string, number> = {};
    const expensesBySubcat: Record<string, number> = {};

    for (const actual of actuals) {
      const amount = parseFloat(actual.amount?.toString() || '0');
      const subcat = actual.subcategory || 'Other';
      
      if (actual.category === 'Revenue') {
        revenueBySubcat[subcat] = (revenueBySubcat[subcat] || 0) + amount;
      } else if (['Expenses', 'COGS', 'Operating Expenses'].includes(actual.category || '')) {
        expensesBySubcat[subcat] = (expensesBySubcat[subcat] || 0) + amount;
      }
    }

    const totalBaseRevenue = Object.values(revenueBySubcat).reduce((sum, v) => sum + v, 0) || 1000000;
    const totalBaseExpenses = Object.values(expensesBySubcat).reduce((sum, v) => sum + v, 0) || 600000;

    const revenueLineItems: LineItem[] = Object.entries(revenueBySubcat).map(([name, base]) => ({
      name,
      category: 'Revenue',
      baseAmount: base,
      growthRate: revenueGrowthRate * 100,
      projections: years.map((_, i) => Math.round(base * Math.pow(1 + revenueGrowthRate, i))),
      isRevenue: true
    }));

    if (revenueLineItems.length === 0) {
      revenueLineItems.push({
        name: 'Wet Slips',
        category: 'Revenue',
        baseAmount: 500000,
        growthRate: revenueGrowthRate * 100,
        projections: years.map((_, i) => Math.round(500000 * Math.pow(1 + revenueGrowthRate, i))),
        isRevenue: true
      });
      revenueLineItems.push({
        name: 'Dry Storage',
        category: 'Revenue',
        baseAmount: 300000,
        growthRate: revenueGrowthRate * 100,
        projections: years.map((_, i) => Math.round(300000 * Math.pow(1 + revenueGrowthRate, i))),
        isRevenue: true
      });
      revenueLineItems.push({
        name: 'Fuel Sales',
        category: 'Revenue',
        baseAmount: 200000,
        growthRate: revenueGrowthRate * 100,
        projections: years.map((_, i) => Math.round(200000 * Math.pow(1 + revenueGrowthRate, i))),
        isRevenue: true
      });
    }

    const expenseLineItems: LineItem[] = Object.entries(expensesBySubcat).map(([name, base]) => ({
      name,
      category: 'Expenses',
      baseAmount: base,
      growthRate: expenseGrowthRate * 100,
      projections: years.map((_, i) => Math.round(base * Math.pow(1 + expenseGrowthRate, i))),
      isRevenue: false
    }));

    if (expenseLineItems.length === 0) {
      expenseLineItems.push({
        name: 'Labor',
        category: 'Expenses',
        baseAmount: 250000,
        growthRate: expenseGrowthRate * 100,
        projections: years.map((_, i) => Math.round(250000 * Math.pow(1 + expenseGrowthRate, i))),
        isRevenue: false
      });
      expenseLineItems.push({
        name: 'Utilities',
        category: 'Expenses',
        baseAmount: 100000,
        growthRate: expenseGrowthRate * 100,
        projections: years.map((_, i) => Math.round(100000 * Math.pow(1 + expenseGrowthRate, i))),
        isRevenue: false
      });
      expenseLineItems.push({
        name: 'Insurance',
        category: 'Expenses',
        baseAmount: 75000,
        growthRate: expenseGrowthRate * 100,
        projections: years.map((_, i) => Math.round(75000 * Math.pow(1 + expenseGrowthRate, i))),
        isRevenue: false
      });
      expenseLineItems.push({
        name: 'Maintenance',
        category: 'Expenses',
        baseAmount: 100000,
        growthRate: expenseGrowthRate * 100,
        projections: years.map((_, i) => Math.round(100000 * Math.pow(1 + expenseGrowthRate, i))),
        isRevenue: false
      });
      expenseLineItems.push({
        name: 'Property Tax',
        category: 'Expenses',
        baseAmount: 50000,
        growthRate: expenseGrowthRate * 100,
        projections: years.map((_, i) => Math.round(50000 * Math.pow(1 + expenseGrowthRate, i))),
        isRevenue: false
      });
      expenseLineItems.push({
        name: 'Management Fee',
        category: 'Expenses',
        baseAmount: 25000,
        growthRate: expenseGrowthRate * 100,
        projections: years.map((_, i) => Math.round(25000 * Math.pow(1 + expenseGrowthRate, i))),
        isRevenue: false
      });
    }

    const revenueTotals = years.map((_, i) => 
      revenueLineItems.reduce((sum, item) => sum + item.projections[i], 0)
    );

    const expenseTotals = years.map((_, i) => 
      expenseLineItems.reduce((sum, item) => sum + item.projections[i], 0)
    );

    const noi = revenueTotals.map((rev, i) => rev - expenseTotals[i]);

    const noiBelowLine = years.map(() => 0);
    const capexRate = 0.02;
    const capex = revenueTotals.map(rev => Math.round(rev * capexRate));
    const cashFlow = noi.map((n, i) => n - capex[i]);

    const exitNoi = noi[noi.length - 1];
    const exitValue = exitCapRate > 0 ? Math.round(exitNoi / exitCapRate) : 0;
    const goingInCapRate = purchasePrice > 0 ? (noi[0] / purchasePrice) * 100 : 0;

    const cashFlows = [-purchasePrice, ...cashFlow.slice(0, -1), cashFlow[cashFlow.length - 1] + exitValue];
    const irr = this.calculateIRR(cashFlows);
    const totalReturn = cashFlows.reduce((sum, cf, i) => i === 0 ? sum : sum + cf, 0);
    const equityMultiple = purchasePrice > 0 ? (totalReturn + purchasePrice) / purchasePrice : 0;

    return {
      projectId,
      scenarioType,
      scenarioVersion: scenario?.version || 1,
      holdPeriod,
      years,
      baseYear,
      revenue: {
        lineItems: revenueLineItems,
        totals: revenueTotals
      },
      expenses: {
        lineItems: expenseLineItems,
        totals: expenseTotals
      },
      noi,
      noiBelowLine,
      capex,
      cashFlow,
      metrics: {
        goingInCapRate,
        exitCapRate: exitCapRate * 100,
        revenueGrowthRate: revenueGrowthRate * 100,
        expenseGrowthRate: expenseGrowthRate * 100,
        purchasePrice,
        exitValue,
        totalReturn,
        irr,
        equityMultiple
      },
      lastUpdated: new Date().toISOString()
    };
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

  async getHistoricalPL(projectId: string, orgId: string, year?: number): Promise<any> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found');
    }

    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    const relevantActuals = year 
      ? actuals.filter(a => a.year === year)
      : actuals;

    const lineItems: Record<string, Record<number, number>> = {};
    const categories: Record<string, string> = {};

    for (const actual of relevantActuals) {
      const key = actual.subcategory || actual.category || 'Other';
      const month = actual.month || 1;
      const amount = parseFloat(actual.amount?.toString() || '0');
      
      if (!lineItems[key]) {
        lineItems[key] = {};
        categories[key] = actual.category || 'Other';
      }
      
      lineItems[key][month] = (lineItems[key][month] || 0) + amount;
    }

    const revenueItems: any[] = [];
    const expenseItems: any[] = [];

    for (const [name, monthlyData] of Object.entries(lineItems)) {
      const monthlyAmounts = Array.from({ length: 12 }, (_, i) => monthlyData[i + 1] || 0);
      const total = monthlyAmounts.reduce((sum, v) => sum + v, 0);
      
      const item = {
        name,
        category: categories[name],
        monthlyAmounts,
        total
      };

      if (categories[name] === 'Revenue') {
        revenueItems.push(item);
      } else {
        expenseItems.push(item);
      }
    }

    const totalRevenue = revenueItems.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + item.total, 0);
    const noi = totalRevenue - totalExpenses;

    return {
      year: year || new Date().getFullYear(),
      revenue: {
        lineItems: revenueItems,
        total: totalRevenue
      },
      expenses: {
        lineItems: expenseItems,
        total: totalExpenses
      },
      noi,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const proFormaEngineService = new ProFormaEngineService();

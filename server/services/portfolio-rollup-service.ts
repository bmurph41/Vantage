import { db } from '../db';
import { 
  modelingProjects,
  modelingActuals,
  modelingScenarioVersions
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';

export interface PortfolioSummary {
  totalProjects: number;
  totalValue: number;
  totalUnits: number;
  totalAcres: number;
  averageCapRate: number;
  totalNetIncome: number;
  totalRevenue: number;
  totalExpenses: number;
  averageOccupancy: number;
  totalDebt: number;
  totalEquity: number;
  weightedLTV: number;
  irr: {
    base: number;
    aggressive: number;
    conservative: number;
  };
}

export interface ProjectRollup {
  id: string;
  name: string;
  marinaName: string;
  state: string;
  region: string;
  acquisitionDate: Date | null;
  totalUnits: number;
  estimatedValue: number;
  noi: number;
  capRate: number;
  occupancy: number;
  status: string;
  scenarioStatus: {
    base: string;
    aggressive: string;
    conservative: string;
  };
}

export interface PortfolioBreakdown {
  byRegion: Array<{
    region: string;
    projectCount: number;
    totalValue: number;
    averageNOI: number;
    averageCapRate: number;
  }>;
  byState: Array<{
    state: string;
    projectCount: number;
    totalValue: number;
    averageNOI: number;
    averageCapRate: number;
  }>;
  byStatus: Array<{
    status: string;
    projectCount: number;
    totalValue: number;
  }>;
  byYear: Array<{
    year: number;
    projectCount: number;
    totalValue: number;
    acquisitions: number;
    dispositions: number;
  }>;
}

export interface PortfolioProjection {
  year: number;
  scenarios: {
    base: {
      revenue: number;
      expenses: number;
      noi: number;
      value: number;
    };
    aggressive: {
      revenue: number;
      expenses: number;
      noi: number;
      value: number;
    };
    conservative: {
      revenue: number;
      expenses: number;
      noi: number;
      value: number;
    };
  };
}

export class PortfolioRollupService {
  async getPortfolioSummary(orgId: string, projectIds?: string[]): Promise<PortfolioSummary> {
    let query = db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    if (projectIds && projectIds.length > 0) {
      query = db.select()
        .from(modelingProjects)
        .where(and(
          eq(modelingProjects.orgId, orgId),
          inArray(modelingProjects.id, projectIds)
        ));
    }

    const projects = await query;

    let totalValue = 0;
    let totalUnits = 0;
    let totalAcres = 0;
    let totalNOI = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalDebt = 0;
    let totalEquity = 0;
    let occupancySum = 0;
    let occupancyCount = 0;
    let capRateSum = 0;
    let capRateCount = 0;

    for (const project of projects) {
      totalValue += parseFloat(project.estimatedValue?.toString() || '0');
      totalUnits += project.totalUnits || 0;
      totalAcres += parseFloat(project.acreage?.toString() || '0');
      totalDebt += parseFloat(project.financingAmount?.toString() || '0');
      
      if (project.currentOccupancy) {
        occupancySum += parseFloat(project.currentOccupancy.toString());
        occupancyCount++;
      }
      
      if (project.capRate) {
        capRateSum += parseFloat(project.capRate.toString());
        capRateCount++;
      }
    }

    const projectIdList = projects.map(p => p.id);
    if (projectIdList.length > 0) {
      const actuals = await db.select({
        category: modelingActuals.category,
        totalAmount: sql<string>`SUM(CAST(${modelingActuals.amount} AS DECIMAL))`
      })
        .from(modelingActuals)
        .where(inArray(modelingActuals.modelingProjectId, projectIdList))
        .groupBy(modelingActuals.category);

      for (const actual of actuals) {
        const amount = parseFloat(actual.totalAmount || '0');
        if (actual.category === 'Revenue') {
          totalRevenue += amount;
        } else if (actual.category === 'Expenses' || actual.category === 'COGS') {
          totalExpenses += amount;
        }
      }
      totalNOI = totalRevenue - totalExpenses;
    }

    totalEquity = totalValue - totalDebt;
    const weightedLTV = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

    const scenarios = await this.calculatePortfolioIRR(orgId, projectIdList);

    return {
      totalProjects: projects.length,
      totalValue,
      totalUnits,
      totalAcres,
      averageCapRate: capRateCount > 0 ? capRateSum / capRateCount : 0,
      totalNetIncome: totalNOI,
      totalRevenue,
      totalExpenses,
      averageOccupancy: occupancyCount > 0 ? occupancySum / occupancyCount : 0,
      totalDebt,
      totalEquity,
      weightedLTV,
      irr: scenarios
    };
  }

  async getProjectRollups(orgId: string, filters?: {
    region?: string;
    state?: string;
    status?: string;
    minValue?: number;
    maxValue?: number;
  }): Promise<ProjectRollup[]> {
    let conditions = [eq(modelingProjects.orgId, orgId)];

    if (filters?.region) {
      conditions.push(eq(modelingProjects.region, filters.region));
    }
    if (filters?.state) {
      conditions.push(eq(modelingProjects.state, filters.state));
    }
    if (filters?.status) {
      conditions.push(eq(modelingProjects.status, filters.status));
    }

    const projects = await db.select()
      .from(modelingProjects)
      .where(and(...conditions))
      .orderBy(desc(modelingProjects.createdAt));

    const rollups: ProjectRollup[] = [];

    for (const project of projects) {
      const value = parseFloat(project.estimatedValue?.toString() || '0');
      
      if (filters?.minValue && value < filters.minValue) continue;
      if (filters?.maxValue && value > filters.maxValue) continue;

      const scenarios = await db.select({
        scenarioType: modelingScenarioVersions.scenarioType,
        status: modelingScenarioVersions.status
      })
        .from(modelingScenarioVersions)
        .where(and(
          eq(modelingScenarioVersions.modelingProjectId, project.id),
          eq(modelingScenarioVersions.isCurrentVersion, true)
        ));

      const scenarioStatus: any = {
        base: 'draft',
        aggressive: 'draft',
        conservative: 'draft'
      };

      for (const scenario of scenarios) {
        if (scenario.scenarioType in scenarioStatus) {
          scenarioStatus[scenario.scenarioType] = scenario.status;
        }
      }

      const occupancy = parseFloat(project.currentOccupancy?.toString() || '0');
      const capRate = parseFloat(project.capRate?.toString() || '0');
      const noi = capRate > 0 ? value * (capRate / 100) : 0;

      rollups.push({
        id: project.id,
        name: project.name,
        marinaName: project.marinaName || '',
        state: project.state || '',
        region: project.region || '',
        acquisitionDate: project.acquisitionDate,
        totalUnits: project.totalUnits || 0,
        estimatedValue: value,
        noi,
        capRate,
        occupancy,
        status: project.status || 'active',
        scenarioStatus
      });
    }

    return rollups;
  }

  async getPortfolioBreakdown(orgId: string): Promise<PortfolioBreakdown> {
    const projects = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    const byRegionMap = new Map<string, { count: number; value: number; noiSum: number; capRateSum: number; capRateCount: number }>();
    const byStateMap = new Map<string, { count: number; value: number; noiSum: number; capRateSum: number; capRateCount: number }>();
    const byStatusMap = new Map<string, { count: number; value: number }>();
    const byYearMap = new Map<number, { count: number; value: number; acquisitions: number; dispositions: number }>();

    for (const project of projects) {
      const value = parseFloat(project.estimatedValue?.toString() || '0');
      const capRate = parseFloat(project.capRate?.toString() || '0');
      const noi = capRate > 0 ? value * (capRate / 100) : 0;
      
      const region = project.region || 'Unknown';
      const regionData = byRegionMap.get(region) || { count: 0, value: 0, noiSum: 0, capRateSum: 0, capRateCount: 0 };
      regionData.count++;
      regionData.value += value;
      regionData.noiSum += noi;
      if (capRate > 0) {
        regionData.capRateSum += capRate;
        regionData.capRateCount++;
      }
      byRegionMap.set(region, regionData);

      const state = project.state || 'Unknown';
      const stateData = byStateMap.get(state) || { count: 0, value: 0, noiSum: 0, capRateSum: 0, capRateCount: 0 };
      stateData.count++;
      stateData.value += value;
      stateData.noiSum += noi;
      if (capRate > 0) {
        stateData.capRateSum += capRate;
        stateData.capRateCount++;
      }
      byStateMap.set(state, stateData);

      const status = project.status || 'active';
      const statusData = byStatusMap.get(status) || { count: 0, value: 0 };
      statusData.count++;
      statusData.value += value;
      byStatusMap.set(status, statusData);

      if (project.acquisitionDate) {
        const year = new Date(project.acquisitionDate).getFullYear();
        const yearData = byYearMap.get(year) || { count: 0, value: 0, acquisitions: 0, dispositions: 0 };
        yearData.count++;
        yearData.value += value;
        yearData.acquisitions++;
        byYearMap.set(year, yearData);
      }
    }

    return {
      byRegion: Array.from(byRegionMap.entries()).map(([region, data]) => ({
        region,
        projectCount: data.count,
        totalValue: data.value,
        averageNOI: data.count > 0 ? data.noiSum / data.count : 0,
        averageCapRate: data.capRateCount > 0 ? data.capRateSum / data.capRateCount : 0
      })).sort((a, b) => b.totalValue - a.totalValue),

      byState: Array.from(byStateMap.entries()).map(([state, data]) => ({
        state,
        projectCount: data.count,
        totalValue: data.value,
        averageNOI: data.count > 0 ? data.noiSum / data.count : 0,
        averageCapRate: data.capRateCount > 0 ? data.capRateSum / data.capRateCount : 0
      })).sort((a, b) => b.totalValue - a.totalValue),

      byStatus: Array.from(byStatusMap.entries()).map(([status, data]) => ({
        status,
        projectCount: data.count,
        totalValue: data.value
      })),

      byYear: Array.from(byYearMap.entries()).map(([year, data]) => ({
        year,
        ...data
      })).sort((a, b) => b.year - a.year)
    };
  }

  async getPortfolioProjections(
    orgId: string, 
    projectIds?: string[],
    yearsToProject = 5
  ): Promise<PortfolioProjection[]> {
    let query = db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    if (projectIds && projectIds.length > 0) {
      query = db.select()
        .from(modelingProjects)
        .where(and(
          eq(modelingProjects.orgId, orgId),
          inArray(modelingProjects.id, projectIds)
        ));
    }

    const projects = await query;
    const projectIdList = projects.map(p => p.id);

    const scenarios = projectIdList.length > 0 
      ? await db.select()
          .from(modelingScenarioVersions)
          .where(and(
            inArray(modelingScenarioVersions.modelingProjectId, projectIdList),
            eq(modelingScenarioVersions.isCurrentVersion, true)
          ))
      : [];

    const scenariosByProject = new Map<string, Map<string, any>>();
    for (const scenario of scenarios) {
      if (!scenariosByProject.has(scenario.modelingProjectId)) {
        scenariosByProject.set(scenario.modelingProjectId, new Map());
      }
      scenariosByProject.get(scenario.modelingProjectId)!.set(scenario.scenarioType, scenario);
    }

    const currentYear = new Date().getFullYear();
    const projections: PortfolioProjection[] = [];

    for (let i = 0; i <= yearsToProject; i++) {
      const year = currentYear + i;
      let baseRevenue = 0, baseExpenses = 0, baseNOI = 0, baseValue = 0;
      let aggressiveRevenue = 0, aggressiveExpenses = 0, aggressiveNOI = 0, aggressiveValue = 0;
      let conservativeRevenue = 0, conservativeExpenses = 0, conservativeNOI = 0, conservativeValue = 0;

      for (const project of projects) {
        const projectValue = parseFloat(project.estimatedValue?.toString() || '0');
        const projectCapRate = parseFloat(project.capRate?.toString() || '0');
        const projectNOI = projectCapRate > 0 ? projectValue * (projectCapRate / 100) : 0;

        const projectScenarios = scenariosByProject.get(project.id) || new Map();

        const baseScenario = projectScenarios.get('base');
        const baseGrowth = parseFloat(baseScenario?.revenueGrowthRate || '3') / 100;
        const baseExpGrowth = parseFloat(baseScenario?.expenseGrowthRate || '2.5') / 100;
        const baseExitCap = parseFloat(baseScenario?.exitCapRate || '7') / 100;

        const aggScenario = projectScenarios.get('aggressive');
        const aggGrowth = parseFloat(aggScenario?.revenueGrowthRate || '5') / 100;
        const aggExpGrowth = parseFloat(aggScenario?.expenseGrowthRate || '2') / 100;
        const aggExitCap = parseFloat(aggScenario?.exitCapRate || '6.5') / 100;

        const consScenario = projectScenarios.get('conservative');
        const consGrowth = parseFloat(consScenario?.revenueGrowthRate || '1.5') / 100;
        const consExpGrowth = parseFloat(consScenario?.expenseGrowthRate || '3') / 100;
        const consExitCap = parseFloat(consScenario?.exitCapRate || '7.5') / 100;

        const baseProjectedRevenue = projectNOI * 1.3 * Math.pow(1 + baseGrowth, i);
        const baseProjectedExpenses = projectNOI * 0.3 * Math.pow(1 + baseExpGrowth, i);
        const baseProjectedNOI = baseProjectedRevenue - baseProjectedExpenses;
        const baseProjectedValue = baseExitCap > 0 ? baseProjectedNOI / baseExitCap : 0;

        baseRevenue += baseProjectedRevenue;
        baseExpenses += baseProjectedExpenses;
        baseNOI += baseProjectedNOI;
        baseValue += baseProjectedValue;

        const aggProjectedRevenue = projectNOI * 1.3 * Math.pow(1 + aggGrowth, i);
        const aggProjectedExpenses = projectNOI * 0.3 * Math.pow(1 + aggExpGrowth, i);
        const aggProjectedNOI = aggProjectedRevenue - aggProjectedExpenses;
        const aggProjectedValue = aggExitCap > 0 ? aggProjectedNOI / aggExitCap : 0;

        aggressiveRevenue += aggProjectedRevenue;
        aggressiveExpenses += aggProjectedExpenses;
        aggressiveNOI += aggProjectedNOI;
        aggressiveValue += aggProjectedValue;

        const consProjectedRevenue = projectNOI * 1.3 * Math.pow(1 + consGrowth, i);
        const consProjectedExpenses = projectNOI * 0.3 * Math.pow(1 + consExpGrowth, i);
        const consProjectedNOI = consProjectedRevenue - consProjectedExpenses;
        const consProjectedValue = consExitCap > 0 ? consProjectedNOI / consExitCap : 0;

        conservativeRevenue += consProjectedRevenue;
        conservativeExpenses += consProjectedExpenses;
        conservativeNOI += consProjectedNOI;
        conservativeValue += consProjectedValue;
      }

      projections.push({
        year,
        scenarios: {
          base: {
            revenue: baseRevenue,
            expenses: baseExpenses,
            noi: baseNOI,
            value: baseValue
          },
          aggressive: {
            revenue: aggressiveRevenue,
            expenses: aggressiveExpenses,
            noi: aggressiveNOI,
            value: aggressiveValue
          },
          conservative: {
            revenue: conservativeRevenue,
            expenses: conservativeExpenses,
            noi: conservativeNOI,
            value: conservativeValue
          }
        }
      });
    }

    return projections;
  }

  private async calculatePortfolioIRR(orgId: string, projectIds: string[]): Promise<{ base: number; aggressive: number; conservative: number }> {
    if (projectIds.length === 0) {
      return { base: 0, aggressive: 0, conservative: 0 };
    }

    const scenarios = await db.select({
      scenarioType: modelingScenarioVersions.scenarioType,
      exitCapRate: modelingScenarioVersions.exitCapRate,
      revenueGrowthRate: modelingScenarioVersions.revenueGrowthRate
    })
      .from(modelingScenarioVersions)
      .where(and(
        inArray(modelingScenarioVersions.modelingProjectId, projectIds),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ));

    const scenarioGroups: Record<string, { exitCaps: number[]; growthRates: number[] }> = {
      base: { exitCaps: [], growthRates: [] },
      aggressive: { exitCaps: [], growthRates: [] },
      conservative: { exitCaps: [], growthRates: [] }
    };

    for (const scenario of scenarios) {
      const type = scenario.scenarioType;
      if (type in scenarioGroups) {
        if (scenario.exitCapRate) {
          scenarioGroups[type].exitCaps.push(parseFloat(scenario.exitCapRate));
        }
        if (scenario.revenueGrowthRate) {
          scenarioGroups[type].growthRates.push(parseFloat(scenario.revenueGrowthRate));
        }
      }
    }

    const calculateIRR = (exitCaps: number[], growthRates: number[]): number => {
      if (exitCaps.length === 0 || growthRates.length === 0) return 0;
      
      const avgExitCap = exitCaps.reduce((a, b) => a + b, 0) / exitCaps.length;
      const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      
      const holdPeriod = 5;
      const capRateSpread = 1.5;
      const estimatedIRR = avgGrowth + (capRateSpread / holdPeriod) + (1 / avgExitCap) - 1;
      
      return Math.max(0, Math.min(estimatedIRR * 100, 50));
    };

    return {
      base: calculateIRR(
        scenarioGroups.base.exitCaps.length > 0 ? scenarioGroups.base.exitCaps : [7],
        scenarioGroups.base.growthRates.length > 0 ? scenarioGroups.base.growthRates : [3]
      ),
      aggressive: calculateIRR(
        scenarioGroups.aggressive.exitCaps.length > 0 ? scenarioGroups.aggressive.exitCaps : [6.5],
        scenarioGroups.aggressive.growthRates.length > 0 ? scenarioGroups.aggressive.growthRates : [5]
      ),
      conservative: calculateIRR(
        scenarioGroups.conservative.exitCaps.length > 0 ? scenarioGroups.conservative.exitCaps : [7.5],
        scenarioGroups.conservative.growthRates.length > 0 ? scenarioGroups.conservative.growthRates : [1.5]
      )
    };
  }

  async getTopPerformingProjects(orgId: string, limit = 10): Promise<ProjectRollup[]> {
    const rollups = await this.getProjectRollups(orgId);
    return rollups
      .sort((a, b) => b.noi - a.noi)
      .slice(0, limit);
  }

  async getUnderperformingProjects(orgId: string, occupancyThreshold = 70): Promise<ProjectRollup[]> {
    const rollups = await this.getProjectRollups(orgId);
    return rollups.filter(p => p.occupancy < occupancyThreshold);
  }

  async exportPortfolioReport(orgId: string): Promise<{
    summary: PortfolioSummary;
    projects: ProjectRollup[];
    breakdown: PortfolioBreakdown;
    projections: PortfolioProjection[];
  }> {
    const [summary, projects, breakdown, projections] = await Promise.all([
      this.getPortfolioSummary(orgId),
      this.getProjectRollups(orgId),
      this.getPortfolioBreakdown(orgId),
      this.getPortfolioProjections(orgId)
    ]);

    return { summary, projects, breakdown, projections };
  }
}

export const portfolioRollupService = new PortfolioRollupService();

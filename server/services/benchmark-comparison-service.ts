/**
 * IMPORTANT: Benchmarking Opt-Out Guardrails
 * 
 * This service aggregates cross-user data for industry benchmarks.
 * Before querying user data for benchmarks, ensure you exclude users who have
 * opted out of anonymized benchmarking.
 * 
 * Use the utilities from './benchmarking-guardrails.ts':
 * - getOptedOutUserIds() - Get user IDs to exclude
 * - getOptedOutOrgIds() - Get org IDs to exclude  
 * - benchmarkingOptOutCondition - Drizzle ORM WHERE clause
 * 
 * @see ./benchmarking-guardrails.ts
 */

import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  salesComps,
  users
} from '@shared/schema';
import { eq, and, gte, lte, avg, count, sql, notInArray } from 'drizzle-orm';
import { getOptedOutOrgIds } from './benchmarking-guardrails';

export interface BenchmarkMetrics {
  projectValue: number;
  benchmarkAvg: number;
  benchmarkMedian: number;
  percentile: number;
  sampleSize: number;
}

export interface BenchmarkResult {
  projectId: string;
  projectName: string;
  region?: string;
  state?: string;
  benchmarks: {
    pricePerUnit: BenchmarkMetrics;
    pricePerSlip: BenchmarkMetrics;
    capRate: BenchmarkMetrics;
    noiMargin: BenchmarkMetrics;
    revenuePerUnit: BenchmarkMetrics;
  };
  marketContext: {
    avgMarketPrice: number;
    avgMarketCapRate: number;
    avgPricePerSlip: number;
    totalComparables: number;
    dateRange: string;
  };
  recommendations: string[];
  generatedAt: string;
}

export class BenchmarkComparisonService {
  async compareToBenchmarks(
    projectId: string,
    orgId: string,
    filters?: {
      region?: string;
      state?: string;
      yearRange?: { start: number; end: number };
      priceRange?: { min: number; max: number };
    }
  ): Promise<BenchmarkResult> {
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

    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, 'base'),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);

    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const actual of actuals) {
      const amount = parseFloat(actual.amount?.toString() || '0');
      if (actual.category === 'Revenue') {
        totalRevenue += amount;
      } else if (['Expenses', 'COGS', 'Operating Expenses'].includes(actual.category || '')) {
        totalExpenses += amount;
      }
    }

    const noi = totalRevenue - totalExpenses;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    const totalUnits = project.totalUnits || 0;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;
    const revenuePerUnit = totalUnits > 0 ? totalRevenue / totalUnits : 0;
    const noiMargin = totalRevenue > 0 ? (noi / totalRevenue) * 100 : 0;

    let compsQuery = db.select().from(salesComps).where(eq(salesComps.orgId, orgId));

    const comparables = await compsQuery;

    const validComps = comparables.filter(c => {
      const salePrice = parseFloat(c.salePrice?.toString() || '0');
      return salePrice > 0;
    });

    const pricePerUnits = validComps
      .filter(c => c.totalSlips && c.totalSlips > 0)
      .map(c => parseFloat(c.salePrice?.toString() || '0') / (c.totalSlips || 1))
      .sort((a, b) => a - b);

    const capRates = validComps
      .filter(c => c.capRate && parseFloat(c.capRate?.toString() || '0') > 0)
      .map(c => parseFloat(c.capRate?.toString() || '0'))
      .sort((a, b) => a - b);

    const salePrices = validComps
      .map(c => parseFloat(c.salePrice?.toString() || '0'))
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    const recommendations: string[] = [];

    const avgPricePerSlip = pricePerUnits.length > 0 
      ? pricePerUnits.reduce((a, b) => a + b, 0) / pricePerUnits.length 
      : 0;
    const avgCapRate = capRates.length > 0 
      ? capRates.reduce((a, b) => a + b, 0) / capRates.length 
      : 0;
    const avgMarketPrice = salePrices.length > 0 
      ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length 
      : 0;

    if (pricePerUnit > avgPricePerSlip * 1.2 && avgPricePerSlip > 0) {
      recommendations.push('Price per unit is 20%+ above market average - validate premium justification');
    } else if (pricePerUnit < avgPricePerSlip * 0.8 && avgPricePerSlip > 0) {
      recommendations.push('Price per unit is below market average - potential value opportunity');
    }

    if (capRate < avgCapRate - 1 && avgCapRate > 0) {
      recommendations.push('Going-in cap rate is below market average - consider negotiating price');
    } else if (capRate > avgCapRate + 1 && avgCapRate > 0) {
      recommendations.push('Going-in cap rate exceeds market average - attractive yield profile');
    }

    if (noiMargin < 35) {
      recommendations.push('NOI margin below 35% indicates operational improvement opportunities');
    } else if (noiMargin > 50) {
      recommendations.push('Strong NOI margin suggests well-managed operations');
    }

    if (recommendations.length === 0) {
      recommendations.push('Metrics align with market benchmarks within normal ranges');
    }

    return {
      projectId,
      projectName: project.marinaName || project.name || 'Unknown',
      region: project.region || undefined,
      state: project.state || undefined,
      benchmarks: {
        pricePerUnit: this.calculateBenchmark(pricePerUnit, pricePerUnits),
        pricePerSlip: this.calculateBenchmark(pricePerUnit, pricePerUnits),
        capRate: this.calculateBenchmark(capRate, capRates),
        noiMargin: this.calculateBenchmark(noiMargin, [30, 35, 40, 45, 50]),
        revenuePerUnit: this.calculateBenchmark(revenuePerUnit, pricePerUnits.map(p => p * 0.08)),
      },
      marketContext: {
        avgMarketPrice,
        avgMarketCapRate: avgCapRate,
        avgPricePerSlip: avgPricePerSlip,
        totalComparables: validComps.length,
        dateRange: 'All Available'
      },
      recommendations,
      generatedAt: new Date().toISOString()
    };
  }

  private calculateBenchmark(projectValue: number, comparables: number[]): BenchmarkMetrics {
    if (comparables.length === 0) {
      return {
        projectValue,
        benchmarkAvg: 0,
        benchmarkMedian: 0,
        percentile: 50,
        sampleSize: 0
      };
    }

    const sorted = [...comparables].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    let percentile = 50;
    if (sorted.length > 0) {
      const belowCount = sorted.filter(v => v < projectValue).length;
      percentile = Math.round((belowCount / sorted.length) * 100);
    }

    return {
      projectValue: Math.round(projectValue * 100) / 100,
      benchmarkAvg: Math.round(avg * 100) / 100,
      benchmarkMedian: Math.round(median * 100) / 100,
      percentile,
      sampleSize: sorted.length
    };
  }

  async getPortfolioRiskMetrics(orgId: string): Promise<any> {
    const projects = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    const byRegion: Record<string, number> = {};
    const byState: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    let totalValue = 0;

    for (const project of projects) {
      const value = parseFloat(project.purchasePrice?.toString() || '0');
      totalValue += value;

      const region = project.region || 'Unknown';
      byRegion[region] = (byRegion[region] || 0) + value;

      const state = project.state || 'Unknown';
      byState[state] = (byState[state] || 0) + value;

      const year = project.createdAt?.getFullYear()?.toString() || 'Unknown';
      byYear[year] = (byYear[year] || 0) + value;
    }

    const regionConcentration = Object.entries(byRegion)
      .map(([region, value]) => ({
        region,
        value,
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    const stateConcentration = Object.entries(byState)
      .map(([state, value]) => ({
        state,
        value,
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    const vintageAnalysis = Object.entries(byYear)
      .map(([year, value]) => ({
        year,
        value,
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0,
        count: projects.filter(p => p.createdAt?.getFullYear()?.toString() === year).length
      }))
      .sort((a, b) => b.year.localeCompare(a.year));

    const topRegion = regionConcentration[0];
    const riskFlags: string[] = [];

    if (topRegion && topRegion.percentage > 50) {
      riskFlags.push(`High geographic concentration: ${topRegion.percentage.toFixed(1)}% in ${topRegion.region}`);
    }

    if (projects.length < 5) {
      riskFlags.push('Limited portfolio diversification: fewer than 5 projects');
    }

    const singleStateExposure = stateConcentration.filter(s => s.percentage > 40);
    if (singleStateExposure.length > 0) {
      riskFlags.push(`State concentration risk: ${singleStateExposure.map(s => `${s.state} (${s.percentage.toFixed(1)}%)`).join(', ')}`);
    }

    return {
      totalProjects: projects.length,
      totalPortfolioValue: totalValue,
      regionConcentration,
      stateConcentration,
      vintageAnalysis,
      riskFlags,
      diversificationScore: this.calculateDiversificationScore(regionConcentration, stateConcentration, projects.length),
      generatedAt: new Date().toISOString()
    };
  }

  private calculateDiversificationScore(
    regions: { percentage: number }[],
    states: { percentage: number }[],
    projectCount: number
  ): number {
    let score = 100;

    const topRegionPct = regions[0]?.percentage || 0;
    if (topRegionPct > 50) score -= 20;
    else if (topRegionPct > 40) score -= 10;

    const topStatePct = states[0]?.percentage || 0;
    if (topStatePct > 50) score -= 15;
    else if (topStatePct > 40) score -= 8;

    if (projectCount < 3) score -= 25;
    else if (projectCount < 5) score -= 15;
    else if (projectCount < 10) score -= 5;

    const uniqueRegions = regions.length;
    if (uniqueRegions < 2) score -= 15;
    else if (uniqueRegions < 3) score -= 5;

    return Math.max(0, Math.min(100, score));
  }
}

export const benchmarkComparisonService = new BenchmarkComparisonService();

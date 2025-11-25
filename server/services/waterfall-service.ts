import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingAuditLog
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface WaterfallTier {
  id: string;
  name: string;
  hurdleRate: number;
  lpSplit: number;
  gpSplit: number;
  catchUp?: number;
  returnOfCapitalFirst?: boolean;
}

export interface WaterfallConfig {
  tiers: WaterfallTier[];
  preferredReturn: number;
  gpCatchUpPercentage: number;
  isEuropean: boolean;
  clawbackProvision: boolean;
  managementFeeRate?: number;
  acquisitionFeeRate?: number;
  dispositionFeeRate?: number;
}

export interface WaterfallInput {
  scenarioVersionId: string;
  totalInvestment: number;
  lpContribution: number;
  gpContribution: number;
  holdingPeriodYears: number;
  annualCashFlows: number[];
  exitProceeds: number;
  config: WaterfallConfig;
}

export interface WaterfallDistribution {
  year: number;
  cashFlow: number;
  returnOfCapital: number;
  preferredReturn: number;
  catchUp: number;
  promoteSplits: Array<{
    tierId: string;
    tierName: string;
    lpAmount: number;
    gpAmount: number;
  }>;
  lpTotal: number;
  gpTotal: number;
  cumulativeLpReturn: number;
  cumulativeGpReturn: number;
  lpIRR: number;
  gpIRR: number;
}

export interface WaterfallResult {
  config: WaterfallConfig;
  distributions: WaterfallDistribution[];
  summary: {
    totalDistributed: number;
    totalLpDistribution: number;
    totalGpDistribution: number;
    lpIRR: number;
    gpIRR: number;
    lpEquityMultiple: number;
    gpEquityMultiple: number;
    lpPreferredPaid: number;
    gpPromotePaid: number;
    effectiveGpPromote: number;
  };
}

export class WaterfallService {
  async calculateWaterfall(
    projectId: string,
    orgId: string,
    userId: string,
    input: WaterfallInput
  ): Promise<WaterfallResult> {
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

    const { config, totalInvestment, lpContribution, gpContribution, annualCashFlows, exitProceeds, holdingPeriodYears } = input;

    let remainingLpCapital = lpContribution;
    let remainingGpCapital = gpContribution;
    let cumulativeLpReturn = 0;
    let cumulativeGpReturn = 0;
    let preferredAccrued = 0;

    const distributions: WaterfallDistribution[] = [];
    const lpCashFlows: number[] = [-lpContribution];
    const gpCashFlows: number[] = [-gpContribution];

    const allCashFlows = [...annualCashFlows];
    if (exitProceeds > 0) {
      allCashFlows[allCashFlows.length - 1] = (allCashFlows[allCashFlows.length - 1] || 0) + exitProceeds;
    }

    for (let year = 1; year <= holdingPeriodYears; year++) {
      const cashFlow = allCashFlows[year - 1] || 0;
      let remainingCashFlow = cashFlow;

      let returnOfCapital = 0;
      let preferredReturn = 0;
      let catchUp = 0;
      const promoteSplits: WaterfallDistribution['promoteSplits'] = [];

      if (config.isEuropean) {
        preferredAccrued += (remainingLpCapital + remainingGpCapital) * (config.preferredReturn / 100);
      }

      if (remainingCashFlow > 0 && (remainingLpCapital > 0 || remainingGpCapital > 0)) {
        const totalRemainingCapital = remainingLpCapital + remainingGpCapital;
        const rocAmount = Math.min(remainingCashFlow, totalRemainingCapital);
        
        const lpRocShare = totalRemainingCapital > 0 ? (remainingLpCapital / totalRemainingCapital) : 0.5;
        const gpRocShare = 1 - lpRocShare;
        
        returnOfCapital = rocAmount;
        const lpRoc = rocAmount * lpRocShare;
        const gpRoc = rocAmount * gpRocShare;
        
        remainingLpCapital -= lpRoc;
        remainingGpCapital -= gpRoc;
        remainingCashFlow -= rocAmount;
        
        cumulativeLpReturn += lpRoc;
        cumulativeGpReturn += gpRoc;
      }

      if (remainingCashFlow > 0) {
        if (config.isEuropean) {
          const prefAmount = Math.min(remainingCashFlow, preferredAccrued);
          preferredReturn = prefAmount;
          preferredAccrued -= prefAmount;
          remainingCashFlow -= prefAmount;
          
          const lpPref = prefAmount * (lpContribution / totalInvestment);
          const gpPref = prefAmount * (gpContribution / totalInvestment);
          cumulativeLpReturn += lpPref;
          cumulativeGpReturn += gpPref;
        } else {
          const requiredPreferred = lpContribution * (config.preferredReturn / 100);
          const prefAmount = Math.min(remainingCashFlow, requiredPreferred);
          preferredReturn = prefAmount;
          remainingCashFlow -= prefAmount;
          cumulativeLpReturn += prefAmount;
        }
      }

      if (remainingCashFlow > 0 && config.gpCatchUpPercentage > 0) {
        const targetGpCatchUp = (preferredReturn / (1 - config.gpCatchUpPercentage)) * config.gpCatchUpPercentage;
        const catchUpAmount = Math.min(remainingCashFlow, targetGpCatchUp);
        catchUp = catchUpAmount;
        remainingCashFlow -= catchUpAmount;
        cumulativeGpReturn += catchUpAmount;
      }

      if (remainingCashFlow > 0) {
        for (const tier of config.tiers) {
          if (remainingCashFlow <= 0) break;
          
          const tierAmount = remainingCashFlow;
          const lpAmount = tierAmount * (tier.lpSplit / 100);
          const gpAmount = tierAmount * (tier.gpSplit / 100);
          
          promoteSplits.push({
            tierId: tier.id,
            tierName: tier.name,
            lpAmount,
            gpAmount
          });
          
          cumulativeLpReturn += lpAmount;
          cumulativeGpReturn += gpAmount;
          remainingCashFlow = 0;
        }
      }

      lpCashFlows.push(cumulativeLpReturn - (lpCashFlows.reduce((a, b) => a + b, 0) + lpContribution));
      gpCashFlows.push(cumulativeGpReturn - (gpCashFlows.reduce((a, b) => a + b, 0) + gpContribution));

      distributions.push({
        year,
        cashFlow,
        returnOfCapital,
        preferredReturn,
        catchUp,
        promoteSplits,
        lpTotal: cumulativeLpReturn - (distributions[year - 2]?.cumulativeLpReturn || 0),
        gpTotal: cumulativeGpReturn - (distributions[year - 2]?.cumulativeGpReturn || 0),
        cumulativeLpReturn,
        cumulativeGpReturn,
        lpIRR: this.calculateIRR(lpCashFlows),
        gpIRR: this.calculateIRR(gpCashFlows)
      });
    }

    const totalDistributed = cumulativeLpReturn + cumulativeGpReturn;
    const lpPreferredPaid = distributions.reduce((sum, d) => sum + d.preferredReturn, 0);
    const gpPromotePaid = distributions.reduce((sum, d) => sum + d.catchUp + d.promoteSplits.reduce((s, p) => s + p.gpAmount, 0), 0);

    const summary = {
      totalDistributed,
      totalLpDistribution: cumulativeLpReturn,
      totalGpDistribution: cumulativeGpReturn,
      lpIRR: this.calculateIRR(lpCashFlows),
      gpIRR: this.calculateIRR(gpCashFlows),
      lpEquityMultiple: cumulativeLpReturn / lpContribution,
      gpEquityMultiple: cumulativeGpReturn / gpContribution,
      lpPreferredPaid,
      gpPromotePaid,
      effectiveGpPromote: (gpPromotePaid / totalDistributed) * 100
    };

    await this.logAuditEvent(projectId, orgId, userId, 'waterfall_calculation', {
      scenarioVersionId: input.scenarioVersionId,
      totalInvestment,
      holdingPeriodYears,
      lpIRR: summary.lpIRR,
      gpIRR: summary.gpIRR
    });

    return {
      config,
      distributions,
      summary
    };
  }

  private calculateIRR(cashFlows: number[]): number {
    if (cashFlows.length < 2) return 0;
    
    let irr = 0.1;
    const maxIterations = 100;
    const tolerance = 0.0001;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivative = 0;

      for (let t = 0; t < cashFlows.length; t++) {
        const discountFactor = Math.pow(1 + irr, t);
        npv += cashFlows[t] / discountFactor;
        if (t > 0) {
          derivative -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
        }
      }

      if (Math.abs(npv) < tolerance) break;
      if (derivative === 0) break;

      irr = irr - npv / derivative;
      
      if (irr < -0.99) irr = -0.99;
      if (irr > 10) irr = 10;
    }

    return irr * 100;
  }

  async getStandardWaterfallConfigs(): Promise<{ id: string; name: string; description: string; config: WaterfallConfig }[]> {
    return [
      {
        id: 'simple-80-20',
        name: 'Simple 80/20 Split',
        description: 'Basic LP/GP split after 8% preferred return',
        config: {
          tiers: [
            { id: 'base', name: 'Base Split', hurdleRate: 0, lpSplit: 80, gpSplit: 20 }
          ],
          preferredReturn: 8,
          gpCatchUpPercentage: 0,
          isEuropean: false,
          clawbackProvision: false
        }
      },
      {
        id: 'institutional-tiered',
        name: 'Institutional Tiered',
        description: 'Multi-tier structure with GP catch-up',
        config: {
          tiers: [
            { id: 'tier1', name: 'Tier 1 (0-12% IRR)', hurdleRate: 12, lpSplit: 80, gpSplit: 20 },
            { id: 'tier2', name: 'Tier 2 (12-18% IRR)', hurdleRate: 18, lpSplit: 70, gpSplit: 30 },
            { id: 'tier3', name: 'Tier 3 (18%+ IRR)', hurdleRate: 100, lpSplit: 60, gpSplit: 40 }
          ],
          preferredReturn: 8,
          gpCatchUpPercentage: 20,
          isEuropean: false,
          clawbackProvision: true
        }
      },
      {
        id: 'european-waterfall',
        name: 'European Waterfall',
        description: 'Full return of capital before profit split',
        config: {
          tiers: [
            { id: 'base', name: 'Profit Split', hurdleRate: 0, lpSplit: 70, gpSplit: 30 }
          ],
          preferredReturn: 8,
          gpCatchUpPercentage: 0,
          isEuropean: true,
          clawbackProvision: true
        }
      },
      {
        id: 'aggressive-promote',
        name: 'Aggressive Promote',
        description: 'Higher GP promote for value-add deals',
        config: {
          tiers: [
            { id: 'tier1', name: 'Tier 1', hurdleRate: 15, lpSplit: 70, gpSplit: 30 },
            { id: 'tier2', name: 'Tier 2', hurdleRate: 20, lpSplit: 60, gpSplit: 40 },
            { id: 'tier3', name: 'Tier 3', hurdleRate: 100, lpSplit: 50, gpSplit: 50 }
          ],
          preferredReturn: 10,
          gpCatchUpPercentage: 50,
          isEuropean: false,
          clawbackProvision: true
        }
      },
      {
        id: 'family-office',
        name: 'Family Office Friendly',
        description: 'Lower promote, no catch-up, simple structure',
        config: {
          tiers: [
            { id: 'base', name: 'Profit Split', hurdleRate: 0, lpSplit: 85, gpSplit: 15 }
          ],
          preferredReturn: 6,
          gpCatchUpPercentage: 0,
          isEuropean: true,
          clawbackProvision: false
        }
      }
    ];
  }

  async compareWaterfallStructures(
    projectId: string,
    orgId: string,
    baseInput: Omit<WaterfallInput, 'config'>,
    configs: WaterfallConfig[]
  ): Promise<{
    configId: number;
    configName: string;
    lpIRR: number;
    gpIRR: number;
    lpMultiple: number;
    gpMultiple: number;
    effectivePromote: number;
  }[]> {
    const results = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const result = await this.calculateWaterfall(projectId, orgId, 'system', {
        ...baseInput,
        config
      });

      results.push({
        configId: i,
        configName: config.tiers[0]?.name || `Structure ${i + 1}`,
        lpIRR: result.summary.lpIRR,
        gpIRR: result.summary.gpIRR,
        lpMultiple: result.summary.lpEquityMultiple,
        gpMultiple: result.summary.gpEquityMultiple,
        effectivePromote: result.summary.effectiveGpPromote
      });
    }

    return results;
  }

  private async logAuditEvent(
    projectId: string,
    orgId: string,
    userId: string,
    eventType: string,
    details: any
  ): Promise<void> {
    await db.insert(modelingAuditLog).values({
      orgId,
      modelingProjectId: projectId,
      eventType,
      entityType: 'waterfall',
      entityId: details.scenarioVersionId,
      newValue: details,
      userId
    });
  }
}

export const waterfallService = new WaterfallService();

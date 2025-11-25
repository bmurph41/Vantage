import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingAuditLog
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface LenderStructure {
  id: string;
  name: string;
  loanAmount: number;
  ltv: number;
  baseRate: number;
  spread: number;
  amortizationYears: number;
  termYears: number;
  interestOnly?: number;
  prepaymentPenalty?: number;
}

export interface DebtSensitivityInput {
  scenarioVersionId: string;
  purchasePrice: number;
  lenderStructures: LenderStructure[];
  rateShifts: number[];
}

export interface DebtServiceResult {
  lenderId: string;
  lenderName: string;
  loanAmount: number;
  ltv: number;
  rate: number;
  monthlyPayment: number;
  annualDebtService: number;
  dscr: number;
  debtYield: number;
  interestExpense: number;
  principalPaydown: number;
}

export interface DebtSensitivityMatrix {
  lenderStructures: LenderStructure[];
  rateShifts: number[];
  baselineNOI: number;
  results: {
    [lenderId: string]: {
      [rateShift: string]: DebtServiceResult;
    };
  };
  summary: {
    minDSCR: number;
    maxDSCR: number;
    averageDSCR: number;
    breakEvenRate: number | null;
    totalDebtCapacity: number;
  };
}

export class DebtSensitivityService {
  async analyzeDebtSensitivity(
    projectId: string,
    orgId: string,
    userId: string,
    input: DebtSensitivityInput
  ): Promise<DebtSensitivityMatrix> {
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
      .where(eq(modelingScenarioVersions.id, input.scenarioVersionId))
      .limit(1);

    if (!scenario) {
      throw new Error('Scenario version not found');
    }

    const assumptions = typeof scenario.assumptions === 'string' 
      ? JSON.parse(scenario.assumptions) 
      : (scenario.assumptions || {});

    const baselineNOI = assumptions.noi || assumptions.netOperatingIncome || (input.purchasePrice * 0.065);

    const results: DebtSensitivityMatrix['results'] = {};
    let allDSCRs: number[] = [];

    for (const lender of input.lenderStructures) {
      results[lender.id] = {};
      
      for (const shift of input.rateShifts) {
        const adjustedRate = lender.baseRate + lender.spread + shift;
        const result = this.calculateDebtService(
          lender,
          adjustedRate,
          baselineNOI
        );
        results[lender.id][shift.toString()] = result;
        allDSCRs.push(result.dscr);
      }
    }

    const summary = this.calculateSummary(allDSCRs, input.lenderStructures, input.rateShifts, baselineNOI, results);

    await this.logAuditEvent(projectId, orgId, userId, 'debt_sensitivity_analysis', {
      scenarioVersionId: input.scenarioVersionId,
      lenderCount: input.lenderStructures.length,
      rateShifts: input.rateShifts,
      minDSCR: summary.minDSCR,
      maxDSCR: summary.maxDSCR
    });

    return {
      lenderStructures: input.lenderStructures,
      rateShifts: input.rateShifts,
      baselineNOI,
      results,
      summary
    };
  }

  private calculateDebtService(
    lender: LenderStructure,
    rate: number,
    noi: number
  ): DebtServiceResult {
    const monthlyRate = rate / 100 / 12;
    const totalPayments = lender.amortizationYears * 12;
    
    let monthlyPayment: number;
    let annualInterest: number;
    let annualPrincipal: number;

    if (lender.interestOnly && lender.interestOnly > 0) {
      monthlyPayment = lender.loanAmount * monthlyRate;
      annualInterest = monthlyPayment * 12;
      annualPrincipal = 0;
    } else {
      if (monthlyRate === 0) {
        monthlyPayment = lender.loanAmount / totalPayments;
      } else {
        monthlyPayment = lender.loanAmount * 
          (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
          (Math.pow(1 + monthlyRate, totalPayments) - 1);
      }
      annualInterest = lender.loanAmount * (rate / 100);
      annualPrincipal = (monthlyPayment * 12) - annualInterest;
    }

    const annualDebtService = monthlyPayment * 12;
    const dscr = noi / annualDebtService;
    const debtYield = (noi / lender.loanAmount) * 100;

    return {
      lenderId: lender.id,
      lenderName: lender.name,
      loanAmount: lender.loanAmount,
      ltv: lender.ltv,
      rate,
      monthlyPayment,
      annualDebtService,
      dscr,
      debtYield,
      interestExpense: annualInterest,
      principalPaydown: Math.max(0, annualPrincipal)
    };
  }

  private calculateSummary(
    allDSCRs: number[],
    lenders: LenderStructure[],
    rateShifts: number[],
    noi: number,
    results: DebtSensitivityMatrix['results']
  ): DebtSensitivityMatrix['summary'] {
    const minDSCR = Math.min(...allDSCRs);
    const maxDSCR = Math.max(...allDSCRs);
    const averageDSCR = allDSCRs.reduce((a, b) => a + b, 0) / allDSCRs.length;

    let breakEvenRate: number | null = null;
    for (const lender of lenders) {
      for (let testRate = 0; testRate <= 20; testRate += 0.25) {
        const result = this.calculateDebtService(lender, testRate, noi);
        if (result.dscr < 1.0) {
          breakEvenRate = testRate - 0.25;
          break;
        }
      }
      if (breakEvenRate) break;
    }

    const totalDebtCapacity = lenders.reduce((sum, l) => sum + l.loanAmount, 0);

    return {
      minDSCR,
      maxDSCR,
      averageDSCR,
      breakEvenRate,
      totalDebtCapacity
    };
  }

  async getStandardLenderStructures(
    purchasePrice: number
  ): Promise<LenderStructure[]> {
    return [
      {
        id: 'senior-bank',
        name: 'Senior Bank Loan',
        loanAmount: purchasePrice * 0.60,
        ltv: 60,
        baseRate: 5.50,
        spread: 2.00,
        amortizationYears: 25,
        termYears: 10,
        interestOnly: 0,
        prepaymentPenalty: 1
      },
      {
        id: 'credit-union',
        name: 'Credit Union',
        loanAmount: purchasePrice * 0.65,
        ltv: 65,
        baseRate: 5.25,
        spread: 1.75,
        amortizationYears: 25,
        termYears: 7,
        interestOnly: 1,
        prepaymentPenalty: 0.5
      },
      {
        id: 'cmbs',
        name: 'CMBS Loan',
        loanAmount: purchasePrice * 0.70,
        ltv: 70,
        baseRate: 6.00,
        spread: 1.50,
        amortizationYears: 30,
        termYears: 10,
        interestOnly: 2,
        prepaymentPenalty: 5
      },
      {
        id: 'bridge',
        name: 'Bridge Loan',
        loanAmount: purchasePrice * 0.75,
        ltv: 75,
        baseRate: 7.50,
        spread: 3.00,
        amortizationYears: 30,
        termYears: 3,
        interestOnly: 3,
        prepaymentPenalty: 2
      },
      {
        id: 'sba',
        name: 'SBA 504 Loan',
        loanAmount: purchasePrice * 0.80,
        ltv: 80,
        baseRate: 5.00,
        spread: 2.75,
        amortizationYears: 25,
        termYears: 25,
        interestOnly: 0,
        prepaymentPenalty: 0
      }
    ];
  }

  async compareMultipleLenders(
    projectId: string,
    orgId: string,
    scenarioVersionId: string,
    purchasePrice: number,
    targetDSCR: number = 1.25
  ): Promise<{
    recommendations: Array<{
      lender: LenderStructure;
      currentRate: number;
      maxRate: number;
      headroom: number;
      recommendation: string;
    }>;
    optimalStructure: LenderStructure | null;
  }> {
    const lenders = await this.getStandardLenderStructures(purchasePrice);
    
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, scenarioVersionId))
      .limit(1);

    const assumptions = scenario?.assumptions as any || {};
    const noi = assumptions.noi || assumptions.netOperatingIncome || (purchasePrice * 0.065);

    const recommendations = lenders.map(lender => {
      const currentRate = lender.baseRate + lender.spread;
      const result = this.calculateDebtService(lender, currentRate, noi);
      
      let maxRate = currentRate;
      for (let testRate = currentRate; testRate <= 15; testRate += 0.25) {
        const testResult = this.calculateDebtService(lender, testRate, noi);
        if (testResult.dscr >= targetDSCR) {
          maxRate = testRate;
        } else {
          break;
        }
      }

      const headroom = maxRate - currentRate;
      
      let recommendation: string;
      if (result.dscr < targetDSCR) {
        recommendation = 'Does not meet minimum DSCR requirements';
      } else if (headroom < 1) {
        recommendation = 'Limited rate headroom - higher risk';
      } else if (headroom < 2) {
        recommendation = 'Moderate rate protection';
      } else {
        recommendation = 'Strong rate protection - recommended';
      }

      return {
        lender,
        currentRate,
        maxRate,
        headroom,
        recommendation
      };
    });

    const optimalStructure = recommendations
      .filter(r => r.headroom >= 2)
      .sort((a, b) => b.lender.ltv - a.lender.ltv)[0]?.lender || null;

    return {
      recommendations,
      optimalStructure
    };
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
      entityType: 'debt_analysis',
      entityId: details.scenarioVersionId,
      newValue: details,
      userId
    });
  }
}

export const debtSensitivityService = new DebtSensitivityService();

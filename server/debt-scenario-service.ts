/**
 * Debt Scenario Calculation Service
 * Handles debt scenario metrics calculations including LTV, DSCR, debt yield, and amortization schedules
 */

export interface DebtScenarioCalculationInputs {
  purchasePrice: number;
  loanAmount: number;
  noi: number; // Net Operating Income
  interestRate: number; // Annual rate as percentage (e.g., 6.75)
  amortizationYears: number;
  loanTermYears: number;
  interestOnlyYears?: number;
}

export interface DebtScenarioMetrics {
  loanToValue: number; // LTV ratio as percentage
  debtServiceCoverageRatio: number; // DSCR
  debtYield: number; // Debt yield as percentage
  cashOnCashReturn: number; // Cash-on-cash return as percentage
  equityRequired: number; // Purchase price - loan amount
  monthlyPayment: number; // Monthly P&I payment
  annualDebtService: number; // Total annual debt service
  firstYearCashFlow: number; // NOI - annual debt service
  monthlyInterestOnlyPayment?: number; // If IO period exists
}

export interface AmortizationScheduleEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
}

export interface SensitivityAnalysis {
  baseCase: DebtScenarioMetrics;
  rateVariations: Array<{
    rate: number;
    metrics: DebtScenarioMetrics;
  }>;
  ltvVariations: Array<{
    ltv: number;
    loanAmount: number;
    metrics: DebtScenarioMetrics;
  }>;
}

class DebtScenarioService {
  /**
   * Calculate monthly payment for a loan
   */
  calculateMonthlyPayment(
    loanAmount: number,
    annualRate: number,
    amortizationYears: number
  ): number {
    if (annualRate === 0) {
      return loanAmount / (amortizationYears * 12);
    }

    const monthlyRate = annualRate / 100 / 12;
    const numPayments = amortizationYears * 12;

    const payment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    return payment;
  }

  /**
   * Calculate interest-only payment
   */
  calculateInterestOnlyPayment(loanAmount: number, annualRate: number): number {
    return (loanAmount * (annualRate / 100)) / 12;
  }

  /**
   * Calculate all debt scenario metrics
   */
  calculateMetrics(inputs: DebtScenarioCalculationInputs): DebtScenarioMetrics {
    const {
      purchasePrice,
      loanAmount,
      noi,
      interestRate,
      amortizationYears,
      interestOnlyYears = 0,
    } = inputs;

    // Calculate monthly payment (after IO period)
    const monthlyPayment = this.calculateMonthlyPayment(
      loanAmount,
      interestRate,
      amortizationYears
    );

    // Calculate IO payment if applicable
    const monthlyInterestOnlyPayment =
      interestOnlyYears > 0
        ? this.calculateInterestOnlyPayment(loanAmount, interestRate)
        : undefined;

    // Annual debt service (blended for first year if IO period exists)
    let annualDebtService: number;
    if (interestOnlyYears > 0 && monthlyInterestOnlyPayment) {
      // If we're in the first year and it's IO, use IO payment
      annualDebtService = monthlyInterestOnlyPayment * 12;
    } else {
      annualDebtService = monthlyPayment * 12;
    }

    // Loan to Value (LTV)
    const loanToValue = (loanAmount / purchasePrice) * 100;

    // Debt Service Coverage Ratio (DSCR)
    const debtServiceCoverageRatio = noi / annualDebtService;

    // Debt Yield
    const debtYield = (noi / loanAmount) * 100;

    // Equity Required
    const equityRequired = purchasePrice - loanAmount;

    // First year cash flow
    const firstYearCashFlow = noi - annualDebtService;

    // Cash on Cash Return
    const cashOnCashReturn =
      equityRequired > 0 ? (firstYearCashFlow / equityRequired) * 100 : 0;

    return {
      loanToValue: parseFloat(loanToValue.toFixed(2)),
      debtServiceCoverageRatio: parseFloat(debtServiceCoverageRatio.toFixed(2)),
      debtYield: parseFloat(debtYield.toFixed(2)),
      cashOnCashReturn: parseFloat(cashOnCashReturn.toFixed(2)),
      equityRequired: parseFloat(equityRequired.toFixed(2)),
      monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
      annualDebtService: parseFloat(annualDebtService.toFixed(2)),
      firstYearCashFlow: parseFloat(firstYearCashFlow.toFixed(2)),
      monthlyInterestOnlyPayment: monthlyInterestOnlyPayment
        ? parseFloat(monthlyInterestOnlyPayment.toFixed(2))
        : undefined,
    };
  }

  /**
   * Generate full amortization schedule
   */
  generateAmortizationSchedule(
    loanAmount: number,
    annualRate: number,
    amortizationYears: number,
    interestOnlyMonths: number = 0
  ): AmortizationScheduleEntry[] {
    const schedule: AmortizationScheduleEntry[] = [];
    let balance = loanAmount;
    let cumulativePrincipal = 0;
    let cumulativeInterest = 0;

    const monthlyRate = annualRate / 100 / 12;
    const totalMonths = amortizationYears * 12;

    // Calculate the amortizing payment (used after IO period)
    const amortizingPayment = this.calculateMonthlyPayment(
      loanAmount,
      annualRate,
      amortizationYears
    );

    for (let month = 1; month <= totalMonths; month++) {
      const interest = balance * monthlyRate;

      let payment: number;
      let principal: number;

      if (month <= interestOnlyMonths) {
        // Interest-only period
        payment = interest;
        principal = 0;
      } else {
        // Amortizing period
        payment = amortizingPayment;
        principal = payment - interest;
        balance -= principal;
      }

      cumulativePrincipal += principal;
      cumulativeInterest += interest;

      schedule.push({
        month,
        payment: parseFloat(payment.toFixed(2)),
        principal: parseFloat(principal.toFixed(2)),
        interest: parseFloat(interest.toFixed(2)),
        balance: parseFloat(Math.max(0, balance).toFixed(2)),
        cumulativePrincipal: parseFloat(cumulativePrincipal.toFixed(2)),
        cumulativeInterest: parseFloat(cumulativeInterest.toFixed(2)),
      });

      // Break if balance is paid off (rounding protection)
      if (balance <= 0.01) break;
    }

    return schedule;
  }

  /**
   * Run sensitivity analysis on interest rates
   */
  runRateSensitivity(
    inputs: DebtScenarioCalculationInputs,
    rateSteps: number[] = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1]
  ): SensitivityAnalysis['rateVariations'] {
    const baseRate = inputs.interestRate;

    return rateSteps.map((step) => {
      const adjustedRate = baseRate + step;
      const adjustedInputs = { ...inputs, interestRate: adjustedRate };
      const metrics = this.calculateMetrics(adjustedInputs);

      return {
        rate: parseFloat(adjustedRate.toFixed(2)),
        metrics,
      };
    });
  }

  /**
   * Run sensitivity analysis on LTV ratios
   */
  runLTVSensitivity(
    inputs: DebtScenarioCalculationInputs,
    ltvTargets: number[] = [50, 55, 60, 65, 70, 75, 80]
  ): SensitivityAnalysis['ltvVariations'] {
    const { purchasePrice } = inputs;

    return ltvTargets.map((ltv) => {
      const loanAmount = purchasePrice * (ltv / 100);
      const adjustedInputs = { ...inputs, loanAmount };
      const metrics = this.calculateMetrics(adjustedInputs);

      return {
        ltv,
        loanAmount: parseFloat(loanAmount.toFixed(2)),
        metrics,
      };
    });
  }

  /**
   * Run complete sensitivity analysis
   */
  runSensitivityAnalysis(
    inputs: DebtScenarioCalculationInputs
  ): SensitivityAnalysis {
    const baseCase = this.calculateMetrics(inputs);
    const rateVariations = this.runRateSensitivity(inputs);
    const ltvVariations = this.runLTVSensitivity(inputs);

    return {
      baseCase,
      rateVariations,
      ltvVariations,
    };
  }

  /**
   * Check covenant compliance
   * Common lender covenants: minimum DSCR, maximum LTV, minimum debt yield
   */
  checkCovenantCompliance(
    metrics: DebtScenarioMetrics,
    covenants: {
      minDSCR?: number;
      maxLTV?: number;
      minDebtYield?: number;
    }
  ): {
    isCompliant: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    if (covenants.minDSCR && metrics.debtServiceCoverageRatio < covenants.minDSCR) {
      violations.push(
        `DSCR ${metrics.debtServiceCoverageRatio.toFixed(2)} below minimum ${covenants.minDSCR.toFixed(2)}`
      );
    }

    if (covenants.maxLTV && metrics.loanToValue > covenants.maxLTV) {
      violations.push(
        `LTV ${metrics.loanToValue.toFixed(2)}% exceeds maximum ${covenants.maxLTV.toFixed(2)}%`
      );
    }

    if (covenants.minDebtYield && metrics.debtYield < covenants.minDebtYield) {
      violations.push(
        `Debt Yield ${metrics.debtYield.toFixed(2)}% below minimum ${covenants.minDebtYield.toFixed(2)}%`
      );
    }

    return {
      isCompliant: violations.length === 0,
      violations,
    };
  }
}

// Export singleton instance
export const debtScenarioService = new DebtScenarioService();

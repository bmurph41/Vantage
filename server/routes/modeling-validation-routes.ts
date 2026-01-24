import { Router } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { modelingScenarioVersions, modelingProjectConfig } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

router.get('/projects/:projectId/sensitivity-analysis', async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { projectId } = req.params;
    const { variancePercent = '10' } = req.query;
    
    const project = await storage.getModelingProject(projectId, orgId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [projectConfig] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, 'base'),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);
    
    const variance = parseFloat(variancePercent as string) / 100;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '10000000');
    const capRate = parseFloat(project.year1CapRate?.toString() || '6.5') / 100;
    const ebitda = parseFloat(project.ebitda?.toString() || '650000');
    const revenue = parseFloat(project.effectiveGrossRevenue?.toString() || '1500000');
    const expenses = parseFloat(project.operatingExpenses?.toString() || '600000');
    const holdPeriod = projectConfig?.holdPeriod || 5;
    const exitCapRate = parseFloat(scenario?.exitCapRate?.toString() || String((capRate * 100) + 0.5)) / 100;
    const revenueGrowth = parseFloat(scenario?.revenueGrowthRate?.toString() || '3') / 100;
    const expenseGrowth = parseFloat(scenario?.expenseGrowthRate?.toString() || '2.5') / 100;
    
    const baseNOI = revenue - expenses;
    
    const calculateIRR = (
      purchasePriceVal: number,
      baseNoiVal: number,
      revGrowth: number,
      expGrowth: number,
      exitCap: number,
      years: number
    ): number => {
      const cashFlows: number[] = [-purchasePriceVal];
      let currentRevenue = revenue;
      let currentExpenses = expenses;
      
      for (let year = 1; year <= years; year++) {
        currentRevenue *= (1 + revGrowth);
        currentExpenses *= (1 + expGrowth);
        const yearNoi = currentRevenue - currentExpenses;
        
        if (year === years) {
          const exitValue = yearNoi / exitCap;
          cashFlows.push(yearNoi + exitValue);
        } else {
          cashFlows.push(yearNoi);
        }
      }
      
      let rate = 0.1;
      for (let i = 0; i < 100; i++) {
        let npv = 0;
        let dnpv = 0;
        for (let j = 0; j < cashFlows.length; j++) {
          npv += cashFlows[j] / Math.pow(1 + rate, j);
          dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
        }
        if (Math.abs(dnpv) < 0.00001) break;
        const newRate = rate - npv / dnpv;
        if (Math.abs(newRate - rate) < 0.00001) break;
        rate = newRate;
      }
      
      return Math.round(rate * 10000) / 100;
    };
    
    const calculateEquityMultiple = (
      purchasePriceVal: number,
      baseNoiVal: number,
      revGrowth: number,
      expGrowth: number,
      exitCap: number,
      years: number
    ): number => {
      let totalCashFlow = 0;
      let currentRevenue = revenue;
      let currentExpenses = expenses;
      
      for (let year = 1; year <= years; year++) {
        currentRevenue *= (1 + revGrowth);
        currentExpenses *= (1 + expGrowth);
        const yearNoi = currentRevenue - currentExpenses;
        
        if (year === years) {
          const exitValue = yearNoi / exitCap;
          totalCashFlow += yearNoi + exitValue;
        } else {
          totalCashFlow += yearNoi;
        }
      }
      
      return purchasePriceVal > 0 ? Math.round((totalCashFlow / purchasePriceVal) * 100) / 100 : 0;
    };
    
    const baseIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, exitCapRate, holdPeriod);
    const baseEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, exitCapRate, holdPeriod);
    const baseValuation = baseNOI / capRate;
    
    const variables = [
      {
        id: 'cap_rate',
        name: 'Going-In Cap Rate',
        baseValue: capRate * 100,
        unit: '%',
        category: 'valuation'
      },
      {
        id: 'noi',
        name: 'Net Operating Income',
        baseValue: baseNOI,
        unit: 'currency',
        category: 'cash_flow'
      },
      {
        id: 'revenue',
        name: 'Effective Gross Revenue',
        baseValue: revenue,
        unit: 'currency',
        category: 'cash_flow'
      },
      {
        id: 'expenses',
        name: 'Operating Expenses',
        baseValue: expenses,
        unit: 'currency',
        category: 'cash_flow'
      },
      {
        id: 'exit_cap',
        name: 'Exit Cap Rate',
        baseValue: exitCapRate * 100,
        unit: '%',
        category: 'valuation'
      },
      {
        id: 'revenue_growth',
        name: 'Revenue Growth Rate',
        baseValue: revenueGrowth * 100,
        unit: '%',
        category: 'growth'
      },
      {
        id: 'expense_growth',
        name: 'Expense Growth Rate',
        baseValue: expenseGrowth * 100,
        unit: '%',
        category: 'growth'
      }
    ];
    
    const sensitivityData = variables.map(variable => {
      let lowIRR: number, highIRR: number;
      let lowEquityMultiple: number, highEquityMultiple: number;
      let lowValuation: number, highValuation: number;
      
      const lowMultiplier = 1 - variance;
      const highMultiplier = 1 + variance;
      
      switch (variable.id) {
        case 'cap_rate':
          const lowCap = capRate * lowMultiplier;
          const highCap = capRate * highMultiplier;
          lowValuation = baseNOI / lowCap;
          highValuation = baseNOI / highCap;
          lowIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, exitCapRate, holdPeriod);
          highIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, exitCapRate, holdPeriod);
          lowEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, exitCapRate, holdPeriod);
          highEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, exitCapRate, holdPeriod);
          break;
        case 'noi':
          const lowNoi = baseNOI * lowMultiplier;
          const highNoi = baseNOI * highMultiplier;
          lowValuation = lowNoi / capRate;
          highValuation = highNoi / capRate;
          lowIRR = baseIRR * lowMultiplier;
          highIRR = baseIRR * highMultiplier;
          lowEquityMultiple = baseEquityMultiple * lowMultiplier;
          highEquityMultiple = baseEquityMultiple * highMultiplier;
          break;
        case 'revenue':
          const lowRev = revenue * lowMultiplier;
          const highRev = revenue * highMultiplier;
          const lowNoiFromRev = lowRev - expenses;
          const highNoiFromRev = highRev - expenses;
          lowValuation = lowNoiFromRev / capRate;
          highValuation = highNoiFromRev / capRate;
          lowIRR = baseIRR * (lowNoiFromRev / baseNOI);
          highIRR = baseIRR * (highNoiFromRev / baseNOI);
          lowEquityMultiple = baseEquityMultiple * (lowNoiFromRev / baseNOI);
          highEquityMultiple = baseEquityMultiple * (highNoiFromRev / baseNOI);
          break;
        case 'expenses':
          const lowExp = expenses * lowMultiplier;
          const highExp = expenses * highMultiplier;
          const lowNoiFromExp = revenue - highExp;
          const highNoiFromExp = revenue - lowExp;
          lowValuation = lowNoiFromExp / capRate;
          highValuation = highNoiFromExp / capRate;
          lowIRR = baseIRR * (lowNoiFromExp / baseNOI);
          highIRR = baseIRR * (highNoiFromExp / baseNOI);
          lowEquityMultiple = baseEquityMultiple * (lowNoiFromExp / baseNOI);
          highEquityMultiple = baseEquityMultiple * (highNoiFromExp / baseNOI);
          break;
        case 'exit_cap':
          const lowExitCap = exitCapRate * lowMultiplier;
          const highExitCap = exitCapRate * highMultiplier;
          lowIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, lowExitCap, holdPeriod);
          highIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, highExitCap, holdPeriod);
          lowEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, lowExitCap, holdPeriod);
          highEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, expenseGrowth, highExitCap, holdPeriod);
          lowValuation = baseValuation;
          highValuation = baseValuation;
          break;
        case 'revenue_growth':
          const lowRevGrowth = revenueGrowth * lowMultiplier;
          const highRevGrowth = revenueGrowth * highMultiplier;
          lowIRR = calculateIRR(purchasePrice, baseNOI, lowRevGrowth, expenseGrowth, exitCapRate, holdPeriod);
          highIRR = calculateIRR(purchasePrice, baseNOI, highRevGrowth, expenseGrowth, exitCapRate, holdPeriod);
          lowEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, lowRevGrowth, expenseGrowth, exitCapRate, holdPeriod);
          highEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, highRevGrowth, expenseGrowth, exitCapRate, holdPeriod);
          lowValuation = baseValuation;
          highValuation = baseValuation;
          break;
        case 'expense_growth':
          const lowExpGrowth = expenseGrowth * lowMultiplier;
          const highExpGrowth = expenseGrowth * highMultiplier;
          lowIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, highExpGrowth, exitCapRate, holdPeriod);
          highIRR = calculateIRR(purchasePrice, baseNOI, revenueGrowth, lowExpGrowth, exitCapRate, holdPeriod);
          lowEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, highExpGrowth, exitCapRate, holdPeriod);
          highEquityMultiple = calculateEquityMultiple(purchasePrice, baseNOI, revenueGrowth, lowExpGrowth, exitCapRate, holdPeriod);
          lowValuation = baseValuation;
          highValuation = baseValuation;
          break;
        default:
          lowIRR = baseIRR * lowMultiplier;
          highIRR = baseIRR * highMultiplier;
          lowEquityMultiple = baseEquityMultiple * lowMultiplier;
          highEquityMultiple = baseEquityMultiple * highMultiplier;
          lowValuation = baseValuation * lowMultiplier;
          highValuation = baseValuation * highMultiplier;
      }
      
      const formatValue = (val: number, unit: string) => {
        if (unit === 'currency') return `$${(val / 1000000).toFixed(2)}M`;
        return `${val.toFixed(1)}%`;
      };
      
      const lowValue = variable.baseValue * lowMultiplier;
      const highValue = variable.baseValue * highMultiplier;
      
      return {
        variable: variable.name,
        variableId: variable.id,
        category: variable.category,
        baseValue: variable.baseValue,
        unit: variable.unit,
        lowValue,
        highValue,
        lowLabel: formatValue(lowValue, variable.unit),
        highLabel: formatValue(highValue, variable.unit),
        metrics: {
          irr: {
            base: baseIRR,
            low: lowIRR,
            high: highIRR,
            lowImpact: lowIRR - baseIRR,
            highImpact: highIRR - baseIRR,
            totalRange: Math.abs(highIRR - lowIRR)
          },
          equityMultiple: {
            base: baseEquityMultiple,
            low: lowEquityMultiple,
            high: highEquityMultiple,
            lowImpact: lowEquityMultiple - baseEquityMultiple,
            highImpact: highEquityMultiple - baseEquityMultiple,
            totalRange: Math.abs(highEquityMultiple - lowEquityMultiple)
          },
          valuation: {
            base: baseValuation,
            low: lowValuation,
            high: highValuation,
            lowImpact: lowValuation - baseValuation,
            highImpact: highValuation - baseValuation,
            totalRange: Math.abs(highValuation - lowValuation)
          }
        }
      };
    });
    
    const sortedByIRRImpact = [...sensitivityData].sort(
      (a, b) => b.metrics.irr.totalRange - a.metrics.irr.totalRange
    );
    
    res.json({
      projectId,
      variancePercent: variance * 100,
      baseMetrics: {
        purchasePrice,
        noi: baseNOI,
        capRate: capRate * 100,
        irr: baseIRR,
        equityMultiple: baseEquityMultiple,
        valuation: baseValuation,
        exitCapRate: exitCapRate * 100,
        holdPeriod
      },
      variables: sortedByIRRImpact,
      keyDrivers: sortedByIRRImpact.slice(0, 3).map(v => ({
        variable: v.variable,
        irrImpactRange: v.metrics.irr.totalRange,
        valuationImpactRange: v.metrics.valuation.totalRange
      }))
    });
  } catch (error: any) {
    console.error('Failed to generate sensitivity analysis:', error);
    res.status(500).json({ error: 'Failed to generate sensitivity analysis' });
  }
});

router.get('/projects/:projectId/sensitivity-tornado', async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { projectId } = req.params;
    const { metric = 'irr', varianceRange = '10' } = req.query;
    
    const project = await storage.getModelingProject(projectId, orgId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const variance = parseFloat(varianceRange as string) / 100;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '10000000');
    const capRate = parseFloat(project.year1CapRate?.toString() || '6.5');
    const ebitda = parseFloat(project.ebitda?.toString() || '650000');
    const revenue = parseFloat(project.effectiveGrossRevenue?.toString() || '1500000');
    const expenses = parseFloat(project.operatingExpenses?.toString() || '600000');
    
    const baseNOI = revenue - expenses > 0 ? revenue - expenses : ebitda * 0.85;
    const baseIRR = 18.5;
    const baseEquityMultiple = 2.1;
    const baseValuation = purchasePrice;
    
    let baseMetricValue: number;
    switch (metric) {
      case 'irr': baseMetricValue = baseIRR; break;
      case 'equity_multiple': baseMetricValue = baseEquityMultiple; break;
      case 'noi': baseMetricValue = baseNOI; break;
      case 'valuation':
      case 'npv':
      default: baseMetricValue = baseValuation; break;
    }
    
    const variables = [
      { 
        id: 'cap_rate', 
        name: 'Going-In Cap Rate', 
        baseValue: capRate, 
        unit: '%', 
        lowImpactFactor: metric === 'valuation' ? 0.11 : 0.08, 
        highImpactFactor: metric === 'valuation' ? -0.09 : -0.075 
      },
      { 
        id: 'noi', 
        name: 'Net Operating Income', 
        baseValue: baseNOI / 1000000, 
        unit: 'M', 
        lowImpactFactor: -0.10, 
        highImpactFactor: 0.10 
      },
      { 
        id: 'revenue', 
        name: 'Effective Gross Revenue', 
        baseValue: revenue / 1000000, 
        unit: 'M', 
        lowImpactFactor: -0.065, 
        highImpactFactor: 0.065 
      },
      { 
        id: 'expenses', 
        name: 'Operating Expenses', 
        baseValue: expenses / 1000000, 
        unit: 'M', 
        lowImpactFactor: 0.035, 
        highImpactFactor: -0.035 
      },
      { 
        id: 'exit_cap', 
        name: 'Exit Cap Rate', 
        baseValue: capRate + 0.5, 
        unit: '%', 
        lowImpactFactor: 0.065, 
        highImpactFactor: -0.06 
      },
      { 
        id: 'revenue_growth', 
        name: 'Revenue Growth Rate', 
        baseValue: 3.0, 
        unit: '%', 
        lowImpactFactor: -0.05, 
        highImpactFactor: 0.055 
      },
      { 
        id: 'expense_growth', 
        name: 'Expense Growth Rate', 
        baseValue: 2.5, 
        unit: '%', 
        lowImpactFactor: 0.03, 
        highImpactFactor: -0.025 
      },
    ];
    
    const tornadoData = variables.map(variable => {
      const lowValue = variable.baseValue * (1 - variance);
      const highValue = variable.baseValue * (1 + variance);
      const lowImpact = baseMetricValue * variable.lowImpactFactor;
      const highImpact = baseMetricValue * variable.highImpactFactor;
      
      const formatVal = (val: number, unit: string) => {
        if (unit === 'M') return `$${val.toFixed(2)}M`;
        return `${val.toFixed(1)}${unit}`;
      };
      
      return {
        variable: variable.name,
        variableId: variable.id,
        baseValue: variable.baseValue,
        lowValue,
        highValue,
        lowImpact,
        highImpact,
        lowLabel: formatVal(lowValue, variable.unit),
        highLabel: formatVal(highValue, variable.unit),
        totalRange: Math.abs(highImpact - lowImpact),
        unit: variable.unit,
      };
    }).sort((a, b) => b.totalRange - a.totalRange);
    
    res.json(tornadoData);
  } catch (error: any) {
    console.error('Failed to generate sensitivity tornado:', error);
    res.status(500).json({ error: 'Failed to generate sensitivity tornado' });
  }
});

router.get('/projects/:projectId/validate', async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { projectId } = req.params;
    
    const project = await storage.getModelingProject(projectId, orgId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [projectConfig] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const scenarios = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ));
    
    const warnings: any[] = [];
    let score = 100;
    
    const capRate = parseFloat(project.year1CapRate?.toString() || '0');
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    const ebitda = parseFloat(project.ebitda?.toString() || '0');
    const revenue = parseFloat(project.effectiveGrossRevenue?.toString() || '0');
    const expenses = parseFloat(project.operatingExpenses?.toString() || '0');
    const holdPeriod = projectConfig?.holdPeriod || 0;
    
    if (!project.purchasePrice) {
      warnings.push({
        id: 'missing_purchase_price',
        severity: 'critical',
        category: 'inputs',
        title: 'Missing Purchase Price',
        message: 'Purchase price is required for accurate valuation analysis.',
        recommendation: 'Enter the expected or asking purchase price to enable full analysis.',
        field: 'purchasePrice'
      });
      score -= 20;
    }
    
    if (!project.year1CapRate) {
      warnings.push({
        id: 'missing_cap_rate',
        severity: 'critical',
        category: 'inputs',
        title: 'Missing Cap Rate',
        message: 'Going-in cap rate is required for valuation metrics.',
        recommendation: 'Enter the cap rate based on NOI and purchase price.',
        field: 'year1CapRate'
      });
      score -= 15;
    }
    
    if (!project.ebitda && !project.effectiveGrossRevenue) {
      warnings.push({
        id: 'missing_financial_data',
        severity: 'critical',
        category: 'inputs',
        title: 'Missing Financial Data',
        message: 'Either EBITDA or revenue/expense data is required.',
        recommendation: 'Upload P&L statements or manually enter EBITDA/revenue figures.',
        field: 'ebitda'
      });
      score -= 20;
    }
    
    if (!project.totalStorageUnits) {
      warnings.push({
        id: 'missing_units',
        severity: 'info',
        category: 'inputs',
        title: 'Missing Total Storage Units',
        message: 'Total storage units count is not specified.',
        recommendation: 'Enter total unit count to enable per-unit metrics and benchmarking.',
        field: 'totalStorageUnits'
      });
      score -= 5;
    }
    
    if (capRate > 0) {
      if (capRate < 3) {
        warnings.push({
          id: 'cap_rate_low',
          severity: 'critical',
          category: 'cap_rate',
          title: 'Cap Rate Unusually Low',
          message: `The going-in cap rate of ${capRate.toFixed(2)}% is below 3%, which is unusually low for marina properties.`,
          recommendation: 'Verify market data and consider if this reflects a premium location or potential data error.',
          value: `${capRate.toFixed(2)}%`,
          threshold: '3% - 15%',
          field: 'year1CapRate'
        });
        score -= 25;
      } else if (capRate < 5) {
        warnings.push({
          id: 'cap_rate_below_market',
          severity: 'warning',
          category: 'cap_rate',
          title: 'Cap Rate Below Market Average',
          message: `The going-in cap rate of ${capRate.toFixed(2)}% is below the typical range for marina properties (5.5% - 8.5%).`,
          recommendation: 'Consider verifying comp data and market conditions. A lower cap rate may be justified for premium locations.',
          value: `${capRate.toFixed(2)}%`,
          threshold: '5.5% - 8.5%',
          field: 'year1CapRate'
        });
        score -= 10;
      } else if (capRate > 15) {
        warnings.push({
          id: 'cap_rate_high',
          severity: 'critical',
          category: 'cap_rate',
          title: 'Cap Rate Unusually High',
          message: `The going-in cap rate of ${capRate.toFixed(2)}% is above 15%, which may indicate distressed asset or data error.`,
          recommendation: 'Review property condition and market factors that might justify this high cap rate.',
          value: `${capRate.toFixed(2)}%`,
          threshold: '3% - 15%',
          field: 'year1CapRate'
        });
        score -= 20;
      }
    }
    
    if (revenue > 0 && expenses > 0) {
      if (expenses >= revenue) {
        warnings.push({
          id: 'expenses_exceed_revenue',
          severity: 'critical',
          category: 'cash_flow',
          title: 'Operating Expenses Exceed Revenue',
          message: `Operating expenses ($${(expenses/1000000).toFixed(2)}M) are equal to or greater than revenue ($${(revenue/1000000).toFixed(2)}M), resulting in negative NOI.`,
          recommendation: 'Verify expense and revenue figures. This scenario indicates a loss-making operation.',
          value: `Expenses: $${(expenses/1000000).toFixed(2)}M`,
          threshold: `Revenue: $${(revenue/1000000).toFixed(2)}M`,
          field: 'operatingExpenses'
        });
        score -= 30;
      } else {
        const expenseRatio = (expenses / revenue) * 100;
        if (expenseRatio > 70) {
          warnings.push({
            id: 'high_expense_ratio',
            severity: 'warning',
            category: 'expense_ratio',
            title: 'High Expense Ratio',
            message: `Operating expense ratio of ${expenseRatio.toFixed(1)}% is above the industry benchmark of 40-55%.`,
            recommendation: 'Review expense line items for potential optimization or verify figures are accurate.',
            value: `${expenseRatio.toFixed(1)}%`,
            threshold: '40% - 55%',
            field: 'operatingExpenses'
          });
          score -= 8;
        }
      }
    }
    
    if (purchasePrice > 0 && ebitda > 0) {
      const impliedMultiple = purchasePrice / ebitda;
      if (impliedMultiple > 20) {
        warnings.push({
          id: 'high_multiple',
          severity: 'warning',
          category: 'cash_flow',
          title: 'High EBITDA Multiple',
          message: `The implied EBITDA multiple of ${impliedMultiple.toFixed(1)}x is above typical marina valuations.`,
          recommendation: 'Verify growth assumptions justify premium valuation or review EBITDA calculations.',
          value: `${impliedMultiple.toFixed(1)}x`,
          threshold: '8x - 15x typical',
          field: 'purchasePrice'
        });
        score -= 8;
      } else if (impliedMultiple < 4) {
        warnings.push({
          id: 'low_multiple',
          severity: 'info',
          category: 'cash_flow',
          title: 'Low EBITDA Multiple',
          message: `The implied EBITDA multiple of ${impliedMultiple.toFixed(1)}x is below typical valuations, which may indicate distress or upside opportunity.`,
          recommendation: 'Investigate reasons for low valuation - could be deferred maintenance, market conditions, or value-add opportunity.',
          value: `${impliedMultiple.toFixed(1)}x`,
          threshold: '8x - 15x typical',
          field: 'purchasePrice'
        });
        score -= 3;
      }
    }
    
    if (!holdPeriod || holdPeriod === 0) {
      warnings.push({
        id: 'missing_hold_period',
        severity: 'warning',
        category: 'inputs',
        title: 'Hold Period Not Set',
        message: 'Investment hold period is not configured.',
        recommendation: 'Set hold period in project settings to enable accurate IRR and exit calculations.',
        field: 'holdPeriod'
      });
      score -= 5;
    } else if (holdPeriod > 15) {
      warnings.push({
        id: 'long_hold_period',
        severity: 'info',
        category: 'inputs',
        title: 'Unusually Long Hold Period',
        message: `Hold period of ${holdPeriod} years exceeds typical investment horizon.`,
        recommendation: 'Verify this is intentional. Long hold periods increase forecast uncertainty.',
        value: `${holdPeriod} years`,
        threshold: '5-10 years typical',
        field: 'holdPeriod'
      });
      score -= 3;
    }
    
    if (scenarios.length === 0) {
      warnings.push({
        id: 'no_scenarios',
        severity: 'warning',
        category: 'projections',
        title: 'No Scenario Versions',
        message: 'No base, upside, or downside scenarios have been configured.',
        recommendation: 'Create scenario versions to enable proper analysis and comparison.',
        field: 'scenarios'
      });
      score -= 10;
    } else {
      const hasBase = scenarios.some(s => s.scenarioType === 'base');
      const hasUpside = scenarios.some(s => s.scenarioType === 'upside');
      const hasDownside = scenarios.some(s => s.scenarioType === 'downside');
      
      if (!hasBase) {
        warnings.push({
          id: 'missing_base_scenario',
          severity: 'warning',
          category: 'projections',
          title: 'Missing Base Scenario',
          message: 'No base case scenario has been configured.',
          recommendation: 'Create a base case scenario with expected assumptions.',
          field: 'scenarios'
        });
        score -= 8;
      }
      
      if (!hasUpside && !hasDownside) {
        warnings.push({
          id: 'missing_sensitivity_scenarios',
          severity: 'info',
          category: 'projections',
          title: 'Missing Upside/Downside Scenarios',
          message: 'Consider adding upside and downside scenarios for risk analysis.',
          recommendation: 'Create alternative scenarios to stress-test your assumptions.',
          field: 'scenarios'
        });
        score -= 5;
      }
    }
    
    for (const scenario of scenarios) {
      const revenueGrowth = parseFloat(scenario.revenueGrowthRate?.toString() || '0');
      const expenseGrowth = parseFloat(scenario.expenseGrowthRate?.toString() || '0');
      const exitCapRate = parseFloat(scenario.exitCapRate?.toString() || '0');
      
      if (revenueGrowth > 10) {
        warnings.push({
          id: `high_rev_growth_${scenario.scenarioType}`,
          severity: 'warning',
          category: 'projections',
          title: `High Revenue Growth (${scenario.scenarioType})`,
          message: `Revenue growth of ${revenueGrowth.toFixed(1)}% in ${scenario.scenarioType} scenario exceeds typical market growth.`,
          recommendation: 'Document specific drivers that support above-market growth assumptions.',
          value: `${revenueGrowth.toFixed(1)}%`,
          threshold: '2% - 5% typical',
          field: 'revenueGrowthRate'
        });
        score -= 5;
      }
      
      if (exitCapRate > 0 && capRate > 0) {
        const capSpread = exitCapRate - capRate;
        if (capSpread < 0) {
          warnings.push({
            id: `exit_cap_compression_${scenario.scenarioType}`,
            severity: 'warning',
            category: 'projections',
            title: `Cap Rate Compression (${scenario.scenarioType})`,
            message: `Exit cap rate (${exitCapRate.toFixed(2)}%) is lower than entry cap (${capRate.toFixed(2)}%), indicating expected value appreciation.`,
            recommendation: 'Validate cap compression assumption against market outlook.',
            value: `${capSpread.toFixed(2)}% spread`,
            field: 'exitCapRate'
          });
          score -= 3;
        }
      }
    }
    
    score = Math.max(0, Math.min(100, score));
    
    res.json({
      projectId,
      isValid: warnings.filter(w => w.severity === 'critical').length === 0,
      score,
      warnings,
      summary: {
        critical: warnings.filter(w => w.severity === 'critical').length,
        warning: warnings.filter(w => w.severity === 'warning').length,
        info: warnings.filter(w => w.severity === 'info').length
      },
      completeness: {
        hasBasicInputs: !!project.purchasePrice && !!project.year1CapRate,
        hasFinancialData: !!project.ebitda || (!!project.effectiveGrossRevenue && !!project.operatingExpenses),
        hasScenarios: scenarios.length > 0,
        hasPropertyDetails: !!project.totalStorageUnits && !!project.marinaName
      }
    });
  } catch (error: any) {
    console.error('Failed to validate modeling project:', error);
    res.status(500).json({ error: 'Failed to validate modeling project' });
  }
});

router.get('/projects/:projectId/scenario-comparison', async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { projectId } = req.params;
    
    const project = await storage.getModelingProject(projectId, orgId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [projectConfig] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const scenarios = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ));
    
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '10000000');
    const capRate = parseFloat(project.year1CapRate?.toString() || '6.5') / 100;
    const ebitda = parseFloat(project.ebitda?.toString() || '650000');
    const revenue = parseFloat(project.effectiveGrossRevenue?.toString() || '1500000');
    const expenses = parseFloat(project.operatingExpenses?.toString() || '600000');
    const holdPeriod = projectConfig?.holdPeriod || 5;
    
    const baseNOI = revenue > 0 && expenses > 0 ? revenue - expenses : ebitda * 0.85;
    
    const calculateScenarioMetrics = (
      scenarioType: string,
      revenueGrowth: number,
      expenseGrowth: number,
      exitCapRate: number
    ) => {
      let projectedRevenue = revenue;
      let projectedExpenses = expenses;
      let totalNOI = 0;
      const yearlyData = [];
      
      for (let year = 1; year <= holdPeriod; year++) {
        projectedRevenue *= (1 + revenueGrowth);
        projectedExpenses *= (1 + expenseGrowth);
        const yearNOI = projectedRevenue - projectedExpenses;
        totalNOI += yearNOI;
        
        yearlyData.push({
          year,
          revenue: Math.round(projectedRevenue),
          expenses: Math.round(projectedExpenses),
          noi: Math.round(yearNOI),
          occupancy: 92 + (year * 0.5) + (scenarioType === 'upside' ? 2 : scenarioType === 'downside' ? -2 : 0)
        });
      }
      
      const exitNOI = projectedRevenue - projectedExpenses;
      const exitValue = exitNOI / exitCapRate;
      const totalReturn = totalNOI + exitValue;
      const equityMultiple = purchasePrice > 0 ? totalReturn / purchasePrice : 0;
      
      let irr = 0.1;
      const cashFlows = [-purchasePrice];
      for (let year = 1; year <= holdPeriod; year++) {
        const yd = yearlyData.find(y => y.year === year);
        if (year === holdPeriod) {
          cashFlows.push((yd?.noi || 0) + exitValue);
        } else {
          cashFlows.push(yd?.noi || 0);
        }
      }
      
      for (let i = 0; i < 100; i++) {
        let npv = 0;
        let dnpv = 0;
        for (let j = 0; j < cashFlows.length; j++) {
          npv += cashFlows[j] / Math.pow(1 + irr, j);
          dnpv -= j * cashFlows[j] / Math.pow(1 + irr, j + 1);
        }
        if (Math.abs(dnpv) < 0.00001) break;
        const newIrr = irr - npv / dnpv;
        if (Math.abs(newIrr - irr) < 0.00001) break;
        irr = newIrr;
      }
      
      const noiMargin = projectedRevenue > 0 ? ((projectedRevenue - projectedExpenses) / projectedRevenue) * 100 : 0;
      const cashOnCash = purchasePrice > 0 ? (yearlyData[0]?.noi || 0) / purchasePrice * 100 : 0;
      
      return {
        purchasePrice,
        noi: Math.round(exitNOI),
        capRate: capRate * 100,
        irr: Math.round(irr * 10000) / 100,
        equityMultiple: Math.round(equityMultiple * 100) / 100,
        cashOnCash: Math.round(cashOnCash * 100) / 100,
        exitValue: Math.round(exitValue),
        totalRevenue: Math.round(projectedRevenue),
        totalExpenses: Math.round(projectedExpenses),
        noiMargin: Math.round(noiMargin * 10) / 10,
        revenueGrowthRate: revenueGrowth * 100,
        expenseGrowthRate: expenseGrowth * 100,
        exitCapRate: exitCapRate * 100,
        yearlyData,
        revenueBreakdown: [
          { name: 'Slip Rentals', value: Math.round(projectedRevenue * 0.55) },
          { name: 'Dry Storage', value: Math.round(projectedRevenue * 0.2) },
          { name: 'Fuel Sales', value: Math.round(projectedRevenue * 0.15) },
          { name: 'Other', value: Math.round(projectedRevenue * 0.1) },
        ]
      };
    };
    
    const scenarioData = [];
    
    const baseScenario = scenarios.find(s => s.scenarioType === 'base');
    const baseRevGrowth = parseFloat(baseScenario?.revenueGrowthRate?.toString() || '3') / 100;
    const baseExpGrowth = parseFloat(baseScenario?.expenseGrowthRate?.toString() || '2.5') / 100;
    const baseExitCap = parseFloat(baseScenario?.exitCapRate?.toString() || String((capRate * 100) + 0.5)) / 100;
    
    scenarioData.push({
      id: 'base',
      name: 'Base Case',
      description: 'Conservative assumptions based on historical performance',
      color: '#3b82f6',
      metrics: calculateScenarioMetrics('base', baseRevGrowth, baseExpGrowth, baseExitCap)
    });
    
    const upsideScenario = scenarios.find(s => s.scenarioType === 'upside');
    const upsideRevGrowth = parseFloat(upsideScenario?.revenueGrowthRate?.toString() || '5') / 100;
    const upsideExpGrowth = parseFloat(upsideScenario?.expenseGrowthRate?.toString() || '2') / 100;
    const upsideExitCap = parseFloat(upsideScenario?.exitCapRate?.toString() || String((capRate * 100) - 0.25)) / 100;
    
    scenarioData.push({
      id: 'upside',
      name: 'Upside Case',
      description: 'Optimistic scenario with value-add initiatives',
      color: '#10b981',
      metrics: calculateScenarioMetrics('upside', upsideRevGrowth, upsideExpGrowth, upsideExitCap)
    });
    
    const downsideScenario = scenarios.find(s => s.scenarioType === 'downside');
    const downsideRevGrowth = parseFloat(downsideScenario?.revenueGrowthRate?.toString() || '1.5') / 100;
    const downsideExpGrowth = parseFloat(downsideScenario?.expenseGrowthRate?.toString() || '3.5') / 100;
    const downsideExitCap = parseFloat(downsideScenario?.exitCapRate?.toString() || String((capRate * 100) + 1)) / 100;
    
    scenarioData.push({
      id: 'downside',
      name: 'Downside Case',
      description: 'Stress test with adverse market conditions',
      color: '#ef4444',
      metrics: calculateScenarioMetrics('downside', downsideRevGrowth, downsideExpGrowth, downsideExitCap)
    });
    
    const comparisonMetrics = [
      {
        id: 'purchasePrice',
        name: 'Purchase Price',
        unit: 'currency',
        scenarios: scenarioData.map(s => ({ 
          id: s.id, 
          value: s.metrics.purchasePrice,
          variance: 0 
        }))
      },
      {
        id: 'noi',
        name: 'Exit Year NOI',
        unit: 'currency',
        scenarios: scenarioData.map(s => {
          const base = scenarioData.find(x => x.id === 'base')?.metrics.noi || 1;
          return { 
            id: s.id, 
            value: s.metrics.noi,
            variance: ((s.metrics.noi - base) / base) * 100
          };
        })
      },
      {
        id: 'capRate',
        name: 'Entry Cap Rate',
        unit: 'percent',
        scenarios: scenarioData.map(s => ({ 
          id: s.id, 
          value: s.metrics.capRate,
          variance: 0
        }))
      },
      {
        id: 'irr',
        name: 'IRR',
        unit: 'percent',
        scenarios: scenarioData.map(s => {
          const base = scenarioData.find(x => x.id === 'base')?.metrics.irr || 1;
          return { 
            id: s.id, 
            value: s.metrics.irr,
            variance: s.metrics.irr - base
          };
        })
      },
      {
        id: 'equityMultiple',
        name: 'Equity Multiple',
        unit: 'multiple',
        scenarios: scenarioData.map(s => {
          const base = scenarioData.find(x => x.id === 'base')?.metrics.equityMultiple || 1;
          return { 
            id: s.id, 
            value: s.metrics.equityMultiple,
            variance: ((s.metrics.equityMultiple - base) / base) * 100
          };
        })
      },
      {
        id: 'cashOnCash',
        name: 'Cash-on-Cash',
        unit: 'percent',
        scenarios: scenarioData.map(s => {
          const base = scenarioData.find(x => x.id === 'base')?.metrics.cashOnCash || 1;
          return { 
            id: s.id, 
            value: s.metrics.cashOnCash,
            variance: s.metrics.cashOnCash - base
          };
        })
      },
      {
        id: 'exitValue',
        name: 'Exit Value',
        unit: 'currency',
        scenarios: scenarioData.map(s => {
          const base = scenarioData.find(x => x.id === 'base')?.metrics.exitValue || 1;
          return { 
            id: s.id, 
            value: s.metrics.exitValue,
            variance: ((s.metrics.exitValue - base) / base) * 100
          };
        })
      }
    ];

    res.json({
      projectId,
      projectName: project.marinaName,
      holdPeriod,
      scenarios: scenarioData,
      comparisonMetrics
    });
  } catch (error: any) {
    console.error('Failed to generate scenario comparison:', error);
    res.status(500).json({ error: 'Failed to generate scenario comparison' });
  }
});

router.get('/projects/:projectId/validation-warnings', async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { projectId } = req.params;
    
    const project = await storage.getModelingProject(projectId, orgId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [projectConfig] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const scenarios = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ));
    
    const warnings: any[] = [];
    let score = 100;
    
    const capRate = parseFloat(project.year1CapRate?.toString() || '0');
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    const ebitda = parseFloat(project.ebitda?.toString() || '0');
    const revenue = parseFloat(project.effectiveGrossRevenue?.toString() || '0');
    const expenses = parseFloat(project.operatingExpenses?.toString() || '0');
    const holdPeriod = projectConfig?.holdPeriod || 0;
    
    if (!project.purchasePrice) {
      warnings.push({
        id: 'missing_purchase_price',
        severity: 'critical',
        category: 'inputs',
        title: 'Missing Purchase Price',
        message: 'Purchase price is required for accurate valuation analysis.',
        recommendation: 'Enter the expected or asking purchase price to enable full analysis.',
        field: 'purchasePrice'
      });
      score -= 20;
    }
    
    if (!project.ebitda && !project.effectiveGrossRevenue) {
      warnings.push({
        id: 'missing_ebitda',
        severity: 'warning',
        category: 'inputs',
        title: 'Missing EBITDA',
        message: 'EBITDA is not specified. Financial metrics may be incomplete.',
        recommendation: 'Enter EBITDA or ensure P&L data is uploaded for automatic calculation.',
        field: 'ebitda'
      });
      score -= 10;
    }
    
    if (!project.totalStorageUnits) {
      warnings.push({
        id: 'missing_units',
        severity: 'info',
        category: 'inputs',
        title: 'Missing Total Storage Units',
        message: 'Total storage units count is not specified.',
        recommendation: 'Enter total unit count to enable per-unit metrics and benchmarking.',
        field: 'totalStorageUnits'
      });
      score -= 5;
    }
    
    if (capRate > 0) {
      if (capRate < 3) {
        warnings.push({
          id: 'cap_rate_low',
          severity: 'critical',
          category: 'cap_rate',
          title: 'Cap Rate Unusually Low',
          message: `The going-in cap rate of ${capRate.toFixed(2)}% is below 3%, which is unusually low for marina properties.`,
          recommendation: 'Verify market data and consider if this reflects a premium location or potential data error.',
          value: `${capRate.toFixed(2)}%`,
          threshold: '3% - 15%',
          field: 'year1CapRate'
        });
        score -= 25;
      } else if (capRate < 5) {
        warnings.push({
          id: 'cap_rate_below_market',
          severity: 'warning',
          category: 'cap_rate',
          title: 'Cap Rate Below Market Average',
          message: `The going-in cap rate of ${capRate.toFixed(2)}% is below the typical range for marina properties (5.5% - 8.5%).`,
          recommendation: 'Consider verifying comp data and market conditions. A lower cap rate may be justified for premium locations.',
          value: `${capRate.toFixed(2)}%`,
          threshold: '5.5% - 8.5%',
          field: 'year1CapRate'
        });
        score -= 10;
      } else if (capRate > 15) {
        warnings.push({
          id: 'cap_rate_high',
          severity: 'critical',
          category: 'cap_rate',
          title: 'Cap Rate Unusually High',
          message: `The going-in cap rate of ${capRate.toFixed(2)}% is above 15%, which may indicate distressed asset or data error.`,
          recommendation: 'Review property condition and market factors that might justify this high cap rate.',
          value: `${capRate.toFixed(2)}%`,
          threshold: '3% - 15%',
          field: 'year1CapRate'
        });
        score -= 20;
      }
    }
    
    if (revenue > 0 && expenses > 0) {
      if (expenses >= revenue) {
        warnings.push({
          id: 'expenses_exceed_revenue',
          severity: 'critical',
          category: 'cash_flow',
          title: 'Operating Expenses Exceed Revenue',
          message: `Operating expenses ($${(expenses/1000000).toFixed(2)}M) equal or exceed revenue ($${(revenue/1000000).toFixed(2)}M), resulting in negative or zero NOI.`,
          recommendation: 'Verify expense and revenue figures. This indicates a loss-making operation.',
          value: `Expenses: $${(expenses/1000000).toFixed(2)}M`,
          threshold: `Revenue: $${(revenue/1000000).toFixed(2)}M`,
          field: 'operatingExpenses'
        });
        score -= 30;
      } else {
        const expenseRatio = (expenses / revenue) * 100;
        if (expenseRatio > 70) {
          warnings.push({
            id: 'high_expense_ratio',
            severity: 'warning',
            category: 'expense_ratio',
            title: 'High Expense Ratio',
            message: `Operating expense ratio of ${expenseRatio.toFixed(1)}% is above the industry benchmark of 40-55%.`,
            recommendation: 'Review expense line items for optimization opportunities.',
            value: `${expenseRatio.toFixed(1)}%`,
            threshold: '40% - 55%',
            field: 'operatingExpenses'
          });
          score -= 8;
        }
      }
    }
    
    if (purchasePrice > 0 && ebitda > 0) {
      const impliedMultiple = purchasePrice / ebitda;
      if (impliedMultiple > 20) {
        warnings.push({
          id: 'high_multiple',
          severity: 'warning',
          category: 'cash_flow',
          title: 'High EBITDA Multiple',
          message: `The implied EBITDA multiple of ${impliedMultiple.toFixed(1)}x is above typical marina valuations.`,
          recommendation: 'Verify growth assumptions justify premium valuation or review EBITDA calculations.',
          value: `${impliedMultiple.toFixed(1)}x`,
          threshold: '8x - 15x typical',
          field: 'purchasePrice'
        });
        score -= 8;
      }
    }
    
    if (scenarios.length === 0) {
      warnings.push({
        id: 'no_scenarios',
        severity: 'warning',
        category: 'projections',
        title: 'No Projection Scenarios Configured',
        message: 'No base, upside, or downside scenarios have been set up.',
        recommendation: 'Configure scenario versions to enable complete analysis.',
        field: 'scenarios'
      });
      score -= 10;
    }
    
    if (!holdPeriod) {
      warnings.push({
        id: 'missing_hold_period',
        severity: 'info',
        category: 'inputs',
        title: 'Hold Period Not Set',
        message: 'Investment hold period is not configured.',
        recommendation: 'Set hold period to enable IRR and exit value calculations.',
        field: 'holdPeriod'
      });
      score -= 5;
    }
    
    score = Math.max(0, score);
    
    res.json({
      isValid: warnings.filter(w => w.severity === 'critical').length === 0,
      score,
      warnings,
      summary: {
        critical: warnings.filter(w => w.severity === 'critical').length,
        warning: warnings.filter(w => w.severity === 'warning').length,
        info: warnings.filter(w => w.severity === 'info').length
      }
    });
  } catch (error: any) {
    console.error('Failed to validate modeling project:', error);
    res.status(500).json({ error: 'Failed to validate modeling project' });
  }
});

export default router;

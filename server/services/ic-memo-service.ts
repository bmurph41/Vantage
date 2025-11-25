import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  modelingAuditLog
} from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export interface ICMemoData {
  project: {
    id: string;
    name: string;
    marinaName: string;
    city?: string;
    state?: string;
    region?: string;
    purchasePrice?: number;
    estimatedValue?: number;
    totalUnits?: number;
    acreage?: number;
    dealOutcome?: string;
    createdAt: string;
  };
  scenarios: Array<{
    id: string;
    name: string;
    scenarioType: string;
    version: number;
    status: string;
    revenueGrowthRate?: number;
    expenseGrowthRate?: number;
    exitCapRate?: number;
    assumptions?: any;
    approvedBy?: string;
    approvedAt?: string;
  }>;
  financials: {
    totalRevenue: number;
    totalExpenses: number;
    noi: number;
    capRate: number;
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
  };
  projections: {
    years: number[];
    scenarios: Record<string, {
      revenue: number[];
      expenses: number[];
      noi: number[];
      value: number[];
    }>;
  };
  approvalHistory: Array<{
    eventType: string;
    scenarioName?: string;
    userId: string;
    createdAt: string;
    notes?: string;
  }>;
  generatedAt: string;
  generatedBy: string;
}

export class ICMemoService {
  async generateMemoData(projectId: string, orgId: string, userId: string): Promise<ICMemoData> {
    // Get project details
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

    // Get current scenarios
    const scenarios = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .orderBy(modelingScenarioVersions.scenarioType);

    // Get actuals data
    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    // Calculate financial summaries
    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueByCategory: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};

    for (const actual of actuals) {
      const amount = parseFloat(actual.amount?.toString() || '0');
      if (actual.category === 'Revenue') {
        totalRevenue += amount;
        const subcat = actual.subcategory || 'Other';
        revenueByCategory[subcat] = (revenueByCategory[subcat] || 0) + amount;
      } else if (['Expenses', 'COGS', 'Operating Expenses'].includes(actual.category || '')) {
        totalExpenses += amount;
        const subcat = actual.subcategory || 'Other';
        expensesByCategory[subcat] = (expensesByCategory[subcat] || 0) + amount;
      }
    }

    const noi = totalRevenue - totalExpenses;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;

    // Get approval history
    const auditEvents = await db.select()
      .from(modelingAuditLog)
      .where(and(
        eq(modelingAuditLog.modelingProjectId, projectId),
        inArray(modelingAuditLog.eventType, ['scenario_approved', 'scenario_rejected', 'scenario_submitted'])
      ))
      .orderBy(desc(modelingAuditLog.createdAt))
      .limit(20);

    const approvalHistory = auditEvents.map(event => ({
      eventType: event.eventType,
      scenarioName: (event.newValue as any)?.name,
      userId: event.userId || 'unknown',
      createdAt: event.createdAt?.toISOString() || new Date().toISOString(),
      notes: (event.newValue as any)?.approvalNotes
    }));

    // Generate projections
    const holdPeriod = 5;
    const baseYear = new Date().getFullYear();
    const years = Array.from({ length: holdPeriod }, (_, i) => baseYear + i);
    
    const projectionScenarios: Record<string, { revenue: number[]; expenses: number[]; noi: number[]; value: number[] }> = {};
    
    for (const scenario of scenarios) {
      const revGrowth = parseFloat(scenario.revenueGrowthRate?.toString() || '3') / 100;
      const expGrowth = parseFloat(scenario.expenseGrowthRate?.toString() || '2.5') / 100;
      const exitCap = parseFloat(scenario.exitCapRate?.toString() || '7.5') / 100;

      const baseRevenue = totalRevenue || 1000000;
      const baseExpenses = totalExpenses || 600000;

      projectionScenarios[scenario.scenarioType] = {
        revenue: years.map((_, i) => Math.round(baseRevenue * Math.pow(1 + revGrowth, i))),
        expenses: years.map((_, i) => Math.round(baseExpenses * Math.pow(1 + expGrowth, i))),
        noi: [],
        value: []
      };

      const scenarioData = projectionScenarios[scenario.scenarioType];
      scenarioData.noi = scenarioData.revenue.map((rev, i) => rev - scenarioData.expenses[i]);
      scenarioData.value = scenarioData.noi.map(noi => Math.round(noi / exitCap));
    }

    return {
      project: {
        id: project.id,
        name: project.name || project.marinaName || 'Unnamed Project',
        marinaName: project.marinaName || '',
        city: project.city || undefined,
        state: project.state || undefined,
        region: project.region || undefined,
        purchasePrice: purchasePrice || undefined,
        estimatedValue: parseFloat(project.estimatedValue?.toString() || '0') || undefined,
        totalUnits: project.totalUnits || undefined,
        acreage: parseFloat(project.acreage?.toString() || '0') || undefined,
        dealOutcome: project.dealOutcome || undefined,
        createdAt: project.createdAt?.toISOString() || new Date().toISOString()
      },
      scenarios: scenarios.map(s => ({
        id: s.id,
        name: s.name || s.scenarioType,
        scenarioType: s.scenarioType,
        version: s.version || 1,
        status: s.status || 'draft',
        revenueGrowthRate: parseFloat(s.revenueGrowthRate?.toString() || '0'),
        expenseGrowthRate: parseFloat(s.expenseGrowthRate?.toString() || '0'),
        exitCapRate: parseFloat(s.exitCapRate?.toString() || '0'),
        assumptions: s.assumptions,
        approvedBy: s.approvedBy || undefined,
        approvedAt: s.approvedAt?.toISOString()
      })),
      financials: {
        totalRevenue,
        totalExpenses,
        noi,
        capRate,
        revenueByCategory,
        expensesByCategory
      },
      projections: {
        years,
        scenarios: projectionScenarios
      },
      approvalHistory,
      generatedAt: new Date().toISOString(),
      generatedBy: userId
    };
  }

  formatMemoAsText(data: ICMemoData): string {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };

    const formatPercent = (value: number) => `${value.toFixed(2)}%`;

    let memo = `
================================================================================
                        INVESTMENT COMMITTEE MEMORANDUM
================================================================================

Property:           ${data.project.marinaName}
Location:           ${[data.project.city, data.project.state].filter(Boolean).join(', ') || 'N/A'}
Region:             ${data.project.region || 'N/A'}
Generated:          ${new Date(data.generatedAt).toLocaleDateString('en-US', { 
                      year: 'numeric', month: 'long', day: 'numeric', 
                      hour: '2-digit', minute: '2-digit' 
                    })}

================================================================================
                              EXECUTIVE SUMMARY
================================================================================

Purchase Price:     ${data.project.purchasePrice ? formatCurrency(data.project.purchasePrice) : 'N/A'}
Estimated Value:    ${data.project.estimatedValue ? formatCurrency(data.project.estimatedValue) : 'N/A'}
Total Units:        ${data.project.totalUnits?.toLocaleString() || 'N/A'}
Acreage:            ${data.project.acreage?.toFixed(1) || 'N/A'} acres
Deal Status:        ${data.project.dealOutcome?.replace('_', ' ').toUpperCase() || 'N/A'}

================================================================================
                              FINANCIAL SUMMARY
================================================================================

Trailing 12-Month Performance:
  Total Revenue:    ${formatCurrency(data.financials.totalRevenue)}
  Total Expenses:   ${formatCurrency(data.financials.totalExpenses)}
  Net Operating Income: ${formatCurrency(data.financials.noi)}
  Implied Cap Rate: ${formatPercent(data.financials.capRate)}

Revenue Breakdown:
${Object.entries(data.financials.revenueByCategory)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([cat, amount]) => `  ${cat.padEnd(25)} ${formatCurrency(amount)}`)
  .join('\n')}

Expense Breakdown:
${Object.entries(data.financials.expensesByCategory)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([cat, amount]) => `  ${cat.padEnd(25)} ${formatCurrency(amount)}`)
  .join('\n')}

================================================================================
                           SCENARIO ANALYSIS
================================================================================
`;

    for (const scenario of data.scenarios) {
      const statusIcon = scenario.status === 'approved' ? '✓' : 
                         scenario.status === 'rejected' ? '✗' : 
                         scenario.status === 'pending_approval' ? '⏳' : '○';
      
      memo += `
${scenario.name.toUpperCase()} (v${scenario.version}) [${statusIcon} ${scenario.status.toUpperCase()}]
  Revenue Growth:   ${formatPercent(scenario.revenueGrowthRate || 0)}
  Expense Growth:   ${formatPercent(scenario.expenseGrowthRate || 0)}
  Exit Cap Rate:    ${formatPercent(scenario.exitCapRate || 0)}
${scenario.approvedAt ? `  Approved:        ${new Date(scenario.approvedAt).toLocaleDateString()}` : ''}
`;
    }

    memo += `
================================================================================
                            5-YEAR PROJECTIONS
================================================================================

Year                ${data.projections.years.map(y => y.toString().padStart(12)).join('')}
`;

    for (const [scenarioType, projection] of Object.entries(data.projections.scenarios)) {
      const scenarioLabel = scenarioType.charAt(0).toUpperCase() + scenarioType.slice(1);
      memo += `
${scenarioLabel} Case:
  Revenue        ${projection.revenue.map(v => formatCurrency(v).padStart(12)).join('')}
  Expenses       ${projection.expenses.map(v => formatCurrency(v).padStart(12)).join('')}
  NOI            ${projection.noi.map(v => formatCurrency(v).padStart(12)).join('')}
  Exit Value     ${projection.value.map(v => formatCurrency(v).padStart(12)).join('')}
`;
    }

    if (data.approvalHistory.length > 0) {
      memo += `
================================================================================
                           APPROVAL HISTORY
================================================================================
`;
      for (const event of data.approvalHistory) {
        const eventLabel = event.eventType.replace(/_/g, ' ').replace(/scenario /i, '');
        memo += `
${new Date(event.createdAt).toLocaleDateString()} - ${eventLabel.toUpperCase()}
  Scenario: ${event.scenarioName || 'N/A'}
  By: ${event.userId}
${event.notes ? `  Notes: ${event.notes}` : ''}
`;
      }
    }

    memo += `
================================================================================
                              DISCLAIMER
================================================================================

This Investment Committee Memorandum is prepared for internal use only and 
contains confidential information. The projections and analyses contained 
herein are based on assumptions that may not reflect actual market conditions.
Past performance is not indicative of future results.

Generated by MarinaMatch Modeling Platform
================================================================================
`;

    return memo;
  }
}

export const icMemoService = new ICMemoService();

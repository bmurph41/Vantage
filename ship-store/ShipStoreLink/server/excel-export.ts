import * as XLSX from 'xlsx';
import type { Scenario, Assumption, Projection, HistoricalData, Transaction } from '@shared/schema';
import { storage } from './storage';

// Export projections to Excel with multiple sheets
export async function exportProjectionsToExcel(scenarioId: string): Promise<Buffer> {
  const scenario = await storage.getScenario(scenarioId);
  const assumptions = await storage.getAssumptionsByScenario(scenarioId);
  const projections = await storage.getProjectionsByScenario(scenarioId);

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Scenario Summary
  const summaryData = [
    ['Scenario Name', scenario?.name || 'N/A'],
    ['Description', scenario?.description || 'N/A'],
    ['Created At', scenario?.createdAt ? new Date(scenario.createdAt).toLocaleDateString() : 'N/A'],
    [''],
    ['ASSUMPTIONS'],
    ['Growth Rate (%)', assumptions?.growthRate || 0],
    ['COGS (%)', assumptions?.cogsPercentage || 0],
    ['Operating Expenses ($)', assumptions?.opexMonthly || 0],
    ['Tax Rate (%)', assumptions?.taxRate || 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: Pro Forma Projections
  if (projections && projections.length > 0) {
    const headers = ['Period', 'Year', 'Month/Quarter', 'Revenue', 'COGS', 'Gross Profit', 'OpEx', 'Net Income', 'Gross Margin %', 'Operating Margin %', 'Net Margin %'];
    const rows = projections.map(p => [
      p.period || 'annual',
      p.periodYear,
      p.periodMonth || p.periodQuarter || '',
      parseFloat(p.projectedRevenue || '0'),
      parseFloat(p.projectedCOGS || '0'),
      parseFloat(p.projectedGrossProfit || '0'),
      parseFloat(p.projectedOpex || '0'),
      parseFloat(p.projectedNetIncome || '0'),
      parseFloat(p.grossMarginPercent || '0'),
      parseFloat(p.operatingMarginPercent || '0'),
      parseFloat(p.netMarginPercent || '0'),
    ]);
    const projectionData = [headers, ...rows];
    const projectionSheet = XLSX.utils.aoa_to_sheet(projectionData);
    
    // Auto-width columns
    const colWidths = headers.map((_, i) => ({
      wch: Math.max(12, ...rows.map(row => String(row[i] || '').length))
    }));
    projectionSheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, projectionSheet, 'Projections');
  }

  // Sheet 3: Assumptions Detail
  if (assumptions) {
    const assumptionsData = [
      ['Parameter', 'Value'],
      ['Base Revenue', assumptions.baseRevenue],
      ['Growth Rate (%)', assumptions.growthRate],
      ['COGS Percentage (%)', assumptions.cogsPercentage],
      ['OpEx Monthly ($)', assumptions.opexMonthly],
      ['Tax Rate (%)', assumptions.taxRate],
      ['Capital Expenditures ($)', assumptions.capex || 0],
      ['Depreciation ($)', assumptions.depreciation || 0],
      ['Working Capital ($)', assumptions.workingCapital || 0],
    ];
    const assumptionsSheet = XLSX.utils.aoa_to_sheet(assumptionsData);
    XLSX.utils.book_append_sheet(workbook, assumptionsSheet, 'Assumptions');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Export historical data to Excel
export async function exportHistoricalDataToExcel(filters?: {
  period?: string;
  year?: number;
  dataSource?: string;
}): Promise<Buffer> {
  const data = await storage.getHistoricalData(filters);

  const workbook = XLSX.utils.book_new();

  if (data && data.length > 0) {
    const headers = ['Period', 'Year', 'Quarter', 'Revenue', 'COGS', 'OpEx', 'Net Income', 'Data Source', 'Import Date'];
    const rows = data.map(d => [
      d.period,
      d.year,
      d.quarter || '',
      parseFloat(d.revenue || '0'),
      parseFloat(d.cogs || '0'),
      parseFloat(d.opex || '0'),
      parseFloat(d.netIncome || '0'),
      d.dataSource || 'Manual',
      d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
    ]);
    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Auto-width columns
    const colWidths = headers.map((_, i) => ({
      wch: Math.max(12, ...rows.map(row => String(row[i] || '').length))
    }));
    sheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, sheet, 'Historical Data');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Export transactions to Excel
export async function exportTransactionsToExcel(filters?: {
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: string;
}): Promise<Buffer> {
  const transactions = await storage.getRecentTransactions(100); // Get recent transactions

  const workbook = XLSX.utils.book_new();

  if (transactions && transactions.length > 0) {
    const headers = ['Transaction ID', 'Date', 'Total', 'Payment Method', 'Item Count', 'Status'];
    const rows = transactions.map(t => [
      t.id.substring(0, 8),
      t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
      parseFloat(t.total.toFixed(2)),
      t.paymentMethod,
      t.items.length,
      t.status || 'completed',
    ]);
    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Auto-width columns
    const colWidths = headers.map((h) => ({ wch: Math.max(12, h.length) }));
    sheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');

    // Add detailed items sheet
    const itemHeaders = ['Transaction ID', 'Product ID', 'Product Name', 'Quantity', 'Price', 'Subtotal'];
    const itemRows: any[] = [];
    transactions.forEach(t => {
      t.items.forEach(item => {
        itemRows.push([
          t.id.substring(0, 8),
          item.productId.substring(0, 8),
          item.name,
          item.quantity,
          parseFloat(item.price.toFixed(2)),
          parseFloat((item.price * item.quantity).toFixed(2)),
        ]);
      });
    });
    const itemData = [itemHeaders, ...itemRows];
    const itemSheet = XLSX.utils.aoa_to_sheet(itemData);
    itemSheet['!cols'] = itemHeaders.map(() => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(workbook, itemSheet, 'Transaction Details');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Export scenario comparison to Excel
export async function exportScenarioComparisonToExcel(scenarioIds: string[]): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // Fetch all scenarios and their projections
  const scenarios = await Promise.all(
    scenarioIds.map(async (id) => {
      const scenario = await storage.getScenario(id);
      const assumptions = await storage.getAssumptionsByScenario(id);
      const projections = await storage.getProjectionsByScenario(id);
      return { scenario, assumptions, projections };
    })
  );

  // Sheet 1: Scenario Overview
  const overviewHeaders = ['Scenario', 'Description', 'Growth Rate (%)', 'COGS (%)', 'OpEx Monthly ($)'];
  const overviewRows = scenarios.map(s => [
    s.scenario?.name || 'N/A',
    s.scenario?.description || 'N/A',
    s.assumptions?.growthRate || 0,
    s.assumptions?.cogsPercentage || 0,
    s.assumptions?.opexMonthly || 0,
  ]);
  const overviewData = [overviewHeaders, ...overviewRows];
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Scenario Overview');

  // Sheet 2: Revenue Comparison
  const allYears = new Set<number>();
  scenarios.forEach(s => {
    s.projections?.forEach(p => allYears.add(p.periodYear));
  });
  const years = Array.from(allYears).sort();

  if (years.length > 0) {
    const revenueHeaders = ['Year', ...scenarios.map(s => s.scenario?.name || 'Unknown')];
    const revenueRows = years.map(year => {
      const row: any[] = [year];
      scenarios.forEach(s => {
        const yearData = s.projections?.find(p => p.periodYear === year);
        row.push(parseFloat(yearData?.projectedRevenue || '0'));
      });
      return row;
    });
    const revenueData = [revenueHeaders, ...revenueRows];
    const revenueSheet = XLSX.utils.aoa_to_sheet(revenueData);
    XLSX.utils.book_append_sheet(workbook, revenueSheet, 'Revenue Comparison');

    // Sheet 3: Net Income Comparison
    const netIncomeHeaders = ['Year', ...scenarios.map(s => s.scenario?.name || 'Unknown')];
    const netIncomeRows = years.map(year => {
      const row: any[] = [year];
      scenarios.forEach(s => {
        const yearData = s.projections?.find(p => p.periodYear === year);
        row.push(parseFloat(yearData?.projectedNetIncome || '0'));
      });
      return row;
    });
    const netIncomeData = [netIncomeHeaders, ...netIncomeRows];
    const netIncomeSheet = XLSX.utils.aoa_to_sheet(netIncomeData);
    XLSX.utils.book_append_sheet(workbook, netIncomeSheet, 'Net Income Comparison');

    // Sheet 4: Gross Profit Comparison
    const grossProfitHeaders = ['Year', ...scenarios.map(s => s.scenario?.name || 'Unknown')];
    const grossProfitRows = years.map(year => {
      const row: any[] = [year];
      scenarios.forEach(s => {
        const yearData = s.projections?.find(p => p.periodYear === year);
        row.push(parseFloat(yearData?.projectedGrossProfit || '0'));
      });
      return row;
    });
    const grossProfitData = [grossProfitHeaders, ...grossProfitRows];
    const grossProfitSheet = XLSX.utils.aoa_to_sheet(grossProfitData);
    XLSX.utils.book_append_sheet(workbook, grossProfitSheet, 'Gross Profit Comparison');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

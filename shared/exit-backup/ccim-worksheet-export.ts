import { generateCCIMACSW, type CCIMACSWResult, type CCIMACSWInput } from './basis-ledger';
import { generateCCIMCFAW, type CCIMCFAWResult, type CashflowProjectionInput } from './cashflow-synthesizer';

export interface ACSWExportData {
  propertyName: string;
  propertyAddress?: string;
  analysisDate: Date;
  preparedBy?: string;
  
  worksheet: CCIMACSWResult;
  
  summary: {
    totalGain: number;
    deferredGain: number;
    taxableGain: number;
    effectiveTaxRate: number;
    afterTaxProceeds: number;
    afterTaxYield: number;
  };
}

export interface CFAWExportData {
  propertyName: string;
  propertyAddress?: string;
  analysisDate: Date;
  preparedBy?: string;
  
  worksheet: CCIMCFAWResult;
  
  summary: {
    totalNoi: number;
    totalDebtService: number;
    averageDscr: number;
    irr: number | null;
    equityMultiple: number;
    paybackPeriod: number | null;
  };
}

export function prepareACSWExport(
  input: CCIMACSWInput,
  propertyName: string,
  propertyAddress?: string,
  preparedBy?: string
): ACSWExportData {
  const worksheet = generateCCIMACSW(input);
  
  const totalGain = worksheet.line15_netCapitalGain;
  const afterTaxProceeds = worksheet.line25_afterTaxProceeds;
  const effectiveTaxRate = totalGain > 0 ? worksheet.line24_totalTaxLiability / totalGain : 0;
  const afterTaxYield = input.basisInput.originalPurchasePrice > 0 
    ? (afterTaxProceeds - input.basisInput.originalPurchasePrice) / input.basisInput.originalPurchasePrice
    : 0;
  
  return {
    propertyName,
    propertyAddress,
    analysisDate: new Date(),
    preparedBy,
    worksheet,
    summary: {
      totalGain,
      deferredGain: 0,
      taxableGain: totalGain,
      effectiveTaxRate,
      afterTaxProceeds,
      afterTaxYield,
    },
  };
}

export function prepareCFAWExport(
  input: CashflowProjectionInput,
  propertyName: string,
  propertyAddress?: string,
  preparedBy?: string
): CFAWExportData {
  const worksheet = generateCCIMCFAW(input, propertyName);
  
  return {
    propertyName,
    propertyAddress,
    analysisDate: new Date(),
    preparedBy,
    worksheet,
    summary: {
      totalNoi: worksheet.yearlyOperations.reduce((sum, y) => sum + y.noi, 0),
      totalDebtService: worksheet.yearlyOperations.reduce((sum, y) => sum + y.debtService, 0),
      averageDscr: worksheet.investmentMetrics.averageDscr,
      irr: worksheet.investmentMetrics.irr,
      equityMultiple: worksheet.investmentMetrics.equityMultiple,
      paybackPeriod: null,
    },
  };
}

export interface WorksheetSection {
  title: string;
  rows: Array<{
    label: string;
    value: string | number;
    indent?: number;
    bold?: boolean;
    highlight?: 'positive' | 'negative' | 'neutral';
  }>;
}

export function formatACSWForDisplay(data: ACSWExportData): WorksheetSection[] {
  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  
  const w = data.worksheet;
  
  return [
    {
      title: 'ACQUISITION',
      rows: [
        { label: 'Line 1 - Acquisition Cost', value: fmt(w.line1_acquisitionCost) },
        { label: 'Line 2 - Acquisition Fees', value: fmt(w.line2_acquisitionFees) },
        { label: 'Line 3 - Total Acquisition Cost', value: fmt(w.line3_totalAcquisitionCost), bold: true },
      ],
    },
    {
      title: 'BASIS ADJUSTMENTS',
      rows: [
        { label: 'Line 4 - Capital Additions', value: fmt(w.line4_capitalAdditions), highlight: 'positive' },
        { label: 'Line 5 - Cost Recovery Taken', value: fmt(w.line5_costRecoveryTaken), highlight: 'negative' },
        { label: 'Line 6 - Straight-Line Recapture Amount', value: fmt(w.line6_straightLineRecapture) },
        { label: 'Line 7 - Partial Sales', value: fmt(w.line7_partialSales) },
        { label: 'Line 8 - Adjusted Basis', value: fmt(w.line8_adjustedBasis), bold: true },
      ],
    },
    {
      title: 'SALE PROCEEDS',
      rows: [
        { label: 'Line 9 - Sale Price', value: fmt(w.line9_salePrice) },
        { label: 'Line 10 - Costs of Sale', value: fmt(w.line10_costsOfSale), highlight: 'negative' },
        { label: 'Line 11 - Net Sale Price', value: fmt(w.line11_netSalePrice), bold: true },
        { label: 'Line 12 - Participation Payments', value: fmt(w.line12_participationPayments) },
        { label: 'Line 13 - Total Amount Realized', value: fmt(w.line13_totalAmountRealized), bold: true },
      ],
    },
    {
      title: 'GAIN ANALYSIS',
      rows: [
        { label: 'Line 14 - Suspended Losses Utilized', value: fmt(w.line14_suspendedLosses), highlight: 'positive' },
        { label: 'Line 15 - Net Capital Gain', value: fmt(w.line15_netCapitalGain), bold: true },
      ],
    },
    {
      title: 'GAIN CHARACTER',
      rows: [
        { label: 'Line 16 - Section 1250 Recapture (25%)', value: fmt(w.line16_section1250Recapture) },
        { label: 'Line 17 - Section 1245 Recapture (Ordinary)', value: fmt(w.line17_section1245Recapture) },
        { label: 'Line 18 - Long-Term Capital Gain', value: fmt(w.line18_longTermCapitalGain) },
      ],
    },
    {
      title: 'TAX LIABILITY',
      rows: [
        { label: 'Line 19 - Section 1250 Tax (25%)', value: fmt(w.line19_section1250Tax), highlight: 'negative' },
        { label: 'Line 20 - Section 1245 Tax (Ordinary)', value: fmt(w.line20_section1245Tax), highlight: 'negative' },
        { label: 'Line 21 - Federal Capital Gains Tax', value: fmt(w.line21_federalCapitalGainsTax), highlight: 'negative' },
        { label: 'Line 22 - NIIT (3.8%)', value: fmt(w.line22_niitTax), highlight: 'negative' },
        { label: 'Line 23 - State Tax', value: fmt(w.line23_stateTax), highlight: 'negative' },
        { label: 'Line 24 - Total Tax Liability', value: fmt(w.line24_totalTaxLiability), bold: true, highlight: 'negative' },
      ],
    },
    {
      title: 'NET PROCEEDS',
      rows: [
        { label: 'Line 25 - After-Tax Sale Proceeds', value: fmt(w.line25_afterTaxProceeds), bold: true, highlight: 'positive' },
      ],
    },
  ];
}

export function formatCFAWForDisplay(data: CFAWExportData): WorksheetSection[] {
  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  
  const w = data.worksheet;
  
  const sections: WorksheetSection[] = [
    {
      title: 'INVESTMENT SUMMARY',
      rows: [
        { label: 'Property Name', value: w.propertyName },
        { label: 'Analysis Date', value: w.analysisDate.toLocaleDateString() },
        { label: 'Holding Period', value: `${w.holdingPeriodYears} years` },
        { label: 'Initial Equity Investment', value: fmt(w.investmentMetrics.initialEquity) },
      ],
    },
    {
      title: 'INVESTMENT METRICS',
      rows: [
        { label: 'Internal Rate of Return (IRR)', value: w.investmentMetrics.irr ? `${w.investmentMetrics.irr.toFixed(2)}%` : 'N/A', bold: true },
        { label: 'Equity Multiple', value: `${w.investmentMetrics.equityMultiple.toFixed(2)}x`, bold: true },
        { label: 'Average Cash-on-Cash', value: pct(w.investmentMetrics.averageCashOnCash) },
        { label: 'Average DSCR', value: w.investmentMetrics.averageDscr.toFixed(2) },
      ],
    },
    {
      title: 'EXIT ANALYSIS',
      rows: [
        { label: 'Sale Price', value: fmt(w.exitAnalysis.salePrice) },
        { label: 'Selling Costs', value: fmt(w.exitAnalysis.sellingCosts), highlight: 'negative' },
        { label: 'Net Sale Price', value: fmt(w.exitAnalysis.netSalePrice), bold: true },
        { label: 'Loan Payoff', value: fmt(w.exitAnalysis.loanPayoff), highlight: 'negative' },
        { label: 'Before-Tax Proceeds', value: fmt(w.exitAnalysis.beforeTaxProceeds), bold: true, highlight: 'positive' },
      ],
    },
    {
      title: 'TOTAL RETURNS',
      rows: [
        { label: 'Total Operating Cash Flow', value: fmt(w.investmentMetrics.totalCashFlow), highlight: 'positive' },
        { label: 'Exit Proceeds', value: fmt(w.investmentMetrics.exitProceeds), highlight: 'positive' },
        { label: 'Total Return', value: fmt(w.investmentMetrics.totalReturn), bold: true, highlight: 'positive' },
      ],
    },
  ];
  
  if (w.yearlyOperations.length > 0) {
    sections.push({
      title: 'YEARLY OPERATIONS',
      rows: w.yearlyOperations.map(y => ({
        label: `Year ${y.year}`,
        value: `NOI: ${fmt(y.noi)} | Cash Flow: ${fmt(y.netCashFlow)}`,
      })),
    });
  }
  
  return sections;
}

export function generateTextExport(sections: WorksheetSection[], title: string): string {
  const lines: string[] = [];
  const divider = '='.repeat(60);
  const subDivider = '-'.repeat(60);
  
  lines.push(divider);
  lines.push(title.toUpperCase());
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(divider);
  lines.push('');
  
  for (const section of sections) {
    lines.push(section.title);
    lines.push(subDivider);
    
    for (const row of section.rows) {
      const indent = '  '.repeat(row.indent || 0);
      const label = row.bold ? row.label.toUpperCase() : row.label;
      lines.push(`${indent}${label.padEnd(45)}${row.value}`);
    }
    
    lines.push('');
  }
  
  lines.push(divider);
  lines.push('CCIM INSTITUTE CERTIFIED COMMERCIAL INVESTMENT MEMBER');
  lines.push('This worksheet follows CCIM curriculum standards');
  lines.push(divider);
  
  return lines.join('\n');
}

export function generateCSVExport(sections: WorksheetSection[]): string {
  const rows: string[][] = [];
  
  rows.push(['Section', 'Label', 'Value']);
  
  for (const section of sections) {
    for (const row of section.rows) {
      rows.push([section.title, row.label, String(row.value)]);
    }
  }
  
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

export interface ExitScenarioExportBundle {
  scenarioName: string;
  scenarioType: string;
  exportDate: Date;
  
  acsw?: ACSWExportData;
  cfaw?: CFAWExportData;
  
  comparisonMetrics?: {
    scenarioId: string;
    scenarioName: string;
    irr: number | null;
    equityMultiple: number;
    afterTaxProceeds: number;
    taxLiability: number;
    holdingPeriod: number;
  }[];
}

export function bundleExitScenarioExport(
  scenarioName: string,
  scenarioType: string,
  acswData?: ACSWExportData,
  cfawData?: CFAWExportData
): ExitScenarioExportBundle {
  return {
    scenarioName,
    scenarioType,
    exportDate: new Date(),
    acsw: acswData,
    cfaw: cfawData,
  };
}

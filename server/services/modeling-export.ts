import * as XLSX from 'xlsx';
import { db } from '../db';
import { 
  modelingProjects, 
  modelingCases, 
  modelingCaseAssumptions,
  modelingCaseLeaseUp,
  modelingAddbacks,
  modelingAddbackValues
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface ExportOptions {
  caseId?: string;
  includeAllCases?: boolean;
  includeAddbacks?: boolean;
  includeLeaseUp?: boolean;
}

export async function exportModelingProjectToExcel(
  projectId: string,
  orgId: string,
  options: ExportOptions = {}
): Promise<Buffer> {
  const { 
    caseId, 
    includeAllCases = true, 
    includeAddbacks = true,
    includeLeaseUp = true 
  } = options;

  const project = await db.query.modelingProjects.findFirst({
    where: and(
      eq(modelingProjects.id, projectId),
      eq(modelingProjects.organizationId, orgId)
    ),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Project Summary
  const summaryData = [
    ['MODELING PROJECT EXPORT'],
    [''],
    ['Project Information'],
    ['Name', project.name],
    ['Description', project.description || 'N/A'],
    ['Property Name', project.propertyName || 'N/A'],
    ['Status', project.status || 'active'],
    ['Created', project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'],
    [''],
    ['Financial Overview'],
    ['Acquisition Price', formatCurrency(project.acquisitionPrice)],
    ['Cap Rate (%)', project.capRate || 'N/A'],
    ['Target Year', project.targetYear || new Date().getFullYear()],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: Cases Overview
  const allCases = await db.query.modelingCases.findMany({
    where: eq(modelingCases.projectId, projectId),
    orderBy: (cases, { desc }) => [desc(cases.isDefault), cases.name],
  });

  if (allCases.length > 0) {
    const casesHeaders = ['Case Name', 'Color', 'Is Default', 'Description', 'Created'];
    const casesRows = allCases.map(c => [
      c.name,
      c.color || 'blue',
      c.isDefault ? 'Yes' : 'No',
      c.description || '',
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
    ]);
    const casesData = [casesHeaders, ...casesRows];
    const casesSheet = XLSX.utils.aoa_to_sheet(casesData);
    casesSheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, casesSheet, 'Cases');
  }

  // Sheet 3+: Case Assumptions (for each case or selected case)
  const casesToExport = caseId 
    ? allCases.filter(c => c.id === caseId)
    : includeAllCases 
      ? allCases 
      : allCases.filter(c => c.isDefault);

  for (const modelCase of casesToExport) {
    const assumptions = await db.query.modelingCaseAssumptions.findFirst({
      where: eq(modelingCaseAssumptions.caseId, modelCase.id),
    });

    if (assumptions) {
      const sheetName = `${modelCase.name.substring(0, 25)} - Assumptions`;
      const assumptionsData = [
        [`ASSUMPTIONS - ${modelCase.name}`],
        [''],
        ['Revenue Assumptions'],
        ['Occupancy Rate (%)', assumptions.occupancyRate || ''],
        ['ADR (Average Daily Rate)', formatCurrency(assumptions.adr)],
        ['Rate Growth (%)', assumptions.rateGrowth || ''],
        [''],
        ['Operating Assumptions'],
        ['Operating Expense Ratio (%)', assumptions.opexRatio || ''],
        ['Management Fee (%)', assumptions.managementFee || ''],
        ['Insurance', formatCurrency(assumptions.insurance)],
        ['Property Tax', formatCurrency(assumptions.propertyTax)],
        ['Utilities', formatCurrency(assumptions.utilities)],
        ['R&M Reserve (%)', assumptions.rmReserve || ''],
        [''],
        ['Capital Assumptions'],
        ['CapEx Reserve (%)', assumptions.capexReserve || ''],
        ['Renovation Budget', formatCurrency(assumptions.renovationBudget)],
        [''],
        ['Exit Assumptions'],
        ['Exit Cap Rate (%)', assumptions.exitCapRate || ''],
        ['Hold Period (Years)', assumptions.holdPeriod || ''],
        ['Selling Costs (%)', assumptions.sellingCosts || ''],
        [''],
        ['Financing'],
        ['LTV (%)', assumptions.ltv || ''],
        ['Interest Rate (%)', assumptions.interestRate || ''],
        ['Amortization (Years)', assumptions.amortization || ''],
        ['Loan Term (Years)', assumptions.loanTerm || ''],
      ];
      const assumptionsSheet = XLSX.utils.aoa_to_sheet(assumptionsData);
      assumptionsSheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, assumptionsSheet, sheetName.substring(0, 31));
    }

    // Lease-up schedule for each case
    if (includeLeaseUp) {
      const leaseUpData = await db.query.modelingCaseLeaseUp.findMany({
        where: eq(modelingCaseLeaseUp.caseId, modelCase.id),
        orderBy: (lu, { asc }) => [asc(lu.month)],
      });

      if (leaseUpData.length > 0) {
        const leaseUpSheetName = `${modelCase.name.substring(0, 20)} - Lease-Up`;
        const leaseUpHeaders = ['Month', 'Occupancy (%)', 'Units Leased', 'Revenue', 'Notes'];
        const leaseUpRows = leaseUpData.map(lu => [
          lu.month,
          lu.occupancy || '',
          lu.unitsLeased || '',
          formatCurrency(lu.revenue),
          lu.notes || '',
        ]);
        const leaseUpSheetData = [leaseUpHeaders, ...leaseUpRows];
        const leaseUpSheet = XLSX.utils.aoa_to_sheet(leaseUpSheetData);
        leaseUpSheet['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, leaseUpSheet, leaseUpSheetName.substring(0, 31));
      }
    }
  }

  // Sheet: Addbacks (if enabled)
  if (includeAddbacks) {
    const addbacks = await db.query.modelingAddbacks.findMany({
      where: eq(modelingAddbacks.projectId, projectId),
      orderBy: (ab, { asc }) => [asc(ab.category), asc(ab.lineItem)],
    });

    if (addbacks.length > 0) {
      const addbackHeaders = ['Category', 'Line Item', 'Description', 'Reason', 'Period Type', 'Amount'];
      const addbackRows: any[][] = [];

      for (const addback of addbacks) {
        const values = await db.query.modelingAddbackValues.findMany({
          where: eq(modelingAddbackValues.addbackId, addback.id),
          orderBy: (v, { asc }) => [asc(v.periodType), asc(v.periodIndex)],
        });

        if (values.length === 0) {
          addbackRows.push([
            addback.category || '',
            addback.lineItem,
            addback.description || '',
            addback.reason || '',
            '',
            '',
          ]);
        } else {
          values.forEach((v, i) => {
            addbackRows.push([
              i === 0 ? (addback.category || '') : '',
              i === 0 ? addback.lineItem : '',
              i === 0 ? (addback.description || '') : '',
              i === 0 ? (addback.reason || '') : '',
              v.periodType === 'monthly' 
                ? `Month ${v.periodIndex}` 
                : v.periodType === 'yearly' 
                  ? `Year ${v.periodIndex}`
                  : v.periodType,
              formatCurrency(v.amount),
            ]);
          });
        }
      }

      const addbacksData = [addbackHeaders, ...addbackRows];
      const addbacksSheet = XLSX.utils.aoa_to_sheet(addbacksData);
      addbacksSheet['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(workbook, addbacksSheet, 'Addbacks');

      // Addbacks Summary
      const summaryByCategory = addbacks.reduce((acc, ab) => {
        const cat = ab.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = 0;
        acc[cat]++;
        return acc;
      }, {} as Record<string, number>);

      const addbacksSummaryData = [
        ['ADDBACKS SUMMARY'],
        [''],
        ['Category', 'Count'],
        ...Object.entries(summaryByCategory).map(([cat, count]) => [cat, count]),
        [''],
        ['Total Addback Items', addbacks.length],
      ];
      const addbacksSummarySheet = XLSX.utils.aoa_to_sheet(addbacksSummaryData);
      addbacksSummarySheet['!cols'] = [{ wch: 20 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(workbook, addbacksSummarySheet, 'Addbacks Summary');
    }
  }

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export async function exportCaseComparisonToExcel(
  projectId: string,
  orgId: string,
  caseIds: string[]
): Promise<Buffer> {
  const project = await db.query.modelingProjects.findFirst({
    where: and(
      eq(modelingProjects.id, projectId),
      eq(modelingProjects.organizationId, orgId)
    ),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const cases = await Promise.all(
    caseIds.map(async (id) => {
      const modelCase = await db.query.modelingCases.findFirst({
        where: and(
          eq(modelingCases.id, id),
          eq(modelingCases.projectId, projectId)
        ),
      });
      const assumptions = modelCase 
        ? await db.query.modelingCaseAssumptions.findFirst({
            where: eq(modelingCaseAssumptions.caseId, modelCase.id),
          })
        : null;
      return { case: modelCase, assumptions };
    })
  );

  const validCases = cases.filter(c => c.case !== null);

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Case Comparison Overview
  const headers = ['Parameter', ...validCases.map(c => c.case!.name)];
  const comparisonRows = [
    ['Color', ...validCases.map(c => c.case!.color || 'blue')],
    ['Is Default', ...validCases.map(c => c.case!.isDefault ? 'Yes' : 'No')],
    [''],
    ['REVENUE ASSUMPTIONS'],
    ['Occupancy Rate (%)', ...validCases.map(c => c.assumptions?.occupancyRate || '')],
    ['ADR', ...validCases.map(c => formatCurrency(c.assumptions?.adr))],
    ['Rate Growth (%)', ...validCases.map(c => c.assumptions?.rateGrowth || '')],
    [''],
    ['OPERATING ASSUMPTIONS'],
    ['OpEx Ratio (%)', ...validCases.map(c => c.assumptions?.opexRatio || '')],
    ['Management Fee (%)', ...validCases.map(c => c.assumptions?.managementFee || '')],
    ['Insurance', ...validCases.map(c => formatCurrency(c.assumptions?.insurance))],
    ['Property Tax', ...validCases.map(c => formatCurrency(c.assumptions?.propertyTax))],
    [''],
    ['EXIT ASSUMPTIONS'],
    ['Exit Cap Rate (%)', ...validCases.map(c => c.assumptions?.exitCapRate || '')],
    ['Hold Period (Years)', ...validCases.map(c => c.assumptions?.holdPeriod || '')],
    [''],
    ['FINANCING'],
    ['LTV (%)', ...validCases.map(c => c.assumptions?.ltv || '')],
    ['Interest Rate (%)', ...validCases.map(c => c.assumptions?.interestRate || '')],
  ];

  const comparisonData = [headers, ...comparisonRows];
  const comparisonSheet = XLSX.utils.aoa_to_sheet(comparisonData);
  comparisonSheet['!cols'] = [
    { wch: 25 },
    ...validCases.map(() => ({ wch: 18 }))
  ];
  XLSX.utils.book_append_sheet(workbook, comparisonSheet, 'Case Comparison');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

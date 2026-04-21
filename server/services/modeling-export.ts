import * as XLSX from 'xlsx';
import { db, pool } from '../db';
import { 
  modelingProjects, 
  modelingCases, 
  modelingCaseAssumptions,
  modelingAddbacks,
  modelingAddbackValues
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { loadLeaseIncomeForProject } from './dcf-calculator-service';

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

    // Lease-up schedule for each case - disabled until modelingCaseLeaseUp table is created
    // if (includeLeaseUp) {
    //   // Lease-up export would go here
    // }
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


  // Sheet: Pro Forma / Direct Input Financials
  const modelInputMode = (project as any).modelInputMode ?? 'auto';
  const customMetrics = (project.customMetrics as any) ?? {};
  const assetClass = (project as any).assetClass ?? 'marina';
  
  if (modelInputMode === 'direct_input' || customMetrics?.inputAssumptions) {
    try {
      const { computeDirectInputFinancials } = await import('./direct-input-engine');
      const inputAssumptions = customMetrics.inputAssumptions ?? {};
      const unitMix = customMetrics.unitMix ?? [];
      const computed = computeDirectInputFinancials(assetClass, inputAssumptions, unitMix);
      
      if (computed && (computed.revenueLines.length > 0 || computed.expenseLines.length > 0)) {
        const proFormaData: any[][] = [
          ['PRO FORMA - DIRECT INPUT FINANCIALS'],
          [''],
          ['Asset Class', assetClass],
          ['Input Mode', modelInputMode],
          [''],
          ['REVENUE', '', 'Annual Amount', 'Formula'],
        ];
        
        for (const line of computed.revenueLines) {
          proFormaData.push([
            '',
            line.label,
            formatCurrency(line.amount),
            line.formula || '',
          ]);
        }
        
        proFormaData.push(['', '', '', '']);
        proFormaData.push(['', 'Total Revenue', formatCurrency(computed.totalRevenue), '']);
        proFormaData.push(['']);
        proFormaData.push(['OPERATING EXPENSES', '', 'Annual Amount', 'Formula']);
        
        for (const line of computed.expenseLines) {
          proFormaData.push([
            '',
            line.label,
            formatCurrency(line.amount),
            line.formula || '',
          ]);
        }
        
        proFormaData.push(['', '', '', '']);
        proFormaData.push(['', 'Total Expenses', formatCurrency(computed.totalExpenses), '']);
        proFormaData.push(['']);
        proFormaData.push(['NET OPERATING INCOME (NOI)', '', formatCurrency(computed.noi), '']);
        
        // Unit Mix detail (if present)
        if (unitMix.length > 0) {
          proFormaData.push(['']);
          proFormaData.push(['UNIT MIX DETAIL']);
          proFormaData.push(['', 'Unit Type', 'Count', 'Rate', 'Occupancy']);
          for (const unit of unitMix) {
            const rate = unit.monthlyRent ?? unit.nightlyRate ?? 0;
            const rateLabel = unit.nightlyRate ? `$${rate}/night` : `$${rate}/mo`;
            proFormaData.push([
              '',
              unit.label || unit.name || 'Unit',
              unit.count ?? 1,
              rateLabel,
              unit.occupancy ? `${(unit.occupancy * 100).toFixed(1)}%` : 'N/A',
            ]);
          }
        }
        
        const proFormaSheet = XLSX.utils.aoa_to_sheet(proFormaData);
        proFormaSheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(workbook, proFormaSheet, 'Pro Forma');
      }
    } catch (proFormaError) {
      console.error('[Export] Failed to compute pro forma sheet:', proFormaError);
    }
  }

  // Sheet: Lease Income Summary (EGI — in-place vs. stabilized)
  try {
    const leaseIncome = await loadLeaseIncomeForProject(pool, projectId);
    if (leaseIncome.hasLeases) {
      const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
      const leaseSheetData: any[][] = [
        ['LEASE INCOME SUMMARY'],
        [''],
        ['EGI Overview', '', 'Annual Amount'],
        ['In-Place EGI (active leases only)', '', formatCurrency(leaseIncome.inPlaceEGIAnnual)],
        ['Stabilized EGI (incl. pre-leased)', '', formatCurrency(leaseIncome.stabilizedEGIAnnual)],
        [''],
        ['Detail', '', ''],
        ['Total Base Rent (Annual)', '', formatCurrency(leaseIncome.totalBaseRentAnnual)],
        ['Total Recovery Income (Annual)', '', formatCurrency(leaseIncome.totalRecoveryAnnual)],
        ['Lease Count', '', leaseIncome.leaseCount],
        ['Wtd. Avg. Escalation Rate', '', pct(leaseIncome.weightedAvgEscalationRate)],
        [''],
        ['Note: In-Place EGI includes only leases with a start date on or before today.'],
        ['Stabilized EGI adds pre-leased (future) spaces whose leases are already signed.'],
      ];

      if (leaseIncome.leaseBreakdown.length > 0) {
        leaseSheetData.push(['']);
        leaseSheetData.push(['LEASE BREAKDOWN']);
        leaseSheetData.push([
          'Tenant',
          'SF',
          'Lease Type',
          'Base Rent (Annual)',
          'Recovery (Annual)',
          'Total EGI (Annual)',
          'Status',
        ]);
        for (const lease of leaseIncome.leaseBreakdown) {
          leaseSheetData.push([
            lease.tenantName || 'Unknown',
            lease.sf ?? '',
            lease.leaseType || '',
            formatCurrency(lease.baseRentAnnual),
            formatCurrency(lease.recoveryAnnual),
            formatCurrency(lease.baseRentAnnual + lease.recoveryAnnual),
            lease.isFuture ? 'Pre-Leased (Future)' : 'In-Place',
          ]);
        }
      }

      const leaseSheet = XLSX.utils.aoa_to_sheet(leaseSheetData);
      leaseSheet['!cols'] = [
        { wch: 38 }, { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(workbook, leaseSheet, 'Lease Income (EGI)');
    }
  } catch (leaseErr) {
    console.error('[Export] Lease income sheet generation failed:', leaseErr);
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


  // ─── DCF Analysis Sheet (from refactored DCF engine) ────────────────────
  try {
    const { computeDirectInputFinancials } = await import('./direct-input-engine');
    const { computeMultiYearProjection } = await import('./multi-year-projection-engine');
    const { calculateXIRR, calculateEquityMultiple } = await import('../../shared/finance/xirr');

    const customMetrics = typeof project.customMetrics === 'string'
      ? JSON.parse(project.customMetrics)
      : project.customMetrics || {};
    const inputAssumptions = customMetrics.inputAssumptions || {};
    const unitMix = customMetrics.unitMix || [];

    if (Object.keys(inputAssumptions).length > 0) {
      const year1 = computeDirectInputFinancials(project.assetClass || 'str', inputAssumptions, unitMix);
      const projection = computeMultiYearProjection(year1, {
        holdPeriod: 5,
        revenueGrowthRate: 0.03,
        expenseGrowthRate: 0.025,
        exitCapRate: 0.065,
        sellingCostPct: 0.03,
      });

      const purchasePrice = Number(project.purchasePrice) || 0;
      const equityInvested = purchasePrice;
      const acqDate = new Date().toISOString().split('T')[0];
      const flows = [
        { date: acqDate, amount: -equityInvested },
        ...projection.years.map((y: any, i: number) => {
          const d = new Date(acqDate);
          d.setFullYear(d.getFullYear() + y.year);
          const isLast = i === projection.years.length - 1;
          return {
            date: d.toISOString().split('T')[0],
            amount: y.ncf + (isLast ? projection.exit.netSaleProceeds : 0),
          };
        }),
      ];

      const irrResult = calculateXIRR(flows);
      const em = calculateEquityMultiple(flows);
      const irr = irrResult;

      const dcfData: any[][] = [
        ['DCF Analysis'],
        [],
        ['Key Metrics'],
        ['IRR', irrResult.irr ? (irrResult.irr / 100).toFixed(4) : 'N/A'],
        ['Equity Multiple', em ? em.toFixed(2) + 'x' : 'N/A'],
        ['Purchase Price', purchasePrice],
        [],
        ['Cash Flow Projections'],
        ['Year', 'Revenue', 'Expenses', 'NOI', 'CapEx', 'NCF'],
        ...projection.years.map((y: any) => [
          y.label, y.totalRevenue, y.totalExpenses, y.noi, y.capex, y.ncf,
        ]),
        [],
        ['Exit Analysis'],
        ['Exit NOI', projection.exit.exitNOI],
        ['Exit Value', projection.exit.exitValue],
        ['Selling Costs', projection.exit.sellingCosts],
        ['Net Sale Proceeds', projection.exit.netSaleProceeds],
      ];

      // Append lease EGI section to DCF sheet if lease data exists
      try {
        const leaseIncome = await loadLeaseIncomeForProject(pool, projectId);
        if (leaseIncome.hasLeases) {
          dcfData.push([]);
          dcfData.push(['Lease Income (EGI)']);
          dcfData.push(['In-Place EGI (active leases only)', leaseIncome.inPlaceEGIAnnual]);
          dcfData.push(['Stabilized EGI (incl. pre-leased)', leaseIncome.stabilizedEGIAnnual]);
          dcfData.push(['Lease Count', leaseIncome.leaseCount]);
          dcfData.push(['Wtd. Avg. Escalation Rate', `${(leaseIncome.weightedAvgEscalationRate * 100).toFixed(2)}%`]);
        }
      } catch {
        // Non-fatal — DCF sheet continues without lease EGI rows
      }

      const dcfSheet = XLSX.utils.aoa_to_sheet(dcfData);
      dcfSheet['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, dcfSheet, 'DCF Analysis');
    }
  } catch (dcfErr) {
    console.error('[Export] DCF sheet generation failed:', dcfErr);
    // Non-fatal — export continues without DCF sheet
  }


  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

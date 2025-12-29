import { db } from '../../db';
import {
  pnlFacts,
  pnlCanonicalLineItems,
  pnlDocuments,
  type PnlFact,
  type PnlCanonicalLineItem,
} from '@shared/schema';
import { eq, and, gte, lte, sql, asc, desc } from 'drizzle-orm';

export interface PnlAggregationOptions {
  from?: Date;
  to?: Date;
  periodType?: 'month' | 'quarter' | 'year';
  fiscalYear?: number;
  groupBy?: 'department' | 'section' | 'canonicalItem' | 'period';
}

export interface AggregatedLineItem {
  canonicalKey: string;
  displayName: string;
  department: string;
  section: string;
  totalValue: number;
  periodValues: Record<string, number>;
  factCount: number;
}

export interface DepartmentSummary {
  department: string;
  revenue: number;
  cogs: number;
  expense: number;
  payroll: number;
  grossProfit: number;
  netIncome: number;
}

export interface PnlAggregationResult {
  assetId: string;
  orgId: string;
  dateRange: { from: string; to: string };
  periodType: string;
  summary: {
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    grossMargin: number;
    totalExpense: number;
    totalPayroll: number;
    operatingExpense: number;
    noi: number;
    noiMargin: number;
    ebitda: number;
    ebitdaMargin: number;
  };
  byDepartment: DepartmentSummary[];
  bySection: Record<string, number>;
  lineItems: AggregatedLineItem[];
  documentCount: number;
  factCount: number;
}

export async function getPnlForMarina(
  orgId: string,
  assetId: string,
  options: PnlAggregationOptions = {}
): Promise<PnlAggregationResult> {
  const {
    from,
    to,
    periodType,
    fiscalYear,
  } = options;

  const conditions: any[] = [
    eq(pnlFacts.orgId, orgId),
    eq(pnlFacts.assetId, assetId),
  ];

  if (from) {
    conditions.push(gte(pnlFacts.periodStart, from));
  }
  if (to) {
    conditions.push(lte(pnlFacts.periodEnd, to));
  }
  if (periodType) {
    conditions.push(eq(pnlFacts.periodType, periodType));
  }
  if (fiscalYear) {
    conditions.push(eq(pnlFacts.fiscalYear, fiscalYear));
  }

  const facts = await db.query.pnlFacts.findMany({
    where: and(...conditions),
    with: {
      canonicalLineItem: true,
    },
  });

  const canonicalItems = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });
  const canonicalMap = new Map(canonicalItems.map(c => [c.id, c]));

  const documentIds = new Set(facts.map(f => f.documentId));

  const lineItemMap = new Map<string, AggregatedLineItem>();
  const departmentMap = new Map<string, DepartmentSummary>();
  const sectionTotals: Record<string, number> = {
    revenue: 0,
    cogs: 0,
    expense: 0,
    payroll: 0,
    other: 0,
  };

  for (const fact of facts) {
    const canonical = canonicalMap.get(fact.canonicalLineItemId);
    if (!canonical) continue;

    const value = Number(fact.value) || 0;
    const periodKey = `${fact.fiscalYear}-${fact.fiscalPeriod}`;

    if (!lineItemMap.has(canonical.canonicalKey)) {
      lineItemMap.set(canonical.canonicalKey, {
        canonicalKey: canonical.canonicalKey,
        displayName: canonical.displayName,
        department: canonical.department,
        section: canonical.section,
        totalValue: 0,
        periodValues: {},
        factCount: 0,
      });
    }
    const lineItem = lineItemMap.get(canonical.canonicalKey)!;
    lineItem.totalValue += value;
    lineItem.periodValues[periodKey] = (lineItem.periodValues[periodKey] || 0) + value;
    lineItem.factCount++;

    sectionTotals[canonical.section] = (sectionTotals[canonical.section] || 0) + value;

    if (!departmentMap.has(canonical.department)) {
      departmentMap.set(canonical.department, {
        department: canonical.department,
        revenue: 0,
        cogs: 0,
        expense: 0,
        payroll: 0,
        grossProfit: 0,
        netIncome: 0,
      });
    }
    const dept = departmentMap.get(canonical.department)!;
    switch (canonical.section) {
      case 'revenue':
        dept.revenue += value;
        break;
      case 'cogs':
        dept.cogs += value;
        break;
      case 'expense':
        dept.expense += value;
        break;
      case 'payroll':
        dept.payroll += value;
        break;
    }
  }

  for (const dept of departmentMap.values()) {
    dept.grossProfit = dept.revenue - dept.cogs;
    dept.netIncome = dept.grossProfit - dept.expense - dept.payroll;
  }

  const totalRevenue = sectionTotals.revenue || 0;
  const totalCogs = sectionTotals.cogs || 0;
  const grossProfit = totalRevenue - totalCogs;
  const totalExpense = sectionTotals.expense || 0;
  const totalPayroll = sectionTotals.payroll || 0;
  const operatingExpense = totalExpense + totalPayroll;
  const noi = grossProfit - operatingExpense;
  const ebitda = noi;

  const dateFrom = from?.toISOString() || facts[0]?.periodStart?.toISOString() || '';
  const dateTo = to?.toISOString() || facts[facts.length - 1]?.periodEnd?.toISOString() || '';

  return {
    assetId,
    orgId,
    dateRange: { from: dateFrom, to: dateTo },
    periodType: periodType || 'mixed',
    summary: {
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMargin: totalRevenue ? (grossProfit / totalRevenue) * 100 : 0,
      totalExpense,
      totalPayroll,
      operatingExpense,
      noi,
      noiMargin: totalRevenue ? (noi / totalRevenue) * 100 : 0,
      ebitda,
      ebitdaMargin: totalRevenue ? (ebitda / totalRevenue) * 100 : 0,
    },
    byDepartment: Array.from(departmentMap.values()).sort((a, b) => b.revenue - a.revenue),
    bySection: sectionTotals,
    lineItems: Array.from(lineItemMap.values()).sort((a, b) => {
      if (a.section !== b.section) {
        const sectionOrder = ['revenue', 'cogs', 'expense', 'payroll', 'other'];
        return sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section);
      }
      return b.totalValue - a.totalValue;
    }),
    documentCount: documentIds.size,
    factCount: facts.length,
  };
}

export async function getPnlTimeSeries(
  orgId: string,
  assetId: string,
  options: {
    fiscalYears?: number[];
    periodType?: 'month' | 'quarter' | 'year';
    sections?: string[];
  } = {}
): Promise<{
  periods: Array<{
    fiscalYear: number;
    fiscalPeriod: number;
    periodLabel: string;
    revenue: number;
    cogs: number;
    grossProfit: number;
    expense: number;
    payroll: number;
    noi: number;
  }>;
}> {
  const { fiscalYears, periodType, sections } = options;

  const conditions: any[] = [
    eq(pnlFacts.orgId, orgId),
    eq(pnlFacts.assetId, assetId),
  ];

  if (periodType) {
    conditions.push(eq(pnlFacts.periodType, periodType));
  }

  const facts = await db.query.pnlFacts.findMany({
    where: and(...conditions),
    with: {
      canonicalLineItem: true,
    },
    orderBy: [asc(pnlFacts.fiscalYear), asc(pnlFacts.fiscalPeriod)],
  });

  const canonicalItems = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });
  const canonicalMap = new Map(canonicalItems.map(c => [c.id, c]));

  const periodMap = new Map<string, {
    fiscalYear: number;
    fiscalPeriod: number;
    revenue: number;
    cogs: number;
    expense: number;
    payroll: number;
  }>();

  for (const fact of facts) {
    const canonical = canonicalMap.get(fact.canonicalLineItemId);
    if (!canonical) continue;

    if (fiscalYears && !fiscalYears.includes(fact.fiscalYear)) continue;
    if (sections && !sections.includes(canonical.section)) continue;

    const key = `${fact.fiscalYear}-${fact.fiscalPeriod}`;
    if (!periodMap.has(key)) {
      periodMap.set(key, {
        fiscalYear: fact.fiscalYear,
        fiscalPeriod: fact.fiscalPeriod,
        revenue: 0,
        cogs: 0,
        expense: 0,
        payroll: 0,
      });
    }

    const period = periodMap.get(key)!;
    const value = Number(fact.value) || 0;

    switch (canonical.section) {
      case 'revenue':
        period.revenue += value;
        break;
      case 'cogs':
        period.cogs += value;
        break;
      case 'expense':
        period.expense += value;
        break;
      case 'payroll':
        period.payroll += value;
        break;
    }
  }

  const periods = Array.from(periodMap.values())
    .sort((a, b) => {
      if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
      return a.fiscalPeriod - b.fiscalPeriod;
    })
    .map(p => ({
      ...p,
      periodLabel: periodType === 'month'
        ? `${p.fiscalYear}-${String(p.fiscalPeriod).padStart(2, '0')}`
        : periodType === 'quarter'
        ? `${p.fiscalYear} Q${p.fiscalPeriod}`
        : `FY ${p.fiscalYear}`,
      grossProfit: p.revenue - p.cogs,
      noi: p.revenue - p.cogs - p.expense - p.payroll,
    }));

  return { periods };
}

export async function getPnlComparisonYoY(
  orgId: string,
  assetId: string,
  options: {
    baseYear: number;
    compareYear: number;
    periodType?: 'month' | 'quarter' | 'year';
  }
): Promise<{
  baseYear: number;
  compareYear: number;
  comparison: Array<{
    metric: string;
    baseValue: number;
    compareValue: number;
    change: number;
    changePercent: number;
  }>;
}> {
  const baseResult = await getPnlForMarina(orgId, assetId, {
    fiscalYear: options.baseYear,
    periodType: options.periodType,
  });

  const compareResult = await getPnlForMarina(orgId, assetId, {
    fiscalYear: options.compareYear,
    periodType: options.periodType,
  });

  const metrics = [
    { key: 'totalRevenue', label: 'Total Revenue' },
    { key: 'totalCogs', label: 'Cost of Goods Sold' },
    { key: 'grossProfit', label: 'Gross Profit' },
    { key: 'totalExpense', label: 'Operating Expenses' },
    { key: 'totalPayroll', label: 'Payroll' },
    { key: 'noi', label: 'Net Operating Income' },
    { key: 'ebitda', label: 'EBITDA' },
  ];

  const comparison = metrics.map(m => {
    const baseValue = (baseResult.summary as any)[m.key] || 0;
    const compareValue = (compareResult.summary as any)[m.key] || 0;
    const change = compareValue - baseValue;
    const changePercent = baseValue ? (change / baseValue) * 100 : 0;

    return {
      metric: m.label,
      baseValue,
      compareValue,
      change,
      changePercent,
    };
  });

  return {
    baseYear: options.baseYear,
    compareYear: options.compareYear,
    comparison,
  };
}

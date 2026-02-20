/**
 * PATCH: Shared Canonical Actuals Loader
 * 
 * This module extracts the shared logic for loading, normalizing, and resolving
 * actuals data that was previously duplicated between getHistoricalPL() and
 * generateProForma() with subtle differences causing data mismatches.
 * 
 * BOTH functions should call loadCanonicalActuals() to get identical data.
 * 
 * Place this in: server/services/canonical-actuals-loader.ts
 * Then import into pro-forma-engine-service.ts
 */

import { db } from '../db';
import {
  modelingActuals,
  modelingProjects,
  modelingPnlOverrides,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { inferDepartment } from '../utils/department-mapping';

export interface CanonicalLineItem {
  /** Grouping key — always: subcategory || category || 'Other' */
  key: string;
  /** Normalized category: 'Revenue' | 'COGS' | 'Expenses' */
  category: string;
  /** Resolved department (overrides applied) */
  department: string;
  /** Monthly amounts: { monthNumber: amount } */
  monthlyAmounts: Record<number, number>;
  /** Sum of all monthly amounts */
  total: number;
}

export interface CanonicalActualsResult {
  revenueItems: CanonicalLineItem[];
  cogsItems: CanonicalLineItem[];
  expenseItems: CanonicalLineItem[];
  totalRevenue: number;
  totalCOGS: number;
  totalExpenses: number;
  grossProfit: number;
  noi: number;
}

/**
 * Normalize a raw category string to one of the canonical categories.
 * 
 * IMPORTANT: This is the SINGLE source of truth for category normalization.
 * It is used by both getHistoricalPL() and generateProForma() to ensure
 * identical categorization of the same underlying data.
 */
export function normalizeCategory(rawCategory: string): string {
  const catNorm = rawCategory.toLowerCase().trim();
  
  if (catNorm === 'revenue') return 'Revenue';
  
  if (catNorm === 'cogs' || catNorm === 'cost_of_goods_sold' || catNorm === 'cost of goods sold') return 'COGS';
  
  // NOTE: Payroll is intentionally merged into Expenses for the P&L waterfall.
  // If you want Payroll as a separate section, change this to return 'Payroll'
  // and add corresponding handling in getHistoricalPL/generateProForma.
  if (
    catNorm === 'expenses' || 
    catNorm === 'expense' || 
    catNorm === 'operating expenses' || 
    catNorm === 'opex' || 
    catNorm === 'payroll'
  ) return 'Expenses';
  
  return rawCategory;
}

/**
 * Load actuals for a project and return them as canonically-normalized line items.
 * 
 * This function:
 * 1. Loads all modelingActuals for the project
 * 2. Applies PNL overrides (excludes, department overrides, category overrides)
 * 3. Normalizes categories using the shared normalizeCategory() function
 * 4. Resolves departments using a consistent priority chain
 * 5. Groups by subcategory key (consistent: subcategory || category || 'Other')
 * 
 * Both getHistoricalPL() and generateProForma() MUST use this function
 * to ensure identical data for the same year.
 */
export async function loadCanonicalActuals(
  projectId: string,
  orgId: string,
  year?: number
): Promise<{
  items: CanonicalLineItem[];
  categorized: CanonicalActualsResult;
  /** All unique years in the actuals data */
  availableYears: number[];
  /** The latest historical year */
  latestYear: number | null;
}> {
  // 1. Load PNL overrides
  const pnlOverrides = await db.select()
    .from(modelingPnlOverrides)
    .where(and(
      eq(modelingPnlOverrides.projectId, projectId),
      eq(modelingPnlOverrides.orgId, orgId)
    ));
  
  const excludeSet = new Set(
    pnlOverrides.filter(o => o.overrideType === 'exclude' && o.isActive).map(o => o.lineItemKey)
  );
  const deptOverrideMap: Record<string, string> = {};
  pnlOverrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideDepartment)
    .forEach(o => { deptOverrideMap[o.lineItemKey] = o.overrideDepartment!; });
  const categoryOverrideMap: Record<string, string> = {};
  pnlOverrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideCategory)
    .forEach(o => { categoryOverrideMap[o.lineItemKey] = o.overrideCategory!; });

  // 2. Load all actuals
  const allActuals = await db.select()
    .from(modelingActuals)
    .where(eq(modelingActuals.modelingProjectId, projectId));
  
  // 3. Apply excludes and category overrides
  const actuals = allActuals
    .filter(a => !excludeSet.has(a.subcategory || ''))
    .map(a => {
      const catOverride = categoryOverrideMap[a.subcategory || ''];
      if (catOverride) {
        return { ...a, category: catOverride };
      }
      return a;
    });
  
  // Determine available years
  const availableYears = Array.from(new Set(actuals.map(a => a.year).filter((y): y is number => y !== null))).sort((a, b) => a - b);
  const latestYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : null;
  
  // 4. Filter to requested year
  const relevantActuals = year
    ? actuals.filter(a => a.year === year)
    : actuals;
  
  // 5. Group by subcategory, normalize categories, resolve departments
  const lineItems: Record<string, {
    monthlyAmounts: Record<number, number>;
    category: string;
    department: string;
  }> = {};
  
  for (const actual of relevantActuals) {
    // CONSISTENT key: always subcategory || category || 'Other'
    // (Previously, generateProForma used lineItem as fallback instead of category)
    const key = actual.subcategory || actual.category || 'Other';
    const month = actual.month || 1;
    const amount = parseFloat(actual.amount?.toString() || '0');
    
    if (!lineItems[key]) {
      // Normalize category using the SHARED function
      const rawCat = categoryOverrideMap[key] || actual.category || 'Other';
      const normalizedCat = normalizeCategory(rawCat);
      
      // Resolve department with consistent priority chain:
      // 1. PNL override → 2. actual.department (from promote-to-actuals) → 3. heuristic
      const department = deptOverrideMap[key] || actual.department || inferDepartment(key, normalizedCat);
      
      lineItems[key] = {
        monthlyAmounts: {},
        category: normalizedCat,
        department,
      };
    }
    
    lineItems[key].monthlyAmounts[month] = (lineItems[key].monthlyAmounts[month] || 0) + amount;
  }
  
  // 6. Build output arrays
  const items: CanonicalLineItem[] = [];
  const revenueItems: CanonicalLineItem[] = [];
  const cogsItems: CanonicalLineItem[] = [];
  const expenseItems: CanonicalLineItem[] = [];
  
  for (const [key, data] of Object.entries(lineItems)) {
    const monthlyArr = Array.from({ length: 12 }, (_, i) => data.monthlyAmounts[i + 1] || 0);
    const total = monthlyArr.reduce((sum, v) => sum + v, 0);
    
    const item: CanonicalLineItem = {
      key,
      category: data.category,
      department: data.department,
      monthlyAmounts: data.monthlyAmounts,
      total,
    };
    
    items.push(item);
    
    if (data.category === 'Revenue') {
      revenueItems.push(item);
    } else if (data.category === 'COGS') {
      cogsItems.push(item);
    } else if (data.category === 'Expenses') {
      expenseItems.push(item);
    } else {
      // Unknown → default to expenses (conservative)
      console.warn(`[Canonical Actuals] Unknown category "${data.category}" for "${key}" — defaulting to Expenses`);
      expenseItems.push({ ...item, category: 'Expenses' });
    }
  }
  
  const totalRevenue = revenueItems.reduce((sum, item) => sum + item.total, 0);
  const totalCOGS = cogsItems.reduce((sum, item) => sum + item.total, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.total, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const noi = grossProfit - totalExpenses;
  
  return {
    items,
    categorized: {
      revenueItems,
      cogsItems,
      expenseItems,
      totalRevenue,
      totalCOGS,
      totalExpenses,
      grossProfit,
      noi,
    },
    availableYears,
    latestYear,
  };
}

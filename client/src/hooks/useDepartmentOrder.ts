import { useState, useEffect, useCallback } from 'react';

const DEFAULT_REVENUE_COGS_ORDER = [
  'Storage',
  'Fuel',
  'Service',
  'Boat Sales',
  'Boat Brokerage',
  'Marina & Amenities',
  "Ship's Store",
  'General',
];

const DEFAULT_EXPENSES_ORDER = [
  'Payroll',
  'Marina & Amenities',
  'Storage',
  'Fuel',
  'Service',
  'Boat Sales',
  'Boat Brokerage',
  "Ship's Store",
  'General',
];

function getStorageKey(section: 'revenueCogs' | 'expenses'): string {
  return `marinamatch-dept-order-${section}`;
}

function loadOrder(section: 'revenueCogs' | 'expenses'): string[] {
  try {
    const stored = localStorage.getItem(getStorageKey(section));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return section === 'revenueCogs' ? DEFAULT_REVENUE_COGS_ORDER : DEFAULT_EXPENSES_ORDER;
}

export function useDepartmentOrder() {
  const [revenueCogsOrder, setRevenueCogsOrder] = useState<string[]>(() => loadOrder('revenueCogs'));
  const [expensesOrder, setExpensesOrder] = useState<string[]>(() => loadOrder('expenses'));

  const updateRevenueCogsOrder = useCallback((newOrder: string[]) => {
    setRevenueCogsOrder(newOrder);
    try { localStorage.setItem(getStorageKey('revenueCogs'), JSON.stringify(newOrder)); } catch {}
  }, []);

  const updateExpensesOrder = useCallback((newOrder: string[]) => {
    setExpensesOrder(newOrder);
    try { localStorage.setItem(getStorageKey('expenses'), JSON.stringify(newOrder)); } catch {}
  }, []);

  const resetRevenueCogsOrder = useCallback(() => {
    setRevenueCogsOrder(DEFAULT_REVENUE_COGS_ORDER);
    try { localStorage.removeItem(getStorageKey('revenueCogs')); } catch {}
  }, []);

  const resetExpensesOrder = useCallback(() => {
    setExpensesOrder(DEFAULT_EXPENSES_ORDER);
    try { localStorage.removeItem(getStorageKey('expenses')); } catch {}
  }, []);

  const sortDepartments = useCallback((departments: string[], category?: string): string[] => {
    const isExpenses = category === 'Expenses' || category === 'expenses';
    const order = isExpenses ? expensesOrder : revenueCogsOrder;
    return [...departments].sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      const posA = idxA === -1 ? order.length : idxA;
      const posB = idxB === -1 ? order.length : idxB;
      return posA - posB;
    });
  }, [revenueCogsOrder, expensesOrder]);

  return {
    revenueCogsOrder,
    expensesOrder,
    updateRevenueCogsOrder,
    updateExpensesOrder,
    resetRevenueCogsOrder,
    resetExpensesOrder,
    sortDepartments,
    DEFAULT_REVENUE_COGS_ORDER,
    DEFAULT_EXPENSES_ORDER,
  };
}

import { useState, useEffect, useCallback } from 'react';

const DEFAULT_DEPARTMENT_ORDER = [
  'Storage',
  'Fuel',
  'Service',
  'Boat Sales',
  'Boat Brokerage',
  'Marina & Amenities',
  "Ship's Store",
  'Payroll',
  'General',
];

function getStorageKey(orgId?: string): string {
  return `marinamatch-dept-order${orgId ? `-${orgId}` : ''}`;
}

export function useDepartmentOrder(orgId?: string) {
  const [departmentOrder, setDepartmentOrder] = useState<string[]>(DEFAULT_DEPARTMENT_ORDER);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(orgId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDepartmentOrder(parsed);
        }
      }
    } catch {
    }
  }, [orgId]);

  const updateOrder = useCallback((newOrder: string[]) => {
    setDepartmentOrder(newOrder);
    try {
      localStorage.setItem(getStorageKey(orgId), JSON.stringify(newOrder));
    } catch {
    }
  }, [orgId]);

  const resetOrder = useCallback(() => {
    setDepartmentOrder(DEFAULT_DEPARTMENT_ORDER);
    try {
      localStorage.removeItem(getStorageKey(orgId));
    } catch {
    }
  }, [orgId]);

  const sortDepartments = useCallback((departments: string[]): string[] => {
    return [...departments].sort((a, b) => {
      const idxA = departmentOrder.indexOf(a);
      const idxB = departmentOrder.indexOf(b);
      const posA = idxA === -1 ? departmentOrder.length : idxA;
      const posB = idxB === -1 ? departmentOrder.length : idxB;
      return posA - posB;
    });
  }, [departmentOrder]);

  return {
    departmentOrder,
    updateOrder,
    resetOrder,
    sortDepartments,
    DEFAULT_DEPARTMENT_ORDER,
  };
}

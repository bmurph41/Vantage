import { useState, useEffect, useCallback } from "react";
import type { ColumnConfig } from "@/components/settings/ColumnCustomizer";

const STORAGE_KEY_PREFIX = 'vantage_columns_';

const DEFAULT_SALES_COMPS_COLUMNS: ColumnConfig[] = [
  { key: 'marina', label: 'Marina', visible: true, sortable: true, type: 'text' },
  { key: 'location', label: 'Location', visible: true, sortable: true, type: 'text' },
  { key: 'state', label: 'State', visible: true, sortable: true, type: 'text' },
  { key: 'saleDate', label: 'Sale Date', visible: true, sortable: true, type: 'date' },
  { key: 'salePrice', label: 'Sale Price', visible: true, sortable: true, type: 'currency' },
  { key: 'seller', label: 'Seller', visible: true, sortable: true, type: 'text' },
  { key: 'buyer', label: 'Buyer', visible: true, sortable: true, type: 'text' },
  { key: 'wetSlips', label: 'Wet Slips', visible: true, sortable: true, type: 'number' },
  { key: 'drySlips', label: 'Dry Slips', visible: true, sortable: true, type: 'number' },
  { key: 'moorings', label: 'Moorings', visible: false, sortable: true, type: 'number' },
  { key: 'capRate', label: 'Cap Rate', visible: true, sortable: true, type: 'percent' },
  { key: 'pricePerSlip', label: 'Price/Slip', visible: true, sortable: true, type: 'currency' },
  { key: 'noi', label: 'NOI', visible: false, sortable: true, type: 'currency' },
  { key: 'grossRevenue', label: 'Gross Revenue', visible: false, sortable: true, type: 'currency' },
  { key: 'occupancy', label: 'Occupancy', visible: false, sortable: true, type: 'percent' },
  { key: 'waterType', label: 'Water Type', visible: true, sortable: true, type: 'text' },
  { key: 'bodyOfWater', label: 'Body of Water', visible: false, sortable: true, type: 'text' },
  { key: 'transactionType', label: 'Transaction Type', visible: false, sortable: true, type: 'text' },
  { key: 'broker', label: 'Broker', visible: false, sortable: true, type: 'text' },
  { key: 'notes', label: 'Notes', visible: false, sortable: false, type: 'text' },
  { key: 'actions', label: 'Actions', visible: true, sortable: false },
];

const DEFAULT_RATE_COMPS_COLUMNS: ColumnConfig[] = [
  { key: 'marina', label: 'Marina', visible: true, sortable: true, type: 'text' },
  { key: 'location', label: 'Location', visible: true, sortable: true, type: 'text' },
  { key: 'storageType', label: 'Storage Type', visible: true, sortable: true, type: 'text' },
  { key: 'boatSize', label: 'Boat Size', visible: true, sortable: true, type: 'text' },
  { key: 'rateAmount', label: 'Rate', visible: true, sortable: true, type: 'currency' },
  { key: 'rateType', label: 'Rate Type', visible: true, sortable: true, type: 'text' },
  { key: 'ratePeriod', label: 'Period', visible: true, sortable: true, type: 'text' },
  { key: 'seasonality', label: 'Seasonality', visible: true, sortable: true, type: 'text' },
  { key: 'electricIncluded', label: 'Electric', visible: true, sortable: true, type: 'boolean' },
  { key: 'protectionLevel', label: 'Protection', visible: true, sortable: true, type: 'text' },
  { key: 'effectiveDate', label: 'Effective Date', visible: true, sortable: true, type: 'date' },
  { key: 'rateCollectionDate', label: 'Collection Date', visible: false, sortable: true, type: 'date' },
  { key: 'rateSource', label: 'Source', visible: false, sortable: true, type: 'text' },
  { key: 'rateTrend', label: 'Trend', visible: false, sortable: true, type: 'text' },
  { key: 'waterType', label: 'Water Type', visible: false, sortable: true, type: 'text' },
  { key: 'bodyOfWater', label: 'Body of Water', visible: false, sortable: true, type: 'text' },
  { key: 'notes', label: 'Notes', visible: false, sortable: false, type: 'text' },
  { key: 'actions', label: 'Actions', visible: true, sortable: false },
];

export function useColumnSettings() {
  const [salesCompsColumns, setSalesCompsColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}salesComps`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading sales comps columns:', e);
    }
    return DEFAULT_SALES_COMPS_COLUMNS;
  });

  const [rateCompsColumns, setRateCompsColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}rateComps`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading rate comps columns:', e);
    }
    return DEFAULT_RATE_COMPS_COLUMNS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}salesComps`, JSON.stringify(salesCompsColumns));
    } catch (e) {
      console.error('Error saving sales comps columns:', e);
    }
  }, [salesCompsColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}rateComps`, JSON.stringify(rateCompsColumns));
    } catch (e) {
      console.error('Error saving rate comps columns:', e);
    }
  }, [rateCompsColumns]);

  const updateSalesCompsColumns = useCallback((columns: ColumnConfig[]) => {
    setSalesCompsColumns(columns);
  }, []);

  const updateRateCompsColumns = useCallback((columns: ColumnConfig[]) => {
    setRateCompsColumns(columns);
  }, []);

  const resetToDefaults = useCallback((module: 'salesComps' | 'rateComps') => {
    if (module === 'salesComps') {
      setSalesCompsColumns(DEFAULT_SALES_COMPS_COLUMNS);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}salesComps`);
    } else {
      setRateCompsColumns(DEFAULT_RATE_COMPS_COLUMNS);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}rateComps`);
    }
  }, []);

  const getVisibleColumns = useCallback((module: 'salesComps' | 'rateComps') => {
    const columns = module === 'salesComps' ? salesCompsColumns : rateCompsColumns;
    return columns.filter(col => col.visible);
  }, [salesCompsColumns, rateCompsColumns]);

  return {
    salesCompsColumns,
    rateCompsColumns,
    updateSalesCompsColumns,
    updateRateCompsColumns,
    resetToDefaults,
    getVisibleColumns,
    DEFAULT_SALES_COMPS_COLUMNS,
    DEFAULT_RATE_COMPS_COLUMNS,
  };
}

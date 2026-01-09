import { formatCurrency as formatCurrencyBase, formatPercent as formatPercentBase } from "@/lib/utils";

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return formatCurrencyBase(value);
};

export const formatPercent = (value: number | null | undefined, decimals: number = 1): string => {
  if (value === null || value === undefined) return '—';
  return formatPercentBase(value);
};

export const formatNumber = (value: number | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const estimateRowCount = (fileSize: number, avgRowSize: number = 100): number => {
  return Math.floor(fileSize / avgRowSize);
};

export const parseNumericValue = (value: string): number | null => {
  if (!value || typeof value !== 'string' || value.trim() === '') return null;
  
  let cleaned = value.trim();
  
  const isNegative = /^\s*\([^)]*\)\s*$/.test(cleaned);
  if (isNegative) {
    cleaned = cleaned.replace(/[()]/g, '');
  }
  
  cleaned = cleaned.replace(/[$€£¥₹₽₩₪₦₡₨₴₵₸₷¢]/g, '');
  cleaned = cleaned.replace(/%/g, '');
  cleaned = cleaned.replace(/\s+/g, '');
  
  const periodCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;
  
  if (periodCount > 1 && commaCount === 1) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 1 && periodCount === 1) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (periodCount === 1 && commaCount === 1) {
    const lastPeriodIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');
    
    if (lastCommaIndex > lastPeriodIndex) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (commaCount > 0 && periodCount === 0) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 3) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');
  
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return null;
  
  return isNegative && num > 0 ? -num : num;
};

export const parseChartNumericValue = (value: string | number | null | undefined): number => {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseNumericValue(value);
    return parsed ?? 0;
  }
  
  return 0;
};

export const parsePercentValue = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  
  const cleaned = value.replace('%', '');
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? null : num;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const generateExportFilename = (prefix: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}_${date}.csv`;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

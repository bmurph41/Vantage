import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Upload, FileSpreadsheet, Info, Pencil, Check, X, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Define field types for formatting in sample preview
const DATE_FIELDS = ['leaseCommencement', 'leaseExpiration', 'coiExpiration'];
const CURRENCY_FIELDS = ['leaseAmount', 'baseRent2', 'baseRent3', 'additionalCharge1', 'additionalCharge2', 'additionalCharge3', 'winterAmount', 'summerAmount', 'seasonalAmount', 'liveaboardAmount', 'electricAmount'];

// Format date values as M/DD/YYYY for preview display
function formatDateForPreview(value: any): string {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  
  const strValue = String(value).trim();
  
  // Handle Excel serial date numbers
  if (!isNaN(Number(strValue)) && Number(strValue) > 1000 && Number(strValue) < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Number(strValue) * 86400000);
    if (!isNaN(date.getTime())) {
      const month = date.getMonth() + 1;
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  }
  
  // Try to parse as date string
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) {
    const month = date.getMonth() + 1;
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  
  return strValue; // Return original if can't parse
}

// Format currency values as $0,000.00 for preview display
function formatCurrencyForPreview(value: any): string {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  
  const strValue = String(value).trim();
  
  // Remove any existing currency symbols and commas
  const cleanValue = strValue.replace(/[$,]/g, '');
  const numValue = parseFloat(cleanValue);
  
  if (!isNaN(numValue)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  }
  
  return strValue; // Return original if can't parse
}

// Format sample value based on field type
function formatSampleValue(value: any, fieldValue: string): string {
  // Handle null/undefined
  if (value === null || value === undefined) return '';
  
  // Handle objects/arrays - bail out instead of returning [object Object]
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.length} items]`;
    return '[object]';
  }
  
  if (DATE_FIELDS.includes(fieldValue)) {
    return formatDateForPreview(value);
  }
  if (CURRENCY_FIELDS.includes(fieldValue)) {
    return formatCurrencyForPreview(value);
  }
  return String(value);
}

/**
 * Checks if a row is a summary/total row that should be excluded from import.
 * Detects patterns like "Total", "Totals", "Sum", "Grand Total", "Subtotal" etc.
 * Checks all cells in the row, not just the first one.
 */
function isSummaryRow(row: Record<string, any>): boolean {
  // Pattern to match summary row indicators
  const summaryPattern = /^(total|totals|grand\s*total|subtotal|sub\s*total|sum|sums|sum\s+of|count|avg|average|=sum|=total)s?:?\s*$/i;
  
  // Check if any cell in the row matches the summary pattern
  for (const value of Object.values(row)) {
    const strValue = String(value || '').trim().toLowerCase();
    if (strValue.length > 0 && strValue.length < 30 && summaryPattern.test(strValue)) {
      return true;
    }
  }
  
  return false;
}

// Field definitions matching TENANT_IMPORT_FIELDS and LEASE_IMPORT_FIELDS from shared/schema.ts
// All fields are optional but "recommended" fields help with data quality
// "recommended" fields show soft warnings when unmapped but don't block import
const IMPORT_FIELDS = [
  { value: "name", label: "Tenant Name", required: false, recommended: true },
  { value: "boatMake", label: "Boat Make", required: false, recommended: false },
  { value: "boatYear", label: "Boat Year", required: false, recommended: false },
  { value: "boatLength", label: "Boat Length (ft)", required: false, recommended: false },
  { value: "boatWidth", label: "Boat Width/Beam (ft)", required: false, recommended: false },
  { value: "address1", label: "Address Line 1", required: false, recommended: false },
  { value: "address2", label: "Address Line 2", required: false, recommended: false },
  { value: "city", label: "City", required: false, recommended: false },
  { value: "state", label: "State", required: false, recommended: false },
  { value: "zip", label: "ZIP Code", required: false, recommended: false },
  { value: "fullAddress", label: "Full Address (AI will split)", required: false, recommended: false },
  { value: "leaseCommencement", label: "Commencement Date", required: false, recommended: true },
  { value: "leaseExpiration", label: "Expiration Date", required: false, recommended: false },
  { value: "leaseAmount", label: "Monthly Rent (Base Rent 1)", required: false, recommended: true },
  { value: "baseRent2", label: "Base Rent 2", required: false, recommended: false },
  { value: "baseRent3", label: "Base Rent 3", required: false, recommended: false },
  { value: "contractTerm", label: "Contract Term", required: false, recommended: false },
  { value: "storageType", label: "Storage Type", required: false, recommended: true },
  { value: "unitLocation", label: "Location", required: false, recommended: false },
  { value: "slipStatus", label: "Slip Status", required: false, recommended: false },
  { value: "slipLength", label: "Slip Length (ft)", required: false, recommended: false },
  { value: "slipWidth", label: "Slip Width (ft)", required: false, recommended: false },
  { value: "additionalCharge1", label: "Additional Charge 1", required: false, recommended: false },
  { value: "additionalCharge2", label: "Additional Charge 2", required: false, recommended: false },
  { value: "additionalCharge3", label: "Additional Charge 3", required: false, recommended: false },
  { value: "leaseOnFile", label: "Lease on File", required: false, recommended: false },
  { value: "coiOnFile", label: "COI on File", required: false, recommended: false },
  { value: "coiExpiration", label: "COI Expiration", required: false, recommended: false },
  { value: "hasDiscount", label: "Has Discount", required: false, recommended: false },
  { value: "discountType", label: "Discount Type", required: false, recommended: false },
  { value: "discountValue", label: "Discount Value", required: false, recommended: false },
  { value: "winterAmount", label: "Winter Slip Amount", required: false, recommended: false },
  { value: "summerAmount", label: "Summer Slip Amount", required: false, recommended: false },
  { value: "seasonalAmount", label: "Seasonal Slip Amount", required: false, recommended: false },
  { value: "liveaboardAmount", label: "Liveaboard Fee", required: false, recommended: false },
  { value: "electricAmount", label: "Electric Fee", required: false, recommended: false },
  { value: "winterSlip", label: "Winter Slip Assignment", required: false, recommended: false },
  { value: "summerSlip", label: "Summer Slip Assignment", required: false, recommended: false },
] as const;

interface FileImportDrawerProps {
  open: boolean;
  onClose: () => void;
  locationId?: string | null;
}

interface ParsedImportRow {
  rowIndex: number;
  tenantData: Record<string, any>;
  leaseData: Record<string, any>;
  lineItemData?: Record<string, any>;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
  duplicateMatchReason?: string;
  existingLeaseId?: string;
}

interface ParseResponse {
  parsedRows: ParsedImportRow[];
  columnMapping: Record<string, string>;
}

interface ImportResponse {
  imported: number;
  skipped: number;
  errors: number;
  updated?: number;
  details: {
    created: Array<{ tenantName: string; leaseKey: string; tenantId: string; leaseId: string }>;
    duplicates: Array<{ tenantName: string; reason: string }>;
    failed: Array<{ tenantName: string; error: string }>;
    updated?: Array<{ tenantName: string; tenantId: string; leaseId?: string; reason: string }>;
  };
}

interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  hasHeaders: boolean;
  previewData: any[][];
}

// Interfaces for multi-sheet support
interface SheetMapping {
  sheetName: string;
  headers: string[];
  rows: Record<string, any>[];
  columnMapping: Record<string, string>;
  parseResult?: ParseResponse;
}

// Interface for unrecognized value detection response
interface UnrecognizedValuesResponse {
  hasUnrecognizedValues: boolean;
  unrecognizedValues: Record<string, {
    fieldLabel: string;
    values: string[];
    validOptions: string[];
    occurrences: Record<string, number>;
  }>;
}

// Import mode type matching backend
type ImportMode = 'create' | 'append' | 'replace';

// Rate type configuration for dynamic seasonal rate mapping
type RateSeasonType = 'annual' | 'summer' | 'winter';

// Rate basis types - how the rate amount is expressed
type RateBasisType = 'per_month' | 'per_season' | 'per_year' | 'per_contract' | 'per_ft_month' | 'per_ft_season' | 'per_ft_year';

const RATE_BASIS_OPTIONS: { value: RateBasisType; label: string }[] = [
  { value: 'per_month', label: '$/Month (flat monthly rate)' },
  { value: 'per_season', label: '$/Season (flat seasonal rate)' },
  { value: 'per_year', label: '$/Year (flat annual rate)' },
  { value: 'per_contract', label: 'Total Contract Value (full term amount)' },
  { value: 'per_ft_month', label: '$/Ft/Month (per foot per month)' },
  { value: 'per_ft_season', label: '$/Ft/Season (per foot for season)' },
  { value: 'per_ft_year', label: '$/Ft/Year (per foot per year)' },
];

interface RateConfig {
  seasonType: RateSeasonType;
  columnKey: string; // The file column mapped to this rate
  slipColumnKey: string; // The file column mapped to the slip assignment for this season
  rateBasis: RateBasisType; // How the rate is expressed ($/mo, $/season, $/ft/mo, etc.)
}

// Define rate field groups - tenant & non-rate lease fields vs rate-specific fields
const TENANT_AND_LEASE_FIELDS = [
  { value: "name", label: "Tenant Name", required: false, recommended: true },
  { value: "boatMake", label: "Boat Make", required: false, recommended: false },
  { value: "boatYear", label: "Boat Year", required: false, recommended: false },
  { value: "boatLength", label: "Boat Length (ft)", required: false, recommended: false },
  { value: "boatWidth", label: "Boat Width/Beam (ft)", required: false, recommended: false },
  { value: "address1", label: "Address Line 1", required: false, recommended: false },
  { value: "address2", label: "Address Line 2", required: false, recommended: false },
  { value: "city", label: "City", required: false, recommended: false },
  { value: "state", label: "State", required: false, recommended: false },
  { value: "zip", label: "ZIP Code", required: false, recommended: false },
  { value: "fullAddress", label: "Full Address (AI will split)", required: false, recommended: false },
  { value: "contractTerm", label: "Contract Term", required: false, recommended: false },
  { value: "storageType", label: "Storage Type", required: false, recommended: true },
  { value: "slipStatus", label: "Slip Status", required: false, recommended: false },
  { value: "slipLength", label: "Slip Length (ft)", required: false, recommended: false },
  { value: "slipWidth", label: "Slip Width (ft)", required: false, recommended: false },
  { value: "leaseOnFile", label: "Lease on File", required: false, recommended: false },
  { value: "coiOnFile", label: "COI on File", required: false, recommended: false },
  { value: "coiExpiration", label: "COI Expiration", required: false, recommended: false },
  { value: "hasDiscount", label: "Has Discount", required: false, recommended: false },
  { value: "discountType", label: "Discount Type", required: false, recommended: false },
  { value: "discountValue", label: "Discount Value", required: false, recommended: false },
] as const;

// Additional fees that are not main seasonal rates
const ADDITIONAL_FEE_FIELDS = [
  { value: "liveaboardAmount", label: "Liveaboard Fee", required: false, recommended: false },
  { value: "electricAmount", label: "Electric Fee", required: false, recommended: false },
  { value: "additionalCharge1", label: "Additional Charge 1", required: false, recommended: false },
  { value: "additionalCharge2", label: "Additional Charge 2", required: false, recommended: false },
  { value: "additionalCharge3", label: "Additional Charge 3", required: false, recommended: false },
] as const;

// Hidden fields that are valid for mapping but not shown in main UI
// These are managed by Rate Configuration section instead
const HIDDEN_VALID_FIELDS = [
  { value: "unitLocation", label: "Location/Slip Assignment", required: false, recommended: false },
] as const;

// Combined list of all valid fields for lookups and sanitization
const ALL_VALID_FIELDS = [
  ...TENANT_AND_LEASE_FIELDS,
  ...ADDITIONAL_FEE_FIELDS,
  ...HIDDEN_VALID_FIELDS,
];

export default function FileImportDrawer({ open, onClose, locationId }: FileImportDrawerProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"upload" | "sheet-selection" | "mapping" | "value-mapping" | "preview" | "complete">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<ExcelSheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);  // Changed to array
  const [currentMappingSheetIndex, setCurrentMappingSheetIndex] = useState<number>(0);
  const [sheetMappings, setSheetMappings] = useState<SheetMapping[]>([]);
  const [excelWorkbook, setExcelWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importMode, setImportMode] = useState<ImportMode>('create');
  const [isParsing, setIsParsing] = useState(false);
  const [showHeaderNotice, setShowHeaderNotice] = useState(false);
  const [dontShowHeaderNotice, setDontShowHeaderNotice] = useState(false);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingColumnValue, setEditingColumnValue] = useState("");
  
  // Value mapping state
  const [unrecognizedValues, setUnrecognizedValues] = useState<UnrecognizedValuesResponse | null>(null);
  const [valueMappings, setValueMappings] = useState<Record<string, Record<string, string>>>({});
  const [pendingMappedRows, setPendingMappedRows] = useState<Record<string, any>[]>([]);
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState(false);
  const [aiSuggestionConfidence, setAiSuggestionConfidence] = useState<Record<string, Record<string, "high" | "medium" | "low">>>({});
  
  // AI Column mapping suggestions state
  const [aiColumnSuggestions, setAiColumnSuggestions] = useState<Record<string, { field: string | null; confidence: "high" | "medium" | "low"; reason?: string }>>({});
  const [isLoadingColumnSuggestions, setIsLoadingColumnSuggestions] = useState(false);
  const [rateStructureHint, setRateStructureHint] = useState<"annual" | "seasonal" | "mixed" | null>(null);
  const [contractTermHints, setContractTermHints] = useState<{ column: string; detectedTerms: string[] }[]>([]);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom column creation state
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [creatingCustomColumnFor, setCreatingCustomColumnFor] = useState<string | null>(null);
  const [newCustomColumnName, setNewCustomColumnName] = useState("");
  
  // Rate configuration state
  const [numberOfRates, setNumberOfRates] = useState<1 | 2 | 3>(1);
  const [rateConfigs, setRateConfigs] = useState<RateConfig[]>([
    { seasonType: 'annual', columnKey: '', slipColumnKey: '', rateBasis: 'per_month' }
  ]);
  
  // Default storage type - applies to all rows when no Storage Type column is mapped
  const [defaultStorageType, setDefaultStorageType] = useState<string>('');
  
  // Auto-apply dates from contract term - when true, uses project season dates based on contract term
  const [autoApplyContractTermDates, setAutoApplyContractTermDates] = useState(true);
  
  // Fetch project details for season dates and configuration
  const { data: projectData } = useQuery<{
    id: string;
    name: string;
    seasonStartDate?: string;
    seasonEndDate?: string;
    winterStartDate?: string;
    winterEndDate?: string;
    seasonType?: string;
  }>({
    queryKey: [`/api/rent-roll/locations/${locationId}`],
    enabled: !!locationId && open,
  });
  
  // Fetch project config for enabled storage types
  const { data: projectConfig } = useQuery<{
    projectId: string;
    enabledStorageTypes: string[];
    enabledContractTerms: string[];
  }>({
    queryKey: [`/api/rent-roll/project-details-config/${locationId}`],
    enabled: !!locationId && open,
  });
  
  // Helper to format season date range for display
  const getSeasonDateLabel = (seasonType: RateSeasonType): string => {
    const currentYear = new Date().getFullYear();
    
    if (seasonType === 'summer') {
      const start = projectData?.seasonStartDate || '05/01';
      const end = projectData?.seasonEndDate || '10/31';
      return `${start}/${currentYear} - ${end}/${currentYear}`;
    } else if (seasonType === 'winter') {
      const start = projectData?.winterStartDate || '11/01';
      const end = projectData?.winterEndDate || '04/30';
      return `${start}/${currentYear} - ${end}/${currentYear + 1}`;
    } else {
      // Annual: from summer start to winter end (full year span)
      const summerStart = projectData?.seasonStartDate || '05/01';
      const winterEnd = projectData?.winterEndDate || '04/30';
      return `${summerStart}/${currentYear} - ${winterEnd}/${currentYear + 1}`;
    }
  };
  
  // Update rate configs when number of rates changes
  const handleNumberOfRatesChange = (num: 1 | 2 | 3) => {
    setNumberOfRates(num);
    
    // Create new rate configs array
    const newConfigs: RateConfig[] = [];
    for (let i = 0; i < num; i++) {
      if (rateConfigs[i]) {
        newConfigs.push(rateConfigs[i]);
      } else {
        // Default new rates based on position
        const defaultType: RateSeasonType = i === 0 ? 'annual' : i === 1 ? 'summer' : 'winter';
        // Default rate basis based on season type
        const defaultBasis: RateBasisType = defaultType === 'annual' ? 'per_month' : 'per_season';
        newConfigs.push({ seasonType: defaultType, columnKey: '', slipColumnKey: '', rateBasis: defaultBasis });
      }
    }
    setRateConfigs(newConfigs);
  };
  
  // Update a specific rate config
  const updateRateConfig = (index: number, field: keyof RateConfig, value: string) => {
    setRateConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  
  // Helper to migrate legacy unitLocation from column mapping
  // Returns object with cleaned mapping and the unitLocation column (if any)
  const extractUnitLocationMapping = (mapping: Record<string, string>): { 
    cleanedMapping: Record<string, string>; 
    unitLocationColumn: string | null;
  } => {
    if (!mapping.unitLocation) {
      return { cleanedMapping: mapping, unitLocationColumn: null };
    }
    
    const unitLocationColumn = mapping.unitLocation;
    const { unitLocation, ...cleanedMapping } = mapping;
    return { cleanedMapping, unitLocationColumn };
  };
  
  // Helper to apply unitLocation to annual rate config
  const applyUnitLocationToRateConfig = (unitLocationColumn: string) => {
    setRateConfigs(prev => {
      const annualIndex = prev.findIndex(c => c.seasonType === 'annual');
      if (annualIndex >= 0) {
        const updated = [...prev];
        // Overwrite even if already set - preserve legacy data mapping
        updated[annualIndex] = { ...updated[annualIndex], slipColumnKey: unitLocationColumn };
        return updated;
      }
      return prev;
    });
  };
  
  // Helper to detect duplicate column mappings
  const getDuplicateColumnMappings = (): { column: string; fields: string[] }[] => {
    // Collect all mapped columns (from regular mapping + rate configs + additional fees)
    const columnUsage: Record<string, string[]> = {};
    
    // Check regular field mappings
    Object.entries(columnMapping).forEach(([fieldValue, column]) => {
      if (column && column !== "__skip__") {
        const fieldDef = ALL_VALID_FIELDS.find(f => f.value === fieldValue);
        const label = fieldDef?.label || fieldValue;
        if (!columnUsage[column]) columnUsage[column] = [];
        columnUsage[column].push(label);
      }
    });
    
    // Check rate config mappings
    rateConfigs.forEach((config, index) => {
      if (config.columnKey && config.columnKey !== "") {
        const label = `Rate ${index + 1} (${config.seasonType})`;
        if (!columnUsage[config.columnKey]) columnUsage[config.columnKey] = [];
        columnUsage[config.columnKey].push(label);
      }
      if (config.slipColumnKey && config.slipColumnKey !== "") {
        const label = `Slip ${index + 1} (${config.seasonType})`;
        if (!columnUsage[config.slipColumnKey]) columnUsage[config.slipColumnKey] = [];
        columnUsage[config.slipColumnKey].push(label);
      }
    });
    
    // Find columns mapped to multiple fields
    return Object.entries(columnUsage)
      .filter(([_, fields]) => fields.length > 1)
      .map(([column, fields]) => ({ column, fields }));
  };
  
  const duplicateMappings = getDuplicateColumnMappings();

  // Rename a column header and update all related data
  const handleRenameColumn = (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    
    // If no change or empty, just close editor
    if (!trimmedNewName || trimmedNewName === oldName) {
      setEditingColumn(null);
      setEditingColumnValue("");
      return;
    }
    
    // Check for duplicate column names
    if (fileHeaders.includes(trimmedNewName) && trimmedNewName !== oldName) {
      toast({
        title: "Column name already exists",
        description: `A column named "${trimmedNewName}" already exists. Please choose a different name.`,
        variant: "destructive",
      });
      // Don't close editor, let user fix
      return;
    }
    
    // Helper to rename row keys
    const renameRowKeys = (rows: Record<string, any>[]) => 
      rows.map(row => {
        const newRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          newRow[key === oldName ? trimmedNewName : key] = value;
        }
        return newRow;
      });
    
    // Helper to rename mapping values
    const renameMappingValues = (mapping: Record<string, string>) => {
      const newMapping: Record<string, string> = {};
      for (const [field, column] of Object.entries(mapping)) {
        newMapping[field] = column === oldName ? trimmedNewName : column;
      }
      return newMapping;
    };
    
    // Update local state
    setFileHeaders(prev => prev.map(h => h === oldName ? trimmedNewName : h));
    setFileRows(prev => renameRowKeys(prev));
    setColumnMapping(prev => renameMappingValues(prev));
    
    // Also update sheetMappings for the current sheet to persist the rename
    if (selectedSheets.length > 0 && currentMappingSheetIndex < sheetMappings.length) {
      setSheetMappings(prev => prev.map((sheet, idx) => {
        if (idx === currentMappingSheetIndex) {
          return {
            ...sheet,
            headers: sheet.headers.map(h => h === oldName ? trimmedNewName : h),
            rows: renameRowKeys(sheet.rows),
            columnMapping: renameMappingValues(sheet.columnMapping),
            // Clear parseResult since column names changed - will be re-validated on continue
            parseResult: undefined,
          };
        }
        return sheet;
      }));
    }
    
    // Clear parseResult since column names changed
    setParseResult(null);
    
    setEditingColumn(null);
    setEditingColumnValue("");
    
    toast({
      title: "Column renamed",
      description: `"${oldName}" has been renamed to "${trimmedNewName}"`,
    });
  };

  // Show header notice dialog when drawer opens (if not permanently dismissed)
  useEffect(() => {
    if (open && step === "upload") {
      const saved = localStorage.getItem('hideImportHeaderNotice');
      if (saved !== 'true') {
        setShowHeaderNotice(true);
      } else {
        setShowHeaderNotice(false);
      }
    } else if (!open) {
      // Reset dialog state when drawer closes (unless permanently dismissed)
      const saved = localStorage.getItem('hideImportHeaderNotice');
      if (saved !== 'true') {
        setShowHeaderNotice(false); // Reset so it shows again on next open
      }
    }
  }, [open, step]);

  // Save header notice preference and close dialog
  const handleDismissHeaderNotice = () => {
    if (dontShowHeaderNotice) {
      localStorage.setItem('hideImportHeaderNotice', 'true');
    }
    setShowHeaderNotice(false);
    setDontShowHeaderNotice(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Prevent re-uploads while parsing
    if (isParsing) {
      toast({
        title: "Please wait",
        description: "A file is currently being processed",
        variant: "destructive",
      });
      return;
    }

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
    ];

    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.csv') && 
        !selectedFile.name.endsWith('.xlsx') && 
        !selectedFile.name.endsWith('.xls') &&
        !selectedFile.name.endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV, Excel, or PDF file",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    try {
      await parseFile(selectedFile);
    } catch (error) {
      // Reset file input on error to allow retry
      e.target.value = '';
    } finally {
      setIsParsing(false);
    }
  };

  // Process a file (shared logic for both file input and drag/drop)
  const processFile = async (selectedFile: File) => {
    if (isParsing) {
      toast({
        title: "Please wait",
        description: "A file is currently being processed",
        variant: "destructive",
      });
      return;
    }

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
    ];

    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.csv') && 
        !selectedFile.name.endsWith('.xlsx') && 
        !selectedFile.name.endsWith('.xls') &&
        !selectedFile.name.endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV, Excel, or PDF file",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    try {
      await parseFile(selectedFile);
    } finally {
      setIsParsing(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isParsing && !showHeaderNotice) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're actually leaving the drop zone
    // Check if relatedTarget is outside the drop zone
    const relatedTarget = e.relatedTarget as Node;
    const currentTarget = e.currentTarget as Node;
    if (!currentTarget.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isParsing || showHeaderNotice) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  // Fetch AI-powered column mapping suggestions
  const fetchAiColumnSuggestions = async (headers: string[], rows: Record<string, any>[]) => {
    setIsLoadingColumnSuggestions(true);
    try {
      // Combine all available fields for AI to map to (including hidden fields)
      const allFields = [
        ...ALL_VALID_FIELDS,
        { value: "leaseCommencement", label: "Commencement Date" },
        { value: "leaseExpiration", label: "Expiration Date" },
        { value: "leaseAmount", label: "Monthly Rent (Base Rent 1)" },
        { value: "baseRent2", label: "Base Rent 2" },
        { value: "baseRent3", label: "Base Rent 3" },
        { value: "winterAmount", label: "Winter Amount" },
        { value: "summerAmount", label: "Summer Amount" },
        { value: "seasonalAmount", label: "Seasonal Amount" },
        { value: "winterSlip", label: "Winter Slip" },
        { value: "summerSlip", label: "Summer Slip" },
      ];

      const response = await fetch("/api/rent-roll/leases/import/suggest-column-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          headers,
          sampleRows: rows.slice(0, 20), // Send first 20 rows as sample
          availableFields: allFields.map(f => ({ value: f.value, label: f.label })),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Convert AI suggestions to a lookup map
        const suggestionsMap: Record<string, { field: string | null; confidence: "high" | "medium" | "low"; reason?: string }> = {};
        for (const suggestion of result.suggestions || []) {
          suggestionsMap[suggestion.csvColumn] = {
            field: suggestion.suggestedField,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          };
        }
        setAiColumnSuggestions(suggestionsMap);
        
        // Store hints for rate structure detection
        setRateStructureHint(result.rateStructureHint || null);
        setContractTermHints(result.contractTermHints || []);
        
        // Auto-apply high confidence suggestions
        // Note: columnMapping is keyed by field name (e.g., "name", "storageType")
        // and values are the CSV column names (e.g., "Customer Name", "Storage Type")
        // Special handling: unitLocation suggestions go to Rate Configuration slip column instead
        
        // First, find unitLocation column suggestion (before state updates)
        let unitLocationColumn: string | null = null;
        for (const [csvColumn, suggestion] of Object.entries(suggestionsMap)) {
          if (suggestion.field === "unitLocation" && suggestion.confidence === "high") {
            unitLocationColumn = csvColumn;
            break;
          }
        }
        
        setColumnMapping(prev => {
          const updated = { ...prev };
          for (const [csvColumn, suggestion] of Object.entries(suggestionsMap)) {
            if (suggestion.field && suggestion.confidence === "high") {
              // Skip unitLocation - handled by Rate Config slip column
              if (suggestion.field === "unitLocation") {
                continue;
              }
              // Only apply to fields that have never been touched (undefined)
              // Don't override explicit user selections including "skip" (empty string)
              if (updated[suggestion.field] === undefined) {
                updated[suggestion.field] = csvColumn;
              }
            }
          }
          return updated;
        });
        
        // If AI detected a slip/location column, auto-populate the first annual rate config's slip column
        if (unitLocationColumn) {
          setRateConfigs(prev => {
            // Find the first annual rate config and set its slipColumnKey
            const annualIndex = prev.findIndex(c => c.seasonType === 'annual');
            if (annualIndex >= 0 && !prev[annualIndex].slipColumnKey) {
              const updated = [...prev];
              updated[annualIndex] = { ...updated[annualIndex], slipColumnKey: unitLocationColumn };
              return updated;
            }
            return prev;
          });
        }
        
        // Show toast if we found suggestions
        const highConfidenceCount = Object.values(suggestionsMap).filter(s => s.field && s.confidence === "high").length;
        const mediumConfidenceCount = Object.values(suggestionsMap).filter(s => s.field && s.confidence === "medium").length;
        
        if (highConfidenceCount > 0 || mediumConfidenceCount > 0) {
          toast({
            title: "AI Mapping Suggestions",
            description: `Found ${highConfidenceCount} high-confidence and ${mediumConfidenceCount} medium-confidence column matches. Review and adjust as needed.`,
          });
        }
        
        // Show rate structure hint
        if (result.rateStructureHint === "seasonal") {
          toast({
            title: "Seasonal Rates Detected",
            description: "Your file appears to have separate winter and summer rates. Consider using 2-3 rate configuration.",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching AI column suggestions:", error);
      // Don't show error toast - AI suggestions are optional enhancement
    } finally {
      setIsLoadingColumnSuggestions(false);
    }
  };

  const parseFile = async (file: File) => {
    if (file.name.endsWith('.csv')) {
      // Parse CSV using Papaparse with aggressive error recovery
      return new Promise<void>((resolve, reject) => {
        (Papa.parse as any)(file, {
          header: true,
          skipEmptyLines: 'greedy', // Skip all empty lines including whitespace-only
          transformHeader: (header: string) => header.trim(),
          dynamicTyping: false,
          delimiter: '', // Auto-detect delimiter
          newline: '', // Auto-detect newline
          quoteChar: '"',
          escapeChar: '"',
          fastMode: false, // Use slower but more robust parsing
          comments: false,
          delimitersToGuess: [',', '\t', '|', ';'],
          complete: (results: any) => {
            try {
              // Filter out critical errors that prevent safe parsing
              const criticalErrors = results.errors?.filter((err: any) => {
                // These error types indicate corrupted or incomplete data
                return err.type === 'Quotes' || err.type === 'FieldMismatch' || err.type === 'Delimiter';
              }) || [];

              // Critical errors are ALWAYS fatal - even if we got partial data
              // Partial data from a malformed CSV is corrupted and unsafe to import
              if (criticalErrors.length > 0) {
                const firstError = criticalErrors[0];
                let errorMessage = firstError.message;
                let errorDetails = "";
                const rowNumber = firstError.row !== undefined ? firstError.row + 2 : 'unknown';

                // Provide helpful context for common errors
                if (firstError.type === 'Quotes') {
                  errorMessage = "CSV Quote Error - Unable to Parse File";
                  errorDetails = `Row ${rowNumber}: ${firstError.message}\n\n` +
                    `The CSV parser cannot recover from this error. Please fix your CSV file:\n\n` +
                    `Option 1 - Fix in Excel:\n` +
                    `1. Open the CSV in Excel\n` +
                    `2. Save As → CSV (Comma delimited) (*.csv)\n` +
                    `3. Excel will automatically fix quote formatting\n\n` +
                    `Option 2 - Manual Fix:\n` +
                    `• Remove all quotes from your data, OR\n` +
                    `• Double any quotes inside quoted fields: "He said ""Hello"""\n` +
                    `• Remove trailing spaces after closing quotes\n` +
                    `• Ensure all quotes are straight quotes (") not curly quotes ("")`;
                } else if (firstError.type === 'FieldMismatch') {
                  errorMessage = "CSV Column Mismatch";
                  errorDetails = `Row ${rowNumber}: This row has a different number of columns than the header.\n\n` +
                    `Expected: ${results.meta.fields?.length || 0} columns\n\n` +
                    `To fix:\n` +
                    `1. Open your CSV in Excel\n` +
                    `2. Check row ${rowNumber} - it likely has extra commas or missing values\n` +
                    `3. Ensure fields with commas are in quotes: "123 Main St, Suite 5"\n` +
                    `4. Save and try again`;
                } else {
                  errorDetails = `Row ${rowNumber}: ${firstError.message}\n\n` +
                    `Try opening the file in Excel and saving it as a new CSV file.`;
                }

                toast({
                  title: errorMessage,
                  description: errorDetails,
                  variant: "destructive",
                  duration: 15000, // Show for 15 seconds
                });
                
                // Reset state and reject to prevent proceeding with corrupted data
                setFile(null);
                reject(new Error(errorMessage));
                return;
              }

              // Log non-critical errors (warnings) but continue
              if (results.errors && results.errors.length > 0) {
                console.warn('[CSV Import] Continuing with non-critical warnings:', results.errors);
                toast({
                  title: "CSV Import Warning",
                  description: `File imported with ${results.errors.length} warning(s). These are minor issues that won't affect the import.`,
                  variant: "default",
                  duration: 5000,
                });
              }

              if (!results.data || results.data.length === 0) {
                toast({
                  title: "Empty file",
                  description: "The file contains no data rows. Please ensure your CSV has at least one row of data after the header.",
                  variant: "destructive",
                });
                resolve();
                return;
              }

              // Normalize headers: create mapping from original to trimmed
              const rawHeaders = results.meta.fields || [];
              const headerMap = new Map<string, string>();
              const normalizedHeaders: string[] = [];

              rawHeaders.forEach((rawHeader: any) => {
                if (rawHeader && typeof rawHeader === 'string') {
                  const trimmed = rawHeader.trim();
                  if (trimmed.length > 0 && !normalizedHeaders.includes(trimmed)) {
                    headerMap.set(rawHeader, trimmed);
                    normalizedHeaders.push(trimmed);
                  }
                }
              });

              if (normalizedHeaders.length === 0) {
                toast({
                  title: "Invalid CSV",
                  description: "CSV file has no valid column headers",
                  variant: "destructive",
                });
                resolve();
                return;
              }

              // Map rows using normalized headers and filter out completely empty rows
              const dataRows = (results.data as Record<string, any>[])
                .map(row => {
                  const normalizedRow: Record<string, any> = {};
                  Array.from(headerMap.entries()).forEach(([originalKey, trimmedKey]) => {
                    normalizedRow[trimmedKey] = row[originalKey] ?? '';
                  });
                  return normalizedRow;
                })
                .filter(row => {
                  // Filter out rows where all cells are empty or whitespace
                  return Object.values(row).some(value => {
                    const stringValue = String(value).trim();
                    return stringValue.length > 0;
                  });
                })
                .filter(row => !isSummaryRow(row));

              // Check if we have any data rows after filtering empty ones
              if (dataRows.length === 0) {
                toast({
                  title: "No data rows found",
                  description: `The CSV file has ${normalizedHeaders.length} column headers but no data rows. Please add at least one row of data.`,
                  variant: "destructive",
                });
                resolve();
                return;
              }

              // Store headers and rows, move to mapping step
              setFileHeaders(normalizedHeaders);
              setFileRows(dataRows);
              setStep("mapping");
              
              // Fetch AI column suggestions asynchronously (don't block UI)
              fetchAiColumnSuggestions(normalizedHeaders, dataRows);
              resolve();
            } catch (error: any) {
              toast({
                title: "Error processing CSV",
                description: error.message || "Failed to process the CSV file",
                variant: "destructive",
              });
              reject(error);
            }
          },
          error: (error: any) => {
            toast({
              title: "Error parsing CSV",
              description: error.message || "Failed to parse CSV file",
              variant: "destructive",
            });
            reject(error);
          },
        });
      });
    } else if (file.name.endsWith('.pdf')) {
      // Parse PDF using AI extraction
      return new Promise<void>(async (resolve, reject) => {
        try {
          // Convert file to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolveBase64, rejectBase64) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolveBase64(base64);
            };
            reader.onerror = () => rejectBase64(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });

          const pdfBase64 = await base64Promise;
          
          toast({
            title: "Processing PDF",
            description: "Using AI to extract lease data from your PDF. This may take a moment...",
          });

          // Call the PDF parsing endpoint
          const res = await apiRequest('POST', '/api/rent-roll/leases/import/pdf', { pdfBase64 });
          const response = await res.json() as {
            success: boolean;
            headers: string[];
            rows: Record<string, string>[];
            confidence: 'high' | 'medium' | 'low';
            warnings: string[];
            pageCount: number;
          };

          if (!response.success || !response.rows || response.rows.length === 0) {
            const warningMsg = response.warnings?.join('. ') || 'No lease data could be extracted';
            toast({
              title: "AI extraction incomplete",
              description: `${warningMsg}. You can still proceed to manually map columns.`,
              variant: "default",
              duration: 8000,
            });
            
            // Use meaningful marina-specific fallback headers instead of generic placeholders
            const fallbackHeaders = response.headers?.length > 0 
              ? response.headers 
              : ['Tenant Name', 'Unit/Slip', 'Monthly Rent', 'Start Date', 'End Date', 'Notes'];
            const emptyRow: Record<string, string> = {};
            fallbackHeaders.forEach(h => { emptyRow[h] = ''; });
            
            setFileHeaders(fallbackHeaders);
            setFileRows([emptyRow]);
            setStep("mapping");
            resolve();
            return;
          }
          
          // Check if we got only a single "Raw Text" column - this means extraction failed
          // Provide comprehensive fallback headers for manual mapping
          if (response.headers.length === 1 && response.headers[0] === 'Raw Text') {
            toast({
              title: "PDF requires manual mapping",
              description: "The PDF structure couldn't be auto-detected. Please use the column dropdowns to map your data fields.",
              variant: "default",
              duration: 8000,
            });
            
            // Provide comprehensive marina-specific headers for manual mapping
            const comprehensiveHeaders = [
              'Tenant Name', 'Unit/Slip', 'Storage Type', 'Boat Length', 'Boat Width',
              'Monthly Rent', 'Annual Rent', 'Start Date', 'End Date', 'Status', 'Notes'
            ];
            const emptyRow: Record<string, string> = {};
            comprehensiveHeaders.forEach(h => { emptyRow[h] = ''; });
            
            setFileHeaders(comprehensiveHeaders);
            setFileRows([emptyRow]);
            setStep("mapping");
            resolve();
            return;
          }

          // Show confidence-based toast
          if (response.confidence === 'low') {
            toast({
              title: "Low confidence extraction",
              description: "Please review the extracted data carefully. Some fields may be missing or incorrect.",
              variant: "default",
              duration: 5000,
            });
          } else if (response.confidence === 'medium') {
            toast({
              title: "PDF extracted",
              description: `Found ${response.rows.length} lease record(s). Please review the data.`,
            });
          } else {
            toast({
              title: "PDF extracted successfully",
              description: `Found ${response.rows.length} lease record(s) with high confidence.`,
            });
          }

          // Show any warnings
          if (response.warnings && response.warnings.length > 0) {
            }

          // Store headers and rows
          setFileHeaders(response.headers);
          setFileRows(response.rows);
          setStep("mapping");
          
          // Fetch AI column suggestions asynchronously (don't block UI)
          fetchAiColumnSuggestions(response.headers, response.rows);
          resolve();
        } catch (error: any) {
          console.error('[PDF Import] Error:', error);
          toast({
            title: "AI extraction unavailable",
            description: "AI extraction failed. You can still proceed to manually define and map columns.",
            variant: "default",
            duration: 8000,
          });
          
          // Use meaningful marina-specific fallback headers
          const fallbackHeaders = ['Tenant Name', 'Unit/Slip', 'Monthly Rent', 'Start Date', 'End Date', 'Notes'];
          const emptyRow: Record<string, string> = {};
          fallbackHeaders.forEach(h => { emptyRow[h] = ''; });
          
          setFileHeaders(fallbackHeaders);
          setFileRows([emptyRow]);
          setStep("mapping");
          resolve();
        }
      });
    } else {
      // Parse Excel using XLSX
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Parse all sheets and collect info
            const sheets: ExcelSheetInfo[] = [];
            
            for (const name of workbook.SheetNames) {
              const worksheet = workbook.Sheets[name];
              const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
              
              // Check if first row has any non-empty headers
              const hasHeaders = sheetData.length > 0 && 
                sheetData[0] && 
                Array.isArray(sheetData[0]) && 
                sheetData[0].some((cell: any) => cell && String(cell).trim().length > 0);
              
              sheets.push({
                name,
                rowCount: sheetData.length,
                hasHeaders,
                previewData: sheetData.slice(0, 3) // Store first 3 rows for preview
              });
              
              }

            // Store workbook and sheet info
            setExcelWorkbook(workbook);
            setAvailableSheets(sheets);
            
            // If only one sheet with data, auto-select it
            const sheetsWithData = sheets.filter(s => s.hasHeaders && s.rowCount >= 2);
            
            if (sheetsWithData.length === 0) {
              toast({
                title: "No data found",
                description: `The Excel file has ${workbook.SheetNames.length} sheet(s) but none contain valid data. Please ensure at least one sheet has headers and data rows.`,
                variant: "destructive",
              });
              resolve();
              return;
            } else if (sheetsWithData.length === 1) {
              // Auto-select the only sheet with data
              setSelectedSheets([sheetsWithData[0].name]);
              setCurrentMappingSheetIndex(0);
              // Initialize sheetMappings for single sheet
              setSheetMappings([{
                sheetName: sheetsWithData[0].name,
                headers: [],
                rows: [],
                columnMapping: {},
              }]);
              parseSelectedSheet(workbook, sheetsWithData[0].name);
              resolve();
            } else {
              // Multiple sheets with data - let user choose
              setStep("sheet-selection");
              resolve();
            }
          } catch (error: any) {
            toast({
              title: "Error parsing Excel file",
              description: error.message || "Failed to parse the Excel file",
              variant: "destructive",
            });
            reject(error);
          }
        };

        reader.onerror = () => {
          toast({
            title: "File read error",
            description: "Failed to read the file",
            variant: "destructive",
          });
          reject(new Error("File read error"));
        };

        reader.readAsArrayBuffer(file);
      });
    }
  };

  const parseSelectedSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const parsedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Normalize headers
      const rawHeaders = parsedData[0] as any[];
      const headers = rawHeaders
        .filter((h): h is string => !!h && typeof h === 'string' && h.trim().length > 0)
        .map(h => String(h).trim());

      if (headers.length === 0) {
        toast({
          title: "Invalid sheet",
          description: "Selected sheet has no valid column headers",
          variant: "destructive",
        });
        return;
      }

      // Extract rows using normalized headers and filter out completely empty rows
      const allMappedRows = parsedData.slice(1)
        .map(row => {
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] ?? '';
          });
          return rowObj;
        });

      const dataRows = allMappedRows
        .filter(row => {
          // Filter out rows where all cells are empty or whitespace
          const hasData = Object.values(row).some(value => {
            const stringValue = String(value).trim();
            return stringValue.length > 0;
          });
          return hasData;
        })
        .filter(row => !isSummaryRow(row));

      // Check if we have any data rows after filtering empty and total rows
      if (dataRows.length === 0) {
        toast({
          title: "No data rows found",
          description: `The sheet "${sheetName}" has ${headers.length} column headers but no data rows with actual content.`,
          variant: "destructive",
        });
        return;
      }

      // Store headers and rows, move to mapping step
      setFileHeaders(headers);
      setFileRows(dataRows);
      setStep("mapping");
      
      // Fetch AI column suggestions asynchronously (don't block UI)
      fetchAiColumnSuggestions(headers, dataRows);
    } catch (error: any) {
      toast({
        title: "Error parsing sheet",
        description: error.message || "Failed to parse the selected sheet",
        variant: "destructive",
      });
    }
  };

  // Handle toggling sheet selection (for checkbox multi-select)
  const handleToggleSheet = (sheetName: string) => {
    setSelectedSheets(prev => {
      if (prev.includes(sheetName)) {
        return prev.filter(s => s !== sheetName);
      } else {
        return [...prev, sheetName];
      }
    });
  };

  // Start mapping process for selected sheets
  const handleStartMapping = () => {
    if (selectedSheets.length === 0) {
      toast({
        title: "No sheets selected",
        description: "Please select at least one sheet to import",
        variant: "destructive",
      });
      return;
    }

    if (!excelWorkbook) {
      toast({
        title: "Error",
        description: "Workbook not loaded",
        variant: "destructive",
      });
      return;
    }

    // Initialize sheetMappings array with placeholders to avoid sparse array
    const initialMappings: SheetMapping[] = selectedSheets.map(sheetName => ({
      sheetName,
      headers: [],
      rows: [],
      columnMapping: {},
    }));
    setSheetMappings(initialMappings);

    // Parse the first selected sheet and start mapping
    setCurrentMappingSheetIndex(0);
    parseSheetForMapping(excelWorkbook, selectedSheets[0]);
  };

  const parseSheetForMapping = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      // Check if we already have edited data for this sheet (e.g., renamed columns)
      const existingMapping = sheetMappings.find(m => m.sheetName === sheetName);
      if (existingMapping && existingMapping.headers.length > 0 && existingMapping.rows.length > 0) {
        // Use existing data that may have been edited (e.g., renamed columns)
        setFileHeaders(existingMapping.headers);
        setFileRows(existingMapping.rows);
        
        // Migrate legacy unitLocation mapping to Rate Config slip column
        const loadedMapping = existingMapping.columnMapping || {};
        const { cleanedMapping, unitLocationColumn } = extractUnitLocationMapping(loadedMapping);
        if (unitLocationColumn) {
          applyUnitLocationToRateConfig(unitLocationColumn);
        }
        setColumnMapping(cleanedMapping);
        setStep("mapping");
        return;
      }
      
      // No existing mapping - parse fresh from workbook
      const worksheet = workbook.Sheets[sheetName];
      const parsedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Normalize headers
      const rawHeaders = parsedData[0] as any[];
      const headers = rawHeaders
        .filter((h): h is string => !!h && typeof h === 'string' && h.trim().length > 0)
        .map(h => String(h).trim());

      if (headers.length === 0) {
        toast({
          title: "Invalid sheet",
          description: `Sheet "${sheetName}" has no valid column headers`,
          variant: "destructive",
        });
        return;
      }

      // Extract rows using normalized headers and filter out completely empty rows
      const allMappedRows = parsedData.slice(1)
        .map(row => {
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] ?? '';
          });
          return rowObj;
        });

      const dataRows = allMappedRows
        .filter(row => {
          const hasData = Object.values(row).some(value => {
            const stringValue = String(value).trim();
            return stringValue.length > 0;
          });
          return hasData;
        })
        .filter(row => !isSummaryRow(row));

      if (dataRows.length === 0) {
        toast({
          title: "No data rows found",
          description: `Sheet "${sheetName}" has ${headers.length} column headers but no data rows with actual content.`,
          variant: "destructive",
        });
        return;
      }

      // Store headers and rows for mapping, reset column mapping
      setFileHeaders(headers);
      setFileRows(dataRows);
      setColumnMapping({});
      setStep("mapping");
      
      // Fetch AI column suggestions asynchronously (don't block UI)
      fetchAiColumnSuggestions(headers, dataRows);
    } catch (error: any) {
      toast({
        title: "Error parsing sheet",
        description: error.message || "Failed to parse the selected sheet",
        variant: "destructive",
      });
    }
  };

  const handleSubmitMapping = async () => {
    // Check for at least ONE column mapped or one rate configured
    const mappedCount = Object.values(columnMapping).filter(v => v && v !== "__skip__").length;
    const configuredRates = rateConfigs.filter(r => r.columnKey && r.columnKey !== "");
    
    if (mappedCount === 0 && configuredRates.length === 0) {
      toast({
        title: "No columns mapped",
        description: "Please map at least one column or configure a rate to proceed with the import.",
        variant: "destructive",
      });
      return;
    }

    // Validate that at least one rate column is configured when rate configurations exist
    if (configuredRates.length === 0 && numberOfRates > 0) {
      toast({
        title: "Rate column required",
        description: "Please map at least one rate column (e.g., Lease Amount) to proceed with the import.",
        variant: "destructive",
      });
      return;
    }

    // Validate that each configured rate has a rate type (rateBasis) set
    const ratesWithoutBasis = configuredRates.filter(r => !r.rateBasis);
    if (ratesWithoutBasis.length > 0) {
      toast({
        title: "Rate type required",
        description: "Please select a rate type (e.g., $/mo, $/season) for each configured rate before importing.",
        variant: "destructive",
      });
      return;
    }

    // Show soft warning for recommended fields not mapped - but don't block
    const recommendedFields = TENANT_AND_LEASE_FIELDS.filter(f => f.recommended);
    const missingRecommended = recommendedFields.filter(f => !columnMapping[f.value]);
    
    if (missingRecommended.length > 0) {
      toast({
        title: "Tip: Consider mapping these fields",
        description: `For better data quality, you may want to map: ${missingRecommended.map(f => f.label).join(', ')}. You can always add more data later.`,
        duration: 8000,
      });
    }

    setIsParsing(true);
    try {
      // Apply column mapping to rows, including rate configurations
      const mappedRows = fileRows.map(row => {
        const mappedRow: Record<string, any> = {};
        
        // Map standard fields
        Object.entries(columnMapping).forEach(([fieldName, fileColumn]) => {
          if (fileColumn && fileColumn !== "__skip__") {
            mappedRow[fieldName] = row[fileColumn] ?? '';
          }
        });
        
        // Map rate configurations to line item fields based on season type
        rateConfigs.forEach((config, index) => {
          if (config.columnKey && config.columnKey !== "") {
            const rawValue = row[config.columnKey];
            if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') {
              // Map to the appropriate line item field based on season type
              if (config.seasonType === 'annual') {
                mappedRow['leaseAmount'] = rawValue;
              } else if (config.seasonType === 'summer') {
                mappedRow['summerAmount'] = rawValue;
              } else if (config.seasonType === 'winter') {
                mappedRow['winterAmount'] = rawValue;
              }
            }
          }
          // Map slip column if configured
          if (config.slipColumnKey && config.slipColumnKey !== "") {
            const slipValue = row[config.slipColumnKey];
            if (slipValue !== undefined && slipValue !== null && String(slipValue).trim() !== '') {
              if (config.seasonType === 'annual') {
                mappedRow['unitLocation'] = slipValue;
              } else if (config.seasonType === 'summer') {
                mappedRow['summerSlip'] = slipValue;
              } else if (config.seasonType === 'winter') {
                mappedRow['winterSlip'] = slipValue;
              }
            }
          }
        });
        
        return mappedRow;
      });
      
      // Store rate configuration for backend processing
      const rateConfigPayload = rateConfigs.filter(r => r.columnKey && r.columnKey !== "");

      // First, detect unrecognized values in enum fields
      const detectResponse = await apiRequest('POST', '/api/rent-roll/leases/import/detect-values', {
        rows: fileRows,
        columnMapping,
      });

      if (!detectResponse.ok) {
        console.warn("Value detection failed, continuing with import...");
      } else {
        const detectResult = await detectResponse.json() as UnrecognizedValuesResponse;
        
        if (detectResult.hasUnrecognizedValues) {
          // Store the mapped rows for later use after value mapping
          setPendingMappedRows(mappedRows);
          setUnrecognizedValues(detectResult);
          
          // Initialize value mappings with empty strings (unmapped)
          const initialMappings: Record<string, Record<string, string>> = {};
          const initialConfidence: Record<string, Record<string, "high" | "medium" | "low">> = {};
          for (const [fieldId, fieldData] of Object.entries(detectResult.unrecognizedValues)) {
            initialMappings[fieldId] = {};
            initialConfidence[fieldId] = {};
            for (const value of fieldData.values) {
              initialMappings[fieldId][value] = ""; // Empty means unmapped
              initialConfidence[fieldId][value] = "low";
            }
          }
          setValueMappings(initialMappings);
          setAiSuggestionConfidence(initialConfidence);
          
          // Fetch AI suggestions in the background
          setIsLoadingAiSuggestions(true);
          setStep("value-mapping");
          setIsParsing(false);
          
          // Call AI suggestion endpoint asynchronously
          try {
            const suggestResponse = await apiRequest('POST', '/api/rent-roll/leases/import/suggest-mappings', {
              unrecognizedValues: detectResult.unrecognizedValues,
            });
            
            if (suggestResponse.ok) {
              const suggestResult = await suggestResponse.json() as {
                suggestions: Array<{
                  fieldId: string;
                  fieldLabel: string;
                  suggestions: Array<{
                    originalValue: string;
                    suggestedValue: string | null;
                    confidence: "high" | "medium" | "low";
                  }>;
                }>;
              };
              
              // Apply AI suggestions to value mappings
              const updatedMappings = { ...initialMappings };
              const updatedConfidence = { ...initialConfidence };
              
              for (const fieldSuggestion of suggestResult.suggestions) {
                if (updatedMappings[fieldSuggestion.fieldId]) {
                  for (const suggestion of fieldSuggestion.suggestions) {
                    if (suggestion.suggestedValue) {
                      updatedMappings[fieldSuggestion.fieldId][suggestion.originalValue] = suggestion.suggestedValue;
                      updatedConfidence[fieldSuggestion.fieldId][suggestion.originalValue] = suggestion.confidence;
                    }
                  }
                }
              }
              
              setValueMappings(updatedMappings);
              setAiSuggestionConfidence(updatedConfidence);
              
              toast({
                title: "AI suggestions ready",
                description: "We've pre-filled some mappings based on AI analysis. Review and adjust as needed.",
              });
            }
          } catch (aiError) {
            console.warn("AI suggestions failed, user can map manually:", aiError);
          } finally {
            setIsLoadingAiSuggestions(false);
          }
          
          return;
        }
      }

      // No unrecognized values - proceed directly to preview
      await proceedToPreview(mappedRows);
    } catch (error: any) {
      toast({
        title: "Error validating data",
        description: error.message || "Failed to validate the mapped data",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Helper function to finalize and go to preview step (no value detection)
  const finalizeToPreview = async (mappedRows: Record<string, any>[]) => {
    // Build extended column mapping that includes rate config fields
    const extendedColumnMapping = { ...columnMapping };
    rateConfigs.forEach(config => {
      if (config.columnKey && config.columnKey !== "") {
        if (config.seasonType === 'annual') {
          extendedColumnMapping['leaseAmount'] = 'leaseAmount';
        } else if (config.seasonType === 'summer') {
          extendedColumnMapping['summerAmount'] = 'summerAmount';
        } else if (config.seasonType === 'winter') {
          extendedColumnMapping['winterAmount'] = 'winterAmount';
        }
      }
      if (config.slipColumnKey && config.slipColumnKey !== "") {
        if (config.seasonType === 'annual') {
          extendedColumnMapping['unitLocation'] = 'unitLocation';
        } else if (config.seasonType === 'summer') {
          extendedColumnMapping['summerSlip'] = 'summerSlip';
        } else if (config.seasonType === 'winter') {
          extendedColumnMapping['winterSlip'] = 'winterSlip';
        }
      }
    });
    
    // Send mapped data to backend for validation
    const response = await apiRequest('POST', '/api/rent-roll/leases/import/parse', {
      rows: mappedRows,
      columnMapping: extendedColumnMapping,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Server error: ${response.status}`);
    }
    
    const result = await response.json() as ParseResponse;
    setParseResult(result);
    setStep("preview");
  };
  
  // Helper function to proceed after column mapping (handles multi-sheet and value detection)
  const proceedToPreview = async (mappedRows: Record<string, any>[]) => {
    // Build extended column mapping that includes rate config fields
    const extendedColumnMapping = { ...columnMapping };
    rateConfigs.forEach(config => {
      if (config.columnKey && config.columnKey !== "") {
        if (config.seasonType === 'annual') {
          extendedColumnMapping['leaseAmount'] = 'leaseAmount';
        } else if (config.seasonType === 'summer') {
          extendedColumnMapping['summerAmount'] = 'summerAmount';
        } else if (config.seasonType === 'winter') {
          extendedColumnMapping['winterAmount'] = 'winterAmount';
        }
      }
      if (config.slipColumnKey && config.slipColumnKey !== "") {
        if (config.seasonType === 'annual') {
          extendedColumnMapping['unitLocation'] = 'unitLocation';
        } else if (config.seasonType === 'summer') {
          extendedColumnMapping['summerSlip'] = 'summerSlip';
        } else if (config.seasonType === 'winter') {
          extendedColumnMapping['winterSlip'] = 'winterSlip';
        }
      }
    });
    
    // Send mapped data to backend for validation
    const response = await apiRequest('POST', '/api/rent-roll/leases/import/parse', {
      rows: mappedRows,
      columnMapping: extendedColumnMapping,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Server error: ${response.status}`);
    }
    
    const result = await response.json() as ParseResponse;

    // For multi-sheet import: save current sheet's mapping and result
    if (selectedSheets.length > 0) {
      const currentSheetName = selectedSheets[currentMappingSheetIndex];
      const newMapping: SheetMapping = {
        sheetName: currentSheetName,
        headers: fileHeaders,
        rows: fileRows,
        columnMapping: columnMapping,
        parseResult: result,
      };

      // Update sheet mappings
      const updatedMappings = [...sheetMappings];
      updatedMappings[currentMappingSheetIndex] = newMapping;
      setSheetMappings(updatedMappings);

      // Check if there are more sheets to map
      if (currentMappingSheetIndex < selectedSheets.length - 1) {
        // More sheets to map - move to next sheet
        const nextIndex = currentMappingSheetIndex + 1;
        setCurrentMappingSheetIndex(nextIndex);
        
        if (!excelWorkbook) {
          throw new Error("Workbook not loaded");
        }
        
        toast({
          title: "Sheet mapped successfully",
          description: `Moving to sheet ${nextIndex + 1} of ${selectedSheets.length}`,
        });

        // Parse next sheet for mapping
        parseSheetForMapping(excelWorkbook, selectedSheets[nextIndex]);
      } else {
        // All sheets mapped - combine and move to preview
        toast({
          title: "All sheets mapped",
          description: `Successfully mapped ${selectedSheets.length} sheet(s)`,
        });

        // Combine all parsed rows from all sheets
        const combinedParsedRows = updatedMappings.flatMap(m => m.parseResult?.parsedRows || []);
        
        setParseResult({
          parsedRows: combinedParsedRows,
          columnMapping: {}, // Not used in multi-sheet mode
        });
        setStep("preview");
      }
    } else {
      // Single-file/CSV import - go directly to preview
      setParseResult(result);
      setStep("preview");
    }
  };

  // Handle value mapping submission
  const handleSubmitValueMapping = async () => {
    setIsParsing(true);
    try {
      // Apply value mappings to the pending mapped rows
      const transformedRows = pendingMappedRows.map(row => {
        const newRow = { ...row };
        
        // For each field with value mappings
        for (const [fieldId, mappings] of Object.entries(valueMappings)) {
          const currentValue = row[fieldId];
          if (currentValue && mappings[currentValue]) {
            newRow[fieldId] = mappings[currentValue];
          }
        }
        
        return newRow;
      });

      // Use finalizeToPreview to skip back to preview (value detection already done)
      await finalizeToPreview(transformedRows);
    } catch (error: any) {
      toast({
        title: "Error processing data",
        description: error.message || "Failed to apply value mappings",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult) throw new Error("No parsed data");
      
      // Prepare file metadata if file is available
      let fileMetadata = null;
      if (file && locationId) {
        try {
          // Convert file to base64
          const fileBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          fileMetadata = {
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            byteSize: file.size,
            fileData: base64,
            sheetName: selectedSheets.length > 0 
              ? selectedSheets.join(', ') 
              : null,
          };
        } catch (error) {
          console.error("Error preparing file metadata:", error);
          // Continue without file metadata
        }
      }
      
      // Filter rate configs that have columns mapped
      const configuredRates = rateConfigs.filter(r => r.columnKey && r.columnKey !== "");
      
      const response = await apiRequest('POST', '/api/rent-roll/leases/import', {
        rows: parseResult.parsedRows,
        skipDuplicates,
        locationId: locationId || undefined,
        fileMetadata,
        importMode,
        rateConfiguration: configuredRates.length > 0 ? configuredRates : undefined,
        // New import options
        defaultStorageType: defaultStorageType || undefined,
        autoApplyContractTermDates,
        projectSeasonDates: autoApplyContractTermDates ? {
          seasonStart: projectData?.seasonStartDate || null,
          seasonEnd: projectData?.seasonEndDate || null,
          winterStart: projectData?.winterStartDate || null,
          winterEnd: projectData?.winterEndDate || null,
        } : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Import failed: ${response.status}`);
      }
      
      return await response.json() as ImportResponse;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("complete");
      
      // Invalidate all lease-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/available-years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/revenue-by-storage-type"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/included-projects"] });
      
      // Invalidate project-specific queries if locationId provided
      // Use array format with partial matching to hit queries with any date params
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/metrics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/move-events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/economic-vacancy"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/seasonal-occupancy"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/contract-term-occupancy"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/seasonal-move-events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/available-storage-types"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/leases-by-storage-location"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/locations", locationId] });
      }
      
      toast({
        title: "Import complete",
        description: `Imported ${data.imported} leases, skipped ${data.skipped}, ${data.errors} errors`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import leases",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    // Reset all state when closing drawer
    setFile(null);
    setFileHeaders([]);
    setFileRows([]);
    setColumnMapping({});
    setParseResult(null);
    setImportResult(null);
    setSelectedSheets([]);
    setSheetMappings([]);
    setCurrentMappingSheetIndex(0);
    setExcelWorkbook(null);
    // Reset value mapping state
    setUnrecognizedValues(null);
    setValueMappings({});
    setPendingMappedRows([]);
    setIsLoadingAiSuggestions(false);
    setAiSuggestionConfidence({});
    // Reset import options
    setImportMode('create');
    setSkipDuplicates(true);
    // Reset rate configuration
    setNumberOfRates(1);
    setRateConfigs([{ seasonType: 'annual', columnKey: '', slipColumnKey: '', rateBasis: 'per_month' }]);
    // Reset drag state
    setIsDragging(false);
    // Reset custom columns
    setCustomColumns([]);
    setCreatingCustomColumnFor(null);
    setNewCustomColumnName("");
    // Reset step last, after all other state is cleared
    setStep("upload");
    onClose();
  };

  const handleImportMore = () => {
    // Reset state but keep drawer open
    setStep("upload");
    setFile(null);
    setFileHeaders([]);
    setFileRows([]);
    setColumnMapping({});
    setParseResult(null);
    setImportResult(null);
    setSelectedSheets([]);
    setSheetMappings([]);
    setCurrentMappingSheetIndex(0);
    setExcelWorkbook(null);
    // Reset value mapping state
    setUnrecognizedValues(null);
    setValueMappings({});
    setPendingMappedRows([]);
    setIsLoadingAiSuggestions(false);
    setAiSuggestionConfidence({});
    // Reset import options
    setImportMode('create');
    setSkipDuplicates(true);
    // Reset rate configuration
    setNumberOfRates(1);
    setRateConfigs([{ seasonType: 'annual', columnKey: '', slipColumnKey: '', rateBasis: 'per_month' }]);
    // Reset drag state
    setIsDragging(false);
    // Reset custom columns
    setCustomColumns([]);
    setCreatingCustomColumnFor(null);
    setNewCustomColumnName("");
  };

  const validRows = parseResult?.parsedRows.filter(row => row.errors.length === 0) || [];
  const errorRows = parseResult?.parsedRows.filter(row => row.errors.length > 0) || [];
  const duplicateRows = validRows.filter(row => row.isDuplicate) || [];
  const warningRows = validRows.filter(row => row.warnings && row.warnings.length > 0) || [];

  // Step indicator helper
  const getStepNumber = () => {
    switch (step) {
      case "upload": return 1;
      case "sheet-selection": return 2;
      case "mapping": return 2;
      case "value-mapping": return 3;
      case "preview": return 3;
      case "complete": return 4;
      default: return 1;
    }
  };
  
  const stepLabels = ["Upload", "Map Columns", "Review", "Done"];
  const currentStepNum = getStepNumber();

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh] flex flex-col" data-testid="drawer-file-import">
        <DrawerHeader className="flex-shrink-0 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>Import Leases</DrawerTitle>
              <DrawerDescription className="text-sm">
                {step === "upload" && "Upload a file with tenant and lease data"}
                {step === "sheet-selection" && "Select sheets to import"}
                {step === "mapping" && "Map your columns to fields"}
                {step === "value-mapping" && "Review and map field values"}
                {step === "preview" && "Review data before importing"}
                {step === "complete" && "Import complete"}
              </DrawerDescription>
            </div>
            {step !== "complete" && (
              <div className="text-xs text-muted-foreground">
                Step {currentStepNum} of 4
              </div>
            )}
          </div>
          
          {/* Step Progress Indicator */}
          {step !== "complete" && (
            <div className="flex items-center gap-1 mt-3">
              {stepLabels.map((label, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === currentStepNum;
                const isComplete = stepNum < currentStepNum;
                
                return (
                  <div key={label} className="flex-1 flex flex-col items-center">
                    <div className={`h-1.5 w-full rounded-full transition-colors ${
                      isComplete ? 'bg-primary' : 
                      isActive ? 'bg-primary/60' : 
                      'bg-muted'
                    }`} />
                    <span className={`text-[10px] mt-1 ${
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DrawerHeader>

        <div className="flex-1 min-h-0 flex flex-col px-6 pb-6">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-6 overflow-y-auto">
              <div 
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 cursor-pointer ${
                  isDragging 
                    ? "border-primary bg-primary/5 scale-[1.02]" 
                    : "hover-elevate"
                } ${isParsing || showHeaderNotice ? "opacity-50 pointer-events-none" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isParsing && !showHeaderNotice && fileInputRef.current?.click()}
                data-testid="dropzone-file-upload"
              >
                <div className="max-w-md mx-auto space-y-6 pointer-events-none">
                  {isDragging ? (
                    <>
                      <Upload className="w-16 h-16 mx-auto text-primary animate-bounce" />
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-primary">
                          Drop your file here
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Release to upload your file
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-16 h-16 mx-auto text-muted-foreground" />
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-foreground">
                          Upload Lease Data
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Drag & drop a file here, or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports CSV, Excel, and PDF files (.csv, .xlsx, .xls, .pdf)
                        </p>
                      </div>
                    </>
                  )}
                  {isParsing && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                      Processing file...
                    </div>
                  )}
                </div>
              </div>
              
              {/* Hidden file input */}
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={isParsing || showHeaderNotice}
                data-testid="input-file-upload"
              />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Supported formats:</strong> CSV (.csv), Excel (.xlsx, .xls), PDF (.pdf)
                  <br />
                  <strong>Required:</strong> Your file must include column headers in the first row (CSV/Excel) or structured lease data (PDF)
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Sheet Selection Step */}
          {step === "sheet-selection" && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Header - Fixed */}
              <div className="flex-shrink-0 flex items-center justify-between gap-4 pb-3">
                <Alert className="flex-1">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Select one or more sheets to import from <strong>{file?.name}</strong>
                  </AlertDescription>
                </Alert>
                <div className="flex-shrink-0">
                  <label htmlFor="additional-file-upload">
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('additional-file-upload')?.click()}
                      data-testid="button-add-files"
                    >
                      + Add Files
                    </Button>
                  </label>
                  <Input
                    id="additional-file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isParsing}
                  />
                </div>
              </div>

              {/* Scrollable sheet list - Grows to fill space */}
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
                <div className="divide-y">
                  {availableSheets.map((sheet) => {
                    const isSelectable = sheet.hasHeaders && sheet.rowCount >= 2;
                    const isChecked = selectedSheets.includes(sheet.name);
                    
                    return (
                      <div
                        key={sheet.name}
                        className={`p-4 hover-elevate transition-colors ${!isSelectable ? 'opacity-40' : ''}`}
                        data-testid={`sheet-row-${sheet.name}`}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            id={`sheet-${sheet.name}`}
                            checked={isChecked}
                            onCheckedChange={() => {
                              if (isSelectable) {
                                handleToggleSheet(sheet.name);
                              }
                            }}
                            disabled={!isSelectable}
                            data-testid={`checkbox-sheet-${sheet.name}`}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={`sheet-${sheet.name}`}
                              className={`font-medium flex items-center gap-2 ${isSelectable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                            >
                              <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span className="truncate">{sheet.name}</span>
                              {isSelectable && (
                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              )}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              {sheet.rowCount} row{sheet.rowCount !== 1 ? 's' : ''} 
                              {sheet.hasHeaders ? ' with headers' : ' (no headers detected)'}
                            </p>
                            
                            {sheet.previewData && sheet.previewData.length > 0 && (
                              <div className="mt-3 border rounded-lg p-4 bg-muted/30">
                                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Preview</p>
                                <div className="space-y-1 font-mono text-xs">
                                  {sheet.previewData.slice(0, 3).map((row, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`p-2 rounded ${idx === 0 ? 'bg-primary/10 font-semibold' : 'bg-background'}`}
                                    >
                                      <div className="flex gap-4 overflow-x-auto">
                                        {Array.isArray(row) && row.slice(0, 6).map((cell, cellIdx) => (
                                          <span 
                                            key={cellIdx} 
                                            className="min-w-[100px] max-w-[150px] truncate"
                                            title={String(cell || '')}
                                          >
                                            {String(cell || '—')}
                                          </span>
                                        ))}
                                        {Array.isArray(row) && row.length > 6 && (
                                          <span className="text-muted-foreground">
                                            +{row.length - 6} more
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer - Fixed at bottom */}
              <div className="flex-shrink-0 flex items-center justify-between gap-4 pt-3 border-t mt-3">
                <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-to-upload">
                  Back
                </Button>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedSheets.length} sheet{selectedSheets.length !== 1 ? 's' : ''} selected
                  </p>
                  <Button 
                    onClick={handleStartMapping}
                    disabled={selectedSheets.length === 0}
                    data-testid="button-start-mapping"
                  >
                    Continue ({selectedSheets.length})
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {step === "mapping" && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Header - Compact */}
              <div className="flex-shrink-0 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {fileHeaders.length} columns found • {fileRows.length} data rows
                    </span>
                    {isLoadingColumnSuggestions && (
                      <span className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                        <Sparkles className="w-3 h-3 animate-pulse" />
                        AI analyzing columns...
                      </span>
                    )}
                    {!isLoadingColumnSuggestions && Object.keys(aiColumnSuggestions).length > 0 && (
                      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/30 px-2 py-1 rounded">
                        <Sparkles className="w-3 h-3" />
                        {Object.values(aiColumnSuggestions).filter(s => s.field && s.confidence === "high").length} auto-mapped
                      </span>
                    )}
                  </div>
                  {selectedSheets.length > 1 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      Sheet {currentMappingSheetIndex + 1}/{selectedSheets.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Column Editor Panel - Collapsible (less prominent) */}
              <Collapsible
                open={showColumnEditor}
                onOpenChange={setShowColumnEditor}
                className="flex-shrink-0"
              >
                <CollapsibleTrigger asChild>
                  <button 
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
                    data-testid="button-toggle-column-editor"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>{showColumnEditor ? "Hide column editor" : "Edit column names"}</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mb-3 p-2 border rounded bg-muted/20 max-h-32 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {fileHeaders.map((header) => (
                        <div key={header} className="group">
                          {editingColumn === header ? (
                            <div className="flex items-center gap-1 bg-background border rounded px-1.5 py-0.5">
                              <Input
                                value={editingColumnValue}
                                onChange={(e) => setEditingColumnValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleRenameColumn(header, editingColumnValue);
                                  } else if (e.key === "Escape") {
                                    setEditingColumn(null);
                                    setEditingColumnValue("");
                                  }
                                }}
                                onBlur={() => handleRenameColumn(header, editingColumnValue)}
                                autoFocus
                                className="h-6 w-32 text-xs px-1.5"
                                data-testid={`input-rename-column-${header}`}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => handleRenameColumn(header, editingColumnValue)}
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => {
                                  setEditingColumn(null);
                                  setEditingColumnValue("");
                                }}
                              >
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingColumn(header);
                                setEditingColumnValue(header);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-background border rounded hover-elevate cursor-pointer transition-colors"
                              data-testid={`button-edit-column-${header}`}
                            >
                              <span className="truncate max-w-[120px]" title={header}>
                                {header}
                              </span>
                              <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Scrollable mapping area - Grows to fill space */}
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg bg-card">
                <div className="p-3 space-y-4">
                  
                  {/* Manual Mode Notice - show when using fallback/empty data (AI extraction failed or returned no data) */}
                  {fileHeaders.length > 0 && fileRows.length <= 1 && fileRows.every(row => Object.values(row).every(v => !v || String(v).trim() === '')) && (
                    <Alert className="mb-3 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30" data-testid="alert-manual-mode">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div className="text-blue-800 dark:text-blue-200">
                        <span className="font-semibold">Manual Entry Mode</span>
                        <div className="text-sm mt-1">
                          AI extraction was unavailable or returned no data. You can still proceed by:
                        </div>
                        <ul className="list-disc ml-4 mt-1 text-sm space-y-0.5">
                          <li>Using the <strong>"Create custom column..."</strong> option in each dropdown to define your data structure</li>
                          <li>Editing column names above using the column editor</li>
                          <li>For best results, upload a CSV or Excel file with clear column headers</li>
                        </ul>
                      </div>
                    </Alert>
                  )}
                  
                  {/* Duplicate Column Warning */}
                  {duplicateMappings.length > 0 && (
                    <Alert variant="destructive" className="mb-3" data-testid="alert-duplicate-mappings">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-semibold">Duplicate column mappings detected:</span>
                        <ul className="mt-1 space-y-0.5 list-disc ml-4">
                          {duplicateMappings.map(({ column, fields }) => (
                            <li key={column} className="text-sm">
                              Column "<span className="font-mono">{column}</span>" is mapped to: {fields.join(', ')}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-sm">Each column should only be mapped to one field to avoid data conflicts.</p>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Tenant & Lease Fields Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground border-b pb-1">Tenant & Lease Information</h4>
                    {TENANT_AND_LEASE_FIELDS.map((field) => {
                      const currentMappedColumn = columnMapping[field.value];
                      const isColumnMapped = currentMappedColumn && currentMappedColumn.length > 0;
                      const sampleData = isColumnMapped 
                        ? fileRows.slice(0, 2).map(row => row[currentMappedColumn]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                        : [];
                      
                      // Find AI suggestion for this field
                      const aiSuggestion = Object.entries(aiColumnSuggestions).find(
                        ([_, suggestion]) => suggestion.field === field.value
                      );
                      const suggestedColumn = aiSuggestion?.[0];
                      const suggestionConfidence = aiSuggestion?.[1]?.confidence;
                      const suggestionReason = aiSuggestion?.[1]?.reason;
                      
                      return (
                        <div key={field.value} className={`p-2 border rounded bg-background ${field.recommended && !isColumnMapped ? 'border-amber-200 dark:border-amber-900/50' : ''}`}>
                          <div className="grid grid-cols-[160px,1fr] gap-3 items-start">
                            <div className="flex items-center gap-1.5 pt-2">
                              <Label className="text-sm font-medium truncate" htmlFor={`mapping-${field.value}`} title={field.label}>
                                {field.label}
                              </Label>
                              {field.recommended && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                                  isColumnMapped 
                                    ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400' 
                                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                                }`}>
                                  Key
                                </span>
                              )}
                              {suggestedColumn && suggestionConfidence === "high" && currentMappedColumn === suggestedColumn && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 flex items-center gap-0.5" title={suggestionReason || "AI auto-mapped"}>
                                  <Sparkles className="w-2.5 h-2.5" />AI
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <div className="relative">
                                {creatingCustomColumnFor === field.value ? (
                                  <div className="flex gap-2">
                                    <Input
                                      type="text"
                                      placeholder="Enter column name..."
                                      value={newCustomColumnName}
                                      onChange={(e) => setNewCustomColumnName(e.target.value)}
                                      className="h-8 text-sm flex-1"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newCustomColumnName.trim()) {
                                          const trimmedName = newCustomColumnName.trim();
                                          if (!fileHeaders.includes(trimmedName) && !customColumns.includes(trimmedName)) {
                                            setCustomColumns(prev => [...prev, trimmedName]);
                                            setFileHeaders(prev => [...prev, trimmedName]);
                                          }
                                          setColumnMapping(prev => ({ ...prev, [field.value]: trimmedName }));
                                          setCreatingCustomColumnFor(null);
                                          setNewCustomColumnName("");
                                        } else if (e.key === 'Escape') {
                                          setCreatingCustomColumnFor(null);
                                          setNewCustomColumnName("");
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        if (newCustomColumnName.trim()) {
                                          const trimmedName = newCustomColumnName.trim();
                                          if (!fileHeaders.includes(trimmedName) && !customColumns.includes(trimmedName)) {
                                            setCustomColumns(prev => [...prev, trimmedName]);
                                            setFileHeaders(prev => [...prev, trimmedName]);
                                          }
                                          setColumnMapping(prev => ({ ...prev, [field.value]: trimmedName }));
                                        }
                                        setCreatingCustomColumnFor(null);
                                        setNewCustomColumnName("");
                                      }}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        setCreatingCustomColumnFor(null);
                                        setNewCustomColumnName("");
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                <Select
                                  value={currentMappedColumn || "__skip__"}
                                  onValueChange={(value) => {
                                    if (value === "__create_custom__") {
                                      setCreatingCustomColumnFor(field.value);
                                      setNewCustomColumnName("");
                                    } else {
                                      const newValue = value === "__skip__" ? "" : value;
                                      setColumnMapping(prev => ({ ...prev, [field.value]: newValue }));
                                    }
                                  }}
                                >
                                  <SelectTrigger id={`mapping-${field.value}`} data-testid={`select-mapping-${field.value}`} className="h-8 text-sm">
                                    <SelectValue placeholder="Select column..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__skip__">Skip this field</SelectItem>
                                    <SelectItem value="__create_custom__">
                                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                        <Pencil className="w-3 h-3" />
                                        Create custom column...
                                      </span>
                                    </SelectItem>
                                    {fileHeaders.map(header => {
                                      const headerSuggestion = aiColumnSuggestions[header];
                                      const isAiSuggested = headerSuggestion?.field === field.value;
                                      const isCustom = customColumns.includes(header);
                                      return (
                                        <SelectItem key={header} value={header}>
                                          <span className="flex items-center gap-1.5">
                                            {header}
                                            {isCustom && (
                                              <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                                                Custom
                                              </span>
                                            )}
                                            {isAiSuggested && (
                                              <span className={`text-[9px] px-1 py-0.5 rounded ${
                                                headerSuggestion.confidence === "high" 
                                                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                                                  : headerSuggestion.confidence === "medium"
                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                              }`}>
                                                AI {headerSuggestion.confidence}
                                              </span>
                                            )}
                                          </span>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                )}
                                {/* AI suggestion hint when not yet mapped */}
                                {!isColumnMapped && suggestedColumn && suggestionConfidence !== "high" && (
                                  <button
                                    type="button"
                                    onClick={() => setColumnMapping(prev => ({ ...prev, [field.value]: suggestedColumn }))}
                                    className={`mt-1 text-xs flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer hover-elevate transition-colors ${
                                      suggestionConfidence === "medium"
                                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                                        : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                                    }`}
                                    title={suggestionReason || "AI suggested mapping"}
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    Suggest: <span className="font-mono">{suggestedColumn}</span>
                                    <span className="text-[9px] uppercase opacity-75">({suggestionConfidence})</span>
                                  </button>
                                )}
                              </div>
                              {isColumnMapped && sampleData.length > 0 && (
                                <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 border border-green-200 dark:border-green-900">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">Sample:</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {sampleData.map((value, idx) => {
                                      const formattedValue = formatSampleValue(value, field.value);
                                      return (
                                        <p key={idx} className="text-xs font-mono text-green-800 dark:text-green-300 truncate" title={formattedValue}>
                                          {formattedValue.substring(0, 40)}{formattedValue.length > 40 ? '...' : ''}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Import Options Section */}
                  <div className="space-y-3" data-testid="section-import-options">
                    <div className="border-b pb-1">
                      <h4 className="text-sm font-semibold text-foreground">Import Options</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Configure default values and automatic date inference.
                      </p>
                    </div>
                    
                    {/* Default Storage Type - shown when Storage Type column is not mapped */}
                    {!columnMapping['storageType'] && projectConfig?.enabledStorageTypes && projectConfig.enabledStorageTypes.length > 0 && (
                      <div className="p-3 border rounded bg-background border-amber-200 dark:border-amber-900/50">
                        <div className="grid grid-cols-[160px,1fr] gap-3 items-start">
                          <div className="flex items-center gap-1.5 pt-2">
                            <Label className="text-sm font-medium">Default Storage Type</Label>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                              Recommended
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <Select
                              value={defaultStorageType || "__none__"}
                              onValueChange={(value) => setDefaultStorageType(value === "__none__" ? "" : value)}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid="select-default-storage-type">
                                <SelectValue placeholder="Select storage type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">No default (leave empty)</SelectItem>
                                {projectConfig.enabledStorageTypes.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              This storage type will be applied to all rows in this import.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Auto-apply contract term dates */}
                    {columnMapping['contractTerm'] && (!columnMapping['leaseCommencement'] || !columnMapping['leaseExpiration']) && (
                      <div className="p-3 border rounded bg-background">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="auto-apply-dates"
                            checked={autoApplyContractTermDates}
                            onCheckedChange={(checked) => setAutoApplyContractTermDates(checked === true)}
                            className="mt-1"
                            data-testid="checkbox-auto-apply-dates"
                          />
                          <div className="flex-1">
                            <Label htmlFor="auto-apply-dates" className="text-sm font-medium cursor-pointer">
                              Auto-apply dates from Contract Term
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              When enabled, leases will automatically get commencement/expiration dates based on their Contract Term value:
                            </p>
                            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 ml-3 list-disc">
                              <li><strong>Annual:</strong> 1/1 to 12/31 of the selected year</li>
                              <li><strong>Summer/Season:</strong> {projectData?.seasonStartDate || '05/01'} to {projectData?.seasonEndDate || '10/31'} (from Details tab)</li>
                              <li><strong>Winter:</strong> {projectData?.winterStartDate || '11/01'} to {projectData?.winterEndDate || '04/30'} (from Details tab)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Rate Configuration Section */}
                  <div className="space-y-3" data-testid="section-rate-configuration">
                    <div className="border-b pb-1">
                      <h4 className="text-sm font-semibold text-foreground" data-testid="heading-rate-configuration">Rate Configuration</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Configure how rates are structured in your file. Season dates are auto-applied from project settings.
                      </p>
                    </div>
                    
                    {/* AI Rate Structure Hint */}
                    {rateStructureHint && (
                      <div className={`p-2 rounded border flex items-center gap-2 ${
                        rateStructureHint === "seasonal" 
                          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
                          : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      }`}>
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {rateStructureHint === "seasonal" ? (
                            <>AI detected <strong>separate seasonal rates</strong> (Winter/Summer). Consider using 2-3 rate configuration.</>
                          ) : rateStructureHint === "mixed" ? (
                            <>AI detected <strong>mixed rate structure</strong>. Review columns carefully.</>
                          ) : (
                            <>AI detected <strong>annual rate structure</strong>. 1 rate configuration recommended.</>
                          )}
                        </p>
                      </div>
                    )}
                    
                    {/* Number of Rates Selector */}
                    <div className="p-3 border rounded bg-background">
                      <div className="grid grid-cols-[160px,1fr] gap-3 items-center">
                        <Label className="text-sm font-medium">Number of Rates</Label>
                        <Select
                          value={String(numberOfRates)}
                          onValueChange={(value) => handleNumberOfRatesChange(Number(value) as 1 | 2 | 3)}
                        >
                          <SelectTrigger className="h-8 text-sm w-40" data-testid="select-number-of-rates">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Rate (Annual)</SelectItem>
                            <SelectItem value="2">2 Rates (e.g., Summer + Winter)</SelectItem>
                            <SelectItem value="3">3 Rates</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Dynamic Rate Configs */}
                    {rateConfigs.map((config, index) => {
                      const rateSampleData = config.columnKey 
                        ? fileRows.slice(0, 2).map(row => row[config.columnKey]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                        : [];
                      const slipSampleData = config.slipColumnKey 
                        ? fileRows.slice(0, 2).map(row => row[config.slipColumnKey]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                        : [];
                      
                      return (
                        <div key={index} className="p-3 border rounded bg-background space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {config.seasonType === 'annual' ? 'Annual' : config.seasonType === 'summer' ? 'Summer Season' : 'Winter Season'}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {getSeasonDateLabel(config.seasonType)}
                            </span>
                          </div>
                          
                          {/* Season Type Selector */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Season Type</Label>
                            <Select
                              value={config.seasonType}
                              onValueChange={(value) => updateRateConfig(index, 'seasonType', value)}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid={`select-rate-type-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="annual">Annual (Full Year)</SelectItem>
                                <SelectItem value="summer">Summer Season</SelectItem>
                                <SelectItem value="winter">Winter Season</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            {/* Rate Amount Column */}
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                {config.seasonType === 'winter' ? 'Winter Rate Column' : config.seasonType === 'summer' ? 'Summer Rate Column' : 'Rate Amount Column'}
                              </Label>
                              <Select
                                value={config.columnKey || "__skip__"}
                                onValueChange={(value) => updateRateConfig(index, 'columnKey', value === "__skip__" ? "" : value)}
                              >
                                <SelectTrigger className="h-8 text-sm" data-testid={`select-rate-column-${index}`}>
                                  <SelectValue placeholder="Select column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__">Skip this rate</SelectItem>
                                  {fileHeaders.map(header => (
                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {config.columnKey && rateSampleData.length > 0 && (
                                <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 border border-green-200 dark:border-green-900">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">Sample:</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {rateSampleData.map((value, idx) => (
                                      <p key={idx} className="text-xs font-mono text-green-800 dark:text-green-300 truncate">
                                        {formatCurrencyForPreview(value)}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Slip Location Column */}
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                {config.seasonType === 'winter' ? 'Winter Slip Column' : config.seasonType === 'summer' ? 'Summer Slip Column' : 'Slip/Location Column'}
                              </Label>
                              <Select
                                value={config.slipColumnKey || "__skip__"}
                                onValueChange={(value) => updateRateConfig(index, 'slipColumnKey', value === "__skip__" ? "" : value)}
                              >
                                <SelectTrigger className="h-8 text-sm" data-testid={`select-slip-column-${index}`}>
                                  <SelectValue placeholder="Select column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__">No slip column</SelectItem>
                                  {fileHeaders.map(header => (
                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {config.slipColumnKey && slipSampleData.length > 0 && (
                                <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 border border-green-200 dark:border-green-900">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">Sample:</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {slipSampleData.map((value, idx) => (
                                      <p key={idx} className="text-xs font-mono text-green-800 dark:text-green-300 truncate">
                                        {String(value)}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Rate Basis Type Selector */}
                          <div className="space-y-1 pt-2 border-t border-dashed">
                            <Label className="text-xs text-muted-foreground">Rate Type (how is this rate expressed?)</Label>
                            <Select
                              value={config.rateBasis}
                              onValueChange={(value) => updateRateConfig(index, 'rateBasis', value)}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid={`select-rate-basis-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RATE_BASIS_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                              {config.rateBasis.includes('per_ft') 
                                ? 'System will calculate monthly rent using boat length from file.'
                                : config.rateBasis === 'per_season'
                                  ? 'System will convert seasonal rate to monthly equivalent.'
                                  : config.rateBasis === 'per_year'
                                    ? 'System will divide annual rate by 12 for monthly rent.'
                                    : config.rateBasis === 'per_contract'
                                      ? 'System will divide total contract value by # of months to get monthly rent.'
                                      : 'Rate will be used directly as monthly rent.'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Season Dates Info */}
                    {projectData && (projectData.seasonStartDate || projectData.winterStartDate) && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-medium">Season dates from project settings:</p>
                            <p>Summer: {projectData.seasonStartDate || '05/01'} - {projectData.seasonEndDate || '10/31'}</p>
                            <p>Winter: {projectData.winterStartDate || '11/01'} - {projectData.winterEndDate || '04/30'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Additional Fees Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground border-b pb-1">Additional Fees</h4>
                    {ADDITIONAL_FEE_FIELDS.map((field) => {
                      const currentMappedColumn = columnMapping[field.value];
                      const isColumnMapped = currentMappedColumn && currentMappedColumn.length > 0;
                      const sampleData = isColumnMapped 
                        ? fileRows.slice(0, 2).map(row => row[currentMappedColumn]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                        : [];
                      
                      return (
                        <div key={field.value} className="p-2 border rounded bg-background">
                          <div className="grid grid-cols-[160px,1fr] gap-3 items-start">
                            <div className="flex items-center gap-1.5 pt-2">
                              <Label className="text-sm font-medium truncate" htmlFor={`mapping-${field.value}`} title={field.label}>
                                {field.label}
                              </Label>
                            </div>
                            <div className="space-y-1.5">
                              <Select
                                value={currentMappedColumn || "__skip__"}
                                onValueChange={(value) => {
                                  const newValue = value === "__skip__" ? "" : value;
                                  setColumnMapping(prev => ({ ...prev, [field.value]: newValue }));
                                }}
                              >
                                <SelectTrigger id={`mapping-${field.value}`} data-testid={`select-mapping-${field.value}`} className="h-8 text-sm">
                                  <SelectValue placeholder="Select column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__">Skip this field</SelectItem>
                                  {fileHeaders.map(header => (
                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isColumnMapped && sampleData.length > 0 && (
                                <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 border border-green-200 dark:border-green-900">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">Sample:</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {sampleData.map((value, idx) => {
                                      const formattedValue = formatSampleValue(value, field.value);
                                      return (
                                        <p key={idx} className="text-xs font-mono text-green-800 dark:text-green-300 truncate" title={formattedValue}>
                                          {formattedValue.substring(0, 40)}{formattedValue.length > 40 ? '...' : ''}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                </div>
              </div>

              {/* Footer - Fixed at bottom */}
              <div className="flex-shrink-0 flex justify-between gap-2 pt-3 border-t mt-3">
                <Button
                  onClick={() => setStep("upload")}
                  variant="outline"
                  size="sm"
                  data-testid="button-back-to-upload"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmitMapping}
                  disabled={isParsing}
                  size="sm"
                  data-testid="button-continue-mapping"
                >
                  {isParsing ? "Validating..." : "Continue to Preview"}
                </Button>
              </div>
            </div>
          )}

          {/* Value Mapping Step */}
          {step === "value-mapping" && unrecognizedValues && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Header - Fixed */}
              <div className="flex-shrink-0 space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Map Field Values</h3>
                  <span className="text-xs text-muted-foreground">
                    {Object.keys(unrecognizedValues.unrecognizedValues).length} field(s) with unrecognized values
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Some values in your file don't match expected options. Map them to valid values or keep them as-is.
                </p>
                {isLoadingAiSuggestions ? (
                  <Alert className="py-2 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                      <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                        AI is analyzing values to suggest mappings...
                      </AlertDescription>
                    </div>
                  </Alert>
                ) : (
                  <Alert className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      AI suggestions are pre-filled below. Review and adjust as needed.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Scrollable content - Grows to fill space */}
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg bg-card">
                <div className="p-3 space-y-4">
                  {Object.entries(unrecognizedValues.unrecognizedValues).map(([fieldId, fieldData]) => (
                    <div key={fieldId} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{fieldData.fieldLabel}</h4>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {fieldData.values.length} unrecognized value{fieldData.values.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="space-y-2 pl-2 border-l-2 border-muted">
                        {fieldData.values.map((value) => {
                          const confidence = aiSuggestionConfidence[fieldId]?.[value];
                          const hasSuggestion = valueMappings[fieldId]?.[value] && valueMappings[fieldId]?.[value] !== "";
                          
                          return (
                            <div key={value} className="p-2 border rounded bg-background">
                              <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
                                <div className="flex items-center gap-2">
                                  <div className="px-2 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded text-sm font-mono truncate" title={value}>
                                    {value}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    ({fieldData.occurrences[value]} row{fieldData.occurrences[value] !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                
                                <span className="text-muted-foreground">→</span>
                                
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={valueMappings[fieldId]?.[value] || "__keep__"}
                                    onValueChange={(newValue) => {
                                      setValueMappings(prev => ({
                                        ...prev,
                                        [fieldId]: {
                                          ...prev[fieldId],
                                          [value]: newValue === "__keep__" ? "" : newValue,
                                        },
                                      }));
                                      // Clear AI confidence when user manually changes
                                      setAiSuggestionConfidence(prev => ({
                                        ...prev,
                                        [fieldId]: {
                                          ...prev[fieldId],
                                          [value]: "low",
                                        },
                                      }));
                                    }}
                                  >
                                    <SelectTrigger 
                                      className="h-8 text-sm flex-1" 
                                      data-testid={`select-value-mapping-${fieldId}-${value}`}
                                    >
                                      <SelectValue placeholder="Select mapping..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__keep__">
                                        <span className="text-muted-foreground italic">Keep original value</span>
                                      </SelectItem>
                                      {fieldData.validOptions.map(option => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  {hasSuggestion && confidence && confidence !== "low" && (
                                    <span 
                                      className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                                        confidence === "high" 
                                          ? "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400" 
                                          : "bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400"
                                      }`}
                                      title={`AI confidence: ${confidence}`}
                                    >
                                      AI {confidence === "high" ? "✓" : "?"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer - Fixed at bottom */}
              <div className="flex-shrink-0 flex justify-between gap-2 pt-3 border-t mt-3">
                <Button
                  onClick={() => setStep("mapping")}
                  variant="outline"
                  size="sm"
                  data-testid="button-back-to-mapping"
                >
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={async () => {
                      // Skip value mapping and proceed with original values
                      setIsParsing(true);
                      try {
                        await finalizeToPreview(pendingMappedRows);
                      } catch (error: any) {
                        toast({
                          title: "Error processing data",
                          description: error.message || "Failed to process data",
                          variant: "destructive",
                        });
                      } finally {
                        setIsParsing(false);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isParsing}
                    data-testid="button-skip-value-mapping"
                  >
                    Skip Mapping
                  </Button>
                  <Button
                    onClick={handleSubmitValueMapping}
                    disabled={isParsing}
                    size="sm"
                    data-testid="button-apply-value-mapping"
                  >
                    {isParsing ? "Processing..." : "Apply & Continue"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && parseResult && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Header - Fixed */}
              <div className="flex-shrink-0 space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Preview Import</h3>
                    <p className="text-sm text-muted-foreground">
                      Review the data before importing.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("mapping")}
                    className="gap-1.5"
                    data-testid="button-edit-mapping"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Mapping
                  </Button>
                </div>
                {selectedSheets.length > 1 && (
                  <Alert className="py-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Combined from <strong>{selectedSheets.length} sheets</strong>
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Current Mapping Summary */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 px-2" data-testid="button-toggle-mapping-summary">
                      <span className="text-muted-foreground">
                        {Object.entries(columnMapping).filter(([_, v]) => v !== 'skip').length} columns mapped
                      </span>
                      <span className="text-muted-foreground">Show mappings</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-2 bg-muted/30 rounded border text-xs space-y-1 max-h-32 overflow-y-auto">
                      {Object.entries(columnMapping)
                        .filter(([_, fieldValue]) => fieldValue !== 'skip')
                        .map(([header, fieldValue]) => {
                          const fieldLabel = IMPORT_FIELDS.find(f => f.value === fieldValue)?.label || fieldValue;
                          return (
                            <div key={header} className="flex justify-between items-center py-0.5">
                              <span className="text-muted-foreground truncate max-w-[45%]" title={header}>{header}</span>
                              <span className="text-foreground font-medium truncate max-w-[45%]" title={fieldLabel}>{fieldLabel}</span>
                            </div>
                          );
                        })}
                      {Object.entries(columnMapping).filter(([_, v]) => v !== 'skip').length === 0 && (
                        <p className="text-muted-foreground italic">No columns mapped</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Scrollable content - Grows to fill space */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-3 pr-2">
                  {/* Stats Cards - Compact */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-3 border rounded bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                      <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 mb-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Valid</span>
                      </div>
                      <p className="text-xl font-bold text-green-900 dark:text-green-300">{validRows.length}</p>
                    </div>
                    <div className="p-3 border rounded bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 mb-0.5">
                        <Info className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Warnings</span>
                      </div>
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-300">{warningRows.length}</p>
                    </div>
                    <div className="p-3 border rounded bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                      <div className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400 mb-0.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Duplicates</span>
                      </div>
                      <p className="text-xl font-bold text-yellow-900 dark:text-yellow-300">{duplicateRows.length}</p>
                    </div>
                    <div className="p-3 border rounded bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                      <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 mb-0.5">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Errors</span>
                      </div>
                      <p className="text-xl font-bold text-red-900 dark:text-red-300">{errorRows.length}</p>
                    </div>
                  </div>

                  {errorRows.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-red-600 dark:text-red-400">Errors (will not be imported):</h4>
                      <div className="max-h-24 overflow-y-auto border rounded p-2 bg-red-50/50 dark:bg-red-950/10">
                        <div className="space-y-0.5">
                          {errorRows.slice(0, 10).map(row => (
                            <div key={row.rowIndex} className="text-xs" data-testid={`error-row-${row.rowIndex}`}>
                              <span className="font-medium text-red-600 dark:text-red-400">Row {row.rowIndex + 1}:</span>{' '}
                              {row.errors.join(', ')}
                            </div>
                          ))}
                          {errorRows.length > 10 && (
                            <p className="text-xs text-muted-foreground">...and {errorRows.length - 10} more</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {warningRows.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400">Warnings (will still import):</h4>
                      <div className="max-h-24 overflow-y-auto border rounded p-2 bg-blue-50/50 dark:bg-blue-950/10">
                        <div className="space-y-0.5">
                          {warningRows.slice(0, 10).map(row => (
                            <div key={row.rowIndex} className="text-xs" data-testid={`warning-row-${row.rowIndex}`}>
                              <span className="font-medium text-blue-600 dark:text-blue-400">Row {row.rowIndex + 1}:</span>{' '}
                              {row.warnings.join(', ')}
                            </div>
                          ))}
                          {warningRows.length > 10 && (
                            <p className="text-xs text-muted-foreground">...and {warningRows.length - 10} more</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import Mode Selection */}
                  {duplicateRows.length > 0 && (
                    <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                      <h4 className="text-sm font-medium">How to handle matching tenants?</h4>
                      <div className="grid gap-2">
                        <label className="flex items-start gap-3 p-2 rounded border cursor-pointer hover-elevate transition-colors">
                          <input
                            type="radio"
                            name="importMode"
                            value="create"
                            checked={importMode === 'create'}
                            onChange={() => setImportMode('create')}
                            className="mt-1"
                            data-testid="radio-import-mode-create"
                          />
                          <div>
                            <p className="text-sm font-medium">Create new records only</p>
                            <p className="text-xs text-muted-foreground">Skip existing tenants - don't update their data</p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 p-2 rounded border cursor-pointer hover-elevate transition-colors">
                          <input
                            type="radio"
                            name="importMode"
                            value="append"
                            checked={importMode === 'append'}
                            onChange={() => setImportMode('append')}
                            className="mt-1"
                            data-testid="radio-import-mode-append"
                          />
                          <div>
                            <p className="text-sm font-medium">Add missing data to existing tenants</p>
                            <p className="text-xs text-muted-foreground">Fill in empty fields for matched tenants, keep existing values</p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 p-2 rounded border cursor-pointer hover-elevate transition-colors">
                          <input
                            type="radio"
                            name="importMode"
                            value="replace"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="mt-1"
                            data-testid="radio-import-mode-replace"
                          />
                          <div>
                            <p className="text-sm font-medium">Update existing tenants</p>
                            <p className="text-xs text-muted-foreground">Overwrite existing fields with new values from this file</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {importMode === 'create' && duplicateRows.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="skipDuplicates"
                        checked={skipDuplicates}
                        onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                        data-testid="checkbox-skip-duplicates"
                      />
                      <Label htmlFor="skipDuplicates" className="text-sm cursor-pointer">
                        Skip {duplicateRows.length} duplicate{duplicateRows.length !== 1 ? 's' : ''}
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - Fixed at bottom */}
              <div className="flex-shrink-0 flex justify-end gap-2 pt-3 border-t mt-3">
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={validRows.length === 0 || importMutation.isPending}
                  size="sm"
                  data-testid="button-import"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importMutation.isPending ? "Importing..." : `Import ${validRows.length} Lease${validRows.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && importResult && (
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-500" />
                </div>
                <h3 className="text-2xl font-semibold mb-2">Import Complete!</h3>
                <p className="text-muted-foreground text-lg">
                  {importResult.imported > 0 && `Created ${importResult.imported} new lease${importResult.imported !== 1 ? 's' : ''}`}
                  {importResult.imported > 0 && importResult.updated && importResult.updated > 0 && ', '}
                  {importResult.updated && importResult.updated > 0 && `Updated ${importResult.updated} existing tenant${importResult.updated !== 1 ? 's' : ''}`}
                  {importResult.imported === 0 && (!importResult.updated || importResult.updated === 0) && 'No records imported'}
                </p>
              </div>

              <div className={`grid gap-4 ${importResult.updated && importResult.updated > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Created</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500">{importResult.imported}</p>
                </div>
                {importResult.updated !== undefined && importResult.updated > 0 && (
                  <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Updated</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">{importResult.updated}</p>
                  </div>
                )}
                <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{importResult.skipped}</p>
                </div>
                <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/20 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Errors</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">{importResult.errors}</p>
                </div>
              </div>

              {importResult.details?.failed && importResult.details.failed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-red-600">Failed Imports:</h4>
                  <ScrollArea className="h-48 border rounded-lg p-4">
                    <div className="space-y-2">
                      {importResult.details.failed.map((item, index) => (
                        <div key={index} className="text-sm" data-testid={`failed-import-${index}`}>
                          <span className="font-medium">{item.tenantName}:</span>{' '}
                          <span className="text-red-600">{item.error}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {importResult.details?.duplicates && importResult.details.duplicates.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-yellow-600">Skipped Duplicates:</h4>
                  <ScrollArea className="h-32 border rounded-lg p-4">
                    <div className="space-y-2">
                      {importResult.details.duplicates.map((item, index) => (
                        <div key={index} className="text-sm text-muted-foreground" data-testid={`duplicate-${index}`}>
                          {item.tenantName}: {item.reason}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {importResult.details?.updated && importResult.details.updated.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-blue-600">Updated Tenants:</h4>
                  <ScrollArea className="h-32 border rounded-lg p-4">
                    <div className="space-y-2">
                      {importResult.details.updated.map((item, index) => (
                        <div key={index} className="text-sm" data-testid={`updated-${index}`}>
                          <span className="font-medium">{item.tenantName}:</span>{' '}
                          <span className="text-blue-600 dark:text-blue-400">
                            {item.reason || 'Data merged'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleImportMore} className="flex-1" data-testid="button-import-more">
                  <Upload className="w-4 h-4 mr-2" />
                  Import More Files
                </Button>
                <Button onClick={handleClose} variant="outline" className="flex-1" data-testid="button-close">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>

      {/* Header Notice Dialog - Blocks upload until dismissed */}
      <AlertDialog open={showHeaderNotice} onOpenChange={setShowHeaderNotice}>
        <AlertDialogContent data-testid="dialog-header-notice">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Important: File Format Requirements
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-base text-foreground font-medium">
                Your file must have column headers in the first row
              </p>
              <p className="text-sm">
                After uploading, you'll map your columns to the required fields:
              </p>
              <ul className="text-sm space-y-1 list-disc pl-5">
                <li>Tenant Name (required)</li>
                <li>Commencement Date (required)</li>
                <li>Monthly Rent (required)</li>
                <li>Storage Type (required)</li>
                <li>Plus optional fields like address, boat details, and more</li>
              </ul>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox 
                  id="dont-show-notice-dialog" 
                  checked={dontShowHeaderNotice}
                  onCheckedChange={(checked) => setDontShowHeaderNotice(checked as boolean)}
                  data-testid="checkbox-dont-show-again"
                />
                <Label htmlFor="dont-show-notice-dialog" className="text-sm cursor-pointer font-normal">
                  Don't show this message again
                </Label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDismissHeaderNotice} data-testid="button-dismiss-notice">
              Got it, let's upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}

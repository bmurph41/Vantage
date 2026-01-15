import { z } from "zod";

export type ImportSessionStatus = 
  | "uploaded" 
  | "sheet_selected" 
  | "columns_mapped" 
  | "values_mapped" 
  | "previewed" 
  | "imported" 
  | "failed";

export type ImportMode = "create" | "append" | "replace";

export type ConfidenceLevel = "high" | "medium" | "low";

export type RateSeasonType = "annual" | "summer" | "winter";

export type RateBasisType = 
  | "per_month" 
  | "per_season" 
  | "per_year" 
  | "per_contract" 
  | "per_ft_month" 
  | "per_ft_season" 
  | "per_ft_year";

export interface RateConfig {
  seasonType: RateSeasonType;
  columnKey: string;
  slipColumnKey?: string;
  rateBasis: RateBasisType;
}

export const RATE_BASIS_OPTIONS: { value: RateBasisType; label: string }[] = [
  { value: "per_month", label: "$/Month (flat monthly rate)" },
  { value: "per_season", label: "$/Season (flat seasonal rate)" },
  { value: "per_year", label: "$/Year (flat annual rate)" },
  { value: "per_contract", label: "Total Contract Value (full term amount)" },
  { value: "per_ft_month", label: "$/Ft/Month (per foot per month)" },
  { value: "per_ft_season", label: "$/Ft/Season (per foot for season)" },
  { value: "per_ft_year", label: "$/Ft/Year (per foot per year)" },
];

export interface ImportOptions {
  defaultStorageType?: string;
  autoApplyContractTermDates?: boolean;
  projectSeasonDates?: {
    seasonStart: string | null;
    seasonEnd: string | null;
    winterStart: string | null;
    winterEnd: string | null;
  };
  rateConfiguration?: RateConfig[];
}

export interface ParsedColumn {
  name: string;
  index: number;
  sampleValues: string[];
  dataType: "text" | "number" | "date" | "currency" | "mixed";
  isEmpty: boolean;
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
  previewData?: any[][];
}

export interface ColumnMappingSuggestion {
  sourceColumn: string;
  targetField: string | null;
  confidence: ConfidenceLevel;
  reason: string;
  isCustomField?: boolean;
}

export interface ValueMappingItem {
  fieldId: string;
  fieldLabel: string;
  originalValue: string;
  occurrences: number;
  suggestedValue: string | null;
  confidence: ConfidenceLevel;
  isResolved: boolean;
  userSelectedValue?: string | null;
}

export interface UnrecognizedValues {
  [fieldId: string]: {
    fieldLabel: string;
    values: string[];
    validOptions: string[];
    occurrences: Record<string, number>;
  };
}

export interface ParsedAddress {
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface ImportRowValidation {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
  existingRecordId?: string;
}

export interface ImportSession {
  id: string;
  orgId: string;
  userId: string;
  status: ImportSessionStatus;
  fileName: string;
  fileType: "csv" | "excel" | "pdf";
  fileSize: number;
  uploadedAt: Date;
  selectedSheet?: string;
  sheets?: SheetInfo[];
  headers: string[];
  rawRows: Record<string, any>[];
  totalRows: number;
  columnMappings: ColumnMappingSuggestion[];
  customFields: CustomFieldDefinition[];
  valueMappings: ValueMappingItem[];
  rateConfiguration?: RateConfig[];
  defaultStorageType?: string;
  autoApplyContractTermDates?: boolean;
  importMode: ImportMode;
  skipDuplicates: boolean;
  parseConfidence: ConfidenceLevel;
  extractionMethod: "direct" | "ocr" | "ai" | "heuristic";
  parsedRows?: ParsedImportRow[];
  warnings: string[];
  errors: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "currency" | "boolean";
  required: boolean;
  defaultValue?: string;
  createdByUser: boolean;
}

export const TENANT_FIELDS: ImportFieldDefinition[] = [
  { id: "tenantName", label: "Tenant Name", type: "text", required: false, recommended: true, aliases: ["tenant", "lessee", "name", "customer", "owner", "renter", "client", "boat owner", "vessel owner"] },
  { id: "boatMake", label: "Boat Make", type: "text", required: false, aliases: ["make", "manufacturer", "brand", "boat_make", "vessel make"] },
  { id: "boatModel", label: "Boat Model", type: "text", required: false, aliases: ["model", "boat_model", "vessel model"] },
  { id: "boatYear", label: "Boat Year", type: "number", required: false, aliases: ["year", "model_year", "boat_year", "vessel year"] },
  { id: "boatLength", label: "Boat Length (ft)", type: "number", required: false, aliases: ["length", "loa", "boat_size", "size", "overall length", "vessel length", "loa (ft)"] },
  { id: "boatWidth", label: "Boat Width/Beam (ft)", type: "number", required: false, aliases: ["width", "beam", "boat_width", "vessel beam"] },
  { id: "tenantEmail", label: "Tenant Email", type: "text", required: false, aliases: ["email", "email_address", "e-mail", "contact email"] },
  { id: "tenantPhone", label: "Tenant Phone", type: "text", required: false, aliases: ["phone", "phone_number", "telephone", "mobile", "cell", "contact phone"] },
  { id: "address1", label: "Address Line 1", type: "text", required: false, aliases: ["address1", "street", "street_address", "address line 1"] },
  { id: "address2", label: "Address Line 2", type: "text", required: false, aliases: ["address2", "apt", "suite", "unit", "address line 2"] },
  { id: "city", label: "City", type: "text", required: false, aliases: ["city", "town"] },
  { id: "state", label: "State", type: "text", required: false, aliases: ["state", "province", "region"] },
  { id: "zip", label: "ZIP Code", type: "text", required: false, aliases: ["zip", "zipcode", "postal", "postal_code"] },
  { id: "fullAddress", label: "Full Address (AI will split)", type: "text", required: false, aliases: ["address", "full_address", "complete_address", "mailing_address", "customer address"] },
];

export const LEASE_FIELDS: ImportFieldDefinition[] = [
  { id: "unitLocation", label: "Unit/Slip Location", type: "text", required: false, aliases: ["slip", "unit", "space", "dock", "location", "berth", "spot", "stall", "slip #", "slip number", "slip no"] },
  { id: "storageType", label: "Storage Type", type: "text", required: false, recommended: true, aliases: ["type", "storage", "category", "class", "storage type", "slip type"], validValues: ["Wet Slip", "Wet Slips", "Lift Slip", "Lift Slips", "Mooring", "Moorings", "Jet Ski", "Jet Skis", "Dry Rack - Indoor", "Dry Racks - Indoor", "Dry Rack - Outdoor", "Dry Racks - Outdoor", "Houseboat", "Houseboats", "Land Storage", "Boat on Trailer", "Trailered Boats", "Trailer Only", "Trailers", "Dinghies/Small Boats", "Carports", "RV Sites", "Cabins", "Sales", "Service", "Commercial", "Rental Boats", "Boat Club", "Mixed"] },
  { id: "leaseAmount", label: "Monthly Rent (Base Rent)", type: "currency", required: false, recommended: true, aliases: ["rent", "rate", "amount", "fee", "charge", "monthly", "price", "cost", "base rent", "monthly rent", "slip fee"] },
  { id: "baseRent2", label: "Base Rent 2", type: "currency", required: false, aliases: ["rent 2", "rate 2", "second rate", "alternate rent"] },
  { id: "baseRent3", label: "Base Rent 3", type: "currency", required: false, aliases: ["rent 3", "rate 3", "third rate"] },
  { id: "leaseCommencement", label: "Lease Start Date", type: "date", required: false, recommended: true, aliases: ["start", "begin", "commence", "from", "effective", "start_date", "lease start", "commencement", "start date"] },
  { id: "leaseExpiration", label: "Lease End Date", type: "date", required: false, aliases: ["end", "expire", "expiration", "through", "to_date", "term_end", "end_date", "lease end", "expiration date"] },
  { id: "contractTerm", label: "Contract Term", type: "text", required: false, aliases: ["term", "contract", "period", "season", "contract type", "lease type", "term type"], validValues: ["Annual", "Seasonal", "Summer", "Winter", "Monthly", "Short-Term", "Transient"] },
  { id: "slipStatus", label: "Slip Status", type: "text", required: false, aliases: ["status", "occupancy", "slip status"], validValues: ["Occupied", "Vacant", "Reserved", "Maintenance", "Sold"] },
  { id: "slipLength", label: "Slip Length (ft)", type: "number", required: false, aliases: ["slip length", "dock length", "slip size"] },
  { id: "slipWidth", label: "Slip Width (ft)", type: "number", required: false, aliases: ["slip width", "dock width"] },
  { id: "leaseOnFile", label: "Lease on File", type: "boolean", required: false, aliases: ["lease on file", "has lease", "lease document"] },
  { id: "coiOnFile", label: "COI on File", type: "boolean", required: false, aliases: ["coi on file", "has coi", "insurance on file"] },
  { id: "coiExpiration", label: "COI Expiration", type: "date", required: false, aliases: ["coi expiration", "insurance expiration", "coi exp"] },
  { id: "hasDiscount", label: "Has Discount", type: "boolean", required: false, aliases: ["discount", "has discount", "discounted"] },
  { id: "discountType", label: "Discount Type", type: "text", required: false, aliases: ["discount type", "discount reason"] },
  { id: "discountValue", label: "Discount Value", type: "currency", required: false, aliases: ["discount value", "discount amount"] },
  { id: "notes", label: "Notes/Comments", type: "text", required: false, aliases: ["notes", "comments", "memo", "remarks", "special instructions"] },
];

export const SEASONAL_RATE_FIELDS: ImportFieldDefinition[] = [
  { id: "winterAmount", label: "Winter Slip Amount", type: "currency", required: false, aliases: ["winter amount", "winter rate", "winter fee", "winter slip", "winter rent"] },
  { id: "summerAmount", label: "Summer Slip Amount", type: "currency", required: false, aliases: ["summer amount", "summer rate", "summer fee", "summer slip", "summer rent", "seasonal amount"] },
  { id: "seasonalAmount", label: "Seasonal Slip Amount", type: "currency", required: false, aliases: ["seasonal amount", "season rate", "seasonal fee"] },
  { id: "winterSlip", label: "Winter Slip Assignment", type: "text", required: false, aliases: ["winter slip", "winter location", "winter berth"] },
  { id: "summerSlip", label: "Summer Slip Assignment", type: "text", required: false, aliases: ["summer slip", "summer location", "summer berth"] },
];

export const ADDITIONAL_FEE_FIELDS: ImportFieldDefinition[] = [
  { id: "liveaboardAmount", label: "Liveaboard Fee", type: "currency", required: false, aliases: ["liveaboard", "liveaboard_fee", "liveaboard_charge", "live aboard fee"] },
  { id: "electricAmount", label: "Electric Fee", type: "currency", required: false, aliases: ["electric", "electric_fee", "electric_charge", "power_fee", "electricity"] },
  { id: "additionalCharge1", label: "Additional Charge 1", type: "currency", required: false, aliases: ["additional 1", "charge 1", "extra 1", "misc 1"] },
  { id: "additionalCharge2", label: "Additional Charge 2", type: "currency", required: false, aliases: ["additional 2", "charge 2", "extra 2", "misc 2"] },
  { id: "additionalCharge3", label: "Additional Charge 3", type: "currency", required: false, aliases: ["additional 3", "charge 3", "extra 3", "misc 3"] },
];

export const RENT_ROLL_TARGET_FIELDS: ImportFieldDefinition[] = [
  ...TENANT_FIELDS,
  ...LEASE_FIELDS,
  ...SEASONAL_RATE_FIELDS,
  ...ADDITIONAL_FEE_FIELDS,
];

export interface ImportFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "currency" | "boolean";
  required: boolean;
  recommended?: boolean;
  aliases: string[];
  validValues?: string[];
  validator?: (value: any) => { valid: boolean; error?: string };
  transformer?: (value: any) => any;
}

export interface ParsedImportRow {
  rowIndex: number;
  tenantData: Record<string, any>;
  leaseData: Record<string, any>;
  lineItemData?: Record<string, any>;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
  duplicateMatchReason?: string;
  existingLeaseId?: string;
  existingTenantId?: string;
}

export interface ParseResponse {
  parsedRows: ParsedImportRow[];
  columnMapping: Record<string, string>;
  rateStructureHint?: "annual" | "seasonal" | "mixed" | null;
  contractTermHints?: { column: string; detectedTerms: string[] }[];
}

export interface DuplicateMatch {
  tenantId: string;
  tenantName: string;
  leaseId?: string;
  matchType: "name_exact" | "name_fuzzy" | "slip_conflict" | "date_overlap";
  matchDetails: string;
  confidence: number;
}

export const rateConfigSchema = z.object({
  seasonType: z.enum(["annual", "summer", "winter"]),
  columnKey: z.string(),
  slipColumnKey: z.string().optional(),
  rateBasis: z.enum(["per_month", "per_season", "per_year", "per_contract", "per_ft_month", "per_ft_season", "per_ft_year"]),
});

export const importSessionSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["csv", "excel", "pdf"]),
  importMode: z.enum(["create", "append", "replace"]).default("create"),
  skipDuplicates: z.boolean().default(true),
});

export const columnMappingRequestSchema = z.object({
  sessionId: z.string().uuid(),
  mappings: z.array(z.object({
    sourceColumn: z.string(),
    targetField: z.string().nullable(),
    isCustomField: z.boolean().optional(),
  })),
  customFields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["text", "number", "date", "currency", "boolean"]),
    required: z.boolean().default(false),
  })).optional(),
});

export const valueMappingRequestSchema = z.object({
  sessionId: z.string().uuid(),
  valueMappings: z.array(z.object({
    fieldId: z.string(),
    originalValue: z.string(),
    mappedValue: z.string().nullable(),
  })),
});

export const importExecuteRequestSchema = z.object({
  sessionId: z.string().uuid(),
  targetLocationId: z.string().uuid(),
  importMode: z.enum(["create", "append", "replace"]),
  skipDuplicates: z.boolean().default(true),
  skipInvalidRows: z.boolean().default(false),
  rateConfiguration: z.array(rateConfigSchema).optional(),
  defaultStorageType: z.string().optional(),
  autoApplyContractTermDates: z.boolean().optional(),
});

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
  details: {
    created: { tenantName: string; id: string }[];
    updated: { tenantName: string; id: string }[];
    duplicates: { tenantName: string; reason: string }[];
    failed: { tenantName: string; error: string; rowIndex: number }[];
  };
}

export function validateDate(value: any): { valid: boolean; error?: string } {
  if (!value || String(value).trim() === '') return { valid: true };
  const strValue = String(value).trim();
  if (!isNaN(Number(strValue)) && Number(strValue) > 1000 && Number(strValue) < 100000) {
    return { valid: true };
  }
  const date = new Date(strValue);
  if (isNaN(date.getTime())) {
    return { valid: false, error: `Invalid date format: ${strValue}` };
  }
  return { valid: true };
}

export function validateNumber(value: any): { valid: boolean; error?: string } {
  if (!value || String(value).trim() === '') return { valid: true };
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  if (isNaN(Number(cleaned))) {
    return { valid: false, error: `Invalid number: ${value}` };
  }
  return { valid: true };
}

export function transformDate(value: any): string | null {
  if (!value || String(value).trim() === '') return null;
  const strValue = String(value).trim();
  if (!isNaN(Number(strValue)) && Number(strValue) > 1000 && Number(strValue) < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Number(strValue) * 86400000);
    return date.toISOString().split('T')[0];
  }
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

export function transformCurrency(value: any): string {
  if (!value || String(value).trim() === '') return '0';
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? '0' : num.toFixed(2);
}

export function transformBoolean(value: any): boolean | null {
  if (!value || String(value).trim() === '') return null;
  const strValue = String(value).toLowerCase().trim();
  if (['true', 'yes', 'y', '1', 'x', 'checked'].includes(strValue)) return true;
  if (['false', 'no', 'n', '0', '', 'unchecked'].includes(strValue)) return false;
  return null;
}

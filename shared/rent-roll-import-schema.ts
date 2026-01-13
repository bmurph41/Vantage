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
  totalRows: number;
  columnMappings: ColumnMappingSuggestion[];
  customFields: CustomFieldDefinition[];
  valueMappings: ValueMappingItem[];
  importMode: ImportMode;
  skipDuplicates: boolean;
  parseConfidence: ConfidenceLevel;
  extractionMethod: "direct" | "ocr" | "ai" | "heuristic";
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

export const RENT_ROLL_TARGET_FIELDS: ImportFieldDefinition[] = [
  { id: "tenantName", label: "Tenant Name", type: "text", required: true, aliases: ["tenant", "lessee", "name", "customer", "owner", "renter", "client"] },
  { id: "unitLocation", label: "Unit/Slip Location", type: "text", required: true, aliases: ["slip", "unit", "space", "dock", "location", "berth", "spot", "stall"] },
  { id: "storageType", label: "Storage Type", type: "text", required: false, aliases: ["type", "storage", "category", "class"], validValues: ["Wet Slip", "Lift Slip", "Mooring", "Jet Ski", "Dry Rack - Indoor", "Dry Rack - Outdoor", "Houseboat", "Land Storage", "Boat on Trailer", "Trailer Only"] },
  { id: "leaseAmount", label: "Lease Amount", type: "currency", required: false, aliases: ["rent", "rate", "amount", "fee", "charge", "monthly", "price", "cost"] },
  { id: "leaseCommencement", label: "Lease Start Date", type: "date", required: false, aliases: ["start", "begin", "commence", "from", "effective", "start_date"] },
  { id: "leaseExpiration", label: "Lease End Date", type: "date", required: false, aliases: ["end", "expire", "expiration", "through", "to_date", "term_end", "end_date"] },
  { id: "boatLength", label: "Boat Length (ft)", type: "number", required: false, aliases: ["length", "loa", "boat_size", "size"] },
  { id: "boatWidth", label: "Boat Beam/Width (ft)", type: "number", required: false, aliases: ["width", "beam"] },
  { id: "boatMake", label: "Boat Make", type: "text", required: false, aliases: ["make", "manufacturer", "brand"] },
  { id: "boatModel", label: "Boat Model", type: "text", required: false, aliases: ["model"] },
  { id: "boatYear", label: "Boat Year", type: "number", required: false, aliases: ["year", "model_year"] },
  { id: "contractTerm", label: "Contract Term", type: "text", required: false, aliases: ["term", "contract", "period", "season"], validValues: ["Annual", "Seasonal", "Winter", "Monthly", "Short-Term", "Transient"] },
  { id: "status", label: "Lease Status", type: "text", required: false, aliases: ["status", "occupancy"], validValues: ["Active", "Expired", "Pending", "Cancelled", "Hold"] },
  { id: "tenantEmail", label: "Tenant Email", type: "text", required: false, aliases: ["email", "email_address", "e-mail"] },
  { id: "tenantPhone", label: "Tenant Phone", type: "text", required: false, aliases: ["phone", "phone_number", "telephone", "mobile", "cell"] },
  { id: "fullAddress", label: "Full Address (AI will split)", type: "text", required: false, aliases: ["address", "full_address", "complete_address", "mailing_address"] },
  { id: "address1", label: "Street Address", type: "text", required: false, aliases: ["address1", "street", "street_address"] },
  { id: "city", label: "City", type: "text", required: false, aliases: ["city", "town"] },
  { id: "state", label: "State", type: "text", required: false, aliases: ["state", "province", "region"] },
  { id: "zip", label: "ZIP/Postal Code", type: "text", required: false, aliases: ["zip", "zipcode", "postal", "postal_code"] },
  { id: "electricIncluded", label: "Electric Included", type: "boolean", required: false, aliases: ["electric", "electric_included", "power"] },
  { id: "electricFee", label: "Electric Fee", type: "currency", required: false, aliases: ["electric_fee", "electric_charge", "power_fee"] },
  { id: "liveaboardAllowed", label: "Liveaboard Allowed", type: "boolean", required: false, aliases: ["liveaboard", "live_aboard", "live_on"] },
  { id: "liveaboardFee", label: "Liveaboard Fee", type: "currency", required: false, aliases: ["liveaboard_fee", "liveaboard_charge"] },
  { id: "notes", label: "Notes/Comments", type: "text", required: false, aliases: ["notes", "comments", "memo", "remarks"] },
];

export interface ImportFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "currency" | "boolean";
  required: boolean;
  aliases: string[];
  validValues?: string[];
  validator?: (value: any) => { valid: boolean; error?: string };
  transformer?: (value: any) => any;
}

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

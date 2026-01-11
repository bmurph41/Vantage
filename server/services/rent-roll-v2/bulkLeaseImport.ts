import { db } from "./db";
import { tenants, leases, leaseLineItems, marinaLocations, type InsertTenant, type InsertLease, type InsertLeaseLineItem } from "@shared/schema";
import {
  ALL_IMPORT_FIELDS,
  TENANT_IMPORT_FIELDS,
  LEASE_IMPORT_FIELDS,
  LINE_ITEM_IMPORT_FIELDS,
  type ImportFieldMetadata,
  type ParsedImportRow,
  type ParsedLineItemData,
  type BulkLeaseImportResponse,
} from "@shared/schema";
import { buildLeaseKey, diffInDays, diffInMonthsInclusive, generateLeaseCashFlows } from "./rentRollService";
import { eq, and, sql } from "drizzle-orm";

/**
 * Fetches project season dates for auto-applying to leases without dates
 */
export async function getProjectSeasonDates(locationId: string): Promise<{
  seasonStart: string | null;
  seasonEnd: string | null;
  winterStart: string | null;
  winterEnd: string | null;
}> {
  const [project] = await db
    .select({
      seasonStartDate: marinaLocations.seasonStartDate,
      seasonEndDate: marinaLocations.seasonEndDate,
      winterStartDate: marinaLocations.winterStartDate,
      winterEndDate: marinaLocations.winterEndDate,
    })
    .from(marinaLocations)
    .where(eq(marinaLocations.id, locationId));
  
  if (!project) {
    return { seasonStart: null, seasonEnd: null, winterStart: null, winterEnd: null };
  }
  
  return {
    seasonStart: project.seasonStartDate,
    seasonEnd: project.seasonEndDate,
    winterStart: project.winterStartDate,
    winterEnd: project.winterEndDate,
  };
}

/**
 * Converts MM/DD format to full date string for current year
 * Appends T12:00:00 to prevent timezone shifts
 */
function convertSeasonDateToFullDate(mmdd: string | null, year: number): string | null {
  if (!mmdd) return null;
  const [month, day] = mmdd.split('/');
  if (!month || !day) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`;
}

/**
 * Maps CSV column names to field IDs using flexible alias matching
 */
export function mapColumnHeaders(headers: string[]): Map<string, string> {
  const columnMap = new Map<string, string>();
  
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    
    // Find matching field by checking aliases
    for (const field of ALL_IMPORT_FIELDS) {
      const matchedAlias = field.aliases.find(alias => 
        alias.toLowerCase() === normalized
      );
      
      if (matchedAlias) {
        columnMap.set(header, field.id);
        break;
      }
    }
  }
  
  return columnMap;
}

/**
 * Validates and transforms a single row from CSV
 */
export function parseImportRow(
  row: Record<string, any>,
  rowIndex: number,
  columnMap: Map<string, string>,
  skipMissingColumnCheck: boolean = false
): ParsedImportRow {
  const tenantData: Partial<InsertTenant> = {};
  const leaseData: Partial<Omit<InsertLease, "tenantId">> = {};
  const lineItemData: ParsedLineItemData = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  // Process each CSV column
  for (const [csvColumn, fieldId] of Array.from(columnMap.entries())) {
    const value = row[csvColumn];
    const field = ALL_IMPORT_FIELDS.find(f => f.id === fieldId);
    
    if (!field) continue;

    // Check if field is required but empty
    if (field.required && (!value || String(value).trim() === "")) {
      errors.push(`${field.label} is required`);
      continue;
    }

    // Skip empty optional fields
    if (!value || String(value).trim() === "") {
      continue;
    }

    // Validate value
    if (field.validator) {
      const validation = field.validator(value);
      if (!validation.valid) {
        errors.push(`${field.label}: ${validation.error}`);
        continue;
      }
    }

    // Transform value
    const transformedValue = field.transformer ? field.transformer(value) : value;

    // Assign to tenant, lease, or line item data
    if (TENANT_IMPORT_FIELDS.some(f => f.id === fieldId)) {
      (tenantData as any)[fieldId] = transformedValue;
    } else if (LEASE_IMPORT_FIELDS.some(f => f.id === fieldId)) {
      (leaseData as any)[fieldId] = transformedValue;
    } else if (LINE_ITEM_IMPORT_FIELDS.some(f => f.id === fieldId)) {
      (lineItemData as any)[fieldId] = transformedValue;
    }
  }

  // Check for required fields that weren't mapped from CSV
  // Skip this check for user-provided mappings (frontend validates required fields)
  if (!skipMissingColumnCheck) {
    const mappedFieldIds = new Set(columnMap.values());
    for (const field of ALL_IMPORT_FIELDS) {
      if (field.required && !mappedFieldIds.has(field.id)) {
        errors.push(`Missing required column: ${field.label}`);
      }
    }
  }

  // Check if we have line item data - calculate total if leaseAmount not provided
  const hasLineItems = Object.values(lineItemData).some(v => v !== undefined && v !== null && v !== "");
  
  // If we have line items but no leaseAmount, calculate total from line items
  if (hasLineItems && !leaseData.leaseAmount) {
    const lineItemTotal = (
      (Number(lineItemData.winterAmount) || 0) +
      (Number(lineItemData.summerAmount) || 0) +
      (Number(lineItemData.seasonalAmount) || 0) +
      (Number(lineItemData.liveaboardAmount) || 0) +
      (Number(lineItemData.electricAmount) || 0)
    );
    if (lineItemTotal > 0) {
      leaseData.leaseAmount = String(lineItemTotal);
    }
  }

  // Add data quality warnings for missing critical fields (only if no errors)
  // These don't prevent import but alert users to incomplete data
  if (errors.length === 0) {
    if (!tenantData.name || String(tenantData.name).trim() === "") {
      warnings.push("Missing Tenant Name - lease will be difficult to identify");
    }
    if (!leaseData.leaseAmount || String(leaseData.leaseAmount).trim() === "") {
      warnings.push("Missing Lease Amount (Base Rent 1) - revenue tracking will be incomplete");
    }
    if (!leaseData.leaseCommencement || String(leaseData.leaseCommencement).trim() === "") {
      warnings.push("Missing Lease Commencement - unable to calculate lease timeline");
    }
  }

  return {
    rowIndex,
    tenantData,
    leaseData,
    lineItemData: hasLineItems ? lineItemData : undefined,
    errors,
    warnings,
  };
}

/**
 * Finds potential duplicate tenants based on name and optional boat/address matching
 * Also retrieves existing lease IDs for consolidation when line items need to be added
 */
export async function findDuplicateTenants(
  parsedRows: ParsedImportRow[],
  locationId?: string | null
): Promise<ParsedImportRow[]> {
  const rowsWithDuplicateCheck = [...parsedRows];

  for (const row of rowsWithDuplicateCheck) {
    if (row.errors.length > 0 || !row.tenantData.name) continue;

    // Check for existing tenant by name (case-insensitive)
    const existingTenants = await db
      .select()
      .from(tenants)
      .where(sql`LOWER(${tenants.name}) = LOWER(${row.tenantData.name})`);

    if (existingTenants.length > 0) {
      // Check if boat info matches (if provided)
      const exactMatch = existingTenants.find((t: typeof tenants.$inferSelect) => {
        const boatMatch = 
          !row.tenantData.boatMake || 
          t.boatMake?.toLowerCase() === row.tenantData.boatMake?.toLowerCase();
        
        const addressMatch =
          !row.tenantData.address1 ||
          t.address1?.toLowerCase() === row.tenantData.address1?.toLowerCase();

        return boatMatch && addressMatch;
      });

      if (exactMatch) {
        row.isDuplicate = true;
        row.duplicateMatchReason = `Tenant "${row.tenantData.name}" already exists`;
        if (exactMatch.boatMake) {
          row.duplicateMatchReason += ` with boat ${exactMatch.boatMake}`;
        }
        
        // Find existing lease for this tenant (for line item consolidation)
        const existingLeases = await db
          .select({ id: leases.id })
          .from(leases)
          .where(
            locationId 
              ? and(eq(leases.tenantId, exactMatch.id), eq(leases.locationId, locationId))
              : eq(leases.tenantId, exactMatch.id)
          );
        
        if (existingLeases.length > 0) {
          row.existingLeaseId = existingLeases[0].id;
        }
      }
    }
  }

  return rowsWithDuplicateCheck;
}

/**
 * Validates slip uniqueness within import data and against existing leases
 * Checks if the same slip (unitLocation) is assigned to multiple active leases with overlapping dates
 */
export async function validateSlipUniqueness(
  parsedRows: ParsedImportRow[],
  locationId?: string | null
): Promise<ParsedImportRow[]> {
  const rowsWithSlipCheck = [...parsedRows];

  // Build a map of slips -> rows for checking within the import
  const slipToRows = new Map<string, number[]>();
  
  for (let i = 0; i < rowsWithSlipCheck.length; i++) {
    const row = rowsWithSlipCheck[i];
    if (row.errors.length > 0) continue;
    
    const unitLocation = row.leaseData.unitLocation;
    if (!unitLocation || String(unitLocation).trim() === "") continue;
    
    const normalizedSlip = String(unitLocation).trim().toLowerCase();
    if (!slipToRows.has(normalizedSlip)) {
      slipToRows.set(normalizedSlip, []);
    }
    slipToRows.get(normalizedSlip)!.push(i);
  }

  // Check for duplicates within the import file
  for (const [slip, rowIndices] of Array.from(slipToRows.entries())) {
    if (rowIndices.length > 1) {
      // Check for date overlaps between rows with the same slip
      for (let i = 0; i < rowIndices.length; i++) {
        for (let j = i + 1; j < rowIndices.length; j++) {
          const row1 = rowsWithSlipCheck[rowIndices[i]];
          const row2 = rowsWithSlipCheck[rowIndices[j]];
          
          if (datesOverlap(row1.leaseData, row2.leaseData)) {
            row2.warnings.push(
              `Slip "${row1.leaseData.unitLocation}" is also assigned to "${row1.tenantData.name}" in row ${rowIndices[i] + 1} with overlapping dates`
            );
          }
        }
      }
    }
  }

  // Check against existing leases in the database
  if (locationId) {
    const existingLeases = await db
      .select({
        id: leases.id,
        unitNumber: leases.unitNumber,
        tenantName: tenants.name,
        leaseCommencement: leases.leaseCommencement,
        leaseExpiration: leases.leaseExpiration,
        isActive: leases.isActive,
      })
      .from(leases)
      .innerJoin(tenants, eq(leases.tenantId, tenants.id))
      .where(
        and(
          eq(leases.locationId, locationId),
          eq(leases.isActive, true)
        )
      );

    const existingSlipMap = new Map<string, typeof existingLeases>();
    for (const lease of existingLeases) {
      if (!lease.unitNumber) continue;
      const normalizedSlip = lease.unitNumber.trim().toLowerCase();
      if (!existingSlipMap.has(normalizedSlip)) {
        existingSlipMap.set(normalizedSlip, []);
      }
      existingSlipMap.get(normalizedSlip)!.push(lease);
    }

    // Check import rows against existing leases
    for (const row of rowsWithSlipCheck) {
      if (row.errors.length > 0) continue;
      
      const unitLocation = row.leaseData.unitLocation;
      if (!unitLocation || String(unitLocation).trim() === "") continue;
      
      const normalizedSlip = String(unitLocation).trim().toLowerCase();
      const existingWithSlip = existingSlipMap.get(normalizedSlip);
      
      if (existingWithSlip && existingWithSlip.length > 0) {
        for (const existing of existingWithSlip) {
          // Skip if this is the row's own existing lease (for append/replace operations)
          if (row.existingLeaseId && existing.id === row.existingLeaseId) {
            continue;
          }
          
          if (datesOverlapWithExisting(row.leaseData, existing)) {
            row.warnings.push(
              `Slip "${unitLocation}" is currently assigned to existing tenant "${existing.tenantName}" with overlapping dates`
            );
          }
        }
      }
    }
  }

  return rowsWithSlipCheck;
}

/**
 * Validates contract date overlaps for the same tenant
 * Checks if a tenant would have multiple leases with overlapping date ranges
 */
export async function validateContractOverlaps(
  parsedRows: ParsedImportRow[],
  locationId?: string | null
): Promise<ParsedImportRow[]> {
  const rowsWithOverlapCheck = [...parsedRows];

  // Build a map of tenant names -> rows for checking within the import
  const tenantToRows = new Map<string, number[]>();
  
  for (let i = 0; i < rowsWithOverlapCheck.length; i++) {
    const row = rowsWithOverlapCheck[i];
    if (row.errors.length > 0 || !row.tenantData.name) continue;
    
    const normalizedName = row.tenantData.name.trim().toLowerCase();
    if (!tenantToRows.has(normalizedName)) {
      tenantToRows.set(normalizedName, []);
    }
    tenantToRows.get(normalizedName)!.push(i);
  }

  // Check for overlaps within the import file (same tenant, overlapping dates)
  for (const [tenantName, rowIndices] of Array.from(tenantToRows.entries())) {
    if (rowIndices.length > 1) {
      for (let i = 0; i < rowIndices.length; i++) {
        for (let j = i + 1; j < rowIndices.length; j++) {
          const row1 = rowsWithOverlapCheck[rowIndices[i]];
          const row2 = rowsWithOverlapCheck[rowIndices[j]];
          
          if (datesOverlap(row1.leaseData, row2.leaseData)) {
            row2.warnings.push(
              `Contract dates overlap with another lease for "${row1.tenantData.name}" in row ${rowIndices[i] + 1}`
            );
          }
        }
      }
    }
  }

  // Check against existing leases in the database
  if (locationId) {
    for (const row of rowsWithOverlapCheck) {
      if (row.errors.length > 0 || !row.tenantData.name) continue;
      
      // Check if this tenant has existing leases with overlapping dates
      const existingLeases = await db
        .select({
          id: leases.id,
          leaseCommencement: leases.leaseCommencement,
          leaseExpiration: leases.leaseExpiration,
          contractTerm: leases.contractTerm,
        })
        .from(leases)
        .innerJoin(tenants, eq(leases.tenantId, tenants.id))
        .where(
          and(
            eq(leases.locationId, locationId),
            sql`LOWER(${tenants.name}) = LOWER(${row.tenantData.name})`
          )
        );

      for (const existing of existingLeases) {
        // Skip if this is the row's own existing lease (for append/replace operations)
        if (row.existingLeaseId && existing.id === row.existingLeaseId) {
          continue;
        }
        
        if (datesOverlapWithExisting(row.leaseData, existing)) {
          row.warnings.push(
            `Contract dates overlap with an existing ${existing.contractTerm || ""} lease for this tenant`
          );
          break; // Only show one warning per tenant
        }
      }
    }
  }

  return rowsWithOverlapCheck;
}

/**
 * Helper: Check if two import rows have overlapping date ranges
 * Returns false if either lease lacks a start date (can't determine overlap)
 */
function datesOverlap(
  lease1: Partial<Omit<InsertLease, "tenantId">>,
  lease2: Partial<Omit<InsertLease, "tenantId">>
): boolean {
  // Must have valid start dates to check overlap
  const start1Str = lease1.leaseCommencement;
  const start2Str = lease2.leaseCommencement;
  
  if (!start1Str || !start2Str || 
      String(start1Str).trim() === "" || String(start2Str).trim() === "") {
    return false;
  }
  
  const start1 = new Date(start1Str);
  const start2 = new Date(start2Str);
  
  // Validate parsed dates
  if (isNaN(start1.getTime()) || isNaN(start2.getTime())) {
    return false;
  }

  // Parse end dates, use far future if missing
  const end1Str = lease1.leaseExpiration;
  const end2Str = lease2.leaseExpiration;
  const effectiveEnd1 = end1Str && String(end1Str).trim() !== "" 
    ? new Date(end1Str) 
    : new Date("2099-12-31");
  const effectiveEnd2 = end2Str && String(end2Str).trim() !== "" 
    ? new Date(end2Str) 
    : new Date("2099-12-31");

  // Check for overlap: start1 <= end2 AND start2 <= end1
  return start1 <= effectiveEnd2 && start2 <= effectiveEnd1;
}

/**
 * Helper: Check if an import row overlaps with an existing lease
 * Returns false if either lease lacks a start date (can't determine overlap)
 */
function datesOverlapWithExisting(
  newLease: Partial<Omit<InsertLease, "tenantId">>,
  existingLease: { leaseCommencement: string | null; leaseExpiration: string | null }
): boolean {
  // Must have valid start dates to check overlap
  const start1Str = newLease.leaseCommencement;
  const start2Str = existingLease.leaseCommencement;
  
  if (!start1Str || !start2Str || 
      String(start1Str).trim() === "" || String(start2Str).trim() === "") {
    return false;
  }
  
  const start1 = new Date(start1Str);
  const start2 = new Date(start2Str);
  
  // Validate parsed dates
  if (isNaN(start1.getTime()) || isNaN(start2.getTime())) {
    return false;
  }

  // Parse end dates, use far future if missing
  const end1Str = newLease.leaseExpiration;
  const end2Str = existingLease.leaseExpiration;
  const effectiveEnd1 = end1Str && String(end1Str).trim() !== "" 
    ? new Date(end1Str) 
    : new Date("2099-12-31");
  const effectiveEnd2 = end2Str && String(end2Str).trim() !== "" 
    ? new Date(end2Str) 
    : new Date("2099-12-31");

  return start1 <= effectiveEnd2 && start2 <= effectiveEnd1;
}

/**
 * Import mode options:
 * - 'create': Create new tenants/leases only, skip duplicates
 * - 'append': Create new tenants OR update existing ones with new data (fill gaps)
 * - 'replace': Create new tenants OR fully overwrite existing data
 */
export type ImportMode = 'create' | 'append' | 'replace';

/**
 * Creates line items from parsed import data
 */
async function createLineItemsFromImport(
  leaseId: string,
  lineItemData: ParsedLineItemData,
  leaseStart: Date | null,
  leaseEnd: Date | null
): Promise<void> {
  const lineItemsToCreate: InsertLeaseLineItem[] = [];
  
  // Helper to format dates for line items
  const formatDate = (d: Date | null): string | null => {
    if (!d) return null;
    return d.toISOString().split('T')[0];
  };
  
  // Winter slip line item
  if (lineItemData.winterAmount && Number(lineItemData.winterAmount) > 0) {
    lineItemsToCreate.push({
      leaseId,
      lineType: "winter_slip",
      amount: String(lineItemData.winterAmount),
      slipAssignment: lineItemData.winterSlip || null,
      startDate: formatDate(leaseStart),
      endDate: formatDate(leaseEnd),
    });
  }
  
  // Summer slip line item
  if (lineItemData.summerAmount && Number(lineItemData.summerAmount) > 0) {
    lineItemsToCreate.push({
      leaseId,
      lineType: "summer_slip",
      amount: String(lineItemData.summerAmount),
      slipAssignment: lineItemData.summerSlip || null,
      startDate: formatDate(leaseStart),
      endDate: formatDate(leaseEnd),
    });
  }
  
  // Seasonal slip line item
  if (lineItemData.seasonalAmount && Number(lineItemData.seasonalAmount) > 0) {
    lineItemsToCreate.push({
      leaseId,
      lineType: "seasonal_slip",
      amount: String(lineItemData.seasonalAmount),
      slipAssignment: lineItemData.summerSlip || lineItemData.winterSlip || null,
      startDate: formatDate(leaseStart),
      endDate: formatDate(leaseEnd),
    });
  }
  
  // Liveaboard line item
  if (lineItemData.liveaboardAmount && Number(lineItemData.liveaboardAmount) > 0) {
    lineItemsToCreate.push({
      leaseId,
      lineType: "liveaboard",
      amount: String(lineItemData.liveaboardAmount),
      slipAssignment: null,
      startDate: formatDate(leaseStart),
      endDate: formatDate(leaseEnd),
    });
  }
  
  // Electric line item
  if (lineItemData.electricAmount && Number(lineItemData.electricAmount) > 0) {
    lineItemsToCreate.push({
      leaseId,
      lineType: "electric",
      amount: String(lineItemData.electricAmount),
      slipAssignment: null,
      startDate: formatDate(leaseStart),
      endDate: formatDate(leaseEnd),
    });
  }
  
  // Bulk insert all line items
  if (lineItemsToCreate.length > 0) {
    await db.insert(leaseLineItems).values(lineItemsToCreate);
  }
}

/**
 * Creates a fallback seasonal line item when:
 * - No explicit line items were created via rate config or traditional mapping
 * - The lease has a seasonal contract term (summer, winter, seasonal)
 * - The lease has a leaseAmount
 * This ensures occupancy metrics are accurate for seasonal leases
 */
async function createFallbackSeasonalLineItem(
  leaseId: string,
  leaseAmount: string | number,
  contractTerm: string | null | undefined,
  unitLocation: string | null | undefined,
  leaseStart: Date | null,
  leaseEnd: Date | null
): Promise<boolean> {
  if (!contractTerm || !leaseAmount) return false;
  
  const normalizedTerm = contractTerm.toLowerCase().trim();
  
  // Determine line item type based on contract term
  // For ambiguous terms (containing both summer and winter), default to seasonal_slip
  let lineType: "winter_slip" | "summer_slip" | "seasonal_slip" | "annual_slip" | null = null;
  
  const hasSummer = normalizedTerm === 'summer' || normalizedTerm.includes('summer');
  const hasWinter = normalizedTerm === 'winter' || normalizedTerm.includes('winter');
  const hasSeasonal = normalizedTerm === 'seasonal' || normalizedTerm.includes('season');
  
  if (hasSummer && hasWinter) {
    // Ambiguous - contains both, default to seasonal
    lineType = 'seasonal_slip';
  } else if (hasSeasonal) {
    lineType = 'seasonal_slip';
  } else if (hasSummer) {
    lineType = 'summer_slip';
  } else if (hasWinter) {
    lineType = 'winter_slip';
  }
  
  if (!lineType) return false;
  
  const formatDate = (d: Date | null): string | null => {
    if (!d) return null;
    return d.toISOString().split('T')[0];
  };
  
  await db.insert(leaseLineItems).values({
    leaseId,
    lineType,
    amount: String(leaseAmount),
    slipAssignment: unitLocation || null,
    startDate: formatDate(leaseStart),
    endDate: formatDate(leaseEnd),
  });
  
  return true;
}

/**
 * Creates line items from rate configuration (dynamic rate mapping)
 * Maps user-specified rate columns to appropriate seasonal line items
 * Uses project season dates to set proper date ranges
 */
async function createLineItemsFromRateConfig(
  leaseId: string,
  row: ParsedImportRow,
  rateConfigs: RateConfig[],
  projectDates: {
    seasonStart: string | null;
    seasonEnd: string | null;
    winterStart: string | null;
    winterEnd: string | null;
  },
  leaseStart: Date | null,
  leaseEnd: Date | null
): Promise<boolean> {
  const lineItemsToCreate: InsertLeaseLineItem[] = [];
  const currentYear = leaseStart ? leaseStart.getFullYear() : new Date().getFullYear();
  
  // Helper to format dates for line items
  const formatDate = (d: Date | null): string | null => {
    if (!d) return null;
    return d.toISOString().split('T')[0];
  };
  
  // Helper to convert MM/DD format to full date string
  const convertToFullDate = (mmdd: string | null, year: number): Date | null => {
    if (!mmdd) return null;
    const [month, day] = mmdd.split('/');
    if (!month || !day) return null;
    return new Date(year, parseInt(month) - 1, parseInt(day));
  };
  
  // Helper to calculate months between two dates
  const getMonthsBetween = (start: Date, end: Date): number => {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    return Math.max(1, months);
  };
  
  // Get boat length from tenant data for per-foot calculations
  const boatLength = row.tenantData.boatLength ? Number(row.tenantData.boatLength) : 
                     row.tenantData.boatSize ? Number(row.tenantData.boatSize) : null;
  
  for (const config of rateConfigs) {
    // Get the amount from row data based on season type
    // The frontend maps rate columns to leaseAmount (annual), summerAmount (summer), winterAmount (winter)
    // These get parsed and placed in lineItemData for summer/winter, leaseData for annual
    let rawAmount: number | null = null;
    
    if (config.seasonType === 'annual') {
      // Annual rates use leaseAmount from leaseData
      const val = row.leaseData.leaseAmount;
      if (val && !isNaN(Number(val))) {
        rawAmount = Number(val);
      }
    } else if (config.seasonType === 'summer') {
      // Summer rates - check lineItemData.summerAmount first (from frontend mapping)
      // Frontend maps summer column to 'summerAmount' which becomes lineItemData.summerAmount
      const val = row.lineItemData?.summerAmount;
      if (val && !isNaN(Number(val))) {
        rawAmount = Number(val);
      }
    } else if (config.seasonType === 'winter') {
      // Winter rates - check lineItemData.winterAmount first (from frontend mapping)
      // Frontend maps winter column to 'winterAmount' which becomes lineItemData.winterAmount
      const val = row.lineItemData?.winterAmount;
      if (val && !isNaN(Number(val))) {
        rawAmount = Number(val);
      }
    }
    
    // Skip if no valid amount found
    if (!rawAmount || rawAmount <= 0) continue;
    
    // Get rate basis for conversion (default to per_month if not specified)
    const rateBasis = config.rateBasis || 'per_month';
    
    // Calculate period months for conversion
    let periodMonths = 12; // Default for annual
    if (config.seasonType === 'summer') {
      // Calculate summer season months from project dates or default (May-Oct = 6 months)
      if (projectDates.seasonStart && projectDates.seasonEnd) {
        const summerStart = convertToFullDate(projectDates.seasonStart, currentYear);
        const summerEnd = convertToFullDate(projectDates.seasonEnd, currentYear);
        if (summerStart && summerEnd) {
          periodMonths = getMonthsBetween(summerStart, summerEnd);
        }
      } else {
        periodMonths = 6; // Default summer season
      }
    } else if (config.seasonType === 'winter') {
      // Calculate winter season months from project dates or default (Nov-Apr = 6 months)
      if (projectDates.winterStart && projectDates.winterEnd) {
        const winterStart = convertToFullDate(projectDates.winterStart, currentYear);
        let winterEnd = convertToFullDate(projectDates.winterEnd, currentYear);
        // Handle year boundary crossing
        if (winterStart && winterEnd && winterEnd < winterStart) {
          winterEnd = new Date(currentYear + 1, winterEnd.getMonth(), winterEnd.getDate());
        }
        if (winterStart && winterEnd) {
          periodMonths = getMonthsBetween(winterStart, winterEnd);
        }
      } else {
        periodMonths = 6; // Default winter season
      }
    }
    
    // Convert raw amount based on rate basis
    let amount: number = rawAmount;
    
    switch (rateBasis) {
      case 'per_month':
        // Amount is already monthly - multiply by period to get period total
        amount = rawAmount * periodMonths;
        break;
        
      case 'per_season':
      case 'per_contract':
        // Amount is total for the season/contract - use as-is for line item
        amount = rawAmount;
        break;
        
      case 'per_year':
        // Amount is annual total - prorate to period
        amount = rawAmount * (periodMonths / 12);
        break;
        
      case 'per_ft_month':
        // Rate per foot per month - multiply by boat length and period
        if (boatLength && boatLength > 0) {
          amount = rawAmount * boatLength * periodMonths;
        } else {
          // Can't calculate without boat length - skip or use raw amount
          amount = rawAmount * periodMonths;
        }
        break;
        
      case 'per_ft_season':
        // Rate per foot for the season - multiply by boat length
        if (boatLength && boatLength > 0) {
          amount = rawAmount * boatLength;
        } else {
          amount = rawAmount;
        }
        break;
        
      case 'per_ft_year':
        // Rate per foot per year - multiply by boat length and prorate
        if (boatLength && boatLength > 0) {
          amount = rawAmount * boatLength * (periodMonths / 12);
        } else {
          amount = rawAmount * (periodMonths / 12);
        }
        break;
    }
    
    // Determine dates based on season type
    let itemStartDate: Date | null = null;
    let itemEndDate: Date | null = null;
    let lineType: InsertLeaseLineItem['lineType'];
    
    switch (config.seasonType) {
      case 'annual':
        // Annual uses lease dates or full year
        itemStartDate = leaseStart || new Date(currentYear, 0, 1);
        itemEndDate = leaseEnd || new Date(currentYear, 11, 31);
        lineType = 'annual_slip';
        break;
        
      case 'summer':
        // Summer uses project's season dates
        if (projectDates.seasonStart && projectDates.seasonEnd) {
          itemStartDate = convertToFullDate(projectDates.seasonStart, currentYear);
          itemEndDate = convertToFullDate(projectDates.seasonEnd, currentYear);
        } else {
          // Default: May 1 - Oct 31
          itemStartDate = new Date(currentYear, 4, 1);
          itemEndDate = new Date(currentYear, 9, 31);
        }
        lineType = 'summer_slip';
        break;
        
      case 'winter':
        // Winter uses project's winter dates
        if (projectDates.winterStart && projectDates.winterEnd) {
          const winterStart = convertToFullDate(projectDates.winterStart, currentYear);
          const winterEnd = convertToFullDate(projectDates.winterEnd, currentYear);
          
          // Handle winter crossing year boundary (Nov-Apr)
          if (winterStart && winterEnd) {
            if (winterEnd < winterStart) {
              // Winter ends next year (e.g., Nov 1 - Apr 30)
              itemStartDate = winterStart;
              itemEndDate = new Date(currentYear + 1, winterEnd.getMonth(), winterEnd.getDate());
            } else {
              itemStartDate = winterStart;
              itemEndDate = winterEnd;
            }
          }
        } else {
          // Default: Nov 1 - Apr 30 (crosses year)
          itemStartDate = new Date(currentYear, 10, 1);
          itemEndDate = new Date(currentYear + 1, 3, 30);
        }
        lineType = 'winter_slip';
        break;
    }
    
    if (itemStartDate && itemEndDate) {
      // Determine slip assignment based on season type
      // Winter uses winterSlip, Summer uses summerSlip, Annual uses unitLocation
      let slipAssignment: string | null = null;
      if (config.seasonType === 'winter') {
        slipAssignment = row.lineItemData?.winterSlip || row.leaseData.unitLocation || null;
      } else if (config.seasonType === 'summer') {
        slipAssignment = row.lineItemData?.summerSlip || row.leaseData.unitLocation || null;
      } else {
        // Annual - use unitLocation
        slipAssignment = row.leaseData.unitLocation || null;
      }
      
      lineItemsToCreate.push({
        leaseId,
        lineType,
        amount: String(amount),
        slipAssignment,
        startDate: formatDate(itemStartDate),
        endDate: formatDate(itemEndDate),
      });
    }
  }
  
  // Bulk insert all line items
  if (lineItemsToCreate.length > 0) {
    await db.insert(leaseLineItems).values(lineItemsToCreate);
    return true;
  }
  return false;
}

/**
 * Merges new tenant data with existing tenant, filling only empty fields
 */
function mergeTenantData(
  existing: typeof tenants.$inferSelect,
  newData: Partial<InsertTenant>
): Partial<InsertTenant> {
  const merged: Partial<InsertTenant> = {};
  
  // String fields that can be merged
  const stringFields: (keyof InsertTenant)[] = [
    'name', 'boatMake',
    'address1', 'address2', 'city', 'state', 'zip'
  ];
  
  for (const field of stringFields) {
    const existingValue = existing[field as keyof typeof existing] as string | null | undefined;
    const newValue = newData[field] as string | null | undefined;
    
    // Use new value only if existing is null/empty AND new value has content
    if ((!existingValue || String(existingValue).trim() === '') && newValue && String(newValue).trim() !== '') {
      (merged as any)[field] = newValue;
    }
  }
  
  // Handle numeric fields separately (boatYear, boatSize, boatLength, boatWidth)
  // These are stored as numeric in the database and need proper type handling
  const numericFields: (keyof InsertTenant)[] = ['boatYear', 'boatSize', 'boatLength', 'boatWidth'];
  
  for (const field of numericFields) {
    const newValue = newData[field];
    if (newValue !== undefined && newValue !== null) {
      const existingValue = existing[field as keyof typeof existing];
      // Use new value only if existing is null/undefined/empty string
      // Note: For boat dimensions, 0 is not a valid value, but we preserve explicit 0 values
      // Safely check for empty - numbers won't have .trim() so check type first
      const existingIsEmpty = existingValue === null || 
                              existingValue === undefined ||
                              (typeof existingValue === 'string' && existingValue.trim() === '');
      
      if (existingIsEmpty) {
        // Coerce new value to number explicitly for type safety
        const numericValue = typeof newValue === 'number' 
          ? newValue 
          : parseFloat(String(newValue));
        
        // Only assign if it's a valid finite number (reject NaN and Infinity)
        if (Number.isFinite(numericValue)) {
          (merged as any)[field] = numericValue;
        }
      }
    }
  }
  
  return merged;
}

// Rate basis types - how the rate amount is expressed in the file
export type RateBasisType = 'per_month' | 'per_season' | 'per_year' | 'per_contract' | 'per_ft_month' | 'per_ft_season' | 'per_ft_year';

// Rate configuration type for dynamic rate mapping
export interface RateConfig {
  seasonType: 'annual' | 'summer' | 'winter';
  columnKey: string;
  slipColumnKey?: string;
  rateBasis?: RateBasisType;
}

// Import options for enhanced import behavior
export interface ImportOptions {
  defaultStorageType?: string;
  autoApplyContractTermDates?: boolean;
  projectSeasonDates?: {
    seasonStart: string | null;
    seasonEnd: string | null;
    winterStart: string | null;
    winterEnd: string | null;
  };
}

/**
 * Imports validated lease rows in a transaction
 */
export async function importLeases(
  validRows: ParsedImportRow[],
  skipDuplicates: boolean = false,
  locationId?: string,
  importMode: ImportMode = 'create',
  rateConfiguration?: RateConfig[],
  importOptions?: ImportOptions
): Promise<BulkLeaseImportResponse> {
  const response: BulkLeaseImportResponse = {
    imported: 0,
    skipped: 0,
    errors: 0,
    updated: 0, // New field to track updates
    details: {
      created: [],
      duplicates: [],
      failed: [],
      updated: [], // New array to track updated records
    },
  };

  // Fetch project season dates for auto-applying to leases without dates
  let projectDates: {
    seasonStart: string | null;
    seasonEnd: string | null;
    winterStart: string | null;
    winterEnd: string | null;
  } | null = null;
  
  if (locationId) {
    projectDates = await getProjectSeasonDates(locationId);
  }

  // Process each row
  for (const row of validRows) {
    try {
      // Handle duplicates based on import mode
      if (row.isDuplicate) {
        if (importMode === 'create' && skipDuplicates) {
          // Create mode: skip duplicates entirely
          response.skipped++;
          response.details.duplicates.push({
            tenantName: row.tenantData.name || "Unknown",
            reason: row.duplicateMatchReason || "Duplicate tenant",
          });
          continue;
        }
      }

      // Check if tenant exists or create new
      let tenantId: string;
      let wasUpdated = false;

      if (row.isDuplicate && (importMode === 'append' || importMode === 'replace')) {
        // Find existing tenant to update
        const existingTenants = await db
          .select()
          .from(tenants)
          .where(sql`LOWER(${tenants.name}) = LOWER(${row.tenantData.name})`);
        
        if (existingTenants.length > 0) {
          const existingTenant = existingTenants[0];
          tenantId = existingTenant.id;
          
          if (importMode === 'append') {
            // Append mode: only fill empty fields
            const mergedData = mergeTenantData(existingTenant, row.tenantData);
            if (Object.keys(mergedData).length > 0) {
              await db.update(tenants)
                .set(mergedData)
                .where(eq(tenants.id, tenantId));
              wasUpdated = true;
            }
          } else if (importMode === 'replace') {
            // Replace mode: overwrite all provided fields
            const updateData: Partial<InsertTenant> = {};
            for (const [key, value] of Object.entries(row.tenantData)) {
              if (value && String(value).trim() !== '' && key !== 'id') {
                (updateData as any)[key] = value;
              }
            }
            if (Object.keys(updateData).length > 0) {
              await db.update(tenants)
                .set(updateData)
                .where(eq(tenants.id, tenantId));
              wasUpdated = true;
            }
          }
        } else {
          // Shouldn't happen, but create if needed
          const [newTenant] = await db.insert(tenants).values(row.tenantData as InsertTenant).returning();
          tenantId = newTenant.id;
        }
      } else if (row.isDuplicate) {
        // Create mode with duplicate - find existing tenant
        const existingTenants = await db
          .select()
          .from(tenants)
          .where(sql`LOWER(${tenants.name}) = LOWER(${row.tenantData.name})`);
        
        if (existingTenants.length > 0) {
          tenantId = existingTenants[0].id;
        } else {
          const [newTenant] = await db.insert(tenants).values(row.tenantData as InsertTenant).returning();
          tenantId = newTenant.id;
        }
      } else {
        // Create new tenant
        const [newTenant] = await db.insert(tenants).values(row.tenantData as InsertTenant).returning();
        tenantId = newTenant.id;
      }

      // Apply default storage type if provided and no storage type in row data
      const effectiveStorageType = row.leaseData.storageType 
        || importOptions?.defaultStorageType 
        || "Wet Slip";
      
      // Determine if lease data is complete or incomplete
      let hasLeaseCommencement = !!row.leaseData.leaseCommencement;
      const hasLeaseAmount = !!row.leaseData.leaseAmount;
      
      // Auto-apply project dates if dates are missing but project has season dates configured
      let leaseCommencement = row.leaseData.leaseCommencement || null;
      let leaseExpiration = row.leaseData.leaseExpiration || null;
      let usesDefaultDates = false;
      
      // Use provided season dates or fall back to fetched project dates
      const seasonDates = importOptions?.projectSeasonDates || projectDates;
      
      // NEW: Auto-apply dates from contract term if enabled
      if (!hasLeaseCommencement && importOptions?.autoApplyContractTermDates && row.leaseData.contractTerm && seasonDates) {
        const currentYear = new Date().getFullYear();
        const contractTerm = String(row.leaseData.contractTerm).toLowerCase();
        
        if (contractTerm.includes('summer') || contractTerm === 'seasonal') {
          // Summer/Seasonal: use season start to season end
          if (seasonDates.seasonStart && seasonDates.seasonEnd) {
            leaseCommencement = convertSeasonDateToFullDate(seasonDates.seasonStart, currentYear);
            leaseExpiration = convertSeasonDateToFullDate(seasonDates.seasonEnd, currentYear);
            hasLeaseCommencement = !!leaseCommencement;
            usesDefaultDates = true;
          }
        } else if (contractTerm.includes('winter')) {
          // Winter: use winter start to winter end (spans years)
          if (seasonDates.winterStart && seasonDates.winterEnd) {
            leaseCommencement = convertSeasonDateToFullDate(seasonDates.winterStart, currentYear);
            leaseExpiration = convertSeasonDateToFullDate(seasonDates.winterEnd, currentYear + 1);
            hasLeaseCommencement = !!leaseCommencement;
            usesDefaultDates = true;
          }
        } else if (contractTerm.includes('annual') || contractTerm.includes('year')) {
          // Annual: 1/1 to 12/31 of the selected year
          const annualStart = new Date(currentYear, 0, 1); // January 1st
          const annualEnd = new Date(currentYear, 11, 31); // December 31st
          leaseCommencement = annualStart.toISOString().split('T')[0];
          leaseExpiration = annualEnd.toISOString().split('T')[0];
          hasLeaseCommencement = true;
          usesDefaultDates = true;
        }
      }
      
      // Fallback: original date inference logic
      if (!hasLeaseCommencement && locationId && seasonDates) {
        const currentYear = new Date().getFullYear();
        // Use season dates if available, otherwise use Jan 1 - Dec 31
        if (seasonDates.seasonStart && seasonDates.seasonEnd) {
          leaseCommencement = convertSeasonDateToFullDate(seasonDates.seasonStart, currentYear);
          leaseExpiration = convertSeasonDateToFullDate(seasonDates.seasonEnd, currentYear);
          hasLeaseCommencement = !!leaseCommencement;
          usesDefaultDates = true;
        } else if (hasLeaseAmount) {
          // Fallback: use Jan 1 - Dec 31 of current year if we have an amount
          // Append T12:00:00 to prevent timezone shifts
          leaseCommencement = `${currentYear}-01-01T12:00:00`;
          leaseExpiration = `${currentYear}-12-31T12:00:00`;
          hasLeaseCommencement = true;
          usesDefaultDates = true;
        }
      }
      
      const isIncompleteLease = !hasLeaseCommencement || !hasLeaseAmount;
      let leaseAmount = row.leaseData.leaseAmount || null;
      let determinedRateType: string | null = null; // Track the rate type to set on the lease
      
      // Convert leaseAmount based on rate basis if rate configuration is provided
      // For seasonal rate types ($/season, $/yr), store the PERIOD TOTAL as leaseAmount
      // For monthly rate types ($/mo), store the monthly rate as leaseAmount
      // The rateType field tells the display layer how to calculate Monthly Rent
      //
      // IMPORTANT: parseImportRow aggregates seasonal amounts into leaseData.leaseAmount before this code runs.
      // We must NOT use the aggregated value. Instead, recalculate from individual rate configs.
      if (rateConfiguration && rateConfiguration.length > 0) {
        const boatLength = row.tenantData.boatLength ? Number(row.tenantData.boatLength) : 
                           row.tenantData.boatSize ? Number(row.tenantData.boatSize) : null;
        const currentYear = new Date().getFullYear();
        
        // Helper to get season months for a config (defaults per season type)
        const getSeasonMonths = (seasonType: string): number => {
          if (seasonType === 'summer') {
            if (seasonDates?.seasonStart && seasonDates?.seasonEnd) {
              const summerStart = convertSeasonDateToFullDate(seasonDates.seasonStart, currentYear);
              const summerEnd = convertSeasonDateToFullDate(seasonDates.seasonEnd, currentYear);
              if (summerStart && summerEnd) {
                return Math.max(1, diffInMonthsInclusive(new Date(summerStart), new Date(summerEnd)));
              }
            }
            return 6; // Default summer = 6 months
          } else if (seasonType === 'winter') {
            if (seasonDates?.winterStart && seasonDates?.winterEnd) {
              const winterStart = convertSeasonDateToFullDate(seasonDates.winterStart, currentYear);
              let winterEnd = convertSeasonDateToFullDate(seasonDates.winterEnd, currentYear);
              if (winterStart && winterEnd) {
                const start = new Date(winterStart);
                let end = new Date(winterEnd);
                if (end < start) {
                  end = new Date(currentYear + 1, end.getMonth(), end.getDate());
                }
                return Math.max(1, diffInMonthsInclusive(start, end));
              }
            }
            return 6; // Default winter = 6 months
          }
          return 12; // Default annual = 12 months
        };
        
        // Helper to convert a raw amount to MONTHLY based on rate basis
        const convertToMonthly = (rawAmount: number, rateBasis: string, seasonMonths: number): number => {
          switch (rateBasis) {
            case 'per_month':
              return rawAmount; // Already monthly
            case 'per_season':
            case 'per_contract':
              return rawAmount / seasonMonths; // Divide by season months
            case 'per_year':
              return rawAmount / 12; // Divide by 12 regardless of season
            case 'per_ft_month':
              return boatLength && boatLength > 0 ? rawAmount * boatLength : rawAmount;
            case 'per_ft_season':
              return boatLength && boatLength > 0 ? (rawAmount * boatLength) / seasonMonths : rawAmount / seasonMonths;
            case 'per_ft_year':
              return boatLength && boatLength > 0 ? (rawAmount * boatLength) / 12 : rawAmount / 12;
            default:
              return rawAmount; // Treat as monthly
          }
        };
        
        // Check if any config has a non-monthly rate basis
        const hasNonMonthlyBasis = rateConfiguration.some(c => c.rateBasis && c.rateBasis !== 'per_month');
        
        if (hasNonMonthlyBasis) {
          // Helper to convert a raw amount to PERIOD TOTAL based on rate basis
          const convertToPeriodTotal = (rawAmount: number, rateBasis: string, seasonMonths: number): number => {
            switch (rateBasis) {
              case 'per_month':
                return rawAmount * seasonMonths; // Monthly rate * months = period total
              case 'per_season':
              case 'per_contract':
                return rawAmount; // Already a period total
              case 'per_year':
                return rawAmount * (seasonMonths / 12); // Annual rate prorated to season
              case 'per_ft_month':
                return boatLength && boatLength > 0 ? rawAmount * boatLength * seasonMonths : rawAmount * seasonMonths;
              case 'per_ft_season':
                return boatLength && boatLength > 0 ? rawAmount * boatLength : rawAmount;
              case 'per_ft_year':
                return boatLength && boatLength > 0 ? rawAmount * boatLength * (seasonMonths / 12) : rawAmount * (seasonMonths / 12);
              default:
                return rawAmount * seasonMonths; // Treat as monthly
            }
          };
          
          let totalAnnualValue = 0;
          let hasValidContributions = false;
          
          for (const config of rateConfiguration) {
            // Get the raw amount DIRECTLY from the config's source field (not the aggregated leaseAmount)
            let rawAmount: number | null = null;
            
            // For annual configs, check if leaseData.leaseAmount is actually from annual mapping
            // or if it was aggregated from seasonal columns
            if (config.seasonType === 'annual') {
              const summerAmt = Number(row.lineItemData?.summerAmount) || 0;
              const winterAmt = Number(row.lineItemData?.winterAmount) || 0;
              const lineItemSum = summerAmt + winterAmt;
              const leaseAmt = Number(row.leaseData.leaseAmount) || 0;
              
              // If leaseAmount equals the sum of seasonal amounts, it was aggregated - skip
              if (lineItemSum > 0 && Math.abs(leaseAmt - lineItemSum) < 0.01) {
                continue; // Skip this config, amounts are from seasonal columns
              }
              
              if (leaseAmt > 0) {
                rawAmount = leaseAmt;
              }
            } else if (config.seasonType === 'summer') {
              rawAmount = Number(row.lineItemData?.summerAmount) || null;
            } else if (config.seasonType === 'winter') {
              rawAmount = Number(row.lineItemData?.winterAmount) || null;
            }
            
            if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) continue;
            
            const seasonMonths = getSeasonMonths(config.seasonType);
            const rateBasis = config.rateBasis || 'per_month';
            const periodTotal = convertToPeriodTotal(rawAmount, rateBasis, seasonMonths);
            
            totalAnnualValue += periodTotal;
            hasValidContributions = true;
          }
          
          if (hasValidContributions && totalAnnualValue > 0) {
            // Store the period total as leaseAmount (NOT divided by 12)
            // The rateType field tells the display layer this is a period total
            leaseAmount = totalAnnualValue.toFixed(2);
            
            // Determine the rate type label based on the first non-monthly rate basis
            const firstNonMonthlyConfig = rateConfiguration.find(c => c.rateBasis && c.rateBasis !== 'per_month');
            if (firstNonMonthlyConfig?.rateBasis) {
              // Map internal rate basis to UI rate type label
              const basisToRateType: Record<string, string> = {
                'per_season': '$/season',
                'per_contract': '$/season',
                'per_year': '$/yr.',
                'per_ft_season': '$/ft./season',
                'per_ft_year': '$/ft./yr.',
              };
              determinedRateType = basisToRateType[firstNonMonthlyConfig.rateBasis] || null;
            }
          }
        }
      }

      // Calculate lease metrics only if we have complete data
      let numDays: number | null = null;
      let numMonths: number | null = null;
      let totalContractValue: number | null = null;
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (hasLeaseCommencement) {
        startDate = new Date(leaseCommencement!);
        endDate = leaseExpiration ? new Date(leaseExpiration) : new Date("2099-12-31");
        numDays = diffInDays(startDate, endDate);
        numMonths = diffInMonthsInclusive(startDate, endDate);
        
        if (hasLeaseAmount && leaseAmount) {
          // For seasonal rate types, leaseAmount IS the total value
          // For monthly rate types, multiply by numMonths
          if (determinedRateType && (determinedRateType.includes('/season') || determinedRateType.includes('/yr'))) {
            totalContractValue = parseFloat(leaseAmount.toString());
          } else {
            totalContractValue = parseFloat(leaseAmount.toString()) * numMonths;
          }
        }
      }

      // Generate lease key - for incomplete leases use tenant name + location + UUID
      const leaseKey = isIncompleteLease
        ? `${row.tenantData.name || 'Unknown'}|${locationId || 'NOLOC'}|${crypto.randomUUID()}`
        : buildLeaseKey(
            row.tenantData.name!,
            startDate!,
            leaseExpiration && leaseExpiration !== "2099-12-31" ? endDate : null
          );

      // Check if lease already exists (only for complete leases)
      if (!isIncompleteLease) {
        const existingLeases = await db
          .select()
          .from(leases)
          .where(eq(leases.leaseKey, leaseKey));

        if (existingLeases.length > 0) {
          // If tenant was updated, count that
          if (wasUpdated) {
            response.updated = (response.updated || 0) + 1;
            response.details.updated = response.details.updated || [];
            response.details.updated.push({
              tenantName: row.tenantData.name || "Unknown",
              tenantId: tenantId,
              reason: "Tenant data updated (lease already exists)",
            });
          } else {
            response.skipped++;
            response.details.duplicates.push({
              tenantName: row.tenantData.name || "Unknown",
              reason: `Lease already exists for this period`,
            });
          }
          continue;
        }
      }

      // Insert lease with optional computed fields
      const leaseInsert = {
        tenantId,
        locationId: locationId || null,
        leaseCommencement,
        leaseExpiration: leaseExpiration === "2099-12-31" ? null : leaseExpiration,
        leaseAmount: leaseAmount ? leaseAmount.toString() : null,
        baseRent2: row.leaseData.baseRent2 ? row.leaseData.baseRent2.toString() : null,
        baseRent3: row.leaseData.baseRent3 ? row.leaseData.baseRent3.toString() : null,
        rateType: determinedRateType, // Set rate type for proper Monthly Rent calculation
        contractTerm: row.leaseData.contractTerm || null,
        storageType: effectiveStorageType,
        unitLocation: row.leaseData.unitLocation || null,
        boatDimensions: row.leaseData.boatDimensions ?? null,
        slipLength: row.leaseData.slipLength ? row.leaseData.slipLength.toString() : null,
        slipWidth: row.leaseData.slipWidth ? row.leaseData.slipWidth.toString() : null,
        additionalCharge1: row.leaseData.additionalCharge1 ? row.leaseData.additionalCharge1.toString() : "0",
        additionalCharge2: row.leaseData.additionalCharge2 ? row.leaseData.additionalCharge2.toString() : "0",
        additionalCharge3: row.leaseData.additionalCharge3 ? row.leaseData.additionalCharge3.toString() : "0",
        leaseOnFile: row.leaseData.leaseOnFile ?? null,
        coiOnFile: row.leaseData.coiOnFile ?? null,
        coiExpiration: row.leaseData.coiExpiration || null,
        leaseKey,
        numDays,
        numMonths,
        totalContractValue: totalContractValue ? totalContractValue.toString() : null,
        isIncomplete: isIncompleteLease,
        usesDefaultDates: usesDefaultDates,
      };

      const [newLease] = await db.insert(leases).values(leaseInsert).returning();

      // Generate cash flows only for complete leases
      if (!isIncompleteLease && startDate && endDate && leaseAmount) {
        // Convert leaseAmount to monthly based on rate type
        // For seasonal/annual rate types, leaseAmount is the TOTAL, so divide by months
        // For monthly rate types, leaseAmount is already monthly
        let monthlyRentForCashFlow = parseFloat(leaseAmount.toString());
        
        if (determinedRateType && numMonths && numMonths > 0) {
          const isSeasonalOrAnnual = determinedRateType.includes('/season') || 
                                      determinedRateType.includes('/yr') ||
                                      determinedRateType.includes('/year');
          if (isSeasonalOrAnnual) {
            monthlyRentForCashFlow = parseFloat(leaseAmount.toString()) / numMonths;
          }
        }
        
        await generateLeaseCashFlows(
          newLease.id,
          startDate,
          endDate,
          monthlyRentForCashFlow
        );
      }

      // Create line items from rate configuration if provided
      // Rate configuration creates line items with proper season dates from project settings
      let rateConfigLineItemsCreated = false;
      if (rateConfiguration && rateConfiguration.length > 0 && projectDates) {
        // Use rate configuration to create line items with proper season dates
        rateConfigLineItemsCreated = await createLineItemsFromRateConfig(
          newLease.id, 
          row, 
          rateConfiguration, 
          projectDates,
          startDate,
          endDate
        );
      }
      
      // Also process traditional line item data if it wasn't covered by rate config
      // Only create traditional line items for fields NOT already covered by rate config
      let anyLineItemsCreated = false;
      if (row.lineItemData && !rateConfigLineItemsCreated) {
        await createLineItemsFromImport(newLease.id, row.lineItemData, startDate, endDate);
        // Check if ANY line items were created (seasonal or ancillary)
        anyLineItemsCreated = Boolean(
          (row.lineItemData.winterAmount && Number(row.lineItemData.winterAmount) > 0) ||
          (row.lineItemData.summerAmount && Number(row.lineItemData.summerAmount) > 0) ||
          (row.lineItemData.seasonalAmount && Number(row.lineItemData.seasonalAmount) > 0) ||
          (row.lineItemData.liveaboardAmount && Number(row.lineItemData.liveaboardAmount) > 0) ||
          (row.lineItemData.electricAmount && Number(row.lineItemData.electricAmount) > 0)
        );
      }
      
      // Fallback: Create seasonal line item based on contract term if NO line items were created at all
      // This is a last-resort for simple imports where only Total and Contract Term are mapped
      // Runs only when:
      // 1. No rate config line items were created
      // 2. No line items of ANY type were created via traditional mapping
      // 3. Lease has a positive leaseAmount
      // 4. Contract term indicates a seasonal type
      // If user maps ancillary fees, they should use Rate Config for proper slip allocation
      if (!rateConfigLineItemsCreated && !anyLineItemsCreated && leaseAmount && Number(leaseAmount) > 0) {
        await createFallbackSeasonalLineItem(
          newLease.id,
          leaseAmount,
          row.leaseData.contractTerm,
          row.leaseData.unitLocation,
          startDate,
          endDate
        );
      }

      // Track as update or create
      if (wasUpdated) {
        response.updated = (response.updated || 0) + 1;
        response.details.updated = response.details.updated || [];
        response.details.updated.push({
          tenantName: row.tenantData.name || "Unknown",
          tenantId: tenantId,
          leaseId: newLease.id,
          reason: "Tenant updated and new lease created",
        });
      }
      response.imported++;
      response.details.created.push({
        tenantName: row.tenantData.name || "Unknown",
        leaseKey: newLease.leaseKey,
        tenantId: tenantId,
        leaseId: newLease.id,
      });
    } catch (error: any) {
      response.errors++;
      response.details.failed.push({
        tenantName: row.tenantData.name || "Unknown",
        error: error.message || "Unknown error",
      });
    }
  }

  return response;
}

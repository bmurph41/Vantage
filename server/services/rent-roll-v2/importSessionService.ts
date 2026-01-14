import { v4 as uuidv4 } from "uuid";
import { db } from "../../db";
import { aiImportMapper } from "./ai-import-mapper";
import { rentRollDocumentParser } from "../rent-roll-document-parser";
import {
  ImportSession,
  ImportSessionStatus,
  ImportMode,
  ColumnMappingSuggestion,
  ValueMappingItem,
  ImportRowValidation,
  ImportResult,
  RENT_ROLL_TARGET_FIELDS,
  CustomFieldDefinition,
  UnrecognizedValues,
  RateConfig,
  RateBasisType,
  ImportOptions,
  ParsedImportRow,
  transformDate,
  transformCurrency,
  transformBoolean,
  validateDate,
  validateNumber,
} from "@shared/rent-roll-import-schema";
import { rraService } from "../../rra-service";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import {
  rraTenants,
  rraLeases,
  rraLeaseLineItems,
  rraMarinaLocations,
  rraStorageLocations,
} from "@shared/schema";

const importSessions = new Map<string, ImportSession & { rawData: Record<string, any>[] }>();

function isSummaryRow(row: Record<string, any>): boolean {
  const summaryPattern = /^(total|totals|grand\s*total|subtotal|sub\s*total|sum|sums|sum\s+of|count|avg|average|=sum|=total)s?:?\s*$/i;
  const lineStartSummaryPattern = /^(total|totals|grand\s*total|subtotal)/i;
  
  const values = Object.values(row);
  if (values.length === 0) return false;
  
  const firstValue = String(values[0] || '').trim();
  if (lineStartSummaryPattern.test(firstValue)) {
    return true;
  }
  
  const nonEmptyValues = values.filter(v => {
    const s = String(v || '').trim();
    return s.length > 0 && !/^[\d,.$%-]+$/.test(s);
  });
  
  if (nonEmptyValues.length === 1) {
    const strValue = String(nonEmptyValues[0] || '').trim().toLowerCase();
    if (strValue.length > 0 && strValue.length < 30 && summaryPattern.test(strValue)) {
      return true;
    }
  }
  
  return false;
}

function convertToMonthly(rawAmount: number, rateBasis: RateBasisType, periodMonths: number, boatLength?: number): number {
  switch (rateBasis) {
    case 'per_month':
      return rawAmount;
    case 'per_season':
    case 'per_contract':
      return periodMonths > 0 ? rawAmount / periodMonths : rawAmount;
    case 'per_year':
      return rawAmount / 12;
    case 'per_ft_month':
      return boatLength && boatLength > 0 ? rawAmount * boatLength : rawAmount;
    case 'per_ft_season':
      return boatLength && boatLength > 0 
        ? (rawAmount * boatLength) / periodMonths 
        : rawAmount / periodMonths;
    case 'per_ft_year':
      return boatLength && boatLength > 0 
        ? (rawAmount * boatLength) / 12 
        : rawAmount / 12;
    default:
      return rawAmount;
  }
}

function parseMonthFromDateString(dateStr: string): number | null {
  if (!dateStr) return null;
  
  // Try MM/DD format first
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 2) {
      const month = parseInt(parts[0], 10);
      if (!isNaN(month) && month >= 1 && month <= 12) {
        return month;
      }
    }
  }
  
  // Try ISO date format (YYYY-MM-DD or Date object string)
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.getMonth() + 1; // getMonth is 0-indexed
  }
  
  return null;
}

function getSeasonMonths(seasonType: string, projectDates?: ImportOptions['projectSeasonDates']): number {
  if (seasonType === 'summer') {
    if (projectDates?.seasonStart && projectDates?.seasonEnd) {
      const startMonth = parseMonthFromDateString(projectDates.seasonStart);
      const endMonth = parseMonthFromDateString(projectDates.seasonEnd);
      if (startMonth && endMonth) {
        return Math.max(1, endMonth - startMonth + 1);
      }
    }
    return 6;
  } else if (seasonType === 'winter') {
    if (projectDates?.winterStart && projectDates?.winterEnd) {
      const startMonth = parseMonthFromDateString(projectDates.winterStart);
      const endMonth = parseMonthFromDateString(projectDates.winterEnd);
      if (startMonth && endMonth) {
        if (endMonth < startMonth) {
          return Math.max(1, (12 - startMonth + 1) + endMonth);
        }
        return Math.max(1, endMonth - startMonth + 1);
      }
    }
    return 6;
  }
  return 12;
}

export class ImportSessionService {
  async createSession(
    orgId: string,
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    options: {
      sheetName?: string;
      importMode?: ImportMode;
      skipDuplicates?: boolean;
    } = {}
  ): Promise<ImportSession & { rawData: Record<string, any>[] }> {
    const ext = fileName.toLowerCase().split(".").pop() || "";
    const fileType = ext === "pdf" ? "pdf" : ext === "csv" ? "csv" : "excel";

    const parseResult = await rentRollDocumentParser.parseDocument(fileBuffer, fileName, {
      sheetName: options.sheetName,
      useAI: true,
      skipAIOnError: true,
    });

    console.log(`[ImportSession] Parse result: ${parseResult.rows.length} rows, method: ${parseResult.extractionMethod}, confidence: ${parseResult.confidence}`);
    if (parseResult.rows.length > 0 && parseResult.rows.length <= 5) {
      console.log('[ImportSession] Parsed rows:', JSON.stringify(parseResult.rows, null, 2));
    } else if (parseResult.rows.length > 5) {
      console.log('[ImportSession] First row:', JSON.stringify(parseResult.rows[0], null, 2));
    }

    const sessionId = uuidv4();
    const filteredRows = parseResult.rows.filter(row => !isSummaryRow(row));
    
    console.log(`[ImportSession] After filtering summary rows: ${filteredRows.length} rows (filtered ${parseResult.rows.length - filteredRows.length})`);
    
    const session: ImportSession & { rawData: Record<string, any>[] } = {
      id: sessionId,
      orgId,
      userId,
      status: parseResult.sheets && parseResult.sheets.length > 1 ? "uploaded" : "uploaded",
      fileName,
      fileType,
      fileSize: fileBuffer.length,
      uploadedAt: new Date(),
      selectedSheet: parseResult.selectedSheet,
      sheets: parseResult.sheets?.map(s => ({
        name: s.name,
        rowCount: s.rowCount,
        headers: [],
        previewData: [],
      })),
      headers: parseResult.headers,
      rawRows: filteredRows,
      totalRows: filteredRows.length,
      columnMappings: [],
      customFields: [],
      valueMappings: [],
      rateConfiguration: [{ seasonType: 'annual', columnKey: '', rateBasis: 'per_month' }],
      defaultStorageType: undefined,
      autoApplyContractTermDates: true,
      importMode: options.importMode || "create",
      skipDuplicates: options.skipDuplicates ?? true,
      parseConfidence: parseResult.confidence,
      extractionMethod: parseResult.extractionMethod,
      parsedRows: undefined,
      warnings: parseResult.warnings,
      errors: parseResult.errors,
      createdAt: new Date(),
      updatedAt: new Date(),
      rawData: filteredRows,
    };

    importSessions.set(sessionId, session);

    return session;
  }

  getSession(sessionId: string): (ImportSession & { rawData: Record<string, any>[] }) | null {
    return importSessions.get(sessionId) || null;
  }

  async selectSheet(
    sessionId: string,
    sheetName: string
  ): Promise<ImportSession & { rawData: Record<string, any>[] }> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    session.selectedSheet = sheetName;
    session.status = "sheet_selected";
    session.updatedAt = new Date();

    return session;
  }

  async suggestColumnMappings(
    sessionId: string
  ): Promise<ColumnMappingSuggestion[]> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const suggestions = await aiImportMapper.suggestColumnMappings(
      session.headers,
      session.rawData.slice(0, 10),
      session.customFields
    );

    session.columnMappings = suggestions;
    session.updatedAt = new Date();

    return suggestions;
  }

  async setColumnMappings(
    sessionId: string,
    mappings: { sourceColumn: string; targetField: string | null; isCustomField?: boolean }[],
    customFields?: CustomFieldDefinition[]
  ): Promise<ImportSession> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    session.columnMappings = mappings.map(m => ({
      sourceColumn: m.sourceColumn,
      targetField: m.targetField,
      confidence: "high" as const,
      reason: "User-defined mapping",
      isCustomField: m.isCustomField,
    }));

    if (customFields) {
      session.customFields = customFields;
    }

    session.status = "columns_mapped";
    session.updatedAt = new Date();

    return session;
  }

  async setRateConfiguration(
    sessionId: string,
    rateConfig: RateConfig[],
    options?: {
      defaultStorageType?: string;
      autoApplyContractTermDates?: boolean;
    }
  ): Promise<ImportSession> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    session.rateConfiguration = rateConfig;
    if (options?.defaultStorageType !== undefined) {
      session.defaultStorageType = options.defaultStorageType;
    }
    if (options?.autoApplyContractTermDates !== undefined) {
      session.autoApplyContractTermDates = options.autoApplyContractTermDates;
    }
    session.updatedAt = new Date();

    return session;
  }

  async detectRateStructure(sessionId: string): Promise<{
    suggestedStructure: "annual" | "seasonal" | "mixed" | null;
    detectedRateColumns: string[];
    contractTermHints: { column: string; detectedTerms: string[] }[];
  }> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const rateColumns: string[] = [];
    const contractTermHints: { column: string; detectedTerms: string[] }[] = [];
    let hasSeasonalTerms = false;
    let hasAnnualTerms = false;

    const winterPattern = /winter|cold|off-?season/i;
    const summerPattern = /summer|season|warm/i;
    const annualPattern = /annual|yearly|year|12\s*month/i;

    for (const header of session.headers) {
      const normalized = header.toLowerCase();
      if (winterPattern.test(normalized) || summerPattern.test(normalized)) {
        rateColumns.push(header);
        hasSeasonalTerms = true;
      }
      if (/rate|rent|amount|fee|charge|price/i.test(normalized)) {
        if (!rateColumns.includes(header)) rateColumns.push(header);
      }
    }

    const contractTermMapping = session.columnMappings.find(m => m.targetField === 'contractTerm');
    if (contractTermMapping) {
      const detectedTerms = new Set<string>();
      for (const row of session.rawData.slice(0, 50)) {
        const value = row[contractTermMapping.sourceColumn]?.toString().toLowerCase().trim();
        if (value) {
          detectedTerms.add(value);
          if (winterPattern.test(value) || summerPattern.test(value)) {
            hasSeasonalTerms = true;
          }
          if (annualPattern.test(value)) {
            hasAnnualTerms = true;
          }
        }
      }
      if (detectedTerms.size > 0) {
        contractTermHints.push({
          column: contractTermMapping.sourceColumn,
          detectedTerms: Array.from(detectedTerms),
        });
      }
    }

    let suggestedStructure: "annual" | "seasonal" | "mixed" | null = null;
    if (hasSeasonalTerms && hasAnnualTerms) {
      suggestedStructure = "mixed";
    } else if (hasSeasonalTerms) {
      suggestedStructure = "seasonal";
    } else if (hasAnnualTerms || rateColumns.length === 1) {
      suggestedStructure = "annual";
    }

    return {
      suggestedStructure,
      detectedRateColumns: rateColumns,
      contractTermHints,
    };
  }

  async detectUnrecognizedValues(sessionId: string): Promise<UnrecognizedValues> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const fieldsWithValidValues = RENT_ROLL_TARGET_FIELDS.filter(f => f.validValues && f.validValues.length > 0);
    const unrecognized: UnrecognizedValues = {};

    for (const field of fieldsWithValidValues) {
      const mapping = session.columnMappings.find(m => m.targetField === field.id);
      if (!mapping) continue;

      const sourceColumn = mapping.sourceColumn;
      const occurrences: Record<string, number> = {};

      for (const row of session.rawData) {
        const value = row[sourceColumn]?.toString().trim();
        if (!value) continue;

        const isValid = field.validValues!.some(
          v => v.toLowerCase() === value.toLowerCase()
        );

        if (!isValid) {
          occurrences[value] = (occurrences[value] || 0) + 1;
        }
      }

      if (Object.keys(occurrences).length > 0) {
        unrecognized[field.id] = {
          fieldLabel: field.label,
          values: Object.keys(occurrences),
          validOptions: field.validValues!,
          occurrences,
        };
      }
    }

    return unrecognized;
  }

  async suggestValueMappings(sessionId: string): Promise<ValueMappingItem[]> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const unrecognized = await this.detectUnrecognizedValues(sessionId);
    const allMappings: ValueMappingItem[] = [];

    for (const [fieldId, data] of Object.entries(unrecognized)) {
      const suggestions = await aiImportMapper.suggestValueMappings(
        fieldId,
        data.fieldLabel,
        data.values,
        data.validOptions
      );

      for (const suggestion of suggestions) {
        suggestion.occurrences = data.occurrences[suggestion.originalValue] || 1;
      }

      allMappings.push(...suggestions);
    }

    session.valueMappings = allMappings;
    session.status = "values_mapped";
    session.updatedAt = new Date();

    return allMappings;
  }

  async setValueMappings(
    sessionId: string,
    mappings: { fieldId: string; originalValue: string; mappedValue: string | null }[]
  ): Promise<ImportSession> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    for (const mapping of mappings) {
      const existing = session.valueMappings.find(
        v => v.fieldId === mapping.fieldId && v.originalValue === mapping.originalValue
      );
      if (existing) {
        existing.userSelectedValue = mapping.mappedValue;
        existing.isResolved = true;
      } else {
        session.valueMappings.push({
          fieldId: mapping.fieldId,
          fieldLabel: RENT_ROLL_TARGET_FIELDS.find(f => f.id === mapping.fieldId)?.label || mapping.fieldId,
          originalValue: mapping.originalValue,
          occurrences: 1,
          suggestedValue: mapping.mappedValue,
          confidence: "high",
          isResolved: true,
          userSelectedValue: mapping.mappedValue,
        });
      }
    }

    session.updatedAt = new Date();
    return session;
  }

  async previewImport(sessionId: string, targetLocationId?: string): Promise<{
    rows: Array<{
      rowIndex: number;
      data: Record<string, any>;
      validation: ImportRowValidation;
    }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      duplicates: number;
    };
  }> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const existingTenants: Map<string, string> = new Map();
    const existingLeases: Map<string, string> = new Map();

    if (targetLocationId) {
      const tenants = await db.select({ id: rraTenants.id, name: rraTenants.name, email: rraTenants.email })
        .from(rraTenants)
        .where(eq(rraTenants.marinaLocationId, targetLocationId));
      
      for (const t of tenants) {
        if (t.name) existingTenants.set(t.name.toLowerCase().trim(), t.id);
        if (t.email) existingTenants.set(t.email.toLowerCase().trim(), t.id);
      }

      const leases = await db.select({ id: rraLeases.id, unitLocation: rraLeases.unitLocation, tenantId: rraLeases.tenantId })
        .from(rraLeases)
        .where(eq(rraLeases.marinaLocationId, targetLocationId));
      
      for (const l of leases) {
        if (l.unitLocation && l.tenantId) {
          existingLeases.set(`${l.tenantId}:${l.unitLocation.toLowerCase().trim()}`, l.id);
        }
      }
    }

    const results: Array<{
      rowIndex: number;
      data: Record<string, any>;
      validation: ImportRowValidation;
    }> = [];

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < session.rawData.length; i++) {
      const row = session.rawData[i];
      const transformedData: Record<string, any> = {};
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const mapping of session.columnMappings) {
        if (!mapping.targetField) continue;

        const rawValue = row[mapping.sourceColumn];
        const field = RENT_ROLL_TARGET_FIELDS.find(f => f.id === mapping.targetField);

        if (!field) {
          transformedData[mapping.targetField] = rawValue;
          continue;
        }

        if (field.required && (!rawValue || String(rawValue).trim() === "")) {
          errors.push(`${field.label} is required`);
          continue;
        }

        let value = rawValue;

        const valueMapping = session.valueMappings.find(
          vm => vm.fieldId === mapping.targetField && vm.originalValue === String(rawValue).trim()
        );
        if (valueMapping && (valueMapping.userSelectedValue || valueMapping.suggestedValue)) {
          value = valueMapping.userSelectedValue || valueMapping.suggestedValue;
        }

        if (field.type === "date") {
          const validation = validateDate(value);
          if (!validation.valid) {
            errors.push(validation.error!);
          } else {
            value = transformDate(value);
          }
        } else if (field.type === "number" || field.type === "currency") {
          const validation = validateNumber(value);
          if (!validation.valid) {
            errors.push(validation.error!);
          } else if (field.type === "currency") {
            value = transformCurrency(value);
          }
        } else if (field.type === "boolean") {
          value = transformBoolean(value);
        }

        transformedData[mapping.targetField] = value;
      }

      let isDuplicate = false;
      let duplicateReason: string | undefined;
      let existingRecordId: string | undefined;

      if (targetLocationId && transformedData.tenantName) {
        const tenantKey = transformedData.tenantName.toLowerCase().trim();
        const emailKey = transformedData.tenantEmail?.toLowerCase().trim();
        const unitKey = transformedData.unitLocation?.toLowerCase().trim();

        const existingTenantId = existingTenants.get(tenantKey) || (emailKey ? existingTenants.get(emailKey) : undefined);

        if (existingTenantId && unitKey) {
          const leaseKey = `${existingTenantId}:${unitKey}`;
          if (existingLeases.has(leaseKey)) {
            isDuplicate = true;
            existingRecordId = existingLeases.get(leaseKey);
            duplicateReason = `Lease for "${transformedData.tenantName}" at unit "${transformedData.unitLocation}" already exists`;
          }
        } else if (existingTenantId) {
          isDuplicate = true;
          existingRecordId = existingTenantId;
          duplicateReason = `Tenant "${transformedData.tenantName}" already exists`;
        }
      }

      const validation: ImportRowValidation = {
        rowIndex: i,
        isValid: errors.length === 0,
        errors,
        warnings,
        isDuplicate,
        duplicateReason,
        existingRecordId,
      };

      if (errors.length > 0) invalidCount++;
      else if (isDuplicate) duplicateCount++;
      else validCount++;

      results.push({ rowIndex: i, data: transformedData, validation });
    }

    session.status = "previewed";
    session.updatedAt = new Date();

    return {
      rows: results,
      summary: {
        total: session.rawData.length,
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount,
      },
    };
  }

  async executeImport(
    sessionId: string,
    targetLocationId: string,
    options: {
      importMode: ImportMode;
      skipDuplicates: boolean;
      skipInvalidRows: boolean;
    }
  ): Promise<ImportResult> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const preview = await this.previewImport(sessionId, targetLocationId);
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: 0,
      duplicates: 0,
      details: {
        created: [],
        updated: [],
        duplicates: [],
        failed: [],
      },
    };

    for (const row of preview.rows) {
      try {
        if (!row.validation.isValid) {
          if (options.skipInvalidRows) {
            result.skipped++;
            result.details.failed.push({
              tenantName: row.data.tenantName || `Row ${row.rowIndex + 1}`,
              error: row.validation.errors.join(", "),
              rowIndex: row.rowIndex,
            });
            continue;
          }
          result.errors++;
          result.details.failed.push({
            tenantName: row.data.tenantName || `Row ${row.rowIndex + 1}`,
            error: row.validation.errors.join(", "),
            rowIndex: row.rowIndex,
          });
          continue;
        }

        if (row.validation.isDuplicate && options.skipDuplicates) {
          result.duplicates++;
          result.details.duplicates.push({
            tenantName: row.data.tenantName || "",
            reason: row.validation.duplicateReason || "Duplicate record",
          });
          continue;
        }

        const [existingTenant] = await db
          .select()
          .from(rraTenants)
          .where(
            and(
              eq(rraTenants.marinaLocationId, targetLocationId),
              or(
                ilike(rraTenants.name, row.data.tenantName || ""),
                sql`${rraTenants.email} = ${row.data.tenantEmail || ""}`
              )
            )
          )
          .limit(1);

        let tenantId: string;

        if (existingTenant) {
          if (options.importMode === "create") {
            if (options.skipDuplicates) {
              result.duplicates++;
              result.details.duplicates.push({
                tenantName: row.data.tenantName || "",
                reason: `Tenant "${row.data.tenantName}" already exists`,
              });
              continue;
            }
          }

          if (options.importMode === "append" || options.importMode === "replace") {
            await db.update(rraTenants)
              .set({
                email: row.data.tenantEmail || existingTenant.email,
                phone: row.data.tenantPhone || existingTenant.phone,
                address1: row.data.address1 || existingTenant.address1,
                city: row.data.city || existingTenant.city,
                state: row.data.state || existingTenant.state,
                zip: row.data.zip || existingTenant.zip,
                updatedAt: new Date(),
              })
              .where(eq(rraTenants.id, existingTenant.id));

            tenantId = existingTenant.id;
            result.imported++;
            result.details.updated.push({
              tenantName: row.data.tenantName || "",
              id: existingTenant.id,
            });
          } else {
            tenantId = existingTenant.id;
          }
        } else {
          const [newTenant] = await db
            .insert(rraTenants)
            .values({
              id: uuidv4(),
              orgId: session.orgId,
              marinaLocationId: targetLocationId,
              name: row.data.tenantName || "Unknown",
              email: row.data.tenantEmail,
              phone: row.data.tenantPhone,
              address1: row.data.address1,
              city: row.data.city,
              state: row.data.state,
              zip: row.data.zip,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          tenantId = newTenant.id;
          result.imported++;
          result.details.created.push({
            tenantName: row.data.tenantName || "",
            id: newTenant.id,
          });
        }

        if (row.data.unitLocation) {
          const [existingLease] = await db.select()
            .from(rraLeases)
            .where(and(
              eq(rraLeases.marinaLocationId, targetLocationId),
              eq(rraLeases.tenantId, tenantId),
              ilike(rraLeases.unitLocation, row.data.unitLocation)
            ))
            .limit(1);

          let leaseId: string;

          if (existingLease) {
            if (options.importMode === "create") {
              continue;
            }

            if (options.importMode === "replace") {
              await db.update(rraLeases)
                .set({
                  storageType: row.data.storageType || existingLease.storageType,
                  contractTermGroup: row.data.contractTerm || existingLease.contractTermGroup,
                  leaseCommencement: row.data.leaseCommencement || existingLease.leaseCommencement,
                  leaseExpiration: row.data.leaseExpiration || existingLease.leaseExpiration,
                  status: row.data.status || existingLease.status,
                  boatLength: row.data.boatLength ? parseFloat(row.data.boatLength) : existingLease.boatLength,
                  boatWidth: row.data.boatWidth ? parseFloat(row.data.boatWidth) : existingLease.boatWidth,
                  boatMake: row.data.boatMake || existingLease.boatMake,
                  boatModel: row.data.boatModel || existingLease.boatModel,
                  boatYear: row.data.boatYear ? parseInt(row.data.boatYear) : existingLease.boatYear,
                  electricIncluded: row.data.electricIncluded ?? existingLease.electricIncluded,
                  electricFee: row.data.electricFee ? parseFloat(row.data.electricFee) : existingLease.electricFee,
                  liveaboardAllowed: row.data.liveaboardAllowed ?? existingLease.liveaboardAllowed,
                  liveaboardFee: row.data.liveaboardFee ? parseFloat(row.data.liveaboardFee) : existingLease.liveaboardFee,
                  notes: row.data.notes || existingLease.notes,
                  updatedAt: new Date(),
                })
                .where(eq(rraLeases.id, existingLease.id));
              leaseId = existingLease.id;
            } else {
              leaseId = existingLease.id;
            }
          } else {
            leaseId = uuidv4();
            await db.insert(rraLeases).values({
              id: leaseId,
              orgId: session.orgId,
              marinaLocationId: targetLocationId,
              tenantId,
              unitLocation: row.data.unitLocation,
              storageType: row.data.storageType || "Wet Slip",
              contractTermGroup: row.data.contractTerm || "Annual",
              leaseCommencement: row.data.leaseCommencement,
              leaseExpiration: row.data.leaseExpiration,
              status: row.data.status || "Active",
              boatLength: row.data.boatLength ? parseFloat(row.data.boatLength) : null,
              boatWidth: row.data.boatWidth ? parseFloat(row.data.boatWidth) : null,
              boatMake: row.data.boatMake,
              boatModel: row.data.boatModel,
              boatYear: row.data.boatYear ? parseInt(row.data.boatYear) : null,
              electricIncluded: row.data.electricIncluded,
              electricFee: row.data.electricFee ? parseFloat(row.data.electricFee) : null,
              liveaboardAllowed: row.data.liveaboardAllowed,
              liveaboardFee: row.data.liveaboardFee ? parseFloat(row.data.liveaboardFee) : null,
              notes: row.data.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          if (row.data.leaseAmount) {
            const [existingLineItem] = await db.select()
              .from(rraLeaseLineItems)
              .where(and(
                eq(rraLeaseLineItems.leaseId, leaseId),
                eq(rraLeaseLineItems.lineItemType, "Base Rent")
              ))
              .limit(1);

            if (existingLineItem && (options.importMode === "replace" || options.importMode === "append")) {
              await db.update(rraLeaseLineItems)
                .set({
                  amount: parseFloat(row.data.leaseAmount),
                  updatedAt: new Date(),
                })
                .where(eq(rraLeaseLineItems.id, existingLineItem.id));
            } else if (!existingLineItem) {
              await db.insert(rraLeaseLineItems).values({
                id: uuidv4(),
                orgId: session.orgId,
                leaseId,
                lineItemType: "Base Rent",
                description: "Monthly Base Rent",
                amount: parseFloat(row.data.leaseAmount),
                frequency: "monthly",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }
      } catch (error: any) {
        result.errors++;
        result.details.failed.push({
          tenantName: row.data.tenantName || `Row ${row.rowIndex + 1}`,
          error: error.message || "Unknown error",
          rowIndex: row.rowIndex,
        });
      }
    }

    session.status = "imported";
    session.updatedAt = new Date();

    return result;
  }

  deleteSession(sessionId: string): void {
    importSessions.delete(sessionId);
  }
}

export const importSessionService = new ImportSessionService();

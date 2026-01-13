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

    const sessionId = uuidv4();
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
      totalRows: parseResult.rows.length,
      columnMappings: [],
      customFields: [],
      valueMappings: [],
      importMode: options.importMode || "create",
      skipDuplicates: options.skipDuplicates ?? true,
      parseConfidence: parseResult.confidence,
      extractionMethod: parseResult.extractionMethod,
      warnings: parseResult.warnings,
      errors: parseResult.errors,
      createdAt: new Date(),
      updatedAt: new Date(),
      rawData: parseResult.rows,
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

        if (existingTenants.has(tenantKey)) {
          isDuplicate = true;
          existingRecordId = existingTenants.get(tenantKey);
          duplicateReason = `Tenant "${transformedData.tenantName}" already exists`;
        } else if (emailKey && existingTenants.has(emailKey)) {
          isDuplicate = true;
          existingRecordId = existingTenants.get(emailKey);
          duplicateReason = `Tenant with email "${transformedData.tenantEmail}" already exists`;
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

    const preview = await this.previewImport(sessionId);
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
          const leaseId = uuidv4();
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

          if (row.data.leaseAmount) {
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

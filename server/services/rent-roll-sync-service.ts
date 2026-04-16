/**
 * Rent Roll Sync Service
 *
 * Bridges parsed rent roll data (from RentRollDocumentParser) into the
 * structured rent_rolls + rent_roll_entries tables. Called after a user
 * uploads a rent roll document and clicks "Sync to Model".
 *
 * Column mapping is heuristic: the parser returns rows with arbitrary
 * header names from the source document. This service normalizes common
 * header variants (e.g., "Slip #" / "Unit" / "Space No." → unitNumber)
 * using pattern matching, then bulk-inserts into rent_roll_entries.
 */

import { pool } from "../db";
import { logger } from "../lib/logger";
import type { DocumentParseResult, ParsedRow } from "./rent-roll-document-parser";

// Header → field mapping patterns
const FIELD_PATTERNS: { field: string; patterns: RegExp[] }[] = [
  { field: "unitNumber", patterns: [/slip|unit|space|dock|berth|lot|#/i] },
  { field: "tenantName", patterns: [/tenant|lessee|name|customer|renter|occupant/i] },
  { field: "monthlyRate", patterns: [/month.*rate|rent|rate|amount|fee|charge|monthly/i] },
  { field: "entryType", patterns: [/type|category|class|storage.*type/i] },
  { field: "status", patterns: [/status|occupancy|vacant|active/i] },
  { field: "startDate", patterns: [/start|begin|lease.*start|move.*in|from/i] },
  { field: "endDate", patterns: [/end|expir|lease.*end|move.*out|to|through/i] },
  { field: "notes", patterns: [/note|comment|memo|remark/i] },
];

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    for (const { field, patterns } of FIELD_PATTERNS) {
      if (mapping[field]) continue;
      if (patterns.some((p) => p.test(header))) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

function inferEntryType(row: ParsedRow, typeHeader: string | undefined): string {
  if (typeHeader) {
    const val = (row[typeHeader] || "").toLowerCase();
    if (/wet|slip|dock|berth/i.test(val)) return "slip";
    if (/dry|rack|stack/i.test(val)) return "rack";
    if (/commercial|retail|office/i.test(val)) return "commercial";
    if (/season/i.test(val)) return "seasonal";
  }
  return "slip";
}

function inferStatus(row: ParsedRow, statusHeader: string | undefined): string {
  if (statusHeader) {
    const val = (row[statusHeader] || "").toLowerCase();
    if (/vacant|empty|available/i.test(val)) return "vacant";
    if (/reserved|hold/i.test(val)) return "reserved";
    if (/maintenance|repair|out.*service/i.test(val)) return "maintenance";
  }
  return "active";
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,\s]/g, "").replace(/\((.+)\)/, "-$1");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(val: string | undefined): string | null {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export interface RentRollSyncResult {
  rentRollId: string;
  entriesCreated: number;
  skippedRows: number;
  headerMapping: Record<string, string>;
}

export async function syncParsedRentRoll(params: {
  orgId: string;
  projectId?: string;
  name: string;
  effectiveDate: string;
  parsed: DocumentParseResult;
}): Promise<RentRollSyncResult> {
  const { orgId, projectId, name, effectiveDate, parsed } = params;
  const headerMapping = mapHeaders(parsed.headers);

  logger.info(
    { headers: parsed.headers, mapping: headerMapping, rowCount: parsed.rows.length },
    "[rent-roll-sync] starting sync",
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create master rent roll
    const { rows: rrRows } = await client.query(
      `INSERT INTO rent_rolls (org_id, project_id, name, effective_date, context)
       VALUES ($1, $2, $3, $4, 'valuation')
       RETURNING id`,
      [orgId, projectId || null, name, effectiveDate],
    );
    const rentRollId = rrRows[0].id;

    let entriesCreated = 0;
    let skippedRows = 0;

    for (const row of parsed.rows) {
      const unitNumber =
        (headerMapping.unitNumber ? row[headerMapping.unitNumber] : null) || `Row-${entriesCreated + 1}`;
      const tenantName = headerMapping.tenantName ? row[headerMapping.tenantName] : null;
      const monthlyRate = parseAmount(
        headerMapping.monthlyRate ? row[headerMapping.monthlyRate] : undefined,
      );
      const entryType = inferEntryType(row, headerMapping.entryType);
      const status = inferStatus(row, headerMapping.status);
      const startDate = parseDate(headerMapping.startDate ? row[headerMapping.startDate] : undefined);
      const endDate = parseDate(headerMapping.endDate ? row[headerMapping.endDate] : undefined);
      const notes = headerMapping.notes ? row[headerMapping.notes] : null;

      // Skip completely empty rows
      if (!tenantName && monthlyRate === 0 && unitNumber.startsWith("Row-")) {
        skippedRows++;
        continue;
      }

      await client.query(
        `INSERT INTO rent_roll_entries
           (org_id, rent_roll_id, entry_type, unit_number, tenant_name,
            monthly_rate, status, start_date, end_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orgId,
          rentRollId,
          entryType,
          unitNumber.substring(0, 255),
          tenantName || null,
          monthlyRate,
          status,
          startDate,
          endDate,
          notes,
        ],
      );
      entriesCreated++;
    }

    await client.query("COMMIT");

    logger.info(
      { rentRollId, entriesCreated, skippedRows },
      "[rent-roll-sync] sync complete",
    );

    return { rentRollId, entriesCreated, skippedRows, headerMapping };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

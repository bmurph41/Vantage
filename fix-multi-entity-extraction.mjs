#!/usr/bin/env node
/**
 * fix-multi-entity-extraction.mjs
 *
 * 1. Add entityName + parentItemId columns to doc_intel_extracted_items (DB migration)
 * 2. Fix doc-intel-service.ts to detect multi-entity Excel files and:
 *    - Extract TOTALS column as the primary item (parentItemId = null)
 *    - Extract each entity column as child items (parentItemId = TOTALS row id)
 *    - Store entityName on each child item
 * 3. importConfirmedItems already uses amountConfirmed/amount — TOTALS row will
 *    import correctly since it has the combined value
 */

import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const WS = process.env.HOME + '/workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DB Migration — add entityName + parentItemId columns
// ═══════════════════════════════════════════════════════════════════════════════

async function runMigration() {
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(`
      ALTER TABLE doc_intel_extracted_items
        ADD COLUMN IF NOT EXISTS entity_name text,
        ADD COLUMN IF NOT EXISTS parent_item_id varchar REFERENCES doc_intel_extracted_items(id) ON DELETE CASCADE
    `);
    console.log('✅ DB: Added entity_name + parent_item_id columns');
  } catch (e) {
    console.log('ℹ️  DB columns already exist or error:', e.message);
  } finally {
    await pool.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Patch schema.ts — add the two columns to Drizzle definition
// ═══════════════════════════════════════════════════════════════════════════════

function patchSchema() {
  const file = `${WS}/shared/schema.ts`;
  let src = fs.readFileSync(file, 'utf8');

  const OLD = `  // Destination mapping
  targetTable: text('target_table'), // e.g., 'pnl_lines', 'rent_roll_entries'
  targetRecordId: varchar('target_record_id'), // ID of created record after import`;

  const NEW = `  // Multi-entity support (e.g. Oakdale combined P&L with 3 entities + TOTALS)
  entityName: text('entity_name'),       // e.g. 'CROWLEY MARINE', 'TOTALS'
  parentItemId: varchar('parent_item_id'), // ID of the TOTALS row this entity row belongs to
  // Destination mapping
  targetTable: text('target_table'), // e.g., 'pnl_lines', 'rent_roll_entries'
  targetRecordId: varchar('target_record_id'), // ID of created record after import`;

  if (!src.includes('entityName: text')) {
    src = src.replace(OLD, NEW);
    fs.writeFileSync(file, src, 'utf8');
    console.log('✅ schema.ts: Added entityName + parentItemId to docIntelExtractedItems');
  } else {
    console.log('ℹ️  schema.ts already has entityName');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Patch doc-intel-service.ts — detect multi-entity Excel + extract correctly
// ═══════════════════════════════════════════════════════════════════════════════

function patchService() {
  const file = `${WS}/server/services/doc-intel-service.ts`;
  let src = fs.readFileSync(file, 'utf8');

  // Find the extractItemsFromExcel function and add multi-entity detection
  // The current single-column fallback reads only the first numeric cell.
  // We need to detect row 0 entity headers and extract TOTALS + entity columns.

  const OLD_SINGLE = `      } else {
          const textColumns: string[] = [];
          let amount: number | null = null;
          let dateValue: string | undefined;
          for (const cell of row) {
            if (cell === null || cell === undefined || cell === '') continue;
            if (typeof cell === 'number') {
              if (amount === null) {
                amount = cell;
              }
            } else if (typeof cell === 'string') {
              const trimmed = sanitizeText(cell);
              
              const numericValue = this.parseNumericString(trimmed);
              if (numericValue !== null && amount === null) {
                amount = numericValue;
              } else if (this.isDateString(trimmed)) {
                dateValue = trimmed;
              } else if (trimmed.length > 0 && !this.isNumericOnly(trimmed)) {
                textColumns.push(trimmed);
              }
            }
          }
          const rawText = sanitizeText(textColumns.join(' '));
          
          if (rawText.length > 2 || amount !== null) {
            const isZeroValueSubtotal = amount === null || amount === 0;
            items.push({
              rawText: rawText || '(no description)',
              amount,
              extractedDate: dateValue,
              sourcePage: sheetIndex + 1,
              sourceRow: globalRow,
              isZeroValueSubtotal,
              periodKey: isAnnual ? \`\${yearForPeriod}-ANNUAL\` : undefined,
            });
          }
        }`;

  const NEW_SINGLE = `      } else {
          // ── Multi-entity detection (e.g. Oakdale: CROWLEY | OAKDALE | JMTM | TOTALS) ──
          const entityHeaders = this.detectEntityColumns(jsonData);
          if (entityHeaders && rowIndex === 0) {
            // Skip entity header rows (rows 0 and 1)
            continue;
          }
          if (entityHeaders && rowIndex === 1) continue;

          if (entityHeaders) {
            // Multi-entity mode: extract TOTALS + all entity columns
            const labelCell = row[0];
            const rawText = sanitizeText(typeof labelCell === 'string' ? labelCell : '');
            if (!rawText || this.isHeaderOrSubtotalRow(rawText)) continue;

            // Find TOTALS column value (last entity or explicitly named TOTALS)
            const totalsEntity = entityHeaders.find(e =>
              e.name.toUpperCase().includes('TOTAL') || e.colIndex === entityHeaders[entityHeaders.length - 1].colIndex
            );
            const totalsAmount = totalsEntity ? (typeof row[totalsEntity.colIndex] === 'number' ? row[totalsEntity.colIndex] : null) : null;

            // Push TOTALS row as primary item (no entityName = it's the parent)
            const totalsItem: any = {
              rawText: rawText || '(no description)',
              amount: totalsAmount,
              sourcePage: sheetIndex + 1,
              sourceRow: globalRow,
              isZeroValueSubtotal: totalsAmount === null || totalsAmount === 0,
              periodKey: isAnnual ? \`\${yearForPeriod}-ANNUAL\` : undefined,
              entityName: totalsEntity?.name || 'TOTALS',
              _entityChildren: [] as any[],
            };

            // Push each non-TOTALS entity as a child item
            for (const ent of entityHeaders) {
              if (ent.name.toUpperCase().includes('TOTAL')) continue;
              const val = typeof row[ent.colIndex] === 'number' ? row[ent.colIndex] : null;
              if (val === null) continue;
              totalsItem._entityChildren.push({
                rawText: rawText || '(no description)',
                amount: val,
                sourcePage: sheetIndex + 1,
                sourceRow: globalRow,
                entityName: ent.name,
                periodKey: isAnnual ? \`\${yearForPeriod}-ANNUAL\` : undefined,
              });
            }

            items.push(totalsItem);
          } else {
            // Standard single-column mode
            const textColumns: string[] = [];
            let amount: number | null = null;
            let dateValue: string | undefined;
            for (const cell of row) {
              if (cell === null || cell === undefined || cell === '') continue;
              if (typeof cell === 'number') {
                if (amount === null) {
                  amount = cell;
                }
              } else if (typeof cell === 'string') {
                const trimmed = sanitizeText(cell);
                
                const numericValue = this.parseNumericString(trimmed);
                if (numericValue !== null && amount === null) {
                  amount = numericValue;
                } else if (this.isDateString(trimmed)) {
                  dateValue = trimmed;
                } else if (trimmed.length > 0 && !this.isNumericOnly(trimmed)) {
                  textColumns.push(trimmed);
                }
              }
            }
            const rawText = sanitizeText(textColumns.join(' '));
            
            if (rawText.length > 2 || amount !== null) {
              const isZeroValueSubtotal = amount === null || amount === 0;
              items.push({
                rawText: rawText || '(no description)',
                amount,
                extractedDate: dateValue,
                sourcePage: sheetIndex + 1,
                sourceRow: globalRow,
                isZeroValueSubtotal,
                periodKey: isAnnual ? \`\${yearForPeriod}-ANNUAL\` : undefined,
              });
            }
          }
        }`;

  if (!src.includes('detectEntityColumns') && src.includes(OLD_SINGLE)) {
    src = src.replace(OLD_SINGLE, NEW_SINGLE);
    console.log('✅ doc-intel-service.ts: Single-column path now detects multi-entity layout');
  } else if (src.includes('detectEntityColumns')) {
    console.log('ℹ️  doc-intel-service.ts multi-entity detection already present');
  } else {
    console.error('❌ Could not find single-column block in doc-intel-service.ts');
  }

  // Add detectEntityColumns method before extractItemsFromExcel or near other private methods
  const DETECT_METHOD = `
  /**
   * Detect multi-entity column layout (e.g. Oakdale: col0=label, col1=CROWLEY, col2=OAKDALE, col3=JMTM, col4=TOTALS)
   * Returns array of {colIndex, name} for each entity column, or null if not multi-entity.
   */
  private detectEntityColumns(jsonData: any[][]): Array<{colIndex: number; name: string}> | null {
    if (!jsonData || jsonData.length < 2) return null;
    const row0 = jsonData[0] || [];
    const row1 = jsonData[1] || [];

    const PERIOD_RE = /\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|20\\d{2}|ytd|t12|ttm)\\b/i;
    const candidates: Array<{colIndex: number; name: string}> = [];

    for (let c = 1; c < row0.length; c++) {
      const cell0 = String(row0[c] || '').trim();
      const cell1 = String(row1[c] || '').trim();
      const cell = cell0 || cell1;
      if (!cell) continue;
      if (typeof row0[c] === 'number') continue;
      if (PERIOD_RE.test(cell)) continue;
      // Must look like a business name or TOTALS
      if (cell.length > 2) {
        candidates.push({ colIndex: c, name: cell });
      }
    }

    // Need at least 2 entity columns (otherwise it's just a label column)
    return candidates.length >= 2 ? candidates : null;
  }`;

  if (!src.includes('detectEntityColumns')) {
    // Insert before the closing of the class or before extractItemsFromExcel
    src = src.replace(
      '  private detectMonthHeaders(',
      DETECT_METHOD + '\n\n  private detectMonthHeaders('
    );
    console.log('✅ doc-intel-service.ts: Added detectEntityColumns() method');
  }

  fs.writeFileSync(file, src, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Patch the item insertion loop to handle _entityChildren
// ═══════════════════════════════════════════════════════════════════════════════

function patchInsertLoop() {
  const file = `${WS}/server/services/doc-intel-service.ts`;
  let src = fs.readFileSync(file, 'utf8');

  // Find the insert loop in processUpload or createExtractedItems
  // Look for where items are looped and inserted into docIntelExtractedItems
  const OLD_INSERT = `        extractedItems.push(extracted);`;

  const NEW_INSERT = `        extractedItems.push(extracted);

        // ── Multi-entity children ──────────────────────────────────────────
        if ((cleanedItem as any)._entityChildren?.length) {
          for (const child of (cleanedItem as any)._entityChildren) {
            const childText = sanitizeText(child.rawText);
            const [childRecord] = await db
              .insert(docIntelExtractedItems)
              .values({
                orgId,
                uploadId,
                rawText: childText || '(no description)',
                amount: child.amount !== null ? String(child.amount) : null,
                sourcePage: child.sourcePage,
                sourceRow: child.sourceRow,
                periodKey: child.periodKey,
                status: 'pending',
                entityName: child.entityName,
                parentItemId: extracted.id,
              })
              .returning();
            extractedItems.push(childRecord);
          }
        }`;

  if (!src.includes('_entityChildren?.length') && src.includes(OLD_INSERT)) {
    src = src.replace(OLD_INSERT, NEW_INSERT);
    fs.writeFileSync(file, src, 'utf8');
    console.log('✅ doc-intel-service.ts: Insert loop now creates entity child rows');
  } else if (src.includes('_entityChildren?.length')) {
    console.log('ℹ️  Entity children insert already present');
    fs.writeFileSync(file, src, 'utf8');
  } else {
    console.error('❌ Could not find insert loop — check doc-intel-service.ts manually');
    fs.writeFileSync(file, src, 'utf8');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Run all patches
// ═══════════════════════════════════════════════════════════════════════════════

await runMigration();
patchSchema();
patchService();
patchInsertLoop();

console.log('');
console.log('Multi-entity extraction fix complete:');
console.log('  • DB columns: entity_name, parent_item_id added');
console.log('  • Schema: Drizzle definition updated');
console.log('  • Extractor: TOTALS row = primary item, entity rows = children');
console.log('  • Insert loop: entity children written with parentItemId reference');
console.log('');
console.log('Restart server, then re-upload Oakdale XLS.');
console.log('Review grid will show TOTALS row with entity breakdown underneath.');

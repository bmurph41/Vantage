import { createHash } from 'crypto';
import { pool } from '../../db.js';

export type TemplateDocClass = 'pl' | 't12' | 'rent_roll';

export interface MatchedTemplate {
  id: string;
  name: string | null;
  documentClass: string;
  columnMappings: Record<string, string> | null;
  fieldHints: Record<string, unknown> | null;
  sampleInput: string | null;
  sampleOutput: Record<string, unknown> | null;
  useCount: number;
  avgConfidence: number | null;
  autoCreated: boolean;
}

// ── Fingerprinting ────────────────────────────────────────────────────────
// The goal isn't a cryptographic hash — it's a "same template" detector.
// We strip values but keep labels: that way two months' rent rolls from the
// same property match, but a different property's doesn't. The XLSX handler
// emits `tables` with explicit layout; we prefer that over free-form fullText.

export function computeStructuralFingerprint(
  docClass: TemplateDocClass,
  fullText: string,
  tables: string,
): string {
  // Prefer the tables payload — it's layout-stable across runs. Fall back to
  // fullText only when the file had no detected tables (rare for XLSX/CSV).
  const source = tables && tables.trim().length > 50 ? tables : fullText;

  // Take the first ~800 non-numeric characters — headers, labels, sheet names.
  // Strip currency/numbers/dates — they change monthly, we want structure not values.
  const structural = source
    .slice(0, 4000)
    .replace(/\$?\s*\(?-?[\d,]+\.?\d*\)?/g, '#')  // numbers → '#'
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, 'DATE')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
    .slice(0, 800);

  const hash = createHash('sha256').update(`${docClass}:${structural}`).digest('hex');
  return hash.slice(0, 32);
}

export async function findMatchingTemplate(
  orgId: string,
  docClass: TemplateDocClass,
  fingerprint: string,
): Promise<MatchedTemplate | null> {
  const result = await pool.query(
    `SELECT id, name, document_class, column_mappings, field_hints,
            sample_input, sample_output, use_count, avg_confidence, auto_created
     FROM extraction_templates
     WHERE org_id=$1 AND document_class=$2 AND structural_fingerprint=$3
     ORDER BY use_count DESC, last_used_at DESC NULLS LAST
     LIMIT 1`,
    [orgId, docClass, fingerprint],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    documentClass: row.document_class,
    columnMappings: row.column_mappings,
    fieldHints: row.field_hints,
    sampleInput: row.sample_input,
    sampleOutput: row.sample_output,
    useCount: row.use_count ?? 0,
    avgConfidence: row.avg_confidence != null ? parseFloat(row.avg_confidence) : null,
    autoCreated: row.auto_created ?? false,
  };
}

export function renderTemplateContext(template: MatchedTemplate): string {
  const parts: string[] = [
    '── PRIOR SUCCESSFUL EXTRACTION ON THIS TEMPLATE ──',
    `This document matches a previously-reviewed template "${template.name ?? '(auto)'}" used ${template.useCount} time(s).`,
    'Use the prior extraction below as a STRONG prior for field labels and layout; still verify each value against the current document.',
  ];
  if (template.columnMappings && Object.keys(template.columnMappings).length > 0) {
    parts.push(
      '',
      'KNOWN COLUMN MAPPINGS (apply verbatim unless the document clearly deviates):',
      ...Object.entries(template.columnMappings).map(([k, v]) => `  - "${k}" → ${v}`),
    );
  }
  if (template.fieldHints && Object.keys(template.fieldHints).length > 0) {
    parts.push(
      '',
      'FIELD HINTS (operator-provided):',
      JSON.stringify(template.fieldHints, null, 2),
    );
  }
  if (template.sampleOutput) {
    parts.push(
      '',
      'PRIOR EXTRACTION OUTPUT (for layout reference — values will differ in the new document):',
      JSON.stringify(template.sampleOutput, null, 2).slice(0, 6000),
    );
  }
  return parts.join('\n');
}

// ── Capture ──────────────────────────────────────────────────────────────
// Called after a user confirms/populates an extraction. Creates a new
// template if no fingerprint match exists, or updates use_count on the match.

export interface CaptureInput {
  orgId: string;
  docClass: TemplateDocClass;
  fingerprint: string;
  sampleInput: string;
  sampleOutput: Record<string, unknown>;
  sourceJobId: string;
  avgConfidence?: number | null;
}

export async function captureOrUpdateTemplate(input: CaptureInput): Promise<{ templateId: string; created: boolean }> {
  const existing = await pool.query(
    `SELECT id, use_count FROM extraction_templates
     WHERE org_id=$1 AND document_class=$2 AND structural_fingerprint=$3
     LIMIT 1`,
    [input.orgId, input.docClass, input.fingerprint],
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    await pool.query(
      `UPDATE extraction_templates
       SET use_count = COALESCE(use_count, 0) + 1,
           last_used_at = NOW(),
           sample_output = COALESCE($2, sample_output),
           avg_confidence = CASE
             WHEN $3::numeric IS NULL THEN avg_confidence
             WHEN avg_confidence IS NULL THEN $3::numeric
             ELSE ((avg_confidence * COALESCE(use_count, 0)) + $3::numeric) / (COALESCE(use_count, 0) + 1)
           END,
           updated_at = NOW()
       WHERE id=$1`,
      [row.id, JSON.stringify(input.sampleOutput), input.avgConfidence ?? null],
    );
    return { templateId: row.id, created: false };
  }

  const insert = await pool.query(
    `INSERT INTO extraction_templates
      (id, org_id, document_class, structural_fingerprint,
       sample_input, sample_output, source_job_id,
       use_count, avg_confidence, auto_created, last_used_at, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 1, $7, true, NOW(), NOW(), NOW())
     RETURNING id`,
    [
      input.orgId,
      input.docClass,
      input.fingerprint,
      input.sampleInput.slice(0, 4000),
      JSON.stringify(input.sampleOutput),
      input.sourceJobId,
      input.avgConfidence ?? null,
    ],
  );
  return { templateId: insert.rows[0].id, created: true };
}

export async function recordTemplateMatch(templateId: string): Promise<void> {
  await pool.query(
    `UPDATE extraction_templates
     SET use_count = COALESCE(use_count, 0) + 1, last_used_at = NOW()
     WHERE id=$1`,
    [templateId],
  );
}

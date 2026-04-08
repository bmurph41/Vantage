import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { upload, ensureUploadDir, detectFileType } from '../services/document-parser/file-router.js';
import { extractPDF } from '../services/document-parser/pdf-extractor.js';
import { extractExcel } from '../services/document-parser/excel-extractor.js';
import { extractPL, extractRentRoll, classifyDocument } from '../services/document-parser/claude-extractor.js';
import { flattenExtractionResult } from '../services/document-parser/flatten-extraction.js';
import { pool } from '../db.js';

const router = express.Router();

async function cleanupFile(filePath: string) {
  try { await fs.unlink(filePath); } catch {}
}

// Default confidence thresholds — can be overridden per org
const DEFAULT_CONFIDENCE_THRESHOLDS = { high: 0.85, medium: 0.65 };

// Ensure org config table exists (idempotent)
pool.query(`
  CREATE TABLE IF NOT EXISTS extraction_org_config (
    org_id VARCHAR PRIMARY KEY,
    confidence_high NUMERIC NOT NULL DEFAULT 0.85,
    confidence_medium NUMERIC NOT NULL DEFAULT 0.65,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(() => {});

async function getOrgThresholds(orgId: string): Promise<{ high: number; medium: number }> {
  const result = await pool.query(
    'SELECT confidence_high, confidence_medium FROM extraction_org_config WHERE org_id=$1',
    [orgId]
  );
  if (result.rows.length === 0) return DEFAULT_CONFIDENCE_THRESHOLDS;
  return {
    high: parseFloat(result.rows[0].confidence_high),
    medium: parseFloat(result.rows[0].confidence_medium),
  };
}

// ─── Entitlement limits by tier ─────────────────────────────────────────────
const MONTHLY_UPLOAD_LIMITS: Record<string, number> = {
  analyst: 0,
  professional: 25,
  enterprise: 100,
  institutional: 500,
};

async function checkUploadEntitlement(userId: string, orgId: string, userTier: string): Promise<{ allowed: boolean; reason?: string }> {
  const tier = (userTier || 'analyst').toLowerCase();
  const limit = MONTHLY_UPLOAD_LIMITS[tier] ?? 0;

  if (limit === 0) {
    return { allowed: false, reason: 'Document Intelligence is not available on the Analyst plan. Upgrade to Professional or higher.' };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await pool.query(
    `SELECT COUNT(*) as count FROM document_extraction_jobs 
     WHERE org_id=$1 AND user_id=$2 AND created_at >= $3 AND status != 'failed'`,
    [orgId, userId, startOfMonth.toISOString()]
  );

  const used = parseInt(result.rows[0].count, 10);
  if (used >= limit) {
    return { allowed: false, reason: `Monthly upload limit reached (${used}/${limit}). Resets on the 1st of next month.` };
  }

  return { allowed: true };
}

// ─── POST /upload ────────────────────────────────────────────────────────────
router.post('/upload', upload.single('document'), async (req: any, res: any) => {
  await ensureUploadDir();
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  const { project_id, document_class: hintClass } = req.body;
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const userId = user.id;
  const orgId = user.orgId || user.org_id;
  const userTier = user.subscriptionTier || user.subscription_tier || 'professional';

  // Entitlement check
  const entitlement = await checkUploadEntitlement(userId, orgId, userTier);
  if (!entitlement.allowed) {
    try { await fs.unlink(file.path); } catch {}
    return res.status(403).json({ error: entitlement.reason });
  }

  try {
    const fileType = detectFileType(file.originalname);
    const jobResult = await pool.query(`
      INSERT INTO document_extraction_jobs 
        (project_id, user_id, org_id, original_filename, file_size_bytes, file_type, document_class, storage_path, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING id
    `, [
      project_id || null, userId, orgId,
      file.originalname, file.size,
      fileType,
      hintClass || 'unknown',
      file.path
    ]);

    const jobId = jobResult.rows[0].id;

    processDocument(jobId, file.path, file.originalname, hintClass, orgId)
      .then(() => cleanupFile(file.path))
      .catch(err => {
        cleanupFile(file.path);
        const safeMessage = (err.message || 'Unknown extraction error').slice(0, 500);
        pool.query(
          `UPDATE document_extraction_jobs SET status='failed', error_message=$1 WHERE id=$2`,
          [safeMessage, jobId]
        ).catch(() => {});
      });

    res.json({ jobId, status: 'pending' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:jobId/status ──────────────────────────────────────────────────────
router.get('/:jobId/status', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId } = req.params;
  const orgId = user.orgId || user.org_id;

  const result = await pool.query(
    `SELECT id, status, original_filename, document_class, page_count, sheet_names,
            error_message, extraction_completed_at, created_at
     FROM document_extraction_jobs WHERE id=$1 AND org_id=$2`,
    [jobId, orgId]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
  res.json(result.rows[0]);
});

// ─── GET /:jobId/fields ──────────────────────────────────────────────────────
router.get('/:jobId/fields', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId } = req.params;
  const orgId = user.orgId || user.org_id;

  const job = await pool.query(
    'SELECT id FROM document_extraction_jobs WHERE id=$1 AND org_id=$2',
    [jobId, orgId]
  );
  if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

  const fields = await pool.query(`
    SELECT id, schema_key, display_label, field_group, raw_value, normalized_value, 
           value_type, period_label, confidence_score, confidence_level,
           source_page, source_sheet, source_snippet, is_confirmed, is_manually_overridden,
           override_value, override_note, proforma_field_key
    FROM extraction_fields 
    WHERE job_id=$1
    ORDER BY field_group, schema_key
  `, [jobId]);

  const warnings = validateExtractionFields(fields.rows);
  res.json({ fields: fields.rows, warnings });
});

// ─── PATCH /:jobId/fields/:fieldId ──────────────────────────────────────────
router.patch('/:jobId/fields/:fieldId', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId, fieldId } = req.params;
  const orgId = user.orgId || user.org_id;
  const { override_value, override_note, is_confirmed } = req.body;

  // Verify job belongs to this org
  const job = await pool.query(
    'SELECT id FROM document_extraction_jobs WHERE id=$1 AND org_id=$2',
    [jobId, orgId]
  );
  if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

  await pool.query(`
    UPDATE extraction_fields
    SET override_value=$1, override_note=$2, is_confirmed=$3,
        is_manually_overridden=($1 IS NOT NULL),
        confirmed_at=CASE WHEN $3=true THEN NOW() ELSE NULL END
    WHERE id=$4 AND job_id=$5
  `, [override_value ?? null, override_note ?? null, is_confirmed ?? false, fieldId, jobId]);

  res.json({ success: true });
});

// ─── POST /:jobId/confirm-all ────────────────────────────────────────────────
router.post('/:jobId/confirm-all', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId } = req.params;
  const orgId = user.orgId || user.org_id;

  // Verify job belongs to this org
  const job = await pool.query(
    'SELECT id FROM document_extraction_jobs WHERE id=$1 AND org_id=$2',
    [jobId, orgId]
  );
  if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

  await pool.query(`
    UPDATE extraction_fields SET is_confirmed=true, confirmed_at=NOW()
    WHERE job_id=$1 AND confidence_level IN ('high', 'medium')
  `, [jobId]);

  res.json({ success: true });
});

// ─── POST /:jobId/populate-proforma ─────────────────────────────────────────
router.post('/:jobId/populate-proforma', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId } = req.params;
  const { scenario_id } = req.body;
  const orgId = user.orgId || user.org_id;

  if (!scenario_id) return res.status(400).json({ error: 'scenario_id is required' });

  // Verify job belongs to this org
  const job = await pool.query(
    'SELECT id FROM document_extraction_jobs WHERE id=$1 AND org_id=$2',
    [jobId, orgId]
  );
  if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

  // Verify scenario belongs to this org
  const scenario = await pool.query(
    'SELECT id FROM modeling_scenario_versions WHERE id=$1 AND org_id=$2',
    [scenario_id, orgId]
  );
  if (scenario.rows.length === 0) return res.status(404).json({ error: 'Scenario not found or access denied' });

  const fields = await pool.query(`
    SELECT schema_key,
           COALESCE(override_value, normalized_value) as final_value,
           proforma_field_key
    FROM extraction_fields
    WHERE job_id=$1 AND is_confirmed=true AND proforma_field_key IS NOT NULL
  `, [jobId]);

  const populationMap: Record<string, number> = {};
  for (const row of fields.rows) {
    if (row.proforma_field_key && row.final_value !== null) {
      const parsed = parseFloat(row.final_value);
      if (!isNaN(parsed) && isFinite(parsed)) {
        populationMap[row.proforma_field_key] = parsed;
      }
    }
  }

  // Merge into scenario config (org already verified above)
  await pool.query(`
    UPDATE modeling_scenario_versions
    SET config = config || $1::jsonb,
        updated_at = NOW()
    WHERE id = $2 AND org_id = $3
  `, [JSON.stringify({ extracted_data: populationMap, extraction_job_id: jobId }), scenario_id, orgId]);

  await pool.query(`
    UPDATE document_extraction_jobs
    SET target_scenario_id=$1, population_completed_at=NOW(), status='confirmed'
    WHERE id=$2 AND org_id=$3
  `, [scenario_id, jobId, orgId]);

  res.json({ success: true, fieldsPopulated: fields.rows.length });
});

// ─── GET /history — list past jobs for org ───────────────────────────────────
router.get('/history', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const orgId = user.orgId || user.org_id;
  const { project_id, limit = 20, offset = 0 } = req.query;

  const result = await pool.query(`
    SELECT id, project_id, original_filename, file_type, document_class, status,
           page_count, created_at, extraction_completed_at, confirmed_at,
           (SELECT COUNT(*) FROM extraction_fields WHERE job_id=j.id) as field_count,
           (SELECT COUNT(*) FROM extraction_fields WHERE job_id=j.id AND is_confirmed=true) as confirmed_count
    FROM document_extraction_jobs j
    WHERE org_id=$1 ${project_id ? 'AND project_id=$4' : ''}
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, project_id ? [orgId, limit, offset, project_id] : [orgId, limit, offset]);

  res.json(result.rows);
});

// ─── GET /config — get org extraction config ────────────────────────────────
router.get('/config', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const orgId = user.orgId || user.org_id;
  const thresholds = await getOrgThresholds(orgId);
  res.json({ confidence_thresholds: thresholds });
});

// ─── PUT /config — update org extraction config ─────────────────────────────
router.put('/config', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const orgId = user.orgId || user.org_id;
  const { confidence_high, confidence_medium } = req.body;

  const high = parseFloat(confidence_high);
  const medium = parseFloat(confidence_medium);

  if (isNaN(high) || isNaN(medium) || high <= medium || high > 1 || medium < 0) {
    return res.status(400).json({ error: 'Invalid thresholds. high must be > medium, both between 0 and 1.' });
  }

  await pool.query(`
    INSERT INTO extraction_org_config (org_id, confidence_high, confidence_medium, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (org_id) DO UPDATE SET confidence_high=$2, confidence_medium=$3, updated_at=NOW()
  `, [orgId, high, medium]);

  res.json({ success: true, confidence_thresholds: { high, medium } });
});

// ─── POST /:jobId/rerun — re-run Claude on same document ────────────────────
router.post('/:jobId/rerun', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId } = req.params;
  const orgId = user.orgId || user.org_id;

  const job = await pool.query(
    'SELECT * FROM document_extraction_jobs WHERE id=$1 AND org_id=$2',
    [jobId, orgId]
  );
  if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

  const j = job.rows[0];
  if (!j.storage_path) return res.status(400).json({ error: 'Original file no longer available' });

  // Reset the job
  await pool.query(`
    UPDATE document_extraction_jobs SET status='pending', error_message=null, 
           extraction_completed_at=null, confirmed_at=null
    WHERE id=$1
  `, [jobId]);
  await pool.query('DELETE FROM extraction_fields WHERE job_id=$1', [jobId]);

  processDocument(jobId, j.storage_path, j.original_filename, j.document_class, orgId)
    .then(() => cleanupFile(j.storage_path))
    .catch(err => {
      cleanupFile(j.storage_path);
      const safeMessage = (err.message || 'Unknown extraction error').slice(0, 500);
      pool.query(
        `UPDATE document_extraction_jobs SET status='failed', error_message=$1 WHERE id=$2`,
        [safeMessage, jobId]
      ).catch(() => {});
    });

  res.json({ jobId, status: 'pending' });
});

// ─── GET /scenarios/:projectId — list scenarios for scenario picker ──────────
router.get('/scenarios/:projectId', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const orgId = user.orgId || user.org_id;
  const { projectId } = req.params;

  const result = await pool.query(`
    SELECT id, name, scenario_type, is_current_version, version, created_at
    FROM modeling_scenario_versions
    WHERE modeling_project_id=$1 AND org_id=$2 AND is_current_version=true
    ORDER BY scenario_type ASC, created_at DESC
  `, [projectId, orgId]);

  res.json(result.rows);
});

// ─── BUSINESS RULE VALIDATION ────────────────────────────────────────────────

interface ValidationWarning {
  rule: string;
  message: string;
  expected: number | null;
  actual: number | null;
  severity: 'warning' | 'error';
}

function validateExtractionFields(fields: any[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const val = (key: string): number | null => {
    const f = fields.find((r: any) => r.schema_key === key);
    if (!f) return null;
    const v = f.override_value ?? f.normalized_value;
    return v !== null && v !== undefined ? parseFloat(v) : null;
  };

  const TOLERANCE = 0.02; // 2% tolerance for rounding

  function checkSum(totalKey: string, totalLabel: string, componentKeys: string[], componentLabel: string) {
    const total = val(totalKey);
    if (total === null) return;
    const components = componentKeys.map(val).filter((v): v is number => v !== null);
    if (components.length < 2) return;
    const sum = components.reduce((a, b) => a + b, 0);
    if (Math.abs(total) > 0 && Math.abs(total - sum) / Math.abs(total) > TOLERANCE) {
      warnings.push({
        rule: `${totalKey}_sum_check`,
        message: `${totalLabel} ($${total.toLocaleString()}) differs from sum of ${componentLabel} ($${sum.toLocaleString()}) by more than 2%`,
        expected: total,
        actual: sum,
        severity: 'warning',
      });
    }
  }

  // Total Revenue = EGI + Total Other Income
  checkSum('total_revenue', 'Total Revenue',
    ['effective_gross_income', 'total_other_income'], 'EGI + Other Income');

  // EGI = GPR - Vacancy - Concessions - Bad Debt
  const gpr = val('gross_potential_rent');
  const vacancy = val('vacancy_loss');
  const concessions = val('concessions');
  const badDebt = val('bad_debt');
  const egi = val('effective_gross_income');
  if (gpr !== null && egi !== null) {
    const computed = gpr - Math.abs(vacancy || 0) - Math.abs(concessions || 0) - Math.abs(badDebt || 0);
    if (Math.abs(egi) > 0 && Math.abs(egi - computed) / Math.abs(egi) > TOLERANCE) {
      warnings.push({
        rule: 'egi_calculation_check',
        message: `EGI ($${egi.toLocaleString()}) differs from GPR minus deductions ($${computed.toLocaleString()})`,
        expected: egi,
        actual: computed,
        severity: 'warning',
      });
    }
  }

  // NOI = Total Revenue - Total OpEx
  checkSum('net_operating_income', 'NOI',
    ['total_revenue', 'total_operating_expenses'], 'Revenue - OpEx');
  // For NOI, it's revenue minus expenses, so override the generic sum check
  const totalRev = val('total_revenue');
  const totalOpex = val('total_operating_expenses');
  const noi = val('net_operating_income');
  if (totalRev !== null && totalOpex !== null && noi !== null) {
    // Remove the generic sum check we just added and replace with subtraction
    const idx = warnings.findIndex(w => w.rule === 'net_operating_income_sum_check');
    if (idx >= 0) warnings.splice(idx, 1);
    const computed = totalRev - Math.abs(totalOpex);
    if (Math.abs(noi) > 0 && Math.abs(noi - computed) / Math.abs(noi) > TOLERANCE) {
      warnings.push({
        rule: 'noi_calculation_check',
        message: `NOI ($${noi.toLocaleString()}) differs from Revenue minus OpEx ($${computed.toLocaleString()})`,
        expected: noi,
        actual: computed,
        severity: 'warning',
      });
    }
  }

  // Total OpEx = sum of expense line items
  checkSum('total_operating_expenses', 'Total Operating Expenses',
    ['management_fees', 'payroll', 'repairs_maintenance', 'contract_services',
     'utilities', 'insurance', 'real_estate_taxes', 'landscaping',
     'administrative', 'advertising_marketing', 'reserves'],
    'expense line items');

  // Rent Roll: occupied + vacant = total
  const totalUnits = val('total_units');
  const occupied = val('occupied_units');
  const vacant = val('vacant_units');
  if (totalUnits !== null && occupied !== null && vacant !== null) {
    if (Math.abs(totalUnits - (occupied + vacant)) > 0.5) {
      warnings.push({
        rule: 'unit_count_check',
        message: `Total units (${totalUnits}) does not equal occupied (${occupied}) + vacant (${vacant})`,
        expected: totalUnits,
        actual: occupied + vacant,
        severity: 'warning',
      });
    }
  }

  // Occupancy rate cross-check
  const occRate = val('occupancy_rate');
  if (occRate !== null && totalUnits !== null && occupied !== null && totalUnits > 0) {
    const computed = (occupied / totalUnits) * 100;
    const rateNormalized = occRate > 1 ? occRate : occRate * 100;
    if (Math.abs(rateNormalized - computed) > 2) {
      warnings.push({
        rule: 'occupancy_rate_check',
        message: `Occupancy rate (${rateNormalized.toFixed(1)}%) doesn't match occupied/total (${computed.toFixed(1)}%)`,
        expected: rateNormalized,
        actual: computed,
        severity: 'warning',
      });
    }
  }

  return warnings;
}

// ─── ASYNC PROCESSING PIPELINE ───────────────────────────────────────────────

async function processDocument(
  jobId: string,
  filePath: string,
  filename: string,
  hintClass?: string,
  orgId?: string
) {
  await pool.query(
    `UPDATE document_extraction_jobs SET status='parsing', parsing_started_at=NOW() WHERE id=$1`,
    [jobId]
  );

  const fileType = detectFileType(filename);

  let fullText = '';
  let tablesFormatted = '';
  let pageCount = 1;
  let sheetNames: string[] = [];

  if (fileType === 'pdf') {
    const result = await extractPDF(filePath);
    fullText = result.fullText;
    pageCount = result.pageCount;
    tablesFormatted = result.pages
      .flatMap(p => p.tables)
      .map(t => `[Page ${t.pageNumber}]\n${t.rows.map(r => r.join(' | ')).join('\n')}`)
      .join('\n\n');
  } else {
    const result = await extractExcel(filePath);
    sheetNames = result.sheetNames;
    fullText = result.fullText;
    tablesFormatted = fullText;
  }

  await pool.query(
    `UPDATE document_extraction_jobs 
     SET raw_text_extracted=$1, page_count=$2, sheet_names=$3, status='extracting'
     WHERE id=$4`,
    [fullText.slice(0, 100000), pageCount, sheetNames, jobId]
  );

  const classification = await classifyDocument(fullText.slice(0, 3000), filename);
  const docClass = (hintClass && hintClass !== 'unknown') ? hintClass : classification.class;

  await pool.query(
    `UPDATE document_extraction_jobs SET document_class=$1 WHERE id=$2`,
    [docClass, jobId]
  );

  const thresholds = orgId ? await getOrgThresholds(orgId) : DEFAULT_CONFIDENCE_THRESHOLDS;

  let extractionResult: any;
  if (docClass === 'pl' || docClass === 't12') {
    extractionResult = await extractPL(fullText, tablesFormatted, filename);
    await saveExtractionFields(jobId, extractionResult, 'pl', thresholds);
  } else if (docClass === 'rent_roll') {
    extractionResult = await extractRentRoll(fullText, tablesFormatted, filename);
    await saveExtractionFields(jobId, extractionResult, 'rent_roll', thresholds);
  }

  await pool.query(
    `UPDATE document_extraction_jobs 
     SET status='review_required', extraction_completed_at=NOW()
     WHERE id=$1`,
    [jobId]
  );
}

async function saveExtractionFields(
  jobId: string,
  result: any,
  docType: 'pl' | 'rent_roll',
  orgConfidenceThresholds?: { high: number; medium: number }
) {
  const thresholds = orgConfidenceThresholds || { high: 0.85, medium: 0.65 };
  const fields = flattenExtractionResult(
    result.data || {},
    result.confidence_scores || {},
    result.source_references || {},
    docType
  );

  if (fields.length === 0) return;

  // Batch insert — build a single multi-row INSERT
  const COLS = 14;
  const values: any[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const confidenceLevel =
      field.confidence_score >= thresholds.high ? 'high'
      : field.confidence_score >= thresholds.medium ? 'medium'
      : 'low';

    const offset = i * COLS;
    placeholders.push(
      `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10},$${offset+11},$${offset+12},$${offset+13},$${offset+14})`
    );
    values.push(
      jobId, field.schema_key, field.display_label, field.field_group,
      field.raw_value, field.normalized_value, field.value_type,
      field.confidence_score, confidenceLevel,
      field.source_page, field.source_sheet, field.source_row,
      field.source_snippet, field.proforma_field_key
    );
  }

  await pool.query(`
    INSERT INTO extraction_fields
      (job_id, schema_key, display_label, field_group, raw_value, normalized_value,
       value_type, confidence_score, confidence_level, source_page, source_sheet,
       source_row, source_snippet, proforma_field_key)
    VALUES ${placeholders.join(',\n           ')}
  `, values);
}

export default router;

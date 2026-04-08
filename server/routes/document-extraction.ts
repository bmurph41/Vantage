import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { upload, ensureUploadDir, detectFileType } from '../services/document-parser/file-router.js';
import { extractPDF } from '../services/document-parser/pdf-extractor.js';
import { extractExcel } from '../services/document-parser/excel-extractor.js';
import { extractPL, extractRentRoll, classifyDocument } from '../services/document-parser/claude-extractor.js';
import { flattenExtractionResult } from '../services/document-parser/flatten-extraction.js';
import { EXTRACTION_TO_ACTUALS_MAP, RENT_ROLL_TO_ACTUALS_MAP, type ActualsMapping } from '../services/document-parser/proforma-mapper.js';
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

// Add fiscal year columns to extraction jobs (idempotent)
pool.query(`
  ALTER TABLE document_extraction_jobs
    ADD COLUMN IF NOT EXISTS fiscal_year INTEGER,
    ADD COLUMN IF NOT EXISTS period_start TEXT,
    ADD COLUMN IF NOT EXISTS period_end TEXT,
    ADD COLUMN IF NOT EXISTS reporting_period TEXT
`).catch(() => {});

// Verify required tables exist on startup
pool.query(`
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='document_extraction_jobs') AS jobs_exist,
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='extraction_fields') AS fields_exist,
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='modeling_actuals') AS actuals_exist
`).then(r => {
  const { jobs_exist, fields_exist, actuals_exist } = r.rows[0];
  if (!jobs_exist || !fields_exist) {
    console.error('[Document Extraction] CRITICAL: Required tables missing. document_extraction_jobs:', jobs_exist, 'extraction_fields:', fields_exist);
    console.error('[Document Extraction] Run database migrations to create these tables.');
  }
  if (!actuals_exist) {
    console.error('[Document Extraction] WARNING: modeling_actuals table missing. Populate Pro Forma will fail.');
  }
}).catch(() => {});

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

  const { project_id, document_class: hintClass, fiscal_year } = req.body;
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
    const parsedFiscalYear = fiscal_year ? parseInt(fiscal_year, 10) : null;
    const jobResult = await pool.query(`
      INSERT INTO document_extraction_jobs
        (project_id, user_id, org_id, original_filename, file_size_bytes, file_type, document_class, storage_path, status, fiscal_year)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
      RETURNING id
    `, [
      project_id || null, userId, orgId,
      file.originalname, file.size,
      fileType,
      hintClass || 'unknown',
      file.path,
      parsedFiscalYear
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
            error_message, extraction_completed_at, created_at,
            fiscal_year, period_start, period_end, reporting_period
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
// Writes confirmed extraction fields into modeling_actuals as historical data.
// The Pro Forma engine reads actuals to build baseline projections.
router.post('/:jobId/populate-proforma', async (req: any, res: any) => {
  const user = req.user || req.resolvedUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId } = req.params;
  const { fiscal_year: overrideFiscalYear } = req.body;
  const orgId = user.orgId || user.org_id;

  // Load job with project and fiscal year context
  const jobResult = await pool.query(
    `SELECT id, project_id, fiscal_year, document_class
     FROM document_extraction_jobs WHERE id=$1 AND org_id=$2`,
    [jobId, orgId]
  );
  if (jobResult.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

  const job = jobResult.rows[0];
  const projectId = job.project_id;
  if (!projectId) return res.status(400).json({ error: 'Job is not linked to a project. Upload from a project workspace.' });

  // Determine fiscal year: user override > job.fiscal_year > current year
  const fiscalYear = overrideFiscalYear
    ? parseInt(overrideFiscalYear, 10)
    : (job.fiscal_year || new Date().getFullYear());

  if (!fiscalYear || isNaN(fiscalYear)) {
    return res.status(400).json({ error: 'Could not determine fiscal year. Specify fiscal_year in request.' });
  }

  // Load confirmed fields
  const fields = await pool.query(`
    SELECT schema_key, field_group,
           COALESCE(override_value, normalized_value) as final_value,
           display_label, period_label
    FROM extraction_fields
    WHERE job_id=$1 AND is_confirmed=true
  `, [jobId]);

  if (fields.rows.length === 0) {
    return res.status(400).json({ error: 'No confirmed fields to populate' });
  }

  // Determine which mapping to use
  const isRentRoll = job.document_class === 'rent_roll';
  const actualsMap = isRentRoll ? RENT_ROLL_TO_ACTUALS_MAP : EXTRACTION_TO_ACTUALS_MAP;

  // Check if the target period is locked
  const lockCheck = await pool.query(
    `SELECT id FROM fund_period_locks
     WHERE org_id=$1 AND is_locked=true
     AND lock_start_date <= $2 AND lock_end_date >= $2`,
    [orgId, `${fiscalYear}-12-31`]
  );
  if (lockCheck.rows.length > 0) {
    return res.status(409).json({ error: `Fiscal year ${fiscalYear} is locked. Unlock the period before populating.` });
  }

  // Clear previous extraction actuals for this project+year+source
  await pool.query(`
    DELETE FROM modeling_actuals
    WHERE modeling_project_id=$1 AND org_id=$2 AND data_source='doc_intel'
      AND source_record_type='extraction_job' AND source_record_id=$3
  `, [projectId, orgId, jobId]);

  let inserted = 0;
  let skippedTotals = 0;
  const errors: string[] = [];

  // Process top-level annual fields
  for (const row of fields.rows) {
    const key = row.schema_key;
    const value = parseFloat(row.final_value);
    if (isNaN(value) || !isFinite(value)) continue;

    // Skip monthly breakdown fields (handled separately below)
    if (key.startsWith('monthly.') || key.startsWith('unit.')) continue;

    const mapping: ActualsMapping | undefined = actualsMap[key];
    if (!mapping) continue;

    // Skip computed totals — the engine recomputes these from line items
    if (mapping.isTotal) {
      skippedTotals++;
      continue;
    }

    // For annual P&L data: spread evenly across 12 months
    const monthlyAmount = value / 12;

    for (let month = 1; month <= 12; month++) {
      try {
        await pool.query(`
          INSERT INTO modeling_actuals
            (org_id, modeling_project_id, year, month, category, subcategory, department,
             line_item_description, amount, data_source, source_record_id, source_record_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'doc_intel', $10, 'extraction_job')
          ON CONFLICT (modeling_project_id, year, month, category, subcategory, line_item_description)
          DO UPDATE SET amount = EXCLUDED.amount, department = EXCLUDED.department,
                        data_source = EXCLUDED.data_source, source_record_id = EXCLUDED.source_record_id,
                        updated_at = NOW()
        `, [
          orgId, projectId, fiscalYear, month,
          mapping.category, mapping.subcategory, mapping.department || 'Operating Expenses',
          `${mapping.department || 'Operating Expenses'}: ${mapping.subcategory}`,
          monthlyAmount.toFixed(2),
          jobId
        ]);
        inserted++;
      } catch (err: any) {
        errors.push(`${key} month ${month}: ${err.message?.slice(0, 100)}`);
      }
    }
  }

  // Process monthly breakdown fields (T-12 format)
  for (const row of fields.rows) {
    const key = row.schema_key;
    if (!key.startsWith('monthly.')) continue;

    const value = parseFloat(row.final_value);
    if (isNaN(value) || !isFinite(value)) continue;

    // Parse: monthly.{period}.{field_key}
    const parts = key.split('.');
    if (parts.length < 3) continue;

    const periodStr = parts[1]; // e.g., "january_2024" or "jan"
    const fieldKey = parts.slice(2).join('.');

    const mapping = actualsMap[fieldKey];
    if (!mapping || mapping.isTotal) continue;

    // Try to extract month number from period string
    const monthNum = parseMonthFromPeriod(periodStr, row.period_label);
    if (!monthNum) continue;

    try {
      await pool.query(`
        INSERT INTO modeling_actuals
          (org_id, modeling_project_id, year, month, category, subcategory, department,
           line_item_description, amount, data_source, source_record_id, source_record_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'doc_intel', $10, 'extraction_job')
        ON CONFLICT (modeling_project_id, year, month, category, subcategory, line_item_description)
        DO UPDATE SET amount = EXCLUDED.amount, department = EXCLUDED.department,
                      data_source = EXCLUDED.data_source, source_record_id = EXCLUDED.source_record_id,
                      updated_at = NOW()
      `, [
        orgId, projectId, fiscalYear, monthNum,
        mapping.category, mapping.subcategory, mapping.department || 'Operating Expenses',
        `${mapping.department || 'Operating Expenses'}: ${mapping.subcategory}`,
        value.toFixed(2),
        jobId
      ]);
      inserted++;
    } catch (err: any) {
      errors.push(`${key}: ${err.message?.slice(0, 100)}`);
    }
  }

  // For rent roll: annualize monthly rent and spread across 12 months
  if (isRentRoll) {
    for (const row of fields.rows) {
      if (row.schema_key !== 'total_actual_rent') continue;
      const monthlyRent = parseFloat(row.final_value);
      if (isNaN(monthlyRent) || !isFinite(monthlyRent)) continue;

      for (let month = 1; month <= 12; month++) {
        try {
          await pool.query(`
            INSERT INTO modeling_actuals
              (org_id, modeling_project_id, year, month, category, subcategory, department,
               line_item_description, amount, data_source, source_record_id, source_record_type)
            VALUES ($1, $2, $3, $4, 'Revenue', 'Gross Potential Rent', 'Revenue',
                    'Revenue: Gross Potential Rent', $5, 'doc_intel', $6, 'extraction_job')
            ON CONFLICT (modeling_project_id, year, month, category, subcategory, line_item_description)
            DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
          `, [orgId, projectId, fiscalYear, month, monthlyRent.toFixed(2), jobId]);
          inserted++;
        } catch (err: any) {
          errors.push(`rent_roll month ${month}: ${err.message?.slice(0, 100)}`);
        }
      }
    }
  }

  // Mark job as confirmed
  await pool.query(`
    UPDATE document_extraction_jobs
    SET population_completed_at=NOW(), status='confirmed', fiscal_year=$2
    WHERE id=$1 AND org_id=$3
  `, [jobId, fiscalYear, orgId]);

  res.json({
    success: true,
    actualsInserted: inserted,
    totalsSkipped: skippedTotals,
    fiscalYear,
    errors: errors.length > 0 ? errors : undefined,
  });
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

// ─── MONTH PARSING UTILITY ───────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function parseMonthFromPeriod(periodKey: string, periodLabel?: string | null): number | null {
  // Try period label first (e.g., "January 2024", "Jan", "1/2024")
  const label = (periodLabel || periodKey || '').toLowerCase().trim();

  // Match month name at start
  for (const [name, num] of Object.entries(MONTH_NAMES)) {
    if (label.startsWith(name)) return num;
  }

  // Match numeric month (e.g., "1_2024", "01", "1/2024")
  const numMatch = label.match(/^(\d{1,2})/);
  if (numMatch) {
    const m = parseInt(numMatch[1], 10);
    if (m >= 1 && m <= 12) return m;
  }

  return null;
}

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

  // Save Claude-detected period info and infer fiscal year if not already set
  const data = extractionResult?.data || {};
  const periodStart = data.period_start || data.roll_date || null;
  const periodEnd = data.period_end || null;
  const reportingPeriod = data.reporting_period || null;

  // Infer fiscal year from period info if user didn't specify
  let inferredYear: number | null = null;
  if (periodEnd) {
    const parsed = new Date(periodEnd);
    if (!isNaN(parsed.getTime())) inferredYear = parsed.getFullYear();
  } else if (periodStart) {
    const parsed = new Date(periodStart);
    if (!isNaN(parsed.getTime())) inferredYear = parsed.getFullYear();
  }

  await pool.query(`
    UPDATE document_extraction_jobs
    SET status='review_required', extraction_completed_at=NOW(),
        period_start=COALESCE($2, period_start),
        period_end=COALESCE($3, period_end),
        reporting_period=COALESCE($4, reporting_period),
        fiscal_year=COALESCE(fiscal_year, $5)
    WHERE id=$1
  `, [jobId, periodStart, periodEnd, reportingPeriod, inferredYear]);
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

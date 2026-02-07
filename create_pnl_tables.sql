-- ═══════════════════════════════════════════════════════════════════
-- P&L Pipeline Tables — Full Creation Script
-- ═══════════════════════════════════════════════════════════════════
--
-- RUN THIS FROM YOUR REPLIT SHELL:
--
--   psql $DATABASE_URL -f create_pnl_tables.sql
--
-- OR paste the contents directly:
--
--   psql $DATABASE_URL <<'EOF'
--   <paste everything below>
--   EOF
--
-- Fully idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════

-- 1. pnl_documents
CREATE TABLE IF NOT EXISTS pnl_documents (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  asset_id        varchar,
  modeling_project_id varchar,
  uploaded_by_user_id varchar,
  original_filename text NOT NULL,
  mime_type       text NOT NULL,
  byte_size       integer NOT NULL,
  sha256          text NOT NULL,
  storage_path    text NOT NULL,
  statement_type  text NOT NULL DEFAULT 'pnl',
  year_hint       integer,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pnl_documents_org_sha_unique UNIQUE (org_id, sha256)
);
CREATE INDEX IF NOT EXISTS pnl_documents_asset_idx ON pnl_documents (asset_id);
CREATE INDEX IF NOT EXISTS pnl_documents_project_idx ON pnl_documents (modeling_project_id);

-- 2. pnl_jobs
CREATE TABLE IF NOT EXISTS pnl_jobs (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  asset_id        varchar,
  document_id     varchar NOT NULL REFERENCES pnl_documents(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'queued',
  stage           text NOT NULL DEFAULT 'ingest',
  retry_count     integer NOT NULL DEFAULT 0,
  last_error      jsonb NOT NULL DEFAULT '{}'::jsonb,
  parser_version  text NOT NULL DEFAULT 'v1',
  mapper_version  text NOT NULL DEFAULT 'v1',
  parse_metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'unknown',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS pnl_jobs_document_idx ON pnl_jobs (document_id);
CREATE INDEX IF NOT EXISTS pnl_jobs_status_idx ON pnl_jobs (status);
CREATE INDEX IF NOT EXISTS pnl_jobs_org_idx ON pnl_jobs (org_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pnl_jobs' AND column_name='parse_metrics_json')
  THEN ALTER TABLE pnl_jobs ADD COLUMN parse_metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pnl_jobs' AND column_name='validation_json')
  THEN ALTER TABLE pnl_jobs ADD COLUMN validation_json jsonb NOT NULL DEFAULT '{}'::jsonb; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pnl_jobs' AND column_name='validation_status')
  THEN ALTER TABLE pnl_jobs ADD COLUMN validation_status text NOT NULL DEFAULT 'unknown'; END IF;
END $$;

-- 3. pnl_parsed_statements
CREATE TABLE IF NOT EXISTS pnl_parsed_statements (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  document_id     varchar NOT NULL REFERENCES pnl_documents(id) ON DELETE CASCADE,
  job_id          varchar NOT NULL REFERENCES pnl_jobs(id) ON DELETE CASCADE,
  parsed_json     jsonb NOT NULL,
  confidence      numeric(5,4) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pnl_parsed_statements_doc_unique UNIQUE (document_id)
);
CREATE INDEX IF NOT EXISTS pnl_parsed_statements_job_idx ON pnl_parsed_statements (job_id);

-- 4. pnl_canonical_line_items
CREATE TABLE IF NOT EXISTS pnl_canonical_line_items (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  canonical_key   text NOT NULL,
  display_name    text NOT NULL,
  department      text NOT NULL,
  section         text NOT NULL,
  parent_id       varchar,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pnl_canonical_line_items_org_key_unique UNIQUE (org_id, canonical_key)
);
CREATE INDEX IF NOT EXISTS pnl_canonical_section_idx ON pnl_canonical_line_items (section);

-- 5. pnl_line_item_aliases
CREATE TABLE IF NOT EXISTS pnl_line_item_aliases (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  alias_text      text NOT NULL,
  alias_regex     text,
  vendor_hint     text,
  canonical_line_item_id varchar REFERENCES pnl_canonical_line_items(id) ON DELETE CASCADE,
  weight          integer NOT NULL DEFAULT 10,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pnl_alias_org_alias_idx ON pnl_line_item_aliases (org_id, alias_text);
CREATE INDEX IF NOT EXISTS pnl_alias_canonical_idx ON pnl_line_item_aliases (canonical_line_item_id);

-- 6. pnl_facts
CREATE TABLE IF NOT EXISTS pnl_facts (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  asset_id        varchar,
  document_id     varchar NOT NULL REFERENCES pnl_documents(id) ON DELETE CASCADE,
  canonical_line_item_id varchar NOT NULL REFERENCES pnl_canonical_line_items(id) ON DELETE RESTRICT,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  period_type     text NOT NULL,
  fiscal_year     integer NOT NULL,
  fiscal_period   integer NOT NULL,
  value           numeric(18,2) NOT NULL,
  source_label    text NOT NULL,
  source_trace    jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_confidence numeric(5,4) NOT NULL DEFAULT 0,
  mapping_confidence numeric(5,4) NOT NULL DEFAULT 0,
  mapping_method  text NOT NULL DEFAULT 'rule',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pnl_facts_doc_line_period_unique UNIQUE (document_id, canonical_line_item_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS pnl_facts_org_asset_idx ON pnl_facts (org_id, asset_id);
CREATE INDEX IF NOT EXISTS pnl_facts_fiscal_year_idx ON pnl_facts (fiscal_year);

-- 7. pnl_review_items
CREATE TABLE IF NOT EXISTS pnl_review_items (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  job_id          varchar NOT NULL REFERENCES pnl_jobs(id) ON DELETE CASCADE,
  document_id     varchar NOT NULL REFERENCES pnl_documents(id) ON DELETE CASCADE,
  extracted_label text NOT NULL,
  normalized_label text NOT NULL,
  suggested_canonical_line_item_id varchar REFERENCES pnl_canonical_line_items(id) ON DELETE SET NULL,
  suggestion_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence      numeric(5,4) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'needs_review',
  resolved_by     varchar,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pnl_review_items_job_idx ON pnl_review_items (job_id);
CREATE INDEX IF NOT EXISTS pnl_review_items_status_idx ON pnl_review_items (status);

-- 8. pnl_keyword_rules
CREATE TABLE IF NOT EXISTS pnl_keyword_rules (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar,
  department      text NOT NULL,
  bucket          text NOT NULL,
  keyword         text NOT NULL,
  match_type      text NOT NULL DEFAULT 'phrase',
  priority        integer NOT NULL DEFAULT 100,
  canonical_line_item_id varchar REFERENCES pnl_canonical_line_items(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  source          text NOT NULL DEFAULT 'seed',
  times_matched   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pnl_keyword_rules_org_keyword_idx ON pnl_keyword_rules (org_id, keyword);
CREATE INDEX IF NOT EXISTS pnl_keyword_rules_dept_bucket_idx ON pnl_keyword_rules (department, bucket);
CREATE INDEX IF NOT EXISTS pnl_keyword_rules_priority_idx ON pnl_keyword_rules (priority);

-- 9. pnl_department_verifications
CREATE TABLE IF NOT EXISTS pnl_department_verifications (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar NOT NULL,
  job_id          varchar NOT NULL REFERENCES pnl_jobs(id) ON DELETE CASCADE,
  document_id     varchar NOT NULL REFERENCES pnl_documents(id) ON DELETE CASCADE,
  extracted_label text NOT NULL,
  normalized_label text NOT NULL,
  ambiguous_keyword text NOT NULL,
  possible_departments jsonb NOT NULL,
  ambiguity_reason text NOT NULL,
  selected_department text,
  selected_bucket text,
  status          text NOT NULL DEFAULT 'pending',
  resolved_by_user_id varchar,
  save_to_keyword_bank boolean NOT NULL DEFAULT false,
  keyword_rule_id varchar REFERENCES pnl_keyword_rules(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS pnl_dept_verifications_job_idx ON pnl_department_verifications (job_id);
CREATE INDEX IF NOT EXISTS pnl_dept_verifications_status_idx ON pnl_department_verifications (status);
CREATE INDEX IF NOT EXISTS pnl_dept_verifications_org_idx ON pnl_department_verifications (org_id);
CREATE INDEX IF NOT EXISTS pnl_dept_verifications_normalized_idx ON pnl_department_verifications (normalized_label);

-- ═══════════════════════════════════════════════════════════════════
-- Done. All 9 P&L pipeline tables created.
-- ═══════════════════════════════════════════════════════════════════

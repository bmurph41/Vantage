# Vantage Document Intelligence — Full Build Specification
## AI-Powered P&L and Rent Roll Extraction Engine

**Version:** 1.0  
**Platform:** Vantage (React/TypeScript + Node.js/Express + PostgreSQL/Drizzle)  
**Target:** Replit AI Agent execution  
**Scope:** Extraction of P&L and Rent Roll data from PDF and Excel documents, with structured output mapped directly into Vantage's Pro Forma financial models.

---

## 1. COMPETITIVE LANDSCAPE SUMMARY

Before building, understand what the best tools do:

| Tool | Strengths | Gaps |
|---|---|---|
| **Parseur** | Template + AI hybrid, 99.99% uptime, audit logs | Generic; not CRE-specific |
| **RealQuant** | Source citations per cell, Excel model output | SaaS only; no embed |
| **PRODA** | Rent roll standardization across PM systems | Rent roll only |
| **Primer (PropRise)** | OM + T12 + rent roll → Excel | Acquisition focus only |
| **Lido** | Template-free, any layout | No CRE financial model integration |
| **Lextract** | 126 lease fields, confidence scoring | Lease abstraction only |
| **Cactus** | Full underwriting suite with doc extraction | Standalone SaaS, expensive |

**Vantage's Advantage:** Native integration with our Pro Forma engine, DCF, and Monte Carlo — extracted data flows directly into the financial model without a copy-paste step. This is the killer differentiator.

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCUMENT INTELLIGENCE                     │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Upload  │───▶│  Parser      │───▶│  Claude AI       │  │
│  │  UI      │    │  Pipeline    │    │  Extraction      │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│                         │                      │            │
│              ┌──────────┴──────┐    ┌──────────▼────────┐  │
│              │  File Type      │    │  Field Confidence  │  │
│              │  Router         │    │  Scoring           │  │
│              │  PDF / Excel /  │    │  + Source Refs     │  │
│              │  Scanned OCR    │    └──────────┬────────┘  │
│              └─────────────────┘               │            │
│                                     ┌──────────▼────────┐  │
│                                     │  Review UI         │  │
│                                     │  (cell-by-cell     │  │
│                                     │   confirmation)    │  │
│                                     └──────────┬────────┘  │
│                                                │            │
│                                     ┌──────────▼────────┐  │
│                                     │  Pro Forma        │  │
│                                     │  Population       │  │
│                                     │  Engine           │  │
│                                     └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. TECH STACK DECISIONS

All libraries chosen to fit the existing Vantage stack (React/TypeScript + Node/Express + PostgreSQL/Drizzle).

### Backend Libraries (add to package.json)
```json
{
  "pdfjs-dist": "^4.x",           // already present — PDF text layer extraction
  "xlsx": "^0.18.5",              // SheetJS — Excel parsing (.xlsx, .xls, .csv)
  "pdf2json": "^3.x",             // geometry-based PDF table detection (supplement)
  "tesseract.js": "^5.x",         // OCR fallback for scanned/image PDFs
  "sharp": "^0.33.x",             // PDF page → image conversion for OCR
  "multer": "^1.4.x",             // multipart file upload middleware
  "uuid": "^9.x"                  // already present
}
```

### Frontend Libraries (add to package.json)
```json
{
  "react-dropzone": "^14.x",      // drag-and-drop file upload
  "react-pdf": "^7.x",            // PDF preview panel
  "@tanstack/react-query": "^5.x" // already present
}
```

### AI Integration
- **Model:** `claude-opus-4-6` for extraction (highest accuracy for structured financial docs)
- **Fallback:** `claude-sonnet-4-6` for simpler extractions
- **API Key:** Use existing `ANTHROPIC_API_KEY` from Vantage environment

---

## 4. DATABASE SCHEMA

Add to Drizzle schema (`shared/schema.ts`). Use `pool.query()` for these tables — do NOT use `db.push()`.

```sql
-- Raw SQL to execute via pool.query()

-- Document extraction jobs
CREATE TABLE IF NOT EXISTS document_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES modeling_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  
  -- File metadata
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'xlsx', 'xls', 'csv')),
  document_class TEXT NOT NULL CHECK (document_class IN ('pl', 'rent_roll', 'om', 't12', 'unknown')),
  storage_path TEXT NOT NULL,  -- path in /uploads or object store
  
  -- Processing state
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'parsing', 'extracting', 'review_required', 'confirmed', 'failed')),
  error_message TEXT,
  
  -- Extraction results
  raw_text_extracted TEXT,           -- full text dump from PDF/Excel
  page_count INTEGER,
  sheet_names TEXT[],                -- for Excel multi-sheet files
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  parsing_started_at TIMESTAMPTZ,
  extraction_completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  
  -- Population target
  target_scenario_id UUID,           -- which Pro Forma scenario to populate
  population_completed_at TIMESTAMPTZ
);

-- Extracted fields (one row per extracted data point)
CREATE TABLE IF NOT EXISTS extraction_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES document_extraction_jobs(id) ON DELETE CASCADE,
  
  -- Field identity
  schema_key TEXT NOT NULL,          -- e.g. 'effective_gross_income', 'unit.102.rent'
  display_label TEXT NOT NULL,       -- e.g. 'Effective Gross Income', 'Unit 102 - Monthly Rent'
  field_group TEXT NOT NULL,         -- e.g. 'income', 'expenses', 'unit_mix', 'debt'
  
  -- Extracted value
  raw_value TEXT,                    -- exactly as extracted from document
  normalized_value NUMERIC,          -- parsed numeric value
  value_type TEXT CHECK (value_type IN ('currency', 'percentage', 'integer', 'text', 'date')),
  period_label TEXT,                 -- e.g. 'Jan 2024', 'TTM', 'Year 1'
  
  -- Provenance / confidence
  confidence_score NUMERIC(4,3),     -- 0.000 to 1.000
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low', 'manual')),
  source_page INTEGER,               -- PDF page number (1-indexed)
  source_sheet TEXT,                 -- Excel sheet name
  source_row INTEGER,                -- row in sheet or PDF table
  source_col TEXT,                   -- column header in source
  source_snippet TEXT,               -- verbatim text from source for audit
  
  -- Review state
  is_confirmed BOOLEAN DEFAULT FALSE,
  is_manually_overridden BOOLEAN DEFAULT FALSE,
  override_value NUMERIC,
  override_note TEXT,
  confirmed_at TIMESTAMPTZ,
  
  -- Pro Forma mapping
  proforma_field_key TEXT,           -- maps to Pro Forma schema key
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction templates (reusable per document source/format)
CREATE TABLE IF NOT EXISTS extraction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  document_class TEXT NOT NULL,
  description TEXT,
  
  -- Template configuration (JSON)
  field_hints JSONB,                 -- hints to Claude about field locations
  column_mappings JSONB,             -- known column header → schema_key mappings
  skip_patterns TEXT[],              -- regex patterns to skip (headers, footers, etc.)
  
  -- Stats
  use_count INTEGER DEFAULT 0,
  avg_confidence NUMERIC(4,3),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_extraction_jobs_project ON document_extraction_jobs(project_id);
CREATE INDEX idx_extraction_jobs_status ON document_extraction_jobs(status);
CREATE INDEX idx_extraction_fields_job ON extraction_fields(job_id);
CREATE INDEX idx_extraction_fields_schema_key ON extraction_fields(schema_key);
```

---

## 5. EXTRACTION SCHEMAS

These define the canonical fields Vantage extracts. Both schemas feed into the Pro Forma engine.

### 5A. P&L Schema (`PLExtractionSchema`)

```typescript
// shared/extraction-schemas.ts

export interface PLExtractionSchema {
  // Document metadata
  property_name?: string;
  property_address?: string;
  reporting_period?: string;        // e.g. "TTM", "Jan-Dec 2024", "2024"
  period_start?: string;            // ISO date
  period_end?: string;              // ISO date
  currency?: string;                // USD default
  reporting_basis?: 'cash' | 'accrual';

  // INCOME
  gross_potential_rent: number | null;
  vacancy_loss: number | null;
  concessions: number | null;
  bad_debt: number | null;
  effective_gross_income: number | null;

  // Other Income
  parking_income?: number | null;
  laundry_income?: number | null;
  late_fees?: number | null;
  pet_fees?: number | null;
  storage_income?: number | null;
  utility_reimbursements?: number | null;
  other_income_line_items?: Array<{ label: string; amount: number }>;
  total_other_income: number | null;

  total_revenue: number | null;

  // OPERATING EXPENSES
  management_fees?: number | null;
  payroll?: number | null;
  repairs_maintenance?: number | null;
  contract_services?: number | null;
  utilities?: number | null;
  insurance?: number | null;
  real_estate_taxes?: number | null;
  landscaping?: number | null;
  administrative?: number | null;
  advertising_marketing?: number | null;
  reserves?: number | null;
  other_expense_line_items?: Array<{ label: string; amount: number }>;
  total_operating_expenses: number | null;

  // NOI
  net_operating_income: number | null;

  // DEBT SERVICE (if included)
  mortgage_payment?: number | null;
  interest_expense?: number | null;
  principal_payment?: number | null;

  // NET CASH FLOW
  net_cash_flow?: number | null;

  // TRAILING PERIODS (for T-12)
  monthly_breakdown?: Array<{
    period: string;                  // e.g. "Jan 2024"
    effective_gross_income: number | null;
    total_operating_expenses: number | null;
    net_operating_income: number | null;
  }>;
}

### 5B. Rent Roll Schema (`RentRollExtractionSchema`)

export interface RentRollExtractionSchema {
  // Document metadata
  property_name?: string;
  property_address?: string;
  roll_date?: string;               // "as of" date
  total_units?: number;
  total_sqft?: number;

  // Summary metrics (extracted from header/footer)
  occupancy_rate?: number;          // 0-1
  occupied_units?: number;
  vacant_units?: number;
  total_potential_rent?: number;
  total_actual_rent?: number;

  // UNIT-LEVEL DATA (the core table)
  units: Array<{
    unit_number: string;
    unit_type?: string;             // e.g. "1BR/1BA", "Studio", "2BR"
    sqft?: number;
    bedrooms?: number;
    bathrooms?: number;
    status: 'occupied' | 'vacant' | 'notice' | 'model' | 'down' | 'unknown';

    // Tenant info
    tenant_name?: string;

    // Lease terms
    lease_start?: string;           // ISO date
    lease_end?: string;             // ISO date
    lease_term_months?: number;

    // Financials
    market_rent?: number;           // monthly
    contract_rent?: number;         // actual monthly charged
    actual_rent_collected?: number; // for T12 context
    rent_per_sqft?: number;
    deposits?: number;
    balance_owed?: number;

    // Additional
    move_in_date?: string;
    move_out_date?: string;         // for notices/vacants
    notes?: string;
  }>;

  // UNIT MIX SUMMARY (aggregated)
  unit_mix?: Array<{
    type: string;
    count: number;
    avg_sqft: number;
    avg_market_rent: number;
    avg_contract_rent: number;
    occupancy_rate: number;
  }>;
}
```

---

## 6. BACKEND: PARSER PIPELINE

### 6A. File Router (`server/services/document-parser/file-router.ts`)

```typescript
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

export const UPLOAD_DIR = '/tmp/vantage-doc-uploads';

export const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  }
});

export type FileType = 'pdf' | 'xlsx' | 'xls' | 'csv';
export type DocumentClass = 'pl' | 'rent_roll' | 't12' | 'om' | 'unknown';

export function detectFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, FileType> = {
    '.pdf': 'pdf', '.xlsx': 'xlsx', '.xls': 'xls', '.csv': 'csv'
  };
  return map[ext] ?? 'pdf';
}
```

### 6B. PDF Extractor (`server/services/document-parser/pdf-extractor.ts`)

```typescript
import * as pdfjs from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';

export interface PageTextResult {
  pageNumber: number;
  text: string;
  tables: ExtractedTable[];
  isScanned: boolean;
}

export interface ExtractedTable {
  pageNumber: number;
  rows: string[][];
  headerRow: string[];
}

export async function extractPDF(filePath: string): Promise<{
  pages: PageTextResult[];
  fullText: string;
  pageCount: number;
  hasScannedPages: boolean;
}> {
  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: PageTextResult[] = [];
  let hasScannedPages = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Extract raw text items with position data
    const items = content.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    // Check if page is effectively empty (scanned image)
    const rawText = items.map(i => i.str).join(' ').trim();
    const isScanned = rawText.length < 50;

    let pageText = rawText;
    let tables: ExtractedTable[] = [];

    if (isScanned) {
      // OCR fallback via Tesseract
      hasScannedPages = true;
      const ocrResult = await runOCROnPage(filePath, i, pdf.numPages);
      pageText = ocrResult.text;
    } else {
      // Geometry-based table detection (same approach as existing P&L parser v2)
      tables = extractTablesFromItems(items, i);
    }

    pages.push({ pageNumber: i, text: pageText, tables, isScanned });
  }

  return {
    pages,
    fullText: pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n'),
    pageCount: pdf.numPages,
    hasScannedPages
  };
}

async function runOCROnPage(
  filePath: string, 
  pageNum: number, 
  totalPages: number
): Promise<{ text: string }> {
  // Convert PDF page to image using sharp, then run Tesseract
  // Implementation: use pdf-poppler or ghostscript via shell if available,
  // else use pdfjs canvas rendering
  const worker = await Tesseract.createWorker('eng');
  try {
    // NOTE: For production, render PDF page to PNG first
    // For now: return placeholder that Claude can fill from other pages
    const result = await worker.recognize(filePath);
    return { text: result.data.text };
  } finally {
    await worker.terminate();
  }
}

function extractTablesFromItems(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
  pageNum: number
): ExtractedTable[] {
  // Group items by Y coordinate (row detection) with tolerance
  // This mirrors the geometry-based approach in the existing P&L parser v2
  const TOLERANCE = 3;
  const rowMap = new Map<number, typeof items>();

  for (const item of items) {
    const y = Math.round(item.transform[5] / TOLERANCE) * TOLERANCE;
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y)!.push(item);
  }

  // Sort rows top-to-bottom (descending Y in PDF coordinates)
  const sortedRows = Array.from(rowMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, items]) => ({
      y,
      cells: items
        .sort((a, b) => a.transform[4] - b.transform[4]) // sort left-to-right by X
        .map(i => i.str.trim())
        .filter(s => s.length > 0)
    }));

  // Detect tables: rows with 2+ numeric columns = financial table
  const tables: ExtractedTable[] = [];
  let currentTableRows: string[][] = [];
  let headerRow: string[] = [];

  for (const row of sortedRows) {
    const numericCount = row.cells.filter(c => /[\d,\.\$\(\)%]/.test(c)).length;
    const isDataRow = numericCount >= 2 && row.cells.length >= 2;

    if (isDataRow) {
      currentTableRows.push(row.cells);
    } else if (currentTableRows.length > 0) {
      // End of table
      tables.push({ pageNumber: pageNum, rows: currentTableRows, headerRow });
      currentTableRows = [];
      headerRow = [];
    } else {
      // Possible header row
      headerRow = row.cells;
    }
  }

  if (currentTableRows.length > 0) {
    tables.push({ pageNumber: pageNum, rows: currentTableRows, headerRow });
  }

  return tables;
}
```

### 6C. Excel Extractor (`server/services/document-parser/excel-extractor.ts`)

```typescript
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, string | number | null>>;
  rawMatrix: (string | number | null)[][];
  numericColumnCount: number;
  rowCount: number;
}

export async function extractExcel(filePath: string): Promise<{
  sheets: SheetData[];
  sheetNames: string[];
  primarySheet: SheetData;
}> {
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const sheets: SheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      raw: false,
      defval: null,
    });

    if (rawMatrix.length === 0) continue;

    // Detect header row (first non-empty row with mostly text)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
      const row = rawMatrix[i];
      const textCount = row.filter(c => c !== null && typeof c === 'string' && isNaN(Number(c))).length;
      if (textCount >= 2) { headerRowIdx = i; break; }
    }

    const headers = (rawMatrix[headerRowIdx] || []).map(h => String(h ?? '').trim());
    const dataRows = rawMatrix.slice(headerRowIdx + 1);

    const rows = dataRows.map(row => {
      const obj: Record<string, string | number | null> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] ?? null;
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== null));

    const numericColumnCount = headers.filter(h => {
      const sample = rows.slice(0, 5).map(r => r[h]);
      return sample.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))).length >= 2;
    }).length;

    sheets.push({ sheetName, headers, rows, rawMatrix, numericColumnCount, rowCount: rows.length });
  }

  // Primary sheet = most numeric columns (the financial data sheet)
  const primarySheet = sheets.sort((a, b) => b.numericColumnCount - a.numericColumnCount)[0];

  return { sheets, sheetNames: workbook.SheetNames, primarySheet };
}
```

### 6D. Claude Extraction Engine (`server/services/document-parser/claude-extractor.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { PLExtractionSchema, RentRollExtractionSchema } from '../../../shared/extraction-schemas.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExtractionResult<T> = {
  data: Partial<T>;
  confidence_scores: Record<string, number>;    // field_key → 0.0-1.0
  source_references: Record<string, {           // field_key → provenance
    page?: number;
    sheet?: string;
    row?: number;
    snippet?: string;
  }>;
  extraction_notes: string[];
  document_class_confirmed: string;
};

// ─── P&L EXTRACTION ──────────────────────────────────────────────

export async function extractPL(
  fullText: string,
  tables: string,
  filename: string
): Promise<ExtractionResult<PLExtractionSchema>> {
  const systemPrompt = `You are an expert commercial real estate financial analyst and document parser.
Your task is to extract structured P&L (income statement) data from the provided document text.

CRITICAL RULES:
1. Extract ONLY values that are explicitly present in the document. Never infer or estimate.
2. For every field you extract, provide a confidence score (0.0–1.0) and a source snippet.
3. Confidence scoring guide:
   - 1.0: Field exactly matches a standard label, clearly numeric, single occurrence
   - 0.85: Strong match but label slightly different (e.g. "Mgmt Fee" for "management_fees")
   - 0.7: Inferred from context (e.g. NOI = EGI - OpEx when not explicitly stated)
   - 0.5: Ambiguous — multiple possible values or label unclear
   - 0.3: Low confidence — guessed from surrounding context
4. All monetary values in USD. Negative values (expenses) should be stored as POSITIVE numbers.
5. Detect the reporting period. TTM = trailing twelve months. T12 = same.
6. If monthly breakdown is present, extract it.
7. If a field is not present, set it to null — do NOT fabricate a value.

Return ONLY valid JSON matching the schema below. No markdown, no explanation.`;

  const userPrompt = `Filename: ${filename}

DOCUMENT TEXT:
${fullText.slice(0, 50000)} ${fullText.length > 50000 ? '\n[TEXT TRUNCATED — first 50K chars shown]' : ''}

DETECTED TABLES (formatted):
${tables}

Extract into this exact JSON structure:
{
  "data": { /* PLExtractionSchema fields */ },
  "confidence_scores": { "field_key": 0.95, ... },
  "source_references": {
    "field_key": { "page": 1, "snippet": "verbatim text from document" }
  },
  "extraction_notes": ["any warnings or observations"],
  "document_class_confirmed": "pl" | "t12" | "unknown"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    throw new Error(`Claude returned invalid JSON for P&L extraction: ${text.slice(0, 200)}`);
  }
}

// ─── RENT ROLL EXTRACTION ─────────────────────────────────────────

export async function extractRentRoll(
  fullText: string,
  tables: string,
  filename: string
): Promise<ExtractionResult<RentRollExtractionSchema>> {
  const systemPrompt = `You are an expert commercial real estate analyst specializing in rent roll analysis.
Your task is to extract structured unit-level rent roll data from the provided document.

CRITICAL RULES:
1. Extract EVERY unit row in the document. Do not skip units.
2. Common column headers and their meanings:
   - "Unit" / "Unit #" / "#" → unit_number
   - "Tenant" / "Resident" / "Name" → tenant_name
   - "BD" / "Bed" / "BR" → bedrooms
   - "BA" / "Bath" → bathrooms  
   - "SQFT" / "SF" / "Sq Ft" → sqft
   - "Market Rent" / "Mkt Rent" / "Potential Rent" → market_rent
   - "Actual Rent" / "Contract Rent" / "Rent Charged" / "Lease Rent" → contract_rent
   - "Lease Start" / "Move In" → lease_start (convert to ISO date)
   - "Lease End" / "Exp" → lease_end (convert to ISO date)
   - "Status" / "Occ" / "Vacant" → status
3. Status values: 'occupied', 'vacant', 'notice', 'model', 'down', 'unknown'
4. If a unit row shows "VACANT" or has no tenant name → status = 'vacant'
5. Calculate unit_mix summary after extracting all units.
6. Confidence is per-unit-field when ambiguous, but aggregate to a summary score.
7. Return ONLY valid JSON. No markdown.`;

  const userPrompt = `Filename: ${filename}

DOCUMENT TEXT:
${fullText.slice(0, 60000)} ${fullText.length > 60000 ? '\n[TEXT TRUNCATED]' : ''}

TABLES:
${tables}

Extract into this exact JSON:
{
  "data": {
    "property_name": "...",
    "roll_date": "...",
    "total_units": 0,
    "occupancy_rate": 0.0,
    "units": [
      {
        "unit_number": "101",
        "unit_type": "2BR/1BA",
        "sqft": 850,
        "status": "occupied",
        "tenant_name": "Smith, J",
        "lease_start": "2023-06-01",
        "lease_end": "2024-05-31",
        "market_rent": 1500,
        "contract_rent": 1450
      }
    ],
    "unit_mix": [...]
  },
  "confidence_scores": { "units": 0.9, "market_rent": 0.85, ... },
  "source_references": { "units": { "sheet": "Rent Roll", "row": 5, "snippet": "..." } },
  "extraction_notes": [],
  "document_class_confirmed": "rent_roll"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,  // larger for big rent rolls
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    throw new Error(`Claude returned invalid JSON for Rent Roll extraction: ${text.slice(0, 200)}`);
  }
}

// ─── DOCUMENT CLASSIFIER ─────────────────────────────────────────

export async function classifyDocument(
  firstPageText: string,
  filename: string
): Promise<{ class: 'pl' | 'rent_roll' | 't12' | 'om' | 'unknown'; confidence: number }> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',  // cheaper for classification
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Classify this CRE document. Filename: "${filename}". First page text: "${firstPageText.slice(0, 2000)}".
      
Reply ONLY with JSON: {"class": "pl"|"rent_roll"|"t12"|"om"|"unknown", "confidence": 0.0-1.0}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { class: 'unknown', confidence: 0 };
  }
}
```

---

## 7. BACKEND: API ROUTES

### Route File (`server/routes/document-extraction.ts`)

```typescript
import express from 'express';
import { upload } from '../services/document-parser/file-router.js';
import { extractPDF } from '../services/document-parser/pdf-extractor.js';
import { extractExcel } from '../services/document-parser/excel-extractor.js';
import { extractPL, extractRentRoll, classifyDocument } from '../services/document-parser/claude-extractor.js';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import path from 'path';

const router = express.Router();

// POST /api/v1/document-extraction/upload
router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  const { project_id, document_class: hintClass } = req.body;
  const userId = req.user.id;
  const orgId = req.user.org_id;

  try {
    // 1. Create job record
    const jobResult = await pool.query(`
      INSERT INTO document_extraction_jobs 
        (project_id, user_id, org_id, original_filename, file_size_bytes, file_type, document_class, storage_path, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING id
    `, [
      project_id || null, userId, orgId,
      file.originalname, file.size,
      path.extname(file.originalname).replace('.', '').toLowerCase(),
      hintClass || 'unknown',
      file.path
    ]);

    const jobId = jobResult.rows[0].id;

    // 2. Start async processing (don't await)
    processDocument(jobId, file.path, file.originalname, hintClass).catch(err => {
      console.error(`Document extraction job ${jobId} failed:`, err);
      pool.query(
        `UPDATE document_extraction_jobs SET status='failed', error_message=$1 WHERE id=$2`,
        [err.message, jobId]
      );
    });

    res.json({ jobId, status: 'pending' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/document-extraction/:jobId/status
router.get('/:jobId/status', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  const result = await pool.query(
    `SELECT id, status, original_filename, document_class, page_count, error_message, 
            extraction_completed_at, created_at
     FROM document_extraction_jobs WHERE id=$1`,
    [jobId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
  res.json(result.rows[0]);
});

// GET /api/v1/document-extraction/:jobId/fields
router.get('/:jobId/fields', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  const fields = await pool.query(`
    SELECT id, schema_key, display_label, field_group, raw_value, normalized_value, 
           value_type, period_label, confidence_score, confidence_level,
           source_page, source_sheet, source_snippet, is_confirmed, is_manually_overridden,
           override_value, proforma_field_key
    FROM extraction_fields 
    WHERE job_id=$1
    ORDER BY field_group, schema_key
  `, [jobId]);

  res.json(fields.rows);
});

// PATCH /api/v1/document-extraction/:jobId/fields/:fieldId
router.patch('/:jobId/fields/:fieldId', requireAuth, async (req, res) => {
  const { fieldId } = req.params;
  const { override_value, override_note, is_confirmed } = req.body;

  await pool.query(`
    UPDATE extraction_fields 
    SET override_value=$1, override_note=$2, is_confirmed=$3,
        is_manually_overridden=($1 IS NOT NULL),
        confirmed_at=CASE WHEN $3=true THEN NOW() ELSE NULL END
    WHERE id=$4
  `, [override_value ?? null, override_note ?? null, is_confirmed ?? false, fieldId]);

  res.json({ success: true });
});

// POST /api/v1/document-extraction/:jobId/confirm-all
router.post('/:jobId/confirm-all', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  await pool.query(`
    UPDATE extraction_fields SET is_confirmed=true, confirmed_at=NOW()
    WHERE job_id=$1 AND confidence_level IN ('high', 'medium')
  `, [jobId]);
  res.json({ success: true });
});

// POST /api/v1/document-extraction/:jobId/populate-proforma
router.post('/:jobId/populate-proforma', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  const { scenario_id } = req.body;

  // Pull all confirmed/high-confidence fields
  const fields = await pool.query(`
    SELECT schema_key, 
           COALESCE(override_value, normalized_value) as final_value,
           proforma_field_key
    FROM extraction_fields
    WHERE job_id=$1 AND is_confirmed=true AND proforma_field_key IS NOT NULL
  `, [jobId]);

  // Build the population payload
  const populationMap: Record<string, number> = {};
  for (const row of fields.rows) {
    if (row.proforma_field_key && row.final_value !== null) {
      populationMap[row.proforma_field_key] = parseFloat(row.final_value);
    }
  }

  // Update the scenario config with extracted values
  // This calls into the existing Pro Forma/scenario update mechanism
  await pool.query(`
    UPDATE modeling_scenario_versions
    SET config = config || $1::jsonb,
        updated_at = NOW()
    WHERE id = $2
  `, [JSON.stringify({ extracted_data: populationMap, extraction_job_id: jobId }), scenario_id]);

  await pool.query(`
    UPDATE document_extraction_jobs 
    SET target_scenario_id=$1, population_completed_at=NOW(), status='confirmed'
    WHERE id=$2
  `, [scenario_id, jobId]);

  res.json({ success: true, fieldsPopulated: fields.rows.length });
});

// ─── ASYNC PROCESSING ──────────────────────────────────────────────

async function processDocument(
  jobId: string,
  filePath: string,
  filename: string,
  hintClass?: string
) {
  await pool.query(
    `UPDATE document_extraction_jobs SET status='parsing', parsing_started_at=NOW() WHERE id=$1`,
    [jobId]
  );

  const fileType = path.extname(filename).replace('.', '').toLowerCase() as 'pdf' | 'xlsx' | 'xls' | 'csv';

  let fullText = '';
  let tablesFormatted = '';
  let pageCount = 1;
  let sheetNames: string[] = [];

  // ── Parse file ──
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
    fullText = result.sheets.map(s =>
      `=== SHEET: ${s.sheetName} ===\nHeaders: ${s.headers.join(' | ')}\n${
        s.rows.slice(0, 500).map(r => Object.values(r).join(' | ')).join('\n')
      }`
    ).join('\n\n');
    tablesFormatted = fullText; // Excel is already tabular
  }

  await pool.query(
    `UPDATE document_extraction_jobs 
     SET raw_text_extracted=$1, page_count=$2, sheet_names=$3, status='extracting'
     WHERE id=$4`,
    [fullText.slice(0, 100000), pageCount, sheetNames, jobId]
  );

  // ── Classify ──
  const classification = await classifyDocument(fullText.slice(0, 3000), filename);
  const docClass = (hintClass && hintClass !== 'unknown') ? hintClass : classification.class;

  await pool.query(
    `UPDATE document_extraction_jobs SET document_class=$1 WHERE id=$2`,
    [docClass, jobId]
  );

  // ── Extract ──
  let extractionResult;
  if (docClass === 'pl' || docClass === 't12') {
    extractionResult = await extractPL(fullText, tablesFormatted, filename);
    await saveExtractionFields(jobId, extractionResult, 'pl');
  } else if (docClass === 'rent_roll') {
    extractionResult = await extractRentRoll(fullText, tablesFormatted, filename);
    await saveExtractionFields(jobId, extractionResult, 'rent_roll');
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
  docType: 'pl' | 'rent_roll'
) {
  const fields = flattenExtractionResult(result.data, result.confidence_scores, result.source_references, docType);

  for (const field of fields) {
    await pool.query(`
      INSERT INTO extraction_fields 
        (job_id, schema_key, display_label, field_group, raw_value, normalized_value,
         value_type, confidence_score, confidence_level, source_page, source_sheet,
         source_snippet, proforma_field_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `, [
      jobId, field.schema_key, field.display_label, field.field_group,
      field.raw_value, field.normalized_value, field.value_type,
      field.confidence_score,
      field.confidence_score >= 0.85 ? 'high' : field.confidence_score >= 0.65 ? 'medium' : 'low',
      field.source_page || null, field.source_sheet || null,
      field.source_snippet || null, field.proforma_field_key || null
    ]);
  }
}
```

**Note:** Implement `flattenExtractionResult()` to walk the extraction schema and convert nested objects (unit rows, monthly breakdowns) into flat field rows with appropriate schema_key naming (`unit.101.contract_rent`, `monthly.jan_2024.noi`, etc.).

---

## 8. FRONTEND: COMPONENTS

### 8A. Document Upload Component (`client/src/components/document-intelligence/DocumentUploader.tsx`)

```tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileText, Table2, Loader2 } from 'lucide-react';

interface Props {
  projectId?: string;
  onJobCreated: (jobId: string) => void;
}

export function DocumentUploader({ projectId, onJobCreated }: Props) {
  const [documentClass, setDocumentClass] = useState<'pl' | 'rent_roll' | 'unknown'>('unknown');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_class', documentClass);
      if (projectId) formData.append('project_id', projectId);

      const res = await fetch('/api/v1/document-extraction/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => onJobCreated(data.jobId)
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) uploadMutation.mutate(files[0]);
  }, [uploadMutation, documentClass]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024
  });

  return (
    <div className="space-y-4">
      {/* Document type selector */}
      <div className="flex gap-2">
        {[
          { value: 'pl', label: 'P&L / Income Statement', icon: FileText },
          { value: 'rent_roll', label: 'Rent Roll', icon: Table2 },
          { value: 'unknown', label: 'Auto-Detect', icon: Upload },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setDocumentClass(value as any)}
            className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
              documentClass === value
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <input {...getInputProps()} />
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>Uploading and parsing document…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Upload className="w-8 h-8" />
            <p className="font-medium text-slate-700">Drop PDF or Excel file here</p>
            <p className="text-sm">Supports .pdf, .xlsx, .xls, .csv — up to 50MB</p>
          </div>
        )}
      </div>

      {uploadMutation.isError && (
        <p className="text-red-500 text-sm">{String(uploadMutation.error)}</p>
      )}
    </div>
  );
}
```

### 8B. Extraction Review Panel (`client/src/components/document-intelligence/ExtractionReview.tsx`)

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, HelpCircle, Edit2, ChevronDown, ChevronRight } from 'lucide-react';

interface ExtractionField {
  id: string;
  schema_key: string;
  display_label: string;
  field_group: string;
  raw_value: string;
  normalized_value: number | null;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low' | 'manual';
  source_page: number | null;
  source_sheet: string | null;
  source_snippet: string | null;
  is_confirmed: boolean;
  override_value: number | null;
}

interface Props {
  jobId: string;
  onPopulate?: (scenarioId: string) => void;
}

export function ExtractionReview({ jobId, onPopulate }: Props) {
  const qc = useQueryClient();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['income', 'expenses']));
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['extraction-fields', jobId],
    queryFn: () => fetch(`/api/v1/document-extraction/${jobId}/fields`, { credentials: 'include' }).then(r => r.json()),
    refetchInterval: 3000  // poll until all fields loaded
  });

  const updateField = useMutation({
    mutationFn: async ({ fieldId, ...body }: { fieldId: string; override_value?: number; is_confirmed?: boolean }) => {
      await fetch(`/api/v1/document-extraction/${jobId}/fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extraction-fields', jobId] })
  });

  const confirmAll = useMutation({
    mutationFn: () => fetch(`/api/v1/document-extraction/${jobId}/confirm-all`, {
      method: 'POST', credentials: 'include'
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extraction-fields', jobId] })
  });

  // Group fields
  const groupedFields = fields.reduce((acc: Record<string, ExtractionField[]>, f: ExtractionField) => {
    if (!acc[f.field_group]) acc[f.field_group] = [];
    acc[f.field_group].push(f);
    return acc;
  }, {});

  const confirmedCount = fields.filter((f: ExtractionField) => f.is_confirmed).length;
  const highConfCount = fields.filter((f: ExtractionField) => f.confidence_level === 'high').length;

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading extracted fields…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex gap-6 text-sm">
          <span className="text-slate-500">
            <span className="font-semibold text-slate-800">{fields.length}</span> fields extracted
          </span>
          <span className="text-emerald-600">
            <span className="font-semibold">{highConfCount}</span> high confidence
          </span>
          <span className="text-blue-600">
            <span className="font-semibold">{confirmedCount}</span> confirmed
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => confirmAll.mutate()}
            className="px-4 py-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Accept All High Confidence
          </button>
          {onPopulate && confirmedCount > 0 && (
            <button
              onClick={() => onPopulate('current-scenario-id')}
              className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Populate Pro Forma ({confirmedCount} fields)
            </button>
          )}
        </div>
      </div>

      {/* Field groups */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {Object.entries(groupedFields).map(([group, groupFields]) => (
          <div key={group}>
            <button
              onClick={() => setExpandedGroups(prev => {
                const next = new Set(prev);
                next.has(group) ? next.delete(group) : next.add(group);
                return next;
              })}
              className="w-full px-6 py-3 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors"
            >
              {expandedGroups.has(group) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-semibold text-slate-700 capitalize">{group.replace('_', ' ')}</span>
              <span className="ml-auto text-xs text-slate-400">{(groupFields as ExtractionField[]).length} fields</span>
            </button>

            {expandedGroups.has(group) && (
              <div className="divide-y divide-slate-50">
                {(groupFields as ExtractionField[]).map(field => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    isEditing={editingFieldId === field.id}
                    onEdit={() => setEditingFieldId(field.id)}
                    onEditCancel={() => setEditingFieldId(null)}
                    onUpdate={(value) => {
                      updateField.mutate({ fieldId: field.id, override_value: value, is_confirmed: true });
                      setEditingFieldId(null);
                    }}
                    onToggleConfirm={() => {
                      updateField.mutate({ fieldId: field.id, is_confirmed: !field.is_confirmed });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldRow({ field, isEditing, onEdit, onEditCancel, onUpdate, onToggleConfirm }: {
  field: ExtractionField;
  isEditing: boolean;
  onEdit: () => void;
  onEditCancel: () => void;
  onUpdate: (value: number) => void;
  onToggleConfirm: () => void;
}) {
  const [editValue, setEditValue] = useState(String(field.override_value ?? field.normalized_value ?? ''));

  const ConfidenceIcon = field.confidence_level === 'high'
    ? CheckCircle2 : field.confidence_level === 'medium'
    ? HelpCircle : AlertCircle;

  const confidenceColor = field.confidence_level === 'high'
    ? 'text-emerald-500' : field.confidence_level === 'medium'
    ? 'text-amber-500' : 'text-red-400';

  const displayValue = field.override_value ?? field.normalized_value;

  return (
    <div className={`px-6 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors ${
      field.is_confirmed ? 'bg-emerald-50/30' : ''
    }`}>
      {/* Confidence indicator */}
      <ConfidenceIcon className={`w-4 h-4 flex-shrink-0 ${confidenceColor}`} />

      {/* Field label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{field.display_label}</p>
        {field.source_snippet && (
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {field.source_page ? `p.${field.source_page} · ` : ''}
            {field.source_sheet ? `${field.source_sheet} · ` : ''}
            "{field.source_snippet.slice(0, 60)}"
          </p>
        )}
      </div>

      {/* Value */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-32 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoFocus
          />
          <button onClick={() => onUpdate(parseFloat(editValue))} className="text-xs text-blue-600 font-medium">Save</button>
          <button onClick={onEditCancel} className="text-xs text-slate-400">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-slate-800 min-w-[80px] text-right">
            {displayValue !== null && displayValue !== undefined
              ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(displayValue)
              : <span className="text-slate-300">—</span>
            }
          </span>
          <button onClick={onEdit} className="text-slate-300 hover:text-slate-500 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Confidence score */}
      <span className={`text-xs font-medium w-10 text-right ${confidenceColor}`}>
        {Math.round((field.confidence_score ?? 0) * 100)}%
      </span>

      {/* Confirm toggle */}
      <button
        onClick={onToggleConfirm}
        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
          field.is_confirmed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-200 hover:border-emerald-400'
        }`}
      >
        {field.is_confirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
      </button>
    </div>
  );
}
```

### 8C. Main Document Intelligence Page (`client/src/pages/document-intelligence/index.tsx`)

```tsx
import { useState } from 'react';
import { DocumentUploader } from '../../components/document-intelligence/DocumentUploader';
import { ExtractionReview } from '../../components/document-intelligence/ExtractionReview';
import { ExtractionStatusPoller } from '../../components/document-intelligence/ExtractionStatusPoller';

export function DocumentIntelligencePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('pending');

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Document Intelligence</h1>
        <p className="text-slate-500 mt-1">Upload P&L or Rent Roll documents — AI extracts and maps data to your Pro Forma</p>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: Upload + Status */}
        <div className="w-96 border-r border-slate-200 p-6 flex flex-col gap-6">
          <DocumentUploader onJobCreated={setJobId} />

          {jobId && (
            <ExtractionStatusPoller
              jobId={jobId}
              onStatusChange={setJobStatus}
            />
          )}
        </div>

        {/* Right: Review Panel */}
        <div className="flex-1 min-w-0">
          {jobId && jobStatus === 'review_required' ? (
            <ExtractionReview
              jobId={jobId}
              onPopulate={(scenarioId) => {
                // Navigate to Pro Forma with pre-populated data
                window.location.href = `/projects/current/pro-forma?from_extraction=${jobId}`;
              }}
            />
          ) : jobId ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="font-medium">Extracting document data…</p>
                <p className="text-sm mt-1">Claude is reading your document</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300">
              <div className="text-center">
                <p className="text-lg font-medium">Upload a document to begin</p>
                <p className="text-sm mt-1">Supports PDF and Excel</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 8D. Status Poller (`client/src/components/document-intelligence/ExtractionStatusPoller.tsx`)

```tsx
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileSearch, Brain } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Queued', icon: Clock, color: 'text-slate-400' },
  parsing: { label: 'Parsing document structure…', icon: FileSearch, color: 'text-blue-500' },
  extracting: { label: 'Claude extracting fields…', icon: Brain, color: 'text-purple-500' },
  review_required: { label: 'Ready for review', icon: CheckCircle2, color: 'text-emerald-500' },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-600' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-red-500' },
};

export function ExtractionStatusPoller({ jobId, onStatusChange }: {
  jobId: string;
  onStatusChange: (status: string) => void;
}) {
  const { data: job } = useQuery({
    queryKey: ['extraction-job-status', jobId],
    queryFn: () => fetch(`/api/v1/document-extraction/${jobId}/status`, { credentials: 'include' }).then(r => r.json()),
    refetchInterval: (data: any) =>
      data?.status && ['review_required', 'confirmed', 'failed'].includes(data.status) ? false : 2000
  });

  useEffect(() => {
    if (job?.status) onStatusChange(job.status);
  }, [job?.status]);

  if (!job) return null;

  const config = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${config.color}`} />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800 truncate">{job.original_filename}</p>
          <p className={`text-xs ${config.color}`}>{config.label}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
          style={{
            width: {
              pending: '10%', parsing: '35%', extracting: '70%',
              review_required: '100%', confirmed: '100%', failed: '100%'
            }[job.status] || '0%'
          }}
        />
      </div>

      {job.page_count && (
        <p className="text-xs text-slate-400">{job.page_count} pages · {job.document_class?.toUpperCase()}</p>
      )}

      {job.error_message && (
        <p className="text-xs text-red-500 bg-red-50 rounded p-2">{job.error_message}</p>
      )}
    </div>
  );
}
```

---

## 9. PRO FORMA INTEGRATION

### Field Mapping (`server/services/document-parser/proforma-mapper.ts`)

```typescript
// Maps extraction schema keys → Vantage Pro Forma field keys
export const PL_TO_PROFORMA_MAP: Record<string, string> = {
  'gross_potential_rent': 'income.gross_potential_rent',
  'vacancy_loss': 'income.vacancy_credit',
  'effective_gross_income': 'income.effective_gross_income',
  'parking_income': 'income.other.parking',
  'laundry_income': 'income.other.laundry',
  'total_other_income': 'income.other_income_total',
  'total_revenue': 'income.total_revenue',
  'management_fees': 'expenses.management',
  'payroll': 'expenses.payroll',
  'repairs_maintenance': 'expenses.repairs_maintenance',
  'utilities': 'expenses.utilities',
  'insurance': 'expenses.insurance',
  'real_estate_taxes': 'expenses.real_estate_taxes',
  'reserves': 'expenses.reserves',
  'total_operating_expenses': 'expenses.total_opex',
  'net_operating_income': 'summary.noi',
};

export const RENT_ROLL_TO_PROFORMA_MAP: Record<string, string> = {
  'total_units': 'property.total_units',
  'occupancy_rate': 'property.current_occupancy',
  'total_actual_rent': 'income.gross_potential_rent',
  // Unit mix maps to: unit_mix.{type}.count, unit_mix.{type}.avg_rent, etc.
};
```

---

## 10. BUILD ORDER FOR REPLIT AGENT

Execute in this exact sequence. Commit after each step.

```
PHASE 1 — DATABASE (Day 1)
□ 1.1  Add uuid, multer to package.json
□ 1.2  Create /tmp/vantage-doc-uploads directory
□ 1.3  Execute CREATE TABLE statements for document_extraction_jobs, extraction_fields, extraction_templates
□ 1.4  Verify tables exist with pool.query()

PHASE 2 — PARSER PIPELINE (Day 1–2)
□ 2.1  Install: xlsx, pdf2json, tesseract.js, sharp, react-dropzone, react-pdf
□ 2.2  Create server/services/document-parser/ directory
□ 2.3  Build file-router.ts (multer config + file type detection)
□ 2.4  Build pdf-extractor.ts (text extraction + geometry table detection)
□ 2.5  Build excel-extractor.ts (SheetJS multi-sheet parser)
□ 2.6  Write unit tests: upload sample PDF → verify text extracted
□ 2.7  Write unit tests: upload sample XLSX → verify sheets and rows parsed

PHASE 3 — CLAUDE EXTRACTOR (Day 2)
□ 3.1  Create shared/extraction-schemas.ts (PLExtractionSchema, RentRollExtractionSchema)
□ 3.2  Build claude-extractor.ts (classifyDocument, extractPL, extractRentRoll)
□ 3.3  Build proforma-mapper.ts (field key maps)
□ 3.4  Build flattenExtractionResult() utility
□ 3.5  Test with sample P&L PDF → verify JSON output and field coverage
□ 3.6  Test with sample rent roll XLSX → verify all unit rows captured

PHASE 4 — API ROUTES (Day 2–3)
□ 4.1  Build document-extraction.ts routes file
□ 4.2  Register router in server/index.ts: app.use('/api/v1/document-extraction', ...)
□ 4.3  Implement processDocument() async pipeline
□ 4.4  Implement saveExtractionFields() with confidence mapping
□ 4.5  Test full upload → parse → extract → save flow via curl/Postman
□ 4.6  Restart Express server and verify routes respond

PHASE 5 — FRONTEND (Day 3–4)
□ 5.1  Create client/src/pages/document-intelligence/ directory
□ 5.2  Build DocumentUploader.tsx with react-dropzone
□ 5.3  Build ExtractionStatusPoller.tsx with polling logic
□ 5.4  Build ExtractionReview.tsx with field groups and edit UI
□ 5.5  Build DocumentIntelligencePage.tsx as main page
□ 5.6  Add route to router: /document-intelligence
□ 5.7  Add nav link in sidebar under "Tools" or "Analysis"

PHASE 6 — PRO FORMA INTEGRATION (Day 4–5)
□ 6.1  Build populate-proforma endpoint
□ 6.2  On Pro Forma page: detect from_extraction query param
□ 6.3  If present: show banner "X fields pre-populated from [filename]"
□ 6.4  Highlight pre-populated cells in Pro Forma with blue border + source tooltip
□ 6.5  Allow user to clear extraction and restore manual entry

PHASE 7 — POLISH (Day 5)
□ 7.1  Extraction history page: list past jobs by project
□ 7.2  Re-extraction: re-run Claude on same document
□ 7.3  Template save: save column mappings for recurring document formats
□ 7.4  Export: download extracted fields as CSV
□ 7.5  Rent roll: visual unit mix chart (bar chart of unit type counts)
□ 7.6  Error handling: graceful UI for failed extractions with retry
```

---

## 11. SAMPLE CLAUDE PROMPTS BY DOCUMENT TYPE

These are the exact prompt structures to use. Tune field hints based on real documents.

### P&L — Common Hint Additions
```
Additional hints for P&L documents:
- "Total Revenue" or "EGI" or "Gross Revenue" → effective_gross_income
- "NOI" or "Net Operating Income" is typically the bottom line before debt service
- Look for "Other Income" section — parse each line item individually
- Watch for parentheses indicating losses: "(50,000)" = -50000 → store as 50000
- T-12 documents have 12 monthly columns — extract all and sum for annual
- Percentage columns (vacancy rate, management %) → store as decimals (0.05 = 5%)
```

### Rent Roll — Common Hint Additions
```
Additional hints for Rent Roll documents:
- First row after headers is usually unit 101 or A1 — do not skip it
- "MTM" = month-to-month lease — set lease_end to null
- "VACANT" or empty tenant name = vacant unit
- Market Rent vs Contract Rent: market is asking, contract is what tenant pays
- Some rolls show only occupied units — infer vacant count from total units
- Square footage may be in a "SF" column or in the unit type label ("850SF")
- Deposits column may be labeled "Sec Dep" or "SD"
```

---

## 12. KNOWN EDGE CASES TO HANDLE

| Edge Case | Handling |
|---|---|
| Multi-year P&L (2022, 2023, 2024 columns) | Extract each year as separate period_label; let user select which year |
| Consolidated P&L (multiple properties) | Detect "Total" row; flag in extraction_notes; ask user to confirm |
| Scanned/image PDF (0 text layer) | Tesseract OCR fallback; lower confidence scores |
| Excel with merged cells | SheetJS unmerge on read; fill down values |
| Rent roll with 500+ units | Chunk into 200-unit batches; parallel Claude calls; merge results |
| Negative numbers in parentheses | Regex: `\([\d,]+\)` → strip parens, negate |
| Mixed currencies | Flag in extraction_notes; default to USD |
| Password-protected PDF | Catch decrypt error; return user-friendly message |
| CSV with no headers | Auto-detect headers from first row pattern |
| Excel with formula cells | SheetJS evaluates formulas on read — use computed values |

---

## 13. ENTITLEMENT GATING (Vantage Billing)

Map Document Intelligence to existing tier structure:

```typescript
// Entitlement keys to add to billing config
export const DOC_INTEL_ENTITLEMENTS = {
  'doc_intel:enabled': {
    analyst: false,      // $99/mo — no access
    professional: true,  // $299/mo — enabled
    enterprise: true,    // $999/mo — enabled
    institutional: true, // $2500/mo — enabled
  },
  'doc_intel:monthly_uploads': {
    analyst: 0,
    professional: 25,
    enterprise: 100,
    institutional: 500,
  },
  'doc_intel:rent_roll_units_max': {
    analyst: 0,
    professional: 200,    // 200 units per rent roll
    enterprise: 1000,
    institutional: -1,    // unlimited
  }
};
```

Add upload count tracking to document_extraction_jobs and enforce limits in the upload route.

---

## 14. ENVIRONMENT VARIABLES REQUIRED

```bash
# Already present in Vantage
ANTHROPIC_API_KEY=sk-ant-...

# No additional env vars needed — uses existing DB connection
```

---

## 15. TESTING CHECKLIST

Before marking any phase complete, verify:

```
PDF Tests:
□ Native text PDF (bank-statement style) → extracts all line items
□ Scanned PDF (image only) → OCR fallback runs, text extracted
□ Multi-page P&L (5+ pages) → all pages combined, no truncation
□ T-12 (12 monthly columns) → monthly_breakdown populated
□ Password-protected PDF → error message returned, job marked failed

Excel Tests:
□ Single-sheet rent roll → all units extracted
□ Multi-sheet workbook → correct sheet auto-selected
□ Excel with merged header cells → unmerged correctly
□ CSV rent roll → parsed as flat table
□ Excel P&L with formula cells → computed values used

Claude Extraction Tests:
□ P&L: NOI matches (EGI - Total OpEx) within 1%
□ P&L: Vacancy loss correctly identified (not double-counted in expenses)
□ Rent Roll: Occupied unit count + vacant count = total units
□ Rent Roll: Unit mix summary matches individual unit counts
□ Classification: P&L file → document_class = 'pl'
□ Classification: Rent roll → document_class = 'rent_roll'

API Tests:
□ Upload → 200 response with jobId
□ Status polling → transitions through pending → parsing → extracting → review_required
□ Fields endpoint → returns all fields with confidence scores
□ Field override → override_value saved, is_manually_overridden = true
□ Confirm-all → only high/medium confidence fields confirmed
□ Populate Pro Forma → scenario config updated with extracted values
```

---

*End of Specification — Version 1.0*
*This document is ready for direct execution by Replit AI Agent.*

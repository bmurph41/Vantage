# MarinaMatch — P&L Parser v2

## Overview

The P&L Parser v2 extracts financial statement data from uploaded PDFs and Excel files
and maps them to the canonical MarinaMatch chart of accounts. It feeds the Pro Forma
and Historical P&L modules.

---

## Architecture

```
File Upload (PDF or Excel)
      ↓
Extraction Engine
  PDF → pdfjs-dist (geometry-based, not text-order)
  Excel → xlsx / SheetJS
      ↓
Raw Line Items
      ↓
Category Classifier
  Normalize → Alias lookup → Confidence scoring
      ↓
Validation (6 checks)
      ↓
Structured P&L Output
      ↓
Pro Forma / Historical P&L ingestion
```

---

## PDF Extraction: pdfjs-dist Geometry-Based

**Critical:** MarinaMatch uses geometry-based extraction, NOT text-order extraction.
PDFs render financial statements with inconsistent text flow — geometry-based extraction
reads columns by their X/Y coordinates, not the order text appears in the PDF stream.

```typescript
import * as pdfjsLib from 'pdfjs-dist';

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

async function extractPDFItems(buffer: ArrayBuffer): Promise<TextItem[]> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allItems: TextItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    textContent.items.forEach((item: any) => {
      const transform = item.transform;
      allItems.push({
        str: item.str,
        x: transform[4],
        y: viewport.height - transform[5],  // flip Y axis
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        fontSize: Math.abs(transform[0])
      });
    });
  }

  return allItems;
}
```

### Column Detection
```typescript
function detectColumns(items: TextItem[]): Column[] {
  // Cluster items by X coordinate (±10px tolerance)
  // Identify label column (leftmost) vs value columns (right side)
  // Handle multi-column P&Ls (multiple years side by side)
}

function groupIntoRows(items: TextItem[], yTolerance = 3): Row[] {
  // Cluster items with similar Y coordinates into rows
  // Sort each row left-to-right by X coordinate
}
```

---

## Category Classifier

### Normalization (Applied First)
```typescript
function normalizeCategory(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')               // collapse whitespace
    .replace(/[^a-z0-9 &\/\-]/g, '')    // remove special chars except common ones
    .replace(/\s*&\s*/g, ' and ');      // normalize ampersands
}

// Examples:
// "  Gross Revenue  " → "gross revenue"
// "G&A Expenses" → "g and a expenses"
// "Net Oper. Income" → "net oper income"
```

### Alias Table
The alias table maps common P&L line item names to canonical categories.
Stored in the database, not hardcoded, so aliases can be learned.

```typescript
interface AliasEntry {
  id: string;
  rawAlias: string;       // normalized input string
  canonicalCategory: string;
  confidence: number;     // 0.0–1.0 (weight-based, increases with usage)
  orgId: string | null;   // null = global alias
  usageCount: number;
  createdAt: Date;
}

// Alias lookup
async function lookupAlias(normalized: string, orgId: string): Promise<AliasEntry | null> {
  const result = await pool.query(
    `SELECT * FROM pl_aliases
     WHERE raw_alias = $1 AND (org_id = $2 OR org_id IS NULL)
     ORDER BY confidence DESC, usage_count DESC
     LIMIT 1`,
    [normalized, orgId]
  );
  return result.rows[0] ?? null;
}
```

### Confidence Scoring (Weight-Based)
```typescript
// When a classification is confirmed by the user:
async function reinforceAlias(aliasId: string): Promise<void> {
  await pool.query(
    `UPDATE pl_aliases
     SET usage_count = usage_count + 1,
         confidence = LEAST(1.0, confidence + 0.05)
     WHERE id = $1`,
    [aliasId]
  );
}

// When a classification is rejected/corrected:
async function penalizeAlias(aliasId: string, correctCategory: string): Promise<void> {
  await pool.query(
    `UPDATE pl_aliases
     SET confidence = GREATEST(0.0, confidence - 0.1)
     WHERE id = $1`,
    [aliasId]
  );
  // Also create new alias entry for the correct mapping
}
```

---

## Canonical Chart of Accounts

All P&L line items must map to one of these canonical categories:

```typescript
const CANONICAL_CATEGORIES = {
  // Revenue
  GROSS_REVENUE: 'gross_revenue',
  VACANCY_LOSS: 'vacancy_loss',
  CREDIT_LOSS: 'credit_loss',
  EFFECTIVE_GROSS_REVENUE: 'effective_gross_revenue',

  // Operating Expenses
  PROPERTY_MANAGEMENT: 'property_management',
  MAINTENANCE_REPAIRS: 'maintenance_repairs',
  UTILITIES: 'utilities',
  INSURANCE: 'insurance',
  PROPERTY_TAXES: 'property_taxes',
  PAYROLL: 'payroll',
  MARKETING: 'marketing',
  ADMINISTRATIVE: 'administrative',
  PROFESSIONAL_FEES: 'professional_fees',
  RESERVES: 'reserves',
  OTHER_OPERATING: 'other_operating',

  // Results
  TOTAL_OPERATING_EXPENSES: 'total_operating_expenses',
  NET_OPERATING_INCOME: 'net_operating_income',

  // Below-the-line
  DEBT_SERVICE: 'debt_service',
  DEPRECIATION: 'depreciation',
  AMORTIZATION: 'amortization',
  INCOME_TAX: 'income_tax',
  NET_INCOME: 'net_income',
} as const;
```

### Category Normalization Fix (Critical)
A prior bug caused NOI to be corrupted when category names contained lowercase
or variant spellings. The fix:

```typescript
// WRONG — was happening before fix
if (category === 'Net Operating Income') { ... }   // missed lowercase variants

// CORRECT — always normalize before comparison
const normalized = normalizeCategory(rawCategory);
if (normalized === 'net operating income' ||
    normalized === 'noi' ||
    normalized === 'net oper income') {
  category = CANONICAL_CATEGORIES.NET_OPERATING_INCOME;
}
```

**Never compare raw category strings. Always normalize first.**

---

## Six Validation Checks

After extraction and classification, run all six checks before accepting output:

```typescript
interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

const VALIDATION_CHECKS = [
  // Check 1: Revenue reconciliation
  // effective_gross_revenue = gross_revenue - vacancy_loss - credit_loss
  // Tolerance: ±1%

  // Check 2: Expense totals
  // total_operating_expenses = sum of all expense line items
  // Tolerance: ±$100

  // Check 3: NOI reconciliation
  // net_operating_income = effective_gross_revenue - total_operating_expenses
  // Tolerance: ±$100

  // Check 4: Sign conventions
  // All revenue items must be positive
  // All expense items must be positive (stored as positive, subtracted in calc)
  // NOI can be negative (distressed property)

  // Check 5: Reasonableness
  // Expense ratio between 20%–85% of EGR (warning outside range)
  // Cap rate implied by NOI between 2%–20% (warning outside range)

  // Check 6: Required fields present
  // Must have: gross_revenue, net_operating_income
  // Warning if missing: vacancy_loss, property_taxes, insurance
];
```

---

## PLModeToggle Integration

The parser feeds into PLModeToggle's three modes:

```typescript
type PLMode = 'uploaded' | 'direct' | 'hybrid';

// uploaded: parser output is used directly as Pro Forma base
// direct: user manually enters all line items (no parser)
// hybrid: parser output as base, user can override specific lines
```

In `hybrid` mode, track which lines have been manually overridden:
```typescript
interface HybridLineItem {
  canonicalCategory: string;
  parsedValue: number;        // from parser
  overriddenValue?: number;   // manually entered by user
  isOverridden: boolean;
  source: 'parsed' | 'manual';
}
```

---

## Excel/XLSX Extraction

For Excel uploads, use SheetJS:

```typescript
import * as XLSX from 'xlsx';

function extractFromExcel(buffer: ArrayBuffer): RawLineItem[] {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Try common P&L sheet names
  const sheetName =
    workbook.SheetNames.find(name =>
      /p&l|profit|loss|income|operating/i.test(name)
    ) ?? workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Find the header row, then extract label/value pairs
  return parseExcelRows(rows);
}
```

---

## DB Tables

```sql
-- Alias table for category learning
CREATE TABLE pl_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,              -- NULL = global alias
  raw_alias VARCHAR(500) NOT NULL,
  canonical_category VARCHAR(100) NOT NULL,
  confidence DECIMAL(4, 3) DEFAULT 0.8,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pl_aliases_raw ON pl_aliases(raw_alias);
CREATE INDEX idx_pl_aliases_org ON pl_aliases(org_id);

-- Parsed P&L records
CREATE TABLE pl_parsed_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID,
  source_file_name VARCHAR(500),
  source_type VARCHAR(20),      -- 'pdf' | 'xlsx'
  parsed_data JSONB NOT NULL,
  validation_results JSONB,
  pl_mode VARCHAR(20) DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

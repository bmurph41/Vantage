# P&L Ingestion Pipeline

## Overview

The P&L ingestion pipeline provides automated extraction, classification, and aggregation of Profit & Loss statements for marina businesses. The system supports multiple document formats (PDF, Excel, CSV) and includes a human-in-the-loop review workflow for low-confidence line items.

## Architecture

```
Document Upload → OCR/Parsing → Period Detection → Line Item Classification → Review Queue → Fact Storage
                      ↓                                      ↓
                 OCR Providers                         LLM Classifiers
              (local/Veryfi/Affinda)              (OpenAI/Anthropic/mock)
```

## Environment Variables

### OCR Configuration
- `OCR_PROVIDER`: OCR provider to use (`local`, `veryfi`, `affinda`). Default: `local`
- `OCR_API_KEY`: API key for external OCR providers
- `VERYFI_CLIENT_ID`: Veryfi client ID (if using Veryfi)
- `VERYFI_USERNAME`: Veryfi username (if using Veryfi)

### LLM Configuration
- `LLM_PROVIDER`: LLM provider for line item classification (`openai`, `anthropic`, `mock`, `none`). Default: `mock`
- `LLM_API_KEY`: API key for LLM provider (falls back to `OPENAI_API_KEY`)
- `LLM_MODEL`: Specific model to use (e.g., `gpt-4o-mini`, `claude-3-haiku-20240307`)
- `ANTHROPIC_API_KEY`: Anthropic API key (if using Anthropic)

### File Upload
- `UPLOAD_DIR`: Directory for uploaded files. Default: `./uploads/pnl`
- `MAX_UPLOAD_MB`: Maximum file size in MB. Default: `100`

## API Endpoints

### Document Management
- `POST /api/pnl/upload` - Upload a P&L document
- `GET /api/pnl/documents` - List all P&L documents for the organization
- `GET /api/pnl/documents/:documentId` - Get document details with jobs and stats

### Job Management
- `GET /api/pnl/jobs/:jobId` - Get job status and review needs count
- `GET /api/pnl/jobs/:jobId/parsed` - Get parsed statement JSON
- `GET /api/pnl/jobs/:jobId/review` - Get review items for a job
- `POST /api/pnl/jobs/:jobId/remap` - Remap a line item and learn from correction

### Statement Management
- `GET /api/pnl/statements/:statementId/lines` - Get statement lines with grouping options
- `POST /api/pnl/statements/:statementId/approve` - Approve statement for modeling

### Marina Aggregation
- `GET /api/pnl/marina/:marinaId` - Get aggregated P&L for a marina
- `GET /api/pnl/marina/:marinaId/time-series` - Get P&L time series data
- `GET /api/pnl/marina/:marinaId/comparison` - Year-over-year comparison

### Chart of Accounts
- `GET /api/pnl/canonical-items` - List canonical line items
- `POST /api/pnl/canonical-items/seed` - Seed basic canonical items
- `POST /api/pnl/canonical-items/seed-marina` - Seed marina-specific COA

### Keyword Bank
- `GET /api/pnl/keyword-bank` - List keyword rules
- `POST /api/pnl/keyword-bank` - Create a keyword rule
- `PATCH /api/pnl/keyword-bank/:ruleId` - Update a keyword rule
- `DELETE /api/pnl/keyword-bank/:ruleId` - Delete a keyword rule
- `POST /api/pnl/keyword-bank/import` - Import keyword bank from Excel
- `POST /api/pnl/keyword-bank/seed-default` - Seed from default Excel file

### Facts
- `GET /api/pnl/facts` - Query stored P&L facts with filters

## Seeding COA and Aliases

### Seed Marina-Specific Chart of Accounts

```typescript
// Via API
POST /api/pnl/canonical-items/seed-marina

// Programmatically
import { seedMarinaCoa } from './server/scripts/seedMarinaCoa';
await seedMarinaCoa(orgId);
```

This seeds 80+ marina-specific line items across departments:
- **Storage**: Wet slips, dry storage, transient dockage, live-aboard
- **Fuel**: Gas and diesel sales
- **Service**: Repairs, labor, detailing, winterization
- **Marina & Amenities**: Launch/haul, electric, water, pump-out
- **Ship's Store**: Merchandise, parts, bait & tackle
- **Boat Sales/Brokerage**: New/used boat sales, commissions
- **Payroll**: By role (dock staff, technicians, admin)
- **Expenses**: Insurance, taxes, utilities, R&M, marketing, professional fees

### Import Keyword Bank

```typescript
// Via API - from file upload
POST /api/pnl/keyword-bank/import (multipart/form-data with Excel file)

// Via API - from default file
POST /api/pnl/keyword-bank/seed-default
```

## Using the Aggregation Helper

The aggregation service provides ready-to-use helpers for dashboards and modeling:

```typescript
import { getPnlForMarina, getPnlTimeSeries, getPnlComparisonYoY } from './server/services/pnl/aggregationService';

// Get aggregated P&L for a marina
const result = await getPnlForMarina(orgId, marinaId, {
  from: new Date('2024-01-01'),
  to: new Date('2024-12-31'),
  periodType: 'month',
});

console.log(result.summary);
// {
//   totalRevenue: 1500000,
//   totalCogs: 300000,
//   grossProfit: 1200000,
//   grossMargin: 80,
//   totalExpense: 400000,
//   totalPayroll: 200000,
//   operatingExpense: 600000,
//   noi: 600000,
//   noiMargin: 40,
//   ebitda: 600000,
//   ebitdaMargin: 40,
// }

// Get time series for charting
const timeSeries = await getPnlTimeSeries(orgId, marinaId, {
  fiscalYears: [2023, 2024],
  periodType: 'month',
});

// Get year-over-year comparison
const comparison = await getPnlComparisonYoY(orgId, marinaId, {
  baseYear: 2023,
  compareYear: 2024,
  periodType: 'year',
});
```

## Classification Pipeline

The mapping pipeline attempts classification in this order:
1. **Alias Match**: Exact match against learned aliases
2. **Regex Match**: Pattern matching from alias regexes
3. **Keyword Match**: Token/phrase matching from keyword bank
4. **Canonical Match**: Fuzzy matching against canonical item names
5. **LLM Classification**: AI-powered classification (when enabled)

Items with confidence below 0.75 are queued for human review.

## Extending for Other Asset Classes

The P&L system is designed to be asset-class agnostic. To add support for multifamily, retail, hotels, etc.:

1. Create a new COA seed file (e.g., `seedMultifamilyCoa.ts`)
2. Define asset-class-specific departments and line items
3. Add keyword rules for common line item labels
4. The aggregation service works with any canonical line items

```typescript
// Example: Multifamily COA seed item
{
  canonicalKey: 'revenue.rental.gross_potential',
  displayName: 'Gross Potential Rent',
  department: 'Rental',
  section: 'revenue',
  sortOrder: 100,
  keywords: ['gross potential', 'gpr', 'gross rent'],
}
```

## Database Tables

- `pnl_documents`: Uploaded documents with SHA256 deduplication
- `pnl_jobs`: Processing jobs with status tracking
- `pnl_parsed_statements`: Parsed JSON with periods and rows
- `pnl_canonical_line_items`: Chart of Accounts categories
- `pnl_line_item_aliases`: Learned mappings from user corrections
- `pnl_facts`: Stored financial facts with full provenance
- `pnl_review_items`: Queue for human review of low-confidence items
- `pnl_keyword_rules`: Keyword bank for classification rules

# MarinaMatch — Marketplace & Sourced Deals

## Overview

The Marketplace is a curated feed of scraped and imported CRE listings that users
can browse, filter, and push directly into the CRM pipeline. It is distinct from
the Marina Map (which is analytical/geo) — the Marketplace is transactional/deal-sourcing.

---

## Component: MarketplaceListings.tsx

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  Source Health Strip (top bar)                               │
│  [LoopNet ✓] [CoStar ✓] [Crexi ✓] [BizBuySell ✓] [Manual ✓]│
├──────────────────┬───────────────────────────────────────────┤
│  Filter Sidebar  │  Listings Area                            │
│  (~260px)        │                                           │
│                  │  [View Mode Toggle: Grid / List / Map]    │
│  Asset Class     │                                           │
│  Price Range     │  [Grid View]                              │
│  Cap Rate        │  ┌─────┐ ┌─────┐ ┌─────┐                │
│  State/Region    │  │Card │ │Card │ │Card │                  │
│  Status          │  └─────┘ └─────┘ └─────┘                │
│  Source          │                                           │
│  Date Added      │  [List View]                              │
│                  │  Row-based table with sortable columns    │
│  [Apply Filters] │                                           │
│  [Reset]         │  [Map View]                               │
│                  │  Embedded map with listing pins           │
└──────────────────┴───────────────────────────────────────────┘
```

### Three View Modes
```typescript
type ViewMode = 'grid' | 'list' | 'map';
```

### Listing Card (Grid View)
```typescript
interface ListingCardProps {
  listing: SourcedDeal;
  onAddToPipeline: (listingId: string) => void;
  onSave: (listingId: string) => void;
  onViewDetails: (listingId: string) => void;
}
// Shows: property photo, name, location, price, cap rate, NOI, source badge, grade
```

---

## Database Table: sourced_deals

```sql
CREATE TABLE sourced_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,                    -- NULL = global/public listing
  external_id VARCHAR(255),       -- ID from source platform
  source VARCHAR(100) NOT NULL,   -- 'loopnet' | 'costar' | 'crexi' | 'bizbuysell' | 'manual'
  source_url TEXT,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  asset_class VARCHAR(100),
  asking_price DECIMAL(15, 2),
  price_per_unit DECIMAL(12, 2),
  price_per_sf DECIMAL(10, 2),
  noi_annual DECIMAL(15, 2),
  cap_rate DECIMAL(5, 4),
  gross_revenue DECIMAL(15, 2),
  total_units INTEGER,
  total_sf INTEGER,
  year_built INTEGER,
  listing_status VARCHAR(50) DEFAULT 'active',  -- active | under_contract | sold | expired
  images JSONB DEFAULT '[]',
  raw_data JSONB DEFAULT '{}',    -- full scraped payload preserved
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sourced_deals_org ON sourced_deals(org_id);
CREATE INDEX idx_sourced_deals_source ON sourced_deals(source);
CREATE INDEX idx_sourced_deals_asset_class ON sourced_deals(asset_class);
CREATE INDEX idx_sourced_deals_status ON sourced_deals(listing_status);
```

---

## Add to Pipeline Modal

Maps a `sourced_deal` record to a new CRM deal in `/api/marinamatch/sourced-deals`.

### Modal Fields
```typescript
interface AddToPipelineForm {
  dealName: string;         // pre-filled from listing title
  pipelineId: string;       // select from org's pipelines
  stageId: string;          // select from pipeline stages
  assignedTo: string;       // user select
  estimatedValue: number;   // pre-filled from asking_price
  notes: string;            // optional initial note
}
```

### Pipeline Mapping Logic
```typescript
// POST /api/marinamatch/sourced-deals/:id/add-to-pipeline
async function addToPipeline(
  sourcedDealId: string,
  form: AddToPipelineForm,
  orgId: string,
  userId: string
) {
  // 1. Fetch the sourced deal
  const dealResult = await pool.query(
    `SELECT * FROM sourced_deals WHERE id = $1`,
    [sourcedDealId]
  );
  const sourcedDeal = dealResult.rows[0];

  // 2. Create CRM deal — use pool.query (pipeline tables are RLS-affected)
  const crmDeal = await pool.query(
    `INSERT INTO crm_deals
     (org_id, name, stage_id, deal_value, assigned_to, source_listing_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [orgId, form.dealName, form.stageId, form.estimatedValue,
     form.assignedTo, sourcedDealId, userId]
  );

  // 3. Log activity
  await pool.query(
    `INSERT INTO crm_activities
     (org_id, entity_type, entity_id, activity_type, description, created_by)
     VALUES ($1, 'deal', $2, 'deal_created', $3, $4)`,
    [orgId, crmDeal.rows[0].id,
     `Deal created from ${sourcedDeal.source} listing: ${sourcedDeal.title}`,
     userId]
  );

  // 4. Fire workflow trigger
  await evaluateRules({
    type: 'deal_created',
    orgId, userId,
    entityType: 'deal',
    entityId: crmDeal.rows[0].id,
    data: { entity: crmDeal.rows[0] },
    timestamp: new Date()
  });

  return crmDeal.rows[0];
}
```

---

## Source Health Strip

Shows real-time status of each data source:

```typescript
interface SourceHealth {
  source: string;
  status: 'active' | 'degraded' | 'down';
  lastScraped: Date;
  listingCount: number;
  newToday: number;
}

// Display in top strip:
// [LoopNet ● 1,243 listings · 12 new today]
// [CoStar ● 847 listings · 6 new today]
// [Crexi ● 2,104 listings · 31 new today]
```

---

## Filter State

```typescript
interface MarketplaceFilters {
  assetClasses: string[];
  priceMin?: number;
  priceMax?: number;
  capRateMin?: number;
  capRateMax?: number;
  states: string[];
  sources: string[];
  status: 'active' | 'all' | 'under_contract';
  dateAddedDays?: number;   // last N days
  searchQuery?: string;
}
```

---

## API Routes

```typescript
// List sourced deals (main marketplace feed)
GET  /api/marinamatch/sourced-deals
     ?assetClass=marina&priceMin=1000000&state=FL&source=loopnet&limit=50&offset=0

// Get single listing detail
GET  /api/marinamatch/sourced-deals/:id

// Add to CRM pipeline
POST /api/marinamatch/sourced-deals/:id/add-to-pipeline

// Save/bookmark a listing
POST /api/marinamatch/sourced-deals/:id/save
DELETE /api/marinamatch/sourced-deals/:id/save

// Manual listing entry
POST /api/marinamatch/sourced-deals
PUT  /api/marinamatch/sourced-deals/:id
DELETE /api/marinamatch/sourced-deals/:id

// Source health status
GET  /api/marinamatch/sourced-deals/source-health
```

---

## Saved Listings

```sql
CREATE TABLE saved_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sourced_deal_id UUID NOT NULL REFERENCES sourced_deals(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sourced_deal_id)
);
```

---

## Scraper Integration Notes

- Raw scraped payload always preserved in `raw_data` JSONB column
- `external_id` + `source` combination must be unique (upsert on scrape)
- Images stored as array of URLs in `images` JSONB
- `scraped_at` tracks freshness — listings older than 30 days flagged stale

```typescript
// Upsert pattern for scraper ingestion
await pool.query(
  `INSERT INTO sourced_deals (external_id, source, title, ...)
   VALUES ($1, $2, $3, ...)
   ON CONFLICT (external_id, source)
   DO UPDATE SET
     title = EXCLUDED.title,
     asking_price = EXCLUDED.asking_price,
     listing_status = EXCLUDED.listing_status,
     raw_data = EXCLUDED.raw_data,
     scraped_at = NOW(),
     updated_at = NOW()`,
  [externalId, source, title, ...]
);
```

# Multi-Asset-Class Property Data Framework
# Admin Configuration Panel & Data Ingestion Blueprint

## Overview

This blueprint extends the existing Marinalytics platform (marina-centric) into a
multi-asset-class investment intelligence platform supporting:

- Single Family Home (SFR) Rentals
- Duplex Rentals
- Triplex Rentals
- Quadplex Rentals
- Multifamily Rentals (5+ units)
- Short-Term Rentals (Airbnb / VRBO)
- Marinas (existing)

External data is sourced from Zillow Bridge API, Redfin, and MLS (RESO Web API).
These are **admin-managed** (platform-level) connections — individual users do NOT
configure API keys. The admin/founder manages all provider credentials, and data
flows automatically to all users filtered by their asset class preferences.

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────────┐
│                    ADMIN PANEL                           │
│  ┌─────────────────┐  ┌──────────────────────────────┐   │
│  │ Asset Class Mgr  │  │ Data Sources Config          │   │
│  │ Enable/disable   │  │ Zillow / Redfin / MLS creds  │   │
│  │ per-class config │  │ Sync freq, field mappings    │   │
│  └─────────────────┘  │ Test connection, logs         │   │
│                        └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│              PROPERTY DATA SERVICE                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Zillow     │  │ Redfin     │  │ MLS/RESO           │  │
│  │ Adapter    │  │ Adapter    │  │ Adapter             │  │
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘  │
│        └───────────────┼────────────────────┘             │
│                        ▼                                  │
│           property_data_cache (normalized)                │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│              CROSS-MODULE CONSUMPTION                    │
│  CRM (auto-populate) │ SalesComps (import comps)         │
│  Modeling (market rents, cap rates)                       │
│  Demographics (neighborhood data)                        │
└──────────────────────────────────────────────────────────┘
```

---

## File Manifest

### Phase 1 — Schema (`schema/`)
- `property-data-schema.ts` — All new DB tables, enums, insert/select types
  - `platform_asset_class_enum`
  - `platform_asset_classes` table
  - `data_source_provider_type_enum`, `data_source_status_enum`
  - `platform_data_sources` table
  - `platform_data_source_mappings` table
  - `property_data_cache` table
  - `data_source_sync_logs` table

### Phase 2 — Admin UI (`client/pages/admin/`)
- `DataSourcesAdmin.tsx` — Full admin page for managing Zillow/Redfin/MLS
- `AssetClassManager.tsx` — Enable/disable asset classes, per-class config

### Phase 3 — Backend Services (`server/services/`)
- `property-data-service.ts` — Core orchestrator with adapter pattern
- `data-adapters/types.ts` — Shared adapter interface
- `data-adapters/zillow-adapter.ts` — Zillow Bridge API adapter
- `data-adapters/redfin-adapter.ts` — Redfin data adapter
- `data-adapters/mls-reso-adapter.ts` — RESO Web API / MLS adapter
- `property-data-cron.ts` — Scheduled sync jobs

### Phase 4 — API Routes (`server/routes/`)
- `property-data-routes.ts` — Admin + user-facing API endpoints

### Documentation (`docs/`)
- `IMPLEMENTATION_GUIDE.md` — This file
- `INTEGRATION_NOTES.md` — Provider-specific API notes, rate limits, auth flows

---

## Integration into Existing Codebase

### Schema
Add the contents of `schema/property-data-schema.ts` to `shared/schema.ts`
(at the end, before any exports). Then run `npx drizzle-kit generate` and
`npx drizzle-kit push` to create the tables.

### Routes
In `server/routes.ts`, add:
```typescript
import { propertyDataRouter } from './routes/property-data-routes';

// Inside registerRoutes():
app.use(authenticateUser, propertyDataRouter);
```

### Admin Pages
Register in `client/src/App.tsx`:
```typescript
import DataSourcesAdmin from './pages/admin/DataSourcesAdmin';
import AssetClassManager from './pages/admin/AssetClassManager';

// In router:
<Route path="/admin/data-sources" component={DataSourcesAdmin} />
<Route path="/admin/asset-classes" component={AssetClassManager} />
```

### Sidebar
Add to `client/src/components/unified-sidebar.tsx` under the Admin section:
```typescript
{ label: "Data Sources", href: "/admin/data-sources", icon: Database },
{ label: "Asset Classes", href: "/admin/asset-classes", icon: Layers },
```

### Cron Jobs
In `server/index.ts` (or wherever cron jobs are initialized):
```typescript
import { initPropertyDataCron } from './services/property-data-cron';
initPropertyDataCron();
```

---

## Environment Variables / Secrets Required

These are admin-managed secrets (set via Replit Secrets or Admin UI):

| Key | Description | Required |
|-----|-------------|----------|
| `ZILLOW_API_KEY` | Zillow Bridge API key (from Zillow partner portal) | For Zillow |
| `REDFIN_API_KEY` | Redfin data access key (if available via partnership) | For Redfin |
| `MLS_RESO_CLIENT_ID` | RESO Web API client ID | For MLS |
| `MLS_RESO_CLIENT_SECRET` | RESO Web API client secret | For MLS |
| `MLS_RESO_TOKEN_URL` | OAuth token endpoint for your MLS board | For MLS |
| `MLS_RESO_API_URL` | RESO Web API base URL | For MLS |

---

## Migration Checklist

1. [ ] Add schema to `shared/schema.ts`
2. [ ] Run `npx drizzle-kit generate` then `npx drizzle-kit push`
3. [ ] Add route registration to `server/routes.ts`
4. [ ] Add admin pages to `client/src/App.tsx`
5. [ ] Add sidebar nav items for admin section
6. [ ] Set environment variables / secrets
7. [ ] Initialize cron jobs
8. [ ] Seed default asset classes via `POST /api/admin/asset-classes/seed`
9. [ ] Configure data sources via Admin UI
10. [ ] Test connections and trigger initial sync

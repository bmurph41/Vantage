# Spec: Dynamic Asset Class Registry

**Task:** Make Asset Classes fully dynamic — DB-driven everywhere
**Tier:** 8 — Platform Infrastructure
**Priority:** High (unblocks multi-vertical expansion)

---

## Problem

There are two disconnected systems:

1. `platformAssetClasses` PostgreSQL table managed via Admin → Asset Classes — the *intended* source of truth
2. A hardcoded `ASSET_CLASS_CONFIGS` / `ASSET_CLASS_OPTIONS` object in `client/src/components/crm/asset-class-fields.tsx` — what the rest of the app *actually* uses

Adding a new asset class via Admin has zero effect on the rest of the app because every CRM form, deal modal, modeling selector, and dropdown reads the hardcoded list, not the DB. Admin routes also have no server-side role enforcement.

---

## Schema Changes

Extend `platformAssetClasses` in `shared/schema.ts` with these fields if not already present:

| Field | Type | Description |
|---|---|---|
| `sizeLabel` | text | What "size" means (e.g. "Slips", "Units", "Sq Ft", "Keys") |
| `occLabel` | text | Occupancy label (e.g. "Slip Occ %", "Occ %", "Leased %") |
| `priceUnit` | text | Denominator for price-per-unit (e.g. "Slip", "Unit", "Sq Ft") |
| `revenueStreams` | jsonb (string[]) | Array of 3 revenue stream label strings |
| `demandKey` | text | Demand metric label for demographics/intel view |
| `group` | text | Sidebar grouping (Waterfront, Hospitality, Residential, Industrial, Office, Retail) |
| `color` | text | Hex color for map markers, charts, badges |

Migration: add columns via `pool.query()` in the seed route (idempotent ALTER TABLE IF NOT EXISTS pattern).

---

## Canonical Asset Registry (36 types)

Seed these via the `/api/admin/asset-classes/seed` endpoint. Must be idempotent (upsert on key conflict).

### Waterfront
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `marina` | Marina | #00d4ff | Slips | Slip Occ % | Slip | Fuel Revenue, Storage Revenue, Service Revenue | Boat Ownership % |
| `dry_stack` | Dry Stack / Boatyard | #06b6d4 | Rack Units | Rack Occ % | Rack | Storage Fees, Launch Fees, Service Revenue | Boat Ownership % |
| `yacht_club` | Yacht Club | #38bdf8 | Slips | Membership Occ | Slip | Membership Dues, Slip Fees, F&B Revenue | HH Boat Ownership % |
| `waterfront_resort` | Waterfront Resort | #0ea5e9 | Keys | Occ % | Key | Room Revenue, Marina Fees, F&B Revenue | Tourism Index |
| `boat_rental` | Boat Rental / Charter | #22d3ee | Vessels | Utilization % | Vessel | Charter Revenue, Rental Revenue, Fuel/Ancillary | Visitor Spend Index |

### Hospitality
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `hotel` | Hotel | #a78bfa | Keys | Occ % / RevPAR | Key | Room Revenue, F&B Revenue, Ancillary | Tourism Index |
| `boutique_hotel` | Boutique Hotel | #8b5cf6 | Keys | Occ % | Key | Room Revenue, F&B Revenue, Events Revenue | ADR vs Market |
| `motel` | Motel / Motor Inn | #c084fc | Keys | Occ % | Key | Room Revenue, Vending, Ancillary | Drive-by Traffic |
| `extended_stay` | Extended Stay | #e879f9 | Units | Occ % | Unit | Weekly Room Rev, Monthly Room Rev, Ancillary | Corporate Demand Idx |
| `rv_park` | RV Park / Campground | #f59e0b | Sites | Occ % | Site | Site Rental, Hook-Ups, Store/Amenity | Snowbird Season % |
| `glamping` | Glamping / Eco-Resort | #fbbf24 | Units | Occ % | Unit | Accommodation Rev, Experience Rev, F&B | Experiential Travel Idx |

### Residential
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `multifamily` | Multifamily | #4ade80 | Units | Occ % | Unit | Rental Revenue, Parking Revenue, Ancillary | Renter Demand Index |
| `garden_apt` | Garden Apartments | #22c55e | Units | Occ % | Unit | Rental Revenue, Laundry/Vend, Storage | Rent Growth YoY % |
| `senior_housing` | Senior Housing | #86efac | Units | Occ % | Unit | Rent/Care Fees, Ancillary Services, Memory Care | 65+ Population % |
| `student_housing` | Student Housing | #bbf7d0 | Beds | Bed Occ % | Bed | Bed Rental, Parking, Amenity Fees | Enrollment Growth % |
| `mobile_home` | Mobile Home Park | #34d399 | Pads | Pad Occ % | Pad | Pad Rent, Utility Fee, Ancillary | Affordable Housing Gap |
| `condo` | Condo / Townhome | #6ee7b7 | Units | Sold / Leased % | Unit | Sale Proceeds, HOA Income, Rental Pool | Median Home Price Idx |
| `sfr` | SFR Portfolio | #a7f3d0 | Homes | Occ % | Home | Rental Revenue, Pet Fees, Late/Other | SFR Rent Growth % |

### Industrial
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `industrial` | Industrial / Flex | #fb923c | Sq Ft | Leased % | Sq Ft | NNN Rent, Reimbursements, Other Income | Industrial Vacancy % |
| `warehouse` | Warehouse / Distribution | #f97316 | Sq Ft | Leased % | Sq Ft | Base Rent, NNN Reimb, Other | Port Proximity Score |
| `cold_storage` | Cold Storage | #fed7aa | Sq Ft | Leased % | Sq Ft | Storage Fees, Handling Fees, Ancillary | Food Logistics Demand |
| `self_storage` | Self Storage | #facc15 | Units | Occ % | Unit | Storage Revenue, Insurance, Truck Rental | Storage Units / 1K Pop |
| `data_center` | Data Center | #fde68a | MW / Cabinets | Power Util % | Cabinet | Colocation Rev, Power Revenue, Managed Svcs | Cloud Demand Index |
| `truck_terminal` | Truck Terminal / Logistics | #fbbf24 | Doors / Acres | Utilization % | Door | Docking Fees, Storage, Cross-Dock | Freight Traffic Index |

### Office
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `office` | Office | #60a5fa | Sq Ft | Leased % | Sq Ft | Base Rent, Parking, Ancillary | Office Absorption Rate |
| `medical_office` | Medical Office | #93c5fd | Sq Ft | Leased % | Sq Ft | NNN Rent, Reimb, Parking | Healthcare Demand Idx |
| `coworking` | Co-working / Flex Office | #bfdbfe | Desks / Offices | Util % | Desk | Membership Rev, Private Office, Meeting Rooms | Remote Work Penetration |
| `creative_office` | Creative / Loft Office | #dbeafe | Sq Ft | Leased % | Sq Ft | Base Rent, Event Space, Parking | Creative Sector Jobs % |

### Retail
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `retail` | Retail Strip | #f472b6 | Sq Ft | Leased % | Sq Ft | Base Rent, NNN Reimb, Overage Rent | Retail Sales PSF |
| `anchored_retail` | Anchored Shopping Ctr | #f9a8d4 | Sq Ft | Leased % | Sq Ft | Anchor Rent, Inline Rent, NNN Reimb | Trade Area Population |
| `nnn_single_tenant` | NNN Single Tenant | #fbcfe8 | Sq Ft | Lease Term Rem. | Sq Ft | NNN Rent, Percent Rent, Ancillary | Credit Tenant Score |
| `car_wash` | Car Wash | #fda4af | Bays | Throughput / Day | Bay | Wash Revenue, Membership, Detailing | Traffic Count / Day |
| `laundromat` | Laundromat | #fecaca | Machines | Turns / Day | Machine | Wash Revenue, Dry Revenue, Vending | Laundry Index |

### Specialty / Other
| Key | Label | Color | Size Label | Occ Label | Price Unit | Revenue Streams | Demand Key |
|---|---|---|---|---|---|---|---|
| `business` | Business Acquisition | #94a3b8 | N/A | N/A | N/A | Operating Revenue, Service Revenue, Ancillary | Business EBITDA Multiple |
| `mixed_use` | Mixed Use | #cbd5e1 | Sq Ft / Units | Blended Occ % | Sq Ft | Commercial Rent, Residential Rent, Parking | Mixed-Use Demand Score |
| `land` | Land | #86efac | Acres | N/A | Acre | Ground Lease, Sale Proceeds, Timber/Mineral | Land Price / Acre |

**Default enabled:** marina, dry_stack, multifamily, retail, office, industrial, hotel, self_storage, mobile_home, rv_park, mixed_use, land, business, car_wash, laundromat
**Default disabled:** all others (can be enabled by admin)

---

## Backend Changes

### 1. Public endpoint
```
GET /api/asset-classes
```
- Authenticated (any user), no owner/admin required
- Returns all `enabled = true` asset classes ordered by `sortOrder`
- Response: `{ assetClasses: AssetClass[] }`

### 2. Admin endpoints — add `requireRole("owner")` to all
```
GET    /api/admin/asset-classes
PATCH  /api/admin/asset-classes/:key
POST   /api/admin/asset-classes          ← new: create custom class
POST   /api/admin/asset-classes/seed
```

### 3. Create endpoint body schema (Zod)
```typescript
z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),   // snake_case only
  label: z.string().min(2),
  shortLabel: z.string().optional(),
  category: z.enum(["residential","commercial","hospitality","specialty","land","waterfront","industrial","office","retail"]),
  group: z.string(),
  icon: z.string(),                          // lucide icon name
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sizeLabel: z.string(),
  occLabel: z.string(),
  priceUnit: z.string(),
  revenueStreams: z.array(z.string()).length(3),
  demandKey: z.string(),
  enabled: z.boolean().default(true),
  enabledModules: z.array(z.string()).default(["crm","modeling","proForma","vdr","dueDiligence"]),
})
```
Validate key uniqueness before insert.

### 4. Strategy fallback
In `server/services/rent-roll-v2/rentRollService.ts` and the `assetStrategies/index.ts` barrel:
- Any key without a dedicated strategy file returns `defaultStrategy`
- Log a warning but do NOT throw — `console.warn(\`[RentRoll] No strategy for asset class "${key}", using default\`)`

---

## Frontend Changes

### 1. New hook: `client/src/hooks/use-asset-classes.ts`
```typescript
export function useAssetClasses() {
  const { data, isLoading } = useQuery<{ assetClasses: AssetClass[] }>({
    queryKey: ['/api/asset-classes'],
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const assetClasses = data?.assetClasses ?? FALLBACK_ASSET_CLASSES;
  const options = assetClasses.map(ac => ({ value: ac.key, label: ac.label }));

  function getConfig(key: string) {
    return assetClasses.find(ac => ac.key === key) ?? assetClasses[0];
  }

  return { assetClasses, options, isLoading, getConfig };
}

// Minimal fallback so forms don't flash empty while loading
const FALLBACK_ASSET_CLASSES = [
  { key: 'marina', label: 'Marina', ... },
  { key: 'multifamily', label: 'Multifamily', ... },
  { key: 'retail', label: 'Retail', ... },
  { key: 'office', label: 'Office', ... },
  { key: 'industrial', label: 'Industrial', ... },
];
```

### 2. Update `client/src/components/crm/asset-class-fields.tsx`
- Replace the static `ASSET_CLASS_CONFIGS` and `ASSET_CLASS_OPTIONS` exports with wrappers that read from the hook's cache via a global query client accessor
- Keep `getAssetClassConfig(key)` signature intact for backwards compatibility
- Keep any icon-mapping or color-mapping logic but source values from DB record

### 3. Replace hardcoded arrays throughout frontend
Files to update (non-exhaustive — agent should grep for all):
- `client/src/pages/modeling/projects/index.tsx`
- `client/src/pages/auth/signup.tsx`
- `client/src/pages/operations/payroll/PositionLibrary.tsx`
- `client/src/components/crm/analytics/pipeline-analytics-dashboard.tsx`
- `client/src/components/crm/lp-export-dialog.tsx`
- `client/src/components/modals/deal-form-modal.tsx`
- `client/src/components/modals/property-form-modal.tsx`
- Any other file containing a hardcoded list of asset class string literals used as select options

### 4. Add "Create Asset Class" to Admin UI
In `client/src/pages/admin/AssetClassManager.tsx`:
- Add "Add Asset Class" button next to "Seed Defaults"
- Dialog with all fields from the create schema above
- Color picker: simple hex input with a preview swatch
- Icon picker: searchable list of 20 most common lucide icon names
- On submit: POST to `/api/admin/asset-classes`, invalidate `['/api/asset-classes']` and `['/api/admin/asset-classes']`

---

## Constraints
- Never use `npm run db:push`
- Never hardcode org IDs
- Use existing `requireRole()` helper for auth
- Use `apiRequest` from `@/lib/queryClient` for all frontend API calls
- Preserve backwards compatibility — existing `marina`, `multifamily`, `retail`, `office`, `industrial` keys must work identically
- Seed endpoint must be idempotent (INSERT ... ON CONFLICT DO UPDATE)

---

## Success Criteria
1. Admin adds a new asset class → it immediately appears in all CRM/modeling/deal form pickers
2. Admin disables an asset class → it disappears from all pickers (existing records unaffected)
3. Seed endpoint re-runnable without duplicates
4. No hardcoded asset class arrays remain in frontend (except the loading fallback in the hook)
5. Unknown asset class keys in rent roll service fall back gracefully instead of erroring
6. All admin write routes reject non-owner users with 403

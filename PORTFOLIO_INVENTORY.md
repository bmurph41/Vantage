# Portfolio Section — Code Inventory

**Generated:** 2026-04-26
**Scope:** The "Portfolio" section that tracks Owned Assets (legacy: "marinas") — `/portfolio` routes, `/api/portfolio/*` endpoints, the `owned_assets` table, and directly related code.

> **Important scope note.** Two unrelated subsystems share the word "portfolio" in their URLs and are **NOT** in scope for this inventory:
> - `/api/portfolio/summary | /projects | /breakdown | /projections | /top-performers | /underperformers | /export` in `server/routes/modeling-routes.ts` — these aggregate **modeling projects** (DCF/IRR rollups), not owned assets. The frontend equivalents live under `client/src/pages/modeling/portfolio/`.
> - `/rent-roll/portfolio` (`client/src/modules/rent-roll-v2/pages/portfolio.tsx`) — rent-roll v2 portfolio view.
>
> Both are listed in **Section 6 (Connection Points)** and **Section 10 (Open Questions)** because they cause an actual route collision with the in-scope routes.

---

## 1. File-by-file inventory

### Pages

| Path | LOC | Purpose | Portfolio imports of note |
|---|---:|---|---|
| `client/src/pages/Portfolio.tsx` | 741 | Main Portfolio dashboard list view — KPI bar, tabbed Assets/Map/Financials/Performance, AssetCard grid, add/edit/delete via MarinaModal. | `MarinaModal`, `MarinaMapEmbed` |
| `client/src/pages/portfolio/MarinaDetail.tsx` | 504 | Detail page for a single owned asset at `/portfolio/:id` — metric cards, Overview/Sales-Comps/Rate-Comps tabs. | (none from portfolio/) |

### Components

| Path | LOC | Purpose | Portfolio imports of note |
|---|---:|---|---|
| `client/src/components/portfolio/MarinaModal.tsx` | 413 | Add/edit modal that POSTs to `/api/portfolio/marinas` and PATCHes `/api/portfolio/marinas/:id`. Source of the recent 400 bug. | `apiRequest`, `queryClient` |

### Routes (server)

| Path | LOC | Purpose | Notes |
|---|---:|---|---|
| `server/routes/portfolio-summary-routes.ts` | 167 | Standalone Express router mounted at `/api/portfolio` (`server/routes.ts:673`). Currently exposes only `GET /summary` aggregating modeling projects (NOT owned assets). | Conflicts with `/api/portfolio/summary` in crm-routes.ts |
| `server/routes/crm-routes.ts` (lines 11432–11947) | 18181 (file total) | Houses **all** owned-asset HTTP routes (`/marinas`, `/marinas/:id`, `/map-locations`, `/available-properties`, `/summary`, `/asset-class-breakdown`) — registered inline inside the broader CRM routes module. | Co-located with CRM, not a standalone portfolio router |
| `server/routes/modeling-routes.ts` (lines 1638–1742) | (file total ~3400) | Defines the **other** `/api/portfolio/*` endpoints: `/summary`, `/projects`, `/breakdown`, `/projections`, `/top-performers`, `/underperformers`, `/export` — these aggregate `modeling_projects`, NOT `owned_assets`. | Out of strict scope; flagged in §10 |

### Services

| Path | LOC | Purpose | Portfolio imports of note |
|---|---:|---|---|
| `server/services/owned-assets-service.ts` | 503 | `OwnedAssetsService` class — CRUD + performance snapshots + `getPortfolioSummary()` + `convertDealToOwnedAsset()`. | `ownedAssets`, `assetPerformanceSnapshots` |
| `server/services/portfolio-rollup-service.ts` | NEEDS REVIEW (not opened) | Backs the modeling-routes.ts portfolio endpoints. Out of strict scope. | — |
| `server/services/operations-module-resolver.ts` | NEEDS REVIEW | Reads `ownedAssets` to enumerate assets for operations modules. | `ownedAssets`, `crmProperties` |
| `server/services/integration-data-pipeline.ts` | NEEDS REVIEW | References `ownedAssets` while syncing data into a deal's owned-asset record. | `ownedAssets` |
| `server/services/operations-data-sync-service.ts` | NEEDS REVIEW | References `ownedAssets`. | `ownedAssets` |

### Schema / Config

| Path | Purpose |
|---|---|
| `shared/schema.ts:2742-2772` | `ownedAssets` and `assetPerformanceSnapshots` table definitions. |
| `shared/schema.ts:196-197` | `assetStatusEnum`, `holdStrategyEnum` Postgres enums. |
| `shared/schema.ts:13743,13824` | `insertOwnedAssetSchema`, `OwnedAsset` type exports. |
| `client/src/Router.tsx:154,1281-1294` | Lazy-loads `Portfolio` and `MarinaDetail`; mounts `/portfolio` and `/portfolio/:id`. |
| `client/src/components/unified-sidebar.tsx:75,716` | Sidebar entry: `{ name: "Portfolio", href: "/portfolio", opsModuleKey: null }`. |
| `client/src/config/sidebarConfig.ts:482,492` | Operations sidebar group lists `/portfolio` as a `matchRoute` and exposes `ops-portfolio` (`/operations/portfolio`). |

### Tests

| Path | Notes |
|---|---|
| _(none found)_ | No test files matched `marina|owned.assets|owned.marina|MarinaModal|MarinaDetail|portfolio` in the in-scope surface. See §8. |

---

## 2. Routes catalog

All routes touched by the in-scope Portfolio surface. Auth = `authenticateUser` middleware; `/api/portfolio/*` mounted via `app.use("/api/portfolio", authenticateUser, enforceTenant, portfolioSummaryRoutes)` at `server/routes.ts:673` (only the `/summary` sub-route is on that router; everything else is registered globally on `app` from `crm-routes.ts`).

### Owned-assets routes (in scope)

| Method | Path | Handler | Auth | Request body | Response shape | DB tables (R/W) |
|---|---|---|---|---|---|---|
| GET | `/api/portfolio/marinas` | crm-routes.ts:11607 | yes (`authenticateUser`) | — | `OwnedMarina[]` (id, name, location, state, slips, status, acquisitionPrice/Date, currentValue, annualRevenue, annualEbitda, occupancy, projectId, propertyId, operationalData) | R: ownedAssets, crmProperties, assetPerformanceSnapshots, rentRolls, rentRollEntries |
| GET | `/api/portfolio/marinas/:id` | crm-routes.ts:11723 | yes | — | `MarinaDetails` (asset + property + project join, keyMetrics flattened) | R: ownedAssets, crmProperties, projects, users |
| POST | `/api/portfolio/marinas` | crm-routes.ts:11768 | yes | `{ propertyId, projectId?, acquisitionDate, acquisitionPrice?, status?, holdStrategy?, exitTargetDate?, keyMetrics?, notes? }` | `201 OwnedAsset` | R: crmProperties, ownedAssets (uniqueness check). W: ownedAssets |
| PATCH | `/api/portfolio/marinas/:id` | crm-routes.ts:11814 | yes | `{ acquisitionDate?, acquisitionPrice?, status?, holdStrategy?, exitTargetDate?, keyMetrics?, notes?, projectId? }` (partial) | `OwnedAsset` | W: ownedAssets |
| DELETE | `/api/portfolio/marinas/:id` | crm-routes.ts:11844 | yes | — | `{ success: true, message }` | W: ownedAssets |
| GET | `/api/portfolio/available-properties` | crm-routes.ts:11862 | yes | query: — | `Array<{ id, title, address, city, state, status, slips }>` (CRM properties not yet owned) | R: crmProperties, ownedAssets |
| GET | `/api/portfolio/map-locations` | crm-routes.ts:11432 | yes | query: `source` (all/owned/pipeline), `state?`, `search?` | `{ locations: MapLoc[], stats }` | R: ownedAssets, crmProperties, crmDeals, dealWorkspaces. W (geocode side-effect): crmProperties.coordinates |
| GET | `/api/portfolio/summary` | crm-routes.ts:11905 | yes | — | `getPortfolioSummary(orgId)` payload from service | R: ownedAssets (via service) |
| GET | `/api/portfolio/asset-class-breakdown` | crm-routes.ts:11917 | yes | — | `{ totalProjects, totalValue, byAssetClass: {...} }` | R: modelingProjects (NOT ownedAssets — see §10) |
| GET | `/api/operations/owned-marinas` | crm-routes.ts:11945 | yes | — | `301 → /api/portfolio/marinas` | — |

### Conflicting/co-located portfolio routes (NOT owned-asset; flagged for context)

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/api/portfolio/summary` | portfolio-summary-routes.ts:17 | Mounted at line 673 of routes.ts. **Same path** is also registered in crm-routes.ts:11905. Whichever is registered first wins. |
| GET | `/api/portfolio/summary` | modeling-routes.ts:1638 | **Third** registration of the same path. |
| GET | `/api/portfolio/projects` | modeling-routes.ts:1652 | Modeling-project rollup. |
| GET | `/api/portfolio/breakdown` | modeling-routes.ts:1672 | Modeling-project breakdown. |
| GET | `/api/portfolio/projections` | modeling-routes.ts:1685 | — |
| GET | `/api/portfolio/top-performers` | modeling-routes.ts:1701 | — |
| GET | `/api/portfolio/underperformers` | modeling-routes.ts:1716 | — |
| GET | `/api/portfolio/export` | modeling-routes.ts:1731 | — |

---

## 3. Database schema

### `owned_assets` (`shared/schema.ts:2742`)

| Column | Type | Notes |
|---|---|---|
| `id` | varchar PK, default `gen_random_uuid()` | |
| `org_id` | varchar NOT NULL | FK → `organizations.id` |
| `property_id` | varchar NOT NULL | FK → `crm_properties.id` |
| `project_id` | varchar NULL | FK → `projects.id` |
| `acquisition_date` | date NOT NULL | |
| `acquisition_price` | integer NULL | dollars (no cents — see §10) |
| `status` | enum `asset_status` NOT NULL default `under_management` | values: `under_management`, `optimization`, `exit` (schema.ts:196) |
| `hold_strategy` | enum `hold_strategy` NULL | values: `core`, `value_add`, `opportunistic` (schema.ts:197) |
| `exit_target_date` | date NULL | |
| `key_metrics` | jsonb default `'{}'` | freeform, holds `currentValue`/`annualRevenue`/`annualEbitda`/`occupancy`/`slips` |
| `notes` | text NULL | |
| `created_by` | varchar NOT NULL | FK → `users.id` |
| `created_at`, `updated_at` | timestamp NOT NULL | |

**Indexes:** `owned_assets_org_status_idx (org_id, status)`, `owned_assets_org_property_idx (org_id, property_id)`.

### Outbound FKs (owned_assets → other)

- `org_id` → `organizations.id`
- `property_id` → `crm_properties.id`
- `project_id` → `projects.id` (the legacy `projects` table — distinct from `modeling_projects`)
- `created_by` → `users.id`

### Inbound FKs (other → owned_assets)

| Table | Column | On delete |
|---|---|---|
| `asset_performance_snapshots` | `owned_asset_id` | CASCADE (schema.ts:2765) |
| `marina_budgets` | `owned_asset_id` | CASCADE (schema.ts:2796) |
| `asset_budgets` | `owned_asset_id` | CASCADE (schema.ts:2904) |
| `rent_roll_snapshots` | `owned_asset_id` | (no explicit cascade; nullable) (schema.ts:2940) |

### Related tables (most relevant)

- `crm_properties` — the underlying property record (address, slips, coordinates, specifications jsonb).
- `projects` — legacy project record optionally linked.
- `asset_performance_snapshots` — historical KPI snapshots, one row per (owned_asset_id, snapshot_date).
- `marina_budgets` / `marina_budget_line_items` / `marina_budget_actuals` — annual budget tracking (schema.ts:2793–2895).
- `asset_budgets` — universal asset-class-agnostic budget table (schema.ts:2901).
- `rent_roll_snapshots` — monthly rent-roll rollups (schema.ts:2936).

### ASCII relationship diagram

```
                     organizations.id
                            ▲
                            │ org_id
                            │
          users.id ─────────┤ created_by
                            │
      crm_properties.id ◄───┤ property_id
                            │
          projects.id ◄─────┤ project_id (nullable)
                            │
                     ┌──────┴──────┐
                     │ owned_assets│
                     └──────▲──────┘
                            │ owned_asset_id
        ┌───────────────────┼─────────────────────┬───────────────────┐
        │                   │                     │                   │
asset_performance_   marina_budgets       asset_budgets       rent_roll_snapshots
   snapshots          (CASCADE)            (CASCADE)            (nullable FK)
   (CASCADE)
                           │
                           ▼
              marina_budget_line_items (CASCADE)
                           │
                           ▼
              marina_budget_actuals (CASCADE)
              budget_rent_roll_bindings (CASCADE)
```

---

## 4. Frontend page → API map

### `Portfolio.tsx` — URL `/portfolio`

| Aspect | Value |
|---|---|
| API endpoints | `GET /api/portfolio/marinas` (queryKey, list); `DELETE /api/portfolio/marinas/:id`; invalidates `/api/portfolio/marinas` and `/api/portfolio/available-properties`. Map tab uses `GET /api/portfolio/map-locations` (or `/api/marina-map/locations` for "all") via `MarinaMapEmbed.baseUrl`. |
| Major components rendered | `KpiBar`, `AssetCard` (in-file), `EmptyPortfolio` (in-file), `MarinaMapEmbed`, `MarinaModal`, `AlertDialog` (delete confirm), tabs `Assets / Map / Financials / Performance`. |
| State of note | `formData` dropped at modal scope; `activeTab` synced to `?tab=` query param via wouter; `mapSource` toggle (`all|owned|pipeline`); `sortBy` (`name|value|ebitda|occupancy`); `selectedMarina` & `marinaToDelete` for modals. |

### `portfolio/MarinaDetail.tsx` — URL `/portfolio/:id`

| Aspect | Value |
|---|---|
| API endpoints | `GET /api/portfolio/marinas/:id`; `GET /api/analysis/sales-comps?state=:state`; `GET /api/analysis/rate-comps?state=:state`. |
| Major components | `MetricCard` (in-file), wouter `useParams/useLocation`, `Tabs` with Overview / Sales Comps / Rate Comps panels, `Table` for comps. |
| State of note | Comps queries gated on `marina?.state`; navigation buttons to `/crm/properties/:propertyId` and `/modeling/projects/:projectId`. |

### `components/portfolio/MarinaModal.tsx` (used by Portfolio.tsx)

| Aspect | Value |
|---|---|
| API endpoints | `GET /api/portfolio/available-properties` (only when `mode=create` && `open`); `POST /api/portfolio/marinas`; `PATCH /api/portfolio/marinas/:id`. |
| Components | `Dialog`, `Select`, `Input`, `Textarea`, `Label`, `Button` (shadcn). |
| Data flow | `formData` keyed by propertyId/dates/price/status/holdStrategy/exitTargetDate/notes/keyMetrics; on submit builds payload, validates `propertyId + acquisitionDate` for create, posts JSON; success invalidates the two list queries and closes. |

---

## 5. Component dependency tree

```
Portfolio.tsx (page)
├── KpiBar                            (in-file)
├── EmptyPortfolio                    (in-file)
├── AssetCard                         (in-file, rendered per marina)
├── MarinaMapEmbed                    @/components/marina-map/MarinaMapEmbed (658 LOC, shared)
│     └── (Mapbox + custom panel internals)
├── MarinaModal                       @/components/portfolio/MarinaModal
│     ├── Dialog/DialogContent/...    @/components/ui/dialog
│     ├── Select/SelectItem/...       @/components/ui/select
│     ├── Input / Textarea / Label    @/components/ui/*
│     └── apiRequest, queryClient     @/lib/queryClient (recently dual-signature)
├── AlertDialog (delete confirm)      @/components/ui/alert-dialog
├── DropdownMenu (asset card actions) @/components/ui/dropdown-menu
└── Tabs (Assets/Map/Financials/Performance)  @/components/ui/tabs

MarinaDetail.tsx (page)
├── MetricCard                        (in-file × 6)
├── Tabs (Overview/Sales/Rate)        @/components/ui/tabs
├── Table                             @/components/ui/table
└── Badge/Card/Button/Skeleton        @/components/ui/*
```

**Notable absence:** there is no shared `KpiCard`, `AssetCard`, or `Financials/Performance tab` component — they are all defined inline inside `Portfolio.tsx`. The "Financials" and "Performance" tabs are inline `<Card>` grids reusing the same `marinas` array, not separate components.

---

## 6. Connection points

### Modeling project system

- `client/src/pages/Portfolio.tsx:188,208,209,406,535,539` — navigates to `/modeling/projects/:projectId`, `/marinalytics/marina-map`, etc.
- `client/src/pages/portfolio/MarinaDetail.tsx:208` — "View Model" button → `/modeling/projects/:projectId` when `marina.projectId` is set.
- `server/routes/crm-routes.ts:11917-11941` — `/api/portfolio/asset-class-breakdown` reads from `modelingProjects` (not `ownedAssets`), so it is conceptually misplaced.
- `server/routes/modeling-routes.ts:1638-1742` — full set of `/api/portfolio/*` rollup endpoints driven by `portfolioRollupService` over `modeling_projects`. Frontend consumers: `client/src/pages/modeling/portfolio/index.tsx` (lines 782–806) and `client/src/pages/modeling/portfolio/dashboard.tsx`.
- `owned_assets.project_id` FK references the legacy `projects` table — **not** `modeling_projects`. The bridge between an owned asset and its modeling project is currently routed through `crm_properties`.

### Comps system (sales/rate)

- `client/src/pages/portfolio/MarinaDetail.tsx:124,129` — uses `/api/analysis/sales-comps` and `/api/analysis/rate-comps`, filtered by `marina.state`. Renders comp tables on the detail page.
- `client/src/pages/Portfolio.tsx:537,538` — map clicks on `comp` / `rate_comp` sources route to `/analysis/sales-comps/:id` / `/analysis/rate-comps/:id`.

### Map system (Mapbox)

- `client/src/components/marina-map/MarinaMapEmbed.tsx` (658 LOC) — shared map component. `Portfolio.tsx:521-540` passes `baseUrl` and click handlers.
- `server/routes/crm-routes.ts:11432-11604` — `/api/portfolio/map-locations` returns owned + pipeline rows; uses `geocodingService` to backfill coordinates and persists results to `crm_properties.coordinates`.

### AI Advisor / knowledge-base

- No direct references found. Portfolio data is not currently fed to the AI advisor RAG layer (no calls to `knowledge-base` or `ai-assistant` from in-scope files).

### CRM ↔ owned_assets

- `owned_assets.property_id` is a hard FK to `crm_properties.id`. Every owned asset must originate from a CRM property.
- `GET /api/portfolio/available-properties` (crm-routes.ts:11862) lists CRM properties **not** yet owned.
- `convertDealToOwnedAsset(...)` (`owned-assets-service.ts:480`, called by `server/routes/external-routes.ts:1039`) — converts a CRM deal to an owned asset record.
- `client/src/pages/dashboard.tsx:738-740` — main app dashboard pulls `/api/portfolio/asset-class-breakdown` for a tile.
- `client/src/components/operations/SyncAllAssetsButton.tsx:75` — invalidates the entire `/api/portfolio` query-key namespace after an ops sync.

---

## 7. Sidebar / Navigation references

| File:line | Role |
|---|---|
| `client/src/components/unified-sidebar.tsx:75` | Top-level entry: `{ name: "Portfolio", href: "/portfolio", opsModuleKey: null }` |
| `client/src/components/unified-sidebar.tsx:716` | Renders `<NavLink item={{ name: "Portfolio", href: "/portfolio" }} />` (always-visible) |
| `client/src/components/unified-sidebar.tsx:707` | "All Assets (Portfolio)" option in an asset-selector dropdown |
| `client/src/components/unified-sidebar.tsx:115-116` | "Portfolio Dashboard" / "Portfolio Returns" entries pointing to `/modeling/portfolio/...` (modeling section, not in-scope) |
| `client/src/components/unified-sidebar.tsx:137` | "Portfolio Analytics" → `/analysis/marinalytics` |
| `client/src/config/sidebarConfig.ts:482` | `matchRoutes: [..., '/portfolio', ...]` for the Operations group |
| `client/src/config/sidebarConfig.ts:492` | `{ id: 'ops-portfolio', label: 'Portfolio', href: '/operations/portfolio', icon: Anchor, requiredModules: [FEATURE_MODULES.OPS_PORTFOLIO] }` |
| `client/src/Router.tsx:154` | `const Portfolio = lazy(() => import("@/pages/Portfolio"))` |
| `client/src/Router.tsx:158` | `const MarinaDetail = lazy(() => import("@/pages/portfolio/MarinaDetail"))` |
| `client/src/Router.tsx:1281-1294` | `Route /portfolio` → `<Portfolio />` and `Route /portfolio/:id` → `<MarinaDetail />`, both inside `<GatedLayout pack="operations">` |
| `client/src/Router.tsx:1346` | `Redirect to "/portfolio"` (catch-all from a stale path) |
| `client/src/Router.tsx:1533-1534` | `/operations/rent-roll/portfolio` → redirects to `/rent-roll/portfolio` (rent-roll module, not in-scope) |
| `client/src/components/Breadcrumb.tsx` | **No breadcrumb entry exists for `/portfolio`**. Only `/modeling/portfolio`, `/operations/rent-roll/portfolio`, and `/rent-roll/portfolio` are mapped (lines 140, 480, 503). See §10. |
| `client/src/lib/tour-configs.ts:179-180,295` | Tour copy mentions "Portfolio Analytics" / "Portfolio Overview" — refers to the analytics dashboard, not the in-scope `/portfolio` page. |

---

## 8. Tests

**No test files exercise the in-scope Portfolio code.** A full search for `portfolio | owned.assets | owned.marina | MarinaModal | MarinaDetail` across `*.test.ts`, `*.test.tsx`, `*.spec.ts` returned zero matches.

Practical implication: the recent `apiRequest` dual-signature change and the `Content-Type` fix in `MarinaModal.tsx` had no automated coverage to regression-check against. Manual smoke via the dashboard "Add to Portfolio" button is currently the only verification path.

---

## 9. "Marina" language audit

Generated via `grep -in "marina" <file>`. This is a literal catalog — no edits are made.

### `client/src/pages/Portfolio.tsx` (89 lines have "marina")

```
50: import { MarinaModal } from "@/components/portfolio/MarinaModal";
51: import MarinaMapEmbed from "@/components/marina-map/MarinaMapEmbed";
55: interface OwnedMarina {
73:   totalMarinas: number;
136: function AssetCard({ marina, onEdit, onDelete, navigate }: {
137:   marina: OwnedMarina;
138:   onEdit: (m: OwnedMarina) => void;
139:   onDelete: (m: OwnedMarina) => void;
142:   const gain = (marina.currentValue || 0) - (marina.acquisitionPrice || 0);
143:   const gainPct = marina.acquisitionPrice ? ((gain / marina.acquisitionPrice) * 100).toFixed(1) : null;
144:   const capRate = marina.currentValue && marina.annualEbitda
145:     ? ((marina.annualEbitda / marina.currentValue) * 100).toFixed(1)
147:   const occupiedSlips = Math.round((marina.slips || 0) * ((marina.occupancy || 0) / 100));
152:       onClick={() => navigate(`/portfolio/${marina.id}`)}
159:               {marina.name}
163:               <span className="truncate">{marina.location}, {marina.state}</span>
167:             <Badge variant={statusVariant[marina.status] || "secondary"} className="text-xs whitespace-nowrap">
168:               {statusLabel[marina.status] || marina.status?.replace(/_/g, " ") || "Unknown"}
177:                 <DropdownMenuItem onClick={() => navigate(`/portfolio/${marina.id}`)}>
181:                 {marina.propertyId && (
182:                   <DropdownMenuItem onClick={() => navigate(`/crm/properties/${marina.propertyId}`)}>
187:                 {marina.projectId && (
188:                   <DropdownMenuItem onClick={() => navigate(`/modeling/projects/${marina.projectId}`)}>
193:                 <DropdownMenuItem onClick={() => onEdit(marina)}>
199:                   onClick={() => onDelete(marina)}
215:             <div className="text-sm font-semibold">{formatCurrency(marina.acquisitionPrice)}</div>
216:             <div className="text-xs text-muted-foreground">{formatDate(marina.acquisitionDate)}</div>
220:             <div className="text-sm font-semibold">{formatCurrency(marina.currentValue)}</div>
230:             <div className="text-sm font-semibold">{formatCurrency(marina.annualEbitda)}</div>
235:             <div className="text-sm font-semibold">{formatCurrency(marina.annualRevenue)}</div>
239:         {marina.slips && (
244:                 {occupiedSlips} / {marina.slips} slips occupied
246:               <span className={`font-medium ${(marina.occupancy || 0) >= 85 ? "text-green-600" : (marina.occupancy || 0) >= 70 ? "text-amber-600" : "text-red-500"}`}>
247:                 {formatPercent(marina.occupancy)}
251:               value={marina.occupancy || 0}
269:         Add marinas and properties to your portfolio to track performance, returns, and financials.
312:   const [selectedMarina, setSelectedMarina] = useState<OwnedMarina | null>(null);
314:   const [marinaToDelete, setMarinaToDelete] = useState<OwnedMarina | null>(null);
328:   const { data: marinas, isLoading } = useQuery<OwnedMarina[]>({
329:     queryKey: ["/api/portfolio/marinas"],
333:     mutationFn: async (id: string) => apiRequest(`/api/portfolio/marinas/${id}`, { method: "DELETE" }),
335:       queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
339:       setMarinaToDelete(null);
346:   const handleAddAsset = () => { setSelectedMarina(null); setModalMode("create"); setModalOpen(true); };
347:   const handleEditMarina = (marina: OwnedMarina) => { setSelectedMarina(marina); setModalMode("edit"); setModalOpen(true); };
348:   const handleDeleteMarina = (marina: OwnedMarina) => { setMarinaToDelete(marina); setDeleteDialogOpen(true); };
349:   const confirmDelete = () => { if (marinaToDelete) deleteMutation.mutate(marinaToDelete.id); };
352:     totalMarinas: marinas?.length || 0,
353:     totalAssets: marinas?.length || 0,
354:     totalValue: marinas?.reduce((s, m) => s + (m.currentValue || m.acquisitionPrice || 0), 0) || 0,
355:     totalEbitda: marinas?.reduce((s, m) => s + (m.annualEbitda || 0), 0) || 0,
356:     totalSlips: marinas?.reduce((s, m) => s + (m.slips || 0), 0) || 0,
357:     totalUnits: marinas?.reduce((s, m) => s + (m.slips || 0), 0) || 0,
358:     avgOccupancy: marinas?.length ? marinas.reduce((s, m) => s + (m.occupancy || 0), 0) / marinas.length : 0,
359:     totalRevenue: marinas?.reduce((s, m) => s + (m.annualRevenue || 0), 0) || 0,
361:   const totalCost = marinas?.reduce((s, m) => s + (m.acquisitionPrice || 0), 0) || 0;
368:   const sortedMarinas = [...(marinas || [])].sort((a, b) => {
405:           <Button variant="outline" size="sm" onClick={() => navigate("/marinalytics/marina-map")}>
449:           {activeTab === "assets" && (marinas?.length || 0) > 0 && (
466:           {!marinas || marinas.length === 0 ? (
470:               {sortedMarinas.map((marina) => (
472:                   key={marina.id}
473:                   marina={marina}
474:                   onEdit={handleEditMarina}
475:                   onDelete={handleDeleteMarina}
521:               <MarinaMapEmbed
524:                 baseUrl={mapSource === 'owned' || mapSource === 'pipeline' ? '/api/portfolio/map-locations' : '/api/marina-map/locations'}
569:           {marinas && marinas.length > 0 && (
571:               {[...marinas]
573:                 .map((marina) => { ... })
581:                       key={marina.id}
583:                       onClick={() => navigate(`/portfolio/${marina.id}`)}
587:                           <CardTitle className="text-sm font-semibold">{marina.name}</CardTitle>
594:                           {marina.location}, {marina.state}
601:                             <div className="font-semibold">{formatCurrency(marina.acquisitionPrice)}</div>
605:                             <div className="font-semibold">{formatCurrency(marina.currentValue)}</div>
616:                             <div className="font-semibold">{formatCurrency(marina.annualEbitda)}</div>
626:           {(!marinas || marinas.length === 0) && (
648:           {marinas && marinas.length > 0 && (
650:               {[...marinas]
652:                 .map((marina) => { ... })
660:                       key={marina.id}
662:                       onClick={() => navigate(`/portfolio/${marina.id}`)}
666:                           <CardTitle className="text-sm font-semibold">{marina.name}</CardTitle>
673:                           {marina.location}, {marina.state}
681:                             <div className="font-semibold">{marina.slips || "—"}</div>
704:           {(!marinas || marinas.length === 0) && (
713:       <MarinaModal
716:         marina={selectedMarina}
725:               This will remove "{marinaToDelete?.name}" from your portfolio. The property will still exist in your CRM but won't be tracked as an owned asset.
```

### `client/src/pages/portfolio/MarinaDetail.tsx`

```
32:  interface MarinaDetails {
57:    marinaName: string;
70:    marinaName: string;
114: export default function MarinaDetail() {
118:   const { data: marina, isLoading, error } = useQuery<MarinaDetails>({
119:     queryKey: [`/api/portfolio/marinas/${id}`],
124:     queryKey: ["/api/analysis/sales-comps", { state: marina?.state }],
125:     enabled: !!marina?.state,
129:     queryKey: ["/api/analysis/rate-comps", { state: marina?.state }],
130:     enabled: !!marina?.state,
153:   if (error || !marina) {
159:             <h3 className="text-lg font-medium mb-2">Marina Not Found</h3>
161:             The marina you're looking for doesn't exist or you don't have access to it.
173-179, 192, 196, 201-202, 207-208, 217-220, 223, 226, 229, 237, 242, 253, 263, 265, 289-301, 304, 307, 324, 328, 332, 337-338, 346, 355, 367, 370, 383, 397, 409, 438, 441, 454, 468, 479: marina.<field> reads, plus literal labels:
367:   Sales Comparables in {marina.state}
370:   Recent marina sales in the same state for benchmarking
397:   <TableHead>Marina</TableHead>
409:   <TableCell className="font-medium">{comp.marinaName}</TableCell>
441:   Current slip rental rates at nearby marinas
468:   <TableHead>Marina</TableHead>
479:   <TableCell className="font-medium">{comp.marinaName}</TableCell>
```

### `client/src/components/portfolio/MarinaModal.tsx`

```
13:  interface MarinaModalProps {
16:    marina?: any;
29:  export function MarinaModal({ open, onOpenChange, marina, mode }: MarinaModalProps) {
54-89: marina.<field> reads inside the edit-mode useEffect
102: toast({ title: "Marina added to portfolio successfully" });
106: toast({ title: "Failed to add marina", description: error.message, variant: "destructive" });
112: return await apiRequest(`/api/portfolio/marinas/${marina.id}`, {
119: queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
120: toast({ title: "Marina updated successfully" });
124: toast({ title: "Failed to update marina", description: error.message, variant: "destructive" });
168: {mode === "create" ? "Add Marina to Portfolio" : "Edit Marina"}
173:   : "Update marina details and financial metrics"
216: {mode === "edit" && marina && (
218:   <div className="font-medium">{marina.name}</div>
220:   {marina.address || `${marina.location}, ${marina.state}`}
```

### `server/routes/crm-routes.ts` (portfolio block, lines 11400–11947 only)

```
11473: name: r.title || 'Unknown Marina',          // map-locations fallback
11606: // Get portfolio marinas (owned properties) with real operational data
11607: app.get('/api/portfolio/marinas', ...)
11634: const marinas = await Promise.all(...)
11694: name: row.propertyTitle || 'Unknown Marina',
11715: res.json(marinas);
11718: console.error('PORTFOLIO_ERROR:', ...); res.status(500).json({ error: 'Failed to fetch portfolio marinas', ... })
11722: // Get single portfolio marina by ID
11723: app.get('/api/portfolio/marinas/:id', ...)
11730: return res.status(404).json({ error: 'Marina not found' });
11741: name: property?.title || 'Unknown Marina',
11762: console.error('Failed to fetch portfolio marina:', error);
11763: res.status(500).json({ error: 'Failed to fetch marina details' });
11767: // Create a new portfolio marina (owned asset)
11768: app.post('/api/portfolio/marinas', ...)
11808: console.error('Failed to create portfolio marina:', error);
11809: res.status(500).json({ error: 'Failed to add marina to portfolio' });
11813: // Update a portfolio marina
11814: app.patch('/api/portfolio/marinas/:id', ...)
11833: return res.status(404).json({ error: 'Marina not found' });
11838: console.error('Failed to update portfolio marina:', error);
11839: res.status(500).json({ error: 'Failed to update marina' });
11843: // Delete a portfolio marina (remove from portfolio)
11844: app.delete('/api/portfolio/marinas/:id', ...)
11851: return res.status(404).json({ error: 'Marina not found' });
11854: res.json({ success: true, message: 'Marina removed from portfolio' });
11856: console.error('Failed to delete portfolio marina:', error);
11857: res.status(500).json({ error: 'Failed to remove marina from portfolio' });
11922: marinaName: modelingProjects.marinaName,        // (asset-class-breakdown reads from modeling_projects)
11934: byClass[ac].assets.push({ id: p.id, name: p.marinaName, ... });
11945: app.get('/api/operations/owned-marinas', ...);
11946: res.redirect(301, '/api/portfolio/marinas');
```

### `server/services/owned-assets-service.ts`

```
(no occurrences of "marina" — service uses "OwnedAsset" / "asset" terminology consistently)
```

---

## 10. Open questions / things that look incomplete

1. **Triple registration of `GET /api/portfolio/summary`.** Three different handlers register the same route:
   - `server/routes/portfolio-summary-routes.ts:17` (mounted at routes.ts:673, modeling-project rollup),
   - `server/routes/modeling-routes.ts:1638` (modeling-project rollup with project filter),
   - `server/routes/crm-routes.ts:11905` (owned-assets rollup via `ownedAssetsService.getPortfolioSummary`).
   Express dispatches the first match — the others are dead code at this URL. Three different consumers (`OperationsHome.tsx:167`, `modeling/portfolio/dashboard.tsx:92`, `modeling/portfolio/index.tsx:782`) call this endpoint expecting different shapes; whichever one wins, two of them are reading garbage.

2. **`GET /api/portfolio/asset-class-breakdown` is mis-located.** It lives in the portfolio routes block (crm-routes.ts:11917) but reads exclusively from `modeling_projects`, never `owned_assets`. Frontend caller is `client/src/pages/dashboard.tsx:738` (the global app dashboard, not the Portfolio page). The naming is misleading.

3. **No breadcrumb entry for `/portfolio`.** `client/src/components/Breadcrumb.tsx` maps `/modeling/portfolio`, `/operations/rent-roll/portfolio`, `/rent-roll/portfolio` — but not the in-scope `/portfolio` route. The detail page `/portfolio/:id` likewise has no breadcrumb mapping. Likely a UX gap.

4. **`MarinaDetail` queries comps but does nothing with the asset's own performance snapshots.** `assetPerformanceSnapshots` exists for tracking historical KPIs of an owned asset, and `OwnedAssetsService.getAssetPerformanceSnapshots` and `getAssetPerformance` are implemented (`owned-assets-service.ts:160,272`). No frontend consumer calls them. Performance tab in `Portfolio.tsx` aggregates from the list query, not from snapshots.

5. **`acquisition_price` is `integer`.** Stores whole dollars only — anything with cents (PSA closing costs, allocations) is silently rounded. `parseInt` on the server (crm-routes.ts:11798, 11823) discards decimals before insert.

6. **`currentValue / annualRevenue / annualEbitda / occupancy / slips` are denormalized into `key_metrics` jsonb.** They are also derived from `assetPerformanceSnapshots` and `rentRolls` in `GET /api/portfolio/marinas` with a fallback chain (snapshot → stored → live). This means the Portfolio list, the Detail page, and the Edit form can all show different numbers for the same field depending on which path won. There is no single source of truth.

7. **`asset_status` enum is constrained to `under_management | optimization | exit`** (schema.ts:196), but `Portfolio.tsx:88-101` defines status labels for `under_management | stabilizing | value_add | disposition | other` and `MarinaModal.tsx:264-268` offers `under_management | pending_acquisition | disposed | under_contract`. **Five of those values are not in the enum** — the Postgres write would fail for any value other than `under_management`. The form-level fallback isn't catching this; the only reason it hasn't surfaced is that the default is `under_management`.

8. **`hold_strategy` enum is `core | value_add | opportunistic`** (schema.ts:197), but `MarinaModal.tsx:285-289` also offers `development`. Same enum-mismatch issue.

9. **Legacy route `/api/operations/owned-marinas`** (crm-routes.ts:11945) just 301-redirects. Worth tracking for removal.

10. **No tests anywhere.** Given that the recent `Content-Type` fix in MarinaModal was a 400-blocking regression, the absence of even a contract test for `POST /api/portfolio/marinas` is the highest-priority gap.

11. **`MarinaModal` `name="acquisitionPrice"` `<Input type="number">` posts as a string** (formData.acquisitionPrice). Server runs `parseInt(acquisitionPrice)`, which silently coerces — but a stray non-numeric character would NaN out and store `null` instead of erroring. Low severity; flagging.

12. **Sidebar `ops-portfolio` (`/operations/portfolio`)** is gated on `FEATURE_MODULES.OPS_PORTFOLIO` (sidebarConfig.ts:492). I did not find a route registration for `/operations/portfolio` in `Router.tsx` — only `/operations/rent-roll/portfolio` and a redirect. If the feature module is enabled but the route is missing, the link 404s. NEEDS REVIEW.

13. **`portfolio-summary-routes.ts` exports a router with only one handler** (`/summary`) yet is mounted at `/api/portfolio` — meaning every other portfolio sub-route bypasses this router entirely and is registered globally on `app` from `crm-routes.ts`. The mount point is misleading; it implies more lives there than actually does.

14. **`Portfolio.tsx` "Financials" and "Performance" tabs are inline `<Card>` grids**, not extracted components. They re-derive the same metrics that already exist on AssetCard. If/when the Performance tab needs to consume `assetPerformanceSnapshots` (see #4), this will need to be extracted.

# API Routes Map

**Total Routes:** 800+ endpoints
**Main Handler:** `server/routes.ts` (31,142 lines)
**Additional Routers:** 40+ module routers

---

## Health & System

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Basic health check |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |
| GET | `/health/db` | Database connectivity |
| GET | `/metrics` | Prometheus metrics |

---

## Authentication (`server/routes/auth-routes.ts`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/logout` | End session |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/verify-email` | Email verification |
| POST | `/api/auth/magic-link/request` | Request magic link |
| POST | `/api/auth/magic-link/verify` | Verify magic link |
| GET | `/api/auth/sso/config` | Get SSO configuration |
| POST | `/api/auth/sso/saml/callback` | SAML callback |

---

## Organization & Packs

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/config` | App configuration |
| GET | `/api/bootstrap` | Bootstrap data for app init |
| GET | `/api/organization/features` | Feature flags |
| GET | `/api/packs/catalog` | Available subscription packs |
| GET | `/api/organization/packs` | Org's pack subscriptions |
| GET | `/api/organization/packs/active` | Active packs only |
| GET | `/api/organization/packs/:packType` | Specific pack status |
| POST | `/api/organization/packs/:packType/activate` | Activate pack |
| POST | `/api/organization/packs/:packType/deactivate` | Deactivate pack |

---

## Financial Kernel (`/api/fk/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/fk/accounts` | Chart of accounts |
| POST | `/api/fk/accounts` | Create account |
| POST | `/api/fk/accounts/seed` | Seed default accounts |
| GET | `/api/fk/aliases` | Account aliases |
| POST | `/api/fk/aliases` | Create alias |
| PATCH | `/api/fk/aliases/:aliasId` | Update alias |
| DELETE | `/api/fk/aliases/:aliasId` | Delete alias |
| GET | `/api/fk/aliases/stats` | Alias statistics |
| POST | `/api/fk/aliases/suggest` | AI-suggest aliases |
| GET | `/api/fk/qbo/status` | QuickBooks status |
| GET | `/api/fk/qbo/accounts` | QB accounts |
| POST | `/api/fk/qbo/ingest` | Ingest QB data |
| GET | `/api/fk/batches` | Import batches |
| POST | `/api/fk/batches/:batchId/approve` | Approve batch |

---

## Due Diligence (`/api/dd/*`)

### Projects
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dd/projects` | List DD projects |
| POST | `/api/dd/projects` | Create project |
| GET | `/api/dd/projects/:id` | Get project |
| PATCH | `/api/dd/projects/:id` | Update project |
| DELETE | `/api/dd/projects/:id` | Delete project |
| POST | `/api/dd/projects/:id/accept` | Accept project |
| POST | `/api/dd/projects/:id/unaccept` | Unaccept project |
| PATCH | `/api/dd/projects/:id/settings` | Update settings |
| GET | `/api/dd/projects/:id/export.csv` | Export to CSV |
| GET | `/api/dd/projects/:id/export.ics` | Export calendar |
| GET | `/api/dd/projects/:id/audit` | Audit trail |

### Tasks
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dd/projects/:projectId/tasks` | List tasks |
| POST | `/api/dd/projects/:projectId/tasks` | Create task |
| PATCH | `/api/dd/tasks/:id` | Update task |
| DELETE | `/api/dd/tasks/:id` | Delete task |
| POST | `/api/dd/tasks/:id/poke` | Poke task assignee |
| PATCH | `/api/dd/tasks/:id/archive` | Archive task |
| PATCH | `/api/dd/tasks/:id/unarchive` | Unarchive task |
| PATCH | `/api/dd/projects/:projectId/tasks/bulk-sort-order` | Reorder tasks |

### Task Dependencies
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dd/projects/:projectId/task-dependencies` | All dependencies |
| GET | `/api/dd/tasks/:taskId/dependencies` | Task dependencies |
| POST | `/api/dd/projects/:projectId/task-dependencies` | Create dependency |
| PUT | `/api/dd/task-dependencies/:id` | Update dependency |
| DELETE | `/api/dd/task-dependencies/:id` | Delete dependency |

### Fees Tracker
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dd/projects/:projectId/fees` | List fees |
| GET | `/api/dd/projects/:projectId/fees/summary` | Fee summary |
| POST | `/api/dd/projects/:projectId/fees` | Create fee |
| PATCH | `/api/dd/fees/:feeId` | Update fee |
| DELETE | `/api/dd/fees/:feeId` | Delete fee |
| POST | `/api/dd/fees/:feeId/mark-paid` | Mark as paid |

### Risks
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dd/projects/:id/risks` | List risks |
| POST | `/api/dd/projects/:id/risks` | Create risk |
| GET | `/api/dd/risks/:id` | Get risk |
| PUT | `/api/dd/risks/:id` | Update risk |
| DELETE | `/api/dd/risks/:id` | Delete risk |
| GET | `/api/dd/projects/:id/risks/analytics` | Risk analytics |
| GET | `/api/dd/projects/:id/risks/ai-analysis` | AI risk analysis |
| GET | `/api/dd/projects/:id/risks/heatmap` | Risk heatmap |
| POST | `/api/dd/projects/:id/risks/recalculate` | Recalculate scores |

### Documents & RAG
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/dd/projects/:projectId/cdd-documents` | Upload document |
| GET | `/api/dd/projects/:projectId/cdd-documents` | List documents |
| GET | `/api/dd/documents/:documentId` | Get document |
| DELETE | `/api/dd/documents/:documentId` | Delete document |
| POST | `/api/dd/documents/:documentId/parse` | Parse document |
| POST | `/api/dd/documents/:documentId/embeddings` | Generate embeddings |
| POST | `/api/dd/projects/:projectId/rag` | RAG query |
| POST | `/api/dd/projects/:projectId/chat` | AI chat |

### Notifications & Calendar
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dd/projects/:projectId/calendar-events` | Calendar events |
| POST | `/api/dd/projects/:projectId/calendar-events` | Create event |
| PATCH | `/api/dd/calendar-events/:id` | Update event |
| DELETE | `/api/dd/calendar-events/:id` | Delete event |
| POST | `/api/dd/projects/:projectId/calendar-events/sync` | Sync calendar |
| GET | `/api/dd/deadlines/upcoming` | Upcoming deadlines |
| POST | `/api/dd/deadlines/check` | Trigger deadline check |
| GET | `/api/dd/deadlines/monitor/status` | Monitor status |

---

## CRM (`/api/crm/*`)

### Deals
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/crm/deals` | List deals |
| POST | `/api/crm/deals` | Create deal |
| PUT | `/api/crm/deals/:id` | Update deal |
| DELETE | `/api/crm/deals/:id` | Delete deal |
| POST | `/api/deals/convert-to-project` | Convert to DD project |

### Contacts
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/crm/contacts` | List contacts |
| POST | `/api/crm/contacts` | Create contact |
| PUT | `/api/crm/contacts/:id` | Update contact |
| DELETE | `/api/crm/contacts/:id` | Delete contact |
| GET | `/api/crm/pending-contacts` | Pending contacts |

### Companies
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/crm/companies` | List companies |
| POST | `/api/crm/companies` | Create company |
| PUT | `/api/crm/companies/:id` | Update company |
| DELETE | `/api/crm/companies/:id` | Delete company |
| GET | `/api/crm/companies/autocomplete` | Autocomplete |
| GET | `/api/crm/pending-companies` | Pending companies |

### Properties
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/crm/properties` | List properties |
| POST | `/api/crm/properties` | Create property |
| PUT | `/api/crm/properties/:id` | Update property |
| DELETE | `/api/crm/properties/:id` | Delete property |
| GET | `/api/crm/pending-properties` | Pending properties |

### Import
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/crm/imports` | Start import |
| GET | `/api/crm/imports/:id` | Get import status |
| POST | `/api/crm/imports/:id/preview` | Preview import |
| POST | `/api/crm/imports/:id/execute` | Execute import |
| POST | `/api/crm/imports/:id/rollback` | Rollback import |

---

## Modeling Projects (`/api/modeling/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/modeling/projects` | List projects |
| POST | `/api/modeling/projects` | Create project |
| GET | `/api/modeling/projects/:id` | Get project |
| PATCH | `/api/modeling/projects/:id` | Update project |
| DELETE | `/api/modeling/projects/:id` | Delete project |
| GET | `/api/modeling/projects/:id/scenarios` | List scenarios |
| POST | `/api/modeling/projects/:id/scenarios` | Create scenario |
| GET | `/api/modeling/projects/:id/addbacks` | List addbacks |
| POST | `/api/modeling/projects/:id/addbacks` | Create addback |
| GET | `/api/modeling/projects/:id/debt-scenarios` | Debt scenarios |
| POST | `/api/modeling/projects/:id/debt-scenarios` | Create debt scenario |
| GET | `/api/modeling/projects/:id/capital-stack` | Capital stack |
| GET | `/api/modeling/projects/:id/exit-scenarios` | Exit scenarios |
| POST | `/api/modeling/projects/:id/exit-scenarios` | Create exit scenario |
| GET | `/api/modeling/projects/:id/valuation` | Calculate valuation |
| GET | `/api/modeling/projects/:id/export/excel` | Export to Excel |

---

## Rent Roll V2 (`/api/rra/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/rra/projects` | List RRA projects |
| POST | `/api/rra/projects` | Create RRA project |
| GET | `/api/rra/projects/:id` | Get project |
| PATCH | `/api/rra/projects/:id` | Update project |
| DELETE | `/api/rra/projects/:id` | Delete project |
| GET | `/api/rra/projects/:id/locations` | Storage locations |
| POST | `/api/rra/projects/:id/locations` | Create location |
| GET | `/api/rra/projects/:id/tenants` | List tenants |
| POST | `/api/rra/projects/:id/tenants` | Create tenant |
| GET | `/api/rra/projects/:id/leases` | List leases |
| POST | `/api/rra/projects/:id/leases` | Create lease |
| GET | `/api/rra/projects/:id/cash-flows` | Cash flows |
| POST | `/api/rra/projects/:id/import` | Import rent roll |
| GET | `/api/rra/projects/:id/analytics` | Analytics |
| GET | `/api/rra/projects/:id/snapshots` | Snapshots |
| POST | `/api/rra/projects/:id/snapshots` | Create snapshot |

---

## Operations Modules

### Fuel Sales (`/api/fuel/*`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/fuel/tanks` | List tanks |
| POST | `/api/fuel/tanks` | Create tank |
| GET | `/api/fuel/transactions` | List transactions |
| POST | `/api/fuel/transactions` | Record sale |
| GET | `/api/fuel/deliveries` | List deliveries |
| POST | `/api/fuel/deliveries` | Record delivery |
| GET | `/api/fuel/inventory` | Inventory levels |
| GET | `/api/fuel/analytics` | Fuel analytics |

### Ship Store (`/api/ship-store/*`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/ship-store/categories` | Categories |
| POST | `/api/ship-store/categories` | Create category |
| GET | `/api/ship-store/products` | Products |
| POST | `/api/ship-store/products` | Create product |
| GET | `/api/ship-store/transactions` | Transactions |
| POST | `/api/ship-store/transactions` | Record sale |
| GET | `/api/ship-store/inventory` | Inventory |

### Service Department (`/api/service/*`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/service/work-orders` | Work orders |
| POST | `/api/service/work-orders` | Create work order |
| PATCH | `/api/service/work-orders/:id` | Update work order |
| GET | `/api/service/labor-entries` | Labor entries |
| POST | `/api/service/labor-entries` | Record labor |

### Boat Rentals (`/api/boat-rentals/*`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boat-rentals` | List rentals |
| POST | `/api/boat-rentals` | Create rental |
| GET | `/api/boat-rentals/:id` | Get rental |
| PATCH | `/api/boat-rentals/:id` | Update rental |

### Boat Club (`/api/boat-club/*`)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boat-club/members` | Members |
| POST | `/api/boat-club/members` | Add member |
| GET | `/api/boat-club/memberships` | Memberships |

---

## Virtual Data Room (`/api/vdr/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/vdr/folders` | List folders |
| POST | `/api/vdr/folders` | Create folder |
| PATCH | `/api/vdr/folders/:id` | Update folder |
| DELETE | `/api/vdr/folders/:id` | Delete folder |
| GET | `/api/vdr/documents` | List documents |
| POST | `/api/vdr/documents` | Upload document |
| GET | `/api/vdr/documents/:id` | Get document |
| DELETE | `/api/vdr/documents/:id` | Delete document |
| GET | `/api/vdr/documents/:id/download` | Download document |
| GET | `/api/vdr/activity` | Activity log |
| GET | `/api/vdr/permissions` | Get permissions |
| POST | `/api/vdr/permissions` | Set permissions |
| GET | `/api/vdr/external-users` | External users |
| POST | `/api/vdr/external-users` | Invite external user |

---

## Sales Comps (`/api/sales-comps/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/sales-comps` | List comps |
| POST | `/api/sales-comps` | Create comp |
| GET | `/api/sales-comps/:id` | Get comp |
| PATCH | `/api/sales-comps/:id` | Update comp |
| DELETE | `/api/sales-comps/:id` | Delete comp |
| POST | `/api/sales-comps/import` | Import comps |
| GET | `/api/sales-comps/export` | Export comps |
| POST | `/api/sales-comps/:id/geocode` | Geocode address |
| GET | `/api/sales-comps/pending-property-profiles` | Pending properties |

---

## Rate Comps (`/api/rate-comps/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/rate-comps` | List rate comps |
| POST | `/api/rate-comps` | Create rate comp |
| GET | `/api/rate-comps/:id` | Get rate comp |
| PATCH | `/api/rate-comps/:id` | Update rate comp |
| DELETE | `/api/rate-comps/:id` | Delete rate comp |
| POST | `/api/rate-comps/import` | Import rate comps |
| GET | `/api/rate-comps/:id/tiers` | Get rate tiers |
| POST | `/api/rate-comps/:id/tiers` | Add rate tier |

---

## DockTalk (`/api/docktalk/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/docktalk/articles` | List articles |
| GET | `/api/docktalk/articles/:id` | Get article |
| GET | `/api/docktalk/sources` | RSS sources |
| POST | `/api/docktalk/sources` | Add source |
| POST | `/api/docktalk/scrape` | Trigger scrape |
| GET | `/api/docktalk/keywords` | Keywords |
| POST | `/api/docktalk/keywords` | Add keyword |
| GET | `/api/docktalk/analytics` | Analytics |

---

## MarinaMatch Intel (`/api/marinamatch/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/marinamatch/listings` | Marina listings |
| POST | `/api/marinamatch/listings` | Create listing |
| GET | `/api/marinamatch/listings/:id` | Get listing |
| PATCH | `/api/marinamatch/listings/:id` | Update listing |
| DELETE | `/api/marinamatch/listings/:id` | Delete listing |
| GET | `/api/marinamatch/sources` | Scrape sources |
| POST | `/api/marinamatch/sources/:id/scrape` | Trigger scrape |
| GET | `/api/marinamatch/market-data` | Market data |

---

## Dashboard & Analytics (`/api/dashboards/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dashboards/data` | Dashboard data |
| GET | `/api/dashboards/modules` | Available modules |
| GET | `/api/dashboards/layout` | User layout |
| POST | `/api/dashboards/layout` | Save layout |
| GET | `/api/dashboards/saved-layouts` | Saved layouts |
| POST | `/api/dashboards/saved-layouts` | Save new layout |
| GET | `/api/dashboards/widgets` | Widget templates |
| POST | `/api/dashboards/widgets/query` | Query widget data |
| GET | `/api/dashboards/trends/:module/:period` | Trend data |
| GET | `/api/dashboards/distribution/:type/:period` | Distribution data |

---

## AI Assistant (`/api/ai-assistant/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/ai-assistant/chat` | AI chat (streaming) |
| GET | `/api/ai-assistant/suggested-questions` | Context suggestions |

---

## Admin Routes (`/api/admin/*`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/users` | Create user |
| PATCH | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/curated/stats` | Curated data stats |
| GET | `/api/admin/curated/listings` | Curated listings |
| POST | `/api/admin/curated/listings/:id/promote` | Promote to global |
| POST | `/api/admin/curated/listings/:id/demote` | Demote to org |
| GET | `/api/admin/audit-logs` | System audit logs |
| POST | `/api/admin/audit-logs/export` | Export audit logs |

---

## Additional Router Files

| Router File | Base Path | Purpose |
|-------------|-----------|---------|
| `auth-routes.ts` | `/api/auth` | Authentication |
| `pnl-routes.ts` | `/api/pnl` | P&L processing |
| `capital-markets-routes.ts` | `/api/capital-markets` | Market rates |
| `vdr-router.ts` | `/api/vdr` | Virtual Data Room |
| `ship-store-router.ts` | `/api/ship-store` | Ship Store |
| `service-router.ts` | `/api/service` | Service Dept |
| `boat-rentals-router.ts` | `/api/boat-rentals` | Boat Rentals |
| `boat-club-router.ts` | `/api/boat-club` | Boat Club |
| `boat-sales-router.ts` | `/api/boat-sales` | Boat Sales |
| `opssos-routes.ts` | `/api/opssos` | Operations SOS |
| `integration-routes.ts` | `/api/integration` | Integrations |
| `marinamatch/routes.ts` | `/api/marinamatch` | MarinaMatch Intel |
| `om/routes.ts` | `/api/om` | Offering Memorandum |
| `om-builder-routes.ts` | `/api/om-builder` | OM Builder |
| `ai-assistant-routes.ts` | `/api/ai-assistant` | AI Assistant |
| `analytics-routes.ts` | `/api/analytics` | Analytics |
| `forecasting-routes.ts` | `/api/crm/forecasting` | CRM Forecasting |
| `phase-gates-routes.ts` | `/api/crm/phase-gates` | Phase Gates |
| `email-marketing-routes.ts` | `/api/email-marketing` | Email Marketing |
| `commercial-tenants-routes.ts` | `/api/commercial-tenants` | Commercial Tenants |
| `marinalytics-routes.ts` | `/api/marinalytics` | Marina Analytics |

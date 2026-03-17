# MarinaMatch Development Journal

## Project Overview
Full-stack CRE investment analysis and deal management platform. TypeScript/React frontend, Node.js/Express backend, PostgreSQL with Drizzle ORM, TanStack Query. 55+ asset classes. Modules: Financial Modeling, CRM, Due Diligence, Document Intelligence, Deal Workspace.

**Test org:** `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`  
**Test project ID:** `6b3a9021-f393-489d-9274-321ac76eae08` (STR)

---

## Current State (as of 2026-03-17)

### Phase 3 DCF Refactor — COMPLETE ✅
- Layers 1–4 done: DCF consumes canonical Multi-Year Pro Forma engine
- Monte Carlo simulation, Decision Support (tornado chart, OLS attribution, IC memo) implemented
- 154/154 tests pass, zero TypeScript errors
- Dummy data purged, empty states added, XIRR consolidated
- assumptions.tsx dynamic via getModelConfig()
- **Remaining:** frontend visual QA + feature gating (post-billing)

### CRM Institutional Upgrade — COMPLETE ✅ (2026-03-17)
Full audit + patch session. All patches applied and server running clean.

#### Schema (applied via raw SQL — never use db:push)
New enums: crm_contact_role, crm_company_type, crm_aum_range, crm_listing_status
- crm_contacts: crmRole, sourceType, linkedInUrl, targetAssetClasses, targetGeographies, dealSizeMin/Max, investmentNotes, relationshipScore, lastContactedAt, nextFollowupDate, ndaOnFile, emailConsent
- crm_companies: companyType, aumRange, aumApprox, investmentMandate, ndaOnFile, ndaExpiryDate, linkedInUrl, parentCompanyId, targetAssetClasses
- crm_properties: listingStatus, askingPrice, lastSalePrice, lastSaleDate, latitude, longitude, totalSlips, drySlips, hasFuelDock, waterDepthFt, dockMaterial, yearBuilt

#### Frontend Files Patched
- PropertyFMPanel.tsx — NEW, financial model panel on property records
- PropertyCompsPanel.tsx — NEW, sales + rate comps on property records
- RelationshipScoreBadge.tsx — NEW, A/B/C/D tier badge
- contact-form-modal.tsx — Investment Profile card (CRE role, source, LinkedIn, deal size)
- contact-record.tsx — crmRole badge, investment section, rel score KPI chip
- contacts.tsx — Strength column + CRE Role filter
- company-form-modal.tsx — Institutional Profile card (firm type, AUM, mandate, NDA)
- company-record.tsx — firm type + NDA badges, institutional profile sidebar
- companies.tsx — Firm Type filter, dual badge on industry column
- properties.tsx — full listing status filter + color badges
- property-record.tsx — listingStatus header badge + KPI chip, lat/lng in interface
- property-form-modal.tsx — 9-option status dropdown + Listing Price field

#### Server Files Patched
- crm-relationship-score.ts — NEW, score endpoint + bulk + stale contacts
- crm-activities-routes.ts — auto-update last_contacted_at on activity create

---

## Key Gotchas

- **db:push is dangerous** — use raw psql ADD COLUMN IF NOT EXISTS instead
- **routes.ts does not auto-restart** — kill and restart server manually after changes
- **Use pool.query() not Drizzle ORM** for enableRLS tables
- **Raw SQL returns snake_case** — requires explicit camelCase mapping
- **tsc OOM on full project** — use skipLibCheck on specific files only
- **pkill -f 'tsx server'** to kill dev server (fuser not available on this system)
- **Patching pattern:** node --input-type=module heredoc scripts

---

## Architecture Notes

- Schema: shared/schema.ts (~10,000+ lines)
- Routes: server/routes.ts (~23,000 lines) — use surgical Node.js scripts, not manual edits
- CRM summary: server/routes/crm-summary-routes.ts
- Activities: server/routes/crm-activities-routes.ts
- Relationship score: server/routes/crm-relationship-score.ts
- Storage: server/storage.ts (8582 lines)
- Asset class config: platform_asset_classes table, varchar-based enums

---

## Remaining Work (prioritized)

### High Priority
1. Company portfolio panel — replace portfolioCount with full linked-properties panel on company record
2. next_followup_date reminder widget — surface on CRM dashboard/contact list
3. ⌘K search UX test — verify /api/crm/search returns results in browser

### Medium Priority
4. Bulk CSV import for contacts
5. last_contacted_at backfill — SQL to backfill from existing activity history
6. Property form lat/lng geocode — auto-populate from address for comp radius queries

### Lower Priority
7. Frontend visual QA — DCF tabs, FM design system consistency
8. Feature gating — post-billing tier enforcement
9. Relationship score backfill — compute scores for existing contacts

---

## Session Log

### 2026-03-17 — CRM Institutional Audit + Full Patch Session
- Full audit: 14 critical gaps, 23 high-priority gaps identified
- Schema patched via raw SQL (safe, no data loss)
- All frontend + server patches applied
- CRM grade: C+ to B+ across all modules
- Server running clean; Docket 403/405 errors are pre-existing noise from paywalled sources

### Earlier
- Phase 3 DCF Refactor (Layers 1-4) complete
- FM Design System v2 across 9 tabs
- Multi-Year Pro Forma engine as canonical source of truth
- Investment document generation (IC Memo, DD Packet, OM, Executive Summary)
- P&L parser v2 with geometry-based PDF extraction
- CRM upgraded: 3-column records, PreviewDrawer, timeline, KPI chips
- Exit Strategy Studio refactored to canonical exit-scenario-engine
- Debt modeling: LTV/dollar toggles, DSCR timelines

### 2026-03-17 — 10x CRM Record Pages session
All 4 record pages upgraded to institutional-grade with rich tab content.

**Files added:**
- client/src/components/crm/ContactRecordTabs.tsx
- client/src/components/crm/CompanyRecordTabs.tsx  
- client/src/components/crm/PropertyRecordTabs.tsx

**Contact Record tabs:** Deals (chart), Properties, Activities, Models, Intel, Notes
**Company Record tabs:** Portfolio (charts), Contacts, Deals (chart), Activities, Models, Intel, Notes
**Property Record tabs:** Storage, Sales Comps (chart), Rate Comps (chart), Activities, Deals, Intel, Notes, Price History
**Deal Record:** Full CrmRecordPage rebuild — Overview, Activities (chart), FM, Comps, Intel, Notes

**Remaining work:**
- Verify browser rendering on all 4 record types
- Add data to test: create a comp or two to see charts populate
- CRM summary route for deals is thin — consider expanding to return more fields

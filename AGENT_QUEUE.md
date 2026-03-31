# MarinaMatch Agent Task Queue

## 🔴 TIER 1 — CRM / DEAL PIPELINE (Active Priority)

- [spec] [in-progress] Write detailed build spec for Deal Comparison workspace — pull DCF + Pro Forma per deal (CRM priority #3)
- [feature] [in-progress] Implement Email Send Integration for Workflow Automation — see agents/specs/email-send-integration-spec.md
- [feature] [todo] Implement Google Maps & Google Places API integration with encrypted key storage — AES-256-GCM encrypted key in DB (pattern: enc:iv:ciphertext), server-side proxy routes for autocomplete (/api/google-places/autocomplete), place details (/api/google-places/details/:placeId), and geocoding (/api/google-places/geocode), reusable GooglePlaceSearch frontend component (debounced, no Google SDK), and Settings UI for key entry/masking — see attached_assets/Pasted-Implement-Google-Maps-Google-Places-API-integration-wit_1774924110030.txt for full spec

## 🟠 TIER 2 — AI ADVISOR

- [spec] [in-progress] Spec entity injection for AI Advisor — auto-inject current Deal Room context into AI prompts
- [feature] [todo] Implement AI advisor entity injection — reads modeling_project, pro forma, DCF for current deal

## 🟡 TIER 3 — DOCUMENT STUDIO / MARKETING PACKAGES

- [spec] [todo] Spec the shared token substitution engine for Document Studio
- [migration] [todo] Create document_templates and document_renders tables for Document Studio
- [feature] [todo] Build token substitution engine — Express route + token resolver pulling live Pro Forma and DCF data
- [spec] [todo] Spec IC Deal Review Deck — section layout, token map, PDF output route
- [feature] [todo] Build IC Deal Review Deck template + POST /api/marinamatch/documents/ic-deck PDF route
- [spec] [todo] Spec Offering Memorandum template — section modularity, token map, PDF output
- [feature] [todo] Build Offering Memorandum template + POST /api/marinamatch/documents/om PDF route
- [feature] [todo] Build Document Studio UI tab — InvestmentMaterialsTab with IC Deck and OM cards and generate buttons

## 🟢 TIER 4 — PROSPECTING / MARKETPLACE

- [spec] [todo] Spec Marina Property Intelligence Map data integration — geocoding and Mapbox GL JS rendering
- [migration] [todo] Ensure marina_properties table has lat/lng, investment grade, demographics JSON columns
- [feature] [todo] Implement CRUD routes for /api/marinamatch/marina-properties
- [feature] [todo] Wire Marina Property Map to live DB data — replace any stub or mock data
- [spec] [todo] Spec lead enrichment pipeline — Marketplace add-to-pipeline auto-creates owner CRM contact
- [feature] [todo] Implement lead enrichment pipeline
- [feature] [todo] Build scraping health dashboard — last scrape time, success rate, new listing count

## 🔵 TIER 5 — REPORTING & ANALYTICS

- [spec] [todo] Spec portfolio dashboard — org-level rollup: aggregate NOI, equity deployed, avg DSCR
- [migration] [todo] Create portfolio_snapshots table for caching rollup calculations
- [feature] [todo] Build portfolio dashboard page — reads all modeling_projects, rolls up Pro Forma and DCF
- [spec] [todo] Spec pipeline analytics — deal velocity, win rate, avg days in stage, conversion funnel
- [feature] [todo] Build pipeline analytics tab in CRM
- [spec] [todo] Spec payroll UI — expense drill-down using existing 30+ payroll tables
- [feature] [todo] Build payroll module UI — department allocations, burden profiles, connects to Pro Forma opex

## 🟣 TIER 6 — FINANCIAL MODEL POLISH

- [test] [todo] Visual QA pass on all Financial Model tabs — layout, empty states, number formatting
- [spec] [todo] Spec financial model feature gating — which FM features gate behind which entitlement tiers

## ⚫ TIER 7 — BILLING

- [spec] [todo] Spec Billing Engine — Stripe integration, plan management, usage metering
- [migration] [todo] Create billing tables — subscriptions, invoices, usage_events, plan_entitlements
- [feature] [todo] Build Billing Engine — Stripe webhook handler, plan upgrade/downgrade, entitlement sync

## 🔍 AUDIT TASKS

- [audit] [todo] Full connectivity audit — verify every feature in Connectivity Matrix is wired end-to-end
- [audit] [todo] Empty state audit — check every page and tab for blank screen conditions

## Completed
- [feature] [done] Polish global activity log — timestamps, filters by entity type and actor, pagination (CRM priority #5)
- [feature] [done] Add key dates display to Kanban pipeline cards — created, expected close, next follow-up (CRM priority #4)
- [feature] [done] Fix AI advisor markdown rendering — add react-markdown renderer to chat UI
- [spec] [done] Spec out Email send integration for CRM Workflow Automation (CRM priority #6)
- [feature] [done] Implement Deal Timeline/Gantt view — see agents/specs/deal-timeline-gantt-spec.md
- [spec] [done] Write detailed build spec for Deal Timeline/Gantt view (CRM priority #2)

- [feature] [done] Workflow Automation engine
- [feature] [done] MarketplaceListings.tsx
- [feature] [done] Marina Property Intelligence Map
- [feature] [done] AI Advisor knowledge-base-service.ts
- [feature] [done] CRM Record Pages — all 4 entity types
- [feature] [done] DCF Phase 3 — 154/154 tests passing
- [feature] [done] Multi-Year Pro Forma
- [feature] [done] Capital Stack
- [feature] [done] Exit Strategy Studio
- [feature] [done] Investment Criteria buy-box
- [feature] [done] P&L Parser v2
- [feature] [done] Payroll module schema
- [feature] [done] Entitlements system
- [feature] [done] Institutional readiness

## Failed / Blocked
- [feature] [todo] Implement Email Send Integration for Workflow Automation — see agents/specs/email-send-integration-spec.md — 


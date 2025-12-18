# MarinaMatch Upgrades Implementation Plan

## Phase 0: Codebase Inventory

### Current Database Schema (shared/schema.ts)

#### Core CRM Tables
- `crmContacts` (line ~2049) - Contact records with companyId reference
- `crmCompanies` (line ~2031) - Company records
- `crmProperties` (line ~2127) - Property records with status, listingPrice fields
- `contactCompanyAssociations` - Junction table for many-to-many contacts/companies

#### Modeling Tables
- `modelingProjects` (line ~7962) - Core modeling projects with caseLabels JSON field
- Case configuration currently stores 4 fixed case types (base, aggressive, conservative, custom) in project's caseLabels JSON

#### Rate Comps / Sales Comps
- `rateComps` (line ~6171) - Rate comp records with propertyProfileId link
- `salesComps` (line ~4630) - Sales comp records with propertyProfileId link
- `rcPendingPropertyProfiles` - Pending property profiles for rate comps
- `scPendingPropertyProfiles` - Pending property profiles for sales comps

#### Due Diligence
- `projects` (line ~611) - DD project records
- `tasks` (line ~688) - DD tasks with companyId and contactId references to CRM

### Key Routes (server/routes.ts)
- CRM routes: `/api/crm/*`
- Modeling routes: `/api/modeling/*`
- Rate Comps routes: `/api/rate-comps/*`
- Sales Comps routes: `/api/sales-comps/*`
- DD routes: `/api/projects/*`

### Key UI Components
- Modeling workspace: `client/src/pages/modeling/projects/workspace/*`
- Case configuration: `client/src/pages/modeling/projects/workspace/case-configuration.tsx`
- CRM pages: `client/src/pages/contacts.tsx`, `companies.tsx`, `properties.tsx`
- DD pages: `client/src/pages/project.tsx`

---

## Upgrades To Implement

### A) Multi-case Scenarios (Modeling)
**Current State:** Fixed 4 case types stored as JSON in modelingProjects.caseLabels
**Target State:** User-defined N cases with separate database records, per-case assumptions, and lease-up data

**New Tables:**
- `modeling_cases` - Individual case definitions
- `modeling_case_assumptions` - Per-case assumption key-value pairs

### B) Rate Comps <-> CRM Property Linking
**Current State:** `rcPendingPropertyProfiles` table exists for pending property workflow
**Target State:** Enhance to support conversion from pending to full CRM property

**Changes:**
- Add conversion endpoint for pending property profiles
- Enhance UI for converting pending properties

### C) CRM Lists Feature
**Current State:** No list system exists
**Target State:** User-defined lists for contacts, companies, properties

**New Tables:**
- `crm_lists` - List definitions
- `crm_list_items` - Entity membership in lists

### D) Export Model to Excel
**Current State:** No Excel export
**Target State:** Multi-tab Excel export with Summary, Assumptions, P&L, etc.

**New:**
- Server-side ExcelJS endpoint
- Export button in UI

### E) Addbacks System
**Current State:** No addback tracking
**Target State:** Per-line-item addback checkboxes with monthly/yearly values

**New Tables:**
- `modeling_addbacks` - Addback flags per line item
- `modeling_addback_values` - Period-specific addback amounts

### F) Due Diligence Fees Tracking
**Current State:** Tasks have companyId/contactId but no fee tracking
**Target State:** Track fees paid to third-parties with a fees tracker view

**New Tables:**
- `dd_fees` - Fee records linked to contacts/companies/tasks

### G) CRM Property Status Toggles
**Current State:** Properties have basic status field
**Target State:** isSelling, isOnMarket toggles with broker/price/cap rate fields

**Schema Changes:**
- Add columns to `crmProperties`: isSelling, isOnMarket, brokerContactId, brokerName, listPrice, listCapRate, listingDate, listingNotes, stage

### H) DD Tasks CRM Search
**Current State:** Tasks have companyId/contactId references
**Target State:** Searchable typeahead for selecting contacts/companies

**Changes:**
- Add search endpoint `/api/crm/search`
- Update DD task forms with typeahead

### I) Entity Relationships Navigation
**Current State:** Basic foreign key references exist
**Target State:** Full relationship navigation in UI

**Changes:**
- Ensure all FK relationships are properly defined
- Add relationship displays to entity detail pages

---

## Implementation Order

1. **Phase 1A:** Database Schema - Cases, Addbacks, CRM Lists tables
2. **Phase 1B:** Database Schema - DD Fees, Property Status fields
3. **Phase 2A:** Backend API - Cases & Addbacks routes
4. **Phase 2B:** Backend API - CRM Lists, DD Fees, Property Status routes
5. **Phase 2C:** Backend API - Rate Comps Pending Property linking
6. **Phase 3A:** Frontend - Modeling Cases UI
7. **Phase 3B:** Frontend - Addbacks System & Tracker
8. **Phase 3C:** Frontend - CRM Lists Feature
9. **Phase 3D:** Frontend - Property Status Toggles
10. **Phase 3E:** Frontend - DD Tasks CRM Search & Fees Tracker
11. **Phase 3F:** Frontend - Entity Relationship Navigation
12. **Phase 4:** Excel Export
13. **Phase 5:** Sales Comps Integration on Close
14. **Phase 6:** QA Documentation

# Database Schema Summary

**Database:** PostgreSQL (Neon Serverless)
**ORM:** Drizzle ORM
**Total Tables:** 511+ tables
**Schema File:** `shared/schema.ts` (22,600+ lines)

---

## Core Domain Tables

### Organizations & Users

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `organizations` | id, name, slug, settings | Multi-tenant organizations |
| `users` | id, email, password, orgId, role | User accounts |
| `user_sessions` | id, userId, sessionToken, expiresAt | Session management |
| `password_reset_tokens` | id, userId, token, expiresAt | Password recovery |
| `security_audit_log` | id, userId, action, ipAddress, timestamp | Security events |
| `sso_configurations` | id, orgId, provider, metadata | SSO/SAML config |

### Pack/Subscription System

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `pack_catalog` | id, name, type, features, pricing | Available packs |
| `organization_packs` | id, orgId, packType, activatedAt, expiresAt | Active subscriptions |

---

## CRM Module

| Table | Key Columns | Relationships |
|-------|-------------|---------------|
| `crm_companies` | id, name, industry, website, orgId | → contacts, properties |
| `crm_contacts` | id, firstName, lastName, email, phone, orgId | → companies, properties, deals |
| `crm_properties` | id, name, address, city, state, zipCode, orgId | → contacts, companies |
| `crm_deals` | id, name, stage, value, probability, ownerId | → contacts, companies, properties |
| `crm_contact_companies` | contactId, companyId | Junction table |
| `crm_company_properties` | companyId, propertyId | Junction table |
| `crm_contact_properties` | contactId, propertyId | Junction table |
| `crm_contacts_labels` | contactId, label | Contact tagging |
| `crm_storage_types` | id, name, category | Storage type master |
| `crm_property_storage_entries` | propertyId, storageTypeId, count | Property storage details |

---

## Due Diligence Module

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `projects` | id, name, status, orgId, startDate, endDate | DD project tracking |
| `project_settings` | id, projectId, settings | Project configuration |
| `project_templates` | id, name, tasks | Reusable templates |
| `tasks` | id, projectId, name, status, priority, dueDate | Task management |
| `task_files` | id, taskId, filename, path | Task attachments |
| `task_dependencies` | id, predecessorId, successorId, dependencyType | Task relationships |
| `timeline_notes` | id, projectId, content, createdAt | Project notes |
| `project_shares` | id, projectId, userId, accessLevel | Project sharing |
| `audit_logs` | id, projectId, userId, action, details, timestamp | Activity logging |
| `risks` | id, projectId, category, status, likelihood, impact | Risk tracking |
| `contacts` | id, projectId, role, name, email, phone | Project contacts |
| `project_contacts` | projectId, contactId, role | Contact assignments |
| `document_requirements` | id, projectId, category, status | DD document checklist |
| `dd_automation_rules` | id, projectId, trigger, action | Automation rules |
| `dd_milestone_notifications` | id, projectId, milestoneId, notifyAt | Milestone alerts |
| `dd_checklist_templates` | id, name, items, category | Checklist templates |

---

## Rent Roll V2 (Marina-Specific)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `rra_projects` | id, name, orgId, projectType, seasonType | Marina projects |
| `rra_storage_locations` | id, projectId, name, storageType, dimensions | Slips/units |
| `rra_tenants` | id, projectId, name, email, phone | Tenants/boaters |
| `rra_leases` | id, tenantId, locationId, startDate, endDate | Lease agreements |
| `rra_lease_line_items` | id, leaseId, chargeType, amount, frequency | Lease charges |
| `rra_cash_flows` | id, leaseId, date, amount, type | Cash flow entries |
| `rra_move_events` | id, tenantId, direction, date | Move in/out tracking |
| `rra_period_snapshots` | id, projectId, periodStart, periodEnd, status | Period snapshots |
| `rent_roll_snapshots` | id, projectId, snapshotDate, metrics | Legacy snapshots |
| `rent_roll_snapshot_details` | id, snapshotId, unitId, details | Snapshot details |

**Enums for Rent Roll:**
- `rra_storage_type`: COVERED_SLIP, UNCOVERED_SLIP, DRY_STACK, RACK, MOORING, TRAILER, etc.
- `rra_charge_type`: BASE_RENT, ELECTRIC, LIVEABOARD, PUMP_OUT, etc.
- `rra_term_status`: active, expired, future

---

## Modeling Projects

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `modeling_projects` | id, name, orgId, createdBy, settings | Valuation models |
| `modeling_scenarios` | id, projectId, name, assumptions | What-if scenarios |
| `modeling_revenue_assumptions` | id, scenarioId, category, values | Revenue inputs |
| `modeling_expense_assumptions` | id, scenarioId, category, values | Expense inputs |
| `modeling_addbacks` | id, projectId, category, amount, description | EBITDA adjustments |
| `modeling_debt_scenarios` | id, projectId, loanAmount, interestRate, term | Debt modeling |
| `modeling_capital_stack` | id, projectId, layer, amount, cost | Cap stack layers |
| `modeling_exit_scenarios` | id, projectId, exitYear, capRate, salePrice | Exit modeling |
| `exit_scenario_loans` | id, exitScenarioId, loanType, amount, rate | Multi-loan tracking |
| `exit_capital_calls` | id, exitScenarioId, amount, date, status | Capital call schedule |

---

## Operations Modules

### Fuel Sales
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `fuel_tanks` | id, marinaId, name, fuelType, capacity | Tank inventory |
| `fuel_deliveries` | id, tankId, quantity, costPerGallon, date | Fuel purchases |
| `fuel_transactions` | id, tankId, gallons, pricePerGallon, date | Sales transactions |
| `fuel_inventory_logs` | id, tankId, reading, date | Tank readings |
| `ops_fuel_transactions` | id, marinaId, date, gallons, revenue | Ops fuel tracking |

### Ship Store
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `ship_store_categories` | id, name, parentId | Product categories |
| `ship_store_products` | id, categoryId, sku, name, price, cost | Product catalog |
| `ship_store_inventory` | id, productId, quantity, reorderPoint | Inventory tracking |
| `ship_store_transactions` | id, date, items, total | Sales transactions |
| `ops_ship_store_sales` | id, marinaId, date, revenue, cogs | Ops ship store |

### Service Department
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `service_work_orders` | id, marinaId, boatId, status, laborHours | Work orders |
| `service_labor_entries` | id, workOrderId, hours, rate | Labor tracking |
| `service_parts_used` | id, workOrderId, partId, quantity, cost | Parts used |
| `ops_service_work_orders` | id, marinaId, date, revenue, laborCost | Ops service |

### Boat Rentals & Club
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `ops_boat_rentals` | id, marinaId, boatId, duration, revenue | Rental transactions |
| `ops_boat_club_memberships` | id, marinaId, memberId, tier, dues | Club memberships |
| `ops_boat_sales` | id, marinaId, boatType, salePrice, commission | Boat sales |

---

## Virtual Data Room (VDR)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `vdr_folders` | id, projectId, name, parentId | Folder hierarchy |
| `vdr_documents` | id, folderId, name, path, mimeType | Documents |
| `vdr_permissions` | id, documentId, userId, accessLevel | Access control |
| `vdr_activity_logs` | id, documentId, userId, action, timestamp | Activity audit |
| `vdr_external_users` | id, projectId, email, accessToken | External sharing |
| `vdr_watermarks` | id, projectId, template | Document watermarks |

---

## Docket (Industry Intelligence)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `articles` | id, title, content, source, publishedAt | News articles |
| `article_summaries` | id, articleId, summary, sentiment | AI summaries |
| `rss_sources` | id, name, url, category, isActive | RSS feed sources |
| `scrape_sources` | id, name, url, selector | Web scrape sources |
| `docket_keyword_bank` | id, keyword, category, weight | Keyword scoring |
| `docket_scoring_config` | id, orgId, weights | Custom scoring |

---

## Analytics & Reporting

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `dashboard_widgets` | id, name, type, config | Widget definitions |
| `user_dashboard_layouts` | id, userId, layout | User dashboard config |
| `dashboard_saved_layouts` | id, userId, name, config | Saved layouts |
| `dashboard_custom_modules` | id, orgId, name, metrics | Custom modules |
| `dashboard_module_metrics` | id, moduleId, date, value | Metric history |
| `analytics_report_schedules` | id, name, schedule, recipients | Scheduled reports |

---

## Integrations

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `integrations` | id, name, type, config | Integration catalog |
| `user_integrations` | id, userId, integrationId, credentials | User connections |
| `integration_sync_history` | id, integrationId, syncedAt, status | Sync logs |
| `integration_sync_metrics` | id, integrationId, metric, value | Sync metrics |

---

## Indexes Summary

Key indexes across the schema:
- All foreign key columns are indexed
- Timestamp columns have indexes for time-range queries
- orgId columns indexed for multi-tenant isolation
- Email columns indexed for user lookups
- Status/type columns indexed for filtering

---

## Relationships Diagram (Simplified)

```
Organizations
    ├── Users
    │   ├── UserSessions
    │   ├── UserDashboardLayouts
    │   └── UserIntegrations
    ├── OrganizationPacks
    ├── CRM Module
    │   ├── CrmCompanies
    │   ├── CrmContacts
    │   ├── CrmProperties
    │   └── CrmDeals
    ├── DD Projects
    │   ├── Tasks
    │   ├── Risks
    │   ├── DocumentRequirements
    │   └── VDR (Folders, Documents)
    ├── Modeling Projects
    │   ├── Scenarios
    │   ├── Addbacks
    │   ├── DebtScenarios
    │   └── ExitScenarios
    ├── RRA Projects (Rent Roll V2)
    │   ├── StorageLocations
    │   ├── Tenants
    │   ├── Leases
    │   └── CashFlows
    └── Operations
        ├── Fuel Transactions
        ├── Ship Store Sales
        ├── Service Work Orders
        └── Boat Rentals
```

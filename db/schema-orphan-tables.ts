/**
 * Orphan table declarations — CLEARED (task #101)
 *
 * All 99 stub tables that were declared here have been resolved:
 *
 *  • Commercial lease tables (11) → already fully defined in
 *    shared/commercial-lease-schema.ts — stubs removed as duplicates.
 *
 *  • OM-builder tables (6) → already fully defined in
 *    shared/document-builder/schema.ts — stubs removed as duplicates.
 *
 *  • Accounting / financial integration tables (25) → promoted to
 *    db/schema-accounting.ts (confirmed active — used by integration
 *    connectors, GL reconciliation, and rent-roll reporting).
 *
 *  • LP / Investor portal tables (8) → promoted to
 *    db/schema-lp-portal.ts (confirmed active — used by lp-portal
 *    service and associated routes).
 *
 *  • Remaining 49 unused tables → DROP TABLE IF EXISTS … CASCADE
 *    migrations added to server/db-startup-migrations.ts and stubs
 *    removed from this file.  Dropped groups:
 *      - AI & Knowledge (7)
 *      - CRM Extensions (5)
 *      - Document Management (5)
 *      - Security / RBAC (8)
 *      - Compliance & Privacy (4)
 *      - Settings & Preferences (4)
 *      - Communication tracking (2)
 *      - Docket Users (1)
 *      - Extraction config (1)
 *      - Legacy Workflow Engine (12)
 *
 * This file intentionally exports nothing.  It is kept so that any
 * cached import of "./schema-orphan-tables" (e.g. in db/schema-index.ts)
 * does not cause a module-not-found error during the transition period.
 * Once all downstream imports are verified clean it may be deleted.
 */

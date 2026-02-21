# MarinaMatch Financial Kernel + Integrations Platform Assessment

## Phase 0: Repository Diagnostic

**Date**: December 16, 2025  
**Status**: Assessment Complete

---

## 1. Repository Structure Analysis

### 1.1 Backend Architecture

| Component | Location | Notes |
|-----------|----------|-------|
| **Entrypoint** | `server/index.ts` | Express app with sequential middleware registration |
| **Route Registration** | `server/routes.ts` | `registerRoutes(app)` pattern |
| **Vite Integration** | `server/vite.ts` | Dev/prod static serving |
| **Database** | `server/db.ts` | Drizzle ORM with Neon PostgreSQL |

### 1.2 Middleware Stack (in order)
1. `requestIdMiddleware` - Already generates X-Request-Id
2. `configureSecurityMiddleware` - Helmet, CORS, rate limiting
3. `express.json/urlencoded` - Body parsing
4. `requestLoggingMiddleware` - Pino HTTP logging
5. Route handlers registered via `registerRoutes()`
6. Docket routes registered separately
7. `centralizedErrorHandler` - Error handling

### 1.3 Schema Location
- **Primary**: `shared/schema.ts` (15,000+ lines)
- **Docket**: `shared/docket-schema.ts`
- **Pattern**: Drizzle ORM with `pgTable`, `pgEnum`, `createInsertSchema`
- **Migrations**: Uses `npm run db:push` (schema-first approach)

---

## 2. Authentication & Authorization

### 2.1 Auth Middleware
- **Location**: `server/modules/auth/auth.middleware.ts`
- **User Context**: `req.user` contains `{ id, orgId, role }`
- **Pattern**: Session-based with development fallback

### 2.2 Existing RBAC System
- **Location**: `server/middleware/rbac.ts`
- **Roles**: `owner`, `admin`, `editor`, `viewer`, `auditor`
- **Permissions**: Module-specific (e.g., `fuel:read`, `fuel:create`)
- **Pattern**: `requirePermission('permission')` middleware
- **Tables**: `organizationUserRoles` in shared/schema.ts

### 2.3 Tenant Context
- **Location**: `server/middleware/tenant-context.ts`
- **Pattern**: Multi-tenant with org-based data isolation

### 2.4 Pack System (Add-on features)
- **Location**: `server/middleware/pack-guard.ts`, `server/services/pack-service.ts`
- **Pattern**: Feature flags via `organizationPacks` table
- **Usage**: `requirePack('pack_type')` middleware

---

## 3. Existing QuickBooks Integration

### 3.1 Current Implementation
- **Location**: `server/services/quickbooks-service.ts` (605 lines)
- **Status**: Fully implemented OAuth2 + P&L sync

### 3.2 Capabilities
- OAuth2 authorization flow
- Token encryption (AES-256-CBC)
- P&L report fetching
- Chart of accounts mapping
- Sync logging (`quickbooksSyncLogs` table)

### 3.3 Database Tables
```typescript
quickbooksIntegrations  // Connection storage
quickbooksSyncLogs      // Sync history
```

### 3.4 Integration Decision
**IMPORTANT**: The existing QuickBooks service should be WRAPPED into the new connector framework, NOT replaced. The new system will:
1. Use the existing service for QBO-specific logic
2. Add normalized data flow to Financial Kernel
3. Extend with mapping layer capabilities

---

## 4. Existing Audit & Logging

### 4.1 Audit Service
- **Location**: `server/services/audit-service.ts`
- **Status**: Exists, used for VDR and other modules

### 4.2 Request ID
- **Location**: `server/middleware/logging.ts`
- **Status**: Already implemented (`requestIdMiddleware`)
- **Usage**: Generates UUID, attaches to `req.requestId`

---

## 5. File Upload Pipeline

### 5.1 Current Setup
- **Middleware**: Multer-based, 10MB limit
- **Storage**: Local filesystem (`server/uploads/`)
- **Usage**: VDR, Document Intelligence modules

---

## 6. Integration Points for New Modules

### 6.1 Where to Mount New Routes
```typescript
// server/routes.ts - Add after existing routes
// Mount new integrations platform routes
app.use('/api/fk', fkRouter);           // Financial Kernel
app.use('/api/mapping', mappingRouter); // Mapping Layer
app.use('/api/connectors', connectorsRouter); // Connectors
app.use('/api/automation', automationRouter); // Automation Rules
app.use('/api/workflow', workflowRouter);     // Light Workflow
```

### 6.2 Schema Extension
```typescript
// Create new file: shared/finance-kernel-schema.ts
// Import into shared/schema.ts via: export * from './finance-kernel-schema';
```

### 6.3 Feature Flags Integration
```typescript
// server/config/featureFlags.ts - New file
// Frontend: client/src/config/featureFlags.ts
// API: GET /api/config - Already pattern exists in bootstrap endpoint
```

---

## 7. Risk Assessment

### 7.1 Low Risk (Safe to Implement)
- New database tables (additive only)
- New route namespaces (`/api/fk/*`, `/api/mapping/*`, etc.)
- New frontend pages under `/admin/*`
- Feature flags with safe defaults

### 7.2 Medium Risk (Requires Care)
- Modifying `server/routes.ts` to mount new routers
- Adding new enums to schema (requires migration)
- Integrating with existing QuickBooks service

### 7.3 High Risk (Avoid)
- Modifying existing middleware order
- Changing existing table structures
- Modifying auth flow

---

## 8. Recommended Implementation Order

1. **Phase 1**: Feature Flags (backend + frontend config)
2. **Phase 2**: Platform Primitives (extend RBAC, add audit tables)
3. **Phase 3**: Financial Kernel (new schema, services, routes)
4. **Phase 4**: Mapping Layer (account aliases, dimension rules)
5. **Phase 5**: Automation Rules Engine
6. **Phase 6**: Light Workflow (posting batch review)
7. **Phase 7**: Connector Framework (wrap existing QBO, add Intacct/NetSuite placeholders)
8. **Phase 8**: Frontend UI (admin pages, gated by feature flag)
9. **Phase 9**: Jobs/Scheduling (if needed)
10. **Phase 10**: Testing + Safety Verification

---

## 9. Rollback Plan

### 9.1 Feature Flag Approach
All new functionality will be behind feature flags:
```
INTEGRATIONS_PLATFORM_ENABLED=false  # Master switch
CONNECTOR_QBO_ENABLED=false          # QBO connector
CONNECTOR_INTACCT_ENABLED=false      # Intacct (placeholder)
CONNECTOR_NETSUITE_ENABLED=false     # NetSuite (placeholder)
FINANCIAL_KERNEL_UI_ENABLED=false    # Frontend routes
```

### 9.2 Rollback Steps
1. Set all feature flags to `false`
2. App continues to function with existing behavior
3. New routes return 404 or "Feature not enabled"
4. No impact on existing functionality

---

## 10. Next Steps

Proceed to implementation starting with:
1. Create `server/config/featureFlags.ts`
2. Create feature flags API endpoint
3. Begin Financial Kernel schema design

**Estimated Effort**: 5-7 phases, each requiring focused implementation sessions.

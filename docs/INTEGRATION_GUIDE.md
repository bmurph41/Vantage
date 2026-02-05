# Integration Guide

**How to wire these files into the Marinalytics codebase.**

---

## File Placement

Copy the output files into your project:

```
server/
├── middleware/
│   ├── route-auth-guard.ts          ← NEW (Priority 1.1)
│   ├── file-upload-security.ts      ← NEW (Priority 1.2) — replaces existing file-security.ts
│   ├── enhanced-security-headers.ts ← NEW (Priority 1.3)
│   └── pagination.ts               ← NEW (Priority 3.3)
│
├── lib/
│   ├── logger.ts                    ← REPLACE existing (Priority 2.1)
│   ├── tracing.ts                   ← NEW (Priority 2.2)
│   └── response.ts                  ← NEW (Priority 3.2)
│
├── routes/
│   ├── health.ts                    ← NEW (Priority 2.3)
│   └── api-versioning.ts           ← NEW (Priority 3.1)
│
├── services/
│   └── data-retention-service.ts    ← NEW (Priority 4.3)
│
├── __tests__/
│   ├── security/
│   │   ├── auth.test.ts             ← NEW (Priority 5.1)
│   │   ├── tenant-isolation.test.ts ← NEW (Priority 5.1)
│   │   └── file-upload.test.ts      ← NEW (Priority 5.1)
│   └── api/
│       └── response.test.ts         ← NEW (Priority 5.1)
│
client/
└── src/
    └── components/
        └── ErrorBoundary.tsx         ← NEW (Priority 6.1)

docs/
├── BACKUP_RECOVERY_RUNBOOK.md       ← NEW (Priority 4.2)
└── ACCESSIBILITY_CHECKLIST.md       ← NEW (Priority 6.2)

migrations/
└── add-missing-indexes.sql          ← NEW (Priority 4.1)
```

---

## server/index.ts Changes

Add these to your existing `index.ts` middleware chain in order:

```typescript
// ─── EXISTING IMPORTS (keep these) ───────────────────────────────
import { configureSecurityMiddleware } from "./middleware/security";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/logging";
import { centralizedErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { tenantContextMiddleware } from "./middleware/tenant-context";
import { logger } from "./lib/logger";

// ─── NEW IMPORTS ─────────────────────────────────────────────────
import './lib/tracing';  // Must be FIRST import (before express)
import { configureEnhancedSecurityHeaders } from "./middleware/enhanced-security-headers";
import { routeAuthGuard } from "./middleware/route-auth-guard";
import { parsePagination } from "./middleware/pagination";
import healthRoutes from "./routes/health";

// ─── MIDDLEWARE CHAIN (add in this order) ────────────────────────

// 1. Request ID (existing)
app.use(requestIdMiddleware);

// 2. Security headers (existing + enhanced)
configureSecurityMiddleware(app);
configureEnhancedSecurityHeaders(app);  // ← ADD THIS

// 3. Health checks (BEFORE auth, so load balancers can probe)
app.use(healthRoutes);  // ← ADD THIS

// 4. Body parsing, cookies, etc. (existing)
// ...

// 5. Auth + route guard (after existing auth resolver)
app.use('/api', routeAuthGuard());  // ← ADD THIS (after authResolver)

// 6. Pagination defaults on all API routes
app.use('/api', parsePagination);  // ← ADD THIS

// 7. Tenant context (existing)
app.use(tenantContextMiddleware);

// 8. Routes (existing)
// ...

// 9. Error handling (existing)
app.use(notFoundHandler);
app.use(centralizedErrorHandler);
```

---

## Data Retention Cron Job

Add to your background services initialization:

```typescript
// In server/index.ts, after other cron jobs start:
import { DataRetentionService } from './services/data-retention-service';

// Run data retention daily at 3 AM
const retention = new DataRetentionService();
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 3 && now.getMinutes() === 0) {
    retention.run().catch(err => logger.error({ error: err }, 'Data retention failed'));
  }
}, 60 * 1000); // Check every minute
```

---

## Database Indexes

Run the migration during a low-traffic window:

```bash
psql "$DATABASE_URL" < migrations/add-missing-indexes.sql
```

All indexes use `CONCURRENTLY` so they won't lock tables, but they do consume I/O.

---

## Error Boundaries in App.tsx

Wrap your route components:

```tsx
import { PageErrorBoundary, SectionErrorBoundary } from './components/ErrorBoundary';

// In your router:
<Route path="/projects">
  <PageErrorBoundary pageName="Projects">
    <ProjectsPage />
  </PageErrorBoundary>
</Route>

<Route path="/crm">
  <PageErrorBoundary pageName="CRM">
    <CrmPage />
  </PageErrorBoundary>
</Route>

// Within pages, wrap volatile sections:
<SectionErrorBoundary sectionName="Revenue Chart">
  <RevenueChart data={data} />
</SectionErrorBoundary>
```

---

## New NPM Dependencies

Some features require optional packages:

```bash
# Required for OpenTelemetry (Priority 2.2) — only if enabling APM
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources \
  @opentelemetry/semantic-conventions

# Required for Datadog logging (Priority 2.1) — only if using Datadog
npm install pino-datadog-transport

# Required for Loki logging (Priority 2.1) — only if using Grafana/Loki
npm install pino-loki

# Required for tests (Priority 5.1) — if not already installed
npm install -D vitest supertest @types/supertest
```

---

## Environment Variables

Add to your `.env` / deployment config:

```env
# Logging (choose one provider, or leave blank for stdout)
DD_API_KEY=               # Datadog API key
DD_SERVICE=marinalytics   # Datadog service name
LOKI_URL=                 # Grafana Loki endpoint

# OpenTelemetry APM
OTEL_ENABLED=false        # Set to 'true' to enable tracing
OTEL_EXPORTER_ENDPOINT=   # OTLP collector URL
OTEL_SERVICE_NAME=marinalytics

# Redis (for advanced rate limiting)
REDIS_URL=                # Redis connection string
```

---

## Recommended Implementation Order

1. **Route auth guard** + **Response envelope** (low risk, high impact)
2. **Health checks** + **Enhanced security headers** (quick wins)
3. **Pagination middleware** (prevents unbounded queries)
4. **Database indexes** (run migration)
5. **File upload security** (replace existing)
6. **Error boundaries** (frontend resilience)
7. **Test suite** (run, fix any failures)
8. **Logger upgrade** (when ready to choose log provider)
9. **Data retention** (enable after verifying policies)
10. **OpenTelemetry** (when APM vendor is selected)

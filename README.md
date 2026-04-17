# Marina Integrations Bundle

Complete marina operations integration framework for MarinaMatch platform. This bundle provides connectors for syncing data from external marina management systems (DockMaster, Dockwa, Storable Marine, Scribble/MarinaGo, Marina Office) into the Operations modules (Rent Roll, Fuel Sales, Ship Store).

## Files Included

### Server - Connectors (`server/integrations/connectors/`)

| File | Description |
|------|-------------|
| `base.ts` | Abstract BaseConnector class with common patterns for auth, fetch, transform, and save operations |
| `index.ts` | Connector factory registration - imports and registers all connectors |
| `dockmaster.ts` | DockMaster PMS connector - slips, tenants, leases, contacts, receivables |
| `dockwa.ts` | Dockwa reservations connector - slips, reservations, tenants, contacts |
| `scribble.ts` | Scribble/MarinaGo connector - slips, customers, reservations, transactions |
| `storable.ts` | Storable Marine connector - slips, tenants, leases, transactions (HMAC auth) |
| `marina-office.ts` | Marina Office connector - slips, tenants, leases, payments (session-based basic auth) |
| `quickbooks.ts` | QuickBooks connector for accounting integration |

### Server - Utils (`server/integrations/utils/`)

| File | Description |
|------|-------------|
| `credential-encryption.ts` | AES-256-GCM encryption/decryption for secure credential storage |

### Server - Routes (`server/routes/`)

| File | Description |
|------|-------------|
| `marina-integrations-routes.ts` | REST API endpoints for connection management and sync triggers |

### Server - Services (`server/services/`)

| File | Description |
|------|-------------|
| `operations-data-sync.ts` | Orchestration service for syncing data across all modules |
| `marina-integration-adapter.ts` | Abstract adapter framework with factory pattern |

### Client - UI (`client/src/pages/operations/`)

| File | Description |
|------|-------------|
| `integrations.tsx` | React UI page for managing marina integrations |

## Architecture

### Connector Pattern

```
BaseConnector (abstract)
├── testConnection() - Verify credentials and connectivity
├── fetchEntity(type) - Fetch data from external API
├── transformRecord(type, record) - Transform to internal format
└── saveEntity(type, data) - Upsert into database
```

### Sync Flow

```
[Marina PMS] → [Connector] → [Transform] → [Operations Tables]
                                              ├── storage_locations
                                              ├── marina_tenants
                                              ├── marina_leases
                                              ├── fuel_sales
                                              └── ship_store_transactions
```

### Authentication Methods

| Connector | Auth Type | Credentials Required |
|-----------|-----------|---------------------|
| DockMaster | API Key | `apiKey`, `siteId` |
| Dockwa | OAuth2/API Key | `apiKey`, `marinaId` |
| Storable Marine | API Key + HMAC | `apiKey`, `apiSecret`, `facilityId` |
| Scribble | API Key | `apiKey`, `siteCode` |
| Marina Office | Basic Auth + Session | `username`, `password`, `siteUrl` |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/marina-integrations/available` | List available integrations with connection status |
| GET | `/api/marina-integrations/connected` | List connected integrations |
| GET | `/api/marina-integrations/status` | Get sync status for all connected integrations |
| POST | `/api/marina-integrations/connect` | Connect a new integration |
| POST | `/api/marina-integrations/disconnect/:key` | Disconnect an integration |
| POST | `/api/marina-integrations/sync/:key` | Trigger manual sync |
| POST | `/api/marina-integrations/test-connection/:key` | Test connection with credentials |
| GET | `/api/marina-integrations/sync-history/:key` | Get sync history |

## Credential Encryption

Credentials are encrypted using AES-256-GCM before storage:

```typescript
import { encryptCredentials, decryptCredentials } from './utils/credential-encryption';

// Encrypt before storing
const encrypted = encryptCredentials({ apiKey: '...', siteId: '...' });

// Decrypt when needed
const credentials = decryptCredentials(encrypted);
```

Requires `MARINA_INTEGRATION_ENCRYPTION_KEY` or `JWT_SECRET` environment variable (min 16 characters).

## Deduplication

Records are deduplicated using composite key:
- `externalId` - ID from the source system
- `integrationSource` - Connector key (e.g., 'dockmaster', 'storable_marine')

## Schema Drift Check

The project includes a script that compares the Drizzle schema definitions in `shared/schema.ts` against the live database and reports any tables or columns that are missing.

**When to run it:**
- Before deploying to production, to confirm pending schema changes have been migrated
- In CI, to catch pull requests that add schema definitions without a matching migration
- After restoring or cloning a database, to verify the schema is complete

**Run locally:**
```bash
npm run check:schema
```

`DATABASE_URL` must be set in your environment (same connection string used by the app).

**Exit codes:**
- `0` — schema and database are in sync
- `1` — drift detected; the output lists the missing tables and columns
- `2` — the check could not connect to the database

**Recovering from drift:**

If `npm run check:schema` reports drift (exit code `1`), generate migration stubs for the missing tables and columns by running:

```bash
npm run gen:migrations
```

This executes `scripts/generate-startup-migrations.ts` and produces migration files that bring the database in line with the current schema. After generating, review the output files and apply them to your database.

The `schema-drift` job in `.github/workflows/ci.yml` runs this check automatically on every push to `main` or `feat/**` branches and on every pull request targeting `main`, using the `DATABASE_URL` repository secret. If that secret is not configured (e.g. on forked pull requests), the step skips with a warning rather than failing the build.

---

## Schema Drift — Nightly Production Alert

The workflow `.github/workflows/schema-drift-nightly.yml` runs every night at **02:00 UTC** against the production database. It can also be triggered manually from the GitHub Actions UI via **workflow_dispatch** — useful for immediate post-deploy verification.

### How alerts are delivered

| Channel | How it works |
|---------|--------------|
| **GitHub email** | GitHub automatically emails repository watchers / on-call when the workflow run is marked **red** (failed). No extra setup needed. |
| **Slack** | Add a `SLACK_WEBHOOK_URL` repository secret. The workflow POSTs a formatted message to the channel whenever drift is detected. |

To configure Slack:
1. Create an Incoming Webhook in your Slack workspace (Apps → Incoming Webhooks).
2. Add the webhook URL as a repository secret named `SLACK_WEBHOOK_URL` (Settings → Secrets and variables → Actions).

### Required repository secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string for the production database. The job fails with an error if this is missing. |
| `SLACK_WEBHOOK_URL` | Optional | Incoming Webhook URL for Slack alerts. If absent, only GitHub's native email notification fires. |

### On-call runbook

When a nightly drift alert fires (red run or Slack message), follow these steps:

1. **Open the failing run** in GitHub Actions and expand the `Run schema drift check against production database` step to see which tables or columns have drifted.

2. **Reproduce locally** against the production database:
   ```bash
   DATABASE_URL="<prod-connection-string>" npm run check:schema
   ```

3. **Identify the cause** — common scenarios:
   - A migration ran in production but the schema file was never updated (or vice versa).
   - A manual `ALTER TABLE` was applied directly to the production database.
   - A migration was rolled back in production but not in the schema file.

4. **Generate migration stubs** for any missing tables or columns:
   ```bash
   npm run gen:migrations
   ```
   Review the output, adjust as needed, and apply the migration to production.

5. **For orphan or phantom objects** (extra columns/tables in the DB): decide whether to `DROP` them or add a matching Drizzle definition, then commit and deploy.

6. **Verify the fix** by re-running the workflow manually:
   - GitHub Actions → **Schema Drift – Nightly Production Alert** → **Run workflow**.

7. **Post-incident**: document what drifted, why, and how it was resolved in the incident log or the PR description.

### Running the nightly job manually

```bash
# From the GitHub UI:
# Actions → Schema Drift – Nightly Production Alert → Run workflow

# Or via the GitHub CLI:
gh workflow run schema-drift-nightly.yml --field reason="Post-deploy verification"
```

## Usage Example

```typescript
import { ConnectorFactory } from './integrations/connectors';
import { OperationsDataSyncService } from './services/operations-data-sync';

// Create connector instance
const connector = ConnectorFactory.create({
  integrationKey: 'dockmaster',
  credentials: { apiKey: 'xxx', siteId: 'yyy' },
  settings: {},
  userId: 'user-123',
  orgId: 'org-456',
});

// Test connection
const result = await connector.testConnection();

// Or use the sync service
const syncService = new OperationsDataSyncService();
const syncResult = await syncService.syncFromIntegration({
  integrationKey: 'dockmaster',
  userId: 'user-123',
  orgId: 'org-456',
  entityTypes: ['slips', 'tenants', 'leases'],
  fullSync: true,
});
```

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

The `schema-drift` job in `.github/workflows/ci.yml` runs this check automatically on every push to `main` or `feat/**` branches and on every pull request targeting `main`, using the `DATABASE_URL` repository secret. If that secret is not configured (e.g. on forked pull requests), the step skips with a warning rather than failing the build.

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

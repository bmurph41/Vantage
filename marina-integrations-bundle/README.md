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

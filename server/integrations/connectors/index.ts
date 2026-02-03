import { ConnectorFactory, BaseConnector } from './base';
import type { ConnectorConfig } from './base';
import { QuickBooksConnector } from './quickbooks';
import { DockwaConnector } from './dockwa';
import { DockMasterConnector } from './dockmaster';
import { ScribbleConnector } from './scribble';
import { StorableMarineConnector } from './storable';
import { MarinaOfficeConnector } from './marina-office';

ConnectorFactory.register('quickbooks', QuickBooksConnector);
ConnectorFactory.register('dockwa', DockwaConnector);
ConnectorFactory.register('dockmaster', DockMasterConnector);
ConnectorFactory.register('scribble', ScribbleConnector);
ConnectorFactory.register('storable_marine', StorableMarineConnector);
ConnectorFactory.register('marina_office', MarinaOfficeConnector);

export { ConnectorFactory, BaseConnector };
export type { ConnectorConfig };
export { QuickBooksConnector } from './quickbooks';
export { DockwaConnector } from './dockwa';
export { DockMasterConnector } from './dockmaster';
export { ScribbleConnector } from './scribble';
export { StorableMarineConnector } from './storable';
export { MarinaOfficeConnector } from './marina-office';

export type {
  SyncDirection,
  SyncStatus,
  ValidationResult,
  ConnectorCredentials,
  SyncResult,
  EntitySyncConfig,
} from './base';

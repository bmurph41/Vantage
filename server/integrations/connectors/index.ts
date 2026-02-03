import { ConnectorFactory, BaseConnector } from './base';
import type { ConnectorConfig } from './base';
import { QuickBooksConnector } from './quickbooks';
import { DockwaConnector } from './dockwa';
import { DockMasterConnector } from './dockmaster';
import { ScribbleConnector } from './scribble';

ConnectorFactory.register('quickbooks', QuickBooksConnector);
ConnectorFactory.register('dockwa', DockwaConnector);
ConnectorFactory.register('dockmaster', DockMasterConnector);
ConnectorFactory.register('scribble', ScribbleConnector);

export { ConnectorFactory, BaseConnector };
export type { ConnectorConfig };
export { QuickBooksConnector } from './quickbooks';
export { DockwaConnector } from './dockwa';
export { DockMasterConnector } from './dockmaster';
export { ScribbleConnector } from './scribble';

export type {
  SyncDirection,
  SyncStatus,
  ValidationResult,
  ConnectorCredentials,
  SyncResult,
  EntitySyncConfig,
} from './base';

import { ConnectorFactory, BaseConnector } from './base';
import type { ConnectorConfig } from './base';
import { QuickBooksConnector } from './quickbooks';
import { DockwaConnector } from './dockwa';
import { DockMasterConnector } from './dockmaster';
import { ScribbleConnector } from './scribble';
import { StorableMarineConnector } from './storable';
import { MarinaOfficeConnector } from './marina-office';
import { QualiaConnector } from './qualia';
import { DocuSignConnector } from './docusign';
import { SageIntacctConnector } from './sage-intacct';

ConnectorFactory.register('quickbooks', QuickBooksConnector);
ConnectorFactory.register('dockwa', DockwaConnector);
ConnectorFactory.register('dockmaster', DockMasterConnector);
ConnectorFactory.register('scribble', ScribbleConnector);
ConnectorFactory.register('storable_marine', StorableMarineConnector);
ConnectorFactory.register('marina_office', MarinaOfficeConnector);
ConnectorFactory.register('qualia', QualiaConnector);
ConnectorFactory.register('docusign', DocuSignConnector);
ConnectorFactory.register('sage_intacct', SageIntacctConnector);

export { ConnectorFactory, BaseConnector };
export type { ConnectorConfig };
export { QuickBooksConnector } from './quickbooks';
export { DockwaConnector } from './dockwa';
export { DockMasterConnector } from './dockmaster';
export { ScribbleConnector } from './scribble';
export { StorableMarineConnector } from './storable';
export { MarinaOfficeConnector } from './marina-office';
export { QualiaConnector } from './qualia';
export { DocuSignConnector } from './docusign';
export { SageIntacctConnector } from './sage-intacct';

export type {
  SyncDirection,
  SyncStatus,
  ValidationResult,
  ConnectorCredentials,
  SyncResult,
  EntitySyncConfig,
} from './base';

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

// Asset-class integration connectors
import { YardiConnector } from './yardi';
import { RealPageConnector } from './realpage';
import { AppFolioConnector } from './appfolio';
import { EntrataConnector } from './entrata';
import { ResManConnector } from './resman';
import { SiteLinkConnector } from './sitelink';
import { StorEdgeConnector } from './storedge';
import { OperaPmsConnector } from './opera-pms';
import { MewsConnector } from './mews';
import { CloudbedsConnector } from './cloudbeds';
import { GuestyConnector } from './guesty';
import { HospitableConnector } from './hospitable';
import { OwnerRezConnector } from './ownerrez';
import { CampspotConnector } from './campspot';
import { RmsCloudConnector } from './rms-cloud';
import { MriSoftwareConnector } from './mri-software';
import { VtsConnector } from './vts';
import { PropertywareConnector } from './propertyware';
import { BuildiumConnector } from './buildium';
import { RentManagerConnector } from './rent-manager';
import { GustoConnector } from './gusto';
import { AdpConnector } from './adp';
import { CleanCloudConnector } from './cleancloud';
import { XeroConnector } from './xero';

// Register existing connectors
ConnectorFactory.register('quickbooks', QuickBooksConnector);
ConnectorFactory.register('dockwa', DockwaConnector);
ConnectorFactory.register('dockmaster', DockMasterConnector);
ConnectorFactory.register('scribble', ScribbleConnector);
ConnectorFactory.register('storable_marine', StorableMarineConnector);
ConnectorFactory.register('marina_office', MarinaOfficeConnector);
ConnectorFactory.register('qualia', QualiaConnector);
ConnectorFactory.register('docusign', DocuSignConnector);
ConnectorFactory.register('sage_intacct', SageIntacctConnector);

// Register multifamily PMS connectors
ConnectorFactory.register('yardi', YardiConnector);
ConnectorFactory.register('realpage', RealPageConnector);
ConnectorFactory.register('appfolio', AppFolioConnector);
ConnectorFactory.register('entrata', EntrataConnector);
ConnectorFactory.register('resman', ResManConnector);

// Register self-storage PMS connectors
ConnectorFactory.register('sitelink', SiteLinkConnector);
ConnectorFactory.register('storedge', StorEdgeConnector);

// Register hotel PMS connectors
ConnectorFactory.register('opera_pms', OperaPmsConnector);
ConnectorFactory.register('mews', MewsConnector);
ConnectorFactory.register('cloudbeds', CloudbedsConnector);

// Register short-term rental (STR) connectors
ConnectorFactory.register('guesty', GuestyConnector);
ConnectorFactory.register('hospitable', HospitableConnector);
ConnectorFactory.register('ownerrez', OwnerRezConnector);

// Register RV park / campground connectors
ConnectorFactory.register('campspot', CampspotConnector);
ConnectorFactory.register('rms_cloud', RmsCloudConnector);

// Register commercial real estate connectors
ConnectorFactory.register('mri_software', MriSoftwareConnector);
ConnectorFactory.register('vts', VtsConnector);

// Register residential property management connectors
ConnectorFactory.register('propertyware', PropertywareConnector);
ConnectorFactory.register('buildium', BuildiumConnector);
ConnectorFactory.register('rent_manager', RentManagerConnector);

// Register payroll connectors
ConnectorFactory.register('gusto', GustoConnector);
ConnectorFactory.register('adp', AdpConnector);

// Register specialty connectors
ConnectorFactory.register('cleancloud', CleanCloudConnector);
ConnectorFactory.register('xero', XeroConnector);

export { ConnectorFactory, BaseConnector };
export type { ConnectorConfig };

// Existing connector exports
export { QuickBooksConnector } from './quickbooks';
export { DockwaConnector } from './dockwa';
export { DockMasterConnector } from './dockmaster';
export { ScribbleConnector } from './scribble';
export { StorableMarineConnector } from './storable';
export { MarinaOfficeConnector } from './marina-office';
export { QualiaConnector } from './qualia';
export { DocuSignConnector } from './docusign';
export { SageIntacctConnector } from './sage-intacct';

// Asset-class connector exports
export { YardiConnector } from './yardi';
export { RealPageConnector } from './realpage';
export { AppFolioConnector } from './appfolio';
export { EntrataConnector } from './entrata';
export { ResManConnector } from './resman';
export { SiteLinkConnector } from './sitelink';
export { StorEdgeConnector } from './storedge';
export { OperaPmsConnector } from './opera-pms';
export { MewsConnector } from './mews';
export { CloudbedsConnector } from './cloudbeds';
export { GuestyConnector } from './guesty';
export { HospitableConnector } from './hospitable';
export { OwnerRezConnector } from './ownerrez';
export { CampspotConnector } from './campspot';
export { RmsCloudConnector } from './rms-cloud';
export { MriSoftwareConnector } from './mri-software';
export { VtsConnector } from './vts';
export { PropertywareConnector } from './propertyware';
export { BuildiumConnector } from './buildium';
export { RentManagerConnector } from './rent-manager';
export { GustoConnector } from './gusto';
export { AdpConnector } from './adp';
export { CleanCloudConnector } from './cleancloud';
export { XeroConnector } from './xero';

export type {
  SyncDirection,
  SyncStatus,
  ValidationResult,
  ConnectorCredentials,
  SyncResult,
  EntitySyncConfig,
} from './base';

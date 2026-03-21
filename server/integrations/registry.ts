export type AuthType = "oauth" | "apiKey" | "none";

export type ConnectionGuide = {
  overview: string;
  prerequisites: string[];
  steps: Array<{
    title: string;
    description: string;
    screenshot?: string;
  }>;
  supportUrl?: string;
  apiDocsUrl?: string;
  estimatedTime: string;
};

export type DataMapping = {
  sourceEntity: string;
  targetModule: string;
  targetEntity: string;
  fields: Array<{
    source: string;
    target: string;
    transform?: string;
  }>;
  syncDirection: "read" | "write" | "bidirectional";
  frequency: "realtime" | "hourly" | "daily" | "weekly" | "manual";
};

export type IntegrationRegistryItem = {
  key: string;
  name: string;
  description: string;
  category: "Marina PMS" | "Multifamily PMS" | "Self-Storage Management" | "Hotel PMS" | "STR Management" | "RV Park Management" | "Commercial RE" | "Residential PM" | "Payroll & HR" | "Reservations & Booking" | "Service & Maintenance" | "Communications" | "Accounting" | "Transaction Management" | "Document & E-Signature" | "Business Operations";
  assetClasses: string[];
  contexts: Array<
    "boatRentals" | "fuelSales" | "financials" | "crm" | "documents" | "analytics" | "marketing" | "rentRoll" | "shipStore" | "dockit" | "service" | "bookkeeping" | string
  >;
  uiPlacements: string[];
  authType: AuthType;
  websiteUrl?: string;
  iconUrl?: string;
  logoColor?: string;
  capabilities: {
    dataRead: string[];
    dataWrite: string[];
    actions: string[];
    uiHooks: string[];
  };
  settingsSchema: {
    fields: Array<{
      key: string;
      label: string;
      type: "string" | "number" | "boolean" | "select" | "secret";
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
      helpText?: string;
    }>;
  };
  connectionGuide: ConnectionGuide;
  dataMappings: DataMapping[];
  migrationSupport: {
    canExportAll: boolean;
    supportsHistoricalImport: boolean;
    migrationComplexity: "low" | "medium" | "high";
    estimatedMigrationDays: number;
  };
};

export const INTEGRATION_REGISTRY: IntegrationRegistryItem[] = [
  // ============ MARINA PMS / OPERATIONS ============
  {
    key: "dockmaster",
    name: "Dockmaster",
    description: "Industry-leading marina management software for slip reservations, billing, and tenant management. Full data sync with MarinaMatch for complete operational visibility.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "crm", "financials", "boatRentals"],
    uiPlacements: ["rentRoll.integrations.panel", "rentRoll.actions.importLeases", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://dfrpms.com/",
    iconUrl: "/assets/integrations/dockmaster.svg",
    logoColor: "#1E4FAB",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.slips", "crm.contacts", "financials.receivables", "boatRentals.reservations"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "crm.sync"],
      uiHooks: ["rentRoll.toolbar.importButton", "crm.toolbar.syncButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Found in Dockmaster Admin > API Settings. Stored encrypted." },
        { key: "siteId", label: "Site ID", type: "string", required: true, helpText: "Your unique Dockmaster site identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Every Hour", value: "hourly" },
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ], helpText: "How often to pull updates from Dockmaster." },
      ],
    },
    connectionGuide: {
      overview: "Connect Dockmaster to automatically sync your marina's slip inventory, tenant information, lease agreements, and billing data into MarinaMatch.",
      prerequisites: [
        "Dockmaster account with API access enabled",
        "Admin-level access to generate API credentials",
        "Your Dockmaster Site ID (found in Settings > Account)"
      ],
      steps: [
        { title: "Log into Dockmaster Admin", description: "Go to your Dockmaster admin panel and navigate to Settings > API Configuration." },
        { title: "Generate API Key", description: "Click 'Generate New API Key' and copy the key. This will only be shown once." },
        { title: "Find Your Site ID", description: "Navigate to Settings > Account. Your Site ID is displayed at the top of the page." },
        { title: "Enter Credentials", description: "Paste your API Key and Site ID into the fields below. MarinaMatch will securely encrypt and store them." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify the credentials work correctly." },
        { title: "Configure Sync", description: "Choose how often you want data to sync and which modules to import." }
      ],
      supportUrl: "https://support.dfrpms.com/",
      apiDocsUrl: "https://developer.dfrpms.com/docs",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "slips", targetModule: "rentRoll", targetEntity: "locations", fields: [
        { source: "slip_id", target: "externalId" },
        { source: "slip_name", target: "name" },
        { source: "length", target: "length" },
        { source: "width", target: "width" },
        { source: "rate", target: "baseRate" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "customers", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "customer_id", target: "externalId" },
        { source: "first_name", target: "firstName" },
        { source: "last_name", target: "lastName" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "reservations", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "reservation_id", target: "externalId" },
        { source: "start_date", target: "startDate" },
        { source: "end_date", target: "endDate" },
        { source: "total_amount", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "marinaoffice",
    name: "Marina Office",
    description: "Comprehensive marina management with billing automation, work orders, and customer portals. Sync reservations, billing, and customer data seamlessly.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://marinaoffice.com/",
    iconUrl: "/assets/integrations/marinaoffice.svg",
    logoColor: "#0066CC",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.billing", "financials.receivables", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "financials.sync"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Generate from Marina Office Settings > Integrations." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "Found in your Marina Office account settings." },
        { key: "includeBilling", label: "Include Billing Data", type: "boolean", helpText: "Sync invoices and payment history." },
      ],
    },
    connectionGuide: {
      overview: "Connect Marina Office to import your property data, tenant information, and billing records into MarinaMatch for unified management.",
      prerequisites: [
        "Marina Office subscription with API access",
        "Property administrator privileges",
        "Property ID from account settings"
      ],
      steps: [
        { title: "Access Integration Settings", description: "In Marina Office, go to Settings > Integrations > API Access." },
        { title: "Create API Credentials", description: "Click 'Add Integration' and select 'MarinaMatch' or 'Custom Integration'." },
        { title: "Copy API Key", description: "Copy the generated API key. Store it safely as it won't be shown again." },
        { title: "Locate Property ID", description: "Go to Settings > Account. Your Property ID is listed under 'Account Details'." },
        { title: "Connect in MarinaMatch", description: "Enter your credentials below and test the connection." }
      ],
      supportUrl: "https://help.marinaoffice.com/",
      apiDocsUrl: "https://developer.marinaoffice.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "tenant_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "contact_email", target: "email" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "invoices", targetModule: "financials", targetEntity: "receivables", fields: [
        { source: "invoice_id", target: "externalId" },
        { source: "amount", target: "amount" },
        { source: "due_date", target: "dueDate" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "sharper_mms",
    name: "Sharper MMS",
    description: "Marina Management System with robust slip management, waiting lists, and service scheduling. Ideal for full-service marinas.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "crm", "boatRentals"],
    uiPlacements: ["rentRoll.integrations.panel", "boatRentals.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://sharpermms.com/",
    iconUrl: "/assets/integrations/sharper.svg",
    logoColor: "#2E7D32",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.waitlist", "crm.contacts", "boatRentals.reservations"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.syncWaitlist"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "From Sharper MMS Admin > API Settings." },
        { key: "marinaCode", label: "Marina Code", type: "string", required: true, helpText: "Your unique marina identifier in Sharper MMS." },
        { key: "includeWaitlist", label: "Sync Waitlist", type: "boolean", helpText: "Import waiting list entries as CRM leads." },
      ],
    },
    connectionGuide: {
      overview: "Connect Sharper MMS to sync your marina's slip inventory, tenant data, waiting lists, and service schedules into MarinaMatch.",
      prerequisites: [
        "Sharper MMS subscription with API module enabled",
        "Administrator access level",
        "Marina Code from system settings"
      ],
      steps: [
        { title: "Enable API Access", description: "Contact Sharper MMS support to enable API access for your account." },
        { title: "Generate API Key", description: "Once enabled, go to Admin > System Settings > API Configuration." },
        { title: "Copy Credentials", description: "Copy your API Key and Marina Code from the settings page." },
        { title: "Configure MarinaMatch", description: "Enter credentials below and select which data to sync." }
      ],
      supportUrl: "https://support.sharpermms.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "slips", targetModule: "rentRoll", targetEntity: "locations", fields: [
        { source: "slip_number", target: "name" },
        { source: "length_feet", target: "length" },
        { source: "monthly_rate", target: "baseRate" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "waitlist", targetModule: "crm", targetEntity: "leads", fields: [
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "requested_size", target: "notes" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 21
    }
  },
  {
    key: "storable_marine",
    name: "Storable Marine",
    description: "Cloud-based marina management from Storable, featuring automated billing, online reservations, and tenant portals.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.storable.com/marine/",
    iconUrl: "/assets/integrations/storable.svg",
    logoColor: "#FF6B00",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "financials.billing", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "financials.sync"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Storable Marine API key from the Developer settings." },
        { key: "apiSecret", label: "API Secret", type: "secret", required: true, helpText: "Your Storable Marine API secret. Stored encrypted." },
        { key: "facilityId", label: "Facility ID", type: "string", required: true, helpText: "Your Storable Marine facility identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Storable Marine using your API credentials for secure, automatic data sync.",
      prerequisites: [
        "Storable Marine account with admin access",
        "API credentials from Developer settings",
        "Facility ID from your account dashboard"
      ],
      steps: [
        { title: "Access Developer Settings", description: "Log into Storable Marine and navigate to Settings > Developer > API Access." },
        { title: "Generate API Credentials", description: "Click 'Create API Key' and copy both the API Key and Secret." },
        { title: "Find Facility ID", description: "Your Facility ID is shown on the main dashboard or in Account Settings." },
        { title: "Enter Credentials", description: "Paste your API Key, Secret, and Facility ID into the fields above." }
      ],
      supportUrl: "https://support.storable.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 7
    }
  },
  {
    key: "docklyne",
    name: "Docklyne",
    description: "Modern marina operations platform with integrated payments, digital contracts, and real-time occupancy tracking.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://docklyne.com/",
    iconUrl: "/assets/integrations/docklyne.svg",
    logoColor: "#00B4D8",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.occupancy", "financials.payments", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.syncOccupancy"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Generate from Docklyne Settings > Developer." },
        { key: "marinaId", label: "Marina ID", type: "string", required: true },
      ],
    },
    connectionGuide: {
      overview: "Connect Docklyne to sync real-time occupancy data, digital contracts, and payment information.",
      prerequisites: [
        "Docklyne account with Developer access",
        "Marina ID from account settings"
      ],
      steps: [
        { title: "Access Developer Settings", description: "In Docklyne, navigate to Settings > Developer > API Keys." },
        { title: "Create New Key", description: "Click 'Create API Key' and name it 'MarinaMatch Integration'." },
        { title: "Copy Credentials", description: "Copy the API Key and your Marina ID." },
        { title: "Complete Setup", description: "Paste credentials below and test the connection." }
      ],
      supportUrl: "https://help.docklyne.com/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "lease_id", target: "externalId" },
        { source: "start", target: "startDate" },
        { source: "end", target: "endDate" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 7
    }
  },
  {
    key: "elitemarinas",
    name: "EliteMarinas",
    description: "Premium marina management for yacht clubs and luxury marinas. Comprehensive member management and event coordination.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "crm", "marketing"],
    uiPlacements: ["rentRoll.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://elitemarinas.com/",
    iconUrl: "/assets/integrations/elitemarinas.svg",
    logoColor: "#8B4513",
    capabilities: {
      dataRead: ["rentRoll.leases", "crm.members", "marketing.events"],
      dataWrite: [],
      actions: ["rentRoll.import", "crm.syncMembers"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "clubId", label: "Club ID", type: "string", required: true },
        { key: "includeMembership", label: "Sync Membership Data", type: "boolean" },
      ],
    },
    connectionGuide: {
      overview: "Connect EliteMarinas to sync member data, slip assignments, and event information.",
      prerequisites: [
        "EliteMarinas subscription",
        "Manager or Admin access",
        "Club ID from account dashboard"
      ],
      steps: [
        { title: "Request API Access", description: "Contact EliteMarinas support to enable API access for your club." },
        { title: "Generate Credentials", description: "Once approved, access Settings > API to generate your key." },
        { title: "Enter Details", description: "Input your API Key and Club ID below." }
      ],
      supportUrl: "https://support.elitemarinas.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "members", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "member_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "membership_type", target: "category" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "boatcloud",
    name: "BoatCloud",
    description: "Cloud-native marina software with IoT integrations for smart marina operations, including sensor data and automated alerts.",
    category: "Marina PMS",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://boatcloud.io/",
    iconUrl: "/assets/integrations/boatcloud.svg",
    logoColor: "#4A90D9",
    capabilities: {
      dataRead: ["rentRoll.leases", "analytics.sensorData", "analytics.occupancy"],
      dataWrite: [],
      actions: ["analytics.syncSensors"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your BoatCloud API key from Developer settings." },
        { key: "apiSecret", label: "API Secret", type: "secret", required: true, helpText: "Your BoatCloud API secret. Stored encrypted." },
        { key: "locationId", label: "Location ID", type: "string", required: true, helpText: "Your marina's Location ID from the dashboard." },
        { key: "includeSensorData", label: "Include IoT Sensor Data", type: "boolean" },
      ],
    },
    connectionGuide: {
      overview: "Connect BoatCloud using your API credentials for seamless integration of IoT data and occupancy analytics.",
      prerequisites: [
        "BoatCloud account with API tier",
        "API credentials from Developer settings",
        "Location ID from dashboard"
      ],
      steps: [
        { title: "Access Developer Settings", description: "Log into BoatCloud and go to Settings > Developer > API Keys." },
        { title: "Generate API Credentials", description: "Create a new API key and copy both the Key and Secret." },
        { title: "Find Location ID", description: "Your Location ID is on the main dashboard or in Account Settings." },
        { title: "Enter Credentials", description: "Paste your API Key, Secret, and Location ID into the fields above." }
      ],
      supportUrl: "https://support.boatcloud.io/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "occupancy", targetModule: "analytics", targetEntity: "metrics", fields: [
        { source: "date", target: "date" },
        { source: "occupied_slips", target: "value" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },

  // ============ RESERVATIONS & BOOKING ============
  {
    key: "fareharbor",
    name: "FareHarbor",
    description: "Leading booking platform for tours, rentals, and activities. Sync boat rental reservations and customer data in real-time.",
    category: "Reservations & Booking",
    assetClasses: ["marina", "str", "rv_park"],
    contexts: ["boatRentals"],
    uiPlacements: ["boatRentals.integrations.panel", "boatRentals.actions.importReservations"],
    authType: "apiKey",
    websiteUrl: "https://fareharbor.com/",
    iconUrl: "/assets/integrations/fareharbor.svg",
    logoColor: "#00A3E0",
    capabilities: {
      dataRead: ["boatRentals.reservations", "boatRentals.customers", "boatRentals.availability"],
      dataWrite: ["boatRentals.availability"],
      actions: ["boatRentals.import", "boatRentals.sync"],
      uiHooks: ["boatRentals.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Found in FareHarbor Dashboard > API Settings." },
        { key: "shortname", label: "Company Shortname", type: "string", required: true, helpText: "Your FareHarbor company identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Real-time", value: "realtime" },
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect FareHarbor to automatically sync boat rental reservations, availability, and customer information.",
      prerequisites: [
        "FareHarbor account with API access",
        "Company shortname from your dashboard",
        "API key from FareHarbor settings"
      ],
      steps: [
        { title: "Access API Settings", description: "Log into FareHarbor and go to Dashboard > Settings > API." },
        { title: "Generate or Copy API Key", description: "Create a new API key or copy your existing one." },
        { title: "Find Company Shortname", description: "Your shortname is in the URL when logged in: fareharbor.com/yourshortname/" },
        { title: "Enter Credentials", description: "Paste your API key and shortname below." },
        { title: "Choose Sync Mode", description: "Select real-time for instant updates or hourly/daily for batched sync." }
      ],
      supportUrl: "https://help.fareharbor.com/",
      apiDocsUrl: "https://fareharbor.com/api/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "bookings", targetModule: "boatRentals", targetEntity: "reservations", fields: [
        { source: "pk", target: "externalId" },
        { source: "start_at", target: "startTime" },
        { source: "end_at", target: "endTime" },
        { source: "status", target: "status" },
        { source: "total", target: "totalAmount" }
      ], syncDirection: "read", frequency: "realtime" },
      { sourceEntity: "customers", targetModule: "boatRentals", targetEntity: "customers", fields: [
        { source: "pk", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 3
    }
  },
  {
    key: "dockwa",
    name: "Dockwa",
    description: "The #1 marina reservation platform. Sync transient bookings, payments, and boater profiles directly into MarinaMatch.",
    category: "Reservations & Booking",
    assetClasses: ["marina"],
    contexts: ["boatRentals", "rentRoll", "crm"],
    uiPlacements: ["boatRentals.integrations.panel", "rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://dockwa.com/",
    iconUrl: "/assets/integrations/dockwa.svg",
    logoColor: "#0077B5",
    capabilities: {
      dataRead: ["boatRentals.reservations", "rentRoll.transients", "crm.boaters"],
      dataWrite: ["boatRentals.availability"],
      actions: ["boatRentals.sync", "rentRoll.importTransients"],
      uiHooks: ["boatRentals.toolbar.dockwaButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Dockwa API key from the Developer portal." },
        { key: "apiSecret", label: "API Secret", type: "secret", required: true, helpText: "Your Dockwa API secret. Stored encrypted." },
        { key: "marinaId", label: "Marina ID", type: "string", required: true, helpText: "Found in Dockwa Pro dashboard." },
        { key: "syncTransients", label: "Sync Transient Bookings", type: "boolean", helpText: "Include transient/visitor reservations." },
        { key: "syncAvailability", label: "Push Availability", type: "boolean", helpText: "Update Dockwa availability from MarinaMatch." },
      ],
    },
    connectionGuide: {
      overview: "Connect Dockwa using your API credentials to sync transient reservations and boater data bidirectionally.",
      prerequisites: [
        "Dockwa Pro subscription",
        "Marina administrator access",
        "API credentials from Developer portal"
      ],
      steps: [
        { title: "Access Developer Portal", description: "Log into Dockwa Pro and navigate to Settings > Developer > API Access." },
        { title: "Generate API Credentials", description: "Create a new API key and copy both the Key and Secret." },
        { title: "Find Marina ID", description: "Your Marina ID is shown in your dashboard header or Account Settings." },
        { title: "Enter Credentials", description: "Paste your API Key, Secret, and Marina ID into the fields above." },
        { title: "Configure Options", description: "Enable transient sync and availability push as needed." }
      ],
      supportUrl: "https://help.dockwa.com/",
      apiDocsUrl: "https://developer.dockwa.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "reservations", targetModule: "boatRentals", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "check_in", target: "startDate" },
        { source: "check_out", target: "endDate" },
        { source: "slip_assignment", target: "slipId" }
      ], syncDirection: "bidirectional", frequency: "realtime" },
      { sourceEntity: "boaters", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "boater_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "boat_name", target: "vesselName" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },
  {
    key: "snagaslip",
    name: "Snag-A-Slip",
    description: "Popular marina booking marketplace. Import reservations from the Snag-A-Slip network directly into your operations.",
    category: "Reservations & Booking",
    assetClasses: ["marina"],
    contexts: ["boatRentals", "rentRoll"],
    uiPlacements: ["boatRentals.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://snagaslip.com/",
    iconUrl: "/assets/integrations/snagaslip.svg",
    logoColor: "#E63946",
    capabilities: {
      dataRead: ["boatRentals.reservations", "rentRoll.transients"],
      dataWrite: [],
      actions: ["boatRentals.import"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "propertyCode", label: "Property Code", type: "string", required: true },
      ],
    },
    connectionGuide: {
      overview: "Connect Snag-A-Slip to import bookings made through their marketplace into MarinaMatch.",
      prerequisites: [
        "Snag-A-Slip marina partner account",
        "API credentials from partner portal"
      ],
      steps: [
        { title: "Access Partner Portal", description: "Log into the Snag-A-Slip partner portal." },
        { title: "Navigate to Integrations", description: "Go to Settings > API & Integrations." },
        { title: "Generate API Key", description: "Create a new API key for MarinaMatch." },
        { title: "Copy Property Code", description: "Find your property code in account settings." },
        { title: "Complete Connection", description: "Enter both values below to connect." }
      ],
      supportUrl: "https://snagaslip.com/support/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "bookings", targetModule: "boatRentals", targetEntity: "reservations", fields: [
        { source: "booking_id", target: "externalId" },
        { source: "arrival", target: "startDate" },
        { source: "departure", target: "endDate" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: false,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 2
    }
  },
  {
    key: "marinago",
    name: "MarinaGo",
    description: "Mobile-first marina booking app with digital check-in. Sync reservations and guest communications seamlessly.",
    category: "Reservations & Booking",
    assetClasses: ["marina"],
    contexts: ["boatRentals", "crm"],
    uiPlacements: ["boatRentals.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://marinago.com/",
    iconUrl: "/assets/integrations/marinago.svg",
    logoColor: "#4CAF50",
    capabilities: {
      dataRead: ["boatRentals.reservations", "boatRentals.checkIns", "crm.guests"],
      dataWrite: [],
      actions: ["boatRentals.import", "boatRentals.syncCheckIns"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "venueId", label: "Venue ID", type: "string", required: true },
        { key: "includeCheckIns", label: "Sync Check-in Data", type: "boolean" },
      ],
    },
    connectionGuide: {
      overview: "Connect MarinaGo to import mobile bookings and digital check-in data.",
      prerequisites: [
        "MarinaGo business account",
        "API access enabled (contact support)"
      ],
      steps: [
        { title: "Request API Access", description: "Email support@marinago.com to enable API access." },
        { title: "Receive Credentials", description: "You'll receive your API Key and Venue ID via email." },
        { title: "Enter Credentials", description: "Input both values below to complete setup." }
      ],
      supportUrl: "https://marinago.com/support/",
      estimatedTime: "1-2 days (API approval required)"
    },
    dataMappings: [
      { sourceEntity: "reservations", targetModule: "boatRentals", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "start_date", target: "startDate" },
        { source: "end_date", target: "endDate" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 3
    }
  },

  // ============ SERVICE & MAINTENANCE ============
  {
    key: "boatyard",
    name: "Boatyard",
    description: "Digital service management for marine service centers. Track work orders, parts, and customer communications.",
    category: "Service & Maintenance",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "crm", "service"],
    uiPlacements: ["rentRoll.integrations.panel", "service.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://boatyard.com/",
    iconUrl: "/assets/integrations/boatyard.svg",
    logoColor: "#FF9800",
    capabilities: {
      dataRead: ["rentRoll.serviceOrders", "crm.boatOwners"],
      dataWrite: [],
      actions: ["rentRoll.importServices"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "yardId", label: "Yard ID", type: "string", required: true },
        { key: "includeCompleted", label: "Include Completed Orders", type: "boolean" },
      ],
    },
    connectionGuide: {
      overview: "Connect Boatyard to sync work orders and service history for boats at your marina.",
      prerequisites: [
        "Boatyard Pro subscription",
        "Manager access level"
      ],
      steps: [
        { title: "Access Settings", description: "In Boatyard, go to Settings > Integrations." },
        { title: "Enable API", description: "Toggle 'Enable API Access' and generate a key." },
        { title: "Copy Yard ID", description: "Your Yard ID is shown in Account > General." },
        { title: "Connect", description: "Enter credentials below to start syncing." }
      ],
      supportUrl: "https://help.boatyard.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "work_orders", targetModule: "rentRoll", targetEntity: "serviceOrders", fields: [
        { source: "order_id", target: "externalId" },
        { source: "boat_name", target: "vesselName" },
        { source: "status", target: "status" },
        { source: "total", target: "amount" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },
  {
    key: "speedydock",
    name: "SpeedyDock",
    description: "Streamlined boat handling and scheduling. Coordinate haul-outs, launches, and service appointments efficiently.",
    category: "Service & Maintenance",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "boatRentals", "dockit"],
    uiPlacements: ["rentRoll.integrations.panel", "dockit.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://speedydock.com/",
    iconUrl: "/assets/integrations/speedydock.svg",
    logoColor: "#1976D2",
    capabilities: {
      dataRead: ["rentRoll.scheduling", "boatRentals.launches"],
      dataWrite: [],
      actions: ["rentRoll.syncSchedule"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "locationId", label: "Location ID", type: "string", required: true },
      ],
    },
    connectionGuide: {
      overview: "Connect SpeedyDock to sync boat handling schedules, launches, and haul-out appointments.",
      prerequisites: [
        "SpeedyDock subscription",
        "Location administrator access"
      ],
      steps: [
        { title: "Log Into SpeedyDock", description: "Access your SpeedyDock dashboard." },
        { title: "Go to API Settings", description: "Navigate to Settings > API Configuration." },
        { title: "Generate Key", description: "Create a new API key for MarinaMatch integration." },
        { title: "Enter Details", description: "Provide your API Key and Location ID below." }
      ],
      supportUrl: "https://support.speedydock.com/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "schedule", targetModule: "rentRoll", targetEntity: "schedule", fields: [
        { source: "event_id", target: "externalId" },
        { source: "boat_id", target: "vesselId" },
        { source: "event_type", target: "type" },
        { source: "scheduled_time", target: "scheduledAt" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 3
    }
  },

  // ============ COMMUNICATIONS ============
  {
    key: "scribble",
    name: "Scribble",
    description: "Marina-focused communication platform with automated messaging, surveys, and tenant engagement tools.",
    category: "Communications",
    assetClasses: ["marina"],
    contexts: ["marketing", "crm"],
    uiPlacements: ["marketing.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://scribble.io/",
    iconUrl: "/assets/integrations/scribble.svg",
    logoColor: "#9C27B0",
    capabilities: {
      dataRead: ["marketing.messages", "crm.communications"],
      dataWrite: ["marketing.lists", "crm.contacts"],
      actions: ["marketing.sendMessage", "crm.syncContacts"],
      uiHooks: ["crm.actions.sendMessage"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "accountId", label: "Account ID", type: "string", required: true },
        { key: "defaultSenderId", label: "Default Sender", type: "string", helpText: "Phone number or email to send from." },
      ],
    },
    connectionGuide: {
      overview: "Connect Scribble for automated tenant communications, surveys, and engagement tracking.",
      prerequisites: [
        "Scribble marina plan",
        "Account with messaging enabled"
      ],
      steps: [
        { title: "Access API Dashboard", description: "Log into Scribble and go to Settings > API." },
        { title: "Create API Key", description: "Click 'New Key' and name it 'MarinaMatch'." },
        { title: "Copy Account ID", description: "Find your Account ID at the top of the dashboard." },
        { title: "Set Default Sender", description: "Choose which phone number or email to use for outbound messages." }
      ],
      supportUrl: "https://support.scribble.io/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "contacts", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "contact_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "phone", target: "phone" }
      ], syncDirection: "bidirectional", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 2
    }
  },
  {
    key: "molo",
    name: "Molo",
    description: "Smart marina access and communication app. Digital gate access, push notifications, and tenant self-service.",
    category: "Communications",
    assetClasses: ["marina"],
    contexts: ["rentRoll", "crm"],
    uiPlacements: ["rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://molo.io/",
    iconUrl: "/assets/integrations/molo.svg",
    logoColor: "#00BCD4",
    capabilities: {
      dataRead: ["rentRoll.accessLogs", "crm.tenants"],
      dataWrite: ["rentRoll.accessPermissions"],
      actions: ["rentRoll.grantAccess", "rentRoll.revokeAccess"],
      uiHooks: ["rentRoll.actions.manageAccess"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Molo API key from Admin settings." },
        { key: "apiSecret", label: "API Secret", type: "secret", required: true, helpText: "Your Molo API secret. Stored encrypted." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "Your property ID from the Molo dashboard." },
        { key: "syncAccessLogs", label: "Sync Access Logs", type: "boolean", helpText: "Import gate access history." },
      ],
    },
    connectionGuide: {
      overview: "Connect Molo using your API credentials to manage digital access and sync gate entry logs.",
      prerequisites: [
        "Molo Pro subscription",
        "Property administrator access",
        "API credentials from Admin settings"
      ],
      steps: [
        { title: "Access Admin Settings", description: "Log into Molo and go to Admin > Integrations > API Keys." },
        { title: "Generate API Credentials", description: "Click 'Create API Key' and copy both the Key and Secret." },
        { title: "Find Property ID", description: "Your Property ID is shown in the dashboard header or Account Settings." },
        { title: "Enter Credentials", description: "Paste your API Key, Secret, and Property ID into the fields above." },
        { title: "Configure Sync", description: "Enable access log sync for security tracking." }
      ],
      supportUrl: "https://help.molo.io/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "access_logs", targetModule: "rentRoll", targetEntity: "accessLogs", fields: [
        { source: "log_id", target: "externalId" },
        { source: "user_id", target: "tenantId" },
        { source: "timestamp", target: "accessedAt" },
        { source: "gate_name", target: "location" }
      ], syncDirection: "read", frequency: "realtime" }
    ],
    migrationSupport: {
      canExportAll: false,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 2
    }
  },

  // ============ ACCOUNTING ============
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    description: "Industry-standard accounting software. Sync your P&L, Chart of Accounts, invoices, and payments for complete financial visibility.",
    category: "Accounting",
    assetClasses: ["marina", "multifamily", "retail", "office", "industrial", "hotel", "str", "self_storage", "sfr", "rv_park", "mobile_home", "business", "laundromat", "mixed_use", "medical_office", "land", "duplex", "triplex", "quad"],
    contexts: ["financials", "bookkeeping"],
    uiPlacements: ["financials.integrations.panel", "financials.toolbar.importButton", "bookkeeping.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://quickbooks.intuit.com/",
    iconUrl: "/assets/integrations/quickbooks.svg",
    logoColor: "#2CA01C",
    capabilities: {
      dataRead: ["financials.pnl", "financials.coa", "financials.invoices", "financials.payments"],
      dataWrite: [],
      actions: ["financials.import", "financials.sync"],
      uiHooks: ["financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "Client ID", type: "secret", required: true, helpText: "Your QuickBooks app Client ID from the Intuit Developer Portal." },
        { key: "clientSecret", label: "Client Secret", type: "secret", required: true, helpText: "Your QuickBooks app Client Secret. Stored encrypted." },
        { key: "realmId", label: "Realm ID (Company ID)", type: "string", required: true, helpText: "Your QuickBooks company's Realm ID. Found in your QuickBooks URL." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
          { label: "Monthly", value: "monthly" },
        ] },
        { key: "syncInvoices", label: "Sync Invoices", type: "boolean", helpText: "Import A/R data from QuickBooks." },
        { key: "syncPayments", label: "Sync Payments", type: "boolean", helpText: "Import payment records." },
      ],
    },
    connectionGuide: {
      overview: "Connect QuickBooks Online using your API credentials to sync your complete financial data—P&L statements, Chart of Accounts, invoices, and payments.",
      prerequisites: [
        "QuickBooks Online subscription (Plus, Advanced, or Accountant)",
        "Intuit Developer account with a registered app",
        "Client ID, Client Secret, and Realm ID from your QuickBooks app"
      ],
      steps: [
        { title: "Create a QuickBooks App", description: "Go to developer.intuit.com and create a new app. Select 'Accounting' as the scope." },
        { title: "Get Your Client ID & Secret", description: "In your app's Keys & OAuth section, copy the Client ID and Client Secret." },
        { title: "Find Your Realm ID", description: "Log into QuickBooks Online. The Realm ID is in the URL after /app/ (e.g., qbo.intuit.com/app/123456789)." },
        { title: "Enter Credentials", description: "Paste your Client ID, Client Secret, and Realm ID into the fields above." },
        { title: "Configure Sync Options", description: "Choose how often to sync and which data types to include." },
        { title: "Test Connection", description: "Click Connect to verify your credentials and start the initial data import." }
      ],
      supportUrl: "https://quickbooks.intuit.com/learn-support/",
      apiDocsUrl: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "ProfitAndLoss", targetModule: "financials", targetEntity: "pnl", fields: [
        { source: "ReportDate", target: "reportDate" },
        { source: "Rows", target: "lineItems", transform: "qbo_pnl_transform" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Account", targetModule: "financials", targetEntity: "chartOfAccounts", fields: [
        { source: "Id", target: "externalId" },
        { source: "Name", target: "name" },
        { source: "AccountType", target: "type" },
        { source: "CurrentBalance", target: "balance" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Invoice", targetModule: "financials", targetEntity: "invoices", fields: [
        { source: "Id", target: "externalId" },
        { source: "TotalAmt", target: "amount" },
        { source: "DueDate", target: "dueDate" },
        { source: "Balance", target: "balance" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Payment", targetModule: "financials", targetEntity: "payments", fields: [
        { source: "Id", target: "externalId" },
        { source: "TotalAmt", target: "amount" },
        { source: "TxnDate", target: "paymentDate" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 30
    }
  },

  // ============ ACCOUNTING (ENTERPRISE) ============
  {
    key: "sage_intacct",
    name: "Sage Intacct",
    description: "Enterprise-grade cloud accounting for institutional marina operators and PE-backed portfolios. Sync multi-entity financials, GL, AP/AR, and dimensional reporting into MarinaMatch for sophisticated underwriting and portfolio analysis.",
    category: "Accounting",
    assetClasses: ["marina", "multifamily", "retail", "office", "industrial", "hotel", "str", "self_storage", "sfr", "rv_park", "mobile_home", "business", "laundromat", "mixed_use", "medical_office", "land", "duplex", "triplex", "quad"],
    contexts: ["financials", "bookkeeping", "analytics"],
    uiPlacements: ["financials.integrations.panel", "financials.toolbar.importButton", "bookkeeping.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.sage.com/en-us/sage-business-cloud/intacct/",
    iconUrl: "/assets/integrations/sage-intacct.svg",
    logoColor: "#00DC00",
    capabilities: {
      dataRead: ["financials.pnl", "financials.coa", "financials.gl", "financials.invoices", "financials.payments", "financials.budgets", "financials.dimensions"],
      dataWrite: [],
      actions: ["financials.import", "financials.sync", "financials.multiEntitySync"],
      uiHooks: ["financials.toolbar.importButton", "bookkeeping.toolbar.syncButton"],
    },
    settingsSchema: {
      fields: [
        { key: "companyId", label: "Company ID", type: "string", required: true, helpText: "Your Sage Intacct Company ID (found in Company > Company Info)." },
        { key: "userId", label: "Web Services User ID", type: "string", required: true, helpText: "The Web Services user configured for API access." },
        { key: "userPassword", label: "Web Services Password", type: "secret", required: true, helpText: "Password for the Web Services user. Stored encrypted." },
        { key: "senderId", label: "Sender ID", type: "string", required: true, helpText: "Your Marketplace Sender ID provided by Sage." },
        { key: "senderPassword", label: "Sender Password", type: "secret", required: true, helpText: "Sender password from your Marketplace listing. Stored encrypted." },
        { key: "locationId", label: "Location / Entity ID", type: "string", helpText: "Optional: Specific entity/location for multi-entity companies." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
          { label: "Monthly", value: "monthly" },
        ], helpText: "How often to pull updates from Sage Intacct." },
        { key: "syncBudgets", label: "Sync Budgets", type: "boolean", helpText: "Import budget data for variance analysis." },
        { key: "syncDimensions", label: "Sync Dimensions", type: "boolean", helpText: "Import dimensional reporting data (departments, locations, classes)." },
      ],
    },
    connectionGuide: {
      overview: "Connect Sage Intacct to sync your enterprise financial data — general ledger, P&L statements, Chart of Accounts, budgets, AP/AR, and dimensional reporting — directly into MarinaMatch for institutional-grade underwriting and portfolio analysis.",
      prerequisites: [
        "Sage Intacct subscription with Web Services enabled",
        "A Web Services user with appropriate permissions (read access to GL, AP, AR modules)",
        "Marketplace Sender ID and Sender Password from Sage",
        "Company ID from Company > Company Info in Sage Intacct"
      ],
      steps: [
        { title: "Create a Web Services User", description: "In Sage Intacct, go to Company > Admin > Web Services Users. Create a new user with read permissions for General Ledger, Accounts Payable, and Accounts Receivable modules." },
        { title: "Get Your Company ID", description: "Go to Company > Company Info. Your Company ID is displayed at the top of the page." },
        { title: "Obtain Sender Credentials", description: "Contact your Sage Intacct account representative or visit the Sage Marketplace to get your Sender ID and Sender Password for API access." },
        { title: "Enter Credentials", description: "Paste your Company ID, Web Services User ID, password, Sender ID, and Sender Password into the fields above." },
        { title: "Configure Multi-Entity (Optional)", description: "If you manage multiple entities, enter the specific Location/Entity ID to sync, or leave blank to sync all entities." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify your credentials. MarinaMatch will attempt to read your Chart of Accounts as a validation step." }
      ],
      supportUrl: "https://www.sage.com/en-us/support/",
      apiDocsUrl: "https://developer.intacct.com/api/",
      estimatedTime: "15-20 minutes"
    },
    dataMappings: [
      { sourceEntity: "GLENTRY", targetModule: "financials", targetEntity: "gl", fields: [
        { source: "RECORDNO", target: "externalId" },
        { source: "BATCH_DATE", target: "date" },
        { source: "DEBIT", target: "debit" },
        { source: "CREDIT", target: "credit" },
        { source: "ACCOUNTNO", target: "accountNumber" },
        { source: "DESCRIPTION", target: "description" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "GLACCOUNT", targetModule: "financials", targetEntity: "chartOfAccounts", fields: [
        { source: "ACCOUNTNO", target: "accountNumber" },
        { source: "TITLE", target: "name" },
        { source: "ACCOUNTTYPE", target: "type" },
        { source: "NORMALBALANCE", target: "normalBalance" },
        { source: "STATUS", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "APBILL", targetModule: "financials", targetEntity: "payables", fields: [
        { source: "RECORDNO", target: "externalId" },
        { source: "VENDORNAME", target: "vendorName" },
        { source: "TOTALDUE", target: "amount" },
        { source: "WHENDUE", target: "dueDate" },
        { source: "STATE", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "ARINVOICE", targetModule: "financials", targetEntity: "receivables", fields: [
        { source: "RECORDNO", target: "externalId" },
        { source: "CUSTOMERNAME", target: "customerName" },
        { source: "TOTALDUE", target: "amount" },
        { source: "WHENDUE", target: "dueDate" },
        { source: "STATE", target: "status" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 45
    }
  },

  // ============ TRANSACTION MANAGEMENT ============
  {
    key: "qualia",
    name: "Qualia",
    description: "Real estate closing and title management platform. Track title orders, escrow status, closing milestones, and document delivery directly from your MarinaMatch deal pipeline for seamless marina acquisition closings.",
    category: "Transaction Management",
    assetClasses: ["marina", "multifamily", "retail", "office", "industrial", "hotel", "self_storage", "sfr", "mixed_use", "medical_office", "land", "duplex", "triplex", "quad"],
    contexts: ["crm", "documents", "financials"],
    uiPlacements: ["crm.deals.closingPanel", "documents.vdr.closingDocs", "crm.pipeline.closingStatus"],
    authType: "oauth",
    websiteUrl: "https://www.qualia.com/",
    iconUrl: "/assets/integrations/qualia.svg",
    logoColor: "#6366F1",
    capabilities: {
      dataRead: ["crm.closingOrders", "crm.titleStatus", "crm.escrowStatus", "documents.closingDocs", "financials.closingCosts"],
      dataWrite: ["crm.createOrder", "documents.uploadDocs"],
      actions: ["crm.createClosingOrder", "crm.syncClosingStatus", "documents.importClosingPackage", "crm.trackMilestones"],
      uiHooks: ["crm.dealDetail.closingPanel", "crm.pipeline.closingBadge", "documents.vdr.closingFolder"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your Qualia Connect app Client ID from the Qualia Developer Portal." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your Qualia Connect app Client Secret. Stored encrypted." },
        { key: "environment", label: "Environment", type: "select", required: true, options: [
          { label: "Production", value: "production" },
          { label: "Sandbox", value: "sandbox" },
        ], helpText: "Select sandbox for testing, production for live transactions." },
        { key: "defaultTitleCompany", label: "Default Title Company", type: "string", helpText: "Preferred title company for new orders (optional)." },
        { key: "autoCreateOrders", label: "Auto-Create Closing Orders", type: "boolean", helpText: "Automatically create a Qualia order when a deal moves to 'Under Contract' stage." },
        { key: "syncClosingDocs", label: "Sync Closing Documents", type: "boolean", helpText: "Import closing documents into the Virtual Data Room automatically." },
      ],
    },
    connectionGuide: {
      overview: "Connect Qualia to manage your marina acquisition closings end-to-end. Track title work, escrow status, closing milestones, and automatically sync closing documents to your Virtual Data Room.",
      prerequisites: [
        "Qualia account with Connect API access",
        "OAuth credentials from the Qualia Developer Portal",
        "Admin access to configure organization-level settings"
      ],
      steps: [
        { title: "Register a Qualia Connect App", description: "Log into the Qualia Developer Portal at developer.qualia.com and register a new application. Select 'Closing Management' and 'Document Access' scopes." },
        { title: "Get OAuth Credentials", description: "After app registration, copy your Client ID and Client Secret from the app settings page." },
        { title: "Choose Environment", description: "Select Sandbox for testing or Production for live transactions. We recommend testing in Sandbox first." },
        { title: "Enter Credentials", description: "Paste your Client ID and Client Secret into the fields above and select your environment." },
        { title: "Authorize Access", description: "Click 'Connect' to initiate the OAuth flow. You'll be redirected to Qualia to authorize MarinaMatch access." },
        { title: "Configure Automation", description: "Choose whether to auto-create closing orders when deals move to 'Under Contract' and whether to sync closing documents to your VDR." }
      ],
      supportUrl: "https://support.qualia.com/",
      apiDocsUrl: "https://developer.qualia.com/docs",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "orders", targetModule: "crm", targetEntity: "closingOrders", fields: [
        { source: "order_id", target: "externalId" },
        { source: "property_address", target: "propertyAddress" },
        { source: "status", target: "closingStatus" },
        { source: "estimated_closing_date", target: "estimatedClosingDate" },
        { source: "actual_closing_date", target: "actualClosingDate" }
      ], syncDirection: "bidirectional", frequency: "hourly" },
      { sourceEntity: "milestones", targetModule: "crm", targetEntity: "closingMilestones", fields: [
        { source: "milestone_id", target: "externalId" },
        { source: "name", target: "milestoneName" },
        { source: "status", target: "status" },
        { source: "completed_at", target: "completedAt" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "documents", targetModule: "documents", targetEntity: "closingDocs", fields: [
        { source: "document_id", target: "externalId" },
        { source: "name", target: "fileName" },
        { source: "type", target: "documentType" },
        { source: "url", target: "downloadUrl" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "settlement", targetModule: "financials", targetEntity: "closingCosts", fields: [
        { source: "line_item", target: "description" },
        { source: "amount", target: "amount" },
        { source: "paid_by", target: "paidBy" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: false,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 3
    }
  },

  // ============ DOCUMENT & E-SIGNATURE ============
  {
    key: "docusign",
    name: "DocuSign",
    description: "Industry-leading electronic signature platform. Send, track, and manage e-signatures for LOIs, purchase agreements, NDAs, LP subscription documents, and all transaction paperwork directly from MarinaMatch.",
    category: "Document & E-Signature",
    assetClasses: ["marina", "multifamily", "retail", "office", "industrial", "hotel", "str", "self_storage", "sfr", "rv_park", "mobile_home", "business", "laundromat", "mixed_use", "medical_office", "land", "duplex", "triplex", "quad"],
    contexts: ["documents", "crm", "financials"],
    uiPlacements: ["documents.vdr.signaturePanel", "crm.deals.signatureActions", "documents.toolbar.sendForSignature"],
    authType: "oauth",
    websiteUrl: "https://www.docusign.com/",
    iconUrl: "/assets/integrations/docusign.svg",
    logoColor: "#FFCC22",
    capabilities: {
      dataRead: ["documents.envelopes", "documents.signatureStatus", "documents.signedDocs", "documents.templates"],
      dataWrite: ["documents.createEnvelope", "documents.sendForSignature", "documents.voidEnvelope"],
      actions: ["documents.sendForSignature", "documents.trackSignatures", "documents.downloadSigned", "documents.useTemplate", "documents.bulkSend"],
      uiHooks: ["documents.vdr.signButton", "crm.dealDetail.signatureStatus", "documents.toolbar.templatePicker"],
    },
    settingsSchema: {
      fields: [
        { key: "integrationKey", label: "Integration Key (Client ID)", type: "secret", required: true, helpText: "Your DocuSign Integration Key from the Admin console > Integrations > API and Keys." },
        { key: "secretKey", label: "Secret Key", type: "secret", required: true, helpText: "RSA Private Key or Secret Key for authentication. Stored encrypted." },
        { key: "accountId", label: "API Account ID", type: "string", required: true, helpText: "Your DocuSign API Account ID (GUID format), found in Admin > Integrations > API and Keys." },
        { key: "environment", label: "Environment", type: "select", required: true, options: [
          { label: "Production", value: "production" },
          { label: "Demo / Sandbox", value: "demo" },
        ], helpText: "Use Demo for testing, Production for live signatures." },
        { key: "defaultSenderName", label: "Default Sender Name", type: "string", helpText: "Name that appears as the sender on envelopes (defaults to your account name)." },
        { key: "autoFileToVDR", label: "Auto-File Signed Documents to VDR", type: "boolean", helpText: "Automatically upload completed/signed documents to the deal's Virtual Data Room." },
        { key: "webhookNotifications", label: "Enable Signature Notifications", type: "boolean", helpText: "Receive real-time notifications when documents are signed, declined, or voided." },
      ],
    },
    connectionGuide: {
      overview: "Connect DocuSign to send documents for electronic signature directly from MarinaMatch. Track signature status on deals, auto-file signed documents to your Virtual Data Room, and use templates for common marina transaction documents.",
      prerequisites: [
        "DocuSign account (Business Pro or higher recommended for API access)",
        "Admin access to DocuSign to create an integration key",
        "API Account ID from DocuSign Admin panel"
      ],
      steps: [
        { title: "Create an Integration Key", description: "In DocuSign Admin, go to Integrations > API and Keys. Click 'Add Integration Key' and copy the Integration Key (Client ID)." },
        { title: "Generate Authentication Key", description: "Under the integration key settings, generate an RSA keypair or Secret Key for server-to-server authentication." },
        { title: "Get Your Account ID", description: "On the API and Keys page, copy your API Account ID (the GUID shown at the top)." },
        { title: "Enter Credentials", description: "Paste your Integration Key, Secret Key, and Account ID into the fields above." },
        { title: "Choose Environment", description: "Select Demo to test with the DocuSign sandbox, or Production for live signatures." },
        { title: "Authorize & Test", description: "Click 'Connect' to authorize. MarinaMatch will verify access by listing your available templates." },
        { title: "Configure Options", description: "Enable auto-filing to VDR and signature notifications for a fully automated workflow." }
      ],
      supportUrl: "https://support.docusign.com/",
      apiDocsUrl: "https://developers.docusign.com/docs/esign-rest-api/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "envelopes", targetModule: "documents", targetEntity: "signatureEnvelopes", fields: [
        { source: "envelopeId", target: "externalId" },
        { source: "status", target: "signatureStatus" },
        { source: "subject", target: "subject" },
        { source: "sentDateTime", target: "sentAt" },
        { source: "completedDateTime", target: "completedAt" }
      ], syncDirection: "read", frequency: "realtime" },
      { sourceEntity: "recipients", targetModule: "documents", targetEntity: "signers", fields: [
        { source: "recipientId", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "status", target: "signerStatus" },
        { source: "signedDateTime", target: "signedAt" }
      ], syncDirection: "read", frequency: "realtime" },
      { sourceEntity: "documents", targetModule: "documents", targetEntity: "signedDocuments", fields: [
        { source: "documentId", target: "externalId" },
        { source: "name", target: "fileName" },
        { source: "uri", target: "downloadUri" }
      ], syncDirection: "read", frequency: "realtime" },
      { sourceEntity: "templates", targetModule: "documents", targetEntity: "signatureTemplates", fields: [
        { source: "templateId", target: "externalId" },
        { source: "name", target: "templateName" },
        { source: "description", target: "description" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: false,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 2
    }
  },

  // ============ MULTIFAMILY PMS ============
  {
    key: "yardi_voyager",
    name: "Yardi Voyager",
    description: "Leading multifamily and commercial property management platform. Comprehensive rent roll, leasing, accounting, maintenance tracking, and resident management for institutional portfolios.",
    category: "Multifamily PMS",
    assetClasses: ["multifamily", "mixed_use", "retail", "office", "industrial"],
    contexts: ["rentRoll", "financials", "bookkeeping", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel", "bookkeeping.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.yardi.com/products/yardi-voyager/",
    iconUrl: "/assets/integrations/yardi.svg",
    logoColor: "#003366",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.gl", "financials.receivables", "financials.payables", "crm.residents", "crm.prospects"],
      dataWrite: ["crm.prospects"],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "financials.sync", "crm.syncResidents"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton", "crm.toolbar.syncButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Yardi Voyager API key from the Yardi Marketplace or IT admin." },
        { key: "serverUrl", label: "Server URL", type: "string", required: true, helpText: "Your Yardi Voyager server URL (e.g., https://yourcompany.yardi.com)." },
        { key: "propertyCode", label: "Property Code", type: "string", required: true, helpText: "The Yardi property code for the asset to sync." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ], helpText: "How often to pull updates from Yardi Voyager." },
      ],
    },
    connectionGuide: {
      overview: "Connect Yardi Voyager to sync your multifamily or commercial property's rent roll, tenant data, financial statements, and maintenance records into MarinaMatch for comprehensive asset management.",
      prerequisites: [
        "Yardi Voyager license with API access enabled",
        "System administrator or IT access to generate API credentials",
        "Property Code for the asset you want to sync",
        "Server URL from your Yardi environment"
      ],
      steps: [
        { title: "Request API Access", description: "Contact your Yardi account representative or IT admin to enable API access for your Voyager instance." },
        { title: "Obtain API Credentials", description: "Your IT team will provide an API key and your Yardi server URL." },
        { title: "Find Property Code", description: "In Yardi Voyager, navigate to Setup > Properties. The property code is listed in the property details." },
        { title: "Enter Credentials", description: "Paste your API Key, Server URL, and Property Code into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify MarinaMatch can reach your Yardi instance." },
        { title: "Configure Sync", description: "Choose sync frequency and which modules to import (rent roll, financials, CRM)." }
      ],
      supportUrl: "https://www.yardi.com/support/",
      apiDocsUrl: "https://www.yardi.com/products/yardi-api/",
      estimatedTime: "15-30 minutes"
    },
    dataMappings: [
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "TenantCode", target: "externalId" },
        { source: "FirstName", target: "firstName" },
        { source: "LastName", target: "lastName" },
        { source: "Email", target: "email" },
        { source: "Phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "LeaseId", target: "externalId" },
        { source: "UnitCode", target: "unitId" },
        { source: "LeaseStartDate", target: "startDate" },
        { source: "LeaseEndDate", target: "endDate" },
        { source: "MonthlyRent", target: "monthlyRent" },
        { source: "Status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "GLAccounts", targetModule: "financials", targetEntity: "chartOfAccounts", fields: [
        { source: "AccountNumber", target: "accountNumber" },
        { source: "AccountName", target: "name" },
        { source: "AccountType", target: "type" },
        { source: "Balance", target: "balance" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Charges", targetModule: "financials", targetEntity: "receivables", fields: [
        { source: "ChargeId", target: "externalId" },
        { source: "TenantCode", target: "tenantId" },
        { source: "Amount", target: "amount" },
        { source: "DueDate", target: "dueDate" },
        { source: "Status", target: "status" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 30
    }
  },
  {
    key: "realpage",
    name: "RealPage",
    description: "AI-powered revenue management, leasing, and operations platform for multifamily properties. Optimize pricing, streamline leasing workflows, and manage resident lifecycles.",
    category: "Multifamily PMS",
    assetClasses: ["multifamily", "mixed_use"],
    contexts: ["rentRoll", "financials", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.realpage.com/",
    iconUrl: "/assets/integrations/realpage.svg",
    logoColor: "#E31937",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.receivables", "analytics.revenueManagement", "crm.prospects"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "analytics.syncRevenue"],
      uiHooks: ["rentRoll.toolbar.importButton", "analytics.toolbar.revenueButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your RealPage API key from the RealPage Exchange portal." },
        { key: "siteId", label: "Site ID", type: "string", required: true, helpText: "The RealPage Site ID for your property." },
        { key: "pmcId", label: "PMC ID", type: "string", required: true, helpText: "Your Property Management Company ID in RealPage." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ], helpText: "How often to pull data from RealPage." },
      ],
    },
    connectionGuide: {
      overview: "Connect RealPage to import rent roll, revenue management data, prospect pipeline, and financial performance metrics for your multifamily assets.",
      prerequisites: [
        "RealPage subscription with API access (RealPage Exchange)",
        "PMC ID and Site ID from your RealPage account",
        "Administrator access to generate API credentials"
      ],
      steps: [
        { title: "Access RealPage Exchange", description: "Log into the RealPage Exchange portal to manage API integrations." },
        { title: "Generate API Key", description: "Navigate to Integrations > API Keys and create a new key for MarinaMatch." },
        { title: "Find PMC and Site IDs", description: "Your PMC ID and Site ID are shown in Account Settings > Property Configuration." },
        { title: "Enter Credentials", description: "Input your API Key, PMC ID, and Site ID in the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your property data." }
      ],
      supportUrl: "https://www.realpage.com/support/",
      apiDocsUrl: "https://developer.realpage.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Residents", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "ResidentId", target: "externalId" },
        { source: "Name", target: "name" },
        { source: "Email", target: "email" },
        { source: "UnitNumber", target: "unitId" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "LeaseId", target: "externalId" },
        { source: "StartDate", target: "startDate" },
        { source: "EndDate", target: "endDate" },
        { source: "MarketRent", target: "marketRent" },
        { source: "EffectiveRent", target: "effectiveRent" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "RevenueMetrics", targetModule: "analytics", targetEntity: "revenueManagement", fields: [
        { source: "Date", target: "date" },
        { source: "OccupancyRate", target: "occupancyRate" },
        { source: "AvgEffectiveRent", target: "avgEffectiveRent" },
        { source: "NER", target: "netEffectiveRent" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 21
    }
  },
  {
    key: "appfolio",
    name: "AppFolio",
    description: "Cloud property management for residential and multifamily portfolios. Streamlined leasing, accounting, maintenance, and tenant communication in one platform.",
    category: "Multifamily PMS",
    assetClasses: ["multifamily", "sfr", "mixed_use", "duplex", "triplex", "quad"],
    contexts: ["rentRoll", "financials", "bookkeeping", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.appfolio.com/",
    iconUrl: "/assets/integrations/appfolio.svg",
    logoColor: "#00A0DF",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.receivables", "financials.payables", "crm.contacts", "crm.prospects"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "crm.syncContacts"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "Client ID", type: "secret", required: true, helpText: "Your AppFolio API Client ID from the Developer settings." },
        { key: "clientSecret", label: "Client Secret", type: "secret", required: true, helpText: "Your AppFolio API Client Secret. Stored encrypted." },
        { key: "subdomain", label: "Subdomain", type: "string", required: true, helpText: "Your AppFolio subdomain (e.g., yourcompany.appfolio.com)." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ], helpText: "How often to sync data from AppFolio." },
      ],
    },
    connectionGuide: {
      overview: "Connect AppFolio to sync your property's rent roll, tenant records, financial statements, and maintenance history into MarinaMatch.",
      prerequisites: [
        "AppFolio Property Manager Plus subscription",
        "Administrator access to enable API integrations",
        "Client ID and Client Secret from AppFolio Developer settings"
      ],
      steps: [
        { title: "Enable API Access", description: "In AppFolio, go to Settings > API & Integrations and enable third-party API access." },
        { title: "Create API Credentials", description: "Click 'Create New Integration' and generate a Client ID and Client Secret." },
        { title: "Note Your Subdomain", description: "Your subdomain is the first part of your AppFolio URL (e.g., yourcompany.appfolio.com)." },
        { title: "Enter Credentials", description: "Input your Client ID, Client Secret, and subdomain into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access." },
        { title: "Select Properties", description: "Choose which properties to sync from your AppFolio portfolio." }
      ],
      supportUrl: "https://help.appfolio.com/",
      apiDocsUrl: "https://help.appfolio.com/s/article/API-Documentation",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "id", target: "externalId" },
        { source: "first_name", target: "firstName" },
        { source: "last_name", target: "lastName" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "id", target: "externalId" },
        { source: "unit_id", target: "unitId" },
        { source: "start_date", target: "startDate" },
        { source: "end_date", target: "endDate" },
        { source: "rent", target: "monthlyRent" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Bills", targetModule: "financials", targetEntity: "payables", fields: [
        { source: "id", target: "externalId" },
        { source: "vendor", target: "vendorName" },
        { source: "amount", target: "amount" },
        { source: "due_date", target: "dueDate" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "entrata",
    name: "Entrata",
    description: "All-in-one multifamily management with leasing, accounting, resident portals, and marketing. Built for large multifamily operators and property management companies.",
    category: "Multifamily PMS",
    assetClasses: ["multifamily", "mixed_use"],
    contexts: ["rentRoll", "financials", "crm", "marketing"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.entrata.com/",
    iconUrl: "/assets/integrations/entrata.svg",
    logoColor: "#FF6200",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.gl", "financials.receivables", "crm.residents", "crm.prospects", "marketing.campaigns"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "crm.syncResidents"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Entrata API key from the Developer portal." },
        { key: "serverUrl", label: "Server URL", type: "string", required: true, helpText: "Your Entrata server URL (e.g., https://yourcompany.entrata.com)." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "The Entrata property ID for the asset to sync." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Entrata to sync your multifamily property's leasing data, financials, resident information, and prospect pipeline into MarinaMatch.",
      prerequisites: [
        "Entrata subscription with API access enabled",
        "Administrator access to generate API credentials",
        "Property ID from your Entrata account"
      ],
      steps: [
        { title: "Request API Access", description: "Contact your Entrata account manager to enable API integration for your account." },
        { title: "Generate API Key", description: "Once enabled, navigate to Settings > API Configuration to create your API key." },
        { title: "Find Property ID", description: "Your Property ID is listed in the property settings or can be found in the URL when viewing the property." },
        { title: "Enter Credentials", description: "Input your API Key, Server URL, and Property ID into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your Entrata data." }
      ],
      supportUrl: "https://www.entrata.com/support/",
      apiDocsUrl: "https://developer.entrata.com/",
      estimatedTime: "10-20 minutes"
    },
    dataMappings: [
      { sourceEntity: "Residents", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "resident_id", target: "externalId" },
        { source: "first_name", target: "firstName" },
        { source: "last_name", target: "lastName" },
        { source: "email", target: "email" },
        { source: "unit_number", target: "unitId" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "lease_id", target: "externalId" },
        { source: "start_date", target: "startDate" },
        { source: "end_date", target: "endDate" },
        { source: "monthly_rent", target: "monthlyRent" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "GLEntries", targetModule: "financials", targetEntity: "gl", fields: [
        { source: "entry_id", target: "externalId" },
        { source: "account_number", target: "accountNumber" },
        { source: "debit", target: "debit" },
        { source: "credit", target: "credit" },
        { source: "date", target: "date" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 21
    }
  },
  {
    key: "resman",
    name: "ResMan",
    description: "Multifamily property management with integrated accounting, leasing automation, and resident services. Purpose-built for multifamily operators.",
    category: "Multifamily PMS",
    assetClasses: ["multifamily"],
    contexts: ["rentRoll", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://myresman.com/",
    iconUrl: "/assets/integrations/resman.svg",
    logoColor: "#1B365D",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.receivables", "crm.residents"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your ResMan API key from the ResMan Integration Hub." },
        { key: "accountId", label: "Account ID", type: "string", required: true, helpText: "Your ResMan account identifier." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "The ResMan property ID for the asset to sync." },
      ],
    },
    connectionGuide: {
      overview: "Connect ResMan to import your multifamily property's rent roll, resident data, and financial records into MarinaMatch.",
      prerequisites: [
        "ResMan subscription with API access",
        "Account ID and Property ID from ResMan settings",
        "Administrator access to generate API key"
      ],
      steps: [
        { title: "Access Integration Hub", description: "In ResMan, navigate to Settings > Integration Hub." },
        { title: "Create API Key", description: "Click 'New Integration' and generate an API key for MarinaMatch." },
        { title: "Find Account and Property IDs", description: "Your Account ID is in Settings > Account. Property ID is in the property details." },
        { title: "Enter Credentials", description: "Input your API Key, Account ID, and Property ID." },
        { title: "Test and Sync", description: "Test the connection and configure your initial sync." }
      ],
      supportUrl: "https://support.myresman.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Residents", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "unit", target: "unitId" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "lease_id", target: "externalId" },
        { source: "start", target: "startDate" },
        { source: "end", target: "endDate" },
        { source: "rent", target: "monthlyRent" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },

  // ============ SELF-STORAGE MANAGEMENT ============
  {
    key: "sitelink",
    name: "SiteLink (by Storable)",
    description: "The #1 self-storage management platform with unit tracking, automated billing, payment processing, gate integration, and comprehensive reporting. Trusted by over 40,000 facilities worldwide.",
    category: "Self-Storage Management",
    assetClasses: ["self_storage"],
    contexts: ["rentRoll", "financials", "crm", "selfStorage"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.storable.com/products/sitelink/",
    iconUrl: "/assets/integrations/sitelink.svg",
    logoColor: "#FF6B00",
    capabilities: {
      dataRead: ["rentRoll.units", "rentRoll.tenants", "rentRoll.leases", "financials.receivables", "financials.payments", "crm.contacts", "selfStorage.occupancy", "selfStorage.unitTypes"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "selfStorage.syncOccupancy"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your SiteLink Web Edition API key from Corp Control." },
        { key: "siteCode", label: "Site Code", type: "string", required: true, helpText: "The unique 4-8 character site code for your facility." },
        { key: "corpCode", label: "Corporate Code", type: "string", required: true, helpText: "Your SiteLink corporate code from Corp Control settings." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ], helpText: "How often to pull updates from SiteLink." },
      ],
    },
    connectionGuide: {
      overview: "Connect SiteLink to sync your self-storage facility's unit inventory, tenant records, occupancy data, and financial information into MarinaMatch for comprehensive asset analysis.",
      prerequisites: [
        "SiteLink Web Edition with API access enabled",
        "Corp Control administrator access",
        "Site Code and Corporate Code from your SiteLink account"
      ],
      steps: [
        { title: "Access Corp Control", description: "Log into SiteLink Corp Control at corpcontrol.sitelink.com." },
        { title: "Enable API Access", description: "Navigate to Settings > API Integration and enable third-party API access." },
        { title: "Generate API Key", description: "Create a new API key and copy it securely." },
        { title: "Find Site and Corp Codes", description: "Your Site Code is in the site dashboard header. Corp Code is in Account > Corporate Settings." },
        { title: "Enter Credentials", description: "Input your API Key, Site Code, and Corporate Code into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your facility data." }
      ],
      supportUrl: "https://support.storable.com/sitelink/",
      apiDocsUrl: "https://developer.storable.com/sitelink/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Units", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "UnitID", target: "externalId" },
        { source: "UnitName", target: "name" },
        { source: "UnitWidth", target: "width" },
        { source: "UnitLength", target: "length" },
        { source: "StandardRate", target: "baseRate" },
        { source: "UnitStatus", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "TenantID", target: "externalId" },
        { source: "FirstName", target: "firstName" },
        { source: "LastName", target: "lastName" },
        { source: "Email", target: "email" },
        { source: "Phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Ledger", targetModule: "financials", targetEntity: "receivables", fields: [
        { source: "LedgerID", target: "externalId" },
        { source: "TenantID", target: "tenantId" },
        { source: "Amount", target: "amount" },
        { source: "DueDate", target: "dueDate" },
        { source: "PaidDate", target: "paidDate" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "storedge",
    name: "storEDGE",
    description: "Self-storage marketing and management platform with online rentals, website builder, revenue management, and tenant portals for modern storage operators.",
    category: "Self-Storage Management",
    assetClasses: ["self_storage"],
    contexts: ["rentRoll", "financials", "crm", "marketing", "selfStorage"],
    uiPlacements: ["rentRoll.integrations.panel", "crm.integrations.panel", "marketing.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.storable.com/products/storedge/",
    iconUrl: "/assets/integrations/storedge.svg",
    logoColor: "#4A90D9",
    capabilities: {
      dataRead: ["rentRoll.units", "rentRoll.tenants", "rentRoll.leases", "financials.receivables", "crm.leads", "marketing.websiteTraffic", "selfStorage.occupancy"],
      dataWrite: [],
      actions: ["rentRoll.import", "crm.syncLeads", "selfStorage.syncOccupancy"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your storEDGE API key from account settings." },
        { key: "facilityId", label: "Facility ID", type: "string", required: true, helpText: "Your storEDGE facility identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect storEDGE to sync your self-storage facility's unit inventory, tenant data, online leads, and occupancy metrics.",
      prerequisites: [
        "storEDGE account with API access",
        "Facility ID from your storEDGE dashboard",
        "Administrator access"
      ],
      steps: [
        { title: "Access Account Settings", description: "Log into storEDGE and navigate to Settings > API & Integrations." },
        { title: "Generate API Key", description: "Click 'Create API Key' and copy the generated key." },
        { title: "Find Facility ID", description: "Your Facility ID is displayed on the main dashboard or in Account Settings." },
        { title: "Enter Credentials", description: "Input your API Key and Facility ID into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access." }
      ],
      supportUrl: "https://support.storable.com/storedge/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Units", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "unit_id", target: "externalId" },
        { source: "unit_name", target: "name" },
        { source: "size", target: "size" },
        { source: "rate", target: "baseRate" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "tenant_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 7
    }
  },
  {
    key: "easy_storage",
    name: "Easy Storage Solutions",
    description: "Affordable self-storage management software for small to mid-size operators. Simple unit tracking, billing, online rentals, and tenant management.",
    category: "Self-Storage Management",
    assetClasses: ["self_storage"],
    contexts: ["rentRoll", "financials", "selfStorage"],
    uiPlacements: ["rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.easystoragesolutions.com/",
    iconUrl: "/assets/integrations/easystorage.svg",
    logoColor: "#28A745",
    capabilities: {
      dataRead: ["rentRoll.units", "rentRoll.tenants", "rentRoll.leases", "financials.receivables", "selfStorage.occupancy"],
      dataWrite: [],
      actions: ["rentRoll.import", "selfStorage.syncOccupancy"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Easy Storage Solutions API key from account settings." },
        { key: "facilityId", label: "Facility ID", type: "string", required: true, helpText: "Your facility identifier from the dashboard." },
      ],
    },
    connectionGuide: {
      overview: "Connect Easy Storage Solutions to import your facility's unit inventory, tenant records, and billing data into MarinaMatch.",
      prerequisites: [
        "Easy Storage Solutions subscription",
        "Account administrator access",
        "Facility ID from dashboard"
      ],
      steps: [
        { title: "Access Settings", description: "Log into Easy Storage Solutions and go to Settings > Integrations." },
        { title: "Generate API Key", description: "Click 'Create API Key' to generate credentials." },
        { title: "Find Facility ID", description: "Your Facility ID is shown on the main dashboard." },
        { title: "Enter Credentials", description: "Paste your API Key and Facility ID below." }
      ],
      supportUrl: "https://support.easystoragesolutions.com/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "units", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "size", target: "size" },
        { source: "price", target: "baseRate" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },
  {
    key: "tenant_inc",
    name: "Tenant Inc",
    description: "Self-storage management with contactless rentals, revenue management, and automated marketing. Modern cloud platform for forward-thinking operators.",
    category: "Self-Storage Management",
    assetClasses: ["self_storage"],
    contexts: ["rentRoll", "financials", "crm", "selfStorage"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.tenantinc.com/",
    iconUrl: "/assets/integrations/tenantinc.svg",
    logoColor: "#5B2D8E",
    capabilities: {
      dataRead: ["rentRoll.units", "rentRoll.tenants", "rentRoll.leases", "financials.receivables", "financials.payments", "crm.leads", "selfStorage.occupancy", "selfStorage.revenueManagement"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "selfStorage.syncRevenue"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Tenant Inc API key from the admin dashboard." },
        { key: "facilityId", label: "Facility ID", type: "string", required: true, helpText: "Your Tenant Inc facility identifier." },
        { key: "includeRevenueMgmt", label: "Include Revenue Management Data", type: "boolean", helpText: "Sync pricing optimization and revenue metrics." },
      ],
    },
    connectionGuide: {
      overview: "Connect Tenant Inc to sync your self-storage facility's unit inventory, tenant records, revenue management data, and financial information.",
      prerequisites: [
        "Tenant Inc subscription with API access",
        "Administrator access",
        "Facility ID from your dashboard"
      ],
      steps: [
        { title: "Access Admin Dashboard", description: "Log into Tenant Inc and navigate to Admin > Integrations." },
        { title: "Enable API Access", description: "Toggle API access on and generate a new API key." },
        { title: "Copy Facility ID", description: "Your Facility ID is on the main dashboard header." },
        { title: "Enter Credentials", description: "Paste your API Key and Facility ID into the fields above." },
        { title: "Configure Options", description: "Choose whether to include revenue management data in the sync." }
      ],
      supportUrl: "https://support.tenantinc.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Units", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "unit_id", target: "externalId" },
        { source: "unit_number", target: "name" },
        { source: "width", target: "width" },
        { source: "depth", target: "length" },
        { source: "street_rate", target: "baseRate" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "tenant_id", target: "externalId" },
        { source: "first_name", target: "firstName" },
        { source: "last_name", target: "lastName" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Payments", targetModule: "financials", targetEntity: "payments", fields: [
        { source: "payment_id", target: "externalId" },
        { source: "amount", target: "amount" },
        { source: "payment_date", target: "paymentDate" },
        { source: "method", target: "paymentMethod" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 10
    }
  },

  // ============ HOTEL PMS ============
  {
    key: "opera_pms",
    name: "Oracle Opera PMS",
    description: "Enterprise hotel property management system by Oracle. Comprehensive reservations, front desk, housekeeping, F&B management, and revenue analytics for full-service hotels and resorts.",
    category: "Hotel PMS",
    assetClasses: ["hotel"],
    contexts: ["hotelOps", "financials", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "analytics.integrations.panel", "crm.integrations.panel"],
    authType: "oauth",
    websiteUrl: "https://www.oracle.com/hospitality/hotel-property-management/",
    iconUrl: "/assets/integrations/opera.svg",
    logoColor: "#C74634",
    capabilities: {
      dataRead: ["hotelOps.reservations", "hotelOps.rooms", "hotelOps.housekeeping", "hotelOps.guestProfiles", "financials.revenue", "financials.pnl", "analytics.revpar", "analytics.occupancy", "crm.guests"],
      dataWrite: [],
      actions: ["hotelOps.syncReservations", "financials.import", "analytics.syncMetrics", "crm.syncGuests"],
      uiHooks: ["rentRoll.toolbar.importButton", "analytics.toolbar.hotelMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your Oracle Hospitality Integration Platform (OHIP) Client ID." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your OHIP Client Secret. Stored encrypted." },
        { key: "hotelId", label: "Hotel ID", type: "string", required: true, helpText: "The Opera property/hotel identifier." },
        { key: "gatewayUrl", label: "Gateway URL", type: "string", required: true, helpText: "Your OHIP gateway URL (e.g., https://your-ohip-instance.oraclehospitality.com)." },
      ],
    },
    connectionGuide: {
      overview: "Connect Oracle Opera PMS to sync your hotel's reservations, room inventory, guest profiles, and financial performance data into MarinaMatch for comprehensive hospitality asset analysis.",
      prerequisites: [
        "Oracle Opera PMS Cloud license",
        "OHIP (Oracle Hospitality Integration Platform) access",
        "OAuth credentials from the OHIP Developer Portal",
        "Hotel ID from your Opera configuration"
      ],
      steps: [
        { title: "Access OHIP Developer Portal", description: "Log into the Oracle Hospitality Integration Platform developer portal." },
        { title: "Register Application", description: "Create a new application and select the Opera PMS APIs you need (Reservations, Property, Guest Profiles, etc.)." },
        { title: "Obtain OAuth Credentials", description: "Copy your Client ID and Client Secret from the application settings." },
        { title: "Find Hotel ID", description: "Your Hotel ID is in Opera's property configuration or can be obtained from your Oracle admin." },
        { title: "Enter Credentials", description: "Paste your OAuth credentials, Gateway URL, and Hotel ID into the fields above." },
        { title: "Authorize and Test", description: "Click 'Connect' to authenticate via OAuth and verify access to your property data." }
      ],
      supportUrl: "https://www.oracle.com/hospitality/support/",
      apiDocsUrl: "https://docs.oracle.com/en/industries/hospitality/integration-platform/",
      estimatedTime: "20-30 minutes"
    },
    dataMappings: [
      { sourceEntity: "Reservations", targetModule: "hotelOps", targetEntity: "reservations", fields: [
        { source: "reservationId", target: "externalId" },
        { source: "arrivalDate", target: "checkIn" },
        { source: "departureDate", target: "checkOut" },
        { source: "roomType", target: "roomType" },
        { source: "rateAmount", target: "dailyRate" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "GuestProfiles", targetModule: "crm", targetEntity: "guests", fields: [
        { source: "profileId", target: "externalId" },
        { source: "firstName", target: "firstName" },
        { source: "lastName", target: "lastName" },
        { source: "email", target: "email" },
        { source: "vipStatus", target: "tier" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Revenue", targetModule: "financials", targetEntity: "revenue", fields: [
        { source: "date", target: "date" },
        { source: "roomRevenue", target: "roomRevenue" },
        { source: "fbRevenue", target: "fbRevenue" },
        { source: "otherRevenue", target: "otherRevenue" },
        { source: "totalRevenue", target: "totalRevenue" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Statistics", targetModule: "analytics", targetEntity: "hotelMetrics", fields: [
        { source: "date", target: "date" },
        { source: "occupancyPct", target: "occupancyRate" },
        { source: "adr", target: "adr" },
        { source: "revpar", target: "revpar" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 45
    }
  },
  {
    key: "mews",
    name: "Mews",
    description: "Modern cloud-native PMS for hospitality with an open API architecture. Streamlined operations, automated workflows, and real-time analytics for hotels and hostels.",
    category: "Hotel PMS",
    assetClasses: ["hotel"],
    contexts: ["hotelOps", "financials", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.mews.com/",
    iconUrl: "/assets/integrations/mews.svg",
    logoColor: "#1A1A2E",
    capabilities: {
      dataRead: ["hotelOps.reservations", "hotelOps.rooms", "hotelOps.guestProfiles", "financials.revenue", "financials.payments", "analytics.occupancy", "analytics.revpar"],
      dataWrite: [],
      actions: ["hotelOps.syncReservations", "financials.import", "analytics.syncMetrics"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "accessToken", label: "Access Token", type: "secret", required: true, helpText: "Your Mews Connector API access token from the Mews Commander." },
        { key: "clientToken", label: "Client Token", type: "secret", required: true, helpText: "Your Mews client token. Stored encrypted." },
        { key: "environment", label: "Environment", type: "select", required: true, options: [
          { label: "Production", value: "production" },
          { label: "Demo", value: "demo" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Mews to sync your hotel's reservations, guest profiles, room inventory, and revenue data into MarinaMatch.",
      prerequisites: [
        "Mews Operations subscription",
        "Access to Mews Commander (admin panel)",
        "Connector API tokens from your Mews account"
      ],
      steps: [
        { title: "Access Mews Commander", description: "Log into Mews Commander and go to Settings > Integrations." },
        { title: "Create Connector Integration", description: "Click 'New Integration' and select 'Connector API'." },
        { title: "Copy Tokens", description: "Copy your Access Token and Client Token from the integration settings." },
        { title: "Enter Credentials", description: "Paste your tokens into the fields above and select your environment." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify API access." }
      ],
      supportUrl: "https://help.mews.com/",
      apiDocsUrl: "https://mews-systems.gitbook.io/connector-api/",
      estimatedTime: "10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Reservations", targetModule: "hotelOps", targetEntity: "reservations", fields: [
        { source: "Id", target: "externalId" },
        { source: "StartUtc", target: "checkIn" },
        { source: "EndUtc", target: "checkOut" },
        { source: "RequestedResourceCategoryId", target: "roomTypeId" },
        { source: "State", target: "status" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Customers", targetModule: "crm", targetEntity: "guests", fields: [
        { source: "Id", target: "externalId" },
        { source: "FirstName", target: "firstName" },
        { source: "LastName", target: "lastName" },
        { source: "Email", target: "email" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "AccountingItems", targetModule: "financials", targetEntity: "revenue", fields: [
        { source: "Id", target: "externalId" },
        { source: "Amount", target: "amount" },
        { source: "ConsumptionUtc", target: "date" },
        { source: "Type", target: "revenueType" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "cloudbeds",
    name: "Cloudbeds",
    description: "Hospitality management suite with PMS, booking engine, revenue management, and channel manager. Ideal for independent hotels and STR portfolios.",
    category: "Hotel PMS",
    assetClasses: ["hotel", "str"],
    contexts: ["hotelOps", "financials", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "oauth",
    websiteUrl: "https://www.cloudbeds.com/",
    iconUrl: "/assets/integrations/cloudbeds.svg",
    logoColor: "#2563EB",
    capabilities: {
      dataRead: ["hotelOps.reservations", "hotelOps.rooms", "financials.revenue", "financials.payments", "crm.guests", "analytics.occupancy"],
      dataWrite: [],
      actions: ["hotelOps.syncReservations", "financials.import", "crm.syncGuests"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your Cloudbeds API Client ID from the Developer Portal." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your Cloudbeds Client Secret. Stored encrypted." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "Your Cloudbeds property identifier." },
      ],
    },
    connectionGuide: {
      overview: "Connect Cloudbeds to sync reservations, room inventory, revenue data, and guest profiles from your hotel or STR portfolio.",
      prerequisites: [
        "Cloudbeds subscription",
        "OAuth credentials from Cloudbeds Developer Portal",
        "Property ID from your Cloudbeds dashboard"
      ],
      steps: [
        { title: "Access Developer Portal", description: "Go to the Cloudbeds Developer Portal and register a new application." },
        { title: "Get OAuth Credentials", description: "Copy your Client ID and Client Secret from the application settings." },
        { title: "Find Property ID", description: "Your Property ID is in your Cloudbeds dashboard under Property Settings." },
        { title: "Enter Credentials", description: "Input your OAuth credentials and Property ID." },
        { title: "Authorize", description: "Click 'Connect' to authorize MarinaMatch via OAuth." }
      ],
      supportUrl: "https://support.cloudbeds.com/",
      apiDocsUrl: "https://docs.cloudbeds.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Reservations", targetModule: "hotelOps", targetEntity: "reservations", fields: [
        { source: "reservationID", target: "externalId" },
        { source: "checkInDate", target: "checkIn" },
        { source: "checkOutDate", target: "checkOut" },
        { source: "roomTypeName", target: "roomType" },
        { source: "grandTotal", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Guests", targetModule: "crm", targetEntity: "guests", fields: [
        { source: "guestID", target: "externalId" },
        { source: "guestFirstName", target: "firstName" },
        { source: "guestLastName", target: "lastName" },
        { source: "guestEmail", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 10
    }
  },
  {
    key: "roomkey_pms",
    name: "RoomKey PMS",
    description: "Hotel management system with direct booking engine, revenue management, and comprehensive front desk operations for independent and boutique hotels.",
    category: "Hotel PMS",
    assetClasses: ["hotel"],
    contexts: ["hotelOps", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://roomkeypms.com/",
    iconUrl: "/assets/integrations/roomkey.svg",
    logoColor: "#FF5722",
    capabilities: {
      dataRead: ["hotelOps.reservations", "hotelOps.rooms", "financials.revenue", "crm.guests"],
      dataWrite: [],
      actions: ["hotelOps.syncReservations", "financials.import"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your RoomKey PMS API key from Account Settings." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "Your RoomKey property identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect RoomKey PMS to sync your hotel's reservations, room inventory, and revenue data into MarinaMatch.",
      prerequisites: [
        "RoomKey PMS subscription",
        "Administrator access",
        "Property ID from your account"
      ],
      steps: [
        { title: "Access Account Settings", description: "Log into RoomKey PMS and navigate to Account > API Settings." },
        { title: "Generate API Key", description: "Click 'Generate API Key' and copy the key securely." },
        { title: "Find Property ID", description: "Your Property ID is in the dashboard header or Account Settings." },
        { title: "Enter Credentials", description: "Input your API Key and Property ID below." },
        { title: "Test Connection", description: "Verify access and configure sync frequency." }
      ],
      supportUrl: "https://support.roomkeypms.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Reservations", targetModule: "hotelOps", targetEntity: "reservations", fields: [
        { source: "reservation_id", target: "externalId" },
        { source: "check_in", target: "checkIn" },
        { source: "check_out", target: "checkOut" },
        { source: "room_type", target: "roomType" },
        { source: "total", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Guests", targetModule: "crm", targetEntity: "guests", fields: [
        { source: "guest_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 7
    }
  },

  // ============ STR MANAGEMENT ============
  {
    key: "guesty",
    name: "Guesty",
    description: "Enterprise short-term rental management with channel distribution across Airbnb, VRBO, Booking.com, and more. Automated messaging, pricing, and operations management.",
    category: "STR Management",
    assetClasses: ["str"],
    contexts: ["strOps", "financials", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.guesty.com/",
    iconUrl: "/assets/integrations/guesty.svg",
    logoColor: "#FF385C",
    capabilities: {
      dataRead: ["strOps.reservations", "strOps.listings", "strOps.channels", "financials.revenue", "financials.payouts", "crm.guests", "analytics.occupancy", "analytics.adr"],
      dataWrite: ["strOps.pricing"],
      actions: ["strOps.syncReservations", "strOps.syncListings", "financials.import", "crm.syncGuests"],
      uiHooks: ["rentRoll.toolbar.importButton", "analytics.toolbar.strMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Guesty API token from the Guesty Developer Portal." },
        { key: "accountId", label: "Account ID", type: "string", required: true, helpText: "Your Guesty account identifier." },
        { key: "syncChannelData", label: "Sync Channel Distribution Data", type: "boolean", helpText: "Include listing performance data from Airbnb, VRBO, etc." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Real-time", value: "realtime" },
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Guesty to sync your short-term rental portfolio's reservations, listings, guest data, channel performance, and revenue metrics into MarinaMatch for STR asset analysis.",
      prerequisites: [
        "Guesty Pro or Enterprise subscription",
        "API access enabled via Guesty Developer Portal",
        "Account ID from your Guesty dashboard"
      ],
      steps: [
        { title: "Access Developer Portal", description: "Log into Guesty and navigate to Marketplace > Developer Tools > API Key." },
        { title: "Generate API Token", description: "Create a new API token with read permissions for Reservations, Listings, Guests, and Financials." },
        { title: "Find Account ID", description: "Your Account ID is displayed in Settings > Account Info." },
        { title: "Enter Credentials", description: "Paste your API Token and Account ID into the fields above." },
        { title: "Configure Options", description: "Enable channel data sync for cross-platform analytics." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your Guesty data." }
      ],
      supportUrl: "https://support.guesty.com/",
      apiDocsUrl: "https://docs.guesty.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Reservations", targetModule: "strOps", targetEntity: "reservations", fields: [
        { source: "_id", target: "externalId" },
        { source: "checkIn", target: "checkIn" },
        { source: "checkOut", target: "checkOut" },
        { source: "listingId", target: "listingId" },
        { source: "money.totalPaid", target: "totalPaid" },
        { source: "source", target: "channel" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "realtime" },
      { sourceEntity: "Listings", targetModule: "strOps", targetEntity: "listings", fields: [
        { source: "_id", target: "externalId" },
        { source: "title", target: "title" },
        { source: "address.full", target: "address" },
        { source: "bedrooms", target: "bedrooms" },
        { source: "bathrooms", target: "bathrooms" },
        { source: "prices.basePrice", target: "basePrice" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Guests", targetModule: "crm", targetEntity: "guests", fields: [
        { source: "_id", target: "externalId" },
        { source: "fullName", target: "name" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "hospitable",
    name: "Hospitable",
    description: "Automated guest communication and short-term rental management platform (formerly Smartbnb). AI-powered messaging, task automation, and multi-channel management.",
    category: "STR Management",
    assetClasses: ["str"],
    contexts: ["strOps", "crm", "financials"],
    uiPlacements: ["rentRoll.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://hospitable.com/",
    iconUrl: "/assets/integrations/hospitable.svg",
    logoColor: "#6C63FF",
    capabilities: {
      dataRead: ["strOps.reservations", "strOps.listings", "crm.guests", "crm.messages", "financials.revenue"],
      dataWrite: [],
      actions: ["strOps.syncReservations", "crm.syncGuests"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Hospitable API key from Account Settings." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Hospitable to sync your short-term rental reservations, guest communications, and listing data.",
      prerequisites: [
        "Hospitable subscription",
        "API access from account settings"
      ],
      steps: [
        { title: "Access Account Settings", description: "Log into Hospitable and navigate to Settings > Integrations." },
        { title: "Generate API Key", description: "Click 'Create API Key' and copy the generated key." },
        { title: "Enter Credentials", description: "Paste your API Key into the field above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify." }
      ],
      supportUrl: "https://help.hospitable.com/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "Reservations", targetModule: "strOps", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "check_in", target: "checkIn" },
        { source: "check_out", target: "checkOut" },
        { source: "listing_id", target: "listingId" },
        { source: "total", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Guests", targetModule: "crm", targetEntity: "guests", fields: [
        { source: "guest_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },
  {
    key: "ownerrez",
    name: "OwnerRez",
    description: "Vacation rental management with direct booking website, channel management, automated communications, and comprehensive reporting for property owners and managers.",
    category: "STR Management",
    assetClasses: ["str"],
    contexts: ["strOps", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.ownerrez.com/",
    iconUrl: "/assets/integrations/ownerrez.svg",
    logoColor: "#2E86AB",
    capabilities: {
      dataRead: ["strOps.reservations", "strOps.listings", "strOps.channels", "financials.revenue", "financials.ownerStatements", "crm.guests"],
      dataWrite: [],
      actions: ["strOps.syncReservations", "financials.import", "crm.syncGuests"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your OwnerRez API key from the API Settings page." },
        { key: "apiSecret", label: "API Secret", type: "secret", required: true, helpText: "Your OwnerRez API secret. Stored encrypted." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect OwnerRez to sync vacation rental reservations, listing data, owner statements, and guest information into MarinaMatch.",
      prerequisites: [
        "OwnerRez subscription",
        "API credentials from Settings > API",
        "At least one active property"
      ],
      steps: [
        { title: "Access API Settings", description: "In OwnerRez, go to Settings > API & Webhooks." },
        { title: "Generate API Credentials", description: "Create a new API key and secret pair." },
        { title: "Enter Credentials", description: "Paste your API Key and Secret into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your OwnerRez data." },
        { title: "Configure Sync", description: "Choose sync frequency and which data to import." }
      ],
      supportUrl: "https://www.ownerrez.com/support",
      apiDocsUrl: "https://www.ownerrez.com/support/articles/api-overview",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Bookings", targetModule: "strOps", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "arrival", target: "checkIn" },
        { source: "departure", target: "checkOut" },
        { source: "property_id", target: "listingId" },
        { source: "total_charge", target: "totalAmount" },
        { source: "channel", target: "channel" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Properties", targetModule: "strOps", targetEntity: "listings", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "title" },
        { source: "address", target: "address" },
        { source: "bedrooms", target: "bedrooms" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "OwnerStatements", targetModule: "financials", targetEntity: "ownerStatements", fields: [
        { source: "statement_id", target: "externalId" },
        { source: "period", target: "period" },
        { source: "gross_revenue", target: "grossRevenue" },
        { source: "net_to_owner", target: "netToOwner" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 7
    }
  },
  {
    key: "lodgify",
    name: "Lodgify",
    description: "Vacation rental software with website builder, channel manager, booking engine, and property management tools for hosts and property managers.",
    category: "STR Management",
    assetClasses: ["str"],
    contexts: ["strOps", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.lodgify.com/",
    iconUrl: "/assets/integrations/lodgify.svg",
    logoColor: "#FF9500",
    capabilities: {
      dataRead: ["strOps.reservations", "strOps.listings", "financials.revenue", "crm.guests"],
      dataWrite: [],
      actions: ["strOps.syncReservations", "financials.import"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Lodgify API key from Account Settings > API." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Lodgify to sync your vacation rental reservations, property listings, and revenue data.",
      prerequisites: [
        "Lodgify subscription with API access",
        "API key from account settings"
      ],
      steps: [
        { title: "Access API Settings", description: "Log into Lodgify and navigate to Account Settings > API." },
        { title: "Copy API Key", description: "Your API key is displayed on the API settings page." },
        { title: "Enter Credentials", description: "Paste your API Key into the field above." },
        { title: "Test Connection", description: "Verify access and start syncing." }
      ],
      supportUrl: "https://support.lodgify.com/",
      apiDocsUrl: "https://docs.lodgify.com/reference",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "Bookings", targetModule: "strOps", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "arrival", target: "checkIn" },
        { source: "departure", target: "checkOut" },
        { source: "property_id", target: "listingId" },
        { source: "total_amount", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Properties", targetModule: "strOps", targetEntity: "listings", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "title" },
        { source: "address", target: "address" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },

  // ============ RV PARK MANAGEMENT ============
  {
    key: "campspot",
    name: "Campspot",
    description: "RV park and campground reservation management with dynamic pricing, online booking, and comprehensive park operations. Used by thousands of parks nationwide.",
    category: "RV Park Management",
    assetClasses: ["rv_park"],
    contexts: ["rentRoll", "rvParkOps", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.campspot.com/",
    iconUrl: "/assets/integrations/campspot.svg",
    logoColor: "#00875A",
    capabilities: {
      dataRead: ["rentRoll.sites", "rentRoll.reservations", "rvParkOps.siteTypes", "rvParkOps.occupancy", "financials.revenue", "financials.payments", "crm.guests"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "rvParkOps.syncOccupancy", "crm.syncGuests"],
      uiHooks: ["rentRoll.toolbar.importButton", "crm.toolbar.syncButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Campspot API key from the Partner Portal." },
        { key: "parkId", label: "Park ID", type: "string", required: true, helpText: "Your Campspot park identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
        { key: "includeSeasonalRates", label: "Include Seasonal Rate Data", type: "boolean", helpText: "Import seasonal and dynamic pricing data." },
      ],
    },
    connectionGuide: {
      overview: "Connect Campspot to sync your RV park's site inventory, reservations, guest data, occupancy metrics, and revenue information into MarinaMatch.",
      prerequisites: [
        "Campspot subscription with API access",
        "Park ID from your Campspot dashboard",
        "Partner Portal API credentials"
      ],
      steps: [
        { title: "Access Partner Portal", description: "Log into the Campspot Partner Portal to manage API integrations." },
        { title: "Generate API Key", description: "Navigate to Settings > API and create a new API key for MarinaMatch." },
        { title: "Find Park ID", description: "Your Park ID is displayed in the dashboard header or in Park Settings." },
        { title: "Enter Credentials", description: "Input your API Key and Park ID into the fields above." },
        { title: "Configure Options", description: "Enable seasonal rate data if you want pricing analytics." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your park data." }
      ],
      supportUrl: "https://support.campspot.com/",
      estimatedTime: "10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Sites", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "site_id", target: "externalId" },
        { source: "site_name", target: "name" },
        { source: "site_type", target: "unitType" },
        { source: "nightly_rate", target: "baseRate" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Reservations", targetModule: "rentRoll", targetEntity: "reservations", fields: [
        { source: "reservation_id", target: "externalId" },
        { source: "check_in", target: "startDate" },
        { source: "check_out", target: "endDate" },
        { source: "site_id", target: "unitId" },
        { source: "total", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Guests", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "guest_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 10
    }
  },
  {
    key: "rms_cloud",
    name: "RMS Cloud",
    description: "Property management for RV parks, campgrounds, marinas, and hospitality. Reservations, channel management, POS, and comprehensive reporting in a single platform.",
    category: "RV Park Management",
    assetClasses: ["rv_park", "marina"],
    contexts: ["rentRoll", "rvParkOps", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.rmscloud.com/",
    iconUrl: "/assets/integrations/rmscloud.svg",
    logoColor: "#0066B3",
    capabilities: {
      dataRead: ["rentRoll.sites", "rentRoll.reservations", "rvParkOps.siteTypes", "financials.revenue", "financials.payments", "crm.guests"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your RMS Cloud API key from the admin portal." },
        { key: "clientId", label: "Client ID", type: "string", required: true, helpText: "Your RMS Cloud client identifier." },
        { key: "propertyId", label: "Property ID", type: "string", required: true, helpText: "The RMS property ID for the park to sync." },
      ],
    },
    connectionGuide: {
      overview: "Connect RMS Cloud to sync your RV park or campground's site inventory, reservations, guest data, and financial records.",
      prerequisites: [
        "RMS Cloud subscription with API access",
        "Client ID and Property ID from your RMS account",
        "Administrator access"
      ],
      steps: [
        { title: "Request API Access", description: "Contact RMS Cloud support to enable API access for your account." },
        { title: "Receive Credentials", description: "You'll receive your API Key and Client ID from RMS support." },
        { title: "Find Property ID", description: "Your Property ID is in the RMS dashboard under Property Settings." },
        { title: "Enter Credentials", description: "Input your API Key, Client ID, and Property ID." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access." }
      ],
      supportUrl: "https://support.rmscloud.com/",
      apiDocsUrl: "https://developer.rmscloud.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Sites", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "SiteId", target: "externalId" },
        { source: "SiteName", target: "name" },
        { source: "SiteType", target: "unitType" },
        { source: "Rate", target: "baseRate" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Reservations", targetModule: "rentRoll", targetEntity: "reservations", fields: [
        { source: "ReservationId", target: "externalId" },
        { source: "ArrivalDate", target: "startDate" },
        { source: "DepartureDate", target: "endDate" },
        { source: "SiteId", target: "unitId" },
        { source: "TotalCharge", target: "totalAmount" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "firefly",
    name: "Firefly Reservations",
    description: "Campground and RV park management software with online booking, point of sale, and guest management. Built specifically for outdoor hospitality.",
    category: "RV Park Management",
    assetClasses: ["rv_park"],
    contexts: ["rentRoll", "rvParkOps", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://fireflyreservations.com/",
    iconUrl: "/assets/integrations/firefly.svg",
    logoColor: "#FF6D00",
    capabilities: {
      dataRead: ["rentRoll.sites", "rentRoll.reservations", "rvParkOps.occupancy", "financials.revenue", "crm.guests"],
      dataWrite: [],
      actions: ["rentRoll.import", "rvParkOps.syncOccupancy", "crm.syncGuests"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Firefly API key from Settings > Integrations." },
        { key: "parkId", label: "Park ID", type: "string", required: true, helpText: "Your Firefly park identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Hourly", value: "hourly" },
          { label: "Daily", value: "daily" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Firefly Reservations to sync your campground's site inventory, reservations, guest data, and revenue information.",
      prerequisites: [
        "Firefly Reservations subscription",
        "Administrator access",
        "Park ID from your account"
      ],
      steps: [
        { title: "Access Integration Settings", description: "In Firefly, go to Settings > Integrations > API." },
        { title: "Generate API Key", description: "Click 'New API Key' and copy the generated key." },
        { title: "Find Park ID", description: "Your Park ID is shown on the dashboard or in Account Settings." },
        { title: "Enter Credentials", description: "Input your API Key and Park ID below." },
        { title: "Test Connection", description: "Verify access and configure sync frequency." }
      ],
      supportUrl: "https://support.fireflyreservations.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Sites", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "site_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "type", target: "unitType" },
        { source: "rate", target: "baseRate" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Reservations", targetModule: "rentRoll", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "arrival", target: "startDate" },
        { source: "departure", target: "endDate" },
        { source: "site_id", target: "unitId" }
      ], syncDirection: "read", frequency: "hourly" },
      { sourceEntity: "Guests", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "guest_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 7
    }
  },
  {
    key: "camplife",
    name: "CampLife",
    description: "Digital tools for RV parks and campgrounds including reservation management, online booking, guest engagement, and operational analytics.",
    category: "RV Park Management",
    assetClasses: ["rv_park"],
    contexts: ["rentRoll", "rvParkOps", "crm"],
    uiPlacements: ["rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.camplife.com/",
    iconUrl: "/assets/integrations/camplife.svg",
    logoColor: "#4CAF50",
    capabilities: {
      dataRead: ["rentRoll.sites", "rentRoll.reservations", "rvParkOps.occupancy", "crm.guests"],
      dataWrite: [],
      actions: ["rentRoll.import", "rvParkOps.syncOccupancy"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your CampLife API key from account settings." },
        { key: "parkId", label: "Park ID", type: "string", required: true, helpText: "Your CampLife park identifier." },
      ],
    },
    connectionGuide: {
      overview: "Connect CampLife to import your RV park's site inventory, reservations, and guest data into MarinaMatch.",
      prerequisites: [
        "CampLife subscription",
        "Administrator access",
        "Park ID from your dashboard"
      ],
      steps: [
        { title: "Access Settings", description: "Log into CampLife and navigate to Settings > API." },
        { title: "Generate API Key", description: "Create a new API key for MarinaMatch." },
        { title: "Find Park ID", description: "Your Park ID is displayed on the dashboard." },
        { title: "Enter Credentials", description: "Input your API Key and Park ID below." }
      ],
      supportUrl: "https://support.camplife.com/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "Sites", targetModule: "rentRoll", targetEntity: "units", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "type", target: "unitType" },
        { source: "nightly_rate", target: "baseRate" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Reservations", targetModule: "rentRoll", targetEntity: "reservations", fields: [
        { source: "id", target: "externalId" },
        { source: "check_in", target: "startDate" },
        { source: "check_out", target: "endDate" },
        { source: "site_id", target: "unitId" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },

  // ============ COMMERCIAL RE ============
  {
    key: "mri_software",
    name: "MRI Software",
    description: "Enterprise commercial real estate management platform. Lease administration, accounting, facilities management, and investment modeling for institutional CRE portfolios.",
    category: "Commercial RE",
    assetClasses: ["retail", "office", "industrial", "medical_office", "mixed_use"],
    contexts: ["rentRoll", "financials", "bookkeeping", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "bookkeeping.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.mrisoftware.com/",
    iconUrl: "/assets/integrations/mri.svg",
    logoColor: "#003B71",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.spaces", "financials.pnl", "financials.gl", "financials.receivables", "financials.payables", "analytics.noi", "analytics.capRate", "crm.tenants"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "financials.sync", "analytics.syncMetrics"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton", "analytics.toolbar.investmentMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your MRI Software API key from the MRI Connect portal." },
        { key: "clientId", label: "Client ID", type: "string", required: true, helpText: "Your MRI client identifier." },
        { key: "entityId", label: "Entity ID", type: "string", required: true, helpText: "The MRI entity/property ID for the asset to sync." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect MRI Software to sync your commercial real estate portfolio's lease data, tenant information, financial statements, and investment analytics into MarinaMatch.",
      prerequisites: [
        "MRI Software license with API access (MRI Connect)",
        "Administrator or IT access to generate API credentials",
        "Client ID and Entity ID from your MRI configuration"
      ],
      steps: [
        { title: "Access MRI Connect", description: "Log into MRI Connect at connect.mrisoftware.com." },
        { title: "Register Integration", description: "Navigate to Integrations > New Integration and register MarinaMatch as a new partner." },
        { title: "Generate API Key", description: "Create API credentials and copy the API Key." },
        { title: "Find Entity ID", description: "Your Entity ID is in the property configuration within MRI." },
        { title: "Enter Credentials", description: "Input your API Key, Client ID, and Entity ID." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access to your MRI data." }
      ],
      supportUrl: "https://www.mrisoftware.com/support/",
      apiDocsUrl: "https://developer.mrisoftware.com/",
      estimatedTime: "15-20 minutes"
    },
    dataMappings: [
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "LeaseId", target: "externalId" },
        { source: "TenantName", target: "tenantName" },
        { source: "SpaceId", target: "unitId" },
        { source: "CommencementDate", target: "startDate" },
        { source: "ExpirationDate", target: "endDate" },
        { source: "BaseRent", target: "monthlyRent" },
        { source: "LeaseType", target: "leaseType" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Tenants", targetModule: "crm", targetEntity: "tenants", fields: [
        { source: "TenantId", target: "externalId" },
        { source: "CompanyName", target: "companyName" },
        { source: "ContactName", target: "contactName" },
        { source: "Email", target: "email" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "GLEntries", targetModule: "financials", targetEntity: "gl", fields: [
        { source: "EntryId", target: "externalId" },
        { source: "AccountNo", target: "accountNumber" },
        { source: "Debit", target: "debit" },
        { source: "Credit", target: "credit" },
        { source: "PostDate", target: "date" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "high",
      estimatedMigrationDays: 30
    }
  },
  {
    key: "vts",
    name: "VTS",
    description: "Leasing and asset management platform for commercial landlords. Pipeline tracking, deal management, tenant engagement, and portfolio analytics for office, retail, and industrial assets.",
    category: "Commercial RE",
    assetClasses: ["retail", "office", "industrial"],
    contexts: ["rentRoll", "crm", "analytics"],
    uiPlacements: ["rentRoll.integrations.panel", "crm.integrations.panel", "analytics.integrations.panel"],
    authType: "oauth",
    websiteUrl: "https://www.vts.com/",
    iconUrl: "/assets/integrations/vts.svg",
    logoColor: "#0052CC",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.spaces", "crm.prospects", "crm.deals", "analytics.leasingVelocity", "analytics.stackingPlan"],
      dataWrite: [],
      actions: ["rentRoll.import", "crm.syncDeals", "analytics.syncLeasing"],
      uiHooks: ["crm.toolbar.dealPipeline", "analytics.toolbar.leasingMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your VTS API Client ID from the VTS Marketplace." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your VTS Client Secret. Stored encrypted." },
        { key: "buildingId", label: "Building ID", type: "string", required: true, helpText: "The VTS building identifier for the property." },
      ],
    },
    connectionGuide: {
      overview: "Connect VTS to sync your commercial property's leasing pipeline, space inventory, deal activity, and portfolio analytics into MarinaMatch.",
      prerequisites: [
        "VTS subscription with API access (VTS Marketplace)",
        "OAuth credentials from VTS Developer Portal",
        "Building ID from your VTS dashboard"
      ],
      steps: [
        { title: "Access VTS Marketplace", description: "Log into VTS and navigate to the Marketplace for API integrations." },
        { title: "Register Application", description: "Create a new app and obtain your OAuth Client ID and Secret." },
        { title: "Find Building ID", description: "Your Building ID is in the property details within your VTS dashboard." },
        { title: "Enter Credentials", description: "Input your OAuth credentials and Building ID." },
        { title: "Authorize", description: "Click 'Connect' to authorize MarinaMatch via OAuth flow." }
      ],
      supportUrl: "https://support.vts.com/",
      apiDocsUrl: "https://developer.vts.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Spaces", targetModule: "rentRoll", targetEntity: "spaces", fields: [
        { source: "spaceId", target: "externalId" },
        { source: "floor", target: "floor" },
        { source: "sqft", target: "squareFootage" },
        { source: "askingRent", target: "askingRent" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Deals", targetModule: "crm", targetEntity: "deals", fields: [
        { source: "dealId", target: "externalId" },
        { source: "tenantName", target: "tenantName" },
        { source: "spaceId", target: "spaceId" },
        { source: "proposedRent", target: "proposedRent" },
        { source: "stage", target: "stage" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "costar",
    name: "CoStar",
    description: "Commercial real estate data, analytics, and market intelligence. Comprehensive property data, comparable sales, market trends, and investment analytics across all CRE asset classes.",
    category: "Commercial RE",
    assetClasses: ["retail", "office", "industrial", "multifamily", "hotel", "self_storage", "mixed_use", "medical_office"],
    contexts: ["analytics", "crm", "financials"],
    uiPlacements: ["analytics.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.costar.com/",
    iconUrl: "/assets/integrations/costar.svg",
    logoColor: "#003366",
    capabilities: {
      dataRead: ["analytics.marketData", "analytics.comps", "analytics.demographics", "analytics.propertyData", "crm.propertyRecords", "financials.valuations"],
      dataWrite: [],
      actions: ["analytics.syncMarketData", "analytics.syncComps", "crm.importProperties"],
      uiHooks: ["analytics.toolbar.marketData", "crm.toolbar.propertySearch"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your CoStar API key from the CoStar Developer Portal." },
        { key: "subscriptionTier", label: "Subscription Tier", type: "select", required: true, options: [
          { label: "CoStar", value: "costar" },
          { label: "CoStar Suite", value: "suite" },
          { label: "CoStar Enterprise", value: "enterprise" },
        ], helpText: "Your CoStar subscription determines which data endpoints are available." },
        { key: "defaultMarket", label: "Default Market", type: "string", helpText: "Default market/MSA for market intelligence queries." },
      ],
    },
    connectionGuide: {
      overview: "Connect CoStar to access comprehensive commercial real estate market data, comparable sales, property analytics, and demographic intelligence directly within MarinaMatch.",
      prerequisites: [
        "CoStar subscription with API access",
        "API credentials from CoStar Developer Portal",
        "CoStar Suite or Enterprise for full API access"
      ],
      steps: [
        { title: "Access Developer Portal", description: "Contact your CoStar representative to obtain API Developer Portal access." },
        { title: "Register Application", description: "Create a new application in the developer portal and specify required data scopes." },
        { title: "Obtain API Key", description: "Copy your API key from the application settings page." },
        { title: "Enter Credentials", description: "Paste your API Key and select your subscription tier above." },
        { title: "Configure Default Market", description: "Set your default MSA for market data queries." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify API access." }
      ],
      supportUrl: "https://www.costar.com/support/",
      apiDocsUrl: "https://developer.costar.com/docs",
      estimatedTime: "15-20 minutes"
    },
    dataMappings: [
      { sourceEntity: "Properties", targetModule: "analytics", targetEntity: "propertyData", fields: [
        { source: "PropertyId", target: "externalId" },
        { source: "Address", target: "address" },
        { source: "PropertyType", target: "assetType" },
        { source: "YearBuilt", target: "yearBuilt" },
        { source: "TotalSF", target: "squareFootage" }
      ], syncDirection: "read", frequency: "weekly" },
      { sourceEntity: "SalesComps", targetModule: "analytics", targetEntity: "comps", fields: [
        { source: "SaleId", target: "externalId" },
        { source: "SalePrice", target: "salePrice" },
        { source: "SaleDate", target: "saleDate" },
        { source: "PricePSF", target: "pricePerSqFt" },
        { source: "CapRate", target: "capRate" }
      ], syncDirection: "read", frequency: "weekly" },
      { sourceEntity: "MarketStats", targetModule: "analytics", targetEntity: "marketData", fields: [
        { source: "Market", target: "market" },
        { source: "VacancyRate", target: "vacancyRate" },
        { source: "AskingRent", target: "avgAskingRent" },
        { source: "Absorption", target: "netAbsorption" }
      ], syncDirection: "read", frequency: "weekly" }
    ],
    migrationSupport: {
      canExportAll: false,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 3
    }
  },
  {
    key: "buildout",
    name: "Buildout",
    description: "CRE marketing and deal management platform. Listing distribution, offering memorandums, prospect tracking, and deal pipeline management for commercial brokers and owners.",
    category: "Commercial RE",
    assetClasses: ["retail", "office", "industrial", "mixed_use", "medical_office"],
    contexts: ["crm", "documents", "marketing"],
    uiPlacements: ["crm.integrations.panel", "documents.integrations.panel", "marketing.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://buildout.com/",
    iconUrl: "/assets/integrations/buildout.svg",
    logoColor: "#1A73E8",
    capabilities: {
      dataRead: ["crm.listings", "crm.prospects", "crm.deals", "documents.offeringMemos", "marketing.campaigns"],
      dataWrite: ["crm.listings"],
      actions: ["crm.syncListings", "crm.syncProspects", "documents.importOMs"],
      uiHooks: ["crm.toolbar.listingSync"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Buildout API key from Account Settings." },
        { key: "companyId", label: "Company ID", type: "string", required: true, helpText: "Your Buildout company identifier." },
        { key: "syncListings", label: "Sync Listings Bidirectionally", type: "boolean", helpText: "Push MarinaMatch listings to Buildout." },
      ],
    },
    connectionGuide: {
      overview: "Connect Buildout to sync your CRE listings, prospect pipeline, deal activity, and marketing materials between MarinaMatch and Buildout.",
      prerequisites: [
        "Buildout subscription with API access",
        "Company ID from Buildout account settings",
        "Administrator access"
      ],
      steps: [
        { title: "Access API Settings", description: "In Buildout, navigate to Settings > API & Integrations." },
        { title: "Generate API Key", description: "Click 'New API Key' and copy the generated key." },
        { title: "Find Company ID", description: "Your Company ID is in Account Settings > Company Info." },
        { title: "Enter Credentials", description: "Input your API Key and Company ID." },
        { title: "Configure Sync", description: "Choose whether to enable bidirectional listing sync." }
      ],
      supportUrl: "https://support.buildout.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Listings", targetModule: "crm", targetEntity: "listings", fields: [
        { source: "id", target: "externalId" },
        { source: "address", target: "address" },
        { source: "property_type", target: "propertyType" },
        { source: "listing_price", target: "price" },
        { source: "status", target: "status" }
      ], syncDirection: "bidirectional", frequency: "daily" },
      { sourceEntity: "Prospects", targetModule: "crm", targetEntity: "prospects", fields: [
        { source: "prospect_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "interest_level", target: "score" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },

  // ============ RESIDENTIAL PM (SFR/SMALL MULTI) ============
  {
    key: "propertyware",
    name: "Propertyware",
    description: "Single-family rental property management by RealPage. Purpose-built for SFR portfolios with leasing, accounting, maintenance, and owner reporting.",
    category: "Residential PM",
    assetClasses: ["sfr", "duplex", "triplex", "quad"],
    contexts: ["rentRoll", "financials", "bookkeeping", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "crm.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.propertyware.com/",
    iconUrl: "/assets/integrations/propertyware.svg",
    logoColor: "#E31937",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.receivables", "financials.ownerStatements", "crm.contacts", "crm.prospects"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "crm.syncContacts"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Propertyware API key from Account Settings > API." },
        { key: "clientId", label: "Client ID", type: "string", required: true, helpText: "Your Propertyware client identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Propertyware to sync your single-family rental portfolio's lease data, tenant records, financial statements, and owner reports into MarinaMatch.",
      prerequisites: [
        "Propertyware subscription with API access",
        "Administrator access to generate API credentials",
        "Client ID from account settings"
      ],
      steps: [
        { title: "Access API Settings", description: "In Propertyware, go to Settings > API & Integrations." },
        { title: "Generate API Key", description: "Click 'Create API Key' and copy the key and Client ID." },
        { title: "Enter Credentials", description: "Input your API Key and Client ID into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access." },
        { title: "Configure Sync", description: "Choose sync frequency and which properties to include." }
      ],
      supportUrl: "https://help.propertyware.com/",
      apiDocsUrl: "https://developer.propertyware.com/",
      estimatedTime: "10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "id", target: "externalId" },
        { source: "first_name", target: "firstName" },
        { source: "last_name", target: "lastName" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "id", target: "externalId" },
        { source: "unit_id", target: "unitId" },
        { source: "start_date", target: "startDate" },
        { source: "end_date", target: "endDate" },
        { source: "rent", target: "monthlyRent" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "OwnerStatements", targetModule: "financials", targetEntity: "ownerStatements", fields: [
        { source: "statement_id", target: "externalId" },
        { source: "owner_id", target: "ownerId" },
        { source: "period", target: "period" },
        { source: "income", target: "grossIncome" },
        { source: "expenses", target: "totalExpenses" },
        { source: "net", target: "netToOwner" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "buildium",
    name: "Buildium",
    description: "Property management for residential portfolios and community associations. Leasing, accounting, maintenance, and owner/board portals in one platform.",
    category: "Residential PM",
    assetClasses: ["sfr", "duplex", "triplex", "quad", "multifamily"],
    contexts: ["rentRoll", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.buildium.com/",
    iconUrl: "/assets/integrations/buildium.svg",
    logoColor: "#4A90D9",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.receivables", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "financials.import", "crm.syncContacts"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Buildium API key from Settings > API Access." },
        { key: "apiSecret", label: "API Secret", type: "secret", required: true, helpText: "Your Buildium API secret. Stored encrypted." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Buildium to sync your residential portfolio's lease data, tenant records, and financial information into MarinaMatch.",
      prerequisites: [
        "Buildium Premium or Growth subscription",
        "API credentials from Settings > API Access"
      ],
      steps: [
        { title: "Access API Settings", description: "In Buildium, go to Settings > API Access." },
        { title: "Generate Credentials", description: "Create a new API key and secret pair." },
        { title: "Enter Credentials", description: "Paste your API Key and Secret into the fields above." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access." }
      ],
      supportUrl: "https://www.buildium.com/support/",
      apiDocsUrl: "https://developer.buildium.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "Id", target: "externalId" },
        { source: "FirstName", target: "firstName" },
        { source: "LastName", target: "lastName" },
        { source: "Email", target: "email" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "Id", target: "externalId" },
        { source: "UnitId", target: "unitId" },
        { source: "LeaseFromDate", target: "startDate" },
        { source: "LeaseToDate", target: "endDate" },
        { source: "Rent", target: "monthlyRent" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 10
    }
  },
  {
    key: "rent_manager",
    name: "Rent Manager",
    description: "Flexible property management for residential portfolios of all sizes. Comprehensive accounting, leasing, work orders, and reporting with extensive customization options.",
    category: "Residential PM",
    assetClasses: ["sfr", "duplex", "triplex", "quad", "multifamily", "mobile_home"],
    contexts: ["rentRoll", "financials", "bookkeeping", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel", "bookkeeping.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.rentmanager.com/",
    iconUrl: "/assets/integrations/rentmanager.svg",
    logoColor: "#00529B",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.pnl", "financials.gl", "financials.receivables", "financials.payables", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync", "financials.import", "financials.sync"],
      uiHooks: ["rentRoll.toolbar.importButton", "financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Rent Manager API key from Admin > API Configuration." },
        { key: "locationId", label: "Location ID", type: "string", required: true, helpText: "Your Rent Manager location/company identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ] },
        { key: "includeGL", label: "Include General Ledger", type: "boolean", helpText: "Sync full GL entries for detailed accounting." },
      ],
    },
    connectionGuide: {
      overview: "Connect Rent Manager to sync your property portfolio's rent roll, tenant data, general ledger, and financial statements into MarinaMatch.",
      prerequisites: [
        "Rent Manager subscription with API module",
        "Admin access to generate API credentials",
        "Location ID from your account"
      ],
      steps: [
        { title: "Enable API Module", description: "Contact Rent Manager support to enable the API module for your account." },
        { title: "Generate API Key", description: "Go to Admin > API Configuration and generate a new key." },
        { title: "Find Location ID", description: "Your Location ID is in Admin > Company Settings." },
        { title: "Enter Credentials", description: "Input your API Key and Location ID." },
        { title: "Configure Options", description: "Enable GL sync if you need detailed accounting data." },
        { title: "Test Connection", description: "Verify access and start the initial sync." }
      ],
      supportUrl: "https://www.rentmanager.com/support/",
      apiDocsUrl: "https://developer.rentmanager.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "TenantID", target: "externalId" },
        { source: "FirstName", target: "firstName" },
        { source: "LastName", target: "lastName" },
        { source: "Email", target: "email" },
        { source: "Phone", target: "phone" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "LeaseID", target: "externalId" },
        { source: "UnitID", target: "unitId" },
        { source: "StartDate", target: "startDate" },
        { source: "EndDate", target: "endDate" },
        { source: "Rent", target: "monthlyRent" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "GLEntries", targetModule: "financials", targetEntity: "gl", fields: [
        { source: "EntryID", target: "externalId" },
        { source: "AccountNo", target: "accountNumber" },
        { source: "Debit", target: "debit" },
        { source: "Credit", target: "credit" },
        { source: "Date", target: "date" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 14
    }
  },
  {
    key: "tenantcloud",
    name: "TenantCloud",
    description: "Free and affordable property management software for independent landlords and small portfolios. Tenant screening, rent collection, maintenance, and basic accounting.",
    category: "Residential PM",
    assetClasses: ["sfr", "duplex", "triplex", "quad"],
    contexts: ["rentRoll", "financials", "crm"],
    uiPlacements: ["rentRoll.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.tenantcloud.com/",
    iconUrl: "/assets/integrations/tenantcloud.svg",
    logoColor: "#00BFA5",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "rentRoll.units", "financials.receivables", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "crm.syncContacts"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your TenantCloud API key from Settings > API." },
        { key: "accountId", label: "Account ID", type: "string", required: true, helpText: "Your TenantCloud account identifier." },
      ],
    },
    connectionGuide: {
      overview: "Connect TenantCloud to import your rental property's lease data, tenant records, and payment history into MarinaMatch.",
      prerequisites: [
        "TenantCloud subscription (Growth or Business plan for API access)",
        "Account ID from settings"
      ],
      steps: [
        { title: "Access API Settings", description: "In TenantCloud, go to Settings > Integrations > API." },
        { title: "Generate API Key", description: "Click 'Generate API Key' and copy the key." },
        { title: "Find Account ID", description: "Your Account ID is shown in Settings > Account." },
        { title: "Enter Credentials", description: "Input your API Key and Account ID." }
      ],
      supportUrl: "https://support.tenantcloud.com/",
      estimatedTime: "5 minutes"
    },
    dataMappings: [
      { sourceEntity: "Tenants", targetModule: "rentRoll", targetEntity: "tenants", fields: [
        { source: "id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Leases", targetModule: "rentRoll", targetEntity: "leases", fields: [
        { source: "id", target: "externalId" },
        { source: "start_date", target: "startDate" },
        { source: "end_date", target: "endDate" },
        { source: "rent", target: "monthlyRent" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: false,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },

  // ============ PAYROLL & HR ============
  {
    key: "gusto",
    name: "Gusto",
    description: "Modern payroll, benefits, and HR platform for small businesses. Automated payroll processing, tax filings, health insurance, 401(k), and compliance management.",
    category: "Payroll & HR",
    assetClasses: ["marina", "multifamily", "hotel", "retail", "office", "business", "laundromat", "self_storage", "rv_park", "industrial", "mixed_use", "medical_office"],
    contexts: ["financials", "bookkeeping", "analytics"],
    uiPlacements: ["financials.integrations.panel", "bookkeeping.integrations.panel"],
    authType: "oauth",
    websiteUrl: "https://gusto.com/",
    iconUrl: "/assets/integrations/gusto.svg",
    logoColor: "#F45D48",
    capabilities: {
      dataRead: ["financials.payroll", "financials.payrollTaxes", "financials.benefits", "bookkeeping.payrollJournalEntries", "analytics.laborCosts"],
      dataWrite: [],
      actions: ["financials.syncPayroll", "bookkeeping.syncPayrollEntries", "analytics.syncLaborCosts"],
      uiHooks: ["financials.toolbar.payrollButton"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your Gusto API Client ID from the Gusto Developer Portal." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your Gusto Client Secret. Stored encrypted." },
        { key: "companyId", label: "Company ID", type: "string", required: true, helpText: "Your Gusto company identifier (UUID format)." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "After Each Payroll", value: "realtime" },
          { label: "Weekly", value: "weekly" },
          { label: "Monthly", value: "monthly" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Gusto to automatically sync payroll data, labor costs, tax withholdings, and benefits expenses into MarinaMatch for accurate operating expense tracking and financial analysis.",
      prerequisites: [
        "Gusto subscription (Simple, Plus, or Premium plan)",
        "Company admin access to authorize API connections",
        "Gusto Developer Portal account for OAuth credentials"
      ],
      steps: [
        { title: "Register at Gusto Developer Portal", description: "Go to developer.gusto.com and register a new application." },
        { title: "Get OAuth Credentials", description: "Copy your Client ID and Client Secret from the app settings." },
        { title: "Find Company ID", description: "Your Company ID is in the URL when logged into Gusto (e.g., app.gusto.com/company/UUID)." },
        { title: "Enter Credentials", description: "Paste your OAuth credentials and Company ID into the fields above." },
        { title: "Authorize Connection", description: "Click 'Connect' to authorize MarinaMatch via Gusto's OAuth flow." },
        { title: "Configure Sync", description: "Choose how often to sync payroll data." }
      ],
      supportUrl: "https://support.gusto.com/",
      apiDocsUrl: "https://docs.gusto.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "Payrolls", targetModule: "financials", targetEntity: "payroll", fields: [
        { source: "payroll_id", target: "externalId" },
        { source: "pay_period_start", target: "periodStart" },
        { source: "pay_period_end", target: "periodEnd" },
        { source: "gross_pay", target: "grossPay" },
        { source: "net_pay", target: "netPay" },
        { source: "employer_taxes", target: "employerTaxes" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "PayrollJournalEntries", targetModule: "bookkeeping", targetEntity: "journalEntries", fields: [
        { source: "entry_id", target: "externalId" },
        { source: "debit_account", target: "debitAccount" },
        { source: "credit_account", target: "creditAccount" },
        { source: "amount", target: "amount" },
        { source: "date", target: "date" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "LaborCosts", targetModule: "analytics", targetEntity: "laborCosts", fields: [
        { source: "department", target: "department" },
        { source: "total_cost", target: "totalCost" },
        { source: "headcount", target: "headcount" },
        { source: "period", target: "period" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 7
    }
  },
  {
    key: "adp_run",
    name: "ADP RUN",
    description: "Payroll and HR solution for small to mid-size businesses by ADP. Automated payroll, tax compliance, benefits administration, and workforce management.",
    category: "Payroll & HR",
    assetClasses: ["marina", "multifamily", "hotel", "retail", "office", "business", "laundromat", "self_storage", "rv_park", "industrial", "mixed_use", "medical_office"],
    contexts: ["financials", "bookkeeping", "analytics"],
    uiPlacements: ["financials.integrations.panel", "bookkeeping.integrations.panel"],
    authType: "oauth",
    websiteUrl: "https://www.adp.com/what-we-offer/payroll/run-powered-by-adp.aspx",
    iconUrl: "/assets/integrations/adp.svg",
    logoColor: "#D0271D",
    capabilities: {
      dataRead: ["financials.payroll", "financials.payrollTaxes", "financials.benefits", "bookkeeping.payrollJournalEntries", "analytics.laborCosts"],
      dataWrite: [],
      actions: ["financials.syncPayroll", "bookkeeping.syncPayrollEntries"],
      uiHooks: ["financials.toolbar.payrollButton"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your ADP API Client ID from the ADP Marketplace." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your ADP Client Secret. Stored encrypted." },
        { key: "companyCode", label: "Company Code", type: "string", required: true, helpText: "Your ADP company code." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "After Each Payroll", value: "realtime" },
          { label: "Weekly", value: "weekly" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect ADP RUN to sync payroll data, labor costs, tax filings, and benefits expenses for accurate operating expense tracking.",
      prerequisites: [
        "ADP RUN subscription",
        "Company administrator access",
        "ADP Marketplace API credentials"
      ],
      steps: [
        { title: "Access ADP Marketplace", description: "Go to the ADP Marketplace and register MarinaMatch as a connected app." },
        { title: "Get OAuth Credentials", description: "Copy your Client ID and Client Secret from the app registration." },
        { title: "Find Company Code", description: "Your Company Code is in ADP RUN under Company > Company Info." },
        { title: "Enter Credentials", description: "Input your OAuth credentials and Company Code." },
        { title: "Authorize Connection", description: "Click 'Connect' to authorize via ADP's OAuth flow." }
      ],
      supportUrl: "https://www.adp.com/contact-us/support.aspx",
      apiDocsUrl: "https://developers.adp.com/",
      estimatedTime: "15-20 minutes"
    },
    dataMappings: [
      { sourceEntity: "PayrollOutputs", targetModule: "financials", targetEntity: "payroll", fields: [
        { source: "payrollId", target: "externalId" },
        { source: "payPeriod.startDate", target: "periodStart" },
        { source: "payPeriod.endDate", target: "periodEnd" },
        { source: "grossPay", target: "grossPay" },
        { source: "netPay", target: "netPay" },
        { source: "employerTaxes", target: "employerTaxes" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "GLEntries", targetModule: "bookkeeping", targetEntity: "journalEntries", fields: [
        { source: "entryId", target: "externalId" },
        { source: "debitAccount", target: "debitAccount" },
        { source: "creditAccount", target: "creditAccount" },
        { source: "amount", target: "amount" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 10
    }
  },
  {
    key: "paychex",
    name: "Paychex Flex",
    description: "Payroll, HR, and benefits administration platform. Scalable from small business to enterprise with flexible payroll processing, compliance, and workforce analytics.",
    category: "Payroll & HR",
    assetClasses: ["marina", "multifamily", "hotel", "retail", "office", "business", "laundromat", "self_storage", "rv_park", "industrial", "mixed_use", "medical_office"],
    contexts: ["financials", "bookkeeping", "analytics"],
    uiPlacements: ["financials.integrations.panel", "bookkeeping.integrations.panel"],
    authType: "oauth",
    websiteUrl: "https://www.paychex.com/",
    iconUrl: "/assets/integrations/paychex.svg",
    logoColor: "#004B87",
    capabilities: {
      dataRead: ["financials.payroll", "financials.payrollTaxes", "financials.benefits", "bookkeeping.payrollJournalEntries", "analytics.laborCosts"],
      dataWrite: [],
      actions: ["financials.syncPayroll", "bookkeeping.syncPayrollEntries"],
      uiHooks: ["financials.toolbar.payrollButton"],
    },
    settingsSchema: {
      fields: [
        { key: "clientId", label: "OAuth Client ID", type: "secret", required: true, helpText: "Your Paychex API Client ID from the Paychex Developer Portal." },
        { key: "clientSecret", label: "OAuth Client Secret", type: "secret", required: true, helpText: "Your Paychex Client Secret. Stored encrypted." },
        { key: "displayId", label: "Display ID", type: "string", required: true, helpText: "Your Paychex company Display ID (found in Flex under Company Settings)." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "After Each Payroll", value: "realtime" },
          { label: "Weekly", value: "weekly" },
        ] },
      ],
    },
    connectionGuide: {
      overview: "Connect Paychex Flex to sync payroll data, labor costs, and tax information for comprehensive operating expense tracking.",
      prerequisites: [
        "Paychex Flex subscription",
        "Company administrator access",
        "Paychex Developer Portal credentials"
      ],
      steps: [
        { title: "Access Developer Portal", description: "Go to developer.paychex.com and register a new application." },
        { title: "Get OAuth Credentials", description: "Copy your Client ID and Client Secret." },
        { title: "Find Display ID", description: "Your Display ID is in Paychex Flex under Company > Company Information." },
        { title: "Enter Credentials", description: "Input your OAuth credentials and Display ID." },
        { title: "Authorize Connection", description: "Click 'Connect' to authorize via Paychex OAuth." }
      ],
      supportUrl: "https://www.paychex.com/support/",
      apiDocsUrl: "https://developer.paychex.com/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "PayrollChecks", targetModule: "financials", targetEntity: "payroll", fields: [
        { source: "checkId", target: "externalId" },
        { source: "periodStart", target: "periodStart" },
        { source: "periodEnd", target: "periodEnd" },
        { source: "grossEarnings", target: "grossPay" },
        { source: "netPay", target: "netPay" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "JournalEntries", targetModule: "bookkeeping", targetEntity: "journalEntries", fields: [
        { source: "id", target: "externalId" },
        { source: "debit", target: "debitAccount" },
        { source: "credit", target: "creditAccount" },
        { source: "amount", target: "amount" },
        { source: "date", target: "date" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "medium",
      estimatedMigrationDays: 10
    }
  },

  // ============ BUSINESS OPERATIONS ============
  {
    key: "cleancloud",
    name: "CleanCloud",
    description: "Laundry and dry cleaning business management platform. POS, order tracking, pickup/delivery scheduling, CRM, and business analytics for laundromat operators.",
    category: "Business Operations",
    assetClasses: ["laundromat", "business"],
    contexts: ["financials", "crm", "analytics", "businessOps"],
    uiPlacements: ["financials.integrations.panel", "crm.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://cleancloud.com/",
    iconUrl: "/assets/integrations/cleancloud.svg",
    logoColor: "#00B8D4",
    capabilities: {
      dataRead: ["financials.revenue", "financials.transactions", "crm.customers", "analytics.salesMetrics", "businessOps.orders", "businessOps.inventory"],
      dataWrite: [],
      actions: ["financials.syncRevenue", "crm.syncCustomers", "analytics.syncMetrics"],
      uiHooks: ["financials.toolbar.importButton", "analytics.toolbar.salesMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your CleanCloud API key from Settings > Integrations." },
        { key: "storeId", label: "Store ID", type: "string", required: true, helpText: "Your CleanCloud store identifier." },
        { key: "syncFrequency", label: "Sync Frequency", type: "select", required: true, options: [
          { label: "Daily", value: "daily" },
          { label: "Weekly", value: "weekly" },
        ] },
        { key: "includeOrders", label: "Include Order Details", type: "boolean", helpText: "Sync individual order data for detailed revenue analysis." },
      ],
    },
    connectionGuide: {
      overview: "Connect CleanCloud to sync your laundromat's revenue, transaction data, customer records, and business analytics into MarinaMatch for comprehensive operating performance tracking.",
      prerequisites: [
        "CleanCloud subscription with API access",
        "Store ID from your CleanCloud account",
        "Administrator access"
      ],
      steps: [
        { title: "Access Integration Settings", description: "In CleanCloud, go to Settings > Integrations > API." },
        { title: "Generate API Key", description: "Click 'Create API Key' and copy the generated key." },
        { title: "Find Store ID", description: "Your Store ID is in Settings > Store Information." },
        { title: "Enter Credentials", description: "Paste your API Key and Store ID into the fields above." },
        { title: "Configure Options", description: "Enable order detail sync for granular revenue analysis." },
        { title: "Test Connection", description: "Click 'Test Connection' to verify access." }
      ],
      supportUrl: "https://support.cleancloud.com/",
      apiDocsUrl: "https://developer.cleancloud.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Orders", targetModule: "financials", targetEntity: "transactions", fields: [
        { source: "order_id", target: "externalId" },
        { source: "total", target: "amount" },
        { source: "created_at", target: "date" },
        { source: "payment_method", target: "paymentMethod" },
        { source: "status", target: "status" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Customers", targetModule: "crm", targetEntity: "contacts", fields: [
        { source: "customer_id", target: "externalId" },
        { source: "name", target: "name" },
        { source: "email", target: "email" },
        { source: "phone", target: "phone" },
        { source: "total_spent", target: "lifetimeValue" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "DailySummary", targetModule: "analytics", targetEntity: "salesMetrics", fields: [
        { source: "date", target: "date" },
        { source: "total_revenue", target: "revenue" },
        { source: "order_count", target: "orderCount" },
        { source: "avg_ticket", target: "avgTicketSize" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },
  {
    key: "cents_laundry",
    name: "Cents",
    description: "Laundromat management platform with POS, payment processing, wash-dry-fold management, and business intelligence. The modern operating system for laundromat owners.",
    category: "Business Operations",
    assetClasses: ["laundromat"],
    contexts: ["financials", "crm", "analytics", "businessOps"],
    uiPlacements: ["financials.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://www.trycents.com/",
    iconUrl: "/assets/integrations/cents.svg",
    logoColor: "#6C5CE7",
    capabilities: {
      dataRead: ["financials.revenue", "financials.transactions", "crm.customers", "analytics.salesMetrics", "businessOps.machineUsage", "businessOps.wdfOrders"],
      dataWrite: [],
      actions: ["financials.syncRevenue", "analytics.syncMetrics", "businessOps.syncMachineData"],
      uiHooks: ["analytics.toolbar.laundromatMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Cents API key from the admin dashboard." },
        { key: "locationId", label: "Location ID", type: "string", required: true, helpText: "Your Cents location identifier." },
        { key: "includeMachineData", label: "Include Machine Usage Data", type: "boolean", helpText: "Sync individual machine performance metrics." },
      ],
    },
    connectionGuide: {
      overview: "Connect Cents to sync your laundromat's revenue, transaction data, machine performance metrics, and customer analytics into MarinaMatch.",
      prerequisites: [
        "Cents subscription",
        "Admin access to the Cents dashboard",
        "Location ID from your account"
      ],
      steps: [
        { title: "Access Admin Dashboard", description: "Log into your Cents admin dashboard." },
        { title: "Navigate to API Settings", description: "Go to Settings > Integrations > API Access." },
        { title: "Generate API Key", description: "Create a new API key and copy it." },
        { title: "Find Location ID", description: "Your Location ID is on the dashboard or in Location Settings." },
        { title: "Enter Credentials", description: "Input your API Key and Location ID." }
      ],
      supportUrl: "https://support.trycents.com/",
      estimatedTime: "5-10 minutes"
    },
    dataMappings: [
      { sourceEntity: "Transactions", targetModule: "financials", targetEntity: "transactions", fields: [
        { source: "transaction_id", target: "externalId" },
        { source: "amount", target: "amount" },
        { source: "timestamp", target: "date" },
        { source: "type", target: "transactionType" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "MachineUsage", targetModule: "analytics", targetEntity: "machineMetrics", fields: [
        { source: "machine_id", target: "machineId" },
        { source: "cycles", target: "cycleCount" },
        { source: "revenue", target: "revenue" },
        { source: "date", target: "date" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "DailySummary", targetModule: "analytics", targetEntity: "salesMetrics", fields: [
        { source: "date", target: "date" },
        { source: "total_revenue", target: "revenue" },
        { source: "coin_revenue", target: "coinRevenue" },
        { source: "card_revenue", target: "cardRevenue" },
        { source: "wdf_revenue", target: "wdfRevenue" }
      ], syncDirection: "read", frequency: "daily" }
    ],
    migrationSupport: {
      canExportAll: true,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 5
    }
  },
  {
    key: "speedqueen",
    name: "SpeedQueen Insights",
    description: "Connected laundry management and analytics by Speed Queen. Machine monitoring, revenue tracking, remote diagnostics, and operational analytics for commercial laundry facilities.",
    category: "Business Operations",
    assetClasses: ["laundromat"],
    contexts: ["financials", "analytics", "businessOps"],
    uiPlacements: ["financials.integrations.panel", "analytics.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://speedqueen.com/speed-queen-insights/",
    iconUrl: "/assets/integrations/speedqueen.svg",
    logoColor: "#C8102E",
    capabilities: {
      dataRead: ["financials.revenue", "analytics.machinePerformance", "analytics.utilization", "businessOps.machineStatus", "businessOps.diagnostics"],
      dataWrite: [],
      actions: ["financials.syncRevenue", "analytics.syncMachineMetrics", "businessOps.syncDiagnostics"],
      uiHooks: ["analytics.toolbar.machineMetrics"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Speed Queen Insights API key from the account portal." },
        { key: "locationId", label: "Location ID", type: "string", required: true, helpText: "Your Speed Queen Insights location identifier." },
        { key: "includeDiagnostics", label: "Include Machine Diagnostics", type: "boolean", helpText: "Sync machine health and diagnostic data." },
      ],
    },
    connectionGuide: {
      overview: "Connect Speed Queen Insights to sync machine performance data, revenue metrics, utilization rates, and diagnostic information from your laundromat's connected equipment.",
      prerequisites: [
        "Speed Queen Insights account with connected machines",
        "API access (contact your Speed Queen representative)",
        "Location ID from your Insights dashboard"
      ],
      steps: [
        { title: "Request API Access", description: "Contact your Speed Queen representative to enable API access for your Insights account." },
        { title: "Receive API Key", description: "You'll receive your API key via the Insights portal or from your representative." },
        { title: "Find Location ID", description: "Your Location ID is on the main Insights dashboard." },
        { title: "Enter Credentials", description: "Input your API Key and Location ID." },
        { title: "Configure Options", description: "Enable machine diagnostics for predictive maintenance insights." }
      ],
      supportUrl: "https://speedqueen.com/support/",
      estimatedTime: "10-15 minutes"
    },
    dataMappings: [
      { sourceEntity: "RevenueData", targetModule: "financials", targetEntity: "revenue", fields: [
        { source: "date", target: "date" },
        { source: "total_revenue", target: "totalRevenue" },
        { source: "vend_revenue", target: "vendRevenue" },
        { source: "cycle_count", target: "totalCycles" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "MachineMetrics", targetModule: "analytics", targetEntity: "machineMetrics", fields: [
        { source: "machine_id", target: "machineId" },
        { source: "model", target: "model" },
        { source: "cycles_today", target: "cycleCount" },
        { source: "utilization_pct", target: "utilizationRate" },
        { source: "revenue", target: "revenue" }
      ], syncDirection: "read", frequency: "daily" },
      { sourceEntity: "Diagnostics", targetModule: "businessOps", targetEntity: "machineDiagnostics", fields: [
        { source: "machine_id", target: "machineId" },
        { source: "error_code", target: "errorCode" },
        { source: "severity", target: "severity" },
        { source: "timestamp", target: "reportedAt" }
      ], syncDirection: "read", frequency: "hourly" }
    ],
    migrationSupport: {
      canExportAll: false,
      supportsHistoricalImport: true,
      migrationComplexity: "low",
      estimatedMigrationDays: 3
    }
  },
];

export function getIntegrationByKey(key: string): IntegrationRegistryItem | undefined {
  return INTEGRATION_REGISTRY.find(i => i.key === key);
}

export function getIntegrationsByContext(context: string): IntegrationRegistryItem[] {
  return INTEGRATION_REGISTRY.filter(i => i.contexts.includes(context));
}

export function getIntegrationsByCategory(category: string): IntegrationRegistryItem[] {
  return INTEGRATION_REGISTRY.filter(i => i.category === category);
}

export function getIntegrationsByPlacement(placement: string): IntegrationRegistryItem[] {
  return INTEGRATION_REGISTRY.filter(i => i.uiPlacements.includes(placement));
}

export function getAllCategories(): string[] {
  return [...new Set(INTEGRATION_REGISTRY.map(i => i.category))];
}

export function getIntegrationsByAssetClass(assetClass: string): IntegrationRegistryItem[] {
  return INTEGRATION_REGISTRY.filter(i => i.assetClasses.includes(assetClass));
}

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
  category: "Marina PMS" | "Reservations & Booking" | "Service & Maintenance" | "Communications" | "Accounting" | "Transaction Management" | "Document & E-Signature";
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

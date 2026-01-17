export type AuthType = "oauth" | "apiKey" | "none";

export type IntegrationRegistryItem = {
  key: string;
  name: string;
  description: string;
  categories: string[];
  contexts: Array<
    "boatRentals" | "fuelSales" | "financials" | "crm" | "documents" | "analytics" | "marketing" | "rentRoll" | "shipStore" | string
  >;
  uiPlacements: string[];
  authType: AuthType;
  websiteUrl?: string;
  iconUrl?: string;
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
};

export const INTEGRATION_REGISTRY: IntegrationRegistryItem[] = [
  {
    key: "fareharbor",
    name: "FareHarbor",
    description: "Sync bookings, availability, and customer data from FareHarbor.",
    categories: ["Reservations", "Operations"],
    contexts: ["boatRentals"],
    uiPlacements: ["boatRentals.integrations.panel", "boatRentals.actions.importReservations"],
    authType: "oauth",
    websiteUrl: "https://fareharbor.com/",
    iconUrl: "/assets/integrations/fareharbor.svg",
    capabilities: {
      dataRead: ["boatRentals.reservations", "boatRentals.customers", "boatRentals.availability"],
      dataWrite: [],
      actions: ["boatRentals.import", "boatRentals.sync"],
      uiHooks: ["boatRentals.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        {
          key: "syncFrequency",
          label: "Sync Frequency",
          type: "select",
          required: true,
          options: [
            { label: "Hourly", value: "hourly" },
            { label: "Daily", value: "daily" },
          ],
          helpText: "How often MarinaMatch should pull reservation updates.",
        },
      ],
    },
  },
  {
    key: "petrosoft",
    name: "Fuel POS (Petrosoft)",
    description: "Connect fuel POS data for gallons, margin, and daily sales summaries.",
    categories: ["POS", "Fuel"],
    contexts: ["fuelSales"],
    uiPlacements: ["fuelSales.integrations.panel", "fuelSales.actions.importDailyClose"],
    authType: "apiKey",
    websiteUrl: "https://petrosoftinc.com/",
    iconUrl: "/assets/integrations/petrosoft.svg",
    capabilities: {
      dataRead: ["fuelSales.transactions", "fuelSales.dailyClose", "fuelSales.inventory"],
      dataWrite: [],
      actions: ["fuelSales.import", "fuelSales.reconcile"],
      uiHooks: ["fuelSales.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Stored encrypted." },
        { key: "storeId", label: "Store ID", type: "string", required: true },
      ],
    },
  },
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync P&L and Chart of Accounts into MarinaMatch Financials.",
    categories: ["Accounting", "Financials"],
    contexts: ["financials"],
    uiPlacements: ["financials.integrations.panel", "financials.toolbar.importButton"],
    authType: "oauth",
    websiteUrl: "https://quickbooks.intuit.com/",
    iconUrl: "/assets/integrations/quickbooks.svg",
    capabilities: {
      dataRead: ["financials.pnl", "financials.coa"],
      dataWrite: [],
      actions: ["financials.import", "financials.sync"],
      uiHooks: ["financials.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        {
          key: "syncFrequency",
          label: "Sync Frequency",
          type: "select",
          required: true,
          options: [
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
          ],
        },
      ],
    },
  },
  {
    key: "dockmaster",
    name: "Dockmaster",
    description: "Import slip reservations and tenant data from Dockmaster PMS.",
    categories: ["Marina Management", "PMS"],
    contexts: ["rentRoll", "crm"],
    uiPlacements: ["rentRoll.integrations.panel", "rentRoll.actions.importLeases"],
    authType: "apiKey",
    websiteUrl: "https://dfrpms.com/",
    iconUrl: "/assets/integrations/dockmaster.svg",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.tenants", "crm.contacts"],
      dataWrite: [],
      actions: ["rentRoll.import", "rentRoll.sync"],
      uiHooks: ["rentRoll.toolbar.importButton"],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "siteId", label: "Site ID", type: "string", required: true },
      ],
    },
  },
  {
    key: "marinaoffice",
    name: "Marina Office",
    description: "Sync billing, reservations, and customer data from Marina Office.",
    categories: ["Marina Management", "PMS"],
    contexts: ["rentRoll", "financials"],
    uiPlacements: ["rentRoll.integrations.panel", "financials.integrations.panel"],
    authType: "apiKey",
    websiteUrl: "https://marinaoffice.com/",
    iconUrl: "/assets/integrations/marinaoffice.svg",
    capabilities: {
      dataRead: ["rentRoll.leases", "rentRoll.billing", "financials.receivables"],
      dataWrite: [],
      actions: ["rentRoll.import", "financials.sync"],
      uiHooks: [],
    },
    settingsSchema: {
      fields: [
        { key: "apiKey", label: "API Key", type: "secret", required: true },
        { key: "propertyId", label: "Property ID", type: "string", required: true },
      ],
    },
  },
  {
    key: "shopify",
    name: "Shopify",
    description: "Sync ship store inventory and sales from Shopify POS.",
    categories: ["E-commerce", "POS"],
    contexts: ["shipStore"],
    uiPlacements: ["shipStore.integrations.panel", "shipStore.actions.syncInventory"],
    authType: "oauth",
    websiteUrl: "https://shopify.com/",
    iconUrl: "/assets/integrations/shopify.svg",
    capabilities: {
      dataRead: ["shipStore.products", "shipStore.orders", "shipStore.inventory"],
      dataWrite: ["shipStore.inventory"],
      actions: ["shipStore.sync", "shipStore.import"],
      uiHooks: ["shipStore.toolbar.syncButton"],
    },
    settingsSchema: {
      fields: [
        {
          key: "syncInventory",
          label: "Auto-sync Inventory",
          type: "boolean",
          helpText: "Automatically sync inventory levels every hour.",
        },
      ],
    },
  },
  {
    key: "stripe",
    name: "Stripe",
    description: "Payment processing and billing automation.",
    categories: ["Payments", "Billing"],
    contexts: ["financials", "rentRoll"],
    uiPlacements: ["financials.integrations.panel", "rentRoll.billing.panel"],
    authType: "oauth",
    websiteUrl: "https://stripe.com/",
    iconUrl: "/assets/integrations/stripe.svg",
    capabilities: {
      dataRead: ["payments.transactions", "payments.customers"],
      dataWrite: ["payments.invoices", "payments.subscriptions"],
      actions: ["payments.charge", "payments.refund"],
      uiHooks: ["billing.paymentButton"],
    },
    settingsSchema: {
      fields: [
        {
          key: "webhookEnabled",
          label: "Enable Webhooks",
          type: "boolean",
          helpText: "Receive real-time payment notifications.",
        },
      ],
    },
  },
  {
    key: "constant_contact",
    name: "Constant Contact",
    description: "Email marketing automation and campaign management.",
    categories: ["Marketing", "Email"],
    contexts: ["marketing", "crm"],
    uiPlacements: ["marketing.integrations.panel", "crm.actions.addToCampaign"],
    authType: "oauth",
    websiteUrl: "https://constantcontact.com/",
    iconUrl: "/assets/integrations/constantcontact.svg",
    capabilities: {
      dataRead: ["marketing.campaigns", "marketing.contacts"],
      dataWrite: ["marketing.contacts", "marketing.lists"],
      actions: ["marketing.sync", "marketing.addContact"],
      uiHooks: ["crm.toolbar.addToCampaign"],
    },
    settingsSchema: {
      fields: [
        {
          key: "defaultListId",
          label: "Default Contact List",
          type: "string",
          helpText: "List ID for new contacts from CRM.",
        },
      ],
    },
  },
];

export function getIntegrationByKey(key: string): IntegrationRegistryItem | undefined {
  return INTEGRATION_REGISTRY.find(i => i.key === key);
}

export function getIntegrationsByContext(context: string): IntegrationRegistryItem[] {
  return INTEGRATION_REGISTRY.filter(i => i.contexts.includes(context));
}

export function getIntegrationsByPlacement(placement: string): IntegrationRegistryItem[] {
  return INTEGRATION_REGISTRY.filter(i => i.uiPlacements.includes(placement));
}

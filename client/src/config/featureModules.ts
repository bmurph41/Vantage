// featureModules.ts
// Place this file in: src/config/featureModules.ts
// Defines all feature modules and subscription packages

// ═══════════════════════════════════════════════════════════════
// FEATURE MODULE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const FEATURE_MODULES = {
  // ─────────────────────────────────────────────────────────────
  // DASHBOARD (Always included - base module)
  // ─────────────────────────────────────────────────────────────
  DASHBOARD: 'dashboard',

  // ─────────────────────────────────────────────────────────────
  // CRM MODULES
  // ─────────────────────────────────────────────────────────────
  CRM_CORE: 'crm.core',           // Contacts, Companies, Properties
  CRM_PIPELINE: 'crm.pipeline',   // Deals, Activity Log
  CRM_TASKS: 'crm.tasks',         // Tasks & Follow-Ups
  CRM_FORECAST: 'crm.forecast',   // Forecast

  // ─────────────────────────────────────────────────────────────
  // PROSPECTING MODULES
  // ─────────────────────────────────────────────────────────────
  PROSPECTING_CORE: 'prospecting.core',         // Overview, Workroom
  PROSPECTING_MARKETING: 'prospecting.marketing', // Marketing tools

  // ─────────────────────────────────────────────────────────────
  // DEAL ROOM MODULES
  // ─────────────────────────────────────────────────────────────
  DEALROOM_PROJECTS: 'dealroom.projects',   // Projects
  DEALROOM_DD: 'dealroom.dd',               // DD Projects (Due Diligence)
  DEALROOM_DATAROOM: 'dealroom.dataroom',   // Data Room

  // ─────────────────────────────────────────────────────────────
  // UNDERWRITING MODULES
  // ─────────────────────────────────────────────────────────────
  UNDERWRITING_VALUATOR: 'underwriting.valuator',   // Valuator
  UNDERWRITING_DEBT: 'underwriting.debt',           // Debt Scenarios
  UNDERWRITING_EXIT: 'underwriting.exit',           // Exit Strategies
  UNDERWRITING_OM: 'underwriting.om',               // OM Builder
  UNDERWRITING_SETTINGS: 'underwriting.settings',   // Modeling Settings

  // ─────────────────────────────────────────────────────────────
  // ANALYTICS (MARINALYTICS) MODULES
  // ─────────────────────────────────────────────────────────────
  ANALYTICS_NEWS: 'analytics.news',               // Docket
  ANALYTICS_COMPS: 'analytics.comps',             // Sales Comps, Rate Comps
  ANALYTICS_DEMOGRAPHICS: 'analytics.demographics', // Demographics
  ANALYTICS_CAPITAL: 'analytics.capital',         // Capital Markets
  ANALYTICS_PORTFOLIO: 'analytics.portfolio',     // Portfolio Analytics

  // ─────────────────────────────────────────────────────────────
  // OPERATIONS MODULES
  // ─────────────────────────────────────────────────────────────
  OPS_PORTFOLIO: 'ops.portfolio',       // Portfolio overview
  OPS_DOCKAGE: 'ops.dockage',           // Dockit
  OPS_TENANTS: 'ops.tenants',           // Commercial Tenants
  OPS_FUEL: 'ops.fuel',                 // Fuel Sales
  OPS_RETAIL: 'ops.retail',             // Ship Store
  OPS_SERVICE: 'ops.service',           // Service Dept
  OPS_RENTALS: 'ops.rentals',           // Boat Rentals
  OPS_CLUB: 'ops.club',                 // Boat Club
  OPS_SALES: 'ops.sales',               // Boat Sales
  OPS_BOOKKEEPING: 'ops.bookkeeping',
  OPS_PAYROLL: 'ops.payroll',           // Payroll

  // ─────────────────────────────────────────────────────────────
  // INTEGRATIONS MODULES
  // ─────────────────────────────────────────────────────────────
  INTEGRATIONS_MARKETPLACE: 'integrations.marketplace', // Marketplace
} as const;

export type FeatureModule = typeof FEATURE_MODULES[keyof typeof FEATURE_MODULES];

// ═══════════════════════════════════════════════════════════════
// MODULE METADATA (for UI display)
// ═══════════════════════════════════════════════════════════════

export interface ModuleInfo {
  key: FeatureModule;
  name: string;
  description: string;
  category: string;
  price?: number;        // Monthly add-on price (if sold separately)
  includedIn?: string[]; // Package slugs that include this
}

export const MODULE_INFO: Record<FeatureModule, ModuleInfo> = {
  // Dashboard
  [FEATURE_MODULES.DASHBOARD]: {
    key: FEATURE_MODULES.DASHBOARD,
    name: 'Dashboard',
    description: 'Main dashboard and overview',
    category: 'Core',
    includedIn: ['all'],
  },

  // CRM
  [FEATURE_MODULES.CRM_CORE]: {
    key: FEATURE_MODULES.CRM_CORE,
    name: 'CRM Core',
    description: 'Contacts, Companies, and Properties management',
    category: 'CRM',
    includedIn: ['investor-essentials', 'broker-pro', 'owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.CRM_PIPELINE]: {
    key: FEATURE_MODULES.CRM_PIPELINE,
    name: 'Deal Pipeline',
    description: 'Deal board and activity tracking',
    category: 'CRM',
    price: 29,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.CRM_TASKS]: {
    key: FEATURE_MODULES.CRM_TASKS,
    name: 'Tasks & Follow-Ups',
    description: 'Task management and follow-up reminders',
    category: 'CRM',
    price: 15,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.CRM_FORECAST]: {
    key: FEATURE_MODULES.CRM_FORECAST,
    name: 'Pipeline Forecast',
    description: 'Sales forecasting and pipeline analytics',
    category: 'CRM',
    price: 25,
    includedIn: ['broker-pro', 'full-platform'],
  },

  // Prospecting
  [FEATURE_MODULES.PROSPECTING_CORE]: {
    key: FEATURE_MODULES.PROSPECTING_CORE,
    name: 'Prospecting Core',
    description: 'Overview and workroom for lead generation',
    category: 'Prospecting',
    price: 20,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.PROSPECTING_MARKETING]: {
    key: FEATURE_MODULES.PROSPECTING_MARKETING,
    name: 'Marketing Tools',
    description: 'Email campaigns and marketing automation',
    category: 'Prospecting',
    price: 35,
    includedIn: ['broker-pro', 'full-platform'],
  },

  // Deal Room
  [FEATURE_MODULES.DEALROOM_PROJECTS]: {
    key: FEATURE_MODULES.DEALROOM_PROJECTS,
    name: 'Projects',
    description: 'Deal project management',
    category: 'Deal Room',
    includedIn: ['investor-essentials', 'broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.DEALROOM_DD]: {
    key: FEATURE_MODULES.DEALROOM_DD,
    name: 'Due Diligence',
    description: 'DD project tracking and checklists',
    category: 'Deal Room',
    price: 30,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.DEALROOM_DATAROOM]: {
    key: FEATURE_MODULES.DEALROOM_DATAROOM,
    name: 'Data Room',
    description: 'Secure document sharing and management',
    category: 'Deal Room',
    includedIn: ['investor-essentials', 'broker-pro', 'full-platform'],
  },

  // Underwriting
  [FEATURE_MODULES.UNDERWRITING_VALUATOR]: {
    key: FEATURE_MODULES.UNDERWRITING_VALUATOR,
    name: 'Financial Model',
    description: 'Property valuation and analysis',
    category: 'Underwriting',
    includedIn: ['investor-essentials', 'broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.UNDERWRITING_DEBT]: {
    key: FEATURE_MODULES.UNDERWRITING_DEBT,
    name: 'Debt Scenarios',
    description: 'Financing scenario modeling',
    category: 'Underwriting',
    price: 25,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.UNDERWRITING_EXIT]: {
    key: FEATURE_MODULES.UNDERWRITING_EXIT,
    name: 'Exit Strategies',
    description: 'Exit planning and ROI projections',
    category: 'Underwriting',
    price: 25,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.UNDERWRITING_OM]: {
    key: FEATURE_MODULES.UNDERWRITING_OM,
    name: 'Investment Materials',
    description: 'Offering memorandum generation',
    category: 'Underwriting',
    price: 40,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.UNDERWRITING_SETTINGS]: {
    key: FEATURE_MODULES.UNDERWRITING_SETTINGS,
    name: 'Model Settings',
    description: 'Custom modeling parameters',
    category: 'Underwriting',
    includedIn: ['investor-essentials', 'broker-pro', 'full-platform'],
  },

  // Analytics
  [FEATURE_MODULES.ANALYTICS_NEWS]: {
    key: FEATURE_MODULES.ANALYTICS_NEWS,
    name: 'The Docket',
    description: 'Industry news and insights',
    category: 'Analytics',
    includedIn: ['investor-essentials', 'broker-pro', 'owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.ANALYTICS_COMPS]: {
    key: FEATURE_MODULES.ANALYTICS_COMPS,
    name: 'Sales & Rate Comps',
    description: 'Comparable sales and rate analysis',
    category: 'Analytics',
    includedIn: ['investor-essentials', 'broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS]: {
    key: FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS,
    name: 'Demographics',
    description: 'Market demographic analysis',
    category: 'Analytics',
    price: 20,
    includedIn: ['broker-pro', 'owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.ANALYTICS_CAPITAL]: {
    key: FEATURE_MODULES.ANALYTICS_CAPITAL,
    name: 'Capital Markets',
    description: 'Capital market trends and data',
    category: 'Analytics',
    price: 35,
    includedIn: ['broker-pro', 'full-platform'],
  },
  [FEATURE_MODULES.ANALYTICS_PORTFOLIO]: {
    key: FEATURE_MODULES.ANALYTICS_PORTFOLIO,
    name: 'Portfolio Analytics',
    description: 'Portfolio performance tracking',
    category: 'Analytics',
    price: 30,
    includedIn: ['owner-operator', 'full-platform'],
  },

  // Operations
  [FEATURE_MODULES.OPS_PORTFOLIO]: {
    key: FEATURE_MODULES.OPS_PORTFOLIO,
    name: 'Portfolio Overview',
    description: 'Marina portfolio management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_DOCKAGE]: {
    key: FEATURE_MODULES.OPS_DOCKAGE,
    name: 'Dockit',
    description: 'Slip and dockage management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_TENANTS]: {
    key: FEATURE_MODULES.OPS_TENANTS,
    name: 'Commercial Tenants',
    description: 'Tenant management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_FUEL]: {
    key: FEATURE_MODULES.OPS_FUEL,
    name: 'Fuel Sales',
    description: 'Fuel sales tracking',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_RETAIL]: {
    key: FEATURE_MODULES.OPS_RETAIL,
    name: 'Ship Store',
    description: 'Retail and ship store management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_SERVICE]: {
    key: FEATURE_MODULES.OPS_SERVICE,
    name: 'Service Dept',
    description: 'Service department management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_RENTALS]: {
    key: FEATURE_MODULES.OPS_RENTALS,
    name: 'Boat Rentals',
    description: 'Rental fleet management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_CLUB]: {
    key: FEATURE_MODULES.OPS_CLUB,
    name: 'Boat Club',
    description: 'Boat club membership management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_SALES]: {
    key: FEATURE_MODULES.OPS_SALES,
    name: 'Boat Sales',
    description: 'Boat sales tracking',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_BOOKKEEPING]: {
    key: FEATURE_MODULES.OPS_BOOKKEEPING,
    name: 'Bookkeeping',
    description: 'Financial tracking and reporting',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },
  [FEATURE_MODULES.OPS_PAYROLL]: {
    key: FEATURE_MODULES.OPS_PAYROLL,
    name: 'Payroll',
    description: 'Staff payroll and labor cost management',
    category: 'Operations',
    includedIn: ['owner-operator', 'full-platform'],
  },

  // Integrations
  [FEATURE_MODULES.INTEGRATIONS_MARKETPLACE]: {
    key: FEATURE_MODULES.INTEGRATIONS_MARKETPLACE,
    name: 'Marketplace',
    description: 'Third-party integrations and apps',
    category: 'Integrations',
    includedIn: ['broker-pro', 'full-platform'],
  },
};

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION PACKAGES
// ═══════════════════════════════════════════════════════════════

export interface SubscriptionPackage {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  modules: FeatureModule[];
  recommended?: boolean;
  popular?: boolean;
  targetPersona: string[];
  features: string[];  // Marketing bullet points
}

export const SUBSCRIPTION_PACKAGES: SubscriptionPackage[] = [
  {
    id: 'tier_starter',
    slug: 'starter',
    name: 'Starter',
    description: 'Explore the platform with market news and sample analytics',
    priceMonthly: 0,
    priceYearly: 0,
    targetPersona: ['investor', 'broker', 'owner', 'lender', 'consultant', 'other'],
    modules: [
      FEATURE_MODULES.DASHBOARD,
      FEATURE_MODULES.ANALYTICS_NEWS,
    ],
    features: [
      'Dashboard overview',
      'The Docket — industry news & alerts',
      'MarinaMatch marketplace (browse)',
      '3 sample sales comps',
      'Demographics preview',
      '1 deal workspace (view only)',
    ],
  },
  {
    id: 'tier_investor',
    slug: 'investor',
    name: 'Investor',
    description: 'Full analysis and modeling tools for evaluating acquisitions',
    priceMonthly: 99,
    priceYearly: 990,
    targetPersona: ['investor', 'lender'],
    modules: [
      FEATURE_MODULES.DASHBOARD,
      FEATURE_MODULES.ANALYTICS_NEWS,
      FEATURE_MODULES.ANALYTICS_COMPS,
      FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS,
      FEATURE_MODULES.ANALYTICS_CAPITAL,
      FEATURE_MODULES.DEALROOM_PROJECTS,
      FEATURE_MODULES.DEALROOM_DATAROOM,
      FEATURE_MODULES.UNDERWRITING_VALUATOR,
      FEATURE_MODULES.UNDERWRITING_DEBT,
      FEATURE_MODULES.UNDERWRITING_EXIT,
      FEATURE_MODULES.UNDERWRITING_SETTINGS,
    ],
    features: [
      'Everything in Starter',
      'Unlimited deal workspaces',
      'Financial modeling (Pro Forma, DCF, Monte Carlo)',
      'Exit Strategy Suite',
      'Sales & Rate Comps (full access)',
      'Demographics & Capital Markets data',
      'Secure Data Room',
    ],
  },
  {
    id: 'tier_broker',
    slug: 'broker',
    name: 'Broker',
    description: 'Complete deal management toolkit for brokers and advisors',
    priceMonthly: 199,
    priceYearly: 1990,
    popular: true,
    targetPersona: ['broker', 'consultant'],
    modules: [
      // All of Investor
      FEATURE_MODULES.DASHBOARD,
      FEATURE_MODULES.ANALYTICS_NEWS,
      FEATURE_MODULES.ANALYTICS_COMPS,
      FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS,
      FEATURE_MODULES.ANALYTICS_CAPITAL,
      FEATURE_MODULES.DEALROOM_PROJECTS,
      FEATURE_MODULES.DEALROOM_DATAROOM,
      FEATURE_MODULES.UNDERWRITING_VALUATOR,
      FEATURE_MODULES.UNDERWRITING_DEBT,
      FEATURE_MODULES.UNDERWRITING_EXIT,
      FEATURE_MODULES.UNDERWRITING_SETTINGS,
      // Plus broker-specific
      FEATURE_MODULES.CRM_CORE,
      FEATURE_MODULES.CRM_PIPELINE,
      FEATURE_MODULES.CRM_TASKS,
      FEATURE_MODULES.CRM_FORECAST,
      FEATURE_MODULES.PROSPECTING_CORE,
      FEATURE_MODULES.PROSPECTING_MARKETING,
      FEATURE_MODULES.DEALROOM_DD,
      FEATURE_MODULES.UNDERWRITING_OM,
      FEATURE_MODULES.INTEGRATIONS_MARKETPLACE,
    ],
    features: [
      'Everything in Investor',
      'Full CRM (contacts, companies, properties)',
      'Deal Pipeline & Kanban board',
      'Tasks, Follow-ups & Forecasting',
      'Prospecting & Marketing tools',
      'OM Builder & Investment Materials',
      'Due Diligence tracking',
    ],
  },
  {
    id: 'tier_owner_operator',
    slug: 'owner-operator',
    name: 'Owner / Operator',
    description: 'End-to-end marina management — deals, operations, and financials',
    priceMonthly: 249,
    priceYearly: 2490,
    targetPersona: ['owner', 'operator'],
    modules: [
      // All of Broker
      FEATURE_MODULES.DASHBOARD,
      FEATURE_MODULES.ANALYTICS_NEWS,
      FEATURE_MODULES.ANALYTICS_COMPS,
      FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS,
      FEATURE_MODULES.ANALYTICS_CAPITAL,
      FEATURE_MODULES.ANALYTICS_PORTFOLIO,
      FEATURE_MODULES.DEALROOM_PROJECTS,
      FEATURE_MODULES.DEALROOM_DATAROOM,
      FEATURE_MODULES.UNDERWRITING_VALUATOR,
      FEATURE_MODULES.UNDERWRITING_DEBT,
      FEATURE_MODULES.UNDERWRITING_EXIT,
      FEATURE_MODULES.UNDERWRITING_SETTINGS,
      FEATURE_MODULES.CRM_CORE,
      FEATURE_MODULES.CRM_PIPELINE,
      FEATURE_MODULES.CRM_TASKS,
      FEATURE_MODULES.CRM_FORECAST,
      FEATURE_MODULES.PROSPECTING_CORE,
      FEATURE_MODULES.PROSPECTING_MARKETING,
      FEATURE_MODULES.DEALROOM_DD,
      FEATURE_MODULES.UNDERWRITING_OM,
      FEATURE_MODULES.INTEGRATIONS_MARKETPLACE,
      // Plus operations
      FEATURE_MODULES.OPS_PORTFOLIO,
      FEATURE_MODULES.OPS_DOCKAGE,
      FEATURE_MODULES.OPS_TENANTS,
      FEATURE_MODULES.OPS_FUEL,
      FEATURE_MODULES.OPS_RETAIL,
      FEATURE_MODULES.OPS_SERVICE,
      FEATURE_MODULES.OPS_RENTALS,
      FEATURE_MODULES.OPS_CLUB,
      FEATURE_MODULES.OPS_SALES,
      FEATURE_MODULES.OPS_BOOKKEEPING,
      FEATURE_MODULES.OPS_PAYROLL,
    ],
    features: [
      'Everything in Broker',
      'Full Operations suite (Dockit, Fuel, Ship Store, Service)',
      'Rent Roll management',
      'Bookkeeping & Payroll',
      'Commercial Tenants',
      'Portfolio Analytics',
    ],
  },
  {
    id: 'tier_institutional',
    slug: 'institutional',
    name: 'Institutional',
    description: 'Enterprise-grade platform for PE firms and institutional investors',
    priceMonthly: 499,
    priceYearly: 4990,
    recommended: true,
    targetPersona: ['consultant', 'other'],
    modules: Object.values(FEATURE_MODULES), // Everything
    features: [
      'Everything in Owner / Operator',
      'Fund Management (capital calls, distributions, NAV)',
      'LP Portal with investor statements',
      'Analytics Pro (predictive, benchmarking)',
      'API access',
      'Priority support',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// PERSONA DEFINITIONS (for onboarding)
// ═══════════════════════════════════════════════════════════════

export interface PersonaOption {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  recommendedPackage: string; // Package slug
}

export const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'investor',
    name: 'Investor',
    description: 'I invest in marina properties',
    icon: 'TrendingUp',
    recommendedPackage: 'investor',
  },
  {
    id: 'broker',
    name: 'Broker',
    description: 'I help clients buy/sell marinas',
    icon: 'Handshake',
    recommendedPackage: 'broker',
  },
  {
    id: 'owner',
    name: 'Owner/Operator',
    description: 'I own or manage marina operations',
    icon: 'Anchor',
    recommendedPackage: 'owner-operator',
  },
  {
    id: 'lender',
    name: 'Lender',
    description: 'I provide financing for marinas',
    icon: 'Landmark',
    recommendedPackage: 'investor',
  },
  {
    id: 'consultant',
    name: 'Consultant',
    description: 'I advise on marina investments',
    icon: 'Briefcase',
    recommendedPackage: 'institutional',
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Something else',
    icon: 'HelpCircle',
    recommendedPackage: 'investor',
  },
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get a package by its slug
 */
export function getPackageBySlug(slug: string): SubscriptionPackage | undefined {
  return SUBSCRIPTION_PACKAGES.find(p => p.slug === slug);
}

/**
 * Get recommended package for a persona
 */
export function getRecommendedPackage(personaId: string): SubscriptionPackage | undefined {
  const persona = PERSONA_OPTIONS.find(p => p.id === personaId);
  if (!persona) return undefined;
  return getPackageBySlug(persona.recommendedPackage);
}

/**
 * Get all modules in a category
 */
export function getModulesByCategory(category: string): ModuleInfo[] {
  return Object.values(MODULE_INFO).filter(m => m.category === category);
}

/**
 * Get unique categories
 */
export function getModuleCategories(): string[] {
  const categories = new Set(Object.values(MODULE_INFO).map(m => m.category));
  return Array.from(categories);
}

/**
 * Calculate total add-on price for modules not in a package
 */
export function calculateAddOnPrice(
  basePackage: SubscriptionPackage,
  additionalModules: FeatureModule[]
): number {
  const packageModules = new Set(basePackage.modules);
  let total = 0;
  
  for (const module of additionalModules) {
    if (!packageModules.has(module)) {
      const info = MODULE_INFO[module];
      if (info?.price) {
        total += info.price;
      }
    }
  }
  
  return total;
}

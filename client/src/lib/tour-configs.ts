import type { TourStep } from "@/components/onboarding/PageTour";

export const TOUR_IDS = {
  DASHBOARD: "dashboard",
  CRM_DEALS: "crm-deals",
  CRM_CONTACTS: "crm-contacts",
  CRM_COMPANIES: "crm-companies",
  CRM_PROPERTIES: "crm-properties",
  DUE_DILIGENCE: "due-diligence",
  DOCKET: "docket",
  RENT_ROLL: "rent-roll",
  VALUATOR: "valuator",
  FUEL_SALES: "fuel-sales",
  SHIP_STORE: "ship-store",
  COMMERCIAL_TENANTS: "commercial-tenants",
  VDR: "vdr",
  PORTFOLIO: "portfolio",
  SALES_COMPS: "sales-comps",
  MARKET_INTEL: "marinamatch-intel",
  DEAL_WORKSPACE: "deal-workspace",
} as const;

export type TourId = typeof TOUR_IDS[keyof typeof TOUR_IDS];

export const dashboardTourSteps: TourStep[] = [
  {
    target: '[data-tour="dashboard-kpis"]',
    content: "Your key performance indicators at a glance. Track deals, pipeline value, and activity metrics from this summary panel.",
    title: "Performance Overview",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dashboard-pipeline"]',
    content: "Visual breakdown of your deal pipeline by stage. Click any stage to filter your deals.",
    title: "Pipeline Summary",
    placement: "right",
  },
  {
    target: '[data-tour="dashboard-tasks"]',
    content: "Your upcoming tasks and deadlines. Stay on top of diligence items and follow-ups.",
    title: "Task Manager",
    placement: "left",
  },
  {
    target: '[data-tour="sidebar-nav"]',
    content: "Navigate between modules here. CRM for relationship management, Deal Workspace for active projects, and Operations for day-to-day marina management.",
    title: "Navigation",
    placement: "right",
  },
];

export const crmDealsTourSteps: TourStep[] = [
  {
    target: '[data-tour="deals-header"]',
    content: "Manage all your marina acquisition deals from this central hub. Track progress from initial contact to closing.",
    title: "Deal Pipeline",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="deals-filter"]',
    content: "Filter deals by status, owner, or date range to focus on what matters most.",
    title: "Smart Filters",
    placement: "bottom",
  },
  {
    target: '[data-tour="deals-add"]',
    content: "Create a new deal with our guided wizard. Enter the marina details and we'll set up everything you need.",
    title: "Add New Deal",
    placement: "left",
  },
  {
    target: '[data-tour="deals-table"]',
    content: "Click any deal to open its detailed view with documents, contacts, and diligence tracking.",
    title: "Deal Details",
    placement: "top",
  },
];

export const dueDiligenceTourSteps: TourStep[] = [
  {
    target: '[data-tour="dd-projects"]',
    content: "Your active due diligence projects. Each project tracks all the items needed to close a deal.",
    title: "Due Diligence",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dd-tasks"]',
    content: "Track every diligence task from surveys to environmental reports. Set deadlines and assign owners.",
    title: "Task Tracking",
    placement: "right",
  },
  {
    target: '[data-tour="dd-documents"]',
    content: "Upload and organize all required documents. Our AI can help extract key terms automatically.",
    title: "Document Management",
    placement: "left",
  },
  {
    target: '[data-tour="dd-timeline"]',
    content: "View your diligence timeline and critical path. Never miss a deadline.",
    title: "Timeline View",
    placement: "top",
  },
];

export const docketTourSteps: TourStep[] = [
  {
    target: '[data-tour="docket-feed"]',
    content: "Your curated feed of marina M&A activity and market trends. Track deal flow, recent transactions, and investment opportunities across the marina industry.",
    title: "M&A Spotlight",
    placement: "bottom",
    disableBeacon: true,
  },
];

export const fuelSalesTourSteps: TourStep[] = [
  {
    target: '[data-tour="fuel-summary"]',
    content: "Track fuel sales volume, revenue, and margins at a glance.",
    title: "Fuel Operations",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="fuel-transactions"]',
    content: "View all fuel transactions with customer details, pump data, and payment status.",
    title: "Transaction Log",
    placement: "right",
  },
  {
    target: '[data-tour="fuel-pricing"]',
    content: "Manage fuel pricing and track margins against wholesale costs.",
    title: "Pricing Management",
    placement: "left",
  },
];

export const shipStoreTourSteps: TourStep[] = [
  {
    target: '[data-tour="store-inventory"]',
    content: "Manage your ship store inventory with automatic reorder alerts.",
    title: "Inventory Management",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="store-sales"]',
    content: "Track sales by product category and identify your best performers.",
    title: "Sales Analytics",
    placement: "right",
  },
  {
    target: '[data-tour="store-pos"]',
    content: "Quick POS access for walk-in customers and charge accounts.",
    title: "Point of Sale",
    placement: "left",
  },
];

export const commercialTenantsTourSteps: TourStep[] = [
  {
    target: '[data-tour="tenants-list"]',
    content: "View all commercial tenants with their lease terms, rent, and status at a glance.",
    title: "Tenant Overview",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="tenants-add"]',
    content: "Add tenants manually or import lease abstracts from documents using AI-powered extraction.",
    title: "Add Tenants",
    placement: "left",
  },
  {
    target: '[data-tour="tenants-analytics"]',
    content: "Portfolio analytics show occupancy rates, rent roll totals, and upcoming expirations.",
    title: "Portfolio Analytics",
    placement: "bottom",
  },
];

export const vdrTourSteps: TourStep[] = [
  {
    target: '[data-tour="vdr-folders"]',
    content: "Your secure Virtual Data Room for managing transaction documents. Organize files by project with granular access controls, upload documents securely, and track all activity with audit logging.",
    title: "Virtual Data Room",
    placement: "bottom",
    disableBeacon: true,
  },
];

export const salesCompsTourSteps: TourStep[] = [
  {
    target: '[data-tour="comps-map"]',
    content: "View comparable marina sales on an interactive map. Click markers for details.",
    title: "Comp Map",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="comps-table"]',
    content: "Compare key metrics like price per slip, cap rates, and amenities across transactions.",
    title: "Comp Analysis",
    placement: "top",
  },
  {
    target: '[data-tour="comps-add"]',
    content: "Add your own comps or access our curated database of verified marina transactions.",
    title: "Add Comparables",
    placement: "left",
  },
];

export const rentRollTourSteps: TourStep[] = [
  {
    target: '[data-tour="rentroll-summary"]',
    content: "Executive summary of your rent roll with key metrics like occupancy, average rent, and revenue.",
    title: "Rent Roll Overview",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="rentroll-units"]',
    content: "Detailed view of all slips, racks, and storage locations with tenant information.",
    title: "Unit Details",
    placement: "right",
  },
  {
    target: '[data-tour="rentroll-import"]',
    content: "Import rent rolls from Excel, CSV, or PDF. Our AI extracts data automatically.",
    title: "Smart Import",
    placement: "left",
  },
  {
    target: '[data-tour="rentroll-analysis"]',
    content: "Analyze rent growth, turnover, and seasonal patterns to optimize pricing.",
    title: "Rent Analysis",
    placement: "top",
  },
  {
    target: '[data-tour="rentroll-export"]',
    content: "Export to Excel or sync with your accounting system for seamless integration.",
    title: "Export Options",
    placement: "bottom",
  },
];

export const valuatorTourSteps: TourStep[] = [
  {
    target: '[data-tour="valuator-inputs"]',
    content: "Enter marina financials and operating metrics. Data can sync from your rent roll and operations modules.",
    title: "Valuation Inputs",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="valuator-scenarios"]',
    content: "Model different scenarios - base case, upside, and downside. Compare outcomes side by side.",
    title: "Scenario Modeling",
    placement: "bottom",
  },
  {
    target: '[data-tour="valuator-analysis"]',
    content: "Deep-dive into NOI build-up, cap rate sensitivity, and return metrics.",
    title: "Financial Analysis",
    placement: "left",
  },
  {
    target: '[data-tour="valuator-exit"]',
    content: "Model exit strategies with different hold periods and exit cap rates.",
    title: "Exit Strategy Suite",
    placement: "top",
  },
  {
    target: '[data-tour="valuator-export"]',
    content: "Export professional Excel models or OM-ready reports for investors.",
    title: "Export & Share",
    placement: "bottom",
  },
  {
    target: '[data-tour="valuator-addbacks"]',
    content: "Track and normalize one-time items to arrive at true operating performance.",
    title: "Addbacks & Adjustments",
    placement: "left",
  },
];

export const portfolioTourSteps: TourStep[] = [
  {
    target: '[data-tour="portfolio-overview"]',
    content: "Your portfolio at a glance - all owned marinas with key performance metrics.",
    title: "Portfolio Overview",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="portfolio-performance"]',
    content: "Track revenue, NOI, and occupancy trends across your portfolio.",
    title: "Performance Metrics",
    placement: "right",
  },
  {
    target: '[data-tour="portfolio-add"]',
    content: "Add a new marina to your portfolio to start tracking operations.",
    title: "Add Property",
    placement: "left",
  },
];

export const dealWorkspaceTourSteps: TourStep[] = [
  {
    target: '[data-tour="workspace-tabs"]',
    content: "Each workspace brings together everything for a deal - financials, diligence, documents, and team.",
    title: "Unified Workspace",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="workspace-financials"]',
    content: "Model the deal with integrated financial modeling tools and rent roll analysis.",
    title: "Financials Tab",
    placement: "right",
  },
  {
    target: '[data-tour="workspace-diligence"]',
    content: "Track all diligence items with deadlines and document requirements.",
    title: "Diligence Tab",
    placement: "bottom",
  },
  {
    target: '[data-tour="workspace-documents"]',
    content: "Secure document room for the deal with granular access controls.",
    title: "Documents Tab",
    placement: "left",
  },
];

export function getTourConfig(tourId: TourId): { steps: TourStep[]; videoUrl?: string; videoTitle?: string } {
  switch (tourId) {
    case TOUR_IDS.DASHBOARD:
      return { steps: dashboardTourSteps };
    case TOUR_IDS.CRM_DEALS:
      return { steps: crmDealsTourSteps };
    case TOUR_IDS.DUE_DILIGENCE:
      return { steps: dueDiligenceTourSteps };
    case TOUR_IDS.DOCKET:
      return { steps: docketTourSteps };
    case TOUR_IDS.FUEL_SALES:
      return { steps: fuelSalesTourSteps };
    case TOUR_IDS.SHIP_STORE:
      return { steps: shipStoreTourSteps };
    case TOUR_IDS.COMMERCIAL_TENANTS:
      return { steps: commercialTenantsTourSteps };
    case TOUR_IDS.VDR:
      return { steps: vdrTourSteps };
    case TOUR_IDS.SALES_COMPS:
      return { steps: salesCompsTourSteps };
    case TOUR_IDS.RENT_ROLL:
      return { 
        steps: rentRollTourSteps,
        videoTitle: "Rent Roll Deep Dive",
      };
    case TOUR_IDS.VALUATOR:
      return { 
        steps: valuatorTourSteps,
        videoTitle: "Financial Model Walkthrough",
      };
    case TOUR_IDS.PORTFOLIO:
      return { steps: portfolioTourSteps };
    case TOUR_IDS.DEAL_WORKSPACE:
      return { steps: dealWorkspaceTourSteps };
    default:
      return { steps: [] };
  }
}

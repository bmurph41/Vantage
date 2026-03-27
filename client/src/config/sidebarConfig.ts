// sidebarConfig.ts
// Place this file in: src/config/sidebarConfig.ts
// Navigation structure with module-based access control

import { 
  LucideIcon, 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  Search, 
  Calculator, 
  BarChart3, 
  Wrench, 
  Plug,
  // Child item icons
  UserRound,
  Building2,
  Home,
  Kanban,
  CheckSquare,
  Activity,
  TrendingUp,
  FolderOpen,
  FileCheck,
  Database,
  Eye,
  Briefcase,
  Megaphone,
  DollarSign,
  CreditCard,
  LogOut,
  FileText,
  Settings,
  Newspaper,
  BarChart2,
  Percent,
  MapPin,
  Building,
  PieChart,
  Anchor,
  Ship,
  Fuel,
  ShoppingBag,
  Wrench as WrenchIcon,
  Key,
  Sailboat,
  Users as UsersIcon,
  BookOpen,
  Store,
  ListTree,
  GitMerge,
  Sparkles,
} from 'lucide-react';

import { FEATURE_MODULES, FeatureModule } from './featureModules';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  matchRoutes?: string[];
  badge?: string | number;
  requiredModules?: FeatureModule[];  // Modules needed to see this item
  featureFlag?: boolean;              // Additional feature flag (for dev/beta)
  disabled?: boolean;
  opsModuleKey?: string;              // Maps to asset-class-ops-modules key for dynamic filtering
}

export interface SidebarGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  matchRoutes?: string[];
  children?: SidebarItem[];
  requiredModules?: FeatureModule[];  // Modules needed to see this group
  featureFlag?: boolean;
  defaultExpanded?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const sidebarConfig: SidebarGroup[] = [
  // ─────────────────────────────────────────────────────────────
  // DASHBOARD (Always visible - base module)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    matchRoutes: ['/dashboard', '/'],
    requiredModules: [FEATURE_MODULES.DASHBOARD],
  },

  // ─────────────────────────────────────────────────────────────
  // CRM (Core Entity Management only)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    matchRoutes: ['/crm', '/contacts', '/companies', '/properties'],
    requiredModules: [FEATURE_MODULES.CRM_CORE],
    children: [
      {
        id: 'contacts',
        label: 'Contacts',
        href: '/crm/contacts',
        icon: UserRound,
        matchRoutes: ['/crm/contacts', '/contacts'],
        requiredModules: [FEATURE_MODULES.CRM_CORE],
      },
      {
        id: 'companies',
        label: 'Companies',
        href: '/crm/companies',
        icon: Building2,
        matchRoutes: ['/crm/companies', '/companies'],
        requiredModules: [FEATURE_MODULES.CRM_CORE],
      },
      {
        id: 'properties',
        label: 'Properties',
        href: '/crm/properties',
        icon: Home,
        matchRoutes: ['/crm/properties', '/properties'],
        requiredModules: [FEATURE_MODULES.CRM_CORE],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PROSPECTING (its own top-level section)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'prospecting',
    label: 'Prospecting',
    icon: Search,
    matchRoutes: ['/prospecting'],
    requiredModules: [FEATURE_MODULES.PROSPECTING_CORE],
    children: [
      {
        id: 'prospecting-overview',
        label: 'Overview',
        href: '/prospecting/overview',
        icon: Eye,
        matchRoutes: ['/prospecting/overview'],
        requiredModules: [FEATURE_MODULES.PROSPECTING_CORE],
      },
      {
        id: 'workroom',
        label: 'Workroom',
        href: '/prospecting/workroom',
        icon: Briefcase,
        matchRoutes: ['/prospecting/workroom', '/workroom'],
        requiredModules: [FEATURE_MODULES.PROSPECTING_CORE],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // MARKETING (top-level section)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    matchRoutes: ['/marketing', '/prospecting/marketing'],
    requiredModules: [FEATURE_MODULES.PROSPECTING_MARKETING],
    children: [
      {
        id: 'marketing-hub',
        label: 'Marketing Hub',
        href: '/marketing',
        icon: Megaphone,
        matchRoutes: ['/marketing'],
        requiredModules: [FEATURE_MODULES.PROSPECTING_MARKETING],
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        href: '/prospecting/campaigns',
        icon: Activity,
        matchRoutes: ['/prospecting/campaigns'],
        requiredModules: [FEATURE_MODULES.PROSPECTING_MARKETING],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PIPELINE (Deal flow — split from CRM)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: Kanban,
    matchRoutes: ['/pipeline', '/deals', '/follow-ups', '/activity', '/forecast'],
    requiredModules: [FEATURE_MODULES.CRM_PIPELINE],
    children: [
      {
        id: 'deals',
        label: 'Deals',
        href: '/pipeline/deal-board',
        icon: Kanban,
        matchRoutes: ['/pipeline/deal-board', '/deals', '/deal-board'],
        requiredModules: [FEATURE_MODULES.CRM_PIPELINE],
      },
      {
        id: 'tasks-followups',
        label: 'Tasks & Follow-Ups',
        href: '/pipeline/follow-ups',
        icon: CheckSquare,
        matchRoutes: ['/pipeline/follow-ups', '/follow-ups', '/tasks'],
        requiredModules: [FEATURE_MODULES.CRM_TASKS],
      },
      {
        id: 'activity-log',
        label: 'Activity Log',
        href: '/pipeline/activity-log',
        icon: Activity,
        matchRoutes: ['/pipeline/activity-log', '/activity-log', '/activity'],
        requiredModules: [FEATURE_MODULES.CRM_PIPELINE],
      },
      {
        id: 'forecast',
        label: 'Forecast',
        href: '/pipeline/forecast',
        icon: TrendingUp,
        matchRoutes: ['/pipeline/forecast', '/forecast'],
        requiredModules: [FEATURE_MODULES.CRM_FORECAST],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // DEAL ROOM
  // ─────────────────────────────────────────────────────────────
  {
    id: 'deal-room',
    label: 'Deal Room',
    icon: FolderKanban,
    matchRoutes: ['/deal-workspace', '/projects', '/dd-projects', '/data-room'],
    requiredModules: [FEATURE_MODULES.DEALROOM_PROJECTS],
    children: [
      {
        id: 'projects',
        label: 'Projects',
        href: '/deal-workspace/projects',
        icon: FolderOpen,
        matchRoutes: ['/deal-workspace/projects', '/projects'],
        requiredModules: [FEATURE_MODULES.DEALROOM_PROJECTS],
      },
      {
        id: 'dd-projects',
        label: 'Due Diligence',
        href: '/deal-workspace/dd-projects',
        icon: FileCheck,
        matchRoutes: ['/deal-workspace/dd-projects', '/dd-projects'],
        requiredModules: [FEATURE_MODULES.DEALROOM_DD],
      },
      {
        id: 'data-room',
        label: 'Data Room',
        href: '/deal-workspace/data-room',
        icon: Database,
        matchRoutes: ['/deal-workspace/data-room', '/data-room'],
        requiredModules: [FEATURE_MODULES.DEALROOM_DATAROOM],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // UNDERWRITING
  // ─────────────────────────────────────────────────────────────
  {
    id: 'underwriting',
    label: 'Underwriting',
    icon: Calculator,
    matchRoutes: ['/underwriting', '/valuator', '/debt-scenarios', '/exit-strategies', '/om-builder', '/modeling-settings'],
    requiredModules: [FEATURE_MODULES.UNDERWRITING_VALUATOR],
    children: [
      {
        id: 'valuator',
        label: 'Financial Model',
        href: '/underwriting/valuator',
        icon: DollarSign,
        matchRoutes: ['/underwriting/valuator', '/valuator'],
        requiredModules: [FEATURE_MODULES.UNDERWRITING_VALUATOR],
      },
      {
        id: 'debt-scenarios',
        label: 'Debt Scenarios',
        href: '/underwriting/debt-scenarios',
        icon: CreditCard,
        matchRoutes: ['/underwriting/debt-scenarios', '/debt-scenarios'],
        requiredModules: [FEATURE_MODULES.UNDERWRITING_DEBT],
      },
      {
        id: 'exit-strategies',
        label: 'Exit Strategies',
        href: '/underwriting/exit-strategies',
        icon: LogOut,
        matchRoutes: ['/underwriting/exit-strategies', '/exit-strategies'],
        requiredModules: [FEATURE_MODULES.UNDERWRITING_EXIT],
      },
      {
        id: 'om-builder',
        label: 'Investment Materials',
        href: '/document-studio',
        icon: FileText,
        matchRoutes: ['/document-studio', '/om', '/om-builder', '/document-builder'],
        requiredModules: [FEATURE_MODULES.UNDERWRITING_OM],
      },
      {
        id: 'modeling-settings',
        label: 'Model Settings',
        href: '/modeling/settings',
        icon: Settings,
        matchRoutes: ['/modeling/settings', '/modeling-settings'],
        requiredModules: [FEATURE_MODULES.UNDERWRITING_SETTINGS],
      },
      {
        id: 'coa-chart-of-accounts',
        label: 'Chart of Accounts',
        href: '/modeling/settings/chart-of-accounts',
        icon: ListTree,
        matchRoutes: ['/modeling/settings/chart-of-accounts'],
      },
      {
        id: 'coa-category-mapping',
        label: 'Category Mapping',
        href: '/modeling/settings/category-mapping',
        icon: GitMerge,
        matchRoutes: ['/modeling/settings/category-mapping'],
      },
      {
        id: 'coa-normalization-status',
        label: 'Normalization',
        href: '/modeling/settings/normalization-status',
        icon: Sparkles,
        matchRoutes: ['/modeling/settings/normalization-status'],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // MARINALYTICS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'marinalytics',
    label: 'Market Intelligence',
    icon: BarChart3,
    matchRoutes: ['/marinalytics', '/analytics', '/docket', '/sales-comps', '/rate-comps', '/demographics', '/capital-markets', '/portfolio-analytics', '/financial-analysis'],
    requiredModules: [FEATURE_MODULES.ANALYTICS_NEWS],
    children: [
      {
        id: 'docket',
        label: 'The Docket',
        href: '/marinalytics/docket',
        icon: Newspaper,
        matchRoutes: ['/marinalytics/docket', '/docket'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_NEWS],
      },
      {
        id: 'sales-comps',
        label: 'Sales Comps',
        href: '/marinalytics/sales-comps',
        icon: BarChart2,
        matchRoutes: ['/marinalytics/sales-comps', '/sales-comps'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_COMPS],
      },
      {
        id: 'rate-comps',
        label: 'Rate Comps',
        href: '/marinalytics/rate-comps',
        icon: Percent,
        matchRoutes: ['/marinalytics/rate-comps', '/rate-comps'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_COMPS],
      },
      {
        id: 'demographics',
        label: 'Demographics',
        href: '/marinalytics/demographics',
        icon: MapPin,
        matchRoutes: ['/marinalytics/demographics', '/demographics'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS],
      },
      {
        id: 'capital-markets',
        label: 'Capital Markets',
        href: '/marinalytics/capital-markets',
        icon: Building,
        matchRoutes: ['/marinalytics/capital-markets', '/capital-markets'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_CAPITAL],
      },
      {
        id: 'portfolio-analytics',
        label: 'Portfolio Analytics',
        href: '/marinalytics/portfolio-analytics',
        icon: PieChart,
        matchRoutes: ['/marinalytics/portfolio-analytics', '/portfolio-analytics'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_PORTFOLIO],
      },
      {
        id: 'financial-analysis',
        label: 'Financial Analysis',
        href: '/marinalytics/financial-analysis',
        icon: TrendingUp,
        matchRoutes: ['/marinalytics/financial-analysis', '/financial-analysis'],
        requiredModules: [FEATURE_MODULES.ANALYTICS_PORTFOLIO],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // OPERATIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'operations',
    label: 'Operations',
    icon: Wrench,
    matchRoutes: ['/operations', '/portfolio', '/dockit', '/commercial-tenants', '/fuel-sales', '/ship-store', '/service-dept', '/boat-rentals', '/boat-club', '/boat-sales', '/bookkeeping','/payroll'],
    requiredModules: [FEATURE_MODULES.OPS_PORTFOLIO],
    defaultExpanded: false,
    children: [
      {
        id: 'ops-portfolio',
        label: 'Portfolio',
        href: '/operations/portfolio',
        icon: Anchor,
        matchRoutes: ['/operations/portfolio', '/portfolio'],
        requiredModules: [FEATURE_MODULES.OPS_PORTFOLIO],
      },
      {
        id: 'dockit',
        label: 'Dockit',
        href: '/operations/dockit',
        icon: Ship,
        matchRoutes: ['/operations/dockit', '/dockit'],
        requiredModules: [FEATURE_MODULES.OPS_DOCKAGE],
        opsModuleKey: 'dockage',
      },
      {
        id: 'commercial-tenants',
        label: 'Commercial Tenants',
        href: '/operations/commercial-tenants',
        icon: Building2,
        matchRoutes: ['/operations/commercial-tenants', '/commercial-tenants'],
        requiredModules: [FEATURE_MODULES.OPS_TENANTS],
        opsModuleKey: 'commercial_tenants',
      },
      {
        id: 'fuel-sales',
        label: 'Fuel Sales',
        href: '/operations/fuel-sales',
        icon: Fuel,
        matchRoutes: ['/operations/fuel-sales', '/fuel-sales'],
        requiredModules: [FEATURE_MODULES.OPS_FUEL],
        opsModuleKey: 'fuel',
      },
      {
        id: 'ship-store',
        label: 'Ship Store',
        href: '/operations/ship-store',
        icon: ShoppingBag,
        matchRoutes: ['/operations/ship-store', '/ship-store'],
        requiredModules: [FEATURE_MODULES.OPS_SHIP_STORE],
        opsModuleKey: 'ship_store',
      },
      {
        id: 'marina-integrations',
        label: 'Integrations',
        href: '/operations/integrations',
        icon: Plug,
        matchRoutes: ['/operations/integrations'],
        requiredModules: [FEATURE_MODULES.OPS_RETAIL],
      },
      {
        id: 'service-dept',
        label: 'Service Dept',
        href: '/operations/service-dept',
        icon: WrenchIcon,
        matchRoutes: ['/operations/service-dept', '/service-dept'],
        requiredModules: [FEATURE_MODULES.OPS_SERVICE],
        opsModuleKey: 'service',
      },
      {
        id: 'payroll',
        label: 'Payroll',
        href: '/operations/payroll',
        icon: DollarSign,
        matchRoutes: ['/operations/payroll', '/payroll'],
        opsModuleKey: 'payroll',
      },
      {
        id: 'boat-rentals',
        label: 'Boat Rentals',
        href: '/operations/boat-rentals',
        icon: Key,
        matchRoutes: ['/operations/boat-rentals', '/boat-rentals'],
        requiredModules: [FEATURE_MODULES.OPS_RENTALS],
        opsModuleKey: 'boat_rentals',
      },
      {
        id: 'boat-club',
        label: 'Boat Club',
        href: '/operations/boat-club',
        icon: UsersIcon,
        matchRoutes: ['/operations/boat-club', '/boat-club'],
        requiredModules: [FEATURE_MODULES.OPS_CLUB],
        opsModuleKey: 'boat_club',
      },
      {
        id: 'boat-sales',
        label: 'Boat Sales',
        href: '/operations/boat-sales',
        icon: Sailboat,
        matchRoutes: ['/operations/boat-sales', '/boat-sales'],
        requiredModules: [FEATURE_MODULES.OPS_SALES],
        opsModuleKey: 'boat_sales',
      },
      {
        id: 'bookkeeping',
        label: 'Bookkeeping',
        href: '/operations/bookkeeping',
        icon: BookOpen,
        matchRoutes: ['/operations/bookkeeping', '/bookkeeping'],
        requiredModules: [FEATURE_MODULES.OPS_BOOKKEEPING],
        opsModuleKey: 'bookkeeping',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // INTEGRATIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    matchRoutes: ['/integrations', '/marketplace'],
    requiredModules: [FEATURE_MODULES.INTEGRATIONS_MARKETPLACE],
    children: [
      {
        id: 'marketplace',
        label: 'Marketplace',
        href: '/integrations/marketplace',
        icon: Store,
        matchRoutes: ['/integrations/marketplace', '/marketplace'],
        requiredModules: [FEATURE_MODULES.INTEGRATIONS_MARKETPLACE],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get active navigation state from pathname
 */
export function getActiveNavState(pathname: string) {
  let activeGroup: string | null = null;
  let activeItem: string | null = null;

  for (const group of sidebarConfig) {
    if (group.featureFlag === false) continue;

    if (group.href && group.matchRoutes?.some(r => pathname === r || pathname.startsWith(r + '/'))) {
      activeGroup = group.id;
      activeItem = group.id;
      break;
    }

    if (group.children) {
      for (const item of group.children) {
        if (item.featureFlag === false) continue;
        
        if (item.matchRoutes?.some(r => pathname === r || pathname.startsWith(r + '/'))) {
          activeGroup = group.id;
          activeItem = item.id;
          break;
        }
      }
    }
    
    if (activeItem) break;
  }

  return { activeGroup, activeItem };
}

/**
 * Filter sidebar config based on user's enabled modules
 */
export function filterSidebarByModules(
  config: SidebarGroup[],
  userModules: Set<string>
): SidebarGroup[] {
  const hasAccess = (requiredModules?: FeatureModule[]) => {
    if (!requiredModules || requiredModules.length === 0) return true;
    return requiredModules.some(m => userModules.has(m));
  };

  return config
    .filter(group => {
      if (group.featureFlag === false) return false;
      return hasAccess(group.requiredModules);
    })
    .map(group => ({
      ...group,
      children: group.children?.filter(item => {
        if (item.featureFlag === false) return false;
        return hasAccess(item.requiredModules);
      }),
    }))
    .filter(group => {
      // Keep groups that either have no children (single item) or have visible children
      if (!group.children) return true;
      return group.children.length > 0;
    });
}

/**
 * Get all unique modules required by sidebar items
 */
export function getAllRequiredModules(): Set<FeatureModule> {
  const modules = new Set<FeatureModule>();
  
  for (const group of sidebarConfig) {
    group.requiredModules?.forEach(m => modules.add(m));
    group.children?.forEach(item => {
      item.requiredModules?.forEach(m => modules.add(m));
    });
  }
  
  return modules;
}

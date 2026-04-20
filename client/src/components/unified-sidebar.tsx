import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings, Activity,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight, ChevronLeft,
  Briefcase, ListTodo, ClipboardList, Calculator, Anchor, Upload, History, Send, Menu, X, AlertCircle, Fuel, CreditCard, Box, Shield, MessageSquare, LayoutList, Megaphone, DollarSign, Link2, FolderLock, Receipt, RefreshCcw, Percent, Search, Wrench, Ship, ShoppingCart, PanelLeftClose, PanelLeft, Plug, BookOpen, Lock, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OPS_MODULE_SUBCATEGORY, OPS_SUBCATEGORY_META, type OpsSubcategory } from '@shared/asset-class-ops-modules';
import { useOpsAssetStore } from '@/stores/operations-asset-store';
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/layout/UserMenu";
import { SimplifiedModeToggle } from "@/components/SimplifiedModeToggle";
import { useDisplayMode } from "@/stores/display-mode-store";
import { PaywallModal } from "@/components/PaywallModal";
import { SupportContactModal } from "@/components/support/SupportContactModal";
import { HeadphonesIcon } from "lucide-react";
import { useSidebarHighlight } from "@/contexts/SidebarHighlightContext";

// CRM Navigation (Core Entity Management only)
const crmNav = [
  { name: "Dashboard", href: "/crm" },
  { name: "Contacts", href: "/crm/contacts" },
  { name: "Companies", href: "/crm/companies" },
  { name: "Properties", href: "/crm/properties" },
  { name: "Meetings", href: "/crm/meetings" },
  { name: "Settings", href: "/crm/settings" },
];

// Marketing Navigation (top-level section)
const marketingNav = [
  { name: "Marketing Hub", href: "/marketing" },
  { name: "Campaigns", href: "/prospecting/campaigns" },
  { name: "Templates", href: "/prospecting/templates" },
];

// Pipeline Navigation (Deal flow, marketing, analytics)
const pipelineDealNav = [
  { name: "Deal Board", href: "/pipeline/deal-board" },
  { name: "Activity Log", href: "/pipeline/activity-log" },
  { name: "Follow-Ups", href: "/pipeline/follow-ups" },
  { name: "Forecast", href: "/pipeline/forecast" },
];


// Prospecting & Outreach Navigation (Premium/Broker Add-On)
const prospectingNav = [
  { name: "Prospecting", href: "/prospecting" },
  { name: "Market Targets", href: "/prospecting/markets" },
  { name: "Deal Sourcing Analytics", href: "/prospecting/analytics" },
];

// CRM Tools Submenu
const crmToolsNav = [
  { name: "Calendar Sync", href: "/calendar-settings" },
  { name: "Labels", href: "/crm/labels" },
  { name: "Products", href: "/crm/products" },
  { name: "Forms", href: "/crm/forms" },
  { name: "Workflows", href: "/crm/workflows" },
  { name: "Webhooks", href: "/crm/webhooks" },
  { name: "Dedupe & Merge", href: "/crm/dedupe" },
  { name: "Scoring", href: "/crm/scoring" },
  { name: "Import Contacts", href: "/import-contacts" },
  { name: "Import History", href: "/import-history" },
];

// Operations Navigation - Flattened module links (tabs handle sub-navigation)
// Each item includes an opsModuleKey for dynamic filtering based on owned asset classes
const operationsModulesNav = [
  { name: "Portfolio", href: "/portfolio", opsModuleKey: null },
  { name: "Bookkeeping", href: "/operations/bookkeeping", opsModuleKey: "bookkeeping" },
  { name: "Payroll", href: "/operations/payroll", opsModuleKey: "payroll" },
  { name: "Dockit", href: "/operations/dockit", opsModuleKey: "dockage" },
  { name: "Rent Roll", href: "/rent-roll/executive", opsModuleKey: "rent_roll" },
  { name: "Commercial Tenants", href: "/operations/commercial-tenants", opsModuleKey: "commercial_tenants" },
  { name: "Fuel Sales", href: "/operations/fuel", opsModuleKey: "fuel" },
  { name: "Ship Store", href: "/operations/ship-store", opsModuleKey: "ship_store" },
  { name: "Service & Parts", href: "/operations/service", opsModuleKey: "service" },
  { name: "Boat Rentals", href: "/operations/boat-rentals", opsModuleKey: "boat_rentals" },
  { name: "Boat Club", href: "/operations/boat-club", opsModuleKey: "boat_club" },
  { name: "Boat Sales", href: "/operations/boat-sales", opsModuleKey: "boat_sales" },
  { name: "Marketing", href: "/marketing", opsModuleKey: "marketing" },
  { name: "Budgeting", href: "/operations/budgeting", opsModuleKey: "budgeting" },
  { name: "Hotel Ops", href: "/operations/hotel", opsModuleKey: "hotel_ops" },
  { name: "Multifamily Ops", href: "/operations/multifamily", opsModuleKey: "multifamily_ops" },
  { name: "Retail/Office Ops", href: "/operations/retail-office", opsModuleKey: "retail_office_ops" },
  { name: "Self-Storage Ops", href: "/operations/self-storage", opsModuleKey: "self_storage_ops" },
];

// Deal Workspace Navigation - Consolidated DD, VDR, and Modeling
const dealWorkspaceNav = [
  { name: "Deals", href: "/crm/deals" },
  { name: "Due Diligence", href: "/dd/projects" },
  { name: "Data Room", href: "/vdr" },
];

// Deal Workspace sub-nav (shown when inside a workspace)
const getWorkspaceSubNav = (workspaceId: string) => [
  { name: "Overview", href: `/workspaces/${workspaceId}` },
  { name: "Financials", href: `/workspaces/${workspaceId}?tab=financials` },
  { name: "Diligence", href: `/workspaces/${workspaceId}?tab=diligence` },
  { name: "Documents", href: `/workspaces/${workspaceId}?tab=documents` },
  { name: "Team", href: `/workspaces/${workspaceId}?tab=team` },
];

// Analysis Navigation (all users - modeling, analysis, and document processing)
const analysisNav = [
  { name: "Financial Model", href: "/modeling/projects" },
  { name: "Pipeline Returns", href: "/modeling/returns-valuation" },
  { name: "Portfolio Dashboard", href: "/modeling/portfolio/dashboard" },
  { name: "Portfolio Returns", href: "/modeling/portfolio/returns" },
  { name: "Debt Scenarios", href: "/modeling/scenarios" },
  { name: "Exit Strategies", href: "/modeling/exit-strategies" },
  { name: "Document Intelligence", href: "/document-intelligence" },
  { name: "Model Settings", href: "/modeling/settings" },
];

// Investor Services Navigation (GP users only via pack check)
const investorServicesNav = [
  { name: "Fund Dashboard", href: "/modeling/funds" },
  { name: "LP Portal", href: "/modeling/lp-portal" },
];

// Market Intelligence Navigation (formerly Marinalytics)
const marketIntelligenceNav = [
  { name: "Analysis Hub", href: "/analysis/hub" },
  { name: "Sales Comps", href: "/analysis/sales-comps" },
  { name: "Rate Comps", href: "/analysis/rate-comps" },
  { name: "Financial Analysis", href: "/analysis/financial-analysis" },
  { name: "Demographics", href: "/analysis/demographics" },
  { name: "Capital Markets", href: "/analysis/benchmarks" },
  { name: "Portfolio Analytics", href: "/analysis/marinalytics" },
  { name: "Predictive Analytics", href: "/analysis/predictive" },
  { name: "Cash Flow Forecast", href: "/analysis/cash-flow" },
  { name: "Deal Sourcing", href: "/analysis/deal-sourcing" },
];

// Integrations - direct link (no sub-navigation)

type PendingItem = {
  id: string;
  status: string;
};

type PackType = 'crm_pipeline' | 'modeling_tools' | 'analysis' | 'operations' | 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro' | 'owner' | 'investor' | 'broker';

type BootstrapData = {
  persona: any;
  features: any[];
  activePacks: PackType[];
  pendingCounts: {
    properties: number;
    contacts: number;
    companies: number;
  };
};

export default function UnifiedSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [operationsExpanded, setOperationsExpanded] = useState(false); // Default collapsed for Operations
  const [crmExpanded, setCrmExpanded] = useState(false);
  const [pipelineExpanded, setPipelineExpanded] = useState(false); // Pipeline deals section
  const [prospectingExpanded, setProspectingExpanded] = useState(false); // Prospecting section
  const [marketingExpanded, setMarketingExpanded] = useState(false); // Marketing section
  const [dealWorkspaceExpanded, setDealWorkspaceExpanded] = useState(false); // Consolidated DD, VDR, Modeling
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [investorServicesExpanded, setInvestorServicesExpanded] = useState(false);
  const [marketIntelExpanded, setMarketIntelExpanded] = useState(false);
  const [documentStudioExpanded, setDocumentStudioExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [expandedSubcats, setExpandedSubcats] = useState<Set<string>>(new Set()); // all start collapsed
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'contact' | 'company' | 'deal', id: string} | null>(null);
  const { simplifiedMode } = useDisplayMode();
  const { selectedAssetId: selectedOpsAssetId, setSelectedAsset: setSelectedOpsAsset } = useOpsAssetStore();
  
  // Sidebar collapse state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  
  // Persist collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Extract workspace ID from URL if viewing a specific workspace
  const workspaceMatch = location.match(/\/workspaces\/([^/?]+)/);
  const activeWorkspaceId = workspaceMatch ? workspaceMatch[1] : null;

  // Single consolidated bootstrap query - replaces 5 separate API calls
  const { data: bootstrapData } = useQuery<BootstrapData>({
    queryKey: ['/api/bootstrap'],
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch enabled ops modules based on owned asset classes
  const { data: opsModulesData, isLoading: opsModulesLoading } = useQuery<{ modules: string[]; assetClasses: string[] }>({
    queryKey: ['/api/operations-context/modules'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Extract data from bootstrap response
  const userPersona = bootstrapData?.persona;
  const activePacks = bootstrapData?.activePacks || [];
  const pendingPropertiesCount = bootstrapData?.pendingCounts?.properties || 0;
  const pendingContactsCount = bootstrapData?.pendingCounts?.contacts || 0;
  const pendingCompaniesCount = bootstrapData?.pendingCounts?.companies || 0;

  // Paywall modal state
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallPackType, setPaywallPackType] = useState<PackType>('crm_pipeline');
  const [paywallFeatureName, setPaywallFeatureName] = useState<string>('');
  const [supportOpen, setSupportOpen] = useState(false);

  const showPaywall = (packType: PackType, featureName: string) => {
    setPaywallPackType(packType);
    setPaywallFeatureName(featureName);
    setPaywallOpen(true);
  };

  const { highlightedIds, active: highlightActive } = useSidebarHighlight();
  const isHighlighted = (id: string) => highlightActive && highlightedIds.includes(id);

  // Helper function to check if user has access to a pack
  const hasPack = (packType: PackType): boolean => {
    return activePacks.includes(packType);
  };

  // Helper function to check if user has access to Rent Roll (requires owner, investor, broker, operations, or modeling_tools pack)
  // Operations pack and Analysis (modeling_tools) pack include Rent Roll as a bundled feature
  const hasRentRollAccess = (): boolean => {
    return hasPack('owner') || hasPack('investor') || hasPack('broker') || hasPack('operations') || hasPack('modeling_tools');
  };

  // Filter operations nav based on enabled modules (from owned asset classes) and access
  const enabledModules = opsModulesData?.modules || [];
  const ownedAssetClasses = opsModulesData?.assetClasses || [];
  const filteredOperationsModulesNav = operationsModulesNav.filter(item => {
    if (item.opsModuleKey === null) return true;
    if (item.href === '/rent-roll/executive' && !hasRentRollAccess()) return false;
    if (enabledModules.length > 0) {
      return enabledModules.includes(item.opsModuleKey);
    }
    return true;
  });

  // Build subcategory-grouped operations nav
  const opsSubcategoryGroups = OPS_SUBCATEGORY_META
    .map(subcat => {
      // For asset-class-specific subcategories, check if user owns any matching asset.
      // Show all while still loading (opsModulesLoading) or in dev mode (enabledModules empty means no subscription data yet).
      if (!subcat.isUniversal) {
        const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
        const hasMatchingAsset = isDev || opsModulesLoading || ownedAssetClasses.length === 0 ||
          (subcat.assetClasses || []).some(ac => ownedAssetClasses.includes(ac));
        if (!hasMatchingAsset) return null;
      }

      // Get items for this subcategory
      const items = operationsModulesNav.filter(item => {
        if (!item.opsModuleKey) return false;
        const itemSubcat = OPS_MODULE_SUBCATEGORY[item.opsModuleKey as keyof typeof OPS_MODULE_SUBCATEGORY];
        if (itemSubcat !== subcat.id) return false;
        // Apply same module filtering as before
        if (item.href === '/rent-roll/executive' && !hasRentRollAccess()) return false;
        if (enabledModules.length > 0) return enabledModules.includes(item.opsModuleKey);
        return true;
      });

      if (items.length === 0) return null;
      return { ...subcat, items };
    })
    .filter(Boolean) as (typeof OPS_SUBCATEGORY_META[0] & { items: typeof operationsModulesNav })[];

  // Helper function to check if user can see a section based on persona
  // Always show all sections so users can see what's available (locked items show paywall)
  const canViewSection = (section: string): boolean => {
    if (!userPersona) return true; // Default to show all if no persona assigned
    
    const persona = userPersona.primaryPersona;
    const secondaryPersona = userPersona.secondaryPersona;
    
    // PE Investors see everything
    if (persona === 'pe_investor') return true;
    
    // Check primary and secondary personas
    const personas = [persona, secondaryPersona].filter(Boolean);
    
    const sectionAccess: Record<string, string[]> = {
      crm: ['pe_investor', 'broker', 'operator', 'advisor'], // CRM & Pipeline - ALL users
      prospecting: ['pe_investor', 'broker'], // Prospecting & Outreach - Broker add-on only
      operations: ['pe_investor', 'operator'],
      deal_workspace: ['pe_investor', 'broker', 'operator', 'advisor'], // Consolidated DD, VDR, Modeling - ALL users who had access to any of these
      modeling_tools: ['pe_investor', 'broker', 'advisor'], // Standalone modeling tools (broader access)
      analysis: ['pe_investor', 'broker', 'advisor'],
    };
    
    return personas.some(p => sectionAccess[section]?.includes(p));
  };

  // Auto-expand categories based on current location
  useEffect(() => {
    // Determine which section the current page belongs to
    const isOperationsPage = location.startsWith('/operations/');
    // CRM: contacts, companies, properties only (entity management)
    const isCrmPage = ['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location);
    const isPendingPage = location.includes('/pending-');
    // Pipeline section: Deal Board, Activity Log, Follow-Ups, Forecast
    const isPipelinePage = ['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/forecast', '/pipeline/deal-board', '/pipeline/activity-log', '/pipeline/follow-ups', '/pipeline/forecast'].includes(location) || location.startsWith('/deal-workspace') || location.startsWith('/pipeline/');
    // Prospecting section: Overview and Workroom only
    const isProspectingPage = location === '/prospecting' || (location.startsWith('/prospecting/') && !location.startsWith('/prospecting/marketing') && !location.startsWith('/prospecting/campaigns') && !location.startsWith('/prospecting/templates'));
    // Marketing section
    const isMarketingPage = location.startsWith('/marketing') || location.startsWith('/prospecting/marketing') || location.startsWith('/prospecting/campaigns') || location.startsWith('/prospecting/templates');
    // Deal Workspace: consolidated DD, VDR pages (workspaces, DD projects, data room)
    const isDealWorkspacePage = location.startsWith('/workspaces') || location.startsWith('/projects') || location === '/progress-report' || location.startsWith('/vdr') || location.startsWith('/dd/');
    // Analysis: Modeling Projects (Financial Model), Debt Scenarios, Exit Strategies, P&L Parser, OM Builder, Modeling Settings
    const isUnderwritingToolsPage = location.startsWith('/modeling/projects') || location.startsWith('/modeling/returns-valuation') || location.startsWith('/modeling/portfolio') || location.startsWith('/modeling/scenarios') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit') || location.startsWith('/modeling/pnl') || location.startsWith('/modeling/settings') || location.startsWith('/document-intelligence');
    const isOmBuilderPage = location.startsWith('/om');
    // Investor Services: Fund Management, LP Portal (GP only)
    const isInvestorServicesPage = location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal');
    const isMarketIntelPage = location.startsWith('/analysis/');
    const isDocumentStudioPage = location.startsWith('/document-studio') || location.startsWith('/om') || location.startsWith('/document-builder') || location.startsWith('/simple-report');

    // Set expanded states - Operations stays expanded by default, others expand when active
    if (isOperationsPage) {
      setOperationsExpanded(true);
    }
    setCrmExpanded(isCrmPage);
    setProspectingExpanded(isProspectingPage);
    setMarketingExpanded(isMarketingPage);
    setPipelineExpanded(isPipelinePage);
    setPendingExpanded(isPendingPage);
    setDealWorkspaceExpanded(isDealWorkspacePage);
    setAnalysisExpanded(isUnderwritingToolsPage);
    setInvestorServicesExpanded(isInvestorServicesPage);
    setMarketIntelExpanded(isMarketIntelPage);
    setDocumentStudioExpanded(isDocumentStudioPage);
    setAdminExpanded(location.startsWith('/admin'));
  }, [location]);

  // Check if there are any pending items to show the Pending section
  const totalPendingCount = pendingPropertiesCount + pendingContactsCount + pendingCompaniesCount;
  const hasPendingItems = totalPendingCount > 0;

  // Pending navigation items - only used when there are pending items
  const pendingNav = [
    ...(pendingContactsCount > 0 ? [{ 
      name: "Contacts", 
      href: "/crm/pending-contacts", 
      badge: String(pendingContactsCount)
    }] : []),
    ...(pendingCompaniesCount > 0 ? [{ 
      name: "Companies", 
      href: "/crm/pending-companies", 
      badge: String(pendingCompaniesCount)
    }] : []),
    ...(pendingPropertiesCount > 0 ? [{ 
      name: "Properties", 
      href: "/crm/pending-properties", 
      badge: String(pendingPropertiesCount)
    }] : []),
  ];


  const handleNavClick = () => {
    // Navigation click handler (sidebar is desktop-only; MobileShell handles mobile nav)
  };

  const NavLink = ({ item, depth = 0 }: { item: { name: string; href: string; icon?: any; badge?: string; disabled?: boolean }; depth?: number }) => {
    // Check if current location is a child of this nav item's href
    // Parse both location and href to handle query parameters using wouter's location string
    const [itemPath, itemQuery] = item.href.split('?');
    
    // Parse current location for query params (location from wouter may include query string)
    const [currentPath, currentQueryStr] = location.split('?');
    const currentTabParam = currentQueryStr ? new URLSearchParams('?' + currentQueryStr).get('tab') : null;
    const itemTabParam = itemQuery ? new URLSearchParams('?' + itemQuery).get('tab') : null;
    
    // For workspace sub-nav with query params, check if we're on the same workspace and same tab
    const isWorkspaceTabLink = itemPath.startsWith('/workspaces/') && itemTabParam;
    const isActiveTab = isWorkspaceTabLink 
      ? (currentPath.startsWith(itemPath) || currentPath === itemPath) && currentTabParam === itemTabParam
      : false;
    
    // For workspace overview (no tab param), check if no tab is in URL
    const isWorkspaceOverview = itemPath.startsWith('/workspaces/') && !itemTabParam && itemPath !== '/workspaces';
    const isActiveOverview = isWorkspaceOverview 
      ? (currentPath === itemPath || currentPath.startsWith(itemPath)) && !currentTabParam
      : false;
    
    // Standard matching: Exact match OR location starts with href followed by / or ?
    const isActive = isActiveTab || isActiveOverview || 
      location === item.href || 
      (item.href !== '/' && location.startsWith(item.href + '/')) ||
      (item.href !== '/' && location.startsWith(item.href + '?'));
    const isDisabled = item.disabled || false;
    
    if (isDisabled) {
      const content = (
        <div
          className={cn(
            "flex items-center text-[13px] text-gray-400 cursor-not-allowed",
            sidebarCollapsed ? "px-2 py-2.5 justify-center" : "px-4 py-2.5"
          )}
          data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
        >
          {item.icon && <item.icon className={cn("w-4 h-4 flex-shrink-0", !sidebarCollapsed && "mr-3")} />}
          {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
        </div>
      );
      
      if (sidebarCollapsed) {
        return (
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <p>{item.name}</p>
            </TooltipContent>
          </Tooltip>
        );
      }
      return content;
    }
    
    const linkContent = (
      <Link 
        key={item.name} 
        href={item.href}
        onClick={handleNavClick}
        style={!sidebarCollapsed && depth > 0 ? { paddingLeft: `${16 + depth * 24}px` } : undefined}
        className={cn(
          "flex items-center min-w-0 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          depth === 0 && "text-[13px] text-sidebar-foreground",
          depth === 1 && "text-[12px] text-sidebar-foreground/60",
          depth >= 2 && "text-[11px] text-sidebar-foreground/50 italic",
          sidebarCollapsed ? "px-2 py-2.5 justify-center" : depth > 0 ? "px-4 py-[7px] md:py-[6px]" : "px-4 py-3 md:py-2.5",
          isActive && "bg-sidebar-accent border-r-3 border-sidebar-primary text-sidebar-primary font-medium !text-sidebar-primary"
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
      >
        {item.icon && <item.icon className={cn("flex-shrink-0", !sidebarCollapsed && "mr-3", depth > 0 ? "w-3.5 h-3.5" : "w-4 h-4", isActive && "text-sidebar-primary")} />}
        {!sidebarCollapsed && (
          <>
            {!item.icon && depth === 1 && (
              <span className="mr-2 text-sidebar-foreground/30 select-none flex-shrink-0">–</span>
            )}
            {!item.icon && depth >= 2 && (
              <span className="mr-1.5 text-sidebar-foreground/25 select-none flex-shrink-0">·</span>
            )}
            <span className="truncate">{item.name}</span>
            {item.badge && (
              <span className="ml-auto text-xs bg-blue-500 text-white rounded-full px-2 py-0.5" data-testid={`badge-${item.name.toLowerCase().replace(/ /g, '-')}`}>
                {item.badge}
              </span>
            )}
          </>
        )}
        {sidebarCollapsed && item.badge && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </Link>
    );
    
    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors relative",
                isActive && "bg-sidebar-accent"
              )}
              onClick={() => setSidebarCollapsed(false)}
            >
              {item.icon && <item.icon className={cn("w-4 h-4", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />}
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p>{item.name}{item.badge ? ` (${item.badge})` : ''}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return linkContent;
  };

  const SectionHeader = ({
    title,
    expanded,
    onToggle,
    isActive = false,
    icon,
    locked = false,
    highlighted = false,
    onLockedClick,
  }: {
    title: string;
    expanded: boolean;
    onToggle: () => void;
    isActive?: boolean;
    icon?: any;
    locked?: boolean;
    highlighted?: boolean;
    onLockedClick?: () => void;
  }) => {
    const IconComponent = icon;
    const dimmed = locked && !highlighted;

    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors relative",
                isActive && "bg-sidebar-accent",
                dimmed && "opacity-60"
              )}
              onClick={() => {
                if (locked && onLockedClick) {
                  onLockedClick();
                } else {
                  setSidebarCollapsed(false);
                }
              }}
            >
              {IconComponent && <IconComponent className={cn("w-4 h-4", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />}
              {locked && !highlighted && (
                <Lock className="w-2.5 h-2.5 absolute bottom-1 right-1 text-amber-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p>{title}{locked && !highlighted ? ' (Locked)' : ''}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <button
        onClick={locked && onLockedClick ? onLockedClick : onToggle}
        className={cn(
          "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors",
          dimmed
            ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70"
            : highlighted && locked
              ? "text-sidebar-foreground hover:bg-sidebar-accent/60"
              : expanded
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        data-testid={`toggle-${title.toLowerCase()}`}
      >
        <div className="flex items-center gap-2">
          {IconComponent && <IconComponent className="w-4 h-4" />}
          <span>{title}</span>
        </div>
        {locked && !highlighted ? (
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-normal text-amber-500 uppercase tracking-wide">Upgrade</span>
          </div>
        ) : locked && highlighted ? (
          <div className="flex items-center gap-1 bg-blue-500 text-white rounded px-1.5 py-0.5">
            <Sparkles className="w-2.5 h-2.5" />
            <span className="text-[9px] font-semibold uppercase tracking-wide">Unlocks</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        ) : (
          expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <>
        {/* Mobile header bar replaced by MobileTopHeader in Router.tsx (md:hidden) */}

        {/* Sidebar — hidden on mobile (bottom tab bar is the primary mobile nav) */}
        <div
          className={cn(
            "bg-sidebar text-sidebar-foreground shadow-lg flex-shrink-0 flex flex-col h-screen",
            // md:relative + md:z-[70] lifts the whole sidebar above the dialog overlay (z-50)
            // so it stays readable when the upgrade modal is open
            "fixed md:relative top-0 left-0 z-50 md:z-[70]",
            "transition-all duration-300 ease-in-out",
            // Always hidden on mobile; always visible on md+
            "-translate-x-full md:translate-x-0",
            sidebarCollapsed ? "w-64 md:w-16" : "w-64"
          )}
          data-testid="unified-sidebar"
        >
          {/* Header */}
          <div className={cn("py-4 border-b border-sidebar-border flex-shrink-0", sidebarCollapsed ? "space-y-2" : "space-y-3")}>
            <div className={cn("flex items-center", sidebarCollapsed ? "justify-center px-2" : "justify-between px-4")}>
              <Link href="/" data-testid="sidebar-logo">
                <div className="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                    <Anchor className="w-5 h-5 text-white" />
                  </div>
                  {!sidebarCollapsed && <h1 className="text-lg font-bold text-sidebar-foreground truncate">Vantage</h1>}
                </div>
              </Link>
            </div>
            {/* Command Palette Trigger */}
            {!sidebarCollapsed ? (
              <div className="w-full px-4">
                <button
                  onClick={() => {
                    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                    document.dispatchEvent(event);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-sidebar-foreground/70 bg-sidebar-accent hover:bg-sidebar-accent/80 border border-sidebar-border rounded-md transition-colors"
                  data-testid="command-palette-trigger"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>Search everything...</span>
                  </div>
                  <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-sidebar-border bg-sidebar px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/70">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                      document.dispatchEvent(event);
                    }}
                    className="flex items-center justify-center w-full py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
                    data-testid="command-palette-trigger-collapsed"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  <p>Search (⌘K)</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
      
      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" data-testid="sidebar-navigation" data-tour="sidebar-nav">
        {/* Dashboard Link */}
        <div className={cn("mb-4", highlightActive && "sidebar-section-dimmed")}>
          <NavLink item={{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }} />
        </div>
        
        {/* Operations Section - Flattened navigation with in-page tabs */}
        {canViewSection('operations') && (
          <div className={cn("mb-2", isHighlighted('operations') && "sidebar-glow")}>
            <SectionHeader
              title="Operations"
              icon={Building2}
              expanded={operationsExpanded && hasPack('operations')}
              onToggle={() => setOperationsExpanded(!operationsExpanded)}
              isActive={location.startsWith('/operations/')}
              locked={!hasPack('operations')}
              highlighted={isHighlighted('operations')}
              onLockedClick={() => showPaywall('operations', 'Operations')}
            />
            {operationsExpanded && hasPack('operations') && (
              <>
                {/* Asset Switcher — only when multiple assets owned */}
                {(opsModulesData?.assets?.length || 0) > 1 && (
                  <div className="px-3 py-1.5">
                    <select
                      className="w-full h-7 text-[11px] rounded-md border border-sidebar-border bg-sidebar px-2 text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selectedOpsAssetId || ''}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        const asset = opsModulesData?.assets?.find((a: any) => a.id === id);
                        setSelectedOpsAsset(id, asset?.name || null);
                      }}
                    >
                      <option value="">All Assets (Portfolio)</option>
                      {(opsModulesData?.assets || []).map((asset: any) => (
                        <option key={asset.id} value={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Portfolio — always visible */}
                <NavLink item={{ name: "Portfolio", href: "/portfolio" }} />

                {/* Subcategory-grouped modules — each section is independently collapsible */}
                {opsSubcategoryGroups.map((subcat) => {
                  const isExpanded = expandedSubcats.has(subcat.id);
                  const isActive = subcat.items.some(item => location.startsWith(item.href));
                  const toggleSubcat = () => setExpandedSubcats(prev => {
                    const next = new Set(prev);
                    if (next.has(subcat.id)) next.delete(subcat.id);
                    else next.add(subcat.id);
                    return next;
                  });
                  return (
                    <div key={subcat.id}>
                      <button
                        onClick={toggleSubcat}
                        className={cn(
                          "mt-2 mb-0 ml-2 mr-1 flex items-center justify-between rounded px-2 py-1",
                          "w-[calc(100%-12px)] text-[9px] font-bold uppercase tracking-widest",
                          "border-l border-sidebar-foreground/15 pl-3",
                          "hover:bg-white/[0.06] transition-colors group",
                          isActive
                            ? "text-sidebar-foreground/70"
                            : "text-sidebar-foreground/40"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{subcat.label}</span>
                          {!subcat.isUniversal && (
                            <span className="w-1 h-1 rounded-full bg-primary/50 flex-shrink-0" title="Asset-class specific" />
                          )}
                        </div>
                        <ChevronDown className={cn(
                          "w-2.5 h-2.5 flex-shrink-0 opacity-50 transition-transform duration-150",
                          isExpanded ? "rotate-0" : "-rotate-90"
                        )} />
                      </button>
                      {isExpanded && subcat.items.map((item) => (
                        <NavLink key={item.name} item={item} depth={1} />
                      ))}
                    </div>
                  );
                })}

                {/* Integrations link */}
                <div className="mt-3 mb-0.5 ml-4 pl-3 border-l border-sidebar-foreground/15 flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/40">System</span>
                </div>
                <NavLink item={{ name: "Integrations", href: "/operations/integrations" }} depth={1} />
              </>
            )}
          </div>
        )}
        
        {/* CRM Section - Contacts, Companies, Properties */}
        {canViewSection('crm') && (
          <div className={cn("mb-2", isHighlighted('crm') && "sidebar-glow")}>
            <SectionHeader
              title="CRM"
              icon={Users}
              expanded={crmExpanded && hasPack('crm_pipeline')}
              onToggle={() => setCrmExpanded(!crmExpanded)}
              isActive={['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location)}
              locked={!hasPack('crm_pipeline')}
              highlighted={isHighlighted('crm')}
              onLockedClick={() => showPaywall('crm_pipeline', 'CRM')}
            />
            {crmExpanded && hasPack('crm_pipeline') && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {crmNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
                {/* Pending Section - Only visible when there are pending items */}
                {hasPendingItems && (
                  <div className="mt-1 mb-2">
                    <button
                      onClick={() => setPendingExpanded(!pendingExpanded)}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-1.5 text-xs font-medium transition-colors rounded-lg",
                        location.includes('/pending-')
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100"
                      )}
                      data-testid="toggle-pending"
                    >
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Pending Review</span>
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full font-semibold">
                          {totalPendingCount}
                        </span>
                      </div>
                      {pendingExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {pendingExpanded && pendingNav.map((item) => (
                      <NavLink key={item.name} item={item} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prospecting Section - Overview and Workroom */}
        {canViewSection('prospecting') && (
          <div className={cn("mb-2", isHighlighted('prospecting') && "sidebar-glow")}>
            <SectionHeader
              title="Prospecting"
              icon={Search}
              expanded={prospectingExpanded && hasPack('prospecting')}
              onToggle={() => setProspectingExpanded(!prospectingExpanded)}
              isActive={location === '/prospecting' || (location.startsWith('/prospecting/') && !location.startsWith('/prospecting/marketing') && !location.startsWith('/prospecting/campaigns'))}
              locked={!hasPack('prospecting')}
              highlighted={isHighlighted('prospecting')}
              onLockedClick={() => showPaywall('prospecting', 'Prospecting')}
            />
            {prospectingExpanded && hasPack('prospecting') && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {prospectingNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Marketing Section */}
        {canViewSection('prospecting') && (
          <div className={cn("mb-2", isHighlighted('marketing') && "sidebar-glow")}>
            <SectionHeader
              title="Marketing"
              icon={Megaphone}
              expanded={marketingExpanded && hasPack('prospecting')}
              onToggle={() => setMarketingExpanded(!marketingExpanded)}
              isActive={location.startsWith('/marketing') || location.startsWith('/prospecting/marketing') || location.startsWith('/prospecting/campaigns')}
              locked={!hasPack('prospecting')}
              highlighted={isHighlighted('marketing')}
              onLockedClick={() => showPaywall('prospecting', 'Marketing')}
            />
            {marketingExpanded && hasPack('prospecting') && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {marketingNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Pipeline Section - Deal Board, Activity Log, Follow-Ups, Forecast */}
        {canViewSection('crm') && (
          <div className={cn("mb-2", isHighlighted('pipeline') && "sidebar-glow")}>
            <SectionHeader
              title="Pipeline"
              icon={Handshake}
              expanded={pipelineExpanded && hasPack('crm_pipeline')}
              onToggle={() => setPipelineExpanded(!pipelineExpanded)}
              isActive={['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/forecast', '/pipeline/deal-board', '/pipeline/activity-log', '/pipeline/follow-ups', '/pipeline/forecast'].includes(location) || location.startsWith('/deal-workspace') || location.startsWith('/pipeline/')}
              locked={!hasPack('crm_pipeline')}
              highlighted={isHighlighted('pipeline')}
              onLockedClick={() => showPaywall('crm_pipeline', 'Pipeline')}
            />
            {pipelineExpanded && hasPack('crm_pipeline') && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {pipelineDealNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Deal Workspace Section - Consolidated DD, VDR, and Modeling */}
        {canViewSection('deal_workspace') && (
          <div className={cn("mb-2", isHighlighted('deal-room') && "sidebar-glow")}>
            <SectionHeader 
              title="Deal Workspace" 
              icon={Briefcase}
              expanded={dealWorkspaceExpanded} 
              onToggle={() => setDealWorkspaceExpanded(!dealWorkspaceExpanded)}
              isActive={location.startsWith('/workspaces') || location.startsWith('/projects') || location === '/progress-report' || location.startsWith('/vdr')}
            />
            {dealWorkspaceExpanded && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {dealWorkspaceNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
                {activeWorkspaceId && (
                  <div className="mt-2 border-l-2 border-blue-200 ml-4 pl-0">
                    <div className="text-xs font-medium text-blue-600 mb-1 px-2">Active Workspace</div>
                    {getWorkspaceSubNav(activeWorkspaceId).map((item) => (
                      <NavLink key={item.name} item={item} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Analysis Section - Modeling Projects, Debt Scenarios, Exit Strategies, OM Builder (all users) */}
        {canViewSection('modeling_tools') && (
          <div className={cn("mb-2", isHighlighted('underwriting') && "sidebar-glow")}>
            <SectionHeader
              title="Analysis"
              icon={Calculator}
              expanded={analysisExpanded}
              onToggle={() => setAnalysisExpanded(!analysisExpanded)}
              isActive={location.startsWith('/modeling/projects') || location.startsWith('/modeling/returns-valuation') || location.startsWith('/modeling/portfolio') || location.startsWith('/modeling/scenarios') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit') || location.startsWith('/modeling/pnl') || location.startsWith('/modeling/settings') || location.startsWith('/document-intelligence')}
            />
            {analysisExpanded && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {hasPack('modeling_tools') ? (
                  analysisNav
                    .filter((item) => {
                      if (!simplifiedMode) return true;
                      const hiddenInSimplifiedMode = [
                        "/modeling/scenarios",
                        "/modeling/returns-valuation",
                        "/modeling/portfolio/returns",
                        "/modeling/exit-strategies",
                      ];
                      return !hiddenInSimplifiedMode.includes(item.href);
                    })
                    .map((item) => (
                      <NavLink key={item.name} item={item} />
                    ))
                ) : (
                  <>
                    <NavLink item={{ name: "Financial Model", href: "/modeling/projects", badge: "Preview" }} />
                    {["Pipeline Returns", "Debt Scenarios", "Exit Strategies", "Model Settings"].map((name) => (
                      <button
                        key={name}
                        onClick={() => showPaywall('modeling_tools', 'Analysis Tools')}
                        className="flex items-center w-full px-4 py-[7px] text-[12px] text-sidebar-foreground/40 hover:bg-sidebar-accent/50 transition-colors"
                      >
                        <Lock className="w-3 h-3 mr-2 text-amber-500/70" />
                        <span>{name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Document Studio - Collapsible section with sub-navigation */}
        <div className="mb-2">
          <SectionHeader
            title="Document Studio"
            icon={FileText}
            expanded={documentStudioExpanded}
            onToggle={() => setDocumentStudioExpanded(!documentStudioExpanded)}
            isActive={location.startsWith('/document-studio') || location.startsWith('/om') || location.startsWith('/document-builder') || location.startsWith('/simple-report')}
          />
          {documentStudioExpanded && (
            <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
              <NavLink item={{ name: "All Documents", href: "/document-studio" }} />
              <NavLink item={{ name: "Template Gallery", href: "/document-studio/templates" }} />
              <NavLink item={{ name: "Quick Reports", href: "/simple-report" }} />
            </div>
          )}
        </div>
        
        {/* Investor Services Section - Fund Management, LP Portal */}
        <div className={cn("mb-2", (isHighlighted('fund-management') || isHighlighted('lp-portal')) && "sidebar-glow")}>
          <SectionHeader
            title="Fund Management"
            icon={DollarSign}
            expanded={investorServicesExpanded && (hasPack('fund_management') || hasPack('lp_portal'))}
            onToggle={() => setInvestorServicesExpanded(!investorServicesExpanded)}
            isActive={location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal')}
            locked={!hasPack('fund_management') && !hasPack('lp_portal')}
            highlighted={isHighlighted('fund-management') || isHighlighted('lp-portal')}
            onLockedClick={() => showPaywall('fund_management', 'Fund Management')}
          />
          {investorServicesExpanded && (hasPack('fund_management') || hasPack('lp_portal')) && (
            <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
              {investorServicesNav
                .filter((item) => {
                  if (item.href === '/modeling/funds') return hasPack('fund_management');
                  if (item.href === '/modeling/lp-portal') return hasPack('lp_portal');
                  return true;
                })
                .map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
            </div>
          )}
        </div>
        
        
        {/* Vantage - Section Title Style Link */}
        <div className="mb-2">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <Target className={cn("w-4 h-4", location.startsWith('/vantage') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Vantage</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/vantage">
              <div
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  location.startsWith('/vantage')
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-vantage"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" />
                  <span>Vantage</span>
                </div>
              </div>
            </Link>
          )}
        </div>
        
        {/* Docket - Section Title Style Link */}
        <div className="mb-2">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <MessageSquare className={cn("w-4 h-4", location.startsWith('/docket') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>The Docket</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/docket">
              <div
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  location.startsWith('/docket')
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-docket"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>The Docket</span>
                </div>
              </div>
            </Link>
          )}
        </div>
        
        {/* Market Intelligence Section — always visible (free users see preview items) */}
        {canViewSection('market_intelligence') && (
          <div className={cn("mb-2", isHighlighted('marinalytics') && "sidebar-glow")}>
            <SectionHeader
              title="Market Intelligence"
              icon={BarChart3}
              expanded={marketIntelExpanded}
              onToggle={() => setMarketIntelExpanded(!marketIntelExpanded)}
              isActive={location.startsWith('/analysis/')}
            />
            {marketIntelExpanded && (
              <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                {hasPack('analysis') ? (
                  // Full access — show all items
                  marketIntelligenceNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))
                ) : (
                  // Free tier — show preview items + locked items
                  <>
                    <NavLink item={{ name: "Analysis Hub", href: "/analysis/hub" }} />
                    <NavLink item={{ name: "Sales Comps", href: "/analysis/sales-comps", badge: "Preview" }} />
                    <NavLink item={{ name: "Demographics", href: "/analysis/demographics", badge: "Preview" }} />
                    {/* Locked items show paywall on click */}
                    {[
                      { name: "Rate Comps" },
                      { name: "Financial Analysis" },
                      { name: "Capital Markets" },
                      { name: "Portfolio Analytics" },
                      { name: "Predictive Analytics" },
                    ].map((item) => (
                      <button
                        key={item.name}
                        onClick={() => showPaywall('analysis', 'Market Intelligence')}
                        className="flex items-center w-full px-4 py-[7px] text-[12px] text-sidebar-foreground/40 hover:bg-sidebar-accent/50 transition-colors"
                      >
                        <Lock className="w-3 h-3 mr-2 text-amber-500/70" />
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Admin - Only visible to owners */}
        {user?.role === 'owner' && (
          <div className="mb-2">
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors",
                      location.startsWith('/admin') ? "bg-sidebar-accent" : ""
                    )}
                    onClick={() => setSidebarCollapsed(false)}
                  >
                    <Shield className={cn("w-4 h-4", location.startsWith('/admin') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  <p>Admin</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <SectionHeader
                  title="Admin"
                  icon={Shield}
                  expanded={adminExpanded}
                  onToggle={() => setAdminExpanded(!adminExpanded)}
                  isActive={location.startsWith('/admin')}
                />
                {adminExpanded && (
                  <div className="border-l-2 border-blue-500/40 ml-2 mr-1 bg-white/[0.04] rounded-br-sm pb-1 mb-2">
                    <NavLink item={{ name: "Customers", href: "/admin/customers" }} />
                    <NavLink item={{ name: "Organizations", href: "/admin/organizations" }} />
                    <NavLink item={{ name: "Activity Log", href: "/admin/audit-trail" }} />
                    <NavLink item={{ name: "Data Sources", href: "/admin/data-sources" }} />
                    <NavLink item={{ name: "Asset Classes", href: "/admin/asset-classes" }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Integrations - Section Title Style Link */}
        <div className="mb-2">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <Plug className={cn("w-4 h-4", location.startsWith('/settings/integrations') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Integrations</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/settings/integrations">
              <div
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  location.startsWith('/settings/integrations')
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-integrations"
              >
                <div className="flex items-center gap-2">
                  <Plug className="w-3.5 h-3.5" />
                  <span>Integrations</span>
                </div>
              </div>
            </Link>
          )}
        </div>
      </nav>
      
      {/* Simplified Mode Toggle */}
      <div className="border-t border-sidebar-border bg-sidebar flex-shrink-0">
        <SimplifiedModeToggle collapsed={sidebarCollapsed} />
      </div>

      {/* Collapse Toggle Button */}
      <div className={cn(
        "border-t border-sidebar-border bg-sidebar flex-shrink-0 hidden md:flex",
        sidebarCollapsed ? "justify-center p-2" : "justify-end px-4 py-2"
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebarCollapse}
              className="p-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
              data-testid="button-toggle-sidebar"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p>{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
          {!sidebarCollapsed && (
            <div className="border-t border-sidebar-border px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <a href="/terms" target="_blank" className="hover:text-foreground transition-colors">Terms</a>
              <a href="/privacy" target="_blank" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/benchmarking" target="_blank" className="hover:text-foreground transition-colors">Benchmarking</a>
              <button
                onClick={() => setSupportOpen(true)}
                className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <HeadphonesIcon className="w-3 h-3" />
                Help
              </button>
            </div>
          )}
          {sidebarCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSupportOpen(true)}
                  className="flex items-center justify-center py-2.5 px-2 w-full hover:bg-sidebar-accent transition-colors border-t border-sidebar-border"
                >
                  <HeadphonesIcon className="w-4 h-4 text-sidebar-foreground/50" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Help & Support</p>
              </TooltipContent>
            </Tooltip>
          )}
          <div className={cn(
            "border-t border-sidebar-border bg-sidebar flex-shrink-0 safe-area-bottom",
            sidebarCollapsed ? "p-2" : "p-4"
          )} data-testid="user-profile">
            {user && (
              <UserMenu 
                user={{
                  id: user.id,
                  name: user.name || user.email?.split('@')[0] || 'User',
                  email: user.email || '',
                  avatarUrl: user.avatarUrl,
                  orgId: user.orgId,
                  ssoProvider: user.ssoProvider,
                }}
              />
            )}
          </div>

        {/* Global Detail Drawer for Search Results */}
        {selectedEntity && (
          <DetailDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            entityType={selectedEntity.type}
            entityId={selectedEntity.id}
            onDelete={() => {
              setDrawerOpen(false);
              setSelectedEntity(null);
            }}
          />
        )}

        {/* Support Contact Modal */}
        <SupportContactModal
          open={supportOpen}
          onOpenChange={setSupportOpen}
          userName={user?.name || user?.email?.split('@')[0] || ''}
          userEmail={user?.email || ''}
        />

        {/* Paywall Modal — triggered when clicking locked sidebar sections */}
        <PaywallModal
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          packType={paywallPackType as any}
          featureName={paywallFeatureName}
        />
      </div>
      </>
    </TooltipProvider>
  );
}

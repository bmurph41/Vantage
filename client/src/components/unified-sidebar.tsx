import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings, Activity,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight, ChevronLeft,
  Briefcase, ListTodo, ClipboardList, Calculator, Anchor, Upload, History, Send, Menu, X, AlertCircle, Fuel, CreditCard, Box, Shield, MessageSquare, LayoutList, Megaphone, DollarSign, Link2, FolderLock, Receipt, RefreshCcw, Percent, Search, Wrench, Ship, ShoppingCart, PanelLeftClose, PanelLeft, Plug, BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/layout/UserMenu";

// CRM Navigation (Core CRM - Entity Management)
const crmNav = [
  { name: "Dashboard", href: "/crm" },
  { name: "Contacts", href: "/crm/contacts" },
  { name: "Companies", href: "/crm/companies" },
  { name: "Properties", href: "/crm/properties" },
  { name: "Prospecting", href: "/prospecting" },
  { name: "Marketing", href: "/marketing" },
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
  { name: "Campaigns & Templates", href: "/prospecting/campaigns" },
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
const operationsModulesNav = [
  { name: "Portfolio", href: "/portfolio" },
  { name: "Bookkeeping", href: "/operations/bookkeeping" },
  { name: "Payroll", href: "/operations/payroll" },
  { name: "Dockit", href: "/operations/dockit" },
  { name: "Rent Roll", href: "/rent-roll/executive" },
  { name: "Commercial Tenants", href: "/operations/commercial-tenants" },
  { name: "Fuel Sales", href: "/operations/fuel" },
  { name: "Ship Store", href: "/operations/ship-store" },
  { name: "Service & Parts", href: "/operations/service" },
  { name: "Boat Rentals", href: "/operations/boat-rentals" },
  { name: "Boat Club", href: "/operations/boat-club" },
  { name: "Boat Sales", href: "/operations/boat-sales" },
];

// Deal Workspace Navigation - Consolidated DD, VDR, and Modeling
const dealWorkspaceNav = [
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
  { name: "Portfolio Returns", href: "/modeling/portfolio/returns" },
  { name: "Debt Scenarios", href: "/modeling/scenarios" },
  { name: "Exit Strategies", href: "/modeling/exit-strategies" },
  { name: "Model Settings", href: "/modeling/settings" },
];

// Investor Services Navigation (GP users only via pack check)
const investorServicesNav = [
  { name: "Fund Management", href: "/modeling/funds" },
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
];

// Integrations - direct link (no sub-navigation)

type PendingItem = {
  id: string;
  status: string;
};

type PackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro' | 'owner' | 'investor' | 'broker' | 'operations';

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
  const [prospectingExpanded, setProspectingExpanded] = useState(false); // Prospecting, Analytics
  const [dealWorkspaceExpanded, setDealWorkspaceExpanded] = useState(false); // Consolidated DD, VDR, Modeling
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [investorServicesExpanded, setInvestorServicesExpanded] = useState(false);
  const [marketIntelExpanded, setMarketIntelExpanded] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'contact' | 'company' | 'deal', id: string} | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  // Extract data from bootstrap response
  const userPersona = bootstrapData?.persona;
  const activePacks = bootstrapData?.activePacks || [];
  const pendingPropertiesCount = bootstrapData?.pendingCounts?.properties || 0;
  const pendingContactsCount = bootstrapData?.pendingCounts?.contacts || 0;
  const pendingCompaniesCount = bootstrapData?.pendingCounts?.companies || 0;

  // Helper function to check if user has access to a pack
  const hasPack = (packType: PackType): boolean => {
    return activePacks.includes(packType);
  };

  // Helper function to check if user has access to Rent Roll (requires owner, investor, broker, operations, or modeling_tools pack)
  // Operations pack and Analysis (modeling_tools) pack include Rent Roll as a bundled feature
  // In development mode, always show Rent Roll for testing
  const hasRentRollAccess = (): boolean => {
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    if (isDev) return true;
    return hasPack('owner') || hasPack('investor') || hasPack('broker') || hasPack('operations') || hasPack('modeling_tools');
  };

  // Filter operations nav to hide Rent Roll if user doesn't have access
  const filteredOperationsModulesNav = operationsModulesNav.filter(item => {
    if (item.href === '/rent-roll/executive') {
      return hasRentRollAccess();
    }
    return true;
  });

  // Helper function to check if user can see a section based on persona
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
    // CRM: contacts, companies, properties, marketing (core entity management)
    const isCrmPage = ['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location) || location.startsWith('/marketing') || location === '/prospecting' || location.startsWith('/prospecting/');
    const isPendingPage = location.includes('/pending-');
    // Pipeline section: Deal Board, Activity Log, Follow-Ups, Forecast
    const isPipelinePage = ['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/forecast', '/pipeline/deal-board', '/pipeline/activity-log', '/pipeline/follow-ups', '/pipeline/forecast'].includes(location) || location.startsWith('/deal-workspace') || location.startsWith('/pipeline/');
    // Prospecting section: Overview and Workroom
    const isProspectingPage = location === '/prospecting' || location.startsWith('/prospecting/');
    // Deal Workspace: consolidated DD, VDR pages (workspaces, DD projects, data room)
    const isDealWorkspacePage = location.startsWith('/workspaces') || location.startsWith('/projects') || location === '/progress-report' || location.startsWith('/vdr') || location.startsWith('/dd/');
    // Analysis: Modeling Projects (Financial Model), Debt Scenarios, Exit Strategies, P&L Parser, OM Builder, Modeling Settings
    const isUnderwritingToolsPage = location.startsWith('/modeling/projects') || location.startsWith('/modeling/returns-valuation') || location.startsWith('/modeling/portfolio/returns') || location.startsWith('/modeling/scenarios') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit') || location.startsWith('/modeling/pnl') || location.startsWith('/modeling/settings');
    const isOmBuilderPage = location.startsWith('/om');
    // Investor Services: Fund Management, LP Portal (GP only)
    const isInvestorServicesPage = location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal');
    const isMarketIntelPage = location.startsWith('/analysis/');

    // Set expanded states - Operations stays expanded by default, others expand when active
    if (isOperationsPage) {
      setOperationsExpanded(true);
    }
    setCrmExpanded(isCrmPage);
    setPipelineExpanded(isPipelinePage);
    setProspectingExpanded(isProspectingPage);
    setPendingExpanded(isPendingPage);
    setDealWorkspaceExpanded(isDealWorkspacePage);
    setAnalysisExpanded(isUnderwritingToolsPage);
    setInvestorServicesExpanded(isInvestorServicesPage);
    setMarketIntelExpanded(isMarketIntelPage);
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
    setMobileMenuOpen(false);
  };

  const NavLink = ({ item }: { item: { name: string; href: string; icon?: any; badge?: string; disabled?: boolean } }) => {
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
        className={cn(
          "flex items-center text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
          sidebarCollapsed ? "px-2 py-2.5 justify-center" : "px-4 py-2.5",
          isActive && "bg-sidebar-accent border-r-3 border-sidebar-primary text-sidebar-primary font-medium"
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
      >
        {item.icon && <item.icon className={cn("w-4 h-4 flex-shrink-0", !sidebarCollapsed && "mr-3", isActive && "text-sidebar-primary")} />}
        {!sidebarCollapsed && (
          <>
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
    icon
  }: { 
    title: string; 
    expanded: boolean; 
    onToggle: () => void;
    isActive?: boolean;
    icon?: any;
  }) => {
    const IconComponent = icon;
    
    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors",
                isActive && "bg-sidebar-accent"
              )}
              onClick={() => setSidebarCollapsed(false)}
            >
              {IconComponent && <IconComponent className={cn("w-4 h-4", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p>{title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors",
          expanded
            ? "bg-blue-600 text-white hover:bg-blue-700" 
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        data-testid={`toggle-${title.toLowerCase()}`}
      >
        <div className="flex items-center gap-2">
          {IconComponent && <IconComponent className="w-4 h-4" />}
          <span>{title}</span>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <>
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-50 md:hidden bg-sidebar p-2 rounded-lg shadow-lg hover:bg-sidebar-accent transition-colors"
          data-testid="button-mobile-menu"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-sidebar-foreground" />
        </button>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            data-testid="mobile-menu-overlay"
          />
        )}

        {/* Sidebar */}
        <div 
          className={cn(
            "bg-sidebar text-sidebar-foreground shadow-lg flex-shrink-0 flex flex-col h-screen",
            "fixed md:static top-0 left-0 z-50",
            "transition-all duration-300 ease-in-out",
            "md:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            sidebarCollapsed ? "w-16" : "w-64"
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
                  {!sidebarCollapsed && <h1 className="text-lg font-bold text-sidebar-foreground truncate">MarinaMatch</h1>}
                </div>
              </Link>
              {/* Mobile Close Button */}
              {!sidebarCollapsed && (
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
                  data-testid="button-close-mobile-menu"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
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
        <div className="mb-4">
          <NavLink item={{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }} />
        </div>
        
        {/* Operations Section - Flattened navigation with in-page tabs */}
        {canViewSection('operations') && (
          <div className="mb-2">
            <SectionHeader 
              title="Operations" 
              icon={Building2}
              expanded={operationsExpanded} 
              onToggle={() => setOperationsExpanded(!operationsExpanded)}
              isActive={location.startsWith('/operations/')}
            />
            {operationsExpanded && filteredOperationsModulesNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* CRM Section - Contacts, Companies, Properties */}
        {canViewSection('crm') && (
          <div className="mb-2">
            <SectionHeader 
              title="CRM" 
              icon={Users}
              expanded={crmExpanded} 
              onToggle={() => setCrmExpanded(!crmExpanded)}
              isActive={['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location) || location.startsWith('/marketing') || location === '/prospecting' || location.startsWith('/prospecting/')}
            />
            {crmExpanded && (
              <>
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
              </>
            )}
          </div>
        )}
        
        {/* Pipeline Section - Deal Board, Activity Log, Follow-Ups, Forecast */}
        {canViewSection('crm') && (
          <div className="mb-2">
            <SectionHeader 
              title="Pipeline" 
              icon={Handshake}
              expanded={pipelineExpanded} 
              onToggle={() => setPipelineExpanded(!pipelineExpanded)}
              isActive={['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/forecast', '/pipeline/deal-board', '/pipeline/activity-log', '/pipeline/follow-ups', '/pipeline/forecast'].includes(location) || location.startsWith('/deal-workspace') || location.startsWith('/pipeline/')}
            />
            {pipelineExpanded && (
              <>
                {pipelineDealNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </>
            )}
          </div>
        )}
        
        {/* Deal Workspace Section - Consolidated DD, VDR, and Modeling */}
        {canViewSection('deal_workspace') && (
          <div className="mb-2">
            <SectionHeader 
              title="Deal Workspace" 
              icon={Briefcase}
              expanded={dealWorkspaceExpanded} 
              onToggle={() => setDealWorkspaceExpanded(!dealWorkspaceExpanded)}
              isActive={location.startsWith('/workspaces') || location.startsWith('/projects') || location === '/progress-report' || location.startsWith('/vdr')}
            />
            {dealWorkspaceExpanded && (
              <>
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
              </>
            )}
          </div>
        )}
        
        {/* Analysis Section - Modeling Projects, Debt Scenarios, Exit Strategies, OM Builder (all users) */}
        {canViewSection('modeling_tools') && (
          <div className="mb-2">
            <SectionHeader 
              title="Analysis" 
              icon={Calculator}
              expanded={analysisExpanded} 
              onToggle={() => setAnalysisExpanded(!analysisExpanded)}
              isActive={location.startsWith('/modeling/projects') || location.startsWith('/modeling/returns-valuation') || location.startsWith('/modeling/portfolio/returns') || location.startsWith('/modeling/scenarios') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit') || location.startsWith('/modeling/pnl') || location.startsWith('/modeling/settings')}
            />
            {analysisExpanded && analysisNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* OM Builder - Standalone Section Link */}
        <div className="mb-2">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <FileText className={cn("w-4 h-4", location.startsWith('/om') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>Investment Materials</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/om">
              <div
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  location.startsWith('/om')
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-om-builder"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Investment Materials</span>
                </div>
              </div>
            </Link>
          )}
          {!sidebarCollapsed && (
            <Link href="/document-builder">
              <div
                className={cn(
                  "flex items-center gap-2 w-full pl-4 pr-4 py-1.5 text-[11px] transition-colors cursor-pointer",
                  location.startsWith('/document-builder')
                    ? "text-blue-600 font-medium" 
                    : "text-gray-500 hover:text-gray-700"
                )}
                data-testid="nav-document-builder"
              >
                <FileText className="w-3 h-3" />
                <span>Document Builder</span>
              </div>
            </Link>
          )}
        </div>
        
        {/* Investor Services Section - Fund Management, LP Portal (GP users only via pack check) */}
        {(hasPack('fund_management') || hasPack('lp_portal')) && (
          <div className="mb-2">
            <SectionHeader 
              title="Investor Services" 
              icon={DollarSign}
              expanded={investorServicesExpanded} 
              onToggle={() => setInvestorServicesExpanded(!investorServicesExpanded)}
              isActive={location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal')}
            />
            {investorServicesExpanded && investorServicesNav
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
        
        
        {/* MarinaMatch - Section Title Style Link */}
        <div className="mb-2">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <Target className={cn("w-4 h-4", location.startsWith('/marinamatch') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>MarinaMatch</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/marinamatch">
              <div
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  location.startsWith('/marinamatch')
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-marinamatch"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" />
                  <span>MarinaMatch</span>
                </div>
              </div>
            </Link>
          )}
        </div>
        
        {/* DockTalk - Section Title Style Link */}
        <div className="mb-2">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <MessageSquare className={cn("w-4 h-4", location.startsWith('/docktalk') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p>The Docket</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/docktalk">
              <div
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  location.startsWith('/docktalk')
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-docktalk"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>The Docket</span>
                </div>
              </div>
            </Link>
          )}
        </div>
        
        {/* Market Intelligence Section */}
        {canViewSection('market_intelligence') && (
          <div className="mb-2">
            <SectionHeader 
              title="Market Intelligence" 
              icon={BarChart3}
              expanded={marketIntelExpanded} 
              onToggle={() => setMarketIntelExpanded(!marketIntelExpanded)}
              isActive={location.startsWith('/analysis/')}
            />
            {marketIntelExpanded && marketIntelligenceNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}

        {/* Admin - Only visible to owners */}
        {user?.role === 'owner' && (
          <div className="mb-2">
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/admin/customers">
                    <div 
                      className={cn(
                        "flex items-center justify-center py-2.5 px-2 cursor-pointer hover:bg-sidebar-accent transition-colors",
                        location.startsWith('/admin') ? "bg-sidebar-accent" : ""
                      )}
                    >
                      <Shield className={cn("w-4 h-4", location.startsWith('/admin') ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  <p>Admin</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Link href="/admin/customers">
                  <div
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                      location.startsWith('/admin')
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    data-testid="nav-admin"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Admin</span>
                    </div>
                  </div>
                </Link>
                <NavLink item={{ name: "Customers", href: "/admin/customers" }} />
                <NavLink item={{ name: "Organizations", href: "/admin/organizations" }} />
                <NavLink item={{ name: "Activity Log", href: "/admin/audit-trail" }} />
                <NavLink item={{ name: "Data Sources", href: "/admin/data-sources" }} />
                <NavLink item={{ name: "Asset Classes", href: "/admin/asset-classes" }} />
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
            </div>
          )}
          <div className={cn(
            "border-t border-sidebar-border bg-sidebar flex-shrink-0",
            sidebarCollapsed ? "p-2" : "p-4"
          )} data-testid="user-profile">
            {user && (
              <UserMenu 
                user={{
                  id: user.id,
                  name: user.name || user.email?.split('@')[0] || 'User',
                  email: user.email || '',
                  avatarUrl: user.avatarUrl,
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
      </div>
      </>
    </TooltipProvider>
  );
}

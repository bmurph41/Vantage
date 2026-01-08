import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight, ChevronLeft,
  Briefcase, ListTodo, ClipboardList, Calculator, Anchor, Upload, History, Send, Menu, X, AlertCircle, Fuel, CreditCard, Box, Shield, MessageSquare, LayoutList, Megaphone, DollarSign, Link2, FolderLock, Receipt, RefreshCcw, Percent, Search, Wrench, Ship, ShoppingCart, PanelLeftClose, PanelLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// CRM Navigation (Core CRM - Entity Management)
const crmNav = [
  { name: "Contacts", href: "/crm/contacts", icon: Users },
  { name: "Companies", href: "/crm/companies", icon: Building },
  { name: "Properties", href: "/crm/properties", icon: Home },
];

// Pipeline Navigation (Deal flow, marketing, analytics)
const pipelineDealNav = [
  { name: "Deal Board", href: "/deal-workspace", icon: Handshake },
  { name: "Activity Log", href: "/crm/activity", icon: History },
  { name: "Follow-Ups", href: "/crm/tasks", icon: ListTodo },
  { name: "Forecast", href: "/crm/forecast", icon: TrendingUp },
];


// Prospecting & Outreach Navigation (Premium/Broker Add-On)
const prospectingNav = [
  { name: "Prospecting", href: "/prospecting", icon: Target },
  { name: "Market Targets", href: "/prospecting/markets", icon: LayoutList },
  { name: "Campaigns & Templates", href: "/prospecting/campaigns", icon: Send },
  { name: "Deal Sourcing Analytics", href: "/prospecting/analytics", icon: PieChart },
];

// CRM Tools Submenu
const crmToolsNav = [
  { name: "Calendar Sync", href: "/calendar-settings", icon: Calendar },
  { name: "Labels", href: "/crm/labels", icon: Tag },
  { name: "Products", href: "/crm/products", icon: Package },
  { name: "Forms", href: "/crm/forms", icon: FileText },
  { name: "Workflows", href: "/crm/workflows", icon: Bot },
  { name: "Webhooks", href: "/crm/webhooks", icon: Webhook },
  { name: "Dedupe & Merge", href: "/crm/dedupe", icon: GitMerge },
  { name: "Scoring", href: "/crm/scoring", icon: Target },
  { name: "Import Contacts", href: "/import-contacts", icon: Upload },
  { name: "Import History", href: "/import-history", icon: History },
];

// Operations Navigation - Flattened module links (tabs handle sub-navigation)
const operationsModulesNav = [
  { name: "Portfolio", href: "/portfolio", icon: Building2 },
  { name: "Dockit", href: "/operations/dockit", icon: Anchor },
  { name: "Rent Roll", href: "/operations/rent-roll", icon: Building2 },
  { name: "Fuel Sales", href: "/operations/fuel", icon: Fuel },
  { name: "Ship Store", href: "/operations/ship-store", icon: ShoppingCart },
  { name: "Service Dept", href: "/operations/service", icon: Wrench },
  { name: "Boat Rentals", href: "/operations/boat-rentals", icon: Ship },
  { name: "Boat Club", href: "/operations/boat-club", icon: Users },
  { name: "Boat Sales", href: "/operations/boat-sales", icon: ShoppingCart },
  { name: "Marketing", href: "/operations/marketing", icon: Megaphone },
];

// Deal Workspace Navigation - Consolidated DD, VDR, and Modeling
const dealWorkspaceNav = [
  { name: "Projects", href: "/workspaces", icon: Briefcase },
  { name: "DD Projects", href: "/projects", icon: ClipboardList },
  { name: "Data Room", href: "/vdr", icon: FolderLock },
];

// Deal Workspace sub-nav (shown when inside a workspace)
const getWorkspaceSubNav = (workspaceId: string) => [
  { name: "Overview", href: `/workspaces/${workspaceId}`, icon: LayoutDashboard },
  { name: "Financials", href: `/workspaces/${workspaceId}?tab=financials`, icon: Calculator },
  { name: "Diligence", href: `/workspaces/${workspaceId}?tab=diligence`, icon: ClipboardList },
  { name: "Documents", href: `/workspaces/${workspaceId}?tab=documents`, icon: FolderLock },
  { name: "Team", href: `/workspaces/${workspaceId}?tab=team`, icon: Users },
];

// Underwriting Tools Navigation (all users - modeling, analysis, and document processing)
const underwritingToolsNav = [
  { name: "Valuator", href: "/modeling/projects", icon: Calculator },
  { name: "Debt Scenarios", href: "/modeling/debt-scenarios", icon: Calculator },
  { name: "Exit Strategies", href: "/modeling/exit-strategies", icon: Target },
  { name: "OM Builder", href: "/om", icon: FileText },
  { name: "Modeling Settings", href: "/modeling/settings", icon: Settings },
];

// Investor Services Navigation (GP users only via pack check)
const investorServicesNav = [
  { name: "Fund Management", href: "/modeling/funds", icon: Briefcase },
  { name: "LP Portal", href: "/modeling/lp-portal", icon: Users },
];

// DockTalk Navigation - Single Entry Point
const dockTalkNav = [
  { name: "DockTalk", href: "/docktalk", icon: MessageSquare },
];

// Market Intelligence Navigation (Sales Comps)
const marketIntelligenceNav = [
  { name: "Sales Comps", href: "/analysis/sales-comps", icon: BarChart3 },
  { name: "Rate Comps", href: "/analysis/rate-comps", icon: TrendingUp },
  { name: "Demographics", href: "/analysis/demographics", icon: Users },
  { name: "Capital Markets", href: "/analysis/benchmarks", icon: Target },
];

type PendingItem = {
  id: string;
  status: string;
};

type PackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro' | 'owner' | 'investor' | 'broker';

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
  const [operationsExpanded, setOperationsExpanded] = useState(false); // Default collapsed for Operations
  const [crmExpanded, setCrmExpanded] = useState(false);
  const [pipelineExpanded, setPipelineExpanded] = useState(false); // Pipeline deals section
  const [prospectingExpanded, setProspectingExpanded] = useState(false); // Prospecting, Analytics
  const [dealWorkspaceExpanded, setDealWorkspaceExpanded] = useState(false); // Consolidated DD, VDR, Modeling
  const [underwritingToolsExpanded, setUnderwritingToolsExpanded] = useState(false);
  const [investorServicesExpanded, setInvestorServicesExpanded] = useState(false);
  const [marketIntelligenceExpanded, setMarketIntelligenceExpanded] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'contact' | 'company' | 'deal', id: string} | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
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

  // Helper function to check if user has access to Rent Roll (requires owner, investor, or broker pack)
  const hasRentRollAccess = (): boolean => {
    return hasPack('owner') || hasPack('investor') || hasPack('broker');
  };

  // Filter operations nav to hide Rent Roll if user doesn't have access
  const filteredOperationsModulesNav = operationsModulesNav.filter(item => {
    if (item.href === '/operations/rent-roll') {
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
    // CRM: contacts, companies, properties (core entity management)
    const isCrmPage = ['/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location);
    const isPendingPage = location.includes('/pending-');
    // Pipeline section: Deal Board, Activity Log, Follow-Ups, Forecast
    const isPipelinePage = ['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/forecast'].includes(location) || location.startsWith('/deal-workspace');
    // Prospecting section: Overview and Workroom
    const isProspectingPage = location === '/prospecting' || location.startsWith('/prospecting/');
    // Deal Workspace: consolidated DD, VDR, and Modeling project pages
    const isDealWorkspacePage = location.startsWith('/workspaces') || location === '/projects' || location === '/progress-report' || location.startsWith('/vdr') || location.startsWith('/modeling/projects');
    // Underwriting Tools: Modeling Projects, Debt Scenarios, Exit Strategies, P&L Parser, OM Builder, Modeling Settings
    const isUnderwritingToolsPage = location.startsWith('/modeling/projects') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit') || location.startsWith('/om') || location.startsWith('/modeling/pnl') || location.startsWith('/modeling/settings');
    // Investor Services: Fund Management, LP Portal (GP only)
    const isInvestorServicesPage = location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal');
    const isMarketIntelligencePage = location.startsWith('/analysis/') || location.startsWith('/docktalk');

    // Set expanded states - Operations stays expanded by default, others expand when active
    if (isOperationsPage) {
      setOperationsExpanded(true);
    }
    setCrmExpanded(isCrmPage);
    setPipelineExpanded(isPipelinePage);
    setProspectingExpanded(isProspectingPage);
    setPendingExpanded(isPendingPage);
    setDealWorkspaceExpanded(isDealWorkspacePage);
    setUnderwritingToolsExpanded(isUnderwritingToolsPage);
    setInvestorServicesExpanded(isInvestorServicesPage);
    setMarketIntelligenceExpanded(isMarketIntelligencePage);
  }, [location]);

  // Check if there are any pending items to show the Pending section
  const totalPendingCount = pendingPropertiesCount + pendingContactsCount + pendingCompaniesCount;
  const hasPendingItems = totalPendingCount > 0;

  // Pending navigation items - only used when there are pending items
  const pendingNav = [
    ...(pendingContactsCount > 0 ? [{ 
      name: "Contacts", 
      href: "/crm/pending-contacts", 
      icon: Users,
      badge: String(pendingContactsCount)
    }] : []),
    ...(pendingCompaniesCount > 0 ? [{ 
      name: "Companies", 
      href: "/crm/pending-companies", 
      icon: Building,
      badge: String(pendingCompaniesCount)
    }] : []),
    ...(pendingPropertiesCount > 0 ? [{ 
      name: "Properties", 
      href: "/crm/pending-properties", 
      icon: Home,
      badge: String(pendingPropertiesCount)
    }] : []),
  ];


  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const NavLink = ({ item }: { item: { name: string; href: string; icon: any; badge?: string; disabled?: boolean } }) => {
    // For Sales Comps, also match sub-routes like analytics and projects
    const isActive = location === item.href || 
      (item.href === '/analysis/sales-comps' && location.startsWith('/analysis/sales-comps/'));
    const isDisabled = item.disabled || false;
    
    if (isDisabled) {
      const content = (
        <div
          className={cn(
            "flex items-center text-sm text-gray-400 cursor-not-allowed",
            sidebarCollapsed ? "px-2 py-2.5 justify-center" : "px-4 py-2.5"
          )}
          data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
        >
          <item.icon className={cn("w-4 h-4 flex-shrink-0", !sidebarCollapsed && "mr-3")} />
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
          "flex items-center text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors",
          sidebarCollapsed ? "px-2 py-2.5 justify-center" : "px-4 py-2.5",
          isActive && "bg-blue-50 border-r-3 border-blue-600 text-blue-600 font-medium"
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
      >
        <item.icon className={cn("w-4 h-4 flex-shrink-0", !sidebarCollapsed && "mr-3", isActive && "text-blue-600")} />
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
            <div className="relative">{linkContent}</div>
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
      // When collapsed, show just a divider line
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "flex items-center justify-center py-2 mx-2 border-t border-gray-200 mt-2 cursor-pointer hover:bg-gray-50",
                isActive && "bg-blue-50"
              )}
              onClick={onToggle}
            >
              {IconComponent && <IconComponent className={cn("w-4 h-4", isActive ? "text-blue-600" : "text-gray-400")} />}
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
          "flex items-center justify-between w-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
          isActive 
            ? "bg-blue-600 text-white hover:bg-blue-700" 
            : "text-gray-500 hover:text-gray-700"
        )}
        data-testid={`toggle-${title.toLowerCase()}`}
      >
        <span>{title}</span>
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
          className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
          data-testid="button-mobile-menu"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-gray-700" />
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
            "bg-white shadow-lg flex-shrink-0 flex flex-col h-screen",
            "fixed md:static top-0 left-0 z-50",
            "transition-all duration-300 ease-in-out",
            "md:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
          data-testid="unified-sidebar"
        >
          {/* Header */}
          <div className={cn("py-4 border-b border-gray-200 flex-shrink-0", sidebarCollapsed ? "space-y-2" : "space-y-3")}>
            <div className={cn("flex items-center", sidebarCollapsed ? "justify-center px-2" : "justify-between px-4")}>
              <Link href="/" data-testid="sidebar-logo">
                <div className="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                    <Anchor className="w-5 h-5 text-white" />
                  </div>
                  {!sidebarCollapsed && <h1 className="text-lg font-bold text-gray-900 truncate">MarinaMatch</h1>}
                </div>
              </Link>
              {/* Mobile Close Button */}
              {!sidebarCollapsed && (
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden text-gray-500 hover:text-gray-700 transition-colors"
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
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"
                  data-testid="command-palette-trigger"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>Search everything...</span>
                  </div>
                  <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-gray-300 bg-white px-1.5 font-mono text-[10px] font-medium text-gray-500">
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
                    className="flex items-center justify-center w-full py-2 text-gray-500 hover:bg-gray-100 transition-colors"
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
      <nav className="flex-1 overflow-y-auto py-4" data-testid="sidebar-navigation">
        {/* Dashboard Link */}
        <div className="mb-4">
          <NavLink item={{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }} />
        </div>
        
        {/* Operations Section - Flattened navigation with in-page tabs */}
        {canViewSection('operations') && (
          <div className="mb-2">
            <SectionHeader 
              title="Operations" 
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
              expanded={crmExpanded} 
              onToggle={() => setCrmExpanded(!crmExpanded)}
              isActive={['/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location)}
            />
            {crmExpanded && (
              <>
                {crmNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
                {/* Pending Section - Only visible when there are pending items */}
                {hasPendingItems && (
                  <div className="ml-4 mt-1 mb-2">
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
              expanded={pipelineExpanded} 
              onToggle={() => setPipelineExpanded(!pipelineExpanded)}
              isActive={['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/forecast'].includes(location) || location.startsWith('/deal-workspace')}
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
        
        {/* Prospecting Section - Overview and Workroom */}
        {canViewSection('crm') && (
          <div className="mb-2">
            <SectionHeader 
              title="Prospecting" 
              expanded={prospectingExpanded} 
              onToggle={() => setProspectingExpanded(!prospectingExpanded)}
              isActive={location === '/prospecting' || location.startsWith('/prospecting/')}
            />
            {prospectingExpanded && (
              <>
                {/* Overview - merged Dashboard + Analytics */}
                <NavLink item={{ name: "Overview", href: "/prospecting", icon: PieChart }} />
                {/* Workroom - weekly cards and goals */}
                <NavLink item={{ name: "Workroom", href: "/prospecting/workroom", icon: Target }} />
              </>
            )}
          </div>
        )}
        
        {/* Marketing - Operations Marketing Hub */}
        {canViewSection('crm') && (
          <div className="mb-2">
            <Link href="/operations/marketing">
              <div 
                className={cn(
                  "flex items-center px-4 py-2.5 text-sm font-medium transition-colors rounded-md mx-2",
                  location.startsWith('/operations/marketing')
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                )}
                data-testid="nav-marketing"
              >
                <Send className="w-4 h-4 mr-3 flex-shrink-0" />
                <span className="truncate">Marketing</span>
              </div>
            </Link>
          </div>
        )}
        
        {/* MarinaMatch - Direct Link (no dropdown) */}
        <div className="mb-2">
          <Link href="/marinamatch">
            <div 
              className={cn(
                "flex items-center px-4 py-2.5 text-sm font-medium transition-colors rounded-md mx-2",
                location.startsWith('/marinamatch')
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              )}
              data-testid="nav-marinamatch"
            >
              <Target className="w-4 h-4 mr-3 flex-shrink-0" />
              <span className="truncate">MarinaMatch</span>
            </div>
          </Link>
        </div>
        
        {/* Deal Workspace Section - Consolidated DD, VDR, and Modeling */}
        {canViewSection('deal_workspace') && (
          <div className="mb-2">
            <SectionHeader 
              title="Deal Workspace" 
              expanded={dealWorkspaceExpanded} 
              onToggle={() => setDealWorkspaceExpanded(!dealWorkspaceExpanded)}
              isActive={location.startsWith('/workspaces') || location === '/projects' || location === '/progress-report' || location.startsWith('/vdr') || location.startsWith('/modeling/projects')}
            />
            {dealWorkspaceExpanded && (
              <>
                {dealWorkspaceNav.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
                {/* Active Workspace Sub-navigation - shown when inside a specific workspace */}
                {activeWorkspaceId && (
                  <div className="ml-4 mt-2 border-l-2 border-blue-200 pl-2">
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
        
        {/* Underwriting Tools Section - Modeling Projects, Debt Scenarios, Exit Strategies, P&L Parser, OM Builder (all users) */}
        {canViewSection('modeling_tools') && (
          <div className="mb-2">
            <SectionHeader 
              title="Underwriting Tools" 
              expanded={underwritingToolsExpanded} 
              onToggle={() => setUnderwritingToolsExpanded(!underwritingToolsExpanded)}
              isActive={location.startsWith('/modeling/projects') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit') || location.startsWith('/om') || location.startsWith('/modeling/pnl') || location.startsWith('/modeling/settings')}
            />
            {underwritingToolsExpanded && underwritingToolsNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* Investor Services Section - Fund Management, LP Portal (GP users only via pack check) */}
        {(hasPack('fund_management') || hasPack('lp_portal')) && (
          <div className="mb-2">
            <SectionHeader 
              title="Investor Services" 
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
        
        {/* Market Intelligence Section */}
        {canViewSection('market_intelligence') && (
          <div className="mb-2">
            <SectionHeader 
              title="Market Intelligence" 
              expanded={marketIntelligenceExpanded} 
              onToggle={() => setMarketIntelligenceExpanded(!marketIntelligenceExpanded)}
              isActive={location.startsWith('/analysis/') || location.startsWith('/docktalk')}
            />
            {marketIntelligenceExpanded && (
              <div className="ml-4 mt-1 mb-2">
                {/* DockTalk - Always visible above Sales Comps */}
                <Link 
                  href="/docktalk"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors",
                    location.startsWith('/docktalk') && "bg-blue-50 border-r-3 border-blue-600 text-blue-600 font-medium"
                  )}
                  data-testid="nav-docktalk"
                >
                  <MessageSquare className={cn("w-4 h-4 mr-3 flex-shrink-0", location.startsWith('/docktalk') && "text-blue-600")} />
                  <span className="truncate">DockTalk</span>
                </Link>
                {/* Other Market Intelligence Pages - Sales Comps, Rate Comps, etc. */}
                <div>
                  {marketIntelligenceNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
      
      {/* Collapse Toggle Button */}
      <div className={cn(
        "border-t border-gray-200 bg-white flex-shrink-0 hidden md:flex",
        sidebarCollapsed ? "justify-center p-2" : "justify-end px-4 py-2"
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebarCollapse}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
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
      
      {/* User Profile - Fixed at bottom */}
      <div className={cn(
        "border-t border-gray-200 bg-white flex-shrink-0",
        sidebarCollapsed ? "p-2" : "p-4"
      )} data-testid="user-profile">
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsDialogOpen(true)}
                className="flex items-center justify-center w-full"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity">
                  <span className="text-white text-sm font-medium" data-testid="user-initials">U</span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <p>User Settings</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium" data-testid="user-initials">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate" data-testid="user-name">User</p>
              <p className="text-xs text-gray-500 truncate" data-testid="user-role">Admin</p>
            </div>
            <button 
              className="text-gray-400 hover:text-gray-600 flex-shrink-0" 
              data-testid="button-user-settings"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

        {/* App Settings Dialog */}
        <AppSettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
        />

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

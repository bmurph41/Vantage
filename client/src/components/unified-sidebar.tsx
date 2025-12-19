import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight,
  FolderKanban, Briefcase, ListTodo, ClipboardList, Calculator, Anchor, Upload, History, Send, Menu, X, AlertCircle, Fuel, CreditCard, Box, Shield, MessageSquare, LayoutList, Megaphone, DollarSign, Link2, FolderLock, Receipt, RefreshCcw, Percent, Search, Wrench, Ship, ShoppingCart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartSearch } from "@/components/crm/smart-search";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";

// CRM Navigation (Core CRM - All Users)
const crmNav = [
  { name: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { name: "Contacts", href: "/crm/contacts", icon: Users },
  { name: "Companies", href: "/crm/companies", icon: Building },
  { name: "Properties", href: "/crm/properties", icon: Home },
];

// Deal Management Navigation
const dealManagementNav = [
  { name: "Deal Workspaces", href: "/workspaces", icon: Briefcase },
  { name: "Deal Board", href: "/deal-workspace", icon: Handshake },
  { name: "Activity Log", href: "/crm/activity", icon: History },
  { name: "Follow-Ups", href: "/crm/tasks", icon: ListTodo },
  { name: "Marketing", href: "/crm/marketing-automation", icon: Send },
  { name: "Analytics", href: "/crm/analytics", icon: PieChart },
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
  { name: "All Workspaces", href: "/workspaces", icon: Briefcase },
  { name: "DD Projects", href: "/projects", icon: ClipboardList },
  { name: "Data Room", href: "/vdr", icon: FolderLock },
  { name: "Modeling Projects", href: "/modeling/projects", icon: Calculator },
];

// Deal Workspace sub-nav (shown when inside a workspace)
const getWorkspaceSubNav = (workspaceId: string) => [
  { name: "Overview", href: `/workspaces/${workspaceId}`, icon: LayoutDashboard },
  { name: "Financials", href: `/workspaces/${workspaceId}?tab=financials`, icon: Calculator },
  { name: "Diligence", href: `/workspaces/${workspaceId}?tab=diligence`, icon: ClipboardList },
  { name: "Documents", href: `/workspaces/${workspaceId}?tab=documents`, icon: FolderLock },
  { name: "Team", href: `/workspaces/${workspaceId}?tab=team`, icon: Users },
];

// Modeling Tools Navigation (standalone tools not tied to a specific deal)
const modelingToolsNav = [
  { name: "OM Builder", href: "/om", icon: FileText },
  { name: "Fund Management", href: "/modeling/funds", icon: Briefcase },
  { name: "LP Portal", href: "/modeling/lp-portal", icon: Users },
  { name: "Debt Scenarios", href: "/modeling/debt-scenarios", icon: Calculator },
  { name: "Exit Strategies", href: "/modeling/exit-strategies", icon: Target },
];

// DockTalk Navigation - Single Entry Point
const dockTalkNav = [
  { name: "DockTalk", href: "/docktalk", icon: MessageSquare },
];

// Analysis Navigation (Sales Comps)
const analysisNav = [
  { name: "Sales Comps", href: "/analysis/sales-comps", icon: BarChart3 },
  { name: "Rate Comps", href: "/analysis/rate-comps", icon: TrendingUp },
  { name: "Demographics", href: "/analysis/demographics", icon: Users },
  { name: "Capital Markets", href: "/analysis/benchmarks", icon: Target },
  { name: "Projects", href: "/analysis/projects", icon: FolderKanban },
];

type PendingItem = {
  id: string;
  status: string;
};

type PackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';

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
  const [dealManagementExpanded, setDealManagementExpanded] = useState(false);
  const [prospectingExpanded, setProspectingExpanded] = useState(false);
  const [crmToolsExpanded, setCrmToolsExpanded] = useState(false);
  const [dealWorkspaceExpanded, setDealWorkspaceExpanded] = useState(false); // Consolidated DD, VDR, Modeling
  const [modelingToolsExpanded, setModelingToolsExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'contact' | 'company' | 'deal', id: string} | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
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
      crm: ['pe_investor', 'broker', 'operator', 'advisor'], // CRM - ALL users
      deal_management: ['pe_investor', 'broker', 'operator', 'advisor'], // Deal Management - ALL users
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
    const isCrmPage = ['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location) || location.startsWith('/import-') || location === '/calendar-settings';
    const isCrmToolsPage = location === '/calendar-settings' || location.startsWith('/import-');
    const isPendingPage = location.includes('/pending-');
    // Deal Management: deal-workspace, activity, tasks, marketing-automation, analytics, forecast
    const isDealManagementPage = ['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/marketing-automation', '/crm/analytics', '/crm/forecast'].includes(location) || location.startsWith('/deal-workspace');
    // Prospecting: prospecting pages (leads are now in Deal Workspace)
    const isProspectingPage = location.startsWith('/prospecting/') || location === '/prospecting';
    // Deal Workspace: consolidated DD, VDR, and Modeling project pages
    const isDealWorkspacePage = location.startsWith('/workspaces') || location === '/projects' || location === '/progress-report' || location.startsWith('/vdr') || location.startsWith('/modeling/projects');
    // Modeling Tools: standalone tools (OM Builder, Funds, etc.) not tied to specific deals
    const isModelingToolsPage = location.startsWith('/om') || location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit');
    const isAnalysisPage = location.startsWith('/analysis/') || location.startsWith('/docktalk');

    // Set expanded states - Operations stays expanded by default, others expand when active
    if (isOperationsPage) {
      setOperationsExpanded(true);
    }
    setCrmExpanded(isCrmPage);
    setDealManagementExpanded(isDealManagementPage);
    setProspectingExpanded(isProspectingPage);
    setCrmToolsExpanded(isCrmToolsPage);
    setPendingExpanded(isPendingPage);
    setDealWorkspaceExpanded(isDealWorkspacePage);
    setModelingToolsExpanded(isModelingToolsPage);
    setAnalysisExpanded(isAnalysisPage);
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
      return (
        <div
          className="flex items-center px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed"
          data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
        >
          <item.icon className="w-4 h-4 mr-3 flex-shrink-0" />
          <span className="truncate">{item.name}</span>
        </div>
      );
    }
    
    return (
      <Link 
        key={item.name} 
        href={item.href}
        onClick={handleNavClick}
        className={cn(
          "flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors",
          isActive && "bg-blue-50 border-r-3 border-blue-600 text-blue-600 font-medium"
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
      >
        <item.icon className={cn("w-4 h-4 mr-3 flex-shrink-0", isActive && "text-blue-600")} />
        <span className="truncate">{item.name}</span>
        {item.badge && (
          <span className="ml-auto text-xs bg-blue-500 text-white rounded-full px-2 py-0.5" data-testid={`badge-${item.name.toLowerCase().replace(/ /g, '-')}`}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SectionHeader = ({ 
    title, 
    expanded, 
    onToggle,
    isActive = false
  }: { 
    title: string; 
    expanded: boolean; 
    onToggle: () => void;
    isActive?: boolean;
  }) => (
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

  return (
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
          "w-64 bg-white shadow-lg flex-shrink-0 flex flex-col h-screen",
          "fixed md:static top-0 left-0 z-50",
          "transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="unified-sidebar"
      >
        {/* Header */}
        <div className="py-4 border-b border-gray-200 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center space-x-2.5" data-testid="sidebar-logo">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                <Anchor className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 truncate">MarinaMatch</h1>
            </div>
            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-500 hover:text-gray-700 transition-colors"
              data-testid="button-close-mobile-menu"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="w-full px-4">
            <PersonaSwitcher />
          </div>
          {/* Command Palette Trigger */}
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
          {/* Quick View Search (opens drawer) */}
          <div className="w-full px-4">
            <SmartSearch 
              onResultSelect={(result) => {
                setSelectedEntity({ type: result.type, id: result.id });
                setDrawerOpen(true);
                setMobileMenuOpen(false);
              }}
            />
          </div>
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
            {operationsExpanded && operationsModulesNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* CRM Section (Core CRM - All Users) */}
        {canViewSection('crm') && (
          <div className="mb-2">
            <SectionHeader 
              title="CRM" 
              expanded={crmExpanded} 
              onToggle={() => setCrmExpanded(!crmExpanded)}
              isActive={['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location) || location.startsWith('/import-') || location === '/calendar-settings'}
            />
            {crmExpanded && crmNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
            {/* Prospecting */}
            {crmExpanded && (
              <NavLink item={{ name: "Prospecting", href: "/prospecting", icon: Target }} />
            )}
            {crmExpanded && (
              <>
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
                {/* Tools & Settings */}
                <div className="ml-4 mt-1 mb-2">
                  <button
                    onClick={() => setCrmToolsExpanded(!crmToolsExpanded)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-1.5 text-xs font-medium transition-colors rounded-lg",
                      (location === '/calendar-settings' || location.startsWith('/import-'))
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                    data-testid="toggle-tools"
                  >
                    <span>Tools & Settings</span>
                    {crmToolsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  {crmToolsExpanded && crmToolsNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Deal Management Section */}
        {canViewSection('deal_management') && (
          <div className="mb-2">
            <SectionHeader 
              title="Deal Management" 
              expanded={dealManagementExpanded} 
              onToggle={() => setDealManagementExpanded(!dealManagementExpanded)}
              isActive={['/crm/deals', '/crm/pipeline', '/crm/activity', '/crm/tasks', '/crm/marketing-automation', '/crm/analytics', '/crm/forecast'].includes(location)}
            />
            {dealManagementExpanded && dealManagementNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
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
        
        {/* Modeling Tools Section - Standalone tools not tied to specific deals */}
        {canViewSection('modeling_tools') && (
          <div className="mb-2">
            <SectionHeader 
              title="Modeling Tools" 
              expanded={modelingToolsExpanded} 
              onToggle={() => setModelingToolsExpanded(!modelingToolsExpanded)}
              isActive={location.startsWith('/om') || location.startsWith('/modeling/funds') || location.startsWith('/modeling/lp-portal') || location.startsWith('/modeling/debt-scenarios') || location.startsWith('/modeling/exit')}
            />
            {modelingToolsExpanded && modelingToolsNav
              .filter((item) => {
                if (item.href === '/modeling/funds') return hasPack('fund_management');
                if (item.href === '/modeling/lp-portal') return hasPack('fund_management') && hasPack('lp_portal');
                return true;
              })
              .map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
          </div>
        )}
        
        {/* Analysis Section */}
        {canViewSection('analysis') && (
          <div className="mb-2">
            <SectionHeader 
              title="Analysis" 
              expanded={analysisExpanded} 
              onToggle={() => setAnalysisExpanded(!analysisExpanded)}
              isActive={location.startsWith('/analysis/') || location.startsWith('/docktalk')}
            />
            {analysisExpanded && (
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
                {/* Other Analysis Pages - Sales Comps, Rate Comps, etc. */}
                <div>
                  {analysisNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
      
      {/* User Profile - Fixed at bottom */}
      <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0" data-testid="user-profile">
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
  );
}

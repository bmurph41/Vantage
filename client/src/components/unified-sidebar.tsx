import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight,
  FolderKanban, Briefcase, ListTodo, ClipboardList, Calculator, Anchor, Upload, History, Send, Menu, X, AlertCircle, Fuel, CreditCard, Box, Shield, MessageSquare, LayoutList, Megaphone, DollarSign, Link2, FolderLock, Receipt, RefreshCcw, Percent, Search
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
  { name: "Deal Workspace", href: "/deal-workspace", icon: Handshake },
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

// Operations Navigation - Fuel Sales Subcategories
const fuelSalesNav = [
  { name: "Dashboard", href: "/operations/fuel/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/operations/fuel/transactions", icon: CreditCard },
  { name: "Inventory", href: "/operations/fuel/inventory", icon: Box },
  { name: "Analytics", href: "/operations/fuel/analytics", icon: BarChart3 },
  { name: "Reports", href: "/operations/fuel/reports", icon: FileText },
  { name: "Financial Model", href: "/operations/fuel/financial-model", icon: Calculator },
  { name: "Import History", href: "/operations/fuel/import-history", icon: History },
  { name: "Audit Trail", href: "/operations/fuel/audit-trail", icon: Shield },
  { name: "Settings", href: "/operations/fuel/integration-settings", icon: Settings },
];

// Operations Navigation - Ship Store Subcategories
const shipStoreNav = [
  { name: "Dashboard", href: "/operations/ship-store/dashboard", icon: LayoutDashboard },
  { name: "Point of Sale", href: "/operations/ship-store/pos", icon: CreditCard },
  { name: "Inventory", href: "/operations/ship-store/inventory", icon: Box },
  { name: "Transactions", href: "/operations/ship-store/transactions", icon: Receipt },
  { name: "Analytics", href: "/operations/ship-store/analytics", icon: BarChart3 },
  { name: "Reports", href: "/operations/ship-store/reports", icon: FileText },
];

// Operations Navigation - Dockit (Launch Operations) Subcategories
const dockitNav = [
  { name: "Launch Control", href: "/operations/dockit", icon: LayoutDashboard },
  { name: "Launch Queue", href: "/operations/dockit/launches", icon: Calendar },
  { name: "Transient Slips", href: "/operations/dockit/slips", icon: Anchor },
];

// Operations Navigation - Rent Roll Subcategories
const rentRollNav = [
  { name: "Portfolio", href: "/operations/rent-roll/portfolio", icon: Building2 },
  { name: "Projects", href: "/operations/rent-roll/projects", icon: FolderKanban },
  { name: "Customer Analytics", href: "/operations/customer-analytics", icon: Users },
];

// Operations Navigation - Marketing Subcategories
const marketingNav = [
  { name: "Dashboard", href: "/operations/marketing/dashboard", icon: LayoutDashboard },
  { name: "Campaigns", href: "/operations/marketing/campaigns", icon: Megaphone },
  { name: "Expenses", href: "/operations/marketing/expenses", icon: DollarSign },
  { name: "Attribution", href: "/operations/marketing/attribution", icon: Link2 },
  { name: "Email Campaigns", href: "/operations/marketing/email-campaigns", icon: Mail },
  { name: "Settings", href: "/operations/marketing/settings", icon: Settings },
];

// Due Diligence Navigation
const ddNav = [
  { name: "All Projects", href: "/projects", icon: LayoutDashboard },
  { name: "Progress Report", href: "/progress-report", icon: ClipboardList },
];

// VDR Navigation
const vdrNav = [
  { name: "Data Room", href: "/vdr", icon: FolderLock },
];

// Modeling Navigation
const modelingNav = [
  { name: "Projects", href: "/modeling/projects", icon: TrendingUp },
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
  const [operationsExpanded, setOperationsExpanded] = useState(false);
  const [dockitExpanded, setDockitExpanded] = useState(false);
  const [fuelSalesExpanded, setFuelSalesExpanded] = useState(false);
  const [shipStoreExpanded, setShipStoreExpanded] = useState(false);
  const [rentRollExpanded, setRentRollExpanded] = useState(false);
  const [marketingExpanded, setMarketingExpanded] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(false);
  const [dealManagementExpanded, setDealManagementExpanded] = useState(false);
  const [prospectingExpanded, setProspectingExpanded] = useState(false);
  const [crmToolsExpanded, setCrmToolsExpanded] = useState(false);
  const [ddExpanded, setDdExpanded] = useState(false);
  const [vdrExpanded, setVdrExpanded] = useState(false);
  const [modelingExpanded, setModelingExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'contact' | 'company' | 'deal', id: string} | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

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
      due_diligence: ['pe_investor', 'broker'],
      vdr: ['pe_investor', 'broker'],
      modeling: ['pe_investor', 'advisor'],
      analysis: ['pe_investor', 'broker', 'advisor'],
    };
    
    return personas.some(p => sectionAccess[section]?.includes(p));
  };

  // Auto-expand categories based on current location
  useEffect(() => {
    // Determine which section the current page belongs to
    const isOperationsPage = location.startsWith('/operations/');
    const isDockitPage = location.startsWith('/operations/dockit');
    const isFuelSalesPage = location.startsWith('/operations/fuel/');
    const isShipStorePage = location.startsWith('/operations/ship-store/');
    const isRentRollPage = location.startsWith('/operations/rent-roll/') || location === '/operations/customer-analytics';
    const isMarketingPage = location.startsWith('/operations/marketing/');
    // CRM: contacts, companies, properties (core entity management)
    const isCrmPage = ['/crm', '/crm/contacts', '/crm/companies', '/crm/properties', '/crm/pending-contacts', '/crm/pending-companies', '/crm/pending-properties'].includes(location) || location.startsWith('/import-') || location === '/calendar-settings';
    const isCrmToolsPage = location === '/calendar-settings' || location.startsWith('/import-');
    const isPendingPage = location.includes('/pending-');
    // Deal Management: deal-workspace, activity, tasks, marketing-automation, analytics, forecast
    const isDealManagementPage = ['/deal-workspace', '/crm/activity', '/crm/tasks', '/crm/marketing-automation', '/crm/analytics', '/crm/forecast'].includes(location) || location.startsWith('/deal-workspace');
    // MarinaMatch has its own section
    const isMarinamatchPage = location.startsWith('/marinamatch');
    // Prospecting: prospecting pages (leads are now in Deal Workspace)
    const isProspectingPage = location.startsWith('/prospecting/') || location === '/prospecting';
    const isDdPage = location === '/' || location === '/progress-report';
    const isVdrPage = location.startsWith('/vdr');
    const isModelingPage = location.startsWith('/modeling/');
    const isAnalysisPage = location.startsWith('/analysis/') || location.startsWith('/docktalk');
    const isDockTalkPage = location.startsWith('/docktalk');

    // Set expanded states - only expand the active section, collapse all others
    setOperationsExpanded(isOperationsPage);
    setDockitExpanded(isDockitPage);
    setFuelSalesExpanded(isFuelSalesPage);
    setShipStoreExpanded(isShipStorePage);
    setRentRollExpanded(isRentRollPage);
    setMarketingExpanded(isMarketingPage);
    setCrmExpanded(isCrmPage);
    setDealManagementExpanded(isDealManagementPage);
    // MarinaMatch is now a direct link, no expanded state needed
    setProspectingExpanded(isProspectingPage);
    setCrmToolsExpanded(isCrmToolsPage);
    setPendingExpanded(isPendingPage);
    setDdExpanded(isDdPage);
    setVdrExpanded(isVdrPage);
    setModelingExpanded(isModelingPage);
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
        
        {/* Operations Section */}
        {canViewSection('operations') && (
          <div className="mb-2">
            <SectionHeader 
              title="Operations" 
              expanded={operationsExpanded} 
              onToggle={() => setOperationsExpanded(!operationsExpanded)}
              isActive={location.startsWith('/operations/')}
            />
            {operationsExpanded && (
            <div className="ml-4 mt-1 mb-2">
              <button
                onClick={() => setDockitExpanded(!dockitExpanded)}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.startsWith('/operations/dockit')
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                )}
                data-testid="toggle-dockit"
              >
                <div className="flex items-center space-x-3">
                  <Anchor className="w-5 h-5" />
                  <span>Dockit</span>
                </div>
                {dockitExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {dockitExpanded && (
                <div className="ml-4">
                  {dockitNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              )}
              <button
                onClick={() => setRentRollExpanded(!rentRollExpanded)}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  (location.startsWith('/operations/rent-roll/') || location === '/operations/customer-analytics')
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                )}
                data-testid="toggle-rent-roll"
              >
                <div className="flex items-center space-x-3">
                  <LayoutList className="w-5 h-5" />
                  <span>Rent Roll</span>
                </div>
                {rentRollExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {rentRollExpanded && (
                <div className="ml-4">
                  {rentRollNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              )}
              <button
                onClick={() => setFuelSalesExpanded(!fuelSalesExpanded)}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.startsWith('/operations/fuel/')
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                )}
                data-testid="toggle-fuel-sales"
              >
                <div className="flex items-center space-x-3">
                  <Fuel className="w-5 h-5" />
                  <span>Fuel Sales</span>
                </div>
                {fuelSalesExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {fuelSalesExpanded && (
                <div className="ml-4">
                  {fuelSalesNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              )}
              <button
                onClick={() => setShipStoreExpanded(!shipStoreExpanded)}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.startsWith('/operations/ship-store/')
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                )}
                data-testid="toggle-ship-store"
              >
                <div className="flex items-center space-x-3">
                  <Package className="w-5 h-5" />
                  <span>Ship Store</span>
                </div>
                {shipStoreExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {shipStoreExpanded && (
                <div className="ml-4">
                  {shipStoreNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              )}
              <button
                onClick={() => setMarketingExpanded(!marketingExpanded)}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.startsWith('/operations/marketing/')
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                )}
                data-testid="toggle-marketing"
              >
                <div className="flex items-center space-x-3">
                  <Megaphone className="w-5 h-5" />
                  <span>Marketing</span>
                </div>
                {marketingExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {marketingExpanded && (
                <div className="ml-4">
                  {marketingNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
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
        
        {/* Prospecting & Outreach Section (Premium/Broker Add-On) */}
        {canViewSection('prospecting') && hasPack('prospecting') && (
          <div className="mb-2">
            <SectionHeader 
              title="Prospecting" 
              expanded={prospectingExpanded} 
              onToggle={() => setProspectingExpanded(!prospectingExpanded)}
              isActive={location.startsWith('/prospecting/')}
            />
            {prospectingExpanded && prospectingNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* Due Diligence Section */}
        {canViewSection('due_diligence') && (
          <div className="mb-2">
            <SectionHeader 
              title="Due Diligence" 
              expanded={ddExpanded} 
              onToggle={() => setDdExpanded(!ddExpanded)}
              isActive={location === '/' || location === '/progress-report'}
            />
            {ddExpanded && ddNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* VDR Section */}
        {canViewSection('vdr') && (
          <div className="mb-2">
            <SectionHeader 
              title="Data Room" 
              expanded={vdrExpanded} 
              onToggle={() => setVdrExpanded(!vdrExpanded)}
              isActive={location.startsWith('/vdr')}
            />
            {vdrExpanded && vdrNav.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        )}
        
        {/* Modeling Section */}
        {canViewSection('modeling') && (
          <div className="mb-2">
            <SectionHeader 
              title="Modeling" 
              expanded={modelingExpanded} 
              onToggle={() => setModelingExpanded(!modelingExpanded)}
              isActive={location.startsWith('/modeling/')}
            />
            {modelingExpanded && modelingNav
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
        
        {/* Market Intel Section */}
        {canViewSection('analysis') && (
          <div className="mb-2">
            <SectionHeader 
              title="Market Intel" 
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

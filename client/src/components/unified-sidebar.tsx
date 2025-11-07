import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight,
  FolderKanban, Briefcase, ListTodo, ClipboardList, Calculator, Anchor, Upload, History, Send, Menu, X, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartSearch } from "@/components/crm/smart-search";
import { DetailDrawer } from "@/components/crm/detail-drawer";

// CRM Navigation
const crmNav = [
  { name: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { name: "Pipeline", href: "/crm/pipeline", icon: Layers },
  { name: "Deals", href: "/crm/deals", icon: Handshake },
  { name: "Leads", href: "/crm/leads", icon: UserCheck },
  { name: "Contacts", href: "/crm/contacts", icon: Users },
  { name: "Companies", href: "/crm/companies", icon: Building },
  { name: "Properties", href: "/crm/properties", icon: Home },
  { name: "Activities", href: "/crm/activities", icon: Calendar },
  { name: "Prospecting", href: "/crm/prospecting", icon: Target },
  { name: "Marketing", href: "/crm/marketing-automation", icon: Send },
  { name: "Analytics", href: "/crm/analytics", icon: PieChart },
  { name: "Forecast", href: "/crm/forecast", icon: TrendingUp },
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

// Due Diligence Navigation
const ddNav = [
  { name: "All Projects", href: "/", icon: LayoutDashboard },
  { name: "Progress Report", href: "/progress-report", icon: ClipboardList },
];

// Modeling Navigation (placeholder for future)
const modelingNav = [
  { name: "Coming Soon", href: "#", icon: Calculator, disabled: true },
];

// Analysis Navigation (Sales Comps)
const analysisNav = [
  { name: "Sales Comps", href: "/analysis/sales-comps", icon: BarChart3 },
  { name: "Projects", href: "/analysis/projects", icon: FolderKanban },
  { name: "Rate Comps", href: "/analysis/rate-comps", icon: TrendingUp },
  { name: "Demographics", href: "/analysis/demographics", icon: Users },
];

type PendingProperty = {
  id: string;
  status: string;
};

export default function UnifiedSidebar() {
  const [location] = useLocation();
  const [crmExpanded, setCrmExpanded] = useState(false);
  const [crmToolsExpanded, setCrmToolsExpanded] = useState(false);
  const [ddExpanded, setDdExpanded] = useState(false);
  const [modelingExpanded, setModelingExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{type: 'contact' | 'company' | 'deal', id: string} | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch pending properties count
  const { data: pendingProperties = [] } = useQuery<PendingProperty[]>({
    queryKey: ['/api/pending-properties'],
    refetchInterval: 60000, // Refresh every minute
  });

  const pendingCount = pendingProperties.filter(p => p.status === 'pending').length;

  // Create dynamic CRM navigation with pending properties badge
  // Properties is at index 6 in crmNav
  const dynamicCrmNav = [
    ...crmNav.slice(0, 7), // Includes Properties at index 6
    ...(pendingCount > 0 ? [{ 
      name: "Pending Properties", 
      href: "/crm/pending-properties", 
      icon: AlertCircle,
      badge: String(pendingCount)
    }] : []),
    ...crmNav.slice(7), // Everything after Properties (Activities, Prospecting, etc.)
  ];

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const NavLink = ({ item }: { item: { name: string; href: string; icon: any; badge?: string; disabled?: boolean } }) => {
    const isActive = location === item.href;
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
    onToggle 
  }: { 
    title: string; 
    expanded: boolean; 
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors"
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
        <div className="px-3 py-4 border-b border-gray-200 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between px-1">
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
          <div className="w-full">
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
      <nav className="flex-1 overflow-y-auto py-4">
        {/* CRM Section */}
        <div className="mb-2">
          <SectionHeader 
            title="CRM" 
            expanded={crmExpanded} 
            onToggle={() => setCrmExpanded(!crmExpanded)} 
          />
          {crmExpanded && dynamicCrmNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
          {crmExpanded && (
            <div className="ml-4 mt-1 mb-2">
              <button
                onClick={() => setCrmToolsExpanded(!crmToolsExpanded)}
                className="flex items-center justify-between w-full px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                data-testid="toggle-tools"
              >
                <span>Tools & Settings</span>
                {crmToolsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {crmToolsExpanded && crmToolsNav.map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
            </div>
          )}
        </div>
        
        {/* Due Diligence Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Due Diligence" 
            expanded={ddExpanded} 
            onToggle={() => setDdExpanded(!ddExpanded)} 
          />
          {ddExpanded && ddNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
        
        {/* Modeling Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Modeling" 
            expanded={modelingExpanded} 
            onToggle={() => setModelingExpanded(!modelingExpanded)} 
          />
          {modelingExpanded && modelingNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
        
        {/* Analysis Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Analysis" 
            expanded={analysisExpanded} 
            onToggle={() => setAnalysisExpanded(!analysisExpanded)} 
          />
          {analysisExpanded && analysisNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
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
          <button className="text-gray-400 hover:text-gray-600 flex-shrink-0" data-testid="button-user-settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
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
  );
}

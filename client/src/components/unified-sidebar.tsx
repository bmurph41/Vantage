import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight,
  FolderKanban, Briefcase, ListTodo, ClipboardList, Calculator, Anchor
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { name: "Analytics", href: "/crm/analytics", icon: PieChart },
  { name: "Forecast", href: "/crm/forecast", icon: TrendingUp },
];

// CRM Tools Submenu
const crmToolsNav = [
  { name: "Labels", href: "/crm/labels", icon: Tag },
  { name: "Products", href: "/crm/products", icon: Package },
  { name: "Forms", href: "/crm/forms", icon: FileText },
  { name: "Workflows", href: "/crm/workflows", icon: Bot },
  { name: "Webhooks", href: "/crm/webhooks", icon: Webhook },
  { name: "Dedupe & Merge", href: "/crm/dedupe", icon: GitMerge },
  { name: "Scoring", href: "/crm/scoring", icon: Target },
];

// Due Diligence Navigation
const ddNav = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "All Projects", href: "/projects/summary", icon: FileText },
  { name: "Progress Report", href: "/progress-report", icon: ClipboardList },
];

// Modeling Navigation (placeholder for future)
const modelingNav = [
  { name: "Coming Soon", href: "#", icon: Calculator, disabled: true },
];

// Comps Navigation (placeholder for future)
const compsNav = [
  { name: "Coming Soon", href: "#", icon: BarChart3, disabled: true },
];

export default function UnifiedSidebar() {
  const [location] = useLocation();
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [crmToolsExpanded, setCrmToolsExpanded] = useState(false);
  const [ddExpanded, setDdExpanded] = useState(false);
  const [modelingExpanded, setModelingExpanded] = useState(false);
  const [compsExpanded, setCompsExpanded] = useState(false);

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
    <div className="w-64 bg-white shadow-lg flex-shrink-0 flex flex-col h-screen" data-testid="unified-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-2.5" data-testid="sidebar-logo">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <Anchor className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 truncate">MarinaMatch</h1>
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
          {crmExpanded && crmNav.map((item) => (
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
        
        {/* Comps Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Comps" 
            expanded={compsExpanded} 
            onToggle={() => setCompsExpanded(!compsExpanded)} 
          />
          {compsExpanded && compsNav.map((item) => (
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
    </div>
  );
}

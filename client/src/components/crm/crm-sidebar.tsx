import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, Users, Building, Handshake, Calendar, 
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText, Target, Home, Tag, Package, Webhook, GitMerge, ChevronDown, ChevronRight, ArrowLeft, Archive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const coreNav = [
  { name: "Sales Pipeline", href: "/crm/pipeline", icon: Layers },
  { name: "Deals", href: "/crm/deals", icon: Handshake },
  { name: "Activities", href: "/crm/activities", icon: Calendar },
];

const crmNav = [
  { name: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { name: "Leads", href: "/crm/leads", icon: UserCheck },
  { name: "Contacts", href: "/crm/contacts", icon: Users },
  { name: "Companies", href: "/crm/companies", icon: Building },
  { name: "Properties", href: "/crm/properties", icon: Home },
];

const toolsNav = [
  { name: "Prospecting", href: "/crm/prospecting", icon: Target },
  { name: "Labels", href: "/crm/labels", icon: Tag },
  { name: "Products", href: "/crm/products", icon: Package },
  { name: "Forms", href: "/crm/forms", icon: FileText },
];

const automationNav = [
  { name: "Workflows", href: "/crm/workflows", icon: Bot },
  { name: "Webhooks", href: "/crm/webhooks", icon: Webhook },
  { name: "Dedupe & Merge", href: "/crm/dedupe", icon: GitMerge },
  { name: "Archive", href: "/crm/archive", icon: Archive },
];

const reportingNav = [
  { name: "Lead Scoring", href: "/crm/scoring", icon: Target },
  { name: "Analytics", href: "/crm/analytics", icon: PieChart },
  { name: "Forecast", href: "/crm/forecast", icon: TrendingUp },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [automationExpanded, setAutomationExpanded] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);

  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const userRole = user?.role || 'Team Member';

  const NavLink = ({ item }: { item: { name: string; href: string; icon: any; badge?: string } }) => {
    const isActive = location === item.href;
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
    <div className="w-64 bg-white shadow-lg flex-shrink-0 flex flex-col h-screen" data-testid="sidebar">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-2.5 mb-3" data-testid="sidebar-logo">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 truncate">MarinaMatchCRM</h1>
        </div>
        <Link href="/" className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors" data-testid="link-back-to-dd">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to DD Tracker
        </Link>
      </div>
      
      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Core Section */}
        <div className="mb-4">
          {coreNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
        
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
        </div>
        
        {/* Tools Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Tools" 
            expanded={toolsExpanded} 
            onToggle={() => setToolsExpanded(!toolsExpanded)} 
          />
          {toolsExpanded && toolsNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
        
        {/* Automation Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Automation" 
            expanded={automationExpanded} 
            onToggle={() => setAutomationExpanded(!automationExpanded)} 
          />
          {automationExpanded && automationNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
        
        {/* Reports Section */}
        <div className="mb-2">
          <SectionHeader 
            title="Reports" 
            expanded={reportsExpanded} 
            onToggle={() => setReportsExpanded(!reportsExpanded)} 
          />
          {reportsExpanded && reportingNav.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
      </nav>
      
      {/* User Profile - Fixed at bottom */}
      <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0" data-testid="user-profile">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium" data-testid="user-initials">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" data-testid="user-name">{userName}</p>
            <p className="text-xs text-gray-500 truncate" data-testid="user-role">{userRole}</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 flex-shrink-0" data-testid="button-user-settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

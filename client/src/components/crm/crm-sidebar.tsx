import { useState } from "react";
import { useState } from 'react';
import { CommandPalette, useCommandPaletteShortcut } from '@/components/CommandPalette';

import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Users, Building, Handshake, Calendar,
  Bot, Bell, Mail, PieChart, TrendingUp, Settings,
  LayoutDashboard, Layers, UserCheck, Building2, FileText,
  Target, Home, Tag, Package, Webhook, GitMerge,
  ChevronDown, ChevronRight, ArrowLeft, Archive, Brain,
  Plus, Search, Flame, CheckSquare, Activity, FolderKanban,
  Briefcase, DollarSign, Clock, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Nav Config ──────────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

const coreNav: NavItem[] = [
  { name: "Deal Workspace", href: "/deal-workspace",  icon: FolderKanban, description: "Unified deal management" },
  { name: "Sales Pipeline", href: "/crm/pipeline",    icon: Layers,       description: "Kanban pipeline view" },
  { name: "Deals",          href: "/crm/deals",       icon: Handshake,    description: "All deal records" },
  { name: "Activities",     href: "/crm/activities",  icon: Calendar,     description: "Calls, meetings, tasks" },
  { name: "Tasks",          href: "/crm/tasks",       icon: CheckSquare,  description: "Task board" },
];

const crmNav: NavItem[] = [
  { name: "Dashboard",  href: "/crm",            icon: LayoutDashboard },
  { name: "Leads",      href: "/crm/leads",       icon: UserCheck },
  { name: "Contacts",   href: "/crm/contacts",    icon: Users },
  { name: "Companies",  href: "/crm/companies",   icon: Building },
  { name: "Properties", href: "/crm/properties",  icon: Home },
];

const toolsNav: NavItem[] = [
  { name: "Prospecting",   href: "/crm/prospecting", icon: Target },
  { name: "Labels",        href: "/crm/labels",      icon: Tag },
  { name: "Products",      href: "/crm/products",    icon: Package },
  { name: "Forms",         href: "/crm/forms",       icon: FileText },
];

const automationNav: NavItem[] = [
  { name: "Workflows",     href: "/crm/workflows",   icon: Bot },
  { name: "Webhooks",      href: "/crm/webhooks",    icon: Webhook },
  { name: "Dedupe & Merge", href: "/crm/dedupe",     icon: GitMerge },
  { name: "Archive",       href: "/crm/archive",     icon: Archive },
];

const reportingNav: NavItem[] = [
  { name: "Pipeline Insights", href: "/crm/pipeline-insights", icon: Brain },
  { name: "Lead Scoring",      href: "/crm/scoring",           icon: Target },
  { name: "Analytics",         href: "/crm/analytics",         icon: PieChart },
  { name: "Forecast",          href: "/crm/forecast",          icon: TrendingUp },
];

// ─── Sidebar Component ───────────────────────────────────────────────

export default function CrmSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [automationExpanded, setAutomationExpanded] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);

  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const userRole = user?.role || 'Team Member';

  // Fetch counts for badges
  const { data: dealsData } = useQuery({ queryKey: ['/api/crm/deals'] });
  const { data: leadsData } = useQuery({ queryKey: ['/api/crm/leads'] });
  const { data: activitiesData } = useQuery({ queryKey: ['/api/crm/activities'] });

  const deals = Array.isArray(dealsData) ? dealsData : (dealsData as any)?.deals || [];
  const leads = Array.isArray(leadsData) ? leadsData : (leadsData as any)?.leads || [];
  const activities = Array.isArray(activitiesData) ? activitiesData : (activitiesData as any)?.activities || [];

  // Compute badge counts
  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length;
  const hotLeads = leads.filter((l: any) => l.leadStatus === 'hot' || (Number(l.score) || 0) >= 70).length;
  const overdueActivities = activities.filter((a: any) => {
    if (!a.dueDate || a.completed) return false;
    try { return new Date(a.dueDate) < new Date(); } catch { return false; }
  }).length;

  // ── NavLink Component ──
  const NavLink = ({ item, compact = false }: { item: NavItem; compact?: boolean }) => {
    const isActive = location === item.href || (item.href !== '/crm' && location.startsWith(item.href));
    const Icon = item.icon;

    
  const [commandOpen, setCommandOpen] = useState(false);
  useCommandPaletteShortcut(() => setCommandOpen(true));

return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center px-3 py-2 text-sm rounded-lg mx-2 transition-all duration-150",
          isActive
            ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
      >
        <Icon className={cn("w-4 h-4 mr-3 flex-shrink-0", isActive ? "text-blue-600" : "text-gray-400")} />
        <span className="truncate flex-1">{item.name}</span>
        {item.badge && (
          <Badge
            variant="secondary"
            className={cn(
              "ml-auto text-[10px] h-5 px-1.5 min-w-[20px] justify-center",
              item.badgeColor || (isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600")
            )}
          >
            {item.badge}
          </Badge>
        )}
      </Link>
    );
  };

  // ── Section Header ──
  const SectionHeader = ({
    title, expanded, onToggle, count,
  }: {
    title: string; expanded: boolean; onToggle: () => void; count?: number;
  }) => (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
      data-testid={`toggle-${title.toLowerCase()}`}
    >
      <span>{title}</span>
      <div className="flex items-center gap-1.5">
        {count != null && count > 0 && (
          <span className="text-[10px] font-normal text-gray-400">{count}</span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </div>
    </button>
  );

  // Inject live counts into nav items
  const coreNavWithBadges = coreNav.map(item => {
    if (item.name === 'Deals')      return { ...item, badge: activeDeals > 0 ? String(activeDeals) : undefined };
    if (item.name === 'Activities') return {
      ...item,
      badge: overdueActivities > 0 ? String(overdueActivities) : undefined,
      badgeColor: overdueActivities > 0 ? "bg-red-100 text-red-600" : undefined,
    };
    return item;
  });

  const crmNavWithBadges = crmNav.map(item => {
    if (item.name === 'Leads') return {
      ...item,
      badge: hotLeads > 0 ? String(hotLeads) : undefined,
      badgeColor: hotLeads > 0 ? "bg-orange-100 text-orange-600" : undefined,
    };
    return item;
  });

  return (
    <div className="w-60 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col h-screen" data-testid="sidebar">
      {/* ── Header ── */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <Building2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">Vantage</h1>
            <p className="text-[10px] text-gray-400 font-medium">CRM & Deal Platform</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center text-xs text-blue-600 hover:text-blue-700 transition-colors mt-1"
          data-testid="link-back-to-dd"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to DD Tracker
        </Link>
      </div>

      {/* ── Quick Add ── */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex gap-1.5">
          <TooltipProvider>
            {[
              { label: "New Deal", href: "/crm/deals", icon: DollarSign, color: "text-green-600 hover:bg-green-50" },
              { label: "New Lead", href: "/crm/leads", icon: TrendingUp, color: "text-blue-600 hover:bg-blue-50" },
              { label: "New Contact", href: "/crm/contacts", icon: Users, color: "text-purple-600 hover:bg-purple-50" },
            ].map(action => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Link href={action.href}>
                    <Button variant="ghost" size="sm" className={cn("h-8 w-full flex-1 text-xs gap-1.5", action.color)}>
                      <Plus className="w-3.5 h-3.5" />
                      <action.icon className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* ── Scrollable Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3">
        {/* Core Section */}
        <div className="mb-3">
          <p className="px-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Core</p>
          {coreNavWithBadges.map(item => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>

        <Separator className="mx-4 mb-2" />

        {/* CRM Section */}
        <div className="mb-1">
          <SectionHeader
            title="CRM"
            expanded={crmExpanded}
            onToggle={() => setCrmExpanded(!crmExpanded)}
          />
          {crmExpanded && crmNavWithBadges.map(item => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>

        {/* Tools Section */}
        <div className="mb-1">
          <SectionHeader
            title="Tools"
            expanded={toolsExpanded}
            onToggle={() => setToolsExpanded(!toolsExpanded)}
          />
          {toolsExpanded && toolsNav.map(item => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>

        {/* Automation Section */}
        <div className="mb-1">
          <SectionHeader
            title="Automation"
            expanded={automationExpanded}
            onToggle={() => setAutomationExpanded(!automationExpanded)}
          />
          {automationExpanded && automationNav.map(item => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>

        {/* Reports Section */}
        <div className="mb-1">
          <SectionHeader
            title="Reports"
            expanded={reportsExpanded}
            onToggle={() => setReportsExpanded(!reportsExpanded)}
          />
          {reportsExpanded && reportingNav.map(item => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>
      </nav>

      {/* ── User Profile ── */}
      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0" data-testid="user-profile">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold" data-testid="user-initials">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" data-testid="user-name">{userName}</p>
            <p className="text-[10px] text-gray-500 truncate" data-testid="user-role">{userRole}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-600" data-testid="button-user-settings">
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

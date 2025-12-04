import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Anchor, LayoutDashboard, Users, Briefcase, Target, Settings as SettingsIcon, FolderKanban, FolderLock, TrendingUp, MessageSquare, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isDynamic?: boolean;
  dynamicType?: 'modeling-project' | 'fund';
  dynamicId?: string;
}

const DASHBOARD_ITEM: BreadcrumbItem = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard };

const CATEGORIES = {
  CRM: { label: 'CRM', href: '/crm', icon: Users },
  DEAL_MANAGEMENT: { label: 'Deal Management', href: '/deal-workspace', icon: Briefcase },
  PROSPECTING: { label: 'Prospecting', href: '/prospecting', icon: Target },
  OPERATIONS: { label: 'Operations', icon: SettingsIcon },
  DUE_DILIGENCE: { label: 'Due Diligence', href: '/projects', icon: FolderKanban },
  VDR: { label: 'VDR', href: '/vdr', icon: FolderLock },
  MODELING: { label: 'Modeling', href: '/modeling/projects', icon: TrendingUp },
  DOCKTALK: { label: 'DockTalk', href: '/docktalk', icon: MessageSquare },
  ANALYSIS: { label: 'Analysis', href: '/analysis/sales-comps', icon: BarChart3 },
  MARINAMATCH: { label: 'MarinaMatch', href: '/marinamatch', icon: Target },
};

const ROUTE_MAPPINGS: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [],
  
  '/projects': [
    CATEGORIES.DUE_DILIGENCE,
    { label: 'All Projects' },
  ],
  '/projects/summary': [
    CATEGORIES.DUE_DILIGENCE,
    { label: 'Summary' },
  ],
  '/dd/projects': [
    CATEGORIES.DUE_DILIGENCE,
    { label: 'Projects' },
  ],
  '/progress-report': [
    CATEGORIES.DUE_DILIGENCE,
    { label: 'Progress Report' },
  ],
  
  '/crm': [
    CATEGORIES.CRM,
    { label: 'Dashboard' },
  ],
  '/crm/contacts': [
    CATEGORIES.CRM,
    { label: 'Contacts' },
  ],
  '/crm/companies': [
    CATEGORIES.CRM,
    { label: 'Companies' },
  ],
  '/crm/properties': [
    CATEGORIES.CRM,
    { label: 'Properties' },
  ],
  '/crm/leads': [
    CATEGORIES.CRM,
    { label: 'Leads' },
  ],
  '/crm/deals': [
    CATEGORIES.CRM,
    { label: 'Deals' },
  ],
  '/crm/pipeline': [
    CATEGORIES.CRM,
    { label: 'Pipeline' },
  ],
  
  '/deal-workspace': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Workspace' },
  ],
  '/crm/activity': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Activity Log' },
  ],
  '/crm/tasks': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Follow-Ups' },
  ],
  '/crm/marketing-automation': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Marketing' },
  ],
  '/crm/analytics': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Analytics' },
  ],
  '/crm/forecast': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Forecast' },
  ],
  '/crm/marketing': [
    CATEGORIES.DEAL_MANAGEMENT,
    { label: 'Marketing Automation' },
  ],
  
  '/prospecting': [
    CATEGORIES.PROSPECTING,
    { label: 'Dashboard' },
  ],
  '/prospecting/board': [
    CATEGORIES.PROSPECTING,
    { label: 'Board' },
  ],
  '/prospecting/markets': [
    CATEGORIES.PROSPECTING,
    { label: 'Market Targets' },
  ],
  '/prospecting/campaigns': [
    CATEGORIES.PROSPECTING,
    { label: 'Campaigns' },
  ],
  '/prospecting/analytics': [
    CATEGORIES.PROSPECTING,
    { label: 'Analytics' },
  ],
  
  '/modeling/projects': [
    CATEGORIES.MODELING,
    { label: 'Projects' },
  ],
  '/modeling/portfolio': [
    CATEGORIES.MODELING,
    { label: 'Portfolio' },
  ],
  '/modeling/debt-scenarios': [
    CATEGORIES.MODELING,
    { label: 'Debt Scenarios' },
  ],
  '/modeling/exit-strategies': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategies' },
  ],
  '/modeling/exit': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy' },
  ],
  '/modeling/exit/scenarios': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Scenarios' },
  ],
  '/modeling/exit/tax': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Tax Calculator' },
  ],
  '/modeling/exit/net-proceeds': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Net Proceeds' },
  ],
  '/modeling/exit/1031': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: '1031 Exchange' },
  ],
  '/modeling/exit/dst': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'DST Analysis' },
  ],
  '/modeling/exit/seller-financing': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Seller Financing' },
  ],
  '/modeling/exit/earnout': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Earnout' },
  ],
  '/modeling/exit/waterfall': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Waterfall' },
  ],
  '/modeling/exit/irr': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'IRR Calculator' },
  ],
  '/modeling/exit/sensitivity': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Sensitivity' },
  ],
  '/modeling/exit/ai-insights': [
    CATEGORIES.MODELING,
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'AI Insights' },
  ],
  '/modeling/doc-intel': [
    CATEGORIES.MODELING,
    { label: 'Document Intelligence' },
  ],
  '/modeling/settings': [
    CATEGORIES.MODELING,
    { label: 'Settings' },
  ],
  '/modeling/funds': [
    CATEGORIES.MODELING,
    { label: 'Fund Management' },
  ],
  '/modeling/lp-portal': [
    CATEGORIES.MODELING,
    { label: 'LP Portal' },
  ],
  
  '/analysis/sales-comps': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps' },
  ],
  '/analysis/sales-comps/analytics': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Analytics' },
  ],
  '/analysis/sales-comps/upload': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Upload' },
  ],
  '/analysis/sales-comps/compare': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Compare' },
  ],
  '/analysis/sales-comps/bulk-edit': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Bulk Edit' },
  ],
  '/analysis/sales-comps/columns': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Column Manager' },
  ],
  '/analysis/sales-comps/projects': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Projects' },
  ],
  '/analysis/sales-comps/pending-profiles': [
    CATEGORIES.ANALYSIS,
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Pending Profiles' },
  ],
  '/analysis/rate-comps': [
    CATEGORIES.ANALYSIS,
    { label: 'Rate Comps' },
  ],
  '/analysis/rate-comps/analytics': [
    CATEGORIES.ANALYSIS,
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Analytics' },
  ],
  '/analysis/rate-comps/upload': [
    CATEGORIES.ANALYSIS,
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Upload' },
  ],
  '/analysis/rate-comps/compare': [
    CATEGORIES.ANALYSIS,
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Compare' },
  ],
  '/analysis/rate-comps/bulk-edit': [
    CATEGORIES.ANALYSIS,
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Bulk Edit' },
  ],
  '/analysis/rate-comps/columns': [
    CATEGORIES.ANALYSIS,
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Column Manager' },
  ],
  '/analysis/demographics': [
    CATEGORIES.ANALYSIS,
    { label: 'Demographics' },
  ],
  '/analysis/benchmarks': [
    CATEGORIES.ANALYSIS,
    { label: 'Capital Markets' },
  ],
  '/analysis/projects': [
    CATEGORIES.ANALYSIS,
    { label: 'Projects' },
  ],
  
  '/operations/dockit': [
    CATEGORIES.OPERATIONS,
    { label: 'Launch Operations', icon: Anchor },
  ],
  '/operations/dockit/launches': [
    CATEGORIES.OPERATIONS,
    { label: 'Launch Operations', href: '/operations/dockit', icon: Anchor },
    { label: 'Launch Queue' },
  ],
  '/operations/dockit/slips': [
    CATEGORIES.OPERATIONS,
    { label: 'Launch Operations', href: '/operations/dockit', icon: Anchor },
    { label: 'Transient Slips' },
  ],
  
  '/operations/fuel/dashboard': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock' },
  ],
  '/operations/fuel/transactions': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Transactions' },
  ],
  '/operations/fuel/inventory': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Inventory' },
  ],
  '/operations/fuel/analytics': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Analytics' },
  ],
  '/operations/fuel/reports': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Reports' },
  ],
  '/operations/fuel/financial-model': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Financial Model' },
  ],
  '/operations/fuel/import-history': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Import History' },
  ],
  '/operations/fuel/audit-trail': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Audit Trail' },
  ],
  '/operations/fuel/integration-settings': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/operations/fuel/dashboard' },
    { label: 'Settings' },
  ],
  
  '/fuel': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock' },
  ],
  '/fuel/transactions': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Transactions' },
  ],
  '/fuel/inventory': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Inventory' },
  ],
  '/fuel/analytics': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Analytics' },
  ],
  '/fuel/reports': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Reports' },
  ],
  '/fuel/model': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Financial Model' },
  ],
  '/fuel/settings': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Settings' },
  ],
  '/fuel/import-history': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Import History' },
  ],
  '/fuel/audit': [
    CATEGORIES.OPERATIONS,
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Audit Trail' },
  ],
  
  '/operations/ship-store/dashboard': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store' },
  ],
  '/operations/ship-store/pos': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/operations/ship-store/dashboard' },
    { label: 'Point of Sale' },
  ],
  '/operations/ship-store/inventory': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/operations/ship-store/dashboard' },
    { label: 'Inventory' },
  ],
  '/operations/ship-store/transactions': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/operations/ship-store/dashboard' },
    { label: 'Transactions' },
  ],
  '/operations/ship-store/analytics': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/operations/ship-store/dashboard' },
    { label: 'Analytics' },
  ],
  '/operations/ship-store/reports': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/operations/ship-store/dashboard' },
    { label: 'Reports' },
  ],
  
  '/ship-store': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store' },
  ],
  '/ship-store/pos': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Point of Sale' },
  ],
  '/ship-store/inventory': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Inventory' },
  ],
  '/ship-store/transactions': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Transactions' },
  ],
  '/ship-store/checkout': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Checkout' },
  ],
  '/ship-store/analytics': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Analytics' },
  ],
  '/ship-store/reports': [
    CATEGORIES.OPERATIONS,
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Reports' },
  ],
  
  '/operations/rent-roll/portfolio': [
    CATEGORIES.OPERATIONS,
    { label: 'Rent Roll' },
  ],
  '/operations/rent-roll/projects': [
    CATEGORIES.OPERATIONS,
    { label: 'Rent Roll', href: '/operations/rent-roll/portfolio' },
    { label: 'Projects' },
  ],
  '/operations/customer-analytics': [
    CATEGORIES.OPERATIONS,
    { label: 'Customer Analytics' },
  ],
  
  '/rent-roll': [
    CATEGORIES.OPERATIONS,
    { label: 'Rent Roll' },
  ],
  '/rent-roll/customers': [
    CATEGORIES.OPERATIONS,
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Customer Analytics' },
  ],
  '/rent-roll/portfolio': [
    CATEGORIES.OPERATIONS,
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Portfolio' },
  ],
  '/rent-roll/projects': [
    CATEGORIES.OPERATIONS,
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Projects' },
  ],
  
  '/operations/marketing/dashboard': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing' },
  ],
  '/operations/marketing/campaigns': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/operations/marketing/dashboard' },
    { label: 'Campaigns' },
  ],
  '/operations/marketing/expenses': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/operations/marketing/dashboard' },
    { label: 'Expenses' },
  ],
  '/operations/marketing/attribution': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/operations/marketing/dashboard' },
    { label: 'Attribution' },
  ],
  '/operations/marketing/email-campaigns': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/operations/marketing/dashboard' },
    { label: 'Email Campaigns' },
  ],
  '/operations/marketing/settings': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/operations/marketing/dashboard' },
    { label: 'Settings' },
  ],
  
  '/marketing': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing' },
  ],
  '/marketing/campaigns': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/marketing' },
    { label: 'Campaigns' },
  ],
  '/marketing/expenses': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/marketing' },
    { label: 'Expenses' },
  ],
  '/marketing/attribution': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/marketing' },
    { label: 'Attribution' },
  ],
  '/marketing/email': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/marketing' },
    { label: 'Email Campaigns' },
  ],
  '/marketing/settings': [
    CATEGORIES.OPERATIONS,
    { label: 'Marketing', href: '/marketing' },
    { label: 'Settings' },
  ],
  
  '/vdr': [
    CATEGORIES.VDR,
    { label: 'Data Room' },
  ],
  '/vdr/data-request': [
    CATEGORIES.VDR,
    { label: 'Data Room', href: '/vdr' },
    { label: 'Data Request' },
  ],
  
  '/docktalk': [
    CATEGORIES.DOCKTALK,
    { label: 'News Feed' },
  ],
  '/docktalk/feed': [
    CATEGORIES.DOCKTALK,
    { label: 'News Feed' },
  ],
  '/docktalk/deals': [
    CATEGORIES.DOCKTALK,
    { label: 'M&A Deals' },
  ],
  '/docktalk/sources': [
    CATEGORIES.DOCKTALK,
    { label: 'Sources' },
  ],
  '/docktalk/training': [
    CATEGORIES.DOCKTALK,
    { label: 'AI Training' },
  ],
  
  '/marinamatch': [
    CATEGORIES.MARINAMATCH,
    { label: 'Overview' },
  ],
  '/marinamatch/intel': [
    CATEGORIES.MARINAMATCH,
    { label: 'Market Intel' },
  ],
  
  '/user/settings': [
    { label: 'User Settings' },
  ],
  '/audit-logs': [
    { label: 'Audit Logs' },
  ],
  '/marina-database': [
    { label: 'Marina Database' },
  ],
  '/calendar-settings': [
    CATEGORIES.CRM,
    { label: 'Calendar Sync' },
  ],
  '/import-contacts': [
    CATEGORIES.CRM,
    { label: 'Import Contacts' },
  ],
  '/import-history': [
    CATEGORIES.CRM,
    { label: 'Import History' },
  ],
};

function getBreadcrumbsForPath(path: string): BreadcrumbItem[] {
  let items: BreadcrumbItem[] = [];

  const modelingProjectMatch = path.match(/^\/modeling\/projects\/([a-f0-9-]+)(\/.*)?$/i);
  if (modelingProjectMatch) {
    const projectId = modelingProjectMatch[1];
    const subPath = modelingProjectMatch[2] || '';
    
    items = [
      CATEGORIES.MODELING,
      { label: 'Projects', href: '/modeling/projects' },
      { label: projectId, isDynamic: true, dynamicType: 'modeling-project', dynamicId: projectId },
    ];
    
    if (subPath) {
      const subSegments = subPath.split('/').filter(Boolean);
      subSegments.forEach(seg => {
        const formattedLabel = seg
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        items.push({ label: formattedLabel });
      });
    }
    
    return [DASHBOARD_ITEM, ...items];
  }

  const fundMatch = path.match(/^\/modeling\/funds\/([a-f0-9-]+)(\/.*)?$/i);
  if (fundMatch) {
    const fundId = fundMatch[1];
    const subPath = fundMatch[2] || '';
    
    items = [
      CATEGORIES.MODELING,
      { label: 'Fund Management', href: '/modeling/funds' },
      { label: fundId, isDynamic: true, dynamicType: 'fund', dynamicId: fundId },
    ];
    
    if (subPath) {
      const subSegments = subPath.split('/').filter(Boolean);
      subSegments.forEach(seg => {
        const formattedLabel = seg
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        items.push({ label: formattedLabel });
      });
    }
    
    return [DASHBOARD_ITEM, ...items];
  }

  if (ROUTE_MAPPINGS[path]) {
    items = ROUTE_MAPPINGS[path];
  } else {
    for (const [pattern, mappedItems] of Object.entries(ROUTE_MAPPINGS)) {
      const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(path)) {
        items = mappedItems;
        break;
      }
    }

    if (items.length === 0) {
      const segments = path.split('/').filter(Boolean);
      
      if (segments.length >= 2) {
        const parentPath = '/' + segments.slice(0, -1).join('/');
        const parentBreadcrumbs = ROUTE_MAPPINGS[parentPath];
        if (parentBreadcrumbs) {
          const lastSegment = segments[segments.length - 1];
          const formattedLabel = lastSegment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          if (parentBreadcrumbs.length > 0) {
            items = [...parentBreadcrumbs.slice(0, -1), { ...parentBreadcrumbs[parentBreadcrumbs.length - 1], href: parentPath }, { label: formattedLabel }];
          } else {
            items = [{ label: formattedLabel }];
          }
        }
      }

      if (items.length === 0 && path.split('/').filter(Boolean).length > 0) {
        const segments = path.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        items = [{ label: lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, ' ') }];
      }
    }
  }

  if (items.length > 0) {
    return [DASHBOARD_ITEM, ...items];
  }

  return [];
}

function DynamicBreadcrumbItem({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  const { data: project } = useQuery<{ marinaName: string }>({
    queryKey: ['/api/modeling/projects', item.dynamicId],
    enabled: item.dynamicType === 'modeling-project' && !!item.dynamicId,
  });
  
  const { data: fund } = useQuery<{ name: string }>({
    queryKey: ['/api/funds', item.dynamicId],
    enabled: item.dynamicType === 'fund' && !!item.dynamicId,
  });
  
  const displayLabel = item.dynamicType === 'fund' 
    ? (fund?.name || item.label) 
    : (project?.marinaName || item.label);
  const Icon = item.icon;
  
  if (isLast) {
    return (
      <span
        className={cn(
          'flex items-center gap-1.5 text-primary font-medium max-w-[200px] truncate',
          Icon && 'gap-1'
        )}
        title={displayLabel}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        {displayLabel}
      </span>
    );
  }
  
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-gray-500 max-w-[200px] truncate',
        Icon && 'gap-1'
      )}
      title={displayLabel}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      {displayLabel}
    </span>
  );
}

const MARINAMATCH_TAB_LABELS: Record<string, string> = {
  'overview': 'Overview',
  'sources': 'Deal Sources',
  'mandates': 'Investment Mandates',
  'deals': 'Deal Queue',
  'brokers': 'Broker Network',
  'listings': 'Market Intel',
  'criteria': 'Investment Criteria',
  'goals': 'Goals',
};

export function Breadcrumb() {
  const [location] = useLocation();
  
  let breadcrumbs = getBreadcrumbsForPath(location);
  
  if (location === '/marinamatch' || location.startsWith('/marinamatch?')) {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || 'overview';
    const tabLabel = MARINAMATCH_TAB_LABELS[tab] || 'Overview';
    breadcrumbs = [
      DASHBOARD_ITEM,
      CATEGORIES.MARINAMATCH,
      { label: tabLabel },
    ];
  }

  if (location === '/dashboard' || location === '/' || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="flex items-center text-sm px-6 py-2 border-b border-gray-100 bg-white/50"
      data-testid="breadcrumb-nav"
    >
      <ol className="flex items-center gap-1.5">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              )}
              {item.isDynamic ? (
                <DynamicBreadcrumbItem item={item} isLast={isLast} />
              ) : isLast ? (
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-primary font-medium',
                    Icon && 'gap-1'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors',
                    Icon && 'gap-1'
                  )}
                  data-testid={`breadcrumb-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-gray-500',
                    Icon && 'gap-1'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;

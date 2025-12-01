import { Link, useLocation } from 'wouter';
import { ChevronRight, Anchor, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const DASHBOARD_ITEM: BreadcrumbItem = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard };

const ROUTE_MAPPINGS: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [],
  '/projects': [
    { label: 'Due Diligence' },
  ],
  '/projects/summary': [
    { label: 'Due Diligence' },
  ],
  '/dd/projects': [
    { label: 'Due Diligence' },
  ],
  '/crm': [
    { label: 'CRM' },
  ],
  '/crm/deals': [
    { label: 'CRM', href: '/crm' },
    { label: 'Deals' },
  ],
  '/crm/pipeline': [
    { label: 'CRM', href: '/crm' },
    { label: 'Pipeline' },
  ],
  '/crm/contacts': [
    { label: 'CRM', href: '/crm' },
    { label: 'Contacts' },
  ],
  '/crm/companies': [
    { label: 'CRM', href: '/crm' },
    { label: 'Companies' },
  ],
  '/crm/properties': [
    { label: 'CRM', href: '/crm' },
    { label: 'Properties' },
  ],
  '/crm/leads': [
    { label: 'CRM', href: '/crm' },
    { label: 'Leads' },
  ],
  '/crm/analytics': [
    { label: 'CRM', href: '/crm' },
    { label: 'Analytics' },
  ],
  '/crm/forecast': [
    { label: 'CRM', href: '/crm' },
    { label: 'Forecast' },
  ],
  '/crm/activity': [
    { label: 'CRM', href: '/crm' },
    { label: 'Activity' },
  ],
  '/crm/tasks': [
    { label: 'CRM', href: '/crm' },
    { label: 'Tasks' },
  ],
  '/crm/marketing': [
    { label: 'CRM', href: '/crm' },
    { label: 'Marketing Automation' },
  ],
  '/prospecting': [
    { label: 'Prospecting' },
  ],
  '/prospecting/board': [
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Board' },
  ],
  '/prospecting/markets': [
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Market Targets' },
  ],
  '/prospecting/campaigns': [
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Campaigns' },
  ],
  '/prospecting/analytics': [
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Analytics' },
  ],
  '/modeling': [
    { label: 'Modeling' },
  ],
  '/modeling/projects': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Projects' },
  ],
  '/modeling/portfolio': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Portfolio' },
  ],
  '/modeling/exit': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy' },
  ],
  '/modeling/exit/scenarios': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Scenarios' },
  ],
  '/modeling/exit/tax': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Tax Calculator' },
  ],
  '/modeling/exit/net-proceeds': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Net Proceeds' },
  ],
  '/modeling/exit/1031': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: '1031 Exchange' },
  ],
  '/modeling/exit/dst': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'DST Analysis' },
  ],
  '/modeling/exit/seller-financing': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Seller Financing' },
  ],
  '/modeling/exit/earnout': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Earnout' },
  ],
  '/modeling/exit/waterfall': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Waterfall' },
  ],
  '/modeling/exit/irr': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'IRR Calculator' },
  ],
  '/modeling/exit/sensitivity': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Sensitivity' },
  ],
  '/modeling/exit/ai-insights': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'AI Insights' },
  ],
  '/modeling/doc-intel': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Document Intelligence' },
  ],
  '/modeling/debt-scenarios': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Debt Scenarios' },
  ],
  '/modeling/settings': [
    { label: 'Modeling', href: '/modeling' },
    { label: 'Settings' },
  ],
  '/analysis/sales-comps': [
    { label: 'Sales Comps' },
  ],
  '/analysis/sales-comps/analytics': [
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Analytics' },
  ],
  '/analysis/sales-comps/upload': [
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Upload' },
  ],
  '/analysis/sales-comps/compare': [
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Compare' },
  ],
  '/analysis/sales-comps/bulk-edit': [
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Bulk Edit' },
  ],
  '/analysis/sales-comps/columns': [
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Column Manager' },
  ],
  '/analysis/sales-comps/projects': [
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Projects' },
  ],
  '/analysis/rate-comps': [
    { label: 'Rate Comps' },
  ],
  '/analysis/rate-comps/analytics': [
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Analytics' },
  ],
  '/analysis/rate-comps/upload': [
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Upload' },
  ],
  '/analysis/rate-comps/compare': [
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Compare' },
  ],
  '/analysis/rate-comps/bulk-edit': [
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Bulk Edit' },
  ],
  '/analysis/rate-comps/columns': [
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Column Manager' },
  ],
  '/analysis/demographics': [
    { label: 'Market Demographics' },
  ],
  '/analysis/benchmarks': [
    { label: 'Benchmarks' },
  ],
  '/operations/dockit': [
    { label: 'Launch Operations', icon: Anchor },
  ],
  '/operations/dockit/launches': [
    { label: 'Launch Operations', href: '/operations/dockit', icon: Anchor },
    { label: 'Launch Queue' },
  ],
  '/operations/dockit/slips': [
    { label: 'Launch Operations', href: '/operations/dockit', icon: Anchor },
    { label: 'Transient Slips' },
  ],
  '/rent-roll': [
    { label: 'Rent Roll' },
  ],
  '/rent-roll/customers': [
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Customer Analytics' },
  ],
  '/rent-roll/portfolio': [
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Portfolio' },
  ],
  '/rent-roll/projects': [
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Projects' },
  ],
  '/fuel': [
    { label: 'Fuel Dock' },
  ],
  '/fuel/transactions': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Transactions' },
  ],
  '/fuel/inventory': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Inventory' },
  ],
  '/fuel/analytics': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Analytics' },
  ],
  '/fuel/reports': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Reports' },
  ],
  '/fuel/model': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Financial Model' },
  ],
  '/fuel/settings': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Settings' },
  ],
  '/fuel/import-history': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Import History' },
  ],
  '/fuel/audit': [
    { label: 'Fuel Dock', href: '/fuel' },
    { label: 'Audit Trail' },
  ],
  '/ship-store': [
    { label: 'Ship Store' },
  ],
  '/ship-store/pos': [
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Point of Sale' },
  ],
  '/ship-store/inventory': [
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Inventory' },
  ],
  '/ship-store/transactions': [
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Transactions' },
  ],
  '/ship-store/checkout': [
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Checkout' },
  ],
  '/ship-store/analytics': [
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Analytics' },
  ],
  '/ship-store/reports': [
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Reports' },
  ],
  '/marketing': [
    { label: 'Marketing' },
  ],
  '/marketing/campaigns': [
    { label: 'Marketing', href: '/marketing' },
    { label: 'Campaigns' },
  ],
  '/marketing/expenses': [
    { label: 'Marketing', href: '/marketing' },
    { label: 'Expenses' },
  ],
  '/marketing/attribution': [
    { label: 'Marketing', href: '/marketing' },
    { label: 'Attribution' },
  ],
  '/marketing/email': [
    { label: 'Marketing', href: '/marketing' },
    { label: 'Email Campaigns' },
  ],
  '/marketing/settings': [
    { label: 'Marketing', href: '/marketing' },
    { label: 'Settings' },
  ],
  '/vdr': [
    { label: 'Virtual Data Room' },
  ],
  '/vdr/data-request': [
    { label: 'Virtual Data Room', href: '/vdr' },
    { label: 'Data Request' },
  ],
  '/docktalk': [
    { label: 'DockTalk' },
  ],
  '/docktalk/feed': [
    { label: 'DockTalk', href: '/docktalk' },
    { label: 'News Feed' },
  ],
  '/docktalk/deals': [
    { label: 'DockTalk', href: '/docktalk' },
    { label: 'M&A Deals' },
  ],
  '/docktalk/sources': [
    { label: 'DockTalk', href: '/docktalk' },
    { label: 'Sources' },
  ],
  '/docktalk/training': [
    { label: 'DockTalk', href: '/docktalk' },
    { label: 'AI Training' },
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
};

function getBreadcrumbsForPath(path: string): BreadcrumbItem[] {
  let items: BreadcrumbItem[] = [];

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

export function Breadcrumb() {
  const [location] = useLocation();
  const breadcrumbs = getBreadcrumbsForPath(location);

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
              {isLast ? (
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

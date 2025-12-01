import { Link, useLocation } from 'wouter';
import { ChevronRight, Home, Anchor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const ROUTE_MAPPINGS: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [
    { label: 'Dashboard', icon: Home },
  ],
  '/projects': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Due Diligence' },
  ],
  '/projects/summary': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Due Diligence' },
  ],
  '/dd/projects': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Due Diligence' },
  ],
  '/crm': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM' },
  ],
  '/crm/deals': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Deals' },
  ],
  '/crm/pipeline': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Pipeline' },
  ],
  '/crm/contacts': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Contacts' },
  ],
  '/crm/companies': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Companies' },
  ],
  '/crm/properties': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Properties' },
  ],
  '/crm/leads': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Leads' },
  ],
  '/crm/analytics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Analytics' },
  ],
  '/crm/forecast': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Forecast' },
  ],
  '/crm/activity': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Activity' },
  ],
  '/crm/tasks': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Tasks' },
  ],
  '/crm/marketing': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'CRM', href: '/crm' },
    { label: 'Marketing Automation' },
  ],
  '/prospecting': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Prospecting' },
  ],
  '/prospecting/board': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Board' },
  ],
  '/prospecting/markets': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Market Targets' },
  ],
  '/prospecting/campaigns': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Campaigns' },
  ],
  '/prospecting/analytics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Prospecting', href: '/prospecting' },
    { label: 'Analytics' },
  ],
  '/modeling': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling' },
  ],
  '/modeling/projects': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Projects' },
  ],
  '/modeling/portfolio': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Portfolio' },
  ],
  '/modeling/exit': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy' },
  ],
  '/modeling/exit/scenarios': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Scenarios' },
  ],
  '/modeling/exit/tax': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Tax Calculator' },
  ],
  '/modeling/exit/net-proceeds': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Net Proceeds' },
  ],
  '/modeling/exit/1031': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: '1031 Exchange' },
  ],
  '/modeling/exit/dst': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'DST Analysis' },
  ],
  '/modeling/exit/waterfall': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Waterfall' },
  ],
  '/modeling/exit/irr': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'IRR Calculator' },
  ],
  '/modeling/exit/sensitivity': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Exit Strategy', href: '/modeling/exit' },
    { label: 'Sensitivity' },
  ],
  '/modeling/doc-intel': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Document Intelligence' },
  ],
  '/modeling/debt-scenarios': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Debt Scenarios' },
  ],
  '/modeling/settings': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Modeling', href: '/modeling' },
    { label: 'Settings' },
  ],
  '/analysis/sales-comps': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Sales Comps' },
  ],
  '/analysis/sales-comps/analytics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Analytics' },
  ],
  '/analysis/sales-comps/upload': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Upload' },
  ],
  '/analysis/sales-comps/compare': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Sales Comps', href: '/analysis/sales-comps' },
    { label: 'Compare' },
  ],
  '/analysis/rate-comps': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Rate Comps' },
  ],
  '/analysis/rate-comps/analytics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Rate Comps', href: '/analysis/rate-comps' },
    { label: 'Analytics' },
  ],
  '/analysis/demographics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Demographics' },
  ],
  '/analysis/benchmarks': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Analysis' },
    { label: 'Benchmarks' },
  ],
  '/operations/dockit': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Launch Operations', icon: Anchor },
  ],
  '/operations/dockit/launches': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Launch Operations', href: '/operations/dockit', icon: Anchor },
    { label: 'Launch Queue' },
  ],
  '/operations/dockit/slips': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Launch Operations', href: '/operations/dockit', icon: Anchor },
    { label: 'Transient Slips' },
  ],
  '/rent-roll': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rent Roll' },
  ],
  '/rent-roll/customers': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Customer Analytics' },
  ],
  '/rent-roll/portfolio': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Portfolio' },
  ],
  '/rent-roll/projects': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rent Roll', href: '/rent-roll' },
    { label: 'Projects' },
  ],
  '/fuel': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Fuel Operations' },
  ],
  '/fuel/transactions': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Fuel Operations', href: '/fuel' },
    { label: 'Transactions' },
  ],
  '/fuel/inventory': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Fuel Operations', href: '/fuel' },
    { label: 'Inventory' },
  ],
  '/fuel/analytics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Fuel Operations', href: '/fuel' },
    { label: 'Analytics' },
  ],
  '/fuel/reports': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Fuel Operations', href: '/fuel' },
    { label: 'Reports' },
  ],
  '/ship-store': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Ship Store' },
  ],
  '/ship-store/pos': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Point of Sale' },
  ],
  '/ship-store/inventory': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Inventory' },
  ],
  '/ship-store/transactions': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Transactions' },
  ],
  '/ship-store/analytics': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Analytics' },
  ],
  '/ship-store/reports': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Ship Store', href: '/ship-store' },
    { label: 'Reports' },
  ],
  '/marketing': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Marketing' },
  ],
  '/marketing/campaigns': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Marketing', href: '/marketing' },
    { label: 'Campaigns' },
  ],
  '/marketing/expenses': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Marketing', href: '/marketing' },
    { label: 'Expenses' },
  ],
  '/marketing/attribution': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Marketing', href: '/marketing' },
    { label: 'Attribution' },
  ],
  '/marketing/email': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Marketing', href: '/marketing' },
    { label: 'Email Campaigns' },
  ],
  '/vdr': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Virtual Data Room' },
  ],
  '/vdr/data-request': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Virtual Data Room', href: '/vdr' },
    { label: 'Data Request' },
  ],
  '/docktalk': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'DockTalk' },
  ],
  '/docktalk/feed': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'DockTalk', href: '/docktalk' },
    { label: 'News Feed' },
  ],
  '/docktalk/deals': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'DockTalk', href: '/docktalk' },
    { label: 'M&A Deals' },
  ],
  '/user/settings': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'User Settings' },
  ],
  '/audit-logs': [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Audit Logs' },
  ],
};

function getBreadcrumbsForPath(path: string): BreadcrumbItem[] {
  if (ROUTE_MAPPINGS[path]) {
    return ROUTE_MAPPINGS[path];
  }

  for (const [pattern, items] of Object.entries(ROUTE_MAPPINGS)) {
    const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(path)) {
      return items;
    }
  }

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
      return [...parentBreadcrumbs.slice(0, -1), { ...parentBreadcrumbs[parentBreadcrumbs.length - 1], href: parentPath }, { label: formattedLabel }];
    }
  }

  return [
    { label: 'Dashboard', href: '/dashboard' },
    { label: segments.length > 0 ? segments[segments.length - 1].charAt(0).toUpperCase() + segments[segments.length - 1].slice(1) : 'Page' },
  ];
}

export function Breadcrumb() {
  const [location] = useLocation();
  const breadcrumbs = getBreadcrumbsForPath(location);

  if (location === '/dashboard' || location === '/') {
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

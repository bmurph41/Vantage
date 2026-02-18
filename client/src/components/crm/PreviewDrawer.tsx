/**
 * PreviewDrawer — Cross-record navigation drawer
 * 
 * Slides in from the right to show a quick summary of any linked CRM entity.
 * Allows users to peek at associated records without losing context on the
 * current page. Provides quick actions (navigate, call, email) and recent
 * activity snippet.
 * 
 * Usage:
 *   <PreviewDrawer
 *     open={!!previewEntity}
 *     onOpenChange={(open) => !open && setPreviewEntity(null)}
 *     entityType="contact"
 *     entityId="abc-123"
 *   />
 */
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowUpRight, Building2, Calendar, ChevronRight, DollarSign,
  ExternalLink, Mail, MapPin, Phone, User, Activity, Clock,
  Briefcase, Home, Anchor, TrendingUp, X,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type EntityType = 'contact' | 'company' | 'property' | 'deal';

interface PreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
}

const entityConfig: Record<EntityType, {
  icon: typeof User;
  label: string;
  color: string;
  bgColor: string;
  recordUrl: (id: string) => string;
  endpoint: (id: string) => string;
}> = {
  contact: {
    icon: User,
    label: 'Contact',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    recordUrl: (id) => `/crm/contacts/${id}`,
    endpoint: (id) => `/api/crm/contacts/${id}/preview`,
  },
  company: {
    icon: Building2,
    label: 'Company',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    recordUrl: (id) => `/crm/companies/${id}`,
    endpoint: (id) => `/api/crm/companies/${id}/preview`,
  },
  property: {
    icon: MapPin,
    label: 'Property',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    recordUrl: (id) => `/crm/properties/${id}`,
    endpoint: (id) => `/api/crm/properties/${id}/preview`,
  },
  deal: {
    icon: DollarSign,
    label: 'Deal',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    recordUrl: (id) => `/crm/deals/${id}`,
    endpoint: (id) => `/api/crm/deals/${id}/preview`,
  },
};

// Format helpers
function fmtCurrency(v: string | number | null): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return '—'; }
}

function fmtRelative(d: string | null): string {
  if (!d) return '';
  try {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return format(new Date(d), 'MMM d');
  } catch { return ''; }
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Activity icon map
const activityIcons: Record<string, typeof Activity> = {
  call: Phone, email: Mail, meeting: Calendar, task: Briefcase,
  note: Activity, site_visit: MapPin, follow_up: Clock,
};

export function PreviewDrawer({ open, onOpenChange, entityType, entityId }: PreviewDrawerProps) {
  const [, setLocation] = useLocation();
  const config = entityConfig[entityType];
  const Icon = config.icon;

  // Fetch preview data — falls back to the full record endpoint if /preview doesn't exist
  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-preview', entityType, entityId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', config.endpoint(entityId));
        return res.json();
      } catch {
        // Fallback: fetch full record if preview endpoint isn't implemented yet
        const fallbackUrl = `/api/crm/${entityType === 'contact' ? 'contacts' : entityType === 'company' ? 'companies' : entityType === 'property' ? 'properties' : 'deals'}/${entityId}`;
        const res = await apiRequest('GET', fallbackUrl);
        return res.json();
      }
    },
    enabled: open && !!entityId,
    staleTime: 30_000,
  });

  const navigateToRecord = () => {
    onOpenChange(false);
    setLocation(config.recordUrl(entityId));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className={cn("px-5 pt-5 pb-4 border-b", config.bgColor)}>
          <SheetHeader className="space-y-0">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={cn("text-[10px] font-medium uppercase tracking-wider", config.color)}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label} Preview
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={navigateToRecord}
              >
                Open Full Record
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
            
            {isLoading ? (
              <div className="pt-3 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : data ? (
              <div className="pt-3">
                <SheetTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  {data.name || data.title || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Untitled'}
                </SheetTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {entityType === 'contact' && [data.position, data.company].filter(Boolean).join(' · ')}
                  {entityType === 'company' && [data.industry, data.city && data.state ? `${data.city}, ${data.state}` : null].filter(Boolean).join(' · ')}
                  {entityType === 'property' && [data.type, data.city && data.state ? `${data.city}, ${data.state}` : null].filter(Boolean).join(' · ')}
                  {entityType === 'deal' && [data.stage, data.value ? fmtCurrency(data.value) : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            ) : null}
          </SheetHeader>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading ? (
            <PreviewSkeleton />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Unable to load preview</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={navigateToRecord}>
                Open Full Record
              </Button>
            </div>
          ) : data ? (
            <>
              {/* Quick Actions */}
              <QuickActions data={data} entityType={entityType} />

              {/* Key Metrics */}
              <KeyMetrics data={data} entityType={entityType} />

              <Separator />

              {/* Key Details */}
              <KeyDetails data={data} entityType={entityType} />

              <Separator />

              {/* Top Associations */}
              <TopAssociations
                data={data}
                entityType={entityType}
                onPreviewEntity={(type, id) => {
                  // Re-open drawer with different entity — handled by parent
                }}
                onNavigate={(url) => {
                  onOpenChange(false);
                  setLocation(url);
                }}
              />

              <Separator />

              {/* Recent Activity */}
              <RecentActivity data={data} />
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-gray-50 dark:bg-gray-900/50">
          <Button className="w-full gap-2" onClick={navigateToRecord}>
            View Full {config.label} Record
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ──────────────────────────────────────────

function PreviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-px w-full" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-4 w-4" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickActions({ data, entityType }: { data: any; entityType: EntityType }) {
  const actions: Array<{ icon: typeof Phone; label: string; href?: string; onClick?: () => void }> = [];

  const email = data.email || data.primaryEmail;
  const phone = data.phone || data.primaryPhone;

  if (email) {
    actions.push({ icon: Mail, label: 'Email', href: `mailto:${email}` });
  }
  if (phone) {
    actions.push({ icon: Phone, label: 'Call', href: `tel:${phone}` });
  }
  if (data.website || data.domain) {
    const url = data.website || `https://${data.domain}`;
    actions.push({ icon: ExternalLink, label: 'Website', href: url.startsWith('http') ? url : `https://${url}` });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2">
      {actions.map((a, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs"
          asChild={!!a.href}
          onClick={a.onClick}
        >
          {a.href ? (
            <a href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
              <a.icon className="h-3 w-3" />
              {a.label}
            </a>
          ) : (
            <>
              <a.icon className="h-3 w-3" />
              {a.label}
            </>
          )}
        </Button>
      ))}
    </div>
  );
}

function KeyMetrics({ data, entityType }: { data: any; entityType: EntityType }) {
  const metrics: Array<{ label: string; value: string; icon: typeof Activity }> = [];

  if (entityType === 'contact') {
    if (data.deals?.length) metrics.push({ label: 'Open Deals', value: String(data.deals.length), icon: DollarSign });
    if (data.activities?.openCount != null) metrics.push({ label: 'Open Activities', value: String(data.activities.openCount), icon: Activity });
    if (data.properties?.length) metrics.push({ label: 'Properties', value: String(data.properties.length), icon: Home });
  }

  if (entityType === 'company') {
    if (data.annualRevenue) metrics.push({ label: 'Revenue', value: fmtCurrency(data.annualRevenue), icon: TrendingUp });
    if (data.contacts?.length) metrics.push({ label: 'Contacts', value: String(data.contacts.length), icon: User });
    if (data.deals?.length) metrics.push({ label: 'Deals', value: String(data.deals.length), icon: DollarSign });
    if (data.properties?.length) metrics.push({ label: 'Properties', value: String(data.properties.length), icon: MapPin });
  }

  if (entityType === 'property') {
    if (data.listingPrice || data.listPrice) metrics.push({ label: 'Asking', value: fmtCurrency(data.listingPrice || data.listPrice), icon: DollarSign });
    if (data.annualRevenue) metrics.push({ label: 'Revenue', value: fmtCurrency(data.annualRevenue), icon: TrendingUp });
    if (data.occupancyRate) metrics.push({ label: 'Occupancy', value: `${data.occupancyRate}%`, icon: Anchor });
    if (data.totalCapacity) metrics.push({ label: 'Capacity', value: String(data.totalCapacity), icon: Home });
  }

  if (entityType === 'deal') {
    if (data.value) metrics.push({ label: 'Value', value: fmtCurrency(data.value), icon: DollarSign });
    if (data.probability != null) metrics.push({ label: 'Probability', value: `${data.probability}%`, icon: TrendingUp });
  }

  if (metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.slice(0, 4).map((m, i) => (
        <div key={i} className="rounded-lg border bg-white dark:bg-gray-800 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <m.icon className="h-3 w-3 text-gray-400" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{m.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function KeyDetails({ data, entityType }: { data: any; entityType: EntityType }) {
  const fields: Array<{ icon: typeof User; label: string; value: string | null }> = [];

  if (entityType === 'contact') {
    fields.push({ icon: Mail, label: 'Email', value: data.email });
    fields.push({ icon: Phone, label: 'Phone', value: data.phone });
    fields.push({ icon: Building2, label: 'Company', value: data.company || data.primaryCompany?.name });
    fields.push({ icon: Briefcase, label: 'Position', value: data.position });
    if (data.city || data.state) fields.push({ icon: MapPin, label: 'Location', value: [data.city, data.state].filter(Boolean).join(', ') });
  }

  if (entityType === 'company') {
    fields.push({ icon: Building2, label: 'Industry', value: data.industry });
    fields.push({ icon: Phone, label: 'Phone', value: data.phone });
    fields.push({ icon: ExternalLink, label: 'Website', value: data.website || data.domain });
    if (data.city || data.state) fields.push({ icon: MapPin, label: 'Location', value: [data.city, data.state].filter(Boolean).join(', ') });
    if (data.size) fields.push({ icon: User, label: 'Size', value: data.size });
  }

  if (entityType === 'property') {
    fields.push({ icon: Home, label: 'Type', value: data.type });
    if (data.address || data.city) fields.push({ icon: MapPin, label: 'Address', value: [data.address, data.city, data.state].filter(Boolean).join(', ') });
    if (data.wetSlips) fields.push({ icon: Anchor, label: 'Wet Slips', value: String(data.wetSlips) });
    if (data.drySlips) fields.push({ icon: Home, label: 'Dry Slips', value: String(data.drySlips) });
    if (data.noiEstimate) fields.push({ icon: DollarSign, label: 'NOI', value: fmtCurrency(data.noiEstimate) });
  }

  if (entityType === 'deal') {
    fields.push({ icon: Activity, label: 'Stage', value: data.stage });
    fields.push({ icon: Calendar, label: 'Close Date', value: fmtDate(data.expectedCloseDate) });
    if (data.source) fields.push({ icon: TrendingUp, label: 'Source', value: data.source });
  }

  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Details</p>
      {fields.filter(f => f.value).map((f, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <f.icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 w-16 flex-shrink-0">{f.label}</span>
          <span className="text-sm text-gray-900 dark:text-white truncate">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

function TopAssociations({
  data,
  entityType,
  onPreviewEntity,
  onNavigate,
}: {
  data: any;
  entityType: EntityType;
  onPreviewEntity: (type: EntityType, id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const sections: Array<{ type: EntityType; label: string; items: any[]; nameKey: string; subtitleFn: (item: any) => string }> = [];

  if (entityType !== 'contact' && data.contacts?.length) {
    sections.push({
      type: 'contact',
      label: 'Contacts',
      items: data.contacts.slice(0, 3),
      nameKey: 'name',
      subtitleFn: (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Contact',
    });
  }
  if (entityType !== 'company' && data.companies?.length) {
    sections.push({
      type: 'company',
      label: 'Companies',
      items: data.companies.slice(0, 3),
      nameKey: 'name',
      subtitleFn: (c) => c.name || 'Company',
    });
  }
  if (entityType !== 'property' && data.properties?.length) {
    sections.push({
      type: 'property',
      label: 'Properties',
      items: data.properties.slice(0, 3),
      nameKey: 'title',
      subtitleFn: (p) => p.title || p.name || 'Property',
    });
  }
  if (entityType !== 'deal' && data.deals?.length) {
    sections.push({
      type: 'deal',
      label: 'Deals',
      items: data.deals.slice(0, 3),
      nameKey: 'name',
      subtitleFn: (d) => d.name || 'Deal',
    });
  }

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Associations</p>
      {sections.map((section) => {
        const sConfig = entityConfig[section.type];
        const SIcon = sConfig.icon;
        return (
          <div key={section.type} className="space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <SIcon className={cn("h-3 w-3", sConfig.color)} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{section.label}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{section.items.length}</Badge>
            </div>
            {section.items.map((item: any) => (
              <button
                key={item.id}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
                onClick={() => onNavigate(sConfig.recordUrl(item.id))}
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-gray-100 dark:bg-gray-700">
                    {getInitials(section.subtitleFn(item))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{section.subtitleFn(item)}</p>
                  {item.role && <p className="text-[10px] text-gray-500 truncate">{item.role}</p>}
                  {item.relationship && <p className="text-[10px] text-gray-500 truncate">{item.relationship}</p>}
                </div>
                <ArrowUpRight className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RecentActivity({ data }: { data: any }) {
  const activities = data.recentActivities?.slice(0, 4) || data.timeline?.slice(0, 4) || [];
  if (activities.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activity</p>
      <div className="space-y-0">
        {activities.map((a: any, i: number) => {
          const AIcon = activityIcons[a.type || a.eventType] || Activity;
          return (
            <div key={a.id || i} className="flex items-start gap-2.5 py-2">
              <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <AIcon className="h-3 w-3 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">
                  {a.subject || a.title || a.content?.slice(0, 60) || 'Activity'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {fmtRelative(a.createdAt || a.scheduledAt || a.completedAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PreviewDrawer;

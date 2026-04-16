import { useQuery } from '@tanstack/react-query';
import { PropertyFMPanel } from '@/components/crm/PropertyFMPanel';
import { PropertyCompsPanel } from '@/components/crm/PropertyCompsPanel';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  MapPin, Building2, Anchor, DollarSign, TrendingUp, Calendar,
  Globe, Phone, Mail, Users, Briefcase, Home, Activity, Clock,
  Tag, ExternalLink, ChevronRight, ArrowUpRight, Warehouse, Ship,
  Droplets, Wifi, Fuel, Wrench, ShowerHead, Store, Fish, Star,
  FileText, MessageSquare, BarChart3, Target, Hash, Waves,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard, AssociationRow,
} from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';
import {
  PropertySalesCompsTab,
  PropertyRateCompsTab,
  PropertyIntelTab,
  PropertyActivitiesTab,
  PropertyRentRollKpiTab,
  PropertyDemographicsTab,
} from '@/components/crm/PropertyRecordTabs';
import { PropertyStatusPanel } from '@/components/crm/panels/PropertyStatusPanel';
import { CommentThreadsPanel } from '@/components/crm/panels/comment-threads-panel';
import { cn, formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

interface PropertyRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  listingPrice: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  coordinates: { lat: number; lng: number } | null;
  specifications: Record<string, any>;
  description: string | null;
  images: any[];
  wetSlips: number | null;
  drySlips: number | null;
  moorings: number | null;
  totalCapacity: number | null;
  amenities: string[] | null;
  occupancyRate: string | null;
  annualRevenue: string | null;
  noiEstimate: string | null;
  askingPriceHistory: Array<{ date: string; price: number; notes?: string }>;
  isSelling: boolean;
  isOnMarket: boolean;
  pipelineStage: string | null;
  brokerName: string | null;
  listPrice: string | null;
  listCapRate: string | null;
  listingDate: string | null;
  listingUrl: string | null;
  listingNotes: string | null;
  lastSaleMonth: number | null;
  lastSaleYear: number | null;
  lastSalePrice: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string } | null;
  brokerContact: { id: string; firstName: string; lastName: string; email: string; phone: string | null } | null;
  ownerCompany: { id: string; name: string; industry: string | null } | null;
  listingAgent: { id: string; firstName: string; lastName: string; email: string; phone: string | null } | null;
  activities: { openCount: number; overdueCount: number; nextActivity: any | null };
  timeline: Array<{ id: string; eventType: string; title: string; createdAt: string }>;
  companies: Array<{ id: string; name: string; industry: string | null; relationship: string | null }>;
  contacts: Array<{ id: string; firstName: string; lastName: string; email: string; phone: string | null; position: string | null; contactTag: string | null; relationship: string | null }>;
  deals: Array<{ id: string; name: string; value: string | null; stage: string; probability: number | null; expectedCloseDate: string | null }>;
  storageEntries: Array<{ id: string; storageTypeName: string; capacity: number; occupied: number; rate: string | null; rateType: string | null }>;
  recentActivities: Array<{ id: string; type: string; subject: string; status: string; scheduledAt: string | null; completedAt: string | null }>;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; engagementScore30d?: number };
  listingStatus?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

// ── Color maps ────────────────────────────────────────────

const typeColors: Record<string, string> = {
  marina: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  boat: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400',
  slip: 'bg-purple-50 text-purple-700 border-purple-200',
  dry_storage: 'bg-orange-50 text-orange-700 border-orange-200',
  multifamily: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  retail: 'bg-pink-50 text-pink-700 border-pink-200',
  industrial: 'bg-gray-50 text-gray-700 border-gray-200',
  office: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-50 text-green-700 border-green-200',
  under_contract: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  sold: 'bg-gray-50 text-gray-600 border-gray-200',
  off_market: 'bg-red-50 text-red-700 border-red-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};
const listingStatusConfig: Record<string, { label: string; cls: string }> = {
  off_market:     { label: 'Off Market',      cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  on_market:      { label: 'On Market',       cls: 'bg-green-100 text-green-800 border-green-300' },
  under_loi:      { label: 'Under LOI',       cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  under_contract: { label: 'Under Contract',  cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  closed:         { label: 'Closed',          cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  portfolio:      { label: 'Portfolio',       cls: 'bg-teal-100 text-teal-800 border-teal-300' },
  watchlist:      { label: 'Watchlist',       cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  available:      { label: 'Available',       cls: 'bg-green-100 text-green-800 border-green-300' },
  sold:           { label: 'Sold',            cls: 'bg-purple-100 text-purple-800 border-purple-300' },
};



const stageColors: Record<string, string> = {
  discovery: 'bg-blue-50 text-blue-700',
  qualification: 'bg-indigo-50 text-indigo-700',
  proposal: 'bg-purple-50 text-purple-700',
  negotiation: 'bg-amber-50 text-amber-700',
  closed_won: 'bg-green-50 text-green-700',
  closed_lost: 'bg-red-50 text-red-700',
};

const amenityIcons: Record<string, any> = {
  fuel: Fuel, restaurant: Store, pool: Droplets, ship_store: Store,
  repairs: Wrench, wifi: Wifi, laundry: Home, showers: ShowerHead,
  pumpout: Anchor, fishing: Fish, default: Star,
};

// ── Helpers ───────────────────────────────────────────────

const currFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const currFmtFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtCurrency(v: string | number | null): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return n >= 1000 ? currFmt.format(n) : currFmtFull.format(n);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return format(new Date(d), 'MM/dd/yyyy'); } catch { return '—'; }
}

function fmtLabel(str: string): string {
  return str.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function fmtPercent(v: string | number | null): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

function getInitials(first: string, last: string): string {
  return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
}

// ── Page Component ────────────────────────────────────────

export default function PropertyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: property, isLoading } = useQuery<PropertyRecord>({
    queryKey: ['crm-property-record', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/properties/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  if (!id) return null;

  const subtitle = property
    ? [property.type ? fmtLabel(property.type) : null, property.city && property.state ? `${property.city}, ${property.state}` : property.address].filter(Boolean).join(' · ')
    : undefined;

  // Compute cap rate if we have NOI and asking price
  const computedCapRate = property?.noiEstimate && (property?.listingPrice || property?.listPrice)
    ? ((parseFloat(property.noiEstimate) / parseFloat(property.listingPrice || property.listPrice || '1')) * 100).toFixed(1)
    : property?.listCapRate;

  // KPI chips
  // Listing status chip for prominence
  const listingStatusChip = property?.listingStatus
    ? {
        label: 'Listing',
        value: listingStatusConfig[property.listingStatus]?.label || property.listingStatus.replace(/_/g, ' '),
        icon: Tag,
        color: property.listingStatus === 'on_market' ? 'text-green-600'
          : property.listingStatus === 'under_loi' ? 'text-amber-600'
          : property.listingStatus === 'under_contract' ? 'text-blue-600'
          : 'text-gray-500',
      }
    : null;

  const kpiChips = property ? [
    ...(listingStatusChip ? [listingStatusChip] : []),
    ...(property.listingPrice || property.listPrice ? [{
      label: 'Asking',
      value: fmtCurrency(property.listingPrice || property.listPrice),
      icon: DollarSign,
      color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    }] : []),
    ...(property.annualRevenue ? [{
      label: 'Revenue',
      value: fmtCurrency(property.annualRevenue),
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    }] : []),
    ...(property.noiEstimate ? [{
      label: 'NOI',
      value: fmtCurrency(property.noiEstimate),
      icon: BarChart3,
    }] : []),
    ...(computedCapRate ? [{
      label: 'Cap Rate',
      value: `${computedCapRate}%`,
      icon: Target,
      color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
    }] : []),
    ...(property.occupancyRate ? [{
      label: 'Occupancy',
      value: fmtPercent(property.occupancyRate),
      icon: Anchor,
      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    }] : []),
    ...(property.totalCapacity ? [{
      label: 'Capacity',
      value: property.totalCapacity,
      icon: Waves,
    }] : []),
    { label: 'Open Deals', value: property.rollups?.openDealsCount || 0, icon: Target },
    { label: 'Engagement (30d)', value: property.rollups?.engagementScore30d || 0, icon: Activity },
  ] : [];

  const nextActivity = property?.activities?.nextActivity
    ? { id: property.activities.nextActivity.id, type: property.activities.nextActivity.type, subject: property.activities.nextActivity.subject || 'Upcoming', scheduledAt: property.activities.nextActivity.scheduledAt }
    : null;

  return (
    <CrmRecordPage
      entityType="property"
      entityId={id}
      entityName={property?.title || 'Loading...'}
      entitySubtitle={subtitle}
      entityAvatar={property && (
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-sm font-medium">
            {property.type === 'marina' ? <Anchor className="h-4 w-4" /> : (property.title || 'P').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      status={(() => {
        const ls = property?.listingStatus || property?.status;
        const cfg = ls ? listingStatusConfig[ls] : null;
        return cfg ? cfg.label : ls ? fmtLabel(ls) : undefined;
      })()}
      statusColor={(() => {
        const ls = property?.listingStatus || property?.status;
        const cfg = ls ? listingStatusConfig[ls] : null;
        return cfg ? cfg.cls : ls ? statusColors[ls.toLowerCase()] || 'bg-gray-100 text-gray-700' : undefined;
      })()}
      owner={property?.owner}
      isLoading={isLoading}
      kpiChips={kpiChips}
      nextActivity={nextActivity}

      // ── LEFT: About Sidebar ──
      aboutSidebar={property && <PropertyAboutSidebar property={property} computedCapRate={computedCapRate} />}

      // ── CENTER: Tabs ──
      centerTabs={property ? [
        ...(property.storageEntries?.length ? [{
          value: 'storage',
          label: 'Storage',
          count: property.storageEntries.length,
          content: <StorageBreakdownTab entries={property.storageEntries} />,
        }] : []),
        {
          value: 'sales-comps',
          label: 'Sales Comps',
          content: <PropertySalesCompsTab
            state={property.state}
            city={property.city}
            propertyType={property.type}
          />,
        },
        {
          value: 'rate-comps',
          label: 'Rate Comps',
          content: <PropertyRateCompsTab
            state={property.state}
            city={property.city}
          />,
        },
        {
          value: 'activities',
          label: 'Activities',
          count: property.activities?.openCount || 0,
          content: <PropertyActivitiesTab propertyId={id} />,
        },
        {
          value: 'deals',
          label: 'Deals',
          count: property.deals?.length || 0,
          content: <PropertyDealsTab deals={property.deals} onNavigate={setLocation} />,
        },
        {
          value: 'intel',
          label: 'Intel',
          content: <PropertyIntelTab state={property.state} city={property.city} />,
        },
        {
          value: 'discussion',
          label: 'Discussion',
          content: <CommentThreadsPanel
            entityType="property"
            entityId={id}
            entityName={property.title}
          />,
        },
        {
          value: 'notes',
          label: 'Notes',
          count: property.notes?.length || 0,
          content: <NotesTab notes={property.notes} />,
        },
        ...(property.askingPriceHistory?.length ? [{
          value: 'price-history',
          label: 'Price History',
          count: property.askingPriceHistory.length,
          content: <PriceHistoryTab history={property.askingPriceHistory} />,
        }] : []),
        {
          value: 'rent-roll-kpi',
          label: 'Rent Roll',
          content: <PropertyRentRollKpiTab propertyId={id} />,
        },
        {
          value: 'demographics',
          label: 'Demographics',
          content: <PropertyDemographicsTab propertyId={id} city={property.city} state={property.state} />,
        },
      ] : []}

      // ── RIGHT: Associations Sidebar ──
      rightSidebar={property && <PropertyAssociationsSidebar property={property} onNavigate={setLocation} />}
    />
  );
}

// ── About Sidebar ─────────────────────────────────────────

function PropertyAboutSidebar({ property, computedCapRate }: { property: PropertyRecord; computedCapRate: string | null }) {
  const fullAddress = [property.address, [property.city, property.state].filter(Boolean).join(', '), property.zipCode].filter(Boolean).join(', ');

  return (
    <>
      {/* Location */}
      <RecordFieldGroup title="Location" icon={MapPin}>
        <RecordField label="Address" value={fullAddress || null} icon={MapPin} />
        {property.coordinates && (
          <RecordField
            label="Map"
            value="View on Google Maps"
            icon={Globe}
            href={`https://www.google.com/maps?q=${property.coordinates.lat},${property.coordinates.lng}`}
          />
        )}
      </RecordFieldGroup>

      {/* Financial KPIs */}
      <RecordFieldGroup title="Financials" icon={DollarSign}>
        <RecordField label="Asking Price" value={property.listingPrice || property.listPrice ? fmtCurrency(property.listingPrice || property.listPrice) : null} icon={DollarSign} />
        <RecordField label="Annual Revenue" value={property.annualRevenue ? fmtCurrency(property.annualRevenue) : null} icon={TrendingUp} />
        <RecordField label="NOI Estimate" value={property.noiEstimate ? fmtCurrency(property.noiEstimate) : null} icon={BarChart3} />
        {computedCapRate && <RecordField label="Cap Rate" value={`${computedCapRate}%`} icon={Target} />}
        {property.lastSalePrice && (
          <RecordField
            label="Last Sale"
            value={`${fmtCurrency(property.lastSalePrice)} ${property.lastSaleMonth && property.lastSaleYear ? `(${property.lastSaleMonth}/${property.lastSaleYear})` : ''}`}
            icon={Calendar}
          />
        )}
      </RecordFieldGroup>

      {/* Capacity & Occupancy */}
      {(property.wetSlips || property.drySlips || property.moorings || property.totalCapacity) && (
        <RecordFieldGroup title="Capacity" icon={Anchor}>
          {property.wetSlips != null && <RecordField label="Wet Slips" value={String(property.wetSlips)} icon={Ship} />}
          {property.drySlips != null && <RecordField label="Dry Slips" value={String(property.drySlips)} icon={Warehouse} />}
          {property.moorings != null && <RecordField label="Moorings" value={String(property.moorings)} icon={Anchor} />}
          {property.totalCapacity != null && <RecordField label="Total Capacity" value={String(property.totalCapacity)} icon={Home} />}
          {property.occupancyRate && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Occupancy</p>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtPercent(property.occupancyRate)}</span>
              </div>
              <Progress value={parseFloat(property.occupancyRate)} className="h-2" />
            </div>
          )}
        </RecordFieldGroup>
      )}

      {/* Listing Info */}
      {(property.isOnMarket || property.brokerName || property.listingDate || property.listingUrl) && (
        <RecordFieldGroup title="Listing" icon={Tag}>
          {property.isOnMarket && (
            <RecordField label="Market Status" value={<Badge variant="secondary" className="text-xs bg-green-50 text-green-700">On Market</Badge>} />
          )}
          {property.brokerName && <RecordField label="Broker" value={property.brokerName} icon={Briefcase} />}
          {property.listingDate && <RecordField label="Listed" value={fmtDate(property.listingDate)} icon={Calendar} />}
          {property.listingUrl && <RecordField label="Listing URL" value="View Listing" icon={ExternalLink} href={property.listingUrl} />}
          {property.pipelineStage && <RecordField label="Pipeline Stage" value={fmtLabel(property.pipelineStage)} icon={Target} />}
        </RecordFieldGroup>
      )}

      {/* Amenities */}
      {property.amenities && property.amenities.length > 0 && (
        <RecordFieldGroup title="Amenities" icon={Star} collapsible>
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.map((amenity) => {
              const AIcon = amenityIcons[amenity.toLowerCase().replace(/\s+/g, '_')] || amenityIcons.default;
              return (
                <Badge key={amenity} variant="outline" className="text-xs gap-1 py-0.5">
                  <AIcon className="h-3 w-3" />
                  {fmtLabel(amenity)}
                </Badge>
              );
            })}
          </div>
        </RecordFieldGroup>
      )}

      {/* Description */}
      {property.description && (
        <RecordFieldGroup title="Description" icon={FileText} collapsible>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{property.description}</p>
        </RecordFieldGroup>
      )}

      {/* Record metadata */}
      <RecordFieldGroup title="Record" icon={Calendar} collapsible defaultOpen={false}>
        <RecordField label="Created" value={fmtDate(property.createdAt)} icon={Calendar} />
        <RecordField label="Updated" value={fmtDate(property.updatedAt)} icon={Clock} />
      </RecordFieldGroup>
    </>
  );
}

// ── Associations Sidebar ──────────────────────────────────

function PropertyAssociationsSidebar({ property, onNavigate }: { property: PropertyRecord; onNavigate: (url: string) => void }) {
  return (
    <>
      {/* Owner Company */}
      {property.ownerCompany && (
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Owner</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <AssociationRow
              entityType="company"
              entityId={property.ownerCompany.id}
              name={property.ownerCompany.name}
              subtitle={property.ownerCompany.industry ? fmtLabel(property.ownerCompany.industry) : undefined}
              badge="Owner"
              badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
              avatarInitials={property.ownerCompany.name.slice(0, 2).toUpperCase()}
            />
          </CardContent>
        </Card>
      )}

      {/* Broker / Listing Agent */}
      {(property.brokerContact || property.listingAgent) && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-4 pt-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-gray-400" />
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Broker / Agent</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {property.brokerContact && (
              <AssociationRow
                entityType="contact"
                entityId={property.brokerContact.id}
                name={`${property.brokerContact.firstName} ${property.brokerContact.lastName}`}
                subtitle={property.brokerContact.email}
                badge="Broker"
                avatarInitials={getInitials(property.brokerContact.firstName, property.brokerContact.lastName)}
              />
            )}
            {property.listingAgent && property.listingAgent.id !== property.brokerContact?.id && (
              <AssociationRow
                entityType="contact"
                entityId={property.listingAgent.id}
                name={`${property.listingAgent.firstName} ${property.listingAgent.lastName}`}
                subtitle={property.listingAgent.email}
                badge="Agent"
                avatarInitials={getInitials(property.listingAgent.firstName, property.listingAgent.lastName)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Companies */}
      <AssociationCard
        type="Companies"
        icon={Building2}
        items={property.companies || []}
        onAdd={() => {}}
        renderItem={(company) => (
          <AssociationRow
            key={company.id}
            entityType="company"
            entityId={company.id}
            name={company.name}
            subtitle={company.industry ? fmtLabel(company.industry) : undefined}
            badge={company.relationship ? fmtLabel(company.relationship) : undefined}
            avatarInitials={company.name.slice(0, 2).toUpperCase()}
          />
        )}
      />

      {/* Contacts */}
      <AssociationCard
        type="Contacts"
        icon={Users}
        items={property.contacts || []}
        onAdd={() => {}}
        renderItem={(contact) => (
          <AssociationRow
            key={contact.id}
            entityType="contact"
            entityId={contact.id}
            name={`${contact.firstName} ${contact.lastName}`}
            subtitle={contact.position || contact.email}
            badge={contact.relationship ? fmtLabel(contact.relationship) : contact.contactTag ? fmtLabel(contact.contactTag) : undefined}
            avatarInitials={getInitials(contact.firstName, contact.lastName)}
          />
        )}
      />

      {/* Deals */}
      <AssociationCard
        type="Deals"
        icon={DollarSign}
        items={property.deals || []}
        onAdd={() => {}}
        renderItem={(deal) => (
          <AssociationRow
            key={deal.id}
            entityType="deal"
            entityId={deal.id}
            name={deal.name}
            subtitle={deal.value ? fmtCurrency(deal.value) : undefined}
            badge={deal.stage ? fmtLabel(deal.stage) : undefined}
            badgeColor={stageColors[deal.stage]}
            avatarInitials={deal.name.slice(0, 2).toUpperCase()}
          />
        )}
      />

      {/* Recent Activities */}
      {property.recentActivities?.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-4 pt-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-gray-400" />
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {property.recentActivities.slice(0, 4).map((a) => {
              const AIcon = activityIconMap[a.type] || Activity;
              return (
                <div key={a.id} className="flex items-start gap-2 py-1">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <AIcon className="h-3 w-3 text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white truncate leading-tight">{a.subject}</p>
                    <p className="text-[10px] text-gray-500">{fmtDate(a.scheduledAt || a.completedAt)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Storage Breakdown Tab ─────────────────────────────────

function StorageBreakdownTab({ entries }: { entries: PropertyRecord['storageEntries'] }) {
  if (!entries || entries.length === 0) return null;

  const totalCapacity = entries.reduce((s, e) => s + e.capacity, 0);
  const totalOccupied = entries.reduce((s, e) => s + e.occupied, 0);
  const overallOccupancy = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Capacity</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{totalCapacity.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Occupied</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{totalOccupied.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Occupancy</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{Math.round(overallOccupancy)}%</p>
        </CardContent></Card>
      </div>

      {/* Per-type breakdown */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Storage Types</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {entries.map((entry) => {
            const pct = entry.capacity > 0 ? (entry.occupied / entry.capacity) * 100 : 0;
            return (
              <div key={entry.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Anchor className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.storageTypeName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{entry.occupied}/{entry.capacity}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{Math.round(pct)}%</span>
                    {entry.rate && <span className="text-primary">{fmtCurrency(entry.rate)}/{entry.rateType || 'mo'}</span>}
                  </div>
                </div>
                <Progress value={pct} className={cn("h-1.5", pct >= 90 ? "[&>div]:bg-green-500" : pct >= 70 ? "[&>div]:bg-blue-500" : "[&>div]:bg-gray-400")} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Deals Tab ─────────────────────────────────────────────

function PropertyDealsTab({ deals, onNavigate }: { deals: PropertyRecord['deals']; onNavigate: (url: string) => void }) {
  if (!deals || deals.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No deals linked to this property</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <Card key={deal.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate(`/crm/deals/${deal.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deal.name}</p>
                  <Badge variant="outline" className={cn("text-[10px]", stageColors[deal.stage])}>{fmtLabel(deal.stage)}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {deal.value && <span className="font-medium text-gray-700 dark:text-gray-300">{fmtCurrency(deal.value)}</span>}
                  {deal.probability != null && <span>{deal.probability}% prob.</span>}
                  {deal.expectedCloseDate && <span>Close: {fmtDate(deal.expectedCloseDate)}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Price History Tab ─────────────────────────────────────

function PriceHistoryTab({ history }: { history: PropertyRecord['askingPriceHistory'] }) {
  if (!history || history.length === 0) return null;

  const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Asking Price History</CardTitle></CardHeader>
      <CardContent className="space-y-0">
        {sorted.map((entry, i) => {
          const prev = sorted[i + 1];
          const change = prev ? ((entry.price - prev.price) / prev.price) * 100 : null;
          return (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <div className="text-xs text-gray-500 w-20 flex-shrink-0">{fmtDate(entry.date)}</div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtCurrency(entry.price)}</span>
              </div>
              {change != null && (
                <Badge variant="outline" className={cn("text-[10px]", change > 0 ? "text-red-600" : change < 0 ? "text-green-600" : "text-gray-500")}>
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </Badge>
              )}
              {entry.notes && <span className="text-xs text-gray-500 truncate max-w-[150px]">{entry.notes}</span>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Notes Tab ─────────────────────────────────────────────

function NotesTab({ notes }: { notes: PropertyRecord['notes'] }) {
  if (!notes || notes.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No notes yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Card key={note.id} className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">{note.content}</p>
            <p className="text-[10px] text-gray-400 mt-2">{fmtDate(note.createdAt)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────

const activityIconMap: Record<string, typeof Activity> = {
  call: Phone, email: Mail, meeting: Users, task: FileText,
  note: MessageSquare, follow_up: Clock, site_visit: MapPin,
};

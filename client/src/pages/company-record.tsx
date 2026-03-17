import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Globe, Phone, Mail, MapPin, Users, Briefcase,
  Calendar, DollarSign, TrendingUp, Activity, Star, ExternalLink,
  Clock, Tag, Flame, Thermometer, ShieldCheck, FileText,
  MessageSquare, Home, Anchor, ChevronRight, ArrowUpRight,
  Linkedin, Twitter, Hash, Target, BarChart3, Zap,
} from 'lucide-react';
import {
  CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard, AssociationRow,
} from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';
import {
  CompanyPortfolioTab,
  CompanyIntelTab,
  CompanyModelsTab,
  CompanyActivitiesTab,
  CompanyContactsTabEnhanced,
  CompanyDealsTabEnhanced,
} from '@/components/crm/CompanyRecordTabs';
import { format } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

interface CompanyRecord {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  labels: string[] | null;
  annualRevenue: string | null;
  annualMarinaSpend: string | null;
  acquisitionInterest: string | null;
  portfolioCount: number | null;
  isPortfolioCompany: boolean;
  capitalPartner: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  linkedInUrl: string | null;
  twitterHandle: string | null;
  employeeCount: number | null;
  tags: string[] | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string } | null;
  activities: { openCount: number; overdueCount: number; nextActivity: any | null };
  timeline: Array<{ id: string; eventType: string; title: string; createdAt: string }>;
  contacts: Array<{ id: string; firstName: string; lastName: string; email: string; phone: string | null; position: string | null; role: string | null; isPrimary: boolean; contactTag: string | null; leadStatus: string | null }>;
  properties: Array<{ id: string; title: string; type: string; status: string; city: string | null; state: string | null; listingPrice: string | null; wetSlips: number | null; relationship: string | null }>;
  deals: Array<{ id: string; name: string; value: string | null; stage: string; probability: number | null; expectedCloseDate: string | null }>;
  recentActivities: Array<{ id: string; type: string; subject: string; status: string; scheduledAt: string | null; completedAt: string | null }>;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; pipelineValue?: number; engagementScore30d?: number };
  // Institutional profile
  companyType?: string | null;
  aumRange?: string | null;
  aumApprox?: string | null;
  investmentMandate?: string | null;
  ndaOnFile?: boolean;
  ndaExpiryDate?: string | null;
  targetAssetClasses?: string[] | null;
}

// ── Color maps ────────────────────────────────────────────

const industryColors: Record<string, string> = {
  marina: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  marine: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  real_estate: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  technology: 'bg-purple-50 text-purple-700 border-purple-200',
  finance: 'bg-amber-50 text-amber-700 border-amber-200',
  hospitality: 'bg-rose-50 text-rose-700 border-rose-200',
  construction: 'bg-orange-50 text-orange-700 border-orange-200',
};

const crmFirmTypeLabels: Record<string, string> = {
  brokerage: 'Brokerage',
  private_equity: 'Private Equity',
  family_office: 'Family Office',
  reit: 'REIT',
  owner_operator: 'Owner-Operator',
  debt_fund: 'Lender / Debt Fund',
  syndicator: 'Syndicator',
  property_management: 'Property Mgmt',
  legal_title: 'Legal / Title',
  government: 'Government',
  other: 'Other',
};

const aumRangeLabels: Record<string, string> = {
  under_10m: 'Under $10M',
  '10m_100m': '$10M–$100M',
  '100m_1b': '$100M–$1B',
  over_1b: 'Over $1B',
};

const stageColors: Record<string, string> = {
  discovery: 'bg-blue-50 text-blue-700',
  qualification: 'bg-indigo-50 text-indigo-700',
  proposal: 'bg-purple-50 text-purple-700',
  negotiation: 'bg-amber-50 text-amber-700',
  closed_won: 'bg-green-50 text-green-700',
  closed_lost: 'bg-red-50 text-red-700',
};

const acquisitionConfig: Record<string, { color: string; icon: any; bg: string; text: string }> = {
  hot: { color: 'text-red-600', icon: Flame, bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800', text: 'Actively pursuing — high priority' },
  warm: { color: 'text-orange-500', icon: Thermometer, bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800', text: 'Moderate interest — monitoring' },
  cold: { color: 'text-blue-500', icon: Thermometer, bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', text: 'Low priority' },
  none: { color: 'text-gray-400', icon: ShieldCheck, bg: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700', text: 'No interest' },
};

// ── Helpers ───────────────────────────────────────────────

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

function fmtLabel(str: string): string {
  return str.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
}

// ── Page Component ────────────────────────────────────────

export default function CompanyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: company, isLoading } = useQuery<CompanyRecord>({
    queryKey: ['crm-company-record', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/companies/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  if (!id) return null;

  const subtitle = company
    ? [company.industry ? fmtLabel(company.industry) : null, company.city && company.state ? `${company.city}, ${company.state}` : null].filter(Boolean).join(' · ')
    : undefined;

  // KPI chips
  const kpiChips = company ? [
    ...(company.contacts?.length ? [{
      label: 'Contacts',
      value: company.contacts.length,
      icon: Users,
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    }] : []),
    ...(company.deals?.length ? [{
      label: 'Deals',
      value: company.deals.length,
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    }] : []),
    ...(company.deals?.length ? [{
      label: 'Pipeline',
      value: fmtCurrency(company.deals.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0).toString()),
      icon: TrendingUp,
    }] : []),
    ...(company.properties?.length ? [{
      label: 'Properties',
      value: company.properties.length,
      icon: MapPin,
      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    }] : []),
    ...(company.annualRevenue ? [{
      label: 'Revenue',
      value: fmtCurrency(company.annualRevenue),
      icon: BarChart3,
    }] : []),
    { label: 'Open Deals', value: company.rollups?.openDealsCount || 0, icon: Target },
    { label: 'Pipeline', value: company.rollups?.pipelineValue ? formatCurrency(company.rollups.pipelineValue) : '$0', icon: DollarSign },
    { label: 'Engagement (30d)', value: company.rollups?.engagementScore30d || 0, icon: Activity },
  ] : [];

  const nextActivity = company?.activities?.nextActivity
    ? { id: company.activities.nextActivity.id, type: company.activities.nextActivity.type, subject: company.activities.nextActivity.subject || 'Upcoming', scheduledAt: company.activities.nextActivity.scheduledAt }
    : null;

  return (
    <CrmRecordPage
      entityType="company"
      entityId={id}
      entityName={company?.name || 'Loading...'}
      entitySubtitle={subtitle}
      entityAvatar={company && (
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-sm font-medium">
            {company.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      status={company?.industry ? fmtLabel(company.industry) : undefined}
      statusColor={company?.industry ? industryColors[company.industry.toLowerCase()] || 'bg-gray-100 text-gray-700' : undefined}
      statusExtra={company?.companyType ? (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
          {crmFirmTypeLabels[company.companyType] || company.companyType}
        </Badge>
      ) : undefined}
      ndaBadge={company?.ndaOnFile ? (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
          <ShieldCheck className="h-3 w-3" />NDA
        </Badge>
      ) : undefined}
      owner={company?.owner}
      isLoading={isLoading}
      kpiChips={kpiChips}
      nextActivity={nextActivity}

      // ── LEFT: About Sidebar ──
      aboutSidebar={company && <CompanyAboutSidebar company={company} />}

      // ── CENTER: Tabbed content ──
      centerTabs={company ? [
        {
          value: 'portfolio',
          label: 'Portfolio',
          count: company.properties?.length || 0,
          content: <CompanyPortfolioTab properties={company.properties || []} />,
        },
        {
          value: 'contacts',
          label: 'Contacts',
          count: company.contacts?.length || 0,
          content: <CompanyContactsTabEnhanced contacts={company.contacts || []} />,
        },
        {
          value: 'deals',
          label: 'Deals',
          count: company.deals?.length || 0,
          content: <CompanyDealsTabEnhanced deals={company.deals || []} />,
        },
        {
          value: 'activities',
          label: 'Activities',
          count: company.activities?.openCount || 0,
          content: <CompanyActivitiesTab companyId={id} />,
        },
        {
          value: 'models',
          label: 'Models',
          content: <CompanyModelsTab
            dealIds={company.deals?.map((d: any) => d.id)}
            propertyIds={company.properties?.map((p: any) => p.id)}
          />,
        },
        {
          value: 'intel',
          label: 'Intel',
          content: <CompanyIntelTab state={company.state} city={company.city} />,
        },
        {
          value: 'notes',
          label: 'Notes',
          count: company.notes?.length || 0,
          content: <NotesTab notes={company.notes} />,
        },
      ] : []}

      // ── RIGHT: Associations Sidebar ──
      rightSidebar={company && <CompanyAssociationsSidebar company={company} onNavigate={setLocation} />}
    />
  );
}

// ── About Sidebar ─────────────────────────────────────────

function CompanyAboutSidebar({ company }: { company: CompanyRecord }) {
  const acqConfig = acquisitionConfig[company.acquisitionInterest || 'none'] || acquisitionConfig.none;
  const AcqIcon = acqConfig.icon;

  return (
    <>
      {/* Company Info */}
      <RecordFieldGroup title="Company Info" icon={Building2}>
        <RecordField label="Phone" value={company.phone} icon={Phone} href={company.phone ? `tel:${company.phone}` : undefined} />
        <RecordField label="Website" value={company.website || company.domain} icon={Globe} href={company.website || (company.domain ? `https://${company.domain}` : undefined)} />
        <RecordField
          label="Location"
          value={[company.address, [company.city, company.state].filter(Boolean).join(', '), company.zipCode].filter(Boolean).join(', ') || null}
          icon={MapPin}
        />
        {company.size && <RecordField label="Size" value={company.size} icon={Users} />}
        {company.employeeCount && <RecordField label="Employees" value={company.employeeCount.toLocaleString()} icon={Users} />}
      </RecordFieldGroup>

      {/* Financial */}
      <RecordFieldGroup title="Financial" icon={DollarSign}>
        <RecordField label="Annual Revenue" value={company.annualRevenue ? fmtCurrency(company.annualRevenue) : null} icon={TrendingUp} />
        {company.annualMarinaSpend && <RecordField label="Marina Spend" value={fmtCurrency(company.annualMarinaSpend)} icon={Anchor} />}
        {company.capitalPartner && <RecordField label="Capital Partner" value={company.capitalPartner} icon={Briefcase} />}
      </RecordFieldGroup>

      {/* Acquisition Interest */}
      {company.acquisitionInterest && company.acquisitionInterest !== 'none' && (
        <Card className={cn("shadow-sm border", acqConfig.bg)}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AcqIcon className={cn("h-4 w-4", acqConfig.color)} />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Acquisition: {fmtLabel(company.acquisitionInterest)}
              </span>
            </div>
            <p className="text-xs text-gray-500">{acqConfig.text}</p>
          </CardContent>
        </Card>
      )}

      {/* Portfolio */}
      {/* Institutional Profile */}
      {(company.companyType || company.aumRange || company.investmentMandate || company.targetAssetClasses?.length) && (
        <RecordFieldGroup label="Institutional Profile" icon={TrendingUp}>
          {company.companyType && (
            <RecordField
              label="Firm Type"
              value={crmFirmTypeLabels[company.companyType] || company.companyType}
              icon={Building2}
            />
          )}
          {(company.aumRange || company.aumApprox) && (
            <RecordField
              label="AUM"
              value={[
                company.aumRange ? aumRangeLabels[company.aumRange] || company.aumRange : null,
                company.aumApprox ? formatCurrency(company.aumApprox) : null,
              ].filter(Boolean).join(' · ') || '—'}
              icon={DollarSign}
            />
          )}
          {company.targetAssetClasses && company.targetAssetClasses.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {company.targetAssetClasses.map(ac => (
                <Badge key={ac} variant="secondary" className="text-[10px] capitalize">{ac.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          )}
          {company.investmentMandate && (
            <RecordField label="Mandate" value={company.investmentMandate} icon={FileText} />
          )}
          {company.ndaOnFile && (
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">NDA on file</span>
              {company.ndaExpiryDate && (
                <span className="text-xs text-muted-foreground">· expires {company.ndaExpiryDate}</span>
              )}
            </div>
          )}
        </RecordFieldGroup>
      )}

      {(company.isPortfolioCompany || company.portfolioCount) && (
        <RecordFieldGroup title="Portfolio" icon={Anchor}>
          {company.isPortfolioCompany && (
            <RecordField label="Status" value={<Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">Portfolio Company</Badge>} />
          )}
          {company.portfolioCount != null && <RecordField label="Properties" value={String(company.portfolioCount)} icon={Home} />}
        </RecordFieldGroup>
      )}

      {/* Social */}
      {(company.linkedInUrl || company.twitterHandle) && (
        <RecordFieldGroup title="Social" icon={Globe}>
          {company.linkedInUrl && <RecordField label="LinkedIn" value="Company Page" icon={Linkedin} href={company.linkedInUrl} />}
          {company.twitterHandle && <RecordField label="X / Twitter" value={`@${company.twitterHandle.replace('@', '')}`} icon={Twitter} href={`https://x.com/${company.twitterHandle.replace('@', '')}`} />}
        </RecordFieldGroup>
      )}

      {/* Description */}
      {company.description && (
        <RecordFieldGroup title="Description" icon={FileText} collapsible>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{company.description}</p>
        </RecordFieldGroup>
      )}

      {/* Labels / Tags */}
      {((company.labels?.length || 0) > 0 || (company.tags?.length || 0) > 0) && (
        <RecordFieldGroup title="Labels" icon={Tag} collapsible defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {company.labels?.map(l => <Badge key={l} variant="secondary" className="text-xs">{fmtLabel(l)}</Badge>)}
            {company.tags?.map(t => <Badge key={t} variant="outline" className="text-xs">{fmtLabel(t)}</Badge>)}
          </div>
        </RecordFieldGroup>
      )}

      {/* Record metadata */}
      <RecordFieldGroup title="Record" icon={Calendar} collapsible defaultOpen={false}>
        <RecordField label="Created" value={fmtDate(company.createdAt)} icon={Calendar} />
        <RecordField label="Updated" value={fmtDate(company.updatedAt)} icon={Clock} />
      </RecordFieldGroup>
    </>
  );
}

// ── Associations Sidebar ──────────────────────────────────

function CompanyAssociationsSidebar({ company, onNavigate }: { company: CompanyRecord; onNavigate: (url: string) => void }) {
  return (
    <>
      {/* Properties */}
      <AssociationCard
        type="Properties"
        icon={MapPin}
        items={company.properties || []}
        onAdd={() => {}}
        renderItem={(prop) => (
          <AssociationRow
            key={prop.id}
            entityType="property"
            entityId={prop.id}
            name={prop.title || 'Untitled'}
            subtitle={[prop.city, prop.state].filter(Boolean).join(', ') || (prop.wetSlips ? `${prop.wetSlips} slips` : undefined)}
            badge={prop.relationship ? fmtLabel(prop.relationship) : prop.status ? fmtLabel(prop.status) : undefined}
            avatarInitials={(prop.title || 'P').slice(0, 2).toUpperCase()}
          />
        )}
      />

      {/* Deals */}
      <AssociationCard
        type="Deals"
        icon={DollarSign}
        items={company.deals || []}
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
      {company.recentActivities?.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-4 pt-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-gray-400" />
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {company.recentActivities.slice(0, 4).map((a) => {
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

// ── Contacts Tab ──────────────────────────────────────────

function CompanyContactsTab({ contacts, onNavigate }: { contacts: CompanyRecord['contacts']; onNavigate: (url: string) => void }) {
  if (!contacts || contacts.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No contacts linked to this company</p>
        </CardContent>
      </Card>
    );
  }

  // Sort: primary first, then alphabetical
  const sorted = [...contacts].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  return (
    <div className="space-y-2">
      {sorted.map((contact) => (
        <Card
          key={contact.id}
          className="shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onNavigate(`/crm/contacts/${contact.id}`)}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                  {getInitials(contact.firstName, contact.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {contact.firstName} {contact.lastName}
                  </p>
                  {contact.isPrimary && (
                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 h-4 px-1.5">Primary</Badge>
                  )}
                  {contact.contactTag && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{fmtLabel(contact.contactTag)}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  {contact.position && <span>{contact.position}</span>}
                  {contact.email && <span className="truncate">{contact.email}</span>}
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

// ── Deals Tab ─────────────────────────────────────────────

function CompanyDealsTab({ deals, onNavigate }: { deals: CompanyRecord['deals']; onNavigate: (url: string) => void }) {
  if (!deals || deals.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No deals linked to this company</p>
        </CardContent>
      </Card>
    );
  }

  const totalPipeline = deals.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Deals</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{deals.length}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pipeline</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{fmtCurrency(totalPipeline.toString())}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Prob.</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {deals.length ? Math.round(deals.reduce((s, d) => s + (d.probability || 0), 0) / deals.length) : 0}%
          </p>
        </CardContent></Card>
      </div>
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
                    {deal.expectedCloseDate && <span>Close: {fmtDate(deal.expectedCloseDate)}</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────

function NotesTab({ notes }: { notes: CompanyRecord['notes'] }) {
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

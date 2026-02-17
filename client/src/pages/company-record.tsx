import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Building2, Globe, Phone, Mail, MapPin, Users, Briefcase,
  Calendar, DollarSign, TrendingUp, Activity, Star, ExternalLink,
  Clock, Tag, Flame, Thermometer, ShieldCheck, FileText,
  MessageSquare, Home, Anchor, ChevronRight, ArrowUpRight,
  Linkedin, Twitter
} from 'lucide-react';
import { CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard } from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';

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
}

const industryColors: Record<string, string> = {
  marina: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  marine: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  real_estate: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  technology: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  finance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  hospitality: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  construction: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  healthcare: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const stageColors: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-700',
  qualification: 'bg-indigo-100 text-indigo-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
};

const acquisitionConfig: Record<string, { color: string; icon: any; bg: string; text: string }> = {
  hot: { color: 'text-red-600', icon: Flame, bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800', text: 'Actively pursuing acquisition — high priority target' },
  warm: { color: 'text-orange-500', icon: Thermometer, bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800', text: 'Moderate interest — monitoring for opportunities' },
  cold: { color: 'text-blue-500', icon: Thermometer, bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', text: 'Low priority — not currently pursuing' },
  none: { color: 'text-gray-400', icon: ShieldCheck, bg: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700', text: 'No acquisition interest indicated' },
  unknown: { color: 'text-gray-300', icon: ShieldCheck, bg: 'bg-gray-50 border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-600', text: 'Acquisition interest has not been assessed' },
};

const activityIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: FileText,
  note: MessageSquare,
  default: Activity,
};

function formatCurrency(value: string | null): string {
  if (!value) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function formatLabel(str: string): string {
  return str.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

export default function CompanyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: company, isLoading } = useQuery<CompanyRecord>({
    queryKey: ['/api/crm/summary/companies', id, 'summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/summary/companies/${id}/summary`);
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading || !company) {
    return (
      <CrmRecordPage
        entityType="company"
        entityId={id || ''}
        entityName=""
        isLoading={true}
        overviewLeft={null}
      />
    );
  }

  const industryLabel = company.industry ? formatLabel(company.industry) : null;
  const industryColor = industryColors[company.industry || 'default'] || industryColors.default;
  const acqInterest = acquisitionConfig[company.acquisitionInterest || 'unknown'] || acquisitionConfig.unknown;
  const AcqIcon = acqInterest.icon;

  const formatAddress = () => {
    const line1 = company.address;
    const line2 = [company.city, company.state].filter(Boolean).join(', ');
    const line3 = [company.zipCode, company.country].filter(Boolean).join(' ');
    const parts = [line1, line2, line3].filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : null;
  };

  const sortedContacts = [...(company.contacts || [])].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  const overviewLeft = (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{company.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {industryLabel && (
                  <Badge className={industryColor}>{industryLabel}</Badge>
                )}
                {company.size && (
                  <Badge variant="outline" className="capitalize">{company.size}</Badge>
                )}
                {company.isPortfolioCompany && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <Star className="h-3 w-3 mr-1" />
                    Portfolio Company
                  </Badge>
                )}
              </div>
              {company.isPortfolioCompany && company.capitalPartner && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  <span className="font-medium">Capital Partner:</span> {company.capitalPartner}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact & Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RecordField icon={Phone} label="Phone" value={company.phone} />
          <RecordField
            icon={Globe}
            label="Website"
            value={company.website}
            href={company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : undefined}
          />
          <RecordField icon={Globe} label="Domain" value={company.domain} />
          {formatAddress() && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{formatAddress()}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Financial Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-gray-50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Annual Revenue</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(company.annualRevenue)}</p>
            </div>
            <div className="rounded-lg border bg-gray-50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Anchor className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Marina Spend</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(company.annualMarinaSpend)}</p>
            </div>
            <div className="rounded-lg border bg-gray-50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Portfolio Count</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{company.portfolioCount ?? '—'}</p>
            </div>
            <div className="rounded-lg border bg-gray-50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-indigo-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Employees</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{company.employeeCount?.toLocaleString() ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`border ${acqInterest.bg}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Acquisition Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${company.acquisitionInterest === 'hot' ? 'bg-red-100 dark:bg-red-900/40' : company.acquisitionInterest === 'warm' ? 'bg-orange-100 dark:bg-orange-900/40' : company.acquisitionInterest === 'cold' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <AcqIcon className={`h-6 w-6 ${acqInterest.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold capitalize text-gray-900 dark:text-white">
                {company.acquisitionInterest || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{acqInterest.text}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(company.linkedInUrl || company.twitterHandle || company.domain) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Social & Online</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.linkedInUrl && (
              <a href={company.linkedInUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Linkedin className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-primary hover:underline truncate">LinkedIn Profile</span>
                <ArrowUpRight className="h-3 w-3 text-gray-400 ml-auto flex-shrink-0" />
              </a>
            )}
            {company.twitterHandle && (
              <a href={`https://twitter.com/${company.twitterHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Twitter className="h-4 w-4 text-sky-500" />
                <span className="text-sm text-primary hover:underline truncate">@{company.twitterHandle.replace('@', '')}</span>
                <ArrowUpRight className="h-3 w-3 text-gray-400 ml-auto flex-shrink-0" />
              </a>
            )}
            {company.domain && (
              <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Globe className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-primary hover:underline truncate">{company.domain}</span>
                <ArrowUpRight className="h-3 w-3 text-gray-400 ml-auto flex-shrink-0" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {company.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{company.description}</p>
          </CardContent>
        </Card>
      )}

      {((company.labels && company.labels.length > 0) || (company.tags && company.tags.length > 0)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Labels & Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {company.labels?.map((label, i) => (
                <Badge key={`label-${i}`} className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  <Tag className="h-3 w-3 mr-1" />
                  {label}
                </Badge>
              ))}
              {company.tags?.map((tag, i) => (
                <Badge key={`tag-${i}`} variant="outline" className="text-gray-600 dark:text-gray-300">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  const overviewRight = (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Users className="h-5 w-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{company.contacts?.length || 0}</p>
              <p className="text-xs text-gray-500">Contacts</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <Home className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{company.properties?.length || 0}</p>
              <p className="text-xs text-gray-500">Properties</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Briefcase className="h-5 w-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{company.deals?.length || 0}</p>
              <p className="text-xs text-gray-500">Active Deals</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <Activity className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{company.activities?.openCount || 0}</p>
              <p className="text-xs text-gray-500">Open Activities</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {company.activities?.nextActivity && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Next Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800">
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                {(() => {
                  const NextIcon = activityIcons[company.activities.nextActivity.type] || activityIcons.default;
                  return <NextIcon className="h-4 w-4 text-blue-600" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{company.activities.nextActivity.subject}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{formatDateTime(company.activities.nextActivity.scheduledAt)}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {(!company.recentActivities || company.recentActivities.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-0">
              {company.recentActivities.slice(0, 5).map((act, i) => {
                const ActIcon = activityIcons[act.type] || activityIcons.default;
                return (
                  <div key={act.id} className="flex items-start gap-3 py-2.5 relative">
                    {i < Math.min(company.recentActivities.length, 5) - 1 && (
                      <div className="absolute left-[11px] top-[30px] bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                    )}
                    <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 z-10">
                      <ActIcon className="h-3 w-3 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{act.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">{act.status}</Badge>
                        <span className="text-[10px] text-gray-400">{formatDate(act.completedAt || act.scheduledAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  const associationsContent = (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team / Contacts
            <Badge variant="secondary" className="ml-2">{sortedContacts.length}</Badge>
          </CardTitle>
          <CardDescription>People associated with this company</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedContacts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No contacts linked</p>
          ) : (
            <div className="space-y-2">
              {sortedContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/crm/contacts/${contact.id}`)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(contact.firstName, contact.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      {contact.isPrimary && (
                        <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">Primary</Badge>
                      )}
                      {contact.contactTag && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{contact.contactTag}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {contact.email && (
                        <span className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />{contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <Phone className="h-3 w-3" />{contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {(contact.role || contact.position) && (
                      <p className="text-xs text-gray-500">{contact.role || contact.position}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Properties
            <Badge variant="secondary" className="ml-2">{company.properties?.length || 0}</Badge>
          </CardTitle>
          <CardDescription>Properties associated with this company</CardDescription>
        </CardHeader>
        <CardContent>
          {(!company.properties || company.properties.length === 0) ? (
            <p className="text-sm text-gray-500 text-center py-6">No properties linked</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {company.properties.map((prop) => (
                <div
                  key={prop.id}
                  className="p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/crm/properties/${prop.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{prop.title}</p>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{formatLabel(prop.type)}</Badge>
                    <Badge className={`text-[10px] ${prop.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{formatLabel(prop.status)}</Badge>
                    {prop.relationship && (
                      <Badge variant="outline" className="text-[10px]">{formatLabel(prop.relationship)}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {(prop.city || prop.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{[prop.city, prop.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {prop.listingPrice && (
                      <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                        <DollarSign className="h-3 w-3" />{formatCurrency(prop.listingPrice)}
                      </span>
                    )}
                    {prop.wetSlips != null && (
                      <span className="flex items-center gap-1">
                        <Anchor className="h-3 w-3" />{prop.wetSlips} slips
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Deals
            <Badge variant="secondary" className="ml-2">{company.deals?.length || 0}</Badge>
          </CardTitle>
          <CardDescription>Active and historical deals</CardDescription>
        </CardHeader>
        <CardContent>
          {(!company.deals || company.deals.length === 0) ? (
            <p className="text-sm text-gray-500 text-center py-6">No deals linked</p>
          ) : (
            <div className="space-y-2">
              {company.deals.map((deal) => {
                const stageColor = stageColors[deal.stage?.toLowerCase().replace(/\s+/g, '_')] || stageColors.default;
                return (
                  <div
                    key={deal.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/crm/deals/${deal.id}`)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-green-50 dark:bg-green-950/20 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deal.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-[10px] ${stageColor}`}>{formatLabel(deal.stage)}</Badge>
                        {deal.probability != null && (
                          <span className="text-xs text-gray-500">{deal.probability}% likely</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {deal.value && (
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(deal.value)}</p>
                      )}
                      {deal.expectedCloseDate && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-0.5">
                          <Calendar className="h-3 w-3" />{formatDate(deal.expectedCloseDate)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const activityTab = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!company.recentActivities || company.recentActivities.length === 0) ? (
          <p className="text-sm text-gray-500 text-center py-8">No activities recorded</p>
        ) : (
          <div className="space-y-3">
            {company.recentActivities.slice(0, 5).map((act) => {
              const ActIcon = activityIcons[act.type] || activityIcons.default;
              return (
                <div key={act.id} className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <ActIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{act.subject}</p>
                    <p className="text-xs text-gray-500 capitalize">{act.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant="outline" className="capitalize text-xs">{act.status}</Badge>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(act.completedAt || act.scheduledAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const notesTab = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!company.notes || company.notes.length === 0) ? (
          <p className="text-sm text-gray-500 text-center py-8">No notes yet</p>
        ) : (
          <div className="space-y-4">
            {company.notes.map((note) => (
              <div key={note.id} className="p-4 rounded-lg border bg-gray-50/50 dark:bg-gray-800/30">
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{formatDateTime(note.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <CrmRecordPage
      entityType="company"
      entityId={id || ''}
      entityName={company.name}
      entitySubtitle={industryLabel || undefined}
      status={company.size ? formatLabel(company.size) : undefined}
      statusColor={industryColor}
      owner={company.owner}
      overviewLeft={overviewLeft}
      overviewRight={overviewRight}
      associationsContent={associationsContent}
      customTabs={[
        { value: 'activity', label: 'Activity', content: activityTab },
        { value: 'notes', label: 'Notes', content: notesTab },
      ]}
    />
  );
}

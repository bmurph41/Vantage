import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User, Mail, Phone, MapPin, Building2, Briefcase, Globe, Calendar,
  DollarSign, Activity, Star, ExternalLink, Clock, Tag, Users, Home,
  Target, TrendingUp, MessageSquare, FileText, ChevronRight, Heart, ArrowUpRight,
} from 'lucide-react';
import { SiLinkedin, SiTwitter } from 'react-icons/si';
import { format } from 'date-fns';
import { CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard } from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';
import { useProspectingActivity } from '@/contexts/ProspectingActivityContext';

interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phones: Array<{ type: string; number: string }> | null;
  position: string | null;
  address: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  company: string | null;
  role: string | null;
  contactType: string | null;
  contactTag: string | null;
  leadStatus: string | null;
  leadScore: string | null;
  leadSource: string | null;
  communicationPreference: string | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  birthday: string | null;
  anniversary: string | null;
  onDealTeam: boolean;
  dealTeamNotes: string | null;
  labels: string[] | null;
  photoDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string } | null;
  primaryCompany: { id: string; name: string; industry: string | null } | null;
  activities: { openCount: number; overdueCount: number; nextActivity: any | null };
  timeline: Array<{ id: string; eventType: string; title: string; createdAt: string }>;
  companies: Array<{ id: string; name: string; industry: string | null; role: string | null; isPrimary: boolean }>;
  properties: Array<{ id: string; title: string; type: string; status: string; city: string | null; state: string | null; relationship: string | null }>;
  deals: Array<{ id: string; name: string; value: string | null; stage: string; probability: number | null; expectedCloseDate: string | null }>;
  recentActivities: Array<{ id: string; type: string; subject: string; status: string; scheduledAt: string | null; completedAt: string | null; notes: string | null }>;
  notes: Array<{ id: string; content: string; createdAt: string }>;
}

const tagColors: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  seller: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  broker: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  vendor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  buyer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  investor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  tenant: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  partner: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const stageColors: Record<string, string> = {
  prospecting: 'bg-blue-100 text-blue-700',
  qualification: 'bg-cyan-100 text-cyan-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  'closed-won': 'bg-emerald-100 text-emerald-700',
  'closed-lost': 'bg-red-100 text-red-700',
};

const leadStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-cyan-100 text-cyan-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  unqualified: 'bg-gray-100 text-gray-700',
  nurturing: 'bg-amber-100 text-amber-700',
};

const activityTypeIcons: Record<string, typeof Activity> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  task: FileText,
  note: MessageSquare,
};

function formatCurrency(value: string | number | null): string {
  if (!value) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return '-';
  }
}

function formatAddress(contact: ContactRecord): string | null {
  const parts = [
    contact.address,
    contact.unit ? `Unit ${contact.unit}` : null,
    [contact.city, contact.state].filter(Boolean).join(', '),
    contact.zipCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : null;
}

export default function ContactRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { setPendingActivity } = useProspectingActivity();

  const { data: contact, isLoading } = useQuery<ContactRecord>({
    queryKey: ['/api/crm/summary/contacts', id, 'summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/summary/contacts/${id}/summary`);
      return res.json();
    },
    enabled: !!id,
  });

  const handleAddToProspecting = () => {
    if (!contact) return;
    const fullName = `${contact.firstName} ${contact.lastName}`;
    setPendingActivity({
      contactId: id || '',
      contactName: fullName,
      companyId: contact.primaryCompany?.id,
      companyName: contact.primaryCompany?.name || contact.company || undefined,
    });
    setLocation('/prospecting');
  };

  if (isLoading || !contact) {
    return (
      <CrmRecordPage
        entityType="contact"
        entityId={id || ''}
        entityName=""
        isLoading={true}
        overviewLeft={null}
      />
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();
  const tagColor = contact.contactTag ? tagColors[contact.contactTag.toLowerCase()] || 'bg-gray-100 text-gray-700' : '';
  const statusBadge = contact.leadStatus ? leadStatusColors[contact.leadStatus.toLowerCase()] || 'bg-gray-100 text-gray-700' : '';
  const addressStr = formatAddress(contact);

  const heroCard = (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-5">
          <Avatar className="h-20 w-20 ring-2 ring-gray-100 dark:ring-gray-700">
            {contact.photoDataUrl && <AvatarImage src={contact.photoDataUrl} alt={fullName} />}
            <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {contact.contactTag && (
                <Badge className={`text-xs font-medium ${tagColor}`}>
                  {contact.contactTag}
                </Badge>
              )}
              {contact.leadStatus && (
                <Badge className={`text-xs font-medium ${statusBadge}`}>
                  {contact.leadStatus}
                </Badge>
              )}
              {contact.leadScore && (
                <Badge variant="outline" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Score: {contact.leadScore}
                </Badge>
              )}
            </div>
            {(contact.position || contact.role) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {[contact.position, contact.role].filter(Boolean).join(' · ')}
              </p>
            )}
            {contact.primaryCompany && (
              <button
                onClick={() => setLocation(`/crm/companies/${contact.primaryCompany!.id}`)}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
              >
                <Building2 className="h-3.5 w-3.5" />
                {contact.primaryCompany.name}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
            {!contact.primaryCompany && contact.company && (
              <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <Building2 className="h-3.5 w-3.5" />
                {contact.company}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const contactInfoCard = (
    <RecordFieldGroup title="Contact Information">
      <RecordField
        icon={Mail}
        label="Email"
        value={contact.email}
        href={contact.email ? `mailto:${contact.email}` : undefined}
      />
      {contact.phone && (
        <RecordField
          icon={Phone}
          label="Phone"
          value={contact.phone}
          href={`tel:${contact.phone}`}
        />
      )}
      {contact.phones?.map((p, i) => (
        <RecordField
          key={i}
          icon={Phone}
          label={p.type ? `${p.type.charAt(0).toUpperCase()}${p.type.slice(1)}` : 'Phone'}
          value={p.number}
          href={`tel:${p.number}`}
        />
      ))}
      {contact.communicationPreference && (
        <div className="flex items-start gap-3">
          <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Preferred Channel</p>
            <Badge variant="outline" className="text-xs mt-0.5">
              {contact.communicationPreference}
            </Badge>
          </div>
        </div>
      )}
      {addressStr && (
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{addressStr}</p>
          </div>
        </div>
      )}
    </RecordFieldGroup>
  );

  const professionalCard = (
    <RecordFieldGroup title="Professional Details">
      {contact.primaryCompany ? (
        <div
          className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 -m-2 rounded-md"
          onClick={() => setLocation(`/crm/companies/${contact.primaryCompany!.id}`)}
        >
          <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Company</p>
            <p className="text-sm text-primary hover:underline truncate">{contact.primaryCompany.name}</p>
            {contact.primaryCompany.industry && (
              <Badge variant="secondary" className="text-xs mt-1">{contact.primaryCompany.industry}</Badge>
            )}
          </div>
        </div>
      ) : contact.company ? (
        <RecordField icon={Building2} label="Company" value={contact.company} />
      ) : null}
      <RecordField icon={Briefcase} label="Position" value={contact.position} />
      <RecordField icon={User} label="Role" value={contact.role} />
      <RecordField icon={Tag} label="Contact Type" value={contact.contactType} />
      <RecordField icon={Target} label="Lead Source" value={contact.leadSource} />
      {contact.labels && contact.labels.length > 0 && (
        <div className="flex items-start gap-3">
          <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Labels</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {contact.labels.map((label, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </RecordFieldGroup>
  );

  const socialCard = (
    <RecordFieldGroup title="Social & Personal">
      {contact.linkedinUrl && (
        <div className="flex items-start gap-3">
          <SiLinkedin className="h-4 w-4 text-[#0077B5] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">LinkedIn</p>
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Profile
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
      {contact.twitterHandle && (
        <div className="flex items-start gap-3">
          <SiTwitter className="h-4 w-4 text-[#1DA1F2] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Twitter</p>
            <a
              href={`https://twitter.com/${contact.twitterHandle.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              @{contact.twitterHandle.replace('@', '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
      <RecordField icon={Calendar} label="Birthday" value={contact.birthday ? formatDate(contact.birthday) : null} />
      <RecordField icon={Heart} label="Anniversary" value={contact.anniversary ? formatDate(contact.anniversary) : null} />
    </RecordFieldGroup>
  );

  const hasSocialData = contact.linkedinUrl || contact.twitterHandle || contact.birthday || contact.anniversary;

  const dealTeamCard = contact.onDealTeam ? (
    <RecordFieldGroup title="Deal Team">
      <div className="flex items-start gap-3">
        <Users className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">
            Active Deal Team Member
          </Badge>
        </div>
      </div>
      {contact.dealTeamNotes && (
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
            <p className="text-sm text-gray-900 dark:text-white">{contact.dealTeamNotes}</p>
          </div>
        </div>
      )}
    </RecordFieldGroup>
  ) : null;

  const quickStats = (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{contact.deals?.length || 0}</p>
            <p className="text-xs text-gray-500">Total Deals</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Activity className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{contact.activities?.openCount || 0}</p>
            <p className="text-xs text-gray-500">Open Activities</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Clock className="h-5 w-5 mx-auto mb-1" style={{ color: (contact.activities?.overdueCount || 0) > 0 ? '#ef4444' : '#6b7280' }} />
            <p className={`text-2xl font-bold ${(contact.activities?.overdueCount || 0) > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
              {contact.activities?.overdueCount || 0}
            </p>
            <p className="text-xs text-gray-500">Overdue</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Home className="h-5 w-5 mx-auto text-violet-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{contact.properties?.length || 0}</p>
            <p className="text-xs text-gray-500">Properties</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const associationsContent = (
    <div className="space-y-6">
      {contact.companies && contact.companies.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Companies ({contact.companies.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {contact.companies.map((company) => (
              <Card
                key={company.id}
                className="cursor-pointer hover:shadow-md transition-shadow border hover:border-primary/30"
                onClick={() => setLocation(`/crm/companies/${company.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{company.name}</p>
                        {company.role && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{company.role}</p>
                        )}
                        {company.industry && (
                          <Badge variant="secondary" className="text-xs mt-1.5">{company.industry}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {company.isPrimary && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {contact.properties && contact.properties.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Home className="h-4 w-4" />
            Properties ({contact.properties.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {contact.properties.map((property) => (
              <Card
                key={property.id}
                className="cursor-pointer hover:shadow-md transition-shadow border hover:border-primary/30"
                onClick={() => setLocation(`/crm/properties/${property.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{property.title}</p>
                      {(property.city || property.state) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[property.city, property.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {property.type && (
                          <Badge variant="secondary" className="text-xs">{property.type}</Badge>
                        )}
                        {property.status && (
                          <Badge variant="outline" className="text-xs">{property.status}</Badge>
                        )}
                        {property.relationship && (
                          <Badge className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            {property.relationship}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {contact.deals && contact.deals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Deals ({contact.deals.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {contact.deals.map((deal) => {
              const sc = stageColors[deal.stage?.toLowerCase()] || 'bg-gray-100 text-gray-700';
              return (
                <Card
                  key={deal.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border hover:border-primary/30"
                  onClick={() => setLocation(`/crm/deals/${deal.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deal.name}</p>
                        {deal.value && (
                          <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-0.5">
                            {formatCurrency(deal.value)}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge className={`text-xs ${sc}`}>{deal.stage}</Badge>
                          {deal.probability != null && (
                            <span className="text-xs text-gray-500">{deal.probability}%</span>
                          )}
                        </div>
                        {deal.expectedCloseDate && (
                          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Close: {formatDate(deal.expectedCloseDate)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {(!contact.companies || contact.companies.length === 0) &&
       (!contact.properties || contact.properties.length === 0) &&
       (!contact.deals || contact.deals.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No associations found for this contact.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const recentActivityTab = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contact.recentActivities && contact.recentActivities.length > 0 ? (
          <div className="space-y-1">
            {contact.recentActivities.slice(0, 5).map((activity, idx) => {
              const IconComp = activityTypeIcons[activity.type?.toLowerCase()] || Activity;
              const isCompleted = activity.status?.toLowerCase() === 'completed';
              const isOverdue = activity.status?.toLowerCase() === 'overdue';
              return (
                <div key={activity.id}>
                  <div className="flex items-start gap-3 py-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                      isOverdue ? 'bg-red-100 dark:bg-red-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      <IconComp className={`h-4 w-4 ${
                        isCompleted ? 'text-emerald-600' :
                        isOverdue ? 'text-red-600' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{activity.subject}</p>
                        <Badge
                          variant="secondary"
                          className={`text-xs flex-shrink-0 ${
                            isCompleted ? 'bg-emerald-100 text-emerald-700' :
                            isOverdue ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {activity.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{activity.type}</Badge>
                        <span className="text-xs text-gray-500">
                          {activity.completedAt ? formatDate(activity.completedAt) : activity.scheduledAt ? formatDate(activity.scheduledAt) : ''}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{activity.notes}</p>
                      )}
                    </div>
                  </div>
                  {idx < Math.min(contact.recentActivities.length, 5) - 1 && <Separator />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <Activity className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No recent activities</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const notesTab = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contact.notes && contact.notes.length > 0 ? (
          <div className="space-y-1">
            {contact.notes.map((note, idx) => (
              <div key={note.id}>
                <div className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line line-clamp-4">
                      {note.content}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(note.createdAt)}
                  </p>
                </div>
                {idx < contact.notes.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No notes yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <CrmRecordPage
      entityType="contact"
      entityId={id || ''}
      entityName={fullName}
      entitySubtitle={contact.position || contact.role || undefined}
      status={contact.contactTag || undefined}
      statusColor={tagColor || undefined}
      owner={contact.owner}
      headerActions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddToProspecting}
          className="gap-2"
        >
          <Target className="h-4 w-4" />
          Add to Prospecting
        </Button>
      }
      overviewLeft={
        <div className="space-y-5">
          {heroCard}
          {contactInfoCard}
          {professionalCard}
          {hasSocialData && socialCard}
          {dealTeamCard}
          {quickStats}
        </div>
      }
      associationsContent={associationsContent}
      customTabs={[
        { value: 'recent-activity', label: 'Recent Activity', content: recentActivityTab },
        { value: 'notes', label: 'Notes', content: notesTab },
      ]}
    />
  );
}
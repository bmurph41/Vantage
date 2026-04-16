import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { ComposeEmailModal } from '@/components/email/compose-email-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  User, Mail, Phone, MapPin, Building2, Briefcase, Globe, Calendar,
  DollarSign, Activity, Star, ExternalLink, Clock, Tag, Users, Home,
  Target, TrendingUp, MessageSquare, FileText, ChevronRight, Heart,
  ArrowUpRight, Linkedin, Twitter, Hash, Zap,
} from 'lucide-react';
import { SiLinkedin, SiX } from 'react-icons/si';
import { format } from 'date-fns';
import {
  CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard, AssociationRow,
} from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';
import { RelationshipScoreBadge } from '@/components/crm/RelationshipScoreBadge';
import {
  ContactPropertiesTab,
  ContactIntelTab,
  ContactModelsTab,
  ContactActivitiesTab,
  ContactDealsTabEnhanced,
  ContactCommissionHistoryTab,
  ContactProspectingHistoryTab,
} from '@/components/crm/ContactRecordTabs';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { RelationshipMap } from '@/components/crm/RelationshipMap';
import { useProspectingActivity } from '@/contexts/ProspectingActivityContext';
import { Shield, AlertTriangle as ShieldAlert } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

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
  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; pipelineValue?: number; engagementScore30d?: number };
  // Investment profile fields
  crmRole?: string | null;
  sourceType?: string | null;
  linkedInUrl?: string | null;
  targetAssetClasses?: string[] | null;
  targetGeographies?: string[] | null;
  dealSizeMin?: string | null;
  dealSizeMax?: string | null;
  investmentNotes?: string | null;
  relationshipScore?: number | null;
  nextFollowupDate?: string | null;
  doNotContact?: boolean;
  gdprConsent?: boolean;
  gdprConsentDate?: string | null;
  emailOptOut?: boolean;
  smsOptOut?: boolean;
  mailOptOut?: boolean;
  ndaOnFile?: boolean;
  emailConsent?: boolean;
}

// ── Color maps ────────────────────────────────────────────

const crmRoleLabels: Record<string, string> = {
  owner: 'Owner', listing_broker: 'Listing Broker', buyers_broker: "Buyer's Broker",
  property_manager: 'Property Manager', lender: 'Lender', attorney: 'Attorney',
  appraiser: 'Appraiser', investor_lp: 'Investor (LP)', investor_gp: 'Investor (GP)',
  family_office: 'Family Office', institutional_buyer: 'Institutional Buyer',
  syndicator: 'Syndicator', government: 'Government', other: 'Other',
};

const crmRoleColors: Record<string, string> = {
  owner: 'bg-purple-50 text-purple-700 border-purple-200',
  listing_broker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  buyers_broker: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  lender: 'bg-blue-50 text-blue-700 border-blue-200',
  investor_lp: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  investor_gp: 'bg-violet-50 text-violet-700 border-violet-200',
  family_office: 'bg-amber-50 text-amber-700 border-amber-200',
  institutional_buyer: 'bg-teal-50 text-teal-700 border-teal-200',
};

const tagColors: Record<string, string> = {
  lead: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  seller: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  broker: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  vendor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  buyer: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300',
  investor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300',
  tenant: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300',
  partner: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300',
};

const stageColors: Record<string, string> = {
  prospecting: 'bg-blue-50 text-blue-700',
  qualification: 'bg-cyan-50 text-cyan-700',
  proposal: 'bg-amber-50 text-amber-700',
  negotiation: 'bg-orange-50 text-orange-700',
  'closed-won': 'bg-emerald-50 text-emerald-700',
  'closed-lost': 'bg-red-50 text-red-700',
};

const leadStatusColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unqualified: 'bg-gray-50 text-gray-700 border-gray-200',
  nurturing: 'bg-amber-50 text-amber-700 border-amber-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
};

// ── Helpers ───────────────────────────────────────────────

function fmtCurrency(value: string | number | null): string {
  if (!value) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'MM/dd/yyyy'); } catch { return '—'; }
}

function fmtLabel(str: string): string {
  return str.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getInitials(first: string, last: string): string {
  return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
}

function formatAddress(c: ContactRecord): string | null {
  const parts = [
    c.address,
    c.unit ? `Unit ${c.unit}` : null,
    [c.city, c.state].filter(Boolean).join(', '),
    c.zipCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ── Page Component ────────────────────────────────────────

export default function ContactRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isEmailComposeOpen, setIsEmailComposeOpen] = useState(false);

  const { data: contact, isLoading } = useQuery<ContactRecord>({
    queryKey: ['crm-contact-record', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/contacts/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  if (!id) return null;

  const fullName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : '';
  const subtitle = contact
    ? [contact.position, contact.company || contact.primaryCompany?.name].filter(Boolean).join(' · ')
    : undefined;

  // KPI chips for the highlights header
  const relScoreChip = contact?.relationshipScore != null ? {
    label: 'Relationship',
    value: contact.relationshipScore >= 80 ? 'Hot' : contact.relationshipScore >= 60 ? 'Warm' : contact.relationshipScore >= 40 ? 'Lukewarm' : 'Cold',
    icon: TrendingUp,
    color: contact.relationshipScore >= 80 ? 'text-red-600' : contact.relationshipScore >= 60 ? 'text-amber-600' : contact.relationshipScore >= 40 ? 'text-blue-600' : 'text-gray-500',
  } : null;

  const kpiChips = contact ? [
    ...(relScoreChip ? [relScoreChip] : []),
    ...(contact.deals?.length ? [{
      label: 'Deals',
      value: contact.deals.length,
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    }] : []),
    ...(contact.deals?.length ? [{
      label: 'Pipeline',
      value: fmtCurrency(contact.deals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0).toString()),
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    }] : []),
    ...(contact.activities?.openCount ? [{
      label: 'Open Activities',
      value: contact.activities.openCount,
      icon: Activity,
    }] : []),
    ...(contact.activities?.overdueCount ? [{
      label: 'Overdue',
      value: contact.activities.overdueCount,
      icon: Clock,
      color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
    }] : []),
    { label: 'Open Deals', value: contact.rollups?.openDealsCount || 0, icon: Target },
    { label: 'Pipeline', value: contact.rollups?.pipelineValue ? formatCurrency(contact.rollups.pipelineValue) : '$0', icon: DollarSign },
    { label: 'Engagement (30d)', value: contact.rollups?.engagementScore30d || 0, icon: Activity },
  ] : [];

  // Next activity
  const nextActivity = contact?.activities?.nextActivity
    ? {
        id: contact.activities.nextActivity.id,
        type: contact.activities.nextActivity.type,
        subject: contact.activities.nextActivity.subject || 'Upcoming activity',
        scheduledAt: contact.activities.nextActivity.scheduledAt,
      }
    : null;

  return (
    <>
    <CrmRecordPage
      entityType="contact"
      entityId={id}
      entityName={fullName || 'Loading...'}
      entitySubtitle={subtitle}
      entityAvatar={contact && (
        <Avatar className="h-9 w-9 flex-shrink-0">
          {contact.photoDataUrl && <AvatarImage src={contact.photoDataUrl} />}
          <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-medium">
            {getInitials(contact.firstName, contact.lastName)}
          </AvatarFallback>
        </Avatar>
      )}
      status={contact?.contactTag ? fmtLabel(contact.contactTag) : contact?.leadStatus ? fmtLabel(contact.leadStatus) : undefined}
      statusExtra={contact?.crmRole ? (
        <Badge variant="outline" className={`text-xs ${crmRoleColors[contact.crmRole] || 'bg-gray-50 text-gray-700'}`}>
          {crmRoleLabels[contact.crmRole] || contact.crmRole}
        </Badge>
      ) : undefined}
      statusColor={
        contact?.contactTag ? tagColors[contact.contactTag] || 'bg-gray-100 text-gray-700'
        : contact?.leadStatus ? leadStatusColors[contact.leadStatus] || 'bg-gray-100 text-gray-700'
        : undefined
      }
      owner={contact?.owner}
      isLoading={isLoading}
      kpiChips={kpiChips}
      headerActions={contact?.email && (
        <Button size="sm" variant="outline" onClick={() => setIsEmailComposeOpen(true)}>
          <Mail className="h-4 w-4 mr-1.5" />Email
        </Button>
      )}
      belowHeader={contact.nextFollowupDate && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
          <Clock className="h-3 w-3" />
          Follow-up: {fmtDate(contact.nextFollowupDate)}
        </div>
      )}
      nextActivity={nextActivity}

      // ── LEFT: About Sidebar ──
      aboutSidebar={contact && (
        <ContactAboutSidebar contact={contact} />
      )}

      // ── CENTER: Tabbed content ──
      centerTabs={contact ? [
        {
          value: 'deals',
          label: 'Deals',
          count: contact.deals?.length || 0,
          content: <ContactDealsTabEnhanced deals={contact.deals || []} />,
        },
        {
          value: 'properties',
          label: 'Properties',
          count: contact.properties?.length || 0,
          content: <ContactPropertiesTab properties={contact.properties || []} />,
        },
        {
          value: 'activities',
          label: 'Activities',
          count: contact.activities?.openCount || 0,
          content: <ContactActivitiesTab contactId={id} />,
        },
        {
          value: 'models',
          label: 'Models',
          content: <ContactModelsTab dealIds={contact.deals?.map((d: any) => d.id)} />,
        },
        {
          value: 'prospecting',
          label: 'Prospecting',
          content: <ContactProspectingHistoryTab contactId={id} />,
        },
        {
          value: 'intel',
          label: 'Intel',
          content: <ContactIntelTab state={contact.state} assetClasses={contact.targetAssetClasses} />,
        },
        {
          value: 'notes',
          label: 'Notes',
          count: contact.notes?.length || 0,
          content: <ContactNotesTab notes={contact.notes} />,
        },
        {
          value: 'timeline',
          label: 'Timeline',
          content: <ContactTimeline contactId={id} />,
        },
        {
          value: 'relationships',
          label: 'Relationships',
          content: <RelationshipMap entityId={id} entityType="contact" />,
        },
        {
          value: 'commissions',
          label: 'Commissions',
          content: <ContactCommissionHistoryTab contactId={id} />,
        },
      ] : []}

      // ── RIGHT: Associations Sidebar ──
      rightSidebar={contact && (
        <ContactAssociationsSidebar contact={contact} onNavigate={setLocation} />
      )}
    />
    {isEmailComposeOpen && (
      <ComposeEmailModal
        open={isEmailComposeOpen}
        onOpenChange={setIsEmailComposeOpen}
        defaultTo={contact?.email || ""}
        contactId={id}
        contactName={contact ? `${contact.firstName} ${contact.lastName}`.trim() : undefined}
      />
    )}
    </>
  );
}

// ── About Sidebar ─────────────────────────────────────────

function ContactAboutSidebar({ contact }: { contact: ContactRecord }) {
  const address = formatAddress(contact);

  return (
    <>
      {/* Contact Info */}
      <RecordFieldGroup title="Contact Info" icon={User}>
        <RecordField label="Email" value={contact.email} icon={Mail} href={`mailto:${contact.email}`} />
        <RecordField label="Phone" value={contact.phone} icon={Phone} href={contact.phone ? `tel:${contact.phone}` : undefined} />
        {contact.phones?.map((p, i) => (
          <RecordField key={i} label={`${fmtLabel(p.type)} Phone`} value={p.number} icon={Phone} href={`tel:${p.number}`} />
        ))}
        <RecordField label="Location" value={address} icon={MapPin} />
        <RecordField label="Timezone" value={contact.timezone || null} icon={Clock} />
      </RecordFieldGroup>

      {/* Professional */}
      <RecordFieldGroup title="Professional" icon={Briefcase}>
        <RecordField label="Position" value={contact.position} icon={Briefcase} />
        <RecordField label="Company" value={contact.company || contact.primaryCompany?.name} icon={Building2} />
        {contact.role && <RecordField label="Role" value={fmtLabel(contact.role)} icon={Tag} />}
        {contact.crmRole && <RecordField label="CRE Role" value={crmRoleLabels[contact.crmRole] || fmtLabel(contact.crmRole)} icon={Target} />}
        {contact.sourceType && <RecordField label="Source" value={fmtLabel(contact.sourceType)} icon={Zap} />}
        {contact.linkedInUrl && (
          <RecordField label="LinkedIn" value={
            <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1">
              View Profile <ExternalLink className="h-3 w-3" />
            </a>
          } icon={Linkedin} />
        )}
        {contact.contactType && <RecordField label="Type" value={fmtLabel(contact.contactType)} icon={Hash} />}
      </RecordFieldGroup>

      {/* Lead Info */}
      {(contact.crmRole === 'investor_lp' || contact.crmRole === 'investor_gp' || contact.crmRole === 'family_office' || contact.crmRole === 'institutional_buyer' || contact.targetAssetClasses?.length || contact.dealSizeMin || contact.investmentNotes) && (
        <RecordFieldGroup label="Investment Profile" icon={TrendingUp}>
          {(contact.dealSizeMin || contact.dealSizeMax) && (
            <RecordField
              label="Deal Size Range"
              value={[
                contact.dealSizeMin ? formatCurrency(parseFloat(contact.dealSizeMin)) : null,
                contact.dealSizeMax ? formatCurrency(parseFloat(contact.dealSizeMax)) : null,
              ].filter(Boolean).join(' – ') || '—'}
              icon={DollarSign}
            />
          )}
          {contact.targetAssetClasses && contact.targetAssetClasses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {contact.targetAssetClasses.map(ac => (
                <Badge key={ac} variant="secondary" className="text-xs capitalize">{ac.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          )}
          {contact.targetGeographies && contact.targetGeographies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {contact.targetGeographies.map(g => (
                <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
              ))}
            </div>
          )}
          {contact.investmentNotes && (
            <RecordField label="Notes" value={contact.investmentNotes} icon={FileText} />
          )}
        </RecordFieldGroup>
      )}

      {(contact.leadStatus || contact.leadScore || contact.leadSource) && (
        <RecordFieldGroup title="Lead Info" icon={Target}>
          {contact.leadStatus && (
            <RecordField
              label="Status"
              value={
                <Badge variant="outline" className={cn("text-xs", leadStatusColors[contact.leadStatus])}>
                  {fmtLabel(contact.leadStatus)}
                </Badge>
              }
            />
          )}
          {contact.leadScore && (
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lead Score</p>
              <div className="flex items-center gap-2">
                <Progress value={parseInt(contact.leadScore)} className="h-1.5 flex-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{contact.leadScore}</span>
              </div>
            </div>
          )}
          {contact.leadSource && <RecordField label="Source" value={fmtLabel(contact.leadSource)} icon={Zap} />}
        </RecordFieldGroup>
      )}

      {/* Social / Links */}
      {(contact.linkedinUrl || contact.twitterHandle) && (
        <RecordFieldGroup title="Social" icon={Globe}>
          {contact.linkedinUrl && (
            <RecordField label="LinkedIn" value="Profile" icon={Linkedin} href={contact.linkedinUrl} />
          )}
          {contact.twitterHandle && (
            <RecordField label="X / Twitter" value={`@${contact.twitterHandle.replace('@', '')}`} icon={Twitter} href={`https://x.com/${contact.twitterHandle.replace('@', '')}`} />
          )}
        </RecordFieldGroup>
      )}

      {/* Personal */}
      {(contact.birthday || contact.anniversary) && (
        <RecordFieldGroup title="Personal" icon={Heart} collapsible defaultOpen={false}>
          <RecordField label="Birthday" value={fmtDate(contact.birthday)} icon={Calendar} />
          <RecordField label="Anniversary" value={fmtDate(contact.anniversary)} icon={Calendar} />
        </RecordFieldGroup>
      )}

      {/* Labels */}
      {contact.labels && contact.labels.length > 0 && (
        <RecordFieldGroup title="Labels" icon={Tag} collapsible defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {contact.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">{fmtLabel(label)}</Badge>
            ))}
          </div>
        </RecordFieldGroup>
      )}

      {/* Consent & Privacy */}
      <RecordFieldGroup title="Consent & Privacy" icon={Shield} collapsible defaultOpen={false}>
        {contact.doNotContact && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded text-red-700 dark:text-red-300 text-xs font-medium">
            <ShieldAlert className="h-3.5 w-3.5" /> Do Not Contact
          </div>
        )}
        <RecordField label="GDPR Consent" value={
          <Badge variant={contact.gdprConsent ? "default" : "outline"} className="text-xs">
            {contact.gdprConsent ? 'Granted' : 'Not Granted'}
          </Badge>
        } />
        {contact.gdprConsentDate && (
          <RecordField label="Consent Date" value={fmtDate(contact.gdprConsentDate)} icon={Calendar} />
        )}
        <RecordField label="Email" value={
          <Badge variant={contact.emailOptOut ? "destructive" : "secondary"} className="text-xs">
            {contact.emailOptOut ? 'Opted Out' : 'Subscribed'}
          </Badge>
        } />
        <RecordField label="SMS" value={
          <Badge variant={contact.smsOptOut ? "destructive" : "secondary"} className="text-xs">
            {contact.smsOptOut ? 'Opted Out' : 'Subscribed'}
          </Badge>
        } />
      </RecordFieldGroup>

      {/* Metadata */}
      <RecordFieldGroup title="Record" icon={FileText} collapsible defaultOpen={false}>
        <RecordField label="Created" value={fmtDate(contact.createdAt)} icon={Calendar} />
        <RecordField label="Updated" value={fmtDate(contact.updatedAt)} icon={Clock} />
        {contact.onDealTeam && (
          <RecordField label="Deal Team" value={<Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">On Deal Team</Badge>} />
        )}
        {contact.dealTeamNotes && <RecordField label="Team Notes" value={contact.dealTeamNotes} />}
      </RecordFieldGroup>
    </>
  );
}

// ── Associations Sidebar ──────────────────────────────────

function ContactAssociationsSidebar({ contact, onNavigate }: { contact: ContactRecord; onNavigate: (url: string) => void }) {
  return (
    <>
      {/* Companies */}
      <AssociationCard
        type="Companies"
        icon={Building2}
        items={contact.companies || []}
        onAdd={() => {}}
        renderItem={(company) => (
          <AssociationRow
            key={company.id}
            entityType="company"
            entityId={company.id}
            name={company.name}
            subtitle={company.industry ? fmtLabel(company.industry) : undefined}
            badge={company.isPrimary ? 'Primary' : company.role ? fmtLabel(company.role) : undefined}
            badgeColor={company.isPrimary ? 'bg-blue-50 text-blue-700 border-blue-200' : undefined}
            avatarInitials={company.name.slice(0, 2).toUpperCase()}
          />
        )}
        emptyMessage="No companies linked"
      />

      {/* Properties */}
      <AssociationCard
        type="Properties"
        icon={MapPin}
        items={contact.properties || []}
        onAdd={() => {}}
        renderItem={(property) => (
          <AssociationRow
            key={property.id}
            entityType="property"
            entityId={property.id}
            name={property.title || 'Untitled Property'}
            subtitle={[property.city, property.state].filter(Boolean).join(', ') || property.type}
            badge={property.relationship ? fmtLabel(property.relationship) : property.status ? fmtLabel(property.status) : undefined}
            avatarInitials={(property.title || 'P').slice(0, 2).toUpperCase()}
          />
        )}
        emptyMessage="No properties linked"
      />

      {/* Deals (compact) */}
      <AssociationCard
        type="Deals"
        icon={DollarSign}
        items={contact.deals || []}
        onViewAll={() => {}}
        renderItem={(deal) => (
          <AssociationRow
            key={deal.id}
            entityType="deal"
            entityId={deal.id}
            name={deal.name}
            subtitle={deal.value ? fmtCurrency(deal.value) : undefined}
            badge={deal.stage ? fmtLabel(deal.stage) : undefined}
            badgeColor={stageColors[deal.stage] || 'bg-gray-50 text-gray-700'}
            avatarInitials={deal.name.slice(0, 2).toUpperCase()}
          />
        )}
        emptyMessage="No deals linked"
      />

      {/* Recent Activities (compact timeline) */}
      {contact.recentActivities?.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-4 pt-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-gray-400" />
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {contact.recentActivities.slice(0, 4).map((a) => {
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
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", a.status === 'completed' ? 'bg-green-50 text-green-700' : '')}
                  >
                    {fmtLabel(a.status)}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Deals Tab ─────────────────────────────────────────────

function ContactDealsTab({ deals, onNavigate }: { deals: ContactRecord['deals']; onNavigate: (url: string) => void }) {
  if (!deals || deals.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No deals associated with this contact</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1">
            <Plus className="h-3 w-3" /> Link Deal
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalPipeline = deals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Deals</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{deals.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pipeline Value</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{fmtCurrency(totalPipeline.toString())}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Probability</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {Math.round(deals.reduce((s, d) => s + (d.probability || 0), 0) / deals.length)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deal cards */}
      <div className="space-y-2">
        {deals.map((deal) => (
          <Card key={deal.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate(`/crm/deals/${deal.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deal.name}</p>
                    <Badge variant="outline" className={cn("text-[10px]", stageColors[deal.stage] || 'bg-gray-50 text-gray-700')}>
                      {fmtLabel(deal.stage)}
                    </Badge>
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
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────

function ContactNotesTab({ notes }: { notes: ContactRecord['notes'] }) {
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

// ── Activity icon map ─────────────────────────────────────

const activityIconMap: Record<string, typeof Activity> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  task: FileText,
  note: MessageSquare,
  follow_up: Clock,
  site_visit: MapPin,
  reminder: Clock,
};

// Small re-export for backward compatibility if needed
const Plus = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

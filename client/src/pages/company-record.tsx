import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, Globe, Phone, Mail, MapPin, Users, Briefcase, 
  Calendar, DollarSign, ExternalLink, Link2
} from 'lucide-react';
import { CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard } from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface CompanyData {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  size: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  description: string | null;
  linkedinUrl: string | null;
  annualRevenue: number | null;
  numberOfEmployees: number | null;
  owner: { id: string; name: string; email: string } | null;
  activities: {
    openCount: number;
    overdueCount: number;
    nextActivity: { id: string; subject: string; type: string; scheduledAt: string } | null;
  };
  timeline: Array<{ id: string; eventType: string; title: string; createdAt: string }>;
  associations: {
    contacts: number;
    deals: number;
  };
}

export default function CompanyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery<CompanyData>({
    queryKey: ['/api/crm/summary/companies', id, 'summary'],
    queryFn: () => apiRequest(`/api/crm/summary/companies/${id}/summary`),
    enabled: !!id,
  });

  const { data: linkedContacts } = useQuery({
    queryKey: ['/api/crm/associations', id, 'contacts'],
    queryFn: () => apiRequest(`/api/crm/associations/company/${id}/linked?targetType=contact`),
    enabled: !!id,
  });

  const { data: linkedDeals } = useQuery({
    queryKey: ['/api/crm/associations', id, 'deals'],
    queryFn: () => apiRequest(`/api/crm/associations/company/${id}/linked?targetType=deal`),
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

  const formatAddress = () => {
    const parts = [company.address, company.city, company.state, company.zipCode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const industryLabel = company.industry?.split('_').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');

  return (
    <CrmRecordPage
      entityType="company"
      entityId={id || ''}
      entityName={company.name}
      entitySubtitle={industryLabel}
      status={company.size ? company.size.charAt(0).toUpperCase() + company.size.slice(1) : undefined}
      statusColor="bg-blue-100 text-blue-700"
      owner={company.owner}
      overviewLeft={
        <>
          <RecordFieldGroup title="Company Information">
            <RecordField 
              icon={Building2} 
              label="Industry" 
              value={industryLabel} 
            />
            <RecordField 
              icon={Users} 
              label="Company Size" 
              value={company.size ? `${company.size.charAt(0).toUpperCase() + company.size.slice(1)}` : null} 
            />
            <RecordField 
              icon={Users} 
              label="Employees" 
              value={company.numberOfEmployees?.toLocaleString()} 
            />
            <RecordField 
              icon={DollarSign} 
              label="Annual Revenue" 
              value={company.annualRevenue ? `$${company.annualRevenue.toLocaleString()}` : null} 
            />
          </RecordFieldGroup>
          
          <RecordFieldGroup title="Contact Information">
            <RecordField 
              icon={Globe} 
              label="Website" 
              value={company.website} 
              href={company.website || undefined}
            />
            <RecordField 
              icon={Phone} 
              label="Phone" 
              value={company.phone} 
            />
            <RecordField 
              icon={MapPin} 
              label="Address" 
              value={formatAddress()} 
            />
            <RecordField 
              icon={Link2} 
              label="LinkedIn" 
              value={company.linkedinUrl ? 'View Profile' : null}
              href={company.linkedinUrl || undefined}
            />
          </RecordFieldGroup>
          
          {company.description && (
            <RecordFieldGroup title="Description">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {company.description}
              </p>
            </RecordFieldGroup>
          )}
        </>
      }
      associationsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AssociationCard
            type="Contacts"
            items={linkedContacts || []}
            onAdd={() => {}}
            renderItem={(contact) => (
              <div 
                key={contact.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => setLocation(`/crm/contacts/${contact.id}`)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{contact.name}</p>
                  <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                </div>
              </div>
            )}
          />
          
          <AssociationCard
            type="Deals"
            items={linkedDeals || []}
            onAdd={() => {}}
            renderItem={(deal) => (
              <div 
                key={deal.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => setLocation(`/deals/${deal.id}`)}
              >
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deal.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {deal.stage}
                    </Badge>
                    {deal.value && (
                      <span className="text-xs text-gray-500">
                        ${deal.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      }
    />
  );
}

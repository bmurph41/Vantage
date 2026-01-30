import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { 
  User, Building2, Mail, Phone, Briefcase, MapPin, 
  Link2, DollarSign, Calendar
} from 'lucide-react';
import { CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard } from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';

interface ContactData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  mobilePhone: string | null;
  linkedinUrl: string | null;
  owner: { id: string; name: string; email: string } | null;
  company: { id: string; name: string } | null;
  activities: {
    openCount: number;
    overdueCount: number;
    nextActivity: { id: string; subject: string; type: string; scheduledAt: string } | null;
  };
  timeline: Array<{ id: string; eventType: string; title: string; createdAt: string }>;
  associations: {
    deals: number;
  };
}

export default function ContactRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: contact, isLoading } = useQuery<ContactData>({
    queryKey: ['/api/crm/summary/contacts', id, 'summary'],
    queryFn: () => apiRequest(`/api/crm/summary/contacts/${id}/summary`),
    enabled: !!id,
  });

  const { data: linkedDeals } = useQuery({
    queryKey: ['/api/crm/associations', id, 'deals'],
    queryFn: () => apiRequest(`/api/crm/associations/contact/${id}/linked?targetType=deal`),
    enabled: !!id,
  });

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

  return (
    <CrmRecordPage
      entityType="contact"
      entityId={id || ''}
      entityName={fullName}
      entitySubtitle={contact.title || undefined}
      owner={contact.owner}
      overviewLeft={
        <>
          <RecordFieldGroup title="Contact Information">
            <RecordField 
              icon={Mail} 
              label="Email" 
              value={contact.email} 
              href={contact.email ? `mailto:${contact.email}` : undefined}
            />
            <RecordField 
              icon={Phone} 
              label="Phone" 
              value={contact.phone} 
            />
            <RecordField 
              icon={Phone} 
              label="Mobile" 
              value={contact.mobilePhone} 
            />
            <RecordField 
              icon={Link2} 
              label="LinkedIn" 
              value={contact.linkedinUrl ? 'View Profile' : null}
              href={contact.linkedinUrl || undefined}
            />
          </RecordFieldGroup>
          
          <RecordFieldGroup title="Work Information">
            <RecordField 
              icon={Briefcase} 
              label="Job Title" 
              value={contact.title} 
            />
            <RecordField 
              icon={Building2} 
              label="Department" 
              value={contact.department} 
            />
            {contact.company && (
              <div 
                className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 -m-2 rounded-md"
                onClick={() => setLocation(`/crm/companies/${contact.company!.id}`)}
              >
                <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Company</p>
                  <p className="text-sm text-primary hover:underline truncate">
                    {contact.company.name}
                  </p>
                </div>
              </div>
            )}
          </RecordFieldGroup>
        </>
      }
      associationsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {contact.company && (
            <RecordFieldGroup title="Company">
              <div 
                className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => setLocation(`/crm/companies/${contact.company!.id}`)}
              >
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{contact.company.name}</p>
                  <p className="text-xs text-gray-500">View company</p>
                </div>
              </div>
            </RecordFieldGroup>
          )}
          
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

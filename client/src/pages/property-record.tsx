import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, Building2, DollarSign, Ruler, Anchor, 
  Calendar, FileText, Users, Globe
} from 'lucide-react';
import { CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard } from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';

interface PropertyData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  propertyType: string | null;
  status: string | null;
  askingPrice: number | null;
  numberOfSlips: number | null;
  totalSquareFeet: number | null;
  yearBuilt: number | null;
  description: string | null;
  owner: { id: string; name: string; email: string } | null;
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

export default function PropertyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: property, isLoading } = useQuery<PropertyData>({
    queryKey: ['/api/crm/summary/properties', id, 'summary'],
    queryFn: () => apiRequest(`/api/crm/summary/properties/${id}/summary`),
    enabled: !!id,
  });

  const { data: linkedDeals } = useQuery({
    queryKey: ['/api/crm/associations', id, 'deals'],
    queryFn: () => apiRequest(`/api/crm/associations/property/${id}/linked?targetType=deal`),
    enabled: !!id,
  });

  const { data: linkedCompanies } = useQuery({
    queryKey: ['/api/crm/associations', id, 'companies'],
    queryFn: () => apiRequest(`/api/crm/associations/property/${id}/linked?targetType=company`),
    enabled: !!id,
  });

  if (isLoading || !property) {
    return (
      <CrmRecordPage
        entityType="property"
        entityId={id || ''}
        entityName=""
        isLoading={true}
        overviewLeft={null}
      />
    );
  }

  const formatAddress = () => {
    const parts = [property.address, property.city, property.state, property.zipCode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    under_contract: 'bg-yellow-100 text-yellow-700',
    sold: 'bg-gray-100 text-gray-700',
    off_market: 'bg-red-100 text-red-700',
  };

  const formatPropertyType = (type: string | null) => {
    if (!type) return null;
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <CrmRecordPage
      entityType="property"
      entityId={id || ''}
      entityName={property.name}
      entitySubtitle={formatAddress() || undefined}
      status={property.status ? formatPropertyType(property.status) : undefined}
      statusColor={statusColors[property.status || ''] || 'bg-gray-100 text-gray-700'}
      owner={property.owner}
      overviewLeft={
        <>
          <RecordFieldGroup title="Property Details">
            <RecordField 
              icon={Building2} 
              label="Property Type" 
              value={formatPropertyType(property.propertyType)} 
            />
            <RecordField 
              icon={MapPin} 
              label="Location" 
              value={formatAddress()} 
            />
            <RecordField 
              icon={Calendar} 
              label="Year Built" 
              value={property.yearBuilt} 
            />
          </RecordFieldGroup>
          
          <RecordFieldGroup title="Property Specifications">
            <RecordField 
              icon={Anchor} 
              label="Number of Slips" 
              value={property.numberOfSlips?.toLocaleString()} 
            />
            <RecordField 
              icon={Ruler} 
              label="Total Square Feet" 
              value={property.totalSquareFeet?.toLocaleString()} 
            />
            <RecordField 
              icon={DollarSign} 
              label="Asking Price" 
              value={property.askingPrice ? `$${property.askingPrice.toLocaleString()}` : null} 
            />
          </RecordFieldGroup>
          
          {property.description && (
            <RecordFieldGroup title="Description">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {property.description}
              </p>
            </RecordFieldGroup>
          )}
        </>
      }
      associationsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AssociationCard
            type="Companies"
            items={linkedCompanies || []}
            onAdd={() => {}}
            renderItem={(company) => (
              <div 
                key={company.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => setLocation(`/crm/companies/${company.id}`)}
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{company.name}</p>
                  <p className="text-xs text-gray-500 truncate">{company.industry}</p>
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

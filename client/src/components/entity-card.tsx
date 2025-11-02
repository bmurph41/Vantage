import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  Building,
  MapPin,
  Globe,
  Users,
  DollarSign,
  Anchor,
  Home,
  Link2
} from "lucide-react";
import type { Contact, Company } from "@shared/schema";

type Property = {
  id: string;
  title: string;
  type: 'marina' | 'boat' | 'slip' | 'dry_storage';
  status: 'available' | 'under_contract' | 'sold' | 'off_market';
  listingPrice?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  specifications?: any;
  description?: string;
  images?: string[];
  ownerId: string;
  listingAgentId?: string;
  createdAt: string;
  updatedAt: string;
};

type ContactWithRelations = Contact & {
  company?: Company | null;
  companies?: Array<{ id: string; name: string; role?: string; }>;
  properties?: Array<{ id: string; title: string; relationship?: string; }>;
};

type CompanyWithRelations = Company & {
  contacts?: Array<{ id: string; firstName: string; lastName: string; role?: string; }>;
  properties?: Array<{ id: string; title: string; relationship?: string; }>;
};

type PropertyWithRelations = Property & {
  contacts?: Array<{ id: string; firstName: string; lastName: string; relationship?: string; }>;
  companies?: Array<{ id: string; name: string; relationship?: string; }>;
};

type EntityCardProps = {
  type: 'contact' | 'company' | 'property';
  data: ContactWithRelations | CompanyWithRelations | PropertyWithRelations;
  onEdit: () => void;
  onDelete: () => void;
  onManageRelationships?: () => void;
};

const getContactInitials = (contact: Contact) => {
  return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
};

const getPropertyIcon = (type: string) => {
  switch (type) {
    case 'marina': return <Anchor className="w-5 h-5" />;
    case 'boat': return <Home className="w-5 h-5" />;
    case 'slip': return <MapPin className="w-5 h-5" />;
    case 'dry_storage': return <Building className="w-5 h-5" />;
    default: return <Home className="w-5 h-5" />;
  }
};

const formatPrice = (price?: string) => {
  if (!price) return '-';
  const num = parseFloat(price);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export function EntityCard({ type, data, onEdit, onDelete, onManageRelationships }: EntityCardProps) {
  if (type === 'contact') {
    const contact = data as ContactWithRelations;
    return (
      <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden" data-testid={`card-contact-${contact.id}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-3 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {getContactInitials(contact)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate" data-testid={`text-contact-name-${contact.id}`}>
                  {contact.firstName} {contact.lastName}
                </h3>
                {contact.position && (
                  <p className="text-sm text-gray-500 truncate">{contact.position}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 w-8 p-0"
                data-testid={`button-edit-contact-${contact.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                data-testid={`button-delete-contact-${contact.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-2 mb-4">
            {contact.email && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{contact.phone}</span>
              </div>
            )}
          </div>

          {/* Relationships */}
          {(contact.companies && contact.companies.length > 0) || (contact.properties && contact.properties.length > 0) ? (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Connections</span>
                {onManageRelationships && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onManageRelationships}
                    className="h-6 text-xs"
                    data-testid={`button-manage-relationships-${contact.id}`}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Manage
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {contact.companies?.slice(0, 3).map((company) => (
                  <Badge key={company.id} variant="secondary" className="text-xs">
                    <Building className="w-3 h-3 mr-1" />
                    {company.name}
                  </Badge>
                ))}
                {contact.properties?.slice(0, 3).map((property) => (
                  <Badge key={property.id} variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    {property.title}
                  </Badge>
                ))}
                {((contact.companies?.length || 0) + (contact.properties?.length || 0)) > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{((contact.companies?.length || 0) + (contact.properties?.length || 0)) - 3} more
                  </Badge>
                )}
              </div>
            </div>
          ) : onManageRelationships ? (
            <div className="pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={onManageRelationships}
                className="w-full text-xs"
                data-testid={`button-add-relationships-${contact.id}`}
              >
                <Link2 className="w-3 h-3 mr-1" />
                Add Connections
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  if (type === 'company') {
    const company = data as CompanyWithRelations;
    return (
      <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden" data-testid={`card-company-${company.id}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-3 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                <Building className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate" data-testid={`text-company-name-${company.id}`}>
                  {company.name}
                </h3>
                {company.industry && (
                  <p className="text-sm text-gray-500">{company.industry}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 w-8 p-0"
                data-testid={`button-edit-company-${company.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                data-testid={`button-delete-company-${company.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Company Information */}
          <div className="space-y-2 mb-4">
            {company.website && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="truncate">{company.website}</span>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{company.phone}</span>
              </div>
            )}
            {company.address && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="truncate">{company.address}</span>
              </div>
            )}
            {company.size && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{company.size}</span>
              </div>
            )}
          </div>

          {/* Relationships */}
          {(company.contacts && company.contacts.length > 0) || (company.properties && company.properties.length > 0) ? (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Connections</span>
                {onManageRelationships && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onManageRelationships}
                    className="h-6 text-xs"
                    data-testid={`button-manage-relationships-${company.id}`}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Manage
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {company.contacts?.slice(0, 3).map((contact) => (
                  <Badge key={contact.id} variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    {contact.firstName} {contact.lastName}
                  </Badge>
                ))}
                {company.properties?.slice(0, 3).map((property) => (
                  <Badge key={property.id} variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    {property.title}
                  </Badge>
                ))}
                {((company.contacts?.length || 0) + (company.properties?.length || 0)) > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{((company.contacts?.length || 0) + (company.properties?.length || 0)) - 3} more
                  </Badge>
                )}
              </div>
            </div>
          ) : onManageRelationships ? (
            <div className="pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={onManageRelationships}
                className="w-full text-xs"
                data-testid={`button-add-relationships-${company.id}`}
              >
                <Link2 className="w-3 h-3 mr-1" />
                Add Connections
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  if (type === 'property') {
    const property = data as PropertyWithRelations;
    return (
      <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden" data-testid={`card-property-${property.id}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-3 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                {getPropertyIcon(property.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate" data-testid={`text-property-title-${property.id}`}>
                  {property.title}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {property.type.replace('_', ' ')}
                  </Badge>
                  <Badge variant={property.status === 'available' ? 'default' : 'outline'} className="text-xs">
                    {property.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 w-8 p-0"
                data-testid={`button-edit-property-${property.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                data-testid={`button-delete-property-${property.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Property Information */}
          <div className="space-y-2 mb-4">
            {property.listingPrice && (
              <div className="flex items-center space-x-2 text-sm font-semibold text-green-700">
                <DollarSign className="w-4 h-4" />
                <span>{formatPrice(property.listingPrice)}</span>
              </div>
            )}
            {property.address && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="truncate">{property.address}</span>
              </div>
            )}
          </div>

          {/* Relationships */}
          {(property.contacts && property.contacts.length > 0) || (property.companies && property.companies.length > 0) ? (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Connections</span>
                {onManageRelationships && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onManageRelationships}
                    className="h-6 text-xs"
                    data-testid={`button-manage-relationships-${property.id}`}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Manage
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {property.contacts?.slice(0, 3).map((contact) => (
                  <Badge key={contact.id} variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    {contact.firstName} {contact.lastName}
                  </Badge>
                ))}
                {property.companies?.slice(0, 3).map((company) => (
                  <Badge key={company.id} variant="outline" className="text-xs">
                    <Building className="w-3 h-3 mr-1" />
                    {company.name}
                  </Badge>
                ))}
                {((property.contacts?.length || 0) + (property.companies?.length || 0)) > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{((property.contacts?.length || 0) + (property.companies?.length || 0)) - 3} more
                  </Badge>
                )}
              </div>
            </div>
          ) : onManageRelationships ? (
            <div className="pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={onManageRelationships}
                className="w-full text-xs"
                data-testid={`button-add-relationships-${property.id}`}
              >
                <Link2 className="w-3 h-3 mr-1" />
                Add Connections
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  return null;
}

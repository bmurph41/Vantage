import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  MapPin, Building2, Anchor, DollarSign, TrendingUp, Calendar,
  Globe, Phone, Mail, Users, Briefcase, Home, Activity, Clock,
  Tag, ExternalLink, ChevronRight, ArrowUpRight, Warehouse, Ship,
  Droplets, Wifi, Fuel, Wrench, ShowerHead, Store, Fish, Star,
  FileText, MessageSquare, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard } from '@/components/crm/CrmRecordPage';
import { apiRequest } from '@/lib/queryClient';

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
}

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const currencyFormatterFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatCurrency(val: string | number | null): string {
  if (val === null || val === undefined) return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return num >= 1000 ? currencyFormatter.format(num) : currencyFormatterFull.format(num);
}

function formatLabel(str: string): string {
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const typeColors: Record<string, string> = {
  marina: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  boat: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  slip: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  dry_storage: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  under_contract: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  sold: 'bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400',
  off_market: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const amenityIcons: Record<string, any> = {
  fuel: Fuel,
  restaurant: Store,
  pool: Droplets,
  ship_store: Store,
  repairs: Wrench,
  wifi: Wifi,
  laundry: Home,
  showers: ShowerHead,
  pumpout: Anchor,
  fishing: Fish,
  default: Star,
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function PropertyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: property, isLoading } = useQuery<PropertyRecord>({
    queryKey: ['/api/crm/summary/properties', id, 'summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/summary/properties/${id}/summary`);
      return res.json();
    },
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

  const fullAddress = [property.address, property.city, property.state, property.zipCode].filter(Boolean).join(', ');
  const occupancy = property.occupancyRate ? parseFloat(property.occupancyRate) : null;
  const occupancyColor = occupancy !== null ? (occupancy > 80 ? 'text-green-600' : occupancy >= 60 ? 'text-yellow-600' : 'text-red-600') : '';
  const occupancyBarColor = occupancy !== null ? (occupancy > 80 ? '[&>div]:bg-green-500' : occupancy >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500') : '';

  const overviewLeft = (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{property.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={typeColors[property.type] || 'bg-gray-100 text-gray-700'}>
                  {formatLabel(property.type)}
                </Badge>
                <Badge className={statusColors[property.status] || 'bg-gray-100 text-gray-700'}>
                  {formatLabel(property.status)}
                </Badge>
                {property.pipelineStage && (
                  <Badge variant="outline" className="border-blue-300 text-blue-600 dark:border-blue-600 dark:text-blue-400">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {formatLabel(property.pipelineStage)}
                  </Badge>
                )}
                {property.isOnMarket && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Globe className="h-3 w-3 mr-1" />
                    On Market
                  </Badge>
                )}
                {property.isSelling && !property.isOnMarket && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Tag className="h-3 w-3 mr-1" />
                    Selling
                  </Badge>
                )}
              </div>
              {fullAddress && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{fullAddress}</span>
                </div>
              )}
            </div>
            {property.listingPrice && (
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Listing Price</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(property.listingPrice)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Anchor className="h-4 w-4" />
            Marina Capacity & Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Wet Slips', value: property.wetSlips, icon: Ship, color: 'text-blue-600' },
              { label: 'Dry Slips', value: property.drySlips, icon: Warehouse, color: 'text-orange-600' },
              { label: 'Moorings', value: property.moorings, icon: Anchor, color: 'text-purple-600' },
              { label: 'Total Capacity', value: property.totalCapacity, icon: BarChart3, color: 'text-green-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value ?? '—'}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {property.storageEntries && property.storageEntries.length > 0 && (
            <>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Storage Type</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Occupied</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Occupancy</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {property.storageEntries.map(entry => {
                      const occ = entry.capacity > 0 ? Math.round((entry.occupied / entry.capacity) * 100) : 0;
                      const barColor = occ > 80 ? '[&>div]:bg-green-500' : occ >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500';
                      return (
                        <tr key={entry.id} className="border-b dark:border-gray-700/50 last:border-0">
                          <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{entry.storageTypeName}</td>
                          <td className="py-2 px-2 text-center text-gray-700 dark:text-gray-300">{entry.capacity}</td>
                          <td className="py-2 px-2 text-center text-gray-700 dark:text-gray-300">{entry.occupied}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Progress value={occ} className={`h-2 flex-1 ${barColor}`} />
                              <span className="text-xs text-gray-500 w-10 text-right">{occ}%</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{entry.rate ? formatCurrency(entry.rate) : '—'}</td>
                          <td className="py-2 px-2 text-right text-gray-500">{entry.rateType || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Listing Price</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(property.listingPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">NOI Estimate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(property.noiEstimate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(property.annualRevenue)}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Occupancy Rate</p>
              {occupancy !== null ? (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${occupancyColor}`}>{occupancy.toFixed(1)}%</span>
                  </div>
                  <Progress value={occupancy} className={`h-2 ${occupancyBarColor}`} />
                </div>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cap Rate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {property.listCapRate ? `${parseFloat(property.listCapRate).toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(property.isOnMarket || property.isSelling) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Listing Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <RecordField icon={DollarSign} label="List Price" value={formatCurrency(property.listPrice)} />
              <RecordField icon={Calendar} label="Listing Date" value={property.listingDate ? format(new Date(property.listingDate), 'MMM d, yyyy') : null} />
              <RecordField icon={TrendingUp} label="Cap Rate" value={property.listCapRate ? `${parseFloat(property.listCapRate).toFixed(2)}%` : null} />
              {property.listingUrl && (
                <RecordField icon={ExternalLink} label="Listing URL" value={property.listingUrl} href={property.listingUrl} />
              )}
            </div>
            {property.listingNotes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Listing Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{property.listingNotes}</p>
                </div>
              </>
            )}
            {(property.brokerContact || property.listingAgent) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {property.brokerContact && (
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/crm/contacts/${property.brokerContact!.id}`)}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">{getInitials(property.brokerContact.firstName, property.brokerContact.lastName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{property.brokerContact.firstName} {property.brokerContact.lastName}</p>
                        <p className="text-xs text-gray-500">Broker Contact</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 ml-auto flex-shrink-0" />
                    </div>
                  )}
                  {property.listingAgent && (
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/crm/contacts/${property.listingAgent!.id}`)}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">{getInitials(property.listingAgent.firstName, property.listingAgent.lastName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{property.listingAgent.firstName} {property.listingAgent.lastName}</p>
                        <p className="text-xs text-gray-500">Listing Agent</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 ml-auto flex-shrink-0" />
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {property.lastSaleYear && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Sale History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Last Sale</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {property.lastSaleMonth ? `${format(new Date(property.lastSaleYear, property.lastSaleMonth - 1), 'MMMM yyyy')}` : property.lastSaleYear}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Sale Price</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(property.lastSalePrice)}</p>
              </div>
            </div>
            {property.askingPriceHistory && property.askingPriceHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Price History</p>
                  <div className="space-y-2">
                    {property.askingPriceHistory.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(entry.date), 'MMM d, yyyy')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.price)}</span>
                            {entry.notes && <span className="text-xs text-gray-500">({entry.notes})</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {property.amenities && property.amenities.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Amenities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map(amenity => {
                const IconComp = amenityIcons[amenity.toLowerCase()] || amenityIcons.default;
                return (
                  <Badge key={amenity} variant="outline" className="px-3 py-1.5 text-sm gap-1.5">
                    <IconComp className="h-3.5 w-3.5" />
                    {formatLabel(amenity)}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {property.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{property.description}</p>
          </CardContent>
        </Card>
      )}

      {property.ownerCompany && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Owner Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/companies/${property.ownerCompany!.id}`)}
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{property.ownerCompany.name}</p>
                {property.ownerCompany.industry && (
                  <Badge variant="secondary" className="text-xs mt-1">{property.ownerCompany.industry}</Badge>
                )}
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
          <CardTitle className="text-sm font-medium text-gray-500">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Total Deals', value: property.deals?.length ?? 0, icon: Briefcase, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
            { label: 'Connected Contacts', value: property.contacts?.length ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Connected Companies', value: property.companies?.length ?? 0, icon: Building2, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Open Activities', value: property.activities?.openCount ?? 0, icon: Activity, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3 p-2 rounded-lg">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          ))}
          {property.activities?.overdueCount > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 text-center">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{property.activities.overdueCount} Overdue Activities</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500">Key Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {property.brokerContact && (
            <div
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/contacts/${property.brokerContact!.id}`)}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">{getInitials(property.brokerContact.firstName, property.brokerContact.lastName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{property.brokerContact.firstName} {property.brokerContact.lastName}</p>
                <p className="text-xs text-gray-500">Broker</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {property.listingAgent && (
            <div
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/contacts/${property.listingAgent!.id}`)}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">{getInitials(property.listingAgent.firstName, property.listingAgent.lastName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{property.listingAgent.firstName} {property.listingAgent.lastName}</p>
                <p className="text-xs text-gray-500">Listing Agent</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {property.ownerCompany && (
            <div
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/companies/${property.ownerCompany!.id}`)}
            >
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{property.ownerCompany.name}</p>
                <p className="text-xs text-gray-500">Owner Company</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {!property.brokerContact && !property.listingAgent && !property.ownerCompany && (
            <p className="text-sm text-gray-400 text-center py-4">No key contacts linked</p>
          )}
        </CardContent>
      </Card>

      {property.activities?.nextActivity && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Next Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{property.activities.nextActivity.subject}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{property.activities.nextActivity.type}</Badge>
                {property.activities.nextActivity.scheduledAt && (
                  <span className="text-xs text-gray-500">
                    {format(new Date(property.activities.nextActivity.scheduledAt), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  const associationsContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AssociationCard
          type="Companies"
          items={property.companies || []}
          onAdd={() => {}}
          renderItem={(company) => (
            <div
              key={company.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/companies/${company.id}`)}
            >
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{company.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {company.industry && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{company.industry}</Badge>}
                  {company.relationship && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{company.relationship}</Badge>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          )}
        />

        <AssociationCard
          type="Contacts"
          items={property.contacts || []}
          onAdd={() => {}}
          renderItem={(contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/contacts/${contact.id}`)}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-green-100 text-green-700">{getInitials(contact.firstName, contact.lastName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{contact.firstName} {contact.lastName}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {contact.email && (
                    <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                      <Mail className="h-2.5 w-2.5" />{contact.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {contact.contactTag && <Badge className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{contact.contactTag}</Badge>}
                  {contact.relationship && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{contact.relationship}</Badge>}
                  {contact.position && <span className="text-[10px] text-gray-500">{contact.position}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          )}
        />

        <AssociationCard
          type="Deals"
          items={property.deals || []}
          onAdd={() => {}}
          renderItem={(deal) => (
            <div
              key={deal.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setLocation(`/crm/deals/${deal.id}`)}
            >
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deal.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{deal.stage}</Badge>
                  {deal.value && <span className="text-xs font-medium text-green-600">{formatCurrency(deal.value)}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {deal.probability !== null && <span className="text-[10px] text-gray-500">{deal.probability}% probability</span>}
                  {deal.expectedCloseDate && <span className="text-[10px] text-gray-500">Close: {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          )}
        />
      </div>
    </div>
  );

  const customTabs = [
    {
      value: 'storage',
      label: 'Storage',
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Storage Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {property.storageEntries && property.storageEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Storage Type</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Occupied</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Available</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-48">Occupancy</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Rate Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {property.storageEntries.map(entry => {
                      const occ = entry.capacity > 0 ? Math.round((entry.occupied / entry.capacity) * 100) : 0;
                      const available = entry.capacity - entry.occupied;
                      const barColor = occ > 80 ? '[&>div]:bg-green-500' : occ >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500';
                      return (
                        <tr key={entry.id} className="border-b dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{entry.storageTypeName}</td>
                          <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{entry.capacity}</td>
                          <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{entry.occupied}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={available > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{available}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Progress value={occ} className={`h-3 flex-1 ${barColor}`} />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right">{occ}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">{entry.rate ? formatCurrency(entry.rate) : '—'}</td>
                          <td className="py-3 px-4 text-right text-gray-500">{entry.rateType || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No storage entries recorded</p>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: 'activity',
      label: 'Activity',
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {property.recentActivities && property.recentActivities.length > 0 ? (
              <div className="space-y-3">
                {property.recentActivities.map(act => (
                  <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg border dark:border-gray-700">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      act.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                      act.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      <Activity className={`h-4 w-4 ${
                        act.status === 'completed' ? 'text-green-600' :
                        act.status === 'overdue' ? 'text-red-600' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{act.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{formatLabel(act.type)}</Badge>
                        <Badge variant={act.status === 'completed' ? 'default' : act.status === 'overdue' ? 'destructive' : 'outline'} className="text-xs">
                          {formatLabel(act.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {act.scheduledAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Scheduled: {format(new Date(act.scheduledAt), 'MMM d, yyyy')}
                          </span>
                        )}
                        {act.completedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Completed: {format(new Date(act.completedAt), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No recent activities</p>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: 'notes',
      label: 'Notes',
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {property.notes && property.notes.length > 0 ? (
              <div className="space-y-3">
                {property.notes.map(note => (
                  <div key={note.id} className="p-4 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No notes yet</p>
            )}
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <CrmRecordPage
      entityType="property"
      entityId={id || ''}
      entityName={property.title}
      entitySubtitle={fullAddress || undefined}
      status={property.status ? formatLabel(property.status) : undefined}
      statusColor={statusColors[property.status] || 'bg-gray-100 text-gray-700'}
      owner={property.owner}
      overviewLeft={overviewLeft}
      overviewRight={overviewRight}
      associationsContent={associationsContent}
      customTabs={customTabs}
    />
  );
}
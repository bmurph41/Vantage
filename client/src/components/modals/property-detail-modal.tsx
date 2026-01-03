import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, Building, MapPin, DollarSign, 
  Edit, X, Clock, Check, Loader2, Anchor, Home, Link2,
  TrendingUp, Calendar, Briefcase, FolderOpen, BarChart3, History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import type { Property, Contact, Company, Deal, Activity as ActivityType, Note, SalesComp, RateComp } from "@shared/schema";
import PropertyIntegrationPanel from "@/components/crm/PropertyIntegrationPanel";

type SalesHistoryMatch = SalesComp & { 
  matchConfidence: number;
  sellerCompanyName?: string | null;
  buyerCompanyName?: string | null;
  sellerContactName?: string | null;
  buyerContactName?: string | null;
};
type RateHistoryMatch = RateComp & { matchConfidence: number };

interface PortfolioStatus {
  property: Property;
  isOwnedAsset: boolean;
  ownedAssetDetails: any | null;
  portfolioMemberships: Array<{
    portfolioId: string;
    portfolioName: string;
    compId: string;
    marinaName: string;
  }>;
}

const formatCurrency = (amount: number | string | null | undefined) => {
  if (!amount) return "$0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

interface PropertyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  onContactClick?: (contact: Contact) => void;
  onCompanyClick?: (company: Company) => void;
  onDealClick?: (deal: Deal) => void;
}

const propertyTypeColors = {
  marina: 'bg-blue-100 text-blue-800',
  boat: 'bg-green-100 text-green-800',
  slip: 'bg-purple-100 text-purple-800',
  dry_storage: 'bg-orange-100 text-orange-800'
};

const statusColors = {
  available: 'bg-green-100 text-green-800',
  under_contract: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-800',
  off_market: 'bg-red-100 text-red-800'
};

const propertyFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(['marina', 'boat', 'slip', 'dry_storage']),
  status: z.enum(['available', 'under_contract', 'sold', 'off_market']),
  listingPrice: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;

type ContactPropertyWithContact = {
  id: string;
  contactId: string;
  propertyId: string;
  relationship?: string | null;
  contact?: Contact | null;
};

type CompanyPropertyWithCompany = {
  id: string;
  companyId: string;
  propertyId: string;
  relationship?: string | null;
  company?: Company | null;
};

export default function PropertyDetailModal({ isOpen, onClose, property, onContactClick, onCompanyClick, onDealClick }: PropertyDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    mode: 'onChange',
    defaultValues: {
      title: property?.title || '',
      type: (property?.type as any) || 'marina',
      status: (property?.status as any) || 'available',
      listingPrice: property?.listingPrice?.toString() || '',
      address: property?.address || '',
      description: property?.description || '',
    },
  });

  // Fetch linked contacts
  const { data: linkedContacts = [] } = useQuery<ContactPropertyWithContact[]>({
    queryKey: [`/api/properties/${property?.id}/contacts`],
    enabled: isOpen && !!property?.id,
  });

  // Fetch linked companies
  const { data: linkedCompanies = [] } = useQuery<CompanyPropertyWithCompany[]>({
    queryKey: [`/api/properties/${property?.id}/companies`],
    enabled: isOpen && !!property?.id,
  });

  // Fetch deals associated with this property
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    enabled: isOpen,
  });

  // Fetch activities
  const { data: activities = [] } = useQuery<ActivityType[]>({
    queryKey: ['/api/activities', 'property', property?.id],
    enabled: isOpen && !!property?.id,
  });

  // Fetch notes
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes', 'property', property?.id],
    enabled: isOpen && !!property?.id,
  });

  // Fetch sales history matches
  const { data: salesHistoryData, isLoading: salesHistoryLoading } = useQuery<{ matches: SalesHistoryMatch[]; property: Property }>({
    queryKey: ['/api/properties', property?.id, 'sales-history'],
    enabled: isOpen && !!property?.id,
  });

  // Fetch rate history matches
  const { data: rateHistoryData, isLoading: rateHistoryLoading } = useQuery<{ matches: RateHistoryMatch[]; property: Property }>({
    queryKey: ['/api/properties', property?.id, 'rate-history'],
    enabled: isOpen && !!property?.id,
  });

  // Fetch portfolio status
  const { data: portfolioStatus, isLoading: portfolioLoading } = useQuery<PortfolioStatus>({
    queryKey: ['/api/properties', property?.id, 'portfolio-status'],
    enabled: isOpen && !!property?.id,
  });

  // Update property mutation
  const updatePropertyMutation = useMutation({
    mutationFn: async (data: PropertyFormData) => {
      if (!property) return;
      const updateData = {
        ...data,
        listingPrice: data.listingPrice ? parseFloat(data.listingPrice) : undefined,
      };
      return await apiRequest('PATCH', `/api/properties/${property.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      
      if (!isAutosaveRef.current) {
        toast({
          title: "Success",
          description: "Property updated successfully",
        });
        setIsEditing(false);
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        isAutosaveRef.current = false;
      }
    },
    onError: () => {
      if (!isAutosaveRef.current) {
        toast({
          title: "Error",
          description: "Failed to update property",
          variant: "destructive",
        });
      } else {
        setSaveStatus('idle');
        isAutosaveRef.current = false;
      }
    },
  });

  // Unlink contact mutation
  const unlinkContactMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return await apiRequest('DELETE', `/api/properties/${property?.id}/contacts/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property?.id}/contacts`] });
      toast({ title: "Contact unlinked" });
    },
    onError: () => {
      toast({ title: "Failed to unlink contact", variant: "destructive" });
    },
  });

  // Unlink company mutation
  const unlinkCompanyMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return await apiRequest('DELETE', `/api/properties/${property?.id}/companies/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property?.id}/companies`] });
      toast({ title: "Company unlinked" });
    },
    onError: () => {
      toast({ title: "Failed to unlink company", variant: "destructive" });
    },
  });

  const onSubmit = (data: PropertyFormData) => {
    isAutosaveRef.current = false;
    updatePropertyMutation.mutate(data);
  };

  const autoSave = (data: PropertyFormData) => {
    isAutosaveRef.current = true;
    setSaveStatus('saving');
    updatePropertyMutation.mutate(data);
  };

  // Reset form when property changes
  useEffect(() => {
    if (property) {
      form.reset({
        title: property.title,
        type: property.type as any,
        status: property.status as any,
        listingPrice: property.listingPrice?.toString() || '',
        address: property.address || '',
        description: property.description || '',
      });
      setIsEditing(false);
      setSaveStatus('idle');
    }
  }, [property, form]);

  // Autosave on form changes when editing
  useEffect(() => {
    if (!isEditing) return;

    const subscription = form.watch(() => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(() => {
        const formData = form.getValues();
        const isValid = form.formState.isValid;
        
        if (isValid) {
          autoSave(formData);
        }
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isEditing, form]);

  if (!property) {
    return null;
  }

  // Filter deals by marina/property details
  // Note: Since deals table has marina-specific fields, we can match by marinaName
  const propertyDeals = allDeals.filter(d => {
    // Match by marina name if this is a marina property
    if (property.type === 'marina' && d.marinaName) {
      return d.marinaName.toLowerCase() === property.title.toLowerCase();
    }
    // Could also match by property address or other fields
    return false;
  });

  const formatPrice = (price?: string | number) => {
    if (!price) return '-';
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'marina': return <Anchor className="w-8 h-8" />;
      case 'boat': return <Home className="w-8 h-8" />;
      case 'slip': return <MapPin className="w-8 h-8" />;
      case 'dry_storage': return <Building className="w-8 h-8" />;
      default: return <Home className="w-8 h-8" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col" data-testid="modal-property-detail">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {/* Property Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
                {getPropertyIcon(form.watch('type'))}
              </div>
              
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold">
                  {form.watch('title')}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={propertyTypeColors[form.watch('type') as keyof typeof propertyTypeColors]}>
                    {form.watch('type').replace('_', ' ')}
                  </Badge>
                  <Badge className={statusColors[form.watch('status') as keyof typeof statusColors]}>
                    {form.watch('status').replace('_', ' ')}
                  </Badge>
                  {form.watch('listingPrice') && (
                    <Badge variant="outline" className="text-green-700 border-green-500">
                      {formatPrice(form.watch('listingPrice'))}
                    </Badge>
                  )}
                  {portfolioStatus?.isOwnedAsset && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200" data-testid="badge-owned-asset">
                      <Briefcase className="w-3 h-3 mr-1" />
                      Owned Asset
                    </Badge>
                  )}
                  {portfolioStatus && portfolioStatus.portfolioMemberships.length > 0 && (
                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200" data-testid="badge-portfolio-count">
                      <FolderOpen className="w-3 h-3 mr-1" />
                      In {portfolioStatus.portfolioMemberships.length} Portfolio{portfolioStatus.portfolioMemberships.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {salesHistoryData && salesHistoryData.matches.length > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200" data-testid="badge-sales-history">
                      <History className="w-3 h-3 mr-1" />
                      {salesHistoryData.matches.length} Sale{salesHistoryData.matches.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 items-center flex-shrink-0">
              {isEditing && (
                <div className="flex items-center gap-1.5 text-sm mr-2" data-testid="text-save-status">
                  {saveStatus === 'saving' && (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-gray-600">Saving...</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Saved</span>
                    </>
                  )}
                </div>
              )}
              {isEditing ? (
                <Button 
                  onClick={() => {
                    setIsEditing(false);
                    form.reset();
                    setSaveStatus('idle');
                  }} 
                  variant="outline" 
                  size="sm"
                  data-testid="button-done-edit"
                >
                  Done
                </Button>
              ) : (
                <Button 
                  onClick={() => setIsEditing(true)} 
                  variant="outline" 
                  size="sm" 
                  data-testid="button-edit-property"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button onClick={onClose} variant="ghost" size="sm" data-testid="button-close-detail">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-8 flex-shrink-0">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="intelligence" data-testid="tab-intelligence">
              <BarChart3 className="w-3 h-3 mr-1" />
              Intel
            </TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts ({linkedContacts.length})</TabsTrigger>
            <TabsTrigger value="companies" data-testid="tab-companies">Companies ({linkedCompanies.length})</TabsTrigger>
            <TabsTrigger value="deals" data-testid="tab-deals">Deals ({propertyDeals.length})</TabsTrigger>
            <TabsTrigger value="comps" data-testid="tab-comps">
              <Link2 className="w-3 h-3 mr-1" />
              Comps
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              {/* Property Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Home className="w-5 h-5" />
                    Property Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="font-semibold">Property Title</Label>
                    {isEditing ? (
                      <Input
                        id="title"
                        {...form.register('title')}
                        className="border-2 border-gray-300 focus:border-blue-500"
                        data-testid="input-title"
                      />
                    ) : (
                      <div className="font-medium px-3 py-2">{form.watch('title')}</div>
                    )}
                    {form.formState.errors.title && (
                      <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type" className="font-semibold">Property Type</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('type')}
                          onValueChange={(value) => form.setValue('type', value as any)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="select-type"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marina">Marina</SelectItem>
                            <SelectItem value="boat">Boat</SelectItem>
                            <SelectItem value="slip">Slip</SelectItem>
                            <SelectItem value="dry_storage">Dry Storage</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">{form.watch('type').replace('_', ' ')}</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status" className="font-semibold">Status</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('status')}
                          onValueChange={(value) => form.setValue('status', value as any)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="select-status"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="under_contract">Under Contract</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                            <SelectItem value="off_market">Off Market</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">{form.watch('status').replace('_', ' ')}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="listingPrice" className="font-semibold flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      Listing Price
                    </Label>
                    {isEditing ? (
                      <Input
                        id="listingPrice"
                        type="number"
                        step="0.01"
                        {...form.register('listingPrice')}
                        className="border-2 border-gray-300 focus:border-blue-500"
                        data-testid="input-listing-price"
                      />
                    ) : (
                      <div className="font-medium text-green-700 text-lg px-3 py-2">
                        {formatPrice(form.watch('listingPrice'))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {isEditing ? (
                      <AddressInput
                        value={form.watch('address') || ""}
                        onChange={(value) => form.setValue('address', value, { shouldDirty: true })}
                        onAddressSelect={(components: AddressComponents) => {
                          form.setValue('address', components.fullAddress || components.street || '', { shouldDirty: true });
                        }}
                        label="Address"
                        placeholder="Start typing an address..."
                        testId="input-address"
                      />
                    ) : (
                      <>
                        <Label htmlFor="address" className="font-semibold flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          Address
                        </Label>
                        <div className="font-medium px-3 py-2">{form.watch('address') || '-'}</div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-semibold">Description</Label>
                    {isEditing ? (
                      <Textarea
                        id="description"
                        {...form.register('description')}
                        className="border-2 border-gray-300 focus:border-blue-500 min-h-[120px]"
                        data-testid="input-description"
                      />
                    ) : (
                      <div className="font-medium px-3 py-2 whitespace-pre-wrap">{form.watch('description') || '-'}</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Specifications */}
              {(() => {
                const specs = property.specifications;
                if (!specs || typeof specs !== 'object' || Object.keys(specs).length === 0) {
                  return null;
                }
                
                const specEntries = Object.entries(specs as Record<string, string | number | boolean | null>);
                
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Specifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {specEntries.map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <div className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                            <div className="font-medium">{value !== null && value !== undefined ? String(value) : '-'}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>

            {/* Intelligence Tab - Sales & Rate History */}
            <TabsContent value="intelligence" className="mt-0 space-y-4">
              {/* Portfolio Status Section */}
              {portfolioLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : portfolioStatus?.isOwnedAsset || (portfolioStatus?.portfolioMemberships && portfolioStatus.portfolioMemberships.length > 0) ? (
                <Card className="border-purple-200 bg-purple-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-900">
                      <FolderOpen className="w-5 h-5" />
                      Portfolio Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {portfolioStatus?.isOwnedAsset && (
                        <div className="flex items-center gap-3 p-3 bg-purple-100 rounded-lg">
                          <Briefcase className="w-5 h-5 text-purple-700" />
                          <div>
                            <div className="font-medium text-purple-900">Owned Asset</div>
                            <div className="text-sm text-purple-700">This property is in your owned asset portfolio</div>
                          </div>
                        </div>
                      )}
                      {portfolioStatus?.portfolioMemberships && portfolioStatus.portfolioMemberships.map((pm) => (
                        <div key={pm.portfolioId} className="flex items-center gap-3 p-3 bg-indigo-100 rounded-lg">
                          <FolderOpen className="w-5 h-5 text-indigo-700" />
                          <div>
                            <div className="font-medium text-indigo-900">{pm.portfolioName}</div>
                            <div className="text-sm text-indigo-700">Matched via: {pm.marinaName}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Sales History Section - County-Style Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    Sales History
                    {salesHistoryData?.matches && salesHistoryData.matches.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {salesHistoryData.matches.length} transaction{salesHistoryData.matches.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesHistoryLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                          <Skeleton className="h-10 w-full rounded" />
                        </div>
                      ))}
                    </div>
                  ) : !salesHistoryData?.matches || salesHistoryData.matches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No sales history found matching this property</p>
                      <p className="text-sm mt-1">Sales transactions will appear here when matched by name or address</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[400px]">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm" data-testid="sales-history-table">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-700">Sale Price</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Buyer</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Seller</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {salesHistoryData.matches.map((comp, index) => (
                              <tr 
                                key={comp.id} 
                                className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                data-testid={`sales-history-row-${comp.id}`}
                              >
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">
                                      {comp.saleMonth && comp.saleYear 
                                        ? `${String(comp.saleMonth).padStart(2, '0')}/${comp.saleYear}`
                                        : comp.saleYear || 'Unknown'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  {comp.salePrice ? (
                                    <span className="font-semibold text-green-700">
                                      {formatCurrency(comp.salePrice)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic">Undisclosed</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="space-y-0.5">
                                    {comp.buyerCompanyName ? (
                                      <div className="flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="font-medium text-gray-900">{comp.buyerCompanyName}</span>
                                      </div>
                                    ) : null}
                                    {comp.buyerContactName ? (
                                      <div className="flex items-center gap-1.5 text-gray-600">
                                        <User className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs">{comp.buyerContactName}</span>
                                      </div>
                                    ) : null}
                                    {!comp.buyerCompanyName && !comp.buyerContactName && (
                                      <span className="text-gray-400 italic text-xs">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="space-y-0.5">
                                    {comp.sellerCompanyName ? (
                                      <div className="flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-orange-500" />
                                        <span className="font-medium text-gray-900">{comp.sellerCompanyName}</span>
                                      </div>
                                    ) : null}
                                    {comp.sellerContactName ? (
                                      <div className="flex items-center gap-1.5 text-gray-600">
                                        <User className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs">{comp.sellerContactName}</span>
                                      </div>
                                    ) : null}
                                    {!comp.sellerCompanyName && !comp.sellerContactName && (
                                      <span className="text-gray-400 italic text-xs">—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Rate History Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Rate Analytics
                    {rateHistoryData?.matches && rateHistoryData.matches.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {rateHistoryData.matches.length} match{rateHistoryData.matches.length > 1 ? 'es' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rateHistoryLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                          <Skeleton className="h-10 w-10 rounded" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !rateHistoryData?.matches || rateHistoryData.matches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No rate data found matching this property</p>
                      <p className="text-sm mt-1">Rate comps will appear here when matched by name or address</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-3 pr-4">
                        {rateHistoryData.matches.map((comp) => (
                          <div 
                            key={comp.id} 
                            className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            data-testid={`rate-history-${comp.id}`}
                          >
                            <div className={`p-2 rounded-lg ${
                              comp.matchConfidence >= 80 ? 'bg-green-100' : 
                              comp.matchConfidence >= 60 ? 'bg-yellow-100' : 'bg-gray-100'
                            }`}>
                              <TrendingUp className={`w-5 h-5 ${
                                comp.matchConfidence >= 80 ? 'text-green-700' : 
                                comp.matchConfidence >= 60 ? 'text-yellow-700' : 'text-gray-700'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate">{comp.marinaName || 'Unnamed'}</span>
                                <Badge variant="outline" className={`text-xs ${
                                  comp.matchConfidence >= 80 ? 'border-green-500 text-green-700' : 
                                  comp.matchConfidence >= 60 ? 'border-yellow-500 text-yellow-700' : 'border-gray-400'
                                }`}>
                                  {comp.matchConfidence}% match
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                {comp.occupancy && (
                                  <span className="flex items-center gap-1">
                                    Occupancy: {comp.occupancy}%
                                  </span>
                                )}
                                {comp.salePrice && (
                                  <span className="flex items-center gap-1 text-green-700 font-medium">
                                    {formatCurrency(comp.salePrice)}
                                  </span>
                                )}
                                {(comp.wetSlips || comp.dryRacks) && (
                                  <span className="flex items-center gap-1">
                                    <Anchor className="w-3 h-3" />
                                    {comp.wetSlips ? `${comp.wetSlips} wet` : ''}{comp.wetSlips && comp.dryRacks ? ' / ' : ''}{comp.dryRacks ? `${comp.dryRacks} dry` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {comp.city}{comp.state ? `, ${comp.state}` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Linked Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedContacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No contacts linked yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedContacts.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <div className="font-semibold">
                              {link.contact?.firstName} {link.contact?.lastName}
                            </div>
                            {link.contact?.email && (
                              <div className="text-sm text-gray-600">{link.contact.email}</div>
                            )}
                            {link.relationship && (
                              <Badge variant="outline" className="text-xs mt-1">{link.relationship}</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkContactMutation.mutate(link.id)}
                            disabled={unlinkContactMutation.isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`button-unlink-contact-${link.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="companies" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Linked Companies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedCompanies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Building className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No companies linked yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedCompanies.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <div className="font-semibold">{link.company?.name || 'Unknown Company'}</div>
                            {link.relationship && (
                              <Badge variant="outline" className="text-xs mt-1">{link.relationship}</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkCompanyMutation.mutate(link.id)}
                            disabled={unlinkCompanyMutation.isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`button-unlink-company-${link.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deals" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Associated Deals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {propertyDeals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No deals associated with this property</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {propertyDeals.map((deal) => (
                        <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <div className="font-semibold">{deal.title}</div>
                            <div className="text-sm text-gray-600">
                              ${Number(deal.amount || 0).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="outline">{deal.priority || 'medium'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comps" className="mt-0">
              <PropertyIntegrationPanel 
                propertyId={property.id} 
                propertyTitle={property.title} 
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No activities recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex gap-3 border-l-2 border-gray-300 pl-4 pb-4">
                          <div className="flex-1">
                            <div className="font-semibold">{activity.subject || activity.type}</div>
                            <div className="text-sm text-gray-600">{activity.description || 'No description'}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {activity.createdAt && format(new Date(activity.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {activity.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No notes added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4 border rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">
                            {note.createdAt && format(new Date(note.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                          </div>
                          <div className="whitespace-pre-wrap">{note.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

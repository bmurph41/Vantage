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
import { 
  User, Building, MapPin, DollarSign, 
  Edit, X, Clock, Check, Loader2, Anchor, Home, Link2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Property, Contact, Company, Deal, Activity as ActivityType, Note } from "@shared/schema";
import PropertyIntegrationPanel from "@/components/crm/PropertyIntegrationPanel";

interface PropertyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
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

export default function PropertyDetailModal({ isOpen, onClose, property }: PropertyDetailModalProps) {
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
    queryKey: ['/api/properties', property?.id, 'contacts'],
    enabled: isOpen && !!property?.id,
  });

  // Fetch linked companies
  const { data: linkedCompanies = [] } = useQuery<CompanyPropertyWithCompany[]>({
    queryKey: ['/api/properties', property?.id, 'companies'],
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
          <TabsList className="grid w-full grid-cols-7 flex-shrink-0">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts ({linkedContacts.length})</TabsTrigger>
            <TabsTrigger value="companies" data-testid="tab-companies">Companies ({linkedCompanies.length})</TabsTrigger>
            <TabsTrigger value="deals" data-testid="tab-deals">Deals ({propertyDeals.length})</TabsTrigger>
            <TabsTrigger value="comps" data-testid="tab-comps">
              <Link2 className="w-3 h-3 mr-1" />
              Comps
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity ({activities.length})</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes ({notes.length})</TabsTrigger>
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
                    <Label htmlFor="address" className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      Address
                    </Label>
                    {isEditing ? (
                      <Input
                        id="address"
                        {...form.register('address')}
                        className="border-2 border-gray-300 focus:border-blue-500"
                        data-testid="input-address"
                      />
                    ) : (
                      <div className="font-medium px-3 py-2">{form.watch('address') || '-'}</div>
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

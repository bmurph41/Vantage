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
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, Building, Mail, Phone, MapPin, Star, 
  Edit, X, Clock, Save, Check, Loader2, Briefcase, Home, DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Contact, Company, Deal, Property, Activity as ActivityType, Note } from "@shared/schema";

interface ContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
}

const contactTypeColors = {
  prospect: 'bg-blue-100 text-blue-800',
  vendor: 'bg-orange-100 text-orange-800',
  buyer: 'bg-green-100 text-green-800',
  seller: 'bg-purple-100 text-purple-800',
  partner: 'bg-indigo-100 text-indigo-800',
  client: 'bg-emerald-100 text-emerald-800'
};

const leadScoreColors = {
  hot: 'bg-red-100 text-red-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-blue-100 text-blue-800',
  new: 'bg-gray-100 text-gray-800'
};

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  position: z.string().optional(),
  address: z.string().optional(),
  unit: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  contactType: z.string(),
  leadScore: z.string(),
  onDealTeam: z.boolean(),
  dealTeamNotes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

type ContactCompanyWithCompany = {
  id: string;
  contactId: string;
  companyId: string;
  role?: string | null;
  isPrimary: boolean;
  company?: Company | null;
};

type ContactPropertyWithProperty = {
  id: string;
  contactId: string;
  propertyId: string;
  relationship?: string | null;
  property?: Property | null;
};

export default function ContactDetailModal({ isOpen, onClose, contact }: ContactDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      position: contact?.position || '',
      address: contact?.address || '',
      unit: contact?.unit || '',
      city: contact?.city || '',
      state: contact?.state || '',
      zipCode: contact?.zipCode || '',
      company: contact?.company || '',
      role: contact?.role || '',
      contactType: contact?.contactType || 'prospect',
      leadScore: contact?.leadScore || 'new',
      onDealTeam: contact?.onDealTeam || false,
      dealTeamNotes: contact?.dealTeamNotes || '',
    },
  });

  // Fetch linked companies
  const { data: linkedCompanies = [] } = useQuery<ContactCompanyWithCompany[]>({
    queryKey: ['/api/contacts', contact?.id, 'companies'],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch linked properties
  const { data: linkedProperties = [] } = useQuery<ContactPropertyWithProperty[]>({
    queryKey: ['/api/contacts', contact?.id, 'properties'],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch deals associated with this contact
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    enabled: isOpen,
  });

  // Fetch activities
  const { data: activities = [] } = useQuery<ActivityType[]>({
    queryKey: ['/api/activities', 'contact', contact?.id],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch notes
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes', 'contact', contact?.id],
    enabled: isOpen && !!contact?.id,
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!contact) return;
      return await apiRequest('PATCH', `/api/contacts/${contact.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      if (!isAutosaveRef.current) {
        toast({
          title: "Success",
          description: "Contact updated successfully",
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
          description: "Failed to update contact",
          variant: "destructive",
        });
      } else {
        setSaveStatus('idle');
        isAutosaveRef.current = false;
      }
    },
  });

  const onSubmit = (data: ContactFormData) => {
    isAutosaveRef.current = false;
    updateContactMutation.mutate(data);
  };

  const autoSave = (data: ContactFormData) => {
    isAutosaveRef.current = true;
    setSaveStatus('saving');
    updateContactMutation.mutate(data);
  };

  // Reset form when contact changes
  useEffect(() => {
    if (contact) {
      form.reset({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone || '',
        position: contact.position || '',
        address: contact.address || '',
        unit: contact.unit || '',
        city: contact.city || '',
        state: contact.state || '',
        zipCode: contact.zipCode || '',
        company: contact.company || '',
        role: contact.role || '',
        contactType: contact.contactType || 'prospect',
        leadScore: contact.leadScore || 'new',
        onDealTeam: contact.onDealTeam || false,
        dealTeamNotes: contact.dealTeamNotes || '',
      });
      setIsEditing(false);
      setSaveStatus('idle');
    }
  }, [contact, form]);

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

  if (!contact) {
    return null;
  }

  const contactDeals = allDeals.filter(d => d.contactId === contact.id);
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col" data-testid="modal-contact-detail">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {/* Contact Avatar */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
                {getInitials(form.watch('firstName'), form.watch('lastName'))}
              </div>
              
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold">
                  {form.watch('firstName')} {form.watch('lastName')}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={contactTypeColors[form.watch('contactType') as keyof typeof contactTypeColors] || 'bg-gray-100 text-gray-800'}>
                    {form.watch('contactType')}
                  </Badge>
                  <Badge className={leadScoreColors[form.watch('leadScore') as keyof typeof leadScoreColors] || 'bg-gray-100 text-gray-800'}>
                    {form.watch('leadScore')} lead
                  </Badge>
                  {form.watch('onDealTeam') && (
                    <Badge variant="outline" className="border-blue-500 text-blue-700">
                      Deal Team Member
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
                  data-testid="button-edit-contact"
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
          <TabsList className="grid w-full grid-cols-6 flex-shrink-0">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="companies" data-testid="tab-companies">Companies ({linkedCompanies.length})</TabsTrigger>
            <TabsTrigger value="deals" data-testid="tab-deals">Deals ({contactDeals.length})</TabsTrigger>
            <TabsTrigger value="properties" data-testid="tab-properties">Properties ({linkedProperties.length})</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity ({activities.length})</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes ({notes.length})</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="font-semibold">First Name</Label>
                      {isEditing ? (
                        <Input
                          id="firstName"
                          {...form.register('firstName')}
                          className="border-2 border-gray-300 focus:border-blue-500"
                          data-testid="input-first-name"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('firstName')}</div>
                      )}
                      {form.formState.errors.firstName && (
                        <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="font-semibold">Last Name</Label>
                      {isEditing ? (
                        <Input
                          id="lastName"
                          {...form.register('lastName')}
                          className="border-2 border-gray-300 focus:border-blue-500"
                          data-testid="input-last-name"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('lastName')}</div>
                      )}
                      {form.formState.errors.lastName && (
                        <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-semibold flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        Email
                      </Label>
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          {...form.register('email')}
                          className="border-2 border-gray-300 focus:border-blue-500"
                          data-testid="input-email"
                        />
                      ) : (
                        <a 
                          href={`mailto:${form.watch('email')}`}
                          className="font-medium text-blue-600 hover:underline px-3 py-2 block"
                        >
                          {form.watch('email')}
                        </a>
                      )}
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-semibold flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        Phone
                      </Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          {...form.register('phone')}
                          className="border-2 border-gray-300 focus:border-blue-500"
                          data-testid="input-phone"
                        />
                      ) : (
                        <a 
                          href={`tel:${form.watch('phone')}`}
                          className="font-medium text-blue-600 hover:underline px-3 py-2 block"
                        >
                          {form.watch('phone') || '-'}
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company" className="font-semibold flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-500" />
                        Company
                      </Label>
                      {isEditing ? (
                        <Input
                          id="company"
                          {...form.register('company')}
                          className="border-2 border-gray-300 focus:border-blue-500"
                          data-testid="input-company"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('company') || '-'}</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="position" className="font-semibold flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-500" />
                        Position
                      </Label>
                      {isEditing ? (
                        <Input
                          id="position"
                          {...form.register('position')}
                          className="border-2 border-gray-300 focus:border-blue-500"
                          data-testid="input-position"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('position') || '-'}</div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Address Information */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Home className="w-4 h-4 text-gray-500" />
                      Address
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="address">Street Address</Label>
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
                        <Label htmlFor="unit">Unit/Suite</Label>
                        {isEditing ? (
                          <Input
                            id="unit"
                            {...form.register('unit')}
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="input-unit"
                          />
                        ) : (
                          <div className="font-medium px-3 py-2">{form.watch('unit') || '-'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        {isEditing ? (
                          <Input
                            id="city"
                            {...form.register('city')}
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="input-city"
                          />
                        ) : (
                          <div className="font-medium px-3 py-2">{form.watch('city') || '-'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        {isEditing ? (
                          <Input
                            id="state"
                            {...form.register('state')}
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="input-state"
                          />
                        ) : (
                          <div className="font-medium px-3 py-2">{form.watch('state') || '-'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        {isEditing ? (
                          <Input
                            id="zipCode"
                            {...form.register('zipCode')}
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="input-zip"
                          />
                        ) : (
                          <div className="font-medium px-3 py-2">{form.watch('zipCode') || '-'}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Contact Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactType" className="font-semibold">Contact Type</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('contactType')}
                          onValueChange={(value) => form.setValue('contactType', value)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="select-contact-type"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prospect">Prospect</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="buyer">Buyer</SelectItem>
                            <SelectItem value="seller">Seller</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">{form.watch('contactType')}</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leadScore" className="font-semibold">Lead Score</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('leadScore')}
                          onValueChange={(value) => form.setValue('leadScore', value)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500"
                            data-testid="select-lead-score"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hot">Hot</SelectItem>
                            <SelectItem value="warm">Warm</SelectItem>
                            <SelectItem value="cold">Cold</SelectItem>
                            <SelectItem value="new">New</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">{form.watch('leadScore')}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="font-semibold">Role/Title</Label>
                    {isEditing ? (
                      <Input
                        id="role"
                        {...form.register('role')}
                        className="border-2 border-gray-300 focus:border-blue-500"
                        data-testid="input-role"
                      />
                    ) : (
                      <div className="font-medium px-3 py-2">{form.watch('role') || '-'}</div>
                    )}
                  </div>

                  {form.watch('onDealTeam') && (
                    <div className="space-y-2">
                      <Label htmlFor="dealTeamNotes" className="font-semibold">Deal Team Notes</Label>
                      {isEditing ? (
                        <Textarea
                          id="dealTeamNotes"
                          {...form.register('dealTeamNotes')}
                          className="border-2 border-gray-300 focus:border-blue-500 min-h-[80px]"
                          data-testid="input-deal-team-notes"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('dealTeamNotes') || '-'}</div>
                      )}
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
                            {link.role && <div className="text-sm text-gray-600">{link.role}</div>}
                            {link.isPrimary && (
                              <Badge variant="outline" className="text-xs mt-1">Primary</Badge>
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
                  {contactDeals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No deals associated with this contact</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactDeals.map((deal) => (
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

            <TabsContent value="properties" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Linked Properties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedProperties.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No properties linked yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedProperties.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <div className="font-semibold">{link.property?.title || 'Unknown Property'}</div>
                            {link.relationship && <div className="text-sm text-gray-600">{link.relationship}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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

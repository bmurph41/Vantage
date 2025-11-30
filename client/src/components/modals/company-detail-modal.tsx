import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Globe, MapPin, Phone, Mail, Users, Edit2, Save, X, FileText } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { AddressInput } from "@/components/address-input";
import type { Company, Contact, Deal, Property } from "@shared/schema";

interface CompanyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
}

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

const industryColors = {
  technology: 'bg-blue-100 text-blue-800',
  manufacturing: 'bg-green-100 text-green-800',
  finance: 'bg-purple-100 text-purple-800',
  healthcare: 'bg-red-100 text-red-800',
  retail: 'bg-orange-100 text-orange-800',
  consulting: 'bg-indigo-100 text-indigo-800',
  education: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800'
};

const sizeColors = {
  'startup': 'bg-green-100 text-green-800',
  'small': 'bg-blue-100 text-blue-800', 
  'medium': 'bg-yellow-100 text-yellow-800',
  'large': 'bg-purple-100 text-purple-800',
  'enterprise': 'bg-red-100 text-red-800'
};

export default function CompanyDetailModal({ isOpen, onClose, company }: CompanyDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: company?.name || '',
      industry: company?.industry || '',
      size: company?.size || '',
      website: company?.website || '',
      phone: company?.phone || '',
      address: company?.address || '',
      description: company?.description || '',
    },
  });

  // Fetch related data
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  // Filter related entities
  const companyContacts = contacts.filter(c => c.companyId === company?.id);
  const companyDeals = deals.filter(d => d.companyId === company?.id);
  // Note: Properties table doesn't have companyId field currently
  const companyProperties: Property[] = [];

  // Reset form when company changes
  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || '',
        industry: company.industry || '',
        size: company.size || '',
        website: company.website || '',
        phone: company.phone || '',
        address: company.address || '',
        description: company.description || '',
      });
      setIsEditing(false);
      setSaveStatus('idle');
    }
  }, [company, form]);

  // Autosave functionality
  useEffect(() => {
    if (!isEditing || !company) return;

    const subscription = form.watch(() => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(async () => {
        if (form.formState.isDirty && form.formState.isValid) {
          isAutosaveRef.current = true;
          await handleSave();
        }
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isEditing, company, form]);

  const handleSave = async () => {
    if (!company) return;

    try {
      setSaveStatus('saving');
      const formData = form.getValues();
      
      await apiRequest('PUT', `/api/companies/${company.id}`, formData);
      
      await queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      
      setSaveStatus('saved');
      
      if (!isAutosaveRef.current) {
        toast({ title: "Company updated successfully" });
        setIsEditing(false);
      }
      
      isAutosaveRef.current = false;
      
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error: any) {
      setSaveStatus('idle');
      toast({ 
        title: "Failed to update company", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const handleCancel = () => {
    if (company) {
      form.reset({
        name: company.name || '',
        industry: company.industry || '',
        size: company.size || '',
        website: company.website || '',
        phone: company.phone || '',
        address: company.address || '',
        description: company.description || '',
      });
    }
    setIsEditing(false);
    setSaveStatus('idle');
  };

  if (!company) {
    return null;
  }

  const getIndustryCategory = (industry?: string): string => {
    if (!industry) return 'other';
    const normalized = industry.toLowerCase();
    if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('it')) return 'technology';
    if (normalized.includes('health') || normalized.includes('medical')) return 'healthcare';
    if (normalized.includes('finance') || normalized.includes('bank')) return 'finance';
    if (normalized.includes('retail') || normalized.includes('store')) return 'retail';
    if (normalized.includes('manufactur')) return 'manufacturing';
    if (normalized.includes('consult')) return 'consulting';
    if (normalized.includes('educat') || normalized.includes('school')) return 'education';
    return 'other';
  };

  const getSizeCategory = (size?: string): string => {
    if (!size) return 'small';
    const normalized = size.toLowerCase();
    if (normalized.includes('startup') || normalized.includes('1-10')) return 'startup';
    if (normalized.includes('small') || normalized.includes('11-50')) return 'small';
    if (normalized.includes('medium') || normalized.includes('51-200')) return 'medium';
    if (normalized.includes('large') || normalized.includes('201-1000')) return 'large';
    if (normalized.includes('enterprise') || normalized.includes('1000+')) return 'enterprise';
    return 'small';
  };

  const industryCategory = getIndustryCategory(company.industry ?? undefined);
  const sizeCategory = getSizeCategory(company.size ?? undefined);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{company.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {company.industry && (
                  <Badge className={industryColors[industryCategory as keyof typeof industryColors] || 'bg-gray-100 text-gray-800'}>
                    {company.industry}
                  </Badge>
                )}
                {company.size && (
                  <Badge className={sizeColors[sizeCategory as keyof typeof sizeColors] || 'bg-gray-100 text-gray-800'}>
                    {company.size}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <span className="text-sm text-gray-500">Saving...</span>}
            {saveStatus === 'saved' && <span className="text-sm text-green-600">Saved</span>}
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" data-testid="button-edit">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button onClick={handleCancel} variant="outline" size="sm" data-testid="button-cancel">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} size="sm" data-testid="button-save">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <TabsList className="bg-transparent">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white" data-testid="tab-overview">
                Overview
              </TabsTrigger>
              <TabsTrigger value="contacts" className="data-[state=active]:bg-white" data-testid="tab-contacts">
                Contacts ({companyContacts.length})
              </TabsTrigger>
              <TabsTrigger value="deals" className="data-[state=active]:bg-white" data-testid="tab-deals">
                Deals ({companyDeals.length})
              </TabsTrigger>
              <TabsTrigger value="properties" className="data-[state=active]:bg-white" data-testid="tab-properties">
                Properties ({companyProperties.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="data-[state=active]:bg-white" data-testid="tab-notes">
                Notes
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 p-6" data-testid="content-overview">
              <Form {...form}>
                <div className="space-y-6">
                  {/* Basic Information Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Company Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} data-testid="input-name" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="industry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Industry</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={!isEditing} data-testid="input-industry" />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Size</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={!isEditing} data-testid="input-size" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Information Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <Globe className="w-4 h-4 inline mr-2" />
                              Website
                            </FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} data-testid="input-website" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <Phone className="w-4 h-4 inline mr-2" />
                              Phone
                            </FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} data-testid="input-phone" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <AddressInput
                                value={field.value || ""}
                                onChange={(value) => field.onChange(value)}
                                label="Address"
                                placeholder="Start typing an address..."
                                disabled={!isEditing}
                                testId="input-address"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Description Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <FileText className="w-4 h-4 inline mr-2" />
                        Description
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                disabled={!isEditing} 
                                rows={4}
                                placeholder="Add description about this company..."
                                data-testid="input-description"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </Form>
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="m-0 p-6" data-testid="content-contacts">
              <Card>
                <CardHeader>
                  <CardTitle>Related Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                  {companyContacts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No contacts associated with this company</p>
                  ) : (
                    <div className="space-y-3">
                      {companyContacts.map(contact => (
                        <div key={contact.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50" data-testid={`contact-${contact.id}`}>
                          <div className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</div>
                          <div className="text-sm text-gray-500">{contact.position || contact.role || 'No title'}</div>
                          <div className="text-sm text-gray-500 mt-1">{contact.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="m-0 p-6" data-testid="content-deals">
              <Card>
                <CardHeader>
                  <CardTitle>Related Deals</CardTitle>
                </CardHeader>
                <CardContent>
                  {companyDeals.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No deals associated with this company</p>
                  ) : (
                    <div className="space-y-3">
                      {companyDeals.map(deal => (
                        <div key={deal.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50" data-testid={`deal-${deal.id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{deal.title}</div>
                              <div className="text-sm text-gray-500">{deal.marinaName || 'No marina'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">${deal.value?.toLocaleString() || '0'}</div>
                              <Badge className="mt-1">{deal.stage}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Properties Tab */}
            <TabsContent value="properties" className="m-0 p-6" data-testid="content-properties">
              <Card>
                <CardHeader>
                  <CardTitle>Related Properties</CardTitle>
                </CardHeader>
                <CardContent>
                  {companyProperties.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No properties associated with this company</p>
                  ) : (
                    <div className="space-y-3">
                      {companyProperties.map(property => (
                        <div key={property.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50" data-testid={`property-${property.id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{property.title}</div>
                              <div className="text-sm text-gray-500">{property.address || 'No address'}</div>
                            </div>
                            <Badge>{property.type}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 p-6" data-testid="content-notes">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{company.description || 'No description available'}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

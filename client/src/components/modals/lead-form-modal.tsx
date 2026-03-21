import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, User, Building, Home, Plus, ArrowRight, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getLeadAttributionData } from "@/utils/utm-tracker";
import { z } from "zod";
import { insertLeadSchema, type Lead, type Contact, type Company, type Property, type Account, type Campaign, type User as UserType } from "@shared/schema";

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onCompanyCreated?: (companyId: string) => void;
  onContactCreated?: (contactId: string) => void;
}

const leadStatuses = [
  { value: "none", label: "None" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
];

const leadSources = [
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "email", label: "Email" },
  { value: "referral", label: "Referral" },
  { value: "cold_call", label: "Cold Call" },
  { value: "event", label: "Event" },
  { value: "advertisement", label: "Advertisement" },
  { value: "direct", label: "Direct" },
  { value: "other", label: "Other" },
];

const prospectStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'target', label: 'Target' },
  { value: 'referral', label: 'Referral' },
  { value: 'past_client', label: 'Past Client' },
  { value: 'cold', label: 'Cold' },
  { value: 'nurture', label: 'Nurture' },
];

export default function LeadFormModal({ isOpen, onClose, lead, onCompanyCreated, onContactCreated }: LeadFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("manual");
  const [searchTerm, setSearchTerm] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen && activeTab !== "manual",
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen && activeTab !== "manual",
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    enabled: isOpen && activeTab !== "manual",
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  const form = useForm({
    resolver: zodResolver(insertLeadSchema.extend({
      description: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      leadSource: z.string().optional(),
    })),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      leadStatus: "new",
      prospectStatus: "active",
      leadSource: "",
      assignedToId: "",
      description: "",
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        jobTitle: lead.jobTitle || "",
        leadStatus: lead.leadStatus,
        prospectStatus: lead.prospectStatus || "active",
        leadSource: lead.leadSource || "",
        assignedToId: lead.assignedToId || "",
        description: "",
      });
    } else if (isOpen && users.length > 0 && !form.getValues('assignedToId')) {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        jobTitle: "",
        leadStatus: "new",
        prospectStatus: "active",
        leadSource: "",
        assignedToId: users[0].id,
        description: "",
      });
    }
  }, [lead, isOpen, users]);

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      const attributionData = getLeadAttributionData();
      
      const requiredFields = ['email', 'firstName', 'lastName', 'assignedToId', 'leadStatus', 'leadSource'];
      
      const cleanData = { 
        ...data,
        ...attributionData,
        firstVisitDate: new Date().toISOString(),
        lastVisitDate: new Date().toISOString(),
        assignedToId: data.assignedToId || (users.length > 0 ? users[0].id : undefined),
      };
      
      Object.keys(cleanData).forEach(key => {
        if (!requiredFields.includes(key) && (cleanData[key] === "" || cleanData[key] === undefined)) {
          delete cleanData[key];
        }
      });
      
      const leadResponse = await apiRequest('POST', '/api/leads', cleanData);
      const lead = await leadResponse.json();
      
      let companyId = null;
      if (data.company && data.company.trim()) {
        const companyData = {
          name: data.company.trim(),
        };
        const companyResponse = await apiRequest('POST', '/api/companies', companyData);
        const company = await companyResponse.json();
        companyId = company.id;
      }
      
      const contactData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        role: data.jobTitle,
        companyId: companyId,
      };
      const contactResponse = await apiRequest('POST', '/api/contacts', contactData);
      const contact = await contactResponse.json();
      
      return { lead: lead.id, company: companyId, contact: contact.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      toast({ 
        title: "Lead created successfully",
        description: "Lead, company, and contact records have been created. You can edit them anytime from their respective pages."
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        score: parseInt(data.score) || 0,
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('PUT', `/api/leads/${lead!.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: "Lead updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: any) => {
    if (lead) {
      updateLeadMutation.mutate(data);
    } else {
      createLeadMutation.mutate(data);
    }
  };

  const handlePrimaryAction = () => {
    if (activeTab === "manual") {
      formRef.current?.requestSubmit();
    }
  };

  const populateFromContact = (contact: Contact) => {
    form.setValue("firstName", contact.firstName);
    form.setValue("lastName", contact.lastName);
    form.setValue("email", contact.email || "");
    form.setValue("phone", contact.phone || "");
    form.setValue("company", contact.company || "");
    form.setValue("jobTitle", contact.role || "");
    setActiveTab("manual");
  };

  const populateFromCompany = (company: Company) => {
    form.setValue("company", company.name);
    form.setValue("firstName", "");
    form.setValue("lastName", "");
    form.setValue("email", "");
    form.setValue("phone", company.phone || "");
    setActiveTab("manual");
  };

  const populateFromProperty = (property: Property) => {
    form.setValue("firstName", "");
    form.setValue("lastName", "");
    form.setValue("company", "");
    form.setValue("email", "");
    form.setValue("phone", "");
    form.setValue("description", `Interest in property: ${property.title}`);
    setActiveTab("manual");
  };

  const filteredContacts = contacts.filter(contact =>
    searchTerm === "" || 
    `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompanies = companies.filter(company =>
    searchTerm === "" || 
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProperties = properties.filter(property =>
    searchTerm === "" || 
    property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    property.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = createLeadMutation.isPending || updateLeadMutation.isPending;

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={lead ? "Edit Lead" : "Create Lead"}
      icon={UserPlus}
      size="lg"
      showProgressBar={true}
      primaryAction={activeTab === "manual" ? {
        label: lead ? "Update" : "Create",
        onClick: handlePrimaryAction,
        disabled: isLoading,
        loading: isLoading,
      } : undefined}
      secondaryAction={activeTab === "manual" ? {
        label: "Back",
        onClick: onClose,
        disabled: isLoading,
      } : undefined}
    >
      <div data-testid="modal-lead-form">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-4">
            <TabsTrigger value="manual">New Contact</TabsTrigger>
            <TabsTrigger value="contacts">From Contact</TabsTrigger>
            <TabsTrigger value="companies">From Company</TabsTrigger>
            <TabsTrigger value="properties">From Property</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-contacts"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredContacts.map((contact) => (
                <Card key={contact.id} className="cursor-pointer hover:bg-gray-50" onClick={() => populateFromContact(contact)}>
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                        <div className="text-sm text-gray-500">{contact.email}</div>
                        <div className="text-sm text-gray-500">{contact.company}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="companies" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-companies"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredCompanies.map((company) => (
                <Card key={company.id} className="cursor-pointer hover:bg-gray-50" onClick={() => populateFromCompany(company)}>
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Building className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-gray-500">{company.industry}</div>
                        <div className="text-sm text-gray-500">{company.phone}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="properties" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search properties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-properties"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredProperties.map((property) => (
                <Card key={property.id} className="cursor-pointer hover:bg-gray-50" onClick={() => populateFromProperty(property)}>
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Home className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{property.title}</div>
                        <div className="text-sm text-gray-500">{property.address}</div>
                        <div className="text-sm text-gray-500">{property.type}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <Form {...form}>
              <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Company Name" {...field} data-testid="input-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Marketing Manager" {...field} data-testid="input-job-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {leadStatuses.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="leadSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {leadSources.map((source) => (
                              <SelectItem key={source.value} value={source.value}>
                                {source.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-assigned-to">
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prospectStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prospect Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-prospect-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {prospectStatuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </StandardDialogShell>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { X, User, Building, Handshake, DollarSign, Target, Tag, Percent, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Contact, Company, Deal, PipelineStage, Lead } from "@shared/schema";

interface EntityConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceEntity: Contact | Company | any | null; // Could be contact, company, or property
  sourceType: 'contact' | 'company' | 'property';
  conversionType: 'deal' | 'lead';
}

const conversionSchema = z.object({
  // Basic Information
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().default("USD"),
  
  // Pipeline & Stage
  pipeline: z.string().min(1, "Pipeline is required"),
  stage: z.string().min(1, "Stage is required"),
  probability: z.number().min(0).max(100).default(0),
  
  // Relationships
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  
  // Contact Information
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  contactRole: z.string().optional(),
  
  // Marina Organization Fields
  wetSlips: z.string().optional(),
  dryRacks: z.string().optional(),
  landStorage: z.string().optional(),
  moorings: z.string().optional(),
  rvSites: z.string().optional(),
  amenities: z.string().optional(),
  grossRevenue: z.string().optional(),
  ebitda: z.string().optional(),
  lastSalePrice: z.string().optional(),
  ownership: z.string().optional(),
  jetSkis: z.string().optional(),
  
  // Additional Fields
  labels: z.array(z.string()).default([]),
  dealSource: z.string().optional(),
  expectedCloseDate: z.date().optional(),
  priority: z.string().default("medium"),
});

type ConversionFormData = z.infer<typeof conversionSchema>;

const currencies = [
  { value: "USD", label: "US Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "CAD", label: "Canadian Dollar (CAD)" },
];

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const dealSources = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "social_media", label: "Social Media" },
  { value: "trade_show", label: "Trade Show" },
  { value: "existing_customer", label: "Existing Customer" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const ownershipTypes = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
  { value: "municipal", label: "Municipal" },
  { value: "corporate", label: "Corporate" },
  { value: "cooperative", label: "Cooperative" },
  { value: "other", label: "Other" },
];

export default function EntityConversionModal({
  isOpen,
  onClose,
  sourceEntity,
  sourceType,
  conversionType
}: EntityConversionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");

  // Fetch required data
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen,
  });

  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages'],
    enabled: isOpen,
  });

  // Prepare contact options for searchable select
  const contactOptions = useMemo(() => {
    const options = contacts.map((contact) => ({
      value: contact.id,
      label: `${contact.firstName} ${contact.lastName}${contact.email ? ` (${contact.email})` : ''}`,
    }));
    return [{ value: "", label: "No contact" }, ...options];
  }, [contacts]);

  // Prepare company options for searchable select
  const companyOptions = useMemo(() => {
    const options = companies.map((company) => ({
      value: company.id,
      label: company.name,
    }));
    return [{ value: "", label: "No company" }, ...options];
  }, [companies]);

  const form = useForm<ConversionFormData>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      title: "",
      description: "",
      amount: "",
      currency: "USD",
      pipeline: "buyer-broker-lead",
      stage: "lead",
      probability: 0,
      contactId: "",
      companyId: "",
      contactPhone: "",
      contactEmail: "",
      contactRole: "",
      wetSlips: "",
      dryRacks: "",
      landStorage: "",
      moorings: "",
      rvSites: "",
      amenities: "",
      grossRevenue: "",
      ebitda: "",
      lastSalePrice: "",
      ownership: "",
      jetSkis: "",
      labels: [],
      dealSource: "",
      priority: "medium",
    },
  });

  // Initialize form with source entity data
  useEffect(() => {
    if (sourceEntity && isOpen) {
      const updates: Partial<ConversionFormData> = {};
      
      if (sourceType === 'contact') {
        updates.contactId = sourceEntity.id;
        updates.contactPhone = sourceEntity.phone || "";
        updates.contactEmail = sourceEntity.email || "";
        updates.title = `${conversionType === 'deal' ? 'Deal' : 'Lead'} - ${sourceEntity.firstName} ${sourceEntity.lastName}`;
      } else if (sourceType === 'company') {
        updates.companyId = sourceEntity.id;
        updates.title = `${conversionType === 'deal' ? 'Deal' : 'Lead'} - ${sourceEntity.name}`;
      } else if (sourceType === 'property') {
        updates.title = `${conversionType === 'deal' ? 'Deal' : 'Lead'} - ${sourceEntity.name || sourceEntity.title || 'Property'}`;
      }
      
      form.reset({
        ...form.getValues(),
        ...updates
      });
    }
  }, [sourceEntity, sourceType, conversionType, isOpen, form]);

  // Get pipeline stages for selected pipeline
  const selectedPipeline = form.watch("pipeline");
  const availableStages = pipelineStages.filter(stage => stage.pipelineName === selectedPipeline);

  // Auto-update probability based on selected stage
  const selectedStage = form.watch("stage");
  useEffect(() => {
    const stage = availableStages.find(s => s.name === selectedStage);
    if (stage && stage.probability !== undefined) {
      form.setValue("probability", stage.probability);
    }
  }, [selectedStage, availableStages, form]);

  // Conversion mutation
  const conversionMutation = useMutation({
    mutationFn: async (data: ConversionFormData) => {
      const endpoint = conversionType === 'deal' ? '/api/deals' : '/api/leads';
      
      const payload = {
        ...data,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        grossRevenue: data.grossRevenue ? parseFloat(data.grossRevenue) : undefined,
        ebitda: data.ebitda ? parseFloat(data.ebitda) : undefined,
        lastSalePrice: data.lastSalePrice ? parseFloat(data.lastSalePrice) : undefined,
        sourceEntityId: sourceEntity?.id,
        sourceEntityType: sourceType,
      };
      
      return apiRequest('POST', endpoint, payload);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${conversionType === 'deal' ? 'Deal' : 'Lead'} created successfully from ${sourceType}`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [conversionType === 'deal' ? '/api/deals' : '/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to create ${conversionType}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConversionFormData) => {
    conversionMutation.mutate(data);
  };

  const getEntityDisplayName = () => {
    if (!sourceEntity) return "";
    
    switch (sourceType) {
      case 'contact':
        return `${sourceEntity.firstName} ${sourceEntity.lastName}`;
      case 'company':
        return sourceEntity.name;
      case 'property':
        return sourceEntity.name || sourceEntity.title || "Property";
      default:
        return "";
    }
  };

  const getEntityIcon = () => {
    switch (sourceType) {
      case 'contact':
        return User;
      case 'company':
        return Building;
      case 'property':
        return Target;
      default:
        return Target;
    }
  };

  const EntityIcon = getEntityIcon();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="entity-conversion-modal">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${conversionType === 'deal' ? 'bg-blue-100' : 'bg-green-100'}`}>
              {conversionType === 'deal' ? (
                <Handshake className={`w-5 h-5 ${conversionType === 'deal' ? 'text-blue-600' : 'text-green-600'}`} />
              ) : (
                <Target className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                Convert to {conversionType === 'deal' ? 'Deal' : 'Lead'}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                <EntityIcon className="w-4 h-4" />
                <span>From {sourceType}: {getEntityDisplayName()}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-conversion">
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="basic" className="text-sm">Basic Info</TabsTrigger>
                <TabsTrigger value="contact" className="text-sm">Contact Details</TabsTrigger>
                <TabsTrigger value="organization" className="text-sm">Organization</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6 mt-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="contactId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Contact person
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={contactOptions}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Search contacts..."
                              searchPlaceholder="Type to search contacts..."
                              emptyText="No contacts found"
                              testId="select-contact"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            Organization
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={companyOptions}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Search organizations..."
                              searchPlaceholder="Type to search organizations..."
                              emptyText="No organizations found"
                              testId="select-company"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter title" data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Value
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="0" type="number" data-testid="input-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-currency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {currencies.map((currency) => (
                                  <SelectItem key={currency.value} value={currency.value}>
                                    {currency.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="pipeline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pipeline</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-pipeline">
                                <SelectValue placeholder="Select pipeline" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="buyer-broker-lead">Buyer-Broker Lead</SelectItem>
                              <SelectItem value="listing-acquisition">Listing Acquisition</SelectItem>
                              <SelectItem value="marina-sales">Marina Sales</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Pipeline Stage Visualization */}
                    <div className="space-y-3">
                      <FormLabel>Pipeline stage</FormLabel>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {availableStages.map((stage, index) => (
                            <div
                              key={stage.id}
                              className={`flex-1 h-2 rounded-full cursor-pointer transition-colors ${
                                selectedStage === stage.name
                                  ? 'bg-green-500'
                                  : index < availableStages.findIndex(s => s.name === selectedStage)
                                  ? 'bg-green-300'
                                  : 'bg-gray-200'
                              }`}
                              onClick={() => form.setValue("stage", stage.name)}
                            />
                          ))}
                        </div>
                        <FormField
                          control={form.control}
                          name="stage"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-stage">
                                    <SelectValue placeholder="Select stage" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableStages.map((stage) => (
                                    <SelectItem key={stage.id} value={stage.name}>
                                      {stage.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="probability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            Probability
                          </FormLabel>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <Progress value={field.value} className="flex-1" />
                              <span className="text-sm font-medium w-12">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                data-testid="input-probability"
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dealSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-deal-source">
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No source</SelectItem>
                              {dealSources.map((source) => (
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
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-lg font-medium">
                    <User className="w-5 h-5" />
                    Person
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="(239) 461-0775" data-testid="input-contact-phone" />
                            </FormControl>
                            <Select defaultValue="work">
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="work">Work</SelectItem>
                                <SelectItem value="mobile">Mobile</SelectItem>
                                <SelectItem value="home">Home</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button variant="outline" size="sm" className="mt-6">
                      + Add phone
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="email@example.com" data-testid="input-contact-email" />
                            </FormControl>
                            <Select defaultValue="work">
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="work">Work</SelectItem>
                                <SelectItem value="personal">Personal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button variant="outline" size="sm" className="mt-6">
                      + Add email
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="organization" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-lg font-medium">
                    <Building className="w-5 h-5" />
                    Organization
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="wetSlips"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wet Slips</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="131" data-testid="input-wet-slips" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dryRacks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dry Racks</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter number" data-testid="input-dry-racks" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="landStorage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Land Storage</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter details" data-testid="input-land-storage" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="moorings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Moorings</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter number" data-testid="input-moorings" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rvSites"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RV Sites</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter number" data-testid="input-rv-sites" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amenities"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amenities</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-amenities">
                                <SelectValue placeholder="Select amenities" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No amenities</SelectItem>
                              <SelectItem value="restaurant">Restaurant</SelectItem>
                              <SelectItem value="fuel_dock">Fuel Dock</SelectItem>
                              <SelectItem value="ship_store">Ship Store</SelectItem>
                              <SelectItem value="repair_services">Repair Services</SelectItem>
                              <SelectItem value="swimming_pool">Swimming Pool</SelectItem>
                              <SelectItem value="clubhouse">Clubhouse</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="grossRevenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gross Revenue</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter amount" type="number" data-testid="input-gross-revenue" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ebitda"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EBITDA</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter amount" type="number" data-testid="input-ebitda" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastSalePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Sale Price</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="Enter amount" type="number" data-testid="input-last-sale-price" />
                            </FormControl>
                            <Select defaultValue="USD">
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currencies.map((currency) => (
                                  <SelectItem key={currency.value} value={currency.value}>
                                    {currency.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ownership"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ownership</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-ownership">
                                <SelectValue placeholder="Select ownership type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No ownership info</SelectItem>
                              {ownershipTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
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
                      name="jetSkis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jet Skis</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter number" data-testid="input-jet-skis" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <AlertCircle className="w-4 h-4" />
                <span>Converting {sourceType}: {getEntityDisplayName()}</span>
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel-conversion"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={conversionMutation.isPending}
                  data-testid="button-save-conversion"
                  className={conversionType === 'deal' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
                >
                  {conversionMutation.isPending 
                    ? 'Converting...' 
                    : `Create ${conversionType === 'deal' ? 'Deal' : 'Lead'}`
                  }
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
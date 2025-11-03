import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CalendarIcon, Percent, DollarSign, Anchor, MapPin, 
  FileText, Users, TrendingUp, Calendar as CalendarClock
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { insertDealSchema, type Deal, type Contact, type Company, type PipelineStage } from "@shared/schema";
import { cn } from "@/lib/utils";

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  defaultStage?: string;
}

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const dealSources = [
  { value: "inbound", label: "Inbound", commissionRate: 3.0 },
  { value: "outbound", label: "Outbound", commissionRate: 4.0 },
  { value: "referral", label: "Referral", commissionRate: 2.5 },
  { value: "partner", label: "Partner", commissionRate: 2.0 },
  { value: "organic", label: "Organic", commissionRate: 3.5 },
];

const commissionTypes = [
  { value: "percentage", label: "Percentage of Deal Value" },
  { value: "fixed", label: "Fixed Amount" },
  { value: "tiered", label: "Tiered" },
];

const propertyTypes = [
  { value: "slip", label: "Slip/Berth" },
  { value: "mooring", label: "Mooring" },
  { value: "dry_storage", label: "Dry Storage" },
  { value: "live_aboard", label: "Live Aboard" },
  { value: "marina_business", label: "Marina Business" },
  { value: "waterfront_property", label: "Waterfront Property" },
];

// Stage Combobox Component
function StageCombobox({ value, onChange, stages, onCreateStage }: {
  value: string;
  onChange: (value: string) => void;
  stages: PipelineStage[];
  onCreateStage: (stageName: string) => Promise<any>;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filteredStages = stages.filter(stage =>
    stage.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleCreateStage = async () => {
    if (!searchValue.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateStage(searchValue.trim());
      onChange(searchValue.trim());
      setSearchValue("");
      setOpen(false);
    } catch (error) {
      console.error("Failed to create stage:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const selectedStage = stages.find(s => s.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="select-stage"
        >
          {selectedStage 
            ? selectedStage.name.charAt(0).toUpperCase() + selectedStage.name.slice(1).replace('_', ' ')
            : value
            ? value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ')
            : "Select or create stage..."}
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <div className="flex items-center border-b px-3">
          <Input
            placeholder="Search or type new stage..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="border-0 focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filteredStages.length > 0 ? (
            filteredStages.map((stage) => (
              <div
                key={stage.id}
                className="cursor-pointer px-3 py-2 hover:bg-gray-100 flex items-center justify-between"
                onClick={() => {
                  onChange(stage.name);
                  setOpen(false);
                  setSearchValue("");
                }}
              >
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: stage.color || '#6b7280' }}
                  />
                  <span>{stage.name.charAt(0).toUpperCase() + stage.name.slice(1).replace('_', ' ')}</span>
                </div>
              </div>
            ))
          ) : searchValue.trim() ? (
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-2">No matching stages found.</p>
              <Button
                onClick={handleCreateStage}
                disabled={isCreating}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isCreating ? "Creating..." : `Create "${searchValue}"`}
              </Button>
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-500">
              Type to search or create a new stage
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DealFormModal({ isOpen, onClose, deal, defaultStage }: DealFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const contactOptions = useMemo(() => {
    const options = contacts.map((contact) => ({
      value: contact.id,
      label: `${contact.firstName} ${contact.lastName}${contact.email ? ` (${contact.email})` : ''}`,
    }));
    return [{ value: "none", label: "No contact" }, ...options];
  }, [contacts]);

  const companyOptions = useMemo(() => {
    const options = companies.map((company) => ({
      value: company.id,
      label: company.name,
    }));
    return [{ value: "none", label: "No company" }, ...options];
  }, [companies]);

  const form = useForm({
    resolver: zodResolver(insertDealSchema.extend({
      primaryContactId: insertDealSchema.shape.primaryContactId.optional(),
      accountId: insertDealSchema.shape.accountId.optional(),
      referralAgentId: insertDealSchema.shape.referralAgentId.optional(),
      transactionCoordinatorId: insertDealSchema.shape.transactionCoordinatorId.optional(),
      description: insertDealSchema.shape.description.optional(),
      expectedCloseDate: z.date().optional(),
      dealSource: z.string().optional(),
      commissionType: z.string().optional(),
      commissionRate: z.string().min(1, "Commission rate is required").refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100, "Must be a valid percentage between 0 and 100").optional(),
      commissionAmount: z.string().refine((val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), "Must be a valid positive number").optional(),
      marinaName: z.string().optional(),
      slipNumber: z.string().optional(),
      dockLocation: z.string().optional(),
      propertyType: z.string().optional(),
      leaseTermMonths: z.string().refine((val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 1200), "Must be a valid number of months between 1 and 1200").optional(),
      propertyDetails: z.object({
        slipsTotal: z.string().optional(),
        linearFeet: z.string().optional(),
        maxBoatLength: z.string().optional(),
        highDryCapacity: z.string().optional(),
        winterStorageCapacity: z.string().optional(),
        occupancyRate: z.string().optional(),
        acreage: z.string().optional(),
        ownershipType: z.string().optional(),
        expansionApproved: z.string().optional(),
        buildingSize: z.string().optional(),
        fuelCapacity: z.string().optional(),
        equipment: z.string().optional(),
        amenities: z.string().optional(),
        servicesOffered: z.string().optional(),
        recentImprovements: z.string().optional(),
        locationDetails: z.string().optional(),
        marketPosition: z.string().optional(),
        grossRevenue: z.string().optional(),
        noi: z.string().optional(),
        revenueBreakdown: z.string().optional(),
        additionalNotes: z.string().optional(),
      }).optional(),
    })),
    defaultValues: {
      name: "",
      description: "",
      amount: "",
      stage: defaultStage || "lead",
      priority: "medium",
      expectedCloseDate: undefined,
      primaryContactId: "none",
      accountId: "none",
      referralAgentId: "none",
      transactionCoordinatorId: "none",
      dealSource: "inbound",
      commissionType: "percentage",
      commissionRate: "3.0",
      commissionAmount: "",
      marinaName: "",
      slipNumber: "",
      dockLocation: "",
      propertyType: "",
      leaseTermMonths: "",
      propertyDetails: {
        slipsTotal: "",
        linearFeet: "",
        maxBoatLength: "",
        highDryCapacity: "",
        winterStorageCapacity: "",
        occupancyRate: "",
        acreage: "",
        ownershipType: "",
        expansionApproved: "",
        buildingSize: "",
        fuelCapacity: "",
        equipment: "",
        amenities: "",
        servicesOffered: "",
        recentImprovements: "",
        locationDetails: "",
        marketPosition: "",
        grossRevenue: "",
        noi: "",
        revenueBreakdown: "",
        additionalNotes: "",
      },
    },
  });

  const dealAmount = form.watch("amount");
  const dealSource = form.watch("dealSource");
  const commissionType = form.watch("commissionType");
  const commissionRate = form.watch("commissionRate");

  useEffect(() => {
    if (commissionType === "percentage" && dealAmount && commissionRate) {
      const amount = parseFloat(dealAmount) || 0;
      const rate = parseFloat(commissionRate) || 0;
      const calculated = (amount * rate) / 100;
      form.setValue("commissionAmount", calculated.toFixed(2));
    }
  }, [dealAmount, commissionRate, commissionType, form]);

  useEffect(() => {
    if (dealSource && commissionType === "percentage") {
      const sourceConfig = dealSources.find(s => s.value === dealSource);
      if (sourceConfig) {
        form.setValue("commissionRate", sourceConfig.commissionRate.toString());
      }
    }
  }, [dealSource, commissionType, form]);

  useEffect(() => {
    if (deal) {
      const propDetails = (deal.propertyDetails || {}) as any;
      form.reset({
        name: deal.title,
        description: deal.description || "",
        amount: deal.amount?.toString() || "",
        stage: deal.stage,
        priority: deal.priority,
        expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) as any : undefined,
        primaryContactId: deal.primaryContactId || "none",
        accountId: deal.accountId || "none",
        dealSource: deal.dealSource || "inbound",
        commissionType: deal.commissionType || "percentage",
        commissionRate: deal.commissionRate?.toString() || "3.0",
        commissionAmount: deal.commissionAmount?.toString() || "",
        marinaName: deal.marinaName || "",
        slipNumber: deal.slipNumber || "",
        dockLocation: deal.dockLocation || "",
        propertyType: deal.propertyType || "",
        leaseTermMonths: deal.leaseTermMonths?.toString() || "",
        propertyDetails: {
          slipsTotal: propDetails.slipsTotal?.toString() || "",
          linearFeet: propDetails.linearFeet?.toString() || "",
          maxBoatLength: propDetails.maxBoatLength?.toString() || "",
          highDryCapacity: propDetails.highDryCapacity?.toString() || "",
          winterStorageCapacity: propDetails.winterStorageCapacity?.toString() || "",
          occupancyRate: propDetails.occupancyRate?.toString() || "",
          acreage: propDetails.acreage?.toString() || "",
          ownershipType: propDetails.ownershipType || "",
          expansionApproved: propDetails.expansionApproved?.toString() || "",
          buildingSize: propDetails.buildingSize?.toString() || "",
          fuelCapacity: propDetails.fuelCapacity?.toString() || "",
          equipment: propDetails.equipment || "",
          amenities: propDetails.amenities || "",
          servicesOffered: propDetails.servicesOffered || "",
          recentImprovements: propDetails.recentImprovements || "",
          locationDetails: propDetails.locationDetails || "",
          marketPosition: propDetails.marketPosition || "",
          grossRevenue: propDetails.grossRevenue?.toString() || "",
          noi: propDetails.noi?.toString() || "",
          revenueBreakdown: propDetails.revenueBreakdown || "",
          additionalNotes: propDetails.additionalNotes || "",
        },
      });
    } else {
      form.reset({
        name: "",
        description: "",
        amount: "",
        stage: defaultStage || "lead",
        priority: "medium",
        expectedCloseDate: undefined,
        primaryContactId: "none",
        accountId: "none",
        dealSource: "inbound",
        commissionType: "percentage",
        commissionRate: "3.0",
        commissionAmount: "",
        marinaName: "",
        slipNumber: "",
        dockLocation: "",
        propertyType: "",
        leaseTermMonths: "",
        propertyDetails: {
          slipsTotal: "",
          linearFeet: "",
          maxBoatLength: "",
          highDryCapacity: "",
          winterStorageCapacity: "",
          occupancyRate: "",
          acreage: "",
          ownershipType: "",
          expansionApproved: "",
          buildingSize: "",
          fuelCapacity: "",
          equipment: "",
          amenities: "",
          servicesOffered: "",
          recentImprovements: "",
          locationDetails: "",
          marketPosition: "",
          grossRevenue: "",
          noi: "",
          revenueBreakdown: "",
          additionalNotes: "",
        },
      });
    }
  }, [deal, defaultStage, form]);

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const parseNumber = (val: string | undefined, parser: (s: string) => number) => {
        if (!val || val === "") return null;
        const parsed = parser(val);
        return isNaN(parsed) ? null : parsed;
      };

      // Clean and parse propertyDetails
      const propertyDetails: any = {};
      if (data.propertyDetails) {
        const pd = data.propertyDetails;
        if (pd.slipsTotal) propertyDetails.slipsTotal = parseNumber(pd.slipsTotal, parseInt);
        if (pd.linearFeet) propertyDetails.linearFeet = parseNumber(pd.linearFeet, parseInt);
        if (pd.maxBoatLength) propertyDetails.maxBoatLength = parseNumber(pd.maxBoatLength, parseInt);
        if (pd.highDryCapacity) propertyDetails.highDryCapacity = parseNumber(pd.highDryCapacity, parseInt);
        if (pd.winterStorageCapacity) propertyDetails.winterStorageCapacity = parseNumber(pd.winterStorageCapacity, parseInt);
        if (pd.occupancyRate) propertyDetails.occupancyRate = parseNumber(pd.occupancyRate, parseFloat);
        if (pd.acreage) propertyDetails.acreage = parseNumber(pd.acreage, parseFloat);
        if (pd.ownershipType) propertyDetails.ownershipType = pd.ownershipType;
        if (pd.expansionApproved) propertyDetails.expansionApproved = pd.expansionApproved;
        if (pd.buildingSize) propertyDetails.buildingSize = parseNumber(pd.buildingSize, parseInt);
        if (pd.fuelCapacity) propertyDetails.fuelCapacity = parseNumber(pd.fuelCapacity, parseInt);
        if (pd.equipment) propertyDetails.equipment = pd.equipment;
        if (pd.amenities) propertyDetails.amenities = pd.amenities;
        if (pd.servicesOffered) propertyDetails.servicesOffered = pd.servicesOffered;
        if (pd.recentImprovements) propertyDetails.recentImprovements = pd.recentImprovements;
        if (pd.locationDetails) propertyDetails.locationDetails = pd.locationDetails;
        if (pd.marketPosition) propertyDetails.marketPosition = pd.marketPosition;
        if (pd.grossRevenue) propertyDetails.grossRevenue = parseNumber(pd.grossRevenue, parseFloat);
        if (pd.noi) propertyDetails.noi = parseNumber(pd.noi, parseFloat);
        if (pd.revenueBreakdown) propertyDetails.revenueBreakdown = pd.revenueBreakdown;
        if (pd.additionalNotes) propertyDetails.additionalNotes = pd.additionalNotes;
      }

      const cleanData = { 
        ...data, 
        amount: parseNumber(data.amount, parseFloat),
        expectedCloseDate: data.expectedCloseDate?.toISOString(),
        commissionRate: parseNumber(data.commissionRate, parseFloat),
        commissionAmount: parseNumber(data.commissionAmount, parseFloat),
        leaseTermMonths: parseNumber(data.leaseTermMonths, parseInt),
        propertyDetails: Object.keys(propertyDetails).length > 0 ? propertyDetails : undefined,
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined || cleanData[key] === "none" || cleanData[key] === null) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('POST', '/api/deals', cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: "Deal created successfully" });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Separate mutation for quick stage changes (doesn't close modal)
  const quickStageChangeMutation = useMutation({
    mutationFn: async (newStage: string) => {
      return await apiRequest('PUT', `/api/deals/${deal!.id}`, { stage: newStage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ 
        title: "Stage updated", 
        description: "Deal moved to new stage successfully"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update stage", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const parseNumber = (val: string | undefined, parser: (s: string) => number) => {
        if (!val || val === "") return null;
        const parsed = parser(val);
        return isNaN(parsed) ? null : parsed;
      };

      // Clean and parse propertyDetails
      const propertyDetails: any = {};
      if (data.propertyDetails) {
        const pd = data.propertyDetails;
        if (pd.slipsTotal) propertyDetails.slipsTotal = parseNumber(pd.slipsTotal, parseInt);
        if (pd.linearFeet) propertyDetails.linearFeet = parseNumber(pd.linearFeet, parseInt);
        if (pd.maxBoatLength) propertyDetails.maxBoatLength = parseNumber(pd.maxBoatLength, parseInt);
        if (pd.highDryCapacity) propertyDetails.highDryCapacity = parseNumber(pd.highDryCapacity, parseInt);
        if (pd.winterStorageCapacity) propertyDetails.winterStorageCapacity = parseNumber(pd.winterStorageCapacity, parseInt);
        if (pd.occupancyRate) propertyDetails.occupancyRate = parseNumber(pd.occupancyRate, parseFloat);
        if (pd.acreage) propertyDetails.acreage = parseNumber(pd.acreage, parseFloat);
        if (pd.ownershipType) propertyDetails.ownershipType = pd.ownershipType;
        if (pd.expansionApproved) propertyDetails.expansionApproved = pd.expansionApproved;
        if (pd.buildingSize) propertyDetails.buildingSize = parseNumber(pd.buildingSize, parseInt);
        if (pd.fuelCapacity) propertyDetails.fuelCapacity = parseNumber(pd.fuelCapacity, parseInt);
        if (pd.equipment) propertyDetails.equipment = pd.equipment;
        if (pd.amenities) propertyDetails.amenities = pd.amenities;
        if (pd.servicesOffered) propertyDetails.servicesOffered = pd.servicesOffered;
        if (pd.recentImprovements) propertyDetails.recentImprovements = pd.recentImprovements;
        if (pd.locationDetails) propertyDetails.locationDetails = pd.locationDetails;
        if (pd.marketPosition) propertyDetails.marketPosition = pd.marketPosition;
        if (pd.grossRevenue) propertyDetails.grossRevenue = parseNumber(pd.grossRevenue, parseFloat);
        if (pd.noi) propertyDetails.noi = parseNumber(pd.noi, parseFloat);
        if (pd.revenueBreakdown) propertyDetails.revenueBreakdown = pd.revenueBreakdown;
        if (pd.additionalNotes) propertyDetails.additionalNotes = pd.additionalNotes;
      }

      const cleanData = { 
        ...data, 
        amount: parseNumber(data.amount, parseFloat),
        expectedCloseDate: data.expectedCloseDate?.toISOString(),
        commissionRate: parseNumber(data.commissionRate, parseFloat),
        commissionAmount: parseNumber(data.commissionAmount, parseFloat),
        leaseTermMonths: parseNumber(data.leaseTermMonths, parseInt),
        propertyDetails: Object.keys(propertyDetails).length > 0 ? propertyDetails : undefined,
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined || cleanData[key] === "none" || cleanData[key] === null) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('PUT', `/api/deals/${deal!.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: "Deal updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: any) => {
    if (deal) {
      updateDealMutation.mutate(data);
    } else {
      createDealMutation.mutate(data);
    }
  };

  const isLoading = createDealMutation.isPending || updateDealMutation.isPending || quickStageChangeMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="deal-form-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{deal ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
        </DialogHeader>
        
        {/* Quick Stage Selector */}
        {deal && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Move Deal</div>
                  {deal.currentStageEnteredAt && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      {(() => {
                        const days = Math.floor((new Date().getTime() - new Date(deal.currentStageEnteredAt).getTime()) / (1000 * 60 * 60 * 24));
                        return `${days} ${days === 1 ? 'day' : 'days'} in this stage`;
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <Select 
                    disabled={quickStageChangeMutation.isPending}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (deal && value !== deal.stage) {
                        quickStageChangeMutation.mutate(value);
                      }
                    }} 
                    value={field.value}
                  >
                    <SelectTrigger className="w-[260px] bg-white border-blue-300 font-medium shadow-sm hover:bg-blue-50 transition-colors" data-testid="select-quick-stage">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full shadow-sm" 
                              style={{ backgroundColor: stage.color || '#6b7280' }}
                            />
                            <span className="font-medium">{stage.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="flex items-center gap-2" data-testid="tab-deal-details">
                  <FileText className="w-4 h-4" />
                  Deal Details
                </TabsTrigger>
                <TabsTrigger value="marina" className="flex items-center gap-2" data-testid="tab-marina-property">
                  <Anchor className="w-4 h-4" />
                  Property Details
                </TabsTrigger>
                <TabsTrigger value="commission" className="flex items-center gap-2" data-testid="tab-commission">
                  <TrendingUp className="w-4 h-4" />
                  Commission
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Marina Slip A-12 Lease" {...field} data-testid="input-deal-title" />
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
                            <FormLabel>Deal Value ($) *</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={field.value ? parseFloat(field.value) : undefined}
                                onValueChange={(val) => field.onChange(val?.toString() || "")}
                                onBlur={field.onBlur}
                                data-testid="input-deal-value"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-priority">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {priorities.map((priority) => (
                                  <SelectItem key={priority.value} value={priority.value}>
                                    {priority.label}
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
                      name="stage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal Stage *</FormLabel>
                          <FormControl>
                            <StageCombobox 
                              value={field.value}
                              onChange={field.onChange}
                              stages={pipelineStages}
                              onCreateStage={async (stageName) => {
                                // Create a new stage for the default pipeline
                                const pipelines = await apiRequest('/api/crm/pipelines', 'GET');
                                if (pipelines && pipelines.length > 0) {
                                  const defaultPipeline = pipelines[0];
                                  const maxOrder = pipelineStages.reduce((max, s) => Math.max(max, s.stageOrder || 0), 0);
                                  const newStage = await apiRequest('/api/crm/pipeline-stages', 'POST', {
                                    pipelineId: defaultPipeline.id,
                                    name: stageName,
                                    color: '#6b7280',
                                    stageOrder: maxOrder + 1,
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
                                  return newStage;
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Deal description, notes, and key details..." 
                              rows={4}
                              {...field} 
                              data-testid="textarea-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Relationships
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="primaryContactId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact</FormLabel>
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
                        name="accountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                              <SearchableSelect
                                options={companyOptions}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Search companies..."
                                searchPlaceholder="Type to search companies..."
                                emptyText="No companies found"
                                testId="select-company"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="expectedCloseDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Expected Close Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-select-date"
                                >
                                  <CalendarClock className="mr-2 h-4 w-4" />
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="marina" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Marina Property Information
                    </CardTitle>
                    <CardDescription>Details about the marina property, slip, location, and lease terms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="propertyType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-property-type">
                                <SelectValue placeholder="Select property type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {propertyTypes.map((type) => (
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
                      name="marinaName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marina Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Harbor Bay Marina" {...field} data-testid="input-marina-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="slipNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slip/Berth Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., A-12" {...field} data-testid="input-slip-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dockLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dock Location</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., North Dock, Pier 5" {...field} data-testid="input-dock-location" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="leaseTermMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease Term (Months)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 12" 
                              {...field} 
                              data-testid="input-lease-term"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Comprehensive Property Details Card (based on OM template) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Detailed Property Specifications
                    </CardTitle>
                    <CardDescription>Comprehensive marina property details from offering memorandums</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Physical Capacity */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Anchor className="w-4 h-4" />
                        Physical Capacity
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="propertyDetails.slipsTotal"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Total Wet Slips</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 273" {...field} data-testid="input-slips-total" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.linearFeet"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Linear Feet of Dockage</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 9000" {...field} data-testid="input-linear-feet" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.maxBoatLength"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Max Boat Length (ft)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 150" {...field} data-testid="input-max-boat-length" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.highDryCapacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">High & Dry Capacity</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 200" {...field} data-testid="input-high-dry-capacity" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.winterStorageCapacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Winter Storage Capacity</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 500" {...field} data-testid="input-winter-storage" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.occupancyRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Occupancy Rate (%)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 100" {...field} data-testid="input-occupancy-rate" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Property Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="propertyDetails.acreage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Total Acreage</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 19.25" {...field} data-testid="input-acreage" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.ownershipType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Ownership Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-ownership-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="fee_simple">Fee Simple</SelectItem>
                                  <SelectItem value="ground_lease">Ground Lease</SelectItem>
                                  <SelectItem value="leasehold">Leasehold</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.expansionApproved"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Approved Expansion (slips)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 40-60" {...field} data-testid="input-expansion" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.buildingSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Building Size (sq ft)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 2100" {...field} data-testid="input-building-size" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Facilities & Equipment */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Facilities & Equipment</h4>
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="propertyDetails.fuelCapacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Fuel Storage Capacity (gallons)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 24000" {...field} data-testid="input-fuel-capacity" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.equipment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Major Equipment</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., 75MT travel lift, 350k lb forklift, etc." 
                                  rows={3}
                                  {...field} 
                                  data-testid="textarea-equipment"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.amenities"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Amenities</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., pool, restaurant, clubhouse, etc." 
                                  rows={2}
                                  {...field} 
                                  data-testid="textarea-amenities"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.servicesOffered"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Services Offered</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., full-service repair, haul/launch, bottom painting, etc." 
                                  rows={3}
                                  {...field} 
                                  data-testid="textarea-services"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Recent Improvements */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Recent Improvements & Capital Projects</h4>
                      <FormField
                        control={form.control}
                        name="propertyDetails.recentImprovements"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder="e.g., new docks (2014), new electrical system, 24k gal fuel tanks, etc." 
                                rows={4}
                                {...field} 
                                data-testid="textarea-improvements"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Location & Market */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Location & Market Information</h4>
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="propertyDetails.locationDetails"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Location Details</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., Boston Harbor, Long Island Sound, proximity to destinations, etc." 
                                  rows={3}
                                  {...field} 
                                  data-testid="textarea-location"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.marketPosition"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Market Position & Competitive Advantages</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., only marina on the river, protected harbor, 30min from NYC, etc." 
                                  rows={3}
                                  {...field} 
                                  data-testid="textarea-market"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Financial Performance */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Financial Performance</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="propertyDetails.grossRevenue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Gross Revenue ($)</FormLabel>
                              <FormControl>
                                <CurrencyInput
                                  value={field.value ? parseFloat(field.value) : undefined}
                                  onValueChange={(val) => field.onChange(val?.toString() || "")}
                                  onBlur={field.onBlur}
                                  data-testid="input-gross-revenue"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="propertyDetails.noi"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">NOI ($)</FormLabel>
                              <FormControl>
                                <CurrencyInput
                                  value={field.value ? parseFloat(field.value) : undefined}
                                  onValueChange={(val) => field.onChange(val?.toString() || "")}
                                  onBlur={field.onBlur}
                                  data-testid="input-noi"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="mt-3">
                        <FormField
                          control={form.control}
                          name="propertyDetails.revenueBreakdown"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Revenue Breakdown</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="e.g., Dockage: $1.9M, High & Dry: $688k, Service: $2.7M, Fuel: $1.2M, etc." 
                                  rows={3}
                                  {...field} 
                                  data-testid="textarea-revenue-breakdown"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Additional Notes</h4>
                      <FormField
                        control={form.control}
                        name="propertyDetails.additionalNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder="Any additional property details, historical information, or special notes..." 
                                rows={4}
                                {...field} 
                                data-testid="textarea-additional-notes"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="commission" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Commission Tracking
                    </CardTitle>
                    <CardDescription>Configure commission rates and calculations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                                {dealSources.map((source) => (
                                  <SelectItem key={source.value} value={source.value}>
                                    {source.label} ({source.commissionRate}%)
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
                        name="commissionType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Commission Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-commission-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {commissionTypes.map((type) => (
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="commissionRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Commission Rate (%)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="3.5" 
                                  className="pl-10"
                                  {...field} 
                                  disabled={commissionType !== "percentage"}
                                  data-testid="input-commission-rate"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="commissionAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Commission Amount ($)</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={field.value ? parseFloat(field.value) : undefined}
                                onValueChange={(val) => field.onChange(val?.toString() || "")}
                                onBlur={field.onBlur}
                                className={cn(commissionType === "percentage" && "bg-gray-50")}
                                readOnly={commissionType === "percentage"}
                                data-testid="input-commission-amount"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {commissionType === "percentage" && dealAmount && commissionRate && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-900">Calculated Commission</p>
                            <p className="text-xs text-blue-700 mt-1">
                              {dealAmount} × {commissionRate}%
                            </p>
                          </div>
                          <div className="text-2xl font-bold text-blue-900">
                            ${((parseFloat(dealAmount) * parseFloat(commissionRate)) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-save-deal"
              >
                {isLoading ? 'Saving...' : (deal ? 'Update Deal' : 'Create Deal')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

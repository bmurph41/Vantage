import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CalendarIcon, Percent, DollarSign, Anchor, MapPin, 
  FileText, Users, TrendingUp, Calendar as CalendarClock, Clock, Plus, X, Trash2,
  Sparkles, Zap, Info, CheckCircle2
} from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { addBusinessDays } from "@/lib/business-days";
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
      ddCity: z.string().optional(),
      ddState: z.string().optional(),
      anchorType: z.enum(["psa", "custom"]).optional(),
      useBusinessDays: z.boolean().optional(),
      holidayCalendar: z.enum(["us_federal", "none"]).optional(),
      projectTimezone: z.string().optional(),
      psaSignedDate: z.string().optional(),
      ddExpirationDate: z.string().optional(),
      closingDate: z.string().optional(),
      ddPeriodDays: z.string().refine((val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) > 0), "Must be a positive number").optional(),
      hasExtensions: z.boolean().optional(),
      extensionCount: z.string().refine((val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 10), "Must be between 0 and 10").optional(),
      extensionDays: z.array(z.string()).optional(),
      daysToClosing: z.string().refine((val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) > 0), "Must be a positive number").optional(),
      sellers: z.array(z.string()).optional(),
      ourAttorneys: z.array(z.string()).optional(),
      titleInsuranceCompany: z.string().optional(),
      lender: z.string().optional(),
      firstDepositAmount: z.string().refine((val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), "Must be a valid positive number").optional(),
      firstDepositDays: z.string().refine((val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0), "Must be a positive number").optional(),
      firstDepositDueDate: z.string().optional(),
      secondDepositAmount: z.string().refine((val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), "Must be a valid positive number").optional(),
      secondDepositDays: z.string().refine((val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0), "Must be a positive number").optional(),
      secondDepositDueDate: z.string().optional(),
      leases: z.array(z.object({
        id: z.string().optional(),
        type: z.string(),
        lessor: z.string(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
        extensionEnabled: z.boolean(),
        extensionNotes: z.string().optional(),
      })).optional(),
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
      ddCity: "",
      ddState: "",
      anchorType: "psa",
      useBusinessDays: false,
      holidayCalendar: "us_federal",
      projectTimezone: "Eastern",
      psaSignedDate: "",
      ddExpirationDate: "",
      closingDate: "",
      ddPeriodDays: "",
      hasExtensions: false,
      extensionCount: "",
      extensionDays: [],
      daysToClosing: "",
      sellers: [],
      ourAttorneys: [],
      titleInsuranceCompany: "",
      lender: "",
      firstDepositAmount: "",
      firstDepositDays: "",
      firstDepositDueDate: "",
      secondDepositAmount: "",
      secondDepositDays: "",
      secondDepositDueDate: "",
      leases: [],
    },
  });

  // State for DD Deal Details
  const [extensionDaysArray, setExtensionDaysArray] = useState<string[]>([]);
  const [sellersArray, setSellersArray] = useState<string[]>([]);
  const [attorneysArray, setAttorneysArray] = useState<string[]>([]);
  const [leases, setLeases] = useState<any[]>([]);

  const dealAmount = form.watch("amount");
  const dealSource = form.watch("dealSource");
  const commissionType = form.watch("commissionType");
  const commissionRate = form.watch("commissionRate");
  
  // Watch DD fields for auto-calculation
  const psaSignedDate = form.watch("psaSignedDate");
  const ddPeriodDays = form.watch("ddPeriodDays");
  const hasExtensions = form.watch("hasExtensions");
  const daysToClosing = form.watch("daysToClosing");
  const useBusinessDays = form.watch("useBusinessDays");
  const holidayCalendar = form.watch("holidayCalendar");

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

  // Auto-calculate DD Expiration Date
  useEffect(() => {
    if (psaSignedDate && ddPeriodDays) {
      try {
        const startDate = parseISO(psaSignedDate);
        let totalDays = parseInt(ddPeriodDays) || 0;
        
        // Add extension days
        if (hasExtensions && extensionDaysArray.length > 0) {
          totalDays += extensionDaysArray.reduce((sum, days) => sum + (parseInt(days) || 0), 0);
        }
        
        const expirationDate = useBusinessDays 
          ? addBusinessDays(startDate, totalDays, holidayCalendar || "us_federal")
          : addDays(startDate, totalDays);
        
        const formattedDate = format(expirationDate, 'yyyy-MM-dd');
        if (formattedDate !== form.getValues("ddExpirationDate")) {
          form.setValue("ddExpirationDate", formattedDate);
        }
      } catch (error) {
        // Invalid date, don't update
      }
    }
  }, [psaSignedDate, ddPeriodDays, hasExtensions, extensionDaysArray, useBusinessDays, holidayCalendar, form]);

  // Auto-calculate Closing Date
  useEffect(() => {
    const ddExpirationDate = form.watch("ddExpirationDate");
    if (ddExpirationDate && daysToClosing) {
      try {
        const expirationDate = parseISO(ddExpirationDate);
        const closingDaysNum = parseInt(daysToClosing) || 0;
        
        const closingDate = useBusinessDays 
          ? addBusinessDays(expirationDate, closingDaysNum, holidayCalendar || "us_federal")
          : addDays(expirationDate, closingDaysNum);
        
        const formattedDate = format(closingDate, 'yyyy-MM-dd');
        if (formattedDate !== form.getValues("closingDate")) {
          form.setValue("closingDate", formattedDate);
        }
      } catch (error) {
        // Invalid date, don't update
      }
    }
  }, [form.watch("ddExpirationDate"), daysToClosing, useBusinessDays, holidayCalendar, form]);

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
        ddCity: (deal as any).ddCity || "",
        ddState: (deal as any).ddState || "",
        anchorType: (deal as any).anchorType || "psa",
        useBusinessDays: (deal as any).useBusinessDays || false,
        holidayCalendar: (deal as any).holidayCalendar || "us_federal",
        projectTimezone: (deal as any).projectTimezone || "Eastern",
        psaSignedDate: (deal as any).psaSignedDate || "",
        ddExpirationDate: (deal as any).ddExpirationDate || "",
        closingDate: (deal as any).closingDate || "",
        ddPeriodDays: (deal as any).ddPeriodDays?.toString() || "",
        hasExtensions: (deal as any).hasExtensions || false,
        extensionCount: (deal as any).extensionCount?.toString() || "",
        extensionDays: (deal as any).extensionDays || [],
        daysToClosing: (deal as any).daysToClosing?.toString() || "",
        sellers: (deal as any).sellers || [],
        ourAttorneys: (deal as any).ourAttorneys || [],
        titleInsuranceCompany: (deal as any).titleInsuranceCompany || "",
        lender: (deal as any).lender || "",
        firstDepositAmount: (deal as any).firstDepositAmount?.toString() || "",
        firstDepositDays: (deal as any).firstDepositDays?.toString() || "",
        firstDepositDueDate: (deal as any).firstDepositDueDate || "",
        secondDepositAmount: (deal as any).secondDepositAmount?.toString() || "",
        secondDepositDays: (deal as any).secondDepositDays?.toString() || "",
        secondDepositDueDate: (deal as any).secondDepositDueDate || "",
        leases: (deal as any).leases || [],
      });
      
      // Initialize state arrays
      setExtensionDaysArray((deal as any).extensionDays || []);
      setSellersArray((deal as any).sellers || []);
      setAttorneysArray((deal as any).ourAttorneys || []);
      setLeases((deal as any).leases || []);
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
        ddCity: "",
        ddState: "",
        anchorType: "psa",
        useBusinessDays: false,
        holidayCalendar: "us_federal",
        projectTimezone: "Eastern",
        psaSignedDate: "",
        ddExpirationDate: "",
        closingDate: "",
        ddPeriodDays: "",
        hasExtensions: false,
        extensionCount: "",
        extensionDays: [],
        daysToClosing: "",
        sellers: [],
        ourAttorneys: [],
        titleInsuranceCompany: "",
        lender: "",
        firstDepositAmount: "",
        firstDepositDays: "",
        firstDepositDueDate: "",
        secondDepositAmount: "",
        secondDepositDays: "",
        secondDepositDueDate: "",
        leases: [],
      });
      
      // Reset state arrays
      setExtensionDaysArray([]);
      setSellersArray([]);
      setAttorneysArray([]);
      setLeases([]);
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
        title: data.name, // Map form field 'name' to database field 'title'
        amount: parseNumber(data.amount, parseFloat),
        expectedCloseDate: data.expectedCloseDate?.toISOString(),
        commissionRate: parseNumber(data.commissionRate, parseFloat),
        commissionAmount: parseNumber(data.commissionAmount, parseFloat),
        leaseTermMonths: parseNumber(data.leaseTermMonths, parseInt),
        leases: data.leases && data.leases.length > 0 ? data.leases : undefined,
        propertyDetails: Object.keys(propertyDetails).length > 0 ? propertyDetails : undefined,
        ddPeriodDays: parseNumber(data.ddPeriodDays, parseInt),
        extensionCount: parseNumber(data.extensionCount, parseInt),
        extensionDays: data.extensionDays && data.extensionDays.length > 0 ? data.extensionDays.map((d: string) => parseInt(d) || 0).filter((d: number) => d > 0) : undefined,
        daysToClosing: parseNumber(data.daysToClosing, parseInt),
        firstDepositAmount: parseNumber(data.firstDepositAmount, parseFloat),
        firstDepositDays: parseNumber(data.firstDepositDays, parseInt),
        secondDepositAmount: parseNumber(data.secondDepositAmount, parseFloat),
        secondDepositDays: parseNumber(data.secondDepositDays, parseInt),
      };
      
      // Remove the 'name' field since we've mapped it to 'title'
      delete cleanData.name;
      
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
        title: data.name, // Map form field 'name' to database field 'title'
        amount: parseNumber(data.amount, parseFloat),
        expectedCloseDate: data.expectedCloseDate?.toISOString(),
        commissionRate: parseNumber(data.commissionRate, parseFloat),
        commissionAmount: parseNumber(data.commissionAmount, parseFloat),
        leaseTermMonths: parseNumber(data.leaseTermMonths, parseInt),
        leases: data.leases && data.leases.length > 0 ? data.leases : undefined,
        propertyDetails: Object.keys(propertyDetails).length > 0 ? propertyDetails : undefined,
        ddPeriodDays: parseNumber(data.ddPeriodDays, parseInt),
        extensionCount: parseNumber(data.extensionCount, parseInt),
        extensionDays: data.extensionDays && data.extensionDays.length > 0 ? data.extensionDays.map((d: string) => parseInt(d) || 0).filter((d: number) => d > 0) : undefined,
        daysToClosing: parseNumber(data.daysToClosing, parseInt),
        firstDepositAmount: parseNumber(data.firstDepositAmount, parseFloat),
        firstDepositDays: parseNumber(data.firstDepositDays, parseInt),
        secondDepositAmount: parseNumber(data.secondDepositAmount, parseFloat),
        secondDepositDays: parseNumber(data.secondDepositDays, parseInt),
      };
      
      // Remove the 'name' field since we've mapped it to 'title'
      delete cleanData.name;
      
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

  // Quick deal templates
  const dealTemplates = [
    {
      name: "Slip Lease",
      icon: Anchor,
      color: "from-blue-500 to-blue-600",
      data: {
        name: "Slip Lease Agreement",
        propertyType: "slip",
        commissionType: "percentage",
        commissionRate: "3.0",
        priority: "medium",
      }
    },
    {
      name: "Marina Acquisition",
      icon: TrendingUp,
      color: "from-purple-500 to-purple-600",
      data: {
        name: "Marina Acquisition Deal",
        propertyType: "marina_business",
        commissionType: "percentage",
        commissionRate: "4.0",
        priority: "high",
      }
    },
    {
      name: "Mooring Purchase",
      icon: Anchor,
      color: "from-cyan-500 to-cyan-600",
      data: {
        name: "Mooring Purchase",
        propertyType: "mooring",
        commissionType: "fixed",
        priority: "medium",
      }
    },
  ];

  const applyTemplate = (template: typeof dealTemplates[0]) => {
    Object.entries(template.data).forEach(([key, value]) => {
      form.setValue(key as any, value);
    });
    toast({ 
      title: "Template applied", 
      description: `${template.name} template loaded successfully` 
    });
  };

  const formattedDealValue = dealAmount ? 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(parseFloat(dealAmount)) : 
    "$0";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="deal-form-modal">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              {deal ? 'Edit Deal' : 'Create New Deal'}
            </DialogTitle>
            {!deal && dealAmount && (
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">Deal Value</div>
                <div className="text-xl font-bold text-green-600">{formattedDealValue}</div>
              </div>
            )}
          </div>
          {!deal && (
            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Zap className="w-3.5 h-3.5" />
                <span className="font-medium">Quick Start:</span>
              </div>
              {dealTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Button
                    key={template.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`text-xs h-7 bg-gradient-to-r ${template.color} text-white border-0 hover:opacity-90 transition-opacity`}
                    onClick={() => applyTemplate(template)}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {template.name}
                  </Button>
                );
              })}
            </div>
          )}
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
        
        <TooltipProvider>
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

                {/* DD Deal Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      DD Deal Details
                    </CardTitle>
                    <CardDescription>Due diligence timeline, contacts, and deposit information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Location */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Location</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ddCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Boston" {...field} data-testid="input-dd-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="ddState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., MA" {...field} data-testid="input-dd-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Timeline Configuration */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Timeline Configuration</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="anchorType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Anchor Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-anchor-type">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="psa">PSA Signed Date</SelectItem>
                                    <SelectItem value="custom">Custom Date</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="projectTimezone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Project Timezone</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-timezone">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Eastern">Eastern</SelectItem>
                                    <SelectItem value="Central">Central</SelectItem>
                                    <SelectItem value="Mountain">Mountain</SelectItem>
                                    <SelectItem value="Pacific">Pacific</SelectItem>
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
                            name="useBusinessDays"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Use Business Days</FormLabel>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-business-days"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="holidayCalendar"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Holiday Calendar</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-holiday-calendar">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="us_federal">US Federal</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Key Dates */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Key Dates</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="psaSignedDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PSA Signed Date</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="MM/DD/YYYY"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="ddExpirationDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DD Expiration Date</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="MM/DD/YYYY"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="closingDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Closing Date</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="MM/DD/YYYY"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* DD Period Configuration */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">DD Period Configuration</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ddPeriodDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DD Period (Days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="e.g., 30" 
                                  {...field}
                                  data-testid="input-dd-period-days"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="daysToClosing"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Closing</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="e.g., 60" 
                                  {...field}
                                  data-testid="input-days-to-closing"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="mt-4">
                        <FormField
                          control={form.control}
                          name="hasExtensions"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Has Extensions</FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-has-extensions"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {hasExtensions && (
                        <div className="mt-4 space-y-3">
                          <FormField
                            control={form.control}
                            name="extensionCount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Number of Extensions</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0"
                                    max="10"
                                    placeholder="e.g., 2" 
                                    {...field}
                                    data-testid="input-extension-count"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div>
                            <Label className="text-sm mb-2 block">Extension Days</Label>
                            {extensionDaysArray.map((days, index) => (
                              <div key={index} className="flex items-center gap-2 mb-2">
                                <Input
                                  type="number"
                                  placeholder="Days"
                                  value={days}
                                  onChange={(e) => {
                                    const newArray = [...extensionDaysArray];
                                    newArray[index] = e.target.value;
                                    setExtensionDaysArray(newArray);
                                    form.setValue("extensionDays", newArray);
                                  }}
                                  data-testid={`input-extension-days-${index}`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const newArray = extensionDaysArray.filter((_, i) => i !== index);
                                    setExtensionDaysArray(newArray);
                                    form.setValue("extensionDays", newArray);
                                  }}
                                  data-testid={`button-remove-extension-${index}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newArray = [...extensionDaysArray, ""];
                                setExtensionDaysArray(newArray);
                                form.setValue("extensionDays", newArray);
                              }}
                              data-testid="button-add-extension"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Extension
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Key Contacts */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Key Contacts</h4>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm mb-2 block">Seller(s)</Label>
                          {sellersArray.map((seller, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                              <Input
                                placeholder="Seller name"
                                value={seller}
                                onChange={(e) => {
                                  const newArray = [...sellersArray];
                                  newArray[index] = e.target.value;
                                  setSellersArray(newArray);
                                  form.setValue("sellers", newArray);
                                }}
                                data-testid={`input-seller-${index}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newArray = sellersArray.filter((_, i) => i !== index);
                                  setSellersArray(newArray);
                                  form.setValue("sellers", newArray);
                                }}
                                data-testid={`button-remove-seller-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newArray = [...sellersArray, ""];
                              setSellersArray(newArray);
                              form.setValue("sellers", newArray);
                            }}
                            data-testid="button-add-seller"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Seller
                          </Button>
                        </div>

                        <div>
                          <Label className="text-sm mb-2 block">Our Attorney(s)</Label>
                          {attorneysArray.map((attorney, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                              <Input
                                placeholder="Attorney name"
                                value={attorney}
                                onChange={(e) => {
                                  const newArray = [...attorneysArray];
                                  newArray[index] = e.target.value;
                                  setAttorneysArray(newArray);
                                  form.setValue("ourAttorneys", newArray);
                                }}
                                data-testid={`input-attorney-${index}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newArray = attorneysArray.filter((_, i) => i !== index);
                                  setAttorneysArray(newArray);
                                  form.setValue("ourAttorneys", newArray);
                                }}
                                data-testid={`button-remove-attorney-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newArray = [...attorneysArray, ""];
                              setAttorneysArray(newArray);
                              form.setValue("ourAttorneys", newArray);
                            }}
                            data-testid="button-add-attorney"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Attorney
                          </Button>
                        </div>

                        <FormField
                          control={form.control}
                          name="titleInsuranceCompany"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title Insurance Company</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., First American Title" {...field} data-testid="input-title-insurance" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lender</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Bank of America" {...field} data-testid="input-lender" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Deposit Information */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Deposit Information</h4>
                      <div className="space-y-4">
                        {/* First Deposit */}
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">First Deposit</Label>
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="firstDepositAmount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Amount</FormLabel>
                                  <FormControl>
                                    <CurrencyInput
                                      value={field.value ? parseFloat(field.value) : undefined}
                                      onValueChange={(val) => field.onChange(val?.toString() || "")}
                                      onBlur={field.onBlur}
                                      data-testid="input-first-deposit-amount"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="firstDepositDays"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Days</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="e.g., 3" 
                                      {...field}
                                      data-testid="input-first-deposit-days"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="firstDepositDueDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Due Date</FormLabel>
                                  <FormControl>
                                    <DateInput
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="MM/DD/YYYY"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Second Deposit */}
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Second Deposit</Label>
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="secondDepositAmount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Amount</FormLabel>
                                  <FormControl>
                                    <CurrencyInput
                                      value={field.value ? parseFloat(field.value) : undefined}
                                      onValueChange={(val) => field.onChange(val?.toString() || "")}
                                      onBlur={field.onBlur}
                                      data-testid="input-second-deposit-amount"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="secondDepositDays"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Days</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="e.g., 10" 
                                      {...field}
                                      data-testid="input-second-deposit-days"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="secondDepositDueDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Due Date</FormLabel>
                                  <FormControl>
                                    <DateInput
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="MM/DD/YYYY"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
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

                    {/* Leases Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Leases</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newLease = {
                              id: `lease-${Date.now()}`,
                              type: 'ground_lease',
                              lessor: '',
                              startDate: null,
                              endDate: null,
                              extensionEnabled: false,
                              extensionNotes: ''
                            };
                            const updatedLeases = [...leases, newLease];
                            setLeases(updatedLeases);
                            form.setValue('leases', updatedLeases);
                          }}
                          data-testid="button-add-lease"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Lease
                        </Button>
                      </div>

                      {leases.length > 0 && (
                        <Accordion type="multiple" className="w-full">
                          {leases.map((lease, index) => (
                            <AccordionItem key={lease.id || index} value={`lease-${index}`}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-2">
                                  <span className="text-sm font-medium">
                                    {lease.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                    {lease.lessor && ` - ${lease.lessor}`}
                                    {lease.startDate && lease.endDate && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({format(new Date(lease.startDate), 'MM/dd/yyyy')} - {format(new Date(lease.endDate), 'MM/dd/yyyy')})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-4 pt-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-xs">Lease Type</Label>
                                      <Select
                                        value={lease.type}
                                        onValueChange={(value) => {
                                          const updated = [...leases];
                                          updated[index] = { ...updated[index], type: value };
                                          setLeases(updated);
                                          form.setValue('leases', updated);
                                        }}
                                      >
                                        <SelectTrigger data-testid={`select-lease-type-${index}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ground_lease">Ground Lease</SelectItem>
                                          <SelectItem value="submerged_land_lease">Submerged Land Lease</SelectItem>
                                          <SelectItem value="dock_lease">Dock Lease</SelectItem>
                                          <SelectItem value="slip_lease">Slip Lease</SelectItem>
                                          <SelectItem value="mooring_lease">Mooring Lease</SelectItem>
                                          <SelectItem value="facility_lease">Facility Lease</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label className="text-xs">Lessor</Label>
                                      <Input
                                        placeholder="Who it's with"
                                        value={lease.lessor}
                                        onChange={(e) => {
                                          const updated = [...leases];
                                          updated[index] = { ...updated[index], lessor: e.target.value };
                                          setLeases(updated);
                                          form.setValue('leases', updated);
                                        }}
                                        data-testid={`input-lessor-${index}`}
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-xs">Start Date</Label>
                                      <DateInput
                                        value={lease.startDate || ''}
                                        onChange={(value) => {
                                          const updated = [...leases];
                                          updated[index] = { ...updated[index], startDate: value };
                                          setLeases(updated);
                                          form.setValue('leases', updated);
                                        }}
                                        placeholder="Select start date"
                                        data-testid={`input-start-date-${index}`}
                                      />
                                    </div>

                                    <div>
                                      <Label className="text-xs">End Date</Label>
                                      <DateInput
                                        value={lease.endDate || ''}
                                        onChange={(value) => {
                                          const updated = [...leases];
                                          updated[index] = { ...updated[index], endDate: value };
                                          setLeases(updated);
                                          form.setValue('leases', updated);
                                        }}
                                        placeholder="Select end date"
                                        data-testid={`input-end-date-${index}`}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={lease.extensionEnabled}
                                      onCheckedChange={(checked) => {
                                        const updated = [...leases];
                                        updated[index] = { ...updated[index], extensionEnabled: checked };
                                        setLeases(updated);
                                        form.setValue('leases', updated);
                                      }}
                                      data-testid={`switch-extension-${index}`}
                                    />
                                    <Label className="text-xs">Extension Options Available</Label>
                                  </div>

                                  {lease.extensionEnabled && (
                                    <div>
                                      <Label className="text-xs">Extension Notes</Label>
                                      <Textarea
                                        placeholder="Details about extension options..."
                                        value={lease.extensionNotes || ''}
                                        onChange={(e) => {
                                          const updated = [...leases];
                                          updated[index] = { ...updated[index], extensionNotes: e.target.value };
                                          setLeases(updated);
                                          form.setValue('leases', updated);
                                        }}
                                        rows={2}
                                        data-testid={`textarea-extension-notes-${index}`}
                                      />
                                    </div>
                                  )}

                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      const updated = leases.filter((_, i) => i !== index);
                                      setLeases(updated);
                                      form.setValue('leases', updated);
                                    }}
                                    data-testid={`button-remove-lease-${index}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Remove Lease
                                  </Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}

                      {leases.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No leases added yet. Click "Add Lease" to get started.
                        </p>
                      )}
                    </div>
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
                            <div className="flex items-center gap-1.5">
                              <FormLabel>Commission Rate (%)</FormLabel>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">The percentage of the deal value that will be paid as commission. Auto-populated based on deal source.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
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

            <div className="flex items-center justify-between pt-4 border-t bg-gray-50 -mx-6 px-6 py-4 -mb-6 rounded-b-lg">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5" />
                <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-mono">Esc</kbd> to cancel</span>
              </div>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isLoading}
                  data-testid="button-cancel"
                  className="hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  data-testid="button-save-deal"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white min-w-[140px]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{deal ? 'Update Deal' : 'Create Deal'}</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}

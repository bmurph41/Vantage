import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Plus, Trash2, DollarSign, Search, Link, Unlink, ToggleLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { rateCompsApi } from '@/lib/ratecomps/api';
import { queryKeys } from '@/lib/ratecomps/queryKeys';
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/ratecomps/authUtils";
import { z } from "zod";
import type { RateComp, InsertRateComp, UpdateRateComp, MarinaRateDatabase } from "@shared/schema";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import debounce from "lodash.debounce";
import { PROFIT_CENTERS, WATER_TYPES, STORAGE_TYPES, US_REGIONS } from "@shared/salescomps-constants";
import { AddressInput } from "@/components/address-input";
import { useCustomStorageTypes, useCreateCustomStorageType } from "@/hooks/ratecomps/useCustomStorageTypes";
import RateTiersDataTable, { TierRowData, rowDataToTier } from "./RateTiersDataTable";
import RateHistoryView from "../analytics/RateHistoryView";
import PropertyAutocomplete from "@/components/property-autocomplete";

const compFormSchema = z.object({
  marina: z.string().min(1, "Marina name is required"),
  marinaId: z.string().optional(), // Link to Marina Rate Database
  propertyId: z.string().optional(), // Link to CRM Property
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().optional(),
  wetSlips: z.union([z.string(), z.number()]).optional(),
  dryRacks: z.union([z.string(), z.number()]).optional(),
  ioBoth: z.string().optional(),
  storageTypes: z.array(z.string()).default([]),
  bodyOfWater: z.string().optional(),
  waterBodyName: z.string().optional(),
  waterfront: z.string().optional(),
  region: z.string().optional(),
  acres: z.union([z.string(), z.number()]).optional(),
  occupancy: z.union([z.string(), z.number()]).optional(),
  yearBuilt: z.union([z.string(), z.number()]).optional(),
  articleUrls: z.array(z.string()).default([]),
  notes: z.string().optional(),
  waterType: z.string().optional(),
  coastalType: z.string().optional(),
  isPortfolio: z.boolean().default(false),
  parentPortfolioId: z.string().optional(),
  // Rate-focused fields
  rateCollectionDate: z.string().optional(),
  rateSource: z.string().optional(),
  rateTrend: z.string().optional(),
  lastVerifiedDate: z.string().optional(),
  sourceNotes: z.string().optional(),
  // Individual profit center boolean fields
  profitCenterStorage: z.boolean().default(false),
  profitCenterEvents: z.boolean().default(false),
  profitCenterService: z.boolean().default(false),
  profitCenterThirdPartyLeases: z.boolean().default(false),
  profitCenterBoatRentals: z.boolean().default(false),
  profitCenterBoatBrokerage: z.boolean().default(false),
  profitCenterRvPark: z.boolean().default(false),
  profitCenterFuel: z.boolean().default(false),
  profitCenterShipStore: z.boolean().default(false),
  profitCenterParts: z.boolean().default(false),
  profitCenterBoatClub: z.boolean().default(false),
  profitCenterBoatSales: z.boolean().default(false),
  profitCenterFnb: z.boolean().default(false),
  profitCenterHospitality: z.boolean().default(false),
  // Profit center operation types
  profitCenterBoatRentalsType: z.string().optional(),
  profitCenterBoatBrokerageType: z.string().optional(),
  profitCenterFuelType: z.string().optional(),
  profitCenterShipStoreType: z.string().optional(),
  profitCenterPartsType: z.string().optional(),
  profitCenterBoatSalesType: z.string().optional(),
  profitCenterFnbType: z.string().optional(),
  profitCenterHospitalityType: z.string().optional(),
  profitCenterBoatClubType: z.string().optional(),
  profitCenterBoatClubCompany: z.string().optional(),
});

type CompFormData = z.infer<typeof compFormSchema>;

interface CreateEditCompDialogProps {
  open: boolean;
  onClose: () => void;
  comp?: RateComp;
  projectId?: string;
  projectName?: string;
  isPortfolioMode?: boolean;
  onUpdate?: (updatedComp: RateComp) => void;
}

export default function CreateEditCompDialog({ open, onClose, comp, projectId, projectName, isPortfolioMode = false, onUpdate }: CreateEditCompDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!comp;

  const [articleUrls, setArticleUrls] = useState<string[]>(comp?.articleUrls || [""]);
  const [showNewPortfolioDialog, setShowNewPortfolioDialog] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [linkToPortfolio, setLinkToPortfolio] = useState(!!(comp?.parentPortfolioId));
  const [showRateTiersDialog, setShowRateTiersDialog] = useState(false);
  
  // Marina lookup state
  const [marinaSearchOpen, setMarinaSearchOpen] = useState(false);
  const [marinaSearchQuery, setMarinaSearchQuery] = useState("");
  const [marinaSearchResults, setMarinaSearchResults] = useState<MarinaRateDatabase[]>([]);
  const [selectedMarina, setSelectedMarina] = useState<MarinaRateDatabase | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // CRM Property linking state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>((comp as any)?.propertyId || null);
  
  // Occupancy N/A toggle state
  const [occupancyNA, setOccupancyNA] = useState<boolean>(comp?.occupancy === null || (comp as any)?.occupancyNA || false);
  
  // Local rate tiers for creation mode (before the comp is saved)
  const [pendingRateTiers, setPendingRateTiers] = useState<TierRowData[]>([]);
  
  // Portfolio mode state
  const [portfolioTabs, setPortfolioTabs] = useState<Array<{id: string, marinaName: string}>>([
    { id: '1', marinaName: '' },
    { id: '2', marinaName: '' },
    { id: '3', marinaName: '' },
  ]);
  const [activePortfolioTab, setActivePortfolioTab] = useState('1');
  const [portfolioName, setPortfolioName] = useState('');
  
  // Check if the existing comp has a legacy storage type value
  const hasLegacyStorageType = comp?.ioBoth && !STORAGE_TYPES.includes(comp.ioBoth as any);
  const [showLegacyStorageWarning, setShowLegacyStorageWarning] = useState(hasLegacyStorageType);

  // Fetch existing portfolio comps
  const { data: portfoliosData } = useQuery({
    queryKey: queryKeys.comps.portfolios,
    queryFn: () => rateCompsApi.getComps({ isPortfolio: true }),
    enabled: open && linkToPortfolio,
  });

  // Fetch custom storage types
  const { data: customStorageTypes = [] } = useCustomStorageTypes();
  const createCustomStorageType = useCreateCustomStorageType();
  const [newStorageTypeName, setNewStorageTypeName] = useState("");

  // Merge predefined and custom storage types
  const allStorageTypes = [...STORAGE_TYPES, ...customStorageTypes.map(t => t.name)];

  const form = useForm<CompFormData>({
    resolver: zodResolver(compFormSchema),
    defaultValues: {
      marina: comp?.marina || "",
      marinaId: (comp as any)?.marinaId || "",
      city: comp?.city || "",
      state: comp?.state || "",
      address: comp?.address || "",
      zip: comp?.zip || "",
      wetSlips: comp?.wetSlips || "",
      dryRacks: comp?.dryRacks || "",
      ioBoth: (comp?.ioBoth && STORAGE_TYPES.includes(comp.ioBoth as any)) ? comp.ioBoth : undefined,
      storageTypes: comp?.storageTypes || [],
      bodyOfWater: comp?.bodyOfWater || "",
      waterBodyName: comp?.waterBodyName || "",
      waterfront: comp?.waterfront || "",
      region: comp?.region || "",
      acres: comp?.acres ? Number(comp.acres) : "",
      occupancy: comp?.occupancy !== undefined && comp?.occupancy !== null ? Number(comp.occupancy) : "",
      yearBuilt: comp?.yearBuilt || "",
      articleUrls: comp?.articleUrls || [],
      notes: comp?.notes || "",
      waterType: comp?.waterType || comp?.coastalType || "",
      coastalType: comp?.coastalType || "",
      isPortfolio: comp?.isPortfolio ?? isPortfolioMode,
      parentPortfolioId: comp?.parentPortfolioId || "",
      // Rate-focused fields
      rateCollectionDate: (comp as any)?.rateCollectionDate || "",
      rateSource: (comp as any)?.rateSource || "",
      rateTrend: (comp as any)?.rateTrend || "",
      lastVerifiedDate: (comp as any)?.lastVerifiedDate || "",
      sourceNotes: (comp as any)?.sourceNotes || "",
      // Individual profit center boolean fields
      profitCenterStorage: comp?.profitCenterStorage ?? false,
      profitCenterEvents: comp?.profitCenterEvents ?? false,
      profitCenterService: comp?.profitCenterService ?? false,
      profitCenterThirdPartyLeases: comp?.profitCenterThirdPartyLeases ?? false,
      profitCenterBoatRentals: comp?.profitCenterBoatRentals ?? false,
      profitCenterBoatBrokerage: comp?.profitCenterBoatBrokerage ?? false,
      profitCenterRvPark: comp?.profitCenterRvPark ?? false,
      profitCenterFuel: comp?.profitCenterFuel ?? false,
      profitCenterShipStore: comp?.profitCenterShipStore ?? false,
      profitCenterParts: comp?.profitCenterParts ?? false,
      profitCenterBoatClub: comp?.profitCenterBoatClub ?? false,
      profitCenterBoatSales: comp?.profitCenterBoatSales ?? false,
      profitCenterFnb: comp?.profitCenterFnb ?? false,
      profitCenterHospitality: comp?.profitCenterHospitality ?? false,
      // Profit center operation types
      profitCenterBoatRentalsType: comp?.profitCenterBoatRentalsType || "",
      profitCenterBoatBrokerageType: comp?.profitCenterBoatBrokerageType || "",
      profitCenterFuelType: comp?.profitCenterFuelType || "",
      profitCenterShipStoreType: comp?.profitCenterShipStoreType || "",
      profitCenterPartsType: comp?.profitCenterPartsType || "",
      profitCenterBoatSalesType: comp?.profitCenterBoatSalesType || "",
      profitCenterFnbType: comp?.profitCenterFnbType || "",
      profitCenterHospitalityType: comp?.profitCenterHospitalityType || "",
      profitCenterBoatClubType: comp?.profitCenterBoatClubType || "",
      profitCenterBoatClubCompany: comp?.profitCenterBoatClubCompany || "",
    },
  });

  useEffect(() => {
    if (comp) {
      setArticleUrls(comp.articleUrls && comp.articleUrls.length > 0 ? comp.articleUrls : [""]);
    }
  }, [comp]);

  // Reset pending rate tiers when dialog opens in create mode
  useEffect(() => {
    if (open && !comp) {
      setPendingRateTiers([]);
    }
  }, [open, comp]);

  // Marina search function with debouncing
  const searchMarinas = async (query: string) => {
    if (query.length < 2) {
      setMarinaSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await apiRequest<MarinaRateDatabase[]>(
        `/api/marina-database/search?q=${encodeURIComponent(query)}&limit=15`
      );
      setMarinaSearchResults(results || []);
    } catch (error) {
      console.error("Error searching marinas:", error);
      setMarinaSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search handler
  const debouncedSearch = debounce(searchMarinas, 300);
  
  // Handle marina search input change
  const handleMarinaSearchChange = (value: string) => {
    setMarinaSearchQuery(value);
    debouncedSearch(value);
  };

  // Handle marina selection - auto-populate form fields
  const handleMarinaSelect = (marina: MarinaRateDatabase) => {
    setSelectedMarina(marina);
    setMarinaSearchOpen(false);
    setMarinaSearchQuery("");
    
    // Populate form fields from selected marina
    form.setValue("marina", marina.marinaName);
    form.setValue("marinaId", marina.id);
    if (marina.city) form.setValue("city", marina.city);
    if (marina.state) form.setValue("state", marina.state);
    if (marina.address) form.setValue("address", marina.address);
    if (marina.zip) form.setValue("zip", marina.zip);
    if (marina.waterType) form.setValue("waterType", marina.waterType);
    if (marina.wetSlips) form.setValue("wetSlips", marina.wetSlips);
    if (marina.dryRacks) form.setValue("dryRacks", marina.dryRacks);
    if (marina.bodyOfWater) form.setValue("bodyOfWater", marina.bodyOfWater);
    if (marina.waterBodyName) form.setValue("waterBodyName", marina.waterBodyName);
    if (marina.region) form.setValue("region", marina.region);
    if (marina.rateSource) form.setValue("rateSource", marina.rateSource);
    
    toast({
      title: "Marina Linked",
      description: `Linked to "${marina.marinaName}" from Marina Database. Fields have been auto-populated.`,
    });
  };

  // Handle unlinking from marina database
  const handleMarinaUnlink = () => {
    setSelectedMarina(null);
    form.setValue("marinaId", "");
    toast({
      title: "Marina Unlinked",
      description: "Rate comp is no longer linked to Marina Database.",
    });
  };

  const createMutation = useMutation({
    mutationFn: rateCompsApi.createComp,
    onSuccess: async (newComp) => {
      // After creating the rate comp, save any pending rate tiers
      if (pendingRateTiers.length > 0) {
        try {
          for (const tier of pendingRateTiers) {
            if (!tier.isEditing) { // Only save tiers that have been confirmed
              const tierData = rowDataToTier(tier);
              await apiRequest(`/api/rate-comps/${newComp.id}/tiers`, {
                method: 'POST',
                body: JSON.stringify(tierData),
              });
            }
          }
          toast({
            title: "Success",
            description: `Rate comp created with ${pendingRateTiers.filter(t => !t.isEditing).length} rate tier(s)`,
          });
        } catch (error) {
          toast({
            title: "Warning",
            description: "Rate comp created but some rate tiers failed to save",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Comp created successfully",
        });
      }
      
      setPendingRateTiers([]); // Clear pending tiers
      onClose();
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
      // Invalidate project comps if editing in project context
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRateComp) => rateCompsApi.updateComp(comp!.id, data),
    onSuccess: (updatedComp) => {
      toast({
        title: "Success",
        description: projectId ? "Comp updated successfully in project context" : "Comp updated successfully",
      });
      
      // Call onUpdate callback if provided (for edit mode state sync)
      if (onUpdate && updatedComp) {
        onUpdate(updatedComp);
      }
      
      onClose();
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
      // Invalidate project comps if editing in project context
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const createPortfolioMutation = useMutation({
    mutationFn: (name: string) => rateCompsApi.createComp({ 
      marina: name, 
      isPortfolio: true,
    } as any),
    onSuccess: (newPortfolio) => {
      toast({
        title: "Success",
        description: "Portfolio created successfully",
      });
      form.setValue("parentPortfolioId", newPortfolio.id);
      setShowNewPortfolioDialog(false);
      setNewPortfolioName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.portfolios });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleCreatePortfolio = () => {
    if (newPortfolioName.trim()) {
      createPortfolioMutation.mutate(newPortfolioName.trim());
    }
  };

  const onSubmit = (data: CompFormData) => {
    // Convert empty strings to undefined for backend Zod schema compatibility
    const processedData = {
      ...data,
      wetSlips: data.wetSlips === "" ? undefined : Number(data.wetSlips),
      dryRacks: data.dryRacks === "" ? undefined : Number(data.dryRacks),
      acres: data.acres === "" ? undefined : Number(data.acres),
      occupancy: occupancyNA || data.occupancy === "" || data.occupancy === "N/A" ? undefined : Number(data.occupancy),
      yearBuilt: data.yearBuilt === "" ? undefined : Number(data.yearBuilt),
      ioBoth: data.ioBoth === "" || data.ioBoth === "none-selected" ? undefined : data.ioBoth,
      storageTypes: data.storageTypes || [],
      articleUrls: articleUrls.filter(url => url.trim() !== ""),
      city: data.city || undefined,
      state: data.state || undefined,
      bodyOfWater: data.bodyOfWater || undefined,
      waterBodyName: data.waterBodyName || undefined,
      waterfront: data.waterfront || undefined,
      region: data.region || undefined,
      address: data.address || undefined,
      zip: data.zip || undefined,
      notes: data.notes || undefined,
      waterType: data.waterType === "" || data.waterType === "none-selected" ? undefined : data.waterType,
      coastalType: data.waterType === "" || data.waterType === "none-selected" ? undefined : data.waterType,
      // Marina Database link
      marinaId: data.marinaId || undefined,
      // CRM Property link
      propertyId: data.propertyId || undefined,
      // Rate-focused fields
      rateCollectionDate: data.rateCollectionDate || undefined,
      rateSource: data.rateSource === "" || data.rateSource === "none-selected" ? undefined : data.rateSource,
      rateTrend: data.rateTrend === "" || data.rateTrend === "none-selected" ? undefined : data.rateTrend,
      lastVerifiedDate: data.lastVerifiedDate || undefined,
      sourceNotes: data.sourceNotes || undefined,
      // Individual profit center boolean fields
      profitCenterStorage: data.profitCenterStorage,
      profitCenterEvents: data.profitCenterEvents,
      profitCenterService: data.profitCenterService,
      profitCenterThirdPartyLeases: data.profitCenterThirdPartyLeases,
      profitCenterBoatRentals: data.profitCenterBoatRentals,
      profitCenterBoatBrokerage: data.profitCenterBoatBrokerage,
      profitCenterRvPark: data.profitCenterRvPark,
      profitCenterFuel: data.profitCenterFuel,
      profitCenterShipStore: data.profitCenterShipStore,
      profitCenterParts: data.profitCenterParts,
      profitCenterBoatClub: data.profitCenterBoatClub,
      profitCenterBoatSales: data.profitCenterBoatSales,
      profitCenterFnb: data.profitCenterFnb,
      profitCenterHospitality: data.profitCenterHospitality,
      // Operation type fields
      profitCenterBoatRentalsType: data.profitCenterBoatRentalsType || undefined,
      profitCenterBoatBrokerageType: data.profitCenterBoatBrokerageType || undefined,
      profitCenterFuelType: data.profitCenterFuelType || undefined,
      profitCenterShipStoreType: data.profitCenterShipStoreType || undefined,
      profitCenterPartsType: data.profitCenterPartsType || undefined,
      profitCenterBoatSalesType: data.profitCenterBoatSalesType || undefined,
      profitCenterFnbType: data.profitCenterFnbType || undefined,
      profitCenterHospitalityType: data.profitCenterHospitalityType || undefined,
      profitCenterBoatClubType: data.profitCenterBoatClubType || undefined,
      profitCenterBoatClubCompany: data.profitCenterBoatClubCompany || undefined,
      isPortfolio: data.isPortfolio,
      parentPortfolioId: data.parentPortfolioId === "" ? undefined : data.parentPortfolioId,
    };

    if (isEdit) {
      updateMutation.mutate(processedData as any);
    } else {
      createMutation.mutate(processedData as any);
    }
  };

  const addArticleUrl = () => {
    setArticleUrls([...articleUrls, ""]);
  };

  const updateArticleUrl = (index: number, value: string) => {
    const newUrls = [...articleUrls];
    newUrls[index] = value;
    setArticleUrls(newUrls);
  };

  const removeArticleUrl = (index: number) => {
    const newUrls = articleUrls.filter((_, i) => i !== index);
    setArticleUrls(newUrls);
  };

  // Portfolio tab management
  const addMarinaTab = () => {
    const nextId = (Math.max(...portfolioTabs.map(t => parseInt(t.id))) + 1).toString();
    setPortfolioTabs([...portfolioTabs, { id: nextId, marinaName: '' }]);
    setActivePortfolioTab(nextId);
  };

  const updateMarinaName = (tabId: string, name: string) => {
    setPortfolioTabs(tabs => tabs.map(tab => 
      tab.id === tabId ? { ...tab, marinaName: name } : tab
    ));
  };

  const removeMarinaTab = (tabId: string) => {
    if (portfolioTabs.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "Portfolio must have at least one marina",
        variant: "destructive",
      });
      return;
    }
    setPortfolioTabs(tabs => tabs.filter(t => t.id !== tabId));
    if (activePortfolioTab === tabId) {
      setActivePortfolioTab(portfolioTabs[0].id);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {isEdit ? "Edit Comp" : (isPortfolioMode ? "Create New Portfolio" : "Create New Comp")}
              </CardTitle>
              {projectId && projectName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Editing in project: <span className="font-medium">{projectName}</span>
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-auto">
          {isPortfolioMode && !isEdit ? (
            /* Portfolio Creation Mode with Tabs */
            <div className="space-y-4">
              {/* Portfolio Name */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Portfolio Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="portfolio-name">Portfolio Name *</Label>
                    <Input
                      id="portfolio-name"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      placeholder="Enter portfolio name..."
                      data-testid="input-portfolio-name"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Marina Tabs */}
              <Tabs value={activePortfolioTab} onValueChange={setActivePortfolioTab}>
                <div className="flex items-center justify-between mb-2">
                  <TabsList>
                    {portfolioTabs.map(tab => (
                      <TabsTrigger key={tab.id} value={tab.id} data-testid={`tab-marina-${tab.id}`}>
                        {tab.marinaName || `Marina ${tab.id}`}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMarinaTab}
                    data-testid="button-add-marina"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Marina
                  </Button>
                </div>

                {portfolioTabs.map(tab => (
                  <TabsContent key={tab.id} value={tab.id} className="mt-4">
                    <Form {...form}>
                      <form className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Left Column */}
                          <div className="space-y-6">
                            {/* Identity Section */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">Identity</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="marina"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Marina Name *</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          onChange={(e) => {
                                            field.onChange(e);
                                            updateMarinaName(tab.id, e.target.value);
                                          }}
                                          placeholder="Enter marina name..."
                                          data-testid={`input-marina-${tab.id}`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          ) : (
            /* Regular Comp Creation/Edit Mode */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Identity Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Identity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="marina"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Marina Name *</FormLabel>
                                {form.watch("marinaId") ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <Link className="h-3 w-3" />
                                      Linked to Marina DB
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={handleMarinaUnlink}
                                      data-testid="button-unlink-marina"
                                    >
                                      <Unlink className="h-3 w-3 mr-1" />
                                      Unlink
                                    </Button>
                                  </div>
                                ) : (
                                  <Popover open={marinaSearchOpen} onOpenChange={setMarinaSearchOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        data-testid="button-search-marina"
                                      >
                                        <Search className="h-3 w-3 mr-1" />
                                        Search Marina DB
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="end">
                                      <Command>
                                        <CommandInput 
                                          placeholder="Search marinas..." 
                                          value={marinaSearchQuery}
                                          onValueChange={handleMarinaSearchChange}
                                          data-testid="input-search-marina"
                                        />
                                        <CommandList>
                                          {isSearching ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                              Searching...
                                            </div>
                                          ) : marinaSearchResults.length === 0 && marinaSearchQuery.length >= 2 ? (
                                            <CommandEmpty>No marinas found.</CommandEmpty>
                                          ) : marinaSearchQuery.length < 2 ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                              Type at least 2 characters to search
                                            </div>
                                          ) : (
                                            <CommandGroup>
                                              {marinaSearchResults.map((marina) => (
                                                <CommandItem
                                                  key={marina.id}
                                                  value={marina.id}
                                                  onSelect={() => handleMarinaSelect(marina)}
                                                  className="cursor-pointer"
                                                  data-testid={`marina-result-${marina.id}`}
                                                >
                                                  <div className="flex flex-col">
                                                    <span className="font-medium">{marina.marinaName}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                      {marina.city}, {marina.state}
                                                      {marina.wetSlips ? ` • ${marina.wetSlips} slips` : ''}
                                                    </span>
                                                  </div>
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          )}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              <FormControl>
                                <PropertyAutocomplete
                                  value={field.value}
                                  selectedPropertyId={selectedPropertyId}
                                  onValueChange={field.onChange}
                                  onPropertySelect={(property) => {
                                    if (property) {
                                      setSelectedPropertyId(property.id);
                                      form.setValue('propertyId', property.id);
                                    } else {
                                      setSelectedPropertyId(null);
                                      form.setValue('propertyId', undefined);
                                    }
                                  }}
                                  onPropertyDataPopulate={async (property) => {
                                    // Fetch full property data from the for-rate-comp endpoint
                                    try {
                                      const response = await fetch(`/api/properties/${property.id}/for-rate-comp`, {
                                        credentials: 'include'
                                      });
                                      if (response.ok) {
                                        const fullData = await response.json();
                                        // Populate all available fields
                                        if (fullData.city) form.setValue('city', fullData.city);
                                        if (fullData.state) form.setValue('state', fullData.state);
                                        if (fullData.address) form.setValue('address', fullData.address);
                                        if (fullData.zip) form.setValue('zip', fullData.zip);
                                        if (fullData.wetSlips) form.setValue('wetSlips', fullData.wetSlips);
                                        if (fullData.dryRacks) form.setValue('dryRacks', fullData.dryRacks);
                                        if (fullData.occupancy !== undefined && fullData.occupancy !== null) {
                                          form.setValue('occupancy', fullData.occupancy);
                                          setOccupancyNA(false);
                                        }
                                        if (fullData.acres) form.setValue('acres', fullData.acres);
                                        if (fullData.yearBuilt) form.setValue('yearBuilt', fullData.yearBuilt);
                                        if (fullData.waterType) form.setValue('waterType', fullData.waterType);
                                        if (fullData.bodyOfWater) form.setValue('bodyOfWater', fullData.bodyOfWater);
                                        if (fullData.waterBodyName) form.setValue('waterBodyName', fullData.waterBodyName);
                                        if (fullData.region) form.setValue('region', fullData.region);
                                        if (fullData.storageTypes?.length) form.setValue('storageTypes', fullData.storageTypes);
                                        if (fullData.ioBoth) form.setValue('ioBoth', fullData.ioBoth);
                                        // Profit centers
                                        if (fullData.profitCenterStorage) form.setValue('profitCenterStorage', true);
                                        if (fullData.profitCenterEvents) form.setValue('profitCenterEvents', true);
                                        if (fullData.profitCenterService) form.setValue('profitCenterService', true);
                                        if (fullData.profitCenterThirdPartyLeases) form.setValue('profitCenterThirdPartyLeases', true);
                                        if (fullData.profitCenterBoatRentals) form.setValue('profitCenterBoatRentals', true);
                                        if (fullData.profitCenterBoatBrokerage) form.setValue('profitCenterBoatBrokerage', true);
                                        if (fullData.profitCenterRvPark) form.setValue('profitCenterRvPark', true);
                                        if (fullData.profitCenterFuel) form.setValue('profitCenterFuel', true);
                                        if (fullData.profitCenterShipStore) form.setValue('profitCenterShipStore', true);
                                        if (fullData.profitCenterParts) form.setValue('profitCenterParts', true);
                                        if (fullData.profitCenterBoatClub) form.setValue('profitCenterBoatClub', true);
                                        if (fullData.profitCenterBoatSales) form.setValue('profitCenterBoatSales', true);
                                        if (fullData.profitCenterFnb) form.setValue('profitCenterFnb', true);
                                        if (fullData.profitCenterHospitality) form.setValue('profitCenterHospitality', true);
                                        
                                        toast({
                                          title: "Property Linked",
                                          description: `Linked to "${fullData.marina}" from CRM. Fields have been auto-populated.`,
                                        });
                                      } else {
                                        // Fallback to basic property data
                                        if (property.city) form.setValue('city', property.city);
                                        if (property.state) form.setValue('state', property.state);
                                        if (property.address) form.setValue('address', property.address);
                                        if (property.zip) form.setValue('zip', property.zip);
                                        if (property.wetSlips) form.setValue('wetSlips', property.wetSlips);
                                        if (property.drySlips) form.setValue('dryRacks', property.drySlips);
                                      }
                                    } catch (error) {
                                      console.error("Failed to fetch full property data:", error);
                                      // Fallback to basic property data
                                      if (property.city) form.setValue('city', property.city);
                                      if (property.state) form.setValue('state', property.state);
                                      if (property.address) form.setValue('address', property.address);
                                      if (property.zip) form.setValue('zip', property.zip);
                                      if (property.wetSlips) form.setValue('wetSlips', property.wetSlips);
                                      if (property.drySlips) form.setValue('dryRacks', property.drySlips);
                                    }
                                  }}
                                  placeholder="Enter marina name..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                      />
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={linkToPortfolio}
                            onCheckedChange={(checked) => {
                              setLinkToPortfolio(!!checked);
                              if (!checked) {
                                form.setValue("parentPortfolioId", "");
                              }
                            }}
                            data-testid="checkbox-portfolio-sale"
                          />
                          <Label className="text-sm font-normal cursor-pointer" onClick={() => setLinkToPortfolio(!linkToPortfolio)}>
                            Portfolio Sale
                          </Label>
                        </div>

                        {linkToPortfolio && (
                          <div className="flex gap-2">
                            <FormField
                              control={form.control}
                              name="parentPortfolioId"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Select 
                                      value={field.value || ""} 
                                      onValueChange={field.onChange}
                                    >
                                      <SelectTrigger data-testid="select-portfolio">
                                        <SelectValue placeholder="Select a portfolio..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {portfoliosData?.comps && portfoliosData.comps.length > 0 ? (
                                          portfoliosData.comps.map((portfolio) => (
                                            <SelectItem key={portfolio.id} value={portfolio.id}>
                                              {portfolio.marina}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="no-portfolios" disabled>
                                            No portfolios available
                                          </SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowNewPortfolioDialog(true)}
                              data-testid="button-new-portfolio"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              New Portfolio
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <AddressInput
                                value={field.value || ""}
                                onChange={field.onChange}
                                onAddressSelect={(components) => {
                                  if (components.city) form.setValue("city", components.city);
                                  if (components.state) form.setValue("state", components.state);
                                  if (components.zipCode) form.setValue("zip", components.zipCode);
                                }}
                                label="Address"
                                placeholder="Enter full address..."
                                testId="input-address"
                                countries={['us', 'ca']}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-3 gap-3">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="San Diego"
                                  data-testid="input-city"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="CA"
                                  maxLength={50}
                                  data-testid="input-state"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="zip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zip</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="92101"
                                  data-testid="input-zip"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Physical Characteristics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Physical Characteristics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="wetSlips"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Wet Slips</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  placeholder="156"
                                  data-testid="input-wet-slips"
                                />
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
                                <Input 
                                  {...field} 
                                  type="number"
                                  placeholder="89"
                                  data-testid="input-dry-racks"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="acres"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Acres</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  step="0.1"
                                  placeholder="12.5"
                                  data-testid="input-acres"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="yearBuilt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Year Built</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  placeholder="1987"
                                  data-testid="input-year-built"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="storageTypes"
                        render={() => (
                          <FormItem>
                            <FormLabel>Storage Types</FormLabel>
                            {showLegacyStorageWarning && (
                              <Alert className="mb-2">
                                <AlertDescription>
                                  This comp has an outdated storage type value ("{comp?.ioBoth}"). Please select one or more of the new storage type options below.
                                </AlertDescription>
                              </Alert>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {allStorageTypes.map((type) => (
                                <FormField
                                  key={type}
                                  control={form.control}
                                  name="storageTypes"
                                  render={({ field }) => {
                                    return (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(type)}
                                            onCheckedChange={(checked) => {
                                              setShowLegacyStorageWarning(false);
                                              const updated = checked
                                                ? [...(field.value || []), type]
                                                : (field.value || []).filter((val) => val !== type);
                                              field.onChange(updated);
                                            }}
                                            data-testid={`checkbox-storage-${type.toLowerCase().replace(/\s+/g, '-')}`}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal">
                                          {type}
                                        </FormLabel>
                                      </FormItem>
                                    );
                                  }}
                                />
                              ))}
                            </div>

                            <div className="flex gap-2 mt-3">
                              <Input
                                placeholder="Add new storage type..."
                                value={newStorageTypeName}
                                onChange={(e) => setNewStorageTypeName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (newStorageTypeName.trim()) {
                                      createCustomStorageType.mutate(newStorageTypeName.trim(), {
                                        onSuccess: () => {
                                          setNewStorageTypeName("");
                                          toast({
                                            title: "Storage type added",
                                            description: `"${newStorageTypeName.trim()}" has been added to your storage types.`,
                                          });
                                        },
                                        onError: (error: any) => {
                                          toast({
                                            variant: "destructive",
                                            title: "Error",
                                            description: error.message || "Failed to add storage type",
                                          });
                                        },
                                      });
                                    }
                                  }
                                }}
                                data-testid="input-new-storage-type"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  if (newStorageTypeName.trim()) {
                                    createCustomStorageType.mutate(newStorageTypeName.trim(), {
                                      onSuccess: () => {
                                        setNewStorageTypeName("");
                                        toast({
                                          title: "Storage type added",
                                          description: `"${newStorageTypeName.trim()}" has been added to your storage types.`,
                                        });
                                      },
                                      onError: (error: any) => {
                                        toast({
                                          variant: "destructive",
                                          title: "Error",
                                          description: error.message || "Failed to add storage type",
                                        });
                                      },
                                    });
                                  }
                                }}
                                disabled={!newStorageTypeName.trim() || createCustomStorageType.isPending}
                                data-testid="button-add-storage-type"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Rate Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Rate Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="rateCollectionDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate Collection Date</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="date"
                                  data-testid="input-rate-collection-date"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="lastVerifiedDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Verified</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="date"
                                  data-testid="input-last-verified-date"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="rateSource"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate Source</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-rate-source">
                                    <SelectValue placeholder="How were rates collected?" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none-selected">Select source</SelectItem>
                                  <SelectItem value="website">Website</SelectItem>
                                  <SelectItem value="phone">Phone Call</SelectItem>
                                  <SelectItem value="site_visit">Site Visit</SelectItem>
                                  <SelectItem value="rate_card">Published Rate Card</SelectItem>
                                  <SelectItem value="broker">Broker</SelectItem>
                                  <SelectItem value="email">Email/Quote</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="rateTrend"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate Trend</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-rate-trend">
                                    <SelectValue placeholder="Overall rate trend" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none-selected">Select trend</SelectItem>
                                  <SelectItem value="increasing">Increasing</SelectItem>
                                  <SelectItem value="stable">Stable</SelectItem>
                                  <SelectItem value="decreasing">Decreasing</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="occupancy"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Occupancy (%)</FormLabel>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">N/A</span>
                                <Switch
                                  checked={occupancyNA}
                                  onCheckedChange={(checked) => {
                                    setOccupancyNA(checked);
                                    if (checked) {
                                      field.onChange("N/A");
                                    } else {
                                      field.onChange("");
                                    }
                                  }}
                                  data-testid="switch-occupancy-na"
                                />
                              </div>
                            </div>
                            <FormControl>
                              <Input 
                                {...field}
                                value={occupancyNA ? "N/A" : (field.value !== undefined && field.value !== null ? String(field.value) : "")}
                                type={occupancyNA ? "text" : "number"}
                                step="0.1"
                                placeholder="94.2"
                                disabled={occupancyNA}
                                className={occupancyNA ? "bg-muted" : ""}
                                onChange={(e) => {
                                  if (!occupancyNA) {
                                    field.onChange(e.target.value);
                                  }
                                }}
                                data-testid="input-occupancy"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sourceNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={2}
                                placeholder="Website URL, contact name, or other source details..."
                                data-testid="textarea-source-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Rate Tiers - Inline for Edit Mode */}
                  {isEdit && comp && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Rate Tiers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="max-h-[400px] overflow-auto">
                          <RateTiersDataTable
                            rateCompId={comp.id}
                            marinaName={comp.marina}
                            onTiersUpdated={() => {
                              queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
                            }}
                          />
                        </div>
                        <RateHistoryView
                          rateCompId={comp.id}
                          marinaName={comp.marina}
                        />
                      </CardContent>
                    </Card>
                  )}
                  
                  {!isEdit && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Rate Tiers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="max-h-[400px] overflow-auto">
                          <RateTiersDataTable
                            marinaName={form.watch("marina") || "New Marina"}
                            localTiers={pendingRateTiers}
                            onLocalTiersChange={setPendingRateTiers}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Profit Centers & Location */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Profit Centers & Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="waterType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Water Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-water-type">
                              <SelectValue placeholder="Select water type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none-selected">Select water type</SelectItem>
                            {WATER_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
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
                    name="waterBodyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Water Body Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Gulf of America, Lake Superior" data-testid="input-water-body-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-region">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none-selected">Select region</SelectItem>
                            {US_REGIONS.map((region) => (
                              <SelectItem key={region} value={region}>
                                {region}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Enhanced Profit Center Checkboxes with Operation Types - Balanced 2-Column Layout */}
                  <div>
                    <FormLabel className="text-base font-semibold">Profit Centers</FormLabel>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3">
                      {/* All profit centers in balanced columns */}
                      {(() => {
                        const allProfitCenters = [
                          { key: 'profitCenterStorage', label: 'Storage', hasType: false },
                          { key: 'profitCenterBoatRentals', typeKey: 'profitCenterBoatRentalsType', label: 'Boat Rentals', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterBoatBrokerage', typeKey: 'profitCenterBoatBrokerageType', label: 'Boat Brokerage', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterFuel', typeKey: 'profitCenterFuelType', label: 'Fuel', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterShipStore', typeKey: 'profitCenterShipStoreType', label: 'Ship Store', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterParts', typeKey: 'profitCenterPartsType', label: 'Parts', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterBoatSales', typeKey: 'profitCenterBoatSalesType', label: 'Boat Sales', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterFnb', typeKey: 'profitCenterFnbType', label: 'F&B', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterHospitality', typeKey: 'profitCenterHospitalityType', label: 'Hospitality/Accommodations', hasType: true, typeOptions: ['in-house', 'leased'] },
                          { key: 'profitCenterEvents', label: 'Events', hasType: false },
                          { key: 'profitCenterService', label: 'Service', hasType: false },
                          { key: 'profitCenterThirdPartyLeases', label: 'Third-Party Leases', hasType: false },
                          { key: 'profitCenterRvPark', label: 'RV Park', hasType: false },
                          { key: 'profitCenterBoatClub', typeKey: 'profitCenterBoatClubType', label: 'Boat Club', hasType: true, typeOptions: ['in-house', 'third-party'], hasCompanyName: true },
                        ];
                        const midpoint = Math.ceil(allProfitCenters.length / 2);
                        const leftColumn = allProfitCenters.slice(0, midpoint);
                        const rightColumn = allProfitCenters.slice(midpoint);
                        
                        const renderProfitCenter = (pc: typeof allProfitCenters[0]) => (
                          <div key={pc.key} className="space-y-2">
                            <FormField
                              control={form.control}
                              name={pc.key as keyof CompFormData}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value === true}
                                      onCheckedChange={(checked) => field.onChange(checked === true)}
                                      data-testid={`checkbox-${pc.key.toLowerCase()}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {pc.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                            {pc.hasType && pc.typeKey && form.watch(pc.key as keyof CompFormData) && (
                              <div className="ml-6 space-y-2">
                                <FormField
                                  control={form.control}
                                  name={pc.typeKey as keyof CompFormData}
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                        <FormControl>
                                          <SelectTrigger className="w-32" data-testid={`select-${pc.typeKey?.toLowerCase()}`}>
                                            <SelectValue placeholder="Select type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="none">Select type</SelectItem>
                                          {pc.typeOptions?.map(opt => (
                                            <SelectItem key={opt} value={opt}>
                                              {opt === 'in-house' ? 'In-House' : opt === 'leased' ? 'Leased' : 'Third-Party'}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                                {pc.hasCompanyName && form.watch(pc.typeKey as keyof CompFormData) === 'third-party' && (
                                  <FormField
                                    control={form.control}
                                    name="profitCenterBoatClubCompany"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            placeholder="Company name"
                                            className="w-32"
                                            data-testid="input-profitcenterboatclubcompany"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                        
                        return (
                          <>
                            <div className="space-y-3">
                              {leftColumn.map(renderProfitCenter)}
                            </div>
                            <div className="space-y-3">
                              {rightColumn.map(renderProfitCenter)}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rate Tiers Section */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Rate Tiers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RateTiersDataTable
                    rateCompId={comp?.id}
                    localTiers={!comp ? pendingRateTiers : undefined}
                    onLocalTiersChange={!comp ? setPendingRateTiers : undefined}
                  />
                </CardContent>
              </Card>
            </form>
          </Form>
          )}
        </div>

        <DialogFooter className="flex gap-2 sticky bottom-0 bg-background pt-4 border-t mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-cancel-comp"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={form.handleSubmit(onSubmit)}
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-save-comp"
        >
          {createMutation.isPending || updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            isEdit ? 'Update' : 'Create'
          )}
        </Button>
        </DialogFooter>
      </Card>

      {/* New Portfolio Dialog */}
      <Dialog open={showNewPortfolioDialog} onOpenChange={setShowNewPortfolioDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-portfolio-name">Portfolio Name</Label>
              <Input
                id="new-portfolio-name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="Enter portfolio name"
                data-testid="input-new-portfolio-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewPortfolioDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePortfolio}
              disabled={!newPortfolioName.trim() || createPortfolioMutation.isPending}
            >
              {createPortfolioMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Portfolio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

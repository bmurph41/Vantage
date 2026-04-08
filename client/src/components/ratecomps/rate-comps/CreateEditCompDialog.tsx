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
import { X, Save, Plus, Trash2, DollarSign, Search, Link, Unlink, ToggleLeft, Loader2, Copy, MapPin, TrendingUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  address: z.string().min(1, "Address is required"),
  zip: z.string().min(1, "Zip code is required"),
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
  rateType: z.string().optional(),
  rateAmount: z.union([z.string(), z.number()]).optional(),
  seasonality: z.string().optional(),
  boatLengthMin: z.union([z.string(), z.number()]).optional(),
  boatLengthMax: z.union([z.string(), z.number()]).optional(),
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
  
  // Combined marina search result type (from Marina DB or CRM Properties)
  type CombinedMarinaResult = {
    id: string;
    marinaName: string;
    city?: string;
    state?: string;
    address?: string;
    zip?: string;
    waterType?: string;
    wetSlips?: number | null;
    dryRacks?: number | null;
    bodyOfWater?: string;
    waterBodyName?: string;
    region?: string;
    rateSource?: string;
    source: 'marina_db' | 'crm_property';
    propertyId?: string; // Only for CRM properties
  };

  // Marina lookup state
  const [marinaSearchOpen, setMarinaSearchOpen] = useState(false);
  const [marinaSearchQuery, setMarinaSearchQuery] = useState("");
  const [marinaSearchResults, setMarinaSearchResults] = useState<CombinedMarinaResult[]>([]);
  const [selectedMarina, setSelectedMarina] = useState<CombinedMarinaResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // CRM Property linking state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>((comp as any)?.propertyId || null);
  
  // Occupancy N/A toggle state
  const [occupancyNA, setOccupancyNA] = useState<boolean>(comp?.occupancy === null || (comp as any)?.occupancyNA || false);
  
  // Copy from existing comp state
  const [showCopyFromDialog, setShowCopyFromDialog] = useState(false);
  const [copySearchQuery, setCopySearchQuery] = useState("");
  const [copySearchResults, setCopySearchResults] = useState<RateComp[]>([]);
  const [isCopySearching, setIsCopySearching] = useState(false);
  
  // Similar marinas state
  const [showSimilarMarinas, setShowSimilarMarinas] = useState(false);
  const [similarMarinas, setSimilarMarinas] = useState<RateComp[]>([]);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  
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
      rateType: (comp as any)?.rateType || "",
      rateAmount: (comp as any)?.rateAmount || "",
      seasonality: (comp as any)?.seasonality || "",
      boatLengthMin: (comp as any)?.boatLengthMin || "",
      boatLengthMax: (comp as any)?.boatLengthMax || "",
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

  // Marina search function with debouncing - searches both Marina DB and CRM Properties
  const searchMarinas = async (query: string) => {
    if (query.length < 2) {
      setMarinaSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Search both Marina Database and CRM Properties in parallel
      const [marinaDbResults, crmResults] = await Promise.all([
        apiRequest<MarinaRateDatabase[]>(
          `/api/marina-database/search?q=${encodeURIComponent(query)}&limit=10`
        ).catch(() => [] as MarinaRateDatabase[]),
        apiRequest<Array<{id: string; title: string; city?: string; state?: string; address?: string; zip?: string; wetSlips?: number; drySlips?: number; occupancy?: number}>>(
          `/api/properties/search?q=${encodeURIComponent(query)}&limit=10&type=marina`
        ).catch(() => [])
      ]);
      
      // Convert Marina DB results to combined format
      const marinaDbFormatted: CombinedMarinaResult[] = (marinaDbResults || []).map(m => ({
        id: m.id,
        marinaName: m.marinaName,
        city: m.city || undefined,
        state: m.state || undefined,
        address: m.address || undefined,
        zip: m.zip || undefined,
        waterType: m.waterType || undefined,
        wetSlips: m.wetSlips,
        dryRacks: m.dryRacks,
        bodyOfWater: m.bodyOfWater || undefined,
        waterBodyName: m.waterBodyName || undefined,
        region: m.region || undefined,
        rateSource: m.rateSource || undefined,
        source: 'marina_db' as const,
      }));
      
      // Convert CRM Property results to combined format
      const crmFormatted: CombinedMarinaResult[] = (crmResults || []).map(p => ({
        id: `crm-${p.id}`,
        marinaName: p.title,
        city: p.city || undefined,
        state: p.state || undefined,
        address: p.address || undefined,
        zip: p.zip || undefined,
        wetSlips: p.wetSlips ?? null,
        dryRacks: p.drySlips ?? null,
        source: 'crm_property' as const,
        propertyId: p.id,
      }));
      
      // Combine and deduplicate by name (prefer CRM if exists)
      const combined = [...crmFormatted, ...marinaDbFormatted];
      setMarinaSearchResults(combined);
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

  // Handle marina selection - auto-populate form fields (works for both Marina DB and CRM Properties)
  const handleMarinaSelect = async (marina: CombinedMarinaResult) => {
    setSelectedMarina(marina);
    setMarinaSearchOpen(false);
    setMarinaSearchQuery("");
    
    // Populate form fields from selected marina
    form.setValue("marina", marina.marinaName);
    
    // If from CRM Property, link to property and fetch full data
    if (marina.source === 'crm_property' && marina.propertyId) {
      form.setValue("propertyId", marina.propertyId);
      setSelectedPropertyId(marina.propertyId);
      
      // Fetch full property data for comprehensive auto-population
      try {
        const response = await fetch(`/api/properties/${marina.propertyId}/for-rate-comp`, {
          credentials: 'include'
        });
        if (response.ok) {
          const fullData = await response.json();
          if (fullData.city) form.setValue('city', fullData.city);
          if (fullData.state) form.setValue('state', fullData.state);
          if (fullData.address) form.setValue('address', fullData.address);
          if (fullData.zip) form.setValue('zip', fullData.zip);
          if (fullData.wetSlips) form.setValue('wetSlips', fullData.wetSlips);
          if (fullData.dryRacks) form.setValue('dryRacks', fullData.dryRacks);
          if (fullData.waterType) form.setValue('waterType', fullData.waterType);
          if (fullData.bodyOfWater) form.setValue('bodyOfWater', fullData.bodyOfWater);
          if (fullData.waterBodyName) form.setValue('waterBodyName', fullData.waterBodyName);
          if (fullData.region) form.setValue('region', fullData.region);
        }
      } catch (error) {
        console.error("Error fetching full property data:", error);
      }
      
      toast({
        title: "Property Linked",
        description: `Linked to "${marina.marinaName}" from CRM. Fields have been auto-populated.`,
      });
    } else {
      // From Marina DB - use the ID directly
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
    }
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

  // Search for existing comps to copy from
  const searchCompsForCopy = async (query: string) => {
    if (query.length < 2) {
      setCopySearchResults([]);
      return;
    }
    
    setIsCopySearching(true);
    try {
      const results = await rateCompsApi.getComps({ search: query, limit: 10 });
      setCopySearchResults(results.comps || []);
    } catch (error) {
      console.error("Error searching comps:", error);
      setCopySearchResults([]);
    } finally {
      setIsCopySearching(false);
    }
  };

  const debouncedCopySearch = debounce(searchCompsForCopy, 300);

  // Handle copying property details from existing comp
  const handleCopyFromComp = (sourceComp: RateComp) => {
    // Copy property details (not rates - those stay separate)
    if (sourceComp.city) form.setValue("city", sourceComp.city);
    if (sourceComp.state) form.setValue("state", sourceComp.state);
    if (sourceComp.region) form.setValue("region", sourceComp.region);
    if (sourceComp.bodyOfWater) form.setValue("bodyOfWater", sourceComp.bodyOfWater);
    if (sourceComp.waterBodyName) form.setValue("waterBodyName", sourceComp.waterBodyName);
    if (sourceComp.waterType) form.setValue("waterType", sourceComp.waterType);
    if (sourceComp.coastalType) form.setValue("coastalType", sourceComp.coastalType);
    if (sourceComp.storageTypes?.length) form.setValue("storageTypes", sourceComp.storageTypes);
    // Copy profit centers
    if (sourceComp.profitCenterStorage) form.setValue("profitCenterStorage", true);
    if (sourceComp.profitCenterEvents) form.setValue("profitCenterEvents", true);
    if (sourceComp.profitCenterService) form.setValue("profitCenterService", true);
    if (sourceComp.profitCenterFuel) form.setValue("profitCenterFuel", true);
    if (sourceComp.profitCenterShipStore) form.setValue("profitCenterShipStore", true);
    if (sourceComp.profitCenterBoatRentals) form.setValue("profitCenterBoatRentals", true);
    if (sourceComp.profitCenterBoatSales) form.setValue("profitCenterBoatSales", true);
    if (sourceComp.profitCenterBoatBrokerage) form.setValue("profitCenterBoatBrokerage", true);
    if (sourceComp.profitCenterBoatClub) form.setValue("profitCenterBoatClub", true);
    
    setShowCopyFromDialog(false);
    setCopySearchQuery("");
    setCopySearchResults([]);
    
    toast({
      title: "Settings Copied",
      description: `Copied region, water type, and profit center settings from "${sourceComp.marina}".`,
    });
  };

  // Find similar marinas by state/region
  const findSimilarMarinas = async () => {
    const state = form.watch("state");
    const region = form.watch("region");
    
    if (!state && !region) {
      toast({
        title: "Location Required",
        description: "Enter a state or region first to find similar marinas.",
        variant: "destructive",
      });
      return;
    }
    
    setIsFindingSimilar(true);
    try {
      const filters: any = { limit: 10 };
      if (state) filters.state = state;
      if (region) filters.region = region;
      
      const results = await rateCompsApi.getComps(filters);
      const currentMarina = form.watch("marina");
      // Filter out the current marina being edited
      setSimilarMarinas((results.comps || []).filter((c: RateComp) => c.marina !== currentMarina));
      setShowSimilarMarinas(true);
    } catch (error) {
      console.error("Error finding similar marinas:", error);
      toast({
        title: "Error",
        description: "Failed to find similar marinas",
        variant: "destructive",
      });
    } finally {
      setIsFindingSimilar(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: rateCompsApi.createComp,
    onSuccess: async (newComp) => {
      // After creating the rate comp, save any pending rate tiers
      const tiersToSave = pendingRateTiers.filter(t => !t.isEditing);
      if (tiersToSave.length > 0) {
        try {
          for (const tier of tiersToSave) {
            const tierData = rowDataToTier(tier);
            await apiRequest('POST', `/api/rate-comps/${newComp.id}/tiers`, tierData);
          }
          toast({
            title: "Success",
            description: `Rate comp created with ${tiersToSave.length} rate tier(s)`,
          });
        } catch (error) {
          console.error("Error saving rate tiers:", error);
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
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
      queryClient.invalidateQueries({ queryKey: ['rate-comps'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
      if (comp) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comps.tiers(comp.id) });
        queryClient.invalidateQueries({ queryKey: ['/api/rate-comps', comp.id, 'tiers'] });
      }
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
      rateType: data.rateType === "" || data.rateType === "none-selected" ? undefined : data.rateType,
      rateAmount: data.rateAmount === "" ? undefined : Number(data.rateAmount),
      seasonality: data.seasonality === "" || data.seasonality === "none-selected" ? undefined : data.seasonality,
      boatLengthMin: data.boatLengthMin === "" ? undefined : Number(data.boatLengthMin),
      boatLengthMax: data.boatLengthMax === "" ? undefined : Number(data.boatLengthMax),
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                {/* Edit Mode: Rate details only - property info shown in parent context */}
                {isEdit && comp && (
                  <div className="space-y-6">
                    {/* Rate Details Section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Rate Classification</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="rateType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate Type</FormLabel>
                                <Select value={field.value || ""} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger data-testid="edit-rate-type">
                                      <SelectValue placeholder="Select rate type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none-selected">Not specified</SelectItem>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Annual">Annual</SelectItem>
                                    <SelectItem value="Daily">Daily</SelectItem>
                                    <SelectItem value="Weekly">Weekly</SelectItem>
                                    <SelectItem value="Seasonal">Seasonal</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="seasonality"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Seasonality</FormLabel>
                                <Select value={field.value || ""} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger data-testid="edit-seasonality">
                                      <SelectValue placeholder="Select seasonality" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none-selected">Not specified</SelectItem>
                                    <SelectItem value="Year-Round">Year-Round</SelectItem>
                                    <SelectItem value="Seasonal">Seasonal</SelectItem>
                                    <SelectItem value="Summer Only">Summer Only</SelectItem>
                                    <SelectItem value="Winter Only">Winter Only</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="boatLengthMin"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Min Boat Length (ft)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    value={field.value ?? ""} 
                                    placeholder="e.g., 20" 
                                    data-testid="edit-boat-length-min" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="boatLengthMax"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Boat Length (ft)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    value={field.value ?? ""} 
                                    placeholder="e.g., 60" 
                                    data-testid="edit-boat-length-max" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="storageTypes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Storage Type</FormLabel>
                                <Select 
                                  value={field.value?.[0] || ""} 
                                  onValueChange={(value) => field.onChange(value ? [value] : [])}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="edit-storage-type">
                                      <SelectValue placeholder="Select storage type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {allStorageTypes.map((type) => (
                                      <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="rateAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate Amount</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input 
                                      type="text"
                                      inputMode="numeric"
                                      {...field}
                                      value={field.value ? Number(field.value).toLocaleString('en-US') : ""}
                                      onChange={(e) => {
                                        const rawValue = e.target.value.replace(/[^0-9]/g, '');
                                        field.onChange(rawValue ? parseInt(rawValue, 10) : "");
                                      }}
                                      placeholder="0"
                                      className="pl-7"
                                      data-testid="edit-rate-amount"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Create Mode: Full Property Section */}
                {!isEdit && (
                <div className="space-y-6">
                  {/* Quick Actions Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCopyFromDialog(true)}
                      className="text-xs"
                      data-testid="button-copy-from"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy From Existing
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={findSimilarMarinas}
                      disabled={isFindingSimilar}
                      className="text-xs"
                      data-testid="button-find-similar"
                    >
                      {isFindingSimilar ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <MapPin className="h-3 w-3 mr-1" />
                      )}
                      Find Similar Marinas
                    </Button>
                  </div>

                  {/* Similar Marinas Panel */}
                  {showSimilarMarinas && similarMarinas.length > 0 && (
                    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            Similar Marinas for Rate Comparison
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSimilarMarinas(false)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ScrollArea className="h-32">
                          <div className="space-y-2">
                            {similarMarinas.map((m) => (
                              <div 
                                key={m.id} 
                                className="flex items-center justify-between p-2 rounded bg-background border text-sm"
                              >
                                <div>
                                  <span className="font-medium">{m.marina}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {m.city}, {m.state}
                                  </span>
                                </div>
                                {m.wetSlips && (
                                  <span className="text-xs text-muted-foreground">
                                    {m.wetSlips} slips
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Property</CardTitle>
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
                                                  <div className="flex flex-col w-full">
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className="font-medium">{marina.marinaName}</span>
                                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${marina.source === 'crm_property' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                        {marina.source === 'crm_property' ? 'CRM' : 'Marina DB'}
                                                      </span>
                                                    </div>
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
                      
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <AddressInput
                                value={field.value || ""}
                                onChange={(value, components) => {
                                  if (components && (components.street || components.city || components.state || components.zipCode)) {
                                    if (components.street) field.onChange(components.street);
                                    if (components.city) form.setValue("city", components.city);
                                    if (components.state) form.setValue("state", components.state);
                                    if (components.zipCode) form.setValue("zip", components.zipCode);
                                  } else {
                                    field.onChange(value);
                                  }
                                }}
                                onAddressSelect={(components) => {
                                  if (components.street || components.streetAddress) {
                                    form.setValue("address", components.street || components.streetAddress || '');
                                  }
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
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                </div>
              </div>
                )}

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
                    marinaName={form.watch("marina") || comp?.marina || ""}
                    localTiers={!comp ? pendingRateTiers : undefined}
                    onLocalTiersChange={!comp ? setPendingRateTiers : undefined}
                    hideAddButton={isEdit}
                  />
                </CardContent>
              </Card>
            </form>
          </Form>
          )}
        </div>

        <DialogFooter className="flex gap-3 sticky bottom-0 bg-background pt-5 pb-2 px-6 border-t mt-4">
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

      {/* Copy From Existing Dialog */}
      <Dialog open={showCopyFromDialog} onOpenChange={setShowCopyFromDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Copy Settings From Existing Comp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Search for an existing rate comp to copy its region, water type, and profit center settings.
            </p>
            <div className="space-y-2">
              <Label>Search Marinas</Label>
              <Input
                value={copySearchQuery}
                onChange={(e) => {
                  setCopySearchQuery(e.target.value);
                  debouncedCopySearch(e.target.value);
                }}
                placeholder="Type marina name to search..."
                data-testid="input-copy-search"
              />
            </div>
            <ScrollArea className="h-48 border rounded-md">
              {isCopySearching ? (
                <div className="flex items-center justify-center h-full p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : copySearchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {copySearchQuery.length >= 2 ? "No marinas found" : "Type at least 2 characters to search"}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {copySearchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCopyFromComp(c)}
                      className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors border"
                      data-testid={`copy-comp-${c.id}`}
                    >
                      <div className="font-medium">{c.marina}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <span>{c.city}, {c.state}</span>
                        {c.region && (
                          <>
                            <span className="text-border">•</span>
                            <span>{c.region}</span>
                          </>
                        )}
                        {c.waterType && (
                          <>
                            <span className="text-border">•</span>
                            <span>{c.waterType}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCopyFromDialog(false);
                setCopySearchQuery("");
                setCopySearchResults([]);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

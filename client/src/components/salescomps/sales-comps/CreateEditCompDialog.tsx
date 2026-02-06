import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PercentageInput } from "@/components/ui/percentage-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { salesCompsApi } from '@/lib/salescomps/api';
import { queryKeys } from '@/lib/salescomps/queryKeys';
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/salescomps/authUtils";
import { z } from "zod";
import type { SalesComp, InsertSalesComp, UpdateSalesComp } from "@shared/schema";
import { PROFIT_CENTERS, WATER_TYPES, STORAGE_TYPES, US_REGIONS } from "@shared/salescomps-constants";
import { AddressInput } from "@/components/address-input";
import { useCustomStorageTypes, useCreateCustomStorageType } from "@/hooks/salescomps/useCustomStorageTypes";
import PropertyAutocomplete from "@/components/property-autocomplete";
import { ArchivePromptModal } from "@/components/crm/ArchivePromptModal";

const compFormSchema = z.object({
  marina: z.string().min(1, "Marina name is required"),
  propertyId: z.string().optional(),
  salePrice: z.union([z.string(), z.number()]).optional(),
  isPriceDisclosed: z.boolean().default(true),
  capRate: z.union([z.string(), z.number()]).optional(),
  isCapRateDisclosed: z.boolean().default(true),
  noi: z.union([z.string(), z.number()]).optional(),
  isNoiDisclosed: z.boolean().default(true),
  saleMonth: z.union([z.string(), z.number()]).optional(),
  saleYear: z.union([z.string(), z.number()]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  wetSlips: z.union([z.string(), z.number()]).optional(),
  dryRacks: z.union([z.string(), z.number()]).optional(),
  ioBoth: z.string().optional(),
  storageTypes: z.array(z.string()).default([]),
  bodyOfWater: z.string().optional(),
  waterBodyName: z.string().optional(),
  waterfront: z.string().optional(),
  region: z.string().optional(),
  saleCondition: z.string().optional(),
  daysOnMarket: z.union([z.string(), z.number()]).optional(),
  broker: z.string().optional(),
  brokerage: z.string().optional(),
  brokerageCompanyId: z.string().optional(),
  agentFirstName: z.string().optional(),
  agentLastName: z.string().optional(),
  agentName: z.string().optional(),
  agentContactId: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().optional(),
  seller: z.string().optional(),
  company: z.string().optional(),
  owner: z.string().optional(),
  listPrice: z.union([z.string(), z.number()]).optional(),
  isMarketBid: z.boolean().default(false),
  estimatedPurchasePrice: z.union([z.string(), z.number()]).optional(),
  // Transaction parties
  sellerCompany: z.string().optional(),
  sellerPrincipal: z.string().optional(),
  buyerCompany: z.string().optional(),
  buyerPrincipal: z.string().optional(),
  acres: z.union([z.string(), z.number()]).optional(),
  occupancy: z.union([z.string(), z.number()]).optional(),
  yearBuilt: z.union([z.string(), z.number()]).optional(),
  articleUrls: z.array(z.string()).default([]),
  notes: z.string().optional(),
  waterType: z.string().optional(),
  coastalType: z.string().optional(), // Legacy field
  isPortfolio: z.boolean().default(false),
  parentPortfolioId: z.string().optional(),
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
  comp?: SalesComp;
  projectId?: string;
  projectName?: string;
  isPortfolioMode?: boolean;
  onUpdate?: (updatedComp: SalesComp) => void;
}

export default function CreateEditCompDialog({ open, onClose, comp, projectId, projectName, isPortfolioMode = false, onUpdate }: CreateEditCompDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!comp;

  const [articleUrls, setArticleUrls] = useState<string[]>(comp?.articleUrls || [""]);
  const [showNewPortfolioDialog, setShowNewPortfolioDialog] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [linkToPortfolio, setLinkToPortfolio] = useState(!!(comp?.parentPortfolioId));
  
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
  
  // Property linking state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>((comp as any)?.propertyId || null);
  
  // Archive prompt state - shows after creating a sales comp with seller info
  const [showArchivePrompt, setShowArchivePrompt] = useState(false);
  const [createdCompId, setCreatedCompId] = useState<string | null>(null);

  // Fetch existing portfolio comps
  const { data: portfoliosData } = useQuery({
    queryKey: queryKeys.comps.portfolios,
    queryFn: () => salesCompsApi.getComps({ isPortfolio: true }),
    enabled: open && linkToPortfolio,
  });

  // Fetch custom storage types
  const { data: customStorageTypes = [] } = useCustomStorageTypes();
  const createCustomStorageType = useCreateCustomStorageType();
  const [newStorageTypeName, setNewStorageTypeName] = useState("");

  // Merge predefined and custom storage types
  const allStorageTypes = [...STORAGE_TYPES, ...customStorageTypes.map(t => t.name)];

  // Brokerage company search state
  const [brokerageSearch, setBrokerageSearch] = useState("");
  const [showBrokerageDropdown, setShowBrokerageDropdown] = useState(false);

  // Agent state
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [isNewAgent, setIsNewAgent] = useState(false);
  
  // Additional agents state for multi-agent support
  type AdditionalAgent = { name: string; contactId?: string };
  const [additionalAgents, setAdditionalAgents] = useState<AdditionalAgent[]>(
    (comp as any)?.additionalAgents || []
  );
  const [showAdditionalAgentDropdown, setShowAdditionalAgentDropdown] = useState<number | null>(null);
  const [additionalAgentSearch, setAdditionalAgentSearch] = useState("");

  // Seller company/principal state
  const [sellerCompanySearch, setSellerCompanySearch] = useState("");
  const [showSellerCompanyDropdown, setShowSellerCompanyDropdown] = useState(false);
  const [sellerPrincipalSearch, setSellerPrincipalSearch] = useState("");
  const [showSellerPrincipalDropdown, setShowSellerPrincipalDropdown] = useState(false);
  const [isNewSellerPrincipal, setIsNewSellerPrincipal] = useState(false);

  // Buyer company/principal state
  const [buyerCompanySearch, setBuyerCompanySearch] = useState("");
  const [showBuyerCompanyDropdown, setShowBuyerCompanyDropdown] = useState(false);
  const [buyerPrincipalSearch, setBuyerPrincipalSearch] = useState("");
  const [showBuyerPrincipalDropdown, setShowBuyerPrincipalDropdown] = useState(false);
  const [isNewBuyerPrincipal, setIsNewBuyerPrincipal] = useState(false);

  const form = useForm<CompFormData>({
    resolver: zodResolver(compFormSchema),
    defaultValues: {
      marina: comp?.marina || "",
      salePrice: comp?.salePrice ? Number(comp.salePrice) : "",
      isPriceDisclosed: comp?.isPriceDisclosed ?? true,
      capRate: comp?.capRate ? Number(comp.capRate) : "",
      isCapRateDisclosed: comp?.isCapRateDisclosed ?? true,
      noi: comp?.noi ? Number(comp.noi) : "",
      isNoiDisclosed: comp?.isNoiDisclosed ?? true,
      saleMonth: comp?.saleMonth || "",
      saleYear: comp?.saleYear || "",
      city: comp?.city || "",
      state: comp?.state || "",
      wetSlips: comp?.wetSlips || "",
      dryRacks: comp?.dryRacks || "",
      ioBoth: (comp?.ioBoth && STORAGE_TYPES.includes(comp.ioBoth as any)) ? comp.ioBoth : undefined,
      storageTypes: comp?.storageTypes || [],
      bodyOfWater: comp?.bodyOfWater || "",
      waterBodyName: comp?.waterBodyName || "",
      waterfront: comp?.waterfront || "",
      region: comp?.region || "",
      saleCondition: comp?.saleCondition || "",
      daysOnMarket: comp?.daysOnMarket || "",
      broker: comp?.broker || "",
      brokerage: comp?.brokerage || "",
      brokerageCompanyId: (comp as any)?.brokerageCompanyId || "",
      agentFirstName: comp?.agentFirstName || "",
      agentLastName: comp?.agentLastName || "",
      agentName: (comp as any)?.agentName || "",
      agentContactId: (comp as any)?.agentContactId || "",
      address: comp?.address || "",
      zip: comp?.zip || "",
      seller: comp?.seller || "",
      company: comp?.company || "",
      owner: comp?.owner || "",
      sellerCompany: comp?.seller || "",
      sellerCompanyId: (comp as any)?.sellerCompanyId || "",
      sellerPrincipal: comp?.owner || "",
      sellerContactId: (comp as any)?.sellerContactId || "",
      buyerCompany: comp?.company || "",
      buyerCompanyId: (comp as any)?.buyerCompanyId || "",
      buyerPrincipal: comp?.buyerPrincipal || "",
      buyerContactId: (comp as any)?.buyerContactId || "",
      listPrice: comp?.listPrice ? Number(comp.listPrice) : "",
      isMarketBid: (comp as any)?.isMarketBid ?? false,
      estimatedPurchasePrice: comp?.estimatedPurchasePrice ? Number(comp.estimatedPurchasePrice) : "",
      acres: comp?.acres ? Number(comp.acres) : "",
      occupancy: comp?.occupancy ? Number(comp.occupancy) : "",
      yearBuilt: comp?.yearBuilt || "",
      articleUrls: comp?.articleUrls || [],
      notes: comp?.notes || "",
      waterType: comp?.waterType || comp?.coastalType || "",
      coastalType: comp?.coastalType || "",
      isPortfolio: comp?.isPortfolio ?? isPortfolioMode,
      parentPortfolioId: comp?.parentPortfolioId || "",
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

  // Watch company IDs for contact filtering (must be after form initialization)
  const selectedBrokerageCompanyId = form.watch("brokerageCompanyId");
  const selectedSellerCompanyId = form.watch("sellerCompanyId");
  const selectedBuyerCompanyId = form.watch("buyerCompanyId");

  // Fetch all CRM companies for autocomplete
  const { data: allCompanies = [] } = useQuery<Array<{id: string; name: string; labels?: string[]}>>({
    queryKey: ['/api/companies'],
    enabled: open,
  });

  // Filter broker companies based on search and "Broker" label
  const filteredBrokerCompanies = allCompanies.filter((company: any) =>
    company.labels?.includes('Broker') &&
    company.name.toLowerCase().includes(brokerageSearch.toLowerCase())
  );

  // Filter all companies for seller search (no label restriction)
  const filteredSellerCompanies = allCompanies.filter((company: any) =>
    company.name.toLowerCase().includes(sellerCompanySearch.toLowerCase())
  );

  // Filter all companies for buyer search (no label restriction)
  const filteredBuyerCompanies = allCompanies.filter((company: any) =>
    company.name.toLowerCase().includes(buyerCompanySearch.toLowerCase())
  );

  // Fetch contacts for selected brokerage company
  const { data: brokerageContacts = [] } = useQuery<Array<{id: string; firstName?: string; lastName?: string; name?: string; companyId?: string}>>({
    queryKey: ['/api/contacts', 'by-company', selectedBrokerageCompanyId],
    queryFn: async () => {
      if (!selectedBrokerageCompanyId) return [];
      const res = await fetch(`/api/contacts?companyId=${selectedBrokerageCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!selectedBrokerageCompanyId,
  });

  // Fetch contacts for selected seller company
  const { data: sellerContacts = [] } = useQuery<Array<{id: string; firstName?: string; lastName?: string; name?: string; companyId?: string}>>({
    queryKey: ['/api/contacts', 'by-company', selectedSellerCompanyId],
    queryFn: async () => {
      if (!selectedSellerCompanyId) return [];
      const res = await fetch(`/api/contacts?companyId=${selectedSellerCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!selectedSellerCompanyId,
  });

  // Fetch contacts for selected buyer company
  const { data: buyerContacts = [] } = useQuery<Array<{id: string; firstName?: string; lastName?: string; name?: string; companyId?: string}>>({
    queryKey: ['/api/contacts', 'by-company', selectedBuyerCompanyId],
    queryFn: async () => {
      if (!selectedBuyerCompanyId) return [];
      const res = await fetch(`/api/contacts?companyId=${selectedBuyerCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!selectedBuyerCompanyId,
  });

  useEffect(() => {
    if (comp) {
      setArticleUrls(comp.articleUrls && comp.articleUrls.length > 0 ? comp.articleUrls : [""]);
      setAdditionalAgents((comp as any).additionalAgents || []);
      
      // Reset form with comp data when editing
      form.reset({
        marina: comp.marina || "",
        salePrice: comp.salePrice ? Number(comp.salePrice) : "",
        isPriceDisclosed: comp.isPriceDisclosed ?? true,
        capRate: comp.capRate ? Number(comp.capRate) : "",
        isCapRateDisclosed: comp.isCapRateDisclosed ?? true,
        noi: comp.noi ? Number(comp.noi) : "",
        isNoiDisclosed: comp.isNoiDisclosed ?? true,
        saleMonth: comp.saleMonth || "",
        saleYear: comp.saleYear || "",
        city: comp.city || "",
        state: comp.state || "",
        wetSlips: comp.wetSlips || "",
        dryRacks: comp.dryRacks || "",
        ioBoth: (comp.ioBoth && STORAGE_TYPES.includes(comp.ioBoth as any)) ? comp.ioBoth : undefined,
        storageTypes: comp.storageTypes || [],
        bodyOfWater: comp.bodyOfWater || "",
        waterBodyName: comp.waterBodyName || "",
        waterfront: comp.waterfront || "",
        region: comp.region || "",
        saleCondition: comp.saleCondition || "",
        daysOnMarket: comp.daysOnMarket || "",
        broker: comp.broker || "",
        brokerage: comp.brokerage || "",
        brokerageCompanyId: (comp as any).brokerageCompanyId || "",
        agentFirstName: comp.agentFirstName || "",
        agentLastName: comp.agentLastName || "",
        agentName: (comp as any).agentName || "",
        agentContactId: (comp as any).agentContactId || "",
        address: comp.address || "",
        zip: comp.zip || "",
        seller: comp.seller || "",
        company: comp.company || "",
        owner: comp.owner || "",
        // Map database columns to form fields for transaction parties
        sellerCompany: comp.seller || "",
        sellerCompanyId: (comp as any).sellerCompanyId || "",
        sellerPrincipal: comp.owner || "",
        sellerContactId: (comp as any).sellerContactId || "",
        buyerCompany: comp.company || "",
        buyerCompanyId: (comp as any).buyerCompanyId || "",
        buyerPrincipal: comp.buyerPrincipal || "",
        buyerContactId: (comp as any).buyerContactId || "",
        listPrice: comp.listPrice ? Number(comp.listPrice) : "",
        isMarketBid: (comp as any).isMarketBid ?? false,
        acres: comp.acres ? Number(comp.acres) : "",
        occupancy: comp.occupancy ? Number(comp.occupancy) : "",
        yearBuilt: comp.yearBuilt || "",
        articleUrls: comp.articleUrls || [],
        notes: comp.notes || "",
        waterType: comp.waterType || comp.coastalType || "",
        coastalType: comp.coastalType || "",
        isPortfolio: comp.isPortfolio ?? isPortfolioMode,
        parentPortfolioId: comp.parentPortfolioId || "",
        profitCenterStorage: comp.profitCenterStorage ?? false,
        profitCenterEvents: comp.profitCenterEvents ?? false,
        profitCenterService: comp.profitCenterService ?? false,
        profitCenterThirdPartyLeases: comp.profitCenterThirdPartyLeases ?? false,
        profitCenterBoatRentals: comp.profitCenterBoatRentals ?? false,
        profitCenterBoatBrokerage: comp.profitCenterBoatBrokerage ?? false,
        profitCenterRvPark: comp.profitCenterRvPark ?? false,
        profitCenterFuel: comp.profitCenterFuel ?? false,
        profitCenterShipStore: comp.profitCenterShipStore ?? false,
        profitCenterParts: comp.profitCenterParts ?? false,
        profitCenterBoatClub: comp.profitCenterBoatClub ?? false,
        profitCenterBoatSales: comp.profitCenterBoatSales ?? false,
        profitCenterFnb: comp.profitCenterFnb ?? false,
        profitCenterHospitality: comp.profitCenterHospitality ?? false,
        profitCenterBoatRentalsType: comp.profitCenterBoatRentalsType || "",
        profitCenterBoatBrokerageType: comp.profitCenterBoatBrokerageType || "",
        profitCenterFuelType: comp.profitCenterFuelType || "",
        profitCenterShipStoreType: comp.profitCenterShipStoreType || "",
        profitCenterPartsType: comp.profitCenterPartsType || "",
        profitCenterBoatSalesType: comp.profitCenterBoatSalesType || "",
        profitCenterFnbType: comp.profitCenterFnbType || "",
        profitCenterHospitalityType: comp.profitCenterHospitalityType || "",
        profitCenterBoatClubType: comp.profitCenterBoatClubType || "",
        profitCenterBoatClubCompany: comp.profitCenterBoatClubCompany || "",
      });
    } else {
      // Reset to empty form when creating new comp
      form.reset({
        marina: "",
        salePrice: "",
        isPriceDisclosed: true,
        capRate: "",
        isCapRateDisclosed: true,
        noi: "",
        isNoiDisclosed: true,
        saleMonth: "",
        saleYear: "",
        city: "",
        state: "",
        wetSlips: "",
        dryRacks: "",
        ioBoth: undefined,
        storageTypes: [],
        bodyOfWater: "",
        waterBodyName: "",
        waterfront: "",
        region: "",
        saleCondition: "",
        daysOnMarket: "",
        broker: "",
        brokerage: "",
        brokerageCompanyId: "",
        agentFirstName: "",
        agentLastName: "",
        agentName: "",
        agentContactId: "",
        address: "",
        zip: "",
        seller: "",
        company: "",
        owner: "",
        sellerCompany: "",
        sellerCompanyId: "",
        sellerPrincipal: "",
        sellerContactId: "",
        buyerCompany: "",
        buyerCompanyId: "",
        buyerPrincipal: "",
        buyerContactId: "",
        listPrice: "",
        isMarketBid: false,
        acres: "",
        occupancy: "",
        yearBuilt: "",
        articleUrls: [],
        notes: "",
        waterType: "",
        coastalType: "",
        isPortfolio: isPortfolioMode,
        parentPortfolioId: "",
        profitCenterStorage: false,
        profitCenterEvents: false,
        profitCenterService: false,
        profitCenterThirdPartyLeases: false,
        profitCenterBoatRentals: false,
        profitCenterBoatBrokerage: false,
        profitCenterRvPark: false,
        profitCenterFuel: false,
        profitCenterShipStore: false,
        profitCenterParts: false,
        profitCenterBoatClub: false,
        profitCenterBoatSales: false,
        profitCenterFnb: false,
        profitCenterHospitality: false,
        profitCenterBoatRentalsType: "",
        profitCenterBoatBrokerageType: "",
        profitCenterFuelType: "",
        profitCenterShipStoreType: "",
        profitCenterPartsType: "",
        profitCenterBoatSalesType: "",
        profitCenterFnbType: "",
        profitCenterHospitalityType: "",
        profitCenterBoatClubType: "",
        profitCenterBoatClubCompany: "",
      });
      setArticleUrls([""]);
      setAdditionalAgents([]);
    }
  }, [comp, form, isPortfolioMode]);

  const createMutation = useMutation({
    mutationFn: salesCompsApi.createComp,
    onSuccess: (createdComp) => {
      toast({
        title: "Success",
        description: "Comp created successfully",
      });
      
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        return key[0] === '/api/analysis/sales-comps/recent' ||
               key[0] === '/api/dashboards/widgets/query';
      }});
      // Invalidate project comps if editing in project context
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      }
      
      // Check if the created comp has seller info and prompt for archiving
      if (createdComp && (createdComp.sellerContactId || createdComp.sellerCompanyId)) {
        setCreatedCompId(createdComp.id);
        setShowArchivePrompt(true);
      } else {
        onClose();
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
    mutationFn: (data: UpdateSalesComp) => salesCompsApi.updateComp(comp!.id, data),
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
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        return key[0] === '/api/analysis/sales-comps/recent' ||
               key[0] === '/api/dashboards/widgets/query';
      }});
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
    mutationFn: (name: string) => salesCompsApi.createComp({ 
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

  const onSubmit = (data: CompFormData) => {
    // Convert empty strings to undefined for backend Zod schema compatibility
    const processedData = {
      ...data,
      salePrice: data.salePrice === "" ? undefined : Number(data.salePrice),
      capRate: data.capRate === "" ? undefined : Number(data.capRate),
      noi: data.noi === "" ? undefined : Number(data.noi),
      saleMonth: data.saleMonth === "" ? undefined : Number(data.saleMonth),
      saleYear: data.saleYear === "" ? undefined : Number(data.saleYear),
      wetSlips: data.wetSlips === "" ? undefined : Number(data.wetSlips),
      dryRacks: data.dryRacks === "" ? undefined : Number(data.dryRacks),
      daysOnMarket: data.daysOnMarket === "" ? undefined : Number(data.daysOnMarket),
      listPrice: data.isMarketBid ? undefined : (data.listPrice === "" ? undefined : Number(data.listPrice)),
      isMarketBid: data.isMarketBid,
      estimatedPurchasePrice: data.estimatedPurchasePrice === "" ? undefined : Number(data.estimatedPurchasePrice),
      acres: data.acres === "" ? undefined : Number(data.acres),
      occupancy: data.occupancy === "" ? undefined : Number(data.occupancy),
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
      saleCondition: data.saleCondition || undefined,
      broker: data.broker || undefined,
      brokerage: data.brokerage || undefined,
      brokerageCompanyId: data.brokerageCompanyId || undefined,
      agentFirstName: data.agentFirstName || undefined,
      agentLastName: data.agentLastName || undefined,
      agentName: data.agentName || undefined,
      agentContactId: data.agentContactId || undefined,
      additionalAgents: additionalAgents.filter(a => a.name.trim() !== ""),
      address: data.address || undefined,
      zip: data.zip || undefined,
      seller: data.seller || undefined,
      company: data.company || undefined,
      owner: data.owner || undefined,
      sellerCompany: data.sellerCompany || undefined,
      sellerPrincipal: data.sellerPrincipal || undefined,
      buyerCompany: data.buyerCompany || undefined,
      buyerPrincipal: data.buyerPrincipal || undefined,
      notes: data.notes || undefined,
      propertyId: data.propertyId || undefined,
      waterType: data.waterType === "" || data.waterType === "none-selected" ? undefined : data.waterType,
      coastalType: data.waterType === "" || data.waterType === "none-selected" ? undefined : data.waterType, // Sync with waterType for backward compatibility
      isPriceDisclosed: data.isPriceDisclosed,
      isCapRateDisclosed: data.isCapRateDisclosed,
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
                                {tab.id === '1' ? (
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
                                ) : (
                                  <div className="space-y-2">
                                    <Label htmlFor={`marina-${tab.id}`}>Marina Name *</Label>
                                    <Input
                                      id={`marina-${tab.id}`}
                                      value={tab.marinaName}
                                      onChange={(e) => updateMarinaName(tab.id, e.target.value)}
                                      placeholder="Enter marina name..."
                                      data-testid={`input-marina-${tab.id}`}
                                    />
                                  </div>
                                )}
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
                              <FormLabel>Marina Name *</FormLabel>
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
                                  onPropertyDataPopulate={(property) => {
                                    if (property.city) form.setValue('city', property.city);
                                    if (property.state) form.setValue('state', property.state);
                                    if (property.address) form.setValue('address', property.address);
                                    if (property.wetSlips) form.setValue('wetSlips', property.wetSlips);
                                    if (property.drySlips) form.setValue('dryRacks', property.drySlips);
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
                                onChange={(value, components) => {
                                  console.error('[SalesComp:onChange]', JSON.stringify({
                                    value, hasComponents: !!components,
                                    street: components?.street, city: components?.city,
                                    state: components?.state, zip: components?.zipCode,
                                  }));
                                  if (components && (components.street || components.city || components.state || components.zipCode)) {
                                    const current = form.getValues();
                                    const updates: Record<string, string> = {};
                                    if (components.street) updates.address = components.street;
                                    if (components.city) updates.city = components.city;
                                    if (components.state) updates.state = components.state;
                                    if (components.zipCode) updates.zip = components.zipCode;
                                    console.error('[SalesComp:onChange] resetting with updates:', JSON.stringify(updates));
                                    form.reset({ ...current, ...updates }, { keepDefaultValues: true });
                                    console.error('[SalesComp:onChange] after reset, values:', JSON.stringify({
                                      address: form.getValues('address'),
                                      city: form.getValues('city'),
                                      state: form.getValues('state'),
                                      zip: form.getValues('zip'),
                                    }));
                                  } else {
                                    field.onChange(value);
                                  }
                                }}
                                onAddressSelect={(components) => {
                                  console.error('[SalesComp:onAddressSelect]', JSON.stringify({
                                    street: components?.street, city: components?.city,
                                    state: components?.state, zip: components?.zipCode,
                                  }));
                                  const current = form.getValues();
                                  const updates: Record<string, string> = {};
                                  if (components.street || components.streetAddress) {
                                    updates.address = components.street || components.streetAddress || '';
                                  }
                                  if (components.city) updates.city = components.city;
                                  if (components.state) updates.state = components.state;
                                  if (components.zipCode) updates.zip = components.zipCode;
                                  form.reset({ ...current, ...updates }, { keepDefaultValues: true });
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
                                  type="text"
                                  placeholder="e.g. 156"
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
                                  type="text"
                                  placeholder="e.g. 89"
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
                                  type="text"
                                  placeholder="e.g. 12.5"
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
                                  type="text"
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
                  {/* Financial Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Financial Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="salePrice"
                          render={({ field }) => {
                            const isPriceUndisclosed = !form.watch("isPriceDisclosed");
                            return (
                              <FormItem>
                                <FormLabel>Sale Price</FormLabel>
                                <FormControl>
                                  {isPriceUndisclosed ? (
                                    <Input value="N/A" disabled data-testid="input-sale-price" />
                                  ) : (
                                    <CurrencyInput
                                      value={field.value}
                                      onValueChange={(val) => field.onChange(val ?? "")}
                                      placeholder="12,500,000"
                                      data-testid="input-sale-price"
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                        
                        <FormField
                          control={form.control}
                          name="listPrice"
                          render={({ field }) => {
                            const isMarketBid = form.watch("isMarketBid");
                            return (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>List Price</FormLabel>
                                  <FormField
                                    control={form.control}
                                    name="isMarketBid"
                                    render={({ field: marketBidField }) => (
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id="isMarketBid"
                                          checked={marketBidField.value}
                                          onCheckedChange={marketBidField.onChange}
                                          data-testid="checkbox-market-bid"
                                        />
                                        <label htmlFor="isMarketBid" className="text-sm text-muted-foreground cursor-pointer">
                                          Market Bid
                                        </label>
                                      </div>
                                    )}
                                  />
                                </div>
                                <FormControl>
                                  {isMarketBid ? (
                                    <Input 
                                      value="Market Bid" 
                                      disabled 
                                      className="bg-muted text-muted-foreground"
                                      data-testid="input-list-price" 
                                    />
                                  ) : (
                                    <CurrencyInput
                                      value={field.value}
                                      onValueChange={(val) => field.onChange(val ?? "")}
                                      placeholder="13,750,000"
                                      data-testid="input-list-price"
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="estimatedPurchasePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estimated Purchase Price</FormLabel>
                              <FormControl>
                                <CurrencyInput
                                  value={field.value}
                                  onValueChange={(val) => field.onChange(val ?? "")}
                                  placeholder="12,000,000"
                                  data-testid="input-estimated-purchase-price"
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground mt-1">Broker estimate when actual price unavailable</p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div /> {/* Empty space for grid alignment */}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="noi"
                          render={({ field }) => {
                            const isNoiUndisclosed = !form.watch("isNoiDisclosed");
                            return (
                              <FormItem>
                                <FormLabel>NOI</FormLabel>
                                <FormControl>
                                  {isNoiUndisclosed ? (
                                    <Input value="N/A" disabled data-testid="input-noi" />
                                  ) : (
                                    <CurrencyInput
                                      value={field.value}
                                      onValueChange={(val) => field.onChange(val ?? "")}
                                      placeholder="900,000"
                                      data-testid="input-noi"
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                        
                        <FormField
                          control={form.control}
                          name="capRate"
                          render={({ field }) => {
                            const isCapRateUndisclosed = !form.watch("isCapRateDisclosed");
                            return (
                              <FormItem>
                                <FormLabel>Cap Rate</FormLabel>
                                <FormControl>
                                  {isCapRateUndisclosed ? (
                                    <Input value="N/A" disabled data-testid="input-cap-rate" />
                                  ) : (
                                    <PercentageInput
                                      value={field.value}
                                      onValueChange={(val) => field.onChange(val ?? "")}
                                      placeholder="7.20"
                                      data-testid="input-cap-rate"
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="occupancy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Occupancy</FormLabel>
                              <FormControl>
                                <PercentageInput
                                  value={field.value}
                                  onValueChange={(val) => field.onChange(val ?? "")}
                                  placeholder="94.20"
                                  data-testid="input-occupancy"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="daysOnMarket"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days on Market</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="text"
                                  placeholder="127"
                                  data-testid="input-days-on-market"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <FormField
                          control={form.control}
                          name="isPriceDisclosed"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={!field.value}
                                  onCheckedChange={(checked) => field.onChange(!checked)}
                                  data-testid="checkbox-price-undisclosed"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Price Undisclosed
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="isCapRateDisclosed"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={!field.value}
                                  onCheckedChange={(checked) => field.onChange(!checked)}
                                  data-testid="checkbox-cap-rate-undisclosed"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Cap Rate Undisclosed
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="isNoiDisclosed"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={!field.value}
                                  onCheckedChange={(checked) => field.onChange(!checked)}
                                  data-testid="checkbox-noi-undisclosed"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                NOI Undisclosed
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sale Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sale Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="saleMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Month</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-sale-month">
                                    <SelectValue placeholder="Select month" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {Array.from({ length: 12 }, (_, i) => {
                                    const month = new Date(0, i).toLocaleString('en', { month: 'long' });
                                    return (
                                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        {month}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="saleYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Year</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="text"
                                  placeholder="2024"
                                  data-testid="input-sale-year"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="saleCondition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sale Condition</FormLabel>
                            <Select 
                              value={field.value || ""} 
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-sale-condition">
                                  <SelectValue placeholder="Select sale condition" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="On-Market">On-Market</SelectItem>
                                <SelectItem value="Off-Market">Off-Market</SelectItem>
                                <SelectItem value="Pocket Listing">Pocket Listing</SelectItem>
                                <SelectItem value="Auction">Auction</SelectItem>
                                <SelectItem value="REO/Foreclosure">REO/Foreclosure</SelectItem>
                                <SelectItem value="Short Sale">Short Sale</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Brokerage with autocomplete */}
                      <FormField
                        control={form.control}
                        name="brokerage"
                        render={({ field }) => {
                          const isOffMarket = form.watch("saleCondition") === "Off-Market";
                          return (
                            <FormItem className="relative">
                              <FormLabel className={isOffMarket ? "text-muted-foreground" : ""}>Brokerage</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={brokerageSearch || field.value || ""}
                                  onChange={(e) => {
                                    setBrokerageSearch(e.target.value);
                                    field.onChange(e.target.value);
                                    form.setValue("brokerageCompanyId", "");
                                    setShowBrokerageDropdown(true);
                                  }}
                                  onFocus={() => setShowBrokerageDropdown(true)}
                                  onBlur={() => setTimeout(() => setShowBrokerageDropdown(false), 200)}
                                  placeholder="Search broker companies..."
                                  data-testid="input-brokerage"
                                  disabled={isOffMarket}
                                  className={isOffMarket ? "bg-muted text-muted-foreground" : ""}
                                  autoComplete="off"
                                />
                              </FormControl>
                              {showBrokerageDropdown && filteredBrokerCompanies.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                  {filteredBrokerCompanies.slice(0, 10).map((company: any) => (
                                    <div
                                      key={company.id}
                                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                      onMouseDown={() => {
                                        field.onChange(company.name);
                                        setBrokerageSearch(company.name);
                                        form.setValue("brokerageCompanyId", company.id);
                                        setShowBrokerageDropdown(false);
                                        // Reset agent when brokerage changes
                                        form.setValue("agentName", "");
                                        form.setValue("agentContactId", "");
                                        setIsNewAgent(false);
                                      }}
                                    >
                                      <span className="font-medium">{company.name}</span>
                                      <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Broker</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Search companies tagged as "Broker" in your CRM
                              </p>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                      
                      {/* Agent - single field with dropdown from brokerage contacts */}
                      <FormField
                        control={form.control}
                        name="agentName"
                        render={({ field }) => {
                          const isOffMarket = form.watch("saleCondition") === "Off-Market";
                          const hasSelectedBrokerage = !!selectedBrokerageCompanyId;
                          
                          return (
                            <FormItem className="relative">
                              <FormLabel className={isOffMarket ? "text-muted-foreground" : ""}>Agent</FormLabel>
                              <FormControl>
                                {isNewAgent ? (
                                  <div className="flex gap-2">
                                    <Input 
                                      {...field} 
                                      value={agentSearch}
                                      onChange={(e) => {
                                        setAgentSearch(e.target.value);
                                        field.onChange(e.target.value);
                                      }}
                                      placeholder="Enter new agent name"
                                      data-testid="input-agent-name"
                                      disabled={isOffMarket}
                                      className={isOffMarket ? "bg-muted text-muted-foreground" : ""}
                                    />
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setIsNewAgent(false);
                                        setAgentSearch("");
                                        field.onChange("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <Input 
                                      value={field.value || agentSearch}
                                      onChange={(e) => {
                                        setAgentSearch(e.target.value);
                                        field.onChange(e.target.value);
                                        form.setValue("agentContactId", "");
                                        setShowAgentDropdown(true);
                                      }}
                                      onFocus={() => setShowAgentDropdown(true)}
                                      onBlur={() => setTimeout(() => setShowAgentDropdown(false), 200)}
                                      placeholder={hasSelectedBrokerage ? "Select or add agent..." : "Enter agent name"}
                                      data-testid="input-agent-name"
                                      disabled={isOffMarket}
                                      className={isOffMarket ? "bg-muted text-muted-foreground" : ""}
                                      autoComplete="off"
                                    />
                                    {showAgentDropdown && hasSelectedBrokerage && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {brokerageContacts
                                          .filter((c: any) => {
                                            const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '';
                                            return fullName.toLowerCase().includes(agentSearch.toLowerCase());
                                          })
                                          .slice(0, 10)
                                          .map((contact: any) => {
                                            const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unnamed Contact';
                                            return (
                                              <div
                                                key={contact.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                                onMouseDown={() => {
                                                  field.onChange(fullName);
                                                  setAgentSearch(fullName);
                                                  form.setValue("agentContactId", contact.id);
                                                  setShowAgentDropdown(false);
                                                }}
                                              >
                                                {fullName}
                                              </div>
                                            );
                                          })}
                                        <div
                                          className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-blue-600 border-t flex items-center gap-2"
                                          onMouseDown={() => {
                                            setIsNewAgent(true);
                                            setAgentSearch("");
                                            field.onChange("");
                                            form.setValue("agentContactId", "");
                                            setShowAgentDropdown(false);
                                          }}
                                        >
                                          <Plus className="w-4 h-4" />
                                          Add New Agent
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </FormControl>
                              {hasSelectedBrokerage && brokerageContacts.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {brokerageContacts.length} agent(s) found at this brokerage
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                      
                      {/* Additional Agents Section */}
                      <div className="space-y-2 pt-2 border-t mt-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Additional Agents</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAdditionalAgents([...additionalAgents, { name: "", contactId: undefined }])}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Agent
                          </Button>
                        </div>
                        {additionalAgents.length > 0 && (
                          <div className="space-y-2">
                            {additionalAgents.map((agent, index) => (
                              <div key={index} className="flex gap-2 items-center">
                                <div className="relative flex-1">
                                  <Input
                                    value={agent.name}
                                    onChange={(e) => {
                                      const updated = [...additionalAgents];
                                      updated[index] = { ...updated[index], name: e.target.value, contactId: undefined };
                                      setAdditionalAgents(updated);
                                      setAdditionalAgentSearch(e.target.value);
                                      setShowAdditionalAgentDropdown(index);
                                    }}
                                    onFocus={() => {
                                      setShowAdditionalAgentDropdown(index);
                                      setAdditionalAgentSearch(agent.name);
                                    }}
                                    onBlur={() => setTimeout(() => setShowAdditionalAgentDropdown(null), 200)}
                                    placeholder="Enter agent name"
                                    className="h-8 text-sm"
                                  />
                                  {showAdditionalAgentDropdown === index && selectedBrokerageCompanyId && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-32 overflow-y-auto">
                                      {brokerageContacts
                                        .filter((c: any) => {
                                          const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '';
                                          return fullName.toLowerCase().includes(additionalAgentSearch.toLowerCase());
                                        })
                                        .slice(0, 5)
                                        .map((contact: any) => {
                                          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unnamed Contact';
                                          return (
                                            <div
                                              key={contact.id}
                                              className="px-2 py-1.5 cursor-pointer hover:bg-gray-100 text-sm"
                                              onMouseDown={() => {
                                                const updated = [...additionalAgents];
                                                updated[index] = { name: fullName, contactId: contact.id };
                                                setAdditionalAgents(updated);
                                                setShowAdditionalAgentDropdown(null);
                                              }}
                                            >
                                              {fullName}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = additionalAgents.filter((_, i) => i !== index);
                                    setAdditionalAgents(updated);
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        {additionalAgents.length === 0 && (
                          <p className="text-xs text-muted-foreground">Click "Add Agent" to add more agents from this brokerage</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Transaction Parties */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaction Parties</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Seller Section */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-gray-700">Seller</h4>
                      
                      {/* Seller Company with autocomplete */}
                      <FormField
                        control={form.control}
                        name="sellerCompany"
                        render={({ field }) => (
                          <FormItem className="relative">
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={sellerCompanySearch || field.value || ""}
                                onChange={(e) => {
                                  setSellerCompanySearch(e.target.value);
                                  field.onChange(e.target.value);
                                  form.setValue("sellerCompanyId", "");
                                  setShowSellerCompanyDropdown(true);
                                }}
                                onFocus={() => setShowSellerCompanyDropdown(true)}
                                onBlur={() => setTimeout(() => setShowSellerCompanyDropdown(false), 200)}
                                placeholder="Search CRM companies..."
                                data-testid="input-seller-company"
                                autoComplete="off"
                              />
                            </FormControl>
                            {showSellerCompanyDropdown && filteredSellerCompanies.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {filteredSellerCompanies.slice(0, 10).map((company: any) => (
                                  <div
                                    key={company.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      field.onChange(company.name);
                                      setSellerCompanySearch(company.name);
                                      form.setValue("sellerCompanyId", company.id);
                                      setShowSellerCompanyDropdown(false);
                                      form.setValue("sellerPrincipal", "");
                                      form.setValue("sellerContactId", "");
                                      setIsNewSellerPrincipal(false);
                                    }}
                                  >
                                    <span className="font-medium">{company.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Search companies in your CRM
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Seller Principal with dropdown */}
                      <FormField
                        control={form.control}
                        name="sellerPrincipal"
                        render={({ field }) => {
                          const hasSelectedSellerCompany = !!selectedSellerCompanyId;
                          return (
                            <FormItem className="relative">
                              <FormLabel>Principal</FormLabel>
                              <FormControl>
                                {isNewSellerPrincipal ? (
                                  <div className="flex gap-2">
                                    <Input 
                                      {...field} 
                                      value={sellerPrincipalSearch}
                                      onChange={(e) => {
                                        setSellerPrincipalSearch(e.target.value);
                                        field.onChange(e.target.value);
                                      }}
                                      placeholder="Enter new principal name"
                                      data-testid="input-seller-principal"
                                    />
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setIsNewSellerPrincipal(false);
                                        setSellerPrincipalSearch("");
                                        field.onChange("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <Input 
                                      value={field.value || sellerPrincipalSearch}
                                      onChange={(e) => {
                                        setSellerPrincipalSearch(e.target.value);
                                        field.onChange(e.target.value);
                                        form.setValue("sellerContactId", "");
                                        setShowSellerPrincipalDropdown(true);
                                      }}
                                      onFocus={() => setShowSellerPrincipalDropdown(true)}
                                      onBlur={() => setTimeout(() => setShowSellerPrincipalDropdown(false), 200)}
                                      placeholder={hasSelectedSellerCompany ? "Select or add principal..." : "Enter principal name"}
                                      data-testid="input-seller-principal"
                                      autoComplete="off"
                                    />
                                    {showSellerPrincipalDropdown && hasSelectedSellerCompany && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {sellerContacts
                                          .filter((c: any) => {
                                            const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '';
                                            return fullName.toLowerCase().includes(sellerPrincipalSearch.toLowerCase());
                                          })
                                          .slice(0, 10)
                                          .map((contact: any) => {
                                            const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unnamed Contact';
                                            return (
                                              <div
                                                key={contact.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                                onMouseDown={() => {
                                                  field.onChange(fullName);
                                                  setSellerPrincipalSearch(fullName);
                                                  form.setValue("sellerContactId", contact.id);
                                                  setShowSellerPrincipalDropdown(false);
                                                }}
                                              >
                                                {fullName}
                                              </div>
                                            );
                                          })}
                                        <div
                                          className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-blue-600 border-t flex items-center gap-2"
                                          onMouseDown={() => {
                                            setIsNewSellerPrincipal(true);
                                            setSellerPrincipalSearch("");
                                            field.onChange("");
                                            form.setValue("sellerContactId", "");
                                            setShowSellerPrincipalDropdown(false);
                                          }}
                                        >
                                          <Plus className="w-4 h-4" />
                                          Add New Principal
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </FormControl>
                              {hasSelectedSellerCompany && sellerContacts.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {sellerContacts.length} contact(s) found at this company
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    {/* Buyer Section */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-gray-700">Buyer</h4>
                      
                      {/* Buyer Company with autocomplete */}
                      <FormField
                        control={form.control}
                        name="buyerCompany"
                        render={({ field }) => (
                          <FormItem className="relative">
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={buyerCompanySearch || field.value || ""}
                                onChange={(e) => {
                                  setBuyerCompanySearch(e.target.value);
                                  field.onChange(e.target.value);
                                  form.setValue("buyerCompanyId", "");
                                  setShowBuyerCompanyDropdown(true);
                                }}
                                onFocus={() => setShowBuyerCompanyDropdown(true)}
                                onBlur={() => setTimeout(() => setShowBuyerCompanyDropdown(false), 200)}
                                placeholder="Search CRM companies..."
                                data-testid="input-buyer-company"
                                autoComplete="off"
                              />
                            </FormControl>
                            {showBuyerCompanyDropdown && filteredBuyerCompanies.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {filteredBuyerCompanies.slice(0, 10).map((company: any) => (
                                  <div
                                    key={company.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      field.onChange(company.name);
                                      setBuyerCompanySearch(company.name);
                                      form.setValue("buyerCompanyId", company.id);
                                      setShowBuyerCompanyDropdown(false);
                                      form.setValue("buyerPrincipal", "");
                                      form.setValue("buyerContactId", "");
                                      setIsNewBuyerPrincipal(false);
                                    }}
                                  >
                                    <span className="font-medium">{company.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Search companies in your CRM
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Buyer Principal with dropdown */}
                      <FormField
                        control={form.control}
                        name="buyerPrincipal"
                        render={({ field }) => {
                          const hasSelectedBuyerCompany = !!selectedBuyerCompanyId;
                          return (
                            <FormItem className="relative">
                              <FormLabel>Principal</FormLabel>
                              <FormControl>
                                {isNewBuyerPrincipal ? (
                                  <div className="flex gap-2">
                                    <Input 
                                      {...field} 
                                      value={buyerPrincipalSearch}
                                      onChange={(e) => {
                                        setBuyerPrincipalSearch(e.target.value);
                                        field.onChange(e.target.value);
                                      }}
                                      placeholder="Enter new principal name"
                                      data-testid="input-buyer-principal"
                                    />
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setIsNewBuyerPrincipal(false);
                                        setBuyerPrincipalSearch("");
                                        field.onChange("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <Input 
                                      value={field.value || buyerPrincipalSearch}
                                      onChange={(e) => {
                                        setBuyerPrincipalSearch(e.target.value);
                                        field.onChange(e.target.value);
                                        form.setValue("buyerContactId", "");
                                        setShowBuyerPrincipalDropdown(true);
                                      }}
                                      onFocus={() => setShowBuyerPrincipalDropdown(true)}
                                      onBlur={() => setTimeout(() => setShowBuyerPrincipalDropdown(false), 200)}
                                      placeholder={hasSelectedBuyerCompany ? "Select or add principal..." : "Enter principal name"}
                                      data-testid="input-buyer-principal"
                                      autoComplete="off"
                                    />
                                    {showBuyerPrincipalDropdown && hasSelectedBuyerCompany && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {buyerContacts
                                          .filter((c: any) => {
                                            const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '';
                                            return fullName.toLowerCase().includes(buyerPrincipalSearch.toLowerCase());
                                          })
                                          .slice(0, 10)
                                          .map((contact: any) => {
                                            const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unnamed Contact';
                                            return (
                                              <div
                                                key={contact.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                                onMouseDown={() => {
                                                  field.onChange(fullName);
                                                  setBuyerPrincipalSearch(fullName);
                                                  form.setValue("buyerContactId", contact.id);
                                                  setShowBuyerPrincipalDropdown(false);
                                                }}
                                              >
                                                {fullName}
                                              </div>
                                            );
                                          })}
                                        <div
                                          className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-blue-600 border-t flex items-center gap-2"
                                          onMouseDown={() => {
                                            setIsNewBuyerPrincipal(true);
                                            setBuyerPrincipalSearch("");
                                            field.onChange("");
                                            form.setValue("buyerContactId", "");
                                            setShowBuyerPrincipalDropdown(false);
                                          }}
                                        >
                                          <Plus className="w-4 h-4" />
                                          Add New Principal
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </FormControl>
                              {hasSelectedBuyerCompany && buyerContacts.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {buyerContacts.length} contact(s) found at this company
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                  
                  {/* Enhanced Profit Center Checkboxes with Operation Types */}
                  <div>
                    <FormLabel className="text-base font-semibold">Profit Centers</FormLabel>
                    <div className="space-y-4 mt-3">
                      {/* Simple profit centers without operation types */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'profitCenterStorage', label: 'Storage' },
                          { key: 'profitCenterEvents', label: 'Events' },
                          { key: 'profitCenterService', label: 'Service' },
                          { key: 'profitCenterThirdPartyLeases', label: 'Third-Party Leases' },
                          { key: 'profitCenterRvPark', label: 'RV Park' },
                        ].map((profitCenter) => (
                          <FormField
                            key={profitCenter.key}
                            control={form.control}
                            name={profitCenter.key as keyof CompFormData}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value === true}
                                    onCheckedChange={(checked) => field.onChange(checked === true)}
                                    data-testid={`checkbox-${profitCenter.key.toLowerCase()}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {profitCenter.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>

                      {/* Profit centers with In-House/Leased operation types */}
                      {[
                        { key: 'profitCenterBoatRentals', typeKey: 'profitCenterBoatRentalsType', label: 'Boat Rentals' },
                        { key: 'profitCenterBoatBrokerage', typeKey: 'profitCenterBoatBrokerageType', label: 'Boat Brokerage' },
                        { key: 'profitCenterFuel', typeKey: 'profitCenterFuelType', label: 'Fuel' },
                        { key: 'profitCenterShipStore', typeKey: 'profitCenterShipStoreType', label: 'Ship Store' },
                        { key: 'profitCenterParts', typeKey: 'profitCenterPartsType', label: 'Parts' },
                        { key: 'profitCenterBoatSales', typeKey: 'profitCenterBoatSalesType', label: 'Boat Sales' },
                        { key: 'profitCenterFnb', typeKey: 'profitCenterFnbType', label: 'F&B' },
                        { key: 'profitCenterHospitality', typeKey: 'profitCenterHospitalityType', label: 'Hospitality/Accommodations' },
                      ].map((profitCenter) => (
                        <div key={profitCenter.key} className="space-y-2">
                          <FormField
                            control={form.control}
                            name={profitCenter.key as keyof CompFormData}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value === true}
                                    onCheckedChange={(checked) => field.onChange(checked === true)}
                                    data-testid={`checkbox-${profitCenter.key.toLowerCase()}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {profitCenter.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                          {form.watch(profitCenter.key as keyof CompFormData) && (
                            <div className="ml-6">
                              <FormField
                                control={form.control}
                                name={profitCenter.typeKey as keyof CompFormData}
                                render={({ field }) => (
                                  <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                      <FormControl>
                                        <SelectTrigger className="w-40" data-testid={`select-${profitCenter.typeKey.toLowerCase()}`}>
                                          <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="none">Select type</SelectItem>
                                        <SelectItem value="in-house">In-House</SelectItem>
                                        <SelectItem value="leased">Leased</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Boat Club with special In-House/Third-Party selector and company name */}
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="profitCenterBoatClub"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value === true}
                                  onCheckedChange={(checked) => field.onChange(checked === true)}
                                  data-testid="checkbox-profitcenterboatclub"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Boat Club
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        {form.watch('profitCenterBoatClub') && (
                          <div className="ml-6 space-y-3">
                            <FormField
                              control={form.control}
                              name="profitCenterBoatClubType"
                              render={({ field }) => (
                                <FormItem>
                                  <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                    <FormControl>
                                      <SelectTrigger className="w-40" data-testid="select-profitcenterboatclubtype">
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">Select type</SelectItem>
                                      <SelectItem value="in-house">In-House</SelectItem>
                                      <SelectItem value="third-party">Third-Party</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            {form.watch('profitCenterBoatClubType') === 'third-party' && (
                              <FormField
                                control={form.control}
                                name="profitCenterBoatClubCompany"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Company Name</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="Enter company name"
                                        className="w-64"
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes & Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes & Documentation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Article URLs</Label>
                    <div className="space-y-2 mt-2">
                      {articleUrls.map((url, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={url}
                            onChange={(e) => updateArticleUrl(index, e.target.value)}
                            placeholder="https://example.com/article"
                            data-testid={`input-article-url-${index}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeArticleUrl(index)}
                            data-testid={`button-remove-article-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addArticleUrl}
                        data-testid="button-add-article-url"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add URL
                      </Button>
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="Marina was recently renovated with new docks and electrical systems..."
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </form>
          </Form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending
                  ? isEdit ? 'Updating...' : 'Creating...'
                  : isEdit ? 'Update Comp' : 'Create Comp'
                }
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* New Portfolio Dialog */}
      <Dialog open={showNewPortfolioDialog} onOpenChange={setShowNewPortfolioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="portfolio-name">Portfolio Name *</Label>
              <Input
                id="portfolio-name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="Enter portfolio name..."
                data-testid="input-new-portfolio-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewPortfolioDialog(false);
                setNewPortfolioName("");
              }}
              data-testid="button-cancel-new-portfolio"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newPortfolioName.trim()) {
                  createPortfolioMutation.mutate(newPortfolioName.trim());
                }
              }}
              disabled={!newPortfolioName.trim() || createPortfolioMutation.isPending}
              data-testid="button-create-portfolio"
            >
              {createPortfolioMutation.isPending ? "Creating..." : "Create Portfolio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Prompt Modal - shows after creating a sales comp with seller info */}
      {createdCompId && (
        <ArchivePromptModal
          open={showArchivePrompt}
          onOpenChange={(open) => {
            setShowArchivePrompt(open);
            if (!open) {
              setCreatedCompId(null);
              onClose();
            }
          }}
          salesCompId={createdCompId}
          onComplete={() => {
            setShowArchivePrompt(false);
            setCreatedCompId(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}

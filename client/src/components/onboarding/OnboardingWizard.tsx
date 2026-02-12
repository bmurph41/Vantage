import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AddressAutocompleteInput, type NormalizedAddress } from "@/components/ui/address-autocomplete-input";
import { US_REGIONS } from "@shared/salescomps-constants";
import { 
  Building2, 
  Anchor, 
  Users, 
  FileText, 
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Target,
  ClipboardList,
  Briefcase,
  Store,
  Fuel,
  Layers,
  Plus,
  Trash2,
  Warehouse,
  Ship,
  Waves,
  MapPin,
  Car,
  Home,
  Wrench,
  ShoppingCart,
  Upload,
  X,
  FileSpreadsheet,
  Loader2,
  Container,
  Sailboat,
  Utensils
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type WizardMode = "onboarding" | "new_project";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  mode?: WizardMode;
  onProjectCreated?: (projectId: string) => void;
}

type DealType = "acquisition" | "refinance" | "owned_marina" | null;
type DealStructure = "single" | "portfolio" | null;

interface MarinaAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface PortfolioMarina {
  name: string;
  address: MarinaAddress;
}

const emptyAddress: MarinaAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
};

type DealStatus = "active" | "won" | "lost" | "passed" | "under_review";

interface WizardStorageType {
  id: string;
  name: string;
  section: 'storage' | 'designated';
  isEnabled: boolean;
  count: string;
  occupancy: string;
  iconName: string;
}

interface WizardProfitCenter {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  iconName: string;
}

type DocTypeEnum = "pnl" | "rent_roll" | "balance_sheet" | "rate_sheet" | "invoice" | "other";

interface WizardStagedFile {
  id: string;
  file: File;
  docType: DocTypeEnum;
  year: string;
  status: "pending" | "uploading" | "complete" | "error";
}

const WIZARD_DOC_TYPES: Record<DocTypeEnum, string> = {
  pnl: "P&L Statement",
  rent_roll: "Rent Roll",
  balance_sheet: "Balance Sheet",
  rate_sheet: "Rate Sheet",
  invoice: "Invoice",
  other: "Other",
};

function guessDocType(filename: string): DocTypeEnum {
  const lower = filename.toLowerCase();
  if (lower.includes("p&l") || lower.includes("pnl") || lower.includes("profit") || lower.includes("income")) return "pnl";
  if (lower.includes("rent") || lower.includes("roll") || lower.includes("tenant")) return "rent_roll";
  if (lower.includes("balance")) return "balance_sheet";
  if (lower.includes("rate")) return "rate_sheet";
  if (lower.includes("invoice")) return "invoice";
  return "other";
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureCsrfToken(): Promise<string> {
  let token = getCsrfToken();
  if (!token) {
    await fetch('/api/auth/me', { credentials: 'include' });
    token = getCsrfToken();
  }
  return token;
}

const defaultWizardStorageTypes: WizardStorageType[] = [
  { id: 'wet_slips', name: 'Wet Slips', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'anchor' },
  { id: 'lift_slips', name: 'Lift Slips', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'waves' },
  { id: 'moorings', name: 'Moorings', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'anchor' },
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'warehouse' },
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'container' },
  { id: 'land_storage', name: 'Land Storage', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'mappin' },
  { id: 'boats_on_trailers', name: 'Boats on Trailers', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'ship' },
  { id: 'trailers', name: 'Trailers', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'car' },
  { id: 'houseboats', name: 'Houseboats', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'home' },
  { id: 'rv_sites', name: 'RV Sites', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'car' },
];

const defaultWizardDesignatedSpaces: WizardStorageType[] = [
  { id: 'transient_slips', name: 'Transient Slips', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'anchor' },
  { id: 'commercial_spaces', name: 'Commercial Tenant Spaces', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'building' },
  { id: 'service_bays', name: 'Service Bays', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'wrench' },
  { id: 'fuel_pumps', name: 'Fuel Pumps / Dispensers', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'fuel' },
  { id: 'rental_fleet', name: 'Rental Fleet Spaces', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'ship' },
  { id: 'launch_ramps', name: 'Launch Ramps', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'waves' },
  { id: 'pump_out_stations', name: 'Pump-Out Stations', section: 'designated', isEnabled: false, count: '', occupancy: '', iconName: 'anchor' },
];

const defaultWizardProfitCenters: WizardProfitCenter[] = [
  { id: 'storage', name: 'Storage', description: 'Wet slips, dry storage, moorings, and other boat storage revenue', isEnabled: false, iconName: 'warehouse' },
  { id: 'fuel', name: 'Fuel Sales', description: 'Gasoline, diesel, and other fuel sales at the fuel dock', isEnabled: false, iconName: 'fuel' },
  { id: 'ship_store', name: "Ship's Store", description: 'Retail merchandise, boating supplies, snacks, and convenience items', isEnabled: false, iconName: 'shoppingcart' },
  { id: 'service', name: 'Service & Repairs', description: 'Boat maintenance, engine repair, detailing, and winterization', isEnabled: false, iconName: 'wrench' },
  { id: 'boat_sales', name: 'Boat Sales / Brokerage', description: 'New or used boat sales and brokerage commissions', isEnabled: false, iconName: 'store' },
  { id: 'boat_rentals', name: 'Boat Rentals', description: 'Rental fleet income from kayaks, pontoons, jet skis, etc.', isEnabled: false, iconName: 'sailboat' },
  { id: 'boat_club', name: 'Boat Club', description: 'Membership-based boat club with recurring fees', isEnabled: false, iconName: 'users' },
  { id: 'commercial_tenants', name: 'Commercial Tenants', description: 'Leased spaces to restaurants, shops, or other businesses', isEnabled: false, iconName: 'building' },
  { id: 'restaurant', name: 'Restaurant / F&B', description: 'On-site food & beverage operations or concessions', isEnabled: false, iconName: 'utensils' },
  { id: 'transient', name: 'Transient Dockage', description: 'Short-term or overnight slip rentals for visiting boaters', isEnabled: false, iconName: 'anchor' },
  { id: 'launch_ramp', name: 'Launch Ramp', description: 'Public or private boat launch with per-use or seasonal fees', isEnabled: false, iconName: 'waves' },
  { id: 'pump_out', name: 'Pump-Out Services', description: 'Waste pump-out station fees and services', isEnabled: false, iconName: 'anchor' },
  { id: 'electric_shore_power', name: 'Electric / Shore Power', description: 'Metered or flat-rate electrical hookup fees for docked vessels', isEnabled: false, iconName: 'fuel' },
  { id: 'water_hookup', name: 'Water Hookup', description: 'Metered or flat-rate water supply fees for docked vessels', isEnabled: false, iconName: 'waves' },
  { id: 'wifi_cable', name: 'Wi-Fi / Cable', description: 'Internet and cable TV service fees for slip holders', isEnabled: false, iconName: 'building' },
  { id: 'parking', name: 'Parking', description: 'Vehicle parking fees for slip holders and visitors', isEnabled: false, iconName: 'car' },
  { id: 'laundry', name: 'Laundry / Showers', description: 'Coin-operated laundry, shower, and restroom facility fees', isEnabled: false, iconName: 'home' },
  { id: 'ice', name: 'Ice Sales', description: 'Block and bag ice vending for boaters', isEnabled: false, iconName: 'container' },
  { id: 'event_venue', name: 'Event Venue', description: 'Facility rental for weddings, corporate events, and gatherings', isEnabled: false, iconName: 'building' },
  { id: 'charter_tours', name: 'Charters / Tours', description: 'Fishing charters, sunset cruises, and sightseeing tours', isEnabled: false, iconName: 'sailboat' },
  { id: 'sailing_school', name: 'Sailing / Boating School', description: 'Boating education, sailing lessons, and certification courses', isEnabled: false, iconName: 'sailboat' },
  { id: 'boat_detailing', name: 'Boat Detailing / Cleaning', description: 'Hull cleaning, waxing, bottom painting, and cosmetic services', isEnabled: false, iconName: 'wrench' },
  { id: 'haul_out', name: 'Haul-Out / Travel Lift', description: 'Boat haul-out, launch, and travel lift services', isEnabled: false, iconName: 'container' },
  { id: 'winter_storage', name: 'Winterization / Shrink Wrap', description: 'Seasonal winterization, shrink wrapping, and decommissioning', isEnabled: false, iconName: 'warehouse' },
  { id: 'bait_tackle', name: 'Bait & Tackle', description: 'Live bait, tackle, and fishing supply sales', isEnabled: false, iconName: 'anchor' },
  { id: 'membership_fees', name: 'Membership / Association Fees', description: 'Annual or monthly membership dues, yacht club fees', isEnabled: false, iconName: 'users' },
  { id: 'insurance_commissions', name: 'Insurance Commissions', description: 'Commissions from marine insurance referrals or in-house policies', isEnabled: false, iconName: 'store' },
  { id: 'towing_salvage', name: 'Towing / Salvage', description: 'On-water towing assistance and salvage operations', isEnabled: false, iconName: 'ship' },
];

function getStorageIcon(iconName: string) {
  const iconMap: Record<string, typeof Anchor> = {
    anchor: Anchor, waves: Waves, warehouse: Warehouse, container: Container,
    mappin: MapPin, ship: Ship, car: Car, home: Home, fuel: Fuel,
    shoppingcart: ShoppingCart, wrench: Wrench, store: Store, building: Building2,
    utensils: Utensils, users: Users, sailboat: Sailboat,
  };
  const Icon = iconMap[iconName] || Anchor;
  return <Icon className="h-4 w-4" />;
}

interface WizardState {
  step: number;
  dealStructure: DealStructure;
  marinaName: string;
  marinaAddress: MarinaAddress;
  dealType: DealType;
  region: string;
  dealStatus: DealStatus;
  portfolioName: string;
  portfolioMarinas: PortfolioMarina[];
  featuresToExplore: string[];
  profitCenters: WizardProfitCenter[];
  storageTypes: WizardStorageType[];
  designatedSpaces: WizardStorageType[];
  stagedFiles: WizardStagedFile[];
}

const onboardingSteps = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "Deal Structure", icon: Layers },
  { id: 3, title: "Marina Details", icon: Anchor },
  { id: 4, title: "Deal Type", icon: Target },
  { id: 5, title: "Profit Centers", icon: Store },
  { id: 6, title: "Storage", icon: Warehouse },
  { id: 7, title: "Documents", icon: Upload },
  { id: 8, title: "Features", icon: ClipboardList },
  { id: 9, title: "Get Started", icon: Check },
];

const newProjectSteps = [
  { id: 1, title: "Deal Structure", icon: Layers },
  { id: 2, title: "Marina Details", icon: Anchor },
  { id: 3, title: "Deal Info", icon: Target },
  { id: 4, title: "Profit Centers", icon: Store },
  { id: 5, title: "Storage", icon: Warehouse },
  { id: 6, title: "Documents", icon: Upload },
];

const dealStructures = [
  {
    id: "single",
    name: "Single Marina",
    description: "One marina being evaluated or managed",
    icon: Anchor,
  },
  {
    id: "portfolio",
    name: "Portfolio Deal",
    description: "Multiple marinas being evaluated as one deal",
    icon: Layers,
  },
];

const dealTypes = [
  {
    id: "acquisition",
    name: "New Acquisition",
    description: "Evaluating a marina to potentially purchase",
    icon: Briefcase,
  },
  {
    id: "refinance",
    name: "Refinance/Revaluation",
    description: "Refinancing or updating valuation of owned asset",
    icon: TrendingUp,
  },
  {
    id: "owned_marina",
    name: "Owned Marina",
    description: "Managing an existing marina in your portfolio",
    icon: Anchor,
  },
];

const features = [
  { id: "crm", name: "CRM & Leads", description: "Track deals and contacts", icon: Users },
  { id: "dd", name: "Due Diligence", description: "Manage DD checklists", icon: ClipboardList },
  { id: "modeling", name: "Financial Model", description: "Financial modeling", icon: TrendingUp },
  { id: "operations", name: "Operations", description: "Manage marina ops", icon: Store },
  { id: "fuel", name: "Fuel Sales", description: "Track fuel revenue", icon: Fuel },
  { id: "documents", name: "Documents", description: "Virtual data room", icon: FileText },
];

export function OnboardingWizard({ open, onOpenChange, userName, mode = "onboarding", onProjectCreated }: OnboardingWizardProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const steps = mode === "new_project" ? newProjectSteps : onboardingSteps;
  const totalSteps = steps.length;
  
  const [state, setState] = useState<WizardState>({
    step: 1,
    dealStructure: mode === "new_project" ? "single" : null,
    marinaName: "",
    marinaAddress: { ...emptyAddress },
    dealType: mode === "new_project" ? "acquisition" : null,
    region: "",
    dealStatus: "active",
    portfolioName: "",
    portfolioMarinas: [{ name: "", address: { ...emptyAddress } }],
    featuresToExplore: [],
    profitCenters: defaultWizardProfitCenters.map(p => ({ ...p })),
    storageTypes: defaultWizardStorageTypes.map(s => ({ ...s })),
    designatedSpaces: defaultWizardDesignatedSpaces.map(s => ({ ...s })),
    stagedFiles: [],
  });

  async function saveStorageConfig(projectId: string) {
    try {
      const departments: Record<string, { seasons: string[]; isEnabled: boolean; section: string; count?: number; occupancy?: number }> = {};
      [...state.storageTypes, ...state.designatedSpaces].forEach(item => {
        if (item.isEnabled) {
          departments[item.id] = {
            seasons: ['seasonal'],
            isEnabled: true,
            section: item.section,
            ...(item.count ? { count: parseInt(item.count) || 0 } : {}),
            ...(item.occupancy ? { occupancy: parseInt(item.occupancy) || 0 } : {}),
          };
        }
      });
      const profitCenters = state.profitCenters
        .filter(pc => pc.isEnabled)
        .map(pc => pc.id);
      const hasData = Object.keys(departments).length > 0 || profitCenters.length > 0;
      if (hasData) {
        await apiRequest('POST', `/api/modeling/projects/${projectId}/config`, { departments, profitCenters });
      }
    } catch (e) {
      console.warn('Storage config save failed (non-blocking):', e);
    }
  }

  async function uploadStagedFiles(projectId: string) {
    const pendingFiles = state.stagedFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;
    
    try {
      const csrfToken = await ensureCsrfToken();
      for (const staged of pendingFiles) {
        try {
          const formData = new FormData();
          formData.append('file', staged.file);
          formData.append('docType', staged.docType);
          formData.append('year', staged.year);
          
          const headers: Record<string, string> = {};
          if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
          
          await fetch(`/api/modeling/projects/${projectId}/documents`, {
            method: 'POST',
            body: formData,
            headers,
            credentials: 'include',
          });
        } catch (e) {
          console.warn(`File upload failed for ${staged.file.name} (non-blocking):`, e);
        }
      }
    } catch (e) {
      console.warn('Document upload failed (non-blocking):', e);
    }
  }

  const createDealMutation = useMutation({
    mutationFn: async (data: {
      dealStructure: DealStructure;
      marinaName: string;
      marinaAddress: MarinaAddress;
      dealType: DealType;
      region: string;
      dealStatus: DealStatus;
      portfolioName: string;
      portfolioMarinas: PortfolioMarina[];
    }) => {
      if (data.dealStructure === "portfolio") {
        const validMarinas = data.portfolioMarinas.filter(m => m.name.trim() && m.address.city && m.address.state);
        if (validMarinas.length === 0) {
          throw new Error("Please add at least one marina with a name, city, and state");
        }
        
        const results = await Promise.all(
          validMarinas.map(async (marina) => {
            const projectRes = await apiRequest('POST', '/api/modeling/projects', {
              marinaName: marina.name,
              address: marina.address.line1,
              city: marina.address.city,
              state: marina.address.state,
              zipCode: marina.address.zip || undefined,
              region: data.region || undefined,
              dealOutcome: data.dealStatus || 'active',
              customMetrics: { dealType: data.dealType, portfolioName: data.portfolioName || 'Untitled Portfolio' },
            });
            const modelingProject = await projectRes.json();
            
            try {
              await apiRequest('POST', '/api/properties', {
                name: marina.name,
                address: marina.address.line1,
                city: marina.address.city,
                state: marina.address.state,
                zipCode: marina.address.zip,
                propertyType: 'marina',
                status: 'prospect',
              });
            } catch (e) {
              console.warn('CRM property creation failed (non-blocking):', e);
            }
            
            return { modelingProject };
          })
        );
        return results;
      } else {
        if (!data.marinaName.trim()) {
          throw new Error("Please provide a marina name");
        }
        
        const projectRes = await apiRequest('POST', '/api/modeling/projects', {
          marinaName: data.marinaName,
          address: data.marinaAddress.line1 || undefined,
          city: data.marinaAddress.city || undefined,
          state: data.marinaAddress.state || undefined,
          zipCode: data.marinaAddress.zip || undefined,
          region: data.region || undefined,
          dealOutcome: data.dealStatus || 'active',
          customMetrics: { dealType: data.dealType },
        });
        const modelingProject = await projectRes.json();
        
        try {
          await apiRequest('POST', '/api/properties', {
            name: data.marinaName,
            address: data.marinaAddress.line1,
            city: data.marinaAddress.city,
            state: data.marinaAddress.state,
            zipCode: data.marinaAddress.zip,
            propertyType: 'marina',
            status: 'prospect',
          });
        } catch (e) {
          console.warn('CRM property creation failed (non-blocking):', e);
        }
        
        return { modelingProject };
      }
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      
      const projectId = Array.isArray(result) 
        ? result[0]?.modelingProject?.id 
        : result?.modelingProject?.id;
      
      if (projectId) {
        await saveStorageConfig(projectId);
        await uploadStagedFiles(projectId);
        queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'config'] });
        queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
      }
      
      const isPortfolio = state.dealStructure === "portfolio";
      const projectCount = isPortfolio ? state.portfolioMarinas.filter(m => m.name.trim()).length : 1;
      const uploadCount = state.stagedFiles.filter(f => f.status === 'pending').length;
      toast({ 
        title: isPortfolio ? "Portfolio Created!" : "Project Created!", 
        description: isPortfolio 
          ? `${projectCount} marina${projectCount > 1 ? 's' : ''} added to CRM and Financial Model.`
          : `${state.marinaName} has been added.${uploadCount > 0 ? ` ${uploadCount} document${uploadCount > 1 ? 's' : ''} queued for AI processing.` : ''}` 
      });
      
      onOpenChange(false);
      
      if (projectId) {
        if (onProjectCreated) {
          onProjectCreated(projectId);
        } else {
          const targetTab = uploadCount > 0 ? 'uploads' : 'inputs';
          navigate(`/modeling/projects/${projectId}?tab=${targetTab}`);
        }
      }
      
      if (mode === "onboarding" && !projectId) {
        if (state.featuresToExplore.includes("modeling")) {
          navigate("/modeling/projects");
        } else if (state.featuresToExplore.includes("crm")) {
          navigate("/crm/deals");
        } else if (state.featuresToExplore.includes("dd")) {
          navigate("/due-diligence");
        } else {
          navigate("/");
        }
      }
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      const msg = error?.message || 'Unknown error';
      toast({ 
        title: "Error", 
        description: msg.includes('403') || msg.includes('CSRF')
          ? "Session expired. Please refresh the page and try again."
          : `Failed to create project: ${msg.substring(0, 100)}`, 
        variant: "destructive" 
      });
    }
  });

  const progress = (state.step / steps.length) * 100;

  const currentStepTitle = steps.find(s => s.id === state.step)?.title || '';

  function handleNext() {
    if (state.step < steps.length) {
      setState(s => ({ ...s, step: s.step + 1 }));
    }
  }

  function handleBack() {
    if (state.step > 1) {
      setState(s => ({ ...s, step: s.step - 1 }));
    }
  }

  function handleFinish() {
    const hasSingleDeal = state.dealStructure === "single" && state.marinaName.trim() && state.dealType;
    const hasPortfolio = state.dealStructure === "portfolio" && state.portfolioMarinas.some(m => m.name.trim()) && state.dealType;
    
    if (hasSingleDeal || hasPortfolio) {
      createDealMutation.mutate({
        dealStructure: state.dealStructure,
        marinaName: state.marinaName,
        marinaAddress: state.marinaAddress,
        dealType: state.dealType,
        region: state.region,
        dealStatus: state.dealStatus,
        portfolioName: state.portfolioName,
        portfolioMarinas: state.portfolioMarinas,
      });
    } else {
      toast({
        title: "Missing Information",
        description: "Please provide a marina name and select a deal source.",
        variant: "destructive"
      });
    }
  }

  function addPortfolioMarina() {
    setState(s => ({
      ...s,
      portfolioMarinas: [...s.portfolioMarinas, { name: "", address: { ...emptyAddress } }]
    }));
  }

  function removePortfolioMarina(index: number) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.filter((_, i) => i !== index)
    }));
  }

  function updatePortfolioMarinaName(index: number, name: string) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.map((m, i) => 
        i === index ? { ...m, name } : m
      )
    }));
  }

  function updatePortfolioMarinaAddress(index: number, field: keyof MarinaAddress, value: string) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.map((m, i) => 
        i === index ? { ...m, address: { ...m.address, [field]: value } } : m
      )
    }));
  }

  function handleAddressAutocomplete(addr: NormalizedAddress, index?: number) {
    const newAddress: MarinaAddress = {
      line1: addr.line1 || "",
      line2: addr.line2 || "",
      city: addr.city || "",
      state: addr.state || "",
      zip: addr.postalCode || "",
      lat: addr.lat,
      lng: addr.lng,
      placeId: addr.placeId,
    };
    
    if (index !== undefined) {
      setState(s => ({
        ...s,
        portfolioMarinas: s.portfolioMarinas.map((m, i) => 
          i === index ? { ...m, address: newAddress } : m
        )
      }));
    } else {
      setState(s => ({ ...s, marinaAddress: newAddress }));
    }
  }

  function toggleFeature(featureId: string) {
    setState(s => ({
      ...s,
      featuresToExplore: s.featuresToExplore.includes(featureId)
        ? s.featuresToExplore.filter(f => f !== featureId)
        : [...s.featuresToExplore, featureId]
    }));
  }

  const [customProfitCenterName, setCustomProfitCenterName] = useState('');
  const [showAddProfitCenter, setShowAddProfitCenter] = useState(false);
  const [customStorageName, setCustomStorageName] = useState('');
  const [showAddStorage, setShowAddStorage] = useState(false);
  const [customDesignatedName, setCustomDesignatedName] = useState('');
  const [showAddDesignated, setShowAddDesignated] = useState(false);

  function addCustomProfitCenter() {
    const name = customProfitCenterName.trim();
    if (!name) return;
    const id = `custom_pc_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    if (state.profitCenters.some(pc => pc.id === id)) return;
    setState(s => ({
      ...s,
      profitCenters: [...s.profitCenters, {
        id, name, description: 'Custom profit center', isEnabled: true, iconName: 'store',
      }],
    }));
    setCustomProfitCenterName('');
    setShowAddProfitCenter(false);
  }

  function addCustomStorageType(list: 'storageTypes' | 'designatedSpaces', section: 'storage' | 'designated') {
    const rawName = list === 'storageTypes' ? customStorageName : customDesignatedName;
    const name = rawName.trim();
    if (!name) return;
    const id = `custom_${section}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    if (state[list].some(s => s.id === id)) return;
    setState(s => ({
      ...s,
      [list]: [...s[list], {
        id, name, section, isEnabled: true, count: '', occupancy: '', iconName: section === 'storage' ? 'ship' : 'wrench',
      }],
    }));
    if (list === 'storageTypes') { setCustomStorageName(''); setShowAddStorage(false); }
    else { setCustomDesignatedName(''); setShowAddDesignated(false); }
  }

  function toggleProfitCenter(id: string) {
    setState(s => ({
      ...s,
      profitCenters: s.profitCenters.map(pc =>
        pc.id === id ? { ...pc, isEnabled: !pc.isEnabled } : pc
      ),
    }));
  }

  function toggleStorageType(id: string, list: 'storageTypes' | 'designatedSpaces') {
    setState(s => ({
      ...s,
      [list]: s[list].map(item =>
        item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
      ),
    }));
  }

  function updateStorageField(id: string, list: 'storageTypes' | 'designatedSpaces', field: 'count' | 'occupancy', value: string) {
    setState(s => ({
      ...s,
      [list]: s[list].map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ['xlsx', 'xls', 'csv', 'pdf'].includes(ext || '');
    });
    addStagedFiles(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addStagedFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  }

  function addStagedFiles(files: File[]) {
    const newFiles: WizardStagedFile[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      docType: guessDocType(file.name),
      year: new Date().getFullYear().toString(),
      status: 'pending',
    }));
    setState(s => ({ ...s, stagedFiles: [...s.stagedFiles, ...newFiles] }));
  }

  function removeStagedFile(id: string) {
    setState(s => ({ ...s, stagedFiles: s.stagedFiles.filter(f => f.id !== id) }));
  }

  function updateStagedFileField(id: string, field: 'docType' | 'year', value: string) {
    setState(s => ({
      ...s,
      stagedFiles: s.stagedFiles.map(f =>
        f.id === id ? { ...f, [field]: value } : f
      ),
    }));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  const getStepContent = () => {
    if (mode === "new_project") {
      return {
        1: renderDealStructureStep(),
        2: renderMarinaDetailsStep(),
        3: renderDealInfoStep(),
        4: renderProfitCentersStep(),
        5: renderStorageTypesStep(),
        6: renderDocumentUploadStep(),
      }[state.step];
    }
    return {
      1: renderWelcomeStep(),
      2: renderDealStructureStep(),
      3: renderMarinaDetailsStep(),
      4: renderDealTypeStep(),
      5: renderProfitCentersStep(),
      6: renderStorageTypesStep(),
      7: renderDocumentUploadStep(),
      8: renderFeaturesStep(),
      9: renderGetStartedStep(),
    }[state.step];
  };

  const renderWelcomeStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#1E4FAB]/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-[#1E4FAB]" />
      </div>
      <div>
        <h3 className="text-xl font-semibold">
          Welcome{userName ? `, ${userName}` : ''}!
        </h3>
        <p className="text-muted-foreground mt-2">
          Let's get you set up with MarinaMatch, your all-in-one platform for 
          marina acquisitions and portfolio management.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <Building2 className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
          <p className="text-sm font-medium">CRM & Pipeline</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <TrendingUp className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
          <p className="text-sm font-medium">Financial Model</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <ClipboardList className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
          <p className="text-sm font-medium">Due Diligence</p>
        </div>
      </div>
    </div>
  );

  const renderDealStructureStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of deal are you working on?</h3>
        <p className="text-sm text-muted-foreground">
          Choose between a single marina or a portfolio of assets
        </p>
      </div>
      <RadioGroup
        value={state.dealStructure || ""}
        onValueChange={(value) => setState(s => ({ ...s, dealStructure: value as DealStructure }))}
        className="space-y-3"
      >
        {dealStructures.map((structure) => (
          <div
            key={structure.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
              state.dealStructure === structure.id 
                ? "border-[#1E4FAB] bg-[#1E4FAB]/5" 
                : "hover:bg-muted/50"
            )}
            onClick={() => setState(s => ({ ...s, dealStructure: structure.id as DealStructure }))}
          >
            <RadioGroupItem value={structure.id} id={`structure-${structure.id}`} />
            <div className="p-2 rounded-lg bg-muted">
              <structure.icon className="h-5 w-5 text-[#1E4FAB]" />
            </div>
            <div className="flex-1">
              <Label htmlFor={`structure-${structure.id}`} className="font-medium cursor-pointer">
                {structure.name}
              </Label>
              <p className="text-sm text-muted-foreground">{structure.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderMarinaDetailsStep = () => {
    if (state.dealStructure === "portfolio") {
      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">Build your portfolio</h3>
            <p className="text-sm text-muted-foreground">Add the marinas in this deal</p>
          </div>
          <div className="space-y-2 mb-4">
            <Label htmlFor="portfolioName">Portfolio Name</Label>
            <Input
              id="portfolioName"
              placeholder="e.g., Gulf Coast Portfolio"
              value={state.portfolioName}
              onChange={(e) => setState(s => ({ ...s, portfolioName: e.target.value }))}
            />
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {state.portfolioMarinas.map((marina, index) => (
              <div key={index} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Marina {index + 1}</span>
                  {state.portfolioMarinas.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePortfolioMarina(index)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input placeholder="Marina name" value={marina.name} onChange={(e) => updatePortfolioMarinaName(index, e.target.value)} />
                <AddressAutocompleteInput value={marina.address.line1} placeholder="Address" onChangeText={(text) => updatePortfolioMarinaAddress(index, 'line1', text)} onSelectAddress={(addr) => handleAddressAutocomplete(addr, index)} searchType="address" />
                <Input placeholder="Address Line 2 (optional)" value={marina.address.line2} onChange={(e) => updatePortfolioMarinaAddress(index, 'line2', e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="City" value={marina.address.city} onChange={(e) => updatePortfolioMarinaAddress(index, 'city', e.target.value)} />
                  <Input placeholder="State" maxLength={2} value={marina.address.state} onChange={(e) => updatePortfolioMarinaAddress(index, 'state', e.target.value.toUpperCase())} />
                  <Input placeholder="Zip" maxLength={10} value={marina.address.zip} onChange={(e) => updatePortfolioMarinaAddress(index, 'zip', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addPortfolioMarina} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Marina
          </Button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Tell us about your marina</h3>
          <p className="text-sm text-muted-foreground">We'll create a CRM property and modeling project</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="marinaName">Marina Name <span className="text-destructive">*</span></Label>
            <Input id="marinaName" placeholder="e.g., Sunset Bay Marina" value={state.marinaName} onChange={(e) => setState(s => ({ ...s, marinaName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Address <span className="text-destructive">*</span></Label>
            <AddressAutocompleteInput value={state.marinaAddress.line1} placeholder="Start typing an address..." onChangeText={(text) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, line1: text } }))} onSelectAddress={(addr) => handleAddressAutocomplete(addr)} searchType="address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input id="addressLine2" placeholder="Suite, Unit, etc." value={state.marinaAddress.line2} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, line2: e.target.value } }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="City" value={state.marinaAddress.city} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, city: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="FL" maxLength={2} value={state.marinaAddress.state} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, state: e.target.value.toUpperCase() } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" placeholder="33139" maxLength={10} value={state.marinaAddress.zip} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, zip: e.target.value } }))} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDealTypeStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of deal is this?</h3>
        <p className="text-sm text-muted-foreground">This helps us tailor your experience</p>
      </div>
      <RadioGroup value={state.dealType || ""} onValueChange={(value) => setState(s => ({ ...s, dealType: value as DealType }))} className="space-y-3">
        {dealTypes.map((type) => (
          <div key={type.id} className={cn("flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors", state.dealType === type.id ? "border-[#1E4FAB] bg-[#1E4FAB]/5" : "hover:bg-muted/50")} onClick={() => setState(s => ({ ...s, dealType: type.id as DealType }))}>
            <RadioGroupItem value={type.id} id={type.id} />
            <div className="p-2 rounded-lg bg-muted"><type.icon className="h-5 w-5 text-[#1E4FAB]" /></div>
            <div className="flex-1">
              <Label htmlFor={type.id} className="font-medium cursor-pointer">{type.name}</Label>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderFeaturesStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What would you like to explore?</h3>
        <p className="text-sm text-muted-foreground">Select the features you're most interested in</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature) => (
          <button key={feature.id} onClick={() => toggleFeature(feature.id)} className={cn("flex items-center gap-3 p-3 rounded-lg border text-left transition-colors", state.featuresToExplore.includes(feature.id) ? "border-[#1E4FAB] bg-[#1E4FAB]/5" : "hover:bg-muted/50")}>
            <div className={cn("p-2 rounded-lg", state.featuresToExplore.includes(feature.id) ? "bg-[#1E4FAB] text-white" : "bg-muted")}>
              <feature.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-sm">{feature.name}</p>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
            {state.featuresToExplore.includes(feature.id) && <Check className="h-4 w-4 text-[#1E4FAB] ml-auto" />}
          </button>
        ))}
      </div>
    </div>
  );

  const renderGetStartedStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h3 className="text-xl font-semibold">You're all set!</h3>
        <p className="text-muted-foreground mt-2">
          {state.dealStructure === "portfolio" 
            ? `We'll create "${state.portfolioName || 'Untitled Portfolio'}" with ${state.portfolioMarinas.filter(m => m.name.trim()).length} marina${state.portfolioMarinas.filter(m => m.name.trim()).length > 1 ? 's' : ''}.`
            : state.marinaName 
              ? `We'll create "${state.marinaName}" as your first project.`
              : "You can create projects anytime from the Modeling page."}
        </p>
      </div>
      {state.featuresToExplore.length > 0 && (
        <div className="pt-4">
          <p className="text-sm text-muted-foreground mb-2">We'll take you to:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {state.featuresToExplore.map((id) => {
              const feature = features.find(f => f.id === id);
              return feature ? (
                <Badge key={id} variant="secondary" className="gap-1">
                  <feature.icon className="h-3 w-3" />
                  {feature.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderProfitCentersStep = () => {
    const enabledCount = state.profitCenters.filter(pc => pc.isEnabled).length;

    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">Profit Centers</h3>
          <p className="text-sm text-muted-foreground">
            Which revenue sources does this marina have? Check all that apply.
          </p>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="mt-2">{enabledCount} selected</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {state.profitCenters.map((pc) => (
            <button
              key={pc.id}
              type="button"
              onClick={() => toggleProfitCenter(pc.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                pc.isEnabled
                  ? "border-[#1E4FAB]/40 bg-[#1E4FAB]/5 ring-1 ring-[#1E4FAB]/20"
                  : "border-muted bg-muted/20 hover:bg-muted/40"
              )}
            >
              <div className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                pc.isEnabled ? "bg-[#1E4FAB] border-[#1E4FAB] text-white" : "border-muted-foreground/30"
              )}>
                {pc.isEnabled && <Check className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{getStorageIcon(pc.iconName)}</span>
                  <span className="text-sm font-medium">{pc.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pc.description}</p>
              </div>
            </button>
          ))}
        </div>
        {showAddProfitCenter ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. Kayak Tours"
              value={customProfitCenterName}
              onChange={(e) => setCustomProfitCenterName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomProfitCenter()}
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button size="sm" className="h-8 bg-[#1E4FAB] hover:bg-[#1a4294]" onClick={addCustomProfitCenter} disabled={!customProfitCenterName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowAddProfitCenter(false); setCustomProfitCenterName(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddProfitCenter(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Profit Center
          </Button>
        )}
        <p className="text-xs text-center text-muted-foreground">
          This helps us set up the right revenue categories for your financial model.
        </p>
      </div>
    );
  };

  const renderStorageTypesStep = () => {
    const renderStorageItems = (items: WizardStorageType[], listKey: 'storageTypes' | 'designatedSpaces') => (
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className={cn(
            "rounded-lg border px-3 py-2 transition-colors",
            item.isEnabled ? "border-[#1E4FAB]/30 bg-[#1E4FAB]/5" : "border-transparent bg-muted/30"
          )}>
            <div className="flex items-center gap-3">
              <Switch
                checked={item.isEnabled}
                onCheckedChange={() => toggleStorageType(item.id, listKey)}
                className="scale-90"
              />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-muted-foreground">{getStorageIcon(item.iconName)}</span>
                <span className="text-sm font-medium truncate">{item.name}</span>
              </div>
              {item.isEnabled && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Count"
                    value={item.count}
                    onChange={(e) => updateStorageField(item.id, listKey, 'count', e.target.value)}
                    className="h-7 w-20 text-xs"
                    type="number"
                  />
                  <Input
                    placeholder="Occ %"
                    value={item.occupancy}
                    onChange={(e) => updateStorageField(item.id, listKey, 'occupancy', e.target.value)}
                    className="h-7 w-20 text-xs"
                    type="number"
                    max={100}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );

    const renderAddRow = (
      show: boolean,
      setShow: (v: boolean) => void,
      value: string,
      setValue: (v: string) => void,
      listKey: 'storageTypes' | 'designatedSpaces',
      section: 'storage' | 'designated',
      label: string
    ) => show ? (
      <div className="flex items-center gap-2 mt-1.5">
        <Input
          placeholder={`e.g. ${section === 'storage' ? 'Jet Ski Lifts' : 'Loading Dock'}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomStorageType(listKey, section)}
          className="h-7 text-xs flex-1"
          autoFocus
        />
        <Button size="sm" className="h-7 text-xs bg-[#1E4FAB] hover:bg-[#1a4294] px-2" onClick={() => addCustomStorageType(listKey, section)} disabled={!value.trim()}>
          Add
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setShow(false); setValue(''); }}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex items-center gap-1 text-xs text-[#1E4FAB] hover:text-[#1a4294] mt-1.5 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add {label}
      </button>
    );

    const enabledCount = [...state.storageTypes, ...state.designatedSpaces].filter(s => s.isEnabled).length;

    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">Storage & Spaces</h3>
          <p className="text-sm text-muted-foreground">
            What types of boat storage does this marina offer? Add counts and occupancy if known.
          </p>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="mt-2">{enabledCount} selected</Badge>
          )}
        </div>
        <div className="max-h-[350px] overflow-y-auto pr-1 space-y-4">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Boat Storage</p>
              <p className="text-xs text-muted-foreground">Primary storage options for boats and vessels</p>
            </div>
            {renderStorageItems(state.storageTypes, 'storageTypes')}
            {renderAddRow(showAddStorage, setShowAddStorage, customStorageName, setCustomStorageName, 'storageTypes', 'storage', 'Storage Type')}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Designated Spaces</p>
              <p className="text-xs text-muted-foreground">Physical spaces allocated to specific operations (e.g. Service uses 5 bays, Fuel has 3 pumps)</p>
            </div>
            {renderStorageItems(state.designatedSpaces, 'designatedSpaces')}
            {renderAddRow(showAddDesignated, setShowAddDesignated, customDesignatedName, setCustomDesignatedName, 'designatedSpaces', 'designated', 'Designated Space')}
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          You can always update this later in your project's Inputs tab.
        </p>
      </div>
    );
  };

  const renderDocumentUploadStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Upload Documents</h3>
        <p className="text-sm text-muted-foreground">
          Upload P&L statements, rent rolls, or other financials. They'll be auto-processed by AI when your project is created.
        </p>
      </div>

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          "hover:border-[#1E4FAB]/50 hover:bg-[#1E4FAB]/5"
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => document.getElementById('wizard-file-input')?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          Excel (.xlsx, .xls), CSV, or PDF - up to 50MB each
        </p>
        <input
          id="wizard-file-input"
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {state.stagedFiles.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
          {state.stagedFiles.map((staged) => (
            <div key={staged.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
              <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{staged.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(staged.file.size)}</p>
              </div>
              <Select value={staged.docType} onValueChange={(v) => updateStagedFileField(staged.id, 'docType', v)}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WIZARD_DOC_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={staged.year} onValueChange={(v) => updateStagedFileField(staged.id, 'year', v)}>
                <SelectTrigger className="h-7 w-[80px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeStagedFile(staged.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {state.stagedFiles.length === 0 && (
        <p className="text-xs text-center text-muted-foreground">
          No documents yet. You can skip this step and upload later.
        </p>
      )}
    </div>
  );

  const renderDealInfoStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Deal Details</h3>
        <p className="text-sm text-muted-foreground">Configure your deal settings</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Deal Source <span className="text-destructive">*</span></Label>
          <Select value={state.dealType || undefined} onValueChange={(value) => setState(s => ({ ...s, dealType: value as DealType }))}>
            <SelectTrigger><SelectValue placeholder="Select deal source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="acquisition">New Acquisition</SelectItem>
              <SelectItem value="refinance">Refinance/Revaluation</SelectItem>
              <SelectItem value="owned_marina">Owned Marina</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Region <span className="text-destructive">*</span></Label>
          <Select value={state.region || undefined} onValueChange={(value) => setState(s => ({ ...s, region: value }))}>
            <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
            <SelectContent>
              {US_REGIONS.map((region) => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Deal Status <span className="text-destructive">*</span></Label>
          <Select value={state.dealStatus} onValueChange={(value) => setState(s => ({ ...s, dealStatus: value as DealStatus }))}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-[#1E4FAB]" />
              {mode === "new_project" ? "New Project" : "MarinaMatch Setup"}
            </DialogTitle>
            <div className="flex items-center gap-1.5 mr-6 -mt-1">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-colors border",
                    state.step >= s.id
                      ? "bg-[#1E4FAB] border-[#1E4FAB]"
                      : "bg-transparent border-[#1E4FAB]/30"
                  )}
                />
              ))}
            </div>
          </div>
          <Progress value={progress} className="h-1" />
          {mode === "new_project" && (
            <DialogDescription className="text-sm text-muted-foreground">
              Add a new valuation/financial modeling project
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {getStepContent()}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={state.step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            {state.step < steps.length ? (
              <Button onClick={handleNext} className="bg-[#1E4FAB] hover:bg-[#1a4294]">
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleFinish} 
                className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                disabled={createDealMutation.isPending}
              >
                {createDealMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : "Get Started"}
                {!createDealMutation.isPending && <ChevronRight className="h-4 w-4 ml-2" />}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

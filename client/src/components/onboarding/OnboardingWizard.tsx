import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { PROFIT_CENTER_CATALOG, AMENITY_CATALOG } from '@shared/marina-catalog';
import { getAssetClassCatalog } from '@shared/asset-class-catalog';
import { getWizardConfig, getDocumentTypesForAsset } from '@shared/wizard-enhancement-config';
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
  Utensils,
  AlertTriangle,
  LandPlot,
  KeyRound,
  ChevronDown,
  Box,
  BarChart3
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
type WizardAssetClass = "marina" | "multifamily" | "retail" | "office" | "industrial" | "self_storage" | "mixed_use" | "hotel" | "str" | "sfr" | "duplex" | "triplex" | "quad" | "laundromat" | "medical_office" | "business" | null;

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

interface WizardAmenity {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  iconName: string;
}

// Widened to string to support asset-class-specific doc types from wizard config
type DocTypeEnum = string;

interface WizardStagedFile {
  id: string;
  file: File;
  docType: DocTypeEnum;
  year: string;
  t12StartMonth?: string;
  t12StartYear?: string;
  t12EndMonth?: string;
  t12EndYear?: string;
  status: "pending" | "uploading" | "complete" | "error";
}

const WIZARD_DOC_TYPES: Record<DocTypeEnum, string> = {
  pnl: "P&L Statement",
  t12: "T12",
  rent_roll: "Rent Roll",
  balance_sheet: "Balance Sheet",
  rate_sheet: "Rate Sheet",
  invoice: "Invoice",
  other: "Other",
};

const WIZARD_DOC_TYPES_NO_T12 = Object.fromEntries(
  Object.entries(WIZARD_DOC_TYPES).filter(([k]) => k !== 't12')
) as Record<Exclude<DocTypeEnum, 't12'>, string>;

const MONTH_OPTIONS = [
  { value: '1', label: 'Jan' }, { value: '2', label: 'Feb' }, { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' }, { value: '5', label: 'May' }, { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' }, { value: '8', label: 'Aug' }, { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
];

function guessDocType(filename: string): DocTypeEnum {
  const lower = filename.toLowerCase();
  if (lower.includes("t12") || lower.includes("trailing")) return "t12";
  if (lower.includes("p&l") || lower.includes("pnl") || lower.includes("profit") || lower.includes("income")) return "pnl";
  if (lower.includes("rent") || lower.includes("roll") || lower.includes("tenant")) return "rent_roll";
  if (lower.includes("balance")) return "balance_sheet";
  if (lower.includes("rate")) return "rate_sheet";
  if (lower.includes("invoice")) return "invoice";
  if (lower.includes("payout") || lower.includes("airbnb") || lower.includes("vrbo")) return "payout";
  if (lower.includes("occupancy") || lower.includes("occ")) return "occupancy";
  if (lower.includes("operating") || lower.includes("ops")) return "operating_statement";
  if (lower.includes("lease") || lower.includes("abstract")) return "lease_abstract";
  if (lower.includes("cam") || lower.includes("reconcil")) return "cam_reconciliation";
  if (lower.includes("tax return") || lower.includes("schedule e") || lower.includes("k-1") || lower.includes("k1")) return "tax_return";
  if (lower.includes("insurance") || lower.includes("declaration")) return "insurance";
  if (lower.includes("property tax") || lower.includes("tax bill")) return "property_tax";
  if (lower.includes("appraisal")) return "appraisal";
  if (lower.includes("environment") || lower.includes("phase i") || lower.includes("phase ii")) return "environmental";
  if (lower.includes("fuel")) return "fuel_sales";
  if (lower.includes("wash") || lower.includes("machine")) return "wash_count";
  if (lower.includes("smith travel") || lower.includes("str report")) return "smith_travel";
  if (lower.includes("franchise")) return "franchise";
  if (lower.includes("debt") || lower.includes("loan") || lower.includes("mortgage")) return "debt_schedule";
  if (lower.includes("capex") || lower.includes("capital")) return "capex_log";
  if (lower.includes("unit mix")) return "unit_mix";
  if (lower.includes("bank statement")) return "bank_statement";
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
  { id: 'liveaboards', name: 'Liveaboards', section: 'storage', isEnabled: false, count: '', occupancy: '', iconName: 'anchor' },
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

const defaultWizardProfitCenters: WizardProfitCenter[] = PROFIT_CENTER_CATALOG.map(pc => ({
  id: pc.id, name: pc.name, description: pc.description, isEnabled: false, iconName: pc.icon,
}));

const defaultWizardAmenities: WizardAmenity[] = AMENITY_CATALOG.map(a => ({
  id: a.id, name: a.name, description: a.description, isEnabled: false, iconName: a.icon,
}));

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

type OwnershipType = 'fee_simple' | 'submerged_land_lease' | 'ground_lease' | 'combined';

interface WizardLeaseDetail {
  id: string;
  type: 'submerged_land_lease' | 'ground_lease';
  counterparty: string;
  monthlyRent: string;
  annualRent: string;
  termRemaining: string;
  termUnit: 'years' | 'months';
  expirationDate: string;
  renewalOptions: string;
  notes: string;
}

interface WizardAcreage {
  totalAcres: string;
  uplandAcres: string;
  submergedAcres: string;
}

interface WizardOwnership {
  type: OwnershipType;
  leases: WizardLeaseDetail[];
}

interface WizardState {
  step: number;
  dealStructure: DealStructure;
  assetClass: WizardAssetClass;
  marinaName: string;
  marinaAddress: MarinaAddress;
  dealType: DealType;
  region: string;
  dealStatus: DealStatus;
  portfolioName: string;
  portfolioMarinas: PortfolioMarina[];
  featuresToExplore: string[];
  profitCenters: WizardProfitCenter[];
  amenities: WizardAmenity[];
  storageTypes: WizardStorageType[];
  designatedSpaces: WizardStorageType[];
  stagedFiles: WizardStagedFile[];
  acreage: WizardAcreage;
  propertySizeValues: Record<string, string>;
  buildings: Array<{ name: string; sizeValues: Record<string, string> }>;
  isMultiBuilding: boolean;
  ownership: WizardOwnership;
}

const MARINA_ONLY_STEPS = new Set(["Profit Centers", "Amenities", "Storage"]);

function getOnboardingSteps(assetClass: string | null) {
  const allSteps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Deal Structure", icon: Layers },
    { title: "Property Details", icon: Anchor },
    { title: "Deal Type", icon: Target },
    { title: "Profit Centers", icon: Store },
    { title: "Amenities", icon: ClipboardList },
    { title: "Storage", icon: Warehouse },
    { title: "Documents", icon: Upload },
    { title: "Features", icon: Sparkles },
    { title: "Get Started", icon: Check },
  ];
  const filtered = assetClass && assetClass !== 'marina'
    ? allSteps.filter(s => !MARINA_ONLY_STEPS.has(s.title))
    : allSteps;
  return filtered.map((s, i) => ({ ...s, id: i + 1 }));
}

function getNewProjectSteps(assetClass: string | null) {
  const allSteps = [
    { title: "Deal Structure", icon: Layers },
    { title: "Property Details", icon: Anchor },
    { title: "Deal Info", icon: Target },
    { title: "Profit Centers", icon: Store },
    { title: "Amenities", icon: ClipboardList },
    { title: "Storage", icon: Warehouse },
    { title: "Documents", icon: Upload },
  ];
  const filtered = assetClass && assetClass !== 'marina'
    ? allSteps.filter(s => !MARINA_ONLY_STEPS.has(s.title))
    : allSteps;
  return filtered.map((s, i) => ({ ...s, id: i + 1 }));
}

const dealStructures = [
  {
    id: "single",
    name: "Single Asset",
    description: "One property being evaluated or managed",
    icon: Building2,
  },
  {
    id: "portfolio",
    name: "Portfolio Deal",
    description: "Multiple properties being evaluated as one deal",
    icon: Layers,
  },
];

const wizardAssetClasses = [
  { id: "marina", name: "Marina", description: "Wet slips, dry storage, fuel docks", icon: Anchor, metric: "cap_rate" },
  { id: "multifamily", name: "Multifamily", description: "Apartments, condos, townhomes", icon: Home, metric: "cap_rate" },
  { id: "retail", name: "Retail", description: "Strip centers, NNN, shopping centers", icon: Store, metric: "cap_rate" },
  { id: "office", name: "Office", description: "Class A/B/C office buildings", icon: Building2, metric: "cap_rate" },
  { id: "industrial", name: "Industrial", description: "Warehouse, flex, distribution", icon: Warehouse, metric: "cap_rate" },
  { id: "self_storage", name: "Self-Storage", description: "Climate and non-climate units", icon: Box, metric: "cap_rate" },
  { id: "hotel", name: "Hotel / Hospitality", description: "Full service, limited service, boutique", icon: Building2, metric: "ebitda_multiple" },
  { id: "str", name: "Short-Term Rental", description: "Vacation rentals, Airbnb portfolios", icon: Home, metric: "grm" },
  { id: "medical_office", name: "Medical Office", description: "MOB, surgical centers, clinics", icon: Building2, metric: "cap_rate" },
  { id: "mixed_use", name: "Mixed-Use", description: "Retail + residential/office combo", icon: Layers, metric: "cap_rate" },
  { id: "laundromat", name: "Laundromat", description: "Coin-op and card-op laundry facilities", icon: Store, metric: "ebitda_multiple" },
  { id: "sfr", name: "Single-Family Rental", description: "SFR portfolios and build-to-rent", icon: Home, metric: "grm" },
  { id: "duplex", name: "Duplex", description: "Two-unit residential properties", icon: Home, metric: "grm" },
  { id: "triplex", name: "Triplex", description: "Three-unit residential properties", icon: Home, metric: "grm" },
  { id: "quad", name: "Quad / Fourplex", description: "Four-unit residential properties", icon: Home, metric: "grm" },
  { id: "business", name: "Business / Other", description: "Operating businesses, other asset types", icon: Briefcase, metric: "ebitda_multiple" },
];

const dealTypes = [
  {
    id: "acquisition",
    name: "New Acquisition",
    description: "Evaluating a property to potentially purchase",
    icon: Briefcase,
  },
  {
    id: "refinance",
    name: "Refinance/Revaluation",
    description: "Refinancing or updating valuation of an owned asset",
    icon: TrendingUp,
  },
  {
    id: "owned_marina",
    name: "Owned Asset",
    description: "Managing an existing asset in your portfolio",
    icon: Anchor,
  },
];

const features = [
  { id: "crm", name: "CRM & Leads", description: "Track deals and contacts", icon: Users },
  { id: "dd", name: "Due Diligence", description: "Manage DD checklists", icon: ClipboardList },
  { id: "modeling", name: "Financial Model", description: "Financial modeling", icon: TrendingUp },
  { id: "operations", name: "Operations", description: "Manage property ops", icon: Store },
  { id: "fuel", name: "Fuel Sales", description: "Track fuel revenue", icon: Fuel },
  { id: "documents", name: "Documents", description: "Virtual data room", icon: FileText },
];

export function OnboardingWizard({ open, onOpenChange, userName, mode = "onboarding", onProjectCreated }: OnboardingWizardProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Asset-class-aware terminology
  const getAssetTerms = (ac: string | null) => {
    const terms: Record<string, { property: string; placeholder: string; heading: string }> = {
      marina: { property: "Marina Name", placeholder: "e.g., Sunset Bay Marina", heading: "Tell us about your marina" },
      multifamily: { property: "Property Name", placeholder: "e.g., Sunset Ridge Apartments", heading: "Tell us about your property" },
      retail: { property: "Property Name", placeholder: "e.g., Shoppes at Sunset", heading: "Tell us about your property" },
      office: { property: "Property Name", placeholder: "e.g., Sunset Tower Office", heading: "Tell us about your property" },
      industrial: { property: "Property Name", placeholder: "e.g., Sunset Distribution Center", heading: "Tell us about your property" },
      self_storage: { property: "Facility Name", placeholder: "e.g., Sunset Self Storage", heading: "Tell us about your facility" },
      hotel: { property: "Hotel Name", placeholder: "e.g., The Sunset Hotel", heading: "Tell us about your hotel" },
      str: { property: "Property Name", placeholder: "e.g., Sunset Beach House", heading: "Tell us about your property" },
      medical_office: { property: "Property Name", placeholder: "e.g., Sunset Medical Plaza", heading: "Tell us about your property" },
      mixed_use: { property: "Property Name", placeholder: "e.g., Sunset Mixed-Use Center", heading: "Tell us about your property" },
      laundromat: { property: "Business Name", placeholder: "e.g., Sunset Wash & Fold", heading: "Tell us about your laundromat" },
      sfr: { property: "Property Name", placeholder: "e.g., 123 Sunset Lane", heading: "Tell us about your rental" },
      duplex: { property: "Property Name", placeholder: "e.g., 456 Oak Street", heading: "Tell us about your duplex" },
      triplex: { property: "Property Name", placeholder: "e.g., 789 Elm Avenue", heading: "Tell us about your triplex" },
      quad: { property: "Property Name", placeholder: "e.g., 321 Pine Drive", heading: "Tell us about your fourplex" },
      business: { property: "Business Name", placeholder: "e.g., Sunset Enterprises", heading: "Tell us about your business" },
    };
    return terms[ac || "marina"] || terms.marina;
  };

  const getInitialState = useCallback((): WizardState => ({
    step: 1,
    dealStructure: mode === "new_project" ? "single" : null,
    assetClass: null,
    marinaName: "",
    marinaAddress: { ...emptyAddress },
    dealType: mode === "new_project" ? "acquisition" : null,
    region: "",
    dealStatus: "active",
    portfolioName: "",
    portfolioMarinas: [{ name: "", address: { ...emptyAddress } }],
    featuresToExplore: [],
    profitCenters: defaultWizardProfitCenters.map(p => ({ ...p })),
    amenities: defaultWizardAmenities.map(a => ({ ...a })),
    storageTypes: defaultWizardStorageTypes.map(s => ({ ...s })),
    designatedSpaces: defaultWizardDesignatedSpaces.map(s => ({ ...s })),
    stagedFiles: [],
    acreage: { totalAcres: '', uplandAcres: '', submergedAcres: '' },
    propertySizeValues: {},
    buildings: [{ name: 'Building A', sizeValues: {} }],
    isMultiBuilding: false,
    ownership: { type: 'fee_simple', leases: [] },
  }), [mode]);
  
  const [state, setState] = useState<WizardState>(getInitialState);
  const steps = useMemo(() => 
    mode === "new_project" 
      ? getNewProjectSteps(state.assetClass) 
      : getOnboardingSteps(state.assetClass),
    [mode, state.assetClass]
  );
  const totalSteps = steps.length;
  const assetTerms = getAssetTerms(state.assetClass);
  const [expandedLeases, setExpandedLeases] = useState<Set<string>>(new Set());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const prevOpenRef = useRef(open);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setState(getInitialState());
      setShowExitConfirm(false);
    }
    prevOpenRef.current = open;
  }, [open, getInitialState]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [state.step]);
  // Update profit centers and amenities when asset class changes
  useEffect(() => {
    if (!state.assetClass) return;
    const catalog = getAssetClassCatalog(state.assetClass);
    const newProfitCenters = catalog.profitCenters.map(pc => ({
      id: pc.id, name: pc.name, description: pc.description, isEnabled: false, iconName: pc.icon,
    }));
    const newAmenities = catalog.amenities.map(a => ({
      id: a.id, name: a.name, description: a.description, isEnabled: false, iconName: a.icon,
    }));
    setState(s => ({ ...s, profitCenters: newProfitCenters, amenities: newAmenities }));
  }, [state.assetClass]);

  const hasProgress = state.step > 1 || 
    state.marinaName.trim() !== '' || 
    (state.marinaAddress?.line1 || '').trim() !== '' ||
    state.portfolioName.trim() !== '' ||
    state.portfolioMarinas.some(m => m.name.trim() !== '') ||
    state.region !== '' ||
    state.profitCenters.some(pc => pc.isEnabled) || 
    state.amenities.some(a => a.isEnabled) ||
    state.storageTypes.some(st => st.isEnabled) || 
    state.designatedSpaces.some(ds => ds.isEnabled) ||
    state.featuresToExplore.length > 0 ||
    state.stagedFiles.length > 0 ||
    state.acreage.totalAcres !== '' || state.acreage.uplandAcres !== '' || state.acreage.submergedAcres !== '' ||
    state.ownership.type !== 'fee_simple' || state.ownership.leases.length > 0;

  function handleCloseAttempt(openState: boolean) {
    if (!openState && open) {
      if (hasProgress) {
        setShowExitConfirm(true);
      } else {
        onOpenChange(false);
      }
    }
  }

  function confirmExit() {
    setShowExitConfirm(false);
    setState(getInitialState());
    onOpenChange(false);
  }

  function cancelExit() {
    setShowExitConfirm(false);
  }

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
      const amenities = state.amenities
        .filter(a => a.isEnabled)
        .map(a => a.id);
      const acreageData = (state.acreage.totalAcres || state.acreage.uplandAcres || state.acreage.submergedAcres)
        ? state.acreage : undefined;
      const ownershipData = state.ownership.type !== 'fee_simple' || state.ownership.leases.length > 0
        ? state.ownership : undefined;
      const propertySizeData = Object.keys(state.propertySizeValues).some(k => state.propertySizeValues[k] !== '') ||
    state.buildings.length > 1
          ? state.propertySizeValues : undefined;
      const buildingsData = state.isMultiBuilding && state.buildings.length > 0
          ? state.buildings.filter(b => b.name.trim() !== '') : undefined;
        const hasData = Object.keys(departments).length > 0 || profitCenters.length > 0 || amenities.length > 0 || acreageData || ownershipData || propertySizeData;
      if (hasData) {
        await apiRequest('POST', `/api/modeling/projects/${projectId}/config`, {
          departments, profitCenters, amenities,
          ...(acreageData ? { acreage: acreageData } : {}),
            ...(propertySizeData ? { propertySize: propertySizeData } : {}),
          ...(ownershipData ? { ownership: ownershipData } : {}),
        });
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
          if (staged.docType === 't12') {
            if (staged.t12StartMonth) formData.append('t12StartMonth', staged.t12StartMonth);
            if (staged.t12StartYear) formData.append('t12StartYear', staged.t12StartYear);
            if (staged.t12EndMonth) formData.append('t12EndMonth', staged.t12EndMonth);
            if (staged.t12EndYear) formData.append('t12EndYear', staged.t12EndYear);
          }
          
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
      assetClass: WizardAssetClass;
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
              assetClass: data.assetClass || "marina",
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
          assetClass: data.assetClass || "marina",
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
        if (state.assetClass === 'marina') {
          await saveStorageConfig(projectId);
        }
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
          ? `${projectCount} asset${projectCount > 1 ? 's' : ''} added to CRM and Financial Model.`
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
      const msg = error?.message || "Unknown error";
      toast({
        title: "Error",
        description: msg.substring(0, 100),
        variant: "destructive",
      });
    },
  });
  function handleNext() {
    if (state.step < steps.length) {
      // Validate current step before advancing (by title, not ordinal)
      const currentTitle = steps.find(s => s.id === state.step)?.title;
      
      if (currentTitle === "Deal Structure") {
        if (!state.dealStructure) {
          toast({ title: "Required", description: "Please select a deal structure.", variant: "destructive" });
          return;
        }
        if (mode === "new_project" && !state.assetClass) {
          toast({ title: "Required", description: "Please select an asset class.", variant: "destructive" });
          return;
        }
      }
      
      if (currentTitle === "Property Details") {
        if (state.dealStructure === "single") {
          if (!state.marinaName.trim()) {
            toast({ title: "Required", description: `Please enter a ${getAssetTerms(state.assetClass).property.toLowerCase()}.`, variant: "destructive" });
            return;
          }
          if (!state.marinaAddress.city.trim() || !state.marinaAddress.state.trim()) {
            toast({ title: "Required", description: "Please enter at least a city and state.", variant: "destructive" });
            return;
          }
        } else if (state.dealStructure === "portfolio") {
          if (!state.portfolioMarinas.some(m => m.name.trim())) {
            toast({ title: "Required", description: "Please add at least one property with a name.", variant: "destructive" });
            return;
          }
        }
      }
      
      if ((currentTitle === "Deal Info" || currentTitle === "Deal Type") && !state.dealType) {
        toast({ title: "Required", description: "Please select a deal type.", variant: "destructive" });
        return;
      }
      
      setState(s => ({ ...s, step: s.step + 1 }));
    }
  }

  const progress = (state.step / steps.length) * 100;

  const currentStepTitle = steps.find(s => s.id === state.step)?.title || '';


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
        assetClass: state.assetClass,
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
  const [customAmenityName, setCustomAmenityName] = useState('');
  const [showAddAmenity, setShowAddAmenity] = useState(false);
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

  function addCustomAmenity() {
    const name = customAmenityName.trim();
    if (!name) return;
    const id = `custom_amenity_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    if (state.amenities.some(a => a.id === id)) return;
    setState(s => ({
      ...s,
      amenities: [...s.amenities, {
        id, name, description: 'Custom amenity', isEnabled: true, iconName: 'wrench',
      }],
    }));
    setCustomAmenityName('');
    setShowAddAmenity(false);
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

  function toggleAmenity(id: string) {
    setState(s => ({
      ...s,
      amenities: s.amenities.map(a =>
        a.id === id ? { ...a, isEnabled: !a.isEnabled } : a
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
    const now = new Date();
    const newFiles: WizardStagedFile[] = files.map(file => {
      const docType = guessDocType(file.name);
      const base: WizardStagedFile = {
        id: crypto.randomUUID(),
        file,
        docType,
        year: now.getFullYear().toString(),
        status: 'pending',
      };
      if (docType === 't12') {
        base.t12StartMonth = (now.getMonth() + 1).toString();
        base.t12StartYear = (now.getFullYear() - 1).toString();
        base.t12EndMonth = (now.getMonth() + 1).toString();
        base.t12EndYear = now.getFullYear().toString();
      }
      return base;
    });
    setState(s => ({ ...s, stagedFiles: [...s.stagedFiles, ...newFiles] }));
  }

  function removeStagedFile(id: string) {
    setState(s => ({ ...s, stagedFiles: s.stagedFiles.filter(f => f.id !== id) }));
  }

  function updateStagedFileField(id: string, field: 'docType' | 'year' | 't12StartMonth' | 't12StartYear' | 't12EndMonth' | 't12EndYear', value: string) {
    setState(s => ({
      ...s,
      stagedFiles: s.stagedFiles.map(f => {
        if (f.id !== id) return f;
        const updated = { ...f, [field]: value };
        if (field === 'docType' && value === 't12') {
          const now = new Date();
          const endMonth = (now.getMonth() + 1).toString();
          const endYear = now.getFullYear().toString();
          const startMonth = endMonth;
          const startYear = (now.getFullYear() - 1).toString();
          updated.t12StartMonth = updated.t12StartMonth || startMonth;
          updated.t12StartYear = updated.t12StartYear || startYear;
          updated.t12EndMonth = updated.t12EndMonth || endMonth;
          updated.t12EndYear = updated.t12EndYear || endYear;
        }
        return updated;
      }),
    }));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
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
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">What type of deal are you working on?</h3>
        <p className="text-sm text-muted-foreground">
          Choose a deal structure and asset class
        </p>
      </div>

      {/* Deal Structure */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Deal Structure</Label>
        <RadioGroup
          value={state.dealStructure || ""}
          onValueChange={(value) => setState(s => ({ ...s, dealStructure: value as DealStructure }))}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {dealStructures.map((structure) => (
            <div
              key={structure.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                state.dealStructure === structure.id
                  ? "border-[#1E4FAB] bg-[#1E4FAB]/5"
                  : "hover:bg-muted/50"
              )}
              onClick={() => setState(s => ({ ...s, dealStructure: structure.id as DealStructure }))}
            >
              <RadioGroupItem value={structure.id} id={`structure-${structure.id}`} />
              <div className="p-1.5 rounded-md bg-muted">
                <structure.icon className="h-4 w-4 text-[#1E4FAB]" />
              </div>
              <div className="flex-1">
                <Label htmlFor={`structure-${structure.id}`} className="font-medium cursor-pointer text-sm">
                  {structure.name}
                </Label>
                <p className="text-xs text-muted-foreground">{structure.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Asset Class */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Asset Class</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {wizardAssetClasses.map((ac) => (
            <div
              key={ac.id}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-left",
                state.assetClass === ac.id
                  ? "border-[#1E4FAB] bg-[#1E4FAB]/5 ring-1 ring-[#1E4FAB]/20"
                  : "hover:bg-muted/50 hover:border-gray-300"
              )}
              onClick={() => setState(s => ({ ...s, assetClass: ac.id as WizardAssetClass }))}
            >
              <div className={cn(
                "p-1.5 rounded-md shrink-0",
                state.assetClass === ac.id ? "bg-[#1E4FAB]/10" : "bg-muted"
              )}>
                <ac.icon className={cn("h-4 w-4", state.assetClass === ac.id ? "text-[#1E4FAB]" : "text-gray-500")} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-xs font-medium truncate", state.assetClass === ac.id && "text-[#1E4FAB]")}>{ac.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{ac.description}</p>
              </div>
            </div>
          ))}
        </div>
        {state.assetClass && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 rounded-md px-3 py-1.5">
            <BarChart3 className="h-3 w-3" />
            <span>Primary metric: <strong className="text-foreground">{wizardAssetClasses.find(a => a.id === state.assetClass)?.metric === "cap_rate" ? "Cap Rate" : wizardAssetClasses.find(a => a.id === state.assetClass)?.metric === "grm" ? "GRM" : "EBITDA Multiple"}</strong> (editable later)</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderMarinaDetailsStep = () => {
    if (state.dealStructure === "portfolio") {
      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">Build your portfolio</h3>
            <p className="text-sm text-muted-foreground">Add the properties in this deal</p>
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
                  <span className="text-sm font-medium text-muted-foreground">Property {index + 1}</span>
                  {state.portfolioMarinas.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePortfolioMarina(index)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input placeholder="Property name" value={marina.name} onChange={(e) => updatePortfolioMarinaName(index, e.target.value)} />
                <AddressAutocompleteInput value={marina.address.line1} placeholder="Address" onChangeText={(text) => updatePortfolioMarinaAddress(index, 'line1', text)} onSelectAddress={(addr) => handleAddressAutocomplete(addr, index)} searchType="address" />
                <Input placeholder="Address Line 2 (optional)" value={marina.address.line2} onChange={(e) => updatePortfolioMarinaAddress(index, 'line2', e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <Input placeholder="City" value={marina.address.city} onChange={(e) => updatePortfolioMarinaAddress(index, 'city', e.target.value)} />
                  <Input placeholder="State" maxLength={2} value={marina.address.state} onChange={(e) => updatePortfolioMarinaAddress(index, 'state', e.target.value.toUpperCase())} />
                  <Input placeholder="Zip" maxLength={10} value={marina.address.zip} onChange={(e) => updatePortfolioMarinaAddress(index, 'zip', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addPortfolioMarina} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Property
          </Button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">{assetTerms.heading}</h3>
          <p className="text-sm text-muted-foreground">We'll create a CRM property and modeling project</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="marinaName">{assetTerms.property} <span className="text-destructive">*</span></Label>
            <Input id="marinaName" placeholder={assetTerms.placeholder} value={state.marinaName} onChange={(e) => setState(s => ({ ...s, marinaName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Address <span className="text-destructive">*</span></Label>
            <AddressAutocompleteInput value={state.marinaAddress.line1} placeholder="Start typing an address..." onChangeText={(text) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, line1: text } }))} onSelectAddress={(addr) => handleAddressAutocomplete(addr)} searchType="address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input id="addressLine2" placeholder="Suite, Unit, etc." value={state.marinaAddress.line2} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, line2: e.target.value } }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

          {/* Property Size — driven by asset class config */}
          {state.assetClass && (() => {
            const wizCfg = getWizardConfig(state.assetClass);
            if (!wizCfg.propertySizeFields.length) return null;
            return (
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Property Size</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wizCfg.propertySizeFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step={field.suffix === 'acres' ? '0.01' : '1'}
                          placeholder="0"
                          value={state.propertySizeValues[field.id] || ''}
                          onChange={(e) => setState(s => ({
                            ...s,
                            propertySizeValues: { ...s.propertySizeValues, [field.id]: e.target.value }
                          }))}
                          className={field.suffix ? 'pr-12' : ''}
                        />
                        {field.suffix && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {field.suffix}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Multi-building toggle */}
                {wizCfg.supportsMultiBuilding && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="multiBuilding"
                        checked={state.isMultiBuilding}
                        onChange={(e) => setState(s => ({ ...s, isMultiBuilding: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="multiBuilding" className="text-xs text-muted-foreground cursor-pointer">
                        This property has multiple buildings
                      </Label>
                    </div>
                    {state.isMultiBuilding && (
                      <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                        {state.buildings.map((building, idx) => (
                          <div key={idx} className="space-y-2 p-3 bg-muted/30 rounded-md">
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder={`Building ${String.fromCharCode(65 + idx)}`}
                                value={building.name}
                                onChange={(e) => setState(s => {
                                  const buildings = [...s.buildings];
                                  buildings[idx] = { ...buildings[idx], name: e.target.value };
                                  return { ...s, buildings };
                                })}
                                className="h-8 text-sm font-medium"
                              />
                              {state.buildings.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setState(s => ({
                                    ...s,
                                    buildings: s.buildings.filter((_, i) => i !== idx)
                                  }))}
                                  className="text-xs text-destructive hover:text-destructive/80 shrink-0"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {wizCfg.propertySizeFields.map((field) => (
                                <div key={field.id} className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      min="0"
                                      step={field.suffix === 'acres' ? '0.01' : '1'}
                                      placeholder="0"
                                      value={building.sizeValues[field.id] || ''}
                                      onChange={(e) => setState(s => {
                                        const buildings = [...s.buildings];
                                        buildings[idx] = {
                                          ...buildings[idx],
                                          sizeValues: { ...buildings[idx].sizeValues, [field.id]: e.target.value }
                                        };
                                        return { ...s, buildings };
                                      })}
                                      className={`h-7 text-xs ${field.suffix ? 'pr-10' : ''}`}
                                    />
                                    {field.suffix && (
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                        {field.suffix}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setState(s => ({
                            ...s,
                            buildings: [...s.buildings, { name: `Building ${String.fromCharCode(65 + s.buildings.length)}`, sizeValues: {} }]
                          }))}
                          className="text-xs text-primary hover:text-primary/80 font-medium"
                        >
                          + Add Building
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    const catalog = getAssetClassCatalog(state.assetClass);
    if (!catalog.hasProfitCenters) {
      return (
        <div className="space-y-4">
          <div className="text-center py-8">
            <Store className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">No Profit Centers</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              {assetTerms.heading.replace("Tell us about your ", "").replace("Tell us about your", "This")} asset class uses a single revenue stream. You can configure revenue details in the financial model.
            </p>
            <p className="text-xs text-muted-foreground mt-3">Click Continue to proceed.</p>
          </div>
        </div>
      );
    }
    const enabledCount = state.profitCenters.filter(pc => pc.isEnabled).length;
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">Profit Centers</h3>
          <p className="text-sm text-muted-foreground">
            Which revenue sources does this property have? Check all that apply.
          </p>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="mt-2">{enabledCount} selected</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
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
  const renderAmenitiesStep = () => {
    const catalog = getAssetClassCatalog(state.assetClass);
    if (!catalog.hasAmenities) {
      return (
        <div className="space-y-4">
          <div className="text-center py-8">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">No Amenities to Configure</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              This asset class doesn't have standard amenities to track. You can add custom features later.
            </p>
            <p className="text-xs text-muted-foreground mt-3">Click Continue to proceed.</p>
          </div>
        </div>
      );
    }
    const enabledCount = state.amenities.filter(a => a.isEnabled).length;
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">Amenities & Services</h3>
          <p className="text-sm text-muted-foreground">
            What amenities and supporting services does this property offer?
          </p>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="mt-2">{enabledCount} selected</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {state.amenities.map((amenity) => (
            <button
              key={amenity.id}
              type="button"
              onClick={() => toggleAmenity(amenity.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                amenity.isEnabled
                  ? "border-[#1E4FAB]/40 bg-[#1E4FAB]/5 ring-1 ring-[#1E4FAB]/20"
                  : "border-muted bg-muted/20 hover:bg-muted/40"
              )}
            >
              <div className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                amenity.isEnabled ? "bg-[#1E4FAB] border-[#1E4FAB] text-white" : "border-muted-foreground/30"
              )}>
                {amenity.isEnabled && <Check className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{getStorageIcon(amenity.iconName)}</span>
                  <span className="text-sm font-medium">{amenity.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{amenity.description}</p>
              </div>
            </button>
          ))}
        </div>
        {showAddAmenity ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. Concierge Service"
              value={customAmenityName}
              onChange={(e) => setCustomAmenityName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomAmenity()}
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button size="sm" className="h-8 bg-[#1E4FAB] hover:bg-[#1a4294]" onClick={addCustomAmenity} disabled={!customAmenityName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowAddAmenity(false); setCustomAmenityName(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddAmenity(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Amenity
          </Button>
        )}
        <p className="text-xs text-center text-muted-foreground">
          Amenities help with property comparison and valuation analysis.
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
            What types of storage or spaces does this property offer? Add counts and occupancy if known.
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

  const renderDocumentUploadStep = () => {
    const assetDocTypes = state.assetClass
      ? getDocumentTypesForAsset(state.assetClass)
      : getDocumentTypesForAsset('business');
    return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">
          {state.assetClass ? getWizardConfig(state.assetClass).uploadLabel : 'Upload Documents'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {state.assetClass
            ? `${getWizardConfig(state.assetClass).uploadDescription} They'll be auto-processed by AI when your project is created.`
            : "Upload P&L statements, rent rolls, or other financials. They'll be auto-processed by AI when your project is created."}
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
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {state.stagedFiles.map((staged) => (
            <div key={staged.id} className="rounded-lg border bg-muted/30 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{staged.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(staged.file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeStagedFile(staged.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <Select value={staged.docType === 't12' ? 'pnl' : staged.docType} onValueChange={(v) => updateStagedFileField(staged.id, 'docType', v as DocTypeEnum)}>
                  <SelectTrigger className="h-7 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetDocTypes
                      .filter(dt => dt.id !== 't12')
                      .map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={staged.docType === 't12' ? 'T12' : staged.year} onValueChange={(v) => {
                  if (v === 'T12') {
                    updateStagedFileField(staged.id, 'docType', 't12' as DocTypeEnum);
                  } else {
                    if (staged.docType === 't12') {
                      updateStagedFileField(staged.id, 'docType', 'pnl' as DocTypeEnum);
                    }
                    updateStagedFileField(staged.id, 'year', v);
                  }
                }}>
                  <SelectTrigger className="h-7 w-[85px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T12">T12</SelectItem>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {staged.docType === 't12' && (
                <div className="flex items-center gap-2 flex-wrap text-xs pl-6">
                  <span className="text-muted-foreground font-medium">From:</span>
                  <Select value={staged.t12StartMonth || '1'} onValueChange={(v) => updateStagedFileField(staged.id, 't12StartMonth', v)}>
                    <SelectTrigger className="h-6 w-[80px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={staged.t12StartYear || new Date().getFullYear().toString()} onValueChange={(v) => updateStagedFileField(staged.id, 't12StartYear', v)}>
                    <SelectTrigger className="h-6 w-[76px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-medium ml-1">To:</span>
                  <Select value={staged.t12EndMonth || '12'} onValueChange={(v) => updateStagedFileField(staged.id, 't12EndMonth', v)}>
                    <SelectTrigger className="h-6 w-[80px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={staged.t12EndYear || new Date().getFullYear().toString()} onValueChange={(v) => updateStagedFileField(staged.id, 't12EndYear', v)}>
                    <SelectTrigger className="h-6 w-[76px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
  };

  const createWizardLease = (type: 'submerged_land_lease' | 'ground_lease'): WizardLeaseDetail => ({
    id: `lease_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    counterparty: '',
    monthlyRent: '',
    annualRent: '',
    termRemaining: '',
    termUnit: 'years',
    expirationDate: '',
    renewalOptions: '',
    notes: '',
  });

  const addWizardLease = (type: 'submerged_land_lease' | 'ground_lease') => {
    const newLease = createWizardLease(type);
    setState(s => ({ ...s, ownership: { ...s.ownership, leases: [...s.ownership.leases, newLease] } }));
    setExpandedLeases(prev => new Set([...prev, newLease.id]));
  };

  const updateWizardLease = (id: string, field: keyof WizardLeaseDetail, value: string) => {
    setState(s => ({
      ...s,
      ownership: {
        ...s.ownership,
        leases: s.ownership.leases.map(l => {
          if (l.id !== id) return l;
          const updated = { ...l, [field]: value };
          if (field === 'monthlyRent') {
            if (value) {
              const monthly = parseFloat(value);
              if (!isNaN(monthly)) updated.annualRent = (monthly * 12).toFixed(2);
            } else {
              updated.annualRent = '';
            }
          } else if (field === 'annualRent') {
            if (value) {
              const annual = parseFloat(value);
              if (!isNaN(annual)) updated.monthlyRent = (annual / 12).toFixed(2);
            } else {
              updated.monthlyRent = '';
            }
          }
          return updated;
        }),
      },
    }));
  };

  const removeWizardLease = (id: string) => {
    setState(s => ({ ...s, ownership: { ...s.ownership, leases: s.ownership.leases.filter(l => l.id !== id) } }));
    setExpandedLeases(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleWizardLeaseExpanded = (id: string) => {
    setExpandedLeases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleWizardOwnershipTypeChange = (type: OwnershipType) => {
    setState(s => {
      let leases = [...s.ownership.leases];
      if (type === 'fee_simple') {
        return { ...s, ownership: { type, leases: [] } };
      }
      if (type === 'submerged_land_lease' && !leases.some(l => l.type === 'submerged_land_lease')) {
        const nl = createWizardLease('submerged_land_lease');
        leases = [...leases, nl];
        setExpandedLeases(prev => new Set([...prev, nl.id]));
      }
      if (type === 'ground_lease' && !leases.some(l => l.type === 'ground_lease')) {
        const nl = createWizardLease('ground_lease');
        leases = [...leases, nl];
        setExpandedLeases(prev => new Set([...prev, nl.id]));
      }
      if (type === 'combined') {
        if (!leases.some(l => l.type === 'submerged_land_lease')) {
          const nl = createWizardLease('submerged_land_lease');
          leases = [...leases, nl];
          setExpandedLeases(prev => new Set([...prev, nl.id]));
        }
        if (!leases.some(l => l.type === 'ground_lease')) {
          const nl = createWizardLease('ground_lease');
          leases = [...leases, nl];
          setExpandedLeases(prev => new Set([...prev, nl.id]));
        }
      }
      return { ...s, ownership: { type, leases } };
    });
  };

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
              <SelectItem value="owned_marina">Owned Asset</SelectItem>
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

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <LandPlot className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Acreage</Label>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Total Acres</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={state.acreage.totalAcres}
                onChange={(e) => setState(s => ({ ...s, acreage: { ...s.acreage, totalAcres: e.target.value } }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Upland Acres</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={state.acreage.uplandAcres}
                  onChange={(e) => setState(s => ({ ...s, acreage: { ...s.acreage, uplandAcres: e.target.value } }))}
                />
              </div>
              {state.assetClass === "marina" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Submerged Acres</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={state.acreage.submergedAcres}
                  onChange={(e) => setState(s => ({ ...s, acreage: { ...s.acreage, submergedAcres: e.target.value } }))}
                />
              </div>
              )}
            </div>
            {state.assetClass === "marina" && state.acreage.uplandAcres && state.acreage.submergedAcres && (
              <div className="flex items-center justify-between p-2 rounded bg-muted/30 border text-xs">
                <span className="text-muted-foreground">Calculated Total</span>
                <span className="font-medium">
                  {(parseFloat(state.acreage.uplandAcres || '0') + parseFloat(state.acreage.submergedAcres || '0')).toFixed(2)} acres
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Ownership Structure</Label>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ownership Type</Label>
              <Select
                value={state.ownership.type}
                onValueChange={(v) => handleWizardOwnershipTypeChange(v as OwnershipType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fee_simple">Fee Simple</SelectItem>
                  {state.assetClass === "marina" && <SelectItem value="submerged_land_lease">Submerged Land Lease</SelectItem>}
                  <SelectItem value="ground_lease">Ground Lease</SelectItem>
                  <SelectItem value="combined">Combined (Multiple)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {state.ownership.type === 'fee_simple' && 'Full ownership of both upland and submerged land'}
                {state.ownership.type === 'submerged_land_lease' && 'Fee simple on upland, leased submerged land'}
                {state.ownership.type === 'ground_lease' && 'Operating on leased ground'}
                {state.ownership.type === 'combined' && 'Mix of owned and leased parcels'}
              </p>
            </div>

            {state.ownership.type !== 'fee_simple' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Lease Details</span>
                  <div className="flex gap-1">
                    {(state.ownership.type === 'submerged_land_lease' || state.ownership.type === 'combined') && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addWizardLease('submerged_land_lease')}>
                        <Plus className="h-3 w-3 mr-1" />Submerged
                      </Button>
                    )}
                    {(state.ownership.type === 'ground_lease' || state.ownership.type === 'combined') && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addWizardLease('ground_lease')}>
                        <Plus className="h-3 w-3 mr-1" />Ground
                      </Button>
                    )}
                  </div>
                </div>

                {state.ownership.leases.map((lease) => (
                  <div key={lease.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-2 bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleWizardLeaseExpanded(lease.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedLeases.has(lease.id) ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {lease.type === 'submerged_land_lease' ? 'Submerged' : 'Ground'}
                        </Badge>
                        <span className="text-xs font-medium">
                          {lease.counterparty || 'Unnamed Lease'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {lease.annualRent && (
                          <span className="text-[10px] text-muted-foreground">
                            ${parseFloat(lease.annualRent).toLocaleString()}/yr
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeWizardLease(lease.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {expandedLeases.has(lease.id) && (
                      <div className="p-3 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Counterparty / Lessor</Label>
                          <Input
                            placeholder="e.g., State of Florida"
                            value={lease.counterparty}
                            onChange={(e) => updateWizardLease(lease.id, 'counterparty', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Monthly Rent ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={lease.monthlyRent}
                              onChange={(e) => updateWizardLease(lease.id, 'monthlyRent', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Annual Rent ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={lease.annualRent}
                              onChange={(e) => updateWizardLease(lease.id, 'annualRent', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Term Remaining</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={lease.termRemaining}
                                onChange={(e) => updateWizardLease(lease.id, 'termRemaining', e.target.value)}
                                className="h-8 text-sm flex-1"
                              />
                              <Select
                                value={lease.termUnit}
                                onValueChange={(v) => updateWizardLease(lease.id, 'termUnit', v)}
                              >
                                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="years">Years</SelectItem>
                                  <SelectItem value="months">Months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Expiration Date</Label>
                            <Input
                              type="date"
                              value={lease.expirationDate}
                              onChange={(e) => updateWizardLease(lease.id, 'expirationDate', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Renewal Options</Label>
                          <Input
                            placeholder="e.g., Two 10-year renewals at market rate"
                            value={lease.renewalOptions}
                            onChange={(e) => updateWizardLease(lease.id, 'renewalOptions', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Input
                            placeholder="Additional terms, escalation clauses, etc."
                            value={lease.notes}
                            onChange={(e) => updateWizardLease(lease.id, 'notes', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const getStepContent = () => {
    const stepTitle = steps.find(s => s.id === state.step)?.title;
    const contentMap: Record<string, React.ReactNode> = mode === "new_project"
      ? {
          "Deal Structure": renderDealStructureStep(),
          "Property Details": renderMarinaDetailsStep(),
          "Deal Info": renderDealInfoStep(),
          "Profit Centers": renderProfitCentersStep(),
          "Amenities": renderAmenitiesStep(),
          "Storage": renderStorageTypesStep(),
          "Documents": renderDocumentUploadStep(),
        }
      : {
          "Welcome": renderWelcomeStep(),
          "Deal Structure": renderDealStructureStep(),
          "Property Details": renderMarinaDetailsStep(),
          "Deal Type": renderDealTypeStep(),
          "Profit Centers": renderProfitCentersStep(),
          "Amenities": renderAmenitiesStep(),
          "Storage": renderStorageTypesStep(),
          "Documents": renderDocumentUploadStep(),
          "Features": renderFeaturesStep(),
          "Get Started": renderGetStartedStep(),
        };
    return stepTitle ? contentMap[stepTitle] : null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseAttempt}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col" onPointerDownOutside={(e) => { if (hasProgress) { e.preventDefault(); setShowExitConfirm(true); } }} onEscapeKeyDown={(e) => { if (hasProgress) { e.preventDefault(); setShowExitConfirm(true); } }}>
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="flex items-center gap-2">
                {state.assetClass === "marina" ? <Anchor className="h-5 w-5 text-[#1E4FAB]" /> : <Building2 className="h-5 w-5 text-[#1E4FAB]" />}
                {mode === "new_project" ? "New Project" : "Setup Wizard"}
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

          <div ref={scrollRef} className="py-4 flex-1 overflow-y-auto min-h-0">
            {getStepContent()}
          </div>

          <div className="flex justify-between pt-4 border-t shrink-0">
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

      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="sm:max-w-[400px]" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Leave Setup?</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                You have unsaved progress in this wizard. Are you sure you want to leave? Your entries will be lost.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 pt-2">
              <Button variant="outline" className="w-full" onClick={cancelExit}>
                Cancel
              </Button>
              <Button variant="destructive" className="w-full" onClick={confirmExit}>
                Leave Without Saving
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

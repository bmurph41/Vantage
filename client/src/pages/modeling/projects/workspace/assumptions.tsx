import {
  Lock, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Lock, useQuery, useMutation } from '@tanstack/react-query';
import {
  Lock, queryClient, apiRequest } from '@/lib/queryClient';
import {
  Lock, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lock, AutosaveIndicator } from '@/components/ui/autosave-indicator';
import {
  Lock, WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import {
  Lock, GrowthRatesTab } from '@/components/modeling/growth-rates/GrowthRatesTab';
import type { AutoSaveStatus } from '@/hooks/use-local-autosave';
import {
  Lock, Button } from '@/components/ui/button';
import {
  Lock, Input } from '@/components/ui/input';
import {
  Lock, Label } from '@/components/ui/label';
import {
  Lock, Badge } from '@/components/ui/badge';
import {
  Lock, Separator } from '@/components/ui/separator';
import {
  Lock, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Lock,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Lock,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Lock,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Lock,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Lock, ScrollArea } from '@/components/ui/scroll-area';
import {
  Lock, useToast } from '@/hooks/use-toast';
import {
  Lock, useCaseLabels, type CaseType } from '@/hooks/useCaseLabels';
import type { ModelingProject } from '@shared/schema';
import {
  Lock,
  Save,
  TrendingUp,
  Percent,
  DollarSign,
  AlertCircle,
  Info,
  Anchor,
  Warehouse,
  Ship,
  Fuel,
  ShoppingCart,
  GitBranch,
  History,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Send,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Layers,
  MapPin,
  Globe,
  Waves,
  Car,
  Home,
  Utensils,
  Users,
  Store,
  Wrench,
  Container,
  Sailboat
} from 'lucide-react';
import {
  Lock, format } from 'date-fns';

function PercentInput({
  value,
  onChange,
  className = '',
  id,
  'data-testid': dataTestId,
}: {
  value: number;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  'data-testid'?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(String(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(localValue) || 0;
    onChange(String(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };

  const displayValue = isFocused ? localValue : `${(parseFloat(String(value)) || 0).toFixed(1)}%`;

  return (
    <Input
      id={id}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`text-right ${className}`}
      data-testid={dataTestId}
    />
  );
}

interface WorkspaceAssumptionsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type ScenarioType = 'base' | 'aggressive' | 'conservative' | 'custom';
type ScenarioStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

interface Scenario {
  id: string;
  scenarioType: ScenarioType;
  name: string;
  description?: string;
  version: number;
  isCurrentVersion: boolean;
  revenueGrowthRate?: string;
  expenseGrowthRate?: string;
  exitCapRate?: string;
  assumptions: any;
  status: ScenarioStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

type GrowthRates = Record<string, number>;
type OccupancyData = Record<string, Record<string, number>>;
type MarginData = Record<string, { historical: number; projected: number }>;
type StorageGrowthMode = 'universal' | 'per_type' | 'granular';

interface StorageLocation {
  id: string;
  name: string;
  storageTypeId: string;
}

interface StorageGrowthData {
  mode: StorageGrowthMode;
  universalRate: number;
  typeRates: Record<string, number>;
  locationRates: Record<string, number>;
}

const storageTypesConfig = [
  { id: 'wet_slips', name: 'Wet Slips', icon: <Anchor className="h-4 w-4" />, locations: [
    { id: 'wet_slips_a_dock', name: 'A Dock' },
    { id: 'wet_slips_b_dock', name: 'B Dock' },
    { id: 'wet_slips_c_dock', name: 'C Dock' },
    { id: 'wet_slips_premium', name: 'Premium Slips' },
  ]},
  { id: 'lift_slips', name: 'Lift Slips', icon: <Waves className="h-4 w-4" />, locations: [
    { id: 'lift_slips_main', name: 'Main Dock' },
  ]},
  { id: 'moorings', name: 'Moorings', icon: <Anchor className="h-4 w-4" />, locations: [
    { id: 'moorings_inner', name: 'Inner Harbor' },
    { id: 'moorings_outer', name: 'Outer Harbor' },
  ]},
  { id: 'dinghies', name: 'Dinghies', icon: <Sailboat className="h-4 w-4" />, locations: [
    { id: 'dinghies_main', name: 'Main Dock' },
  ]},
  { id: 'jet_skis', name: 'Jet Skis', icon: <Waves className="h-4 w-4" />, locations: [
    { id: 'jet_skis_main', name: 'PWC Dock' },
  ]},
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', icon: <Warehouse className="h-4 w-4" />, locations: [
    { id: 'dry_racks_indoor_main', name: 'Main Building' },
    { id: 'dry_racks_indoor_annex', name: 'Annex Building' },
  ]},
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', icon: <Container className="h-4 w-4" />, locations: [
    { id: 'dry_racks_outdoor_lot_a', name: 'Lot A' },
    { id: 'dry_racks_outdoor_lot_b', name: 'Lot B' },
  ]},
  { id: 'land_storage', name: 'Land Storage', icon: <MapPin className="h-4 w-4" />, locations: [
    { id: 'land_storage_main', name: 'Main Lot' },
  ]},
  { id: 'boats_on_trailers', name: 'Boats on Trailers', icon: <Ship className="h-4 w-4" />, locations: [
    { id: 'boats_on_trailers_lot', name: 'Trailer Lot' },
  ]},
  { id: 'trailers', name: 'Trailers', icon: <Car className="h-4 w-4" />, locations: [
    { id: 'trailers_lot', name: 'Trailer Storage Lot' },
  ]},
  { id: 'carports', name: 'Carports', icon: <Home className="h-4 w-4" />, locations: [
    { id: 'carports_main', name: 'Main Carport Area' },
  ]},
  { id: 'houseboats', name: 'Houseboats', icon: <Home className="h-4 w-4" />, locations: [
    { id: 'houseboats_dock', name: 'Houseboat Dock' },
  ]},
  { id: 'rv_sites', name: 'RV Sites', icon: <Car className="h-4 w-4" />, locations: [
    { id: 'rv_sites_main', name: 'RV Park' },
  ]},
];

const storageTypeCategories = [
  { id: 'wet_slips', name: 'Wet Slips', icon: <Anchor className="h-4 w-4" />, section: 'storage' },
  { id: 'lift_slips', name: 'Lift Slips', icon: <Waves className="h-4 w-4" />, section: 'storage' },
  { id: 'moorings', name: 'Moorings', icon: <Anchor className="h-4 w-4" />, section: 'storage' },
  { id: 'dinghies', name: 'Dinghies', icon: <Sailboat className="h-4 w-4" />, section: 'storage' },
  { id: 'jet_skis', name: 'Jet Skis', icon: <Waves className="h-4 w-4" />, section: 'storage' },
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', icon: <Warehouse className="h-4 w-4" />, section: 'storage' },
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', icon: <Container className="h-4 w-4" />, section: 'storage' },
  { id: 'land_storage', name: 'Land Storage', icon: <MapPin className="h-4 w-4" />, section: 'storage' },
  { id: 'boats_on_trailers', name: 'Boats on Trailers', icon: <Ship className="h-4 w-4" />, section: 'storage' },
  { id: 'trailers', name: 'Trailers', icon: <Car className="h-4 w-4" />, section: 'storage' },
  { id: 'carports', name: 'Carports', icon: <Home className="h-4 w-4" />, section: 'storage' },
  { id: 'houseboats', name: 'Houseboats', icon: <Home className="h-4 w-4" />, section: 'storage' },
  { id: 'rv_sites', name: 'RV Sites', icon: <Car className="h-4 w-4" />, section: 'storage' },
];

const designatedSpaceCategories = [
  { id: 'boat_sales', name: 'Boat Sales', icon: <Store className="h-4 w-4" />, section: 'designated' },
  { id: 'service', name: 'Service', icon: <Wrench className="h-4 w-4" />, section: 'designated' },
  { id: 'commercial_tenants', name: 'Commercial Tenants', icon: <Warehouse className="h-4 w-4" />, section: 'designated' },
  { id: 'rental_boats', name: 'Rental Boats', icon: <Ship className="h-4 w-4" />, section: 'designated' },
  { id: 'boat_club', name: 'Boat Club', icon: <Users className="h-4 w-4" />, section: 'designated' },
  { id: 'fuel_dock', name: 'Fuel Dock', icon: <Fuel className="h-4 w-4" />, section: 'designated' },
  { id: 'transient', name: 'Transient', icon: <Anchor className="h-4 w-4" />, section: 'designated' },
  { id: 'restaurant', name: 'Restaurant', icon: <Utensils className="h-4 w-4" />, section: 'designated' },
  { id: 'ship_store', name: 'Ship Store', icon: <ShoppingCart className="h-4 w-4" />, section: 'designated' },
];

const allRevenueCategories = [...storageTypeCategories, ...designatedSpaceCategories];

const expenseCategories = [
  { id: 'payroll', name: 'Payroll & Benefits' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'repairs_maintenance', name: 'Repairs & Maintenance' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'professional_fees', name: 'Professional Fees' },
  { id: 'property_taxes', name: 'Property Taxes' },
  { id: 'management_fees', name: 'Management Fees' },
  { id: 'g_and_a', name: 'G&A' },
  { id: 'licenses_permits', name: 'Licenses & Permits' },
  { id: 'contract_services', name: 'Contract Services' },
  { id: 'bank_cc_fees', name: 'Bank/CC Fees' },
  { id: 'leases', name: 'Leases' },
  { id: 'other_expenses', name: 'Other Expenses' },
];

const segmentExpenseCategories = [
  { id: 'f_and_b', name: 'F&B', segment: true },
  { id: 'service', name: 'Service', segment: true },
  { id: 'parts', name: 'Parts', segment: true },
  { id: 'rv_park', name: 'RV Park', segment: true },
  { id: 'hospitality', name: 'Hospitality', segment: true },
];

const allExpenseCategories = [...expenseCategories, ...segmentExpenseCategories];

const storageOptions = [
  { id: 'wet_slips', name: 'Wet Slips', totalUnits: 150 },
  { id: 'lift_slips', name: 'Lift Slips', totalUnits: 30 },
  { id: 'moorings', name: 'Moorings', totalUnits: 25 },
  { id: 'dinghies', name: 'Dinghies', totalUnits: 20 },
  { id: 'jet_skis', name: 'Jet Skis', totalUnits: 15 },
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', totalUnits: 100 },
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', totalUnits: 100 },
  { id: 'land_storage', name: 'Land Storage', totalUnits: 50 },
  { id: 'boats_on_trailers', name: 'Boats on Trailers', totalUnits: 40 },
  { id: 'trailers', name: 'Trailers', totalUnits: 30 },
  { id: 'carports', name: 'Carports', totalUnits: 20 },
  { id: 'houseboats', name: 'Houseboats', totalUnits: 10 },
  { id: 'rv_sites', name: 'RV Sites', totalUnits: 25 },
];

const scenarioTypeConfig: Record<ScenarioType, { label: string; color: string; icon: any }> = {
  base: { label: 'Base Case', color: 'bg-blue-500', icon: TrendingUp },
  aggressive: { label: 'Aggressive', color: 'bg-green-500', icon: TrendingUp },
  conservative: { label: 'Conservative', color: 'bg-orange-500', icon: TrendingUp },
  custom: { label: 'Custom', color: 'bg-purple-500', icon: GitBranch },
};

const statusConfig: Record<ScenarioStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: Clock },
  pending_approval: { label: 'Pending Approval', variant: 'outline', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
};

export default function WorkspaceAssumptions({ projectId, onTabChange }: WorkspaceAssumptionsProps) {
  const { toast } = useToast();
  const [activeScenarioType, setActiveScenarioType] = useState<ScenarioType>('base');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutoSaveStatus>('idle');
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });
  
  const { getLabel, getCaseColor } = useCaseLabels(project);

  const { data: scenarios = [], isLoading: scenariosLoading, refetch: refetchScenarios } = useQuery<Scenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
  });

  const { data: versionHistory = [] } = useQuery<Scenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios', activeScenarioType, 'history'],
    enabled: showHistoryDialog,
  });

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const initScenariosMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios/init`),
    onSuccess: () => {
      refetchScenarios();
      toast({ title: 'Initialized', description: 'Default scenarios have been created.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to initialize scenarios.', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!scenariosLoading && scenarios.length === 0) {
      initScenariosMutation.mutate();
    }
  }, [scenarios, scenariosLoading]);

  const activeScenario = scenarios.find(s => s.scenarioType === activeScenarioType && s.isCurrentVersion);
  const holdPeriod = config?.holdPeriod || 5;
  // Timeline derived from config (no hardcoded years)
  const projectionStartYear = config?.projectionStartDate 
    ? new Date(config.projectionStartDate).getFullYear() 
    : (config?.acquisitionCloseDate 
      ? new Date(config.acquisitionCloseDate).getFullYear() 
      : new Date().getFullYear());
  const years = Array.from({ length: holdPeriod }, (_, i) => projectionStartYear + i);

  const revenueCategories = useMemo(() => {
    if (!config?.departments) return [];
    return allRevenueCategories.filter(cat => 
      config.departments[cat.id]?.isEnabled === true
    );
  }, [config]);

  // Storage type IDs for filtering
  const storageTypeIds = useMemo(() => storageTypeCategories.map(s => s.id), []);

  // Non-storage revenue categories (excludes storage types like Wet Slips, Dry Racks, etc.)
  const nonStorageRevenueCategories = useMemo(() => {
    return revenueCategories.filter(cat => !storageTypeIds.includes(cat.id));
  }, [revenueCategories, storageTypeIds]);

  // Storage revenue categories only
  const storageRevenueCategories = useMemo(() => {
    return revenueCategories.filter(cat => storageTypeIds.includes(cat.id));
  }, [revenueCategories, storageTypeIds]);

  const enabledProfitCenters = useMemo(() => {
    if (!config?.departments) return [];
    return Object.entries(config.departments)
      .filter(([_, dept]: [string, any]) => dept?.isEnabled === true)
      .map(([id, dept]: [string, any]) => ({
        id,
        name: dept.name || id.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        icon: storageTypesConfig.find(s => s.id === id)?.icon || 
              designatedSpaceCategories.find(d => d.id === id)?.icon || 
              <Warehouse className="h-4 w-4" />,
      }));
  }, [config]);

  const [growthRates, setGrowthRates] = useState<GrowthRates>({});
  const [expenseGrowth, setExpenseGrowth] = useState<GrowthRates>({});
  const [occupancy, setOccupancy] = useState<OccupancyData>({});
  const [margins, setMargins] = useState<MarginData>({});
  const [storageGrowth, setStorageGrowth] = useState<StorageGrowthData>({
    mode: 'universal',
    universalRate: 3,
    typeRates: {},
    locationRates: {},
  });
  const [expandedStorageTypes, setExpandedStorageTypes] = useState<Record<string, boolean>>({});
  const [expandedOccupancyTypes, setExpandedOccupancyTypes] = useState<Record<string, boolean>>({});

  const isUniversalRateSynced = useMemo(() => {
    if (storageRevenueCategories.length === 0) return true;
    return storageRevenueCategories.every(
      cat => (storageGrowth.typeRates[cat.id] ?? storageGrowth.universalRate) === storageGrowth.universalRate
    );
  }, [storageRevenueCategories, storageGrowth.typeRates, storageGrowth.universalRate]);
  const [occupancyViewMode, setOccupancyViewMode] = useState<'annualized' | 'monthly'>('annualized');

  const enabledStorageTypes = useMemo(() => {
    if (!config?.departments) return [];
    return storageTypesConfig.filter(st => 
      config.departments[st.id]?.isEnabled === true
    ).map(st => ({
      ...st,
      totalUnits: config.departments[st.id]?.totalUnits || 50,
      locations: st.locations.map(loc => ({
        ...loc,
        units: Math.floor((config.departments[st.id]?.totalUnits || 50) / st.locations.length),
      })),
    }));
  }, [config]);

  const toggleOccupancyTypeExpanded = (typeId: string) => {
    setExpandedOccupancyTypes(prev => ({ ...prev, [typeId]: !prev[typeId] }));
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getLocationOccupancy = (locationId: string, year: number, month?: number) => {
    if (month !== undefined) {
      return occupancy[`${locationId}_${year}_${month}`] ?? occupancy[locationId]?.[year] ?? 85;
    }
    return occupancy[locationId]?.[year] ?? 85;
  };

  const updateLocationOccupancy = (locationId: string, year: number, value: string, month?: number) => {
    const numValue = parseFloat(value) || 0;
    setOccupancy(prev => {
      if (month !== undefined) {
        return { ...prev, [`${locationId}_${year}_${month}`]: numValue };
      }
      return {
        ...prev,
        [locationId]: { ...(prev[locationId] || {}), [year]: numValue },
      };
    });
    setHasChanges(true);
    triggerAutosave();
  };

  const getStorageTypeAvgOccupancy = (storageType: typeof enabledStorageTypes[0], year: number) => {
    if (storageType.locations.length === 0) return 85;
    const sum = storageType.locations.reduce((acc, loc) => acc + getLocationOccupancy(loc.id, year), 0);
    return sum / storageType.locations.length;
  };

  const getYoYChange = (locationId: string, year: number) => {
    if (year === years[0]) return null;
    const currentOcc = getLocationOccupancy(locationId, year);
    const prevOcc = getLocationOccupancy(locationId, year - 1);
    return currentOcc - prevOcc;
  };

  const getNetAdds = (locationId: string, year: number, totalUnits: number) => {
    const currentOcc = getLocationOccupancy(locationId, year);
    const prevOcc = year === years[0] ? 85 : getLocationOccupancy(locationId, year - 1);
    const currentOccupied = Math.round((currentOcc / 100) * totalUnits);
    const prevOccupied = Math.round((prevOcc / 100) * totalUnits);
    return currentOccupied - prevOccupied;
  };

  useEffect(() => {
    if (activeScenario?.assumptions) {
      const assumptions = activeScenario.assumptions;
      setGrowthRates(assumptions.growthRates || getDefaultGrowthRates(activeScenarioType));
      setExpenseGrowth(assumptions.expenseGrowth || getDefaultExpenseGrowth(activeScenarioType));
      setOccupancy(assumptions.occupancy || getDefaultOccupancy(years));
      setMargins(assumptions.margins || getDefaultMargins());
      setStorageGrowth(assumptions.storageGrowth || getDefaultStorageGrowth(activeScenarioType));
      setHasChanges(false);
    } else {
      setGrowthRates(getDefaultGrowthRates(activeScenarioType));
      setExpenseGrowth(getDefaultExpenseGrowth(activeScenarioType));
      setOccupancy(getDefaultOccupancy(years));
      setMargins(getDefaultMargins());
      setStorageGrowth(getDefaultStorageGrowth(activeScenarioType));
      setHasChanges(false);
    }
  }, [activeScenario, activeScenarioType, holdPeriod]);

  function getDefaultGrowthRates(scenarioType: ScenarioType): GrowthRates {
    const baseRates: Record<ScenarioType, number> = {
      base: 3,
      aggressive: 5,
      conservative: 1.5,
      custom: 3,
    };
    const rate = baseRates[scenarioType];
    const defaultGrowth: GrowthRates = {};
    allRevenueCategories.forEach(cat => { defaultGrowth[cat.id] = rate; });
    return defaultGrowth;
  }

  function getDefaultExpenseGrowth(scenarioType: ScenarioType): GrowthRates {
    const baseRates: Record<ScenarioType, number> = {
      base: 2.5,
      aggressive: 2,
      conservative: 3,
      custom: 2.5,
    };
    const rate = baseRates[scenarioType];
    const defaultExpenseGrowth: GrowthRates = {};
    expenseCategories.forEach(cat => { defaultExpenseGrowth[cat.id] = rate; });
    return defaultExpenseGrowth;
  }

  function getDefaultOccupancy(years: number[]): OccupancyData {
    const defaultOccupancy: OccupancyData = {};
    storageOptions.forEach(opt => {
      defaultOccupancy[opt.id] = {};
      years.forEach(year => {
        defaultOccupancy[opt.id][year] = 85;
      });
    });
    return defaultOccupancy;
  }

  function getDefaultMargins(): MarginData {
    return {
      fuel_dock: { historical: 15, projected: 18 },
      ship_store: { historical: 35, projected: 38 },
    };
  }

  function getDefaultStorageGrowth(scenarioType: ScenarioType): StorageGrowthData {
    const baseRates: Record<ScenarioType, number> = {
      base: 3,
      aggressive: 5,
      conservative: 1.5,
      custom: 3,
    };
    const rate = baseRates[scenarioType];
    const typeRates: Record<string, number> = {};
    const locationRates: Record<string, number> = {};
    
    storageTypesConfig.forEach(type => {
      typeRates[type.id] = rate;
      type.locations.forEach(loc => {
        locationRates[loc.id] = rate;
      });
    });
    
    return {
      mode: 'universal',
      universalRate: rate,
      typeRates,
      locationRates,
    };
  }

  const statusResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const changesSinceSaveRef = useRef(false);
  const hasChangesRef = useRef(false);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
    if (pendingSaveRef.current) {
      changesSinceSaveRef.current = true;
    }
  }, [hasChanges, growthRates, expenseGrowth, occupancy, margins, storageGrowth]);

  const saveMutation = useMutation({
    mutationFn: ({ createNewVersion, isAutosave }: { createNewVersion: boolean; isAutosave?: boolean }) => {
      if (isAutosave) {
        setAutosaveStatus('saving');
        changesSinceSaveRef.current = false;
      }
      if (!activeScenario) {
        return apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
          scenarioType: activeScenarioType,
          name: getLabel(activeScenarioType as CaseType),
          revenueGrowthRate: Object.values(growthRates).reduce((a, b) => a + b, 0) / Object.values(growthRates).length,
          expenseGrowthRate: Object.values(expenseGrowth).reduce((a, b) => a + b, 0) / Object.values(expenseGrowth).length,
          assumptions: { growthRates, expenseGrowth, occupancy, margins, storageGrowth },
        });
      }
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions: { growthRates, expenseGrowth, occupancy, margins, storageGrowth },
        createNewVersion,
      });
    },
    onSuccess: (_, { createNewVersion, isAutosave }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      if (!changesSinceSaveRef.current) {
        setHasChanges(false);
      }
      if (isAutosave) {
        setAutosaveStatus('saved');
        if (statusResetTimerRef.current) {
          clearTimeout(statusResetTimerRef.current);
        }
        statusResetTimerRef.current = setTimeout(() => setAutosaveStatus('idle'), 3000);
      } else {
        toast({ 
          title: createNewVersion ? 'New Version Created' : 'Saved', 
          description: createNewVersion 
            ? `Version ${(activeScenario?.version || 0) + 1} has been created.`
            : 'Assumptions have been saved.' 
        });
      }
    },
    onError: (_, { isAutosave }) => {
      if (isAutosave) {
        setAutosaveStatus('error');
        if (statusResetTimerRef.current) {
          clearTimeout(statusResetTimerRef.current);
        }
        statusResetTimerRef.current = setTimeout(() => setAutosaveStatus('idle'), 5000);
      } else {
        toast({ title: 'Error', description: 'Failed to save assumptions.', variant: 'destructive' });
      }
    },
    onSettled: () => {
      pendingSaveRef.current = false;
      if (changesSinceSaveRef.current && hasChangesRef.current) {
        autosaveTimerRef.current = setTimeout(() => {
          if (!pendingSaveRef.current && hasChangesRef.current) {
            pendingSaveRef.current = true;
            saveMutation.mutate({ createNewVersion: false, isAutosave: true });
          }
        }, 500);
      }
    },
  });

  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      if (!pendingSaveRef.current && hasChangesRef.current) {
        pendingSaveRef.current = true;
        saveMutation.mutate({ createNewVersion: false, isAutosave: true });
      } else if (pendingSaveRef.current) {
        changesSinceSaveRef.current = true;
      }
    }, 2000);
  }, [saveMutation]);

  useEffect(() => {
    if (hasChanges) {
      triggerAutosave();
    }
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [hasChanges, growthRates, expenseGrowth, occupancy, margins, storageGrowth]);

  useEffect(() => {
    return () => {
      if (statusResetTimerRef.current) {
        clearTimeout(statusResetTimerRef.current);
      }
    };
  }, []);

  const submitMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios/${activeScenario?.id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      toast({ title: 'Submitted', description: 'Scenario submitted for approval.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit scenario.', variant: 'destructive' });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({ action, notes }: { action: 'approve' | 'reject'; notes?: string }) =>
      apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios/${activeScenario?.id}/${action}`, { notes }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      setShowApprovalDialog(false);
      setApprovalNotes('');
      toast({ 
        title: action === 'approve' ? 'Approved' : 'Rejected', 
        description: `Scenario has been ${action}d.` 
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to process approval.', variant: 'destructive' });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => 
      apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios/${versionId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      setShowHistoryDialog(false);
      toast({ title: 'Restored', description: 'Previous version has been restored.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to restore version.', variant: 'destructive' });
    },
  });

  // Timeline configuration mutation
  const timelineConfigMutation = useMutation({
    mutationFn: (updates: { projectionStartRule?: string; irrDisplayPreference?: string; stabilizedNoiMode?: string; stabilizedNoiYear?: number }) =>
      apiRequest('PATCH', `/api/modeling/projects/${projectId}/config/timeline`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'config'] });
      toast({ title: 'Saved', description: 'Timeline configuration updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save timeline configuration.', variant: 'destructive' });
    },
  });

  // Governance mutations (Phase 5)
  const forkMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios/${activeScenario?.id}/fork`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      toast({ title: 'Forked', description: 'Created editable copy of the approved scenario.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to fork scenario.', variant: 'destructive' });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (reason?: string) => apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios/${activeScenario?.id}/withdraw`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      toast({ title: 'Withdrawn', description: 'Approval submission withdrawn. You can now edit.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to withdraw submission.', variant: 'destructive' });
    },
  });

  const canModifyQuery = useQuery<{ canModify: boolean; reason?: string }>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios', activeScenario?.id, 'can-modify'],
    queryFn: () => apiRequest('GET', `/api/modeling/projects/${projectId}/scenarios/${activeScenario?.id}/can-modify`),
    enabled: !!activeScenario?.id,
  });

  const isScenarioLocked = activeScenario?.status === 'approved' || activeScenario?.status === 'pending_approval';

  const handleSave = (createNewVersion = false) => {
    saveMutation.mutate({ createNewVersion });
  };

  const updateGrowthRate = (categoryId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setGrowthRates(prev => ({ ...prev, [categoryId]: numValue }));
    setHasChanges(true);
  };

  const updateExpenseGrowth = (categoryId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setExpenseGrowth(prev => ({ ...prev, [categoryId]: numValue }));
    setHasChanges(true);
  };

  const updateOccupancy = (storageId: string, year: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setOccupancy(prev => ({
      ...prev,
      [storageId]: {
        ...prev[storageId],
        [year]: Math.min(100, Math.max(0, numValue)),
      },
    }));
    setHasChanges(true);
  };

  const updateMargin = (categoryId: string, field: 'historical' | 'projected', value: string) => {
    const numValue = parseFloat(value) || 0;
    setMargins(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [field]: Math.min(100, Math.max(0, numValue)),
      },
    }));
    setHasChanges(true);
  };

  const updateStorageGrowthMode = (mode: StorageGrowthMode) => {
    setStorageGrowth(prev => ({ ...prev, mode }));
    setHasChanges(true);
  };

  const updateStorageUniversalRate = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setStorageGrowth(prev => {
      const typeRates: Record<string, number> = {};
      const locationRates: Record<string, number> = {};
      storageTypesConfig.forEach(type => {
        typeRates[type.id] = numValue;
        type.locations.forEach(loc => {
          locationRates[loc.id] = numValue;
        });
      });
      return {
        ...prev,
        universalRate: numValue,
        typeRates,
        locationRates,
      };
    });
    setHasChanges(true);
  };

  const updateStorageTypeRate = (typeId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setStorageGrowth(prev => {
      const newLocationRates = { ...prev.locationRates };
      const storageType = storageTypesConfig.find(t => t.id === typeId);
      if (storageType) {
        storageType.locations.forEach(loc => {
          newLocationRates[loc.id] = numValue;
        });
      }
      return {
        ...prev,
        typeRates: { ...prev.typeRates, [typeId]: numValue },
        locationRates: newLocationRates,
      };
    });
    setHasChanges(true);
  };

  const reapplyUniversalRate = () => {
    const universalValue = storageGrowth.universalRate;
    setStorageGrowth(prev => {
      const typeRates: Record<string, number> = {};
      const locationRates: Record<string, number> = {};
      storageTypesConfig.forEach(type => {
        typeRates[type.id] = universalValue;
        type.locations.forEach(loc => {
          locationRates[loc.id] = universalValue;
        });
      });
      return {
        ...prev,
        typeRates,
        locationRates,
      };
    });
    setHasChanges(true);
  };

  const updateStorageLocationRate = (locationId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setStorageGrowth(prev => ({
      ...prev,
      locationRates: { ...prev.locationRates, [locationId]: numValue },
    }));
    setHasChanges(true);
  };

  const toggleStorageTypeExpanded = (typeId: string) => {
    setExpandedStorageTypes(prev => ({
      ...prev,
      [typeId]: !prev[typeId],
    }));
  };

  const StatusIcon = activeScenario ? statusConfig[activeScenario.status as ScenarioStatus]?.icon : Clock;

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="assumptions" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">Assumptions</h2>
          <p className="text-sm text-muted-foreground">
            Configure growth rates, occupancy projections, and COGS margins by scenario
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeScenario && (
            <>
              <Badge 
                variant={statusConfig[activeScenario.status as ScenarioStatus]?.variant || 'secondary'}
                className="flex items-center gap-1"
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig[activeScenario.status as ScenarioStatus]?.label || activeScenario.status}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                v{activeScenario.version}
              </Badge>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Tabs value={activeScenarioType} onValueChange={(v) => setActiveScenarioType(v as ScenarioType)}>
                <TabsList>
                  {(['base', 'aggressive', 'conservative'] as ScenarioType[]).map(type => {
                    const scenario = scenarios.find(s => s.scenarioType === type && s.isCurrentVersion);
                    return (
                      <TabsTrigger 
                        key={type} 
                        value={type}
                        className="flex items-center gap-2"
                        data-testid={`tab-scenario-${type}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${getCaseColor(type as CaseType)}`} />
                        {getLabel(type as CaseType)}
                        {scenario && (
                          <span className="text-xs text-muted-foreground">(v{scenario.version})</span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-3">
              <AutosaveIndicator status={autosaveStatus} showText size="sm" />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistoryDialog(true)}
                data-testid="button-version-history"
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    disabled={saveMutation.isPending || !hasChanges || isScenarioLocked}
                    data-testid="button-save-dropdown"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSave(false)} data-testid="button-save-current">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSave(true)} data-testid="button-save-new-version">
                    <Plus className="h-4 w-4 mr-2" />
                    Save as New Version
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => submitMutation.mutate()}
                    disabled={activeScenario?.status !== 'draft'}
                    data-testid="button-submit-approval"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Approval
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {activeScenario?.status === 'pending_approval' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" data-testid="button-review-dropdown">
                      Review
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => { setApprovalAction('approve'); setShowApprovalDialog(true); }}
                      data-testid="button-approve"
                    >
                      <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => { setApprovalAction('reject'); setShowApprovalDialog(true); }}
                      data-testid="button-reject"
                    >
                      <ThumbsDown className="h-4 w-4 mr-2 text-red-500" />
                      Reject
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              {/* Fork button for approved scenarios */}
              {activeScenario?.status === 'approved' && (
                <Button
                  variant="outline"
                  onClick={() => forkMutation.mutate()}
                  disabled={forkMutation.isPending}
                  data-testid="button-fork"
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  Fork to Edit
                </Button>
              )}

              {/* Withdraw button for pending scenarios */}
              {activeScenario?.status === 'pending_approval' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => withdrawMutation.mutate()}
                  disabled={withdrawMutation.isPending}
                  data-testid="button-withdraw"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Timeline & Model Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Model Configuration</CardTitle>
              <Badge variant="outline" className="text-xs">
                {years[0]} - {years[years.length - 1]}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTimelineSettings(!showTimelineSettings)}
            >
              {showTimelineSettings ? 'Hide' : 'Show'} Settings
              <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showTimelineSettings ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        {showTimelineSettings && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Projection Start</Label>
                <Select value={config?.projectionStartRule || 'acq_close_year'} onValueChange={(value) => timelineConfigMutation.mutate({ projectionStartRule: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acq_close_year">Acquisition Close Year</SelectItem>
                    <SelectItem value="next_full_calendar_year">Next Full Calendar Year</SelectItem>
                    <SelectItem value="ttm_plus_one_month">TTM End + 1 Month</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Determines when projections begin</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">IRR Display</Label>
                <Select value={config?.irrDisplayPreference || 'monthly'} onValueChange={(value) => timelineConfigMutation.mutate({ irrDisplayPreference: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly IRR (Default)</SelectItem>
                    <SelectItem value="annualized">Annualized IRR</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How IRR is displayed in reports</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Stabilized NOI</Label>
                <Select value={config?.stabilizedNoiMode || 'fixed_year'} onValueChange={(value) => timelineConfigMutation.mutate({ stabilizedNoiMode: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_year">Year 3 (Default)</SelectItem>
                    <SelectItem value="user_set">Custom Year/Month</SelectItem>
                    <SelectItem value="post_ramp">Post-Ramp Stabilization</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used in sensitivity analysis</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <div><span className="text-muted-foreground">Hold Period:</span> <span className="font-medium">{holdPeriod} years</span></div>
                <div><span className="text-muted-foreground">Projection:</span> <span className="font-medium">{years[0]} - {years[years.length - 1]}</span></div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth" data-testid="tab-growth">
            <TrendingUp className="h-4 w-4 mr-2" />
            Growth Rates
          </TabsTrigger>
          <TabsTrigger value="occupancy" data-testid="tab-occupancy">
            <Percent className="h-4 w-4 mr-2" />
            Occupancy
          </TabsTrigger>
          <TabsTrigger value="margins" data-testid="tab-margins">
            <DollarSign className="h-4 w-4 mr-2" />
            COGS Margins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-6">
          <GrowthRatesTab
            growthRates={growthRates}
            expenseGrowth={expenseGrowth}
            storageGrowth={storageGrowth}
            updateGrowthRate={updateGrowthRate}
            updateExpenseGrowth={updateExpenseGrowth}
            updateStorageGrowthMode={updateStorageGrowthMode}
            updateStorageUniversalRate={updateStorageUniversalRate}
            updateStorageTypeRate={updateStorageTypeRate}
            storageRevenueCategories={storageRevenueCategories}
            nonStorageRevenueCategories={nonStorageRevenueCategories}
            expenseCategories={expenseCategories}
            segmentExpenseCategories={segmentExpenseCategories}
            getDefaultGrowthRate={() => {
              const baseRates: Record<ScenarioType, number> = {
                base: 3,
                aggressive: 5,
                conservative: 1.5,
                custom: 3,
              };
              return baseRates[activeScenarioType];
            }}
            getDefaultExpenseRate={() => {
              const baseRates: Record<ScenarioType, number> = {
                base: 2.5,
                aggressive: 2,
                conservative: 3,
                custom: 2.5,
              };
              return baseRates[activeScenarioType];
            }}
            getDefaultStorageRate={() => {
              const baseRates: Record<ScenarioType, number> = {
                base: 3,
                aggressive: 5,
                conservative: 1.5,
                custom: 3,
              };
              return baseRates[activeScenarioType];
            }}
            triggerAutosave={triggerAutosave}
          />
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Occupancy Projections
                  </CardTitle>
                  <CardDescription>
                    Set occupancy rates by storage type and location across the hold period
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={occupancyViewMode} onValueChange={(v) => setOccupancyViewMode(v as 'annualized' | 'monthly')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annualized">Annualized</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {enabledStorageTypes.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  No storage types enabled. Enable them in Department Configuration.
                </p>
              )}
              {enabledStorageTypes.map((storageType) => (
                <div key={storageType.id} className="border rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggleOccupancyTypeExpanded(storageType.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {storageType.icon}
                      <span className="font-medium">{storageType.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {storageType.totalUnits} units
                      </Badge>
                      <Badge variant="outline" className="ml-1">
                        {storageType.locations.length} location{storageType.locations.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      {years.slice(0, 3).map(year => (
                        <div key={year} className="text-center">
                          <span className="text-xs text-muted-foreground">{year}</span>
                          <div className="font-medium text-sm">
                            {getStorageTypeAvgOccupancy(storageType, year).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {expandedOccupancyTypes[storageType.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {expandedOccupancyTypes[storageType.id] && (
                    <div className="border-t">
                      {occupancyViewMode === 'annualized' ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-48">Location</TableHead>
                                <TableHead className="w-16 text-right">Units</TableHead>
                                {years.map(year => (
                                  <TableHead key={year} className="text-center w-28">
                                    <div>{year}</div>
                                    <div className="text-[10px] text-muted-foreground font-normal">Occ% / YoY / Net</div>
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {storageType.locations.map((location) => (
                                <TableRow key={location.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      {location.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground text-sm">
                                    {location.units}
                                  </TableCell>
                                  {years.map(year => {
                                    const yoyChange = getYoYChange(location.id, year);
                                    const netAdds = getNetAdds(location.id, year, location.units);
                                    return (
                                      <TableCell key={year} className="p-1">
                                        <div className="flex flex-col items-center gap-0.5">
                                          <PercentInput
                                            value={getLocationOccupancy(location.id, year)}
                                            onChange={(val) => updateLocationOccupancy(location.id, year, val)}
                                            className="h-7 w-16 text-xs"
                                          />
                                          <div className="flex items-center gap-1 text-[10px]">
                                            {yoyChange !== null && (
                                              <span className={yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                                              </span>
                                            )}
                                            {yoyChange !== null && <span className="text-muted-foreground">|</span>}
                                            <span className={netAdds >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                                              {netAdds >= 0 ? '+' : ''}{netAdds}
                                            </span>
                                          </div>
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/30 font-medium">
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {storageType.icon}
                                    {storageType.name} Average
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{storageType.totalUnits}</TableCell>
                                {years.map(year => {
                                  const avgOcc = getStorageTypeAvgOccupancy(storageType, year);
                                  const prevAvgOcc = year === years[0] ? 85 : getStorageTypeAvgOccupancy(storageType, year - 1);
                                  const yoyChange = year === years[0] ? null : avgOcc - prevAvgOcc;
                                  const totalNetAdds = storageType.locations.reduce((sum, loc) => sum + getNetAdds(loc.id, year, loc.units), 0);
                                  return (
                                    <TableCell key={year} className="text-center">
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="font-semibold">{avgOcc.toFixed(1)}%</span>
                                        <div className="flex items-center gap-1 text-[10px]">
                                          {yoyChange !== null && (
                                            <span className={yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                              {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                                            </span>
                                          )}
                                          {yoyChange !== null && <span className="text-muted-foreground">|</span>}
                                          <span className={totalNetAdds >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                                            {totalNetAdds >= 0 ? '+' : ''}{totalNetAdds}
                                          </span>
                                        </div>
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="p-4 space-y-4">
                          {storageType.locations.map((location) => (
                            <div key={location.id} className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-sm">{location.name}</span>
                                <Badge variant="secondary" className="text-xs">{location.units} units</Badge>
                              </div>
                              {years.map(year => (
                                <div key={year} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium w-12">{year}</span>
                                    <div className="text-xs text-muted-foreground">
                                      Annual: {getLocationOccupancy(location.id, year).toFixed(1)}%
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-12 gap-1">
                                    {months.map((month, idx) => (
                                      <div key={month} className="text-center">
                                        <span className="text-[10px] text-muted-foreground">{month}</span>
                                        <PercentInput
                                          value={getLocationOccupancy(location.id, year, idx)}
                                          onChange={(val) => updateLocationOccupancy(location.id, year, val, idx)}
                                          className="h-6 w-full text-[10px] px-1"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="margins" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">COGS Margins</CardTitle>
              <CardDescription className="text-xs">
                Gross profit margins for departments with cost of goods sold. COGS = (1 - Margin%) x Revenue.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const cogsCategories = ['fuel_dock', 'ship_store', 'restaurant', 'service', 'rental_boats', 'parts'];
                const enabledCogsCategories = cogsCategories.filter(id => 
                  config?.departments?.[id]?.isEnabled === true
                );
                
                if (enabledCogsCategories.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground py-4">
                      No profit centers with COGS enabled. Enable Fuel Dock, Ship Store, Restaurant, Service, Rental Boats, or Parts in Department Configuration.
                    </p>
                  );
                }
                
                return (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {enabledCogsCategories.map((categoryId) => {
                      const category = revenueCategories.find(c => c.id === categoryId);
                      const margin = margins[categoryId] || { historical: 0, projected: 0 };
                      
                      return (
                        <div key={categoryId} className="p-3 rounded-lg border space-y-2">
                          <div className="flex items-center gap-2">
                            {category?.icon}
                            <span className="font-medium text-sm">{category?.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Historical</Label>
                              <PercentInput
                                value={margin.historical}
                                onChange={(val) => updateMargin(categoryId, 'historical', val)}
                                className="h-8 w-full"
                                data-testid={`input-margin-historical-${categoryId}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Projected</Label>
                              <PercentInput
                                value={margin.projected}
                                onChange={(val) => updateMargin(categoryId, 'projected', val)}
                                className="h-8 w-full"
                                data-testid={`input-margin-projected-${categoryId}`}
                              />
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            COGS multiplier: {((100 - (margin.projected || 0)) / 100).toFixed(2)}x
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History - {getLabel(activeScenarioType as CaseType)}
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of this scenario.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {versionHistory.map((version) => (
                <div 
                  key={version.id} 
                  className={`p-4 rounded-lg border ${version.isCurrentVersion ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={version.isCurrentVersion ? 'default' : 'outline'}>
                        v{version.version}
                      </Badge>
                      <div>
                        <p className="font-medium">{version.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={statusConfig[version.status as ScenarioStatus]?.variant || 'secondary'}
                        className="text-xs"
                      >
                        {statusConfig[version.status as ScenarioStatus]?.label || version.status}
                      </Badge>
                      {!version.isCurrentVersion && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreMutation.mutate(version.id)}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-restore-${version.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                  {version.description && (
                    <p className="text-sm text-muted-foreground mt-2">{version.description}</p>
                  )}
                </div>
              ))}
              {versionHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No version history available
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalAction === 'approve' ? (
                <><ThumbsUp className="h-5 w-5 text-green-500" /> Approve Scenario</>
              ) : (
                <><ThumbsDown className="h-5 w-5 text-red-500" /> Reject Scenario</>
              )}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' 
                ? 'Approving this scenario will mark it as ready for use in reporting and analysis.'
                : 'Rejecting this scenario will require revision before it can be approved.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notes (optional)</Label>
              <Input
                id="approval-notes"
                placeholder="Add any comments..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                data-testid="input-approval-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant={approvalAction === 'approve' ? 'default' : 'destructive'}
              onClick={() => approvalMutation.mutate({ action: approvalAction, notes: approvalNotes })}
              disabled={approvalMutation.isPending}
              data-testid={`button-confirm-${approvalAction}`}
            >
              {approvalMutation.isPending ? 'Processing...' : approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

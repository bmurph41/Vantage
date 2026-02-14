import {
  useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import {
  useQuery, useMutation } from '@tanstack/react-query';
import {
  queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AutosaveIndicator } from '@/components/ui/autosave-indicator';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { GrowthRatesTab } from '@/components/modeling/growth-rates/GrowthRatesTab';
import { SectionCard } from '@/components/modeling/growth-rates';
import { REVENUE_CATEGORIES } from '@/components/modeling/growth-rates';
import type { AutoSaveStatus } from '@/hooks/use-local-autosave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ScrollArea } from '@/components/ui/scroll-area';
import {
  useToast } from '@/hooks/use-toast';
import {
  useCaseLabels, type CaseType } from '@/hooks/useCaseLabels';
import type { ModelingProject } from '@shared/schema';
import type { ProjectConfig, ScenarioVersionComparison } from '@/types/modeling';
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
  Sailboat,
  Hash,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

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

function CountInput({
  value,
  onChange,
  className = '',
  max,
  id,
  'data-testid': dataTestId,
}: {
  value: number;
  onChange: (value: string) => void;
  className?: string;
  max?: number;
  id?: string;
  'data-testid'?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(String(Math.round(value)));

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(Math.round(value)));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(String(Math.round(value)));
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = Math.round(parseFloat(localValue) || 0);
    if (max !== undefined) parsed = Math.min(parsed, max);
    if (parsed < 0) parsed = 0;
    onChange(String(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  return (
    <Input
      id={id}
      type="text"
      value={isFocused ? localValue : String(Math.round(value))}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`text-right ${className}`}
      data-testid={dataTestId}
    />
  );
}

function NumericInput({
  value,
  onChange,
  className = '',
  disabled,
  placeholder,
}: {
  value: number | string;
  onChange: (val: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  const displayStr = isNaN(numVal) || value === '' ? '' : String(numVal);
  const [localValue, setLocalValue] = useState(displayStr);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(displayStr);
    }
  }, [displayStr, isFocused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={isFocused ? localValue : displayStr}
      placeholder={placeholder || '0'}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) {
          setLocalValue(v);
          const parsed = parseFloat(v);
          if (!isNaN(parsed)) onChange(parsed);
        }
      }}
      onFocus={() => {
        setIsFocused(true);
        setLocalValue(displayStr);
      }}
      onBlur={() => {
        setIsFocused(false);
        const parsed = parseFloat(localValue);
        onChange(isNaN(parsed) ? 0 : parsed);
      }}
      className={className}
      disabled={disabled}
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
type YearlyGrowthRates = Record<string, number[]>;
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
  universalRates: number[];
  typeRates: Record<string, number>;
  typeRatesByYear: Record<string, number[]>;
  locationRates: Record<string, number>;
}

function normalizeToYearlyArray(ratesOrNumber: number | number[] | undefined, holdPeriod: number, defaultRate: number): number[] {
  if (Array.isArray(ratesOrNumber)) {
    if (ratesOrNumber.length >= holdPeriod) return ratesOrNumber.slice(0, holdPeriod);
    return [...ratesOrNumber, ...Array(holdPeriod - ratesOrNumber.length).fill(ratesOrNumber[ratesOrNumber.length - 1] ?? defaultRate)];
  }
  if (typeof ratesOrNumber === 'number') return Array(holdPeriod).fill(ratesOrNumber);
  return Array(holdPeriod).fill(defaultRate);
}

function convertFlatToYearly(flatRates: Record<string, number>, holdPeriod: number, defaultRate: number): YearlyGrowthRates {
  const result: YearlyGrowthRates = {};
  for (const [key, val] of Object.entries(flatRates)) {
    result[key] = Array(holdPeriod).fill(val);
  }
  return result;
}

function convertYearlyToFlat(yearlyRates: YearlyGrowthRates): GrowthRates {
  const result: GrowthRates = {};
  for (const [key, arr] of Object.entries(yearlyRates)) {
    result[key] = arr[0] ?? 0;
  }
  return result;
}

function buildYearlyGrowthRatesForEngine(
  growthRates: YearlyGrowthRates,
  expenseGrowth: YearlyGrowthRates,
  storageGrowth: StorageGrowthData,
  years: number[],
): { revenue: Record<string, Record<string, number>>; expenses: Record<string, Record<string, number>> } {
  const revenue: Record<string, Record<string, number>> = {};
  const expenses: Record<string, Record<string, number>> = {};

  years.forEach((year, idx) => {
    const yearKey = String(year);
    revenue[yearKey] = {};
    expenses[yearKey] = {};

    for (const [catId, rates] of Object.entries(growthRates)) {
      revenue[yearKey][catId] = rates[idx] ?? rates[0] ?? 0;
    }

    if (storageGrowth.mode === 'universal') {
      const universalRate = storageGrowth.universalRates?.[idx] ?? storageGrowth.universalRate ?? 3;
      for (const [typeId] of Object.entries(storageGrowth.typeRatesByYear || storageGrowth.typeRates || {})) {
        revenue[yearKey][typeId] = universalRate;
      }
    } else {
      for (const [typeId, rates] of Object.entries(storageGrowth.typeRatesByYear || {})) {
        revenue[yearKey][typeId] = rates[idx] ?? (storageGrowth.typeRates?.[typeId] ?? storageGrowth.universalRate ?? 3);
      }
    }

    for (const [catId, rates] of Object.entries(expenseGrowth)) {
      expenses[yearKey][catId] = rates[idx] ?? rates[0] ?? 0;
    }
  });

  return { revenue, expenses };
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
  const [compareVersions, setCompareVersions] = useState<{ base?: string; compare?: string }>({});
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

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { data: rentRollMetrics } = useQuery<{
    occupancyRate: number;
    totalUnits: number;
    occupiedUnits: number;
    unitsByType: Record<string, { count: number; totalRent: number }>;
  }>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'metrics'],
  });

  const { data: rentRollUnits = [] } = useQuery<Array<{
    id: string;
    unitNumber: string;
    storageType: string;
    status: string;
    dock?: string;
    section?: string;
    monthlyRent: string;
  }>>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'],
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

  const nonStorageRevenueCategories = useMemo(() => {
    const allRevCats = [
      ...REVENUE_CATEGORIES.coreMarineRevenue,
      ...REVENUE_CATEGORIES.retailAndService,
      ...REVENUE_CATEGORIES.boats,
      ...REVENUE_CATEGORIES.leasesAndHospitality,
    ];
    return allRevCats.map(cat => ({ id: cat.id, name: cat.label, icon: <cat.icon className="h-4 w-4" /> }));
  }, []);

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

  const [growthRates, setGrowthRates] = useState<YearlyGrowthRates>({});
  const [expenseGrowth, setExpenseGrowth] = useState<YearlyGrowthRates>({});
  const [occupancy, setOccupancy] = useState<OccupancyData>({});
  const [margins, setMargins] = useState<MarginData>({});
  const [storageGrowth, setStorageGrowth] = useState<StorageGrowthData>({
    mode: 'universal',
    universalRate: 3,
    universalRates: Array(holdPeriod).fill(3),
    typeRates: {},
    typeRatesByYear: {},
    locationRates: {},
  });
  const [belowTheLine, setBelowTheLine] = useState({
    managementFeePct: 0,
    capexPct: 2,
    capexAmount: 0,
    reservesPct: 0,
    reservesAmount: 0,
  });
  const [exitAssumptions, setExitAssumptions] = useState({
    sellingFeePct: 2,
    loanExitFeePct: 0,
    workingCapitalRecoveryPct: 100,
    workingCapitalAmount: 0,
  });
  const [exitCapRateValue, setExitCapRateValue] = useState<number>(7.5);
  const [expandedStorageTypes, setExpandedStorageTypes] = useState<Record<string, boolean>>({});
  const [expandedOccupancyTypes, setExpandedOccupancyTypes] = useState<Record<string, boolean>>({});

  const isUniversalRateSynced = useMemo(() => {
    if (storageRevenueCategories.length === 0) return true;
    return storageRevenueCategories.every(
      cat => (storageGrowth.typeRates[cat.id] ?? storageGrowth.universalRate) === storageGrowth.universalRate
    );
  }, [storageRevenueCategories, storageGrowth.typeRates, storageGrowth.universalRate]);
  const [occupancyViewMode, setOccupancyViewMode] = useState<'annualized' | 'monthly'>('annualized');
  const [occupancyInputMode, setOccupancyInputMode] = useState<'percent' | 'count'>('percent');

  const storageTypeToConfigId: Record<string, string> = {
    'Wet Slip': 'wet_slips',
    'Dry Storage': 'dry_racks_indoor',
    'Dry Rack': 'dry_racks_indoor',
    'Dry Stack': 'dry_racks_outdoor',
    'Mooring': 'moorings',
    'Trailer Storage': 'trailers',
    'Lift Storage': 'lift_slips',
    'Other': 'land_storage',
  };

  const hasRentRollData = rentRollUnits.length > 0;

  const enabledStorageTypes = useMemo(() => {
    if (!config?.departments) return [];

    const enabledIds = Object.entries(config.departments)
      .filter(([_, dept]: [string, any]) => dept?.isEnabled === true)
      .map(([id]) => id);

    if (hasRentRollData && rentRollUnits.length > 0) {
      const groupedByType: Record<string, typeof rentRollUnits> = {};
      rentRollUnits.forEach(unit => {
        const type = unit.storageType || 'Other';
        if (!groupedByType[type]) groupedByType[type] = [];
        groupedByType[type].push(unit);
      });

      return Object.entries(groupedByType).map(([typeName, units]) => {
        const configId = storageTypeToConfigId[typeName] || typeName.toLowerCase().replace(/\s+/g, '_');
        const stConfig = storageTypesConfig.find(s => s.id === configId);

        const dockGroups: Record<string, typeof units> = {};
        units.forEach(u => {
          const locKey = u.dock || u.section || 'Main';
          if (!dockGroups[locKey]) dockGroups[locKey] = [];
          dockGroups[locKey].push(u);
        });

        const locations = Object.entries(dockGroups).map(([dockName, dockUnits]) => ({
          id: `${configId}_${dockName.toLowerCase().replace(/\s+/g, '_')}`,
          name: dockName,
          units: dockUnits.length,
          occupiedUnits: dockUnits.filter(u => u.status === 'occupied').length,
        }));

        return {
          id: configId,
          name: typeName,
          icon: stConfig?.icon || <Warehouse className="h-4 w-4" />,
          totalUnits: units.length,
          occupiedUnits: units.filter(u => u.status === 'occupied').length,
          locations,
          dataSource: 'rent_roll' as const,
        };
      });
    }

    return enabledIds
      .filter(id => storageTypesConfig.some(st => st.id === id))
      .map(id => {
        const stConfig = storageTypesConfig.find(s => s.id === id)!;
        const deptConfig = config.departments![id] as any;
        const totalUnits = deptConfig?.totalUnits || 0;
        return {
          id,
          name: stConfig.name,
          icon: stConfig.icon,
          totalUnits,
          occupiedUnits: 0,
          locations: [{
            id: `${id}_all`,
            name: 'All Units',
            units: totalUnits,
            occupiedUnits: 0,
          }],
          dataSource: (totalUnits > 0 ? 'setup_wizard' : 'placeholder') as 'setup_wizard' | 'placeholder',
        };
      })
      .filter(st => st.totalUnits > 0);
  }, [config, hasRentRollData, rentRollUnits]);

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

  const percentToCount = (percent: number, totalUnits: number) => Math.round((percent / 100) * totalUnits);
  const countToPercent = (count: number, totalUnits: number) => totalUnits > 0 ? (count / totalUnits) * 100 : 0;

  const getOccupancyCount = (locationId: string, year: number, totalUnits: number, month?: number) => {
    return percentToCount(getLocationOccupancy(locationId, year, month), totalUnits);
  };

  const updateOccupancyFromCount = (locationId: string, year: number, countStr: string, totalUnits: number, month?: number) => {
    const count = Math.round(parseFloat(countStr) || 0);
    const clampedCount = Math.max(0, Math.min(count, totalUnits));
    const percent = countToPercent(clampedCount, totalUnits);
    updateLocationOccupancy(locationId, year, String(percent), month);
  };

  const getStorageTypeOccupancy = (storageType: typeof enabledStorageTypes[0], year: number) => {
    if (storageType.locations.length === 0) return 85;
    const primaryLoc = storageType.locations[0];
    return getLocationOccupancy(primaryLoc.id, year);
  };

  const updateStorageTypeOccupancy = (storageType: typeof enabledStorageTypes[0], year: number, value: string, month?: number) => {
    storageType.locations.forEach(loc => {
      updateLocationOccupancy(loc.id, year, value, month);
    });
  };

  const updateStorageTypeOccupancyFromCount = (storageType: typeof enabledStorageTypes[0], year: number, countStr: string, month?: number) => {
    const count = Math.round(parseFloat(countStr) || 0);
    const clampedCount = Math.max(0, Math.min(count, storageType.totalUnits));
    const percent = countToPercent(clampedCount, storageType.totalUnits);
    storageType.locations.forEach(loc => {
      updateLocationOccupancy(loc.id, year, String(percent), month);
    });
  };

  useEffect(() => {
    if (activeScenario?.assumptions) {
      const assumptions = activeScenario.assumptions;
      const loadedGrowth = assumptions.growthRatesByYear || assumptions.growthRates || getDefaultGrowthRates(activeScenarioType);
      const loadedExpense = assumptions.expenseGrowthByYear || assumptions.expenseGrowth || getDefaultExpenseGrowth(activeScenarioType);

      const defaultRate = getDefaultGrowthRateValue(activeScenarioType);
      let parsedGrowth: YearlyGrowthRates;
      if (loadedGrowth && typeof Object.values(loadedGrowth)[0] === 'number') {
        parsedGrowth = convertFlatToYearly(loadedGrowth as Record<string, number>, holdPeriod, defaultRate);
      } else {
        parsedGrowth = {};
        for (const [key, val] of Object.entries(loadedGrowth as YearlyGrowthRates)) {
          parsedGrowth[key] = normalizeToYearlyArray(val, holdPeriod, defaultRate);
        }
      }
      const allRevCatIds = [
        ...REVENUE_CATEGORIES.coreMarineRevenue,
        ...REVENUE_CATEGORIES.retailAndService,
        ...REVENUE_CATEGORIES.boats,
        ...REVENUE_CATEGORIES.leasesAndHospitality,
      ];
      allRevCatIds.forEach(cat => {
        if (!parsedGrowth[cat.id]) parsedGrowth[cat.id] = Array(holdPeriod).fill(defaultRate);
      });
      setGrowthRates(parsedGrowth);

      if (loadedExpense && typeof Object.values(loadedExpense)[0] === 'number') {
        setExpenseGrowth(convertFlatToYearly(loadedExpense as Record<string, number>, holdPeriod, getDefaultExpenseRateValue(activeScenarioType)));
      } else {
        const yearly = loadedExpense as YearlyGrowthRates;
        const normalized: YearlyGrowthRates = {};
        for (const [key, val] of Object.entries(yearly)) {
          normalized[key] = normalizeToYearlyArray(val, holdPeriod, getDefaultExpenseRateValue(activeScenarioType));
        }
        setExpenseGrowth(normalized);
      }

      setOccupancy(assumptions.occupancy || getDefaultOccupancy(years));
      setMargins(assumptions.margins || getDefaultMargins());

      const loadedStorage = assumptions.storageGrowth || getDefaultStorageGrowth(activeScenarioType);
      const defaultStorageVal = getDefaultStorageRateValue(activeScenarioType);
      setStorageGrowth({
        ...loadedStorage,
        universalRates: normalizeToYearlyArray(loadedStorage.universalRates ?? loadedStorage.universalRate, holdPeriod, defaultStorageVal),
        typeRatesByYear: Object.fromEntries(
          Object.entries(loadedStorage.typeRatesByYear || loadedStorage.typeRates || {}).map(([k, v]: [string, any]) => [
            k,
            normalizeToYearlyArray(v, holdPeriod, defaultStorageVal),
          ])
        ),
      });

      setBelowTheLine(assumptions.belowTheLine || { managementFeePct: 0, capexPct: 2, capexAmount: 0, reservesPct: 0, reservesAmount: 0 });
      setExitAssumptions(assumptions.exitAssumptions || { sellingFeePct: 2, loanExitFeePct: 0, workingCapitalRecoveryPct: 100, workingCapitalAmount: 0 });
      setExitCapRateValue(activeScenario?.exitCapRate ? parseFloat(activeScenario.exitCapRate) * 100 : 7.5);
      setHasChanges(false);
    } else {
      setGrowthRates(getDefaultGrowthRates(activeScenarioType));
      setExpenseGrowth(getDefaultExpenseGrowth(activeScenarioType));
      setOccupancy(getDefaultOccupancy(years));
      setMargins(getDefaultMargins());
      setStorageGrowth(getDefaultStorageGrowth(activeScenarioType));
      setBelowTheLine({ managementFeePct: 0, capexPct: 2, capexAmount: 0, reservesPct: 0, reservesAmount: 0 });
      setExitAssumptions({ sellingFeePct: 2, loanExitFeePct: 0, workingCapitalRecoveryPct: 100, workingCapitalAmount: 0 });
      setExitCapRateValue(7.5);
      setHasChanges(false);
    }
  }, [activeScenario, activeScenarioType, holdPeriod]);

  function getDefaultGrowthRateValue(scenarioType: ScenarioType): number {
    const baseRates: Record<ScenarioType, number> = { base: 3, aggressive: 5, conservative: 1.5, custom: 3 };
    return baseRates[scenarioType];
  }

  function getDefaultExpenseRateValue(scenarioType: ScenarioType): number {
    const baseRates: Record<ScenarioType, number> = { base: 2.5, aggressive: 2, conservative: 3, custom: 2.5 };
    return baseRates[scenarioType];
  }

  function getDefaultStorageRateValue(scenarioType: ScenarioType): number {
    const baseRates: Record<ScenarioType, number> = { base: 3, aggressive: 5, conservative: 1.5, custom: 3 };
    return baseRates[scenarioType];
  }

  function getDefaultGrowthRates(scenarioType: ScenarioType): YearlyGrowthRates {
    const rate = getDefaultGrowthRateValue(scenarioType);
    const defaultGrowth: YearlyGrowthRates = {};
    allRevenueCategories.forEach(cat => { defaultGrowth[cat.id] = Array(holdPeriod).fill(rate); });
    const allRevCatIds = [
      ...REVENUE_CATEGORIES.coreMarineRevenue,
      ...REVENUE_CATEGORIES.retailAndService,
      ...REVENUE_CATEGORIES.boats,
      ...REVENUE_CATEGORIES.leasesAndHospitality,
    ];
    allRevCatIds.forEach(cat => {
      if (!defaultGrowth[cat.id]) defaultGrowth[cat.id] = Array(holdPeriod).fill(rate);
    });
    return defaultGrowth;
  }

  function getDefaultExpenseGrowth(scenarioType: ScenarioType): YearlyGrowthRates {
    const rate = getDefaultExpenseRateValue(scenarioType);
    const defaultExpenseGrowth: YearlyGrowthRates = {};
    expenseCategories.forEach(cat => { defaultExpenseGrowth[cat.id] = Array(holdPeriod).fill(rate); });
    return defaultExpenseGrowth;
  }

  function getDefaultOccupancy(years: number[]): OccupancyData {
    const defaultOccupancy: OccupancyData = {};
    enabledStorageTypes.forEach(st => {
      st.locations.forEach(loc => {
        const locOccRate = loc.units > 0 && loc.occupiedUnits > 0
          ? (loc.occupiedUnits / loc.units) * 100
          : (rentRollMetrics?.occupancyRate || 85);
        defaultOccupancy[loc.id] = {};
        years.forEach(year => {
          defaultOccupancy[loc.id][year] = Math.round(locOccRate * 10) / 10;
        });
      });
    });
    storageOptions.forEach(opt => {
      if (!defaultOccupancy[opt.id]) {
        defaultOccupancy[opt.id] = {};
        years.forEach(year => {
          defaultOccupancy[opt.id][year] = rentRollMetrics?.occupancyRate || 85;
        });
      }
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
    const rate = getDefaultStorageRateValue(scenarioType);
    const typeRates: Record<string, number> = {};
    const typeRatesByYear: Record<string, number[]> = {};
    const locationRates: Record<string, number> = {};
    
    storageTypesConfig.forEach(type => {
      typeRates[type.id] = rate;
      typeRatesByYear[type.id] = Array(holdPeriod).fill(rate);
      type.locations.forEach(loc => {
        locationRates[loc.id] = rate;
      });
    });
    
    return {
      mode: 'universal',
      universalRate: rate,
      universalRates: Array(holdPeriod).fill(rate),
      typeRates,
      typeRatesByYear,
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
  }, [hasChanges, growthRates, expenseGrowth, occupancy, margins, storageGrowth, belowTheLine, exitAssumptions, exitCapRateValue]);

  const saveMutation = useMutation({
    mutationFn: ({ createNewVersion, isAutosave }: { createNewVersion: boolean; isAutosave?: boolean }) => {
      if (isAutosave) {
        setAutosaveStatus('saving');
        changesSinceSaveRef.current = false;
      }
      const flatGrowth = convertYearlyToFlat(growthRates);
      const flatExpense = convertYearlyToFlat(expenseGrowth);
      const avgRevenue = Object.values(flatGrowth).length > 0 ? Object.values(flatGrowth).reduce((a, b) => a + b, 0) / Object.values(flatGrowth).length : 3;
      const avgExpense = Object.values(flatExpense).length > 0 ? Object.values(flatExpense).reduce((a, b) => a + b, 0) / Object.values(flatExpense).length : 2.5;
      const yearlyGrowthRatesForEngine = buildYearlyGrowthRatesForEngine(growthRates, expenseGrowth, storageGrowth, years);
      const assumptions = {
        growthRates: flatGrowth,
        growthRatesByYear: growthRates,
        expenseGrowth: flatExpense,
        expenseGrowthByYear: expenseGrowth,
        occupancy,
        margins,
        storageGrowth,
        belowTheLine,
        exitAssumptions,
        yearlyGrowthRates: yearlyGrowthRatesForEngine,
      };
      const exitCapRateDecimal = (exitCapRateValue / 100).toFixed(4);
      if (!activeScenario) {
        return apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
          scenarioType: activeScenarioType,
          name: getLabel(activeScenarioType as CaseType),
          revenueGrowthRate: avgRevenue,
          expenseGrowthRate: avgExpense,
          exitCapRate: exitCapRateDecimal,
          assumptions,
        });
      }
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions,
        exitCapRate: exitCapRateDecimal,
        createNewVersion,
      });
    },
    onSuccess: (_, { createNewVersion, isAutosave }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'dcf'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'deal-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
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
  }, [hasChanges, growthRates, expenseGrowth, occupancy, margins, storageGrowth, belowTheLine, exitAssumptions]);

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


  const comparisonQuery = useQuery<ScenarioVersionComparison>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios', 'compare', compareVersions.base, compareVersions.compare],
    queryFn: () => apiRequest('GET', `/api/modeling/projects/${projectId}/scenarios/compare?baseVersionId=${compareVersions.base}\&compareVersionId=${compareVersions.compare}`),
    enabled: !!compareVersions.base && !!compareVersions.compare,
  });
  const isScenarioLocked = activeScenario?.status === 'approved' || activeScenario?.status === 'pending_approval';

  const handleSave = (createNewVersion = false) => {
    saveMutation.mutate({ createNewVersion });
  };

  const updateGrowthRate = (categoryId: string, yearIndex: number, value: number) => {
    setGrowthRates(prev => {
      const existing = prev[categoryId] || Array(holdPeriod).fill(getDefaultGrowthRateValue(activeScenarioType));
      const updated = [...existing];
      updated[yearIndex] = value;
      return { ...prev, [categoryId]: updated };
    });
    setHasChanges(true);
  };

  const updateGrowthRateAllYears = (categoryId: string, value: number) => {
    setGrowthRates(prev => ({ ...prev, [categoryId]: Array(holdPeriod).fill(value) }));
    setHasChanges(true);
  };

  const updateExpenseGrowth = (categoryId: string, yearIndex: number, value: number) => {
    setExpenseGrowth(prev => {
      const existing = prev[categoryId] || Array(holdPeriod).fill(getDefaultExpenseRateValue(activeScenarioType));
      const updated = [...existing];
      updated[yearIndex] = value;
      return { ...prev, [categoryId]: updated };
    });
    setHasChanges(true);
  };

  const updateExpenseGrowthAllYears = (categoryId: string, value: number) => {
    setExpenseGrowth(prev => ({ ...prev, [categoryId]: Array(holdPeriod).fill(value) }));
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

  const updateStorageUniversalRate = (yearIndex: number, value: number) => {
    setStorageGrowth(prev => {
      const newUniversalRates = [...(prev.universalRates || Array(holdPeriod).fill(prev.universalRate))];
      newUniversalRates[yearIndex] = value;
      const newTypeRatesByYear = { ...prev.typeRatesByYear };
      storageTypesConfig.forEach(type => {
        const existing = newTypeRatesByYear[type.id] || Array(holdPeriod).fill(prev.universalRate);
        const updated = [...existing];
        updated[yearIndex] = value;
        newTypeRatesByYear[type.id] = updated;
      });
      return {
        ...prev,
        universalRate: newUniversalRates[0],
        universalRates: newUniversalRates,
        typeRatesByYear: newTypeRatesByYear,
      };
    });
    setHasChanges(true);
  };

  const updateStorageUniversalRateAllYears = (value: number) => {
    setStorageGrowth(prev => {
      const typeRates: Record<string, number> = {};
      const typeRatesByYear: Record<string, number[]> = {};
      const locationRates: Record<string, number> = {};
      storageTypesConfig.forEach(type => {
        typeRates[type.id] = value;
        typeRatesByYear[type.id] = Array(holdPeriod).fill(value);
        type.locations.forEach(loc => { locationRates[loc.id] = value; });
      });
      return {
        ...prev,
        universalRate: value,
        universalRates: Array(holdPeriod).fill(value),
        typeRates,
        typeRatesByYear,
        locationRates,
      };
    });
    setHasChanges(true);
  };

  const updateStorageTypeRate = (typeId: string, yearIndex: number, value: number) => {
    setStorageGrowth(prev => {
      const existing = prev.typeRatesByYear?.[typeId] || Array(holdPeriod).fill(prev.typeRates?.[typeId] ?? prev.universalRate);
      const updated = [...existing];
      updated[yearIndex] = value;
      return {
        ...prev,
        typeRates: { ...prev.typeRates, [typeId]: updated[0] },
        typeRatesByYear: { ...prev.typeRatesByYear, [typeId]: updated },
      };
    });
    setHasChanges(true);
  };

  const updateStorageTypeRateAllYears = (typeId: string, value: number) => {
    setStorageGrowth(prev => {
      const newLocationRates = { ...prev.locationRates };
      const storageType = storageTypesConfig.find(t => t.id === typeId);
      if (storageType) {
        storageType.locations.forEach(loc => { newLocationRates[loc.id] = value; });
      }
      return {
        ...prev,
        typeRates: { ...prev.typeRates, [typeId]: value },
        typeRatesByYear: { ...prev.typeRatesByYear, [typeId]: Array(holdPeriod).fill(value) },
        locationRates: newLocationRates,
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

  if (scenariosLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="assumptions" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">Assumptions</h2>
          <p className="text-sm text-muted-foreground">
            Configure growth rates, occupancy projections, and cash flow assumptions by scenario
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
              )}

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
          <TabsTrigger value="cashflow" data-testid="tab-cashflow">
            <DollarSign className="h-4 w-4 mr-2" />
            Cash Flow & Exit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-6">
          <GrowthRatesTab
            years={years}
            growthRates={growthRates}
            expenseGrowth={expenseGrowth}
            storageGrowth={storageGrowth}
            updateGrowthRate={updateGrowthRate}
            updateGrowthRateAllYears={updateGrowthRateAllYears}
            updateExpenseGrowth={updateExpenseGrowth}
            updateExpenseGrowthAllYears={updateExpenseGrowthAllYears}
            updateStorageGrowthMode={updateStorageGrowthMode}
            updateStorageUniversalRate={updateStorageUniversalRate}
            updateStorageUniversalRateAllYears={updateStorageUniversalRateAllYears}
            updateStorageTypeRate={updateStorageTypeRate}
            updateStorageTypeRateAllYears={updateStorageTypeRateAllYears}
            storageRevenueCategories={storageRevenueCategories}
            nonStorageRevenueCategories={nonStorageRevenueCategories}
            expenseCategories={expenseCategories}
            segmentExpenseCategories={segmentExpenseCategories}
            getDefaultGrowthRate={() => getDefaultGrowthRateValue(activeScenarioType)}
            getDefaultExpenseRate={() => getDefaultExpenseRateValue(activeScenarioType)}
            getDefaultStorageRate={() => getDefaultStorageRateValue(activeScenarioType)}
            triggerAutosave={triggerAutosave}
            margins={margins}
            updateMargin={(categoryId, field, value) => updateMargin(categoryId, field, String(value))}
            enabledDepartments={enabledProfitCenters.map(p => p.id)}
          />
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Percent className="h-4 w-4" />
                    Occupancy Projections
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Set occupancy by storage type across the hold period
                    {hasRentRollData && (
                      <span className="ml-1.5 text-blue-600">
                        &middot; Sourced from Rent Roll data ({rentRollUnits.length} units)
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setOccupancyInputMode('percent')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        occupancyInputMode === 'percent' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => setOccupancyInputMode('count')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        occupancyInputMode === 'count' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      Count
                    </button>
                  </div>
                  <Select value={occupancyViewMode} onValueChange={(v) => setOccupancyViewMode(v as 'annualized' | 'monthly')}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
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
            <CardContent className="pt-0">
              {enabledStorageTypes.length === 0 ? (
                <div className="py-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No storage types configured yet. Occupancy data can come from:
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                    <li>The <strong>Rent Roll</strong> tab (most detailed - unit-level dock/section breakdown)</li>
                    <li>The <strong>Setup Wizard</strong> storage mix entries (basic capacity &amp; occupancy)</li>
                    <li>Enable storage types in <strong>Department Configuration</strong></li>
                  </ul>
                </div>
              ) : occupancyViewMode === 'annualized' ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-40 text-xs">Storage Type</TableHead>
                        <TableHead className="w-14 text-right text-xs">Units</TableHead>
                        {years.map(year => (
                          <TableHead key={year} className="text-center text-xs min-w-[70px]">
                            {year}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enabledStorageTypes.map((storageType) => {
                        const isExpanded = expandedOccupancyTypes[storageType.id];
                        const hasMultipleLocations = storageType.locations.length > 1;
                        return (
                          <Fragment key={storageType.id}>
                            {hasMultipleLocations && (
                              <TableRow className="bg-muted/20">
                                <TableCell className="py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleOccupancyTypeExpanded(storageType.id)}
                                    className="flex items-center gap-1.5 text-sm font-medium cursor-pointer hover:text-primary"
                                  >
                                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    {storageType.icon}
                                    <span className="truncate">{storageType.name}</span>
                                    {storageType.dataSource === 'rent_roll' && (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1 text-blue-600 border-blue-200">Rent Roll</Badge>
                                    )}
                                    {storageType.dataSource === 'setup_wizard' && (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1 text-amber-600 border-amber-200">Setup</Badge>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground py-1.5">
                                  <span title="Total units">{storageType.totalUnits}</span>
                                </TableCell>
                                {years.map(year => {
                                  const avgOcc = getStorageTypeAvgOccupancy(storageType, year);
                                  const avgCount = percentToCount(avgOcc, storageType.totalUnits);
                                  return (
                                    <TableCell key={year} className="p-1 text-center">
                                      <div className="text-xs font-semibold">
                                        {occupancyInputMode === 'percent'
                                          ? `${avgOcc.toFixed(1)}%`
                                          : `${avgCount}`
                                        }
                                      </div>
                                      <div className="text-[9px] text-muted-foreground">
                                        avg &middot; {occupancyInputMode === 'percent'
                                          ? `${avgCount} units`
                                          : `${avgOcc.toFixed(1)}%`
                                        }
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            )}
                            {(!hasMultipleLocations || isExpanded) && storageType.locations.map((location) => (
                              <TableRow key={location.id}>
                                <TableCell className={`py-1 ${hasMultipleLocations ? 'pl-10' : 'pl-3'}`}>
                                  {hasMultipleLocations ? (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <MapPin className="h-2.5 w-2.5" />
                                      {location.name}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-sm font-medium">
                                      {storageType.icon}
                                      <span className="truncate">{storageType.name}</span>
                                      {storageType.dataSource === 'rent_roll' && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1 text-blue-600 border-blue-200">Rent Roll</Badge>
                                      )}
                                      {storageType.dataSource === 'setup_wizard' && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1 text-amber-600 border-amber-200">Setup</Badge>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-[11px] text-muted-foreground py-1">
                                  {hasMultipleLocations ? location.units : storageType.totalUnits}
                                </TableCell>
                                {years.map(year => {
                                  const locOccPercent = getLocationOccupancy(location.id, year);
                                  const locCount = percentToCount(locOccPercent, location.units);
                                  return (
                                    <TableCell key={year} className="p-0.5 text-center">
                                      {occupancyInputMode === 'percent' ? (
                                        <PercentInput
                                          value={locOccPercent}
                                          onChange={(val) => updateLocationOccupancy(location.id, year, val)}
                                          className="h-6 w-full text-[11px] mx-auto max-w-[60px]"
                                        />
                                      ) : (
                                        <CountInput
                                          value={locCount}
                                          max={location.units}
                                          onChange={(val) => updateOccupancyFromCount(location.id, year, val, location.units)}
                                          className="h-6 w-full text-[11px] mx-auto max-w-[60px]"
                                        />
                                      )}
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {occupancyInputMode === 'percent'
                                          ? `${locCount}`
                                          : `${locOccPercent.toFixed(1)}%`
                                        }
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="space-y-3">
                  {enabledStorageTypes.map((storageType) => {
                    const hasMultiLoc = storageType.locations.length > 1;
                    const locationsToShow = hasMultiLoc ? storageType.locations : [storageType.locations[0]];
                    return (
                      <div key={storageType.id} className="border rounded-lg">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
                          {storageType.icon}
                          <span className="font-medium text-sm">{storageType.name}</span>
                          <Badge variant="secondary" className="text-[10px] h-5">{storageType.totalUnits} units</Badge>
                          {storageType.dataSource === 'rent_roll' && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-blue-600 border-blue-200">Rent Roll</Badge>
                          )}
                          {storageType.dataSource === 'setup_wizard' && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-200">Setup</Badge>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs sticky left-0 bg-background z-10 min-w-[80px]">
                                  {hasMultiLoc ? 'Location / Year' : 'Year'}
                                </TableHead>
                                {months.map(m => (
                                  <TableHead key={m} className="text-center text-[10px] min-w-[52px] px-0.5">{m}</TableHead>
                                ))}
                                <TableHead className="text-center text-[10px] min-w-[52px] px-0.5 bg-muted/20 font-semibold">Avg</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {locationsToShow.map((location) => (
                                <Fragment key={location.id}>
                                  {hasMultiLoc && (
                                    <TableRow className="bg-muted/10">
                                      <TableCell colSpan={14} className="py-1 sticky left-0 bg-muted/10 z-10">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                          <MapPin className="h-2.5 w-2.5" />
                                          {location.name}
                                          <span className="text-[10px]">({location.units} units)</span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {years.map(year => {
                                    const locUnits = hasMultiLoc ? location.units : storageType.totalUnits;
                                    const monthValues = months.map((_, idx) => getLocationOccupancy(location.id, year, idx));
                                    const avgOcc = monthValues.reduce((a, b) => a + b, 0) / 12;
                                    return (
                                      <TableRow key={`${location.id}_${year}`}>
                                        <TableCell className="text-xs font-medium py-1 sticky left-0 bg-background z-10">{year}</TableCell>
                                        {months.map((_, idx) => {
                                          const monthOccPercent = getLocationOccupancy(location.id, year, idx);
                                          const monthCount = percentToCount(monthOccPercent, locUnits);
                                          return (
                                            <TableCell key={idx} className="p-0.5 text-center">
                                              {occupancyInputMode === 'percent' ? (
                                                <PercentInput
                                                  value={monthOccPercent}
                                                  onChange={(val) => updateLocationOccupancy(location.id, year, val, idx)}
                                                  className="h-6 w-full text-[10px] px-1"
                                                />
                                              ) : (
                                                <CountInput
                                                  value={monthCount}
                                                  max={locUnits}
                                                  onChange={(val) => updateOccupancyFromCount(location.id, year, val, locUnits, idx)}
                                                  className="h-6 w-full text-[10px] px-1"
                                                />
                                              )}
                                            </TableCell>
                                          );
                                        })}
                                        <TableCell className="text-center text-[10px] font-medium bg-muted/20 py-1">
                                          {occupancyInputMode === 'percent'
                                            ? `${avgOcc.toFixed(1)}%`
                                            : percentToCount(avgOcc, locUnits)
                                          }
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </Fragment>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            <div className="space-y-3">
              <SectionCard
                title="Below-the-Line Cash Flow"
                description="Items deducted from NOI to calculate Levered Cash Flow"
                accent="blue"
                icon={DollarSign}
              >
                <div className="space-y-4 p-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Management Fee (%)</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-24"
                          value={belowTheLine.managementFeePct}
                          onChange={(val) => {
                            setBelowTheLine(prev => ({ ...prev, managementFeePct: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                        <span className="text-xs text-muted-foreground">% of Gross Revenue</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">CapEx</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-24"
                          value={belowTheLine.capexPct}
                          onChange={(val) => {
                            setBelowTheLine(prev => ({ ...prev, capexPct: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                        <span className="text-xs text-muted-foreground">% of Revenue</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">or fixed $</span>
                        <NumericInput
                          className="w-28"
                          value={belowTheLine.capexAmount || ''}
                          placeholder="0"
                          onChange={(val) => {
                            setBelowTheLine(prev => ({ ...prev, capexAmount: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Fixed overrides % when &gt; 0</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Replacement Reserves</Label>
                    <div className="flex items-center gap-2">
                      <NumericInput
                        className="w-24"
                        value={belowTheLine.reservesPct}
                        onChange={(val) => {
                          setBelowTheLine(prev => ({ ...prev, reservesPct: val }));
                          setHasChanges(true);
                          changesSinceSaveRef.current = true;
                          hasChangesRef.current = true;
                        }}
                        disabled={isScenarioLocked}
                      />
                      <span className="text-xs text-muted-foreground">% of Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">or fixed $</span>
                      <NumericInput
                        className="w-28"
                        value={belowTheLine.reservesAmount || ''}
                        placeholder="0"
                        onChange={(val) => {
                          setBelowTheLine(prev => ({ ...prev, reservesAmount: val }));
                          setHasChanges(true);
                          changesSinceSaveRef.current = true;
                          hasChangesRef.current = true;
                        }}
                        disabled={isScenarioLocked}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Fixed overrides % when &gt; 0</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-lg">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Levered Cash Flow = NOI − Mgmt Fee − CapEx − Reserves − Debt Service</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Debt Service auto-calculated from Capital Stack.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="space-y-3">
              <SectionCard
                title="Exit Cap Rate"
                description="Terminal valuation based on cap rate"
                accent="emerald"
                icon={TrendingUp}
              >
                <div className="p-1">
                  <div className="flex items-center gap-4">
                    <div className="space-y-1.5 flex-1 max-w-xs">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Exit Cap Rate (%)</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-24"
                          value={exitCapRateValue}
                          onChange={(val) => {
                            setExitCapRateValue(val);
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Exit Value = Final Year NOI / Exit Cap Rate
                      </p>
                    </div>
                    {exitCapRateValue > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg">
                        <p className="text-[10px] text-muted-foreground">Implied Exit Multiple</p>
                        <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{(1 / (exitCapRateValue / 100)).toFixed(2)}x NOI</p>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Exit Assumptions"
                description="Costs applied when calculating net exit proceeds"
                accent="purple"
                icon={Shield}
              >
                <div className="space-y-4 p-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Selling Fees (%)</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-24"
                          value={exitAssumptions.sellingFeePct}
                          onChange={(val) => {
                            setExitAssumptions(prev => ({ ...prev, sellingFeePct: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                        <span className="text-xs text-muted-foreground">% of Exit Value</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Loan Exit Fee (%)</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-24"
                          value={exitAssumptions.loanExitFeePct}
                          onChange={(val) => {
                            setExitAssumptions(prev => ({ ...prev, loanExitFeePct: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                        <span className="text-xs text-muted-foreground">% of Loan Balance</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Working Capital ($)</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-28"
                          value={exitAssumptions.workingCapitalAmount || ''}
                          placeholder="0"
                          onChange={(val) => {
                            setExitAssumptions(prev => ({ ...prev, workingCapitalAmount: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">WC Recovery (%)</Label>
                      <div className="flex items-center gap-2">
                        <NumericInput
                          className="w-24"
                          value={exitAssumptions.workingCapitalRecoveryPct}
                          onChange={(val) => {
                            setExitAssumptions(prev => ({ ...prev, workingCapitalRecoveryPct: val }));
                            setHasChanges(true);
                            changesSinceSaveRef.current = true;
                            hasChangesRef.current = true;
                          }}
                          disabled={isScenarioLocked}
                        />
                        <span className="text-xs text-muted-foreground">% recovered at exit</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300">Net Exit = Exit Value − Selling Fees − Loan Payoff − Exit Fees + WC Recovery</p>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
                      Exit Value = Terminal NOI ÷ Cap Rate. Loan payoff from debt schedule.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
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
                      <Checkbox
                        checked={compareVersions.base === version.id || compareVersions.compare === version.id}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            if (!compareVersions.base) {
                              setCompareVersions({ base: version.id });
                            } else if (!compareVersions.compare) {
                              setCompareVersions({ ...compareVersions, compare: version.id });
                            }
                          } else {
                            if (compareVersions.base === version.id) {
                              setCompareVersions({ compare: compareVersions.compare });
                            } else {
                              setCompareVersions({ base: compareVersions.base });
                            }
                          }
                        }}
                      />
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

          {/* Version Comparison Panel */}
          {compareVersions.base && compareVersions.compare && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Version Comparison</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompareVersions({})}
                >
                  Clear Selection
                </Button>
              </div>
              {comparisonQuery.isLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading comparison...</div>
              ) : comparisonQuery.data ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-muted/50 rounded">
                      <Badge variant="outline" className="mb-2">v{comparisonQuery.data.baseVersion?.version}</Badge>
                      <p className="font-medium">{comparisonQuery.data.baseVersion?.name}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded">
                      <Badge variant="outline" className="mb-2">v{comparisonQuery.data.compareVersion?.version}</Badge>
                      <p className="font-medium">{comparisonQuery.data.compareVersion?.name}</p>
                    </div>
                  </div>
                  {comparisonQuery.data.changes?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Field Changes:</p>
                      <div className="space-y-1">
                        {comparisonQuery.data.changes.map((change: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1 px-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground">{change.field}</span>
                            <span>
                              <span className="text-red-500 line-through mr-2">{change.oldValue}</span>
                              <span className="text-green-500">{change.newValue}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {comparisonQuery.data.assumptionsDiff?.modified?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Assumption Changes ({comparisonQuery.data.assumptionsDiff.modified.length}):</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {comparisonQuery.data.assumptionsDiff.modified.slice(0, 10).map((change: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground truncate max-w-[150px]">{change.key}</span>
                            <span className="text-green-500 text-xs">Modified</span>
                          </div>
                        ))}
                        {comparisonQuery.data.assumptionsDiff.modified.length > 10 && (
                          <p className="text-xs text-muted-foreground">...and {comparisonQuery.data.assumptionsDiff.modified.length - 10} more</p>
                        )}
                      </div>
                    </div>
                  )}
                  {comparisonQuery.data.changes?.length === 0 && comparisonQuery.data.assumptionsDiff?.modified?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No differences found</p>
                  )}
                </div>
              ) : null}
            </div>
          )}
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

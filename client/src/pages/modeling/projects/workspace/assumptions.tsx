import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AutosaveIndicator } from '@/components/ui/autosave-indicator';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useCaseLabels, type CaseType } from '@/hooks/useCaseLabels';
import type { ModelingProject } from '@shared/schema';
import {
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
  Globe
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

interface WorkspaceAssumptionsProps {
  projectId: string;
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
  { id: 'dry_storage', name: 'Dry Storage', icon: <Warehouse className="h-4 w-4" />, locations: [
    { id: 'dry_storage_covered', name: 'Covered Racks' },
    { id: 'dry_storage_outdoor', name: 'Outdoor Racks' },
    { id: 'dry_storage_forklift', name: 'Forklift Access' },
  ]},
  { id: 'mooring', name: 'Mooring', icon: <Anchor className="h-4 w-4" />, locations: [
    { id: 'mooring_inner', name: 'Inner Harbor' },
    { id: 'mooring_outer', name: 'Outer Harbor' },
  ]},
  { id: 'covered_slips', name: 'Covered Slips', icon: <Warehouse className="h-4 w-4" />, locations: [
    { id: 'covered_slips_main', name: 'Main Marina' },
    { id: 'covered_slips_annex', name: 'Annex' },
  ]},
  { id: 'trailer_storage', name: 'Trailer Storage', icon: <Warehouse className="h-4 w-4" />, locations: [
    { id: 'trailer_storage_lot_a', name: 'Lot A' },
    { id: 'trailer_storage_lot_b', name: 'Lot B' },
  ]},
];

const allRevenueCategories = [
  { id: 'wet_slips', name: 'Wet Slips', icon: <Anchor className="h-4 w-4" /> },
  { id: 'dry_storage', name: 'Dry Storage', icon: <Warehouse className="h-4 w-4" /> },
  { id: 'annual_storage', name: 'Annual Storage', icon: <Warehouse className="h-4 w-4" /> },
  { id: 'rental_boats', name: 'Rental Boats', icon: <Ship className="h-4 w-4" /> },
  { id: 'fuel', name: 'Fuel Sales', icon: <Fuel className="h-4 w-4" /> },
  { id: 'ship_store', name: 'Ship Store', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'service_repair', name: 'Service & Repair' },
  { id: 'third_party_leases', name: 'Third-Party Leases' },
  { id: 'other_revenue', name: 'Other Revenue' },
];

const expenseCategories = [
  { id: 'payroll', name: 'Payroll & Benefits' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'repairs_maintenance', name: 'Repairs & Maintenance' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'professional_fees', name: 'Professional Fees' },
  { id: 'property_taxes', name: 'Property Taxes' },
  { id: 'management_fees', name: 'Management Fees' },
  { id: 'other_expenses', name: 'Other Expenses' },
];

const storageOptions = [
  { id: 'wet_slips', name: 'Wet Slips', totalUnits: 150 },
  { id: 'dry_racks', name: 'Dry Racks', totalUnits: 200 },
  { id: 'covered_slips', name: 'Covered Slips', totalUnits: 50 },
  { id: 'mooring_balls', name: 'Mooring Balls', totalUnits: 25 },
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

export default function WorkspaceAssumptions({ projectId }: WorkspaceAssumptionsProps) {
  const { toast } = useToast();
  const [activeScenarioType, setActiveScenarioType] = useState<ScenarioType>('base');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutoSaveStatus>('idle');
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
  const years = Array.from({ length: holdPeriod }, (_, i) => 2026 + i);

  const revenueCategories = useMemo(() => {
    if (!config?.departments) return allRevenueCategories;
    return allRevenueCategories.filter(cat => 
      config.departments[cat.id]?.isEnabled !== false
    );
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
      fuel: { historical: 15, projected: 18 },
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

  const saveMutation = useMutation({
    mutationFn: ({ createNewVersion, isAutosave }: { createNewVersion: boolean; isAutosave?: boolean }) => {
      if (isAutosave) {
        setAutosaveStatus('saving');
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
      setHasChanges(false);
      if (isAutosave) {
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 3000);
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
        setTimeout(() => setAutosaveStatus('idle'), 5000);
      } else {
        toast({ title: 'Error', description: 'Failed to save assumptions.', variant: 'destructive' });
      }
    },
  });

  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      if (hasChanges && activeScenario) {
        saveMutation.mutate({ createNewVersion: false, isAutosave: true });
      }
    }, 2000);
  }, [hasChanges, activeScenario, saveMutation]);

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
                    disabled={saveMutation.isPending || !hasChanges}
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
            </div>
          </div>
        </CardHeader>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    Storage Revenue Growth
                  </CardTitle>
                  <CardDescription>
                    Annual percentage increase for marina storage revenue by type or location
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={storageGrowth.mode} onValueChange={(v) => updateStorageGrowthMode(v as StorageGrowthMode)}>
                    <SelectTrigger className="w-[180px]" data-testid="select-storage-growth-mode">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="universal">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Universal Rate
                        </div>
                      </SelectItem>
                      <SelectItem value="per_type">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Per Storage Type
                        </div>
                      </SelectItem>
                      <SelectItem value="granular">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Granular (Dock/Location)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {storageGrowth.mode === 'universal' && (
                <div className="max-w-xs">
                  <Label htmlFor="storage-universal-rate" className="flex items-center gap-1.5 text-sm mb-1.5">
                    <Globe className="h-4 w-4" />
                    Universal Growth Rate
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Apply this rate to all storage types and locations
                  </p>
                  <PercentInput
                    id="storage-universal-rate"
                    value={storageGrowth.universalRate}
                    onChange={(val) => updateStorageUniversalRate(val)}
                    className="h-9 w-24"
                    data-testid="input-storage-universal-rate"
                  />
                </div>
              )}

              {storageGrowth.mode === 'per_type' && (
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {storageTypesConfig.map((storageType) => (
                    <div key={storageType.id} className="space-y-1">
                      <Label htmlFor={`storage-type-${storageType.id}`} className="flex items-center gap-1.5 text-sm">
                        {storageType.icon}
                        {storageType.name}
                      </Label>
                      <PercentInput
                        id={`storage-type-${storageType.id}`}
                        value={storageGrowth.typeRates[storageType.id] ?? 3}
                        onChange={(val) => updateStorageTypeRate(storageType.id, val)}
                        className="h-9 w-24"
                        data-testid={`input-storage-type-${storageType.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {storageType.locations.length} location{storageType.locations.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {storageGrowth.mode === 'granular' && (
                <div className="space-y-4">
                  {storageTypesConfig.map((storageType) => (
                    <div key={storageType.id} className="border rounded-lg">
                      <button
                        type="button"
                        onClick={() => toggleStorageTypeExpanded(storageType.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        data-testid={`button-expand-${storageType.id}`}
                      >
                        <div className="flex items-center gap-2">
                          {storageType.icon}
                          <span className="font-medium">{storageType.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {storageType.locations.length} locations
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            Avg: {(
                              storageType.locations.reduce(
                                (sum, loc) => sum + (storageGrowth.locationRates[loc.id] ?? 3),
                                0
                              ) / storageType.locations.length
                            ).toFixed(1)}%
                          </span>
                          {expandedStorageTypes[storageType.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                      
                      {expandedStorageTypes[storageType.id] && (
                        <div className="border-t p-4 bg-muted/20">
                          <div className="flex items-center gap-4 mb-4 pb-3 border-b">
                            <Label className="text-sm font-medium">Set all locations:</Label>
                            <PercentInput
                              value={storageGrowth.typeRates[storageType.id] ?? 3}
                              onChange={(val) => updateStorageTypeRate(storageType.id, val)}
                              className="h-8 w-20"
                              data-testid={`input-set-all-${storageType.id}`}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {storageType.locations.map((location) => (
                              <div key={location.id} className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-sm truncate">{location.name}</span>
                                </div>
                                <PercentInput
                                  value={storageGrowth.locationRates[location.id] ?? 3}
                                  onChange={(val) => updateStorageLocationRate(location.id, val)}
                                  className="h-8 w-20"
                                  data-testid={`input-location-${location.id}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revenue Growth Rates</CardTitle>
              <CardDescription className="text-xs">
                Annual percentage increase applied to trailing 12-month actuals
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-x-3 gap-y-2 grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {revenueCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2">
                    <Label htmlFor={`growth-${category.id}`} className="flex items-center gap-1 text-xs whitespace-nowrap min-w-0 flex-1">
                      {category.icon}
                      <span className="truncate">{category.name}</span>
                    </Label>
                    <PercentInput
                      id={`growth-${category.id}`}
                      value={growthRates[category.id] ?? 3}
                      onChange={(val) => updateGrowthRate(category.id, val)}
                      className="h-7 text-xs w-16 px-2"
                      data-testid={`input-growth-${category.id}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Expense Growth Rates</CardTitle>
              <CardDescription className="text-xs">
                Annual percentage increase for operating expenses
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-x-3 gap-y-2 grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {expenseCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2">
                    <Label htmlFor={`expense-${category.id}`} className="text-xs whitespace-nowrap min-w-0 flex-1 truncate">
                      {category.name}
                    </Label>
                    <PercentInput
                      id={`expense-${category.id}`}
                      value={expenseGrowth[category.id] ?? 2}
                      onChange={(val) => updateExpenseGrowth(category.id, val)}
                      className="h-7 text-xs w-16 px-2"
                      data-testid={`input-expense-${category.id}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Projections by Storage Type</CardTitle>
              <CardDescription>
                Set occupancy rates for each storage option across the hold period. 
                This drives storage revenue projections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Storage Type</TableHead>
                      <TableHead className="w-24 text-right">Units</TableHead>
                      {years.map(year => (
                        <TableHead key={year} className="text-center w-24">{year}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storageOptions.map((storage) => (
                      <TableRow key={storage.id}>
                        <TableCell className="font-medium">{storage.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {storage.totalUnits}
                        </TableCell>
                        {years.map(year => (
                          <TableCell key={year} className="p-1">
                            <PercentInput
                              value={occupancy[storage.id]?.[year] ?? 85}
                              onChange={(val) => updateOccupancy(storage.id, year, val)}
                              className="w-full"
                              data-testid={`input-occupancy-${storage.id}-${year}`}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="margins" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>COGS Margins</CardTitle>
              <CardDescription>
                Set gross profit margins for departments with cost of goods sold. 
                COGS is calculated as (1 - Margin%) x Revenue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['fuel', 'ship_store'].map((categoryId) => {
                  const category = revenueCategories.find(c => c.id === categoryId);
                  const margin = margins[categoryId] || { historical: 0, projected: 0 };
                  
                  return (
                    <div key={categoryId} className="p-4 rounded-lg border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {category?.icon}
                          <span className="font-medium">{category?.name}</span>
                        </div>
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            Historical Average
                          </Label>
                          <PercentInput
                            value={margin.historical}
                            onChange={(val) => updateMargin(categoryId, 'historical', val)}
                            className="w-32"
                            data-testid={`input-margin-historical-${categoryId}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Based on actual P&L data
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Projected Margin</Label>
                          <PercentInput
                            value={margin.projected}
                            onChange={(val) => updateMargin(categoryId, 'projected', val)}
                            className="w-32"
                            data-testid={`input-margin-projected-${categoryId}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Applied to Pro Forma projections
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          COGS = Revenue x (1 - {margin.projected || 0}%) = Revenue x {((100 - (margin.projected || 0)) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

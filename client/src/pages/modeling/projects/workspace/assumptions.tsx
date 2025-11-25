import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  RotateCcw,
  Send,
  ThumbsUp,
  ThumbsDown,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';

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

const revenueCategories = [
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

  const [growthRates, setGrowthRates] = useState<GrowthRates>({});
  const [expenseGrowth, setExpenseGrowth] = useState<GrowthRates>({});
  const [occupancy, setOccupancy] = useState<OccupancyData>({});
  const [margins, setMargins] = useState<MarginData>({});

  useEffect(() => {
    if (activeScenario?.assumptions) {
      const assumptions = activeScenario.assumptions;
      setGrowthRates(assumptions.growthRates || getDefaultGrowthRates(activeScenarioType));
      setExpenseGrowth(assumptions.expenseGrowth || getDefaultExpenseGrowth(activeScenarioType));
      setOccupancy(assumptions.occupancy || getDefaultOccupancy(years));
      setMargins(assumptions.margins || getDefaultMargins());
      setHasChanges(false);
    } else {
      setGrowthRates(getDefaultGrowthRates(activeScenarioType));
      setExpenseGrowth(getDefaultExpenseGrowth(activeScenarioType));
      setOccupancy(getDefaultOccupancy(years));
      setMargins(getDefaultMargins());
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
    revenueCategories.forEach(cat => { defaultGrowth[cat.id] = rate; });
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

  const saveMutation = useMutation({
    mutationFn: ({ createNewVersion }: { createNewVersion: boolean }) => {
      if (!activeScenario) {
        return apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
          scenarioType: activeScenarioType,
          name: scenarioTypeConfig[activeScenarioType].label,
          revenueGrowthRate: Object.values(growthRates).reduce((a, b) => a + b, 0) / Object.values(growthRates).length,
          expenseGrowthRate: Object.values(expenseGrowth).reduce((a, b) => a + b, 0) / Object.values(expenseGrowth).length,
          assumptions: { growthRates, expenseGrowth, occupancy, margins },
        });
      }
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions: { growthRates, expenseGrowth, occupancy, margins },
        createNewVersion,
      });
    },
    onSuccess: (_, { createNewVersion }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      setHasChanges(false);
      toast({ 
        title: createNewVersion ? 'New Version Created' : 'Saved', 
        description: createNewVersion 
          ? `Version ${(activeScenario?.version || 0) + 1} has been created.`
          : 'Assumptions have been saved.' 
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save assumptions.', variant: 'destructive' });
    },
  });

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
                    const config = scenarioTypeConfig[type];
                    const scenario = scenarios.find(s => s.scenarioType === type && s.isCurrentVersion);
                    return (
                      <TabsTrigger 
                        key={type} 
                        value={type}
                        className="flex items-center gap-2"
                        data-testid={`tab-scenario-${type}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${config.color}`} />
                        {config.label}
                        {scenario && (
                          <span className="text-xs text-muted-foreground">(v{scenario.version})</span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
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
              <CardTitle>Revenue Growth Rates</CardTitle>
              <CardDescription>
                Annual percentage increase applied to trailing 12-month actuals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {revenueCategories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <Label htmlFor={`growth-${category.id}`} className="flex items-center gap-2">
                      {category.icon}
                      {category.name}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`growth-${category.id}`}
                        type="number"
                        step="0.1"
                        value={growthRates[category.id] ?? 3}
                        onChange={(e) => updateGrowthRate(category.id, e.target.value)}
                        className="pr-8"
                        data-testid={`input-growth-${category.id}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expense Growth Rates</CardTitle>
              <CardDescription>
                Annual percentage increase for operating expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {expenseCategories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <Label htmlFor={`expense-${category.id}`}>{category.name}</Label>
                    <div className="relative">
                      <Input
                        id={`expense-${category.id}`}
                        type="number"
                        step="0.1"
                        value={expenseGrowth[category.id] ?? 2}
                        onChange={(e) => updateExpenseGrowth(category.id, e.target.value)}
                        className="pr-8"
                        data-testid={`input-expense-${category.id}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
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
                            <div className="relative">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={occupancy[storage.id]?.[year] ?? 85}
                                onChange={(e) => updateOccupancy(storage.id, year, e.target.value)}
                                className="w-full text-center pr-6"
                                data-testid={`input-occupancy-${storage.id}-${year}`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                              </span>
                            </div>
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
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              value={margin.historical}
                              onChange={(e) => updateMargin(categoryId, 'historical', e.target.value)}
                              className="pr-8"
                              data-testid={`input-margin-historical-${categoryId}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              %
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Based on actual P&L data
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Projected Margin</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              value={margin.projected}
                              onChange={(e) => updateMargin(categoryId, 'projected', e.target.value)}
                              className="pr-8"
                              data-testid={`input-margin-projected-${categoryId}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              %
                            </span>
                          </div>
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
              Version History - {scenarioTypeConfig[activeScenarioType]?.label}
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

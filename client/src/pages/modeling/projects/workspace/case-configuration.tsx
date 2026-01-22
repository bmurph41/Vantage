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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ModelingProject, ModelingCase, ModelingScenarioTemplate } from '@shared/schema';
import {
  Plus,
  Save,
  RotateCcw,
  Settings2,
  Tag,
  TrendingUp,
  Target,
  Loader2,
  Trash2,
  Copy,
  Star,
  GripVertical,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  FileText,
  Globe,
  Building2,
  User,
  Bookmark
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ScenarioComparison from './scenario-comparison';

interface CaseConfigurationProps {
  projectId: string;
}

interface LeaseUpEntry {
  month: number;
  occupancy: number;
}

const CASE_COLORS = [
  { name: 'Blue', value: 'blue', bg: 'bg-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-500' },
  { name: 'Green', value: 'green', bg: 'bg-green-500', text: 'text-green-600', bgLight: 'bg-green-50', border: 'border-green-500' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-500' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-500' },
  { name: 'Red', value: 'red', bg: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50', border: 'border-red-500' },
  { name: 'Teal', value: 'teal', bg: 'bg-teal-500', text: 'text-teal-600', bgLight: 'bg-teal-50', border: 'border-teal-500' },
];


function getCaseColorClass(color: string | null): { bg: string; text: string; bgLight: string; border: string } {
  const found = CASE_COLORS.find(c => c.value === color);
  return found || CASE_COLORS[0];
}

function PercentInput({
  value,
  onChange,
  className = '',
  'data-testid': dataTestId,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
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
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const displayValue = isFocused ? localValue : `${(parseFloat(String(value)) || 0).toFixed(1)}%`;

  return (
    <Input
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

export default function CaseConfiguration({ projectId }: CaseConfigurationProps) {
  const { toast } = useToast();
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<ModelingCase | null>(null);
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseColor, setNewCaseColor] = useState('blue');
  const [newCaseDescription, setNewCaseDescription] = useState('');
  const [newRevenueGrowth, setNewRevenueGrowth] = useState('3.0');
  const [newExpenseGrowth, setNewExpenseGrowth] = useState('2.5');
  const [newExitCapRate, setNewExitCapRate] = useState('7.0');
  const [newOccupancyRate, setNewOccupancyRate] = useState('85');
  const [editedCase, setEditedCase] = useState<Partial<ModelingCase> | null>(null);
  const [leaseUpSchedule, setLeaseUpSchedule] = useState<LeaseUpEntry[]>([]);
  const [showLeaseUp, setShowLeaseUp] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { data: cases = [], isLoading: casesLoading, refetch: refetchCases } = useQuery<ModelingCase[]>({
    queryKey: ['/api/modeling/projects', projectId, 'cases'],
    enabled: !!projectId,
  });

  const { data: templates = [] } = useQuery<ModelingScenarioTemplate[]>({
    queryKey: ['/api/modeling/scenario-templates'],
  });

  useEffect(() => {
    if (cases.length > 0 && !activeCaseId) {
      const defaultCase = cases.find(c => c.isDefault) || cases[0];
      setActiveCaseId(defaultCase.id);
    }
  }, [cases, activeCaseId]);

  useEffect(() => {
    if (activeCaseId) {
      const activeCase = cases.find(c => c.id === activeCaseId);
      if (activeCase) {
        setEditedCase({ ...activeCase });
        const schedule = activeCase.leaseUpSchedule as LeaseUpEntry[] | null;
        setLeaseUpSchedule(schedule || []);
      }
    }
  }, [activeCaseId, cases]);

  const createCaseMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      color: string; 
      description: string;
      revenueGrowthRate?: string;
      expenseGrowthRate?: string;
      exitCapRate?: string;
      occupancyRate?: string;
    }) => {
      const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/cases`, {
        name: data.name,
        color: data.color,
        description: data.description,
        sortOrder: cases.length,
        isDefault: cases.length === 0,
        isEnabled: true,
        revenueGrowthRate: data.revenueGrowthRate,
        expenseGrowthRate: data.expenseGrowthRate,
        exitCapRate: data.exitCapRate,
        occupancyRate: data.occupancyRate,
      });
      return response.json();
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      setShowAddDialog(false);
      setNewCaseName('');
      setNewCaseColor('blue');
      setNewCaseDescription('');
      setNewRevenueGrowth('3.0');
      setNewExpenseGrowth('2.5');
      setNewExitCapRate('7.0');
      setNewOccupancyRate('85');
      setActiveCaseId(newCase.id);
      toast({ title: 'Scenario Created', description: `"${newCase.name}" has been created.` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create scenario.', variant: 'destructive' });
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: async (data: Partial<ModelingCase> & { id: string }) => {
      const { id, ...updates } = data;
      const response = await apiRequest('PATCH', `/api/modeling/cases/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Scenario Updated', description: 'Changes have been saved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update scenario.', variant: 'destructive' });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      await apiRequest('DELETE', `/api/modeling/cases/${caseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      setShowDeleteDialog(false);
      setCaseToDelete(null);
      if (activeCaseId === caseToDelete?.id) {
        const remaining = cases.filter(c => c.id !== caseToDelete?.id);
        setActiveCaseId(remaining[0]?.id || null);
      }
      toast({ title: 'Scenario Deleted', description: 'The scenario has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete scenario.', variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest('POST', `/api/modeling/cases/${caseId}/set-default`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Default Scenario Updated', description: 'This scenario is now the default.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to set default.', variant: 'destructive' });
    },
  });

  const cloneCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest('POST', `/api/modeling/cases/${caseId}/clone`);
      return response.json();
    },
    onSuccess: (clonedCase) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      setActiveCaseId(clonedCase.id);
      toast({ title: 'Scenario Cloned', description: `Created "${clonedCase.name}".` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to clone scenario.', variant: 'destructive' });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest('POST', `/api/modeling/scenario-templates/apply/${templateId}/project/${projectId}`);
      return response.json();
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      setActiveCaseId(newCase.id);
      toast({ title: 'Template Applied', description: `Created "${newCase.name}" from template.` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to apply template.', variant: 'destructive' });
    },
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: async (data: { caseId: string; name: string; description?: string; scope: string }) => {
      const response = await apiRequest('POST', `/api/modeling/scenario-templates/save-from-case/${data.caseId}`, {
        name: data.name,
        description: data.description,
        scope: data.scope,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/scenario-templates'] });
      toast({ title: 'Template Saved', description: 'Scenario saved as reusable template.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to save template.', variant: 'destructive' });
    },
  });

  const handleSaveCase = () => {
    if (!editedCase || !activeCaseId) return;
    updateCaseMutation.mutate({
      id: activeCaseId,
      name: editedCase.name,
      description: editedCase.description,
      color: editedCase.color,
      revenueGrowthRate: editedCase.revenueGrowthRate,
      expenseGrowthRate: editedCase.expenseGrowthRate,
      exitCapRate: editedCase.exitCapRate,
      occupancyRate: editedCase.occupancyRate,
      isEnabled: editedCase.isEnabled,
      leaseUpSchedule: leaseUpSchedule,
    });
  };

  const handleAddLeaseUpMonth = () => {
    const nextMonth = leaseUpSchedule.length > 0 
      ? Math.max(...leaseUpSchedule.map(l => l.month)) + 1 
      : 1;
    setLeaseUpSchedule([...leaseUpSchedule, { month: nextMonth, occupancy: 0.5 }]);
  };

  const handleUpdateLeaseUpEntry = (index: number, field: 'month' | 'occupancy', value: number) => {
    const updated = [...leaseUpSchedule];
    updated[index] = { ...updated[index], [field]: value };
    setLeaseUpSchedule(updated);
  };

  const handleRemoveLeaseUpEntry = (index: number) => {
    setLeaseUpSchedule(leaseUpSchedule.filter((_, i) => i !== index));
  };

  const activeCase = cases.find(c => c.id === activeCaseId);
  const colorClasses = getCaseColorClass(activeCase?.color || 'blue');

  if (projectLoading || casesLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Scenario Analysis
          </h2>
          <p className="text-muted-foreground">
            Create and customize modeling scenarios with unique assumptions and lease-up schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-scenario">
                <Plus className="h-4 w-4 mr-2" />
                Add Scenario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Scenario</DialogTitle>
                <DialogDescription>
                  Add a new modeling scenario with custom assumptions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-case-name">Scenario Name</Label>
                  <Input
                    id="new-case-name"
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="e.g., Optimistic Scenario"
                    data-testid="input-new-scenario-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-case-color">Color</Label>
                  <Select value={newCaseColor} onValueChange={setNewCaseColor}>
                    <SelectTrigger data-testid="select-new-case-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASE_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-case-description">Description (optional)</Label>
                  <Textarea
                    id="new-case-description"
                    value={newCaseDescription}
                    onChange={(e) => setNewCaseDescription(e.target.value)}
                    placeholder="Describe the assumptions for this scenario..."
                    data-testid="input-new-case-description"
                    rows={2}
                  />
                </div>
                
                <Separator className="my-2" />
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Key Assumptions
                  </Label>
                  <p className="text-xs text-muted-foreground">These values differentiate this scenario from others</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-revenue-growth" className="text-sm">Revenue Growth (%)</Label>
                    <Input
                      id="new-revenue-growth"
                      type="number"
                      step="0.1"
                      value={newRevenueGrowth}
                      onChange={(e) => setNewRevenueGrowth(e.target.value)}
                      placeholder="3.0"
                      className="bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-expense-growth" className="text-sm">Expense Growth (%)</Label>
                    <Input
                      id="new-expense-growth"
                      type="number"
                      step="0.1"
                      value={newExpenseGrowth}
                      onChange={(e) => setNewExpenseGrowth(e.target.value)}
                      placeholder="2.5"
                      className="bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-exit-cap-rate" className="text-sm">Exit Cap Rate (%)</Label>
                    <Input
                      id="new-exit-cap-rate"
                      type="number"
                      step="0.1"
                      value={newExitCapRate}
                      onChange={(e) => setNewExitCapRate(e.target.value)}
                      placeholder="7.0"
                      className="bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-occupancy-rate" className="text-sm">Occupancy Rate (%)</Label>
                    <Input
                      id="new-occupancy-rate"
                      type="number"
                      step="1"
                      value={newOccupancyRate}
                      onChange={(e) => setNewOccupancyRate(e.target.value)}
                      placeholder="85"
                      className="bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createCaseMutation.mutate({ 
                    name: newCaseName, 
                    color: newCaseColor, 
                    description: newCaseDescription,
                    revenueGrowthRate: newRevenueGrowth ? (parseFloat(newRevenueGrowth) / 100).toString() : undefined,
                    expenseGrowthRate: newExpenseGrowth ? (parseFloat(newExpenseGrowth) / 100).toString() : undefined,
                    exitCapRate: newExitCapRate ? (parseFloat(newExitCapRate) / 100).toString() : undefined,
                    occupancyRate: newOccupancyRate ? (parseFloat(newOccupancyRate) / 100).toString() : undefined,
                  })}
                  disabled={!newCaseName.trim() || createCaseMutation.isPending}
                  data-testid="button-create-scenario"
                >
                  {createCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Scenario'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Scenario Comparison Section - Shown First */}
      {cases.length >= 2 && (
        <>
          <ScenarioComparison projectId={projectId} />
          <Separator className="my-6" />
        </>
      )}

      {cases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Settings2 className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold mb-1">No Scenarios Yet</h3>
            <p className="text-muted-foreground text-center text-sm">
              Use the "Add Scenario" button above to create your first modeling scenario.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Scenarios ({cases.length})
              </CardTitle>
              <CardDescription>
                Select a scenario to configure
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-1 p-2">
                  {cases.map((modelCase) => {
                    const isActive = activeCaseId === modelCase.id;
                    const caseColor = getCaseColorClass(modelCase.color);
                    
                    return (
                      <button
                        key={modelCase.id}
                        onClick={() => setActiveCaseId(modelCase.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isActive 
                            ? `${caseColor.bgLight} ${caseColor.border} border-2` 
                            : 'hover:bg-muted border-2 border-transparent'
                        }`}
                        data-testid={`button-select-case-${modelCase.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-3 h-3 rounded-full ${caseColor.bg} flex-shrink-0`} />
                          <div className="text-left min-w-0 flex-1">
                            <div className="font-medium flex items-center gap-2">
                              {modelCase.name}
                              {modelCase.isDefault && (
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              )}
                            </div>
                            {modelCase.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {modelCase.description}
                              </div>
                            )}
                            {(modelCase.exitCapRate || modelCase.revenueGrowthRate) && (
                              <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                                {modelCase.exitCapRate && (
                                  <span className="font-medium">Cap: {(parseFloat(modelCase.exitCapRate) * 100).toFixed(1)}%</span>
                                )}
                                {modelCase.revenueGrowthRate && (
                                  <span className="font-medium">Rev: +{(parseFloat(modelCase.revenueGrowthRate) * 100).toFixed(1)}%</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {!modelCase.isEnabled && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">Disabled</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
            
            {templates.length > 0 && (
              <>
                <Separator />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    Global Templates
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {templates.slice(0, 5).map((template) => {
                      const templateColor = getCaseColorClass(template.color || 'blue');
                      const ScopeIcon = template.scope === 'global' ? Globe : template.scope === 'org' ? Building2 : User;
                      return (
                        <Button
                          key={template.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-auto py-2"
                          onClick={() => applyTemplateMutation.mutate(template.id)}
                          disabled={applyTemplateMutation.isPending}
                        >
                          <div className={`w-2 h-2 rounded-full ${templateColor.bg}`} />
                          <span className="flex-1 text-left truncate">{template.name}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ScopeIcon className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                {template.scope === 'global' ? 'Global template' : template.scope === 'org' ? 'Organization template' : 'Your template'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </>
            )}
          </Card>

          {activeCase && editedCase && (
            <Card className="lg:col-span-3">
              <CardHeader className={`${colorClasses.bgLight} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${colorClasses.bg}`} />
                    <div>
                      <CardTitle className={colorClasses.text}>
                        {activeCase.name}
                        {activeCase.isDefault && (
                          <Badge variant="secondary" className="ml-2">Default</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Configure assumptions and lease-up schedule
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cloneCaseMutation.mutate(activeCase.id)}
                            disabled={cloneCaseMutation.isPending}
                            data-testid="button-clone-case"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clone Scenario</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveAsTemplateMutation.mutate({
                              caseId: activeCase.id,
                              name: activeCase.name,
                              description: activeCase.description || '',
                              scope: 'org'
                            })}
                            disabled={saveAsTemplateMutation.isPending}
                            data-testid="button-save-as-template"
                          >
                            <Bookmark className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save as Reusable Template</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!activeCase.isDefault && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDefaultMutation.mutate(activeCase.id)}
                              disabled={setDefaultMutation.isPending}
                              data-testid="button-set-default"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Set as Default</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {cases.length > 1 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCaseToDelete(activeCase);
                                setShowDeleteDialog(true);
                              }}
                              data-testid="button-delete-case"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Case</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs defaultValue="general" className="space-y-6">
                  <TabsList data-testid="tabs-case-settings">
                    <TabsTrigger value="general" className="gap-2" data-testid="tab-general">
                      <Tag className="h-4 w-4" />
                      General
                    </TabsTrigger>
                    <TabsTrigger value="assumptions" className="gap-2" data-testid="tab-assumptions">
                      <TrendingUp className="h-4 w-4" />
                      Assumptions
                    </TabsTrigger>
                    <TabsTrigger value="lease-up" className="gap-2" data-testid="tab-lease-up">
                      <Calendar className="h-4 w-4" />
                      Lease-Up Schedule
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="case-name">Scenario Name</Label>
                        <Input
                          id="case-name"
                          value={editedCase.name || ''}
                          onChange={(e) => setEditedCase({ ...editedCase, name: e.target.value })}
                          placeholder="Enter scenario name"
                          data-testid="input-case-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="case-color">Color</Label>
                        <Select
                          value={editedCase.color || 'blue'}
                          onValueChange={(value) => setEditedCase({ ...editedCase, color: value })}
                        >
                          <SelectTrigger data-testid="select-case-color">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CASE_COLORS.map((color) => (
                              <SelectItem key={color.value} value={color.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                                  {color.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="case-description">Description</Label>
                      <Textarea
                        id="case-description"
                        value={editedCase.description || ''}
                        onChange={(e) => setEditedCase({ ...editedCase, description: e.target.value })}
                        placeholder="Describe the scenario and key assumptions..."
                        rows={3}
                        data-testid="input-case-description"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="case-enabled">Enable Scenario</Label>
                        <p className="text-sm text-muted-foreground">
                          Include in scenario comparisons and exports
                        </p>
                      </div>
                      <Switch
                        id="case-enabled"
                        checked={editedCase.isEnabled ?? true}
                        onCheckedChange={(checked) => setEditedCase({ ...editedCase, isEnabled: checked })}
                        data-testid="switch-case-enabled"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="assumptions" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Revenue Growth Rate</Label>
                            <p className="text-sm text-muted-foreground">Annual growth</p>
                          </div>
                          <PercentInput
                            value={parseFloat(editedCase.revenueGrowthRate || '0') * 100}
                            onChange={(val) => setEditedCase({
                              ...editedCase,
                              revenueGrowthRate: (val / 100).toFixed(4)
                            })}
                            className="w-24"
                            data-testid="input-revenue-growth"
                          />
                        </div>
                        <Slider
                          value={[parseFloat(editedCase.revenueGrowthRate || '0') * 100]}
                          onValueChange={([value]) => setEditedCase({
                            ...editedCase,
                            revenueGrowthRate: (value / 100).toFixed(4)
                          })}
                          min={-5}
                          max={15}
                          step={0.1}
                          data-testid="slider-revenue-growth"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Expense Growth Rate</Label>
                            <p className="text-sm text-muted-foreground">Annual growth</p>
                          </div>
                          <PercentInput
                            value={parseFloat(editedCase.expenseGrowthRate || '0') * 100}
                            onChange={(val) => setEditedCase({
                              ...editedCase,
                              expenseGrowthRate: (val / 100).toFixed(4)
                            })}
                            className="w-24"
                            data-testid="input-expense-growth"
                          />
                        </div>
                        <Slider
                          value={[parseFloat(editedCase.expenseGrowthRate || '0') * 100]}
                          onValueChange={([value]) => setEditedCase({
                            ...editedCase,
                            expenseGrowthRate: (value / 100).toFixed(4)
                          })}
                          min={0}
                          max={10}
                          step={0.1}
                          data-testid="slider-expense-growth"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Exit Cap Rate</Label>
                            <p className="text-sm text-muted-foreground">At disposition</p>
                          </div>
                          <PercentInput
                            value={parseFloat(editedCase.exitCapRate || '0') * 100}
                            onChange={(val) => setEditedCase({
                              ...editedCase,
                              exitCapRate: (val / 100).toFixed(4)
                            })}
                            className="w-24"
                            data-testid="input-exit-cap"
                          />
                        </div>
                        <Slider
                          value={[parseFloat(editedCase.exitCapRate || '0') * 100]}
                          onValueChange={([value]) => setEditedCase({
                            ...editedCase,
                            exitCapRate: (value / 100).toFixed(4)
                          })}
                          min={4}
                          max={12}
                          step={0.1}
                          data-testid="slider-exit-cap"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Occupancy Rate</Label>
                            <p className="text-sm text-muted-foreground">Target stabilized</p>
                          </div>
                          <PercentInput
                            value={parseFloat(editedCase.occupancyRate || '0') * 100}
                            onChange={(val) => setEditedCase({
                              ...editedCase,
                              occupancyRate: (val / 100).toFixed(4)
                            })}
                            className="w-24"
                            data-testid="input-occupancy"
                          />
                        </div>
                        <Slider
                          value={[parseFloat(editedCase.occupancyRate || '0') * 100]}
                          onValueChange={([value]) => setEditedCase({
                            ...editedCase,
                            occupancyRate: (value / 100).toFixed(4)
                          })}
                          min={50}
                          max={100}
                          step={1}
                          data-testid="slider-occupancy"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="lease-up" className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Monthly Lease-Up Schedule</h3>
                        <p className="text-sm text-muted-foreground">
                          Define occupancy ramp-up from acquisition to stabilization
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddLeaseUpMonth}
                        data-testid="button-add-lease-up-month"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Month
                      </Button>
                    </div>

                    {leaseUpSchedule.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8">
                          <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground text-sm">
                            No lease-up schedule defined. Add months to track occupancy ramp-up.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground px-3">
                          <div className="col-span-2">Month</div>
                          <div className="col-span-8">Occupancy</div>
                          <div className="col-span-2 text-right">Actions</div>
                        </div>
                        {leaseUpSchedule.map((entry, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-12 gap-4 items-center p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={entry.month}
                                onChange={(e) => handleUpdateLeaseUpEntry(index, 'month', parseInt(e.target.value) || 1)}
                                min={1}
                                className="w-full"
                                data-testid={`input-lease-up-month-${index}`}
                              />
                            </div>
                            <div className="col-span-8 flex items-center gap-3">
                              <Slider
                                value={[entry.occupancy * 100]}
                                onValueChange={([value]) => handleUpdateLeaseUpEntry(index, 'occupancy', value / 100)}
                                min={0}
                                max={100}
                                step={1}
                                className="flex-1"
                                data-testid={`slider-lease-up-occupancy-${index}`}
                              />
                              <span className="text-sm font-medium w-12 text-right">
                                {(entry.occupancy * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLeaseUpEntry(index)}
                                data-testid={`button-remove-lease-up-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <Separator className="my-6" />

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditedCase({ ...activeCase });
                      const schedule = activeCase.leaseUpSchedule as LeaseUpEntry[] | null;
                      setLeaseUpSchedule(schedule || []);
                    }}
                    data-testid="button-reset-changes"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleSaveCase}
                    disabled={updateCaseMutation.isPending}
                    data-testid="button-save-case"
                  >
                    {updateCaseMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{caseToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => caseToDelete && deleteCaseMutation.mutate(caseToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

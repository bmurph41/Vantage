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
import type { ModelingProject, ModelingCase } from '@shared/schema';
import {
  Plus,
  Save,
  RotateCcw,
  Settings2,
  Tag,
  TrendingUp,
  Percent,
  Target,
  Loader2,
  Trash2,
  Copy,
  Star,
  GripVertical,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

const DEFAULT_CASE_TEMPLATES = [
  { name: 'Base Case', color: 'blue', revenueGrowthRate: '0.03', expenseGrowthRate: '0.025', exitCapRate: '0.07', occupancyRate: '0.90' },
  { name: 'Conservative', color: 'orange', revenueGrowthRate: '0.015', expenseGrowthRate: '0.03', exitCapRate: '0.075', occupancyRate: '0.85' },
  { name: 'Aggressive', color: 'green', revenueGrowthRate: '0.05', expenseGrowthRate: '0.02', exitCapRate: '0.065', occupancyRate: '0.95' },
];

function getCaseColorClass(color: string | null): { bg: string; text: string; bgLight: string; border: string } {
  const found = CASE_COLORS.find(c => c.value === color);
  return found || CASE_COLORS[0];
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
    mutationFn: async (data: { name: string; color: string; description: string }) => {
      const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/cases`, {
        name: data.name,
        color: data.color,
        description: data.description,
        sortOrder: cases.length,
        isDefault: cases.length === 0,
        isEnabled: true,
      });
      return response.json();
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      setShowAddDialog(false);
      setNewCaseName('');
      setNewCaseColor('blue');
      setNewCaseDescription('');
      setActiveCaseId(newCase.id);
      toast({ title: 'Case Created', description: `"${newCase.name}" has been created.` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create case.', variant: 'destructive' });
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
      toast({ title: 'Case Updated', description: 'Changes have been saved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update case.', variant: 'destructive' });
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
      toast({ title: 'Case Deleted', description: 'The case has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete case.', variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest('POST', `/api/modeling/cases/${caseId}/set-default`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Default Case Updated', description: 'This case is now the default.' });
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
      toast({ title: 'Case Cloned', description: `Created "${clonedCase.name}".` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to clone case.', variant: 'destructive' });
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

  const handleCreateFromTemplate = (template: typeof DEFAULT_CASE_TEMPLATES[0]) => {
    createCaseMutation.mutate({
      name: template.name,
      color: template.color,
      description: '',
    });
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
            Case Configuration
          </h2>
          <p className="text-muted-foreground">
            Create and customize modeling scenarios with unique assumptions and lease-up schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-case">
                <Plus className="h-4 w-4 mr-2" />
                Add Case
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Case</DialogTitle>
                <DialogDescription>
                  Add a new modeling scenario with custom assumptions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-case-name">Case Name</Label>
                  <Input
                    id="new-case-name"
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="e.g., Optimistic Scenario"
                    data-testid="input-new-case-name"
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
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Quick Templates</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_CASE_TEMPLATES.map((template) => (
                      <Button
                        key={template.name}
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateFromTemplate(template)}
                        disabled={createCaseMutation.isPending}
                        data-testid={`button-template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createCaseMutation.mutate({ name: newCaseName, color: newCaseColor, description: newCaseDescription })}
                  disabled={!newCaseName.trim() || createCaseMutation.isPending}
                  data-testid="button-create-case"
                >
                  {createCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Case'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {cases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Cases Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first modeling case to start building scenarios.
            </p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CASE_TEMPLATES.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  onClick={() => handleCreateFromTemplate(template)}
                  disabled={createCaseMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Cases ({cases.length})
              </CardTitle>
              <CardDescription>
                Select a case to configure
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
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${caseColor.bg}`} />
                          <div className="text-left">
                            <div className="font-medium flex items-center gap-2">
                              {modelCase.name}
                              {modelCase.isDefault && (
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              )}
                            </div>
                            {modelCase.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {modelCase.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {!modelCase.isEnabled && (
                          <Badge variant="outline" className="text-xs">Disabled</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
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
                        <TooltipContent>Clone Case</TooltipContent>
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
                        <Label htmlFor="case-name">Case Name</Label>
                        <Input
                          id="case-name"
                          value={editedCase.name || ''}
                          onChange={(e) => setEditedCase({ ...editedCase, name: e.target.value })}
                          placeholder="Enter case name"
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
                        <Label htmlFor="case-enabled">Enable Case</Label>
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
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={parseFloat(editedCase.revenueGrowthRate || '0') * 100}
                              onChange={(e) => setEditedCase({
                                ...editedCase,
                                revenueGrowthRate: (parseFloat(e.target.value) / 100).toFixed(4)
                              })}
                              className="w-20 text-right"
                              step="0.1"
                              data-testid="input-revenue-growth"
                            />
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          </div>
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
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={parseFloat(editedCase.expenseGrowthRate || '0') * 100}
                              onChange={(e) => setEditedCase({
                                ...editedCase,
                                expenseGrowthRate: (parseFloat(e.target.value) / 100).toFixed(4)
                              })}
                              className="w-20 text-right"
                              step="0.1"
                              data-testid="input-expense-growth"
                            />
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          </div>
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
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={parseFloat(editedCase.exitCapRate || '0') * 100}
                              onChange={(e) => setEditedCase({
                                ...editedCase,
                                exitCapRate: (parseFloat(e.target.value) / 100).toFixed(4)
                              })}
                              className="w-20 text-right"
                              step="0.1"
                              data-testid="input-exit-cap"
                            />
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          </div>
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
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={parseFloat(editedCase.occupancyRate || '0') * 100}
                              onChange={(e) => setEditedCase({
                                ...editedCase,
                                occupancyRate: (parseFloat(e.target.value) / 100).toFixed(4)
                              })}
                              className="w-20 text-right"
                              step="1"
                              data-testid="input-occupancy"
                            />
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          </div>
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
            <AlertDialogTitle>Delete Case</AlertDialogTitle>
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

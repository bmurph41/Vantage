import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
} from 'recharts';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Edit2,
  Plus,
  Trash2,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/formatUtils';

type CategoryAggregation = {
  category: string;
  totalAmount: number;
  avgMonthlyAmount: number;
  minMonthlyAmount: number;
  maxMonthlyAmount: number;
  monthCount: number;
  subcategories: string[];
};

type SubcategoryAggregation = {
  subcategory: string;
  totalAmount: number;
  avgMonthlyAmount: number;
  minMonthlyAmount: number;
  maxMonthlyAmount: number;
  monthCount: number;
  lineItems: string[];
  yearlyTotals: { year: number; total: number }[];
};

type LineItemAggregation = {
  lineItem: string;
  totalAmount: number;
  avgMonthlyAmount: number;
  minMonthlyAmount: number;
  maxMonthlyAmount: number;
  monthCount: number;
  monthlyData: { year: number; month: number; amount: number }[];
  trend: 'increasing' | 'decreasing' | 'stable';
};

type FinancialPeriod = {
  id: string;
  periodType: string;
  periodLabel: string;
  periodYear: number | null;
};

type Adjustment = {
  id: string;
  modelingProjectId: string;
  periodLabel: string;
  scope: 'line_item' | 'department' | 'category';
  targetIdentifier: string;
  targetLabel: string;
  adjustmentType: 'absolute' | 'percentage' | 'replace';
  adjustmentValue: string;
  originalValue: string | null;
  reason: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
};

type FinancialSummary = {
  rawTotals: { revenue: number; cogs: number; expenses: number; noi: number };
  adjustedTotals: { revenue: number; cogs: number; expenses: number; noi: number };
  adjustments: Adjustment[];
  adjustmentImpact: { revenue: number; cogs: number; expenses: number; noi: number };
};

interface AnalyticsNormalizationProps {
  projectId: string;
}

export default function AnalyticsNormalization({ projectId }: AnalyticsNormalizationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<{
    scope: 'line_item' | 'department' | 'category';
    targetIdentifier: string;
    targetLabel: string;
    category: string;
    subcategory?: string;
    lineItem?: string;
    originalValue: number;
    existingAdjustment?: Adjustment;
  } | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustmentType: 'absolute' as 'absolute' | 'percentage' | 'replace',
    adjustmentValue: '',
    reason: '',
  });

  const { data: periods = [], isLoading: periodsLoading } = useQuery<FinancialPeriod[]>({
    queryKey: ['/api/modeling/projects', projectId, 'financial-periods'],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CategoryAggregation[]>({
    queryKey: ['/api/modeling/projects', projectId, 'analytics/categories'],
    enabled: !!projectId,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<FinancialSummary>({
    queryKey: ['/api/modeling/projects', projectId, 'analytics/summary', selectedPeriod || 'default'],
    enabled: !!projectId && !!selectedPeriod,
  });

  const { data: adjustments = [] } = useQuery<Adjustment[]>({
    queryKey: ['/api/modeling/projects', projectId, 'adjustments'],
    enabled: !!projectId,
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: {
      periodLabel: string;
      scope: 'line_item' | 'department' | 'category';
      targetIdentifier: string;
      targetLabel: string;
      adjustmentType: 'absolute' | 'percentage' | 'replace';
      adjustmentValue: string;
      originalValue: string;
      reason?: string;
    }) => {
      return apiRequest('POST', `/api/modeling/projects/${projectId}/adjustments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'analytics/summary'] });
      toast({ title: 'Adjustment created', description: 'The normalization adjustment has been saved.' });
      setAdjustmentDialogOpen(false);
      resetAdjustmentForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create adjustment', variant: 'destructive' });
    },
  });

  const updateAdjustmentMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Adjustment>) => {
      return apiRequest('PATCH', `/api/modeling/adjustments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'analytics/summary'] });
      toast({ title: 'Adjustment updated' });
      setAdjustmentDialogOpen(false);
      resetAdjustmentForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update adjustment', variant: 'destructive' });
    },
  });

  const toggleAdjustmentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/modeling/adjustments/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'analytics/summary'] });
    },
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/modeling/adjustments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'analytics/summary'] });
      toast({ title: 'Adjustment deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete adjustment', variant: 'destructive' });
    },
  });

  const resetAdjustmentForm = () => {
    setEditingAdjustment(null);
    setAdjustmentForm({ adjustmentType: 'absolute', adjustmentValue: '', reason: '' });
  };

  const openAdjustmentDialog = (params: typeof editingAdjustment) => {
    if (!params) return;
    setEditingAdjustment(params);
    if (params.existingAdjustment) {
      setAdjustmentForm({
        adjustmentType: params.existingAdjustment.adjustmentType,
        adjustmentValue: params.existingAdjustment.adjustmentValue,
        reason: params.existingAdjustment.reason || '',
      });
    } else {
      setAdjustmentForm({ adjustmentType: 'absolute', adjustmentValue: '', reason: '' });
    }
    setAdjustmentDialogOpen(true);
  };

  const handleSaveAdjustment = () => {
    if (!editingAdjustment || !selectedPeriod) return;
    
    const data = {
      periodLabel: selectedPeriod,
      scope: editingAdjustment.scope,
      targetIdentifier: editingAdjustment.targetIdentifier,
      targetLabel: editingAdjustment.targetLabel,
      adjustmentType: adjustmentForm.adjustmentType,
      adjustmentValue: adjustmentForm.adjustmentValue,
      originalValue: editingAdjustment.originalValue.toString(),
      reason: adjustmentForm.reason || undefined,
    };

    if (editingAdjustment.existingAdjustment) {
      updateAdjustmentMutation.mutate({
        id: editingAdjustment.existingAdjustment.id,
        ...data,
      });
    } else {
      createAdjustmentMutation.mutate(data);
    }
  };

  const getAdjustmentForTarget = (targetIdentifier: string): Adjustment | undefined => {
    return adjustments.find(
      adj => adj.targetIdentifier === targetIdentifier && adj.periodLabel === selectedPeriod
    );
  };

  const hasActiveAdjustment = (targetIdentifier: string): boolean => {
    const adj = getAdjustmentForTarget(targetIdentifier);
    return adj?.isActive ?? false;
  };

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (key: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubcategories(newExpanded);
  };

  const calculateAdjustedValue = (original: number, adjustment: Adjustment | undefined): number => {
    if (!adjustment || !adjustment.isActive) return original;
    
    const adjValue = parseFloat(adjustment.adjustmentValue) || 0;
    
    switch (adjustment.adjustmentType) {
      case 'absolute':
        return original + adjValue;
      case 'percentage':
        return original * (1 + adjValue / 100);
      case 'replace':
        return adjValue;
      default:
        return original;
    }
  };

  const formatImpact = (value: number): string => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${formatCurrency(value)}`;
  };

  if (periodsLoading || categoriesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const activeAdjustmentsCount = adjustments.filter(a => a.isActive && a.periodLabel === selectedPeriod).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Financial Analytics & Normalization
              </CardTitle>
              <CardDescription>
                Drill down into financial data and apply normalization adjustments for accurate modeling
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="period-select" className="text-sm font-medium">
                  Financial Period:
                </Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-48" id="period-select" data-testid="select-period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.periodLabel}>
                        {period.periodLabel}
                        {period.periodYear && ` (${period.periodYear})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeAdjustmentsCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Filter className="h-3 w-3" />
                  {activeAdjustmentsCount} Active Adjustment{activeAdjustmentsCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {selectedPeriod && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Raw Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(summary.rawTotals.revenue)}</p>
              {summary.adjustmentImpact.revenue !== 0 && (
                <p className={`text-sm mt-1 ${summary.adjustmentImpact.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatImpact(summary.adjustmentImpact.revenue)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Raw Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(summary.rawTotals.expenses + summary.rawTotals.cogs)}</p>
              {(summary.adjustmentImpact.expenses + summary.adjustmentImpact.cogs) !== 0 && (
                <p className={`text-sm mt-1 ${(summary.adjustmentImpact.expenses + summary.adjustmentImpact.cogs) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatImpact(summary.adjustmentImpact.expenses + summary.adjustmentImpact.cogs)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Raw NOI</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(summary.rawTotals.noi)}</p>
            </CardContent>
          </Card>

          <Card className="col-span-1 border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Normalized NOI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{formatCurrency(summary.adjustedTotals.noi)}</p>
              {summary.adjustmentImpact.noi !== 0 && (
                <p className={`text-sm mt-1 ${summary.adjustmentImpact.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatImpact(summary.adjustmentImpact.noi)} from raw
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Category Drill-Down
          </CardTitle>
          <CardDescription>
            Click on categories to expand and view departments and line items. Add adjustments at any level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No financial data available for this project.</p>
              <p className="text-sm mt-2">Import actuals data to enable analytics.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <CategoryRow
                  key={category.category}
                  category={category}
                  projectId={projectId}
                  selectedPeriod={selectedPeriod}
                  isExpanded={expandedCategories.has(category.category)}
                  onToggle={() => toggleCategory(category.category)}
                  expandedSubcategories={expandedSubcategories}
                  onToggleSubcategory={toggleSubcategory}
                  onOpenAdjustment={openAdjustmentDialog}
                  adjustments={adjustments}
                  hasActiveAdjustment={hasActiveAdjustment}
                  getAdjustmentForTarget={getAdjustmentForTarget}
                  onToggleAdjustment={(id, isActive) => toggleAdjustmentMutation.mutate({ id, isActive })}
                  onDeleteAdjustment={(id) => deleteAdjustmentMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {adjustments.length > 0 && (
        <Card data-tour="valuator-addbacks">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Adjustments
            </CardTitle>
            <CardDescription>
              Review and manage all normalization adjustments for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments
                  .filter(adj => adj.periodLabel === selectedPeriod || !selectedPeriod)
                  .map((adjustment) => (
                  <TableRow key={adjustment.id} className={!adjustment.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {adjustment.scope.replace('_', ' ')}
                        </Badge>
                        <span className="font-medium">{adjustment.targetLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{adjustment.adjustmentType}</TableCell>
                    <TableCell>
                      {adjustment.adjustmentType === 'percentage' 
                        ? `${adjustment.adjustmentValue}%`
                        : formatCurrency(parseFloat(adjustment.adjustmentValue) || 0)
                      }
                    </TableCell>
                    <TableCell>
                      {adjustment.originalValue 
                        ? formatCurrency(parseFloat(adjustment.originalValue))
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{adjustment.reason || '-'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={adjustment.isActive}
                        onCheckedChange={(checked) => toggleAdjustmentMutation.mutate({ id: adjustment.id, isActive: checked })}
                        data-testid={`toggle-adjustment-${adjustment.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAdjustmentMutation.mutate(adjustment.id)}
                        data-testid={`delete-adjustment-${adjustment.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAdjustment?.existingAdjustment ? 'Edit' : 'Add'} Normalization Adjustment
            </DialogTitle>
            <DialogDescription>
              Apply an adjustment to "{editingAdjustment?.targetLabel}" for accurate modeling.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Badge variant="outline" className="capitalize">
                  {editingAdjustment?.scope.replace('_', ' ')}
                </Badge>
                <span className="font-medium">{editingAdjustment?.targetLabel}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Original Value</Label>
              <div className="text-lg font-semibold">
                {editingAdjustment ? formatCurrency(editingAdjustment.originalValue) : '-'}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-type">Adjustment Type</Label>
              <Select
                value={adjustmentForm.adjustmentType}
                onValueChange={(value: 'absolute' | 'percentage' | 'replace') => 
                  setAdjustmentForm(prev => ({ ...prev, adjustmentType: value }))
                }
              >
                <SelectTrigger id="adjustment-type" data-testid="select-adjustment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Absolute (+/-)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="replace">Replace Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-value">
                {adjustmentForm.adjustmentType === 'percentage' ? 'Percentage' : 'Amount'}
              </Label>
              <div className="flex items-center gap-2">
                {adjustmentForm.adjustmentType !== 'percentage' && (
                  <span className="text-muted-foreground">$</span>
                )}
                <Input
                  id="adjustment-value"
                  type="number"
                  step="0.01"
                  placeholder={adjustmentForm.adjustmentType === 'percentage' ? 'e.g., -10' : 'e.g., 5000'}
                  value={adjustmentForm.adjustmentValue}
                  onChange={(e) => setAdjustmentForm(prev => ({ ...prev, adjustmentValue: e.target.value }))}
                  data-testid="input-adjustment-value"
                />
                {adjustmentForm.adjustmentType === 'percentage' && (
                  <span className="text-muted-foreground">%</span>
                )}
              </div>
              {adjustmentForm.adjustmentValue && editingAdjustment && (
                <div className="text-sm text-muted-foreground mt-1">
                  New value: {formatCurrency(
                    adjustmentForm.adjustmentType === 'absolute'
                      ? editingAdjustment.originalValue + (parseFloat(adjustmentForm.adjustmentValue) || 0)
                      : adjustmentForm.adjustmentType === 'percentage'
                        ? editingAdjustment.originalValue * (1 + (parseFloat(adjustmentForm.adjustmentValue) || 0) / 100)
                        : parseFloat(adjustmentForm.adjustmentValue) || 0
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Reason</Label>
              <Textarea
                id="adjustment-reason"
                placeholder="e.g., Non-recurring expense, owner salary normalization..."
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, reason: e.target.value }))}
                data-testid="input-adjustment-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAdjustment}
              disabled={!adjustmentForm.adjustmentValue || createAdjustmentMutation.isPending || updateAdjustmentMutation.isPending}
              data-testid="button-save-adjustment"
            >
              {createAdjustmentMutation.isPending || updateAdjustmentMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CategoryRowProps {
  category: CategoryAggregation;
  projectId: string;
  selectedPeriod: string;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSubcategories: Set<string>;
  onToggleSubcategory: (key: string) => void;
  onOpenAdjustment: (params: {
    scope: 'line_item' | 'department' | 'category';
    targetIdentifier: string;
    targetLabel: string;
    category: string;
    subcategory?: string;
    lineItem?: string;
    originalValue: number;
    existingAdjustment?: Adjustment;
  }) => void;
  adjustments: Adjustment[];
  hasActiveAdjustment: (targetIdentifier: string) => boolean;
  getAdjustmentForTarget: (targetIdentifier: string) => Adjustment | undefined;
  onToggleAdjustment: (id: string, isActive: boolean) => void;
  onDeleteAdjustment: (id: string) => void;
}

function CategoryRow({
  category,
  projectId,
  selectedPeriod,
  isExpanded,
  onToggle,
  expandedSubcategories,
  onToggleSubcategory,
  onOpenAdjustment,
  adjustments,
  hasActiveAdjustment,
  getAdjustmentForTarget,
  onToggleAdjustment,
  onDeleteAdjustment,
}: CategoryRowProps) {
  const { data: subcategories } = useQuery<SubcategoryAggregation[]>({
    queryKey: ['/api/modeling/projects', projectId, 'analytics/categories', category.category, 'subcategories'],
    enabled: isExpanded,
  });

  const categoryIdentifier = `${category.category}`;
  const categoryAdjustment = getAdjustmentForTarget(categoryIdentifier);
  const hasAdjustment = hasActiveAdjustment(categoryIdentifier);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={`border rounded-lg ${hasAdjustment ? 'border-primary/50 bg-primary/5' : ''}`}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {category.category}
                  {hasAdjustment && (
                    <Badge variant="secondary" className="text-xs">Adjusted</Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {category.subcategories.length} department{category.subcategories.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(category.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">
                  Avg: {formatCurrency(category.avgMonthlyAmount)}/mo
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAdjustment({
                          scope: 'category',
                          targetIdentifier: categoryIdentifier,
                          targetLabel: category.category,
                          category: category.category,
                          originalValue: category.totalAmount,
                          existingAdjustment: categoryAdjustment,
                        });
                      }}
                      data-testid={`adjust-category-${category.category}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add/Edit adjustment</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-2 space-y-2">
            {subcategories?.map((subcategory) => (
              <SubcategoryRow
                key={subcategory.subcategory}
                subcategory={subcategory}
                category={category.category}
                projectId={projectId}
                selectedPeriod={selectedPeriod}
                isExpanded={expandedSubcategories.has(`${category.category}|${subcategory.subcategory}`)}
                onToggle={() => onToggleSubcategory(`${category.category}|${subcategory.subcategory}`)}
                onOpenAdjustment={onOpenAdjustment}
                hasActiveAdjustment={hasActiveAdjustment}
                getAdjustmentForTarget={getAdjustmentForTarget}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface SubcategoryRowProps {
  subcategory: SubcategoryAggregation;
  category: string;
  projectId: string;
  selectedPeriod: string;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenAdjustment: (params: {
    scope: 'line_item' | 'department' | 'category';
    targetIdentifier: string;
    targetLabel: string;
    category: string;
    subcategory?: string;
    lineItem?: string;
    originalValue: number;
    existingAdjustment?: Adjustment;
  }) => void;
  hasActiveAdjustment: (targetIdentifier: string) => boolean;
  getAdjustmentForTarget: (targetIdentifier: string) => Adjustment | undefined;
}

function SubcategoryRow({
  subcategory,
  category,
  projectId,
  selectedPeriod,
  isExpanded,
  onToggle,
  onOpenAdjustment,
  hasActiveAdjustment,
  getAdjustmentForTarget,
}: SubcategoryRowProps) {
  const { data: lineItems } = useQuery<LineItemAggregation[]>({
    queryKey: ['/api/modeling/projects', projectId, 'analytics/categories', category, 'subcategories', subcategory.subcategory, 'line-items'],
    enabled: isExpanded,
  });

  const subcategoryIdentifier = `${category}|${subcategory.subcategory}`;
  const subcategoryAdjustment = getAdjustmentForTarget(subcategoryIdentifier);
  const hasAdjustment = hasActiveAdjustment(subcategoryIdentifier);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={`ml-6 border-l-2 pl-4 ${hasAdjustment ? 'border-l-primary bg-primary/5 rounded' : 'border-l-muted'}`}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/50 rounded px-2">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <div>
                <p className="font-medium flex items-center gap-2">
                  {subcategory.subcategory}
                  {hasAdjustment && (
                    <Badge variant="secondary" className="text-xs">Adjusted</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subcategory.lineItems.length} line item{subcategory.lineItems.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{formatCurrency(subcategory.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">
                  Range: {formatCurrency(subcategory.minMonthlyAmount)} - {formatCurrency(subcategory.maxMonthlyAmount)}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAdjustment({
                          scope: 'department',
                          targetIdentifier: subcategoryIdentifier,
                          targetLabel: subcategory.subcategory,
                          category,
                          subcategory: subcategory.subcategory,
                          originalValue: subcategory.totalAmount,
                          existingAdjustment: subcategoryAdjustment,
                        });
                      }}
                      data-testid={`adjust-subcategory-${subcategory.subcategory}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add/Edit adjustment</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {lineItems?.map((item) => {
              const lineItemIdentifier = `${category}|${subcategory.subcategory}|${item.lineItem}`;
              const lineItemAdjustment = getAdjustmentForTarget(lineItemIdentifier);
              const itemHasAdjustment = hasActiveAdjustment(lineItemIdentifier);

              return (
                <div
                  key={item.lineItem}
                  className={`ml-6 flex items-center justify-between py-2 px-3 rounded ${itemHasAdjustment ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-center gap-3">
                    {item.trend && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            {item.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-green-600" />}
                            {item.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-red-600" />}
                            {item.trend === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
                          </TooltipTrigger>
                          <TooltipContent>
                            Trend: {item.trend}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <div>
                      <p className="text-sm flex items-center gap-2">
                        {item.lineItem}
                        {itemHasAdjustment && (
                          <Badge variant="secondary" className="text-xs">Adjusted</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.monthCount} data points
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-8">
                      {item.monthlyData && item.monthlyData.length > 1 && (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.monthlyData.slice(-12)}>
                            <Area
                              type="monotone"
                              dataKey="amount"
                              stroke={item.trend === 'increasing' ? '#10b981' : item.trend === 'decreasing' ? '#ef4444' : '#6b7280'}
                              fill={item.trend === 'increasing' ? '#10b98120' : item.trend === 'decreasing' ? '#ef444420' : '#6b728020'}
                              strokeWidth={1.5}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="font-medium">{formatCurrency(item.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg: {formatCurrency(item.avgMonthlyAmount)}/mo
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenAdjustment({
                              scope: 'line_item',
                              targetIdentifier: lineItemIdentifier,
                              targetLabel: item.lineItem,
                              category,
                              subcategory: subcategory.subcategory,
                              lineItem: item.lineItem,
                              originalValue: item.totalAmount,
                              existingAdjustment: lineItemAdjustment,
                            })}
                            data-testid={`adjust-line-item-${item.lineItem}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add/Edit adjustment</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

import { useState } from 'react';
import { useModelingAddbacks, ADDBACK_REASONS, AddbackReasonType } from '@/hooks/useModelingAddbacks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Progress } from '@/components/ui/progress';
import {
  ArrowUpCircle,
  DollarSign,
  Edit2,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface AddbacksTrackerProps {
  projectId: string;
  availableYears?: number[];
  compact?: boolean;
}

export function AddbacksTracker({ 
  projectId, 
  availableYears = [2023, 2024, 2025],
  compact = false 
}: AddbacksTrackerProps) {
  const {
    addbacks,
    isLoading,
    createOrUpdate,
    deleteAddback,
    getAddbacksSummary,
    isPending,
  } = useModelingAddbacks(projectId);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAddback, setEditingAddback] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    lineItemId: '',
    reason: 'one_time' as AddbackReasonType,
    notes: '',
    periodType: 'yearly' as 'monthly' | 'yearly',
    values: availableYears.map(year => ({ year, amount: '' })),
  });

  const summary = getAddbacksSummary();

  const resetForm = () => {
    setFormData({
      lineItemId: '',
      reason: 'one_time',
      notes: '',
      periodType: 'yearly',
      values: availableYears.map(year => ({ year, amount: '' })),
    });
    setEditingAddback(null);
  };

  const handleSubmit = async () => {
    if (!formData.lineItemId.trim()) return;
    
    const validValues = formData.values.filter(v => v.amount && parseFloat(v.amount) !== 0);
    
    await createOrUpdate({
      lineItemId: formData.lineItemId,
      reason: formData.reason,
      notes: formData.notes || undefined,
      periodType: formData.periodType,
      values: validValues.map(v => ({
        year: v.year,
        amount: v.amount,
      })),
    });
    
    resetForm();
    setShowAddDialog(false);
  };

  const handleEdit = (addbackId: string) => {
    const addback = addbacks.find(a => a.id === addbackId);
    if (!addback) return;
    
    const valuesByYear: Record<number, string> = {};
    addback.values.forEach(v => {
      valuesByYear[v.year] = v.amount;
    });
    
    setFormData({
      lineItemId: addback.lineItemId,
      reason: (addback.reason || 'other') as AddbackReasonType,
      notes: addback.notes || '',
      periodType: addback.periodType as 'monthly' | 'yearly',
      values: availableYears.map(year => ({ 
        year, 
        amount: valuesByYear[year] || '' 
      })),
    });
    setEditingAddback(addbackId);
    setShowAddDialog(true);
  };

  const handleDelete = async (addbackId: string) => {
    if (confirm('Remove this addback? This cannot be undone.')) {
      await deleteAddback(addbackId);
    }
  };

  const getReasonLabel = (reason: string | null) => {
    const found = ADDBACK_REASONS.find(r => r.value === reason);
    return found?.label || 'Other';
  };

  const getReasonBadgeColor = (reason: string | null) => {
    switch (reason) {
      case 'one_time': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'owner_related': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'non_operating': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'management_fee': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'capex': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Addbacks
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAddDialog(true)}
              data-testid="button-add-addback-compact"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(summary.total)}</div>
              <div className="text-sm text-muted-foreground">{summary.count} adjustments</div>
            </div>
          </div>
          
          {addbacks.length > 0 && (
            <div className="mt-4 space-y-1">
              {Object.entries(summary.byReason).slice(0, 3).map(([reason, total]) => (
                <div key={reason} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{getReasonLabel(reason)}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        <AddbackDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          formData={formData}
          setFormData={setFormData}
          availableYears={availableYears}
          onSubmit={handleSubmit}
          onCancel={() => { resetForm(); setShowAddDialog(false); }}
          isEditing={!!editingAddback}
          isPending={isPending}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" />
              EBITDA Addbacks
            </CardTitle>
            <CardDescription>
              Track expense adjustments for normalized EBITDA calculation
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-addback">
            <Plus className="h-4 w-4 mr-2" />
            Add Addback
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                Total Addbacks
              </div>
              <div className="text-2xl font-bold">{formatCurrency(summary.total)}</div>
            </CardContent>
          </Card>
          
          {Object.entries(summary.byReason).slice(0, 3).map(([reason, total]) => (
            <Card key={reason} className="bg-muted/50">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1 truncate">
                  {getReasonLabel(reason)}
                </div>
                <div className="text-lg font-semibold">{formatCurrency(total)}</div>
                <Progress 
                  value={summary.total > 0 ? (total / summary.total) * 100 : 0} 
                  className="h-1 mt-2" 
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {addbacks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No addbacks recorded yet.</p>
            <p className="text-sm">Add line-item adjustments to calculate normalized EBITDA.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line Item</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Period Type</TableHead>
                {availableYears.map(year => (
                  <TableHead key={year} className="text-right">{year}</TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addbacks.map((addback) => {
                const valuesByYear: Record<number, string> = {};
                addback.values.forEach(v => {
                  valuesByYear[v.year] = v.amount;
                });
                const lineTotal = addback.values.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
                
                return (
                  <TableRow key={addback.id}>
                    <TableCell className="font-medium">{addback.lineItemId}</TableCell>
                    <TableCell>
                      <Badge className={getReasonBadgeColor(addback.reason)}>
                        {getReasonLabel(addback.reason)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{addback.periodType}</TableCell>
                    {availableYears.map(year => (
                      <TableCell key={year} className="text-right font-mono">
                        {valuesByYear[year] ? formatCurrency(parseFloat(valuesByYear[year])) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(addback.id)}
                                data-testid={`button-edit-addback-${addback.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(addback.id)}
                                data-testid={`button-delete-addback-${addback.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      
      <AddbackDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        formData={formData}
        setFormData={setFormData}
        availableYears={availableYears}
        onSubmit={handleSubmit}
        onCancel={() => { resetForm(); setShowAddDialog(false); }}
        isEditing={!!editingAddback}
        isPending={isPending}
      />
    </Card>
  );
}

interface AddbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: {
    lineItemId: string;
    reason: AddbackReasonType;
    notes: string;
    periodType: 'monthly' | 'yearly';
    values: { year: number; amount: string }[];
  };
  setFormData: (data: any) => void;
  availableYears: number[];
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  isPending: boolean;
}

function AddbackDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  availableYears,
  onSubmit,
  onCancel,
  isEditing,
  isPending,
}: AddbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            {isEditing ? 'Edit Addback' : 'Add Addback'}
          </DialogTitle>
          <DialogDescription>
            Flag a P&L line item as an addback for EBITDA normalization.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lineItemId">Line Item Name</Label>
            <Input
              id="lineItemId"
              value={formData.lineItemId}
              onChange={(e) => setFormData({ ...formData, lineItemId: e.target.value })}
              placeholder="e.g., Owner's Salary, Legal Settlement"
              disabled={isEditing}
              data-testid="input-addback-line-item"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reason">Addback Reason</Label>
            <Select 
              value={formData.reason} 
              onValueChange={(v: AddbackReasonType) => setFormData({ ...formData, reason: v })}
            >
              <SelectTrigger data-testid="select-addback-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDBACK_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    <div>
                      <div>{reason.label}</div>
                      <div className="text-xs text-muted-foreground">{reason.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="periodType">Period Type</Label>
            <Select 
              value={formData.periodType} 
              onValueChange={(v: 'monthly' | 'yearly') => setFormData({ ...formData, periodType: v })}
            >
              <SelectTrigger data-testid="select-period-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Addback Values</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Enter the amount to add back for each period
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {formData.values.map((value, idx) => (
                <div key={value.year} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{value.year}</Label>
                  <Input
                    type="number"
                    value={value.amount}
                    onChange={(e) => {
                      const newValues = [...formData.values];
                      newValues[idx].amount = e.target.value;
                      setFormData({ ...formData, values: newValues });
                    }}
                    placeholder="0"
                    data-testid={`input-addback-value-${value.year}`}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional context..."
              rows={2}
              data-testid="input-addback-notes"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={!formData.lineItemId.trim() || isPending}
            data-testid="button-save-addback"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? 'Update' : 'Add'} Addback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

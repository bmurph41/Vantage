import { useState } from 'react';
import { useDdFees, FEE_CATEGORIES, FeeCategoryType } from '@/hooks/useDdFees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Check,
  DollarSign,
  Edit2,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';
import { format } from 'date-fns';

interface DdFeesTrackerProps {
  projectId: string;
  compact?: boolean;
}

export function DdFeesTracker({ projectId, compact = false }: DdFeesTrackerProps) {
  const {
    fees,
    summary,
    isLoading,
    createFee,
    updateFee,
    deleteFee,
    markPaid,
    getUnpaidFees,
    isPending,
  } = useDdFees(projectId);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const [formData, setFormData] = useState({
    category: 'legal' as FeeCategoryType,
    description: '',
    amount: '',
    dateIncurred: '',
    invoiceNumber: '',
    notes: '',
    contactId: null as string | null,
    companyId: null as string | null,
  });

  const resetForm = () => {
    setFormData({
      category: 'legal',
      description: '',
      amount: '',
      dateIncurred: '',
      invoiceNumber: '',
      notes: '',
      contactId: null,
      companyId: null,
    });
    setEditingFee(null);
  };

  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) === 0) return;
    
    if (editingFee) {
      await updateFee({
        feeId: editingFee,
        data: {
          category: formData.category,
          description: formData.description || undefined,
          amount: formData.amount,
          dateIncurred: formData.dateIncurred || undefined,
          invoiceNumber: formData.invoiceNumber || undefined,
          notes: formData.notes || undefined,
        },
      });
    } else {
      await createFee({
        category: formData.category,
        description: formData.description || undefined,
        amount: formData.amount,
        dateIncurred: formData.dateIncurred || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        notes: formData.notes || undefined,
        contactId: formData.contactId,
        companyId: formData.companyId,
        taskId: null,
        datePaid: null,
        isPaid: false,
        paymentMethod: null,
        phase: null,
      });
    }
    
    resetForm();
    setShowAddDialog(false);
  };

  const handleEdit = (feeId: string) => {
    const fee = fees.find(f => f.id === feeId);
    if (!fee) return;
    
    setFormData({
      category: fee.category as FeeCategoryType,
      description: fee.description || '',
      amount: fee.amount,
      dateIncurred: fee.dateIncurred || '',
      invoiceNumber: fee.invoiceNumber || '',
      notes: fee.notes || '',
      contactId: fee.contactId,
      companyId: fee.companyId,
    });
    setEditingFee(feeId);
    setShowAddDialog(true);
  };

  const handleDelete = async (feeId: string) => {
    if (confirm('Delete this fee record? This cannot be undone.')) {
      await deleteFee(feeId);
    }
  };

  const handleMarkPaid = async (feeId: string) => {
    await markPaid({ feeId, datePaid: new Date().toISOString().split('T')[0] });
  };

  const getCategoryLabel = (category: string) => {
    const found = FEE_CATEGORIES.find(c => c.value === category);
    return found?.label || category;
  };

  const unpaidFees = getUnpaidFees();
  const filteredFees = activeTab === 'all' 
    ? fees 
    : activeTab === 'unpaid' 
      ? unpaidFees 
      : fees.filter(f => f.category === activeTab);

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
              <Receipt className="h-4 w-4" />
              DD Fees
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAddDialog(true)}
              data-testid="button-add-fee-compact"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-bold">{formatCurrency(summary?.totalFees || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Paid</span>
              <span className="text-green-600">{formatCurrency(summary?.paidFees || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Unpaid</span>
              <span className="text-amber-600">{formatCurrency(summary?.unpaidFees || 0)}</span>
            </div>
            <Progress 
              value={summary?.totalFees ? (summary.paidFees / summary.totalFees) * 100 : 0}
              className="h-2 mt-2"
            />
          </div>
        </CardContent>
        
        <FeeDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => { resetForm(); setShowAddDialog(false); }}
          isEditing={!!editingFee}
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
              <Receipt className="h-5 w-5" />
              Due Diligence Fees
            </CardTitle>
            <CardDescription>
              Track fees and expenses incurred during due diligence
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-fee">
            <Plus className="h-4 w-4 mr-2" />
            Add Fee
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                Total Fees
              </div>
              <div className="text-2xl font-bold">{formatCurrency(summary?.totalFees || 0)}</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                <Check className="h-4 w-4" />
                Paid
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(summary?.paidFees || 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-1">
                <FileText className="h-4 w-4" />
                Unpaid
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {formatCurrency(summary?.unpaidFees || 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Payment Progress</div>
              <Progress 
                value={summary?.totalFees ? (summary.paidFees / summary.totalFees) * 100 : 0}
                className="h-2 mt-3"
              />
              <div className="text-sm text-muted-foreground mt-1">
                {summary?.totalFees 
                  ? Math.round((summary.paidFees / summary.totalFees) * 100) 
                  : 0}% paid
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-fees-all">All ({fees.length})</TabsTrigger>
            <TabsTrigger value="unpaid" className="text-amber-600" data-testid="tab-fees-unpaid">
              Unpaid ({unpaidFees.length})
            </TabsTrigger>
            {summary?.byCategory?.slice(0, 4).map((cat) => (
              <TabsTrigger key={cat.category} value={cat.category} data-testid={`tab-fees-${cat.category}`}>
                {getCategoryLabel(cat.category)} ({cat.count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filteredFees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No fees recorded yet.</p>
            <p className="text-sm">Track legal, accounting, and other DD costs here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    <Badge variant="outline">{getCategoryLabel(fee.category)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {fee.description || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(parseFloat(fee.amount))}
                  </TableCell>
                  <TableCell>
                    {fee.dateIncurred ? format(new Date(fee.dateIncurred), 'MM/dd/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {fee.invoiceNumber || '-'}
                  </TableCell>
                  <TableCell>
                    {fee.isPaid ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Unpaid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        {!fee.isPaid && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                onClick={() => handleMarkPaid(fee.id)}
                                data-testid={`button-mark-paid-${fee.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as paid</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(fee.id)}
                              data-testid={`button-edit-fee-${fee.id}`}
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
                              onClick={() => handleDelete(fee.id)}
                              data-testid={`button-delete-fee-${fee.id}`}
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
              ))}
            </TableBody>
          </Table>
          </div>
        )}

        {summary?.byCategory && summary.byCategory.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-medium mb-4">Fees by Category</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {summary.byCategory.map((cat) => (
                <div key={cat.category} className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">{getCategoryLabel(cat.category)}</div>
                  <div className="text-lg font-semibold">{formatCurrency(parseFloat(cat.totalAmount))}</div>
                  <div className="text-xs text-muted-foreground">{cat.count} fee(s)</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <FeeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onCancel={() => { resetForm(); setShowAddDialog(false); }}
        isEditing={!!editingFee}
        isPending={isPending}
      />
    </Card>
  );
}

interface FeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: {
    category: FeeCategoryType;
    description: string;
    amount: string;
    dateIncurred: string;
    invoiceNumber: string;
    notes: string;
    contactId: string | null;
    companyId: string | null;
  };
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  isPending: boolean;
}

function FeeDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEditing,
  isPending,
}: FeeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isEditing ? 'Edit Fee' : 'Add Fee'}
          </DialogTitle>
          <DialogDescription>
            Record a due diligence expense or fee.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v: FeeCategoryType) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger data-testid="select-fee-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                data-testid="input-fee-amount"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Phase 1 Environmental Assessment"
              data-testid="input-fee-description"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateIncurred">Date Incurred</Label>
              <Input
                id="dateIncurred"
                type="date"
                value={formData.dateIncurred}
                onChange={(e) => setFormData({ ...formData, dateIncurred: e.target.value })}
                data-testid="input-fee-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice #</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                placeholder="Optional"
                data-testid="input-fee-invoice"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details..."
              rows={2}
              data-testid="input-fee-notes"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={!formData.amount || isPending}
            data-testid="button-save-fee"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? 'Update' : 'Add'} Fee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

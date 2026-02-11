import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowUpCircle, Undo2, DollarSign, Trash2, Check } from 'lucide-react';
import { ADDBACK_REASONS, type AddbackScope, type Addback } from '@/hooks/useModelingAddbacks';

interface AddbackEditorProps {
  scope: AddbackScope;
  lineItemKey: string;
  lineItemLabel: string;
  category: string;
  year?: number;
  month?: number;
  currentValue?: number;
  existingAddback?: Addback;
  isActive: boolean;
  onSave: (data: {
    lineItemKey: string;
    lineItemLabel: string;
    category: string;
    scope: AddbackScope;
    reason: string;
    notes?: string;
    amount?: string;
    addbackMonth?: number;
    addbackYear?: number;
    periodType: 'monthly' | 'yearly';
    values?: { year: number; month?: number; amount: string }[];
  }) => Promise<void>;
  onToggle: () => Promise<void>;
  onDelete?: (addbackId: string) => Promise<void>;
  isPending: boolean;
  trigger: React.ReactNode;
}

export function AddbackEditor({
  scope,
  lineItemKey,
  lineItemLabel,
  category,
  year,
  month,
  currentValue,
  existingAddback,
  isActive,
  onSave,
  onToggle,
  onDelete,
  isPending,
  trigger,
}: AddbackEditorProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(existingAddback?.reason || 'one_time');
  const [notes, setNotes] = useState(existingAddback?.notes || '');
  const [customAmount, setCustomAmount] = useState('');
  const [useCurrentValue, setUseCurrentValue] = useState(false);

  useEffect(() => {
    if (existingAddback) {
      setReason(existingAddback.reason || 'one_time');
      setNotes(existingAddback.notes || '');
      const existingValue = existingAddback.values?.[0];
      if (existingValue) {
        setCustomAmount(existingValue.amount);
      }
    } else {
      setReason('one_time');
      setNotes('');
      setCustomAmount('');
    }
  }, [existingAddback, open]);

  useEffect(() => {
    if (useCurrentValue && currentValue != null) {
      setCustomAmount(Math.abs(currentValue).toFixed(2));
    }
  }, [useCurrentValue, currentValue]);

  const handleSave = async () => {
    const values: { year: number; month?: number; amount: string }[] = [];
    const amountStr = customAmount?.trim();

    if (amountStr && parseFloat(amountStr) !== 0) {
      if (scope === 'month_cell' && year != null && month != null) {
        values.push({ year, month, amount: amountStr });
      } else if (year != null) {
        values.push({ year, amount: amountStr });
      }
    }

    await onSave({
      lineItemKey,
      lineItemLabel,
      category,
      scope,
      reason: reason || 'other',
      notes: notes || undefined,
      amount: amountStr || undefined,
      addbackMonth: scope === 'month_cell' ? month : undefined,
      addbackYear: scope === 'month_cell' ? year : (year || undefined),
      periodType: scope === 'month_cell' ? 'monthly' : 'yearly',
      values: values.length > 0 ? values : undefined,
    });
    setOpen(false);
  };

  const handleRevert = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive && existingAddback) {
      await onToggle();
      setOpen(false);
    }
  };

  const handleDelete = async () => {
    if (existingAddback && onDelete) {
      await onDelete(existingAddback.id);
      setOpen(false);
    }
  };

  const scopeLabels: Record<AddbackScope, string> = {
    line_item: 'Line Item',
    category: 'Entire Category',
    month_cell: 'Single Month',
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const formattedCurrentValue = currentValue != null && currentValue !== 0
    ? `$${Math.abs(currentValue).toLocaleString()}`
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-sm">
                {isActive ? 'Edit Addback' : 'Add Back'}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {scopeLabels[scope]}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
            <div className="font-medium text-foreground truncate">{lineItemLabel}</div>
            {scope === 'month_cell' && month != null && year != null && (
              <div>{monthNames[month - 1]} {year}</div>
            )}
            {scope === 'category' && (
              <div>All items in {category}</div>
            )}
            {formattedCurrentValue && (
              <div className="mt-0.5">
                Original value: <span className="font-medium text-foreground">{formattedCurrentValue}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDBACK_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span className="text-xs">{r.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Adjusted Value <span className="text-muted-foreground">(replaces original)</span>
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <DollarSign className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setUseCurrentValue(false);
                  }}
                  className="h-8 text-xs pl-7"
                />
              </div>
              {currentValue != null && currentValue !== 0 && (
                <Button
                  variant={useCurrentValue ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[10px] whitespace-nowrap shrink-0"
                  onClick={() => setUseCurrentValue(!useCurrentValue)}
                >
                  Keep Original
                </Button>
              )}
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5">
              <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
                {scope === 'month_cell'
                  ? 'This value will replace the original amount for this month in the normalized view. Leave blank to zero it out.'
                  : scope === 'category'
                    ? 'This value will replace the original total for the entire category in the normalized view. Leave blank to zero it out.'
                    : 'This value will replace the original annual total for this line item in the normalized view. Leave blank to zero it out.'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              placeholder="Why is this being added back?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs h-16 resize-none"
            />
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={handleSave}
              disabled={isPending}
            >
              <Check className="h-3 w-3 mr-1" />
              {isActive ? 'Update' : 'Apply Addback'}
            </Button>
            {isActive && existingAddback && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleRevert}
                  disabled={isPending}
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  Revert
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface AddbackSummaryPanelProps {
  addbacks: Addback[];
  onToggle: (addbackId: string, isActive: boolean) => Promise<void>;
  onDelete: (addbackId: string) => Promise<void>;
  isPending: boolean;
  formatCurrency: (value: number) => string;
}

export function AddbackSummaryPanel({
  addbacks,
  onToggle,
  onDelete,
  isPending,
  formatCurrency,
}: AddbackSummaryPanelProps) {
  const activeAddbacks = addbacks.filter(a => a.isActive);
  const inactiveAddbacks = addbacks.filter(a => !a.isActive);

  const totalAmount = activeAddbacks.reduce((sum, a) => {
    return sum + a.values.reduce((vSum, v) => vSum + (parseFloat(v.amount) || 0), 0);
  }, 0);

  const scopeLabels: Record<string, string> = {
    line_item: 'Line',
    category: 'Category',
    month_cell: 'Month',
  };

  const reasonLabels: Record<string, string> = {};
  ADDBACK_REASONS.forEach(r => { reasonLabels[r.value] = r.label; });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (addbacks.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <ArrowUpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No addbacks yet</p>
        <p className="text-xs mt-1">Click the arrow icons next to line items or categories to start adding back expenses</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {totalAmount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Total Custom Adjustments</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-[10px]">{activeAddbacks.length} Active</Badge>
        {inactiveAddbacks.length > 0 && (
          <Badge variant="outline" className="text-[10px]">{inactiveAddbacks.length} Reverted</Badge>
        )}
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {activeAddbacks.map((addback) => (
          <div key={addback.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group border border-transparent hover:border-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] h-4 shrink-0 bg-amber-50 text-amber-700 border-amber-300">
                  {scopeLabels[addback.scope] || addback.scope}
                </Badge>
                <span className="text-xs font-medium truncate">{addback.lineItemLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {reasonLabels[addback.reason || ''] || addback.reason || 'Other'}
                </span>
                {addback.scope === 'month_cell' && addback.addbackMonth != null && addback.addbackYear != null && (
                  <span className="text-[10px] text-muted-foreground">
                    &middot; {monthNames[addback.addbackMonth - 1]} {addback.addbackYear}
                  </span>
                )}
                {addback.values.length > 0 && parseFloat(addback.values[0].amount) !== 0 && (
                  <span className="text-[10px] font-medium text-amber-600">
                    &middot; {formatCurrency(parseFloat(addback.values[0].amount))}
                  </span>
                )}
              </div>
              {addback.notes && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate italic">{addback.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onToggle(addback.id, false)}
                disabled={isPending}
                title="Revert to original value"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Revert
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(addback.id)}
                disabled={isPending}
                title="Delete addback"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}

        {inactiveAddbacks.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1">Reverted</div>
            {inactiveAddbacks.map((addback) => (
              <div key={addback.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group opacity-50 border border-transparent hover:border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                      {scopeLabels[addback.scope] || addback.scope}
                    </Badge>
                    <span className="text-xs truncate">{addback.lineItemLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onToggle(addback.id, true)}
                    disabled={isPending}
                  >
                    Re-apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(addback.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

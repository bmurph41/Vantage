/**
 * DdPeriodTracker.tsx
 * 
 * Inline period tracking for DD checklist items.
 * Shows checkable year/month/trailing period slots with progress.
 * 
 * Usage:
 *   <DdPeriodTracker itemId={item.id} hasPeriods={item.hasPeriods} />
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, X, CheckCircle2, Circle, Trash2, CheckCheck } from 'lucide-react';
import {
  useItemPeriods, useAddPeriods, useTogglePeriod, useDeletePeriod,
  useBulkTogglePeriods, generateYearValues, generateMonthValues, generateTrailingValues,
  type DdPeriod,
} from '@/hooks/useDdPeriods';

interface PeriodTrackerProps {
  itemId: string;
  compact?: boolean;  // For inline display in item row
}

// ─── Compact inline badge showing period progress ────────────────────────────
export function PeriodProgressBadge({ itemId }: { itemId: string }) {
  const { data } = useItemPeriods(itemId);
  if (!data || data.progress.total === 0) return null;

  const { received, total, pct } = data.progress;
  const color = pct === 100 ? 'bg-green-100 text-green-700' 
    : pct > 0 ? 'bg-amber-100 text-amber-700' 
    : 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {received}/{total}
    </span>
  );
}

// ─── Full Period Tracker (for item drawer) ───────────────────────────────────
export default function DdPeriodTracker({ itemId, compact = false }: PeriodTrackerProps) {
  const { data, isLoading } = useItemPeriods(itemId);
  const addPeriods = useAddPeriods();
  const togglePeriod = useTogglePeriod();
  const deletePeriod = useDeletePeriod();
  const bulkToggle = useBulkTogglePeriods();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [periodType, setPeriodType] = useState<'year' | 'month' | 'trailing'>('year');
  const [yearStart, setYearStart] = useState(String(new Date().getFullYear() - 3));
  const [yearEnd, setYearEnd] = useState(String(new Date().getFullYear()));
  const [monthYear, setMonthYear] = useState(String(new Date().getFullYear()));
  const [customValues, setCustomValues] = useState('');

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading periods...</div>;

  const periods = data?.periods || [];
  const progress = data?.progress || { total: 0, received: 0, pct: 0 };

  const handleToggle = (period: DdPeriod) => {
    togglePeriod.mutate({
      periodId: period.id,
      isReceived: !period.isReceived,
      itemId,
    });
  };

  const handleDelete = (period: DdPeriod) => {
    deletePeriod.mutate({ periodId: period.id, itemId });
  };

  const handleBulkReceive = () => {
    bulkToggle.mutate({ itemId, isReceived: true });
  };

  const handleBulkUnreceive = () => {
    bulkToggle.mutate({ itemId, isReceived: false });
  };

  const handleAddPeriods = () => {
    let values: string[] = [];

    if (periodType === 'year') {
      values = generateYearValues(parseInt(yearStart), parseInt(yearEnd));
    } else if (periodType === 'month') {
      values = generateMonthValues(parseInt(monthYear));
    } else if (periodType === 'trailing') {
      values = generateTrailingValues();
    }

    // Allow custom comma-separated values to be appended
    if (customValues.trim()) {
      const custom = customValues.split(',').map(v => v.trim()).filter(Boolean);
      values = [...values, ...custom];
    }

    if (values.length > 0) {
      addPeriods.mutate({ itemId, type: periodType, values });
      setShowAddDialog(false);
      setCustomValues('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Progress header */}
      {progress.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.received} of {progress.total} received
            </span>
            <span className="font-medium">{progress.pct}%</span>
          </div>
          <Progress value={progress.pct} className="h-2" />
        </div>
      )}

      {/* Period checklist */}
      {periods.length > 0 && (
        <div className="space-y-1">
          {periods.map((period) => (
            <div
              key={period.id}
              className="flex items-center gap-2 group py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={period.isReceived}
                onCheckedChange={() => handleToggle(period)}
                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
              <span className={`flex-1 text-sm ${period.isReceived ? 'line-through text-muted-foreground' : ''}`}>
                {period.periodLabel}
              </span>
              {period.isReceived && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              )}
              {period.notes && (
                <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                  {period.notes}
                </span>
              )}
              <button
                onClick={() => handleDelete(period)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Periods
        </Button>
        {periods.length > 0 && (
          <>
            {progress.received < progress.total && (
              <Button variant="ghost" size="sm" onClick={handleBulkReceive}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark All Received
              </Button>
            )}
            {progress.received > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBulkUnreceive} className="text-muted-foreground">
                Reset All
              </Button>
            )}
          </>
        )}
      </div>

      {/* Add Periods Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Period Slots</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Period Type</Label>
              <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Years (e.g. 2021, 2022, 2023)</SelectItem>
                  <SelectItem value="month">Months (e.g. Jan 2024, Feb 2024)</SelectItem>
                  <SelectItem value="trailing">Trailing Periods (T3, T6, T12, T24, T36)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === 'year' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Start Year</Label>
                  <Input
                    type="number"
                    value={yearStart}
                    onChange={(e) => setYearStart(e.target.value)}
                    min="2000" max="2030"
                  />
                </div>
                <div>
                  <Label>End Year</Label>
                  <Input
                    type="number"
                    value={yearEnd}
                    onChange={(e) => setYearEnd(e.target.value)}
                    min="2000" max="2030"
                  />
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  Will create: {generateYearValues(parseInt(yearStart), parseInt(yearEnd)).join(', ')}
                </div>
              </div>
            )}

            {periodType === 'month' && (
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  min="2000" max="2030"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Will create 12 monthly slots for {monthYear}
                </div>
              </div>
            )}

            {periodType === 'trailing' && (
              <div className="text-sm text-muted-foreground">
                Will create: T3, T6, T12, T24, T36
              </div>
            )}

            <div>
              <Label>Custom Values (optional)</Label>
              <Input
                placeholder="e.g. YTD 2024, Q1 2024, TTM"
                value={customValues}
                onChange={(e) => setCustomValues(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated. Added alongside the generated periods above.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPeriods} disabled={addPeriods.isPending}>
              Add Periods
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

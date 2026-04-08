import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Plus, Settings, ChevronDown } from 'lucide-react';
import type { ModelingFinancialPeriod } from '@shared/schema';

export interface FinancialPeriodOption {
  periodType: string;
  periodLabel: string;
  periodYear: number | null;
}

interface YearSelectorProps {
  projectId: string;
  selectedPeriod: string | null;
  onPeriodChange: (periodLabel: string, period: ModelingFinancialPeriod | null) => void;
  showAddButton?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

const PERIOD_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  calendar_year: { label: 'Calendar Year', color: 'bg-blue-500' },
  trailing_12: { label: 'Trailing 12 Months', color: 'bg-green-500' },
  projected: { label: 'Projected Year', color: 'bg-purple-500' },
  fiscal_year: { label: 'Fiscal Year', color: 'bg-amber-500' },
};

export default function YearSelector({
  projectId,
  selectedPeriod,
  onPeriodChange,
  showAddButton = true,
  className = '',
  size = 'default',
}: YearSelectorProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPeriodLabel, setNewPeriodLabel] = useState('');
  const [newPeriodType, setNewPeriodType] = useState<string>('calendar_year');
  const [newPeriodYear, setNewPeriodYear] = useState<string>(new Date().getFullYear().toString());

  const { data: availablePeriods, isLoading: isLoadingPeriods } = useQuery<FinancialPeriodOption[]>({
    queryKey: ['/api/modeling/projects', projectId, 'available-periods'],
    enabled: !!projectId,
  });

  const { data: periods, isLoading: isLoadingFullPeriods } = useQuery<ModelingFinancialPeriod[]>({
    queryKey: ['/api/modeling/projects', projectId, 'financial-periods'],
    enabled: !!projectId,
  });

  const createPeriodMutation = useMutation({
    mutationFn: (data: {
      periodLabel: string;
      periodType: string;
      periodYear: number | null;
    }) => apiRequest('POST', `/api/modeling/projects/${projectId}/financial-periods`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'available-periods'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'financial-periods'] });
      setIsAddDialogOpen(false);
      setNewPeriodLabel('');
      toast({ title: 'Period Added', description: 'New financial period has been created.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create financial period.', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!selectedPeriod && availablePeriods && availablePeriods.length > 0) {
      const defaultPeriod = availablePeriods.find(p => p.periodType === 'trailing_12') ||
        availablePeriods[0];
      if (defaultPeriod) {
        const fullPeriod = periods?.find(p => p.periodLabel === defaultPeriod.periodLabel);
        onPeriodChange(defaultPeriod.periodLabel, fullPeriod || null);
      }
    }
  }, [availablePeriods, periods, selectedPeriod, onPeriodChange]);

  const handlePeriodSelect = (periodLabel: string) => {
    const fullPeriod = periods?.find(p => p.periodLabel === periodLabel);
    onPeriodChange(periodLabel, fullPeriod || null);
  };

  const handleAddPeriod = () => {
    if (!newPeriodLabel.trim()) {
      toast({ title: 'Error', description: 'Please enter a period label.', variant: 'destructive' });
      return;
    }

    createPeriodMutation.mutate({
      periodLabel: newPeriodLabel.trim(),
      periodType: newPeriodType,
      periodYear: newPeriodType === 'trailing_12' ? null : parseInt(newPeriodYear),
    });
  };

  const generatePeriodLabel = () => {
    if (newPeriodType === 'trailing_12') {
      setNewPeriodLabel('T12');
    } else if (newPeriodType === 'calendar_year') {
      setNewPeriodLabel(newPeriodYear);
    } else if (newPeriodType === 'projected') {
      const yearNum = parseInt(newPeriodYear);
      const currentYear = new Date().getFullYear();
      const yearDiff = yearNum - currentYear;
      if (yearDiff > 0) {
        setNewPeriodLabel(`Year ${yearDiff}`);
      } else {
        setNewPeriodLabel(`Year ${yearNum}`);
      }
    } else if (newPeriodType === 'fiscal_year') {
      setNewPeriodLabel(`FY${newPeriodYear}`);
    }
  };

  useEffect(() => {
    generatePeriodLabel();
  }, [newPeriodType, newPeriodYear]);

  if (isLoadingPeriods) {
    return <Skeleton className={`h-10 w-40 ${className}`} />;
  }

  const hasPeriods = availablePeriods && availablePeriods.length > 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Period:</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select financial period for analysis</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {hasPeriods ? (
        <Select
          value={selectedPeriod || undefined}
          onValueChange={handlePeriodSelect}
        >
          <SelectTrigger 
            className={size === 'sm' ? 'h-8 w-32' : 'h-10 w-40'}
            data-testid="select-year-period"
          >
            <SelectValue placeholder="Select period..." />
          </SelectTrigger>
          <SelectContent>
            {availablePeriods.map((period) => (
              <SelectItem
                key={period.periodLabel}
                value={period.periodLabel}
                data-testid={`option-period-${period.periodLabel}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      PERIOD_TYPE_LABELS[period.periodType]?.color || 'bg-gray-400'
                    }`}
                  />
                  <span>{period.periodLabel}</span>
                  {period.periodYear && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {period.periodYear}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary" className="py-1.5 px-3">
          No periods defined
        </Badge>
      )}

      {showAddButton && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              data-testid="button-add-period"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Financial Period</DialogTitle>
              <DialogDescription>
                Create a new financial period for tracking revenues, expenses, and yields.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
                <Label htmlFor="periodType" className="text-right">
                  Type
                </Label>
                <Select
                  value={newPeriodType}
                  onValueChange={setNewPeriodType}
                >
                  <SelectTrigger className="col-span-3" data-testid="select-new-period-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar_year">Calendar Year</SelectItem>
                    <SelectItem value="trailing_12">Trailing 12 Months (T12)</SelectItem>
                    <SelectItem value="projected">Projected Year</SelectItem>
                    <SelectItem value="fiscal_year">Fiscal Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newPeriodType !== 'trailing_12' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
                  <Label htmlFor="periodYear" className="text-right">
                    Year
                  </Label>
                  <Input
                    id="periodYear"
                    type="number"
                    value={newPeriodYear}
                    onChange={(e) => setNewPeriodYear(e.target.value)}
                    className="col-span-3"
                    min={2000}
                    max={2100}
                    data-testid="input-new-period-year"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
                <Label htmlFor="periodLabel" className="text-right">
                  Label
                </Label>
                <Input
                  id="periodLabel"
                  value={newPeriodLabel}
                  onChange={(e) => setNewPeriodLabel(e.target.value)}
                  placeholder="e.g., 2024, T12, Year 1"
                  className="col-span-3"
                  data-testid="input-new-period-label"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                data-testid="button-cancel-add-period"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddPeriod}
                disabled={createPeriodMutation.isPending}
                data-testid="button-confirm-add-period"
              >
                {createPeriodMutation.isPending ? 'Adding...' : 'Add Period'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface YearSelectorWithDataProps extends Omit<YearSelectorProps, 'selectedPeriod' | 'onPeriodChange'> {
  onDataChange?: (data: ModelingFinancialPeriod | null) => void;
}

export function YearSelectorWithState({
  projectId,
  onDataChange,
  ...props
}: YearSelectorWithDataProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const handlePeriodChange = (periodLabel: string, periodData: ModelingFinancialPeriod | null) => {
    setSelectedPeriod(periodLabel);
    if (onDataChange) {
      onDataChange(periodData);
    }
  };

  return (
    <YearSelector
      projectId={projectId}
      selectedPeriod={selectedPeriod}
      onPeriodChange={handlePeriodChange}
      {...props}
    />
  );
}

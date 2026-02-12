import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save, DollarSign, Calculator } from 'lucide-react';

// Types
type ClosingCostLine = {
  id?: string;
  category: string;
  amount: number | string;
  notes?: string;
  isFinancingFee?: boolean;
  sortOrder: number;
};

type TransitionCostLine = {
  id?: string;
  category: string;
  amount: number | string;
  notes?: string;
  sortOrder: number;
};

type NwcLine = {
  id?: string;
  bucketType: 'current_asset' | 'current_liability' | 'nwc_adjustment';
  label: string;
  amount: number | string;
  sortOrder: number;
};

type TransactionClosingData = {
  summary: {
    purchasePrice?: number | string;
    financingFeeRate?: number | string;
    financingBaseAmount?: number | string;
    financingFees?: number | string;
    workingCapitalMonths?: number;
    workingCapitalMonthlyExpenseBase?: number | string;
    workingCapitalRequired?: number | string;
    capexPhase1?: number | string;
    capexPhase2?: number | string;
    capexPhase3?: number | string;
    totalClosingCosts?: number | string;
    transitionCostsTotal?: number | string;
    totalInvestmentCost?: number | string;
    currentAssetsTotal?: number | string;
    currentLiabilitiesTotal?: number | string;
    currentRatio?: number | string;
    arMinusAp?: number | string;
    nwcAdjustmentsTotal?: number | string;
    workingCapitalBalance?: number | string;
    currentRatioAsOfDate?: string;
    notes?: string;
  };
  closingCostLines: ClosingCostLine[];
  transitionCostLines: TransitionCostLine[];
  nwcLines: NwcLine[];
};

// Default line items for each category
const DEFAULT_CLOSING_COSTS = [
  'Legal Fees',
  'Broker Fees/Finder Fees',
  'Survey',
  'Phase I Environmental',
  'Phase II Environmental',
  'Property Condition Report',
  'Forklifts/Vehicle Inspections',
  'Travel',
  'Other',
];

const DEFAULT_TRANSITION_COSTS = [
  'Office 365 License',
  'Software/Migration',
  'Inacct Licenses',
  'Website',
  'Hardware',
  'Laptops/Workstations',
  'Printer/POS',
  'Wifi and Networking',
  'Travel & Lodging',
  'Signage',
  'Uniforms',
  'Security',
  'Insurance Consulting',
  'Other',
];

const DEFAULT_CURRENT_ASSETS = [
  'Cash',
  'Accounts Receivables',
  'Inventory',
  'Marketable Securities',
  'Pre-Paid Expenses',
  'Other',
];

const DEFAULT_CURRENT_LIABILITIES = [
  'Accounts Payable',
  'Accrued Expenses',
  'Taxes Payable',
  'Short-Term Debt',
  'Payroll Liabilities',
  'Other',
];

const DEFAULT_NWC_ADJUSTMENTS = [
  'AR Adjustment',
  'AP Adjustment',
  'Inventory Adjustment',
  'Accrual Adjustment',
  'Other Adjustments',
];

export default function TransactionClosingPage() {
  const { projectId } = useParams();
  const { toast } = useToast();

  const [closingCostLines, setClosingCostLines] = useState<ClosingCostLine[]>([]);
  const [transitionCostLines, setTransitionCostLines] = useState<TransitionCostLine[]>([]);
  const [nwcLines, setNwcLines] = useState<NwcLine[]>([]);
  const [summary, setSummary] = useState<TransactionClosingData['summary']>({});

  // Fetch transaction closing data
  const { data, isLoading, error } = useQuery<TransactionClosingData>({
    queryKey: ['/api/modeling/projects', projectId, 'transaction-closing'],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/transaction-closing`);
      if (!res.ok) throw new Error('Failed to fetch transaction closing data');
      return res.json();
    },
    enabled: !!projectId,
  });

  // Initialize state when data loads
  useEffect(() => {
    if (data) {
      // Initialize closing costs
      if (data.closingCostLines.length > 0) {
        setClosingCostLines(data.closingCostLines);
      } else {
        // Initialize with default categories
        setClosingCostLines(
          DEFAULT_CLOSING_COSTS.map((category, index) => ({
            category,
            amount: 0,
            notes: '',
            isFinancingFee: false,
            sortOrder: index,
          }))
        );
      }

      // Initialize transition costs
      if (data.transitionCostLines.length > 0) {
        setTransitionCostLines(data.transitionCostLines);
      } else {
        setTransitionCostLines(
          DEFAULT_TRANSITION_COSTS.map((category, index) => ({
            category,
            amount: 0,
            notes: '',
            sortOrder: index,
          }))
        );
      }

      // Initialize NWC lines
      if (data.nwcLines.length > 0) {
        setNwcLines(data.nwcLines);
      } else {
        const initialNwc: NwcLine[] = [
          ...DEFAULT_CURRENT_ASSETS.map((label, index) => ({
            bucketType: 'current_asset' as const,
            label,
            amount: 0,
            sortOrder: index,
          })),
          ...DEFAULT_CURRENT_LIABILITIES.map((label, index) => ({
            bucketType: 'current_liability' as const,
            label,
            amount: 0,
            sortOrder: DEFAULT_CURRENT_ASSETS.length + index,
          })),
          ...DEFAULT_NWC_ADJUSTMENTS.map((label, index) => ({
            bucketType: 'nwc_adjustment' as const,
            label,
            amount: 0,
            sortOrder: DEFAULT_CURRENT_ASSETS.length + DEFAULT_CURRENT_LIABILITIES.length + index,
          })),
        ];
        setNwcLines(initialNwc);
      }

      // Initialize summary
      if (data.summary) {
        setSummary(data.summary);
      }
    }
  }, [data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: TransactionClosingData) => {
      return apiRequest('POST', `/api/modeling/projects/${projectId}/transaction-closing`, payload);
    },
    onSuccess: (savedData) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'transaction-closing'],
      });
      toast({ title: 'Success', description: 'Transaction closing costs saved successfully' });
      
      // Update state with saved data (including IDs for line items)
      if (savedData.summary) {
        setSummary(savedData.summary);
      }
      if (savedData.closingCostLines) {
        setClosingCostLines(savedData.closingCostLines);
      }
      if (savedData.transitionCostLines) {
        setTransitionCostLines(savedData.transitionCostLines);
      }
      if (savedData.nwcLines) {
        setNwcLines(savedData.nwcLines);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save transaction closing costs',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      summary,
      closingCostLines,
      transitionCostLines,
      nwcLines,
    });
  };

  const formatNumber = (value: number | string | undefined) => {
    if (value === undefined || value === null || value === '') return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  };

  const parseNumber = (value: string): number => {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Update handlers
  const updateClosingCostLine = (index: number, field: string, value: any) => {
    const newLines = [...closingCostLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setClosingCostLines(newLines);
  };

  const updateTransitionCostLine = (index: number, field: string, value: any) => {
    const newLines = [...transitionCostLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setTransitionCostLines(newLines);
  };

  const updateNwcLine = (index: number, field: string, value: any) => {
    const newLines = [...nwcLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setNwcLines(newLines);
  };

  const addClosingCostLine = () => {
    setClosingCostLines([
      ...closingCostLines,
      { category: '', amount: 0, notes: '', sortOrder: closingCostLines.length },
    ]);
  };

  const removeClosingCostLine = (index: number) => {
    setClosingCostLines(closingCostLines.filter((_, i) => i !== index));
  };

  const addTransitionCostLine = () => {
    setTransitionCostLines([
      ...transitionCostLines,
      { category: '', amount: 0, notes: '', sortOrder: transitionCostLines.length },
    ]);
  };

  const removeTransitionCostLine = (index: number) => {
    setTransitionCostLines(transitionCostLines.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-destructive">Failed to load transaction closing data</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction & Closing Costs</h1>
          <p className="text-muted-foreground mt-1">
            Track acquisition costs, working capital, and investment totals
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Purchase Price</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.purchasePrice)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Total Investment Cost</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalInvestmentCost)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-purple-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Current Ratio</p>
              <p className="text-2xl font-bold">{formatNumber(summary.currentRatio)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Three-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - Closing Costs */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Closing Costs</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addClosingCostLine}
                data-testid="button-add-closing-cost"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {closingCostLines.map((line, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      value={line.category}
                      onChange={(e) => updateClosingCostLine(index, 'category', e.target.value)}
                      placeholder="Category"
                      className="mb-1"
                      data-testid={`input-closing-category-${index}`}
                    />
                    <Input
                      type="number"
                      value={line.amount}
                      onChange={(e) => updateClosingCostLine(index, 'amount', parseNumber(e.target.value))}
                      placeholder="Amount"
                      data-testid={`input-closing-amount-${index}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClosingCostLine(index)}
                    data-testid={`button-remove-closing-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center font-semibold">
                <span>Total Closing Costs</span>
                <span data-testid="text-total-closing-costs">
                  {formatCurrency(summary.totalClosingCosts)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* MIDDLE COLUMN - Transition Costs & Working Capital */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Transition Costs Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Transition Costs</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTransitionCostLine}
                  data-testid="button-add-transition-cost"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transitionCostLines.map((line, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={line.category}
                        onChange={(e) => updateTransitionCostLine(index, 'category', e.target.value)}
                        placeholder="Category"
                        className="mb-1"
                        data-testid={`input-transition-category-${index}`}
                      />
                      <Input
                        type="number"
                        value={line.amount}
                        onChange={(e) => updateTransitionCostLine(index, 'amount', parseNumber(e.target.value))}
                        placeholder="Amount"
                        data-testid={`input-transition-amount-${index}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTransitionCostLine(index)}
                      data-testid={`button-remove-transition-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-semibold text-sm">
                  <span>Transition Costs Total</span>
                  <span data-testid="text-transition-costs-total">
                    {formatCurrency(summary.transitionCostsTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Working Capital Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Working Capital</h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="workingCapitalMonths">Months of Expenses</Label>
                  <Input
                    id="workingCapitalMonths"
                    type="number"
                    value={summary.workingCapitalMonths || ''}
                    onChange={(e) => setSummary({ ...summary, workingCapitalMonths: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 3"
                    data-testid="input-working-capital-months"
                  />
                </div>

                <div>
                  <Label htmlFor="monthlyExpenseBase">Monthly Expense Base</Label>
                  <Input
                    id="monthlyExpenseBase"
                    type="number"
                    value={summary.workingCapitalMonthlyExpenseBase || ''}
                    onChange={(e) => setSummary({ ...summary, workingCapitalMonthlyExpenseBase: parseNumber(e.target.value) })}
                    placeholder="Annual OpEx / 12"
                    data-testid="input-monthly-expense-base"
                  />
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Working Capital Required</span>
                    <span data-testid="text-working-capital-required">
                      {formatCurrency(summary.workingCapitalRequired)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* RIGHT COLUMN - Net Working Capital */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Net Working Capital</h2>

            {/* Current Assets */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Current Assets</h3>
              {nwcLines.filter(l => l.bucketType === 'current_asset').map((line, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-sm flex-1">{line.label}</span>
                  <Input
                    type="number"
                    value={line.amount}
                    onChange={(e) => {
                      const idx = nwcLines.findIndex(l => l.bucketType === 'current_asset' && l.label === line.label);
                      updateNwcLine(idx, 'amount', parseNumber(e.target.value));
                    }}
                    className="w-32"
                    data-testid={`input-nwc-asset-${index}`}
                  />
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-semibold text-sm">
                <span>Total Current Assets</span>
                <span data-testid="text-current-assets-total">
                  {formatCurrency(summary.currentAssetsTotal)}
                </span>
              </div>
            </div>

            {/* Current Liabilities */}
            <div className="space-y-2 pt-4">
              <h3 className="font-medium text-sm text-muted-foreground">Current Liabilities</h3>
              {nwcLines.filter(l => l.bucketType === 'current_liability').map((line, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-sm flex-1">{line.label}</span>
                  <Input
                    type="number"
                    value={line.amount}
                    onChange={(e) => {
                      const idx = nwcLines.findIndex(l => l.bucketType === 'current_liability' && l.label === line.label);
                      updateNwcLine(idx, 'amount', parseNumber(e.target.value));
                    }}
                    className="w-32"
                    data-testid={`input-nwc-liability-${index}`}
                  />
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-semibold text-sm">
                <span>Total Current Liabilities</span>
                <span data-testid="text-current-liabilities-total">
                  {formatCurrency(summary.currentLiabilitiesTotal)}
                </span>
              </div>
            </div>

            {/* NWC Adjustments */}
            <div className="space-y-2 pt-4">
              <h3 className="font-medium text-sm text-muted-foreground">NWC Adjustments</h3>
              {nwcLines.filter(l => l.bucketType === 'nwc_adjustment').map((line, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-sm flex-1">{line.label}</span>
                  <Input
                    type="number"
                    value={line.amount}
                    onChange={(e) => {
                      const idx = nwcLines.findIndex(l => l.bucketType === 'nwc_adjustment' && l.label === line.label);
                      updateNwcLine(idx, 'amount', parseNumber(e.target.value));
                    }}
                    className="w-32"
                    data-testid={`input-nwc-adjustment-${index}`}
                  />
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-semibold text-sm">
                <span>NWC Adjustments Total</span>
                <span data-testid="text-nwc-adjustments-total">
                  {formatCurrency(summary.nwcAdjustmentsTotal)}
                </span>
              </div>
            </div>

            {/* Final Metrics */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>AR - AP</span>
                <span data-testid="text-ar-minus-ap">{formatCurrency(summary.arMinusAp)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Working Capital Balance</span>
                <span data-testid="text-working-capital-balance">
                  {formatCurrency(summary.workingCapitalBalance)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import * as XLSX from 'xlsx';
import { useHoldPeriod } from '@/hooks/use-hold-period';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown,
  Calculator,
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Percent,
  Target,
  Activity,
  Layers,
  AlertCircle,
  Building2,
  Info,
  Users,
  Settings2
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import debounce from 'lodash.debounce';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { FMEmptyState } from '@/components/modeling/FMEmptyState';
import { MarketRatePicker, MarketRateContext } from '@/components/modeling/MarketRatePicker';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import { DCFMonteCarloPanel, DecisionSupportAccordion } from '@/components/workspace/DCFMonteCarloPanel';

interface DCFScenario {
  id: string;
  name: string;
  isBase: boolean;
  probability?: number;
  purchasePrice: number;
  npv: number;
  irr: number;
  leveredIRR: number;
  equityMultiple: number;
  avgCashOnCash: number;
  paybackPeriod: number;
  terminalValueAmount: number;
  goingInCapRate: number;
  exitCapRate: number;
  cashFlows: {
    period: number;
    year: number;
    noi: number;
    cashFlowBeforeDebt: number;
    cashFlowAfterDebt: number;
    presentValue: number;
  }[];
}

interface SensitivityMatrix {
  variable1: { name: string; values: number[] };
  variable2: { name: string; values: number[] };
  metric: string;
  results: number[][];
}

interface LeaseYearDetail {
  leaseId: string;
  tenantName: string;
  baseRent: number;
  recovery: number;
  isExpired: boolean;
  freeRentReduction: number;
  vacancyDeduction: number;
  tiLcCost: number;
  escalationType?: string;
  activeStepRentAnnual?: number | null;
  isFuture?: boolean;
  leaseStartDate?: string | null;
}

interface RentStepEntryFE {
  effectiveDate: string;
  value: number;
  unit: string;
  notes?: string;
}

interface LeaseBreakdownItem {
  leaseId: string;
  tenantName: string;
  leaseEndDate: string | null;
  baseRentAnnual: number;
  recoveryAnnual: number;
  leaseType: string;
  sf: number;
  escalationType: string;
  escalationRate: number;
  scheduleJson?: RentStepEntryFE[] | null;
}

interface YearlyLeaseIncome {
  year: number;
  baseRentAnnual: number;
  recoveryAnnual: number;
  egiAnnual: number;
  vacancyDeductionTotal: number;
  tiLcCostTotal: number;
  leaseDetail: LeaseYearDetail[];
}

interface DCFAnalysis {
  projectId: string;
  scenarios: DCFScenario[];
  baseScenario: DCFScenario;
  sensitivityMatrix?: SensitivityMatrix;
  scenarioComparison: {
    scenarios: string[];
    metrics: { name: string; values: Record<string, number>; unit: string }[];
  };
  probabilityWeightedResult?: {
    expectedNPV: number;
    expectedIRR: number;
    expectedEquityMultiple: number;
    standardDeviation: number;
    confidenceInterval: { low: number; high: number };
  };
  meta?: {
    leaseIncomeInjected: boolean;
    useLeaseIncomeForDcf: boolean | null;
    revenueGrowthRateUsed: number;
    leaseEscalationRateUsed: number | null;
    discountRate: number;
    hasDebt: boolean;
    overridesApplied: boolean;
    generatedAt: string;
    acquisitionDate?: string;
  };
  leaseIncome?: {
    hasLeases: boolean;
    totalEGIAnnual: number;
    totalBaseRentAnnual: number;
    totalRecoveryAnnual: number;
    weightedAvgEscalationRate: number;
  };
  yearlyLeaseIncome?: YearlyLeaseIncome[];
  years?: Array<{
    year: number;
    label: string;
    noi: number;
    capex: number;
    ncf: number;
    debtService: number;
    leveredCF: number;
    cashOnCash: number;
  }>;
}

interface DCFCalculatorPageProps {
  onTabChange?: (tab: string) => void;
}

interface ScenarioAssumptions {
  rolloverVacancyMonths?: number;
  rolloverTiLcPerSf?: number;
  year1NOIOverride?: number;
  year1NOISource?: string;
  [key: string]: unknown;
}

export default function DCFCalculatorPage({ onTabChange }: DCFCalculatorPageProps = {}) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [expandedCFYears, setExpandedCFYears] = useState<Set<number>>(new Set());
  const [expandedLeaseYears, setExpandedLeaseYears] = useState<Set<number>>(new Set());

  const toggleCFYear = (year: number) => {
    setExpandedCFYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleLeaseYear = (year: number) => {
    setExpandedLeaseYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const LEASE_EXPORT_COLUMNS = [
    { key: 'year', label: 'Year' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'baseRent', label: 'Base Rent' },
    { key: 'recoveries', label: 'Recoveries' },
    { key: 'freeRentReduction', label: 'Free Rent Reduction' },
    { key: 'vacancyDeduction', label: 'Vacancy Deduction' },
    { key: 'tiLcCost', label: 'TI/LC Cost' },
    { key: 'netEgi', label: 'Net EGI' },
    { key: 'status', label: 'Status' },
  ] as const;

  type LeaseExportColumnKey = typeof LEASE_EXPORT_COLUMNS[number]['key'];
  const ALL_COLUMN_KEYS = LEASE_EXPORT_COLUMNS.map(c => c.key) as LeaseExportColumnKey[];

  const SESSION_KEY = 'leaseExportColumns';
  const loadSavedColumns = (): Set<LeaseExportColumnKey> => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((k): k is LeaseExportColumnKey =>
            ALL_COLUMN_KEYS.includes(k as LeaseExportColumnKey)
          );
          if (valid.length > 0) return new Set(valid);
        }
      }
    } catch {}
    return new Set(ALL_COLUMN_KEYS);
  };

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportDialogFormat, setExportDialogFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [selectedExportColumns, setSelectedExportColumns] = useState<Set<LeaseExportColumnKey>>(loadSavedColumns);

  const toggleExportColumn = (key: LeaseExportColumnKey) => {
    setSelectedExportColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const openExportDialog = (format: 'xlsx' | 'csv') => {
    setExportDialogFormat(format);
    setExportDialogOpen(true);
  };

  const { data: dcfAnalysis, isLoading, isError, error: dcfError, refetch } = useQuery<DCFAnalysis>({
    queryKey: ['/api/modeling/projects', projectId, 'dcf'],
    enabled: !!projectId,
    retry: false,
  });

  const { data: leaseIncomeData } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'lease-income'],
    enabled: !!projectId,
  });

  const { data: dcfProject } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const exportLeaseIncome = useCallback((format: 'xlsx' | 'csv', cols?: Set<LeaseExportColumnKey>) => {
    const data = dcfAnalysis?.yearlyLeaseIncome;
    if (!data || data.length === 0) return;

    const activeCols = cols ?? selectedExportColumns;
    const colDefs = (LEASE_EXPORT_COLUMNS as ReadonlyArray<{ key: LeaseExportColumnKey; label: string }>)
      .filter(c => activeCols.has(c.key));

    const pick = (colKey: string, detail: any, yearRow: any, isTotal: boolean): string | number => {
      const vacDed = detail?.vacancyDeduction ?? 0;
      const tiLc = detail?.tiLcCost ?? 0;
      const netEgi = isTotal
        ? yearRow.egiAnnual
        : (detail.isExpired ? 0 : detail.baseRent) + (detail.isExpired ? 0 : detail.recovery) - detail.freeRentReduction - vacDed - tiLc;
      switch (colKey) {
        case 'year': return yearRow.year;
        case 'tenant': return isTotal ? 'TOTAL' : detail.tenantName;
        case 'baseRent': return isTotal ? yearRow.baseRentAnnual : (detail.isExpired ? 0 : detail.baseRent);
        case 'recoveries': return isTotal ? yearRow.recoveryAnnual : (detail.isExpired ? 0 : detail.recovery);
        case 'freeRentReduction': return isTotal
          ? yearRow.leaseDetail.reduce((s: number, l: any) => s + l.freeRentReduction, 0)
          : detail.freeRentReduction;
        case 'vacancyDeduction': return isTotal
          ? ((yearRow.vacancyDeductionTotal ?? 0) > 0 ? -(yearRow.vacancyDeductionTotal ?? 0) : 0)
          : (vacDed > 0 ? -vacDed : 0);
        case 'tiLcCost': return isTotal
          ? ((yearRow.tiLcCostTotal ?? 0) > 0 ? -(yearRow.tiLcCostTotal ?? 0) : 0)
          : (tiLc > 0 ? -tiLc : 0);
        case 'netEgi': return netEgi;
        case 'status': return isTotal ? '' : (detail.isExpired ? 'Expired' : 'Active');
        default: return '';
      }
    };

    const headers = colDefs.map(c => c.label);
    const rows: (string | number)[][] = [headers];

    for (const yearRow of data) {
      for (const ld of yearRow.leaseDetail) {
        rows.push(colDefs.map(c => pick(c.key, ld, yearRow, false)));
      }
      rows.push(colDefs.map(c => pick(c.key, null, yearRow, true)));
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lease Income');

    const projectSlug = (dcfProject?.name ?? 'project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${projectSlug}-lease-income-${dateStr}.${format}`;
    XLSX.writeFile(wb, filename, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
  }, [dcfAnalysis?.yearlyLeaseIncome, selectedExportColumns, dcfProject]);

  const { holdPeriod: sharedHoldPeriod, setHoldPeriod: setSharedHoldPeriod } = useHoldPeriod(projectId || '');

  const { data: scenarios = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
    enabled: !!projectId,
  });
  const activeScenario = scenarios.find((s: any) => s.scenarioType === 'base' && s.isCurrentVersion);

  const { data: proFormaData } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
    enabled: !!projectId,
  });

  const { data: capitalStackData } = useQuery<any>({
    queryKey: ['/api/capital-stacks', projectId],
    enabled: !!projectId,
  });

  const [liveInputs, setLiveInputs] = useState({
    purchasePrice: 0,
    year1NOI: 0,
    noiGrowthRate: 3,
    discountRate: 10,
    exitCapRate: 7.5,
    holdPeriod: 10,
    loanAmount: 0,
    loanRate: 5.5,
  });

  const [inputSources, setInputSources] = useState<Record<string, string>>({});
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updates: Partial<typeof liveInputs> = {};
    const sources: Record<string, string> = {};

    const trySet = (field: keyof typeof liveInputs, value: number, source: string) => {
      if (userOverrides[field]) return;
      if (value > 0) {
        updates[field] = value;
        sources[field] = source;
      }
    };

    const pp = dcfProject?.purchasePrice ? parseFloat(dcfProject.purchasePrice) : 0;
    trySet('purchasePrice', pp, 'Project');

    const pfY1 = proFormaData?.metrics?.year1Noi || proFormaData?.noi?.[0];
    if (pfY1 && pfY1 > 0) {
      trySet('year1NOI', pfY1, 'Pro Forma');
    } else if (pp > 0 && !pfY1 && !userOverrides.year1NOI) {
      updates.year1NOI = pp * 0.10;
      sources.year1NOI = 'Estimated (10% cap)';
    }

    const pfExitCap = proFormaData?.metrics?.exitCapRate;
    if (pfExitCap && pfExitCap > 0) {
      trySet('exitCapRate', pfExitCap, 'Pro Forma');
    } else if (activeScenario?.exitCapRate) {
      const ecr = parseFloat(activeScenario.exitCapRate);
      trySet('exitCapRate', ecr > 1 ? ecr : ecr * 100, 'Scenario');
    }

    const pfGrowth = proFormaData?.metrics?.revenueGrowthRate;
    if (pfGrowth && pfGrowth > 0) {
      trySet('noiGrowthRate', pfGrowth, 'Pro Forma');
    } else if (activeScenario?.revenueGrowthRate) {
      trySet('noiGrowthRate', parseFloat(activeScenario.revenueGrowthRate), 'Scenario');
    }

    const pfHp = proFormaData?.holdPeriod;
    if (pfHp && pfHp > 0) {
      trySet('holdPeriod', pfHp, 'Pro Forma');
    } else if (sharedHoldPeriod && sharedHoldPeriod > 0) {
      trySet('holdPeriod', sharedHoldPeriod, 'Shared');
    }

    const stack = capitalStackData?.capitalStack || capitalStackData;
    if (stack?.totalDebt) {
      trySet('loanAmount', parseFloat(stack.totalDebt), 'Capital Stack');
    }
    if (stack?.blendedDebtRate) {
      const bdr = parseFloat(stack.blendedDebtRate);
      trySet('loanRate', bdr > 1 ? bdr : bdr * 100, 'Capital Stack');
    }

    if (updates.loanAmount === undefined && updates.purchasePrice && updates.purchasePrice > 0 && !userOverrides.loanAmount) {
      updates.loanAmount = updates.purchasePrice * 0.65;
      sources.loanAmount = 'Default (65% LTV)';
    }

    if (Object.keys(updates).length > 0) {
      setLiveInputs(prev => ({ ...prev, ...updates }));
      setInputSources(prev => ({ ...prev, ...sources }));
    }
  }, [dcfProject, proFormaData, capitalStackData, activeScenario, sharedHoldPeriod, userOverrides]);

  useEffect(() => {
    if (sharedHoldPeriod && sharedHoldPeriod !== liveInputs.holdPeriod && !userOverrides.holdPeriod) {
      setLiveInputs(prev => ({ ...prev, holdPeriod: sharedHoldPeriod }));
    }
  }, [sharedHoldPeriod]);

  // null = not yet loaded from server; false = disabled; true = enabled
  const [leaseOverrideEnabled, setLeaseOverrideEnabled] = useState<boolean | null>(null);

  // Rollover vacancy assumption settings (stored in scenario assumptions jsonb)
  const [rolloverVacancyMonths, setRolloverVacancyMonths] = useState<number>(0);
  const [rolloverTiLcPerSf, setRolloverTiLcPerSf] = useState<number>(0);

  useEffect(() => {
    const meta = dcfAnalysis?.meta;
    if (meta) {
      setLeaseOverrideEnabled(meta.useLeaseIncomeForDcf === true);
    }
  }, [dcfAnalysis]);

  // Initialise rollover settings from the active scenario assumptions.
  // Always reset to 0 for missing keys so stale values from a previous
  // scenario don't bleed through when switching scenarios.
  useEffect(() => {
    const assumptions: ScenarioAssumptions = activeScenario?.assumptions ?? {};
    setRolloverVacancyMonths(
      typeof assumptions.rolloverVacancyMonths === 'number'
        ? assumptions.rolloverVacancyMonths
        : 0
    );
    setRolloverTiLcPerSf(
      typeof assumptions.rolloverTiLcPerSf === 'number'
        ? assumptions.rolloverTiLcPerSf
        : 0
    );
    // Restore the "Use Lease EGI" override so that refreshing the page keeps
    // the snapped value and keeps the reconciliation banner dismissed.
    // When no override is saved (e.g. different scenario), explicitly clear
    // the override state so stale data from a prior scenario cannot bleed through.
    if (typeof assumptions.year1NOIOverride === 'number') {
      const savedNOI = assumptions.year1NOIOverride;
      const savedSource = assumptions.year1NOISource ?? 'Lease Data';
      setUserOverrides(prev => ({ ...prev, year1NOI: true }));
      setLiveInputs(prev => ({ ...prev, year1NOI: savedNOI }));
      setInputSources(prev => ({ ...prev, year1NOI: savedSource }));
    } else {
      setUserOverrides(prev => {
        if (!prev.year1NOI) return prev;
        const next = { ...prev };
        delete next.year1NOI;
        return next;
      });
      setInputSources(prev => {
        if (prev.year1NOI !== 'Lease Data') return prev;
        const next = { ...prev };
        delete next.year1NOI;
        return next;
      });
    }
  // Include assumptions object so UI re-syncs if server assumptions change
  // without an ID change (e.g., another tab updates the same scenario).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario?.id, activeScenario?.assumptions]);

  useEffect(() => {
    setExpandedCFYears(new Set());
    setExpandedLeaseYears(new Set());
  }, [projectId]);

  const updateLeaseOverrideMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
        useLeaseIncomeForDcf: enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'dcf'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
    },
  });

  const patchScenarioAssumptionsMutation = useMutation({
    mutationFn: (assumptions: ScenarioAssumptions) => {
      if (!activeScenario?.id) return Promise.resolve();
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
    },
  });

  const updateRolloverAssumptionsMutation = useMutation({
    mutationFn: (vals: { rolloverVacancyMonths: number; rolloverTiLcPerSf: number }) => {
      if (!activeScenario?.id) return Promise.resolve();
      const merged = {
        ...(activeScenario?.assumptions ?? {}),
        rolloverVacancyMonths: vals.rolloverVacancyMonths,
        rolloverTiLcPerSf: vals.rolloverTiLcPerSf,
      };
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions: merged,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'dcf'] });
    },
  });

  const debouncedSaveRollover = useCallback(
    debounce((vals: { rolloverVacancyMonths: number; rolloverTiLcPerSf: number }) => {
      updateRolloverAssumptionsMutation.mutate(vals);
    }, 600),
    [activeScenario?.id]
  );

  const saveExitCapRateToScenario = useMutation({
    mutationFn: (exitCapRatePercent: number) => {
      if (!activeScenario?.id) return Promise.resolve();
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        exitCapRate: (exitCapRatePercent / 100).toFixed(4),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'dcf'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'deal-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
    },
  });

  const debouncedSaveCapRate = useCallback(
    debounce((exitCapRatePercent: number) => {
      saveExitCapRateToScenario.mutate(exitCapRatePercent);
    }, 500),
    [activeScenario?.id]
  );

  // Real-time IRR calculation
  const calculateQuickIRR = useMutation({
    mutationFn: (input: any) =>
      apiRequest('POST', '/api/dcf/quick-irr', { input }),
  });

  const debouncedCalculate = useCallback(
    debounce((inputs: typeof liveInputs) => {
      calculateQuickIRR.mutate({
        purchasePrice: inputs.purchasePrice,
        year1NOI: inputs.year1NOI,
        noiGrowthRate: inputs.noiGrowthRate / 100,
        discountRate: inputs.discountRate / 100,
        exitCapRate: inputs.exitCapRate / 100,
        holdPeriod: inputs.holdPeriod,
        loanAmount: inputs.loanAmount,
        loanRate: inputs.loanRate / 100,
      });
    }, 300),
    []
  );

  const handleInputChange = (key: keyof typeof liveInputs, value: number) => {
    const newInputs = { ...liveInputs, [key]: value };
    setLiveInputs(newInputs);
    setUserOverrides(prev => ({ ...prev, [key]: true }));
    setInputSources(prev => ({ ...prev, [key]: 'Manual' }));
    debouncedCalculate(newInputs);
    if (key === 'holdPeriod') {
      setSharedHoldPeriod(value);
    }
    if (key === 'exitCapRate') {
      debouncedSaveCapRate(value);
    }
    // If the user manually edits year1NOI after a "Use Lease EGI" snap, clear
    // the persisted override so a page refresh reflects the manual value rather
    // than the stale lease snap.
    if (key === 'year1NOI') {
      const currentAssumptions: ScenarioAssumptions = activeScenario?.assumptions ?? {};
      if (typeof currentAssumptions.year1NOIOverride === 'number') {
        const { year1NOIOverride: _ovr, year1NOISource: _src, ...cleared } = currentAssumptions;
        patchScenarioAssumptionsMutation.mutate(cleared);
      }
    }
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  const leaseExpiryWarnings = useMemo(() => {
    const yearlyLeaseIncome = dcfAnalysis?.yearlyLeaseIncome;
    if (!yearlyLeaseIncome || yearlyLeaseIncome.length === 0) return [];

    const year1 = yearlyLeaseIncome[0];
    if (!year1 || !year1.leaseDetail || year1.leaseDetail.length === 0) return [];

    const year1TotalEGI = year1.egiAnnual;
    if (!year1TotalEGI || year1TotalEGI <= 0) return [];

    const holdPeriodYears = yearlyLeaseIncome.length;
    const holdYears = yearlyLeaseIncome.filter(y => y.year >= 1 && y.year <= holdPeriodYears);

    const warnings: { tenantName: string; leaseId: string; egiPct: number; expiryYear: number }[] = [];

    for (const detail of year1.leaseDetail) {
      if (detail.isExpired) continue;

      const tenantYear1EGI = detail.baseRent + detail.recovery - detail.freeRentReduction;
      const egiPct = tenantYear1EGI / year1TotalEGI;

      if (egiPct < 0.15) continue;

      let expiryYear: number | null = null;
      for (const yearData of holdYears) {
        const tenantInYear = yearData.leaseDetail.find(d => d.leaseId === detail.leaseId);
        if (tenantInYear && tenantInYear.isExpired) {
          expiryYear = yearData.year;
          break;
        }
      }

      if (expiryYear !== null) {
        warnings.push({ tenantName: detail.tenantName, leaseId: detail.leaseId, egiPct, expiryYear });
      }
    }

    return warnings;
  }, [dcfAnalysis?.yearlyLeaseIncome]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError) {
    const errMsg = (dcfError as any)?.message ?? '';
    const needsInputs = errMsg.includes('Project not found') || errMsg.includes('No inputs') || !dcfAnalysis;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
        <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-4">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">
            {needsInputs ? 'Input Assumptions Required' : 'DCF Analysis Unavailable'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {needsInputs
              ? 'Complete the property inputs on the Inputs & Data tab — occupancy, revenue assumptions, and unit mix — to generate a DCF analysis.'
              : errMsg || 'Unable to compute DCF. Check that project assumptions are configured.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
          <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'inputs' }))}>
            Go to Inputs
          </Button>
        </div>
      </div>
    );
  }

  // Belt-and-suspenders: if query succeeded but returned no analysis object,
  // treat that as "needs inputs" rather than rendering downstream with undefined.
  if (!dcfAnalysis) {
    return (
      <FMEmptyState
        icon={TrendingUp}
        title="DCF analysis not yet available"
        description="DCF metrics appear after you complete property inputs — occupancy, revenue assumptions, unit mix, and debt. Open the Inputs & Data tab to get started."
        actionLabel="Go to Inputs"
        onAction={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'inputs' }))}
      />
    );
  }

  const baseScenario = dcfAnalysis?.baseScenario;
  const dcfScenarios = dcfAnalysis?.scenarios || [];
  const sensitivityMatrix = dcfAnalysis?.sensitivityMatrix;
  const probabilityResult = dcfAnalysis?.probabilityWeightedResult;
  const comparison = dcfAnalysis?.scenarioComparison;

  const quickResult = calculateQuickIRR.data as any;
  const displayIRR = quickResult?.irr ?? (dcfAnalysis?.baseScenario?.irr ?? 0);
  const displayLeveredIRR = quickResult?.leveredIrr ?? (dcfAnalysis?.baseScenario?.leveredIRR ?? 0);
  const displayNPV = quickResult?.npv ?? (dcfAnalysis?.baseScenario?.npv ?? 0);
  const displayEquityMultiple = quickResult?.equityMultiple ?? (dcfAnalysis?.baseScenario?.equityMultiple ?? 0);

  const SourceBadge = ({ field }: { field: string }) => {
    const src = inputSources[field];
    if (!src) return null;
    const isManual = src === 'Manual';
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
        isManual 
          ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400'
          : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
      }`}>
        {src}
      </span>
    );
  };

  return (
    <div ref={pdfRef} className="fm-page" data-testid="dcf-calculator-page">
      {onTabChange && (
        <WorkflowNavigation currentTab="dcf" onNavigate={onTabChange} />
      )}
      <div className="fm-header">
        <div>
          <div className="fm-header-title">DCF Analysis</div>
          <div className="fm-header-sub">Discounted cash flow · IRR · NPV · Sensitivity</div>
        </div>
        <div className="fm-header-actions">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            data-testid="refresh-btn"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" data-testid="export-btn">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="dcf-analysis" title="DCF Analysis" />
        </div>
      </div>

      {/* Real-Time Calculator */}
      <div className="fm-body">
      <div className="fm-panel">
        <div className="fm-panel-header">
          <div className="fm-panel-title">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Real-Time DCF Calculator
          </div>
          <span className="text-xs text-muted-foreground">Adjust inputs for instant IRR · NPV · Equity Multiple</span>
        </div>
        <div className="fm-panel-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Purchase Price</Label>
                <SourceBadge field="purchasePrice" />
              </div>
              <Input
                value={liveInputs.purchasePrice ? `$${liveInputs.purchasePrice.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('purchasePrice', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$10,000,000"
                data-testid="input-purchase-price"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Year 1 NOI</Label>
                <SourceBadge field="year1NOI" />
              </div>
              <Input
                value={liveInputs.year1NOI ? `$${liveInputs.year1NOI.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('year1NOI', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$500,000"
                data-testid="input-year1-noi"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>NOI Growth Rate</Label>
                <SourceBadge field="noiGrowthRate" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.noiGrowthRate]}
                  onValueChange={([v]) => handleInputChange('noiGrowthRate', v)}
                  min={0}
                  max={10}
                  step={0.25}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.noiGrowthRate}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Discount Rate</Label>
                <MarketRatePicker 
                  compact
                  filterRateTypes={['treasury']}
                  onSelectRate={(rate, label) => {
                    const riskPremium = 4;
                    handleInputChange('discountRate', rate + riskPremium);
                  }}
                  buttonLabel="Risk-Free + Premium"
                />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.discountRate]}
                  onValueChange={([v]) => handleInputChange('discountRate', v)}
                  min={5}
                  max={20}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.discountRate}%</span>
              </div>
              <MarketRateContext 
                currentRate={liveInputs.discountRate}
                rateType="treasury"
                tenor="10y"
                className="mt-1"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Exit Cap Rate</Label>
                <SourceBadge field="exitCapRate" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.exitCapRate]}
                  onValueChange={([v]) => handleInputChange('exitCapRate', v)}
                  min={4}
                  max={12}
                  step={0.25}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.exitCapRate}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Hold Period (Years)</Label>
                <SourceBadge field="holdPeriod" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.holdPeriod]}
                  onValueChange={([v]) => handleInputChange('holdPeriod', v)}
                  min={3}
                  max={15}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.holdPeriod}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Loan Amount</Label>
                <SourceBadge field="loanAmount" />
              </div>
              <Input
                value={liveInputs.loanAmount ? `$${liveInputs.loanAmount.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('loanAmount', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$7,500,000"
                data-testid="input-loan-amount"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Loan Rate</Label>
                <SourceBadge field="loanRate" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.loanRate]}
                  onValueChange={([v]) => handleInputChange('loanRate', v)}
                  min={3}
                  max={10}
                  step={0.125}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.loanRate}%</span>
              </div>
            </div>
          </div>

          {/* Real-Time Results */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                <p className="text-sm text-green-600 dark:text-green-400">Unlevered IRR</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {calculateQuickIRR.isPending ? (
                    <Activity className="h-6 w-6 animate-pulse mx-auto" />
                  ) : (
                    formatPercent(displayIRR)
                  )}
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                <p className="text-sm text-blue-600 dark:text-blue-400">Going-In Cap</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatPercent((liveInputs.year1NOI / liveInputs.purchasePrice) * 100)}
                </p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
                <p className="text-sm text-purple-600 dark:text-purple-400">LTV Ratio</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {formatPercent((liveInputs.loanAmount / liveInputs.purchasePrice) * 100)}
                </p>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg text-center">
                <p className="text-sm text-orange-600 dark:text-orange-400">Equity Required</p>
                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                  {formatCompactCurrency(liveInputs.purchasePrice * 1.02 - liveInputs.loanAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Lease vs Pro-Forma Reconciliation Banner ── */}
      {(() => {
        const leaseIncomeInjected = dcfAnalysis?.meta?.leaseIncomeInjected === true;
        if (!leaseIncomeInjected) return null;
        const leaseEGI = dcfAnalysis?.leaseIncome?.totalEGIAnnual ?? leaseIncomeData?.totalEGIAnnual;
        if (!leaseEGI) return null;
        // Compare against the live modeling input — if user has snapped to lease EGI this becomes 0
        const proFormaNOI = liveInputs.year1NOI || proFormaData?.metrics?.year1Noi || proFormaData?.noi?.[0];
        if (!proFormaNOI) return null;
        const delta = leaseEGI - proFormaNOI;
        const variancePct = Math.abs(delta / proFormaNOI) * 100;
        if (variancePct <= 10) return null;
        const isHigher = delta > 0;
        return (
          <div
            className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
            data-testid="lease-variance-banner"
          >
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Lease income deviates significantly from pro-forma estimate
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-1">
                Actual lease EGI is <strong>{formatCompactCurrency(leaseEGI)}</strong> —{' '}
                {isHigher ? 'above' : 'below'} your pro-forma Year&nbsp;1 NOI of{' '}
                <strong>{formatCompactCurrency(proFormaNOI)}</strong> by{' '}
                <strong>{variancePct.toFixed(1)}%</strong> ({isHigher ? '+' : ''}{formatCompactCurrency(delta)}).{' '}
                The DCF is using lease-derived income as the Year&nbsp;1 basis.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className="text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-700"
              >
                {variancePct.toFixed(1)}% variance
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 whitespace-nowrap"
                onClick={() => {
                  const newInputs = { ...liveInputs, year1NOI: leaseEGI };
                  setLiveInputs(newInputs);
                  setUserOverrides(prev => ({ ...prev, year1NOI: true }));
                  setInputSources(prev => ({ ...prev, year1NOI: 'Lease Data' }));
                  debouncedCalculate(newInputs);
                  patchScenarioAssumptionsMutation.mutate({
                    ...(activeScenario?.assumptions ?? {}),
                    year1NOIOverride: leaseEGI,
                    year1NOISource: 'Lease Data',
                  });
                }}
                data-testid="use-lease-egi-btn"
              >
                Use Lease EGI
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ── Major Tenant Lease Expiry Warning ── */}
      {leaseExpiryWarnings.length > 0 && (
        <div
          className="flex items-start gap-3 p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
          data-testid="lease-expiry-warning-banner"
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveTab('cashflows');
            setExpandedCFYears(prev => {
              const next = new Set(prev);
              leaseExpiryWarnings.forEach(w => next.add(w.expiryYear));
              return next;
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveTab('cashflows');
              setExpandedCFYears(prev => {
                const next = new Set(prev);
                leaseExpiryWarnings.forEach(w => next.add(w.expiryYear));
                return next;
              });
            }
          }}
        >
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold text-red-800 dark:text-red-300">
              Major tenant{leaseExpiryWarnings.length > 1 ? 's' : ''} rolling during hold period
            </p>
            <ul className="mt-1 space-y-0.5">
              {leaseExpiryWarnings.map(w => (
                <li key={w.leaseId} className="text-red-700 dark:text-red-400">
                  <strong>{w.tenantName}</strong> ({(w.egiPct * 100).toFixed(0)}% of Year&nbsp;1 EGI) — expires in{' '}
                  <strong>Year&nbsp;{w.expiryYear}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">View Cash Flows</span>
            <ChevronRight className="h-4 w-4 text-red-500" />
          </div>
        </div>
      )}

      {/* ── Institutional KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 divide-x divide-border border rounded-lg overflow-hidden">
        {[
          { label: 'Levered IRR', value: formatPercent(baseScenario?.leveredIRR || 0), accent: 'text-emerald-600 dark:text-emerald-400', testId: 'card-irr' },
          { label: 'Unlevered IRR', value: formatPercent(baseScenario?.irr || 0), accent: 'text-emerald-600/80' },
          { label: 'Equity Multiple', value: `${(baseScenario?.equityMultiple || 0).toFixed(2)}x`, accent: 'text-blue-600 dark:text-blue-400', testId: 'card-equity-multiple' },
          { label: 'NPV', value: formatCompactCurrency(baseScenario?.npv || 0), accent: (baseScenario?.npv||0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500', testId: 'card-npv' },
          { label: 'Cash-on-Cash', value: formatPercent(baseScenario?.avgCashOnCash || 0), accent: 'text-amber-600 dark:text-amber-400', testId: 'card-coc' },
          { label: 'Going-In Cap', value: formatPercent(baseScenario?.goingInCapRate || 0), accent: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Exit Cap', value: formatPercent(baseScenario?.exitCapRate || 0), accent: 'text-violet-600 dark:text-violet-400' },
          { label: 'Payback', value: baseScenario?.paybackPeriod ? `${baseScenario.paybackPeriod.toFixed(1)} yrs` : '—', accent: 'text-foreground' },
        ].map(m => (
          <div key={m.label} className="px-3 py-3" data-testid={(m as any).testId}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1.5">{m.label}</p>
            <p className={`text-base font-bold tabular-nums leading-none ${m.accent}`}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="finance-kpi-card variant-green" data-testid="card-irr">
          <div className="kpi-icon">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Levered IRR</div>
            <div className="kpi-value">{formatPercent(baseScenario?.leveredIRR || 0)}</div>
          </div>
        </div>

        <div className="finance-kpi-card variant-blue" data-testid="card-equity-multiple">
          <div className="kpi-icon">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Equity Multiple</div>
            <div className="kpi-value">{(baseScenario?.equityMultiple || 0).toFixed(2)}x</div>
          </div>
        </div>

        <div className="finance-kpi-card" data-testid="card-npv">
          <div className="kpi-icon">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">NPV</div>
            <div className="kpi-value">{formatCompactCurrency(baseScenario?.npv || 0)}</div>
          </div>
        </div>

        <div className="finance-kpi-card variant-orange" data-testid="card-coc">
          <div className="kpi-icon">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Cash-on-Cash</div>
            <div className="kpi-value">{formatPercent(baseScenario?.avgCashOnCash || 0)}</div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Lease Income Override Status Badge (visible on Overview tab only) ── */}
      {activeTab === 'overview' && (() => {
        const injected = dcfAnalysis?.meta?.leaseIncomeInjected === true;
        const toggled = dcfAnalysis?.meta?.useLeaseIncomeForDcf === true || leaseOverrideEnabled === true;
        const hasLeases = leaseIncomeData?.hasLeases;
        if (!toggled && !injected) return null;
        let label: React.ReactNode;
        if (injected) {
          label = <>Lease income is <strong>active</strong> in this DCF{hasLeases ? ` (${leaseIncomeData.leaseCount} lease${leaseIncomeData.leaseCount !== 1 ? 's' : ''})` : ''}</>;
        } else if (hasLeases) {
          label = <>Lease income override is <strong>enabled</strong> — recalculate to inject lease data</>;
        } else {
          label = <>Lease income override is <strong>enabled</strong> — no leases loaded yet</>;
        }
        return (
          <button
            type="button"
            onClick={() => setActiveTab('lease-income')}
            data-testid="lease-income-status-badge"
            className="flex items-center gap-2 text-sm w-fit rounded-md px-3 py-1.5 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
              border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100
              dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>
        );
      })()}

      {baseScenario?.cashFlows && baseScenario.cashFlows.length > 0 && (
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Levered Cash Flow Waterfall</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={baseScenario.cashFlows.map((cf: any) => ({
              yr: cf.year ? `Y${cf.year}` : `P${cf.period}`,
              noi: Math.round(cf.noi || cf.cashFlowBeforeDebt || 0),
              cf: Math.round(cf.cashFlowAfterDebt ?? cf.leveredCashFlow ?? cf.cashFlow ?? cf.noi ?? 0),
            }))} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="yr" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} />
              <RechartTooltip formatter={(v, n) => [`${Number(v).toLocaleString()}`, n === 'noi' ? 'NOI' : 'Levered CF']} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid hsl(var(--border))' }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Bar dataKey="noi" fill="#3b82f6" opacity={0.25} radius={[3,3,0,0]} name="NOI" />
              <Line type="monotone" dataKey="cf" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Levered CF" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="sensitivity" data-testid="tab-sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="cashflows" data-testid="tab-cashflows">Cash Flows</TabsTrigger>
          <TabsTrigger value="lease-income" data-testid="tab-lease-income" className="relative">
            Lease Income
            {leaseIncomeData?.hasLeases && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                {leaseIncomeData.leaseCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Probability Weighted Results */}
            {probabilityResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Probability-Weighted Analysis</CardTitle>
                  <CardDescription>Expected returns across all scenarios</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Expected NPV</p>
                        <p className="text-lg font-bold">
                          {formatCompactCurrency(probabilityResult.expectedNPV)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Expected IRR</p>
                        <p className="text-lg font-bold">
                          {formatPercent(probabilityResult.expectedIRR)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Expected Multiple</p>
                        <p className="text-lg font-bold">
                          {probabilityResult.expectedEquityMultiple.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">90% Confidence Interval (NPV)</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{formatCompactCurrency(probabilityResult.confidenceInterval.low)}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full relative">
                          <div 
                            className="absolute top-0 left-1/4 right-1/4 h-full bg-blue-500 rounded-full"
                          />
                        </div>
                        <span className="text-sm">{formatCompactCurrency(probabilityResult.confidenceInterval.high)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scenario Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="finance-section-header">Scenario Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {comparison?.scenarios.map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison?.metrics.slice(0, 6).map((m, idx) => (
                      <tr key={m.name} className={['IRR', 'NPV', 'Equity Multiple'].includes(m.name) ? 'highlight-row' : ''}>
                        <td>{m.name}</td>
                        {comparison.scenarios.map((s) => (
                          <td key={s}>
                            {m.unit === '$' 
                              ? formatCompactCurrency(m.values[s] || 0)
                              : m.unit === '%'
                              ? formatPercent(m.values[s] || 0)
                              : m.unit === 'x'
                              ? `${(m.values[s] || 0).toFixed(2)}x`
                              : `${(m.values[s] || 0).toFixed(1)} ${m.unit}`
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Investment Scenarios</CardTitle>
                  <CardDescription>Compare base, upside, and downside cases</CardDescription>
                </div>
                <Button variant="outline" size="sm" data-testid="add-scenario-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scenario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {dcfScenarios.map((scenario) => (
                  <Card 
                    key={scenario.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedScenario === scenario.id && "ring-2 ring-primary",
                      scenario.isBase && "border-blue-500"
                    )}
                    onClick={() => setSelectedScenario(
                      selectedScenario === scenario.id ? null : scenario.id
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                        {scenario.isBase && (
                          <Badge>Base</Badge>
                        )}
                        {scenario.probability && (
                          <Badge variant="outline">{(scenario.probability * 100).toFixed(0)}% prob</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">IRR</span>
                          <span className="font-semibold text-green-600">
                            {formatPercent(scenario.irr)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Levered IRR</span>
                          <span className="font-semibold">
                            {formatPercent(scenario.leveredIRR)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Equity Multiple</span>
                          <span className="font-semibold">
                            {scenario.equityMultiple.toFixed(2)}x
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">NPV</span>
                          <span className={cn(
                            "font-semibold",
                            scenario.npv >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {formatCompactCurrency(scenario.npv)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Cash-on-Cash</span>
                          <span className="font-semibold">
                            {formatPercent(scenario.avgCashOnCash)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Payback</span>
                          <span className="font-semibold">
                            {scenario.paybackPeriod.toFixed(1)} years
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sensitivity Tab */}
        <TabsContent value="sensitivity" className="mt-4">
          {sensitivityMatrix && (
            <Card>
              <CardHeader>
                <CardTitle>IRR Sensitivity Matrix</CardTitle>
                <CardDescription>
                  {sensitivityMatrix.variable1.name} vs {sensitivityMatrix.variable2.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-muted">{sensitivityMatrix.variable1.name} ↓ / {sensitivityMatrix.variable2.name} →</TableHead>
                        {sensitivityMatrix.variable2.values.map((v, i) => (
                          <TableHead key={i} className="text-center min-w-[80px]">
                            {(v * 100).toFixed(1)}%
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sensitivityMatrix.results.map((row, i) => {
                        const baseIRR = baseScenario?.irr || 10;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium bg-muted">
                              {(sensitivityMatrix.variable1.values[i] * 100).toFixed(1)}%
                            </TableCell>
                            {row.map((value, j) => {
                              const variance = value - baseIRR;
                              return (
                                <TableCell 
                                  key={j}
                                  className={cn(
                                    "text-center font-medium",
                                    variance > 2 ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" :
                                    variance > 0 ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400" :
                                    variance < -2 ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" :
                                    variance < 0 ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400" :
                                    "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
                                  )}
                                >
                                  {value.toFixed(1)}%
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cash Flows Tab */}
        <TabsContent value="cashflows" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="finance-section-header">Projected Cash Flows - {baseScenario?.name || 'Base Case'}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {dcfAnalysis?.yearlyLeaseIncome && dcfAnalysis.yearlyLeaseIncome.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full px-2.5 py-1">
                      <Users className="h-3 w-3" />
                      Click a year row to see per-tenant lease breakdown
                    </span>
                  )}
                  {dcfAnalysis?.yearlyLeaseIncome && dcfAnalysis.yearlyLeaseIncome.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => openExportDialog('xlsx')}
                        data-testid="export-lease-income-xlsx"
                      >
                        <Download className="h-3 w-3" />
                        Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => openExportDialog('csv')}
                        data-testid="export-lease-income-csv"
                      >
                        <Download className="h-3 w-3" />
                        CSV
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}></th>
                      <th>Year</th>
                      <th>NOI</th>
                      <th>CF Before Debt</th>
                      <th>CF After Debt</th>
                      <th>Present Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseScenario?.cashFlows.map((cf) => {
                      const yearNum = cf.year ?? cf.period;
                      const leaseYear = dcfAnalysis?.yearlyLeaseIncome?.find(y => y.year === yearNum);
                      const isExpanded = expandedCFYears.has(yearNum);
                      const hasLeaseDetail = leaseYear && leaseYear.leaseDetail && leaseYear.leaseDetail.length > 0;
                      return (
                        <Fragment key={`cf-frag-${cf.period}`}>
                          <tr
                            className={hasLeaseDetail ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}
                            onClick={hasLeaseDetail ? () => toggleCFYear(yearNum) : undefined}
                          >
                            <td className="text-center">
                              {hasLeaseDetail && (
                                <ChevronRight
                                  className={cn(
                                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                    isExpanded && 'rotate-90'
                                  )}
                                />
                              )}
                            </td>
                            <td>Year {cf.period}</td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                {formatCurrency(cf.noi)}
                                {leaseYear && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    EGI {formatCompactCurrency(leaseYear.egiAnnual)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{formatCurrency(cf.cashFlowBeforeDebt)}</td>
                            <td>
                              <span className={cf.cashFlowAfterDebt >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                {formatCurrency(cf.cashFlowAfterDebt)}
                              </span>
                            </td>
                            <td className="text-muted-foreground">{formatCurrency(cf.presentValue)}</td>
                          </tr>
                          {isExpanded && hasLeaseDetail && (
                            <tr key={`cf-detail-${cf.period}`} className="bg-emerald-50/60 dark:bg-emerald-950/20">
                              <td></td>
                              <td colSpan={5} className="py-3 px-2">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Users className="h-3 w-3" />
                                  Year {yearNum} — Per-Tenant Lease Income
                                </div>
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="text-left border-b border-border">
                                      <th className="pb-1 font-medium text-muted-foreground pr-4">Tenant</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Base Rent</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Step Rent</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Recoveries</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Free Rent</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Vacancy</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right pr-4">TI/LC</th>
                                      <th className="pb-1 font-medium text-muted-foreground text-right">Net EGI</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {leaseYear.leaseDetail.map((ld) => {
                                      const netEgi = ld.baseRent + ld.recovery - ld.freeRentReduction
                                        - (ld.vacancyDeduction ?? 0) - (ld.tiLcCost ?? 0);
                                      const hasVacancy = (ld.vacancyDeduction ?? 0) > 0;
                                      const hasTiLc = (ld.tiLcCost ?? 0) > 0;
                                      const isSchedule = ld.escalationType === 'SCHEDULE';
                                      return (
                                        <tr key={ld.leaseId} className="border-b border-border/40 last:border-0">
                                          <td className="py-1 pr-4 font-medium">
                                            <div className="flex items-center gap-1.5">
                                              {ld.tenantName}
                                              {ld.isExpired && (
                                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800">
                                                  Expired
                                                </Badge>
                                              )}
                                              {isSchedule && !ld.isExpired && (
                                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800">
                                                  Step
                                                </Badge>
                                              )}
                                            </div>
                                          </td>
                                          <td className={cn('py-1 pr-4 text-right tabular-nums', ld.isExpired && 'text-muted-foreground')}>
                                            {ld.isExpired ? '$0' : formatCurrency(ld.baseRent)}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {isSchedule && !ld.isExpired && ld.activeStepRentAnnual != null ? (
                                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                {formatCurrency(ld.activeStepRentAnnual)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className={cn('py-1 pr-4 text-right tabular-nums', ld.isExpired && 'text-muted-foreground')}>
                                            {ld.isExpired ? '$0' : formatCurrency(ld.recovery)}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {ld.freeRentReduction > 0 ? (
                                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                -{formatCurrency(ld.freeRentReduction)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {hasVacancy ? (
                                              <span className="text-orange-600 dark:text-orange-400 font-medium">
                                                -{formatCurrency(ld.vacancyDeduction)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {hasTiLc ? (
                                              <span className="text-red-600 dark:text-red-400 font-medium">
                                                -{formatCurrency(ld.tiLcCost)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className="py-1 text-right tabular-nums font-semibold">
                                            {netEgi < 0 ? (
                                              <span className="text-red-600 dark:text-red-400">{formatCurrency(netEgi)}</span>
                                            ) : netEgi === 0 ? (
                                              <span className="text-muted-foreground">$0</span>
                                            ) : (
                                              formatCurrency(netEgi)
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="border-t border-border font-semibold">
                                      <td className="pt-1.5 pr-4 text-muted-foreground">Total</td>
                                      <td className="pt-1.5 pr-4 text-right tabular-nums">{formatCurrency(leaseYear.baseRentAnnual)}</td>
                                      <td className="pt-1.5 pr-4 text-right tabular-nums text-muted-foreground">—</td>
                                      <td className="pt-1.5 pr-4 text-right tabular-nums">{formatCurrency(leaseYear.recoveryAnnual)}</td>
                                      <td className="pt-1.5 pr-4 text-right tabular-nums text-amber-600 dark:text-amber-400">
                                        {leaseYear.leaseDetail.reduce((s, l) => s + l.freeRentReduction, 0) > 0
                                          ? `-${formatCurrency(leaseYear.leaseDetail.reduce((s, l) => s + l.freeRentReduction, 0))}`
                                          : '—'}
                                      </td>
                                      <td className="pt-1.5 pr-4 text-right tabular-nums text-orange-600 dark:text-orange-400">
                                        {(leaseYear.vacancyDeductionTotal ?? 0) > 0
                                          ? `-${formatCurrency(leaseYear.vacancyDeductionTotal)}`
                                          : '—'}
                                      </td>
                                      <td className="pt-1.5 pr-4 text-right tabular-nums text-red-600 dark:text-red-400">
                                        {(leaseYear.tiLcCostTotal ?? 0) > 0
                                          ? `-${formatCurrency(leaseYear.tiLcCostTotal)}`
                                          : '—'}
                                      </td>
                                      <td className="pt-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(leaseYear.egiAnnual)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    <tr className="highlight-row">
                      <td></td>
                      <td>Terminal Value</td>
                      <td colSpan={2}></td>
                      <td>{formatCurrency(baseScenario?.terminalValueAmount || 0)}</td>
                      <td>
                        {formatCurrency(
                          (baseScenario as any)?.presentValueOfTerminal ||
                          ((baseScenario?.terminalValueAmount || 0) / 
                            Math.pow(1 + (liveInputs.discountRate / 100), baseScenario?.cashFlows.length || 10))
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lease Income Reconciliation Tab */}
        <TabsContent value="lease-income" className="mt-4 space-y-6">
          {/* Lease Income Override Toggle */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 p-1.5">
                    <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Use Lease Income in DCF</p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      When enabled, tenant lease schedules (base rent + recoveries + escalations) override
                      the pro-forma revenue estimate in the DCF model. Disable to use manual pro-forma inputs only.
                    </p>
                    {leaseIncomeData?.hasLeases && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          dcfAnalysis?.meta?.leaseIncomeInjected
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          <Info className="h-3 w-3" />
                          {dcfAnalysis?.meta?.leaseIncomeInjected
                            ? 'Lease income is active in the current DCF'
                            : 'Lease income is not used in the current DCF'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={leaseOverrideEnabled === true}
                    onCheckedChange={(checked) => {
                      setLeaseOverrideEnabled(checked);
                      updateLeaseOverrideMutation.mutate(checked);
                    }}
                    disabled={leaseOverrideEnabled === null || updateLeaseOverrideMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground w-12">
                    {leaseOverrideEnabled === null ? '—' : leaseOverrideEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {!leaseIncomeData?.hasLeases ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">No active tenant leases found for this project</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add leases on the Commercial Tenants tab to see actual income flowing into this DCF model.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Rollover Vacancy Assumption Settings */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="mt-0.5 rounded-md bg-orange-100 dark:bg-orange-950 p-1.5">
                      <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Rollover Vacancy Assumption</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                        When a lease expires mid-hold, model a vacancy period before re-leasing.
                        Lost rent and TI/LC costs are deducted from EGI in the affected years,
                        making the DCF more conservative.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Vacancy Period (months)</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[rolloverVacancyMonths]}
                          onValueChange={([v]) => {
                            setRolloverVacancyMonths(v);
                            debouncedSaveRollover({ rolloverVacancyMonths: v, rolloverTiLcPerSf });
                          }}
                          min={0}
                          max={24}
                          step={1}
                          className="flex-1"
                          data-testid="rollover-vacancy-months-slider"
                        />
                        <span className="text-sm font-semibold w-12 text-right tabular-nums">
                          {rolloverVacancyMonths} mo
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Lost rent deducted from EGI for each expiring lease
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">TI/LC Allowance ($/SF)</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[rolloverTiLcPerSf]}
                          onValueChange={([v]) => {
                            setRolloverTiLcPerSf(v);
                            debouncedSaveRollover({ rolloverVacancyMonths, rolloverTiLcPerSf: v });
                          }}
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid="rollover-tilc-per-sf-slider"
                        />
                        <span className="text-sm font-semibold w-16 text-right tabular-nums">
                          ${rolloverTiLcPerSf}/SF
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        One-time re-leasing cost charged in the year of expiry
                      </p>
                    </div>
                  </div>
                  {(rolloverVacancyMonths > 0 || rolloverTiLcPerSf > 0) && (
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant="outline" className="text-orange-700 dark:text-orange-300 border-orange-400 dark:border-orange-700 text-[11px]">
                        Active: {rolloverVacancyMonths} mo vacancy
                        {rolloverTiLcPerSf > 0 ? ` · $${rolloverTiLcPerSf}/SF TI/LC` : ''}
                      </Badge>
                      {updateRolloverAssumptionsMutation.isPending && (
                        <span className="text-[11px] text-muted-foreground">Saving…</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mid-Hold Lease Expiry Warning */}
              {(() => {
                const acquisitionDateStr = dcfAnalysis?.meta?.acquisitionDate;
                if (!acquisitionDateStr || !leaseIncomeData?.leaseBreakdown?.length) return null;
                const holdStart = new Date(acquisitionDateStr);
                const holdPeriod = liveInputs.holdPeriod ?? dcfAnalysis?.holdPeriodYears ?? 5;
                const holdEnd = new Date(acquisitionDateStr);
                holdEnd.setFullYear(holdEnd.getFullYear() + holdPeriod);
                const breakdown = leaseIncomeData.leaseBreakdown as LeaseBreakdownItem[];
                const expiringLeases = breakdown.filter((lease) => {
                  if (!lease.leaseEndDate) return false;
                  const endDate = new Date(lease.leaseEndDate);
                  return endDate > holdStart && endDate < holdEnd;
                });
                if (!expiringLeases.length) return null;
                const totalEGI = leaseIncomeData.totalEGIAnnual;
                return (
                  <div
                    className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4"
                    data-testid="mid-hold-expiry-warning"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          {expiringLeases.length === 1
                            ? '1 lease expires during the hold period'
                            : `${expiringLeases.length} leases expire during the hold period`}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          Income from {expiringLeases.length === 1 ? 'this lease' : 'these leases'} will drop off before the end of Year {holdPeriod}.
                          Account for re-leasing costs, vacancy, or downside scenarios.
                        </p>
                        <div className="mt-3 flex flex-col gap-1.5">
                          {expiringLeases.map((lease) => {
                            const egi = lease.baseRentAnnual + lease.recoveryAnnual;
                            const egiPct = totalEGI > 0 ? (egi / totalEGI) * 100 : null;
                            const expiryYear = lease.leaseEndDate
                              ? new Date(lease.leaseEndDate).getFullYear()
                              : '—';
                            return (
                              <div
                                key={lease.leaseId}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                              >
                                <span className="font-semibold text-amber-900 dark:text-amber-200">
                                  {lease.tenantName}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                                >
                                  Expires {expiryYear}
                                </Badge>
                                {egiPct !== null && (
                                  <span className="text-amber-700 dark:text-amber-400">
                                    {egiPct.toFixed(1)}% of EGI
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 italic">
                          Tip: Run a downside scenario with a vacancy period or reduced growth rate
                          to stress-test returns against re-leasing risk.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Annual Base Rent</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(leaseIncomeData.totalBaseRentAnnual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">From {leaseIncomeData.leaseCount} active lease{leaseIncomeData.leaseCount !== 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Annual Recoveries</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(leaseIncomeData.totalRecoveryAnnual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">CAM, taxes, insurance</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total EGI</p>
                    <p className="text-2xl font-bold">{formatCurrency(leaseIncomeData.totalEGIAnnual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Effective gross income</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Wtd Avg Escalation</p>
                    <p className="text-2xl font-bold">
                      {leaseIncomeData.weightedAvgEscalationRate > 0
                        ? `${(leaseIncomeData.weightedAvgEscalationRate * 100).toFixed(2)}%`
                        : 'Flat'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Annual rent growth</p>
                  </CardContent>
                </Card>
              </div>

              {/* Delta vs. Pro-Forma comparison row */}
              {(() => {
                const leaseEGI = dcfAnalysis?.leaseIncome?.totalEGIAnnual ?? leaseIncomeData.totalEGIAnnual;
                const proFormaNOI = proFormaData?.metrics?.year1Noi || proFormaData?.noi?.[0] || liveInputs.year1NOI;
                if (!leaseEGI || !proFormaNOI) return null;
                const delta = leaseEGI - proFormaNOI;
                const variancePct = proFormaNOI > 0 ? (delta / proFormaNOI) * 100 : 0;
                const isHigher = delta > 0;
                const isSignificant = Math.abs(variancePct) > 10;
                return (
                  <div
                    className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-lg border text-sm ${
                      isSignificant
                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800'
                        : 'border-border bg-muted/40'
                    }`}
                    data-testid="lease-delta-row"
                  >
                    <span className="font-medium text-muted-foreground">Delta vs. Pro-Forma:</span>
                    <span className="font-semibold">
                      Pro-forma NOI: <span className="tabular-nums">{formatCompactCurrency(proFormaNOI)}</span>
                    </span>
                    <span className="font-semibold">
                      Lease EGI: <span className="tabular-nums">{formatCompactCurrency(leaseEGI)}</span>
                    </span>
                    <span className={`font-bold tabular-nums ${isHigher ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isHigher ? '+' : ''}{formatCompactCurrency(delta)} ({variancePct.toFixed(1)}%)
                    </span>
                    {isSignificant && (
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-700">
                        &gt;10% — review inputs
                      </Badge>
                    )}
                  </div>
                );
              })()}

              {/* Year-by-Year Projection */}
              {leaseIncomeData.yearlyProjection?.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          Lease Income Projection (with Escalations)
                        </CardTitle>
                        <CardDescription>Base rent grows by tenant-specific escalation schedules; recoveries grow at 2.5%/yr</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
                          <ChevronRight className="h-3 w-3" />
                          Click a row to expand per-tenant detail
                        </span>
                        {dcfAnalysis?.yearlyLeaseIncome && dcfAnalysis.yearlyLeaseIncome.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => openExportDialog('xlsx')}
                              data-testid="export-lease-income-xlsx-li"
                            >
                              <Download className="h-3 w-3" />
                              Excel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => openExportDialog('csv')}
                              data-testid="export-lease-income-csv-li"
                            >
                              <Download className="h-3 w-3" />
                              CSV
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead style={{ width: 28 }}></TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Base Rent</TableHead>
                          <TableHead className="text-right">Recoveries</TableHead>
                          <TableHead className="text-right">Total EGI</TableHead>
                          <TableHead className="text-right">YoY Growth</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaseIncomeData.yearlyProjection.map((row: any, idx: number) => {
                          const prev = idx > 0 ? leaseIncomeData.yearlyProjection[idx - 1] : null;
                          const yoyGrowth = prev && (prev.egiAnnual ?? prev.totalEGI) > 0
                            ? (((row.egiAnnual ?? row.totalEGI) - (prev.egiAnnual ?? prev.totalEGI)) / (prev.egiAnnual ?? prev.totalEGI)) * 100
                            : null;
                          const leaseYearDetail = dcfAnalysis?.yearlyLeaseIncome?.find(y => y.year === row.year);
                          const isExpanded = expandedLeaseYears.has(row.year);
                          const hasDetail = leaseYearDetail && leaseYearDetail.leaseDetail && leaseYearDetail.leaseDetail.length > 0;
                          return (
                            <Fragment key={`ly-frag-${row.year}`}>
                              <TableRow
                                className={hasDetail ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}
                                onClick={hasDetail ? () => toggleLeaseYear(row.year) : undefined}
                              >
                                <TableCell className="text-center">
                                  {hasDetail && (
                                    <ChevronRight
                                      className={cn(
                                        'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                        isExpanded && 'rotate-90'
                                      )}
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">Year {row.year}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.baseRentAnnual)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.recoveryAnnual)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(row.egiAnnual ?? row.totalEGI)}</TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {yoyGrowth !== null ? `+${yoyGrowth.toFixed(1)}%` : '—'}
                                </TableCell>
                              </TableRow>
                              {isExpanded && hasDetail && (
                                <TableRow key={`ly-detail-${row.year}`} className="bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20">
                                  <TableCell></TableCell>
                                  <TableCell colSpan={5} className="py-3">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Users className="h-3 w-3" />
                                      Year {row.year} — Per-Tenant Breakdown
                                    </div>
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="text-left border-b border-border">
                                          <th className="pb-1 font-medium text-muted-foreground pr-4">Tenant</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Base Rent</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Step Rent</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Recoveries</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Free Rent</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right pr-4">Vacancy</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right pr-4">TI/LC</th>
                                          <th className="pb-1 font-medium text-muted-foreground text-right">Net EGI</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {leaseYearDetail.leaseDetail.map((ld) => {
                                          const vacDed = ld.vacancyDeduction ?? 0;
                                          const tiLc = ld.tiLcCost ?? 0;
                                          const netEgi = ld.baseRent + ld.recovery - ld.freeRentReduction
                                            - vacDed - tiLc;
                                          const isSchedule = ld.escalationType === 'SCHEDULE';
                                          const isPreCommencement = !!ld.isFuture && !ld.isExpired
                                            && ld.baseRent === 0 && ld.freeRentReduction === 0;
                                          const leaseStartFormatted = ld.leaseStartDate
                                            ? new Date(ld.leaseStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : null;
                                          return (
                                            <tr key={ld.leaseId} className={cn('border-b border-border/40 last:border-0', isPreCommencement && 'opacity-70')}>
                                              <td className="py-1 pr-4 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                  {ld.tenantName}
                                                  {ld.isExpired && (
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800">
                                                      Expired
                                                    </Badge>
                                                  )}
                                                  {isPreCommencement && (
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700 cursor-default">
                                                            Pre-Leased
                                                          </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs text-xs">
                                                          {leaseStartFormatted
                                                            ? `Lease commences ${leaseStartFormatted}. No income until commencement.`
                                                            : 'Lease has not yet commenced. No income in pre-commencement years.'}
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  )}
                                                  {isSchedule && !ld.isExpired && (
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800">
                                                      Step
                                                    </Badge>
                                                  )}
                                                </div>
                                              </td>
                                              <td className={cn('py-1 pr-4 text-right tabular-nums', (ld.isExpired || isPreCommencement) && 'text-muted-foreground')}>
                                                {(ld.isExpired || isPreCommencement) ? '$0' : formatCurrency(ld.baseRent)}
                                              </td>
                                              <td className="py-1 pr-4 text-right tabular-nums">
                                                {isSchedule && !ld.isExpired && ld.activeStepRentAnnual != null ? (
                                                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                    {formatCurrency(ld.activeStepRentAnnual)}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </td>
                                              <td className={cn('py-1 pr-4 text-right tabular-nums', (ld.isExpired || isPreCommencement) && 'text-muted-foreground')}>
                                                {(ld.isExpired || isPreCommencement) ? '$0' : formatCurrency(ld.recovery)}
                                              </td>
                                              <td className="py-1 pr-4 text-right tabular-nums">
                                                {ld.freeRentReduction > 0 ? (
                                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                    -{formatCurrency(ld.freeRentReduction)}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </td>
                                              <td className="py-1 pr-4 text-right tabular-nums">
                                                {vacDed > 0 ? (
                                                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                                                    -{formatCurrency(vacDed)}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </td>
                                              <td className="py-1 pr-4 text-right tabular-nums">
                                                {tiLc > 0 ? (
                                                  <span className="text-red-600 dark:text-red-400 font-medium">
                                                    -{formatCurrency(tiLc)}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </td>
                                              <td className="py-1 text-right tabular-nums font-semibold">
                                                {isPreCommencement ? (
                                                  <TooltipProvider>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <span className="text-muted-foreground cursor-default inline-flex items-center gap-0.5">
                                                          $0 <Info className="h-3 w-3" />
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent side="left" className="max-w-xs text-xs">
                                                        {leaseStartFormatted
                                                          ? `Lease goes live ${leaseStartFormatted}. No income until commencement.`
                                                          : 'Lease has not yet commenced. No income in pre-commencement years.'}
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                ) : netEgi < 0 ? (
                                                  <span className="text-red-600 dark:text-red-400">{formatCurrency(netEgi)}</span>
                                                ) : netEgi === 0 ? (
                                                  <span className="text-muted-foreground">$0</span>
                                                ) : (
                                                  formatCurrency(netEgi)
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        <tr className="border-t border-border font-semibold">
                                          <td className="pt-1.5 pr-4 text-muted-foreground">Total</td>
                                          <td className="pt-1.5 pr-4 text-right tabular-nums">{formatCurrency(leaseYearDetail.baseRentAnnual)}</td>
                                          <td className="pt-1.5 pr-4 text-right tabular-nums text-muted-foreground">—</td>
                                          <td className="pt-1.5 pr-4 text-right tabular-nums">{formatCurrency(leaseYearDetail.recoveryAnnual)}</td>
                                          <td className="pt-1.5 pr-4 text-right tabular-nums text-amber-600 dark:text-amber-400">
                                            {leaseYearDetail.leaseDetail.reduce((s, l) => s + l.freeRentReduction, 0) > 0
                                              ? `-${formatCurrency(leaseYearDetail.leaseDetail.reduce((s, l) => s + l.freeRentReduction, 0))}`
                                              : '—'}
                                          </td>
                                          <td className="pt-1.5 pr-4 text-right tabular-nums text-orange-600 dark:text-orange-400">
                                            {(leaseYearDetail.vacancyDeductionTotal ?? 0) > 0
                                              ? `-${formatCurrency(leaseYearDetail.vacancyDeductionTotal)}`
                                              : '—'}
                                          </td>
                                          <td className="pt-1.5 pr-4 text-right tabular-nums text-red-600 dark:text-red-400">
                                            {(leaseYearDetail.tiLcCostTotal ?? 0) > 0
                                              ? `-${formatCurrency(leaseYearDetail.tiLcCostTotal)}`
                                              : '—'}
                                          </td>
                                          <td className="pt-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(leaseYearDetail.egiAnnual)}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Per-Tenant Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Per-Tenant Income Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Lease Type</TableHead>
                          <TableHead>SF</TableHead>
                          <TableHead className="text-right">Base Rent/Yr</TableHead>
                          <TableHead className="text-right">Recoveries/Yr</TableHead>
                          <TableHead>Escalation</TableHead>
                          <TableHead>Lease Expiry</TableHead>
                          <TableHead className="text-right">% of EGI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(leaseIncomeData.leaseBreakdown as LeaseBreakdownItem[] | undefined)?.map((lease) => {
                          const pct = leaseIncomeData.totalEGIAnnual > 0
                            ? ((lease.baseRentAnnual + lease.recoveryAnnual) / leaseIncomeData.totalEGIAnnual) * 100
                            : 0;
                          const escalationLabel =
                            lease.escalationType === 'PERCENT' ? `${(lease.escalationRate * 100).toFixed(2)}%/yr`
                            : lease.escalationType === 'CPI' ? 'CPI'
                            : lease.escalationType === 'CPI_CAP_FLOOR' ? 'CPI (capped)'
                            : lease.escalationType === 'SCHEDULE' ? 'Scheduled'
                            : lease.escalationType === 'FIXED_DOLLAR' ? 'Fixed $'
                            : 'Flat';
                          const hasSchedule = lease.escalationType === 'SCHEDULE' && lease.scheduleJson && lease.scheduleJson.length > 0;
                          return (
                            <TableRow key={lease.leaseId}>
                              <TableCell className="font-medium">{lease.tenantName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{lease.leaseType}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{Number(lease.sf).toLocaleString()}</TableCell>
                              <TableCell className="text-right">{formatCurrency(lease.baseRentAnnual)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(lease.recoveryAnnual)}</TableCell>
                              <TableCell className="text-sm">
                                {hasSchedule ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 cursor-pointer text-blue-600 dark:text-blue-400 underline decoration-dotted whitespace-nowrap">
                                          Scheduled <Info className="h-3 w-3 shrink-0" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs p-3">
                                        <div className="text-xs space-y-1">
                                          <div className="font-semibold mb-1.5 text-xs">Step Schedule</div>
                                          {lease.scheduleJson!.map((step, i) => (
                                            <div key={i} className="flex justify-between gap-6">
                                              <span className="text-muted-foreground">{step.effectiveDate}</span>
                                              <span className="font-medium tabular-nums">
                                                {step.unit === 'PSF_YEAR'
                                                  ? `$${step.value.toFixed(2)}/sf/yr`
                                                  : step.unit === 'PER_MONTH'
                                                  ? `${formatCurrency(step.value)}/mo`
                                                  : `${formatCurrency(step.value)}/yr`}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  escalationLabel
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{lease.leaseEndDate}</TableCell>
                              <TableCell className="text-right font-medium">{pct.toFixed(1)}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Reconciliation Note */}
              <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-emerald-800 dark:text-emerald-300">
                        Lease income is wired into this DCF model
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-400 mt-1">
                        Year 1 NOI is derived from actual tenant base rent and recoveries.
                        Forward-year projections apply each lease's escalation method individually:
                        SCHEDULE leases step to their configured absolute rent amounts (shown in the
                        "Step Rent" column when you expand a year), while other leases compound using
                        a {leaseIncomeData.weightedAvgEscalationRate > 0
                          ? `weighted average escalation rate of ${(leaseIncomeData.weightedAvgEscalationRate * 100).toFixed(2)}%/yr`
                          : 'the scenario revenue growth rate'}.
                        The scenario revenue growth rate is applied as a minimum floor.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Monte Carlo Simulation */}
      {projectId && <DCFMonteCarloPanel projectId={projectId} />}

      {/* Decision Support (Tornado, Attribution, IC Memo) */}
      {projectId && <DecisionSupportAccordion projectId={projectId} />}

      {/* Lease Income Export Column Picker */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Choose Export Columns
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Select the columns to include in the {exportDialogFormat === 'xlsx' ? 'Excel' : 'CSV'} export. At least one column must remain selected.
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            {LEASE_EXPORT_COLUMNS.map(col => (
              <label
                key={col.key}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <Checkbox
                  checked={selectedExportColumns.has(col.key)}
                  onCheckedChange={() => toggleExportColumn(col.key)}
                  id={`export-col-${col.key}`}
                />
                <span className="text-sm">{col.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="flex items-center gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const all = new Set(ALL_COLUMN_KEYS);
                setSelectedExportColumns(all);
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(ALL_COLUMN_KEYS));
              }}
            >
              Select All
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setExportDialogOpen(false);
                exportLeaseIncome(exportDialogFormat, selectedExportColumns);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/**
 * Component test: "Use Lease EGI" snap action
 *
 * Verifies:
 * 1. When DCF analysis has leaseIncomeInjected=true and Lease EGI diverges
 *    from pro-forma Year 1 NOI by > 10%, the reconciliation banner and
 *    "Use Lease EGI" button are visible.
 * 2. Clicking the button snaps year1NOI to totalEGIAnnual, the banner
 *    disappears (variance = 0%), and the calculator re-runs via
 *    POST /api/dcf/quick-irr with the updated year1NOI value.
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';

// ── Routing ────────────────────────────────────────────────────────────────────
vi.mock('wouter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wouter')>();
  return {
    ...actual,
    useParams: () => ({ projectId: TEST_PROJECT_ID }),
    useLocation: () => ['/modeling/projects/test-proj-001/workspace/dcf-calculator', vi.fn()],
  };
});

// ── Heavy chart / spreadsheet deps ────────────────────────────────────────────
vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => null,
  Cell: () => null,
  Legend: () => null,
}));

vi.mock('xlsx', () => ({
  default: {
    utils: { aoa_to_sheet: vi.fn(() => ({})), book_new: vi.fn(() => ({})), book_append_sheet: vi.fn() },
    writeFile: vi.fn(),
  },
  utils: { aoa_to_sheet: vi.fn(() => ({})), book_new: vi.fn(() => ({})), book_append_sheet: vi.fn() },
  writeFile: vi.fn(),
}));

vi.mock('lodash.debounce', () => ({
  default: (fn: (...args: unknown[]) => unknown) => {
    const immediate = (...args: unknown[]) => fn(...args);
    immediate.cancel = () => {};
    immediate.flush = () => {};
    return immediate;
  },
}));

// ── Lucide icons — forwardRef components that crash jsdom without mocking ──────
vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  );
  return {
    TrendingUp: Icon, TrendingDown: Icon, Calculator: Icon, DollarSign: Icon,
    BarChart3: Icon, PieChart: Icon, RefreshCw: Icon, Download: Icon,
    Plus: Icon, Trash2: Icon, ChevronUp: Icon, ChevronDown: Icon, ChevronRight: Icon,
    Percent: Icon, Target: Icon, Activity: Icon, Layers: Icon, AlertCircle: Icon,
    Building2: Icon, Info: Icon, Users: Icon, Check: Icon, X: Icon,
    ChevronLeft: Icon, MoreHorizontal: Icon, MoreVertical: Icon,
  };
});

// ── Radix UI Slot (used inside shadcn Button) ──────────────────────────────────
vi.mock('@radix-ui/react-slot', () => ({
  Slot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Slottable: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── shadcn UI components — minimal pass-through stubs ─────────────────────────
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    size: _size,
    variant: _variant,
    className,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant: _variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    ...rest
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} />,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({
    children,
    onValueChange: _onValueChange,
    value: _v,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <button data-tab-value={value}>{children}</button>,
  TabsContent: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    asChild: _a,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => <div data-select-value={value}>{children}</div>,
  SelectTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
    step,
    className,
  }: {
    value: number[];
    onValueChange?: (v: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
  }) => (
    <input
      type="range"
      value={value[0] ?? 0}
      min={min}
      max={max}
      step={step}
      className={className}
      onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
      readOnly={!onValueChange}
    />
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    className,
    disabled,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      className={className}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ScrollBar: () => null,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <td className={className}>{children}</td>,
  TableHead: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <th className={className}>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <tr className={className} onClick={onClick}>
      {children}
    </tr>
  ),
}));

// ── Internal component stubs ───────────────────────────────────────────────────
vi.mock('@/components/modeling/workflow-navigation', () => ({
  WorkflowNavigation: () => null,
}));

vi.mock('@/components/modeling/FMEmptyState', () => ({
  FMEmptyState: () => <div data-testid="fm-empty-state" />,
}));

vi.mock('@/components/modeling/MarketRatePicker', () => ({
  MarketRatePicker: () => null,
  MarketRateContext: () => null,
}));

vi.mock('@/components/ui/export-pdf-button', () => ({
  ExportPdfButton: () => null,
}));

vi.mock('@/components/workspace/DCFMonteCarloPanel', () => ({
  DCFMonteCarloPanel: () => null,
  DecisionSupportAccordion: () => null,
}));

vi.mock('@/hooks/use-hold-period', () => ({
  useHoldPeriod: () => ({ holdPeriod: 5, setHoldPeriod: vi.fn() }),
}));

// ── apiRequest stub (mutations must not throw; spy is used in tests) ───────────
vi.mock('@/lib/queryClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queryClient')>();
  return {
    ...actual,
    apiRequest: vi.fn().mockResolvedValue({}),
  };
});

// ── Imports that depend on the mocks above ────────────────────────────────────
import { apiRequest } from '@/lib/queryClient';
import DCFCalculatorPage from '../dcf-calculator';

// ── Constants ──────────────────────────────────────────────────────────────────
const TEST_PROJECT_ID = 'test-proj-001';
const TOTAL_EGI_ANNUAL = 150_000;
const PRO_FORMA_NOI = 100_000;

// ── Fixture builder ────────────────────────────────────────────────────────────
function buildQueryClient(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  qc.setQueryData(['/api/modeling/projects', TEST_PROJECT_ID, 'dcf'], {
    projectId: TEST_PROJECT_ID,
    scenarios: [],
    baseScenario: null,
    scenarioComparison: { scenarios: [], metrics: [] },
    meta: {
      leaseIncomeInjected: true,
      useLeaseIncomeForDcf: true,
      revenueGrowthRateUsed: 0.03,
      leaseEscalationRateUsed: null,
      discountRate: 0.08,
      hasDebt: false,
      overridesApplied: false,
      generatedAt: new Date().toISOString(),
    },
    leaseIncome: {
      hasLeases: true,
      totalEGIAnnual: TOTAL_EGI_ANNUAL,
      totalBaseRentAnnual: TOTAL_EGI_ANNUAL,
      totalRecoveryAnnual: 0,
      weightedAvgEscalationRate: 0.03,
    },
    years: [],
    yearlyLeaseIncome: [],
  });

  qc.setQueryData(['/api/modeling/projects', TEST_PROJECT_ID, 'pro-forma'], {
    metrics: { year1Noi: PRO_FORMA_NOI, exitCapRate: 0.065, revenueGrowthRate: 0.03 },
    holdPeriod: 5,
    noi: [PRO_FORMA_NOI],
  });

  qc.setQueryData(['/api/modeling/projects', TEST_PROJECT_ID], {
    id: TEST_PROJECT_ID,
    name: 'Test Project',
    purchasePrice: '1000000',
    propertyType: 'office',
  });

  qc.setQueryData(['/api/modeling/projects', TEST_PROJECT_ID, 'scenarios'], []);

  qc.setQueryData(['/api/modeling/projects', TEST_PROJECT_ID, 'lease-income'], {
    hasLeases: true,
    totalEGIAnnual: TOTAL_EGI_ANNUAL,
    totalBaseRentAnnual: TOTAL_EGI_ANNUAL,
    totalRecoveryAnnual: 0,
    leaseCount: 2,
    leaseBreakdown: [],
  });

  qc.setQueryData(['/api/capital-stacks', TEST_PROJECT_ID], null);

  return qc;
}

function renderDCF(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <DCFCalculatorPage />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DCF Calculator — Use Lease EGI snap action', () => {
  let queryClient: QueryClient;
  let mockApiRequest: MockedFunction<typeof apiRequest>;

  beforeEach(() => {
    queryClient = buildQueryClient();
    mockApiRequest = apiRequest as MockedFunction<typeof apiRequest>;
    mockApiRequest.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('shows the lease-variance-banner and use-lease-egi-btn when variance > 10%', async () => {
    renderDCF(queryClient);

    await waitFor(
      () => expect(screen.getByTestId('lease-variance-banner')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(screen.getByTestId('use-lease-egi-btn')).toBeInTheDocument();
    expect(screen.getByTestId('use-lease-egi-btn')).toHaveTextContent('Use Lease EGI');
  });

  it('banner text shows correct variance direction and magnitude', async () => {
    renderDCF(queryClient);

    const banner = await screen.findByTestId('lease-variance-banner', {}, { timeout: 3000 });

    expect(banner).toHaveTextContent('Lease income deviates significantly from pro-forma estimate');
    expect(banner).toHaveTextContent('50.0% variance');
  });

  it('clicking Use Lease EGI snaps year1NOI, hides banner, and re-runs the calculator', async () => {
    renderDCF(queryClient);

    await screen.findByTestId('lease-variance-banner', {}, { timeout: 3000 });

    const noiInput = screen.getByTestId('input-year1-noi') as HTMLInputElement;
    const btn = screen.getByTestId('use-lease-egi-btn');

    await act(async () => {
      fireEvent.click(btn);
    });

    // year1NOI input should reflect the snapped lease EGI value
    await waitFor(() => {
      expect(noiInput.value).toBe(`$${TOTAL_EGI_ANNUAL.toLocaleString()}`);
    });

    // With variance now 0%, the reconciliation banner must disappear
    await waitFor(() => {
      expect(screen.queryByTestId('lease-variance-banner')).not.toBeInTheDocument();
    });

    // The debounced recalculation must fire a POST to the quick-IRR endpoint
    // carrying the updated year1NOI so the displayed metrics stay in sync
    const quickIrrCalls = mockApiRequest.mock.calls.filter(
      ([method, url]) => method === 'POST' && url === '/api/dcf/quick-irr',
    );
    expect(quickIrrCalls.length).toBeGreaterThan(0);

    const lastCall = quickIrrCalls[quickIrrCalls.length - 1] as [
      string,
      string,
      { input: { year1NOI: number } },
    ];
    expect(lastCall[2].input.year1NOI).toBe(TOTAL_EGI_ANNUAL);
  });
});

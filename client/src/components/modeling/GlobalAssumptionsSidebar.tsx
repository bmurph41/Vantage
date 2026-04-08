import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FundAssumptions {
  exitCapRate?: number;
  interestRate?: number;
  ltv?: number;
  holdPeriod?: number;
  carriedInterestPct?: number;
  preferredReturnPct?: number;
  prefType?: 'simple' | 'compound';
  gpCatchUp?: 'none' | 'full';
  gpCommitmentPct?: number;
  saleCostsPct?: number;
  benefitsRate?: number;
  salaryGrowth?: number;
  numberOfPartners?: number;
}

interface Project {
  id: string;
  name?: string;
  customMetrics?: {
    fundAssumptions?: FundAssumptions;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ReturnsData {
  lpIrr?: number;
  lpMoic?: number;
  gpPromote?: number;
  gpNet?: number;
  [key: string]: unknown;
}

interface GlobalAssumptionsSidebarProps {
  projectId: string;
  project?: Project | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return '--';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | undefined | null, decimals = 2): string {
  if (v == null || isNaN(v)) return '--';
  return v.toFixed(decimals);
}

function fmtCurrency(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function irrColor(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return 'text-slate-400';
  if (v >= 0.15) return 'text-emerald-400';
  if (v >= 0.08) return 'text-green-400';
  if (v >= 0) return 'text-yellow-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2 mt-4 first:mt-0">
      {children}
    </h3>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  suffix?: string;
  onChange: (raw: string) => void;
  onBlur: () => void;
  type?: 'number' | 'text';
  step?: string;
  min?: string;
  max?: string;
}

function FieldRow({ label, value, suffix, onChange, onBlur, type = 'number', step = '0.1', min, max }: FieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <span className="text-[11px] text-slate-300 whitespace-nowrap truncate">{label}</span>
      <div className="flex items-center gap-0.5">
        <input
          type={type}
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-[52px] h-6 rounded bg-[#0F1B33] border border-slate-600 text-right text-[11px] text-white px-1.5 focus:outline-none focus:border-amber-400 transition-colors"
        />
        {suffix && <span className="text-[10px] text-slate-400 w-3">{suffix}</span>}
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
}

function ToggleRow({ label, options, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <span className="text-[11px] text-slate-300 whitespace-nowrap truncate">{label}</span>
      <div className="flex rounded overflow-hidden border border-slate-600">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-[10px] px-2 py-0.5 transition-colors ${
              value === opt.value
                ? 'bg-amber-500/80 text-white font-medium'
                : 'bg-[#0F1B33] text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OutputRow({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-[12px] font-semibold tabular-nums ${colorClass ?? 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <div className="h-3 w-20 rounded bg-slate-600/50 animate-pulse" />
      <div className="h-6 w-[52px] rounded bg-slate-600/50 animate-pulse" />
    </div>
  );
}

function SectionSkeleton() {
  return (
    <>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GlobalAssumptionsSidebar({ projectId, project: projectProp }: GlobalAssumptionsSidebarProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Data queries -------------------------------------------------------

  const { data: fetchedProject, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId && !projectProp,
  });

  const project: Project | undefined = projectProp ?? fetchedProject ?? undefined;

  const fundAssumptions: FundAssumptions = project?.customMetrics?.fundAssumptions ?? {};

  const { data: returnsData } = useQuery<ReturnsData>({
    queryKey: ['/api/returns/model', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/returns/model/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  // We keep pro-forma and pricing queries active so the cache stays warm,
  // even though the sidebar itself primarily reads from project + returns.
  useQuery({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
    enabled: !!projectId,
  });

  useQuery({
    queryKey: ['/api/modeling/projects', projectId, 'deal-pricing', 'inputs'],
    enabled: !!projectId,
  });

  // ---- Local editable state (seeded from fundAssumptions) -----------------

  const [fields, setFields] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate local fields from fundAssumptions when project data loads
  useEffect(() => {
    if (!project || hydrated) return;
    const fa = project.customMetrics?.fundAssumptions;
    if (!fa) {
      setHydrated(true);
      return;
    }
    const initial: Record<string, string> = {};
    const pctFields = [
      'exitCapRate', 'interestRate', 'ltv', 'carriedInterestPct',
      'preferredReturnPct', 'gpCommitmentPct', 'saleCostsPct',
      'benefitsRate', 'salaryGrowth',
    ];
    for (const key of pctFields) {
      const v = (fa as Record<string, unknown>)[key];
      if (v != null && typeof v === 'number' && !isNaN(v)) {
        initial[key] = (v * 100).toFixed(1);
      }
    }
    const intFields = ['holdPeriod', 'numberOfPartners'];
    for (const key of intFields) {
      const v = (fa as Record<string, unknown>)[key];
      if (v != null && typeof v === 'number' && !isNaN(v)) {
        initial[key] = String(Math.round(v));
      }
    }
    setFields(initial);
    setHydrated(true);
  }, [project, hydrated]);

  function getField(key: string, multiplier = 100, decimals = 1): string {
    if (key in fields) return fields[key];
    const v = (fundAssumptions as Record<string, unknown>)[key];
    if (v == null || typeof v !== 'number' || isNaN(v)) return '';
    return (v * multiplier).toFixed(decimals);
  }

  function setField(key: string, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
  }

  // ---- Mutation ------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (updatedAssumptions: FundAssumptions) => {
      const existingMetrics = project?.customMetrics ?? {};
      const patch = {
        customMetrics: {
          ...existingMetrics,
          fundAssumptions: {
            ...existingMetrics.fundAssumptions,
            ...updatedAssumptions,
          },
        },
      };
      // Sync hold period to config table (canonical source for pro-forma engine)
      if (updatedAssumptions.holdPeriod != null) {
        try {
          await apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
            holdPeriod: updatedAssumptions.holdPeriod,
          });
        } catch (_) { /* config may not exist yet */ }
        // Also sync to project root for backwards compat
        (patch as any).holdPeriodYears = updatedAssumptions.holdPeriod;
      }
      const res = await apiRequest('PATCH', `/api/modeling/projects/${projectId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/model', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'deal-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'lp-reporting'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-waterfall/projects', projectId] });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const debouncedSave = useCallback(
    (updatedAssumptions: FundAssumptions) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate(updatedAssumptions);
      }, 500);
    },
    [saveMutation],
  );

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function commitField(key: string, divisor = 100) {
    const raw = fields[key];
    if (raw == null) return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) return;
    const value = divisor === 1 ? parsed : parsed / divisor;
    debouncedSave({ [key]: value });
  }

  function commitToggle(key: string, value: string) {
    // Toggles update local display immediately via fundAssumptions read
    saveMutation.mutate({ [key]: value } as unknown as FundAssumptions);
  }

  function commitIntField(key: string) {
    const raw = fields[key];
    if (raw == null) return;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    debouncedSave({ [key]: parsed });
  }

  // ---- Loading state ------------------------------------------------------

  const isLoading = !projectProp && projectLoading;

  // ---- Render --------------------------------------------------------------

  return (
    <div className="relative flex-shrink-0 flex" style={{ zIndex: 20 }}>
      {/* Sidebar panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          collapsed ? 'w-0' : 'w-full max-w-[220px]'
        }`}
      >
        <div className="w-full max-w-[220px] h-full bg-[#1B2A4A] flex flex-col border-r border-slate-700">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
            {isLoading ? (
              <>
                <SectionHeader>Fund Structure</SectionHeader>
                <SectionSkeleton />
                <SectionHeader>Waterfall &amp; Carry</SectionHeader>
                <SectionSkeleton />
                <SectionHeader>G&amp;A Globals</SectionHeader>
                <SectionSkeleton />
              </>
            ) : (
              <>
                {/* Fund Structure */}
                <SectionHeader>Fund Structure</SectionHeader>
                <FieldRow
                  label="Exit Cap Rate"
                  value={getField('exitCapRate')}
                  suffix="%"
                  onChange={(v) => setField('exitCapRate', v)}
                  onBlur={() => commitField('exitCapRate')}
                />
                <FieldRow
                  label="Interest Rate"
                  value={getField('interestRate')}
                  suffix="%"
                  onChange={(v) => setField('interestRate', v)}
                  onBlur={() => commitField('interestRate')}
                />
                <FieldRow
                  label="LTV (Debt %)"
                  value={getField('ltv')}
                  suffix="%"
                  onChange={(v) => setField('ltv', v)}
                  onBlur={() => commitField('ltv')}
                  min="0"
                  max="100"
                />
                <FieldRow
                  label="Hold Period"
                  value={getField('holdPeriod', 1, 0)}
                  suffix="yr"
                  onChange={(v) => setField('holdPeriod', v)}
                  onBlur={() => commitIntField('holdPeriod')}
                  step="1"
                  min="1"
                  max="30"
                />

                {/* Waterfall & Carry */}
                <SectionHeader>Waterfall &amp; Carry</SectionHeader>
                <FieldRow
                  label="Carried Int."
                  value={getField('carriedInterestPct')}
                  suffix="%"
                  onChange={(v) => setField('carriedInterestPct', v)}
                  onBlur={() => commitField('carriedInterestPct')}
                />
                <FieldRow
                  label="Pref Return"
                  value={getField('preferredReturnPct')}
                  suffix="%"
                  onChange={(v) => setField('preferredReturnPct', v)}
                  onBlur={() => commitField('preferredReturnPct')}
                />
                <ToggleRow
                  label="Pref Type"
                  options={[
                    { label: 'Simple', value: 'simple' },
                    { label: 'Compound', value: 'compound' },
                  ]}
                  value={fundAssumptions.prefType ?? 'simple'}
                  onChange={(v) => commitToggle('prefType', v)}
                />
                <ToggleRow
                  label="GP Catch-Up"
                  options={[
                    { label: 'None', value: 'none' },
                    { label: 'Full', value: 'full' },
                  ]}
                  value={fundAssumptions.gpCatchUp ?? 'none'}
                  onChange={(v) => commitToggle('gpCatchUp', v)}
                />
                <FieldRow
                  label="GP Commit"
                  value={getField('gpCommitmentPct')}
                  suffix="%"
                  onChange={(v) => setField('gpCommitmentPct', v)}
                  onBlur={() => commitField('gpCommitmentPct')}
                />
                <FieldRow
                  label="Sale Costs"
                  value={getField('saleCostsPct')}
                  suffix="%"
                  onChange={(v) => setField('saleCostsPct', v)}
                  onBlur={() => commitField('saleCostsPct')}
                />

                {/* G&A Globals */}
                <SectionHeader>G&amp;A Globals</SectionHeader>
                <FieldRow
                  label="Benefits Rate"
                  value={getField('benefitsRate')}
                  suffix="%"
                  onChange={(v) => setField('benefitsRate', v)}
                  onBlur={() => commitField('benefitsRate')}
                />
                <FieldRow
                  label="Salary Growth"
                  value={getField('salaryGrowth')}
                  suffix="%"
                  onChange={(v) => setField('salaryGrowth', v)}
                  onBlur={() => commitField('salaryGrowth')}
                />
                <FieldRow
                  label="# of Partners"
                  value={getField('numberOfPartners', 1, 0)}
                  onChange={(v) => setField('numberOfPartners', v)}
                  onBlur={() => commitIntField('numberOfPartners')}
                  step="1"
                  min="1"
                  max="99"
                />
              </>
            )}
          </div>

          {/* Live Output -- sticky bottom */}
          <div className="border-t border-slate-600 bg-[#142038] px-3 py-3 flex-shrink-0">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2">
              Live Output
            </h3>
            <OutputRow
              label="LP IRR"
              value={pct(returnsData?.lpIrr)}
              colorClass={irrColor(returnsData?.lpIrr)}
            />
            <OutputRow
              label="LP MOIC"
              value={returnsData?.lpMoic != null ? `${fmtNum(returnsData.lpMoic, 2)}x` : '--'}
              colorClass={
                returnsData?.lpMoic != null && returnsData.lpMoic >= 2.0
                  ? 'text-emerald-400'
                  : returnsData?.lpMoic != null && returnsData.lpMoic >= 1.5
                    ? 'text-green-400'
                    : 'text-white'
              }
            />
            <OutputRow
              label="GP Promote"
              value={fmtCurrency(returnsData?.gpPromote)}
              colorClass="text-amber-300"
            />
            <OutputRow
              label="GP Net"
              value={fmtCurrency(returnsData?.gpNet)}
              colorClass="text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-4 top-4 z-30 flex h-8 w-4 items-center justify-center rounded-r bg-[#1B2A4A] border border-l-0 border-slate-600 text-slate-300 hover:text-white hover:bg-[#243660] transition-colors"
        aria-label={collapsed ? 'Expand assumptions sidebar' : 'Collapse assumptions sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </div>
  );
}

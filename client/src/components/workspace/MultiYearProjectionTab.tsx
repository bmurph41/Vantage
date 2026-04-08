/**
 * MultiYearProjectionTab — institutional redesign
 * Uses app design system (Tailwind + shadcn) to match all other FM tabs.
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, ChevronRight, ChevronDown, AlertCircle, RefreshCw, Building2, Calendar, BarChart3, ArrowUpRight } from 'lucide-react';

interface ProjectionLineItem { key: string; label: string; category: string; amount: number; formula?: string; isVacancyOverride?: boolean; }
interface ProjectionMonthlyBreakdown { month: number; monthName: string; revenue: number; expenses: number; noi: number; daysInMonth: number; isSeasonal?: boolean; }
interface ProjectionYear { year: number; label: string; totalRevenue: number; totalExpenses: number; noi: number; capex: number; ncf: number; revenueLines: ProjectionLineItem[]; expenseLines: ProjectionLineItem[]; monthlyBreakdown: ProjectionMonthlyBreakdown[]; noiChange?: number; noiChangePct?: number; capexScheduleEntry?: { amount: number; label?: string }; }
interface ExitMetrics { exitNOI: number; exitValue: number; sellingCosts: number; netSaleProceeds: number; impliedCapRate: number; }
interface MultiYearProjectionResult { years: ProjectionYear[]; noiWaterfall: { year: number; label: string; noi: number; ncf: number }[]; exit: ExitMetrics | null; totalNOI: number; totalNCF: number; noiCAGR: number | null; }
interface ProjectionConfig { holdPeriod: number; revenueGrowthRate: number; expenseGrowthRate: number; exitCapRate?: number; vacancyCurve?: { year: number; vacancyRate: number }[]; capexSchedule?: { year: number; amount: number; label?: string }[]; }

const fmtFull = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtCpt  = (n: number) => Math.abs(n) >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
const fmtPct  = (n: number) => `${(n * 100).toFixed(2)}%`;
const fmtPctS = (n: number) => (n >= 0 ? '+' : '') + `${(n * 100).toFixed(1)}%`;

function KpiStrip({ result, config }: { result: MultiYearProjectionResult; config: ProjectionConfig }) {
  const y1 = result.years[0];
  const yn = result.years[result.years.length - 1];
  const items = [
    { label: 'Year 1 NOI',                    value: fmtFull(y1?.noi ?? 0),                accent: 'text-foreground', bg: '' },
    { label: `Year ${config.holdPeriod} NOI`, value: fmtFull(yn?.noi ?? 0),               accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5' },
    { label: 'NOI CAGR',                       value: result.noiCAGR != null ? fmtPct(result.noiCAGR) : '—', accent: (result.noiCAGR ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground', bg: '' },
    { label: 'Total NOI',                      value: fmtCpt(result.totalNOI),               accent: 'text-foreground', bg: '' },
    { label: 'Total NCF',                      value: fmtCpt(result.totalNCF),               accent: 'text-blue-600 dark:text-blue-400', bg: '' },
    ...(result.exit ? [
      { label: 'Exit Value',    value: fmtCpt(result.exit.exitValue),         accent: 'text-violet-600 dark:text-violet-400', bg: '' },
      { label: 'Net Proceeds',  value: fmtCpt(result.exit.netSaleProceeds),   accent: 'text-violet-600/80 dark:text-violet-400/80', bg: '' },
      { label: 'Exit Cap Rate', value: fmtPct(result.exit.impliedCapRate),    accent: 'text-indigo-600 dark:text-indigo-400', bg: '' },
    ] : []),
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 divide-x divide-border border rounded-lg overflow-hidden">
      {items.map(m => (
        <div key={m.label} className={`px-3 py-3 ${m.bg}`}>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1.5">{m.label}</p>
          <p className={`text-sm font-bold tabular-nums leading-none ${m.accent}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function ProjectionChart({ result }: { result: MultiYearProjectionResult }) {
  const data = result.years.map(y => ({ label: y.label, revenue: Math.round(y.totalRevenue), expenses: Math.round(y.totalExpenses), noi: Math.round(y.noi), ncf: Math.round(y.ncf) }));
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Revenue & NOI Projection</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-primary/20 inline-block" />Revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-destructive/20 inline-block" />Expenses</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />NOI</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-5">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtCpt} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={64} />
            <Tooltip formatter={(v: number, n: string) => [fmtFull(v), n === 'revenue' ? 'Revenue' : n === 'expenses' ? 'Expenses' : n === 'noi' ? 'NOI' : 'NCF']} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid hsl(var(--border))' }} />
            <Bar dataKey="revenue"  fill="hsl(var(--primary))"     opacity={0.15} radius={[2,2,0,0]} />
            <Bar dataKey="expenses" fill="hsl(var(--destructive))" opacity={0.12} radius={[2,2,0,0]} />
            <Line type="monotone" dataKey="noi" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="ncf" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function YearRow({ projYear, isLast }: { projYear: ProjectionYear; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const cp = projYear.noiChangePct;
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setOpen(o => !o)}>
        <TableCell className="py-2.5 pl-4 font-medium">
          <div className="flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
            <span className={isLast ? 'text-primary font-semibold' : ''}>{projYear.label}</span>
            {isLast && <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1">Exit Yr</Badge>}
          </div>
        </TableCell>
        <TableCell className="py-2.5 text-right tabular-nums text-sm">{fmtFull(projYear.totalRevenue)}</TableCell>
        <TableCell className="py-2.5 text-right tabular-nums text-sm text-muted-foreground">{fmtFull(projYear.totalExpenses)}</TableCell>
        <TableCell className={`py-2.5 text-right tabular-nums text-sm font-semibold ${projYear.noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtFull(projYear.noi)}</TableCell>
        <TableCell className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">{projYear.capex > 0 ? fmtFull(projYear.capex) : '—'}</TableCell>
        <TableCell className={`py-2.5 text-right tabular-nums text-sm ${projYear.ncf >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>{fmtFull(projYear.ncf)}</TableCell>
        <TableCell className={`py-2.5 pr-4 text-right tabular-nums text-xs ${cp != null ? (cp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-muted-foreground'}`}>{cp != null ? fmtPctS(cp) : '—'}</TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="px-4 pb-4 pt-0 bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Revenue Lines</p>
                <div className="space-y-0.5">
                  {projYear.revenueLines.map(l => (
                    <div key={l.key} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span className="text-muted-foreground truncate pr-2">{l.label}</span>
                      <span className="tabular-nums font-medium">{fmtFull(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expense Lines</p>
                <div className="space-y-0.5">
                  {projYear.expenseLines.map(l => (
                    <div key={l.key} className={`flex justify-between text-xs py-1 border-b border-border/40 ${l.isVacancyOverride ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      <span className="truncate pr-2">{l.label}{l.isVacancyOverride ? ' ⚡' : ''}</span>
                      <span className="tabular-nums font-medium">{fmtFull(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {projYear.monthlyBreakdown?.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly NOI</p>
                <div className="grid grid-cols-12 gap-1">
                  {projYear.monthlyBreakdown.map(m => (
                    <div key={m.month} className={`rounded px-1 py-1.5 text-center border ${m.isSeasonal ? 'bg-blue-500/10 border-blue-500/30' : 'bg-background border-border/50'}`}>
                      <p className="text-[9px] text-muted-foreground">{m.monthName.slice(0,3)}</p>
                      <p className={`text-[10px] font-semibold tabular-nums ${m.noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtCpt(m.noi)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ConfigPanel({ config, onChange }: { config: ProjectionConfig; onChange: (c: ProjectionConfig) => void }) {
  const [showVacancy, setShowVacancy] = useState(false);
  const [showCapex,   setShowCapex]   = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />Projection Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Hold Period</Label>
            <Select value={String(config.holdPeriod)} onValueChange={v => onChange({ ...config, holdPeriod: Number(v) })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4,5,6,7,8,9,10,12,15].map(n => <SelectItem key={n} value={String(n)}>{n} Year{n > 1 ? 's' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Revenue Growth</Label>
            <div className="flex items-center gap-1.5">
              <Input type="number" step="0.1" min="-10" max="20" className="h-8 text-sm text-right" value={(config.revenueGrowthRate*100).toFixed(1)} onChange={e => onChange({ ...config, revenueGrowthRate: Number(e.target.value)/100 })} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expense Growth</Label>
            <div className="flex items-center gap-1.5">
              <Input type="number" step="0.1" min="-10" max="20" className="h-8 text-sm text-right" value={(config.expenseGrowthRate*100).toFixed(1)} onChange={e => onChange({ ...config, expenseGrowthRate: Number(e.target.value)/100 })} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exit Cap Rate</Label>
            <div className="flex items-center gap-1.5">
              <Input type="number" step="0.1" min="1" max="20" className="h-8 text-sm text-right" value={((config.exitCapRate??0.065)*100).toFixed(1)} onChange={e => onChange({ ...config, exitCapRate: Number(e.target.value)/100 })} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowVacancy(v => !v)}>
            {showVacancy ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Vacancy Burn-off
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowCapex(v => !v)}>
            {showCapex ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}CapEx Schedule
          </Button>
        </div>
        {showVacancy && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Override vacancy rate per year — leave blank to use growth rate compounding</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Array.from({ length: config.holdPeriod }, (_, i) => i+1).map(yr => {
                const entry = config.vacancyCurve?.find(e => e.year === yr);
                return (
                  <div key={yr} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Yr {yr}</Label>
                    <div className="flex items-center gap-1">
                      <Input type="number" step="0.5" min="0" max="100" placeholder="—" className="h-7 text-xs text-right"
                        value={entry ? (entry.vacancyRate*100).toFixed(1) : ''}
                        onChange={e => {
                          const val = e.target.value;
                          const curve = (config.vacancyCurve??[]).filter(c => c.year !== yr);
                          if (val !== '') curve.push({ year: yr, vacancyRate: Number(val)/100 });
                          onChange({ ...config, vacancyCurve: curve.length ? curve : undefined });
                        }} />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {showCapex && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Schedule major capital events — leave blank for 2% of EGI default</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Array.from({ length: config.holdPeriod }, (_, i) => i+1).map(yr => {
                const entry = config.capexSchedule?.find(e => e.year === yr);
                return (
                  <div key={yr} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Yr {yr} CapEx</Label>
                    <Input type="number" step="1000" min="0" placeholder="default" className="h-7 text-xs"
                      value={entry ? entry.amount : ''}
                      onChange={e => {
                        const val = e.target.value;
                        const sched = (config.capexSchedule??[]).filter(c => c.year !== yr);
                        if (val !== '') sched.push({ year: yr, amount: Number(val) });
                        onChange({ ...config, capexSchedule: sched.length ? sched : undefined });
                      }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExitCard({ exit, holdPeriod }: { exit: ExitMetrics; holdPeriod: number }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-violet-500" />Exit Analysis — Year {holdPeriod}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-5">
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border border rounded-lg overflow-hidden">
          {[
            { label: 'Exit NOI',      value: fmtFull(exit.exitNOI),           accent: 'text-foreground' },
            { label: 'Exit Cap Rate', value: fmtPct(exit.impliedCapRate),      accent: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Gross Value',   value: fmtCpt(exit.exitValue),           accent: 'text-violet-600 dark:text-violet-400' },
            { label: 'Selling Costs', value: fmtFull(exit.sellingCosts),       accent: 'text-muted-foreground' },
            { label: 'Net Proceeds',  value: fmtCpt(exit.netSaleProceeds),     accent: 'text-emerald-600 dark:text-emerald-400' },
          ].map(m => (
            <div key={m.label} className="px-4 py-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
              <p className={`text-sm font-bold tabular-nums ${m.accent}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface MultiYearProjectionTabProps {
  projectId: string;
  initialConfig?: Partial<ProjectionConfig>;
}

export default function MultiYearProjectionTab({ projectId, initialConfig }: MultiYearProjectionTabProps) {
  const [config, setConfig] = useState<ProjectionConfig>({
    holdPeriod:        initialConfig?.holdPeriod        ?? 5,
    revenueGrowthRate: initialConfig?.revenueGrowthRate ?? 0.03,
    expenseGrowthRate: initialConfig?.expenseGrowthRate ?? 0.025,
    exitCapRate:       initialConfig?.exitCapRate       ?? 0.065,
    vacancyCurve:      initialConfig?.vacancyCurve,
    capexSchedule:     initialConfig?.capexSchedule,
  });

  const fetchProjection = useCallback(async (): Promise<{ projection: MultiYearProjectionResult }> => {
    const res = await fetch(`/api/modeling/projects/${projectId}/multi-year-projection`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(config),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? `HTTP ${res.status}`); }
    return res.json();
  }, [projectId, config]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['multi-year-projection', projectId, config],
    queryFn: fetchProjection,
    staleTime: 30_000,
  });

  const result = data?.projection;

  return (
    <div className="space-y-4">
      <ConfigPanel config={config} onChange={setConfig} />
      {isLoading && <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-56 w-full" /><Skeleton className="h-64 w-full" /></div>}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div><p className="text-sm font-medium text-destructive">Projection failed</p><p className="text-xs text-muted-foreground">{(error as Error).message}</p></div>
            <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
          </CardContent>
        </Card>
      )}
      {result && (
        <>
          <KpiStrip result={result} config={config} />
          <ProjectionChart result={result} />
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />Year-by-Year P&L
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1">{config.holdPeriod}-Year Hold</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-0 px-0">
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-xs py-2 h-auto">Year</TableHead>
                    <TableHead className="text-right text-xs py-2 h-auto">Revenue</TableHead>
                    <TableHead className="text-right text-xs py-2 h-auto">Expenses</TableHead>
                    <TableHead className="text-right text-xs py-2 h-auto">NOI</TableHead>
                    <TableHead className="text-right text-xs py-2 h-auto">CapEx</TableHead>
                    <TableHead className="text-right text-xs py-2 h-auto">NCF</TableHead>
                    <TableHead className="text-right text-xs py-2 h-auto pr-4">NOI Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.years.map((yr, i) => <YearRow key={yr.year} projYear={yr} isLast={i === result.years.length - 1} />)}
                  <TableRow className="border-t-2 bg-muted/30 hover:bg-muted/30">
                    <TableCell className="pl-4 py-2.5 text-sm font-bold">Total</TableCell>
                    <TableCell className="text-right py-2.5 tabular-nums text-sm font-semibold">{fmtFull(result.years.reduce((s,y)=>s+y.totalRevenue,0))}</TableCell>
                    <TableCell className="text-right py-2.5 tabular-nums text-sm text-muted-foreground">{fmtFull(result.years.reduce((s,y)=>s+y.totalExpenses,0))}</TableCell>
                    <TableCell className="text-right py-2.5 tabular-nums text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtFull(result.totalNOI)}</TableCell>
                    <TableCell className="text-right py-2.5 tabular-nums text-xs text-muted-foreground">{fmtFull(result.years.reduce((s,y)=>s+y.capex,0))}</TableCell>
                    <TableCell className="text-right py-2.5 tabular-nums text-sm font-bold text-blue-600 dark:text-blue-400">{fmtFull(result.totalNCF)}</TableCell>
                    <TableCell className="pr-4" />
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
          {result.exit && <ExitCard exit={result.exit} holdPeriod={config.holdPeriod} />}
        </>
      )}
    </div>
  );
}

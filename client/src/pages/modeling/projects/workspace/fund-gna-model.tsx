import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Trash2, DollarSign, Users, TrendingUp, Calendar } from 'lucide-react';

// --- Types ---

interface PartnerEntry {
  id: string;
  role: string;
  annualSalary: number;
  startMonth: number;
}

interface StaffEntry {
  id: string;
  role: string;
  annualSalary: number;
  hireMonth: number;
  gnaAllocPct: number;
}

interface OverheadEntry {
  id: string;
  category: string;
  monthlyBudget: number;
  startMonth: number;
  rampUpMonths: number;
}

interface FundGnAData {
  partners: PartnerEntry[];
  staff: StaffEntry[];
  overhead: OverheadEntry[];
  benefitsRate: number;
  annualSalaryGrowth: number;
}

interface MonthlyBreakdown {
  month: number;
  label: string;
  partnerComp: number;
  staffComp: number;
  overhead: number;
  total: number;
  cumulative: number;
}

// --- Defaults ---

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

const defaultData: FundGnAData = {
  partners: [
    { id: generateId(), role: 'Managing Partner', annualSalary: 350000, startMonth: 1 },
    { id: generateId(), role: 'Operating Partner', annualSalary: 275000, startMonth: 1 },
  ],
  staff: [
    { id: generateId(), role: 'Fund Controller', annualSalary: 165000, hireMonth: 1, gnaAllocPct: 100 },
    { id: generateId(), role: 'Analyst', annualSalary: 95000, hireMonth: 3, gnaAllocPct: 100 },
    { id: generateId(), role: 'Office Manager', annualSalary: 72000, hireMonth: 1, gnaAllocPct: 50 },
  ],
  overhead: [
    { id: generateId(), category: 'Office Rent', monthlyBudget: 8500, startMonth: 1, rampUpMonths: 0 },
    { id: generateId(), category: 'Insurance (D&O / E&O)', monthlyBudget: 3200, startMonth: 1, rampUpMonths: 0 },
    { id: generateId(), category: 'Legal & Compliance', monthlyBudget: 5000, startMonth: 1, rampUpMonths: 3 },
    { id: generateId(), category: 'Accounting / Audit', monthlyBudget: 4500, startMonth: 1, rampUpMonths: 2 },
    { id: generateId(), category: 'Technology / Software', monthlyBudget: 2800, startMonth: 1, rampUpMonths: 1 },
    { id: generateId(), category: 'Travel & Meetings', monthlyBudget: 3500, startMonth: 3, rampUpMonths: 3 },
    { id: generateId(), category: 'Marketing / IR', monthlyBudget: 2000, startMonth: 6, rampUpMonths: 4 },
  ],
  benefitsRate: 0.28,
  annualSalaryGrowth: 0.03,
};

// --- Helpers ---

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function monthLabel(m: number): string {
  const year = Math.ceil(m / 12);
  const mo = ((m - 1) % 12) + 1;
  return `Y${year}-M${String(mo).padStart(2, '0')}`;
}

function quarterLabel(q: number): string {
  const year = Math.ceil(q / 4);
  const qn = ((q - 1) % 4) + 1;
  return `Y${year} Q${qn}`;
}

/** Monthly salary with benefits and annual growth applied */
function monthlySalaryAt(annualBase: number, month: number, benefitsRate: number, growthRate: number): number {
  const yearsElapsed = Math.floor((month - 1) / 12);
  const grown = annualBase * Math.pow(1 + growthRate, yearsElapsed);
  return (grown * (1 + benefitsRate)) / 12;
}

/** Overhead ramp factor: linear from 0 to 1 over rampUpMonths */
function rampFactor(currentMonth: number, startMonth: number, rampUpMonths: number): number {
  if (currentMonth < startMonth) return 0;
  if (rampUpMonths <= 0) return 1;
  const elapsed = currentMonth - startMonth + 1;
  if (elapsed >= rampUpMonths) return 1;
  return elapsed / rampUpMonths;
}

// --- Calculation Engine ---

function computeMonthly(data: FundGnAData, holdMonths: number): MonthlyBreakdown[] {
  const { partners, staff, overhead, benefitsRate, annualSalaryGrowth } = data;
  const months: MonthlyBreakdown[] = [];
  let cumulative = 0;

  for (let m = 1; m <= holdMonths; m++) {
    let partnerComp = 0;
    for (const p of partners) {
      if (m >= p.startMonth) {
        partnerComp += monthlySalaryAt(p.annualSalary, m - p.startMonth + 1, benefitsRate, annualSalaryGrowth);
      }
    }

    let staffComp = 0;
    for (const s of staff) {
      if (m >= s.hireMonth) {
        const raw = monthlySalaryAt(s.annualSalary, m - s.hireMonth + 1, benefitsRate, annualSalaryGrowth);
        staffComp += raw * (s.gnaAllocPct / 100);
      }
    }

    let overheadTotal = 0;
    for (const o of overhead) {
      overheadTotal += o.monthlyBudget * rampFactor(m, o.startMonth, o.rampUpMonths);
    }

    const total = partnerComp + staffComp + overheadTotal;
    cumulative += total;

    months.push({
      month: m,
      label: monthLabel(m),
      partnerComp,
      staffComp,
      overhead: overheadTotal,
      total,
      cumulative,
    });
  }

  return months;
}

// --- Component ---

export default function FundGnAModel({ projectId, onTabChange }: { projectId: string; onTabChange?: (tab: string) => void }) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState('charts');

  // Load project to seed data
  const { data: project } = useQuery({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const [data, setData] = useState<FundGnAData>(defaultData);
  const [autoSaving, setAutoSaving] = useState(false);

  // Hydrate from server when project data loads
  useEffect(() => {
    if (project?.customMetrics?.fundGnA) {
      setData(project.customMetrics.fundGnA);
    }
  }, [project?.customMetrics?.fundGnA]);

  // Dynamic hold period from fund assumptions or default 7 years
  const holdYears = project?.customMetrics?.fundAssumptions?.holdPeriod || 7;
  const holdMonths = holdYears * 12;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: FundGnAData) => {
      const existing = project?.customMetrics ?? {};
      const res = await apiRequest('PATCH', `/api/modeling/projects/${projectId}`, {
        customMetrics: { ...existing, fundGnA: payload },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/model', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'lp-reporting'] });
      setAutoSaving(false);
    },
    onError: () => {
      setAutoSaving(false);
      toast({ title: 'Save Failed', description: 'Could not save G&A data.', variant: 'destructive' });
    },
  });

  // Debounced auto-save: triggers 2s after the last data edit
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip auto-save on initial render / hydration
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaving(true);
    autoSaveTimer.current = setTimeout(() => {
      saveMutation.mutate(data);
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [data]);

  // Monthly calculations
  const monthly = useMemo(() => computeMonthly(data, holdMonths), [data, holdMonths]);

  // KPI summaries
  const kpis = useMemo(() => {
    const totalGnA = monthly[monthly.length - 1]?.cumulative ?? 0;
    const partnerTotal = monthly.reduce((s, m) => s + m.partnerComp, 0);
    const staffAndOverhead = totalGnA - partnerTotal;
    const monthlyAvg = totalGnA / holdMonths;
    return { totalGnA, partnerTotal, staffAndOverhead, monthlyAvg };
  }, [monthly, holdMonths]);

  // Chart data (sampled for performance: every 3rd month)
  const chartData = useMemo(() => {
    return monthly.filter((_, i) => i % 3 === 0 || i === monthly.length - 1).map(m => ({
      label: m.label,
      'Partner Comp': Math.round(m.partnerComp),
      'Staff Comp': Math.round(m.staffComp),
      'Overhead': Math.round(m.overhead),
      'Total': Math.round(m.total),
      'Cumulative': Math.round(m.cumulative),
    }));
  }, [monthly]);

  // Quarterly CF data
  const quarterlyCF = useMemo(() => {
    const quarters: { label: string; partnerComp: number; staffComp: number; overhead: number; total: number }[] = [];
    for (let q = 0; q < 28; q++) {
      const start = q * 3;
      const slice = monthly.slice(start, start + 3);
      if (slice.length === 0) break;
      quarters.push({
        label: quarterLabel(q + 1),
        partnerComp: Math.round(slice.reduce((s, m) => s + m.partnerComp, 0)),
        staffComp: Math.round(slice.reduce((s, m) => s + m.staffComp, 0)),
        overhead: Math.round(slice.reduce((s, m) => s + m.overhead, 0)),
        total: Math.round(slice.reduce((s, m) => s + m.total, 0)),
      });
    }
    return quarters;
  }, [monthly]);

  // Hire Gantt data
  const ganttRows = useMemo(() => {
    const rows: { role: string; type: string; start: number; end: number }[] = [];
    for (const p of data.partners) {
      rows.push({ role: p.role, type: 'Partner', start: p.startMonth, end: holdMonths });
    }
    for (const s of data.staff) {
      rows.push({ role: s.role, type: 'Staff', start: s.hireMonth, end: holdMonths });
    }
    return rows;
  }, [data.partners, data.staff, holdMonths]);

  // 7-yr cost for a partner
  function partnerSevenYrCost(p: PartnerEntry): number {
    let total = 0;
    for (let m = p.startMonth; m <= holdMonths; m++) {
      total += monthlySalaryAt(p.annualSalary, m - p.startMonth + 1, data.benefitsRate, data.annualSalaryGrowth);
    }
    return total;
  }

  // 7-yr cost for staff
  function staffSevenYrCost(s: StaffEntry): number {
    let total = 0;
    for (let m = s.hireMonth; m <= holdMonths; m++) {
      const raw = monthlySalaryAt(s.annualSalary, m - s.hireMonth + 1, data.benefitsRate, data.annualSalaryGrowth);
      total += raw * (s.gnaAllocPct / 100);
    }
    return total;
  }

  // Mutators
  function updatePartner(id: string, field: keyof PartnerEntry, value: string | number) {
    setData(prev => ({
      ...prev,
      partners: prev.partners.map(p => p.id === id ? { ...p, [field]: typeof value === 'string' && field !== 'role' ? parseFloat(value) || 0 : value } : p),
    }));
  }

  function addPartner() {
    setData(prev => ({
      ...prev,
      partners: [...prev.partners, { id: generateId(), role: 'New Partner', annualSalary: 200000, startMonth: 1 }],
    }));
  }

  function removePartner(id: string) {
    setData(prev => ({ ...prev, partners: prev.partners.filter(p => p.id !== id) }));
  }

  function updateStaff(id: string, field: keyof StaffEntry, value: string | number) {
    setData(prev => ({
      ...prev,
      staff: prev.staff.map(s => s.id === id ? { ...s, [field]: typeof value === 'string' && field !== 'role' ? parseFloat(value) || 0 : value } : s),
    }));
  }

  function addStaff() {
    setData(prev => ({
      ...prev,
      staff: [...prev.staff, { id: generateId(), role: 'New Hire', annualSalary: 80000, hireMonth: 1, gnaAllocPct: 100 }],
    }));
  }

  function removeStaff(id: string) {
    setData(prev => ({ ...prev, staff: prev.staff.filter(s => s.id !== id) }));
  }

  function updateOverhead(id: string, field: keyof OverheadEntry, value: string | number) {
    setData(prev => ({
      ...prev,
      overhead: prev.overhead.map(o => o.id === id ? { ...o, [field]: typeof value === 'string' && field !== 'category' ? parseFloat(value) || 0 : value } : o),
    }));
  }

  function addOverhead() {
    setData(prev => ({
      ...prev,
      overhead: [...prev.overhead, { id: generateId(), category: 'New Expense', monthlyBudget: 1000, startMonth: 1, rampUpMonths: 0 }],
    }));
  }

  function removeOverhead(id: string) {
    setData(prev => ({ ...prev, overhead: prev.overhead.filter(o => o.id !== id) }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fund G&A Model</h2>
          <p className="text-muted-foreground text-sm mt-1">
            GP entity operating expenses, staffing, and overhead over a {holdYears}-year hold period
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoSaving && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
          <Button variant="outline" size="sm" onClick={() => setData(defaultData)}>
            Reset Defaults
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate(data)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Model'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total G&A (7yr)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalGnA)}</div>
            <p className="text-xs text-muted-foreground">All-in incl. partner salaries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Salaries (7yr)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.partnerTotal)}</div>
            <p className="text-xs text-muted-foreground">Base comp, excl. promote</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff & Overhead</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.staffAndOverhead)}</div>
            <p className="text-xs text-muted-foreground">Non-partner G&A</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Avg</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.monthlyAvg)}</div>
            <p className="text-xs text-muted-foreground">G&A run-rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Global Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Benefits Rate</label>
              <Input
                type="number"
                className="w-24"
                value={Math.round(data.benefitsRate * 100)}
                onChange={e => setData(prev => ({ ...prev, benefitsRate: (parseFloat(e.target.value) || 0) / 100 }))}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Annual Salary Growth</label>
              <Input
                type="number"
                className="w-24"
                value={Math.round(data.annualSalaryGrowth * 100)}
                onChange={e => setData(prev => ({ ...prev, annualSalaryGrowth: (parseFloat(e.target.value) || 0) / 100 }))}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="gantt">Hire Gantt</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly CF</TabsTrigger>
          <TabsTrigger value="monthly">Monthly CF</TabsTrigger>
        </TabsList>

        {/* Charts View */}
        <TabsContent value="charts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly G&A by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrencyFull(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Partner Comp" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Staff Comp" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Overhead" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Total" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cumulative G&A Running Total</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrencyFull(v)} />
                  <Area type="monotone" dataKey="Cumulative" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hire Gantt View */}
        <TabsContent value="gantt">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hire Timeline (Gantt)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ganttRows.map((row, i) => {
                  const leftPct = ((row.start - 1) / holdMonths) * 100;
                  const widthPct = ((row.end - row.start + 1) / holdMonths) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-40 text-sm truncate flex items-center gap-2">
                        <Badge variant={row.type === 'Partner' ? 'default' : 'secondary'} className="text-xs">
                          {row.type}
                        </Badge>
                        <span>{row.role}</span>
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded relative">
                        <div
                          className={`absolute h-full rounded ${row.type === 'Partner' ? 'bg-indigo-500/70' : 'bg-cyan-500/70'}`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                        {/* Year markers */}
                        {[1, 2, 3, 4, 5, 6].map(y => (
                          <div
                            key={y}
                            className="absolute top-0 h-full border-l border-muted-foreground/20"
                            style={{ left: `${(y * 12 / holdMonths) * 100}%` }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">Mo {row.start}</span>
                    </div>
                  );
                })}
                {/* Year labels */}
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-40" />
                  <div className="flex-1 flex justify-between text-xs text-muted-foreground px-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(y => (
                      <span key={y}>Yr {y}</span>
                    ))}
                  </div>
                  <div className="w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quarterly CF View */}
        <TabsContent value="quarterly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quarterly G&A Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={quarterlyCF}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrencyFull(v)} />
                  <Legend />
                  <Bar dataKey="partnerComp" name="Partner Comp" stackId="a" fill="#6366f1" />
                  <Bar dataKey="staffComp" name="Staff Comp" stackId="a" fill="#06b6d4" />
                  <Bar dataKey="overhead" name="Overhead" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>

              {/* Quarterly table */}
              <div className="mt-4 max-h-[400px] overflow-auto">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarter</TableHead>
                      <TableHead className="text-right">Partner Comp</TableHead>
                      <TableHead className="text-right">Staff Comp</TableHead>
                      <TableHead className="text-right">Overhead</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarterlyCF.map(q => (
                      <TableRow key={q.label}>
                        <TableCell className="font-medium">{q.label}</TableCell>
                        <TableCell className="text-right">{formatCurrencyFull(q.partnerComp)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyFull(q.staffComp)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyFull(q.overhead)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrencyFull(q.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly CF View */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly G&A Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Partner Comp</TableHead>
                      <TableHead className="text-right">Staff Comp</TableHead>
                      <TableHead className="text-right">Overhead</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Cumulative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthly.map(m => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className="text-right">{formatCurrencyFull(Math.round(m.partnerComp))}</TableCell>
                        <TableCell className="text-right">{formatCurrencyFull(Math.round(m.staffComp))}</TableCell>
                        <TableCell className="text-right">{formatCurrencyFull(Math.round(m.overhead))}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrencyFull(Math.round(m.total))}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(m.cumulative)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Partner Base Salaries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Partner Base Salaries</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Partner salaries are a G&A expense paid by the GP entity from fee income.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addPartner}>
              <Plus className="h-4 w-4 mr-1" /> Add Partner
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Annual Salary</TableHead>
                <TableHead className="text-right">Start Month</TableHead>
                <TableHead className="text-right">7-yr Total (w/ Benefits)</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.partners.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Input
                      value={p.role}
                      onChange={e => updatePartner(p.id, 'role', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={p.annualSalary}
                      onChange={e => updatePartner(p.id, 'annualSalary', e.target.value)}
                      className="h-8 w-32 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={1}
                      max={holdMonths}
                      value={p.startMonth}
                      onChange={e => updatePartner(p.id, 'startMonth', e.target.value)}
                      className="h-8 w-20 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrencyFull(Math.round(partnerSevenYrCost(p)))}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePartner(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.partners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No partners added. Click "Add Partner" to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Staff Headcount */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Staff Headcount — Hire Timing & Salaries</CardTitle>
            <Button variant="outline" size="sm" onClick={addStaff}>
              <Plus className="h-4 w-4 mr-1" /> Add Staff Hire
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Annual Salary</TableHead>
                <TableHead className="text-right">Hire Month</TableHead>
                <TableHead className="text-right">G&A Alloc %</TableHead>
                <TableHead className="text-right">7-yr Cost</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Input
                      value={s.role}
                      onChange={e => updateStaff(s.id, 'role', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={s.annualSalary}
                      onChange={e => updateStaff(s.id, 'annualSalary', e.target.value)}
                      className="h-8 w-32 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={1}
                      max={holdMonths}
                      value={s.hireMonth}
                      onChange={e => updateStaff(s.id, 'hireMonth', e.target.value)}
                      className="h-8 w-20 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={s.gnaAllocPct}
                      onChange={e => updateStaff(s.id, 'gnaAllocPct', e.target.value)}
                      className="h-8 w-20 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrencyFull(Math.round(staffSevenYrCost(s)))}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStaff(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No staff added. Click "Add Staff Hire" to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recurring Overhead */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recurring Overhead</CardTitle>
            <Button variant="outline" size="sm" onClick={addOverhead}>
              <Plus className="h-4 w-4 mr-1" /> Add Line Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Monthly Budget</TableHead>
                <TableHead className="text-right">Start Month</TableHead>
                <TableHead className="text-right">Ramp-Up (Months)</TableHead>
                <TableHead className="text-right">7-yr Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.overhead.map(o => {
                let total = 0;
                for (let m = 1; m <= holdMonths; m++) {
                  total += o.monthlyBudget * rampFactor(m, o.startMonth, o.rampUpMonths);
                }
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Input
                        value={o.category}
                        onChange={e => updateOverhead(o.id, 'category', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={o.monthlyBudget}
                        onChange={e => updateOverhead(o.id, 'monthlyBudget', e.target.value)}
                        className="h-8 w-28 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        max={holdMonths}
                        value={o.startMonth}
                        onChange={e => updateOverhead(o.id, 'startMonth', e.target.value)}
                        className="h-8 w-20 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        value={o.rampUpMonths}
                        onChange={e => updateOverhead(o.id, 'rampUpMonths', e.target.value)}
                        className="h-8 w-20 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyFull(Math.round(total))}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOverhead(o.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.overhead.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No overhead items added. Click "Add Line Item" to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

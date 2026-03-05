/**
 * MultiYearProjectionTab
 * =======================
 * Workspace tab for the multi-year pro forma projection.
 *
 * Features:
 *  - Hold period selector (1–15 years)
 *  - Growth rate inputs (revenue, expense, exit cap rate)
 *  - Vacancy burn-off table (optional, expandable)
 *  - CapEx schedule table (optional, expandable)
 *  - NOI waterfall bar chart (recharts)
 *  - Full year-by-year P&L table with revenue/expense line detail toggle
 *  - Exit value summary card
 *
 * Usage:
 *   import { MultiYearProjectionTab } from '@/components/workspace/MultiYearProjectionTab';
 *   // Add as a tab in your workspace: <MultiYearProjectionTab projectId={project.id} />
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types (mirror multi-year-projection-engine.ts) ───────────────────────────

interface ProjectionLineItem {
  key: string;
  label: string;
  category: string;
  amount: number;
  formula?: string;
  isVacancyOverride?: boolean;
}

interface ProjectionMonthlyBreakdown {
  month: number;
  monthName: string;
  revenue: number;
  expenses: number;
  noi: number;
  daysInMonth: number;
  isSeasonal?: boolean;
}

interface ProjectionYear {
  year: number;
  label: string;
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  capex: number;
  ncf: number;
  revenueLines: ProjectionLineItem[];
  expenseLines: ProjectionLineItem[];
  monthlyBreakdown: ProjectionMonthlyBreakdown[];
  noiChange?: number;
  noiChangePct?: number;
  capexScheduleEntry?: { amount: number; label?: string };
}

interface ExitMetrics {
  exitNOI: number;
  exitValue: number;
  sellingCosts: number;
  netSaleProceeds: number;
  impliedCapRate: number;
}

interface VacancyCurveEntry { year: number; vacancyRate: number }
interface CapExScheduleEntry { year: number; amount: number; label?: string }

interface ProjectionConfig {
  holdPeriod: number;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  exitCapRate?: number;
  vacancyCurve?: VacancyCurveEntry[];
  capexSchedule?: CapExScheduleEntry[];
}

interface MultiYearProjectionResult {
  years: ProjectionYear[];
  noiWaterfall: { year: number; label: string; noi: number; ncf: number }[];
  exit: ExitMetrics | null;
  totalNOI: number;
  totalNCF: number;
  noiCAGR: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)
    return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtFull(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
      padding: '14px 18px', minWidth: 140,
    }}>
      <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', marginRight: 6 }}>
      ▶
    </span>
  );
}

function YearDetailRow({ projYear }: { projYear: ProjectionYear }) {
  const [open, setOpen] = useState(false);
  const noiColor = projYear.noi >= 0 ? '#22c55e' : '#ef4444';
  const changePct = projYear.noiChangePct;

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b', transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <td style={{ padding: '10px 12px', color: '#f1f5f9', fontWeight: 600 }}>
          <Chevron open={open} />{projYear.label}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{fmtFull(projYear.totalRevenue)}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{fmtFull(projYear.totalExpenses)}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', color: noiColor, fontWeight: 700 }}>{fmtFull(projYear.noi)}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{fmtFull(projYear.capex)}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', color: projYear.ncf >= 0 ? '#60a5fa' : '#f87171', fontWeight: 600 }}>{fmtFull(projYear.ncf)}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', color: changePct != null ? (changePct >= 0 ? '#22c55e' : '#ef4444') : '#64748b', fontSize: 12 }}>
          {changePct != null ? (changePct >= 0 ? '+' : '') + fmtPct(changePct) : '—'}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ padding: '0 16px 16px 32px', background: '#0f172a' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              {/* Revenue detail */}
              <div>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Revenue Lines</div>
                {projYear.revenueLines.map(l => (
                  <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{l.label}</span>
                    <span style={{ color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace' }}>{fmtFull(l.amount)}</span>
                  </div>
                ))}
              </div>
              {/* Expense detail */}
              <div>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Expense Lines</div>
                {projYear.expenseLines.map(l => (
                  <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ color: l.isVacancyOverride ? '#f59e0b' : '#94a3b8', fontSize: 12 }}>
                      {l.label}{l.isVacancyOverride ? ' ⚡' : ''}
                    </span>
                    <span style={{ color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace' }}>{fmtFull(l.amount)}</span>
                  </div>
                ))}
                {projYear.capexScheduleEntry && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1e293b', marginTop: 4 }}>
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>⚒ {projYear.capexScheduleEntry.label ?? 'Scheduled CapEx'}</span>
                    <span style={{ color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace' }}>{fmtFull(projYear.capex)}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Monthly breakdown mini-table */}
            <div style={{ marginTop: 14 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Monthly NOI</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
                {projYear.monthlyBreakdown.map(m => (
                  <div key={m.month} style={{
                    background: m.isSeasonal ? '#1e3a5f' : '#1e293b',
                    borderRadius: 4, padding: '4px 6px', textAlign: 'center',
                    border: m.isSeasonal ? '1px solid #3b82f6' : '1px solid #334155',
                  }}>
                    <div style={{ color: '#64748b', fontSize: 9 }}>{m.monthName.slice(0, 3)}</div>
                    <div style={{ color: m.noi >= 0 ? '#86efac' : '#fca5a5', fontSize: 10, fontWeight: 600 }}>
                      {fmtCurrency(m.noi)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  config, onChange
}: {
  config: ProjectionConfig;
  onChange: (c: ProjectionConfig) => void;
}) {
  const [showVacancy, setShowVacancy] = useState(false);
  const [showCapex, setShowCapex] = useState(false);

  const inputStyle = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
    color: '#f1f5f9', padding: '4px 8px', width: '100%', fontSize: 13,
  };
  const labelStyle = { color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 };

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Projection Settings</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>

        <div>
          <div style={labelStyle}>Hold Period</div>
          <select value={config.holdPeriod} onChange={e => onChange({ ...config, holdPeriod: Number(e.target.value) })} style={inputStyle}>
            {[1,2,3,4,5,6,7,8,9,10,12,15].map(n => (
              <option key={n} value={n}>{n} Year{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Revenue Growth</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" step="0.1" min="-10" max="20"
              value={(config.revenueGrowthRate * 100).toFixed(1)}
              onChange={e => onChange({ ...config, revenueGrowthRate: Number(e.target.value) / 100 })}
              style={{ ...inputStyle, width: '70%' }} />
            <span style={{ color: '#64748b' }}>%</span>
          </div>
        </div>

        <div>
          <div style={labelStyle}>Expense Growth</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" step="0.1" min="-10" max="20"
              value={(config.expenseGrowthRate * 100).toFixed(1)}
              onChange={e => onChange({ ...config, expenseGrowthRate: Number(e.target.value) / 100 })}
              style={{ ...inputStyle, width: '70%' }} />
            <span style={{ color: '#64748b' }}>%</span>
          </div>
        </div>

        <div>
          <div style={labelStyle}>Exit Cap Rate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" step="0.1" min="1" max="20"
              value={((config.exitCapRate ?? 0.065) * 100).toFixed(1)}
              onChange={e => onChange({ ...config, exitCapRate: Number(e.target.value) / 100 })}
              style={{ ...inputStyle, width: '70%' }} />
            <span style={{ color: '#64748b' }}>%</span>
          </div>
        </div>

      </div>

      {/* Vacancy burn-off toggle */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowVacancy(v => !v)} style={{
          background: 'none', border: '1px solid #334155', borderRadius: 4,
          color: '#94a3b8', fontSize: 12, padding: '4px 10px', cursor: 'pointer', marginRight: 8,
        }}>
          <Chevron open={showVacancy} />Vacancy Burn-off
        </button>
        <button onClick={() => setShowCapex(v => !v)} style={{
          background: 'none', border: '1px solid #334155', borderRadius: 4,
          color: '#94a3b8', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
        }}>
          <Chevron open={showCapex} />CapEx Schedule
        </button>
      </div>

      {showVacancy && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>
            Override vacancy rate per year — leave blank to use growth rate compounding
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {Array.from({ length: config.holdPeriod }, (_, i) => i + 1).map(yr => {
              const entry = config.vacancyCurve?.find(e => e.year === yr);
              return (
                <div key={yr}>
                  <div style={{ ...labelStyle, fontSize: 10 }}>Yr {yr} Vacancy</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input
                      type="number" step="0.5" min="0" max="100"
                      placeholder="—"
                      value={entry ? (entry.vacancyRate * 100).toFixed(1) : ''}
                      onChange={e => {
                        const val = e.target.value;
                        const curve = (config.vacancyCurve ?? []).filter(c => c.year !== yr);
                        if (val !== '') curve.push({ year: yr, vacancyRate: Number(val) / 100 });
                        onChange({ ...config, vacancyCurve: curve.length ? curve : undefined });
                      }}
                      style={{ ...inputStyle, width: '75%', fontSize: 12 }}
                    />
                    <span style={{ color: '#64748b', fontSize: 11 }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCapex && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>
            Schedule major capital events — leave blank to use 2% of EGI default
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {Array.from({ length: config.holdPeriod }, (_, i) => i + 1).map(yr => {
              const entry = config.capexSchedule?.find(e => e.year === yr);
              return (
                <div key={yr}>
                  <div style={{ ...labelStyle, fontSize: 10 }}>Yr {yr} CapEx ($)</div>
                  <input
                    type="number" step="1000" min="0"
                    placeholder="default (2%)"
                    value={entry ? entry.amount : ''}
                    onChange={e => {
                      const val = e.target.value;
                      const sched = (config.capexSchedule ?? []).filter(c => c.year !== yr);
                      if (val !== '') sched.push({ year: yr, amount: Number(val) });
                      onChange({ ...config, capexSchedule: sched.length ? sched : undefined });
                    }}
                    style={{ ...inputStyle, fontSize: 12 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MultiYearProjectionTabProps {
  projectId: string;
  /** Initial config — usually loaded from project/scenario row */
  initialConfig?: Partial<ProjectionConfig>;
}

export default function MultiYearProjectionTab({ projectId, initialConfig }: MultiYearProjectionTabProps) {
  const [config, setConfig] = useState<ProjectionConfig>({
    holdPeriod: initialConfig?.holdPeriod ?? 5,
    revenueGrowthRate: initialConfig?.revenueGrowthRate ?? 0.03,
    expenseGrowthRate: initialConfig?.expenseGrowthRate ?? 0.025,
    exitCapRate: initialConfig?.exitCapRate ?? 0.065,
    vacancyCurve: initialConfig?.vacancyCurve,
    capexSchedule: initialConfig?.capexSchedule,
  });

  const fetchProjection = useCallback(async (): Promise<{ projection: MultiYearProjectionResult }> => {
    const res = await fetch(`/api/modeling/projects/${projectId}/multi-year-projection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }, [projectId, config]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['multi-year-projection', projectId, config],
    queryFn: fetchProjection,
    staleTime: 30_000,
  });

  const result = data?.projection;

  const containerStyle = { fontFamily: "'Inter', system-ui, sans-serif", color: '#f1f5f9', minHeight: '100%' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 };
  const thStyle = { padding: '10px 12px', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em', textAlign: 'right' as const, borderBottom: '1px solid #334155' };

  return (
    <div style={containerStyle}>
      <ConfigPanel config={config} onChange={setConfig} />

      {isLoading && (
        <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Computing projection…</div>
      )}

      {error && (
        <div style={{ color: '#ef4444', padding: 16, background: '#1e1010', borderRadius: 8, marginBottom: 16 }}>
          Error: {(error as Error).message}
          <button onClick={() => refetch()} style={{ marginLeft: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            Retry
          </button>
        </div>
      )}

      {result && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <SummaryCard label="Hold Period" value={`${config.holdPeriod} Years`} />
            <SummaryCard
              label="Year 1 NOI"
              value={fmtFull(result.years[0]?.noi ?? 0)}
            />
            <SummaryCard
              label={`Year ${config.holdPeriod} NOI`}
              value={fmtFull(result.years[result.years.length - 1]?.noi ?? 0)}
            />
            <SummaryCard
              label="NOI CAGR"
              value={result.noiCAGR != null ? fmtPct(result.noiCAGR) : '—'}
            />
            <SummaryCard label="Total NOI" value={fmtFull(result.totalNOI)} sub={`${config.holdPeriod}-year sum`} />
            {result.exit && (
              <>
                <SummaryCard label="Exit Value" value={fmtFull(result.exit.exitValue)} sub={`${fmtPct(result.exit.impliedCapRate)} cap rate`} />
                <SummaryCard label="Net Proceeds" value={fmtFull(result.exit.netSaleProceeds)} sub="after selling costs" />
              </>
            )}
          </div>

          {/* NOI waterfall chart */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              NOI Waterfall
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={result.noiWaterfall} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => fmtCurrency(v)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  formatter={(val: number, name: string) => [fmtFull(val), name === 'noi' ? 'NOI' : 'NCF']}
                />
                <Bar dataKey="noi" name="noi" radius={[3, 3, 0, 0]}>
                  {result.noiWaterfall.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={idx === result.noiWaterfall.length - 1 ? '#3b82f6' : '#22c55e'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="ncf" name="ncf" radius={[3, 3, 0, 0]} fill="#0ea5e9" opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Year-by-year table */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Year</th>
                  <th style={thStyle}>Revenue</th>
                  <th style={thStyle}>Expenses</th>
                  <th style={thStyle}>NOI</th>
                  <th style={thStyle}>CapEx</th>
                  <th style={thStyle}>NCF</th>
                  <th style={thStyle}>NOI Δ</th>
                </tr>
              </thead>
              <tbody>
                {result.years.map(yr => (
                  <YearDetailRow key={yr.year} projYear={yr} />
                ))}
                {/* Totals row */}
                <tr style={{ borderTop: '2px solid #334155', background: '#0f172a' }}>
                  <td style={{ padding: '10px 12px', color: '#f1f5f9', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>
                    {fmtFull(result.years.reduce((s, y) => s + y.totalRevenue, 0))}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>
                    {fmtFull(result.years.reduce((s, y) => s + y.totalExpenses, 0))}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>
                    {fmtFull(result.totalNOI)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>
                    {fmtFull(result.years.reduce((s, y) => s + y.capex, 0))}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#60a5fa', fontWeight: 700 }}>
                    {fmtFull(result.totalNCF)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Exit summary */}
          {result.exit && (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Exit Analysis (Year {config.holdPeriod})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                <SummaryCard label="Exit NOI" value={fmtFull(result.exit.exitNOI)} />
                <SummaryCard label="Exit Cap Rate" value={fmtPct(result.exit.impliedCapRate)} />
                <SummaryCard label="Gross Exit Value" value={fmtFull(result.exit.exitValue)} />
                <SummaryCard label="Selling Costs" value={fmtFull(result.exit.sellingCosts)} />
                <SummaryCard label="Net Proceeds" value={fmtFull(result.exit.netSaleProceeds)} sub="after costs" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

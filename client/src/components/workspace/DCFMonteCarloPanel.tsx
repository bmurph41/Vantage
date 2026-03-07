/**
 * client/src/components/workspace/DCFMonteCarloPanel.tsx
 * 
 * Minimal frontend wiring for Monte Carlo + Decision Support.
 * Designed to be imported into the existing DCF calculator tab.
 * 
 * Usage in dcf-calculator.tsx:
 *   import { DCFMonteCarloPanel, DecisionSupportAccordion } from '../components/workspace/DCFMonteCarloPanel';
 *   // Place inside your DCF tab JSX:
 *   <DCFMonteCarloPanel projectId={projectId} />
 *   <DecisionSupportAccordion projectId={projectId} />
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

// ─── Types (match backend response shapes) ───────────────────────────────────

interface DistributionStats {
  mean: number; median: number; stdDev: number;
  p5: number; p10: number; p25: number; p50: number;
  p75: number; p90: number; p95: number;
  min: number; max: number;
}

interface RiskMetrics {
  probIrrBelowHurdle: number;
  probMultipleBelow1: number;
  expectedShortfallIrrP10: number;
  expectedShortfallNpvP10: number;
}

interface MonteCarloResult {
  n: number; seed: number; mode: string;
  stats: { irr: DistributionStats; equityMultiple: DistributionStats; npv: DistributionStats };
  risks: RiskMetrics;
  computeTimeMs: number;
}

interface TornadoDriverImpact {
  driver: string; low: number; base: number; high: number;
  delta: string; spread: number;
}

interface MemoSection { title: string; bullets: string[] }
interface MemoResult {
  tone: string; headline: string; executiveSummary: string;
  sections: MemoSection[];
}

interface DecisionSupportResult {
  enabled: boolean; entitled: boolean;
  tornado?: { drivers: TornadoDriverImpact[] };
  attribution?: { drivers: any[]; r2: number };
  memo?: MemoResult;
  monteCarlo?: MonteCarloResult;
}

// ─── Monte Carlo Panel ───────────────────────────────────────────────────────

export function DCFMonteCarloPanel({ projectId }: { projectId: string }) {
  const [simCount, setSimCount] = useState(2000);
  const [mode, setMode] = useState<'fast' | 'exact'>('fast');
  const [result, setResult] = useState<MonteCarloResult | null>(null);

  const mcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: simCount, mode, hurdleIRR: 12 }),
      });
      if (!res.ok) throw new Error('Monte Carlo failed');
      return res.json();
    },
    onSuccess: (data) => setResult(data),
  });

  return (
    <div className="border rounded-lg p-4 mt-4 bg-white">
      <h3 className="text-lg font-semibold mb-3">Monte Carlo Simulation</h3>

      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="text-sm text-gray-600 block">Simulations</label>
          <input
            type="number"
            value={simCount}
            onChange={(e) => setSimCount(Math.min(10000, Math.max(200, Number(e.target.value))))}
            className="border rounded px-2 py-1 w-24 text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 block">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'fast' | 'exact')}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="fast">Fast (approx)</option>
            <option value="exact">Exact (slower)</option>
          </select>
        </div>

        <button
          onClick={() => mcMutation.mutate()}
          disabled={mcMutation.isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 self-end"
        >
          {mcMutation.isPending ? 'Running...' : 'Run Monte Carlo'}
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-2 gap-4">
          <StatsCard label="IRR Distribution" stats={result.stats.irr} suffix="%" />
          <StatsCard label="Equity Multiple" stats={result.stats.equityMultiple} suffix="x" />

          <div className="col-span-2 bg-gray-50 rounded p-3">
            <h4 className="text-sm font-medium mb-2">Risk Metrics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>P(IRR &lt; hurdle): <span className="font-medium">{(result.risks.probIrrBelowHurdle * 100).toFixed(1)}%</span></div>
              <div>P(Loss): <span className="font-medium">{(result.risks.probMultipleBelow1 * 100).toFixed(1)}%</span></div>
              <div>Expected shortfall (P10 IRR): <span className="font-medium">{result.risks.expectedShortfallIrrP10.toFixed(2)}%</span></div>
              <div>Compute time: <span className="font-medium">{result.computeTimeMs}ms</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ label, stats, suffix }: { label: string; stats: DistributionStats; suffix: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <h4 className="text-sm font-medium mb-2">{label}</h4>
      <div className="grid grid-cols-3 gap-1 text-sm">
        <div className="text-center">
          <div className="text-gray-500 text-xs">P10</div>
          <div className="font-medium">{stats.p10.toFixed(1)}{suffix}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">P50</div>
          <div className="font-medium">{stats.p50.toFixed(1)}{suffix}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">P90</div>
          <div className="font-medium">{stats.p90.toFixed(1)}{suffix}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Mean: {stats.mean.toFixed(2)}{suffix} | StdDev: {stats.stdDev.toFixed(2)}
      </div>
    </div>
  );
}

// ─── Decision Support Accordion ──────────────────────────────────────────────

export function DecisionSupportAccordion({ projectId }: { projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'tornado' | 'attribution' | 'memo'>('tornado');

  const { data: dsResult, isLoading } = useQuery<DecisionSupportResult>({
    queryKey: ['decision-support', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/dcf/decision-support`);
      if (!res.ok) throw new Error('Decision support fetch failed');
      return res.json();
    },
    enabled: expanded,
    staleTime: 60_000,
  });

  // Not entitled — hide completely
  if (dsResult && !dsResult.entitled) return null;

  // Entitled but not enabled — show toggle
  if (dsResult && dsResult.entitled && !dsResult.enabled) {
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded border text-sm text-gray-600">
        Decision Support is available.{' '}
        <button className="text-blue-600 underline" onClick={() => setExpanded(true)}>
          Enable
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
      >
        <span className="font-medium text-sm">Decision Support</span>
        <span className="text-gray-400 text-xs">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="p-4">
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading analysis...</div>
          ) : dsResult ? (
            <>
              <div className="flex gap-2 mb-4 border-b pb-2">
                {(['tornado', 'attribution', 'memo'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 text-sm rounded ${
                      activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {tab === 'tornado' ? 'Tornado' : tab === 'attribution' ? 'Attribution' : 'IC Memo'}
                  </button>
                ))}
              </div>

              {activeTab === 'tornado' && dsResult.tornado && (
                <TornadoDisplay drivers={dsResult.tornado.drivers} />
              )}

              {activeTab === 'attribution' && dsResult.attribution && (
                <AttributionDisplay
                  drivers={dsResult.attribution.drivers}
                  r2={dsResult.attribution.r2}
                />
              )}

              {activeTab === 'memo' && dsResult.memo && (
                <MemoDisplay memo={dsResult.memo} />
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TornadoDisplay({ drivers }: { drivers: TornadoDriverImpact[] }) {
  const maxSpread = Math.max(...drivers.map(d => d.spread), 1);

  return (
    <div className="space-y-2">
      {drivers.map(d => {
        const width = (d.spread / maxSpread) * 100;
        const left = Math.min(d.low, d.high);
        const right = Math.max(d.low, d.high);
        return (
          <div key={d.driver} className="flex items-center gap-2 text-sm">
            <div className="w-32 text-right text-gray-600 truncate">{d.driver}</div>
            <div className="flex-1 relative h-6 bg-gray-100 rounded">
              <div
                className="absolute h-full bg-blue-200 rounded"
                style={{ width: `${width}%`, left: `${(1 - width / 100) * 50}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                <span>{left.toFixed(1)}%</span>
                <span>{right.toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-16 text-xs text-gray-500">{d.delta}</div>
          </div>
        );
      })}
    </div>
  );
}

function AttributionDisplay({ drivers, r2 }: { drivers: any[]; r2: number }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">Model R²: {(r2 * 100).toFixed(1)}%</div>
      <div className="space-y-1">
        {drivers.map((d: any) => (
          <div key={d.driver} className="flex items-center gap-2 text-sm">
            <div className="w-32 text-right text-gray-600">{d.driver}</div>
            <div className="flex-1 bg-gray-100 rounded h-4 relative">
              <div
                className={`h-full rounded ${d.direction === 'positive' ? 'bg-green-300' : 'bg-red-300'}`}
                style={{ width: `${d.importance * 100}%` }}
              />
            </div>
            <div className="w-16 text-xs">{(d.importance * 100).toFixed(0)}%</div>
            <div className="w-8 text-xs">{d.direction === 'positive' ? '↑' : '↓'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoDisplay({ memo }: { memo: MemoResult }) {
  return (
    <div className="text-sm space-y-3">
      <h4 className="font-semibold text-base">{memo.headline}</h4>
      <p className="text-gray-700">{memo.executiveSummary}</p>
      {memo.sections.map((s, i) => (
        <div key={i}>
          <h5 className="font-medium text-gray-900 mt-2">{s.title}</h5>
          <ul className="list-disc pl-5 text-gray-600 space-y-0.5">
            {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default DCFMonteCarloPanel;

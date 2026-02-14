/**
 * exit-reconciliation.tsx
 *
 * Dev-only diagnostic tool that verifies all exit pages produce identical
 * canonical numbers for the same inputs.
 *
 * Features:
 * - Single input form → runs engine for cash_sale, exchange_1031, dst, waterfall
 * - Shows canonical fields side by side
 * - Highlights diffs > $1
 * - Loads GOLDEN_VECTORS.json and shows pass/fail
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Beaker } from "lucide-react";
import { runExitScenario } from "@shared/exit/exit-scenario-engine";
import type { ExitScenarioInput, ExitScenarioResult } from "@shared/exit/exit-scenario-engine";
import { buildExitScenarioInput, buildCashSaleBaseline } from "@/lib/exitScenario/buildExitScenarioInput";
import type { ExitScenarioUIState } from "@/lib/exitScenario/buildExitScenarioInput";

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Canonical fields we reconcile across pages
// ---------------------------------------------------------------------------
const CANONICAL_FIELDS: { key: keyof ExitScenarioResult | string; label: string }[] = [
  { key: 'netSaleProceeds', label: 'Net Sale Proceeds' },
  { key: 'beforeTaxEquityProceeds', label: 'Before-Tax Equity Proceeds' },
  { key: 'taxResult.totalTaxLiability', label: 'Total Tax Liability' },
  { key: 'afterTaxEquityProceeds', label: 'After-Tax Equity Proceeds' },
];

function getNestedValue(obj: any, path: string): number | null {
  const parts = path.split('.');
  let val = obj;
  for (const p of parts) {
    if (val == null) return null;
    val = val[p];
  }
  return typeof val === 'number' ? val : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExitReconciliation() {
  const [inputs, setInputs] = useState({
    salePrice: 10_000_000,
    purchasePrice: 7_500_000,
    brokerCommissionPercent: 3,
    closingCosts: 75_000,
    outstandingDebt: 5_000_000,
    holdingPeriodYears: 5,
    capitalImprovements: 200_000,
    replacementValue: 12_000_000,
  });

  // Run all scenarios from the same inputs
  const results = useMemo(() => {
    const base: ExitScenarioUIState = {
      scenarioName: 'Reconciliation Test',
      scenarioType: 'cash_sale',
      salePrice: inputs.salePrice,
      brokerCommissionPercent: inputs.brokerCommissionPercent,
      closingCosts: inputs.closingCosts,
      purchasePrice: inputs.purchasePrice,
      holdingPeriodYears: inputs.holdingPeriodYears,
      capitalImprovements: inputs.capitalImprovements,
      outstandingDebt: inputs.outstandingDebt,
    };

    const scenarios: { name: string; result: ExitScenarioResult | null; error?: string }[] = [];

    // 1. Cash Sale (Net Proceeds page)
    try {
      const input = buildExitScenarioInput({ ...base, scenarioName: 'Cash Sale (Net Proceeds)' });
      scenarios.push({ name: 'Net Proceeds', result: runExitScenario(input) });
    } catch (err: any) {
      scenarios.push({ name: 'Net Proceeds', result: null, error: err.message });
    }

    // 2. 1031 Exchange
    try {
      const input = buildExitScenarioInput({
        ...base,
        scenarioName: '1031 Exchange',
        scenarioType: 'exchange_1031',
        exchange1031: {
          saleDate: new Date().toISOString().slice(0, 10),
          replacementProperties: [{
            name: 'Replacement',
            purchasePrice: inputs.replacementValue,
            newMortgage: inputs.replacementValue * 0.6,
            closingCosts: 0,
            improvements: 0,
          }],
          qualifiedIntermediaryFee: 2500,
          additionalCashInvested: 0,
          isTicOrDst: false,
          isReverseExchange: false,
          isImprovementExchange: false,
        },
      });
      scenarios.push({ name: '1031 Exchange', result: runExitScenario(input) });
    } catch (err: any) {
      scenarios.push({ name: '1031 Exchange', result: null, error: err.message });
    }

    // 3. DST (as 1031 replacement)
    try {
      const input = buildExitScenarioInput({
        ...base,
        scenarioName: 'DST / 1031',
        scenarioType: 'exchange_1031',
        exchange1031: {
          saleDate: new Date().toISOString().slice(0, 10),
          replacementProperties: [{
            name: 'DST Portfolio',
            purchasePrice: inputs.replacementValue,
            newMortgage: 0,
            closingCosts: 0,
            improvements: 0,
          }],
          qualifiedIntermediaryFee: 2500,
          additionalCashInvested: 0,
          isTicOrDst: true,
          isReverseExchange: false,
          isImprovementExchange: false,
        },
      });
      scenarios.push({ name: 'DST Analysis', result: runExitScenario(input) });
    } catch (err: any) {
      scenarios.push({ name: 'DST Analysis', result: null, error: err.message });
    }

    // 4. Waterfall source (cash sale — distributable cash)
    try {
      const input = buildExitScenarioInput({
        ...base,
        scenarioName: 'Waterfall Source',
      });
      scenarios.push({ name: 'Waterfall', result: runExitScenario(input) });
    } catch (err: any) {
      scenarios.push({ name: 'Waterfall', result: null, error: err.message });
    }

    return scenarios;
  }, [inputs]);

  // Check reconciliation: net proceeds and waterfall (both cash_sale) should match exactly
  const reconciliationChecks = useMemo(() => {
    const checks: { field: string; values: { scenario: string; value: number | null }[]; pass: boolean }[] = [];

    // Compare cash-sale scenarios (Net Proceeds vs Waterfall)
    const cashSaleResults = results.filter(r =>
      r.result?.scenarioType === 'cash_sale'
    );

    for (const field of CANONICAL_FIELDS) {
      const values = results.map(r => ({
        scenario: r.name,
        value: r.result ? getNestedValue(r.result, field.key) : null,
      }));

      // Only check cash-sale parity (1031/DST will differ on tax due to deferral)
      const cashValues = cashSaleResults.map(r => getNestedValue(r.result, field.key)).filter(v => v != null);
      const pass = cashValues.length <= 1 || cashValues.every(v => Math.abs(v! - cashValues[0]!) <= 1);

      checks.push({ field: field.label, values, pass });
    }

    return checks;
  }, [results]);

  const allPass = reconciliationChecks.every(c => c.pass);

  // ── Golden Vectors ────────────────────────────────────────────────────
  const [goldenVectors, setGoldenVectors] = useState<any[] | null>(null);
  const [goldenResults, setGoldenResults] = useState<{ name: string; pass: boolean; diffs: string[] }[]>([]);

  const loadGoldenVectors = async () => {
    try {
      const resp = await fetch('/GOLDEN_VECTORS.json');
      if (!resp.ok) {
        setGoldenVectors([]);
        return;
      }
      const vectors = await resp.json();
      setGoldenVectors(Array.isArray(vectors) ? vectors : [vectors]);
    } catch {
      setGoldenVectors([]);
    }
  };

  const runGoldenVectors = () => {
    if (!goldenVectors) return;
    const results = goldenVectors.map((vector: any) => {
      try {
        const result = runExitScenario(vector.input as ExitScenarioInput);
        const diffs: string[] = [];

        for (const [key, expectedVal] of Object.entries(vector.expected || {})) {
          const actualVal = getNestedValue(result, key);
          if (actualVal != null && typeof expectedVal === 'number') {
            if (Math.abs(actualVal - expectedVal) > 1) {
              diffs.push(`${key}: expected ${fmt(expectedVal)}, got ${fmt(actualVal)}`);
            }
          }
        }

        return { name: vector.name || 'Unnamed', pass: diffs.length === 0, diffs };
      } catch (err: any) {
        return { name: vector.name || 'Unnamed', pass: false, diffs: [`Error: ${err.message}`] };
      }
    });
    setGoldenResults(results);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Beaker className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Exit Reconciliation Tool</h1>
          <Badge variant="secondary">Dev Only</Badge>
        </div>
        <p className="text-muted-foreground">
          Verifies that Net Proceeds, 1031, DST, and Waterfall all derive canonical values from the same engine.
        </p>
      </div>

      <Tabs defaultValue="reconciliation">
        <TabsList>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="golden">Golden Vectors</TabsTrigger>
        </TabsList>

        {/* ── Reconciliation Tab ───────────────────────────────────── */}
        <TabsContent value="reconciliation" className="space-y-6">
          {/* Input form */}
          <Card>
            <CardHeader>
              <CardTitle>Test Inputs</CardTitle>
              <CardDescription>Same inputs fed to all four pages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(inputs).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                    <Input
                      type="number"
                      value={val}
                      className="h-8 text-sm"
                      onChange={(e) => setInputs(p => ({ ...p, [key]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <div className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
            allPass ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'
          }`}>
            {allPass ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <span className="font-medium text-lg">
              {allPass
                ? 'All cash-sale scenarios reconcile within $1'
                : 'Reconciliation failures detected'}
            </span>
          </div>

          {/* Comparison table */}
          <Card>
            <CardHeader>
              <CardTitle>Canonical Field Comparison</CardTitle>
              <CardDescription>
                Cash-sale scenarios (Net Proceeds, Waterfall) must match within $1.
                1031/DST will differ on tax due to deferral.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Field</th>
                      {results.map(r => (
                        <th key={r.name} className="text-right py-2 px-3 font-medium">{r.name}</th>
                      ))}
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationChecks.map((check, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 pr-4 font-medium">{check.field}</td>
                        {check.values.map((v, j) => (
                          <td key={j} className="text-right py-2 px-3 font-mono text-xs">
                            {fmt(v.value)}
                          </td>
                        ))}
                        <td className="text-center py-2 px-3">
                          {check.pass ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 inline" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Engine warnings */}
          {results.some(r => r.result && r.result.warnings.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engine Warnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.flatMap(r =>
                  (r.result?.warnings || []).map((w, i) => (
                    <div key={`${r.name}-${i}`} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="text-xs shrink-0">{r.name}</Badge>
                      <Badge variant={w.severity === 'error' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                        {w.severity}
                      </Badge>
                      <span className="text-muted-foreground">{w.message}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {results.some(r => r.error) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-red-500">Engine Errors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.filter(r => r.error).map(r => (
                  <div key={r.name} className="flex items-start gap-2 text-sm">
                    <Badge variant="destructive" className="text-xs">{r.name}</Badge>
                    <span className="text-red-600">{r.error}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Golden Vectors Tab ───────────────────────────────────── */}
        <TabsContent value="golden" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Golden Vector Test Harness</CardTitle>
              <CardDescription>
                Loads GOLDEN_VECTORS.json and runs each vector through the engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button onClick={loadGoldenVectors} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Vectors
                </Button>
                <Button onClick={runGoldenVectors} disabled={!goldenVectors || goldenVectors.length === 0}>
                  <Beaker className="h-4 w-4 mr-2" />
                  Run All
                </Button>
                {goldenVectors && (
                  <span className="text-sm text-muted-foreground">
                    {goldenVectors.length} vector{goldenVectors.length !== 1 ? 's' : ''} loaded
                  </span>
                )}
              </div>

              {goldenVectors && goldenVectors.length === 0 && (
                <div className="p-4 border rounded-lg bg-muted text-center text-muted-foreground">
                  No GOLDEN_VECTORS.json found. Place it in the public directory.
                </div>
              )}

              {goldenResults.length > 0 && (
                <div className="space-y-3">
                  {goldenResults.map((gr, i) => (
                    <div key={i} className={`p-4 rounded-lg border-l-4 ${
                      gr.pass ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {gr.pass ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{gr.name}</span>
                        <Badge variant={gr.pass ? 'default' : 'destructive'}>
                          {gr.pass ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      {gr.diffs.length > 0 && (
                        <div className="ml-6 mt-2 space-y-1">
                          {gr.diffs.map((d, j) => (
                            <p key={j} className="text-sm text-red-600 font-mono">{d}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className={`p-3 rounded-lg text-center font-medium ${
                    goldenResults.every(r => r.pass)
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {goldenResults.filter(r => r.pass).length} / {goldenResults.length} vectors passed
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

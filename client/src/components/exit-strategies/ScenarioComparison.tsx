import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Shield } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { 
  compareExitScenarios, 
  type ExitScenarioResult 
} from "@shared/exit/exit-scenario-engine";

interface ScenarioComparisonProps {
  scenarios: ExitScenarioResult[];
}

const STRATEGY_COLORS: Record<string, string> = {
  cash_sale: 'bg-green-100 text-green-700',
  exchange_1031: 'bg-blue-100 text-blue-700',
  seller_financing: 'bg-amber-100 text-amber-700',
  dst_investment: 'bg-purple-100 text-purple-700',
  hybrid: 'bg-pink-100 text-pink-700',
};

export function ScenarioComparison({ scenarios }: ScenarioComparisonProps) {
  const comparison = useMemo(() => {
    if (scenarios.length < 2) return null;
    return compareExitScenarios(scenarios);
  }, [scenarios]);

  if (scenarios.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Run at least 2 scenarios to compare them side-by-side.
        </CardContent>
      </Card>
    );
  }

  if (!comparison) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-muted-foreground">Best by Proceeds:</span>
          <Badge variant="outline" className="font-medium">{comparison.bestByAfterTax}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">Best by IRR:</span>
          <Badge variant="outline" className="font-medium">{comparison.bestByIrr}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-blue-500" />
          <span className="text-muted-foreground">Lowest Risk:</span>
          <Badge variant="outline" className="font-medium">{comparison.bestByRisk}</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium">Metric</th>
              {comparison.summary.map((s, i) => (
                <th key={i} className="text-center py-2 px-3 min-w-[140px]">
                  <div className="space-y-1">
                    <div className="font-medium text-xs">{s.scenarioName}</div>
                    <Badge className={`text-[10px] ${STRATEGY_COLORS[scenarios[i]?.scenarioType || 'cash_sale'] || ''}`}>
                      {scenarios[i]?.scenarioType.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow 
              label="After-Tax Proceeds" 
              values={comparison.summary.map(s => formatCurrency(String(Math.round(s.afterTaxProceeds))))}
              bestIndex={comparison.summary.indexOf(comparison.summary.find(s => s.scenarioName === comparison.bestByAfterTax)!)}
            />
            <ComparisonRow 
              label="Effective Tax Rate" 
              values={comparison.summary.map(s => `${(s.effectiveTaxRate * 100).toFixed(1)}%`)}
              bestIndex={comparison.summary.reduce((best, s, i) => s.effectiveTaxRate < comparison.summary[best].effectiveTaxRate ? i : best, 0)}
              lowerIsBetter
            />
            <ComparisonRow 
              label="IRR" 
              values={comparison.summary.map(s => s.irr ? `${(s.irr * 100).toFixed(1)}%` : 'N/A')}
              bestIndex={comparison.summary.indexOf(comparison.summary.find(s => s.scenarioName === comparison.bestByIrr)!)}
            />
            <ComparisonRow 
              label="Deferred Gain" 
              values={comparison.summary.map(s => s.deferredGain > 0 ? formatCurrency(String(Math.round(s.deferredGain))) : '-')}
              bestIndex={comparison.summary.reduce((best, s, i) => s.deferredGain > comparison.summary[best].deferredGain ? i : best, 0)}
            />
            <ComparisonRow 
              label="Risk Score" 
              values={comparison.summary.map(s => `${s.riskScore}/10`)}
              bestIndex={comparison.summary.indexOf(comparison.summary.find(s => s.scenarioName === comparison.bestByRisk)!)}
              lowerIsBetter
            />
          </tbody>
        </table>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Scenario Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comparison.scenarioRankings.map((r) => (
              <div key={r.scenarioName} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm w-6 text-center ${r.rank === 1 ? 'text-yellow-500' : r.rank === 2 ? 'text-gray-400' : 'text-amber-700'}`}>
                    #{r.rank}
                  </span>
                  <span className="font-medium text-sm">{r.scenarioName}</span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Score: {r.score.toFixed(0)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonRow({ 
  label, 
  values, 
  bestIndex,
  lowerIsBetter 
}: { 
  label: string; 
  values: string[]; 
  bestIndex: number;
  lowerIsBetter?: boolean;
}) {
  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="py-2 px-3 text-muted-foreground text-xs">{label}</td>
      {values.map((v, i) => (
        <td 
          key={i} 
          className={`text-center py-2 px-3 font-mono text-xs ${
            i === bestIndex ? 'bg-green-50 font-bold text-green-700' : ''
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

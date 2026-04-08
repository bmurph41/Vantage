import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldAlert, TrendingDown, Loader2 } from 'lucide-react';

interface Props { projectId: string; }

export default function StressTestHeatmap({ projectId }: Props) {
  const [baseNoi, setBaseNoi] = useState('525000');
  const [propertyValue, setPropertyValue] = useState('7500000');
  const [minDscr, setMinDscr] = useState('1.25');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/debt-stress-test`, {
        rateShocksBps: [0, 50, 100, 150, 200], noiDrops: [0, -0.05, -0.10, -0.15, -0.20],
        baseNoi: parseFloat(baseNoi), propertyValue: parseFloat(propertyValue),
        minDscrThreshold: parseFloat(minDscr), maxLtvThreshold: 0.75,
      });
      return res.json();
    },
  });
  const result = mutation.data;
  const matrix = result?.matrix;
  const minD = parseFloat(minDscr);

  const color = (d: number) => d < minD ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
    d < minD + 0.10 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
    d < minD + 0.25 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2"><ShieldAlert className="h-4 w-4" />DSCR Stress Test</CardTitle>
        <CardDescription className="text-xs">Rate shocks × NOI compression</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label className="text-xs">Base NOI</Label><Input type="text" value={baseNoi} onChange={e => setBaseNoi(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Property Value</Label><Input type="text" value={propertyValue} onChange={e => setPropertyValue(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Min DSCR</Label><Input type="text" value={minDscr} onChange={e => setMinDscr(e.target.value)} className="h-8 text-xs" /></div>
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Running...</> : 'Run Stress Test'}
        </Button>
        {matrix && (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr>
                  <th className="p-1.5 text-left font-medium text-muted-foreground border-b">Rate ↓ \ NOI →</th>
                  {matrix.noiDrops.map((nd: number, i: number) => <th key={i} className="p-1.5 text-center font-medium text-muted-foreground border-b">{nd === 0 ? 'Base' : `${(nd*100).toFixed(0)}%`}</th>)}
                </tr></thead>
                <tbody>
                  {matrix.rateShocksBps.map((rs: number, ri: number) => (
                    <tr key={ri}>
                      <td className="p-1.5 font-medium text-muted-foreground border-r">{rs === 0 ? 'Base' : `+${rs}bps`}</td>
                      {matrix.noiDrops.map((_: number, ni: number) => {
                        const dscr = matrix.dscrValues[ri][ni];
                        const ltv = matrix.ltvValues[ri][ni];
                        return (
                          <Tooltip key={ni}><TooltipTrigger asChild>
                            <td className={`p-1.5 text-center font-mono tabular-nums cursor-default border ${color(dscr)}`}>{dscr.toFixed(2)}x</td>
                          </TooltipTrigger><TooltipContent side="top" className="text-xs">
                            <div>DSCR: {dscr.toFixed(2)}x / LTV: {(ltv*100).toFixed(1)}%</div>
                            {matrix.breaches[ri][ni] && <div className="text-red-400 font-medium">⚠ Breach</div>}
                          </TooltipContent></Tooltip>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>
        )}
        {result?.breachSummary && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Badge variant={result.breachSummary.breachedScenarios > 0 ? 'destructive' : 'secondary'} className="text-xs">{result.breachSummary.breachedScenarios}/{result.breachSummary.totalScenarios} breached</Badge>
            <Badge variant="outline" className="text-xs">Worst: {result.breachSummary.worstDscr.toFixed(2)}x</Badge>
            {result.breachSummary.breakEvenNoiDrop != null && <Badge variant="outline" className="text-xs"><TrendingDown className="h-3 w-3 mr-1" />NOI break-even: {(result.breachSummary.breakEvenNoiDrop*100).toFixed(1)}%</Badge>}
            {result.breachSummary.breakEvenRateShock != null && <Badge variant="outline" className="text-xs">Rate break-even: +{result.breachSummary.breakEvenRateShock}bps</Badge>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

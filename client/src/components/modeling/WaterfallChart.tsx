import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Layers, Loader2, Users } from 'lucide-react';

interface Props { projectId: string; cashflows?: any; }

export default function WaterfallChart({ projectId, cashflows }: Props) {
  const [prefReturn, setPrefReturn] = useState('8.0');
  const [gpCommit, setGpCommit] = useState('5.0');

  const mutation = useMutation({
    mutationFn: async () => {
      const config = { preferredReturn: parseFloat(prefReturn)/100, preferredReturnCompounding: 'annual',
        catchUpPercent: 1.0, catchUpTarget: 0.20, structureType: 'deal_by_deal', clawbackEnabled: false,
        promoteTiers: [{ name: 'Tier 1', irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }, { name: 'Tier 2', irrHurdle: 0.12, gpSplit: 0.25, lpSplit: 0.75 }],
        gpCommitmentPercent: parseFloat(gpCommit)/100 };
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/fund-waterfall`, { cashflows, config });
      return res.json();
    },
  });
  const r = mutation.data;
  const chartData = r ? [...r.annualDistributions.map((d: any) => ({ name: `Yr ${d.year}`, GP: d.gpShare, LP: d.lpShare })),
    { name: 'Exit', GP: r.exitDistribution.gpShare - r.annualDistributions.reduce((s: number, d: any) => s + d.gpShare, 0), LP: r.exitDistribution.lpShare - r.annualDistributions.reduce((s: number, d: any) => s + d.lpShare, 0) }] : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2"><Layers className="h-4 w-4" />GP / LP Waterfall</CardTitle>
        <CardDescription className="text-xs">Multi-tier promote with preferred return</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Pref Return %</Label><Input type="number" step="0.5" value={prefReturn} onChange={e => setPrefReturn(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">GP Co-Invest %</Label><Input type="number" step="1" value={gpCommit} onChange={e => setGpCommit(e.target.value)} className="h-8 text-xs" /></div>
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !cashflows} className="w-full">
          {mutation.isPending ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Computing...</> : !cashflows ? 'Needs Pro Forma cashflows' : 'Compute Waterfall'}
        </Button>
        {r && chartData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="LP" stackId="a" fill="#3b82f6" name="LP" />
                <Bar dataKey="GP" stackId="a" fill="#8b5cf6" name="GP" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {r && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2 text-xs space-y-0.5">
              <p className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1"><Users className="h-3 w-3" />LP</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Equity</span><span className="font-mono">{formatCurrency(r.lpEquity)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Distributed</span><span className="font-mono">{formatCurrency(r.metrics.lpTotalDistributed)}</span></div>
              <div className="flex justify-between font-medium"><span>Multiple</span><span className="font-mono">{r.metrics.lpEquityMultiple.toFixed(2)}x</span></div>
            </div>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-2 text-xs space-y-0.5">
              <p className="font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1"><Users className="h-3 w-3" />GP</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Equity</span><span className="font-mono">{formatCurrency(r.gpEquity)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Distributed</span><span className="font-mono">{formatCurrency(r.metrics.gpTotalDistributed)}</span></div>
              <div className="flex justify-between font-medium"><span>Multiple</span><span className="font-mono">{r.metrics.gpEquityMultiple.toFixed(2)}x</span></div>
            </div>
          </div>
        )}
        {r?.metrics.totalPromote > 0 && <Badge variant="secondary" className="text-xs">GP Promote: {formatCurrency(r.metrics.totalPromote)}</Badge>}
      </CardContent>
    </Card>
  );
}

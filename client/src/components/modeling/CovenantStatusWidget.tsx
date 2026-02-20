import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface Props { projectId: string; }
type Status = 'green' | 'yellow' | 'red';

function getStatus(v: number | null | undefined, min?: number, max?: number): Status {
  if (v == null) return 'green';
  if (min != null && v < min) return 'red';
  if (max != null && v > max) return 'red';
  if (min != null && v < min + 0.10) return 'yellow';
  if (max != null && v > max - 0.05) return 'yellow';
  return 'green';
}

const colors: Record<Status, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
};

function Icon({ s }: { s: Status }) {
  if (s === 'red') return <ShieldAlert className="h-3.5 w-3.5 text-red-500" />;
  if (s === 'yellow') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />;
}

function Row({ label, value, status }: { label: string; value: string; status: Status }) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-md border ${colors[status]}`}>
      <div className="flex items-center gap-1.5"><Icon s={status} /><span className="text-xs font-medium">{label}</span></div>
      <span className="text-xs font-mono font-semibold">{value}</span>
    </div>
  );
}

export default function CovenantStatusWidget({ projectId }: Props) {
  const { data, isLoading } = useQuery<any>({ queryKey: ['/api/modeling/projects', projectId, 'debt-summary'] });

  if (isLoading) return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4" />Covenant Status</CardTitle></CardHeader>
    <CardContent className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></CardContent></Card>
  );
  if (!data?.hasDebt) return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4" />Covenant Status</CardTitle></CardHeader>
    <CardContent><p className="text-xs text-muted-foreground">No debt configured</p></CardContent></Card>
  );

  const ds = getStatus(data.dscr, 1.25);
  const ls = getStatus(data.ltv, undefined, 0.75);
  const dys = data.debtYield != null ? getStatus(data.debtYield, 0.08) : 'green' as Status;
  const overall: Status = [ds,ls,dys].includes('red') ? 'red' : [ds,ls,dys].includes('yellow') ? 'yellow' : 'green';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2"><Shield className="h-4 w-4" />Covenant Status</span>
          <Badge variant={overall === 'red' ? 'destructive' : overall === 'yellow' ? 'default' : 'secondary'} className="text-[10px]">
            {overall === 'green' ? 'All Clear' : overall === 'yellow' ? 'Caution' : 'Breach'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label="DSCR" value={data.dscr != null ? `${data.dscr.toFixed(2)}x` : 'N/A'} status={ds} />
        <Row label="LTV" value={`${(data.ltv*100).toFixed(1)}%`} status={ls} />
        {data.debtYield != null && <Row label="Debt Yield" value={`${(data.debtYield*100).toFixed(2)}%`} status={dys} />}
      </CardContent>
    </Card>
  );
}

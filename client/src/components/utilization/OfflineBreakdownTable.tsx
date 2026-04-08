import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShieldOff, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  dredging: { label: 'Dredging', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  storm: { label: 'Storm Damage', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  repair: { label: 'Repair', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  upgrade: { label: 'Upgrade', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  power_outage: { label: 'Power Outage', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  condemnation: { label: 'Condemnation', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' },
  owner_use: { label: 'Owner Use', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300' },
  other: { label: 'Other', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300' },
};

function formatCurrency(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

interface OfflineBreakdownTableProps {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  mode: string;
}

export default function OfflineBreakdownTable({
  propertyId,
  periodStart,
  periodEnd,
  mode,
}: OfflineBreakdownTableProps) {
  const queryParams = new URLSearchParams({
    propertyId,
    periodStart,
    periodEnd,
    mode,
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/utilization/offline-breakdown', propertyId, periodStart, periodEnd, mode],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/offline-breakdown?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch offline breakdown');
      return res.json();
    },
    enabled: !!propertyId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const byReason = data?.byReason ?? [];
  const totalLostRevenue = data?.totalEstimatedLostRevenue ?? 0;
  const totalBlocks = data?.totalOfflineBlocks ?? 0;
  const totalOfflineUnits = data?.totalOfflineUnits ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          Offline Capacity Breakdown
        </CardTitle>
        <CardDescription>
          {totalBlocks > 0
            ? `${totalBlocks} offline block${totalBlocks !== 1 ? 's' : ''} affecting ${totalOfflineUnits} unit${totalOfflineUnits !== 1 ? 's' : ''}`
            : 'No offline blocks in this period'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalBlocks === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">All units are operational</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <DollarSign className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-400">
                  Est. Lost Revenue: {formatCurrency(totalLostRevenue)}
                </p>
                <p className="text-xs text-red-700 dark:text-red-500">
                  Based on avg effective rate per capacity-time for occupied units
                </p>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Blocks</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Capacity-Time</TableHead>
                  <TableHead className="text-right">Est. Lost Rev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byReason.map((reason: any) => {
                  const info = REASON_LABELS[reason.reasonCode] ?? REASON_LABELS.other;
                  return (
                    <TableRow key={reason.reasonCode}>
                      <TableCell>
                        <Badge className={cn('text-xs', info.color)} variant="secondary">
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{reason.blockCount}</TableCell>
                      <TableCell className="text-right">{reason.unitIds?.length ?? 0}</TableCell>
                      <TableCell className="text-right">{reason.totalOfflineDays}</TableCell>
                      <TableCell className="text-right">{reason.offlineCapacityTime.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                        {formatCurrency(reason.estimatedLostRevenue)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
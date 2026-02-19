import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Anchor, Eye, FileText, Radio, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

type UtilizationMode = 'contracted' | 'physical';

interface DrilldownEvent {
  id: string;
  unitId: string;
  unitType?: string;
  startDate: string;
  endDate: string | null;
  type: 'occupancy' | 'presence';
  leaseId?: string | null;
  tenantId?: string | null;
  monthlyRevenue?: number;
  source?: string;
  confidence?: number;
}

interface OfflineBlock {
  id: string;
  scopeType: string;
  scopeKey: string;
  unitId?: string;
  startDate: string;
  endDate: string | null;
  reasonCode: string;
  notes?: string;
}

interface UtilizationDrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drilldownMetric: string;
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  mode: UtilizationMode;
  unitTypes?: string[];
}

function parseDrilldownMetric(metric: string): { unitType?: string; bandKey?: string; label: string } {
  if (metric.startsWith('type:')) {
    const unitType = metric.slice(5);
    return { unitType, label: unitType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
  }
  if (metric.startsWith('band:')) {
    const bandKey = metric.slice(5);
    return { bandKey, label: `Size Band: ${bandKey}` };
  }
  const labelMap: Record<string, string> = {
    utilization: 'All Units — Utilization',
    units: 'All Units — Inventory',
    offline: 'Offline Units',
    churn: 'Move-ins & Move-outs',
  };
  return { label: labelMap[metric] || metric };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Ongoing';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function UtilizationDrilldownDrawer({
  open,
  onOpenChange,
  drilldownMetric,
  propertyId,
  periodStart,
  periodEnd,
  mode,
  unitTypes,
}: UtilizationDrilldownDrawerProps) {
  const { unitType, bandKey, label } = parseDrilldownMetric(drilldownMetric);

  const queryParams = new URLSearchParams({
    propertyId,
    periodStart,
    periodEnd,
    mode,
  });
  if (unitType) queryParams.set('unitType', unitType);
  if (bandKey) queryParams.set('bandKey', bandKey);
  if (unitTypes?.length) queryParams.set('unitTypes', unitTypes.join(','));

  const { data, isLoading } = useQuery({
    queryKey: ['/api/utilization/drilldown-events', propertyId, periodStart, periodEnd, mode, unitType || '', bandKey || '', unitTypes?.join(',') || ''],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/drilldown-events?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch drilldown events');
      return res.json();
    },
    enabled: open && !!propertyId && !!drilldownMetric,
  });

  const events: DrilldownEvent[] = data?.events ?? [];
  const offlineBlocks: OfflineBlock[] = data?.offlineBlocks ?? [];
  const insufficientData = data?.insufficientData === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {mode === 'physical' ? <Eye className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            Drilldown: {label}
          </SheetTitle>
          <SheetDescription>
            {mode === 'contracted' ? 'Financial (Contracted)' : 'Operational (Physical)'} view
            {' — '}
            {periodStart} to {periodEnd}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={mode === 'contracted' ? 'default' : 'secondary'}>
              {mode === 'contracted' ? 'Contracted' : 'Physical'}
            </Badge>
            {unitType && <Badge variant="outline">{unitType.replace(/_/g, ' ')}</Badge>}
            {bandKey && <Badge variant="outline">{bandKey}</Badge>}
          </div>

          {insufficientData && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Insufficient Physical Data</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                    No presence events found for this period. Physical utilization requires sensor, camera, or AIS data.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {mode === 'physical' ? <Radio className="h-4 w-4" /> : <Anchor className="h-4 w-4" />}
                    {mode === 'contracted' ? 'Occupancy Events' : 'Presence Events'}
                    <Badge variant="secondary" className="ml-auto">{events.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No {mode === 'contracted' ? 'occupancy' : 'presence'} events found
                    </p>
                  ) : (
                    <div className="max-h-[320px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Unit</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            {mode === 'contracted' && <TableHead className="text-right">Revenue</TableHead>}
                            {mode === 'physical' && <TableHead>Source</TableHead>}
                            {mode === 'physical' && <TableHead className="text-right">Confidence</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {events.slice(0, 50).map((evt) => (
                            <TableRow key={evt.id}>
                              <TableCell className="font-mono text-xs">{evt.unitId.slice(0, 8)}...</TableCell>
                              <TableCell className="text-xs">{formatDate(evt.startDate)}</TableCell>
                              <TableCell className="text-xs">{formatDate(evt.endDate)}</TableCell>
                              {mode === 'contracted' && (
                                <TableCell className="text-right text-xs">
                                  {evt.monthlyRevenue != null ? `$${evt.monthlyRevenue.toLocaleString()}` : '—'}
                                </TableCell>
                              )}
                              {mode === 'physical' && (
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{evt.source || 'unknown'}</Badge>
                                </TableCell>
                              )}
                              {mode === 'physical' && (
                                <TableCell className="text-right text-xs">
                                  {evt.confidence != null ? `${(evt.confidence * 100).toFixed(0)}%` : '—'}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {events.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Showing 50 of {events.length} events
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {offlineBlocks.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ban className="h-4 w-4 text-amber-600" />
                      Offline Blocks
                      <Badge variant="secondary" className="ml-auto">{offlineBlocks.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {offlineBlocks.map((block) => (
                        <div key={block.id} className="flex items-center justify-between p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <div>
                            <p className="text-xs font-medium">
                              {block.scopeType === 'unit' ? `Unit: ${block.unitId?.slice(0, 8)}...` : `${block.scopeType}: ${block.scopeKey}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(block.startDate)} — {formatDate(block.endDate)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">{block.reasonCode || 'maintenance'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

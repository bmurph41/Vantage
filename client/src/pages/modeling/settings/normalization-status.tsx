import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity, Clock, FileCheck, FileX, Play, Loader2, ArrowRight, BarChart3, ScrollText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'wouter';

type NormalizationStatus = {
  lastRunAt?: string;
  totalNormalizedLines: number;
  mappedLines: number;
  unmappedLines: number;
};

type NormalizationResult = {
  total_lines: number;
  mapped: number;
  unmapped: number;
  breakdown?: { type: string; count: number }[];
};

type AuditLogEntry = {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  details?: string;
};

type MappingProgress = {
  total: number;
  mapped: number;
  unmapped: number;
  percentage: number;
  unmappedAccounts?: { id: string; accountName: string; accountType: string }[];
};

export default function NormalizationStatusPage() {
  const { toast } = useToast();
  const [runResult, setRunResult] = useState<NormalizationResult | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<NormalizationStatus>({
    queryKey: ['/api/financial-normalization/status'],
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['/api/coa/audit-log', '?limit=20'],
  });

  const { data: progress } = useQuery<MappingProgress>({
    queryKey: ['/api/coa/mapping/progress'],
  });

  const runNormalizationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/financial-normalization/run');
    },
    onSuccess: async (res) => {
      const data = await res.json();
      setRunResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/financial-normalization/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa/audit-log'] });
      toast({ title: 'Normalization Complete', description: `${data.total_lines || 0} lines processed` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Normalization failed', variant: 'destructive' });
    },
  });

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <div className="container mx-auto py-4 max-w-5xl space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <Activity className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold leading-tight">Normalization Status</h1>
          <p className="text-sm text-muted-foreground">Monitor and run financial data normalization</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statusLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Last Run</p>
                </div>
                <p className="text-lg font-bold">
                  {status?.lastRunAt ? formatTime(status.lastRunAt) : 'Never'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Total Lines</p>
                </div>
                <p className="text-lg font-bold">{status?.totalNormalizedLines?.toLocaleString() || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileCheck className="h-4 w-4 text-green-500" />
                  <p className="text-xs font-medium text-muted-foreground">Mapped Lines</p>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{status?.mappedLines?.toLocaleString() || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileX className="h-4 w-4 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground">Unmapped Lines</p>
                </div>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{status?.unmappedLines?.toLocaleString() || 0}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Run Normalization</CardTitle>
            </div>
            <Button
              size="sm"
              className="h-8"
              onClick={() => runNormalizationMutation.mutate()}
              disabled={runNormalizationMutation.isPending}
            >
              {runNormalizationMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3 w-3" />
              )}
              Run Normalization
            </Button>
          </div>
          <CardDescription className="text-xs">Process all available financial data through normalization</CardDescription>
        </CardHeader>
        {runResult && (
          <CardContent className="px-4 pb-3 pt-0">
            <div className="p-3 rounded-md bg-muted text-sm space-y-1">
              <p><span className="font-medium">{runResult.total_lines}</span> total lines processed</p>
              <p className="text-green-600 dark:text-green-400"><span className="font-medium">{runResult.mapped}</span> mapped</p>
              <p className="text-amber-600 dark:text-amber-400"><span className="font-medium">{runResult.unmapped}</span> unmapped</p>
              {runResult.breakdown && runResult.breakdown.length > 0 && (
                <div className="pt-1 border-t mt-1">
                  {runResult.breakdown.map((b) => (
                    <p key={b.type} className="text-xs text-muted-foreground">{b.type}: {b.count}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Recent Audit Log</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {auditLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : auditLog.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No audit log entries</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-1.5">Timestamp</TableHead>
                    <TableHead className="text-xs py-1.5">Action</TableHead>
                    <TableHead className="text-xs py-1.5">Entity Type</TableHead>
                    <TableHead className="text-xs py-1.5">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="py-1.5 text-sm text-muted-foreground whitespace-nowrap">
                        {formatTime(entry.timestamp)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-sm">{entry.entityType}</TableCell>
                      <TableCell className="py-1.5 text-sm text-muted-foreground max-w-[200px] truncate">
                        {entry.details || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {progress && progress.unmapped > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Unmapped Accounts ({progress.unmapped})</CardTitle>
              <Link href="/modeling/settings/category-mapping">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <ArrowRight className="mr-1 h-3 w-3" />
                  Go to Category Mapping
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {progress.unmappedAccounts && progress.unmappedAccounts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {progress.unmappedAccounts.slice(0, 20).map((a) => (
                  <Badge key={a.id} variant="secondary" className="text-xs">
                    {a.accountName}
                  </Badge>
                ))}
                {progress.unmappedAccounts.length > 20 && (
                  <Badge variant="secondary" className="text-xs">+{progress.unmappedAccounts.length - 20} more</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {progress.unmapped} accounts are unmapped.{' '}
                <Link href="/modeling/settings/category-mapping" className="text-primary hover:underline">
                  Map them now
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

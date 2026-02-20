import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Database, FileSpreadsheet, Loader2 } from 'lucide-react';

const formatK = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

interface DeptConfig {
  dept: string;
  label: string;
  hasProfitCenterData: boolean;
  source: 'profit_center' | 'pnl_actuals';
  pcAmount?: number;
  pnlAmount?: number;
}

interface RevenueSourceConfigResponse {
  departments: DeptConfig[];
  revenueSourceByDept: Record<string, string>;
}

export function RevenueSourceToggle({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<RevenueSourceConfigResponse>({
    queryKey: ['/api/modeling/projects', projectId, 'revenue-source-config'],
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: (revenueSourceByDept: Record<string, string>) =>
      apiRequest('PATCH', `/api/modeling/projects/${projectId}/revenue-source-config`, { revenueSourceByDept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'revenue-source-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      toast({ title: 'Updated', description: 'Revenue source preference saved. Pro Forma will update.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update revenue source.', variant: 'destructive' });
    },
  });

  const handleToggle = (dept: string, useProfitCenter: boolean) => {
    const current = data?.revenueSourceByDept || {};
    const updated = { ...current, [dept]: useProfitCenter ? 'profit_center' : 'pnl_actuals' };
    mutation.mutate(updated);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const activeDepts = (data?.departments || []).filter(d => d.hasProfitCenterData);
  if (activeDepts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          Revenue Data Source
        </CardTitle>
        <CardDescription>
          Choose whether each department uses data from Profit Center modules or uploaded P&L documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeDepts.map((dept) => (
            <div key={dept.dept} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{dept.label}</span>
                <Badge variant={dept.source === 'profit_center' ? 'default' : 'secondary'} className="text-xs">
                  {dept.source === 'profit_center' ? (
                    <><Database className="h-3 w-3 mr-1" /> Profit Center</>
                  ) : (
                    <><FileSpreadsheet className="h-3 w-3 mr-1" /> P&L Actuals</>
                  )}
                </Badge>
                {((dept.pcAmount || 0) > 0 || (dept.pnlAmount || 0) > 0) && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    PC {formatK(dept.pcAmount || 0)} / P&L {formatK(dept.pnlAmount || 0)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">P&L</span>
                <Switch
                  checked={dept.source === 'profit_center'}
                  onCheckedChange={(checked) => handleToggle(dept.dept, checked)}
                  disabled={mutation.isPending}
                />
                <span className="text-xs text-muted-foreground">PC</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

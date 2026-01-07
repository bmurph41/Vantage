import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Anchor,
  Link2,
  Unlink,
  ExternalLink,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Ship,
  Plus,
  AlertTriangle,
  Loader2,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';

interface RentRollDataTabProps {
  projectId: string;
  projectName?: string;
}

interface LinkedRraLocation {
  id: string;
  linkId: string;
  name: string;
  code?: string;
  capacity?: number;
  totalUnits?: number;
  isPrimary: boolean;
  syncEnabled: boolean;
  lastSyncAt?: string;
}

interface RraMetrics {
  occupancyRate: number;
  totalUnits: number;
  occupiedUnits: number;
  totalAnnualRevenue: number;
  averageRentPerUnit: number;
  activeLeaseCount: number;
  expiringLeases90Days: number;
  cashFlowByMonth: { month: string; amount: number }[];
}

export default function RentRollDataTab({ projectId, projectName }: RentRollDataTabProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const { data: linkedLocations = [], isLoading: locationsLoading } = useQuery<LinkedRraLocation[]>({
    queryKey: ['/api/rent-roll/modeling-projects', projectId, 'rra-locations'],
    enabled: !!projectId,
  });

  const { data: availableLocations = [] } = useQuery<any[]>({
    queryKey: ['/api/rent-roll/projects'],
  });

  const effectiveLocationId = selectedLocationId || linkedLocations[0]?.id;

  const { data: metrics, isLoading: metricsLoading } = useQuery<RraMetrics>({
    queryKey: ['/api/rent-roll/locations', effectiveLocationId, 'metrics-for-modeling'],
    enabled: !!effectiveLocationId,
  });

  const { data: leases = [] } = useQuery<any[]>({
    queryKey: ['/api/rent-roll/leases', { projectId: effectiveLocationId }],
    enabled: !!effectiveLocationId,
  });

  const linkMutation = useMutation({
    mutationFn: (rraLocationId: string) =>
      apiRequest('/api/rent-roll/modeling-links', {
        method: 'POST',
        body: JSON.stringify({ rraLocationId, modelingProjectId: projectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/modeling-projects', projectId, 'rra-locations'] });
      toast({ title: "Linked", description: "RRA location linked to this modeling project." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to link.", variant: "destructive" });
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      apiRequest(`/api/rent-roll/modeling-links/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/modeling-projects', projectId, 'rra-locations'] });
      toast({ title: "Unlinked", description: "RRA location unlinked from this modeling project." });
    }
  });

  const syncMutation = useMutation({
    mutationFn: (linkId: string) =>
      apiRequest(`/api/rent-roll/modeling-links/${linkId}/sync`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations', effectiveLocationId, 'metrics-for-modeling'] });
      toast({ title: "Synced", description: "RRA data synced to modeling assumptions." });
    }
  });

  const unlinkedLocations = availableLocations.filter(
    (loc: any) => !linkedLocations.some((ll) => ll.id === loc.id)
  );

  if (locationsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5" />
                Linked Rent Roll Data
              </CardTitle>
              <CardDescription>
                Connect RRA locations to import live occupancy and revenue data
              </CardDescription>
            </div>
            {linkedLocations.length > 0 && effectiveLocationId && (
              <Button
                onClick={() => {
                  const link = linkedLocations.find(l => l.id === effectiveLocationId);
                  if (link?.linkId) syncMutation.mutate(link.linkId);
                }}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                Sync Data
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {linkedLocations.length === 0 ? (
            <div className="text-center py-8">
              <Anchor className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">No Rent Roll Data Connected</h3>
              <p className="text-muted-foreground mb-4">
                Link an RRA location to import live occupancy and revenue data for your modeling assumptions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {linkedLocations.map((loc) => (
                  <Button
                    key={loc.id}
                    variant={selectedLocationId === loc.id || (!selectedLocationId && loc.id === linkedLocations[0]?.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedLocationId(loc.id)}
                    className="gap-2"
                  >
                    <Ship className="h-4 w-4" />
                    {loc.name}
                    {loc.isPrimary && <Badge variant="secondary" className="ml-1">Primary</Badge>}
                  </Button>
                ))}
              </div>

              {effectiveLocationId && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{linkedLocations.find(l => l.id === effectiveLocationId)?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {linkedLocations.find(l => l.id === effectiveLocationId)?.syncEnabled ? 'Sync enabled' : 'Sync disabled'}
                        {linkedLocations.find(l => l.id === effectiveLocationId)?.lastSyncAt && 
                          ` • Last synced: ${new Date(linkedLocations.find(l => l.id === effectiveLocationId)?.lastSyncAt!).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/operations/rent-roll/projects/${effectiveLocationId}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open RRA
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const link = linkedLocations.find(l => l.id === effectiveLocationId);
                        if (link?.linkId) unlinkMutation.mutate(link.linkId);
                      }}
                      disabled={unlinkMutation.isPending}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {effectiveLocationId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                    {metricsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{metrics?.occupancyRate?.toFixed(1) || 0}%</p>
                    )}
                  </div>
                  <div className={cn(
                    "p-2 rounded-full",
                    (metrics?.occupancyRate || 0) >= 90 ? "bg-green-100 dark:bg-green-900" : 
                    (metrics?.occupancyRate || 0) >= 70 ? "bg-yellow-100 dark:bg-yellow-900" : "bg-red-100 dark:bg-red-900"
                  )}>
                    <Ship className={cn(
                      "h-5 w-5",
                      (metrics?.occupancyRate || 0) >= 90 ? "text-green-600" : 
                      (metrics?.occupancyRate || 0) >= 70 ? "text-yellow-600" : "text-red-600"
                    )} />
                  </div>
                </div>
                <Progress value={metrics?.occupancyRate || 0} className="h-2 mt-3" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Occupied / Total Units</p>
                    {metricsLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold">{metrics?.occupiedUnits || 0} / {metrics?.totalUnits || 0}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Annual Revenue</p>
                    {metricsLoading ? (
                      <Skeleton className="h-8 w-28" />
                    ) : (
                      <p className="text-2xl font-bold">{formatCurrency(metrics?.totalAnnualRevenue || 0)}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Rent/Unit</p>
                    {metricsLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold">{formatCurrency(metrics?.averageRentPerUnit || 0)}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Leases</CardTitle>
                  <CardDescription>
                    {leases.length} leases from the linked RRA location
                  </CardDescription>
                </div>
                {metrics?.expiringLeases90Days && metrics.expiringLeases90Days > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {metrics.expiringLeases90Days} expiring in 90 days
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {leases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No active leases found</p>
              ) : (
                <div className="overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Slip/Unit</TableHead>
                        <TableHead>Monthly Rent</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leases.slice(0, 10).map((lease: any) => (
                        <TableRow key={lease.id}>
                          <TableCell className="font-medium">{lease.tenantName || 'Unknown'}</TableCell>
                          <TableCell>{lease.slipNumber || lease.unitNumber || '-'}</TableCell>
                          <TableCell>{formatCurrency(lease.monthlyRent || 0)}</TableCell>
                          <TableCell>{lease.startDate ? new Date(lease.startDate).toLocaleDateString() : '-'}</TableCell>
                          <TableCell>{lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'MTM'}</TableCell>
                          <TableCell>
                            <Badge variant={lease.status === 'active' ? 'default' : 'secondary'}>
                              {lease.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {leases.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      Showing 10 of {leases.length} leases
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Apply to Modeling Assumptions
              </CardTitle>
              <CardDescription>
                Use the RRA data to update your modeling inputs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Occupancy Rate</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">{metrics?.occupancyRate?.toFixed(1) || 0}%</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">→ Base case occupancy</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Units</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">{metrics?.totalUnits || 0}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">→ Total storage units</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Annual Revenue</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">{formatCurrency(metrics?.totalAnnualRevenue || 0)}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">→ Year 1 storage revenue</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => {
                    const link = linkedLocations.find(l => l.id === effectiveLocationId);
                    if (link?.linkId) syncMutation.mutate(link.linkId);
                  }}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                  Sync to Assumptions
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Link Additional RRA Location
          </CardTitle>
          <CardDescription>
            Connect more rent roll data sources to this modeling project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unlinkedLocations.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-3">All RRA locations are already linked</p>
              <Link href="/operations/rent-roll/projects/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New RRA Location
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {unlinkedLocations.slice(0, 5).map((loc: any) => (
                <div key={loc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Anchor className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{loc.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {loc.capacity || loc.totalUnits || 0} units
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => linkMutation.mutate(loc.id)}
                    disabled={linkMutation.isPending}
                  >
                    {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                    Link
                  </Button>
                </div>
              ))}
              {unlinkedLocations.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  And {unlinkedLocations.length - 5} more locations...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

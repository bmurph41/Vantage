import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PricingRecommendationsPanelProps {
  propertyId: string;
}

interface Driver {
  metric: string;
  currentValue: number;
  threshold: number;
  operator: string;
  windowDays?: number;
  satisfied: boolean;
}

interface Recommendation {
  id: string;
  propertyId: string;
  ruleId: string;
  unitType: string | null;
  bandKey: string | null;
  action: 'increase' | 'decrease' | 'hold';
  adjustmentPct: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'implemented';
  drivers: Driver[];
  summary: string;
  evaluatedAt: string;
  resolvedAt: string | null;
  notes: string | null;
}

const METRIC_LABELS: Record<string, string> = {
  weightedUtilPct: 'Weighted Util',
  unitUtilPct: 'Unit Util',
  compressionDaysPct: 'Compression %',
  avgUtilizationPct: 'Avg Utilization',
  waitlistCount: 'Waitlist',
  conversionRate: 'Conversion Rate',
};

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
};

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case 'increase': return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'decrease': return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-gray-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>;
    case 'accepted':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Accepted</Badge>;
    case 'dismissed':
      return <Badge variant="secondary">Dismissed</Badge>;
    case 'implemented':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Implemented</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function PricingRecommendationsPanel({ propertyId }: PricingRecommendationsPanelProps) {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const statusFilter = showResolved ? 'pending,accepted,dismissed,implemented' : 'pending,accepted';

  const { data, isLoading } = useQuery({
    queryKey: ['/api/pricing/recommendations', propertyId, statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/recommendations?propertyId=${propertyId}&status=${statusFilter}`);
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      return res.json();
    },
    enabled: !!propertyId,
  });

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/pricing/evaluate', { propertyId });
    },
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/recommendations'] });
      toast({
        title: 'Rules Evaluated',
        description: `${result.evaluated} rules checked, ${result.generated} new recommendation(s) generated.`,
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to evaluate pricing rules.', variant: 'destructive' });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/pricing/rules/seed', {});
    },
    onSuccess: async () => {
      toast({ title: 'Default Rules Created', description: 'Default pricing rules have been seeded.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to seed default rules.', variant: 'destructive' });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/pricing/recommendations/${id}/dismiss`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/recommendations'] });
      toast({ title: 'Dismissed', description: 'Recommendation dismissed.' });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/pricing/recommendations/${id}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/recommendations'] });
      toast({ title: 'Accepted', description: 'Recommendation accepted.' });
    },
  });

  const implementMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/pricing/recommendations/${id}/implement`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/recommendations'] });
      toast({ title: 'Implemented', description: 'Recommendation marked as implemented.' });
    },
  });

  const recommendations: Recommendation[] = data?.recommendations ?? [];
  const pendingCount = recommendations.filter(r => r.status === 'pending').length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Recommended Rate Actions
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{pendingCount}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Pricing recommendations based on utilization, waitlist, and compression data
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide Resolved' : 'Show All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Seed Rules
            </Button>
            <Button
              size="sm"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
              Evaluate Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recommendations yet.</p>
            <p className="text-xs mt-1">Click "Seed Rules" to add default pricing rules, then "Evaluate Now" to check your data.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const isExpanded = expandedId === rec.id;
              const adjPct = parseFloat(rec.adjustmentPct);

              return (
                <div
                  key={rec.id}
                  className="border rounded-lg p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        <ActionIcon action={rec.action} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {rec.action === 'increase' ? '+' : rec.action === 'decrease' ? '-' : ''}{adjPct}% Rate {rec.action === 'increase' ? 'Increase' : rec.action === 'decrease' ? 'Decrease' : 'Hold'}
                          </span>
                          {rec.unitType && (
                            <Badge variant="outline" className="text-xs">{rec.unitType}</Badge>
                          )}
                          {rec.bandKey && (
                            <Badge variant="outline" className="text-xs">{rec.bandKey}</Badge>
                          )}
                          <StatusBadge status={rec.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{rec.summary}</p>
                        <button
                          className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 hover:underline"
                          onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isExpanded ? 'Hide' : 'Show'} Drivers
                        </button>
                      </div>
                    </div>

                    {(rec.status === 'pending' || rec.status === 'accepted') && (
                      <div className="flex items-center gap-1 shrink-0">
                        {rec.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                              onClick={() => acceptMutation.mutate(rec.id)}
                              disabled={acceptMutation.isPending}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => dismissMutation.mutate(rec.id)}
                              disabled={dismissMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {rec.status === 'accepted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => implementMutation.mutate(rec.id)}
                            disabled={implementMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Mark Implemented
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Driver Metrics</p>
                      <div className="grid gap-2">
                        {rec.drivers.map((driver, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                          >
                            <span className="font-medium">
                              {METRIC_LABELS[driver.metric] || driver.metric}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={driver.satisfied ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                                {driver.currentValue}
                              </span>
                              <span className="text-muted-foreground">
                                {OPERATOR_LABELS[driver.operator] || driver.operator} {driver.threshold}
                              </span>
                              {driver.windowDays && (
                                <span className="text-muted-foreground">({driver.windowDays}d)</span>
                              )}
                              {driver.satisfied ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <X className="h-3 w-3 text-red-400" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Evaluated: {new Date(rec.evaluatedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

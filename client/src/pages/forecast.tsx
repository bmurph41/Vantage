import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Target, Calendar, Award, Percent, BarChart3, Loader2, AlertTriangle, Clock, Zap, Layers, ArrowRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, addMonths, differenceInDays } from "date-fns";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Link } from "wouter";
import type { Deal, CrmPipelineStage } from "@shared/schema";

type DealWithRelations = Deal & {
  contact?: any;
  company?: any;
};

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export default function Forecast() {
  const [timePeriod, setTimePeriod] = useState<"month" | "quarter" | "year">("quarter");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: deals = [], isLoading: dealsLoading } = useQuery<DealWithRelations[]>({
    queryKey: ['/api/deals'],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<CrmPipelineStage[]>({
    queryKey: ['/api/stages'],
  });

  const isLoading = dealsLoading || stagesLoading;

  const wonStageIds = useMemo(() => {
    return new Set(stages.filter(s => s.stageType === 'won').map(s => s.id));
  }, [stages]);

  const lostStageIds = useMemo(() => {
    return new Set(stages.filter(s => s.stageType === 'lost').map(s => s.id));
  }, [stages]);

  const dateRange = useMemo(() => {
    switch (timePeriod) {
      case "month":
        return {
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        };
      case "quarter":
        return {
          start: startOfQuarter(selectedDate),
          end: endOfQuarter(selectedDate),
        };
      case "year":
        return {
          start: startOfYear(selectedDate),
          end: endOfYear(selectedDate),
        };
    }
  }, [timePeriod, selectedDate]);

  const periodDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (!deal.expectedCloseDate) return false;
      const closeDate = new Date(deal.expectedCloseDate);
      return isWithinInterval(closeDate, dateRange);
    });
  }, [deals, dateRange]);

  const isDealWon = (deal: DealWithRelations) => {
    if (deal.stageId && wonStageIds.has(deal.stageId)) return true;
    const s = (deal.stage || '').toLowerCase().replace(/[_\s]/g, '');
    return s === 'closedwon' || s === 'won';
  };

  const isDealLost = (deal: DealWithRelations) => {
    if (deal.stageId && lostStageIds.has(deal.stageId)) return true;
    const s = (deal.stage || '').toLowerCase().replace(/[_\s]/g, '');
    return s === 'closedlost' || s === 'lost';
  };

  const metrics = useMemo(() => {
    const wonDeals = periodDeals.filter(isDealWon);
    const lostDeals = periodDeals.filter(isDealLost);
    const openDeals = periodDeals.filter(d => !isDealWon(d) && !isDealLost(d));

    const totalRevenue = wonDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const totalCommission = wonDeals.reduce((sum, deal) => sum + Number(deal.commissionAmount || 0), 0);
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const weightedPipeline = openDeals.reduce((sum, deal) => {
      const amount = Number(deal.amount || 0);
      const stageProbability = deal.stageId
        ? stages.find(s => s.id === deal.stageId)?.probability
        : undefined;
      const probability = (stageProbability ?? deal.probability ?? 10) / 100;
      return sum + (amount * probability);
    }, 0);

    const projectedCommission = openDeals.reduce((sum, deal) => {
      const commissionAmount = Number(deal.commissionAmount || 0);
      const stageProbability = deal.stageId
        ? stages.find(s => s.id === deal.stageId)?.probability
        : undefined;
      const probability = (stageProbability ?? deal.probability ?? 10) / 100;
      return sum + (commissionAmount * probability);
    }, 0);

    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    return {
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      totalRevenue,
      totalCommission,
      pipelineValue,
      weightedPipeline,
      projectedCommission,
      totalProjectedCommission: totalCommission + projectedCommission,
      openDeals: openDeals.length,
      winRate,
    };
  }, [periodDeals, stages, wonStageIds, lostStageIds]);

  const monthlyBreakdown = useMemo(() => {
    const months: any[] = [];
    let currentMonth = dateRange.start;

    while (currentMonth <= dateRange.end) {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const monthDeals = periodDeals.filter((deal) => {
        if (!deal.expectedCloseDate) return false;
        const closeDate = new Date(deal.expectedCloseDate);
        return isWithinInterval(closeDate, { start: monthStart, end: monthEnd });
      });

      const wonDeals = monthDeals.filter(isDealWon);
      const openDeals = monthDeals.filter(d => !isDealWon(d) && !isDealLost(d));

      const revenue = wonDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
      const commission = wonDeals.reduce((sum, deal) => sum + Number(deal.commissionAmount || 0), 0);
      const projectedRevenue = openDeals.reduce((sum, deal) => {
        const amount = Number(deal.amount || 0);
        const stageProbability = deal.stageId
          ? stages.find(s => s.id === deal.stageId)?.probability
          : undefined;
        const probability = (stageProbability ?? deal.probability ?? 10) / 100;
        return sum + (amount * probability);
      }, 0);
      const projectedCommission = openDeals.reduce((sum, deal) => {
        const commissionAmount = Number(deal.commissionAmount || 0);
        const stageProbability = deal.stageId
          ? stages.find(s => s.id === deal.stageId)?.probability
          : undefined;
        const probability = (stageProbability ?? deal.probability ?? 10) / 100;
        return sum + (commissionAmount * probability);
      }, 0);

      months.push({
        month: format(currentMonth, "MMM yyyy"),
        dealCount: monthDeals.length,
        wonCount: wonDeals.length,
        revenue,
        commission,
        projectedRevenue,
        projectedCommission,
        totalProjected: revenue + projectedRevenue,
        totalCommissionProjected: commission + projectedCommission,
      });

      currentMonth = addMonths(currentMonth, 1);
    }

    return months;
  }, [periodDeals, dateRange, stages, wonStageIds, lostStageIds]);

  const sourceBreakdown = useMemo(() => {
    const sources: Record<string, any> = {};

    periodDeals.forEach((deal) => {
      const source = deal.dealSource || "Unknown";
      if (!sources[source]) {
        sources[source] = {
          source,
          count: 0,
          revenue: 0,
          commission: 0,
          avgCommissionRate: 0,
          deals: [],
        };
      }

      sources[source].count += 1;
      sources[source].revenue += Number(deal.amount || 0);
      sources[source].commission += Number(deal.commissionAmount || 0);
      sources[source].deals.push(deal);
    });

    Object.values(sources).forEach((source: any) => {
      if (source.revenue > 0) {
        source.avgCommissionRate = (source.commission / source.revenue) * 100;
      }
    });

    return Object.values(sources).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [periodDeals]);

  const topDeals = useMemo(() => {
    return [...periodDeals]
      .filter(d => !isDealWon(d) && !isDealLost(d))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 5);
  }, [periodDeals, wonStageIds, lostStageIds]);

  const pipelineHealthMetrics = useMemo(() => {
    const openDeals = periodDeals.filter(d => !isDealWon(d) && !isDealLost(d));
    const now = new Date();

    const pipelineCoverage = metrics.totalRevenue > 0
      ? metrics.weightedPipeline / metrics.totalRevenue
      : null;

    const dealVelocities = openDeals.map(d => {
      const created = d.createdAt ? new Date(d.createdAt) : now;
      return differenceInDays(now, created);
    });
    const avgVelocity = dealVelocities.length > 0
      ? Math.round(dealVelocities.reduce((a, b) => a + b, 0) / dealVelocities.length)
      : 0;

    const agingDeals = openDeals.filter(d => {
      if (!d.expectedCloseDate) return false;
      return new Date(d.expectedCloseDate) < now;
    });

    const newPipelineDeals = periodDeals.filter(d => {
      if (!d.createdAt) return false;
      const created = new Date(d.createdAt);
      return isWithinInterval(created, dateRange) && !isDealWon(d) && !isDealLost(d);
    });
    const pipelineGrowth = newPipelineDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);

    return { pipelineCoverage, avgVelocity, agingDealsCount: agingDeals.length, pipelineGrowth };
  }, [periodDeals, metrics, dateRange, wonStageIds, lostStageIds]);

  const stageFunnelData = useMemo(() => {
    const openDeals = periodDeals.filter(d => !isDealWon(d) && !isDealLost(d));
    const activeStages = stages
      .filter(s => s.stageType !== 'won' && s.stageType !== 'lost')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const stageData = activeStages.map((stage, index) => {
      const stageDeals = openDeals.filter(d => d.stageId === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const nextStage = activeStages[index + 1];
      const nextStageCount = nextStage
        ? openDeals.filter(d => d.stageId === nextStage.id).length
        : 0;
      const conversionRate = stageDeals.length > 0
        ? (nextStageCount / stageDeals.length) * 100
        : 0;

      return {
        id: stage.id,
        name: stage.name,
        dealCount: stageDeals.length,
        totalValue,
        conversionRate,
        isLast: index === activeStages.length - 1,
      };
    });

    const maxCount = Math.max(...stageData.map(s => s.dealCount), 1);
    return stageData.map(s => ({ ...s, barWidth: (s.dealCount / maxCount) * 100 }));
  }, [periodDeals, stages, wonStageIds, lostStageIds]);

  const dealAgingBuckets = useMemo(() => {
    const openDeals = periodDeals.filter(d => !isDealWon(d) && !isDealLost(d));
    const now = new Date();

    const buckets = [
      { label: "< 30 days", min: 0, max: 30, deals: [] as DealWithRelations[], color: "bg-green-500" },
      { label: "30-60 days", min: 30, max: 60, deals: [] as DealWithRelations[], color: "bg-yellow-500" },
      { label: "60-90 days", min: 60, max: 90, deals: [] as DealWithRelations[], color: "bg-orange-500" },
      { label: "90+ days", min: 90, max: Infinity, deals: [] as DealWithRelations[], color: "bg-red-500" },
    ];

    openDeals.forEach(deal => {
      const created = deal.createdAt ? new Date(deal.createdAt) : now;
      const age = differenceInDays(now, created);
      const bucket = buckets.find(b => age >= b.min && age < b.max);
      if (bucket) bucket.deals.push(deal);
    });

    const totalDeals = openDeals.length || 1;
    return buckets.map(b => ({
      ...b,
      count: b.deals.length,
      totalValue: b.deals.reduce((sum, d) => sum + Number(d.amount || 0), 0),
      percentage: (b.deals.length / totalDeals) * 100,
    }));
  }, [periodDeals, wonStageIds, lostStageIds]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="forecast-title">
                Commission Forecast
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Pipeline revenue projections and commission tracking</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
              <SelectTrigger className="w-36" data-testid="select-time-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <KpiSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
              <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card data-testid="card-revenue">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Revenue (Won)</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</div>
                  <p className="text-xs text-gray-500 mt-1">{metrics.wonDeals} deals closed</p>
                </CardContent>
              </Card>

              <Card data-testid="card-commission-earned">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Commission Earned</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Award className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalCommission)}</div>
                  <p className="text-xs text-gray-500 mt-1">From won deals</p>
                </CardContent>
              </Card>

              <Card data-testid="card-pipeline">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Weighted Pipeline</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.weightedPipeline)}</div>
                  <p className="text-xs text-gray-500 mt-1">{metrics.openDeals} open deals</p>
                </CardContent>
              </Card>

              <Card data-testid="card-projected-commission">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Projected</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalProjectedCommission)}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatPercent(metrics.winRate)} win rate
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Pipeline Coverage</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-cyan-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {pipelineHealthMetrics.pipelineCoverage !== null
                      ? `${pipelineHealthMetrics.pipelineCoverage.toFixed(1)}x`
                      : "∞"}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {pipelineHealthMetrics.pipelineCoverage !== null && pipelineHealthMetrics.pipelineCoverage > 3
                      ? <span className="text-green-600">Healthy coverage</span>
                      : pipelineHealthMetrics.pipelineCoverage !== null
                        ? <span className="text-amber-600">Below 3x target</span>
                        : "No won revenue yet"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Deal Velocity</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-teal-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{pipelineHealthMetrics.avgVelocity} days</div>
                  <p className="text-xs text-gray-500 mt-1">Avg time in pipeline</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Aging Deals</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{pipelineHealthMetrics.agingDealsCount}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {pipelineHealthMetrics.agingDealsCount > 0
                      ? <span className="text-red-600">Overdue deals need attention</span>
                      : "No overdue deals"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Pipeline Growth</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(pipelineHealthMetrics.pipelineGrowth)}</div>
                  <p className="text-xs text-gray-500 mt-1">New pipeline this period</p>
                </CardContent>
              </Card>
            </div>

            {topDeals.length > 0 && (
              <Card className="mb-6" data-testid="card-top-deals">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                    </div>
                    Top Open Deals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topDeals.map((deal) => {
                      const stageName = deal.stageId
                        ? stages.find(s => s.id === deal.stageId)?.name || deal.stage
                        : deal.stage;
                      const prob = deal.stageId
                        ? stages.find(s => s.id === deal.stageId)?.probability ?? deal.probability ?? 10
                        : deal.probability ?? 10;
                      return (
                        <div key={deal.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0">
                          <div className="flex-1">
                            <Link href={`/crm/deals/${deal.id}`} onClick={(e: any) => e.stopPropagation()}>
                              <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">{deal.title || deal.name}</span>
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              {deal.contact && deal.contactId && (
                                <Link href={`/crm/contacts/${deal.contactId}`} onClick={(e: any) => e.stopPropagation()}>
                                  <span className="text-xs text-blue-500 hover:text-blue-700 hover:underline cursor-pointer">{deal.contact.firstName} {deal.contact.lastName}</span>
                                </Link>
                              )}
                              {deal.contact && !deal.contactId && (
                                <span className="text-xs text-gray-500">{deal.contact.firstName} {deal.contact.lastName}</span>
                              )}
                              {deal.company && deal.companyId && (
                                <Link href={`/crm/companies/${deal.companyId}`} onClick={(e: any) => e.stopPropagation()}>
                                  <span className="text-xs text-blue-500 hover:text-blue-700 hover:underline cursor-pointer">{deal.company.name}</span>
                                </Link>
                              )}
                              {deal.company && !deal.companyId && (
                                <span className="text-xs text-gray-500">{deal.company.name}</span>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">{stageName}</Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{formatCurrency(Number(deal.amount || 0))}</div>
                            <div className="text-xs text-gray-500">{prob}% probability</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card data-testid="card-monthly-breakdown">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    Monthly Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {monthlyBreakdown.map((month) => (
                      <div key={month.month} className="border-b border-gray-200 pb-3 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-900">{month.month}</span>
                          <span className="text-sm text-gray-500">{month.wonCount}/{month.dealCount} won</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Revenue</div>
                            <div className="font-semibold text-gray-900">{formatCurrency(month.revenue)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Commission</div>
                            <div className="font-semibold text-green-600">{formatCurrency(month.commission)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Projected Revenue</div>
                            <div className="font-medium text-blue-600">{formatCurrency(month.projectedRevenue)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Projected Commission</div>
                            <div className="font-medium text-blue-600">{formatCurrency(month.projectedCommission)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {monthlyBreakdown.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No deals in this period</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-performance-metrics">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Percent className="w-4 h-4 text-purple-600" />
                    </div>
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Win Rate</span>
                        <span className="text-lg font-bold text-gray-900">{formatPercent(metrics.winRate)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-green-600 h-2.5 rounded-full transition-all"
                          style={{ width: `${Math.min(metrics.winRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>{metrics.wonDeals} won</span>
                        <span>{metrics.lostDeals} lost</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-sm text-gray-600 mb-1">Pipeline Value</div>
                          <div className="text-xl font-bold text-gray-900">{formatCurrency(metrics.pipelineValue)}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-sm text-gray-600 mb-1">Weighted Value</div>
                          <div className="text-xl font-bold text-blue-600">{formatCurrency(metrics.weightedPipeline)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-600 mb-2">Commission Pipeline</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Earned</div>
                          <div className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalCommission)}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Projected</div>
                          <div className="text-lg font-bold text-blue-600">{formatCurrency(metrics.projectedCommission)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-source-breakdown" className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                  </div>
                  Commission by Deal Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200">
                      <tr className="text-left">
                        <th className="pb-3 text-sm font-semibold text-gray-600">Source</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600 text-right">Deals</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600 text-right">Revenue</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600 text-right">Commission</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600 text-right">Avg Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            No deals in this period
                          </td>
                        </tr>
                      ) : (
                        sourceBreakdown.map((source: any) => (
                          <tr key={source.source} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="py-3 font-medium text-gray-900 capitalize">{source.source}</td>
                            <td className="py-3 text-right text-gray-900">{source.count}</td>
                            <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(source.revenue)}</td>
                            <td className="py-3 text-right font-semibold text-green-600">{formatCurrency(source.commission)}</td>
                            <td className="py-3 text-right text-gray-600">{formatPercent(source.avgCommissionRate)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </div>
                  Stage Funnel Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stageFunnelData.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pipeline stages configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stageFunnelData.map((stage) => (
                      <div key={stage.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 text-sm">{stage.name}</span>
                            <Badge variant="secondary" className="text-xs">{stage.dealCount} deals</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-semibold text-gray-900">{formatCurrency(stage.totalValue)}</span>
                            {!stage.isLast && (
                              <span className="flex items-center gap-1 text-gray-500">
                                <ArrowRight className="w-3 h-3" />
                                {stage.conversionRate.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className="bg-indigo-500 h-3 rounded-full transition-all"
                            style={{ width: `${Math.max(stage.barWidth, 2)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  Deal Aging Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dealAgingBuckets.map((bucket) => (
                    <div key={bucket.label} className={`rounded-lg p-4 ${bucket.label === "90+ days" ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${bucket.label === "90+ days" ? "text-red-700" : "text-gray-900"}`}>
                            {bucket.label}
                          </span>
                          {bucket.label === "90+ days" && bucket.count > 0 && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">{bucket.count} deals</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(bucket.totalValue)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`${bucket.color} h-2.5 rounded-full transition-all`}
                          style={{ width: `${Math.max(bucket.percentage, 1)}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{bucket.percentage.toFixed(1)}% of open deals</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

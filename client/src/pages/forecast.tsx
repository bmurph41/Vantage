import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Target, Calendar, Award, Percent, BarChart3, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, addMonths } from "date-fns";
import { formatCurrency, formatPercent } from "@/lib/utils";
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
                            <div className="font-medium text-gray-900">{deal.title || deal.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {deal.contact && (
                                <span className="text-xs text-gray-500">{deal.contact.firstName} {deal.contact.lastName}</span>
                              )}
                              {deal.company && (
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

            <Card data-testid="card-source-breakdown">
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
          </>
        )}
      </div>
    </div>
  );
}

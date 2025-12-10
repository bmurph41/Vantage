import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Clock, Target, ArrowRight, BarChart3 } from "lucide-react";
import type { CrmDeal, CrmPipelineStage } from "@shared/schema";

interface DealMetricsDashboardProps {
  pipelineId?: string;
}

export function DealMetricsDashboard({ pipelineId }: DealMetricsDashboardProps) {
  const { data: deals = [], isLoading: dealsLoading } = useQuery<CrmDeal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<CrmPipelineStage[]>({
    queryKey: ["/api/stages"],
  });

  if (dealsLoading || stagesLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-24 mb-2"></div>
              <div className="h-8 bg-muted rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const filteredDeals = pipelineId 
    ? deals.filter(d => d.pipelineId === pipelineId)
    : deals;

  const filteredStages = pipelineId
    ? stages.filter(s => s.pipelineId === pipelineId)
    : stages;

  const totalPipelineValue = filteredDeals.reduce((sum, deal) => {
    const value = typeof deal.dealValue === 'string' ? parseFloat(deal.dealValue) : (deal.dealValue || 0);
    return sum + value;
  }, 0);

  const weightedPipelineValue = filteredDeals.reduce((sum, deal) => {
    const value = typeof deal.dealValue === 'string' ? parseFloat(deal.dealValue) : (deal.dealValue || 0);
    const probability = deal.probability || 0;
    return sum + (value * probability / 100);
  }, 0);

  const closedWonDeals = filteredDeals.filter(d => d.isClosed && d.wonOrLost === 'won');
  const closedLostDeals = filteredDeals.filter(d => d.isClosed && d.wonOrLost === 'lost');
  const openDeals = filteredDeals.filter(d => !d.isClosed);

  const closedWonValue = closedWonDeals.reduce((sum, deal) => {
    const value = typeof deal.dealValue === 'string' ? parseFloat(deal.dealValue) : (deal.dealValue || 0);
    return sum + value;
  }, 0);

  const totalClosedDeals = closedWonDeals.length + closedLostDeals.length;
  const winRate = totalClosedDeals > 0 ? (closedWonDeals.length / totalClosedDeals * 100) : 0;

  const avgDealSize = filteredDeals.length > 0 
    ? totalPipelineValue / filteredDeals.length 
    : 0;

  const avgDaysInStage = filteredDeals.reduce((sum, deal) => sum + (deal.daysInCurrentStage || 0), 0) / (filteredDeals.length || 1);

  const valueByStage = filteredStages
    .sort((a, b) => a.stageOrder - b.stageOrder)
    .map(stage => {
      const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
      const value = stageDeals.reduce((sum, deal) => {
        const v = typeof deal.dealValue === 'string' ? parseFloat(deal.dealValue) : (deal.dealValue || 0);
        return sum + v;
      }, 0);
      return { stage, dealCount: stageDeals.length, value };
    });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-pipeline">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pipeline Value</p>
                <h3 className="text-2xl font-bold mt-1" data-testid="text-total-value">
                  {formatCurrency(totalPipelineValue)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {openDeals.length} open deals
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-weighted-pipeline">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Weighted Pipeline</p>
                <h3 className="text-2xl font-bold mt-1" data-testid="text-weighted-value">
                  {formatCurrency(weightedPipelineValue)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected revenue
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-win-rate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <h3 className="text-2xl font-bold mt-1" data-testid="text-win-rate">
                  {winRate.toFixed(1)}%
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {closedWonDeals.length} won / {totalClosedDeals} closed
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-days">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Days in Stage</p>
                <h3 className="text-2xl font-bold mt-1" data-testid="text-avg-days">
                  {avgDaysInStage.toFixed(1)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg deal size: {formatCurrency(avgDealSize)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-pipeline-funnel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pipeline by Stage
          </CardTitle>
          <CardDescription>
            Deal distribution and value across pipeline stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {valueByStage.map(({ stage, dealCount, value }, index) => {
              const maxValue = Math.max(...valueByStage.map(v => v.value), 1);
              const percentage = (value / maxValue) * 100;
              
              return (
                <div key={stage.id} className="space-y-2" data-testid={`stage-row-${stage.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color || '#3B82F6' }}
                      />
                      <span className="font-medium">{stage.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({dealCount} {dealCount === 1 ? 'deal' : 'deals'})
                      </span>
                    </div>
                    <span className="font-semibold">{formatCurrency(value)}</span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                    style={{ 
                      '--progress-background': stage.color || '#3B82F6' 
                    } as React.CSSProperties}
                  />
                  {index < valueByStage.length - 1 && valueByStage[index].dealCount > 0 && valueByStage[index + 1].dealCount > 0 && (
                    <div className="flex items-center justify-center py-1">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground ml-1">
                        {((valueByStage[index + 1].dealCount / Math.max(valueByStage[index].dealCount, 1)) * 100).toFixed(0)}% conversion
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-closed-won">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Closed Won</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(closedWonValue)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {closedWonDeals.length} deals closed
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-closed-lost">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Closed Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {closedLostDeals.length}
                </h3>
                <p className="text-sm text-muted-foreground">
                  deals lost
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <Target className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

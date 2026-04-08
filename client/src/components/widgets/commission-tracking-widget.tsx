import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Target,
  Award,
  PieChart,
  Users,
  Activity,
  ArrowUpRight,
  AlertCircle
} from "lucide-react";

interface CommissionData {
  earned: number;
  pending: number;
  forecasted: number;
  ytdTotal: number;
  progress: {
    current: number;
    target: number;
    percentage: number;
  };
  recentTransactions: {
    id: string;
    dealName: string;
    amount: number;
    rate: number;
    status: 'earned' | 'pending' | 'paid';
    date: string;
  }[];
  forecast: {
    nextMonth: number;
    nextQuarter: number;
    confidence: number;
  };
}

const statusColors = {
  earned: 'bg-green-500',
  pending: 'bg-yellow-500',
  paid: 'bg-blue-500'
};

const statusLabels = {
  earned: 'Earned',
  pending: 'Pending',
  paid: 'Paid'
};

export default function CommissionTrackingWidget() {
  const { data: commissionData, isLoading } = useQuery<CommissionData>({
    queryKey: ['/api/commission/dashboard'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="commission-tracking-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Commission Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            <div className="h-2 bg-gray-200 rounded w-full"></div>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded w-full animate-pulse"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!commissionData) {
    return (
      <Card className="h-full" data-testid="commission-tracking-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Commission Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No commission data available</p>
            <p className="text-sm">Commission tracking will appear here once deals are closed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="commission-tracking-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Commission Tracking
            <Badge variant="outline" className="ml-2">
              YTD: {formatCurrency(commissionData.ytdTotal)}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="view-commission-details">
            <Activity className="w-4 h-4 mr-1" />
            Details
          </Button>
        </div>
        
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(commissionData.earned)}
            </div>
            <div className="text-xs text-gray-500">Earned</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">
              {formatCurrency(commissionData.pending)}
            </div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
        </div>
        
        {/* Progress Towards Target */}
        {commissionData.progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Target Progress</span>
              <span className="text-sm text-gray-500">
                {formatCurrency(commissionData.progress.current)} / {formatCurrency(commissionData.progress.target)}
              </span>
            </div>
            <Progress value={commissionData.progress.percentage} className="h-2" />
            <div className="text-xs text-gray-500 mt-1">
              {Math.round(commissionData.progress.percentage)}% of annual target
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>
          
          <TabsContent value="recent" className="mt-4">
            <div className="space-y-3">
              {commissionData.recentTransactions.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Award className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No recent transactions</p>
                </div>
              ) : (
                commissionData.recentTransactions.map((transaction, index) => (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    data-testid={`commission-transaction-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${statusColors[transaction.status]}`}></div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {transaction.dealName}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatDate(transaction.date)}</span>
                          <span>•</span>
                          <span>{(transaction.rate * 100).toFixed(1)}% rate</span>
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[transaction.status]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm text-gray-900">
                        {formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="forecast" className="mt-4">
            <div className="space-y-4">
              {/* Forecast Cards */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Next Month</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-900">
                      {formatCurrency(commissionData.forecast.nextMonth)}
                    </div>
                    <div className="text-xs text-blue-700">Projected</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Next Quarter</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-900">
                      {formatCurrency(commissionData.forecast.nextQuarter)}
                    </div>
                    <div className="text-xs text-green-700">Projected</div>
                  </div>
                </div>
              </div>
              
              {/* Confidence Indicator */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Forecast Confidence
                  </div>
                  <div className="text-xs text-gray-600">
                    Based on pipeline and historical data
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">
                    {Math.round(commissionData.forecast.confidence)}%
                  </div>
                </div>
              </div>
              
              {/* Forecast Notes */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <div className="font-medium mb-1">Forecast Notes</div>
                    <p className="text-xs">
                      Projections based on current pipeline, historical closing rates, 
                      and seasonal trends. Actual results may vary.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
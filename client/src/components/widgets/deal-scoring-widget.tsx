import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  DollarSign,
  Activity,
  Users,
  Zap,
  Shield,
  Award,
  Eye,
  BarChart3
} from "lucide-react";
import { useMemo } from "react";

interface DealScore {
  dealId: string;
  dealName: string;
  overallScore: number;
  probabilityScore: number;
  timelineScore: number;
  valueScore: number;
  riskScore: number;
  activityScore: number;
  confidence: number;
  stage: string;
  value: number;
  predictions: {
    closingProbability: number;
    estimatedCloseDate: string;
    predictedValue: number;
    riskFactors: string[];
    recommendedActions: string[];
  };
}

interface DealScoringData {
  topDeals: DealScore[];
  averageScore: number;
  totalDealsScored: number;
  scoreDistribution: {
    high: number; // 80-100
    medium: number; // 50-79
    low: number; // 0-49
  };
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
};

export default function DealScoringWidget() {
  const { data: scoringData, isLoading } = useQuery<DealScoringData>({
    queryKey: ['/api/deal-scoring/summary'],
    refetchInterval: 600000, // Refresh every 10 minutes
  });

  const scoreMetrics = useMemo(() => {
    if (!scoringData) return null;
    
    return [
      {
        label: 'Average Score',
        value: Math.round(scoringData.averageScore),
        icon: Target,
        color: getScoreColor(scoringData.averageScore)
      },
      {
        label: 'Deals Scored',
        value: scoringData.totalDealsScored,
        icon: BarChart3,
        color: 'text-blue-600'
      },
      {
        label: 'High Confidence',
        value: scoringData.scoreDistribution.high,
        icon: Award,
        color: 'text-green-600'
      }
    ];
  }, [scoringData]);

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="deal-scoring-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            AI Deal Scoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topDeals = scoringData?.topDeals || [];

  return (
    <Card className="h-full" data-testid="deal-scoring-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            AI Deal Scoring
            <Badge variant="outline" className="ml-2">
              {scoringData?.totalDealsScored || 0} scored
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="view-all-scores">
            <Eye className="w-4 h-4 mr-1" />
            View All
          </Button>
        </div>
        
        {scoreMetrics && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {scoreMetrics.map((metric, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <div className={`text-lg font-bold ${metric.color}`}>
                  {typeof metric.value === 'number' && metric.label === 'Average Score' 
                    ? `${metric.value}%` 
                    : metric.value}
                </div>
                <div className="text-xs text-gray-500">{metric.label}</div>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs defaultValue="top-deals" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="top-deals">Top Deals</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
          </TabsList>
          
          <TabsContent value="top-deals" className="mt-4">
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {topDeals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No scored deals available</p>
                    <p className="text-sm">Deal scores will appear here once generated</p>
                  </div>
                ) : (
                  topDeals.map((deal, index) => (
                    <div 
                      key={deal.dealId} 
                      className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      data-testid={`deal-score-${index}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900 truncate">
                            {deal.dealName}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {deal.stage}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              ${deal.value?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={getScoreBadgeVariant(deal.overallScore)}>
                            {Math.round(deal.overallScore)}%
                          </Badge>
                          <div className="text-xs text-gray-500">
                            {deal.confidence}% confidence
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-green-600" />
                          <span className="text-xs">Probability: {Math.round(deal.probabilityScore)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span className="text-xs">Timeline: {Math.round(deal.timelineScore)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-yellow-600" />
                          <span className="text-xs">Value: {Math.round(deal.valueScore)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-red-600" />
                          <span className="text-xs">Risk: {Math.round(deal.riskScore)}%</span>
                        </div>
                      </div>
                      
                      <Progress 
                        value={deal.overallScore} 
                        className="h-2"
                      />
                      
                      {deal.predictions.riskFactors.length > 0 && (
                        <div className="mt-2 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-600">
                            {deal.predictions.riskFactors[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="distribution" className="mt-4">
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-900 mb-3">Score Distribution</div>
              
              {scoringData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">High (80-100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scoringData.scoreDistribution.high}</span>
                      <Progress 
                        value={(scoringData.scoreDistribution.high / scoringData.totalDealsScored) * 100} 
                        className="w-16 h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Medium (50-79%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scoringData.scoreDistribution.medium}</span>
                      <Progress 
                        value={(scoringData.scoreDistribution.medium / scoringData.totalDealsScored) * 100} 
                        className="w-16 h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Low (0-49%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scoringData.scoreDistribution.low}</span>
                      <Progress 
                        value={(scoringData.scoreDistribution.low / scoringData.totalDealsScored) * 100} 
                        className="w-16 h-2"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">AI Scoring Insights</div>
                    <p className="text-xs">
                      Scores are updated automatically based on deal activity, 
                      stage progression, and historical performance patterns.
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
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Target, 
  TrendingUp, 
  Award, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Trophy,
  Clock,
  ArrowUpRight,
  Star,
  Zap
} from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  percentage: number;
  timeframe: string;
  category: string;
  status: 'on_track' | 'at_risk' | 'achieved' | 'missed';
  deadline: string;
  daysRemaining: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
  category: string;
  points: number;
}

interface GoalsKpiData {
  activeGoals: Goal[];
  recentAchievements: Achievement[];
  summary: {
    totalGoals: number;
    achieved: number;
    onTrack: number;
    atRisk: number;
    totalPoints: number;
  };
}

const statusColors = {
  on_track: 'text-green-600',
  at_risk: 'text-yellow-600',
  achieved: 'text-blue-600',
  missed: 'text-red-600'
};

const statusBadgeVariants = {
  on_track: 'default',
  at_risk: 'secondary',
  achieved: 'default',
  missed: 'destructive'
} as const;

const statusIcons = {
  on_track: Target,
  at_risk: AlertCircle,
  achieved: CheckCircle,
  missed: AlertCircle
};

const categoryIcons = {
  revenue: TrendingUp,
  deals: Target,
  activities: Zap,
  performance: Star,
  general: Trophy
};

export default function GoalsKpiWidget() {
  const { data: goalsData, isLoading } = useQuery<GoalsKpiData>({
    queryKey: ['/api/goals/dashboard'],
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

  const getDaysText = (days: number) => {
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day left';
    if (days > 0) return `${days} days left`;
    return `${Math.abs(days)} days overdue`;
  };

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="goals-kpi-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Goals & KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
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

  if (!goalsData) {
    return (
      <Card className="h-full" data-testid="goals-kpi-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Goals & KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No goals set</p>
            <p className="text-sm">Set your first goal to start tracking progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="goals-kpi-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Goals & KPIs
            <Badge variant="outline" className="ml-2">
              {goalsData.summary.totalGoals} active
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="manage-goals">
            <Target className="w-4 h-4 mr-1" />
            Manage
          </Button>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {goalsData.summary.achieved}
            </div>
            <div className="text-xs text-gray-500">Achieved</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {goalsData.summary.onTrack}
            </div>
            <div className="text-xs text-gray-500">On Track</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">
              {goalsData.summary.atRisk}
            </div>
            <div className="text-xs text-gray-500">At Risk</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              {goalsData.summary.totalPoints}
            </div>
            <div className="text-xs text-gray-500">Points</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="goals">Active Goals</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>
          
          <TabsContent value="goals" className="mt-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {goalsData.activeGoals.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Target className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No active goals</p>
                </div>
              ) : (
                goalsData.activeGoals.map((goal, index) => {
                  const StatusIcon = statusIcons[goal.status];
                  const CategoryIcon = categoryIcons[goal.category as keyof typeof categoryIcons] || Trophy;
                  
                  return (
                    <div 
                      key={goal.id}
                      className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      data-testid={`goal-${index}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CategoryIcon className="w-3.5 h-3.5 text-gray-600" />
                            <h4 className="font-medium text-sm text-gray-900 truncate">
                              {goal.title}
                            </h4>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            {goal.description}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariants[goal.status]} className="text-xs">
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {goal.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">
                            {goal.category === 'revenue' ? formatCurrency(goal.current) : goal.current.toLocaleString()} 
                            {' / '}
                            {goal.category === 'revenue' ? formatCurrency(goal.target) : goal.target.toLocaleString()}
                          </span>
                        </div>
                        
                        <Progress value={goal.percentage} className="h-2" />
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{Math.round(goal.percentage)}% complete</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{getDaysText(goal.daysRemaining)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="achievements" className="mt-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {goalsData.recentAchievements.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Award className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No achievements yet</p>
                  <p className="text-xs">Complete goals to unlock achievements</p>
                </div>
              ) : (
                goalsData.recentAchievements.map((achievement, index) => {
                  const CategoryIcon = categoryIcons[achievement.category as keyof typeof categoryIcons] || Trophy;
                  
                  return (
                    <div 
                      key={achievement.id}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg"
                      data-testid={`achievement-${index}`}
                    >
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <CategoryIcon className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm text-gray-900">
                            {achievement.title}
                          </h4>
                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                            +{achievement.points} pts
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">
                          {achievement.description}
                        </p>
                        <div className="text-xs text-gray-500">
                          Unlocked {formatDate(achievement.unlockedAt)}
                        </div>
                      </div>
                      <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                  );
                })
              )}
            </div>
            
            {goalsData.recentAchievements.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-600" />
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Keep it up!</span> You've earned{' '}
                    <span className="font-bold">{goalsData.summary.totalPoints} points</span> this quarter.
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
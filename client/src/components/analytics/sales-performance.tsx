import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  TrendingUp, Target, Users, DollarSign, 
  Calendar, Phone, Mail, MessageSquare,
  Award, Star, Trophy, Crown
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface SalesAgent {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  
  // Performance metrics
  dealsWon: number;
  dealsLost: number;
  totalDealsValue: number;
  averageDealSize: number;
  winRate: number;
  
  // Activity metrics
  callsMade: number;
  emailsSent: number;
  textsSent: number;
  meetingsHeld: number;
  activitiesPerDeal: number;
  
  // Pipeline metrics
  activePipeline: number;
  averageSalesCycle: number;
  conversionRate: number;
  
  // Rankings
  rank: number;
  previousRank: number;
  
  // Targets
  monthlyTarget: number;
  targetProgress: number;
}

interface SalesTeamMetrics {
  totalRevenue: number;
  totalDeals: number;
  averageDealSize: number;
  teamWinRate: number;
  totalActivities: number;
  
  // Performance tiers
  topPerformers: SalesAgent[];
  consistentPerformers: SalesAgent[];
  needsSupport: SalesAgent[];
  
  // Team trends
  monthlyPerformance: {
    month: string;
    revenue: number;
    deals: number;
    activities: number;
    winRate: number;
  }[];
  
  // Activity breakdown
  activityBreakdown: {
    calls: { total: number; average: number };
    emails: { total: number; average: number };
    texts: { total: number; average: number };
    meetings: { total: number; average: number };
  };
  
  // Lead sources performance
  leadSources: {
    source: string;
    leads: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }[];
}

interface SalesPerformanceProps {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function SalesPerformance({ dateRange }: SalesPerformanceProps) {
  const [selectedView, setSelectedView] = useState<'team' | 'individual'>('team');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: teamMetrics, isLoading } = useQuery<SalesTeamMetrics>({
    queryKey: ['/api/analytics/sales-performance', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/sales-performance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sales performance');
      return response.json();
    },
  });

  const getPerformanceTier = (agent: SalesAgent) => {
    if (teamMetrics?.topPerformers.includes(agent)) return 'top';
    if (teamMetrics?.consistentPerformers.includes(agent)) return 'consistent';
    if (teamMetrics?.needsSupport.includes(agent)) return 'needs-support';
    return 'consistent';
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'top':
        return <Badge className="bg-gold-100 text-gold-800"><Crown className="w-3 h-3 mr-1" />Top Performer</Badge>;
      case 'consistent':
        return <Badge className="bg-green-100 text-green-800"><Star className="w-3 h-3 mr-1" />Consistent</Badge>;
      case 'needs-support':
        return <Badge className="bg-yellow-100 text-yellow-800"><Target className="w-3 h-3 mr-1" />Coaching Needed</Badge>;
      default:
        return null;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2: return <Trophy className="w-4 h-4 text-gray-400" />;
      case 3: return <Award className="w-4 h-4 text-orange-500" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!teamMetrics) return null;

  const allAgents = [
    ...teamMetrics.topPerformers,
    ...teamMetrics.consistentPerformers,
    ...teamMetrics.needsSupport,
  ].sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Sales Performance
          </h2>
          <p className="text-gray-600">
            Track individual and team performance metrics, activities, and targets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedView === 'team' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedView('team')}
          >
            Team View
          </Button>
          <Button
            variant={selectedView === 'individual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedView('individual')}
          >
            Individual View
          </Button>
        </div>
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(teamMetrics.totalRevenue)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Deals Closed</p>
                <p className="text-2xl font-bold text-blue-600">{teamMetrics.totalDeals}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Deal Size</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(teamMetrics.averageDealSize)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Team Win Rate</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatPercent(teamMetrics.teamWinRate)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <Trophy className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-2xl font-bold text-indigo-600">{teamMetrics.totalActivities}</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-100">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="activities">Activity Analysis</TabsTrigger>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="sources">Lead Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Performers */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Sales Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allAgents.map((agent) => {
                    const tier = getPerformanceTier(agent);
                    const rankIcon = getRankIcon(agent.rank);
                    
                    return (
                      <div 
                        key={agent.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedAgent(agent.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {rankIcon}
                            <span className="text-sm font-medium">#{agent.rank}</span>
                          </div>
                          
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={agent.avatar} />
                            <AvatarFallback>
                              {agent.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-sm text-gray-600">{agent.role}</div>
                          </div>
                          
                          {getTierBadge(tier)}
                        </div>
                        
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            {formatCurrency(agent.totalDealsValue)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {agent.dealsWon} deals • {formatPercent(agent.winRate)} win rate
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Target Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Target Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allAgents.slice(0, 5).map((agent) => (
                    <div key={agent.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{agent.name.split(' ')[0]}</span>
                        <span>{formatPercent(agent.targetProgress)}</span>
                      </div>
                      <Progress value={agent.targetProgress} className="h-2" />
                      <div className="text-xs text-gray-500">
                        Target: {formatCurrency(agent.monthlyTarget)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Team Activity Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100">
                        <Phone className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-medium">Phone Calls</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{teamMetrics.activityBreakdown.calls.total}</div>
                      <div className="text-sm text-gray-600">
                        {teamMetrics.activityBreakdown.calls.average.toFixed(1)} avg/person
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100">
                        <Mail className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="font-medium">Emails</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{teamMetrics.activityBreakdown.emails.total}</div>
                      <div className="text-sm text-gray-600">
                        {teamMetrics.activityBreakdown.emails.average.toFixed(1)} avg/person
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-orange-100">
                        <MessageSquare className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="font-medium">Text Messages</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{teamMetrics.activityBreakdown.texts.total}</div>
                      <div className="text-sm text-gray-600">
                        {teamMetrics.activityBreakdown.texts.average.toFixed(1)} avg/person
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-100">
                        <Calendar className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="font-medium">Meetings</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{teamMetrics.activityBreakdown.meetings.total}</div>
                      <div className="text-sm text-gray-600">
                        {teamMetrics.activityBreakdown.meetings.average.toFixed(1)} avg/person
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Activity Leaders */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Leaders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allAgents
                    .sort((a, b) => (b.callsMade + b.emailsSent + b.textsSent + b.meetingsHeld) - 
                                   (a.callsMade + a.emailsSent + a.textsSent + a.meetingsHeld))
                    .slice(0, 5)
                    .map((agent, index) => {
                      const totalActivities = agent.callsMade + agent.emailsSent + agent.textsSent + agent.meetingsHeld;
                      
                      return (
                        <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-600">#{index + 1}</span>
                            </div>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={agent.avatar} />
                              <AvatarFallback className="text-xs">
                                {agent.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{agent.name.split(' ')[0]}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{totalActivities}</div>
                            <div className="text-xs text-gray-600">
                              {agent.activitiesPerDeal.toFixed(1)} per deal
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMetrics.monthlyPerformance.map((month) => (
                  <div key={month.month} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="font-medium">
                      {format(new Date(month.month), 'MMM yyyy')}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-green-600">{formatCurrency(month.revenue)}</div>
                        <div className="text-gray-600">Revenue</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-blue-600">{month.deals}</div>
                        <div className="text-gray-600">Deals</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-purple-600">{month.activities}</div>
                        <div className="text-gray-600">Activities</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-orange-600">{formatPercent(month.winRate)}</div>
                        <div className="text-gray-600">Win Rate</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Source Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMetrics.leadSources.map((source) => (
                  <div key={source.source} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{source.source}</div>
                      <div className="text-sm text-gray-600">
                        {source.leads} leads • {source.conversions} conversions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{formatCurrency(source.revenue)}</div>
                      <div className="text-sm text-gray-600">
                        {formatPercent(source.conversionRate)} conversion
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

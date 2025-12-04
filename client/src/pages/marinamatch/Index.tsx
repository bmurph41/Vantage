import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Target, Users, TrendingUp, Rss, FileText, BarChart3, Radar, Goal, Settings2 } from "lucide-react";
import { DealSourcesTab } from "./DealSources";
import { MandatesTab } from "./Mandates";
import { DealTrackerTab } from "./DealTracker";
import { BrokersTab } from "./Brokers";
import { MarketIntelTab } from "./MarketIntel";
import { InvestmentCriteriaTab } from "./InvestmentCriteria";
import { GoalsDashboard } from "./GoalsDashboard";

export default function MarinaMatchIndex() {
  const [location, setLocation] = useLocation();
  
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const validTabs = ["overview", "sources", "mandates", "deals", "brokers", "listings", "criteria", "goals"];
    return tab && validTabs.includes(tab) ? tab : "overview";
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location]);
  
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (newTab === "overview") {
      setLocation("/marinamatch");
    } else {
      setLocation(`/marinamatch?tab=${newTab}`);
    }
  };
  
  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    totalDeals: number;
    statusBreakdown: Record<string, number>;
    activeSources: number;
    totalSources: number;
    activeMandates: number;
    highScoreDeals: number;
    conversionRate: string | number;
    topBrokers: any[];
  }>({
    queryKey: ["/api/marinamatch/analytics/overview"],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-marinamatch">
                MarinaMatch Deal Sourcing
              </h1>
              <p className="text-muted-foreground">
                Institutional-grade deal flow management with automated scoring
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap justify-start gap-1">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-background"
              data-testid="tab-overview"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="sources" 
              className="data-[state=active]:bg-background"
              data-testid="tab-sources"
            >
              <Rss className="h-4 w-4 mr-2" />
              Deal Sources
            </TabsTrigger>
            <TabsTrigger 
              value="mandates" 
              className="data-[state=active]:bg-background"
              data-testid="tab-mandates"
            >
              <Target className="h-4 w-4 mr-2" />
              Investment Mandates
            </TabsTrigger>
            <TabsTrigger 
              value="deals" 
              className="data-[state=active]:bg-background"
              data-testid="tab-deals"
            >
              <FileText className="h-4 w-4 mr-2" />
              Deal Queue
            </TabsTrigger>
            <TabsTrigger 
              value="brokers" 
              className="data-[state=active]:bg-background"
              data-testid="tab-brokers"
            >
              <Users className="h-4 w-4 mr-2" />
              Broker Network
            </TabsTrigger>
            <TabsTrigger 
              value="listings" 
              className="data-[state=active]:bg-background"
              data-testid="tab-listings"
            >
              <Radar className="h-4 w-4 mr-2" />
              Available Listings
            </TabsTrigger>
            <TabsTrigger 
              value="criteria" 
              className="data-[state=active]:bg-background"
              data-testid="tab-criteria"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Investment Criteria
            </TabsTrigger>
            <TabsTrigger 
              value="goals" 
              className="data-[state=active]:bg-background"
              data-testid="tab-goals"
            >
              <Goal className="h-4 w-4 mr-2" />
              Goals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription>Total Sourced Deals</CardDescription>
                  <CardTitle className="text-3xl" data-testid="stat-total-deals">
                    {analyticsLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      analytics?.totalDeals || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {analytics?.statusBreakdown && Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                      <Badge key={status} variant="secondary" className="text-xs">
                        {status}: {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardDescription>Active Sources</CardDescription>
                  <CardTitle className="text-3xl" data-testid="stat-active-sources">
                    {analyticsLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      `${analytics?.activeSources || 0} / ${analytics?.totalSources || 0}`
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Broker feeds, marketplaces, and proprietary sources
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardDescription>Investment Mandates</CardDescription>
                  <CardTitle className="text-3xl" data-testid="stat-mandates">
                    {analyticsLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      analytics?.activeMandates || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Active investment criteria profiles
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardDescription>High-Score Matches</CardDescription>
                  <CardTitle className="text-3xl" data-testid="stat-high-score">
                    {analyticsLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      analytics?.highScoreDeals || 0
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Deals scoring 70%+ against mandates
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Conversion Funnel
                  </CardTitle>
                  <CardDescription>
                    Deal progression from sourcing to CRM conversion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-4/5" />
                      <Skeleton className="h-8 w-3/5" />
                      <Skeleton className="h-8 w-2/5" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <FunnelStep 
                        label="New Deals" 
                        count={analytics?.statusBreakdown?.new || 0}
                        total={analytics?.totalDeals || 1}
                        color="bg-blue-500"
                      />
                      <FunnelStep 
                        label="Under Review" 
                        count={analytics?.statusBreakdown?.under_review || 0}
                        total={analytics?.totalDeals || 1}
                        color="bg-yellow-500"
                      />
                      <FunnelStep 
                        label="Qualified" 
                        count={analytics?.statusBreakdown?.qualified || 0}
                        total={analytics?.totalDeals || 1}
                        color="bg-green-500"
                      />
                      <FunnelStep 
                        label="Converted to CRM" 
                        count={analytics?.statusBreakdown?.converted || 0}
                        total={analytics?.totalDeals || 1}
                        color="bg-primary"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Performing Brokers
                  </CardTitle>
                  <CardDescription>
                    Brokers ranked by deal conversion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-32 mb-1" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                          <Skeleton className="h-6 w-12" />
                        </div>
                      ))}
                    </div>
                  ) : analytics?.topBrokers?.length ? (
                    <div className="space-y-3">
                      {analytics.topBrokers.map((broker, idx) => (
                        <div key={broker.id} className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{broker.contactName}</p>
                            <p className="text-sm text-muted-foreground">{broker.company}</p>
                          </div>
                          <Badge variant="secondary">
                            {broker.totalDealsConverted} deals
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-6">
                      No broker data available yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sources">
            <DealSourcesTab />
          </TabsContent>

          <TabsContent value="mandates">
            <MandatesTab />
          </TabsContent>

          <TabsContent value="deals">
            <DealTrackerTab />
          </TabsContent>

          <TabsContent value="brokers">
            <BrokersTab />
          </TabsContent>

          <TabsContent value="listings">
            <MarketIntelTab />
          </TabsContent>

          <TabsContent value="criteria">
            <InvestmentCriteriaTab />
          </TabsContent>

          <TabsContent value="goals">
            <GoalsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FunnelStep({ 
  label, 
  count, 
  total, 
  color 
}: { 
  label: string; 
  count: number; 
  total: number; 
  color: string; 
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
    </div>
  );
}

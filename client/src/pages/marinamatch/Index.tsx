import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Target, Users, TrendingUp, Rss, FileText, BarChart3, Radar, Goal, Settings2, Briefcase, MessageSquareWarning, Zap, Globe } from "lucide-react";
import { DealSourcesTab } from "./DealSources";
import { MandatesTab } from "./Mandates";
import { DealTrackerTab } from "./DealTracker";
import { BrokersTab } from "./Brokers";
import { MarketIntelTab } from "./MarketIntel";
import { InvestmentCriteriaTab } from "./InvestmentCriteria";
import { GoalsDashboard } from "./GoalsDashboard";
import { FeedbackAdminTab } from "./FeedbackAdmin";
import MarketplaceListings from "./MarketplaceListings";
import { WorkflowAutomation } from "./WorkflowAutomation";

function ConsolidatedInvestmentCriteria() {
  const [subTab, setSubTab] = useState("mandates");
  
  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="mandates" className="data-[state=active]:bg-background" data-testid="subtab-mandates">
            <Target className="h-4 w-4 mr-2" />
            Investment Mandates
          </TabsTrigger>
          <TabsTrigger value="scoring" className="data-[state=active]:bg-background" data-testid="subtab-scoring">
            <Settings2 className="h-4 w-4 mr-2" />
            Scoring Criteria
          </TabsTrigger>
          <TabsTrigger value="goals" className="data-[state=active]:bg-background" data-testid="subtab-goals">
            <Goal className="h-4 w-4 mr-2" />
            Goals
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="mandates" className="mt-4">
          <MandatesTab />
        </TabsContent>
        
        <TabsContent value="scoring" className="mt-4">
          <InvestmentCriteriaTab />
        </TabsContent>
        
        <TabsContent value="goals" className="mt-4">
          <GoalsDashboard />
        </TabsContent>
      </Tabs>
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

function PipelineSnapshot() {
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
    queryKey: ["/api/vantage/analytics/overview"],
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">Total Deals</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-total-deals">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                analytics?.totalDeals || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">Active Sources</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-active-sources">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                `${analytics?.activeSources || 0}/${analytics?.totalSources || 0}`
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">Mandates</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-mandates">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                analytics?.activeMandates || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">High-Score</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-high-score">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                analytics?.highScoreDeals || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {analyticsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-3/5" />
              </div>
            ) : (
              <div className="space-y-2">
                <FunnelStep 
                  label="New" 
                  count={analytics?.statusBreakdown?.new || 0}
                  total={analytics?.totalDeals || 1}
                  color="bg-blue-500"
                />
                <FunnelStep 
                  label="Review" 
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
                  label="Converted" 
                  count={analytics?.statusBreakdown?.converted || 0}
                  total={analytics?.totalDeals || 1}
                  color="bg-primary"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Brokers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {analyticsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : analytics?.topBrokers?.length ? (
              <div className="space-y-2">
                {analytics.topBrokers.slice(0, 3).map((broker, idx) => (
                  <div key={broker.id} className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </div>
                    <span className="text-sm truncate flex-1">{broker.contactName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {broker.totalDealsConverted}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-2">
                No broker data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DealManagement() {
  const [subTab, setSubTab] = useState("queue");
  
  return (
    <div className="space-y-6">
      <PipelineSnapshot />
      
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="queue" className="data-[state=active]:bg-background" data-testid="subtab-queue">
            <FileText className="h-4 w-4 mr-2" />
            Deal Queue
          </TabsTrigger>
          <TabsTrigger value="sources" className="data-[state=active]:bg-background" data-testid="subtab-sources">
            <Rss className="h-4 w-4 mr-2" />
            Deal Sources
          </TabsTrigger>
          <TabsTrigger value="brokers" className="data-[state=active]:bg-background" data-testid="subtab-brokers">
            <Users className="h-4 w-4 mr-2" />
            Broker Network
          </TabsTrigger>
          <TabsTrigger value="automation" className="data-[state=active]:bg-background" data-testid="subtab-automation">
            <Zap className="h-4 w-4 mr-2" />
            Automation
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="queue" className="mt-4">
          <DealTrackerTab />
        </TabsContent>
        
        <TabsContent value="sources" className="mt-4">
          <DealSourcesTab />
        </TabsContent>
        
        <TabsContent value="brokers" className="mt-4">
          <BrokersTab />
        </TabsContent>
        <TabsContent value="automation" className="mt-4">
          <WorkflowAutomation />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListingsSection({ onNavigateToBrokers }: { onNavigateToBrokers: () => void }) {
  const [subTab, setSubTab] = useState("intel");
  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="intel" className="data-[state=active]:bg-background">
            <Radar className="h-4 w-4 mr-2" />
            Market Intel
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="data-[state=active]:bg-background">
            <Globe className="h-4 w-4 mr-2" />
            Live Marketplace
          </TabsTrigger>
        </TabsList>
        <TabsContent value="intel" className="mt-4">
          <MarketIntelTab onNavigateToBrokers={onNavigateToBrokers} />
        </TabsContent>
        <TabsContent value="marketplace" className="mt-0">
          <div className="h-[calc(100dvh-220px)]">
            <MarketplaceListings />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function VantageIndex() {
  const [location, setLocation] = useLocation();
  
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const validTabs = ["listings", "criteria", "deals", "feedback"];
    return tab && validTabs.includes(tab) ? tab : "listings";
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location]);
  
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (newTab === "listings") {
      setLocation("/vantage");
    } else {
      setLocation(`/vantage?tab=${newTab}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-vantage">
                Vantage Intel
              </h1>
              <p className="text-muted-foreground">
                AI-powered marina acquisition platform
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap justify-start gap-1">
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
              <Target className="h-4 w-4 mr-2" />
              Investment Criteria
            </TabsTrigger>
            <TabsTrigger 
              value="deals" 
              className="data-[state=active]:bg-background"
              data-testid="tab-deals"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Deal Management
            </TabsTrigger>
            <TabsTrigger 
              value="feedback" 
              className="data-[state=active]:bg-background"
              data-testid="tab-feedback"
            >
              <MessageSquareWarning className="h-4 w-4 mr-2" />
              Feedback Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            <ListingsSection onNavigateToBrokers={() => handleTabChange("deals")} />
          </TabsContent>

          <TabsContent value="criteria">
            <ConsolidatedInvestmentCriteria />
          </TabsContent>

          <TabsContent value="deals">
            <DealManagement />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackAdminTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

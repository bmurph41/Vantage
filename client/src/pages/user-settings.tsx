import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, User, Mail, Calendar, HelpCircle, RotateCcw, Play, CheckCircle2, Shield, Info } from "lucide-react";
import { useLocation } from "wouter";
import { EmailManagement } from "@/components/email-management";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TOUR_IDS } from "@/lib/tour-configs";

const TOUR_INFO = [
  { id: TOUR_IDS.DASHBOARD, name: "Dashboard", description: "Overview of your marina acquisitions", route: "/" },
  { id: TOUR_IDS.DEALS, name: "CRM Deals", description: "Manage your deal pipeline", route: "/deals" },
  { id: TOUR_IDS.DOCKTALK, name: "DockTalk", description: "M&A intelligence feed", route: "/docktalk" },
  { id: TOUR_IDS.FUEL_SALES, name: "Fuel Sales", description: "Track fuel operations", route: "/operations/fuel" },
  { id: TOUR_IDS.SHIP_STORE, name: "Ship Store", description: "Retail inventory tracking", route: "/operations/ship-store" },
  { id: TOUR_IDS.COMMERCIAL_TENANTS, name: "Commercial Tenants", description: "Lease management", route: "/operations/commercial-tenants" },
  { id: TOUR_IDS.VDR, name: "Virtual Data Room", description: "Secure document storage", route: "/vdr" },
  { id: TOUR_IDS.RENT_ROLL, name: "Rent Roll", description: "Marina lease tracking", route: "/operations/rent-roll" },
  { id: TOUR_IDS.VALUATOR, name: "Financial Model", description: "Financial modeling", route: "/modeling" },
  { id: TOUR_IDS.SALES_COMPS, name: "Sales Comps", description: "Comparable sales analysis", route: "/analysis/sales-comps" },
];

const VIDEO_PLACEHOLDERS = [
  { title: "Getting Started with MarinaMatch", description: "Learn the basics of navigating the platform", duration: "5 min" },
  { title: "CRM & Deal Management", description: "How to manage your acquisition pipeline", duration: "8 min" },
  { title: "Rent Roll Deep Dive", description: "Advanced rent roll features and reporting", duration: "12 min" },
  { title: "Financial Modeling", description: "Building accurate marina valuations", duration: "15 min" },
];

export default function UserSettingsPage() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("emails");
  const { toast } = useToast();

  // Fetch user emails
  const { data: userEmails = [], isLoading: isLoadingEmails } = useQuery({
    queryKey: ['/api/user/emails'],
  });

  // Fetch tour progress
  const { data: tourProgress } = useQuery<{ tours: Record<string, boolean> }>({
    queryKey: ['/api/tour-progress'],
  });

  const completedTours = tourProgress?.tours || {};

  // Fetch benchmarking settings
  const { data: benchmarkingSettings, isLoading: isLoadingBenchmarking } = useQuery<{
    benchmarkingOptOut: boolean;
    optOutTimestamp: string | null;
    dataBenchmarkingConsent: boolean;
    consentTimestamp: string | null;
    consentVersion: string | null;
  }>({
    queryKey: ['/api/auth/account/benchmarking'],
  });

  // Update benchmarking settings mutation
  const updateBenchmarkingMutation = useMutation({
    mutationFn: async (benchmarkingOptOut: boolean) => {
      const response = await apiRequest("PATCH", "/api/auth/account/benchmarking", { benchmarkingOptOut });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/account/benchmarking'] });
      toast({ 
        title: "Settings updated", 
        description: "Your privacy preferences have been saved." 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to update privacy settings. Please try again.",
        variant: "destructive"
      });
    },
  });

  // Reset single tour mutation
  const resetTourMutation = useMutation({
    mutationFn: async (tourId: string) => {
      await apiRequest("DELETE", `/api/tour-progress/${tourId}`);
    },
    onSuccess: (_, tourId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tour-progress'] });
      toast({ title: "Tour reset", description: "You'll see this tour again when you visit the page." });
    },
  });

  // Reset all tours mutation
  const resetAllToursMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/tour-progress");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tour-progress'] });
      toast({ title: "All tours reset", description: "Page tours will show again when you visit each page." });
    },
  });

  const typedEmails = Array.isArray(userEmails) ? userEmails : [];

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="flex h-16 items-center gap-4 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground" data-testid="text-page-title">
              User Settings
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-description">
              Manage your account preferences and calendar integration settings
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5" data-testid="tabs-user-settings">
            <TabsTrigger value="emails" className="gap-2" data-testid="tab-emails">
              <Mail className="h-4 w-4" />
              Email Management
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2" data-testid="tab-calendar">
              <Calendar className="h-4 w-4" />
              Calendar Settings
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="tours" className="gap-2" data-testid="tab-tours">
              <HelpCircle className="h-4 w-4" />
              Tours & Help
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2" data-testid="tab-privacy">
              <Shield className="h-4 w-4" />
              Privacy & Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="space-y-6">
            <Card data-testid="card-email-management">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid="text-email-title">
                      <Mail className="h-5 w-5" />
                      Email Management
                    </CardTitle>
                    <CardDescription data-testid="text-email-description">
                      Manage your email addresses for calendar sync and notifications
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" data-testid="badge-email-count">
                    {typedEmails.length} email{typedEmails.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <EmailManagement emails={typedEmails} isLoading={isLoadingEmails} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <Card data-testid="card-calendar-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="text-calendar-title">
                  <Calendar className="h-5 w-5" />
                  Calendar Integration Settings
                </CardTitle>
                <CardDescription data-testid="text-calendar-description">
                  Configure your default calendar provider and sync preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Default Calendar Provider</h4>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred calendar service for sync operations
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Auto-Sync Settings</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure automatic calendar synchronization preferences
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card data-testid="card-profile-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="text-profile-title">
                  <User className="h-5 w-5" />
                  Profile Settings
                </CardTitle>
                <CardDescription data-testid="text-profile-description">
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Account Information</h4>
                      <p className="text-sm text-muted-foreground">
                        Update your name, timezone, and other account details
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Notification Preferences</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure global notification settings
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tours" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      Page Tours
                    </CardTitle>
                    <CardDescription>
                      Interactive guides that walk you through each page's features
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetAllToursMutation.mutate()}
                    disabled={resetAllToursMutation.isPending}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset All Tours
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {TOUR_INFO.map((tour) => {
                    const isCompleted = completedTours[tour.id];
                    return (
                      <div
                        key={tour.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          <div>
                            <h4 className="font-medium text-foreground">{tour.name}</h4>
                            <p className="text-sm text-muted-foreground">{tour.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetTourMutation.mutate(tour.id)}
                              disabled={resetTourMutation.isPending}
                              className="gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (isCompleted) {
                                resetTourMutation.mutate(tour.id);
                              }
                              setLocation(tour.route);
                            }}
                            className="gap-1"
                          >
                            <Play className="h-3 w-3" />
                            {isCompleted ? "Replay" : "Start"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Video Tutorials
                </CardTitle>
                <CardDescription>
                  In-depth video guides for platform features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {VIDEO_PLACEHOLDERS.map((video, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/30"
                    >
                      <div className="flex-shrink-0 w-16 h-12 bg-muted rounded flex items-center justify-center">
                        <Play className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{video.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{video.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{video.duration}</Badge>
                          <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card data-testid="card-privacy-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="text-privacy-title">
                  <Shield className="h-5 w-5" />
                  Privacy & Data
                </CardTitle>
                <CardDescription data-testid="text-privacy-description">
                  Manage how your data is used for industry benchmarks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-start justify-between p-4 border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">Contribute to anonymized industry benchmarks</h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Anonymized benchmarking means your data is combined with many others and cannot be traced back to your marina.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        This helps improve industry analytics for all MarinaMatch users. Your marina's identity is never disclosed. You can opt out at any time.
                      </p>
                      {benchmarkingSettings?.optOutTimestamp && benchmarkingSettings.benchmarkingOptOut && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Opted out on {new Date(benchmarkingSettings.optOutTimestamp).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={!benchmarkingSettings?.benchmarkingOptOut}
                      onCheckedChange={(checked) => updateBenchmarkingMutation.mutate(!checked)}
                      disabled={isLoadingBenchmarking || updateBenchmarkingMutation.isPending}
                      data-testid="switch-benchmarking"
                    />
                  </div>

                  {benchmarkingSettings?.dataBenchmarkingConsent && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-foreground text-sm">Consent Information</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        You agreed to the Data Use & Anonymized Benchmarking Terms
                        {benchmarkingSettings.consentTimestamp && (
                          <> on {new Date(benchmarkingSettings.consentTimestamp).toLocaleDateString()}</>
                        )}
                        {benchmarkingSettings.consentVersion && (
                          <> (Version: {benchmarkingSettings.consentVersion})</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
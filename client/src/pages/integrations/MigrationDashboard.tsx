import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, CheckCircle2, Circle, AlertTriangle, ArrowRight, 
  Database, RefreshCw, Settings, Zap, Archive, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIntegrations, type IntegrationItem } from "@/lib/api/integrations";

interface MigrationPhase {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const MIGRATION_PHASES: MigrationPhase[] = [
  {
    id: "connect",
    name: "Connect & Sync",
    description: "Initial connection established, data importing",
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: "dual_write",
    name: "Dual-Write Mode",
    description: "Data syncing both directions, staff training",
    icon: <RefreshCw className="w-4 h-4" />,
  },
  {
    id: "cutover",
    name: "Cutover Ready",
    description: "All data validated, ready to switch primary system",
    icon: <Settings className="w-4 h-4" />,
  },
  {
    id: "archive",
    name: "Archive Legacy",
    description: "Legacy system archived, MarinaMatch is primary",
    icon: <Archive className="w-4 h-4" />,
  },
];

function getPhaseIndex(status: string): number {
  if (status === "connected") return 0;
  return -1;
}

function getPhaseProgress(integration: IntegrationItem): number {
  if (integration.status !== "connected") return 0;
  const phase = getPhaseIndex(integration.status);
  return ((phase + 1) / MIGRATION_PHASES.length) * 100;
}

function getMigrationChecklist(integration: IntegrationItem) {
  const isConnected = integration.status === "connected";
  return [
    { label: "Integration connected", done: isConnected },
    { label: "Initial data sync completed", done: isConnected },
    { label: "Data mappings configured", done: isConnected },
    { label: "Staff trained on dual-entry", done: false },
    { label: "30-day parallel run completed", done: false },
    { label: "Data validation passed", done: false },
    { label: "Legacy system read-only", done: false },
    { label: "Full cutover complete", done: false },
  ];
}

export default function MigrationDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: fetchIntegrations,
  });

  const integrations = data?.items || [];
  const connectedIntegrations = integrations.filter((i) => i.status === "connected");
  const availableIntegrations = integrations.filter((i) => i.status !== "connected");
  
  const totalProgress = connectedIntegrations.length > 0
    ? connectedIntegrations.reduce((sum, i) => sum + getPhaseProgress(i), 0) / connectedIntegrations.length
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/settings/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Integrations
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Migration Readiness Dashboard</h1>
        <p className="text-muted-foreground">
          Track your progress migrating from legacy marina software to MarinaMatch as your primary system.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#1E4FAB]" />
              Overall Migration Progress
            </CardTitle>
            <CardDescription>
              {connectedIntegrations.length} of {integrations?.length || 0} integrations connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Readiness</span>
                <span className="font-medium">{Math.round(totalProgress)}%</span>
              </div>
              <Progress value={totalProgress} className="h-3" />
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-6">
                {MIGRATION_PHASES.map((phase, idx) => (
                  <div
                    key={phase.id}
                    className={`text-center p-3 rounded-lg border transition-colors ${
                      idx === 0 && connectedIntegrations.length > 0
                        ? "bg-[#1E4FAB]/10 border-[#1E4FAB] text-[#1E4FAB]"
                        : "bg-muted/50 border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex justify-center mb-2">{phase.icon}</div>
                    <p className="text-xs font-medium">{phase.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connected</span>
              <Badge variant="default" className="bg-green-600">
                {connectedIntegrations.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available</span>
              <Badge variant="secondary">{availableIntegrations.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Integrations</span>
              <Badge variant="outline">{integrations?.length || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {connectedIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Connected Integrations</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {connectedIntegrations.map((integration) => {
              const checklist = getMigrationChecklist(integration);
              const completedCount = checklist.filter((c) => c.done).length;
              const progress = (completedCount / checklist.length) * 100;

              return (
                <Card key={integration.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: integration.logoColor || "#1E4FAB" }}
                        >
                          {integration.name.slice(0, 2).toUpperCase()}
                        </div>
                        {integration.name}
                      </CardTitle>
                      <Badge className="bg-green-100 text-green-800">Connected</Badge>
                    </div>
                    <CardDescription>{integration.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Migration Progress</span>
                        <span className="font-medium">{completedCount}/{checklist.length}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      
                      <div className="space-y-1.5 mt-3">
                        {checklist.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {item.done ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                        {checklist.length > 4 && (
                          <p className="text-xs text-muted-foreground pl-6">
                            +{checklist.length - 4} more steps
                          </p>
                        )}
                      </div>

                      <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setLocation(`/settings/integrations/${integration.key}`)}>
                        View Details
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {connectedIntegrations.length === 0 && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h3 className="text-lg font-semibold mb-2">No Integrations Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your first integration to start tracking migration progress.
            </p>
            <Button onClick={() => setLocation("/settings/integrations")}>
              Browse Integrations
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Migration Phases Explained</CardTitle>
          <CardDescription>
            Our 4-phase migration process ensures a smooth transition with zero data loss
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {MIGRATION_PHASES.map((phase, idx) => (
              <div key={phase.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-[#1E4FAB]/10 flex items-center justify-center text-[#1E4FAB]">
                    {phase.icon}
                  </div>
                  {idx < MIGRATION_PHASES.length - 1 && (
                    <div className="w-px h-full bg-border my-2" />
                  )}
                </div>
                <div className="pb-6">
                  <h4 className="font-medium mb-1">Phase {idx + 1}: {phase.name}</h4>
                  <p className="text-sm text-muted-foreground">{phase.description}</p>
                  {idx === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Duration: Typically 1-2 weeks depending on data volume
                    </p>
                  )}
                  {idx === 1 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Duration: 30-60 days recommended for staff transition
                    </p>
                  )}
                  {idx === 2 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Duration: 1-2 weeks for final validation and sign-off
                    </p>
                  )}
                  {idx === 3 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Duration: Ongoing - legacy system can be maintained read-only for reference
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

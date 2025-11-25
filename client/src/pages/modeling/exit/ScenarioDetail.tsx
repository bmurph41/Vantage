import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Calculator, 
  DollarSign, 
  RefreshCcw, 
  Landmark,
  HandCoins,
  Award,
  BarChart3,
  Percent,
  TrendingUp,
  Settings,
  ChevronRight
} from "lucide-react";
import type { ModelingProject, ExitScenario } from "@shared/schema";

interface ScenarioDetailProps {
  projectId: string;
  scenarioId: string;
}

export default function ExitScenarioDetail({ projectId, scenarioId }: ScenarioDetailProps) {
  const [, setLocation] = useLocation();

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: scenario, isLoading } = useQuery<ExitScenario>({
    queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios', scenarioId],
    enabled: !!scenarioId,
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const tools = [
    { id: "tax", name: "Tax Calculator", icon: Calculator, path: `/tax?scenario=${scenarioId}` },
    { id: "net-proceeds", name: "Net Proceeds", icon: DollarSign, path: `/net-proceeds?scenario=${scenarioId}` },
    { id: "1031", name: "1031 Exchange", icon: RefreshCcw, path: `/1031?scenario=${scenarioId}` },
    { id: "dst", name: "DST Analysis", icon: Landmark, path: `/dst?scenario=${scenarioId}` },
    { id: "seller-financing", name: "Seller Financing", icon: HandCoins, path: `/seller-financing?scenario=${scenarioId}` },
    { id: "earnout", name: "Earnout", icon: Award, path: `/earnout?scenario=${scenarioId}` },
    { id: "waterfall", name: "Waterfall", icon: BarChart3, path: `/waterfall?scenario=${scenarioId}` },
    { id: "irr", name: "IRR Calculator", icon: Percent, path: `/irr?scenario=${scenarioId}` },
    { id: "sensitivity", name: "Sensitivity", icon: TrendingUp, path: `/sensitivity?scenario=${scenarioId}` },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="p-6">
        <Card className="py-12">
          <CardContent className="text-center">
            <h3 className="text-lg font-semibold mb-2">Scenario Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The requested exit scenario could not be found.
            </p>
            <Button onClick={() => setLocation(`${basePath}/scenarios`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scenarios
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button 
              onClick={() => setLocation(basePath)}
              className="hover:text-primary transition-colors"
            >
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <button 
              onClick={() => setLocation(`${basePath}/scenarios`)}
              className="hover:text-primary transition-colors"
            >
              Scenarios
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{scenario.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold" data-testid="scenario-detail-title">{scenario.name}</h1>
            <Badge variant={scenario.status === 'active' ? 'default' : 'secondary'}>
              {scenario.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {scenario.description || 'Exit scenario for ' + project?.propertyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setLocation(`${basePath}/scenarios`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-edit-scenario">
            <Settings className="h-4 w-4 mr-2" />
            Edit Scenario
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Exit Year</div>
            <div className="text-2xl font-bold" data-testid="text-exit-year">
              {scenario.exitYear || 'TBD'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Exit Cap Rate</div>
            <div className="text-2xl font-bold" data-testid="text-exit-cap-rate">
              {scenario.exitCapRate ? `${scenario.exitCapRate}%` : 'TBD'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Exit Price</div>
            <div className="text-2xl font-bold" data-testid="text-exit-price">
              {scenario.exitPrice ? `$${Number(scenario.exitPrice).toLocaleString()}` : 'TBD'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Holding Period</div>
            <div className="text-2xl font-bold" data-testid="text-holding-period">
              {scenario.holdingPeriodYears ? `${scenario.holdingPeriodYears} Years` : 'TBD'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis Tools</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scenario Summary</CardTitle>
              <CardDescription>
                Key assumptions and projected outcomes for this exit scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground">Purchase Price</div>
                  <div className="text-lg font-semibold">
                    ${Number(project?.purchasePrice || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Projected Exit Price</div>
                  <div className="text-lg font-semibold">
                    {scenario.exitPrice ? `$${Number(scenario.exitPrice).toLocaleString()}` : 'Calculate'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Gross Profit</div>
                  <div className="text-lg font-semibold text-green-600">
                    {scenario.exitPrice 
                      ? `$${(Number(scenario.exitPrice) - Number(project?.purchasePrice || 0)).toLocaleString()}`
                      : 'Calculate'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Entry Cap Rate</div>
                  <div className="text-lg font-semibold">
                    {project?.year1CapRate ? `${project.year1CapRate}%` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Exit Cap Rate</div>
                  <div className="text-lg font-semibold">
                    {scenario.exitCapRate ? `${scenario.exitCapRate}%` : 'TBD'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Cap Rate Spread</div>
                  <div className="text-lg font-semibold">
                    {scenario.exitCapRate && project?.year1CapRate 
                      ? `${(Number(project.year1CapRate) - Number(scenario.exitCapRate)).toFixed(2)}%`
                      : 'TBD'
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Tools</CardTitle>
              <CardDescription>
                Run detailed analyses for this exit scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tools.map((tool) => (
                  <Button
                    key={tool.id}
                    variant="outline"
                    className="h-auto p-4 justify-start"
                    onClick={() => setLocation(`${basePath}${tool.path}`)}
                    data-testid={`btn-tool-${tool.id}`}
                  >
                    <tool.icon className="h-5 w-5 mr-3" />
                    <span>{tool.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scenario Settings</CardTitle>
              <CardDescription>
                Configure assumptions and parameters for this scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Scenario configuration options will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

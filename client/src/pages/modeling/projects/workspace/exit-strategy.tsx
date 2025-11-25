import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calculator, 
  TrendingUp, 
  Building2, 
  FileSpreadsheet,
  ArrowRight,
  Plus,
  DollarSign,
  Percent,
  BarChart3,
  Brain,
  RefreshCcw,
  Landmark,
  HandCoins,
  Award,
  ExternalLink
} from "lucide-react";
import type { ModelingProject, ExitScenario } from "@shared/schema";

interface WorkspaceExitStrategyProps {
  projectId: string;
}

const exitTools = [
  { 
    id: "tax", 
    name: "Tax Calculator", 
    description: "Capital gains & depreciation recapture analysis", 
    icon: Calculator,
    path: "/tax",
    color: "text-red-500",
    bgColor: "bg-red-50"
  },
  { 
    id: "net-proceeds", 
    name: "Net Proceeds", 
    description: "Cash-on-cash analysis at exit", 
    icon: DollarSign,
    path: "/net-proceeds",
    color: "text-green-500",
    bgColor: "bg-green-50"
  },
  { 
    id: "1031", 
    name: "1031 Exchange", 
    description: "Like-kind exchange planning", 
    icon: RefreshCcw,
    path: "/1031",
    color: "text-blue-500",
    bgColor: "bg-blue-50"
  },
  { 
    id: "dst", 
    name: "DST Analysis", 
    description: "Delaware Statutory Trust modeling", 
    icon: Landmark,
    path: "/dst",
    color: "text-purple-500",
    bgColor: "bg-purple-50"
  },
  { 
    id: "seller-financing", 
    name: "Seller Financing", 
    description: "Installment sale modeling", 
    icon: HandCoins,
    path: "/seller-financing",
    color: "text-amber-500",
    bgColor: "bg-amber-50"
  },
  { 
    id: "earnout", 
    name: "Earnout Modeling", 
    description: "Contingent payment structures", 
    icon: Award,
    path: "/earnout",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50"
  },
  { 
    id: "waterfall", 
    name: "Waterfall Analysis", 
    description: "Fund distribution modeling", 
    icon: BarChart3,
    path: "/waterfall",
    color: "text-cyan-500",
    bgColor: "bg-cyan-50"
  },
  { 
    id: "irr", 
    name: "IRR Calculator", 
    description: "Multi-period return analysis", 
    icon: Percent,
    path: "/irr",
    color: "text-emerald-500",
    bgColor: "bg-emerald-50"
  },
  { 
    id: "sensitivity", 
    name: "Sensitivity Analysis", 
    description: "What-if scenario explorer", 
    icon: TrendingUp,
    path: "/sensitivity",
    color: "text-orange-500",
    bgColor: "bg-orange-50"
  },
  { 
    id: "ai-insights", 
    name: "AI Insights", 
    description: "AI-powered exit recommendations", 
    icon: Brain,
    path: "/ai-insights",
    color: "text-pink-500",
    bgColor: "bg-pink-50"
  },
];

export default function WorkspaceExitStrategy({ projectId }: WorkspaceExitStrategyProps) {
  const [, navigate] = useLocation();
  
  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery<ExitScenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios'],
    enabled: !!projectId,
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" data-testid="exit-strategy-title">Exit Strategy Suite</h2>
          <p className="text-sm text-muted-foreground">
            Institutional-grade exit analysis tools for {project?.marinaName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(basePath)}
            data-testid="button-full-exit-suite"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Full Suite View
          </Button>
          <Button 
            onClick={() => navigate(`${basePath}/scenarios`)}
            data-testid="button-manage-exit-scenarios"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Manage Scenarios
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Property Value</p>
                <p className="text-lg font-bold" data-testid="text-exit-property-value">
                  ${(Number(project?.purchasePrice) || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit Scenarios</p>
                <p className="text-lg font-bold" data-testid="text-exit-scenario-count">
                  {scenarios.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Percent className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cap Rate</p>
                <p className="text-lg font-bold" data-testid="text-exit-cap-rate">
                  {project?.year1CapRate ? `${project.year1CapRate}%` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EBITDA</p>
                <p className="text-lg font-bold" data-testid="text-exit-ebitda">
                  ${(Number(project?.ebitda) || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exit Analysis Tools</CardTitle>
              <CardDescription>
                Professional-grade tools for comprehensive exit planning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exitTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => navigate(`${basePath}${tool.path}`)}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left group"
                    data-testid={`button-exit-tool-${tool.id}`}
                  >
                    <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                      <tool.icon className={`h-4 w-4 ${tool.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Recent Scenarios</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(`${basePath}/scenarios`)}
                data-testid="button-view-all-scenarios"
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {scenariosLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : scenarios.length === 0 ? (
                <div className="text-center py-6">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No exit scenarios yet
                  </p>
                  <Button 
                    size="sm"
                    onClick={() => navigate(`${basePath}/scenarios`)}
                    data-testid="button-create-exit-scenario"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Scenario
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {scenarios.slice(0, 4).map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => navigate(`${basePath}/scenarios/${scenario.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                      data-testid={`button-exit-scenario-${scenario.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{scenario.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Exit Year: {scenario.exitYear || 'TBD'}
                        </p>
                      </div>
                      <Badge variant={scenario.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {scenario.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => navigate(`${basePath}/scenarios`)}
                data-testid="button-quick-new-scenario"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Exit Scenario
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => navigate(`${basePath}/ai-insights`)}
                data-testid="button-quick-ai-analysis"
              >
                <Brain className="h-4 w-4 mr-2" />
                Run AI Analysis
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => navigate(`${basePath}/sensitivity`)}
                data-testid="button-quick-sensitivity"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Sensitivity Analysis
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => navigate(`${basePath}/irr`)}
                data-testid="button-quick-irr"
              >
                <Percent className="h-4 w-4 mr-2" />
                IRR Calculator
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

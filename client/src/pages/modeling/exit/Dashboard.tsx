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
  ChevronRight,
  GitCompare
} from "lucide-react";
import type { ModelingProject, ExitScenario } from "@shared/schema";

interface ExitDashboardProps {
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
  { 
    id: "compare", 
    name: "Compare Scenarios", 
    description: "Side-by-side scenario analysis", 
    icon: GitCompare,
    path: "/compare",
    color: "text-[#1E4FAB]",
    bgColor: "bg-[#1E4FAB]/10"
  },
];

export default function ExitStrategyDashboard({ projectId }: ExitDashboardProps) {
  const [, setLocation] = useLocation();
  
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Modeling</span>
            <ChevronRight className="h-4 w-4" />
            <span>{project?.propertyName || 'Project'}</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Exit Strategy Suite</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="exit-dashboard-title">Exit Strategy Suite</h1>
          <p className="text-muted-foreground mt-1">
            Institutional-grade exit analysis tools for {project?.propertyName}
          </p>
        </div>
        <Button 
          onClick={() => setLocation(`${basePath}/scenarios`)}
          data-testid="btn-manage-scenarios"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Manage Scenarios
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Property Value</p>
                <p className="text-2xl font-bold" data-testid="text-property-value">
                  ${(Number(project?.purchasePrice) || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exit Scenarios</p>
                <p className="text-2xl font-bold" data-testid="text-scenario-count">
                  {scenarios.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Percent className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cap Rate</p>
                <p className="text-2xl font-bold" data-testid="text-cap-rate">
                  {project?.year1CapRate ? `${project.year1CapRate}%` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">EBITDA</p>
                <p className="text-2xl font-bold" data-testid="text-ebitda">
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
              <CardTitle>Exit Analysis Tools</CardTitle>
              <CardDescription>
                Professional-grade tools for comprehensive exit planning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exitTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setLocation(`${basePath}${tool.path}`)}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors text-left group"
                    data-testid={`btn-tool-${tool.id}`}
                  >
                    <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                      <tool.icon className={`h-5 w-5 ${tool.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium group-hover:text-primary transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
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
                onClick={() => setLocation(`${basePath}/scenarios`)}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {scenariosLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
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
                    onClick={() => setLocation(`${basePath}/scenarios`)}
                    data-testid="btn-create-first-scenario"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Scenario
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {scenarios.slice(0, 5).map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => setLocation(`${basePath}/scenarios/${scenario.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                      data-testid={`btn-scenario-${scenario.id}`}
                    >
                      <div>
                        <p className="font-medium">{scenario.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Exit Year: {scenario.exitYear || 'TBD'}
                        </p>
                      </div>
                      <Badge variant={scenario.status === 'active' ? 'default' : 'secondary'}>
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
                className="w-full justify-start"
                onClick={() => setLocation(`${basePath}/scenarios`)}
                data-testid="btn-new-scenario"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Exit Scenario
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation(`${basePath}/ai-insights`)}
                data-testid="btn-ai-analysis"
              >
                <Brain className="h-4 w-4 mr-2" />
                Run AI Analysis
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation(`${basePath}/sensitivity`)}
                data-testid="btn-sensitivity"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Sensitivity Analysis
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

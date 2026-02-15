import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  Building2,
  Percent,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

interface ProjectSnapshot {
  indicatedValue: number | null;
  capRate: number | null;
  noi: number | null;
  ebitda: number | null;
  irr: number | null;
  equityMultiple: number | null;
  cashOnCash: number | null;
  grossRevenue: number | null;
  snapshotDate: string;
}

interface MonteCarloSummary {
  hasResults: boolean;
  probabilityOfLoss: number | null;
  valueAtRisk: number | null;
  irrMean: number | null;
  irrP5: number | null;
  irrP95: number | null;
  npvMean: number | null;
  sharpeRatio: number | null;
  iterations: number | null;
  lastCalculated: string | null;
  sensitivityTop: { variable: string; contribution: number; correlationToIRR: number }[];
}

interface ReturnsProject {
  id: string;
  marinaName: string;
  city: string | null;
  state: string | null;
  purchasePrice: number | null;
  year1CapRate: number | null;
  ebitda: number | null;
  totalStorageUnits: number | null;
  dealOutcome: string;
  updatedAt: string;
  t12Noi: number | null;
  snapshot: ProjectSnapshot | null;
  monteCarlo: MonteCarloSummary | null;
}

const formatMultiple = (val: number | null | undefined) => {
  if (val == null) return "—";
  return `${val.toFixed(2)}x`;
};

const outcomeColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  passed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const outcomeLabels: Record<string, string> = {
  active: "Active",
  under_review: "Under Review",
  won: "Won",
  passed: "Passed",
  lost: "Lost",
};

function SummaryCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: any;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReturnsValuationPage() {
  const [, setLocation] = useLocation();

  const { data: projects, isLoading } = useQuery<ReturnsProject[]>({
    queryKey: ["/api/modeling/returns-valuation"],
  });

  const activeProjects = projects?.filter((p) => p.dealOutcome === "active") || [];
  const totalPortfolioValue = projects?.reduce((sum, p) => {
    const val = p.snapshot?.indicatedValue ?? p.purchasePrice;
    return sum + (val ?? 0);
  }, 0) ?? 0;
  const toDisplayPct = (val: number) => Math.abs(val) < 1 ? val * 100 : val;
  const avgCapRate = (() => {
    const withCap = projects?.filter((p) => {
      const cap = p.snapshot?.capRate ?? p.year1CapRate;
      return cap != null && cap > 0;
    }) ?? [];
    if (withCap.length === 0) return null;
    const sum = withCap.reduce((s, p) => {
      const cap = p.snapshot?.capRate ?? p.year1CapRate ?? 0;
      return s + toDisplayPct(cap);
    }, 0);
    return sum / withCap.length;
  })();
  const avgIrr = (() => {
    const withIrr = projects?.filter((p) => p.snapshot?.irr != null) ?? [];
    if (withIrr.length === 0) return null;
    const sum = withIrr.reduce((s, p) => s + toDisplayPct(p.snapshot!.irr!), 0);
    return sum / withIrr.length;
  })();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Pipeline Returns
        </h1>
        <p className="text-muted-foreground mt-1">
          Key returns and valuation metrics across all Financial Model projects
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Projects"
          value={String(projects?.length ?? 0)}
          icon={Building2}
          subtitle={`${activeProjects.length} active`}
        />
        <SummaryCard
          title="Portfolio Value"
          value={formatCurrency(totalPortfolioValue || null, { dash: true })}
          icon={DollarSign}
          subtitle="Indicated or purchase price"
        />
        <SummaryCard
          title="Avg Cap Rate"
          value={avgCapRate != null ? `${avgCapRate.toFixed(2)}%` : "—"}
          icon={Percent}
        />
        <SummaryCard
          title="Avg IRR"
          value={avgIrr != null ? `${avgIrr.toFixed(2)}%` : "—"}
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Project Returns Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!projects || projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No Financial Model projects yet</p>
              <p className="text-sm mt-1">
                Create a project in Financial Model to see returns and valuation data here.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/modeling/projects/new")}
              >
                Create Project
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Marina</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Purchase Price</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        Indicated Value
                        <InfoTooltip 
                          content="The model's current valuation estimate based on NOI, cap rate, or DCF analysis from the latest snapshot. Unlike Purchase Price (what you paid or plan to pay), Indicated Value reflects what the property is worth today according to your financial model."
                          tip="When Indicated Value exceeds Purchase Price, it signals value creation in your portfolio."
                          side="bottom"
                        />
                      </span>
                    </TableHead>
                    <TableHead className="text-right">NOI</TableHead>
                    <TableHead className="text-right">Cap Rate</TableHead>
                    <TableHead className="text-right">IRR</TableHead>
                    <TableHead className="text-right">Equity Multiple</TableHead>
                    <TableHead className="text-right">Cash-on-Cash</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        MC Risk
                        <InfoTooltip
                          content="Monte Carlo simulation risk metrics: probability of negative NPV (loss), IRR confidence range (P5–P95), and Value at Risk. Run a simulation from the deal workspace to populate."
                          side="bottom"
                        />
                      </span>
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const capRate = project.snapshot?.capRate ?? project.year1CapRate;
                    const noi = project.snapshot?.noi ?? project.t12Noi;

                    return (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setLocation(`/modeling/projects/${project.id}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {project.marinaName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {[project.city, project.state]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              outcomeColors[project.dealOutcome] || ""
                            }
                          >
                            {outcomeLabels[project.dealOutcome] ||
                              project.dealOutcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(project.purchasePrice, { dash: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(project.snapshot?.indicatedValue, { dash: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(noi, { dash: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(capRate, { dash: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(project.snapshot?.irr, { dash: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMultiple(project.snapshot?.equityMultiple)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(project.snapshot?.cashOnCash, { dash: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {project.monteCarlo?.hasResults ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex flex-col items-end gap-0.5">
                                    <span className={cn(
                                      "text-sm font-medium",
                                      (project.monteCarlo.probabilityOfLoss ?? 0) < 0.1
                                        ? "text-green-600"
                                        : (project.monteCarlo.probabilityOfLoss ?? 0) < 0.25
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                    )}>
                                      {((project.monteCarlo.probabilityOfLoss ?? 0) * 100).toFixed(1)}% loss
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      IRR {formatPercent(project.monteCarlo.irrP5)}–{formatPercent(project.monteCarlo.irrP95)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <div className="space-y-1 text-xs">
                                    <p className="font-medium">Monte Carlo ({(project.monteCarlo.iterations ?? 0).toLocaleString()} iterations)</p>
                                    <p>Prob. of Loss: {((project.monteCarlo.probabilityOfLoss ?? 0) * 100).toFixed(1)}%</p>
                                    <p>VaR (95%): {project.monteCarlo.valueAtRisk != null ? formatCurrency(project.monteCarlo.valueAtRisk, { dash: true }) : '—'}</p>
                                    <p>Mean IRR: {formatPercent(project.monteCarlo.irrMean)}</p>
                                    <p>Sharpe: {(project.monteCarlo.sharpeRatio ?? 0).toFixed(2)}</p>
                                    {project.monteCarlo.sensitivityTop?.length > 0 && (
                                      <p>Top driver: {project.monteCarlo.sensitivityTop[0].variable}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(
                                `/modeling/projects/${project.id}`
                              );
                            }}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

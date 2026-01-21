import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileWarning,
  Calendar,
  DollarSign,
  Users,
  Building2,
  ExternalLink
} from "lucide-react";
import DashboardNav from "../components/navigation/DashboardNav";
import { useProjectContext } from "../contexts/ProjectContext";

interface DataQualityIssue {
  id: string;
  severity: "INFO" | "WARNING" | "ERROR";
  category: string;
  message: string;
  leaseId?: string;
  tenantId?: string;
  locationId?: string;
  metadata?: Record<string, any>;
}

interface DataQualitySummary {
  issues: DataQualityIssue[];
  countsBySeverity: Record<string, number>;
  countsByCategory: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof AlertCircle }> = {
  LEASE_DATES: { label: "Lease Dates", icon: Calendar },
  COI: { label: "Certificate of Insurance", icon: FileWarning },
  LEASE_AMOUNT: { label: "Lease Amounts", icon: DollarSign },
  TENANT_DATA: { label: "Tenant Data", icon: Users },
  OVERLAPPING_LEASES: { label: "Overlapping Leases", icon: Building2 },
  MISC: { label: "Miscellaneous", icon: AlertCircle },
};

const SEVERITY_CONFIG = {
  ERROR: { label: "Error", color: "bg-red-500/10 text-red-700 border-red-200", icon: AlertCircle },
  WARNING: { label: "Warning", color: "bg-yellow-500/10 text-yellow-700 border-yellow-200", icon: AlertTriangle },
  INFO: { label: "Info", color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: Info },
};

export default function ReconciliationPage() {
  // Get project context - will have projectId when in project-specific view
  const { projectId: contextProjectId, isPortfolioScope, project } = useProjectContext();
  const isProjectScoped = !!contextProjectId;
  
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // When in project context, lock to that project
  const effectiveProject = contextProjectId || selectedProject;

  const { data: projects, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['/api/marina-locations'],
  });

  const { data: qualitySummary, isLoading: summaryLoading, refetch } = useQuery<DataQualitySummary>({
    queryKey: ['/api/rent-roll/data-quality', effectiveProject],
    queryFn: async () => {
      const url = effectiveProject === "all" 
        ? '/api/rent-roll/data-quality' 
        : `/api/rent-roll/data-quality?locationId=${effectiveProject}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch data quality');
      return response.json();
    },
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filteredIssues = qualitySummary?.issues?.filter(issue => {
    if (selectedSeverity !== "all" && issue.severity !== selectedSeverity) return false;
    if (selectedCategory !== "all" && issue.category !== selectedCategory) return false;
    return true;
  }) || [];

  const groupedIssues = filteredIssues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, DataQualityIssue[]>);

  const totalErrors = qualitySummary?.countsBySeverity?.ERROR || 0;
  const totalWarnings = qualitySummary?.countsBySeverity?.WARNING || 0;
  const totalInfo = qualitySummary?.countsBySeverity?.INFO || 0;
  const totalIssues = totalErrors + totalWarnings + totalInfo;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Rent Roll
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
            <Button 
              variant="outline" 
              size="default" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-total-issues">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-total-issues">{totalIssues}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-errors">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-red-600" data-testid="text-errors">{totalErrors}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-warnings">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-yellow-600" data-testid="text-warnings">{totalWarnings}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-info">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Info</CardTitle>
              <Info className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-blue-600" data-testid="text-info">{totalInfo}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Data Quality Issues</CardTitle>
                <CardDescription>Review issues by category, severity, and project</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* When in project context, show badge instead of selector */}
                {isProjectScoped && project ? (
                  <Badge variant="secondary" className="px-3 py-1.5" data-testid="badge-current-project">
                    <Building2 className="h-3 w-3 mr-2" />
                    {project.name}
                  </Badge>
                ) : (
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-[180px]" data-testid="select-project">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects?.map((proj: any) => (
                        <SelectItem key={proj.id} value={proj.id}>
                          {proj.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                  <SelectTrigger className="w-[140px]" data-testid="select-severity">
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="ERROR">Errors</SelectItem>
                    <SelectItem value="WARNING">Warnings</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-green-100 p-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium">No issues found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSeverity !== "all" || selectedCategory !== "all" 
                    ? "Try adjusting your filters to see more results."
                    : "Your data quality looks good!"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {Object.entries(groupedIssues).map(([category, issues]) => {
                    const categoryConfig = CATEGORY_LABELS[category] || CATEGORY_LABELS.MISC;
                    const CategoryIcon = categoryConfig.icon;
                    const isExpanded = expandedCategories[category] !== false;

                    return (
                      <Collapsible
                        key={category}
                        open={isExpanded}
                        onOpenChange={() => toggleCategory(category)}
                      >
                        <CollapsibleTrigger asChild>
                          <div 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                            data-testid={`category-header-${category}`}
                          >
                            <div className="flex items-center gap-3">
                              <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{categoryConfig.label}</span>
                              <Badge variant="secondary">{issues.length}</Badge>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">Severity</TableHead>
                                <TableHead>Issue</TableHead>
                                <TableHead>Tenant</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {issues.map((issue) => {
                                const severityConfig = SEVERITY_CONFIG[issue.severity];
                                const SeverityIcon = severityConfig.icon;
                                return (
                                  <TableRow key={issue.id} data-testid={`issue-row-${issue.id}`}>
                                    <TableCell>
                                      <Badge 
                                        variant="outline" 
                                        className={severityConfig.color}
                                      >
                                        <SeverityIcon className="h-3 w-3 mr-1" />
                                        {severityConfig.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p className="text-sm">{issue.message}</p>
                                        {issue.metadata && (
                                          <p className="text-xs text-muted-foreground">
                                            {Object.entries(issue.metadata)
                                              .filter(([key]) => key !== 'tenantName')
                                              .map(([key, value]) => `${key}: ${value}`)
                                              .join(' | ')}
                                          </p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm">
                                        {issue.metadata?.tenantName || '-'}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {issue.leaseId && issue.locationId && (
                                        <Link href={`/rent-roll/${issue.locationId}?leaseId=${issue.leaseId}`}>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            data-testid={`button-view-lease-${issue.id}`}
                                          >
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            View
                                          </Button>
                                        </Link>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Summary</CardTitle>
            <CardDescription>Issues breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(qualitySummary?.countsByCategory || {}).map(([category, count]) => {
                  const categoryConfig = CATEGORY_LABELS[category] || CATEGORY_LABELS.MISC;
                  const CategoryIcon = categoryConfig.icon;
                  return (
                    <div 
                      key={category}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                      data-testid={`category-summary-${category}`}
                    >
                      <div className="p-2 bg-muted rounded-lg">
                        <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{categoryConfig.label}</p>
                        <p className="text-xl font-semibold">{count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

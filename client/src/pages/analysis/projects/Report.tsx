import { useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, MapPin, TrendingUp, DollarSign, BarChart3, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import type { Project, Property } from "@shared/schema";

interface DealSalesCompSalesComp {
  id: string;
  marinaName: string | null;
  city: string | null;
  state: string | null;
  salePrice: string | null;
  capRate: string | null;
  saleYear: number | null;
  wetSlips: number | null;
  totalSlips: number | null;
  pricePerSlip: string | null;
}

interface DealSalesComp {
  id: string;
  dealId: string;
  salesCompId: string;
  isPrimary: boolean;
  relevanceScore: number | null;
  notes: string | null;
  comparisonType: string | null;
  distanceMiles: number | null;
  salesComp: DealSalesCompSalesComp;
}

interface DealRateCompRateComp {
  id: string;
  marinaName: string | null;
  city: string | null;
  state: string | null;
  wetSlipRateAvg: string | null;
  drySlipRateAvg: string | null;
  totalSlips: number | null;
  occupancyRate: string | null;
  qualityTier: string | null;
}

interface DealRateComp {
  id: string;
  dealId: string;
  rateCompId: string;
  isPrimary: boolean;
  relevanceScore: number | null;
  notes: string | null;
  comparisonType: string | null;
  rateVariancePercent: number | null;
  rateComp: DealRateCompRateComp;
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `${num.toFixed(2)}%`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active": return "default";
    case "completed": return "secondary";
    case "archived": return "outline";
    default: return "secondary";
  }
}

function CollapsibleSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between mb-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors">
            {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            {title}
            <Badge variant="outline" className="text-xs font-normal">{count}</Badge>
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

interface ProjectReportProps {
  id?: string;
}

export default function ProjectReport({ id: propId }: ProjectReportProps) {
  const [, setLocation] = useLocation();
  const reportRef = useRef<HTMLDivElement>(null);
  const [, routeParams] = useRoute("/analysis/projects/:id/report");
  const [, routeParamsAlt] = useRoute("/analysis/projects/:id");

  const projectId = propId ?? routeParams?.id ?? routeParamsAlt?.id;

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project, { status?: number; message?: string }>({
    queryKey: queryKeys.projects.detail(projectId ?? ""),
    queryFn: async () => {
      const res = await fetch(`/api/sc-projects/${projectId}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        const error: { status?: number; message?: string } = { status: res.status, message: err.message };
        throw error;
      }
      return res.json() as Promise<Project>;
    },
    enabled: !!projectId,
    retry: false,
  });

  const { data: property, isLoading: propertyLoading } = useQuery<Property>({
    queryKey: ["/api/properties", project?.propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${project!.propertyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Property not found");
      return res.json() as Promise<Property>;
    },
    enabled: !!project?.propertyId,
    retry: false,
  });

  const { data: salesComps = [], isLoading: salesCompsLoading, error: salesCompsError } = useQuery<DealSalesComp[]>({
    queryKey: ["/api/integrations/deals", projectId, "sales-comps"],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/deals/${projectId}/sales-comps`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load sales comparables (${res.status})`);
      return res.json() as Promise<DealSalesComp[]>;
    },
    enabled: !!projectId,
    retry: false,
  });

  const { data: rateComps = [], isLoading: rateCompsLoading, error: rateCompsError } = useQuery<DealRateComp[]>({
    queryKey: ["/api/integrations/deals", projectId, "rate-comps"],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/deals/${projectId}/rate-comps`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load rate comparables (${res.status})`);
      return res.json() as Promise<DealRateComp[]>;
    },
    enabled: !!projectId,
    retry: false,
  });

  const isLoading = projectLoading || (!!project?.propertyId && propertyLoading) || salesCompsLoading || rateCompsLoading;

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Project ID is required to generate a report.
              </AlertDescription>
            </Alert>
            <Button onClick={() => setLocation("/analysis/projects")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleGoBack = () => {
    setLocation("/analysis/projects");
  };

  if (projectError) {
    const status = (projectError as { status?: number }).status;
    const isNotFound = status === 404;
    const isAccessDenied = status === 403;
    let errorMessage = "Failed to load project report data. Please try again later.";
    if (isNotFound) errorMessage = "Project not found.";
    else if (isAccessDenied) errorMessage = "You do not have access to this project.";
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button onClick={handleGoBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const fullAddress = [project.address, project.city, project.state, project.zipCode]
    .filter(Boolean)
    .join(", ");

  const askingPrice = project.purchasePrice;
  const noi = property?.noiEstimate ?? null;
  const capRate = property?.listCapRate ?? null;
  const occupancyRate = property?.occupancyRate ?? null;

  return (
    <div className="min-h-screen bg-background print:bg-white" ref={reportRef}>
      <div className="print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button onClick={handleGoBack} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
            <ExportPdfButton
              contentRef={reportRef}
              filename={`${project.name.replace(/\s+/g, "-").toLowerCase()}-report`}
              title={`${project.name} — Analysis Report`}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8 print:px-0 print:pb-0" data-pdf-content>
        <div className="max-w-6xl mx-auto space-y-8 print:space-y-6" data-report-content>

          {/* Header Card */}
          <Card className="print:shadow-none print:border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-primary flex-shrink-0" />
                  <div>
                    <CardTitle className="text-2xl font-bold">{project.name}</CardTitle>
                    {fullAddress && (
                      <div className="flex items-center gap-1 mt-1 text-muted-foreground text-sm">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{fullAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(project.status)}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </Badge>
                  {project.projectType === "portfolio" && (
                    <Badge variant="outline">Portfolio</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            {project.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </CardContent>
            )}
          </Card>

          {/* Deal Metrics Grid */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Deal Metrics
            </h2>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${occupancyRate !== null ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
              <Card className="print:shadow-none print:border">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Asking Price
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xl font-bold">{formatCurrency(askingPrice)}</p>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    NOI
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xl font-bold">{formatCurrency(noi)}</p>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Cap Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xl font-bold">{formatPercent(capRate)}</p>
                </CardContent>
              </Card>

              {occupancyRate !== null && (
                <Card className="print:shadow-none print:border">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Occupancy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xl font-bold">{formatPercent(occupancyRate)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sales Comparables */}
          <CollapsibleSection title="Sales Comparables" count={salesComps.length}>
            <Card className="print:shadow-none print:border">
              <CardContent className="p-0">
                {salesCompsError ? (
                  <div className="p-6 flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{salesCompsError instanceof Error ? salesCompsError.message : "Failed to load sales comparables."}</span>
                  </div>
                ) : salesComps.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No sales comparables linked to this project.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marina</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead className="text-right">Sale Price</TableHead>
                          <TableHead className="text-right">Cap Rate</TableHead>
                          <TableHead className="text-right">Sale Year</TableHead>
                          <TableHead className="text-right">Total Slips</TableHead>
                          <TableHead className="text-right">Price/Slip</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesComps.map((item) => {
                          const sc = item.salesComp;
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{sc.marinaName ?? "—"}</TableCell>
                              <TableCell>{sc.city ?? "—"}</TableCell>
                              <TableCell>{sc.state ?? "—"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(sc.salePrice)}</TableCell>
                              <TableCell className="text-right">{formatPercent(sc.capRate)}</TableCell>
                              <TableCell className="text-right">{sc.saleYear ?? "—"}</TableCell>
                              <TableCell className="text-right">{sc.totalSlips ?? "—"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(sc.pricePerSlip)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleSection>

          {/* Rate Comparables */}
          <CollapsibleSection title="Rate Comparables" count={rateComps.length}>
            <Card className="print:shadow-none print:border">
              <CardContent className="p-0">
                {rateCompsError ? (
                  <div className="p-6 flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{rateCompsError instanceof Error ? rateCompsError.message : "Failed to load rate comparables."}</span>
                  </div>
                ) : rateComps.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No rate comparables linked to this project.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marina</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead className="text-right">Wet Slip Rate Avg</TableHead>
                          <TableHead className="text-right">Dry Slip Rate Avg</TableHead>
                          <TableHead className="text-right">Total Slips</TableHead>
                          <TableHead className="text-right">Occupancy Rate</TableHead>
                          <TableHead>Quality Tier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rateComps.map((item) => {
                          const rc = item.rateComp;
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{rc.marinaName ?? "—"}</TableCell>
                              <TableCell>{rc.city ?? "—"}</TableCell>
                              <TableCell>{rc.state ?? "—"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(rc.wetSlipRateAvg)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(rc.drySlipRateAvg)}</TableCell>
                              <TableCell className="text-right">{rc.totalSlips ?? "—"}</TableCell>
                              <TableCell className="text-right">{formatPercent(rc.occupancyRate)}</TableCell>
                              <TableCell>
                                {rc.qualityTier ? (
                                  <Badge variant="outline">{rc.qualityTier}</Badge>
                                ) : "—"}
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
          </CollapsibleSection>

          {/* Investment Thesis */}
          {project.investmentThesis && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Investment Thesis</h2>
              <Card className="print:shadow-none print:border">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.investmentThesis}</p>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

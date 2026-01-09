import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  DollarSign,
  TrendingUp,
  MapPin,
  Anchor,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Target,
  BarChart3,
  FileText,
  Waves,
} from "lucide-react";

interface MarinaDetails {
  id: string;
  propertyId: string;
  projectId?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  slips: number;
  status: string;
  holdStrategy: string | null;
  acquisitionDate: string | null;
  acquisitionPrice: number | null;
  exitTargetDate: string | null;
  keyMetrics: Record<string, any>;
  notes: string | null;
  currentValue: number | null;
  annualRevenue: number | null;
  annualEbitda: number | null;
  occupancy: number | null;
}

interface SalesComp {
  id: string;
  marinaName: string;
  location: string;
  state: string;
  saleDate: string;
  salePrice: number | null;
  pricePerSlip: number | null;
  totalSlips: number | null;
  capRate: number | null;
  source: string | null;
}

interface RateComp {
  id: string;
  marinaName: string;
  location: string;
  state: string;
  effectiveDate: string;
  avgMonthlyRate: number | null;
  slipSize: string | null;
  amenities: string[] | null;
  notes: string | null;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (!value) return "-";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatDate = (date: string | null): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function MetricCard({
  label,
  value,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

export default function MarinaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: marina, isLoading, error } = useQuery<MarinaDetails>({
    queryKey: ["/api/portfolio/marinas", id],
    enabled: !!id,
  });

  const { data: salesComps, isLoading: loadingSalesComps } = useQuery<SalesComp[]>({
    queryKey: ["/api/analysis/sales-comps", { state: marina?.state }],
    enabled: !!marina?.state,
  });

  const { data: rateComps, isLoading: loadingRateComps } = useQuery<RateComp[]>({
    queryKey: ["/api/analysis/rate-comps", { state: marina?.state }],
    enabled: !!marina?.state,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !marina) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Marina Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The marina you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate("/portfolio")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portfolio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const capRate = marina.currentValue && marina.annualEbitda 
    ? ((marina.annualEbitda / marina.currentValue) * 100).toFixed(1) 
    : "-";

  const unrealizedGain = (marina.currentValue || 0) - (marina.acquisitionPrice || 0);
  const gainPercent = marina.acquisitionPrice && marina.currentValue
    ? (((marina.currentValue - marina.acquisitionPrice) / marina.acquisitionPrice) * 100).toFixed(1)
    : "0";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portfolio")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              {marina.name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {marina.address || `${marina.city}, ${marina.state} ${marina.zip || ""}`}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {marina.propertyId && (
            <Button variant="outline" onClick={() => navigate(`/crm/properties/${marina.propertyId}`)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Property
            </Button>
          )}
          {marina.projectId && (
            <Button variant="outline" onClick={() => navigate(`/modeling/projects/${marina.projectId}`)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Model
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={marina.status === "under_management" ? "default" : "secondary"}>
          {marina.status?.replace(/_/g, " ")}
        </Badge>
        {marina.holdStrategy && (
          <Badge variant="outline">
            <Target className="h-3 w-3 mr-1" />
            {marina.holdStrategy.replace(/_/g, " ")}
          </Badge>
        )}
        {marina.acquisitionDate && (
          <Badge variant="outline">
            <Calendar className="h-3 w-3 mr-1" />
            Acquired {formatDate(marina.acquisitionDate)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Current Value"
          value={formatCurrency(marina.currentValue)}
          icon={DollarSign}
        />
        <MetricCard
          label="Acquisition Price"
          value={formatCurrency(marina.acquisitionPrice)}
          icon={DollarSign}
        />
        <MetricCard
          label="Unrealized Gain"
          value={formatCurrency(unrealizedGain)}
          icon={TrendingUp}
          subtitle={`${gainPercent}%`}
        />
        <MetricCard
          label="Annual EBITDA"
          value={formatCurrency(marina.annualEbitda)}
          icon={TrendingUp}
        />
        <MetricCard
          label="Cap Rate"
          value={`${capRate}%`}
          icon={BarChart3}
        />
        <MetricCard
          label="Total Slips"
          value={String(marina.slips || 0)}
          icon={Anchor}
          subtitle={`${marina.occupancy || 0}% occupied`}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales-comps">Sales Comps</TabsTrigger>
          <TabsTrigger value="rate-comps">Rate Comps</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Address</div>
                    <div className="font-medium">{marina.address || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">City</div>
                    <div className="font-medium">{marina.city || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">State</div>
                    <div className="font-medium">{marina.state || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">ZIP</div>
                    <div className="font-medium">{marina.zip || "-"}</div>
                  </div>
                </div>
                {marina.exitTargetDate && (
                  <div>
                    <div className="text-sm text-muted-foreground">Exit Target</div>
                    <div className="font-medium">{formatDate(marina.exitTargetDate)}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Annual Revenue</div>
                    <div className="font-medium">{formatCurrency(marina.annualRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Annual EBITDA</div>
                    <div className="font-medium">{formatCurrency(marina.annualEbitda)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Occupancy</div>
                    <div className="font-medium">{marina.occupancy || 0}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Revenue/Slip</div>
                    <div className="font-medium">
                      {marina.slips && marina.annualRevenue 
                        ? formatCurrency(marina.annualRevenue / marina.slips) 
                        : "-"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {marina.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{marina.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sales-comps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Sales Comparables in {marina.state}
              </CardTitle>
              <CardDescription>
                Recent marina sales in the same state for benchmarking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSalesComps ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !salesComps || salesComps.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Waves className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sales comparables found for {marina.state}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate("/analysis/sales-comps")}
                  >
                    Add Sales Comps
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marina</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Sale Date</TableHead>
                        <TableHead className="text-right">Sale Price</TableHead>
                        <TableHead className="text-right">Slips</TableHead>
                        <TableHead className="text-right">$/Slip</TableHead>
                        <TableHead className="text-right">Cap Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesComps.map((comp) => (
                        <TableRow key={comp.id}>
                          <TableCell className="font-medium">{comp.marinaName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {comp.location}, {comp.state}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatDate(comp.saleDate)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(comp.salePrice)}</TableCell>
                          <TableCell className="text-right">{comp.totalSlips || "-"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(comp.pricePerSlip)}</TableCell>
                          <TableCell className="text-right">
                            {comp.capRate ? `${comp.capRate.toFixed(1)}%` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-comps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Rate Comparables in {marina.state}
              </CardTitle>
              <CardDescription>
                Current slip rental rates at nearby marinas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRateComps ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !rateComps || rateComps.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Anchor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rate comparables found for {marina.state}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate("/analysis/rate-comps")}
                  >
                    Add Rate Comps
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marina</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Effective Date</TableHead>
                        <TableHead className="text-right">Avg Monthly Rate</TableHead>
                        <TableHead>Slip Size</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rateComps.map((comp) => (
                        <TableRow key={comp.id}>
                          <TableCell className="font-medium">{comp.marinaName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {comp.location}, {comp.state}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatDate(comp.effectiveDate)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(comp.avgMonthlyRate)}</TableCell>
                          <TableCell>{comp.slipSize || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {comp.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

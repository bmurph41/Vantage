import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  MapPin,
  Calendar,
  Lock,
  Info,
  Building
} from "lucide-react";
import { InlineBanner } from "@/components/ui/inline-banner";

interface IndustryStandard {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  region?: string;
  state?: string;
  metricValue?: string;
  metricUnit?: string;
  lowRange?: string;
  highRange?: string;
  effectiveYear?: number;
  effectiveQuarter?: number;
  dataSource?: string;
  confidenceLevel?: string;
  requiredPack?: string;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "occupancy", label: "Occupancy Rates", icon: Percent },
  { value: "revenue", label: "Revenue Metrics", icon: DollarSign },
  { value: "expenses", label: "Expense Ratios", icon: BarChart3 },
  { value: "cap_rates", label: "Cap Rates", icon: TrendingUp },
  { value: "rates", label: "Slip/Storage Rates", icon: Building },
];

const REGIONS = [
  { value: "all", label: "All Regions" },
  { value: "Northeast", label: "Northeast" },
  { value: "Southeast", label: "Southeast" },
  { value: "Gulf Coast", label: "Gulf Coast" },
  { value: "Great Lakes", label: "Great Lakes" },
  { value: "Pacific", label: "Pacific" },
  { value: "National", label: "National Average" },
];

function formatMetricValue(value?: string, unit?: string): string {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  
  switch (unit) {
    case "percentage":
      return `${num.toFixed(1)}%`;
    case "dollars":
      return `$${num.toLocaleString()}`;
    case "dollars_per_foot":
      return `$${num.toFixed(2)}/ft`;
    case "dollars_per_slip":
      return `$${num.toLocaleString()}/slip`;
    case "multiplier":
      return `${num.toFixed(2)}x`;
    default:
      return value;
  }
}

function formatRange(low?: string, high?: string, unit?: string): string {
  if (!low || !high) return "-";
  return `${formatMetricValue(low, unit)} - ${formatMetricValue(high, unit)}`;
}

function getCategoryIcon(category: string) {
  const cat = CATEGORIES.find(c => c.value === category);
  return cat?.icon || BarChart3;
}

export default function IndustryStandards() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  
  const queryParams = new URLSearchParams();
  if (selectedCategory !== "all") queryParams.set("category", selectedCategory);
  if (selectedRegion !== "all") queryParams.set("region", selectedRegion);
  if (selectedYear) queryParams.set("year", selectedYear);

  const queryString = queryParams.toString();
  const apiUrl = queryString ? `/api/industry-standards?${queryString}` : "/api/industry-standards";

  const { data: standards = [], isLoading } = useQuery<IndustryStandard[]>({
    queryKey: [apiUrl],
  });

  const groupedByCategory = standards.reduce((acc, std) => {
    if (!acc[std.category]) acc[std.category] = [];
    acc[std.category].push(std);
    return acc;
  }, {} as Record<string, IndustryStandard[]>);

  return (
    <MainLayout 
      title="Industry Standards" 
      subtitle="Global marina benchmarks and performance metrics"
    >
      <div className="space-y-6" ref={reportRef}>
        <div className="flex items-center justify-between">
          <div />
          <ExportPdfButton contentRef={reportRef} filename="industry-standards" title="Marina Industry Standards" />
        </div>
        <InlineBanner variant="info">
          <Info className="h-4 w-4 mr-2" />
          Industry standards are curated by MarinaMatch from authoritative sources including NMMA, industry surveys, and proprietary research.
        </InlineBanner>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-32 sm:w-40">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-muted animate-pulse" />
                    <div className="h-5 w-32 rounded bg-muted animate-pulse" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex items-center gap-4">
                      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : standards.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No standards available</p>
                <p className="text-sm mt-2">
                  Industry standards for the selected filters are not yet available.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : selectedCategory === "all" ? (
          <div className="grid gap-6">
            {Object.entries(groupedByCategory).map(([category, items]) => {
              const CategoryIcon = getCategoryIcon(category);
              const categoryLabel = CATEGORIES.find(c => c.value === category)?.label || category;
              
              return (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{categoryLabel}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Range</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Year</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((std) => (
                          <TableRow key={std.id}>
                            <TableCell className="font-medium">{std.name}</TableCell>
                            <TableCell>{std.region || "National"}</TableCell>
                            <TableCell className="font-mono">
                              {formatMetricValue(std.metricValue, std.metricUnit)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatRange(std.lowRange, std.highRange, std.metricUnit)}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {std.dataSource || "MarinaMatch Research"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {std.effectiveYear}
                              {std.effectiveQuarter && ` Q${std.effectiveQuarter}`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{CATEGORIES.find(c => c.value === selectedCategory)?.label}</CardTitle>
              <CardDescription>
                {selectedRegion !== "all" ? `${selectedRegion} region` : "All regions"} - {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standards.map((std) => (
                    <TableRow key={std.id}>
                      <TableCell className="font-medium">{std.name}</TableCell>
                      <TableCell>{std.region || "National"}</TableCell>
                      <TableCell className="font-mono">
                        {formatMetricValue(std.metricValue, std.metricUnit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRange(std.lowRange, std.highRange, std.metricUnit)}
                      </TableCell>
                      <TableCell>
                        {std.confidenceLevel && (
                          <Badge variant={
                            std.confidenceLevel === "high" ? "default" :
                            std.confidenceLevel === "medium" ? "secondary" : "outline"
                          }>
                            {std.confidenceLevel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {std.dataSource || "MarinaMatch Research"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-dashed">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Additional Data Available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upgrade to Analytics Pro to access detailed regional breakdowns, historical trends, and custom benchmark comparisons.
                </p>
                <Button variant="outline" size="sm" className="mt-3">
                  Learn More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

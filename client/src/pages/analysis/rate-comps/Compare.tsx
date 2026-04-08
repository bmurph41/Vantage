import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3, AlertCircle, FileDown, TrendingUp, DollarSign, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { rateCompsApi } from "@/lib/ratecomps/api";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/ratecomps/format";
import { generateRateCompsComparisonPDF, downloadPDF } from "@/components/ratecomps/analytics/RateCompsComparisonPDF";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import type { RateComp } from "@shared/schema";

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Compare() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idsParam = params.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      setSelectedIds(ids);
    }
  }, [location]);

  // Fetch all selected comps
  const { data: compsData, isLoading, error } = useQuery({
    queryKey: ['rate-comps-compare', selectedIds],
    queryFn: async () => {
      const comps = await Promise.all(
        selectedIds.map(id => rateCompsApi.getComp(id))
      );
      return comps;
    },
    enabled: selectedIds.length > 0,
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!compsData || compsData.length === 0) return null;

    const wetRates = compsData.filter(c => c.avgWetRate).map(c => c.avgWetRate!);
    const dryRates = compsData.filter(c => c.avgDryRate).map(c => c.avgDryRate!);
    const occupancies = compsData.filter(c => c.occupancy).map(c => c.occupancy!);
    const capacities = compsData.filter(c => c.totalSlips).map(c => c.totalSlips!);
    
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const min = (arr: number[]) => arr.length ? Math.min(...arr) : 0;
    const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0;

    return {
      avgWetRate: avg(wetRates),
      minWetRate: min(wetRates),
      maxWetRate: max(wetRates),
      avgDryRate: avg(dryRates),
      minDryRate: min(dryRates),
      maxDryRate: max(dryRates),
      avgOccupancy: avg(occupancies),
      avgCapacity: avg(capacities),
    };
  }, [compsData]);

  const handleExportPDF = async () => {
    if (!compsData || !statistics) {
      toast({
        title: "Cannot Export",
        description: "Please wait for data to load before exporting",
        variant: "destructive",
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      const blob = await generateRateCompsComparisonPDF(compsData, statistics);
      const filename = `marina-rate-comps-comparison-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(blob, filename);
      toast({
        title: "PDF Exported",
        description: `Rate comparison analysis saved as ${filename}`,
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (selectedIds.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                No Comparables Selected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Please select at least 2 rate comparables to compare.
              </p>
              <Link href="/analysis/rate-comps">
                <Button data-testid="button-back-to-comps">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Rate Comps
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div ref={reportRef} className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <BarChart3 className="h-8 w-8" />
                Comparative Analysis
              </h1>
              <p className="text-muted-foreground mt-2" data-testid="text-comparison-count">
                Comparing {selectedIds.length} {selectedIds.length === 1 ? 'property' : 'properties'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportPdfButton contentRef={reportRef} filename="rate-comps-comparison" title="Rate Comps Comparison" />
              <Button 
                onClick={handleExportPDF}
                disabled={isExportingPdf}
                data-testid="button-export-pdf"
              >
                <FileDown className="h-4 w-4 mr-2" />
                {isExportingPdf ? "Generating PDF..." : "Export PDF"}
              </Button>
              <Link href="/analysis/rate-comps">
                <Button variant="outline" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to List
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Error Loading Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Failed to load comparison data'}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && compsData && compsData.length > 0 && (
          <div className="space-y-6">
            {/* Summary Statistics */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Avg Sale Price
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-price">
                      {formatCurrency(statistics.avgPrice)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Range: {formatCurrency(statistics.minPrice)} - {formatCurrency(statistics.maxPrice)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Percent className="h-4 w-4 text-blue-600" />
                      Avg Cap Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-cap-rate">
                      {formatPercent(statistics.avgCapRate)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Range: {formatPercent(statistics.minCapRate)} - {formatPercent(statistics.maxCapRate)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      Avg Wet Slips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-wet-slips">
                      {formatNumber(statistics.avgWetSlips)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-600" />
                      Avg Dry Racks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-dry-racks">
                      {formatNumber(statistics.avgDryRacks)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Price Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sale Price Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart 
                    data={compsData.filter(c => c.salePrice).map((comp, i) => ({
                      name: comp.marina,
                      displayName: comp.marina.length > 20 ? comp.marina.substring(0, 20) + '...' : comp.marina,
                      price: comp.salePrice,
                      isSubject: i === 0,
                      fill: i === 0 ? '#10b981' : '#3b82f6'
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="displayName" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip 
                      formatter={(value: any, name: string, props: any) => [
                        formatCurrency(value),
                        props.payload.isSubject ? 'Subject Property' : 'Comparable'
                      ]}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0) {
                          return payload[0].payload.name;
                        }
                        return label;
                      }}
                    />
                    <Bar 
                      dataKey="price" 
                      barSize={60}
                      radius={[8, 8, 0, 0]}
                    >
                      {compsData.filter(c => c.salePrice).map((comp, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? '#10b981' : '#3b82f6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#10b981]"></div>
                    <span className="text-muted-foreground">Subject Property (First in comparison)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#3b82f6]"></div>
                    <span className="text-muted-foreground">Comparables</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Property</TableHead>
                        {compsData.map((comp, i) => (
                          <TableHead key={comp.id} className="min-w-[150px]">
                            <div className="font-semibold">{comp.marina}</div>
                            <div className="text-xs text-muted-foreground">{comp.city}, {comp.state}</div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Sale Price</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.salePrice ? formatCurrency(comp.salePrice) : (
                              <Badge variant="secondary">Undisclosed</Badge>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Cap Rate</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.capRate ? formatPercent(comp.capRate) : (
                              <Badge variant="secondary">Undisclosed</Badge>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">NOI</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.noi ? formatCurrency(comp.noi) : (
                              <Badge variant="secondary">Undisclosed</Badge>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Sale Date</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.saleMonth && comp.saleYear ? `${comp.saleMonth}/${comp.saleYear}` : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Wet Slips</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.wetSlips ? formatNumber(comp.wetSlips) : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Dry Racks</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.dryRacks ? formatNumber(comp.dryRacks) : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Storage Type</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.ioBoth || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Occupancy</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.occupancy ? formatPercent(comp.occupancy) : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Year Built</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.yearBuilt || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Body of Water</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.bodyOfWater || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Region</TableCell>
                        {compsData.map(comp => (
                          <TableCell key={comp.id}>
                            {comp.region || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                  </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

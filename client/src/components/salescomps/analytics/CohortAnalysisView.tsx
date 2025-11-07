import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers, DollarSign } from "lucide-react";

interface MetricResult {
  metric: string;
  value: number;
  sampleSize: number;
  groupValue?: string;
}

interface CohortAnalysisViewProps {
  byPriceRange?: Record<string, MetricResult[]>;
  byYear?: Record<string, MetricResult[]>;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export default function CohortAnalysisView({ byPriceRange, byYear, isLoading }: CohortAnalysisViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const priceRangeOrder = [
    'Under $1M',
    '$1M - $5M',
    '$5M - $10M',
    '$10M - $25M',
    'Over $25M'
  ];

  const priceRangeData = byPriceRange 
    ? priceRangeOrder
        .filter(range => byPriceRange[range])
        .map(range => {
          const metrics = byPriceRange[range];
          return {
            range,
            count: metrics.find(m => m.metric === 'count')?.value || 0,
            avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
            avgPricePerSlip: metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0,
            avgCapRate: metrics.find(m => m.metric === 'avgCapRate')?.value || 0,
          };
        })
    : [];

  const yearData = byYear
    ? Object.entries(byYear)
        .map(([year, metrics]) => ({
          year: parseInt(year),
          count: metrics.find(m => m.metric === 'count')?.value || 0,
          avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
          avgPricePerSlip: metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0,
          avgCapRate: metrics.find(m => m.metric === 'avgCapRate')?.value || 0,
        }))
        .sort((a, b) => a.year - b.year)
    : [];

  return (
    <div className="space-y-6" data-testid="cohort-analysis-view">
      {/* Price Range Distribution */}
      {priceRangeData.length > 0 && (
        <Card className="border-border/40" data-testid="card-price-range-distribution">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Distribution by Price Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priceRangeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="range"
                  className="text-xs"
                  stroke="currentColor"
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  className="text-xs"
                  stroke="currentColor"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'count') return [value, 'Count'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Transaction Count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Price Range Metrics Table */}
      {priceRangeData.length > 0 && (
        <Card className="border-border/40" data-testid="card-price-range-metrics">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Price Range Metrics Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Price Range</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Avg Price/Slip</TableHead>
                    <TableHead className="text-right">Avg Cap Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceRangeData.map((row) => (
                    <TableRow key={row.range} data-testid={`row-price-range-${row.range}`}>
                      <TableCell className="font-medium">{row.range}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.avgPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.avgPricePerSlip)}</TableCell>
                      <TableCell className="text-right">
                        {row.avgCapRate > 0 ? formatPercent(row.avgCapRate) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yearly Cohort Analysis */}
      {yearData.length > 0 && (
        <>
          <Card className="border-border/40" data-testid="card-year-volume">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Transaction Volume by Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="year"
                    className="text-xs"
                    stroke="currentColor"
                  />
                  <YAxis 
                    className="text-xs"
                    stroke="currentColor"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" name="Transactions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/40" data-testid="card-year-metrics">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Year-by-Year Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg Price</TableHead>
                      <TableHead className="text-right">Avg Price/Slip</TableHead>
                      <TableHead className="text-right">Avg Cap Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearData.map((row) => (
                      <TableRow key={row.year} data-testid={`row-year-${row.year}`}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.avgPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.avgPricePerSlip)}</TableCell>
                        <TableCell className="text-right">
                          {row.avgCapRate > 0 ? formatPercent(row.avgCapRate) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

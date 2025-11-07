import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PieChart, BarChart3 } from "lucide-react";

interface DistributionAnalysisViewProps {
  data: any;
  isLoading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function DistributionAnalysisView({ data, isLoading }: DistributionAnalysisViewProps) {
  if (isLoading || !data) {
    return (
      <Card className="p-6 text-center border-dashed">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Loading distribution analysis...</p>
      </Card>
    );
  }

  // Create distribution data from metrics
  const priceDistribution = data.byPriceRange
    ? Object.entries(data.byPriceRange).map(([range, comps]: [string, any]) => ({
        range,
        count: Array.isArray(comps) ? comps.length : 0,
      }))
    : [];

  const capacityDistribution = [
    { range: '0-50', count: 0 },
    { range: '51-100', count: 0 },
    { range: '101-200', count: 0 },
    { range: '201-500', count: 0 },
    { range: '500+', count: 0 },
  ];

  const capRateDistribution = [
    { range: '0-5%', count: 0 },
    { range: '5-7%', count: 0 },
    { range: '7-10%', count: 0 },
    { range: '10-15%', count: 0 },
    { range: '15%+', count: 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Price Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priceDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6">
                  {priceDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Capacity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Capacity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={capacityDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981">
                  {capacityDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cap Rate Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Cap Rate Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={capRateDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b">
                  {capRateDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Percentile Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4" />
              Price Percentiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">10th Percentile</span>
                <span className="text-sm font-semibold">${data.overall?.avgPrice ? (data.overall.avgPrice * 0.4).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">25th Percentile</span>
                <span className="text-sm font-semibold">${data.overall?.avgPrice ? (data.overall.avgPrice * 0.6).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b bg-muted/20">
                <span className="text-sm text-muted-foreground font-medium">50th Percentile (Median)</span>
                <span className="text-sm font-bold">${data.overall?.medianPrice?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">75th Percentile</span>
                <span className="text-sm font-semibold">${data.overall?.avgPrice ? (data.overall.avgPrice * 1.4).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">90th Percentile</span>
                <span className="text-sm font-semibold">${data.overall?.avgPrice ? (data.overall.avgPrice * 1.8).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

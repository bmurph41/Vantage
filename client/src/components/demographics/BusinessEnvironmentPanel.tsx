import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/utils";

interface Sector {
  naicsCode: string;
  name: string;
  establishments: number;
  employees: number;
  payroll: number;
}

interface BusinessPatternsResponse {
  totalEstablishments: number;
  totalEmployees: number;
  totalPayroll: number;
  sectors: Sector[];
}

interface BusinessEnvironmentPanelProps {
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
}

export default function BusinessEnvironmentPanel({ latitude, longitude, locationLabel }: BusinessEnvironmentPanelProps) {
  const { data, isLoading } = useQuery<BusinessPatternsResponse>({
    queryKey: ['/api/demographics/business-patterns', latitude, longitude],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/demographics/business-patterns', { latitude, longitude });
      return res.json();
    },
    enabled: !!latitude && !!longitude,
  });

  const topSectors = useMemo(() => {
    if (!data?.sectors) return [];
    return [...data.sectors]
      .sort((a, b) => b.establishments - a.establishments)
      .slice(0, 8)
      .map(s => ({
        name: s.name.length > 20 ? s.name.substring(0, 18) + '…' : s.name,
        fullName: s.name,
        establishments: s.establishments,
      }));
  }, [data]);

  if (!latitude || !longitude) {
    return (
      <Card data-testid="card-business-environment-empty">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Business Environment</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Building2 className="mx-auto h-12 w-12 mb-4" />
            <p className="text-sm">Select a location to view business environment data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card data-testid="card-business-environment-loading">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Business Environment</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.sectors || data.sectors.length === 0) {
    return (
      <Card data-testid="card-business-environment-no-data">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Business Environment</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Building2 className="mx-auto h-12 w-12 mb-4" />
            <p className="text-sm">No business environment data available for this location</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const payrollInMillions = (data.totalPayroll / 1_000_000).toFixed(1);

  return (
    <Card data-testid="card-business-environment">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Business Environment</h3>
          </div>
          {locationLabel && (
            <Badge variant="outline" className="text-xs">{locationLabel}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-total-businesses">
            <p className="text-xs text-muted-foreground">Total Businesses</p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {formatNumber(data.totalEstablishments)}
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-total-employees">
            <p className="text-xs text-muted-foreground">Total Employees</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatNumber(data.totalEmployees)}
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-total-payroll">
            <p className="text-xs text-muted-foreground">Total Payroll ($M)</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              ${payrollInMillions}
            </p>
          </div>
        </div>

        {topSectors.length > 0 && (
          <div data-testid="chart-sectors">
            <h4 className="text-sm font-medium mb-2">Top Sectors by Establishments</h4>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSectors} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    width={130}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      formatNumber(value),
                      props.payload.fullName || 'Establishments'
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="establishments" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div data-testid="table-sectors">
          <h4 className="text-sm font-medium mb-2">All Sectors</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Sector</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Businesses</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Employees</th>
                  <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Avg Payroll/Employee</th>
                </tr>
              </thead>
              <tbody>
                {data.sectors.map((sector) => {
                  const avgPayroll = sector.employees > 0
                    ? Math.round(sector.payroll / sector.employees)
                    : 0;
                  return (
                    <tr key={sector.naicsCode} className="border-b border-muted/50">
                      <td className="py-1.5 pr-2 text-muted-foreground">{sector.name}</td>
                      <td className="text-right py-1.5 px-2">{formatNumber(sector.establishments)}</td>
                      <td className="text-right py-1.5 px-2">{formatNumber(sector.employees)}</td>
                      <td className="text-right py-1.5 pl-2">${formatNumber(avgPayroll)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

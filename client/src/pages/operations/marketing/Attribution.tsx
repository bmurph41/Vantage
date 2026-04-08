import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target, Users, DollarSign, TrendingUp } from "lucide-react";
import type { LeadAttribution } from "@shared/schema";

export default function Attribution() {
  const { data: attributions = [], isLoading } = useQuery<LeadAttribution[]>({
    queryKey: ['/api/marketing/attribution'],
  });

  const firstTouchCount = attributions.filter(a => a.attributionType === 'first_touch').length;
  const lastTouchCount = attributions.filter(a => a.attributionType === 'last_touch').length;
  const assistedCount = attributions.filter(a => a.attributionType === 'assisted').length;
  const totalRevenue = attributions.reduce((sum, a) => sum + parseFloat(a.revenue || '0'), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Lead Attribution</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-first-touch">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First Touch</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-first-touch">{firstTouchCount}</div>
            <p className="text-xs text-muted-foreground">Initial attribution</p>
          </CardContent>
        </Card>

        <Card data-testid="card-last-touch">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Touch</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-last-touch">{lastTouchCount}</div>
            <p className="text-xs text-muted-foreground">Final attribution</p>
          </CardContent>
        </Card>

        <Card data-testid="card-assisted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assisted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-assisted">{assistedCount}</div>
            <p className="text-xs text-muted-foreground">Assisted conversions</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-total-revenue">
              ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Attributed revenue</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading attribution data...</div>
      ) : attributions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No attribution data available yet. Lead attribution will appear here once campaigns start generating leads.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Attribution History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Touch Date</TableHead>
                    <TableHead>Attribution Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Medium</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attributions.map((attribution) => (
                    <TableRow key={attribution.id} data-testid={`row-attribution-${attribution.id}`}>
                      <TableCell data-testid={`text-date-${attribution.id}`}>
                        {attribution.touchDate ? new Date(attribution.touchDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-type-${attribution.id}`}>
                          {attribution.attributionType?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-source-${attribution.id}`}>
                        {attribution.source || 'N/A'}
                      </TableCell>
                      <TableCell data-testid={`text-medium-${attribution.id}`}>
                        {attribution.medium || 'N/A'}
                      </TableCell>
                      <TableCell data-testid={`text-campaign-${attribution.id}`}>
                        {attribution.campaign || 'N/A'}
                      </TableCell>
                      <TableCell data-testid={`text-revenue-${attribution.id}`}>
                        {attribution.revenue ? `$${parseFloat(attribution.revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

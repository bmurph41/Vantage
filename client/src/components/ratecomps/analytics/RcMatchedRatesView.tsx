import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { RcAnalyticsFilters } from "./RcAnalyticsFilters";
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS } from "@shared/ratecomps-utils";

interface MatchedRate {
  id: string;
  marina: string;
  state: string;
  city: string;
  storageType: string;
  ratePeriod: string;
  ratePerFt: number;
  monthlyRate: number;
  loaMin: number | null;
  loaMax: number | null;
  seasonality: string;
  electricIncluded: boolean;
  waterIncluded: boolean;
}

interface RcMatchedRatesViewProps {
  filters: RcAnalyticsFilters;
  isLoading?: boolean;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Math.round(Number(value)).toLocaleString('en-US')}`;
}

function formatRatePerFt(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Number(value).toFixed(2)}/ft`;
}

function hasValidFilters(filters: RcAnalyticsFilters): boolean {
  return Object.entries(filters).some(([_, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null;
  });
}

export default function RcMatchedRatesView({ filters, isLoading: parentLoading }: RcMatchedRatesViewProps) {
  const { data, isLoading } = useQuery<{ rates: MatchedRate[]; total: number }>({
    queryKey: ['rc-analytics-matched', filters],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/rate-comps/analytics/matched-rates', filters);
      return res.json();
    },
    enabled: hasValidFilters(filters),
  });

  if (!hasValidFilters(filters)) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Table2 className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Apply Filters to View Rates</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Select at least one filter criteria to see matching rate records from the database.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || parentLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Matched Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rates = data?.rates || [];
  const total = data?.total || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Matched Rates
          </CardTitle>
          <Badge variant="secondary">{total} records</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No rates match the selected criteria
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marina</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Storage Type</TableHead>
                  <TableHead>LOA Range</TableHead>
                  <TableHead>Rate/Ft/Mo</TableHead>
                  <TableHead>Monthly Rate</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amenities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.slice(0, 50).map((rate) => (
                  <TableRow key={rate.id} data-testid={`row-rate-${rate.id}`}>
                    <TableCell className="font-medium">{rate.marina}</TableCell>
                    <TableCell>
                      {rate.city && rate.state ? `${rate.city}, ${rate.state}` : rate.state || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {STORAGE_TYPE_LABELS[rate.storageType] || rate.storageType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rate.loaMin && rate.loaMax 
                        ? `${rate.loaMin}' - ${rate.loaMax}'`
                        : rate.loaMin 
                          ? `${rate.loaMin}'+`
                          : rate.loaMax 
                            ? `Up to ${rate.loaMax}'`
                            : 'Any'}
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {formatRatePerFt(rate.ratePerFt)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(rate.monthlyRate)}
                    </TableCell>
                    <TableCell>
                      {RATE_PERIOD_LABELS[rate.ratePeriod] || rate.ratePeriod}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {rate.electricIncluded && (
                          <Badge variant="secondary" className="text-xs">Electric</Badge>
                        )}
                        {rate.waterIncluded && (
                          <Badge variant="secondary" className="text-xs">Water</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {total > 50 && (
              <div className="text-center text-sm text-muted-foreground mt-4">
                Showing 50 of {total} matching rates
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

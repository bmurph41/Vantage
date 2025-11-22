import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Search, Table2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalyticsFilters } from "./AnalyticsFilters";

interface SalesComp {
  id: string;
  propertyName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  saleDate: string | null;
  salePrice: number | null;
  totalSlips: number | null;
  pricePerSlip: number | null;
  storageTypes: string[] | null;
  profitCenters: string[] | null;
  waterType: string | null;
  buyerName: string | null;
  sellerName: string | null;
  brokerName: string | null;
  coastalType: string | null;
  region: string | null;
  isPortfolio: boolean;
}

interface MatchedCompsViewProps {
  filters: AnalyticsFilters;
  isLoading?: boolean;
}

export default function MatchedCompsView({ filters, isLoading: parentLoading }: MatchedCompsViewProps) {
  const { toast } = useToast();

  const { data: matchedComps = [], isLoading } = useQuery<SalesComp[]>({
    queryKey: ["/api/sales-comps/analytics/matched-comps", filters],
    queryFn: async () => {
      const response = await apiRequest("/api/sales-comps/analytics/matched-comps", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return response;
    },
    enabled: Object.keys(filters).length > 0,
  });

  const handleExportCSV = () => {
    if (matchedComps.length === 0) {
      toast({
        title: "No data to export",
        description: "No properties match the current filters",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'Property Name',
      'City',
      'State',
      'Sale Date',
      'Sale Price',
      'Total Slips',
      'Price Per Slip',
      'Water Type',
      'Storage Types',
      'Profit Centers',
      'Buyer',
      'Seller',
      'Broker',
      'Coastal Type',
      'Region',
      'Portfolio',
    ];

    const rows = matchedComps.map((comp) => [
      comp.propertyName || '',
      comp.city || '',
      comp.state || '',
      comp.saleDate || '',
      comp.salePrice ? `$${comp.salePrice.toLocaleString()}` : '',
      comp.totalSlips || '',
      comp.pricePerSlip ? `$${comp.pricePerSlip.toLocaleString()}` : '',
      comp.waterType || '',
      comp.storageTypes?.join('; ') || '',
      comp.profitCenters?.join('; ') || '',
      comp.buyerName || '',
      comp.sellerName || '',
      comp.brokerName || '',
      comp.coastalType || '',
      comp.region || '',
      comp.isPortfolio ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matched-comps-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${matchedComps.length} properties to CSV`,
    });
  };

  const loading = isLoading || parentLoading;

  if (Object.keys(filters).length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-sm font-semibold mb-2">No Filters Applied</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Apply filters on the left to see all properties that match your criteria
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Matched Properties</h3>
            <p className="text-xs text-muted-foreground">Loading properties...</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (matchedComps.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Table2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-sm font-semibold mb-2">No Properties Found</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          No properties match your current filter criteria. Try adjusting your filters to see more results.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Matched Properties</h3>
          <p className="text-xs text-muted-foreground">
            {matchedComps.length} {matchedComps.length === 1 ? 'property' : 'properties'} match your filters
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          variant="outline"
          size="sm"
          data-testid="button-export-matched-comps"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[200px]">Property</TableHead>
                <TableHead className="min-w-[120px]">Location</TableHead>
                <TableHead className="min-w-[100px]">Sale Date</TableHead>
                <TableHead className="text-right min-w-[120px]">Sale Price</TableHead>
                <TableHead className="text-right min-w-[80px]">Slips</TableHead>
                <TableHead className="text-right min-w-[120px]">Price/Slip</TableHead>
                <TableHead className="min-w-[100px]">Water Type</TableHead>
                <TableHead className="min-w-[150px]">Storage</TableHead>
                <TableHead className="min-w-[150px]">Profit Centers</TableHead>
                <TableHead className="min-w-[150px]">Broker</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchedComps.map((comp) => (
                <TableRow key={comp.id} data-testid={`row-comp-${comp.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-sm">{comp.propertyName || 'Unnamed Property'}</span>
                      {comp.isPortfolio && (
                        <span className="text-xs text-muted-foreground bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded w-fit mt-1">
                          Portfolio
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.city || comp.state || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {comp.saleDate ? new Date(comp.saleDate).toLocaleDateString() : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">
                      {comp.salePrice ? `$${comp.salePrice.toLocaleString()}` : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm">{comp.totalSlips || '-'}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">
                      {comp.pricePerSlip ? `$${comp.pricePerSlip.toLocaleString()}` : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{comp.waterType || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {comp.storageTypes?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {comp.profitCenters?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{comp.brokerName || '-'}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

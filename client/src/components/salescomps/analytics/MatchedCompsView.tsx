import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Table2, GitCompare, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalyticsFilters } from "./AnalyticsFilters";
import ComparisonMatrix from "./ComparisonMatrix";
import { hasValidFilters } from "@/lib/salescomps/filterUtils";

interface SalesComp {
  id: string;
  propertyName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  saleYear: number | null;
  saleMonth: number | null;
  salePrice: number | null;
  wetSlips: number | null;
  dryRacks: number | null;
  totalSlips: number | null;
  pricePerSlip: number | null;
  storageTypes: string[] | null;
  profitCenters: string[] | null;
  waterType: string | null;
  buyerName: string | null;
  sellerName: string | null;
  brokerName: string | null;
  agentName: string | null;
  coastalType: string | null;
  region: string | null;
  isPortfolio: boolean;
  capRate: number | null;
  noi: number | null;
  listPrice: number | null;
  acres: number | null;
  occupancy: number | null;
  yearBuilt: number | null;
  daysOnMarket: number | null;
  saleCondition: string | null;
  bodyOfWater: string | null;
  waterBodyName: string | null;
  company: string | null;
}

interface MatchedCompsViewProps {
  filters: AnalyticsFilters;
  isLoading?: boolean;
}

export default function MatchedCompsView({ filters, isLoading: parentLoading }: MatchedCompsViewProps) {
  const { toast } = useToast();
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const { data: matchedComps = [], isLoading } = useQuery<SalesComp[]>({
    queryKey: ["/api/sales-comps/analytics/matched-comps", filters],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/sales-comps/analytics/matched-comps", filters);
      return res.json();
    },
    enabled: hasValidFilters(filters),
  });

  const selectedComps = useMemo(() => {
    return matchedComps.filter(comp => selectedCompIds.includes(comp.id));
  }, [matchedComps, selectedCompIds]);

  const handleToggleComp = (compId: string) => {
    setSelectedCompIds(prev => {
      if (prev.includes(compId)) {
        return prev.filter(id => id !== compId);
      } else {
        if (prev.length >= 6) {
          toast({
            title: "Selection limit reached",
            description: "You can compare up to 6 properties at a time",
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, compId];
      }
    });
  };

  const handleRemoveFromComparison = (compId: string) => {
    setSelectedCompIds(prev => prev.filter(id => id !== compId));
  };

  const handleClearSelection = () => {
    setSelectedCompIds([]);
  };

  const handleShowComparison = () => {
    if (selectedCompIds.length < 2) {
      toast({
        title: "Select more properties",
        description: "Please select at least 2 properties to compare",
        variant: "destructive",
      });
      return;
    }
    setShowComparison(true);
  };

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
      'Address',
      'City',
      'State',
      'Zip Code',
      'Sale Date',
      'Sale Price',
      'Cap Rate',
      'NOI',
      'Wet Slips',
      'Dry Racks',
      'Total Slips',
      'Price Per Slip',
      'Water Type',
      'Coastal Type',
      'Region',
      'Body of Water',
      'Storage Types',
      'Profit Centers',
      'Buyer',
      'Seller',
      'Broker',
      'Agent',
      'Days on Market',
      'List Price',
      'Acres',
      'Year Built',
      'Occupancy',
      'Portfolio',
    ];

    const rows = matchedComps.map((comp) => {
      const saleDate = comp.saleYear 
        ? (comp.saleMonth ? `${comp.saleMonth}/${comp.saleYear}` : `${comp.saleYear}`)
        : '';
      const capRate = comp.capRate 
        ? `${(Number(comp.capRate) > 1 ? Number(comp.capRate) : Number(comp.capRate) * 100).toFixed(2)}%`
        : '';
      return [
        comp.propertyName || '',
        comp.address || '',
        comp.city || '',
        comp.state || '',
        comp.zipCode || '',
        saleDate,
        comp.salePrice ? `$${Number(comp.salePrice).toLocaleString()}` : '',
        capRate,
        comp.noi ? `$${Number(comp.noi).toLocaleString()}` : '',
        comp.wetSlips ?? '',
        comp.dryRacks ?? '',
        comp.totalSlips ?? '',
        comp.pricePerSlip ? `$${Math.round(Number(comp.pricePerSlip)).toLocaleString()}` : '',
        comp.waterType || '',
        comp.coastalType || '',
        comp.region || '',
        comp.waterBodyName || comp.bodyOfWater || '',
        comp.storageTypes?.join('; ') || '',
        comp.profitCenters?.join('; ') || '',
        comp.buyerName || comp.company || '',
        comp.sellerName || '',
        comp.brokerName || '',
        comp.agentName || '',
        comp.daysOnMarket ?? '',
        comp.listPrice ? `$${Number(comp.listPrice).toLocaleString()}` : '',
        comp.acres ?? '',
        comp.yearBuilt ?? '',
        comp.occupancy ? `${comp.occupancy}%` : '',
        comp.isPortfolio ? 'Yes' : 'No',
      ];
    });

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

  if (!hasValidFilters(filters)) {
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

  // Show comparison matrix if active
  if (showComparison && selectedComps.length >= 2) {
    return (
      <div className="space-y-4">
        <ComparisonMatrix
          comps={selectedComps}
          onRemoveComp={handleRemoveFromComparison}
          onClose={() => setShowComparison(false)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComparison(false)}
          className="w-full"
        >
          Back to List View
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection Bar */}
      {selectedCompIds.length > 0 && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900">
                {selectedCompIds.length} selected
              </Badge>
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {selectedCompIds.length >= 2
                  ? `Ready to compare ${selectedCompIds.length} properties`
                  : 'Select at least one more property to compare'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleShowComparison}
                disabled={selectedCompIds.length < 2}
                size="sm"
                variant="default"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Selected
              </Button>
              <Button
                onClick={handleClearSelection}
                variant="ghost"
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

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
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedCompIds.length === matchedComps.length && matchedComps.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCompIds(matchedComps.slice(0, 6).map(c => c.id));
                      } else {
                        setSelectedCompIds([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="min-w-[180px]">Property</TableHead>
                <TableHead className="min-w-[140px]">Location</TableHead>
                <TableHead className="min-w-[90px]">Sale Date</TableHead>
                <TableHead className="text-right min-w-[100px]">Sale Price</TableHead>
                <TableHead className="text-right min-w-[90px]">Cap Rate</TableHead>
                <TableHead className="text-right min-w-[80px]">Wet</TableHead>
                <TableHead className="text-right min-w-[80px]">Dry</TableHead>
                <TableHead className="text-right min-w-[100px]">$/Slip</TableHead>
                <TableHead className="min-w-[100px]">Water Type</TableHead>
                <TableHead className="min-w-[100px]">Region</TableHead>
                <TableHead className="min-w-[120px]">Buyer</TableHead>
                <TableHead className="min-w-[120px]">Seller</TableHead>
                <TableHead className="min-w-[130px]">Broker</TableHead>
                <TableHead className="min-w-[120px]">Profit Centers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchedComps.map((comp) => {
                const saleDate = comp.saleYear 
                  ? (comp.saleMonth ? `${comp.saleMonth}/${comp.saleYear}` : `${comp.saleYear}`)
                  : '-';
                const capRateDisplay = comp.capRate 
                  ? `${(Number(comp.capRate) > 1 ? Number(comp.capRate) : Number(comp.capRate) * 100).toFixed(2)}%`
                  : '-';
                return (
                  <TableRow key={comp.id} data-testid={`row-comp-${comp.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedCompIds.includes(comp.id)}
                        onCheckedChange={() => handleToggleComp(comp.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm truncate max-w-[160px]" title={comp.propertyName || 'Unnamed Property'}>
                          {comp.propertyName || 'Unnamed Property'}
                        </span>
                        {comp.isPortfolio && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 w-fit mt-0.5">
                            Portfolio
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.city || comp.state || '-'}</div>
                        {comp.zipCode && <div className="text-xs text-muted-foreground">{comp.zipCode}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{saleDate}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">
                        {comp.salePrice ? `$${Number(comp.salePrice).toLocaleString()}` : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">{capRateDisplay}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">{comp.wetSlips != null ? Number(comp.wetSlips).toLocaleString() : '-'}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">{comp.dryRacks != null ? Number(comp.dryRacks).toLocaleString() : '-'}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">
                        {comp.pricePerSlip ? `$${Math.round(Number(comp.pricePerSlip)).toLocaleString()}` : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{comp.waterType || comp.coastalType || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[90px]" title={comp.region || '-'}>
                        {comp.region || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[110px]" title={comp.buyerName || comp.company || '-'}>
                        {comp.buyerName || comp.company || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[110px]" title={comp.sellerName || '-'}>
                        {comp.sellerName || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="truncate max-w-[120px]" title={comp.brokerName || '-'}>
                          {comp.brokerName || '-'}
                        </div>
                        {comp.agentName && comp.agentName.trim() && (
                          <div className="text-xs text-muted-foreground truncate max-w-[120px]" title={comp.agentName}>
                            {comp.agentName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs truncate max-w-[110px]" title={comp.profitCenters?.join(', ') || '-'}>
                        {comp.profitCenters?.join(', ') || '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      </Card>
    </div>
  );
}

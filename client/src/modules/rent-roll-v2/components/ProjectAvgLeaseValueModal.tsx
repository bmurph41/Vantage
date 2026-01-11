import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectAvgLeaseValueModalProps {
  open: boolean;
  onClose: () => void;
  locationId: string;
  startDate: string;
  endDate: string;
  contractTermFilter?: string;
  storageTypeFilter?: string;
}

interface StorageTypeAvgValue {
  storageType: string;
  totalRevenue: string;
  activeLeases: number;
  avgLeaseValue: string;
  minLeaseValue: string;
  maxLeaseValue: string;
}

export function ProjectAvgLeaseValueModal({ 
  open, 
  onClose, 
  locationId,
  startDate,
  endDate,
  contractTermFilter = "overall",
  storageTypeFilter = "all",
}: ProjectAvgLeaseValueModalProps) {
  const { data, isLoading } = useQuery<StorageTypeAvgValue[]>({
    queryKey: ["/api/rent-roll", locationId, "overview/avg-lease-value-by-storage-type", startDate, endDate, contractTermFilter, storageTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (contractTermFilter && contractTermFilter !== "overall") {
        params.append("contractTermFilter", contractTermFilter);
      }
      if (storageTypeFilter && storageTypeFilter !== "all") {
        params.append("storageTypeFilter", storageTypeFilter);
      }
      const response = await fetch(`/api/rent-roll/${locationId}/overview/avg-lease-value-by-storage-type?${params}`);
      if (!response.ok) throw new Error('Failed to fetch avg lease value by storage type');
      return response.json();
    },
    enabled: open && !!locationId,
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalRevenue = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0);
  }, [data]);

  const totalLeases = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, item) => sum + item.activeLeases, 0);
  }, [data]);

  const overallAvg = totalLeases > 0 ? totalRevenue / totalLeases : 0;

  const getContractTermLabel = (term: string) => {
    switch (term) {
      case "annual": return "Annual";
      case "seasonal": return "Seasonal";
      case "winter": return "Winter";
      case "shortTerm": return "Short-Term";
      default: return "All Contract Terms";
    }
  };

  const hasFilters = contractTermFilter !== "overall" || storageTypeFilter !== "all";
  const filterDescription = hasFilters ? (
    <span className="text-xs">
      {" "}• Filtered by: {contractTermFilter !== "overall" && getContractTermLabel(contractTermFilter)}
      {contractTermFilter !== "overall" && storageTypeFilter !== "all" && ", "}
      {storageTypeFilter !== "all" && storageTypeFilter}
    </span>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0" data-testid="modal-project-avg-lease-value">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Average Lease Value by Storage Type</DialogTitle>
          <DialogDescription>
            Overall average: {formatCurrency(overallAvg)} across {totalLeases} active leases
            {filterDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Storage Type</TableHead>
                    <TableHead className="text-right">Active Leases</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Avg Value</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data && data.length > 0 ? (
                    data.map((item) => (
                      <TableRow 
                        key={item.storageType} 
                        data-testid={`row-storage-type-${item.storageType}`}
                      >
                        <TableCell className="font-medium">{item.storageType}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.activeLeases}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.totalRevenue)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(item.avgLeaseValue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatCurrency(item.minLeaseValue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatCurrency(item.maxLeaseValue)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No storage type data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

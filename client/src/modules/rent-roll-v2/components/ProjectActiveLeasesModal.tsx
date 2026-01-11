import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectActiveLeasesModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

interface StorageLocationLeaseBreakdown {
  storageLocationId: string;
  storageLocationName: string;
  storageType: string | null;
  capacity: number | null;
  activeLeases: number;
  totalLeases: number;
  vacantSlips: number;
  occupancyRate: number;
}

export function ProjectActiveLeasesModal({ 
  open, 
  onClose, 
  projectId,
}: ProjectActiveLeasesModalProps) {
  const { data: storageData, isLoading } = useQuery<StorageLocationLeaseBreakdown[]>({
    queryKey: ["/api/rent-roll", projectId, "overview/leases-by-storage-location"],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/${projectId}/overview/leases-by-storage-location`);
      if (!response.ok) throw new Error('Failed to fetch leases by storage location');
      return response.json();
    },
    enabled: open && !!projectId,
  });

  const totalActive = storageData?.reduce((sum, sl) => sum + sl.activeLeases, 0) || 0;
  const totalLeases = storageData?.reduce((sum, sl) => sum + sl.totalLeases, 0) || 0;
  const totalVacant = storageData?.reduce((sum, sl) => sum + sl.vacantSlips, 0) || 0;
  const totalCapacity = storageData?.reduce((sum, sl) => sum + (sl.capacity || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-project-active-leases">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Active Leases by Storage Location</DialogTitle>
          <DialogDescription>
            {totalActive} active of {totalLeases} total leases
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 grid grid-cols-4 gap-4 flex-shrink-0 border-b">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="text-modal-active">{totalActive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="text-modal-total">{totalLeases}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Vacant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="text-modal-vacant">{totalVacant}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="text-modal-capacity">{totalCapacity}</div>
            </CardContent>
          </Card>
        </div>

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
                    <TableHead>Storage Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Capacity</TableHead>
                    <TableHead className="text-right">Vacant</TableHead>
                    <TableHead className="text-right">Occupancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storageData && storageData.length > 0 ? (
                    storageData.map((sl) => (
                      <TableRow 
                        key={sl.storageLocationId} 
                        data-testid={`row-storage-location-${sl.storageLocationId}`}
                      >
                        <TableCell className="font-medium">{sl.storageLocationName}</TableCell>
                        <TableCell>
                          {sl.storageType ? (
                            <Badge variant="secondary">{sl.storageType}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{sl.activeLeases}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{sl.totalLeases}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {sl.capacity !== null ? sl.capacity : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{sl.vacantSlips}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {sl.capacity !== null && sl.capacity > 0 ? (
                            <span className={sl.occupancyRate >= 90 ? "text-green-600 font-medium" : ""}>
                              {sl.occupancyRate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No storage locations configured
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

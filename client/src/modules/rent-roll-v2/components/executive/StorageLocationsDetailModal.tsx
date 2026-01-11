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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface StorageLocationsDetailModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string;
}

interface StorageLocationOccupancy {
  locationId: string;
  locationName: string;
  capacity: number | null;
  isActive: boolean;
  activeLeases: number;
  occupancyRate: number;
}

export function StorageLocationsDetailModal({
  open,
  onClose,
  projectId,
  projectName,
}: StorageLocationsDetailModalProps) {
  const { data: locations, isLoading } = useQuery<StorageLocationOccupancy[]>({
    queryKey: ["/api/executive-dashboard/storage-locations", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await fetch(`/api/executive-dashboard/storage-locations/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch storage locations");
      return response.json();
    },
    enabled: open && !!projectId,
  });

  const totalActiveLocations = locations?.filter(l => l.isActive).length || 0;
  const totalLocations = locations?.length || 0;
  const totalActiveLeases = locations?.reduce((sum, l) => sum + l.activeLeases, 0) || 0;
  const totalCapacity = locations?.reduce((sum, l) => sum + (l.capacity || 0), 0) || 0;
  const overallOccupancyRate = totalCapacity > 0 ? (totalActiveLeases / totalCapacity) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col" data-testid="modal-storage-locations-detail">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Storage Locations - {projectName}</DialogTitle>
          <DialogDescription>
            {totalActiveLocations} active locations with {totalActiveLeases} leases across {totalCapacity.toLocaleString()} total capacity ({overallOccupancyRate.toFixed(1)}% occupancy)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Location Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Active Leases</TableHead>
                        <TableHead className="text-right">Total Capacity</TableHead>
                        <TableHead className="text-right">Occupancy Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations && locations.length > 0 ? (
                        locations.map((location) => (
                          <TableRow key={location.locationId} data-testid={`row-location-${location.locationId}`}>
                            <TableCell className="font-medium">{location.locationName}</TableCell>
                            <TableCell>
                              <Badge variant={location.isActive ? "default" : "secondary"}>
                                {location.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{location.activeLeases}</TableCell>
                            <TableCell className="text-right">{location.capacity?.toLocaleString() || 0}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  location.occupancyRate >= 90
                                    ? "text-green-600 dark:text-green-500 font-medium"
                                    : location.occupancyRate >= 70
                                    ? "text-amber-600 dark:text-amber-500 font-medium"
                                    : "text-red-600 dark:text-red-500 font-medium"
                                }
                              >
                                {location.occupancyRate.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No storage locations found for this project
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

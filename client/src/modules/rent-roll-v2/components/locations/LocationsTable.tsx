import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { getStorageLocationsByProject, deleteStorageLocation } from "../../lib/storageLocationApi";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, MapPin } from "lucide-react";
import { ImportedDataBadge } from "@/components/integrations/ImportedDataBadge";

interface LocationsTableProps {
  projectId: string;
  onEditLocation: (locationId: string) => void;
}

export default function LocationsTable({ projectId, onEditLocation }: LocationsTableProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);

  const { data: locations, isLoading } = useQuery<Array<{ 
    id: string; 
    name: string; 
    code: string | null; 
    description: string | null; 
    storageType: string | null;
    capacity: number | null; 
    postedRate: string | null;
    postedRateType: string | null;
    isActive: boolean 
  }>>({
    queryKey: ["/api/rent-roll/storage-locations", { projectId }],
  });
  
  // Calculate storage type summary
  const storageTypeSummary = locations?.reduce((acc, loc) => {
    if (loc.isActive && loc.storageType) {
      acc[loc.storageType] = (acc[loc.storageType] || 0) + (loc.capacity || 1);
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const deleteMutation = useMutation({
    mutationFn: deleteStorageLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/storage-locations", { projectId }] });
      toast({
        title: "Success",
        description: "Storage location deleted successfully",
      });
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete storage location",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (locationId: string) => {
    setLocationToDelete(locationId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (locationToDelete) {
      deleteMutation.mutate(locationToDelete);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="status-loading-locations">
        <div className="text-sm text-muted-foreground">Loading storage locations...</div>
      </div>
    );
  }

  // Format posted rate for display as $00,000 format
  const formatPostedRate = (rate: string | null, rateType: string | null) => {
    if (!rate) return "-";
    const numRate = parseFloat(rate);
    // Use whole number format unless there are actual cents
    const hasDecimals = numRate % 1 !== 0;
    const formattedRate = numRate.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    });
    return rateType ? `${formattedRate} ${rateType}` : formattedRate;
  };

  if (!locations || locations.length === 0) {
    return (
      <div data-testid="status-no-locations">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Code</TableHead>
              <TableHead className="text-muted-foreground">Storage Type</TableHead>
              <TableHead className="text-right text-muted-foreground">Capacity</TableHead>
              <TableHead className="text-right text-muted-foreground">Posted Rate</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-right text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        <div className="flex flex-col items-center justify-center py-12 text-center border-t border-dashed">
          <div className="p-3 rounded-full bg-muted mb-4">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Storage Locations Yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add storage locations like docks, slips, or berths to organize your marina inventory
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Storage Type</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Posted Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id} data-testid={`row-location-${location.id}`}>
                <TableCell className="font-medium" data-testid={`text-location-name-${location.id}`}>
                  <div className="flex items-center gap-2">
                    {location.name}
                    <ImportedDataBadge
                      integrationSource={(location as any).integrationSource}
                      externalId={(location as any).externalId}
                      lastSyncedAt={(location as any).lastSyncedAt}
                    />
                  </div>
                </TableCell>
                <TableCell data-testid={`text-location-code-${location.id}`}>
                  {location.code || "-"}
                </TableCell>
                <TableCell data-testid={`text-location-storage-type-${location.id}`}>
                  {location.storageType || "-"}
                </TableCell>
                <TableCell className="text-right" data-testid={`text-location-capacity-${location.id}`}>
                  {location.capacity || "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums" data-testid={`text-location-posted-rate-${location.id}`}>
                  {formatPostedRate(location.postedRate, location.postedRateType)}
                </TableCell>
                <TableCell data-testid={`badge-location-status-${location.id}`}>
                  <Badge variant={location.isActive ? "default" : "secondary"}>
                    {location.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditLocation(location.id)}
                      data-testid={`button-edit-location-${location.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(location.id)}
                      data-testid={`button-delete-location-${location.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Storage Type Summary */}
        {Object.keys(storageTypeSummary).length > 0 && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg" data-testid="storage-type-summary">
            <h4 className="text-sm font-medium mb-3">Storage Types Summary</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(storageTypeSummary)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-sm" data-testid={`badge-summary-${type}`}>
                    {type}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this storage location. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-location"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

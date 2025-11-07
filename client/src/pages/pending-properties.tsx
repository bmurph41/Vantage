import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, AlertTriangle, MapPin, DollarSign, Calendar, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

type PendingProperty = {
  id: string;
  orgId: string;
  compId: string;
  marinaName: string;
  city: string | null;
  state: string | null;
  address: string | null;
  salePrice: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  compMetadata: {
    saleYear?: number;
    saleMonth?: number;
    wetSlips?: number;
    dryRacks?: number;
    bodyOfWater?: string;
  };
  suggestedDuplicates: string[];
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type Property = {
  id: string;
  title: string;
  address?: string;
  listingPrice?: string;
  status: string;
};

export default function PendingProperties() {
  const [selectedPending, setSelectedPending] = useState<PendingProperty | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingProperties = [], isLoading } = useQuery<PendingProperty[]>({
    queryKey: ['/api/pending-properties'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-properties/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property accepted and created successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to accept property", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-properties/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-properties'] });
      toast({ title: "Pending property removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to remove property", variant: "destructive" });
    },
  });

  const handleAccept = (pending: PendingProperty) => {
    // If there are suggested duplicates, show them first
    if (pending.suggestedDuplicates && pending.suggestedDuplicates.length > 0) {
      setSelectedPending(pending);
      setShowDuplicatesDialog(true);
    } else {
      // No duplicates, accept directly
      if (confirm(`Accept "${pending.marinaName}" as a new property?`)) {
        acceptMutation.mutate(pending.id);
      }
    }
  };

  const handleReject = (pending: PendingProperty) => {
    if (confirm(`Remove "${pending.marinaName}" from pending properties?`)) {
      rejectMutation.mutate(pending.id);
    }
  };

  const confirmAccept = () => {
    if (selectedPending) {
      acceptMutation.mutate(selectedPending.id);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatSaleDate = (month: number | undefined, year: number | undefined) => {
    if (!year) return 'N/A';
    if (!month) return year.toString();
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
    return `${monthName} ${year}`;
  };

  const getSuggestedProperties = (duplicateIds: string[]) => {
    return properties.filter(p => duplicateIds.includes(p.id));
  };

  const pendingCount = pendingProperties.filter(p => p.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading pending properties...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Properties Review</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve properties created from sales comp imports
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {pendingCount === 0 ? (
        <Alert>
          <AlertDescription>
            No pending properties to review. New properties from comp imports will appear here.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Properties</CardTitle>
            <CardDescription>
              Accept to create a new Property record, or Remove if this is a duplicate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marina Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sale Info</TableHead>
                  <TableHead>Comp Details</TableHead>
                  <TableHead className="text-center">Potential Duplicates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingProperties
                  .filter(p => p.status === 'pending')
                  .map((pending) => (
                    <TableRow key={pending.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {pending.marinaName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {pending.city && pending.state
                            ? `${pending.city}, ${pending.state}`
                            : pending.city || pending.state || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(pending.salePrice)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatSaleDate(pending.compMetadata?.saleMonth, pending.compMetadata?.saleYear)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {pending.compMetadata?.wetSlips && (
                            <div>Wet Slips: {pending.compMetadata.wetSlips}</div>
                          )}
                          {pending.compMetadata?.dryRacks && (
                            <div>Dry Racks: {pending.compMetadata.dryRacks}</div>
                          )}
                          {pending.compMetadata?.bodyOfWater && (
                            <div className="truncate max-w-[150px]" title={pending.compMetadata.bodyOfWater}>
                              {pending.compMetadata.bodyOfWater}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {pending.suggestedDuplicates?.length > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {pending.suggestedDuplicates.length} Found
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(pending)}
                            data-testid={`button-reject-${pending.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAccept(pending)}
                            data-testid={`button-accept-${pending.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Duplicates Warning Dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Potential Duplicate Properties Found
            </DialogTitle>
            <DialogDescription>
              We found {selectedPending?.suggestedDuplicates?.length || 0} existing properties that might match "{selectedPending?.marinaName}". 
              Review these before accepting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">New Property from Comp:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {selectedPending?.marinaName}
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>{' '}
                  {selectedPending?.city && selectedPending?.state
                    ? `${selectedPending.city}, ${selectedPending.state}`
                    : selectedPending?.city || selectedPending?.state || 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">Sale Price:</span> {formatCurrency(selectedPending?.salePrice || null)}
                </div>
                <div>
                  <span className="text-muted-foreground">Sale Date:</span>{' '}
                  {formatSaleDate(selectedPending?.compMetadata?.saleMonth, selectedPending?.compMetadata?.saleYear)}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Existing Properties:</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {getSuggestedProperties(selectedPending?.suggestedDuplicates || []).map((prop) => (
                  <div key={prop.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{prop.title}</div>
                        <div className="text-sm text-muted-foreground">{prop.address || 'No address'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{prop.listingPrice ? formatCurrency(parseInt(prop.listingPrice)) : 'N/A'}</div>
                        <Badge variant="secondary" className="text-xs">{prop.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedPending) {
                  handleReject(selectedPending);
                }
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Remove (It's a Duplicate)
            </Button>
            <Button onClick={confirmAccept}>
              <Check className="h-4 w-4 mr-2" />
              Accept Anyway (It's New)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

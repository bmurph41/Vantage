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
import { Check, X, AlertTriangle, MapPin, DollarSign, Calendar, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PendingPropertyDetailDialog } from "@/components/pending-property-detail-dialog";
import DuplicateResolutionModal from "@/components/modals/duplicate-resolution-modal";
import type { PendingProperty, Property } from "@shared/schema";

export default function PendingProperties() {
  const [selectedPending, setSelectedPending] = useState<PendingProperty | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<Property | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingProperties = [], isLoading } = useQuery<PendingProperty[]>({
    queryKey: ['/api/crm/pending-properties'],
    refetchInterval: 30000,
  });

  const { mutate: fetchDuplicate, isPending: isFetchingDuplicate } = useMutation({
    mutationFn: async (propertyId: string) => {
      const response = await fetch(`/api/properties/${propertyId}`);
      if (!response.ok) throw new Error('Failed to fetch property');
      return response.json() as Promise<Property>;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'replace' | 'add_new' }) => {
      return await apiRequest('POST', `/api/crm/pending-properties/${id}/accept`, { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property accepted and created successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to accept property", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/crm/pending-properties/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-properties'] });
      toast({ title: "Pending property removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to remove property", variant: "destructive" });
    },
  });

  const handleAccept = async (pending: PendingProperty) => {
    setSelectedPending(pending);
    
    if (pending.suggestedDuplicates && Array.isArray(pending.suggestedDuplicates) && pending.suggestedDuplicates.length > 0) {
      const duplicateId = pending.suggestedDuplicates[0] as string;
      fetchDuplicate(duplicateId, {
        onSuccess: (existingProperty) => {
          setSelectedExisting(existingProperty);
          setShowDuplicatesDialog(true);
        },
        onError: () => {
          setSelectedExisting(null);
          setShowDuplicatesDialog(true);
        },
      });
    } else {
      setSelectedExisting(null);
      setShowDuplicatesDialog(true);
    }
  };

  const handleReject = () => {
    if (selectedPending) {
      rejectMutation.mutate(selectedPending.id);
    }
  };

  const handleAcceptWithMode = (mode: 'replace' | 'add_new') => {
    if (selectedPending) {
      acceptMutation.mutate({ id: selectedPending.id, mode });
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
                    <TableRow
                      key={pending.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedPending(pending);
                        setShowDetailDialog(true);
                      }}
                      data-testid={`row-pending-${pending.id}`}
                    >
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPending(pending);
                              handleReject();
                            }}
                            data-testid={`button-reject-${pending.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(pending);
                            }}
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

      <DuplicateResolutionModal
        isOpen={showDuplicatesDialog}
        onClose={() => {
          setShowDuplicatesDialog(false);
          setSelectedPending(null);
          setSelectedExisting(null);
        }}
        entityType="property"
        pendingEntity={selectedPending}
        existingEntity={selectedExisting}
        onAccept={handleAcceptWithMode}
        onReject={handleReject}
        isLoading={acceptMutation.isPending || rejectMutation.isPending}
      />

      <PendingPropertyDetailDialog
        pending={selectedPending}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X, AlertTriangle, MapPin, DollarSign, Calendar, Building, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BulkActionBar } from "@/components/ui/_primitives/bulk-action-bar";
import { PendingPropertyDetailDialog } from "@/components/pending-property-detail-dialog";
import DuplicateResolutionModal from "@/components/modals/duplicate-resolution-modal";
import { formatCurrency } from "@/lib/utils";
import type { PendingProperty, Property } from "@shared/schema";

interface DuplicateMatch {
  entityId: string;
  matchEntityId?: string;
  entityType: 'property' | 'contact' | 'company';
  confidenceScore: number;
  matchedFields: string[];
  matchReasons: string[];
  fieldScores: Record<string, number>;
  matchReason: string;
}

export default function PendingProperties() {
  const [selectedPending, setSelectedPending] = useState<PendingProperty | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<Property | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<Record<string, DuplicateMatch[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingProperties = [], isLoading } = useQuery<PendingProperty[]>({
    queryKey: ['/api/crm/pending-properties'],
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const pendingItems = pendingProperties.filter(p => p.status === 'pending');

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map(p => p.id)));
    }
  };

  const detectDuplicatesMutation = useMutation({
    mutationFn: async (pendingId: string) => {
      const response = await fetch(`/api/pending/property/${pendingId}/detect-duplicates`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to detect duplicates');
      return response.json();
    },
    onSuccess: (data, pendingId) => {
      setDuplicateMatches(prev => ({
        ...prev,
        [pendingId]: data.matches || []
      }));
    }
  });

  useEffect(() => {
    pendingProperties.filter(p => p.status === 'pending').forEach(pending => {
      if (!duplicateMatches[pending.id]) {
        detectDuplicatesMutation.mutate(pending.id);
      }
    });
  }, [pendingProperties]);

  const getMatchCount = (pendingId: string): number => {
    return duplicateMatches[pendingId]?.length || 0;
  };

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
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: "Pending property removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to remove property", variant: "destructive" });
    },
  });

  const bulkAcceptMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/crm/pending-properties/bulk/accept', { ids, mode: 'add_new' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: `${data.accepted} propert${data.accepted !== 1 ? 'ies' : 'y'} accepted` });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed to bulk accept properties", variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/crm/pending-properties/bulk/reject', { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: `${data.rejected} propert${data.rejected !== 1 ? 'ies' : 'y'} removed` });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed to bulk remove properties", variant: "destructive" });
    },
  });

  const handleAccept = async (pending: PendingProperty) => {
    setSelectedPending(pending);
    
    const matches = duplicateMatches[pending.id] || [];
    if (matches.length > 0) {
      const bestMatch = matches[0];
      const entityId = bestMatch.entityId || bestMatch.matchEntityId;
      fetchDuplicate(entityId, {
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

  const handleReject = (pendingId?: string) => {
    const id = pendingId || selectedPending?.id;
    if (id) {
      rejectMutation.mutate(id);
    }
  };

  const handleAcceptWithMode = (mode: 'replace' | 'add_new') => {
    if (selectedPending) {
      acceptMutation.mutate({ id: selectedPending.id, mode });
    }
  };

  const formatSalePriceDisplay = (salePrice: number | null | undefined, estimatedPrice: number | null | undefined) => {
    if (salePrice) {
      return formatCurrency(salePrice);
    }
    if (estimatedPrice) {
      return `Est. ${formatCurrency(estimatedPrice)}`;
    }
    return 'N/A';
  };

  const formatSaleDate = (month: number | undefined, year: number | undefined) => {
    if (!year) return 'N/A';
    if (!month) return year.toString();
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
    return `${monthName} ${year}`;
  };

  const pendingCount = pendingItems.length;
  const isBulkPending = bulkAcceptMutation.isPending || bulkRejectMutation.isPending;

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
          <h1 className="text-2xl font-bold tracking-tight">Pending Properties Review</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve properties created from Sales Comps or Rate Comps imports
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
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === pendingItems.length && pendingItems.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Marina Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Sale Date</TableHead>
                  <TableHead className="text-center">Potential Duplicates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems
                  .map((pending) => (
                    <TableRow
                      key={pending.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(pending.id) ? 'bg-muted/30' : ''}`}
                      onClick={() => {
                        setSelectedPending(pending);
                        setShowDetailDialog(true);
                      }}
                      data-testid={`row-pending-${pending.id}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(pending.id)}
                          onCheckedChange={() => toggleSelection(pending.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span>{pending.marinaName}</span>
                            <Badge variant="outline" className="text-xs w-fit mt-0.5">
                              {pending.sourceType === 'rate_comp' ? 'Rate Comp' : 'Sales Comp'}
                            </Badge>
                          </div>
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
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3" />
                          {formatSalePriceDisplay(pending.salePrice, pending.compMetadata?.estimatedPrice)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatSaleDate(pending.compMetadata?.saleMonth, pending.compMetadata?.saleYear)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getMatchCount(pending.id) > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {getMatchCount(pending.id)} Match{getMatchCount(pending.id) > 1 ? 'es' : ''}
                          </Badge>
                        ) : duplicateMatches[pending.id] === undefined ? (
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <Check className="h-3 w-3 mr-1" />
                            Unique
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(pending.id);
                            }}
                            disabled={rejectMutation.isPending}
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
            </div>
          </CardContent>
        </Card>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        itemLabel="property"
        actions={[
          {
            label: "Accept All",
            icon: <Check className="h-4 w-4" />,
            onClick: () => bulkAcceptMutation.mutate(Array.from(selectedIds)),
            disabled: isBulkPending,
          },
          {
            label: "Remove All",
            icon: <X className="h-4 w-4" />,
            onClick: () => bulkRejectMutation.mutate(Array.from(selectedIds)),
            variant: "destructive",
            disabled: isBulkPending,
          },
        ]}
      />

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

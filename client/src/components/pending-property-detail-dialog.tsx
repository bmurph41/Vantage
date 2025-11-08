import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Check,
  X,
  AlertTriangle,
  MapPin,
  DollarSign,
  Calendar,
  Building,
  GitMerge,
  Trash2,
  Edit2,
  Save,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  city?: string;
  state?: string;
};

type SalesComp = {
  id: string;
  marina: string;
  city?: string;
  state?: string;
  salePrice?: number;
  saleYear?: number;
  saleMonth?: number;
  wetSlips?: number;
  dryRacks?: number;
  bodyOfWater?: string;
};

interface PendingPropertyDetailDialogProps {
  pending: PendingProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingPropertyDetailDialog({
  pending,
  open,
  onOpenChange,
}: PendingPropertyDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<PendingProperty>>({});
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [compToDelete, setCompToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch duplicate properties
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    enabled: open,
  });

  // Fetch sales comp details
  const { data: comp } = useQuery<SalesComp>({
    queryKey: ['/api/sales-comps', pending?.compId],
    enabled: !!pending?.compId && open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PendingProperty>) => {
      return await apiRequest('PATCH', `/api/pending-properties/${pending?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-properties'] });
      toast({ title: "Property details updated successfully" });
      setIsEditing(false);
      setEditedData({});
    },
    onError: () => {
      toast({ title: "Failed to update property", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-properties/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property accepted and created successfully" });
      onOpenChange(false);
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
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to remove property", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ pendingId, propertyId }: { pendingId: string; propertyId: string }) => {
      return await apiRequest('POST', `/api/pending-properties/${pendingId}/merge`, { propertyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property merged successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to merge property", variant: "destructive" });
    },
  });

  const deleteCompMutation = useMutation({
    mutationFn: async (compId: string) => {
      return await apiRequest('DELETE', `/api/sales-comps/${compId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-properties'] });
      toast({ title: "Comp deleted successfully" });
      setShowDeleteDialog(false);
      setCompToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete comp", variant: "destructive" });
    },
  });

  if (!pending) return null;

  const getSuggestedProperties = () => {
    return properties.filter(p => pending.suggestedDuplicates.includes(p.id));
  };

  const formatCurrency = (amount: number | null | undefined) => {
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

  const handleSaveEdit = () => {
    updateMutation.mutate(editedData);
  };

  const handleMerge = () => {
    if (!selectedDuplicateId) {
      toast({ title: "Please select a property to merge with", variant: "destructive" });
      return;
    }
    mergeMutation.mutate({ pendingId: pending.id, propertyId: selectedDuplicateId });
  };

  const handleDeleteComp = () => {
    if (compToDelete) {
      deleteCompMutation.mutate(compToDelete);
    }
  };

  const currentData = isEditing ? { ...pending, ...editedData } : pending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {currentData.marinaName}
            </DialogTitle>
            <DialogDescription>
              Review property details, manage duplicates, and make decisions
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" data-testid="tab-details">
                Details
              </TabsTrigger>
              <TabsTrigger value="duplicates" data-testid="tab-duplicates">
                <div className="flex items-center gap-2">
                  Duplicates
                  {pending.suggestedDuplicates?.length > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {pending.suggestedDuplicates.length}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Property Information</h3>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedData({});
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                      data-testid="button-save"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marinaName">Marina Name</Label>
                  {isEditing ? (
                    <Input
                      id="marinaName"
                      value={currentData.marinaName}
                      onChange={(e) => setEditedData({ ...editedData, marinaName: e.target.value })}
                      data-testid="input-marinaName"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded">{currentData.marinaName}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  {isEditing ? (
                    <Input
                      id="address"
                      value={currentData.address || ''}
                      onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                      data-testid="input-address"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded">{currentData.address || 'N/A'}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  {isEditing ? (
                    <Input
                      id="city"
                      value={currentData.city || ''}
                      onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                      data-testid="input-city"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded">{currentData.city || 'N/A'}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  {isEditing ? (
                    <Input
                      id="state"
                      value={currentData.state || ''}
                      onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
                      data-testid="input-state"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded">{currentData.state || 'N/A'}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price</Label>
                  {isEditing ? (
                    <Input
                      id="salePrice"
                      type="number"
                      value={currentData.salePrice || ''}
                      onChange={(e) => setEditedData({ ...editedData, salePrice: parseInt(e.target.value) || null })}
                      data-testid="input-salePrice"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded">{formatCurrency(currentData.salePrice)}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Sale Date</Label>
                  <div className="p-2 bg-muted rounded">
                    {formatSaleDate(currentData.compMetadata?.saleMonth, currentData.compMetadata?.saleYear)}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Comp Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Wet Slips</Label>
                    <div className="p-2 bg-muted rounded">
                      {currentData.compMetadata?.wetSlips || 'N/A'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dry Racks</Label>
                    <div className="p-2 bg-muted rounded">
                      {currentData.compMetadata?.dryRacks || 'N/A'}
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Body of Water</Label>
                    <div className="p-2 bg-muted rounded">
                      {currentData.compMetadata?.bodyOfWater || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => rejectMutation.mutate(pending.id)}
                  disabled={rejectMutation.isPending}
                  data-testid="button-reject-detail"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
                <Button
                  onClick={() => acceptMutation.mutate(pending.id)}
                  disabled={acceptMutation.isPending}
                  data-testid="button-accept-detail"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Accept as New Property
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="duplicates" className="flex-1 overflow-hidden flex flex-col mt-4">
              {pending.suggestedDuplicates?.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No potential duplicates found
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Potential Duplicates</h3>
                      <p className="text-sm text-muted-foreground">
                        Select a property to merge with or manage duplicate comps
                      </p>
                    </div>
                    {selectedDuplicateId && (
                      <Button
                        onClick={handleMerge}
                        disabled={mergeMutation.isPending}
                        data-testid="button-merge"
                      >
                        <GitMerge className="h-4 w-4 mr-2" />
                        Merge with Selected
                      </Button>
                    )}
                  </div>

                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-3">
                      {getSuggestedProperties().map((prop) => (
                        <div
                          key={prop.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedDuplicateId === prop.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedDuplicateId(
                            selectedDuplicateId === prop.id ? null : prop.id
                          )}
                          data-testid={`duplicate-${prop.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{prop.title}</h4>
                                <Badge variant="secondary">{prop.status}</Badge>
                                {selectedDuplicateId === prop.id && (
                                  <Badge variant="default">Selected</Badge>
                                )}
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                {prop.address && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {prop.address}
                                  </div>
                                )}
                                {prop.city && prop.state && (
                                  <div>Location: {prop.city}, {prop.state}</div>
                                )}
                                {prop.listingPrice && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(parseInt(prop.listingPrice))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Manage Source Comp</h4>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">Source Sales Comp</div>
                        <div className="text-xs text-muted-foreground">
                          Delete this comp if you have better duplicate data
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setCompToDelete(pending.compId);
                          setShowDeleteDialog(true);
                        }}
                        data-testid="button-delete-comp"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Comp
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Comp?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the sales comp record. This action cannot be undone.
              The pending property review will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComp}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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
import { Card } from "@/components/ui/card";
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
import { AddressInput, type AddressComponents } from "@/components/address-input";
import { formatCurrency } from "@/lib/utils";

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

type DuplicateMatch = {
  property: Property;
  similarityScore: number;
  matchReasons: string[];
  matchDetails: {
    nameMatch: number;
    locationMatch: number;
    priceMatch?: number;
    overallConfidence: 'high' | 'medium' | 'low';
  };
  explanation: string;
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

  // Fetch ALL potential duplicates with similarity scores
  const { data: duplicateData, isLoading: duplicatesLoading } = useQuery<{
    pendingProperty: PendingProperty;
    totalMatches: number;
    matches: DuplicateMatch[];
  }>({
    queryKey: ['/api/pending-properties', pending?.id, 'all-duplicates'],
    enabled: !!pending?.id && open,
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

  const allMatches = duplicateData?.matches || [];
  const highConfidenceMatches = allMatches.filter(m => m.matchDetails.overallConfidence === 'high');
  const mediumConfidenceMatches = allMatches.filter(m => m.matchDetails.overallConfidence === 'medium');
  const lowConfidenceMatches = allMatches.filter(m => m.matchDetails.overallConfidence === 'low');

  const getConfidenceBadgeVariant = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
    }
  };

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
    }
  };

  const formatCurrencyDisplay = (amount: number | null | undefined) => {
    if (!amount) return 'N/A';
    return formatCurrency(amount);
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
                  {duplicatesLoading ? (
                    <Badge variant="secondary" className="ml-1">...</Badge>
                  ) : allMatches.length > 0 ? (
                    <Badge variant="destructive" className="ml-1">
                      {allMatches.length}
                    </Badge>
                  ) : null}
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
              <div className="flex items-center justify-between mb-6">
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

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Identity Section */}
                  <Card>
                    <div className="p-4 border-b border-border">
                      <h4 className="font-semibold">Identity</h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="marinaName">Marina Name *</Label>
                        {isEditing ? (
                          <Input
                            id="marinaName"
                            value={currentData.marinaName}
                            onChange={(e) => setEditedData({ ...editedData, marinaName: e.target.value })}
                            placeholder="Enter marina name..."
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-marinaName"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.marinaName}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {isEditing ? (
                          <AddressInput
                            value={currentData.address || ''}
                            onChange={(value) => setEditedData({ ...editedData, address: value })}
                            onAddressSelect={(components: AddressComponents) => {
                              setEditedData({ 
                                ...editedData, 
                                address: components.streetAddress || components.fullAddress || '',
                                city: components.city || editedData.city,
                                state: components.state || editedData.state,
                                compMetadata: {
                                  ...currentData.compMetadata,
                                  ...editedData.compMetadata,
                                  zip: components.zipCode || (editedData.compMetadata as any)?.zip
                                }
                              });
                            }}
                            label="Address"
                            placeholder="Start typing an address..."
                            testId="input-address"
                          />
                        ) : (
                          <>
                            <Label htmlFor="address">Address</Label>
                            <div className="p-2 bg-muted rounded text-sm">{currentData.address || 'N/A'}</div>
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          {isEditing ? (
                            <Input
                              id="city"
                              value={currentData.city || ''}
                              onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                              placeholder="San Diego"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-city"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.city || 'N/A'}</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          {isEditing ? (
                            <Input
                              id="state"
                              value={currentData.state || ''}
                              onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
                              placeholder="CA"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-state"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.state || 'N/A'}</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="zip">Zip</Label>
                          {isEditing ? (
                            <Input
                              id="zip"
                              value={(editedData.compMetadata as any)?.zip || currentData.compMetadata?.zip || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, zip: e.target.value } })}
                              placeholder="92101"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-zip"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.zip || 'N/A'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Physical Characteristics */}
                  <Card>
                    <div className="p-4 border-b border-border">
                      <h4 className="font-semibold">Physical Characteristics</h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Wet Slips</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={(editedData.compMetadata as any)?.wetSlips || currentData.compMetadata?.wetSlips || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, wetSlips: parseInt(e.target.value) || undefined } })}
                              placeholder="156"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-wetSlips"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.wetSlips || 'N/A'}</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Dry Racks</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={(editedData.compMetadata as any)?.dryRacks || currentData.compMetadata?.dryRacks || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, dryRacks: parseInt(e.target.value) || undefined } })}
                              placeholder="89"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-dryRacks"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.dryRacks || 'N/A'}</div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Acres</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.1"
                              value={(editedData.compMetadata as any)?.acres || currentData.compMetadata?.acres || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, acres: parseFloat(e.target.value) || undefined } })}
                              placeholder="12.5"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-acres"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.acres || 'N/A'}</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Year Built</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={(editedData.compMetadata as any)?.yearBuilt || currentData.compMetadata?.yearBuilt || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, yearBuilt: parseInt(e.target.value) || undefined } })}
                              placeholder="1987"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-yearBuilt"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.yearBuilt || 'N/A'}</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Occupancy (%)</Label>
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={(editedData.compMetadata as any)?.occupancy || currentData.compMetadata?.occupancy || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, occupancy: parseInt(e.target.value) || undefined } })}
                            placeholder="95"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-occupancy"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.occupancy ? `${currentData.compMetadata.occupancy}%` : 'N/A'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Body of Water</Label>
                        {isEditing ? (
                          <Input
                            value={(editedData.compMetadata as any)?.bodyOfWater || currentData.compMetadata?.bodyOfWater || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, bodyOfWater: e.target.value } })}
                            placeholder="Pacific Ocean"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-bodyOfWater"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.bodyOfWater || 'N/A'}</div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Financial Information */}
                  <Card>
                    <div className="p-4 border-b border-border">
                      <h4 className="font-semibold">Financial Information</h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="salePrice">Sale Price</Label>
                        {isEditing ? (
                          <Input
                            id="salePrice"
                            type="number"
                            value={currentData.salePrice || ''}
                            onChange={(e) => setEditedData({ ...editedData, salePrice: parseInt(e.target.value) || null })}
                            placeholder="5000000"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-salePrice"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{formatCurrency(currentData.salePrice)}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="listPrice">List Price</Label>
                        {isEditing ? (
                          <Input
                            id="listPrice"
                            type="number"
                            value={(editedData.compMetadata as any)?.listPrice || currentData.compMetadata?.listPrice || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, listPrice: parseInt(e.target.value) || undefined } })}
                            placeholder="5500000"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-listPrice"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{formatCurrency(currentData.compMetadata?.listPrice)}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="noi">NOI</Label>
                        {isEditing ? (
                          <Input
                            id="noi"
                            type="number"
                            value={(editedData.compMetadata as any)?.noi || currentData.compMetadata?.noi || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, noi: parseInt(e.target.value) || undefined } })}
                            placeholder="450000"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-noi"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{formatCurrency(currentData.compMetadata?.noi)}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="capRate">Cap Rate (%)</Label>
                        {isEditing ? (
                          <Input
                            id="capRate"
                            type="number"
                            step="0.01"
                            value={(editedData.compMetadata as any)?.capRate || currentData.compMetadata?.capRate || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, capRate: parseFloat(e.target.value) || undefined } })}
                            placeholder="9.0"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-capRate"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.capRate ? `${currentData.compMetadata.capRate}%` : 'N/A'}</div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Sale Month</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              value={(editedData.compMetadata as any)?.saleMonth || currentData.compMetadata?.saleMonth || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, saleMonth: parseInt(e.target.value) || undefined } })}
                              placeholder="6"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-saleMonth"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.saleMonth || 'N/A'}</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Sale Year</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={(editedData.compMetadata as any)?.saleYear || currentData.compMetadata?.saleYear || ''}
                              onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, saleYear: parseInt(e.target.value) || undefined } })}
                              placeholder="2023"
                              className="bg-white dark:bg-slate-900"
                              data-testid="input-saleYear"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.saleYear || 'N/A'}</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="daysOnMarket">Days on Market</Label>
                        {isEditing ? (
                          <Input
                            id="daysOnMarket"
                            type="number"
                            value={(editedData.compMetadata as any)?.daysOnMarket || currentData.compMetadata?.daysOnMarket || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, daysOnMarket: parseInt(e.target.value) || undefined } })}
                            placeholder="120"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-daysOnMarket"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.daysOnMarket || 'N/A'}</div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Transaction Details */}
                  <Card>
                    <div className="p-4 border-b border-border">
                      <h4 className="font-semibold">Transaction Details</h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="saleCondition">Sale Condition</Label>
                        {isEditing ? (
                          <Input
                            id="saleCondition"
                            value={(editedData.compMetadata as any)?.saleCondition || currentData.compMetadata?.saleCondition || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, saleCondition: e.target.value } })}
                            placeholder="As-is"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-saleCondition"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.saleCondition || 'N/A'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="broker">Broker</Label>
                        {isEditing ? (
                          <Input
                            id="broker"
                            value={(editedData.compMetadata as any)?.broker || currentData.compMetadata?.broker || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, broker: e.target.value } })}
                            placeholder="ABC Realty"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-broker"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.broker || 'N/A'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="seller">Seller</Label>
                        {isEditing ? (
                          <Input
                            id="seller"
                            value={(editedData.compMetadata as any)?.seller || currentData.compMetadata?.seller || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, seller: e.target.value } })}
                            placeholder="John Doe"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-seller"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.seller || 'N/A'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="buyer">Buyer</Label>
                        {isEditing ? (
                          <Input
                            id="buyer"
                            value={(editedData.compMetadata as any)?.buyer || currentData.compMetadata?.buyer || ''}
                            onChange={(e) => setEditedData({ ...editedData, compMetadata: { ...currentData.compMetadata, buyer: e.target.value } })}
                            placeholder="XYZ Corp"
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-buyer"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.compMetadata?.buyer || 'N/A'}</div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between">
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
              {duplicatesLoading ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Loading duplicate matches...
                </div>
              ) : allMatches.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No potential duplicates found
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">All Potential Duplicates ({allMatches.length})</h3>
                      <p className="text-sm text-muted-foreground">
                        Every property that could be a duplicate, sorted by similarity
                      </p>
                      <div className="flex gap-2 mt-2">
                        {highConfidenceMatches.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {highConfidenceMatches.length} High Confidence
                          </Badge>
                        )}
                        {mediumConfidenceMatches.length > 0 && (
                          <Badge variant="default" className="text-xs">
                            {mediumConfidenceMatches.length} Medium
                          </Badge>
                        )}
                        {lowConfidenceMatches.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {lowConfidenceMatches.length} Low
                          </Badge>
                        )}
                      </div>
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
                      {allMatches.map((match) => (
                        <div
                          key={match.property.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedDuplicateId === match.property.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedDuplicateId(
                            selectedDuplicateId === match.property.id ? null : match.property.id
                          )}
                          data-testid={`duplicate-${match.property.id}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{match.property.title}</h4>
                                <Badge variant="secondary">{match.property.status}</Badge>
                                <Badge variant={getConfidenceBadgeVariant(match.matchDetails.overallConfidence)}>
                                  {match.similarityScore}% Match
                                </Badge>
                                {selectedDuplicateId === match.property.id && (
                                  <Badge variant="default">Selected</Badge>
                                )}
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                {match.property.address && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {match.property.address}
                                  </div>
                                )}
                                {match.property.city && match.property.state && (
                                  <div>Location: {match.property.city}, {match.property.state}</div>
                                )}
                                {match.property.listingPrice && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(parseInt(match.property.listingPrice))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Similarity breakdown */}
                          <div className="space-y-2 border-t pt-3 mt-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Match Analysis
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="space-y-1">
                                <div className="text-muted-foreground">Name</div>
                                <div className={`font-semibold ${match.matchDetails.nameMatch >= 80 ? 'text-green-600' : match.matchDetails.nameMatch >= 60 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                  {match.matchDetails.nameMatch}%
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-muted-foreground">Location</div>
                                <div className={`font-semibold ${match.matchDetails.locationMatch >= 80 ? 'text-green-600' : match.matchDetails.locationMatch >= 60 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                  {match.matchDetails.locationMatch}%
                                </div>
                              </div>
                              {match.matchDetails.priceMatch !== undefined && (
                                <div className="space-y-1">
                                  <div className="text-muted-foreground">Price</div>
                                  <div className={`font-semibold ${match.matchDetails.priceMatch >= 80 ? 'text-green-600' : match.matchDetails.priceMatch >= 60 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                    {match.matchDetails.priceMatch}%
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Match reasons */}
                            {match.matchReasons.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground">
                                  {match.matchReasons.join(' • ')}
                                </div>
                              </div>
                            )}

                            {/* Explanation */}
                            <div className={`text-xs ${getConfidenceColor(match.matchDetails.overallConfidence)} bg-opacity-10 p-2 rounded`}>
                              {match.explanation}
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

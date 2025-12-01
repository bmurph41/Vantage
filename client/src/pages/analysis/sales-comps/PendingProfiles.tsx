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
import { Check, X, MapPin, DollarSign, Calendar, Building, ExternalLink, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PendingPropertyProfile = {
  id: string;
  compId: string;
  orgId: string;
  status: string;
  suggestedDuplicates?: string[];
  createdAt: string;
  completedAt?: string;
};

type SalesComp = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  salePrice?: number;
  saleMonth?: number;
  saleYear?: number;
  totalSlips?: number;
  buyer?: string;
  seller?: string;
};

type Property = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
};

export default function PendingProfiles() {
  const [selectedProfile, setSelectedProfile] = useState<PendingPropertyProfile | null>(null);
  const [selectedComp, setSelectedComp] = useState<SalesComp | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingProfilesData, isLoading } = useQuery<PendingPropertyProfile[]>({
    queryKey: ['/api/sales-comps/pending-property-profiles'],
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: salesCompsData } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps'],
    staleTime: 60 * 1000,
  });

  const { data: propertiesData } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    staleTime: 60 * 1000,
  });

  // Ensure arrays are always valid even if API returns null/undefined
  const pendingProfiles = Array.isArray(pendingProfilesData) ? pendingProfilesData : [];
  const salesComps = Array.isArray(salesCompsData) ? salesCompsData : [];
  const properties = Array.isArray(propertiesData) ? propertiesData : [];

  const createPropertyMutation = useMutation({
    mutationFn: async ({ profileId, compId }: { profileId: string; compId: string }) => {
      const comp = salesComps.find(c => c.id === compId);
      if (!comp) throw new Error('Comp not found');
      
      const propertyData = {
        name: comp.name,
        address: comp.address || '',
        city: comp.city || '',
        state: comp.state || '',
        propertyType: 'marina',
        status: 'active',
        source: 'sales_comp_import',
        sourceId: compId,
      };
      
      await apiRequest('POST', '/api/properties', propertyData);
      await apiRequest('PATCH', `/api/sales-comps/pending-property-profiles/${profileId}`, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps/pending-property-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property profile created successfully" });
      setShowCreateDialog(false);
      setSelectedProfile(null);
      setSelectedComp(null);
    },
    onError: (error) => {
      toast({ title: "Failed to create property profile", description: String(error), variant: "destructive" });
    },
  });

  const linkExistingMutation = useMutation({
    mutationFn: async ({ profileId, compId, propertyId }: { profileId: string; compId: string; propertyId: string }) => {
      await apiRequest('PATCH', `/api/sales-comps/${compId}`, { propertyId });
      await apiRequest('PATCH', `/api/sales-comps/pending-property-profiles/${profileId}`, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps/pending-property-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      toast({ title: "Sales comp linked to existing property" });
      setShowCreateDialog(false);
      setSelectedProfile(null);
      setSelectedComp(null);
    },
    onError: (error) => {
      toast({ title: "Failed to link property", description: String(error), variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return await apiRequest('PATCH', `/api/sales-comps/pending-property-profiles/${profileId}`, { status: 'skipped' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps/pending-property-profiles'] });
      toast({ title: "Skipped property profile creation" });
    },
    onError: () => {
      toast({ title: "Failed to skip", variant: "destructive" });
    },
  });

  const handleCreateProfile = (profile: PendingPropertyProfile) => {
    const comp = salesComps.find(c => c.id === profile.compId);
    setSelectedProfile(profile);
    setSelectedComp(comp || null);
    setShowCreateDialog(true);
  };

  const handleSkip = (profileId: string) => {
    skipMutation.mutate(profileId);
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

  const getCompForProfile = (profile: PendingPropertyProfile) => {
    return salesComps.find(c => c.id === profile.compId);
  };

  const pendingCount = pendingProfiles.filter(p => p.status === 'pending').length;
  const pendingItems = pendingProfiles.filter(p => p.status === 'pending');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading pending property profiles...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/analysis/sales-comps">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-sales-comps">
            <ArrowLeft className="h-4 w-4" />
            Back to Sales Comps
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Property Profiles</h1>
          <p className="text-muted-foreground mt-1">
            Create property profiles for imported sales comps to enable CRM integration
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-pending-count">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {pendingCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-muted-foreground max-w-md">
              No pending property profiles to create. When you import sales comps, any that don't have matching properties will appear here.
            </p>
            <Link href="/analysis/sales-comps">
              <Button variant="outline" className="mt-4" data-testid="button-view-sales-comps">
                View Sales Comps
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sales Comps Needing Property Profiles</CardTitle>
            <CardDescription>
              Create a new property profile or link to an existing property in your CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marina Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sale Info</TableHead>
                  <TableHead>Slips</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.map((profile) => {
                  const comp = getCompForProfile(profile);
                  if (!comp) return null;
                  
                  return (
                    <TableRow key={profile.id} data-testid={`row-pending-profile-${profile.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{comp.name}</div>
                            <Link href={`/analysis/sales-comps/${comp.id}`}>
                              <span className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                View comp <ExternalLink className="h-3 w-3" />
                              </span>
                            </Link>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {comp.city && comp.state 
                              ? `${comp.city}, ${comp.state}`
                              : comp.state || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>{formatCurrency(comp.salePrice)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatSaleDate(comp.saleMonth, comp.saleYear)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{comp.totalSlips || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleCreateProfile(profile)}
                            disabled={createPropertyMutation.isPending}
                            data-testid={`button-create-profile-${profile.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Create Profile
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSkip(profile.id)}
                            disabled={skipMutation.isPending}
                            data-testid={`button-skip-profile-${profile.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Skip
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Property Profile</DialogTitle>
            <DialogDescription>
              Create a new property in your CRM or link this sales comp to an existing property.
            </DialogDescription>
          </DialogHeader>

          {selectedComp && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Sales Comp Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {selectedComp.name}</div>
                  <div><span className="text-muted-foreground">Location:</span> {selectedComp.city}, {selectedComp.state}</div>
                  <div><span className="text-muted-foreground">Sale Price:</span> {formatCurrency(selectedComp.salePrice)}</div>
                  <div><span className="text-muted-foreground">Sale Date:</span> {formatSaleDate(selectedComp.saleMonth, selectedComp.saleYear)}</div>
                </div>
              </div>

              {properties.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Link to Existing Property</h4>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {properties.slice(0, 10).map((property) => (
                      <div
                        key={property.id}
                        className="flex items-center justify-between p-3 hover:bg-muted/50 border-b last:border-b-0"
                      >
                        <div>
                          <div className="font-medium">{property.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {property.city && property.state 
                              ? `${property.city}, ${property.state}`
                              : property.address || 'No address'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (selectedProfile && selectedComp) {
                              linkExistingMutation.mutate({
                                profileId: selectedProfile.id,
                                compId: selectedComp.id,
                                propertyId: property.id,
                              });
                            }
                          }}
                          disabled={linkExistingMutation.isPending}
                          data-testid={`button-link-property-${property.id}`}
                        >
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedProfile && selectedComp) {
                  createPropertyMutation.mutate({
                    profileId: selectedProfile.id,
                    compId: selectedComp.id,
                  });
                }
              }}
              disabled={createPropertyMutation.isPending}
              data-testid="button-confirm-create-profile"
            >
              <Check className="h-4 w-4 mr-1" />
              Create New Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

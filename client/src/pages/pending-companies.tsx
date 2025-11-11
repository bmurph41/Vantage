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
import { Check, X, AlertTriangle, Building2, MapPin, Phone, Globe, Calendar, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type PendingCompany = {
  id: string;
  orgId: string;
  sourceType: string;
  sourceId: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  industry: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  sourceMetadata: Record<string, any>;
  suggestedDuplicates: string[];
  createdCompanyId: string | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type Company = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

export default function PendingCompanies() {
  const [selectedPending, setSelectedPending] = useState<PendingCompany | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingCompanies = [], isLoading } = useQuery<PendingCompany[]>({
    queryKey: ['/api/pending-companies'],
    refetchInterval: 30000,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-companies/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: "Company accepted and created successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to accept company", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-companies/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-companies'] });
      toast({ title: "Pending company removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to remove company", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ pendingId, companyId }: { pendingId: string; companyId: string }) => {
      return await apiRequest('POST', `/api/pending-companies/${pendingId}/merge`, { companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: "Company merged successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to merge company", variant: "destructive" });
    },
  });

  const handleAccept = (pending: PendingCompany) => {
    if (pending.suggestedDuplicates && pending.suggestedDuplicates.length > 0) {
      setSelectedPending(pending);
      setShowDuplicatesDialog(true);
    } else {
      if (confirm(`Accept "${pending.name}" as a new company?`)) {
        acceptMutation.mutate(pending.id);
      }
    }
  };

  const handleReject = (pending: PendingCompany) => {
    if (confirm(`Remove "${pending.name}" from pending companies?`)) {
      rejectMutation.mutate(pending.id);
    }
  };

  const handleMerge = (companyId: string) => {
    if (selectedPending) {
      mergeMutation.mutate({ pendingId: selectedPending.id, companyId });
    }
  };

  const confirmAccept = () => {
    if (selectedPending) {
      acceptMutation.mutate(selectedPending.id);
    }
  };

  const getSuggestedCompanies = (duplicateIds: string[]) => {
    return companies.filter(c => duplicateIds.includes(c.id));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatLocation = (city: string | null, state: string | null) => {
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return 'N/A';
  };

  const pendingCount = pendingCompanies.filter(c => c.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-96" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Companies Review</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve companies from various sources
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-pending-count">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {pendingCount === 0 ? (
        <Alert>
          <AlertDescription>
            No pending companies to review. New companies from imports will appear here.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Companies</CardTitle>
            <CardDescription>
              Accept to create a new Company record, or Remove if this is a duplicate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-center">Potential Duplicates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCompanies
                  .filter(c => c.status === 'pending')
                  .map((pending) => (
                    <TableRow
                      key={pending.id}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-pending-company-${pending.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2" data-testid={`text-company-name-${pending.id}`}>
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{pending.name}</div>
                            {pending.website && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Globe className="h-3 w-3" />
                                {pending.website}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-company-location-${pending.id}`}>
                          <MapPin className="h-3 w-3" />
                          {formatLocation(pending.city, pending.state)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-company-phone-${pending.id}`}>
                          {pending.phone ? (
                            <>
                              <Phone className="h-3 w-3" />
                              {pending.phone}
                            </>
                          ) : (
                            <span className="text-xs">N/A</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm" data-testid={`text-company-source-${pending.id}`}>
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {pending.sourceType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-company-created-${pending.id}`}>
                          <Calendar className="h-3 w-3" />
                          {formatDate(pending.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {pending.suggestedDuplicates?.length > 0 ? (
                          <Badge variant="destructive" className="gap-1" data-testid={`badge-duplicates-${pending.id}`}>
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
                              handleReject(pending);
                            }}
                            data-testid={`button-reject-company-${pending.id}`}
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
                            data-testid={`button-accept-company-${pending.id}`}
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

      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Potential Duplicate Companies Found
            </DialogTitle>
            <DialogDescription>
              We found {selectedPending?.suggestedDuplicates?.length || 0} existing companies that might match "{selectedPending?.name}". 
              Review these before accepting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">New Company:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {selectedPending?.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span> {formatLocation(selectedPending?.city || null, selectedPending?.state || null)}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span> {selectedPending?.phone || 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">Website:</span> {selectedPending?.website || 'N/A'}
                </div>
                {selectedPending?.industry && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Industry:</span> {selectedPending.industry}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Existing Companies:</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {getSuggestedCompanies(selectedPending?.suggestedDuplicates || []).map((company) => (
                  <div
                    key={company.id}
                    className="border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {company.address && <div>{company.address}</div>}
                          <div>
                            {formatLocation(company.city, company.state)}
                            {company.phone && ` • ${company.phone}`}
                          </div>
                          {company.website && (
                            <div className="flex items-center gap-1 text-xs">
                              <Globe className="h-3 w-3" />
                              {company.website}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMerge(company.id)}
                        disabled={mergeMutation.isPending}
                        data-testid={`button-merge-company-${company.id}`}
                      >
                        Merge
                      </Button>
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
              data-testid="button-reject-dialog"
            >
              <X className="h-4 w-4 mr-2" />
              Remove (It's a Duplicate)
            </Button>
            <Button onClick={confirmAccept} data-testid="button-accept-dialog">
              <Check className="h-4 w-4 mr-2" />
              Accept Anyway (It's New)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

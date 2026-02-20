import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X, AlertTriangle, Building2, MapPin, Phone, Globe, Calendar, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkActionBar } from "@/components/ui/_primitives/bulk-action-bar";
import DuplicateResolutionModal from "@/components/modals/duplicate-resolution-modal";
import { PendingCompanyDetailDialog } from "@/components/pending-company-detail-dialog";
import type { PendingCompany, CrmCompany } from "@shared/schema";

export default function PendingCompanies() {
  const [selectedPending, setSelectedPending] = useState<PendingCompany | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<CrmCompany | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingCompanies = [], isLoading } = useQuery<PendingCompany[]>({
    queryKey: ['/api/crm/pending-companies'],
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const pendingItems = pendingCompanies.filter(c => c.status === 'pending');

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

  const { mutate: fetchDuplicate, isPending: isFetchingDuplicate } = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await fetch(`/api/crm/companies/${companyId}`);
      if (!response.ok) throw new Error('Failed to fetch company');
      return response.json() as Promise<CrmCompany>;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'replace' | 'add_new' }) => {
      return await apiRequest('POST', `/api/crm/pending-companies/${id}/accept`, { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: "Company accepted and created successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to accept company", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/crm/pending-companies/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: "Pending company removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to remove company", variant: "destructive" });
    },
  });

  const bulkAcceptMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/crm/pending-companies/bulk/accept', { ids, mode: 'add_new' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: `${data.accepted} compan${data.accepted !== 1 ? 'ies' : 'y'} accepted` });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed to bulk accept companies", variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/crm/pending-companies/bulk/reject', { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: `${data.rejected} compan${data.rejected !== 1 ? 'ies' : 'y'} removed` });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed to bulk remove companies", variant: "destructive" });
    },
  });

  const handleAccept = async (pending: PendingCompany) => {
    setSelectedPending(pending);
    
    if (pending.suggestedDuplicates && Array.isArray(pending.suggestedDuplicates) && pending.suggestedDuplicates.length > 0) {
      const duplicateId = pending.suggestedDuplicates[0] as string;
      fetchDuplicate(duplicateId, {
        onSuccess: (existingCompany) => {
          setSelectedExisting(existingCompany);
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

  const handleEditDetails = () => {
    setShowDuplicatesDialog(false);
    setShowDetailDialog(true);
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

  const pendingCount = pendingItems.length;
  const isBulkPending = bulkAcceptMutation.isPending || bulkRejectMutation.isPending;

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
          <h1 className="text-2xl font-bold tracking-tight">Pending Companies Review</h1>
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
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
              <Checkbox
                checked={selectedIds.size === pendingItems.length && pendingItems.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
              </span>
            </div>
            <div className="divide-y">
              {pendingItems.map((pending) => {
                const hasDuplicates = pending.suggestedDuplicates?.length > 0;
                const initial = (pending.name || '?')[0].toUpperCase();
                const location = formatLocation(pending.city, pending.state);
                return (
                  <div
                    key={pending.id}
                    className={`flex items-start gap-4 px-4 py-3.5 cursor-pointer transition-colors hover:bg-muted/40 ${selectedIds.has(pending.id) ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''} ${hasDuplicates ? 'border-l-2 border-l-amber-400' : ''}`}
                    data-testid={`row-pending-company-${pending.id}`}
                    onClick={() => {
                      setSelectedPending(pending);
                      setShowDetailDialog(true);
                    }}
                  >
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(pending.id)}
                        onCheckedChange={() => toggleSelection(pending.id)}
                      />
                    </div>

                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate" data-testid={`text-company-name-${pending.id}`}>
                          {pending.name}
                        </span>
                        {pending.industry && (
                          <Badge variant="secondary" className="text-[10px] h-5 hidden sm:inline-flex">
                            {pending.industry}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {location !== 'N/A' && (
                          <span className="flex items-center gap-1" data-testid={`text-company-location-${pending.id}`}>
                            <MapPin className="h-3 w-3" />
                            {location}
                          </span>
                        )}
                        {pending.phone && (
                          <span className="flex items-center gap-1" data-testid={`text-company-phone-${pending.id}`}>
                            <Phone className="h-3 w-3" />
                            {pending.phone}
                          </span>
                        )}
                        {pending.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span className="truncate max-w-[180px]">{pending.website}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1" data-testid={`text-company-created-${pending.id}`}>
                          <Calendar className="h-3 w-3" />
                          {formatDate(pending.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px] h-5" data-testid={`text-company-source-${pending.id}`}>
                          <FileText className="h-2.5 w-2.5 mr-1" />
                          {pending.sourceType === 'dd_project' ? 'DD Project' : 
                           pending.sourceType === 'sales_comp' ? 'Sales Comp' :
                           pending.sourceType === 'contact_form' ? 'Contact Form' :
                           pending.sourceType || 'Import'}
                        </Badge>
                        {hasDuplicates && (
                          <Badge variant="destructive" className="text-[10px] h-5 gap-0.5" data-testid={`badge-duplicates-${pending.id}`}>
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {pending.suggestedDuplicates.length} Duplicate{pending.suggestedDuplicates.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(pending.id);
                        }}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-company-${pending.id}`}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(pending);
                        }}
                        data-testid={`button-accept-company-${pending.id}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        itemLabel="company"
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
        entityType="company"
        pendingEntity={selectedPending}
        existingEntity={selectedExisting}
        onAccept={handleAcceptWithMode}
        onReject={handleReject}
        onEditDetails={handleEditDetails}
        isLoading={acceptMutation.isPending || rejectMutation.isPending}
      />

      <PendingCompanyDetailDialog
        pending={selectedPending}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </div>
  );
}

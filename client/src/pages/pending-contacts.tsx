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
import { Check, X, AlertTriangle, User, Mail, Phone, Calendar, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import DuplicateResolutionModal from "@/components/modals/duplicate-resolution-modal";
import type { PendingContact, CrmContact } from "@shared/schema";

export default function PendingContacts() {
  const [selectedPending, setSelectedPending] = useState<PendingContact | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<CrmContact | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingContacts = [], isLoading } = useQuery<PendingContact[]>({
    queryKey: ['/api/crm/pending-contacts'],
    refetchInterval: 30000,
  });

  const { mutate: fetchDuplicate, isPending: isFetchingDuplicate } = useMutation({
    mutationFn: async (contactId: string) => {
      const response = await fetch(`/api/crm/contacts/${contactId}`);
      if (!response.ok) throw new Error('Failed to fetch contact');
      return response.json() as Promise<CrmContact>;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'replace' | 'add_new' }) => {
      return await apiRequest('POST', `/api/crm/pending-contacts/${id}/accept`, { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      toast({ title: "Contact accepted and created successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to accept contact", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/crm/pending-contacts/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-contacts'] });
      toast({ title: "Pending contact removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
      setSelectedExisting(null);
    },
    onError: () => {
      toast({ title: "Failed to remove contact", variant: "destructive" });
    },
  });

  const handleAccept = async (pending: PendingContact) => {
    setSelectedPending(pending);
    
    if (pending.suggestedDuplicates && Array.isArray(pending.suggestedDuplicates) && pending.suggestedDuplicates.length > 0) {
      const duplicateId = pending.suggestedDuplicates[0] as string;
      fetchDuplicate(duplicateId, {
        onSuccess: (existingContact) => {
          setSelectedExisting(existingContact);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const pendingCount = pendingContacts.filter(c => c.status === 'pending').length;

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
          <h1 className="text-3xl font-bold tracking-tight">Pending Contacts Review</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve contacts from various sources
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
            No pending contacts to review. New contacts from imports will appear here.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Contacts</CardTitle>
            <CardDescription>
              Accept to create a new Contact record, or Remove if this is a duplicate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-center">Potential Duplicates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingContacts
                  .filter(c => c.status === 'pending')
                  .map((pending) => (
                    <TableRow
                      key={pending.id}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-pending-contact-${pending.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2" data-testid={`text-contact-name-${pending.id}`}>
                          <User className="h-4 w-4 text-muted-foreground" />
                          {pending.fullName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-contact-email-${pending.id}`}>
                          {pending.email ? (
                            <>
                              <Mail className="h-3 w-3" />
                              {pending.email}
                            </>
                          ) : (
                            <span className="text-xs">N/A</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-contact-phone-${pending.id}`}>
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
                        <div className="flex items-center gap-1 text-sm" data-testid={`text-contact-source-${pending.id}`}>
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {pending.sourceType === 'sales_comp' && pending.sourceId ? (
                            <a
                              href={`/analysis/sales-comps`}
                              className="text-blue-600 hover:underline text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Sales Comp
                            </a>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {pending.sourceType === 'dd_project' ? 'DD Project' : 
                               pending.sourceType === 'sales_comp' ? 'Sales Comp' :
                               pending.sourceType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-contact-created-${pending.id}`}>
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
                              setSelectedPending(pending);
                              handleReject();
                            }}
                            data-testid={`button-reject-contact-${pending.id}`}
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
                            data-testid={`button-accept-contact-${pending.id}`}
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
        entityType="contact"
        pendingEntity={selectedPending}
        existingEntity={selectedExisting}
        onAccept={handleAcceptWithMode}
        onReject={handleReject}
        isLoading={acceptMutation.isPending || rejectMutation.isPending}
      />
    </div>
  );
}

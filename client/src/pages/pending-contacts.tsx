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
import { Check, X, AlertTriangle, User, Mail, Phone, Calendar, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type PendingContact = {
  id: string;
  orgId: string;
  sourceType: string;
  sourceId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  jobTitle: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  sourceMetadata: Record<string, any>;
  suggestedDuplicates: string[];
  createdContactId: string | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
};

export default function PendingContacts() {
  const [selectedPending, setSelectedPending] = useState<PendingContact | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingContacts = [], isLoading } = useQuery<PendingContact[]>({
    queryKey: ['/api/pending-contacts'],
    refetchInterval: 30000,
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-contacts/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact accepted and created successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to accept contact", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/pending-contacts/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-contacts'] });
      toast({ title: "Pending contact removed" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to remove contact", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ pendingId, contactId }: { pendingId: string; contactId: string }) => {
      return await apiRequest('POST', `/api/pending-contacts/${pendingId}/merge`, { contactId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact merged successfully" });
      setShowDuplicatesDialog(false);
      setSelectedPending(null);
    },
    onError: () => {
      toast({ title: "Failed to merge contact", variant: "destructive" });
    },
  });

  const handleAccept = (pending: PendingContact) => {
    if (pending.suggestedDuplicates && pending.suggestedDuplicates.length > 0) {
      setSelectedPending(pending);
      setShowDuplicatesDialog(true);
    } else {
      if (confirm(`Accept "${pending.fullName}" as a new contact?`)) {
        acceptMutation.mutate(pending.id);
      }
    }
  };

  const handleReject = (pending: PendingContact) => {
    if (confirm(`Remove "${pending.fullName}" from pending contacts?`)) {
      rejectMutation.mutate(pending.id);
    }
  };

  const handleMerge = (contactId: string) => {
    if (selectedPending) {
      mergeMutation.mutate({ pendingId: selectedPending.id, contactId });
    }
  };

  const confirmAccept = () => {
    if (selectedPending) {
      acceptMutation.mutate(selectedPending.id);
    }
  };

  const getSuggestedContacts = (duplicateIds: string[]) => {
    return contacts.filter(c => duplicateIds.includes(c.id));
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
                          <Badge variant="outline" className="text-xs">
                            {pending.sourceType}
                          </Badge>
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
                              handleReject(pending);
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

      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Potential Duplicate Contacts Found
            </DialogTitle>
            <DialogDescription>
              We found {selectedPending?.suggestedDuplicates?.length || 0} existing contacts that might match "{selectedPending?.fullName}". 
              Review these before accepting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">New Contact:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {selectedPending?.fullName}
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> {selectedPending?.email || 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span> {selectedPending?.phone || 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">Job Title:</span> {selectedPending?.jobTitle || 'N/A'}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Existing Contacts:</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {getSuggestedContacts(selectedPending?.suggestedDuplicates || []).map((contact) => (
                  <div
                    key={contact.id}
                    className="border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{contact.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          {contact.email || 'No email'} • {contact.phone || 'No phone'}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMerge(contact.id)}
                        disabled={mergeMutation.isPending}
                        data-testid={`button-merge-contact-${contact.id}`}
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

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  X,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Briefcase,
  GitMerge,
  Trash2,
  Edit2,
  Save,
  FileText,
  Calendar,
  Building2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingContact, CrmContact } from "@shared/schema";

interface DuplicateMatch {
  existingEntity: CrmContact;
  confidenceScore: number;
  matchedFields: string[];
  matchReasons: string[];
}

interface PendingContactDetailDialogProps {
  pending: PendingContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingContactDetailDialog({
  pending,
  open,
  onOpenChange,
}: PendingContactDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<PendingContact>>({});
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: duplicateContacts = [], isLoading: duplicatesLoading } = useQuery<CrmContact[]>({
    queryKey: ['/api/crm/pending-contacts', pending?.id, 'duplicates'],
    queryFn: async () => {
      if (!pending?.id) return [];
      try {
        const response = await fetch(`/api/pending-contacts/${pending.id}/all-duplicates`);
        if (!response.ok) return [];
        const matches = await response.json();
        return matches.map((m: any) => m.contact);
      } catch {
        return [];
      }
    },
    enabled: !!pending?.id && open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PendingContact>) => {
      return await apiRequest('PATCH', `/api/pending-contacts/${pending?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-contacts'] });
      toast({ title: "Contact details updated" });
      setIsEditing(false);
      setEditedData({});
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'replace' | 'add_new' }) => {
      return await apiRequest('POST', `/api/crm/pending-contacts/${id}/accept`, { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: "Contact approved and added to CRM" });
      onOpenChange(false);
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
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({ title: "Pending contact removed" });
      onOpenChange(false);
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
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      toast({ title: "Contact merged successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to merge contact", variant: "destructive" });
    },
  });

  if (!pending) return null;

  const currentData = isEditing ? { ...pending, ...editedData } : pending;
  const sourceMetadata = (pending.sourceMetadata || {}) as Record<string, any>;

  const handleSaveEdit = () => {
    updateMutation.mutate(editedData);
  };

  const handleMerge = () => {
    if (!selectedDuplicateId) {
      toast({ title: "Please select a contact to merge with", variant: "destructive" });
      return;
    }
    mergeMutation.mutate({ pendingId: pending.id, contactId: selectedDuplicateId });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadge = (role?: string) => {
    if (!role) return null;
    const labels: Record<string, string> = {
      seller_principal: 'Seller Principal',
      buyer_principal: 'Buyer Principal',
      agent: 'Agent/Broker',
      broker: 'Broker',
    };
    return (
      <Badge variant="outline" className="text-xs">
        {labels[role] || role}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {currentData.fullName || `${currentData.firstName || ''} ${currentData.lastName || ''}`.trim() || 'Unnamed Contact'}
              {getRoleBadge(sourceMetadata?.role)}
            </DialogTitle>
            <DialogDescription>
              Review contact details, edit information, and approve or remove
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="source">Source Info</TabsTrigger>
              <TabsTrigger value="duplicates">
                <div className="flex items-center gap-2">
                  Duplicates
                  {duplicatesLoading ? (
                    <Badge variant="secondary" className="ml-1">...</Badge>
                  ) : duplicateContacts.length > 0 ? (
                    <Badge variant="destructive" className="ml-1">
                      {duplicateContacts.length}
                    </Badge>
                  ) : null}
                </div>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="details" className="mt-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditedData({}); }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <div className="p-4 border-b border-border">
                      <h4 className="font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Identity
                      </h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.firstName || ''}
                              onChange={(e) => setEditedData({ ...editedData, firstName: e.target.value })}
                              placeholder="John"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.firstName || 'N/A'}</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.lastName || ''}
                              onChange={(e) => setEditedData({ ...editedData, lastName: e.target.value })}
                              placeholder="Smith"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="p-2 bg-muted rounded text-sm">{currentData.lastName || 'N/A'}</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        {isEditing ? (
                          <Input
                            value={currentData.fullName || ''}
                            onChange={(e) => setEditedData({ ...editedData, fullName: e.target.value })}
                            placeholder="John Smith"
                            className="bg-white dark:bg-slate-900"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.fullName || 'N/A'}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Job Title</Label>
                        {isEditing ? (
                          <Input
                            value={currentData.jobTitle || ''}
                            onChange={(e) => setEditedData({ ...editedData, jobTitle: e.target.value })}
                            placeholder="Marina Manager"
                            className="bg-white dark:bg-slate-900"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm">{currentData.jobTitle || 'N/A'}</div>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-4 border-b border-border">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Contact Details
                      </h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        {isEditing ? (
                          <Input
                            type="email"
                            value={currentData.email || ''}
                            onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                            placeholder="john@example.com"
                            className="bg-white dark:bg-slate-900"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
                            {currentData.email ? (
                              <>
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {currentData.email}
                              </>
                            ) : 'N/A'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Phone</Label>
                        {isEditing ? (
                          <Input
                            type="tel"
                            value={currentData.phone || ''}
                            onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                            placeholder="(555) 123-4567"
                            className="bg-white dark:bg-slate-900"
                          />
                        ) : (
                          <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
                            {currentData.phone ? (
                              <>
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {currentData.phone}
                              </>
                            ) : 'N/A'}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                <Separator className="my-6" />

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowAcceptDialog(true)}
                    disabled={acceptMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve to CRM
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="source" className="mt-0">
                <Card>
                  <div className="p-4 border-b border-border">
                    <h4 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Source Information
                    </h4>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Source Type</Label>
                        <div className="p-2 bg-muted rounded text-sm">
                          <Badge variant="outline">
                            {pending.sourceType === 'sales_comp' ? 'Sales Comp' :
                             pending.sourceType === 'dd_project' ? 'Due Diligence' :
                             pending.sourceType}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Role</Label>
                        <div className="p-2 bg-muted rounded text-sm">
                          {getRoleBadge(sourceMetadata?.role) || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {sourceMetadata?.marina && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Related Marina</Label>
                        <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {sourceMetadata.marina}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Created</Label>
                      <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(pending.createdAt)}
                      </div>
                    </div>

                    {pending.sourceId && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Source Record ID</Label>
                        <div className="p-2 bg-muted rounded text-sm font-mono text-xs">{pending.sourceId}</div>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="duplicates" className="mt-0">
                {duplicatesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Checking for duplicates...</div>
                  </div>
                ) : duplicateContacts.length === 0 ? (
                  <Card className="p-6 text-center">
                    <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No duplicate contacts found. This appears to be a unique contact.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      The following existing contacts may be duplicates. You can merge this pending contact with an existing one.
                    </p>

                    {duplicateContacts.map((dup) => (
                      <Card
                        key={dup.id}
                        className={`cursor-pointer transition-all ${selectedDuplicateId === dup.id ? 'ring-2 ring-primary border-primary' : 'hover:border-muted-foreground/30'}`}
                        onClick={() => setSelectedDuplicateId(selectedDuplicateId === dup.id ? null : dup.id)}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {dup.firstName} {dup.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {dup.email || 'No email'} {dup.phone ? `| ${dup.phone}` : ''}
                                </div>
                              </div>
                            </div>
                            {selectedDuplicateId === dup.id && (
                              <Badge variant="default" className="bg-primary">
                                <Check className="h-3 w-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                          </div>
                          {dup.jobTitle && (
                            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {dup.jobTitle}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}

                    <Separator className="my-4" />

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!selectedDuplicateId || mergeMutation.isPending}
                        onClick={handleMerge}
                      >
                        <GitMerge className="h-4 w-4 mr-2" />
                        Merge with Selected
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Contact</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new contact record in your CRM for "{currentData.fullName || `${currentData.firstName || ''} ${currentData.lastName || ''}`.trim()}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => acceptMutation.mutate({ id: pending.id, mode: 'add_new' })}
              disabled={acceptMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pending Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this pending contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate(pending.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejectMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

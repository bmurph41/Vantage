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
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  Anchor,
  Link2,
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

function SectionHeader({ icon: Icon, title, accent = "slate" }: { icon: any; title: string; accent?: string }) {
  const accentMap: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    emerald: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    purple: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  };
  const borderMap: Record<string, string> = {
    blue: "border-l-blue-500",
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    purple: "border-l-purple-500",
    slate: "border-l-slate-400",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 border-l-[3px] ${borderMap[accent] || borderMap.slate} bg-slate-50/50 dark:bg-slate-800/30 rounded-t-lg`}>
      <div className={`p-1 rounded-md ${accentMap[accent] || accentMap.slate}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <h4 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
    </div>
  );
}

function FieldDisplay({ label, value, suffix }: { label: string; value: any; suffix?: string }) {
  const displayVal = value === null || value === undefined || value === '' ? 'N/A' : String(value);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-100">
        {displayVal}{suffix && displayVal !== 'N/A' ? suffix : ''}
      </div>
    </div>
  );
}

export function PendingContactDetailDialog({
  pending,
  open,
  onOpenChange,
}: PendingContactDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<PendingContact>>({});
  const [editedMetadata, setEditedMetadata] = useState<Record<string, any>>({});
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: duplicateMatches = [], isLoading: duplicatesLoading } = useQuery<Array<{ contact: CrmContact; score: number }>>({
    queryKey: ['/api/crm/pending-contacts', pending?.id, 'duplicates'],
    queryFn: async () => {
      if (!pending?.id) return [];
      try {
        const response = await fetch(`/api/pending-contacts/${pending.id}/all-duplicates`);
        if (!response.ok) return [];
        return await response.json();
      } catch {
        return [];
      }
    },
    enabled: !!pending?.id && open,
  });
  const duplicateContacts = duplicateMatches.map(m => m.contact);

  const { data: pendingCompanies = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pending-companies'],
    enabled: !!pending && open,
  });

  const { data: pendingProperties = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pending-properties'],
    enabled: !!pending && open,
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
      setEditedMetadata({});
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
  const currentMetadata = isEditing ? { ...sourceMetadata, ...editedMetadata } : sourceMetadata;

  const handleSaveEdit = () => {
    const payload: Partial<PendingContact> = { ...editedData };
    if (Object.keys(editedMetadata).length > 0) {
      (payload as any).sourceMetadata = { ...sourceMetadata, ...editedMetadata };
    }
    updateMutation.mutate(payload);
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
      <Badge variant="outline" className="text-[10px]">
        {labels[role] || role}
      </Badge>
    );
  };

  const relatedCompanies = (Array.isArray(pendingCompanies) ? pendingCompanies : []).filter((c: any) => {
    if (!c || c.id === pending.id) return false;
    if (pending.sourceId && c.sourceId && c.sourceId === pending.sourceId) return true;
    if (sourceMetadata?.marina && c.sourceMetadata?.marina && c.sourceMetadata.marina === sourceMetadata.marina) return true;
    return false;
  });

  const relatedProperties = (Array.isArray(pendingProperties) ? pendingProperties : []).filter((p: any) => {
    if (!p) return false;
    if (pending.sourceId && p.sourceId && p.sourceId === pending.sourceId) return true;
    if (sourceMetadata?.marina && p.marinaName && p.marinaName === sourceMetadata.marina) return true;
    if (sourceMetadata?.marina && p.sourceMetadata?.marina && p.sourceMetadata.marina === sourceMetadata.marina) return true;
    return false;
  });

  const contactTagOptions = [
    { value: "lead", label: "Lead" },
    { value: "seller", label: "Seller" },
    { value: "competitor", label: "Competitor" },
    { value: "broker", label: "Broker" },
    { value: "vendor", label: "Vendor" },
    { value: "insurance", label: "Insurance" },
    { value: "lender", label: "Lender" },
    { value: "attorney", label: "Attorney" },
    { value: "other", label: "Other" },
  ];

  const leadSourceOptions = [
    { value: "website", label: "Website" },
    { value: "referral", label: "Referral" },
    { value: "trade_show", label: "Trade Show" },
    { value: "cold_call", label: "Cold Call" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "other", label: "Other" },
  ];

  const commPrefOptions = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "text", label: "Text" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg flex items-center gap-2">
                    {currentData.fullName || `${currentData.firstName || ''} ${currentData.lastName || ''}`.trim() || 'Unnamed Contact'}
                    {getRoleBadge(sourceMetadata?.role)}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Review contact details, edit information, and approve or remove
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditedData({}); setEditedMetadata({}); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Save
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="source">Source Info</TabsTrigger>
              <TabsTrigger value="duplicates">
                <div className="flex items-center gap-2">
                  Duplicates
                  {duplicatesLoading ? (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">...</Badge>
                  ) : duplicateContacts.length > 0 ? (
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                      {duplicateContacts.length}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Check className="h-2.5 w-2.5 mr-0.5" />
                      None
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="details" className="mt-0">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={User} title="Identity" accent="blue" />
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">First Name</Label>
                            {isEditing ? (
                              <Input
                                value={currentData.firstName || ''}
                                onChange={(e) => setEditedData({ ...editedData, firstName: e.target.value })}
                                placeholder="John"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentData.firstName} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Last Name</Label>
                            {isEditing ? (
                              <Input
                                value={currentData.lastName || ''}
                                onChange={(e) => setEditedData({ ...editedData, lastName: e.target.value })}
                                placeholder="Smith"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentData.lastName} />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Full Name</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.fullName || ''}
                              onChange={(e) => setEditedData({ ...editedData, fullName: e.target.value })}
                              placeholder="John Smith"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <FieldDisplay label="" value={currentData.fullName} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Address</Label>
                          {isEditing ? (
                            <Input
                              value={currentMetadata.address || ''}
                              onChange={(e) => setEditedMetadata({ ...editedMetadata, address: e.target.value })}
                              placeholder="123 Marina Dr"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <FieldDisplay label="" value={currentMetadata.address} />
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">City</Label>
                            {isEditing ? (
                              <Input
                                value={currentMetadata.city || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, city: e.target.value })}
                                placeholder="San Diego"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.city} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">State</Label>
                            {isEditing ? (
                              <Input
                                value={currentMetadata.state || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, state: e.target.value })}
                                placeholder="CA"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.state} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Zip</Label>
                            {isEditing ? (
                              <Input
                                value={currentMetadata.zip || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, zip: e.target.value })}
                                placeholder="92101"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.zip} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={Mail} title="Contact Details" accent="emerald" />
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          {isEditing ? (
                            <Input
                              type="email"
                              value={currentData.email || ''}
                              onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                              placeholder="john@example.com"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm flex items-center gap-2">
                              {currentData.email ? (
                                <>
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {currentData.email}
                                </>
                              ) : 'N/A'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone</Label>
                          {isEditing ? (
                            <Input
                              type="tel"
                              value={currentData.phone || ''}
                              onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                              placeholder="(555) 123-4567"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm flex items-center gap-2">
                              {currentData.phone ? (
                                <>
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {currentData.phone}
                                </>
                              ) : 'N/A'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Communication Preference</Label>
                          {isEditing ? (
                            <Select
                              value={currentMetadata.communicationPreference || ''}
                              onValueChange={(val) => setEditedMetadata({ ...editedMetadata, communicationPreference: val })}
                            >
                              <SelectTrigger className="bg-white dark:bg-slate-900">
                                <SelectValue placeholder="Select preference..." />
                              </SelectTrigger>
                              <SelectContent>
                                {commPrefOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <FieldDisplay label="" value={commPrefOptions.find(o => o.value === currentMetadata.communicationPreference)?.label || currentMetadata.communicationPreference} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">LinkedIn URL</Label>
                          {isEditing ? (
                            <Input
                              value={currentMetadata.linkedinUrl || ''}
                              onChange={(e) => setEditedMetadata({ ...editedMetadata, linkedinUrl: e.target.value })}
                              placeholder="https://linkedin.com/in/..."
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm flex items-center gap-2">
                              {currentMetadata.linkedinUrl ? (
                                <>
                                  <Link2 className="h-3 w-3 text-muted-foreground" />
                                  <a href={currentMetadata.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                                    {currentMetadata.linkedinUrl}
                                  </a>
                                </>
                              ) : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={Briefcase} title="Professional" accent="amber" />
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Job Title</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.jobTitle || ''}
                              onChange={(e) => setEditedData({ ...editedData, jobTitle: e.target.value })}
                              placeholder="Marina Manager"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <FieldDisplay label="" value={currentData.jobTitle} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Company Name</Label>
                          {isEditing ? (
                            <Input
                              value={currentMetadata.companyName || ''}
                              onChange={(e) => setEditedMetadata({ ...editedMetadata, companyName: e.target.value })}
                              placeholder="Marina Corp"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <FieldDisplay label="" value={currentMetadata.companyName} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Contact Tag</Label>
                          {isEditing ? (
                            <Select
                              value={currentMetadata.contactTag || ''}
                              onValueChange={(val) => setEditedMetadata({ ...editedMetadata, contactTag: val })}
                            >
                              <SelectTrigger className="bg-white dark:bg-slate-900">
                                <SelectValue placeholder="Select tag..." />
                              </SelectTrigger>
                              <SelectContent>
                                {contactTagOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <FieldDisplay label="" value={contactTagOptions.find(o => o.value === currentMetadata.contactTag)?.label || currentMetadata.contactTag} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lead Source</Label>
                          {isEditing ? (
                            <Select
                              value={currentMetadata.leadSource || ''}
                              onValueChange={(val) => setEditedMetadata({ ...editedMetadata, leadSource: val })}
                            >
                              <SelectTrigger className="bg-white dark:bg-slate-900">
                                <SelectValue placeholder="Select source..." />
                              </SelectTrigger>
                              <SelectContent>
                                {leadSourceOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <FieldDisplay label="" value={leadSourceOptions.find(o => o.value === currentMetadata.leadSource)?.label || currentMetadata.leadSource} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          {isEditing ? (
                            <Textarea
                              value={currentMetadata.notes || ''}
                              onChange={(e) => setEditedMetadata({ ...editedMetadata, notes: e.target.value })}
                              placeholder="Additional notes..."
                              rows={3}
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm min-h-[2rem]">
                              {currentMetadata.notes || 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={Link2} title="Related Items" accent="purple" />
                      <div className="p-4 space-y-3">
                        {relatedCompanies.length === 0 && relatedProperties.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-2">No related items found</div>
                        ) : (
                          <>
                            {relatedCompanies.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Pending Companies</Label>
                                <div className="space-y-1.5">
                                  {relatedCompanies.map((company: any) => (
                                    <div key={company.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md">
                                      <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      <span className="text-sm truncate flex-1">{company.companyName || company.name || 'Unnamed'}</span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{company.status || 'pending'}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {relatedProperties.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Pending Properties</Label>
                                <div className="space-y-1.5">
                                  {relatedProperties.map((property: any) => (
                                    <div key={property.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md">
                                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      <span className="text-sm truncate flex-1">{property.marinaName || property.name || 'Unnamed'}</span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{property.status || 'pending'}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
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
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                  <SectionHeader icon={FileText} title="Source Information" accent="slate" />
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Source Type</Label>
                        <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm">
                          <Badge variant="outline" className="text-[10px]">
                            {pending.sourceType === 'sales_comp' ? 'Sales Comp' :
                             pending.sourceType === 'dd_project' ? 'Due Diligence' :
                             pending.sourceType}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Role</Label>
                        <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm">
                          {getRoleBadge(sourceMetadata?.role) || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {sourceMetadata?.marina && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Related Marina</Label>
                        <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm flex items-center gap-2">
                          <Anchor className="h-4 w-4 text-muted-foreground" />
                          {sourceMetadata.marina}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Created</Label>
                      <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(pending.createdAt)}
                      </div>
                    </div>

                    {pending.sourceId && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Source Record ID</Label>
                        <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-mono text-xs">{pending.sourceId}</div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="duplicates" className="mt-0">
                {duplicatesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Checking for duplicates...</div>
                  </div>
                ) : duplicateContacts.length === 0 ? (
                  <div className="rounded-lg border border-green-200 dark:border-green-800 p-6 text-center bg-green-50/50 dark:bg-green-950/20">
                    <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-green-800 dark:text-green-300 mb-1">No Match</p>
                    <p className="text-sm text-muted-foreground">No duplicate contacts found in your CRM. This appears to be a unique contact.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      The following existing contacts may be duplicates. You can merge this pending contact with an existing one.
                    </p>

                    {duplicateMatches.map(({ contact: dup, score }) => (
                      <div
                        key={dup.id}
                        className={`cursor-pointer transition-all rounded-lg border p-4 ${selectedDuplicateId === dup.id ? 'ring-2 ring-primary border-primary' : 'border-slate-200 dark:border-slate-700 hover:border-muted-foreground/30'} bg-white dark:bg-slate-900`}
                        onClick={() => setSelectedDuplicateId(selectedDuplicateId === dup.id ? null : dup.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {dup.firstName} {dup.lastName}
                                <Badge variant={score >= 100 ? "destructive" : score >= 60 ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                  {score >= 100 ? 'Exact' : score >= 60 ? 'Strong' : 'Partial'} Match
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {dup.email || 'No email'} {dup.phone ? `| ${dup.phone}` : ''}
                              </div>
                            </div>
                          </div>
                          {selectedDuplicateId === dup.id && (
                            <Badge variant="default" className="bg-primary text-[10px]">
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

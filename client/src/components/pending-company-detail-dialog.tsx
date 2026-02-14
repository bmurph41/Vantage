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
  Building2,
  MapPin,
  Phone,
  Globe,
  GitMerge,
  Edit2,
  Save,
  FileText,
  Calendar,
  Briefcase,
  BarChart3,
  Link2,
  User,
  Anchor,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingCompany, CrmCompany } from "@shared/schema";

interface PendingCompanyDetailDialogProps {
  pending: PendingCompany | null;
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

export function PendingCompanyDetailDialog({
  pending,
  open,
  onOpenChange,
}: PendingCompanyDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<PendingCompany>>({});
  const [editedMetadata, setEditedMetadata] = useState<Record<string, any>>({});
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: duplicateCompanies = [], isLoading: duplicatesLoading } = useQuery<CrmCompany[]>({
    queryKey: ['/api/crm/pending-companies', pending?.id, 'duplicates'],
    queryFn: async () => {
      if (!pending?.id) return [];
      try {
        const response = await fetch(`/api/pending-companies/${pending.id}/all-duplicates`);
        if (!response.ok) return [];
        const matches = await response.json();
        return matches.map((m: any) => m.company);
      } catch {
        return [];
      }
    },
    enabled: !!pending?.id && open,
  });

  const { data: pendingContacts = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pending-contacts'],
    enabled: !!pending && open,
  });

  const { data: pendingProperties = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pending-properties'],
    enabled: !!pending && open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PendingCompany>) => {
      return await apiRequest('PATCH', `/api/pending-companies/${pending?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      toast({ title: "Company details updated" });
      setIsEditing(false);
      setEditedData({});
      setEditedMetadata({});
    },
    onError: () => {
      toast({ title: "Failed to update company", variant: "destructive" });
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
      toast({ title: "Company approved and added to CRM" });
      onOpenChange(false);
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
      onOpenChange(false);
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
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      toast({ title: "Company merged successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to merge company", variant: "destructive" });
    },
  });

  if (!pending) return null;

  const currentData = isEditing ? { ...pending, ...editedData } : pending;
  const sourceMetadata = (pending.sourceMetadata || {}) as Record<string, any>;
  const currentMetadata = isEditing ? { ...sourceMetadata, ...editedMetadata } : sourceMetadata;

  const handleSaveEdit = () => {
    const payload: Partial<PendingCompany> = { ...editedData };
    if (Object.keys(editedMetadata).length > 0) {
      (payload as any).sourceMetadata = { ...sourceMetadata, ...editedMetadata };
    }
    updateMutation.mutate(payload);
  };

  const handleMerge = () => {
    if (!selectedDuplicateId) {
      toast({ title: "Please select a company to merge with", variant: "destructive" });
      return;
    }
    mergeMutation.mutate({ pendingId: pending.id, companyId: selectedDuplicateId });
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
      seller: 'Seller Company',
      buyer: 'Buyer Company',
      brokerage: 'Brokerage',
    };
    return (
      <Badge variant="outline" className="text-[10px]">
        {labels[role] || role}
      </Badge>
    );
  };

  const formatLocation = (city: string | null, state: string | null) => {
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return '';
  };

  const relatedContacts = (Array.isArray(pendingContacts) ? pendingContacts : []).filter((c: any) => {
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

  const acquisitionInterestOptions = [
    { value: "hot", label: "Hot" },
    { value: "warm", label: "Warm" },
    { value: "cold", label: "Cold" },
    { value: "none", label: "None" },
    { value: "unknown", label: "Unknown" },
  ];

  const locationSubtitle = formatLocation(currentData.city, currentData.state);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg flex items-center gap-2">
                    {currentData.name}
                    {getRoleBadge(sourceMetadata?.role)}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    {locationSubtitle || 'Review company details, edit information, and approve or remove'}
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
                  ) : duplicateCompanies.length > 0 ? (
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                      {duplicateCompanies.length}
                    </Badge>
                  ) : null}
                </div>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="details" className="mt-0">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={Building2} title="Identity" accent="blue" />
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Company Name *</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.name}
                              onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                              placeholder="Acme Marina Holdings"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium">{currentData.name}</div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Industry</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.industry || ''}
                              onChange={(e) => setEditedData({ ...editedData, industry: e.target.value })}
                              placeholder="Marina & Marine Services"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <FieldDisplay label="" value={currentData.industry} />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Website</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.website || ''}
                              onChange={(e) => setEditedData({ ...editedData, website: e.target.value })}
                              placeholder="https://www.example.com"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm flex items-center gap-2">
                              {currentData.website ? (
                                <>
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                  {currentData.website}
                                </>
                              ) : 'N/A'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          {isEditing ? (
                            <Textarea
                              value={currentMetadata.description || ''}
                              onChange={(e) => setEditedMetadata({ ...editedMetadata, description: e.target.value })}
                              placeholder="Company description..."
                              rows={3}
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm min-h-[2rem]">
                              {currentMetadata.description || 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={MapPin} title="Location & Contact" accent="emerald" />
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Address</Label>
                          {isEditing ? (
                            <Input
                              value={currentData.address || ''}
                              onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                              placeholder="123 Harbor Way"
                              className="bg-white dark:bg-slate-900"
                            />
                          ) : (
                            <FieldDisplay label="" value={currentData.address} />
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">City</Label>
                            {isEditing ? (
                              <Input
                                value={currentData.city || ''}
                                onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                                placeholder="San Diego"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentData.city} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">State</Label>
                            {isEditing ? (
                              <Input
                                value={currentData.state || ''}
                                onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
                                placeholder="CA"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentData.state} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Zip Code</Label>
                            {isEditing ? (
                              <Input
                                value={currentData.zipCode || ''}
                                onChange={(e) => setEditedData({ ...editedData, zipCode: e.target.value })}
                                placeholder="92101"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentData.zipCode} />
                            )}
                          </div>
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
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={BarChart3} title="Business Details" accent="amber" />
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Annual Revenue</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={currentMetadata.annualRevenue || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, annualRevenue: e.target.value ? Number(e.target.value) : undefined })}
                                placeholder="5000000"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.annualRevenue} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Employee Count</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={currentMetadata.employeeCount || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, employeeCount: e.target.value ? Number(e.target.value) : undefined })}
                                placeholder="50"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.employeeCount} />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Acquisition Interest</Label>
                          {isEditing ? (
                            <Select
                              value={currentMetadata.acquisitionInterest || ''}
                              onValueChange={(val) => setEditedMetadata({ ...editedMetadata, acquisitionInterest: val })}
                            >
                              <SelectTrigger className="bg-white dark:bg-slate-900">
                                <SelectValue placeholder="Select interest level..." />
                              </SelectTrigger>
                              <SelectContent>
                                {acquisitionInterestOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <FieldDisplay label="" value={acquisitionInterestOptions.find(o => o.value === currentMetadata.acquisitionInterest)?.label || currentMetadata.acquisitionInterest} />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Portfolio Count</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={currentMetadata.portfolioCount || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, portfolioCount: e.target.value ? Number(e.target.value) : undefined })}
                                placeholder="12"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.portfolioCount} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Capital Partner</Label>
                            {isEditing ? (
                              <Input
                                value={currentMetadata.capitalPartner || ''}
                                onChange={(e) => setEditedMetadata({ ...editedMetadata, capitalPartner: e.target.value })}
                                placeholder="Partner name"
                                className="bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <FieldDisplay label="" value={currentMetadata.capitalPartner} />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">LinkedIn URL</Label>
                          {isEditing ? (
                            <Input
                              value={currentMetadata.linkedinUrl || ''}
                              onChange={(e) => setEditedMetadata({ ...editedMetadata, linkedinUrl: e.target.value })}
                              placeholder="https://linkedin.com/company/..."
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

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                      <SectionHeader icon={Link2} title="Related Items" accent="purple" />
                      <div className="p-4 space-y-3">
                        {relatedContacts.length === 0 && relatedProperties.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-2">No related items found</div>
                        ) : (
                          <>
                            {relatedContacts.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Pending Contacts</Label>
                                <div className="space-y-1.5">
                                  {relatedContacts.map((contact: any) => (
                                    <div key={contact.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md">
                                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      <span className="text-sm truncate flex-1">{contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed'}</span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{contact.status || 'pending'}</Badge>
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
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={rejectMutation.isPending}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
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
                             pending.sourceType === 'contact_form' ? 'Contact Form' :
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

                    {sourceMetadata?.salesCompId && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Sales Comp ID</Label>
                        <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-mono text-xs">{sourceMetadata.salesCompId}</div>
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
                ) : duplicateCompanies.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center bg-white dark:bg-slate-900">
                    <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No duplicate companies found. This appears to be a unique company.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      The following existing companies may be duplicates. You can merge this pending company with an existing one.
                    </p>

                    {duplicateCompanies.map((dup) => (
                      <div
                        key={dup.id}
                        className={`cursor-pointer transition-all rounded-lg border p-4 ${selectedDuplicateId === dup.id ? 'ring-2 ring-primary border-primary' : 'border-slate-200 dark:border-slate-700 hover:border-muted-foreground/30'} bg-white dark:bg-slate-900`}
                        onClick={() => setSelectedDuplicateId(selectedDuplicateId === dup.id ? null : dup.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{dup.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatLocation(dup.city, dup.state) || 'No location'}
                                {dup.phone ? ` | ${dup.phone}` : ''}
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
                        {dup.website && (
                          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {dup.website}
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
            <AlertDialogTitle>Approve Company</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new company record in your CRM for "{currentData.name}".
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
            <AlertDialogTitle>Remove Pending Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this pending company? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate(pending.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejectMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

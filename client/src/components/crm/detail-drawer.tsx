import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  Mail,
  StickyNote,
  CheckSquare,
  Building2,
  User,
  Calendar,
  DollarSign,
  Edit,
  Save,
  X,
  Trash2,
  ExternalLink,
  FileText,
  Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Contact, Deal } from "@shared/schema";
import { FileUploader } from "./file-uploader";
import { FileList } from "./file-list";
import UnifiedTimeline from "./unified-timeline";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "contact" | "company" | "deal";
  entityId: string | null;
  onDelete?: () => void;
}

export function DetailDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  onDelete,
}: DetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch entity data
  const { data: entity, isLoading } = useQuery({
    queryKey: [`/api/${entityType}s`, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const response = await fetch(`/api/${entityType}s/${entityId}`);
      if (!response.ok) throw new Error(`Failed to fetch ${entityType}`);
      return response.json();
    },
    enabled: open && !!entityId,
  });

  // Fetch related company for contacts
  const { data: relatedCompany } = useQuery({
    queryKey: ['/api/companies', entity?.companyId],
    enabled: entityType === 'contact' && !!entity?.companyId,
  });

  // Fetch related contact for deals
  const { data: relatedContact } = useQuery({
    queryKey: ['/api/contacts', entity?.primaryContactId || entity?.contactId],
    enabled: entityType === 'deal' && !!(entity?.primaryContactId || entity?.contactId),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', `/api/${entityType}s/${entityId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s`] });
      toast({ title: `${entityType} updated successfully` });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: `Failed to update ${entityType}`,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/${entityType}s/${entityId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s`] });
      toast({ title: `${entityType} deleted successfully` });
      onOpenChange(false);
      onDelete?.();
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: `Failed to delete ${entityType}`,
        variant: "destructive",
      });
    },
  });

  // Initialize edit data when entity changes
  useEffect(() => {
    if (entity) {
      setEditData(entity);
    }
  }, [entity]);

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this ${entityType}?`)) {
      deleteMutation.mutate();
    }
  };

  const getEntityTitle = () => {
    if (!entity) return "";
    
    switch (entityType) {
      case "contact":
        return `${entity.firstName || ""} ${entity.lastName || ""}`.trim() || "Unnamed Contact";
      case "company":
        return entity.name || "Unnamed Company";
      case "deal":
        return entity.name || "Unnamed Deal";
      default:
        return "";
    }
  };

  const getEntitySubtitle = () => {
    if (!entity) return "";
    
    switch (entityType) {
      case "contact":
        return entity.title || entity.email || "";
      case "company":
        return entity.domain || entity.industry || "";
      case "deal":
        return entity.amount ? `$${entity.amount.toLocaleString()}` : "";
      default:
        return "";
    }
  };

  if (!entityId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-xl font-semibold">
                {getEntityTitle()}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground mt-1">
                {getEntitySubtitle()}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditData(entity);
                    }}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" data-testid="button-email">
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button size="sm" variant="outline" data-testid="button-call">
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>
            <Button size="sm" variant="outline" data-testid="button-note">
              <StickyNote className="h-4 w-4 mr-1" />
              Note
            </Button>
            <Button size="sm" variant="outline" data-testid="button-task">
              <CheckSquare className="h-4 w-4 mr-1" />
              Task
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">Files</TabsTrigger>
            <TabsTrigger value="custom" data-testid="tab-custom">Custom Fields</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="px-6 pb-6">
              <TabsContent value="overview" className="mt-4 space-y-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    {/* Contact Overview */}
                    {entityType === "contact" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>First Name</Label>
                            {isEditing ? (
                              <Input
                                value={editData.firstName || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, firstName: e.target.value })
                                }
                                data-testid="input-firstName"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-firstName">
                                {entity?.firstName || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Last Name</Label>
                            {isEditing ? (
                              <Input
                                value={editData.lastName || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, lastName: e.target.value })
                                }
                                data-testid="input-lastName"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-lastName">
                                {entity?.lastName || "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Email</Label>
                          {isEditing ? (
                            <Input
                              type="email"
                              value={editData.email || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, email: e.target.value })
                              }
                              data-testid="input-email"
                            />
                          ) : (
                            <div className="text-sm flex items-center gap-2" data-testid="text-email">
                              {entity?.email || "-"}
                              {entity?.email && (
                                <a
                                  href={`mailto:${entity.email}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Phone</Label>
                          {isEditing ? (
                            <Input
                              value={editData.phone || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, phone: e.target.value })
                              }
                              data-testid="input-phone"
                            />
                          ) : (
                            <div className="text-sm flex items-center gap-2" data-testid="text-phone">
                              {entity?.phone || "-"}
                              {entity?.phone && (
                                <a
                                  href={`tel:${entity.phone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Title</Label>
                          {isEditing ? (
                            <Input
                              value={editData.title || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, title: e.target.value })
                              }
                              data-testid="input-title"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-title">
                              {entity?.title || "-"}
                            </div>
                          )}
                        </div>

                        {relatedCompany && (
                          <div className="space-y-2">
                            <Label>Company</Label>
                            <div className="text-sm flex items-center gap-2" data-testid="text-company">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {relatedCompany.name}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Lifecycle Stage</Label>
                          {isEditing ? (
                            <Input
                              value={editData.lifecycleStage || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, lifecycleStage: e.target.value })
                              }
                              data-testid="input-lifecycleStage"
                            />
                          ) : (
                            <Badge variant="secondary" data-testid="badge-lifecycleStage">
                              {entity?.lifecycleStage || "Unknown"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Company Overview */}
                    {entityType === "company" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Company Name</Label>
                          {isEditing ? (
                            <Input
                              value={editData.name || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, name: e.target.value })
                              }
                              data-testid="input-name"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-name">
                              {entity?.name || "-"}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Domain</Label>
                          {isEditing ? (
                            <Input
                              value={editData.domain || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, domain: e.target.value })
                              }
                              data-testid="input-domain"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-domain">
                              {entity?.domain || "-"}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Industry</Label>
                          {isEditing ? (
                            <Input
                              value={editData.industry || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, industry: e.target.value })
                              }
                              data-testid="input-industry"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-industry">
                              {entity?.industry || "-"}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Phone</Label>
                          {isEditing ? (
                            <Input
                              value={editData.phone || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, phone: e.target.value })
                              }
                              data-testid="input-phone"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-phone">
                              {entity?.phone || "-"}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Website</Label>
                          {isEditing ? (
                            <Input
                              value={editData.website || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, website: e.target.value })
                              }
                              data-testid="input-website"
                            />
                          ) : (
                            <div className="text-sm flex items-center gap-2" data-testid="text-website">
                              {entity?.website || "-"}
                              {entity?.website && (
                                <a
                                  href={entity.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Deal Overview */}
                    {entityType === "deal" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Deal Name</Label>
                          {isEditing ? (
                            <Input
                              value={editData.name || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, name: e.target.value })
                              }
                              data-testid="input-name"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-name">
                              {entity?.name || "-"}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Amount</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.amount || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, amount: parseFloat(e.target.value) })
                                }
                                data-testid="input-amount"
                              />
                            ) : (
                              <div className="text-sm flex items-center gap-1" data-testid="text-amount">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                {entity?.amount?.toLocaleString() || "0"}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Close Date</Label>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editData.closeDate ? new Date(editData.closeDate).toISOString().split('T')[0] : ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, closeDate: new Date(e.target.value) })
                                }
                                data-testid="input-closeDate"
                              />
                            ) : (
                              <div className="text-sm flex items-center gap-1" data-testid="text-closeDate">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {entity?.closeDate ? new Date(entity.closeDate).toLocaleDateString() : "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Badge
                            variant={entity?.status === 'won' ? 'default' : entity?.status === 'lost' ? 'destructive' : 'secondary'}
                            data-testid="badge-status"
                          >
                            {entity?.status || "open"}
                          </Badge>
                        </div>

                        {relatedContact && (
                          <div className="space-y-2">
                            <Label>Primary Contact</Label>
                            <div className="text-sm flex items-center gap-2" data-testid="text-contact">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {relatedContact.firstName} {relatedContact.lastName}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <Separator className="my-4" />

                    <div className="text-xs text-muted-foreground space-y-1">
                      {entity?.createdAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Created {formatDistanceToNow(new Date(entity.createdAt))} ago
                        </div>
                      )}
                      {entity?.updatedAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Updated {formatDistanceToNow(new Date(entity.updatedAt))} ago
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {entityId && (
                  <UnifiedTimeline 
                    entityType={entityType} 
                    entityId={entityId}
                    showHeader={false}
                    maxHeight="400px"
                    compact={true}
                  />
                )}
              </TabsContent>

              <TabsContent value="files" className="mt-4 space-y-6">
                {entityId && (
                  <>
                    <FileUploader
                      entityType={entityType}
                      entityId={entityId}
                    />
                    <div>
                      <h3 className="text-sm font-medium mb-3">Attached Files</h3>
                      <FileList
                        entityType={entityType}
                        entityId={entityId}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="custom" className="mt-4">
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Custom Fields coming soon</p>
                  <p className="text-sm">Add custom fields to track additional data</p>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

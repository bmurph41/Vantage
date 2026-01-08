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
  Users,
  MapPin,
  Anchor,
  Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Contact, Deal } from "@shared/schema";
import { FileUploader } from "./file-uploader";
import { FileList } from "./file-list";
import UnifiedTimeline from "./unified-timeline";
import { RelationshipStats } from "./relationship-stats";
import { CustomFieldsEditor } from "./custom-fields-editor";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "contact" | "company" | "deal" | "property";
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

  // Helper to pluralize entity type correctly (property -> properties, company -> companies)
  const getApiPath = (type: string) => {
    if (type === 'property') return 'properties';
    if (type === 'company') return 'companies';
    return `${type}s`;
  };

  // Fetch entity data
  const { data: entity, isLoading } = useQuery({
    queryKey: [`/api/${getApiPath(entityType)}`, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const response = await fetch(`/api/${getApiPath(entityType)}/${entityId}`);
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

  // Fetch contacts for company
  const { data: companyContacts = [] } = useQuery<any[]>({
    queryKey: ['/api/companies', entityId, 'contacts'],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/companies/${entityId}/contacts`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: entityType === 'company' && !!entityId,
  });

  // Fetch properties linked to company
  const { data: companyProperties = [] } = useQuery<any[]>({
    queryKey: ['/api/companies', entityId, 'properties'],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/companies/${entityId}/properties`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: entityType === 'company' && !!entityId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', `/api/${getApiPath(entityType)}/${entityId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${getApiPath(entityType)}`] });
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
      const response = await apiRequest('DELETE', `/api/${getApiPath(entityType)}/${entityId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${getApiPath(entityType)}`] });
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
      case "property":
        return entity.name || entity.address || "Unnamed Property";
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
      case "property":
        return entity.city && entity.state ? `${entity.city}, ${entity.state}` : entity.status || "";
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
            {entityType === "company" && (
              <>
                <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
                <TabsTrigger value="properties" data-testid="tab-properties">Properties</TabsTrigger>
              </>
            )}
            <TabsTrigger value="custom" data-testid="tab-custom">Custom Fields</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="px-6 pb-6">
              <TabsContent value="overview" className="mt-4 space-y-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    {entityId && (
                      <RelationshipStats entityType={entityType} entityId={entityId} />
                    )}
                    
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
                              {entity?.lifecycleStage || entity?.contactTag || "Unknown"}
                            </Badge>
                          )}
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Lead & Communication</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Lead Source</Label>
                            {isEditing ? (
                              <Input
                                value={editData.leadSource || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, leadSource: e.target.value })
                                }
                                placeholder="website, referral, trade show..."
                                data-testid="input-leadSource"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-leadSource">
                                {entity?.leadSource || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Preferred Contact</Label>
                            {isEditing ? (
                              <Input
                                value={editData.communicationPreference || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, communicationPreference: e.target.value })
                                }
                                placeholder="email, phone, text"
                                data-testid="input-communicationPreference"
                              />
                            ) : (
                              <div className="text-sm capitalize" data-testid="text-communicationPreference">
                                {entity?.communicationPreference || "Email"}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Social Profiles</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>LinkedIn</Label>
                            {isEditing ? (
                              <Input
                                value={editData.linkedinUrl || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, linkedinUrl: e.target.value })
                                }
                                placeholder="https://linkedin.com/in/..."
                                data-testid="input-linkedinUrl"
                              />
                            ) : (
                              <div className="text-sm flex items-center gap-2" data-testid="text-linkedinUrl">
                                {entity?.linkedinUrl ? (
                                  <a
                                    href={entity.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    View Profile <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Twitter/X</Label>
                            {isEditing ? (
                              <Input
                                value={editData.twitterHandle || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, twitterHandle: e.target.value })
                                }
                                placeholder="@handle"
                                data-testid="input-twitterHandle"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-twitterHandle">
                                {entity?.twitterHandle ? `@${entity.twitterHandle.replace('@', '')}` : "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Address</h4>

                        <div className="space-y-2">
                          <Label>Street Address</Label>
                          {isEditing ? (
                            <Input
                              value={editData.address || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, address: e.target.value })
                              }
                              data-testid="input-address"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-address">
                              {entity?.address || "-"}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>City</Label>
                            {isEditing ? (
                              <Input
                                value={editData.city || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, city: e.target.value })
                                }
                                data-testid="input-city"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-city">
                                {entity?.city || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            {isEditing ? (
                              <Input
                                value={editData.state || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, state: e.target.value })
                                }
                                data-testid="input-state"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-state">
                                {entity?.state || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Zip</Label>
                            {isEditing ? (
                              <Input
                                value={editData.zipCode || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, zipCode: e.target.value })
                                }
                                data-testid="input-zipCode"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-zipCode">
                                {entity?.zipCode || "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Personal Dates</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Birthday</Label>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editData.birthday || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, birthday: e.target.value })
                                }
                                data-testid="input-birthday"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-birthday">
                                {entity?.birthday ? new Date(entity.birthday).toLocaleDateString() : "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Anniversary</Label>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editData.anniversary || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, anniversary: e.target.value })
                                }
                                data-testid="input-anniversary"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-anniversary">
                                {entity?.anniversary ? new Date(entity.anniversary).toLocaleDateString() : "-"}
                              </div>
                            )}
                          </div>
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

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Financial & Business</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Annual Revenue</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.annualRevenue || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, annualRevenue: e.target.value })
                                }
                                placeholder="$0"
                                data-testid="input-annualRevenue"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-annualRevenue">
                                {entity?.annualRevenue ? `$${Number(entity.annualRevenue).toLocaleString()}` : "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Marina Spend</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.annualMarinaSpend || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, annualMarinaSpend: e.target.value })
                                }
                                placeholder="$0"
                                data-testid="input-annualMarinaSpend"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-annualMarinaSpend">
                                {entity?.annualMarinaSpend ? `$${Number(entity.annualMarinaSpend).toLocaleString()}` : "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Acquisition & Portfolio</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Acquisition Interest</Label>
                            {isEditing ? (
                              <Input
                                value={editData.acquisitionInterest || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, acquisitionInterest: e.target.value })
                                }
                                placeholder="hot, warm, cold, none"
                                data-testid="input-acquisitionInterest"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-acquisitionInterest">
                                <Badge variant={
                                  entity?.acquisitionInterest === 'hot' ? 'default' :
                                  entity?.acquisitionInterest === 'warm' ? 'secondary' : 'outline'
                                } className={
                                  entity?.acquisitionInterest === 'hot' ? 'bg-red-500' :
                                  entity?.acquisitionInterest === 'warm' ? 'bg-yellow-500' : ''
                                }>
                                  {entity?.acquisitionInterest || "Unknown"}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Portfolio Size</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.portfolioCount || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, portfolioCount: parseInt(e.target.value) || 0 })
                                }
                                placeholder="0"
                                data-testid="input-portfolioCount"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-portfolioCount">
                                {entity?.portfolioCount ? `${entity.portfolioCount} properties` : "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Size Tier</Label>
                          {isEditing ? (
                            <Input
                              value={editData.size || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, size: e.target.value })
                              }
                              placeholder="startup, small, medium, large, enterprise"
                              data-testid="input-size"
                            />
                          ) : (
                            <div className="text-sm capitalize" data-testid="text-size">
                              {entity?.size || "-"}
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

                    {/* Property Overview */}
                    {entityType === "property" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Property Name</Label>
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

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            {isEditing ? (
                              <Input
                                value={editData.type || "marina"}
                                onChange={(e) =>
                                  setEditData({ ...editData, type: e.target.value })
                                }
                                data-testid="input-type"
                              />
                            ) : (
                              <div className="text-sm capitalize" data-testid="text-type">
                                {entity?.type || "Marina"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            {isEditing ? (
                              <Input
                                value={editData.status || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, status: e.target.value })
                                }
                                data-testid="input-status"
                              />
                            ) : (
                              <Badge variant="secondary" data-testid="badge-status">
                                {entity?.status || "Available"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Location</h4>

                        <div className="space-y-2">
                          <Label>Address</Label>
                          {isEditing ? (
                            <Input
                              value={editData.address || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, address: e.target.value })
                              }
                              data-testid="input-address"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-address">
                              {entity?.address || "-"}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>City</Label>
                            {isEditing ? (
                              <Input
                                value={editData.city || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, city: e.target.value })
                                }
                                data-testid="input-city"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-city">
                                {entity?.city || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            {isEditing ? (
                              <Input
                                value={editData.state || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, state: e.target.value })
                                }
                                data-testid="input-state"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-state">
                                {entity?.state || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Zip</Label>
                            {isEditing ? (
                              <Input
                                value={editData.zipCode || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, zipCode: e.target.value })
                                }
                                data-testid="input-zipCode"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-zipCode">
                                {entity?.zipCode || "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Marina Capacity</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Wet Slips</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.wetSlips || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, wetSlips: parseInt(e.target.value) || null })
                                }
                                data-testid="input-wetSlips"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-wetSlips">
                                {entity?.wetSlips || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Dry Slips</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.drySlips || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, drySlips: parseInt(e.target.value) || null })
                                }
                                data-testid="input-drySlips"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-drySlips">
                                {entity?.drySlips || "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Moorings</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.moorings || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, moorings: parseInt(e.target.value) || null })
                                }
                                data-testid="input-moorings"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-moorings">
                                {entity?.moorings || "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Total Capacity</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.totalCapacity || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, totalCapacity: parseInt(e.target.value) || null })
                                }
                                data-testid="input-totalCapacity"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-totalCapacity">
                                {entity?.totalCapacity || "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Occupancy Rate</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editData.occupancyRate || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, occupancyRate: e.target.value })
                              }
                              placeholder="0-100%"
                              data-testid="input-occupancyRate"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-occupancyRate">
                              {entity?.occupancyRate ? `${entity.occupancyRate}%` : "-"}
                            </div>
                          )}
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Amenities</h4>

                        <div className="text-sm" data-testid="text-amenities">
                          {entity?.amenities && Array.isArray(entity.amenities) && entity.amenities.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {entity.amenities.map((amenity: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="capitalize">
                                  {amenity.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          ) : "-"}
                        </div>

                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Financials</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Listing Price</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.listingPrice || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, listingPrice: e.target.value })
                                }
                                data-testid="input-listingPrice"
                              />
                            ) : (
                              <div className="text-sm font-medium text-green-600" data-testid="text-listingPrice">
                                {entity?.listingPrice ? `$${Number(entity.listingPrice).toLocaleString()}` : "-"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Annual Revenue</Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.annualRevenue || ""}
                                onChange={(e) =>
                                  setEditData({ ...editData, annualRevenue: e.target.value })
                                }
                                data-testid="input-annualRevenue"
                              />
                            ) : (
                              <div className="text-sm" data-testid="text-annualRevenue">
                                {entity?.annualRevenue ? `$${Number(entity.annualRevenue).toLocaleString()}` : "-"}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>NOI Estimate</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editData.noiEstimate || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, noiEstimate: e.target.value })
                              }
                              data-testid="input-noiEstimate"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-noiEstimate">
                              {entity?.noiEstimate ? `$${Number(entity.noiEstimate).toLocaleString()}` : "-"}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          {isEditing ? (
                            <Textarea
                              value={editData.description || ""}
                              onChange={(e) =>
                                setEditData({ ...editData, description: e.target.value })
                              }
                              rows={3}
                              data-testid="input-description"
                            />
                          ) : (
                            <div className="text-sm" data-testid="text-description">
                              {entity?.description || "-"}
                            </div>
                          )}
                        </div>
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


              {/* Contacts Tab - only for companies */}
              {entityType === "company" && (
                <TabsContent value="contacts" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Contacts ({companyContacts.length})</h3>
                    </div>
                    {companyContacts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No contacts linked to this company</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {companyContacts.map((contact: any) => (
                          <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium">
                              {(contact.firstName?.[0] || "").toUpperCase()}{(contact.lastName?.[0] || "").toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{contact.firstName} {contact.lastName}</div>
                              <div className="text-sm text-muted-foreground truncate">{contact.title || contact.email || "-"}</div>
                            </div>
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="text-muted-foreground hover:text-foreground">
                                <Phone className="h-4 w-4" />
                              </a>
                            )}
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-foreground">
                                <Mail className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* Properties Tab - only for companies */}
              {entityType === "company" && (
                <TabsContent value="properties" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Properties ({companyProperties.length})</h3>
                    </div>
                    {companyProperties.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Anchor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No properties linked to this company</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {companyProperties.map((link: any) => {
                          const property = link.property || link;
                          return (
                            <div key={property.id || link.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                              <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
                                <Anchor className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{property.name || property.address || "Unnamed Property"}</div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {property.city && property.state ? `${property.city}, ${property.state}` : property.status || "-"}
                                </div>
                              </div>
                              {link.relationship && (
                                <Badge variant="outline" className="ml-2">{link.relationship}</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              <TabsContent value="custom" className="mt-4">
                {entityId && entity && (
                  <CustomFieldsEditor
                    entityType={entityType}
                    entityId={entityId}
                    customFields={entity.customFields || {}}
                  />
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

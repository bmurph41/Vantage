import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Maximize2,
  FileText,
  Users,
  MapPin,
  Anchor,
  Clock,
  Link2,
  Loader2,
  Globe,
  Briefcase,
  TrendingUp,
  Activity,
  Target,
  Hash,
  Ship,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  XCircle,
  Banknote,
  Scale,
  Landmark,
  Info,
  Droplets,
  Wrench,
  Flag,
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
import { NoteModal, TaskModal, CallModal, EmailRedirectModal } from "./action-modals";
import { CollapsibleSection, EditableFieldRow, FieldRow } from "./collapsible-section";
import { DealDetailPanel } from "./deal-detail-panel";

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
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [showLinkCompanyDialog, setShowLinkCompanyDialog] = useState(false);
  const [showLinkPropertyDialog, setShowLinkPropertyDialog] = useState(false);
  const [selectedCompanyToLink, setSelectedCompanyToLink] = useState("");
  const [selectedPropertyToLink, setSelectedPropertyToLink] = useState("");
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [linkRole, setLinkRole] = useState("owner");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper to pluralize entity type correctly (property -> properties, company -> companies)
  const getApiPath = (type: string) => {
    if (type === 'property') return 'properties';
    if (type === 'company') return 'companies';
    return `${type}s`;
  };

  // Helper to format role/industry enum values (marina_operator -> Marina Operator)
  const formatRole = (role: string | null | undefined) => {
    if (!role) return "-";
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get first contact's phone for company display
  // Helper to get entity display name
  const getEntityName = () => {
    if (!entity) return "";
    if (entityType === "contact") {
      return [entity.firstName, entity.lastName].filter(Boolean).join(" ") || "Contact";
    }
    if (entityType === "company") {
      return entity.name || "Company";
    }
    if (entityType === "deal") {
      return entity.name || "Deal";
    }
    if (entityType === "property") {
      return entity.name || "Property";
    }
    return "Entity";
  };

  const getCompanyPhone = () => {
    if (entity?.phone) return entity.phone;
    if (companyContacts && companyContacts.length > 0) {
      const firstLink = companyContacts[0];
      const contact = firstLink?.contact || firstLink;
      if (contact?.phone) {
        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
        return `${contact.phone} (${contactName})`;
      }
    }
    return "-";
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
    enabled: (entityType === 'contact' || entityType === 'deal') && !!entity?.companyId,
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

  const { data: _modelCoverage } = useQuery<{ propertyIds: string[]; companyIds: string[]; contactIds: string[] }>({
    queryKey: ['/api/modeling/property-coverage'],
  });
  const modeledPropertyIds = new Set(_modelCoverage?.propertyIds ?? []);
  const modeledCompanyIds = new Set(_modelCoverage?.companyIds ?? []);

  // Fetch companies linked to contact
  const { data: contactCompanies = [] } = useQuery<any[]>({
    queryKey: ['/api/contacts', entityId, 'companies'],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/contacts/${entityId}/companies`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: entityType === 'contact' && !!entityId,
  });

  // Fetch all companies for linking dialog
  const { data: allCompanies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    enabled: showLinkCompanyDialog && entityType === 'contact',
  });

  // Fetch all properties for linking dialog  
  const { data: allProperties = [] } = useQuery<any[]>({
    queryKey: ['/api/properties'],
    enabled: showLinkPropertyDialog && (entityType === 'contact' || entityType === 'company'),
  });
  
  // Fetch properties linked to contact
  const { data: contactProperties = [] } = useQuery<any[]>({
    queryKey: ['/api/contacts', entityId, 'properties'],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/contacts/${entityId}/properties`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: entityType === 'contact' && !!entityId,
  });

  // Fetch contacts linked to property
  const { data: propertyContacts = [] } = useQuery<any[]>({
    queryKey: ['/api/properties', entityId, 'contacts'],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/properties/${entityId}/contacts`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: entityType === 'property' && !!entityId,
  });

  // Fetch companies linked to property
  const { data: propertyCompanies = [] } = useQuery<any[]>({
    queryKey: ['/api/properties', entityId, 'companies'],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/properties/${entityId}/companies`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: entityType === 'property' && !!entityId,
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

  // Link company to contact mutation
  const linkCompanyMutation = useMutation({
    mutationFn: async ({ companyId, role }: { companyId: string; role: string }) => {
      const response = await apiRequest('POST', `/api/contacts/${entityId}/companies`, {
        companyId,
        role,
        isPrimary: contactCompanies.length === 0
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', entityId, 'companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Company linked successfully" });
      setShowLinkCompanyDialog(false);
      setSelectedCompanyToLink("");
      setCompanySearchQuery("");
      setLinkRole("owner");
    },
    onError: () => {
      toast({ title: "Failed to link company", variant: "destructive" });
    },
  });

  // Link property to contact mutation
  const linkPropertyToContactMutation = useMutation({
    mutationFn: async ({ propertyId, relationship }: { propertyId: string; relationship: string }) => {
      const response = await apiRequest('POST', `/api/contacts/${entityId}/properties`, {
        propertyId,
        relationship
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', entityId, 'properties'] });
      toast({ title: "Property linked successfully" });
      setShowLinkPropertyDialog(false);
      setSelectedPropertyToLink("");
      setLinkRole("owner");
    },
    onError: () => {
      toast({ title: "Failed to link property", variant: "destructive" });
    },
  });

  // Link property to company mutation
  const linkPropertyToCompanyMutation = useMutation({
    mutationFn: async ({ propertyId, relationship }: { propertyId: string; relationship: string }) => {
      const response = await apiRequest('POST', `/api/companies/${entityId}/properties`, {
        propertyId,
        relationship
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', entityId, 'properties'] });
      toast({ title: "Property linked successfully" });
      setShowLinkPropertyDialog(false);
      setSelectedPropertyToLink("");
      setLinkRole("owner");
    },
    onError: () => {
      toast({ title: "Failed to link property", variant: "destructive" });
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
        return entity.website || formatRole(entity.industry) || "";
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
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col max-h-screen overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b bg-gradient-to-b from-muted/40 to-background">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
              entityType === "contact" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
              entityType === "company" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" :
              entityType === "property" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" :
              "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            }`}>
              {entityType === "contact" && (
                <>
                  {(entity?.firstName?.[0] || "").toUpperCase()}
                  {(entity?.lastName?.[0] || "").toUpperCase()}
                </>
              )}
              {entityType === "company" && <Building2 className="h-6 w-6" />}
              {entityType === "property" && <Anchor className="h-6 w-6" />}
              {entityType === "deal" && <DollarSign className="h-6 w-6" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl font-semibold truncate">
                  {getEntityTitle()}
                </SheetTitle>
                {entityType === "contact" && entity?.contactType && (
                  <Badge variant="secondary" className="text-xs capitalize">{entity.contactType.replace(/_/g, ' ')}</Badge>
                )}
                {entityType === "contact" && entity?.leadStatus && (
                  <Badge variant={entity.leadStatus === 'hot' ? 'default' : 'outline'} className={`text-xs capitalize ${entity.leadStatus === 'hot' ? 'bg-red-500' : entity.leadStatus === 'warm' ? 'bg-yellow-500 text-black' : ''}`}>
                    {entity.leadStatus}
                  </Badge>
                )}
                {entityType === "company" && entity?.acquisitionInterest && (
                  <Badge variant={entity.acquisitionInterest === 'hot' ? 'default' : 'outline'} className={`text-xs capitalize ${entity.acquisitionInterest === 'hot' ? 'bg-red-500' : entity.acquisitionInterest === 'warm' ? 'bg-yellow-500 text-black' : ''}`}>
                    {entity.acquisitionInterest}
                  </Badge>
                )}
                {entityType === "property" && entity?.status && (
                  <Badge variant="secondary" className="text-xs capitalize">{entity.status.replace(/_/g, ' ')}</Badge>
                )}
                {entityType === "deal" && entity?.status && (
                  <Badge variant={entity.status === 'won' ? 'default' : entity.status === 'lost' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                    {entity.status}
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-sm text-muted-foreground mt-0.5 truncate">
                {getEntitySubtitle()}
              </SheetDescription>

              {/* Key Metrics Row */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                {entityType === "contact" && entity?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${entity.email}`} className="hover:text-foreground hover:underline truncate max-w-[180px]">{entity.email}</a>
                  </span>
                )}
                {entityType === "contact" && entity?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {entity.phone}
                  </span>
                )}
                {entityType === "company" && entity?.website && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <a href={entity.website.startsWith('http') ? entity.website : `https://${entity.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline truncate max-w-[180px]">{entity.website}</a>
                  </span>
                )}
                {entityType === "company" && entity?.industry && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {formatRole(entity.industry)}
                  </span>
                )}
                {entityType === "property" && entity?.city && entity?.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {entity.city}, {entity.state}
                  </span>
                )}
                {entityType === "property" && entity?.totalCapacity && (
                  <span className="flex items-center gap-1">
                    <Ship className="h-3 w-3" />
                    {entity.totalCapacity} slips
                  </span>
                )}
                {entityType === "deal" && entity?.amount && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${entity.amount.toLocaleString()}
                  </span>
                )}
                {entity?.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(entity.updatedAt))} ago
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isEditing ? (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditData(entity);
                    }}
                    title="Cancel"
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    title="Save"
                    data-testid="button-save-edit"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    title="Edit"
                    data-testid="button-edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const basePath = entityType === 'property' ? 'properties' : 
                                       entityType === 'company' ? 'companies' : 
                                       entityType === 'contact' ? 'contacts' : 'deals';
                      setLocation(`/crm/${basePath}/${entityId}`);
                      onOpenChange(false);
                    }}
                    title="Open full page"
                    data-testid="button-open-full-page"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    title="Delete"
                    className="text-destructive hover:text-destructive"
                    data-testid="button-delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-1.5 mt-3">
            <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="button-email" onClick={() => setEmailModalOpen(true)}>
              <Mail className="h-3.5 w-3.5 mr-1" />
              Email
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="button-call" onClick={() => setCallModalOpen(true)}>
              <Phone className="h-3.5 w-3.5 mr-1" />
              Call
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="button-note" onClick={() => setNoteModalOpen(true)}>
              <StickyNote className="h-3.5 w-3.5 mr-1" />
              Note
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="button-task" onClick={() => setTaskModalOpen(true)}>
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Task
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 mb-4 justify-start">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            {entityType === "contact" && (
              <>
                <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>
                <TabsTrigger value="contact-properties" data-testid="tab-contact-properties">Properties</TabsTrigger>
              </>
            )}
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

          <ScrollArea className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="px-6 pb-6">
              <TabsContent value="overview" className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    {entityId && (
                      <RelationshipStats entityType={entityType} entityId={entityId} />
                    )}
                    
                    {/* Contact Overview - Collapsible Sections */}
                    {entityType === "contact" && (
                      <div className="space-y-3">
                        <CollapsibleSection title="About" icon={<User className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="First Name" isEditing={isEditing}
                              value={<span data-testid="text-firstName">{entity?.firstName || "-"}</span>}
                              editComponent={<Input value={editData.firstName || ""} onChange={(e) => setEditData({ ...editData, firstName: e.target.value })} data-testid="input-firstName" />}
                            />
                            <EditableFieldRow label="Last Name" isEditing={isEditing}
                              value={<span data-testid="text-lastName">{entity?.lastName || "-"}</span>}
                              editComponent={<Input value={editData.lastName || ""} onChange={(e) => setEditData({ ...editData, lastName: e.target.value })} data-testid="input-lastName" />}
                            />
                            <EditableFieldRow label="Title" isEditing={isEditing}
                              value={<span data-testid="text-title">{entity?.title || "-"}</span>}
                              editComponent={<Input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} data-testid="input-title" />}
                            />
                            <EditableFieldRow label="Contact Type" isEditing={isEditing}
                              value={
                                entity?.contactType ? (
                                  <Badge variant="secondary" className="capitalize text-xs" data-testid="text-contactType">{entity.contactType.replace(/_/g, ' ')}</Badge>
                                ) : <span data-testid="text-contactType">-</span>
                              }
                              editComponent={
                                <Select value={editData.contactType || ""} onValueChange={(v) => setEditData({ ...editData, contactType: v })}>
                                  <SelectTrigger data-testid="select-contactType"><SelectValue placeholder="Select type" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="owner">Owner</SelectItem>
                                    <SelectItem value="broker">Broker</SelectItem>
                                    <SelectItem value="investor">Investor</SelectItem>
                                    <SelectItem value="marina_operator">Marina Operator</SelectItem>
                                    <SelectItem value="vendor">Vendor</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Lead Status" isEditing={isEditing}
                              value={
                                entity?.leadStatus ? (
                                  <Badge variant={entity.leadStatus === 'hot' ? 'default' : 'outline'} className={`capitalize text-xs ${entity.leadStatus === 'hot' ? 'bg-red-500' : entity.leadStatus === 'warm' ? 'bg-yellow-500 text-black' : ''}`} data-testid="text-leadStatus">
                                    {entity.leadStatus}
                                  </Badge>
                                ) : <span data-testid="text-leadStatus">-</span>
                              }
                              editComponent={
                                <Select value={editData.leadStatus || ""} onValueChange={(v) => setEditData({ ...editData, leadStatus: v })}>
                                  <SelectTrigger data-testid="select-leadStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="hot">Hot</SelectItem>
                                    <SelectItem value="warm">Warm</SelectItem>
                                    <SelectItem value="cold">Cold</SelectItem>
                                    <SelectItem value="lost">Lost</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Source" isEditing={isEditing}
                              value={<span data-testid="text-source" className="capitalize">{entity?.source?.replace(/_/g, ' ') || "-"}</span>}
                              editComponent={<Input value={editData.source || ""} onChange={(e) => setEditData({ ...editData, source: e.target.value })} data-testid="input-source" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Communication" icon={<Mail className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Email" isEditing={isEditing}
                              value={
                                entity?.email ? (
                                  <a href={`mailto:${entity.email}`} className="text-blue-600 hover:underline flex items-center gap-1" data-testid="text-email">
                                    {entity.email} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span data-testid="text-email">-</span>
                              }
                              editComponent={<Input type="email" value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} data-testid="input-email" />}
                            />
                            <EditableFieldRow label="Phone" isEditing={isEditing}
                              value={<span data-testid="text-phone">{entity?.phone || "-"}</span>}
                              editComponent={<Input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} data-testid="input-phone" />}
                            />
                            <EditableFieldRow label="Preferred Contact" isEditing={isEditing}
                              value={<span data-testid="text-communicationPreference" className="capitalize">{entity?.communicationPreference || "Email"}</span>}
                              editComponent={<Input value={editData.communicationPreference || ""} onChange={(e) => setEditData({ ...editData, communicationPreference: e.target.value })} placeholder="email, phone, text" data-testid="input-communicationPreference" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Social Profiles" icon={<Globe className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="LinkedIn" isEditing={isEditing}
                              value={
                                entity?.linkedinUrl ? (
                                  <a href={entity.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1" data-testid="text-linkedinUrl">
                                    View Profile <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span data-testid="text-linkedinUrl">-</span>
                              }
                              editComponent={<Input value={editData.linkedinUrl || ""} onChange={(e) => setEditData({ ...editData, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." data-testid="input-linkedinUrl" />}
                            />
                            <EditableFieldRow label="Twitter/X" isEditing={isEditing}
                              value={<span data-testid="text-twitterHandle">{entity?.twitterHandle ? `@${entity.twitterHandle.replace('@', '')}` : "-"}</span>}
                              editComponent={<Input value={editData.twitterHandle || ""} onChange={(e) => setEditData({ ...editData, twitterHandle: e.target.value })} placeholder="@handle" data-testid="input-twitterHandle" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Address" icon={<MapPin className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Street Address" isEditing={isEditing}
                              value={<span data-testid="text-address">{entity?.address || "-"}</span>}
                              editComponent={<Input value={editData.address || ""} onChange={(e) => setEditData({ ...editData, address: e.target.value })} data-testid="input-address" />}
                            />
                            <EditableFieldRow label="City" isEditing={isEditing}
                              value={<span data-testid="text-city">{entity?.city || "-"}</span>}
                              editComponent={<Input value={editData.city || ""} onChange={(e) => setEditData({ ...editData, city: e.target.value })} data-testid="input-city" />}
                            />
                            <EditableFieldRow label="State" isEditing={isEditing}
                              value={<span data-testid="text-state">{entity?.state || "-"}</span>}
                              editComponent={<Input value={editData.state || ""} onChange={(e) => setEditData({ ...editData, state: e.target.value })} data-testid="input-state" />}
                            />
                            <EditableFieldRow label="Zip" isEditing={isEditing}
                              value={<span data-testid="text-zipCode">{entity?.zipCode || "-"}</span>}
                              editComponent={<Input value={editData.zipCode || ""} onChange={(e) => setEditData({ ...editData, zipCode: e.target.value })} data-testid="input-zipCode" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Personal Dates" icon={<Calendar className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Birthday" isEditing={isEditing}
                              value={<span data-testid="text-birthday">{entity?.birthday ? new Date(entity.birthday).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.birthday || ""} onChange={(e) => setEditData({ ...editData, birthday: e.target.value })} data-testid="input-birthday" />}
                            />
                            <EditableFieldRow label="Anniversary" isEditing={isEditing}
                              value={<span data-testid="text-anniversary">{entity?.anniversary ? new Date(entity.anniversary).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.anniversary || ""} onChange={(e) => setEditData({ ...editData, anniversary: e.target.value })} data-testid="input-anniversary" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Investment Profile" icon={<Landmark className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Target Asset Classes" isEditing={isEditing}
                              value={<span data-testid="text-targetAssetClasses">{Array.isArray(entity?.targetAssetClasses) ? entity.targetAssetClasses.join(', ') : entity?.targetAssetClasses || "-"}</span>}
                              editComponent={<Input value={editData.targetAssetClasses || ""} onChange={(e) => setEditData({ ...editData, targetAssetClasses: e.target.value })} placeholder="marina, dry_storage, mixed_use" data-testid="input-targetAssetClasses" />}
                            />
                            <EditableFieldRow label="Target Geographies" isEditing={isEditing}
                              value={<span data-testid="text-targetGeographies">{Array.isArray(entity?.targetGeographies) ? entity.targetGeographies.join(', ') : entity?.targetGeographies || "-"}</span>}
                              editComponent={<Input value={editData.targetGeographies || ""} onChange={(e) => setEditData({ ...editData, targetGeographies: e.target.value })} placeholder="Southeast, Gulf Coast, Mid-Atlantic" data-testid="input-targetGeographies" />}
                            />
                            <EditableFieldRow label="Min Deal Size" isEditing={isEditing}
                              value={<span data-testid="text-dealSizeMin">{entity?.dealSizeMin ? `$${Number(entity.dealSizeMin).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.dealSizeMin || ""} onChange={(e) => setEditData({ ...editData, dealSizeMin: e.target.value })} placeholder="0" data-testid="input-dealSizeMin" />}
                            />
                            <EditableFieldRow label="Max Deal Size" isEditing={isEditing}
                              value={<span data-testid="text-dealSizeMax">{entity?.dealSizeMax ? `$${Number(entity.dealSizeMax).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.dealSizeMax || ""} onChange={(e) => setEditData({ ...editData, dealSizeMax: e.target.value })} placeholder="0" data-testid="input-dealSizeMax" />}
                            />
                            <EditableFieldRow label="Min Return Hurdle" isEditing={isEditing}
                              value={<span data-testid="text-returnCriteriaMin">{entity?.returnCriteriaMin ? `${entity.returnCriteriaMin}%` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.returnCriteriaMin || ""} onChange={(e) => setEditData({ ...editData, returnCriteriaMin: e.target.value })} placeholder="e.g. 12" data-testid="input-returnCriteriaMin" />}
                            />
                            <EditableFieldRow label="Investment Notes" isEditing={isEditing}
                              value={<span data-testid="text-investmentNotes" className="text-xs">{entity?.investmentNotes || "-"}</span>}
                              editComponent={<Textarea value={editData.investmentNotes || ""} onChange={(e) => setEditData({ ...editData, investmentNotes: e.target.value })} rows={3} placeholder="Capital available, strategy, preferences..." data-testid="input-investmentNotes" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Relationship & Compliance" icon={<Scale className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Relationship Score" isEditing={isEditing}
                              value={
                                <div className="flex items-center gap-1" data-testid="text-relationshipScore">
                                  {entity?.relationshipScore ? (
                                    <>
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        entity.relationshipScore >= 80 ? 'bg-green-100 text-green-700' :
                                        entity.relationshipScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>{entity.relationshipScore}/100</span>
                                    </>
                                  ) : <span>-</span>}
                                </div>
                              }
                              editComponent={<Input type="number" min="0" max="100" value={editData.relationshipScore || ""} onChange={(e) => setEditData({ ...editData, relationshipScore: parseInt(e.target.value) || null })} placeholder="0–100" data-testid="input-relationshipScore" />}
                            />
                            <EditableFieldRow label="Last Contacted" isEditing={isEditing}
                              value={<span data-testid="text-lastContactedAt">{entity?.lastContactedAt ? new Date(entity.lastContactedAt).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.lastContactedAt?.split('T')[0] || ""} onChange={(e) => setEditData({ ...editData, lastContactedAt: e.target.value })} data-testid="input-lastContactedAt" />}
                            />
                            <EditableFieldRow label="Next Follow-up" isEditing={isEditing}
                              value={<span data-testid="text-nextFollowupDate">{entity?.nextFollowupDate ? new Date(entity.nextFollowupDate).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.nextFollowupDate?.split('T')[0] || ""} onChange={(e) => setEditData({ ...editData, nextFollowupDate: e.target.value })} data-testid="input-nextFollowupDate" />}
                            />
                            <FieldRow label="NDA on File" value={
                              <div className="flex items-center gap-1.5" data-testid="text-ndaOnFile">
                                {entity?.ndaOnFile
                                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700 text-xs font-medium">Yes</span></>
                                  : <><XCircle className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-500 text-xs">No</span></>}
                                {isEditing && (
                                  <input type="checkbox" className="ml-2" checked={!!editData.ndaOnFile} onChange={(e) => setEditData({ ...editData, ndaOnFile: e.target.checked })} data-testid="input-ndaOnFile" />
                                )}
                              </div>
                            } />
                            <FieldRow label="Do Not Contact" value={
                              <div className="flex items-center gap-1.5" data-testid="text-doNotContact">
                                {entity?.doNotContact
                                  ? <><AlertTriangle className="h-3.5 w-3.5 text-red-500" /><span className="text-red-600 text-xs font-medium">Yes</span></>
                                  : <><CheckCircle2 className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-500 text-xs">No</span></>}
                                {isEditing && (
                                  <input type="checkbox" className="ml-2" checked={!!editData.doNotContact} onChange={(e) => setEditData({ ...editData, doNotContact: e.target.checked })} data-testid="input-doNotContact" />
                                )}
                              </div>
                            } />
                            <FieldRow label="Email Opt-Out" value={
                              <div className="flex items-center gap-1.5" data-testid="text-emailOptOut">
                                {entity?.emailOptOut
                                  ? <><Flag className="h-3.5 w-3.5 text-orange-500" /><span className="text-orange-600 text-xs font-medium">Opted Out</span></>
                                  : <><CheckCircle2 className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-500 text-xs">Subscribed</span></>}
                                {isEditing && (
                                  <input type="checkbox" className="ml-2" checked={!!editData.emailOptOut} onChange={(e) => setEditData({ ...editData, emailOptOut: e.target.checked })} data-testid="input-emailOptOut" />
                                )}
                              </div>
                            } />
                          </div>
                        </CollapsibleSection>
                      </div>
                    )}

                    {/* Company Overview - Collapsible Sections */}
                    {entityType === "company" && (
                      <div className="space-y-3">
                        <CollapsibleSection title="About" icon={<Building2 className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Company Name" isEditing={isEditing}
                              value={<span data-testid="text-name">{entity?.name || "-"}</span>}
                              editComponent={<Input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} data-testid="input-name" />}
                            />
                            <EditableFieldRow label="Role" isEditing={isEditing}
                              value={<span data-testid="text-industry">{formatRole(entity?.industry)}</span>}
                              editComponent={<Input value={editData.industry || ""} onChange={(e) => setEditData({ ...editData, industry: e.target.value })} data-testid="input-industry" />}
                            />
                            <EditableFieldRow label="Phone" isEditing={isEditing}
                              value={<span data-testid="text-phone">{getCompanyPhone()}</span>}
                              editComponent={<Input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} data-testid="input-phone" />}
                            />
                            <EditableFieldRow label="Website" isEditing={isEditing}
                              value={
                                entity?.website ? (
                                  <a href={entity.website.startsWith('http') ? entity.website : `https://${entity.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1" data-testid="text-website">
                                    {entity.website} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span data-testid="text-website">-</span>
                              }
                              editComponent={<Input value={editData.website || ""} onChange={(e) => setEditData({ ...editData, website: e.target.value })} data-testid="input-website" />}
                            />
                            <EditableFieldRow label="Size Tier" isEditing={isEditing}
                              value={<span data-testid="text-size" className="capitalize">{entity?.size || "-"}</span>}
                              editComponent={<Input value={editData.size || ""} onChange={(e) => setEditData({ ...editData, size: e.target.value })} placeholder="startup, small, medium, large, enterprise" data-testid="input-size" />}
                            />
                            <EditableFieldRow label="Entity Type" isEditing={isEditing}
                              value={<span data-testid="text-companyType" className="capitalize">{entity?.companyType?.replace(/_/g, ' ') || "-"}</span>}
                              editComponent={
                                <Select value={editData.companyType || ""} onValueChange={(v) => setEditData({ ...editData, companyType: v })}>
                                  <SelectTrigger data-testid="select-companyType"><SelectValue placeholder="Select entity type" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="llc">LLC</SelectItem>
                                    <SelectItem value="lp">LP</SelectItem>
                                    <SelectItem value="c_corp">C-Corp</SelectItem>
                                    <SelectItem value="s_corp">S-Corp</SelectItem>
                                    <SelectItem value="reit">REIT</SelectItem>
                                    <SelectItem value="family_office">Family Office</SelectItem>
                                    <SelectItem value="pe_fund">PE Fund</SelectItem>
                                    <SelectItem value="operator">Operator</SelectItem>
                                    <SelectItem value="broker">Broker</SelectItem>
                                    <SelectItem value="lender">Lender</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Employee Count" isEditing={isEditing}
                              value={<span data-testid="text-employeeCount">{entity?.employeeCount ? entity.employeeCount.toLocaleString() : "-"}</span>}
                              editComponent={<Input type="number" value={editData.employeeCount || ""} onChange={(e) => setEditData({ ...editData, employeeCount: parseInt(e.target.value) || null })} placeholder="0" data-testid="input-employeeCount" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Financial & Business" icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Annual Revenue" isEditing={isEditing}
                              value={<span data-testid="text-annualRevenue">{entity?.annualRevenue ? `$${Number(entity.annualRevenue).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.annualRevenue || ""} onChange={(e) => setEditData({ ...editData, annualRevenue: e.target.value })} placeholder="$0" data-testid="input-annualRevenue" />}
                            />
                            <EditableFieldRow label="AUM (Approx)" isEditing={isEditing}
                              value={<span data-testid="text-aumApprox">{entity?.aumApprox ? `$${Number(entity.aumApprox).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.aumApprox || ""} onChange={(e) => setEditData({ ...editData, aumApprox: e.target.value })} placeholder="$0" data-testid="input-aumApprox" />}
                            />
                            <EditableFieldRow label="AUM Range" isEditing={isEditing}
                              value={<span data-testid="text-aumRange" className="capitalize">{entity?.aumRange?.replace(/_/g, ' ') || "-"}</span>}
                              editComponent={
                                <Select value={editData.aumRange || ""} onValueChange={(v) => setEditData({ ...editData, aumRange: v })}>
                                  <SelectTrigger data-testid="select-aumRange"><SelectValue placeholder="Select AUM range" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="under_10m">Under $10M</SelectItem>
                                    <SelectItem value="10m_50m">$10M – $50M</SelectItem>
                                    <SelectItem value="50m_100m">$50M – $100M</SelectItem>
                                    <SelectItem value="100m_500m">$100M – $500M</SelectItem>
                                    <SelectItem value="500m_1b">$500M – $1B</SelectItem>
                                    <SelectItem value="over_1b">Over $1B</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Marina Spend" isEditing={isEditing}
                              value={<span data-testid="text-annualMarinaSpend">{entity?.annualMarinaSpend ? `$${Number(entity.annualMarinaSpend).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.annualMarinaSpend || ""} onChange={(e) => setEditData({ ...editData, annualMarinaSpend: e.target.value })} placeholder="$0" data-testid="input-annualMarinaSpend" />}
                            />
                            <EditableFieldRow label="Investment Mandate" isEditing={isEditing}
                              value={<span data-testid="text-investmentMandate" className="text-xs">{entity?.investmentMandate || "-"}</span>}
                              editComponent={<Textarea value={editData.investmentMandate || ""} onChange={(e) => setEditData({ ...editData, investmentMandate: e.target.value })} rows={3} placeholder="Strategy, fund type, return targets..." data-testid="input-investmentMandate" />}
                            />
                            <EditableFieldRow label="NDA Expiry" isEditing={isEditing}
                              value={<span data-testid="text-ndaExpiryDate">{entity?.ndaExpiryDate ? new Date(entity.ndaExpiryDate).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.ndaExpiryDate?.split('T')[0] || ""} onChange={(e) => setEditData({ ...editData, ndaExpiryDate: e.target.value })} data-testid="input-ndaExpiryDate" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Acquisition & Portfolio" icon={<Target className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Acquisition Interest" isEditing={isEditing}
                              value={
                                <Badge variant={entity?.acquisitionInterest === 'hot' ? 'default' : entity?.acquisitionInterest === 'warm' ? 'secondary' : 'outline'}
                                  className={`capitalize text-xs ${entity?.acquisitionInterest === 'hot' ? 'bg-red-500' : entity?.acquisitionInterest === 'warm' ? 'bg-yellow-500 text-black' : ''}`}
                                  data-testid="text-acquisitionInterest">
                                  {entity?.acquisitionInterest || "Unknown"}
                                </Badge>
                              }
                              editComponent={<Input value={editData.acquisitionInterest || ""} onChange={(e) => setEditData({ ...editData, acquisitionInterest: e.target.value })} placeholder="hot, warm, cold, none" data-testid="input-acquisitionInterest" />}
                            />
                            <EditableFieldRow label="Portfolio Size" isEditing={isEditing}
                              value={<span data-testid="text-portfolioCount">{entity?.portfolioCount ? `${entity.portfolioCount} properties` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.portfolioCount || ""} onChange={(e) => setEditData({ ...editData, portfolioCount: parseInt(e.target.value) || 0 })} placeholder="0" data-testid="input-portfolioCount" />}
                            />
                            <FieldRow label="Number of Marinas" value={<span data-testid="text-numberOfMarinas" className="font-medium">{companyProperties?.length || 0}</span>} />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Office Location" icon={<MapPin className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Address" isEditing={isEditing}
                              value={<span data-testid="text-address">{entity?.address || "-"}</span>}
                              editComponent={<Input value={editData.address || ""} onChange={(e) => setEditData({ ...editData, address: e.target.value })} data-testid="input-address" />}
                            />
                            <EditableFieldRow label="City" isEditing={isEditing}
                              value={<span data-testid="text-city">{entity?.city || "-"}</span>}
                              editComponent={<Input value={editData.city || ""} onChange={(e) => setEditData({ ...editData, city: e.target.value })} data-testid="input-city" />}
                            />
                            <EditableFieldRow label="State" isEditing={isEditing}
                              value={<span data-testid="text-state">{entity?.state || "-"}</span>}
                              editComponent={<Input value={editData.state || ""} onChange={(e) => setEditData({ ...editData, state: e.target.value })} data-testid="input-state" />}
                            />
                            <EditableFieldRow label="Zip Code" isEditing={isEditing}
                              value={<span data-testid="text-zipCode">{entity?.zipCode || "-"}</span>}
                              editComponent={<Input value={editData.zipCode || ""} onChange={(e) => setEditData({ ...editData, zipCode: e.target.value })} data-testid="input-zipCode" />}
                            />
                            <EditableFieldRow label="Country" isEditing={isEditing}
                              value={<span data-testid="text-country">{entity?.country || "-"}</span>}
                              editComponent={<Input value={editData.country || ""} onChange={(e) => setEditData({ ...editData, country: e.target.value })} placeholder="US" data-testid="input-country" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Digital Presence" icon={<Globe className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="LinkedIn" isEditing={isEditing}
                              value={
                                entity?.linkedinUrl ? (
                                  <a href={entity.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1" data-testid="text-linkedinUrl">
                                    View Profile <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span data-testid="text-linkedinUrl">-</span>
                              }
                              editComponent={<Input value={editData.linkedinUrl || ""} onChange={(e) => setEditData({ ...editData, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/company/..." data-testid="input-linkedinUrl" />}
                            />
                            <EditableFieldRow label="Twitter/X" isEditing={isEditing}
                              value={
                                entity?.twitterHandle ? (
                                  <a href={`https://twitter.com/${entity.twitterHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1" data-testid="text-twitterHandle">
                                    @{entity.twitterHandle.replace('@', '')} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span data-testid="text-twitterHandle">-</span>
                              }
                              editComponent={<Input value={editData.twitterHandle || ""} onChange={(e) => setEditData({ ...editData, twitterHandle: e.target.value })} placeholder="@handle" data-testid="input-twitterHandle" />}
                            />
                          </div>
                        </CollapsibleSection>
                      </div>
                    )}

                    {/* Deal Overview - Institutional Grade Panel */}
                    {entityType === "deal" && (
                      <DealDetailPanel
                        deal={entity as Deal}
                        isEditing={isEditing}
                        onEditToggle={setIsEditing}
                        editData={editData}
                        setEditData={setEditData}
                        onSave={handleSave}
                        isSaving={updateMutation.isPending}
                        relatedContact={relatedContact}
                        relatedCompany={relatedCompany}
                        layoutMode="narrow"
                      />
                    )}

                    {/* Property Overview - Collapsible Sections */}
                    {entityType === "property" && (
                      <div className="space-y-3">
                        <CollapsibleSection title="About" icon={<Anchor className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Property Name" isEditing={isEditing}
                              value={<span data-testid="text-title">{entity?.title || entity?.name || "-"}</span>}
                              editComponent={<Input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} data-testid="input-title" />}
                            />
                            <EditableFieldRow label="Type" isEditing={isEditing}
                              value={<span data-testid="text-type" className="capitalize">{entity?.type?.replace('_', ' ') || "Marina"}</span>}
                              editComponent={
                                <Select value={editData.type || "marina"} onValueChange={(v) => setEditData({ ...editData, type: v })}>
                                  <SelectTrigger data-testid="select-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="marina">Marina</SelectItem>
                                    <SelectItem value="boat_yard">Boat Yard</SelectItem>
                                    <SelectItem value="marina_yard">Marina & Yard</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Status" isEditing={isEditing}
                              value={<Badge variant="secondary" data-testid="badge-status" className="capitalize">{entity?.status?.replace('_', ' ') || "Available"}</Badge>}
                              editComponent={
                                <Select value={editData.status || "target"} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                                  <SelectTrigger data-testid="select-status"><SelectValue placeholder="Select status" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="target">Target</SelectItem>
                                    <SelectItem value="for_sale">For Sale</SelectItem>
                                    <SelectItem value="under_loi">Under LOI</SelectItem>
                                    <SelectItem value="under_contract">Under Contract</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <FieldRow label="Owner" value={
                              propertyContacts.length > 0 ? (
                                <span className="text-primary hover:underline cursor-pointer flex items-center gap-1"
                                  onClick={() => {
                                    const ownerContact = propertyContacts[0]?.contact;
                                    if (ownerContact) { setLocation(`/crm/contacts/${ownerContact.id}`); onOpenChange(false); }
                                  }}
                                  data-testid="link-owner-contact">
                                  <User className="h-3 w-3" />
                                  {propertyContacts[0]?.contact?.firstName} {propertyContacts[0]?.contact?.lastName}
                                </span>
                              ) : <span className="text-muted-foreground">No owner assigned</span>
                            } />
                            <FieldRow label="Company" value={
                              propertyCompanies.length > 0 ? (
                                <span className="text-primary hover:underline cursor-pointer flex items-center gap-1"
                                  onClick={() => {
                                    const linkedCompany = propertyCompanies[0]?.company;
                                    if (linkedCompany) { setLocation(`/crm/companies/${linkedCompany.id}`); onOpenChange(false); }
                                  }}
                                  data-testid="link-owner-company">
                                  <Building2 className="h-3 w-3" />
                                  {propertyCompanies[0]?.company?.name}
                                </span>
                              ) : <span className="text-muted-foreground">No company assigned</span>
                            } />
                            <EditableFieldRow label="Description" isEditing={isEditing}
                              value={<span data-testid="text-description" className="text-xs">{entity?.description || "-"}</span>}
                              editComponent={<Textarea value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={3} data-testid="input-description" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Location" icon={<MapPin className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Address" isEditing={isEditing}
                              value={<span data-testid="text-address">{entity?.address || "-"}</span>}
                              editComponent={<Input value={editData.address || ""} onChange={(e) => setEditData({ ...editData, address: e.target.value })} data-testid="input-address" />}
                            />
                            <EditableFieldRow label="City" isEditing={isEditing}
                              value={<span data-testid="text-city">{entity?.city || "-"}</span>}
                              editComponent={<Input value={editData.city || ""} onChange={(e) => setEditData({ ...editData, city: e.target.value })} data-testid="input-city" />}
                            />
                            <EditableFieldRow label="State" isEditing={isEditing}
                              value={<span data-testid="text-state">{entity?.state || "-"}</span>}
                              editComponent={<Input value={editData.state || ""} onChange={(e) => setEditData({ ...editData, state: e.target.value })} data-testid="input-state" />}
                            />
                            <EditableFieldRow label="Zip" isEditing={isEditing}
                              value={<span data-testid="text-zipCode">{entity?.zipCode || "-"}</span>}
                              editComponent={<Input value={editData.zipCode || ""} onChange={(e) => setEditData({ ...editData, zipCode: e.target.value })} data-testid="input-zipCode" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Marina Capacity" icon={<Ship className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Wet Slips" isEditing={isEditing}
                              value={<span data-testid="text-wetSlips">{entity?.wetSlips || "-"}</span>}
                              editComponent={<Input type="number" value={editData.wetSlips || ""} onChange={(e) => setEditData({ ...editData, wetSlips: parseInt(e.target.value) || null })} data-testid="input-wetSlips" />}
                            />
                            <EditableFieldRow label="Dry Slips" isEditing={isEditing}
                              value={<span data-testid="text-drySlips">{entity?.drySlips || "-"}</span>}
                              editComponent={<Input type="number" value={editData.drySlips || ""} onChange={(e) => setEditData({ ...editData, drySlips: parseInt(e.target.value) || null })} data-testid="input-drySlips" />}
                            />
                            <EditableFieldRow label="Moorings" isEditing={isEditing}
                              value={<span data-testid="text-moorings">{entity?.moorings || "-"}</span>}
                              editComponent={<Input type="number" value={editData.moorings || ""} onChange={(e) => setEditData({ ...editData, moorings: parseInt(e.target.value) || null })} data-testid="input-moorings" />}
                            />
                            <EditableFieldRow label="Total Capacity" isEditing={isEditing}
                              value={<span data-testid="text-totalCapacity">{entity?.totalCapacity || "-"}</span>}
                              editComponent={<Input type="number" value={editData.totalCapacity || ""} onChange={(e) => setEditData({ ...editData, totalCapacity: parseInt(e.target.value) || null })} data-testid="input-totalCapacity" />}
                            />
                            <EditableFieldRow label="Occupancy Rate" isEditing={isEditing}
                              value={<span data-testid="text-occupancyRate">{entity?.occupancyRate ? `${entity.occupancyRate}%` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.occupancyRate || ""} onChange={(e) => setEditData({ ...editData, occupancyRate: e.target.value })} placeholder="0-100%" data-testid="input-occupancyRate" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Amenities" icon={<Hash className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}
                          badge={entity?.amenities?.length ? <Badge variant="outline" className="ml-1 text-xs">{entity.amenities.length}</Badge> : undefined}>
                          <div data-testid="text-amenities">
                            {entity?.amenities && Array.isArray(entity.amenities) && entity.amenities.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {entity.amenities.map((amenity: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="capitalize text-xs">{amenity.replace(/_/g, ' ')}</Badge>
                                ))}
                              </div>
                            ) : <span className="text-sm text-muted-foreground">No amenities listed</span>}
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Financials" icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} defaultOpen={true}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Listing Price" isEditing={isEditing}
                              value={<span data-testid="text-listingPrice" className="font-medium text-green-600">{entity?.listingPrice ? `$${Number(entity.listingPrice).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.listingPrice || ""} onChange={(e) => setEditData({ ...editData, listingPrice: e.target.value })} data-testid="input-listingPrice" />}
                            />
                            <EditableFieldRow label="Annual Revenue" isEditing={isEditing}
                              value={<span data-testid="text-annualRevenue">{entity?.annualRevenue ? `$${Number(entity.annualRevenue).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.annualRevenue || ""} onChange={(e) => setEditData({ ...editData, annualRevenue: e.target.value })} data-testid="input-annualRevenue" />}
                            />
                            <EditableFieldRow label="NOI Estimate" isEditing={isEditing}
                              value={<span data-testid="text-noiEstimate">{entity?.noiEstimate ? `$${Number(entity.noiEstimate).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.noiEstimate || ""} onChange={(e) => setEditData({ ...editData, noiEstimate: e.target.value })} data-testid="input-noiEstimate" />}
                            />
                            <EditableFieldRow label="Asking Price" isEditing={isEditing}
                              value={<span data-testid="text-askingPrice" className="font-medium text-green-600">{entity?.askingPrice ? `$${Number(entity.askingPrice).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.askingPrice || ""} onChange={(e) => setEditData({ ...editData, askingPrice: e.target.value })} data-testid="input-askingPrice" />}
                            />
                            <EditableFieldRow label="List Price" isEditing={isEditing}
                              value={<span data-testid="text-listPrice">{entity?.listPrice ? `$${Number(entity.listPrice).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.listPrice || ""} onChange={(e) => setEditData({ ...editData, listPrice: e.target.value })} data-testid="input-listPrice" />}
                            />
                            <EditableFieldRow label="List Cap Rate" isEditing={isEditing}
                              value={<span data-testid="text-listCapRate">{entity?.listCapRate ? `${entity.listCapRate}%` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.listCapRate || ""} onChange={(e) => setEditData({ ...editData, listCapRate: e.target.value })} placeholder="e.g. 6.5" data-testid="input-listCapRate" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Marina Features" icon={<Anchor className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Total Slips" isEditing={isEditing}
                              value={<span data-testid="text-totalSlips">{entity?.totalSlips || "-"}</span>}
                              editComponent={<Input type="number" value={editData.totalSlips || ""} onChange={(e) => setEditData({ ...editData, totalSlips: parseInt(e.target.value) || null })} data-testid="input-totalSlips" />}
                            />
                            <EditableFieldRow label="Water Depth (ft)" isEditing={isEditing}
                              value={<span data-testid="text-waterDepthFt">{entity?.waterDepthFt ? `${entity.waterDepthFt} ft` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.waterDepthFt || ""} onChange={(e) => setEditData({ ...editData, waterDepthFt: e.target.value })} placeholder="e.g. 8.5" data-testid="input-waterDepthFt" />}
                            />
                            <EditableFieldRow label="Dock Material" isEditing={isEditing}
                              value={<span data-testid="text-dockMaterial" className="capitalize">{entity?.dockMaterial?.replace(/_/g, ' ') || "-"}</span>}
                              editComponent={
                                <Select value={editData.dockMaterial || ""} onValueChange={(v) => setEditData({ ...editData, dockMaterial: v })}>
                                  <SelectTrigger data-testid="select-dockMaterial"><SelectValue placeholder="Select material" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="concrete">Concrete</SelectItem>
                                    <SelectItem value="wood">Wood</SelectItem>
                                    <SelectItem value="aluminum">Aluminum</SelectItem>
                                    <SelectItem value="composite">Composite</SelectItem>
                                    <SelectItem value="floating_concrete">Floating Concrete</SelectItem>
                                    <SelectItem value="floating_aluminum">Floating Aluminum</SelectItem>
                                    <SelectItem value="mixed">Mixed</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Year Built" isEditing={isEditing}
                              value={<span data-testid="text-yearBuilt">{entity?.yearBuilt || "-"}</span>}
                              editComponent={<Input type="number" value={editData.yearBuilt || ""} onChange={(e) => setEditData({ ...editData, yearBuilt: parseInt(e.target.value) || null })} placeholder="e.g. 1985" data-testid="input-yearBuilt" />}
                            />
                            <FieldRow label="Fuel Dock" value={
                              <div className="flex items-center gap-1.5" data-testid="text-hasFuelDock">
                                {entity?.hasFuelDock
                                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700 text-xs font-medium">Yes</span></>
                                  : <><XCircle className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-500 text-xs">No</span></>}
                                {isEditing && (
                                  <input type="checkbox" className="ml-2" checked={!!editData.hasFuelDock} onChange={(e) => setEditData({ ...editData, hasFuelDock: e.target.checked })} data-testid="input-hasFuelDock" />
                                )}
                              </div>
                            } />
                            <FieldRow label="Repair Yard" value={
                              <div className="flex items-center gap-1.5" data-testid="text-hasRepairYard">
                                {entity?.hasRepairYard
                                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700 text-xs font-medium">Yes</span></>
                                  : <><XCircle className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-500 text-xs">No</span></>}
                                {isEditing && (
                                  <input type="checkbox" className="ml-2" checked={!!editData.hasRepairYard} onChange={(e) => setEditData({ ...editData, hasRepairYard: e.target.checked })} data-testid="input-hasRepairYard" />
                                )}
                              </div>
                            } />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Transaction Details" icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Listing Status" isEditing={isEditing}
                              value={<span data-testid="text-listingStatus" className="capitalize">{entity?.listingStatus?.replace(/_/g, ' ') || "-"}</span>}
                              editComponent={
                                <Select value={editData.listingStatus || ""} onValueChange={(v) => setEditData({ ...editData, listingStatus: v })}>
                                  <SelectTrigger data-testid="select-listingStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="off_market">Off Market</SelectItem>
                                    <SelectItem value="on_market">On Market</SelectItem>
                                    <SelectItem value="under_loi">Under LOI</SelectItem>
                                    <SelectItem value="under_contract">Under Contract</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                    <SelectItem value="watchlist">Watchlist</SelectItem>
                                  </SelectContent>
                                </Select>
                              }
                            />
                            <EditableFieldRow label="Broker Name" isEditing={isEditing}
                              value={<span data-testid="text-brokerName">{entity?.brokerName || "-"}</span>}
                              editComponent={<Input value={editData.brokerName || ""} onChange={(e) => setEditData({ ...editData, brokerName: e.target.value })} placeholder="Broker name" data-testid="input-brokerName" />}
                            />
                            <EditableFieldRow label="Listing Date" isEditing={isEditing}
                              value={<span data-testid="text-listingDate">{entity?.listingDate ? new Date(entity.listingDate).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.listingDate?.split('T')[0] || ""} onChange={(e) => setEditData({ ...editData, listingDate: e.target.value })} data-testid="input-listingDate" />}
                            />
                            <EditableFieldRow label="Listing URL" isEditing={isEditing}
                              value={
                                entity?.listingUrl ? (
                                  <a href={entity.listingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs" data-testid="text-listingUrl">
                                    View Listing <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span data-testid="text-listingUrl">-</span>
                              }
                              editComponent={<Input value={editData.listingUrl || ""} onChange={(e) => setEditData({ ...editData, listingUrl: e.target.value })} placeholder="https://..." data-testid="input-listingUrl" />}
                            />
                            <EditableFieldRow label="Listing Notes" isEditing={isEditing}
                              value={<span data-testid="text-listingNotes" className="text-xs">{entity?.listingNotes || "-"}</span>}
                              editComponent={<Textarea value={editData.listingNotes || ""} onChange={(e) => setEditData({ ...editData, listingNotes: e.target.value })} rows={2} data-testid="input-listingNotes" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Sale History" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-0.5">
                            <EditableFieldRow label="Last Sale Date" isEditing={isEditing}
                              value={<span data-testid="text-lastSaleDate">{entity?.lastSaleDate ? new Date(entity.lastSaleDate).toLocaleDateString() : "-"}</span>}
                              editComponent={<Input type="date" value={editData.lastSaleDate?.split('T')[0] || ""} onChange={(e) => setEditData({ ...editData, lastSaleDate: e.target.value })} data-testid="input-lastSaleDate" />}
                            />
                            <EditableFieldRow label="Last Sale Price" isEditing={isEditing}
                              value={<span data-testid="text-lastSalePrice">{entity?.lastSalePrice ? `$${Number(entity.lastSalePrice).toLocaleString()}` : "-"}</span>}
                              editComponent={<Input type="number" value={editData.lastSalePrice || ""} onChange={(e) => setEditData({ ...editData, lastSalePrice: e.target.value })} data-testid="input-lastSalePrice" />}
                            />
                          </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Due Diligence Flags" icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
                          <div className="space-y-1 pt-1">
                            {[
                              { key: 'hasEnvIssues', label: 'Environmental Issues', editKey: 'hasEnvIssues' },
                              { key: 'hasTitleIssues', label: 'Title Issues', editKey: 'hasTitleIssues' },
                              { key: 'inFloodZone', label: 'In Flood Zone', editKey: 'inFloodZone' },
                              { key: 'hasWetlands', label: 'Has Wetlands', editKey: 'hasWetlands' },
                            ].map(({ key, label, editKey }) => (
                              <div key={key} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/30">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                <div className="flex items-center gap-1.5" data-testid={`text-${key}`}>
                                  {entity?.[key]
                                    ? <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /><span className="text-amber-600 text-xs font-medium">Flagged</span></>
                                    : <><CheckCircle2 className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-500 text-xs">Clear</span></>}
                                  {isEditing && (
                                    <input type="checkbox" className="ml-1" checked={!!editData[editKey]} onChange={(e) => setEditData({ ...editData, [editKey]: e.target.checked })} data-testid={`input-${key}`} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleSection>
                      </div>
                    )}

                    {/* Activity Summary */}
                    <div className="border rounded-lg bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground space-y-1.5">
                        {entity?.createdAt && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Created {formatDistanceToNow(new Date(entity.createdAt))} ago
                          </div>
                        )}
                        {entity?.updatedAt && (
                          <div className="flex items-center gap-2">
                            <Activity className="h-3 w-3" />
                            Last updated {formatDistanceToNow(new Date(entity.updatedAt))} ago
                          </div>
                        )}
                      </div>
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
                        {companyContacts.map((link: any) => {
                          const contact = link.contact || link;
                          return (
                            <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium">
                                {(contact.firstName?.[0] || "").toUpperCase()}{(contact.lastName?.[0] || "").toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{contact.firstName} {contact.lastName}</div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {link.role ? `${link.role} • ` : ""}{contact.title || contact.email || "-"}
                                </div>
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* Properties Tab - only for companies */}
              {entityType === "company" && (
                <TabsContent value="properties" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium">Properties ({companyProperties.length})</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLinkPropertyDialog(true)}
                        className="gap-2"
                      >
                        <Link2 className="h-4 w-4" />
                        Link Property
                      </Button>
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
                          const isModeled = modeledPropertyIds.has(property.id);
                          return (
                            <div key={property.id || link.id} className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors ${isModeled ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                              <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
                                <Anchor className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-1.5">
                                  {property.name || property.address || "Unnamed Property"}
                                  {isModeled && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                      <BarChart3 className="h-2.5 w-2.5" />
                                      Modeled
                                    </span>
                                  )}
                                </div>
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

              {/* Company Tab - only for contacts */}
              {entityType === "contact" && (
                <TabsContent value="company" className="mt-4">
                  <div className="space-y-4">
                  {contactCompanies.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="mb-4">No companies linked to this contact</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLinkCompanyDialog(true)}
                        className="gap-2"
                      >
                        <Link2 className="h-4 w-4" />
                        Link Company
                      </Button>
                    </div>
                    ) : (
                      <div className="space-y-6">
                        {contactCompanies.map((link: any) => {
                          const company = link.company || link;
                          return (
                            <div key={link.id} className="rounded-lg border bg-card p-4 space-y-4">
                              {/* Company Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300">
                                    <Building2 className="h-6 w-6" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-lg">{company.name || "Unnamed Company"}</h3>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      {link.role && <span>{formatRole(link.role)}</span>}
                                      {link.isPrimary && <Badge variant="default" className="text-xs">Primary</Badge>}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    setLocation(`/crm/companies/${company.id}`);
                                  }}
                                  data-testid={`button-view-company-${company.id}`}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View Company
                                </Button>
                              </div>

                              {/* Contact Info */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Phone</Label>
                                  <div className="text-sm flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {company.phone || "-"}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Website</Label>
                                  <div className="text-sm flex items-center gap-1 truncate">
                                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    {company.website ? (
                                      <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                                         target="_blank" 
                                         rel="noopener noreferrer"
                                         className="text-blue-600 hover:underline truncate">
                                        {company.website}
                                      </a>
                                    ) : "-"}
                                  </div>
                                </div>
                              </div>

                              {/* Address */}
                              {company.address && (
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Address</Label>
                                  <div className="text-sm flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    {company.address}
                                  </div>
                                </div>
                              )}

                              <Separator />

                              {/* Financial Info */}
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Financial & Business</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Annual Revenue</Label>
                                    <div className="text-sm font-medium">
                                      {company.annualRevenue ? `$${Number(company.annualRevenue).toLocaleString()}` : "-"}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Marina Spend</Label>
                                    <div className="text-sm font-medium">
                                      {company.annualMarinaSpend ? `$${Number(company.annualMarinaSpend).toLocaleString()}` : "-"}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Acquisition & Portfolio */}
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Acquisition & Portfolio</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Interest</Label>
                                    <Badge variant={
                                      company.acquisitionInterest === 'hot' ? 'default' :
                                      company.acquisitionInterest === 'warm' ? 'secondary' : 'outline'
                                    } className={
                                      company.acquisitionInterest === 'hot' ? 'bg-red-500' :
                                      company.acquisitionInterest === 'warm' ? 'bg-yellow-500' : ''
                                    }>
                                      {company.acquisitionInterest ? formatRole(company.acquisitionInterest) : "Unknown"}
                                    </Badge>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Portfolio Size</Label>
                                    <div className="text-sm font-medium">
                                      {company.portfolioCount ? `${company.portfolioCount} properties` : "-"}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Size Tier</Label>
                                    <div className="text-sm font-medium capitalize">
                                      {company.size || "-"}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Role/Industry */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Role</Label>
                                  <div className="text-sm">
                                    {company.industry ? formatRole(company.industry) : "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

                  {/* Properties Tab - only for contacts */}
                  {entityType === "contact" && (
                    <TabsContent value="contact-properties" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowLinkPropertyDialog(true)}
                            className="gap-2"
                          >
                            <Link2 className="h-4 w-4" />
                            Link Property
                          </Button>
                        </div>
                        {contactProperties.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Anchor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No properties linked to this contact</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {contactProperties.map((link: any) => {
                          const property = link.property || link;
                          const amenities = Array.isArray(property.amenities) ? property.amenities : [];
                          return (
                            <div key={link.id} className="rounded-lg border bg-card p-4 space-y-4">
                              {/* Property Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
                                    <Anchor className="h-6 w-6" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-lg">{property.title || property.name || property.address || "Unnamed Property"}</h3>
                                      {modeledPropertyIds.has(property.id) && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                          <BarChart3 className="h-2.5 w-2.5" />
                                          Modeled
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      {link.role && <span>{formatRole(link.role)}</span>}
                                      <Badge variant={
                                        property.status === 'available' ? 'default' :
                                        property.status === 'under_contract' ? 'secondary' :
                                        property.status === 'sold' ? 'outline' : 'destructive'
                                      }>
                                        {property.status ? formatRole(property.status) : "Unknown"}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    setLocation(`/crm/properties/${property.id}`);
                                  }}
                                  data-testid={`button-view-property-${property.id}`}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View Property
                                </Button>
                              </div>

                              {/* Location */}
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Location</Label>
                                <div className="text-sm flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  {[property.address, property.city, property.state, property.zipCode]
                                    .filter(Boolean)
                                    .join(", ") || "-"}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Listing Price</Label>
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                                    {property.listingPrice ? `${Number(property.listingPrice).toLocaleString()}` : "-"}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Type</Label>
                                  <div className="text-sm capitalize">
                                    {property.type ? formatRole(property.type) : "-"}
                                  </div>
                                </div>
                              </div>

                              <Separator />

                              {/* Capacity */}
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Marina Capacity</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Wet Slips</Label>
                                    <div className="text-sm font-medium">{property.wetSlips ?? "-"}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Dry Slips</Label>
                                    <div className="text-sm font-medium">{property.drySlips ?? "-"}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Moorings</Label>
                                    <div className="text-sm font-medium">{property.moorings ?? "-"}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Total</Label>
                                    <div className="text-sm font-medium">{property.totalCapacity ?? "-"}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Financials */}
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Financials</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Occupancy</Label>
                                    <div className="text-sm font-medium">
                                      {property.occupancyRate ? `${Number(property.occupancyRate).toFixed(1)}%` : "-"}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Annual Revenue</Label>
                                    <div className="text-sm font-medium">
                                      {property.annualRevenue ? `$${Number(property.annualRevenue).toLocaleString()}` : "-"}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">NOI Estimate</Label>
                                    <div className="text-sm font-medium">
                                      {property.noiEstimate ? `$${Number(property.noiEstimate).toLocaleString()}` : "-"}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Amenities */}
                              {amenities.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Amenities</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {amenities.map((amenity: string) => (
                                      <Badge key={amenity} variant="outline" className="text-xs">
                                        {formatRole(amenity)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
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
      {/* Action Modals */}
      {entityId && entity && (
        <>
          <NoteModal
            open={noteModalOpen}
            onOpenChange={setNoteModalOpen}
            entityType={entityType}
            entityId={entityId}
            entityName={getEntityName()}
            linkedCompanyId={entityType === "contact" ? contactCompanies?.[0]?.company?.id : undefined}
            linkedCompanyName={entityType === "contact" ? contactCompanies?.[0]?.company?.name : undefined}
          />
          <TaskModal
            open={taskModalOpen}
            onOpenChange={setTaskModalOpen}
            entityType={entityType}
            entityId={entityId}
            entityName={getEntityName()}
            linkedCompanyId={entityType === "contact" ? contactCompanies?.[0]?.company?.id : undefined}
            linkedCompanyName={entityType === "contact" ? contactCompanies?.[0]?.company?.name : undefined}
          />
          <CallModal
            open={callModalOpen}
            onOpenChange={setCallModalOpen}
            entityType={entityType}
            entityId={entityId}
            entityName={getEntityName()}
            phone={entity?.phone || entity?.phones?.[0]?.number}
          />
          <EmailRedirectModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            entityType={entityType}
            entityId={entityId}
            entityName={getEntityName()}
            email={entity?.email}
          />
        </>
      )}
      {/* Link Company Dialog */}
      <Dialog open={showLinkCompanyDialog} onOpenChange={setShowLinkCompanyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Link Company to Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search Companies</Label>
              <Input
                placeholder="Search by company name..."
                value={companySearchQuery}
                onChange={(e) => setCompanySearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Company</Label>
              <Select value={selectedCompanyToLink} onValueChange={setSelectedCompanyToLink}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose company" />
                </SelectTrigger>
                <SelectContent>
                  {allCompanies
                    .filter((c: any) => !contactCompanies.some((cc: any) => cc.companyId === c.id || cc.company?.id === c.id))
                    .filter((c: any) => !companySearchQuery || c.name?.toLowerCase().includes(companySearchQuery.toLowerCase()))
                    .map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} {company.industry && `- ${company.industry}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role at Company</Label>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="investor">Investor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLinkCompanyDialog(false);
              setSelectedCompanyToLink("");
              setCompanySearchQuery("");
              setLinkRole("owner");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => linkCompanyMutation.mutate({ companyId: selectedCompanyToLink, role: linkRole })}
              disabled={!selectedCompanyToLink || linkCompanyMutation.isPending}
            >
              {linkCompanyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Property Dialog */}
      <Dialog open={showLinkPropertyDialog} onOpenChange={setShowLinkPropertyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="w-5 h-5" />
              Link Property to {entityType === 'contact' ? 'Contact' : 'Company'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search Properties</Label>
              <Input
                placeholder="Search by name or address..."
                value={propertySearchQuery}
                onChange={(e) => setPropertySearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Property</Label>
              <Select value={selectedPropertyToLink} onValueChange={setSelectedPropertyToLink}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose property" />
                </SelectTrigger>
                <SelectContent>
                  {allProperties
                    .filter((p: any) => {
                      const linked = entityType === 'contact' ? contactProperties : companyProperties;
                      return !linked.some((lp: any) => lp.propertyId === p.id || lp.property?.id === p.id);
                    })
                    .filter((p: any) => !propertySearchQuery || 
                      p.title?.toLowerCase().includes(propertySearchQuery.toLowerCase()) ||
                      p.name?.toLowerCase().includes(propertySearchQuery.toLowerCase()) ||
                      p.address?.toLowerCase().includes(propertySearchQuery.toLowerCase())
                    )
                    .map((property: any) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.title || property.name || property.address || 'Unnamed Property'}
                        {property.city && ` - ${property.city}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="investor">Investor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLinkPropertyDialog(false);
              setSelectedPropertyToLink("");
              setPropertySearchQuery("");
              setLinkRole("owner");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (entityType === 'contact') {
                  linkPropertyToContactMutation.mutate({ propertyId: selectedPropertyToLink, relationship: linkRole });
                } else {
                  linkPropertyToCompanyMutation.mutate({ propertyId: selectedPropertyToLink, relationship: linkRole });
                }
              }}
              disabled={!selectedPropertyToLink || linkPropertyToContactMutation.isPending || linkPropertyToCompanyMutation.isPending}
            >
              {(linkPropertyToContactMutation.isPending || linkPropertyToCompanyMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Link Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

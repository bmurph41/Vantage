import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp, DollarSign, Building2, MapPin, Calendar, Trash2, Plus, Search,
  FolderOpen, FileText, Link2, ArrowRightCircle, MoreVertical, Star, ExternalLink,
  Anchor, PercentIcon, CheckCircle2, X, Shield, Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Deal, SalesComp, RateComp } from "@shared/schema";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface DealIntegrationPanelProps {
  dealId: string;
  dealTitle: string;
  onConvertToDd?: () => void;
}

function SalesCompCard({ comp, linkMetadata, onUnlink }: { 
  comp: SalesComp & { linkMetadata?: any }; 
  linkMetadata?: any;
  onUnlink: () => void;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`sales-comp-card-${comp.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm">{comp.marinaName || "Unnamed Marina"}</span>
              {linkMetadata?.isPrimary && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <Star className="w-3 h-3 mr-1" />
                  Primary
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{comp.state || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{comp.saleYear || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>{formatCurrency(comp.salePrice)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                <span>{comp.totalSlips || "N/A"} slips</span>
              </div>
            </div>
            {linkMetadata?.relevanceScore && (
              <div className="mt-2 flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  Relevance: {linkMetadata.relevanceScore}%
                </Badge>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`sales-comp-menu-${comp.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/sales-comps?id=${comp.id}`, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUnlink} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Unlink
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCompCard({ comp, linkMetadata, onUnlink }: { 
  comp: RateComp & { linkMetadata?: any }; 
  linkMetadata?: any;
  onUnlink: () => void;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`rate-comp-card-${comp.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm">{comp.marinaName || "Unnamed Marina"}</span>
              {linkMetadata?.isPrimary && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <Star className="w-3 h-3 mr-1" />
                  Primary
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{comp.city}, {comp.state || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                <span>{comp.totalSlips || "N/A"} slips</span>
              </div>
              <div className="flex items-center gap-1">
                <PercentIcon className="w-3 h-3" />
                <span>{formatPercent(comp.occupancyRate)}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>{formatCurrency(comp.avgMonthlyRate)}/mo</span>
              </div>
            </div>
            {linkMetadata?.relevanceScore && (
              <div className="mt-2 flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  Relevance: {linkMetadata.relevanceScore}%
                </Badge>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`rate-comp-menu-${comp.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/rate-comps?id=${comp.id}`, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUnlink} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Unlink
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function VdrFolderCard({ folder, onUnlink }: { 
  folder: any; 
  onUnlink: () => void;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`vdr-folder-card-${folder.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-sm">{folder.name}</span>
            </div>
            <div className="text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>{folder.documentCount || 0} documents</span>
              </div>
              {folder.linkMetadata?.linkType && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {folder.linkMetadata.linkType}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`vdr-folder-menu-${folder.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`/vdr?folder=${folder.id}`, '_blank')}>
                <Eye className="w-4 h-4 mr-2" />
                Open Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUnlink} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Unlink
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function LinkCompModal({
  isOpen,
  onClose,
  dealId,
  compType,
}: {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  compType: "sales" | "rate";
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: salesComps = [], isLoading: salesLoading } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps'],
    enabled: compType === "sales" && isOpen,
  });

  const { data: rateComps = [], isLoading: rateLoading } = useQuery<RateComp[]>({
    queryKey: ['/api/rate-comps'],
    enabled: compType === "rate" && isOpen,
  });

  const comps = compType === "sales" ? salesComps : rateComps;
  const isLoading = compType === "sales" ? salesLoading : rateLoading;

  const filteredComps = comps.filter((comp: any) =>
    (comp.marinaName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (comp.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (comp.state || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompId) throw new Error("No comp selected");
      const endpoint = compType === "sales"
        ? `/api/integration/deals/${dealId}/sales-comps`
        : `/api/integration/deals/${dealId}/rate-comps`;
      const body = compType === "sales"
        ? { salesCompId: selectedCompId, isPrimary, notes }
        : { rateCompId: selectedCompId, isPrimary, notes };
      return apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      const key = compType === "sales" 
        ? `/api/integration/deals/${dealId}/sales-comps`
        : `/api/integration/deals/${dealId}/rate-comps`;
      queryClient.invalidateQueries({ queryKey: [key] });
      toast({
        title: "Comp Linked",
        description: `Successfully linked ${compType} comp to this deal.`,
      });
      onClose();
      setSelectedCompId(null);
      setIsPrimary(false);
      setNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link comp",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="link-comp-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link {compType === "sales" ? "Sales" : "Rate"} Comp
          </DialogTitle>
          <DialogDescription>
            Search and select a comparable to link to this deal for analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by marina name, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-comps-input"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredComps.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No comps found matching your search</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredComps.map((comp: any) => (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompId(comp.id)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedCompId === comp.id
                        ? "border-blue-500 bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                    data-testid={`comp-option-${comp.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{comp.marinaName || "Unnamed"}</div>
                        <div className="text-xs text-gray-500">
                          {comp.city}, {comp.state} • {compType === "sales" ? formatCurrency(comp.salePrice) : formatCurrency(comp.avgMonthlyRate) + "/mo"}
                        </div>
                      </div>
                      {selectedCompId === comp.id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPrimary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(checked === true)}
                data-testid="is-primary-checkbox"
              />
              <Label htmlFor="isPrimary" className="text-sm">
                Mark as primary comparable
              </Label>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about why this comp is relevant..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
                data-testid="comp-notes-input"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-link-btn">
            Cancel
          </Button>
          <Button
            onClick={() => linkMutation.mutate()}
            disabled={!selectedCompId || linkMutation.isPending}
            data-testid="confirm-link-btn"
          >
            {linkMutation.isPending ? "Linking..." : "Link Comp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToDdModal({
  isOpen,
  onClose,
  dealId,
  dealTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealTitle: string;
}) {
  const [createVdrFolder, setCreateVdrFolder] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['/api/dd/templates'],
    enabled: isOpen,
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/integration/deals/${dealId}/convert-to-project`, {
        method: "POST",
        body: JSON.stringify({
          templateId: selectedTemplateId || undefined,
          createVdrFolder,
        }),
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      toast({
        title: "Deal Converted",
        description: `Successfully created DD project from this deal.${result.vdrFolderId ? " VDR folder created." : ""}`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert deal",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="convert-to-dd-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightCircle className="w-5 h-5" />
            Convert to DD Project
          </DialogTitle>
          <DialogDescription>
            Create a Due Diligence project from "{dealTitle}". This will set up tasks and optionally create a VDR folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium">Project Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="mt-1" data-testid="template-select">
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No template</SelectItem>
                {templates.map((template: any) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Templates pre-populate tasks and checklists for the DD project.
            </p>
          </div>

          <div className="flex items-start space-x-3 border rounded-md p-3 bg-gray-50">
            <Checkbox
              id="createVdr"
              checked={createVdrFolder}
              onCheckedChange={(checked) => setCreateVdrFolder(checked === true)}
              data-testid="create-vdr-checkbox"
            />
            <div>
              <Label htmlFor="createVdr" className="font-medium text-sm">
                Create VDR Folder
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Automatically create a secure Virtual Data Room folder for this project's documents.
              </p>
            </div>
          </div>

          <div className="border rounded-md p-3 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
              <Shield className="w-4 h-4" />
              What will be created:
            </div>
            <ul className="mt-2 space-y-1 text-xs text-blue-600">
              <li>• New DD project linked to this deal</li>
              <li>• Contacts and activities will be preserved</li>
              {createVdrFolder && <li>• VDR folder with deal documents</li>}
              {selectedTemplateId && <li>• Tasks from the selected template</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-convert-btn">
            Cancel
          </Button>
          <Button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            data-testid="confirm-convert-btn"
          >
            {convertMutation.isPending ? "Converting..." : "Convert Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DealIntegrationPanel({ dealId, dealTitle, onConvertToDd }: DealIntegrationPanelProps) {
  const [activeTab, setActiveTab] = useState("sales-comps");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkCompType, setLinkCompType] = useState<"sales" | "rate">("sales");
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: salesComps = [], isLoading: salesLoading } = useQuery({
    queryKey: [`/api/integration/deals/${dealId}/sales-comps`],
    enabled: !!dealId,
  });

  const { data: rateComps = [], isLoading: rateLoading } = useQuery({
    queryKey: [`/api/integration/deals/${dealId}/rate-comps`],
    enabled: !!dealId,
  });

  const { data: vdrFolders = [], isLoading: vdrLoading } = useQuery({
    queryKey: [`/api/integration/deals/${dealId}/vdr-folders`],
    enabled: !!dealId,
  });

  const unlinkSalesCompMutation = useMutation({
    mutationFn: async (salesCompId: string) => {
      return apiRequest(`/api/integration/deals/${dealId}/sales-comps/${salesCompId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/deals/${dealId}/sales-comps`] });
      toast({ title: "Comp Unlinked", description: "Sales comp has been unlinked from this deal." });
    },
  });

  const unlinkRateCompMutation = useMutation({
    mutationFn: async (rateCompId: string) => {
      return apiRequest(`/api/integration/deals/${dealId}/rate-comps/${rateCompId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/deals/${dealId}/rate-comps`] });
      toast({ title: "Comp Unlinked", description: "Rate comp has been unlinked from this deal." });
    },
  });

  const unlinkVdrMutation = useMutation({
    mutationFn: async (vdrFolderId: string) => {
      return apiRequest(`/api/integration/deals/${dealId}/vdr-folders/${vdrFolderId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/deals/${dealId}/vdr-folders`] });
      toast({ title: "Folder Unlinked", description: "VDR folder has been unlinked from this deal." });
    },
  });

  const openLinkModal = (type: "sales" | "rate") => {
    setLinkCompType(type);
    setLinkModalOpen(true);
  };

  return (
    <>
      <Card className="border shadow-sm" data-testid="deal-integration-panel">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-600" />
                Linked Data
              </CardTitle>
              <CardDescription>
                Connected comparables, documents, and projects
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setConvertModalOpen(true)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="convert-to-dd-btn"
            >
              <ArrowRightCircle className="w-4 h-4 mr-1" />
              Convert to DD
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="sales-comps" className="text-xs" data-testid="tab-sales-comps">
                <TrendingUp className="w-3 h-3 mr-1" />
                Sales ({salesComps.length})
              </TabsTrigger>
              <TabsTrigger value="rate-comps" className="text-xs" data-testid="tab-rate-comps">
                <DollarSign className="w-3 h-3 mr-1" />
                Rates ({rateComps.length})
              </TabsTrigger>
              <TabsTrigger value="vdr" className="text-xs" data-testid="tab-vdr">
                <FolderOpen className="w-3 h-3 mr-1" />
                VDR ({vdrFolders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales-comps" className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Linked sales comparables for valuation</p>
                <Button size="sm" variant="outline" onClick={() => openLinkModal("sales")} data-testid="add-sales-comp-btn">
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {salesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : salesComps.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-md border-dashed border-2">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">No sales comps linked yet</p>
                  <Button size="sm" variant="link" onClick={() => openLinkModal("sales")}>
                    Link your first comparable
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {salesComps.map((comp: any) => (
                    <SalesCompCard
                      key={comp.id}
                      comp={comp}
                      linkMetadata={comp.linkMetadata}
                      onUnlink={() => unlinkSalesCompMutation.mutate(comp.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rate-comps" className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Linked rate comparables for pricing</p>
                <Button size="sm" variant="outline" onClick={() => openLinkModal("rate")} data-testid="add-rate-comp-btn">
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {rateLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : rateComps.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-md border-dashed border-2">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">No rate comps linked yet</p>
                  <Button size="sm" variant="link" onClick={() => openLinkModal("rate")}>
                    Link your first rate comparable
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {rateComps.map((comp: any) => (
                    <RateCompCard
                      key={comp.id}
                      comp={comp}
                      linkMetadata={comp.linkMetadata}
                      onUnlink={() => unlinkRateCompMutation.mutate(comp.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="vdr" className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Linked VDR folders and documents</p>
              </div>
              {vdrLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : vdrFolders.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-md border-dashed border-2">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">No VDR folders linked</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Convert to DD project to auto-create VDR folder
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vdrFolders.map((folder: any) => (
                    <VdrFolderCard
                      key={folder.id}
                      folder={folder}
                      onUnlink={() => unlinkVdrMutation.mutate(folder.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <LinkCompModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        dealId={dealId}
        compType={linkCompType}
      />

      <ConvertToDdModal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        dealId={dealId}
        dealTitle={dealTitle}
      />
    </>
  );
}

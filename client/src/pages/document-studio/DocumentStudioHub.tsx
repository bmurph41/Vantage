import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Search, Filter, MoreHorizontal, Edit, Copy, Download,
  Share2, Trash2, FileSpreadsheet, Presentation, BookOpen, FileCheck,
  Briefcase, Building, Clock, Star, ChevronRight, FolderOpen, Sparkles,
  Zap, Layout, Eye, ExternalLink, ArrowRight,
} from "lucide-react";
import type { DocumentType, AssetClass, AudiencePersona } from "@shared/document-builder/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentRecord {
  id: number;
  title: string;
  documentType: DocumentType;
  status: "draft" | "published" | "archived";
  dealId: number | null;
  dealName?: string;
  projectName?: string;
  assetClass: AssetClass | null;
  audience: AudiencePersona | null;
  templateId: number | null;
  updatedAt: string;
  createdAt: string;
}

interface TemplateRecord {
  id: number;
  name: string;
  documentType: DocumentType;
  assetClass: AssetClass | null;
  previewUrl?: string;
  description?: string;
}

interface ProjectRecord {
  id: number;
  name: string;
  dealId: number;
}

interface QuickAction {
  type: DocumentType | "quick_report";
  title: string;
  description: string;
  icon: React.ReactNode;
  estimatedTime: string;
  route: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: QuickAction[] = [
  {
    type: "offering_memorandum",
    title: "Offering Memorandum",
    description: "Full OM with all sections, financials, and market data",
    icon: <BookOpen className="h-5 w-5" />,
    estimatedTime: "45-60 min",
    route: "/document-studio/new?type=offering_memorandum",
  },
  {
    type: "executive_summary",
    title: "Executive Summary",
    description: "Concise 2-3 page investment overview",
    icon: <FileCheck className="h-5 w-5" />,
    estimatedTime: "15-20 min",
    route: "/document-studio/new?type=executive_summary",
  },
  {
    type: "ic_memo",
    title: "Investment Memo",
    description: "IC-ready analysis with risk assessment",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    estimatedTime: "30-45 min",
    route: "/document-studio/new?type=ic_memo",
  },
  {
    type: "pitch_deck",
    title: "Pitch Deck",
    description: "Visual presentation for investor meetings",
    icon: <Presentation className="h-5 w-5" />,
    estimatedTime: "25-35 min",
    route: "/document-studio/new?type=pitch_deck",
  },
  {
    type: "lender_package",
    title: "Lender Package",
    description: "Debt-focused package with underwriting data",
    icon: <Building className="h-5 w-5" />,
    estimatedTime: "30-40 min",
    route: "/document-studio/new?type=lender_package",
  },
  {
    type: "quick_report",
    title: "Quick Report",
    description: "Fast one-page property snapshot",
    icon: <Zap className="h-5 w-5" />,
    estimatedTime: "5-10 min",
    route: "/document-studio/new?type=quick_report",
  },
  {
    type: "teaser",
    title: "Teaser / Flyer",
    description: "Marketing one-pager for distribution",
    icon: <Star className="h-5 w-5" />,
    estimatedTime: "10-15 min",
    route: "/document-studio/new?type=teaser",
  },
  {
    type: "custom",
    title: "Custom Document",
    description: "Start from scratch with a blank canvas",
    icon: <Layout className="h-5 w-5" />,
    estimatedTime: "Varies",
    route: "/document-studio/new?type=custom",
  },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  offering_memorandum: "Offering Memorandum",
  executive_summary: "Executive Summary",
  ic_memo: "Investment Memo",
  pitch_deck: "Pitch Deck",
  lender_package: "Lender Package",
  teaser: "Teaser",
  due_diligence_summary: "DD Summary",
  custom: "Custom",
  quick_report: "Quick Report",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentStudioHub() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // New-document dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const [newDocAudience, setNewDocAudience] = useState<string>("");
  const [newDocAssetClass, setNewDocAssetClass] = useState<string>("");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ---- Data fetching ----

  const { data: documents, isLoading: docsLoading } = useQuery<DocumentRecord[]>({
    queryKey: ["document-builder", "documents"],
    queryFn: async () => {
      const res = await fetch("/api/document-builder/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      const json = await res.json();
      return json.data ?? json;
    },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<TemplateRecord[]>({
    queryKey: ["document-builder", "templates"],
    queryFn: async () => {
      const res = await fetch("/api/document-builder/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const json = await res.json();
      return json.data ?? json;
    },
  });

  const { data: projects } = useQuery<ProjectRecord[]>({
    queryKey: ["modeling", "projects"],
    queryFn: async () => {
      const res = await fetch("/api/modeling/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      const json = await res.json();
      return json.data ?? json;
    },
  });

  // ---- Mutations ----

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/document-builder/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-builder", "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/document-builder/documents/${docId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Duplicate failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-builder", "documents"] });
      toast({ title: "Document duplicated" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      documentType: DocumentType;
      title: string;
      dealId?: number;
      templateId?: number;
      audience?: string;
      assetClass?: string;
    }) => {
      const res = await fetch("/api/document-builder/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Create failed");
      const json = await res.json();
      return json.data ?? json;
    },
    onSuccess: (data: DocumentRecord) => {
      queryClient.invalidateQueries({ queryKey: ["document-builder", "documents"] });
      setShowNewDialog(false);
      resetWizard();
      navigate(`/document-studio/editor/${data.id}`);
    },
  });

  // ---- Computed ----

  const stats = useMemo(() => {
    if (!documents) return { total: 0, published: 0, drafts: 0, templatesUsed: 0 };
    const templateIds = new Set(documents.filter((d) => d.templateId).map((d) => d.templateId));
    return {
      total: documents.length,
      published: documents.filter((d) => d.status === "published").length,
      drafts: documents.filter((d) => d.status === "draft").length,
      templatesUsed: templateIds.size,
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    return documents
      .filter((d) => {
        if (filterType !== "all" && d.documentType !== filterType) return false;
        if (filterStatus !== "all" && d.status !== filterStatus) return false;
        if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [documents, filterType, filterStatus, searchQuery]);

  const projectGroups = useMemo(() => {
    if (!documents || !projects) return [];
    const map = new Map<number, { project: ProjectRecord; docs: DocumentRecord[] }>();
    for (const p of projects) {
      map.set(p.dealId, { project: p, docs: [] });
    }
    for (const d of documents) {
      if (d.dealId && map.has(d.dealId)) {
        map.get(d.dealId)!.docs.push(d);
      }
    }
    return Array.from(map.values()).filter((g) => g.docs.length > 0);
  }, [documents, projects]);

  // ---- Helpers ----

  function resetWizard() {
    setWizardStep(1);
    setSelectedType(null);
    setSelectedProjectId("");
    setSelectedTemplateId(null);
    setNewDocName("");
    setNewDocAudience("");
    setNewDocAssetClass("");
  }

  function handleCreateSubmit() {
    if (!selectedType || !newDocName.trim()) return;
    createMutation.mutate({
      documentType: selectedType,
      title: newDocName.trim(),
      dealId: selectedProjectId ? Number(selectedProjectId) : undefined,
      templateId: selectedTemplateId ?? undefined,
      audience: newDocAudience || undefined,
      assetClass: newDocAssetClass || undefined,
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ---- Render helpers ----

  function renderStatCard(label: string, value: number, icon: React.ReactNode) {
    return (
      <Card className="flex-1 min-w-[140px]">
        <CardContent className="flex items-center gap-3 py-4 px-5">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderLoadingSkeleton() {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 flex-1" />
          ))}
        </div>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <Skeleton className="h-8 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  function renderEmptyDocuments() {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No documents yet</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Create your first investment document using a quick action above or start from a template.
        </p>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </div>
    );
  }

  // =========================================================================
  // Main render
  // =========================================================================

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      <div className="container mx-auto py-6 px-4 max-w-7xl space-y-8">
        {/* ---- Header ---- */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Document Studio</h1>
              <p className="text-sm text-muted-foreground">
                Create, customize, and export professional investment documents
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>

        {/* ---- Stats row ---- */}
        <div className="flex flex-wrap gap-4">
          {renderStatCard("Total Documents", stats.total, <FileText className="h-4 w-4" />)}
          {renderStatCard("Published", stats.published, <FileCheck className="h-4 w-4" />)}
          {renderStatCard("Drafts", stats.drafts, <Edit className="h-4 w-4" />)}
          {renderStatCard("Templates Used", stats.templatesUsed, <Layout className="h-4 w-4" />)}
        </div>

        {/* ---- Quick Actions ---- */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Quick Start
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <Card
                key={action.type}
                className="hover:shadow-md transition-shadow cursor-pointer group"
              >
                <CardContent className="py-5 px-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      {action.icon}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      <Clock className="h-3 w-3 mr-1" />
                      {action.estimatedTime}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
                  <p className="text-xs text-muted-foreground flex-1 mb-3">{action.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(action.route)}
                  >
                    Create
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* ---- Template Gallery ---- */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Template Gallery
            </h2>
            <Link href="/document-studio/templates">
              <Button variant="ghost" size="sm">
                Browse All Templates
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {templatesLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-52 w-64 flex-shrink-0" />
              ))}
            </div>
          ) : !templates || templates.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No templates available yet. Templates will appear here once your team creates them.
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {templates.map((tpl) => (
                  <Card key={tpl.id} className="w-64 flex-shrink-0 hover:shadow-md transition-shadow">
                    <div className="h-28 bg-gradient-to-br from-primary/5 to-primary/15 rounded-t-lg flex items-center justify-center">
                      <FileText className="h-10 w-10 text-primary/40" />
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-medium text-sm truncate">{tpl.name}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {DOC_TYPE_LABELS[tpl.documentType] ?? tpl.documentType}
                        </Badge>
                        {tpl.assetClass && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {tpl.assetClass.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1"
                        onClick={() => {
                          setSelectedTemplateId(tpl.id);
                          setSelectedType(tpl.documentType);
                          setNewDocName(tpl.name);
                          setWizardStep(4);
                          setShowNewDialog(true);
                        }}
                      >
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        <Separator />

        {/* ---- Recent Documents ---- */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Recent Documents
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {docsLoading ? (
            renderLoadingSkeleton()
          ) : !filteredDocuments.length ? (
            renderEmptyDocuments()
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium">Name</th>
                      <th className="text-left py-3 px-4 font-medium">Type</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Project</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Modified</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            className="font-medium text-primary hover:underline text-left"
                            onClick={() => navigate(`/document-studio/editor/${doc.id}`)}
                          >
                            {doc.title}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-[10px]">
                            {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                          {doc.projectName ?? doc.dealName ?? "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`text-[10px] ${STATUS_STYLES[doc.status] ?? ""}`}>
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                          {formatDate(doc.updatedAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/document-studio/editor/${doc.id}`)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/document-studio/editor/${doc.id}`)}>
                                  <Edit className="h-3.5 w-3.5 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateMutation.mutate(doc.id)}>
                                  <Copy className="h-3.5 w-3.5 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/api/document-builder/documents/${doc.id}/export?format=pdf`)}>
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Export PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/api/document-builder/documents/${doc.id}/export?format=docx`)}>
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Export DOCX
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/api/document-builder/documents/${doc.id}/export?format=pptx`)}>
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Export PPTX
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Share2 className="h-3.5 w-3.5 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteMutation.mutate(doc.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        <Separator />

        {/* ---- Project-Linked Documents ---- */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Project-Linked Documents
          </h2>

          {projectGroups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Link documents to projects for organized tracking
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectGroups.map(({ project, docs }) => (
                <Card key={project.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{project.name}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProjectId(String(project.dealId));
                          setWizardStep(1);
                          setShowNewDialog(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Create
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {docs.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <button
                            className="text-primary hover:underline truncate max-w-[70%] text-left"
                            onClick={() => navigate(`/document-studio/editor/${d.id}`)}
                          >
                            {d.title}
                          </button>
                          <Badge className={`text-[10px] ${STATUS_STYLES[d.status] ?? ""}`}>
                            {d.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ================================================================= */}
      {/* New Document Dialog                                               */}
      {/* ================================================================= */}
      <Dialog
        open={showNewDialog}
        onOpenChange={(open) => {
          if (!open) resetWizard();
          setShowNewDialog(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && "Choose a document type to get started"}
              {wizardStep === 2 && "Link this document to a project (optional)"}
              {wizardStep === 3 && "Start from a template or blank"}
              {wizardStep === 4 && "Configure your document details"}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step <= wizardStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Document type */}
          {wizardStep === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.filter((a) => a.type !== "quick_report").map((action) => (
                <button
                  key={action.type}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedType === action.type
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/40"
                  }`}
                  onClick={() => setSelectedType(action.type as DocumentType)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-primary">{action.icon}</span>
                    <span className="font-medium text-sm">{action.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Link project */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.dealId)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking a project auto-populates deal data into your document sections.
              </p>
            </div>
          )}

          {/* Step 3: Choose template */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <button
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  selectedTemplateId === null
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                }`}
                onClick={() => setSelectedTemplateId(null)}
              >
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Start Blank</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Begin with default sections for your document type
                </p>
              </button>
              {(templates ?? [])
                .filter((t) => !selectedType || t.documentType === selectedType)
                .map((tpl) => (
                  <button
                    key={tpl.id}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedTemplateId === tpl.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/40"
                    }`}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{tpl.name}</span>
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                    )}
                  </button>
                ))}
            </div>
          )}

          {/* Step 4: Configure */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Document Name</label>
                <Input
                  placeholder="e.g. Sunrise Marina - Offering Memorandum"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Target Audience</label>
                <Select value={newDocAudience} onValueChange={setNewDocAudience}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institutional_investor">Institutional Investor</SelectItem>
                    <SelectItem value="private_equity">Private Equity</SelectItem>
                    <SelectItem value="family_office">Family Office</SelectItem>
                    <SelectItem value="lender">Lender</SelectItem>
                    <SelectItem value="investment_committee">Investment Committee</SelectItem>
                    <SelectItem value="board_of_directors">Board of Directors</SelectItem>
                    <SelectItem value="potential_buyer">Potential Buyer</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Asset Class</label>
                <Select value={newDocAssetClass} onValueChange={setNewDocAssetClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marina">Marina</SelectItem>
                    <SelectItem value="rv_park">RV Park</SelectItem>
                    <SelectItem value="mobile_home_park">Mobile Home Park</SelectItem>
                    <SelectItem value="self_storage">Self Storage</SelectItem>
                    <SelectItem value="multifamily">Multifamily</SelectItem>
                    <SelectItem value="mixed_use">Mixed Use</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {wizardStep > 1 && (
                <Button variant="outline" onClick={() => setWizardStep((s) => s - 1)}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setShowNewDialog(false); resetWizard(); }}>
                Cancel
              </Button>
              {wizardStep < 4 ? (
                <Button
                  onClick={() => setWizardStep((s) => s + 1)}
                  disabled={wizardStep === 1 && !selectedType}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreateSubmit}
                  disabled={!newDocName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create & Open Editor"}
                  <ExternalLink className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

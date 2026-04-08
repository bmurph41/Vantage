import React, { useState, useMemo, useRef } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, Plus, Search, Filter, MoreHorizontal, Edit, Copy, Download,
  Share2, Trash2, FileSpreadsheet, Presentation, BookOpen, FileCheck,
  Briefcase, Building, Clock, Star, ChevronRight, FolderOpen, Sparkles,
  Zap, Layout, Eye, ExternalLink, ArrowRight, ImagePlus, CheckCircle2,
  Upload, Camera, Database,
} from "lucide-react";
import type { DocumentType, AssetClass, AudiencePersona } from "@shared/document-builder/types";
import { AssetClassSelect } from "@/components/ui/asset-class-select";

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

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  review: { label: "In Review", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  generating: { label: "Generating", className: "bg-purple-100 text-purple-700" },
  completed: { label: "Published", className: "bg-green-100 text-green-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
  published: { label: "Published", className: "bg-green-100 text-green-700" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600" },
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

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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

  // Fetch preview data for the selected project to show what will auto-populate
  const { data: projectPreview, isLoading: previewLoading } = useQuery<{
    propertyName?: string;
    address?: string;
    assetClass?: string;
    purchasePrice?: number;
    noi?: number;
    capRate?: number;
    units?: number;
    sqft?: number;
    yearBuilt?: number;
  }>({
    queryKey: ["project-preview", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId || selectedProjectId === "none") return {};
      const res = await fetch(`/api/om-builder/project/${selectedProjectId}/data`);
      if (!res.ok) return {};
      const json = await res.json();
      const d = json.data ?? json;
      return {
        propertyName: d.propertyName || d.property?.name,
        address: d.address || d.property?.address,
        assetClass: d.assetClass || d.property?.assetClass,
        purchasePrice: d.purchasePrice || d.financials?.purchasePrice,
        noi: d.noi || d.financials?.noi,
        capRate: d.capRate || d.financials?.capRate,
        units: d.units || d.property?.totalUnits,
        sqft: d.sqft || d.property?.totalSqft,
        yearBuilt: d.yearBuilt || d.property?.yearBuilt,
      };
    },
    enabled: !!selectedProjectId && selectedProjectId !== "none",
  });

  // Hero photo upload state
  const [heroPhotoFile, setHeroPhotoFile] = useState<File | null>(null);
  const [heroPhotoPreview, setHeroPhotoPreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleHeroPhotoSelect(file: File) {
    setHeroPhotoFile(file);
    const url = URL.createObjectURL(file);
    setHeroPhotoPreview(url);
  }

  function handleHeroPhotoDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleHeroPhotoSelect(file);
    }
  }

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
    onError: () => {
      toast({ title: "Operation failed", description: "Something went wrong. Please try again.", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Operation failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      documentType: DocumentType;
      title: string;
      dealId?: string;
      templateId?: string;
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
    onError: () => {
      toast({ title: "Operation failed", description: "Something went wrong. Please try again.", variant: "destructive" });
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
    setHeroPhotoFile(null);
    if (heroPhotoPreview) URL.revokeObjectURL(heroPhotoPreview);
    setHeroPhotoPreview(null);
  }

  function handleCreateSubmit() {
    if (!selectedType || !newDocName.trim()) return;
    createMutation.mutate({
      documentType: selectedType,
      title: newDocName.trim(),
      dealId: (selectedProjectId && selectedProjectId !== "none") ? selectedProjectId : undefined,
      templateId: selectedTemplateId ? String(selectedTemplateId) : undefined,
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
                    onClick={() => {
                      setSelectedType(action.type === "quick_report" ? "custom" as DocumentType : action.type as DocumentType);
                      if (action.type === "quick_report") {
                        navigate("/simple-report");
                        return;
                      }
                      setWizardStep(2);
                      setShowNewDialog(true);
                    }}
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
                          setWizardStep(3);
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
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="generating">Generating</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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
                          <Badge className={`text-[10px] ${STATUS_STYLES[doc.status]?.className ?? ""}`}>
                            {STATUS_STYLES[doc.status]?.label ?? doc.status}
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
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/document-builder/documents/${doc.id}/export`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ format: 'pdf' }),
                                    });
                                    if (!res.ok) throw new Error('Export failed');
                                    const json = await res.json();
                                    const job = json.data ?? json;
                                    toast({ title: 'Export started', description: `PDF export is being generated. Job ID: ${job.id}` });
                                    const checkJob = async () => {
                                      const jobRes = await fetch(`/api/document-builder/export/${job.id}`);
                                      const jobJson = await jobRes.json();
                                      const jobData = jobJson.data ?? jobJson;
                                      if (jobData.status === 'completed' && jobData.downloadUrl) {
                                        window.open(jobData.downloadUrl);
                                        toast({ title: 'Export ready', description: 'Your PDF is downloading.' });
                                      } else if (jobData.status === 'failed') {
                                        toast({ title: 'Export failed', variant: 'destructive' });
                                      } else {
                                        setTimeout(checkJob, 2000);
                                      }
                                    };
                                    setTimeout(checkJob, 2000);
                                  } catch {
                                    toast({ title: 'Export failed', variant: 'destructive' });
                                  }
                                }}>
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Export PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/document-builder/documents/${doc.id}/export`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ format: 'docx' }),
                                    });
                                    if (!res.ok) throw new Error('Export failed');
                                    const json = await res.json();
                                    const job = json.data ?? json;
                                    toast({ title: 'Export started', description: `DOCX export is being generated. Job ID: ${job.id}` });
                                    const checkJob = async () => {
                                      const jobRes = await fetch(`/api/document-builder/export/${job.id}`);
                                      const jobJson = await jobRes.json();
                                      const jobData = jobJson.data ?? jobJson;
                                      if (jobData.status === 'completed' && jobData.downloadUrl) {
                                        window.open(jobData.downloadUrl);
                                        toast({ title: 'Export ready', description: 'Your DOCX is downloading.' });
                                      } else if (jobData.status === 'failed') {
                                        toast({ title: 'Export failed', variant: 'destructive' });
                                      } else {
                                        setTimeout(checkJob, 2000);
                                      }
                                    };
                                    setTimeout(checkJob, 2000);
                                  } catch {
                                    toast({ title: 'Export failed', variant: 'destructive' });
                                  }
                                }}>
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Export DOCX
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/document-builder/documents/${doc.id}/export`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ format: 'pptx' }),
                                    });
                                    if (!res.ok) throw new Error('Export failed');
                                    const json = await res.json();
                                    const job = json.data ?? json;
                                    toast({ title: 'Export started', description: `PPTX export is being generated. Job ID: ${job.id}` });
                                    const checkJob = async () => {
                                      const jobRes = await fetch(`/api/document-builder/export/${job.id}`);
                                      const jobJson = await jobRes.json();
                                      const jobData = jobJson.data ?? jobJson;
                                      if (jobData.status === 'completed' && jobData.downloadUrl) {
                                        window.open(jobData.downloadUrl);
                                        toast({ title: 'Export ready', description: 'Your PPTX is downloading.' });
                                      } else if (jobData.status === 'failed') {
                                        toast({ title: 'Export failed', variant: 'destructive' });
                                      } else {
                                        setTimeout(checkJob, 2000);
                                      }
                                    };
                                    setTimeout(checkJob, 2000);
                                  } catch {
                                    toast({ title: 'Export failed', variant: 'destructive' });
                                  }
                                }}>
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Export PPTX
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const shareUrl = `${window.location.origin}/document-studio/editor/${doc.id}`;
                                  navigator.clipboard.writeText(shareUrl).then(() => {
                                    toast({ title: 'Link Copied', description: 'Document link copied to clipboard.' });
                                  });
                                }}>
                                  <Share2 className="h-3.5 w-3.5 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteConfirmId(doc.id)}
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
                          <Badge className={`text-[10px] ${STATUS_STYLES[d.status]?.className ?? ""}`}>
                            {STATUS_STYLES[d.status]?.label ?? d.status}
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
        <DialogContent className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && "Choose a document type to get started"}
              {wizardStep === 2 && "Link a project to auto-fill financials, property data, and comps"}
              {wizardStep === 3 && "Add your cover photo and finalize document settings"}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator — 3 steps */}
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3].map((step) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Step 2: Link project — shows auto-populate preview */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Link to Project</label>
                <Select
                  value={selectedProjectId}
                  onValueChange={(val) => {
                    setSelectedProjectId(val);
                    // Auto-populate name from project if blank
                    if (val && val !== "none") {
                      const proj = (projects ?? []).find((p) => String(p.dealId) === val);
                      if (proj && !newDocName) {
                        const typeLabel = DOC_TYPE_LABELS[selectedType || ""] || "Document";
                        setNewDocName(`${proj.name} - ${typeLabel}`);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <Database className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select a project to auto-fill data..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project — enter data manually</SelectItem>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.dealId)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-populate preview when project is selected */}
              {selectedProjectId && selectedProjectId !== "none" && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Data that will auto-populate</span>
                    </div>
                    {previewLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}
                      </div>
                    ) : projectPreview && Object.values(projectPreview).some(Boolean) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        {projectPreview.propertyName && (
                          <><span className="text-muted-foreground">Property</span><span className="font-medium truncate">{projectPreview.propertyName}</span></>
                        )}
                        {projectPreview.address && (
                          <><span className="text-muted-foreground">Address</span><span className="font-medium truncate">{projectPreview.address}</span></>
                        )}
                        {projectPreview.assetClass && (
                          <><span className="text-muted-foreground">Asset Class</span><span className="font-medium capitalize">{projectPreview.assetClass.replace(/_/g, " ")}</span></>
                        )}
                        {projectPreview.purchasePrice && (
                          <><span className="text-muted-foreground">Purchase Price</span><span className="font-medium">${projectPreview.purchasePrice.toLocaleString()}</span></>
                        )}
                        {projectPreview.noi && (
                          <><span className="text-muted-foreground">NOI</span><span className="font-medium">${projectPreview.noi.toLocaleString()}</span></>
                        )}
                        {projectPreview.capRate && (
                          <><span className="text-muted-foreground">Cap Rate</span><span className="font-medium">{(projectPreview.capRate * 100).toFixed(2)}%</span></>
                        )}
                        {projectPreview.units && (
                          <><span className="text-muted-foreground">Units</span><span className="font-medium">{projectPreview.units.toLocaleString()}</span></>
                        )}
                        {projectPreview.yearBuilt && (
                          <><span className="text-muted-foreground">Year Built</span><span className="font-medium">{projectPreview.yearBuilt}</span></>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Financial and property data from this project will populate document sections automatically.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {(!selectedProjectId || selectedProjectId === "none") && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  Linking a project auto-fills financials, property details, comps, and market data into every section.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Hero photo upload + document name + configure */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              {/* Hero Photo Upload — the primary variable element */}
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  Cover Photo
                  <Badge variant="outline" className="text-[9px] ml-1">Key Visual</Badge>
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer overflow-hidden ${
                    heroPhotoPreview
                      ? "border-primary/30 bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50 bg-muted/30"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleHeroPhotoDrop}
                >
                  {heroPhotoPreview ? (
                    <div className="relative">
                      <img
                        src={heroPhotoPreview}
                        alt="Cover preview"
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-sm font-medium flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Replace Photo
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-primary text-white text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Uploaded
                      </Badge>
                    </div>
                  ) : (
                    <div className="py-10 flex flex-col items-center text-center px-4">
                      <div className="rounded-full bg-primary/10 p-3 mb-3">
                        <ImagePlus className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-sm font-medium mb-1">
                        Drop your cover photo here or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Property exterior, aerial view, or hero image. PNG, JPG up to 10MB.
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleHeroPhotoSelect(file);
                  }}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  This is the most impactful element — it appears on the cover page of every generated document.
                </p>
              </div>

              <Separator />

              {/* Document Name */}
              <div>
                <label className="text-sm font-medium mb-1 block">Document Name</label>
                <Input
                  placeholder="e.g. Sunrise Marina - Offering Memorandum"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                />
              </div>

              {/* Audience + Asset Class in a row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <AssetClassSelect
                    value={newDocAssetClass || (projectPreview?.assetClass ?? "")}
                    onValueChange={setNewDocAssetClass}
                    placeholder="Select asset class"
                  />
                </div>
              </div>

              {/* Optional template choice inline */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Template (optional)</label>
                <Select
                  value={selectedTemplateId ? String(selectedTemplateId) : "blank"}
                  onValueChange={(val) => setSelectedTemplateId(val === "blank" ? null : Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Start blank or choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">
                      <span className="flex items-center gap-2">
                        <Layout className="h-3.5 w-3.5" />
                        Start Blank — default sections
                      </span>
                    </SelectItem>
                    {(templates ?? [])
                      .filter((t) => !selectedType || t.documentType === selectedType)
                      .map((tpl) => (
                        <SelectItem key={tpl.id} value={String(tpl.id)}>
                          <span className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5" />
                            {tpl.name}
                          </span>
                        </SelectItem>
                      ))}
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
              {wizardStep < 3 ? (
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

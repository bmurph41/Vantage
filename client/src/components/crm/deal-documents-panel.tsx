/**
 * DealDocumentsPanel
 * 
 * Document management panel for the deal detail drawer.
 * Shows categorized documents, upload status, and quick actions.
 * 
 * Categories: LOI, PSA, Financials, Environmental, DD Reports, Title, Other
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, Upload, FolderOpen, ExternalLink, Download, Eye,
  File, FileSpreadsheet, FileImage, FileType,
  Clock, Plus, MoreHorizontal, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────

interface DealDocumentsPanelProps {
  dealId: string | number;
  maxHeight?: string;
  onUploadClick?: () => void;
  onVDRClick?: () => void;
}

interface DealDocument {
  id: string;
  name: string;
  type?: string;
  category?: string;
  size?: number;
  url?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  status?: "draft" | "final" | "under_review" | "expired";
}

// ─── Document Categories ──────────────────────────────────────────

const DOCUMENT_CATEGORIES = [
  { key: "loi", label: "LOI / Offer", icon: FileText, color: "text-blue-600" },
  { key: "psa", label: "PSA / Contract", icon: FileText, color: "text-green-600" },
  { key: "financials", label: "Financials", icon: FileSpreadsheet, color: "text-purple-600" },
  { key: "environmental", label: "Environmental", icon: FileText, color: "text-amber-600" },
  { key: "dd_report", label: "DD Reports", icon: FolderOpen, color: "text-orange-600" },
  { key: "title", label: "Title / Survey", icon: FileText, color: "text-cyan-600" },
  { key: "appraisal", label: "Appraisal", icon: FileText, color: "text-rose-600" },
  { key: "other", label: "Other", icon: File, color: "text-slate-600" },
];

// ─── Component ────────────────────────────────────────────────────

export function DealDocumentsPanel({ dealId, maxHeight = "350px", onUploadClick, onVDRClick }: DealDocumentsPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Fetch deal files
  const { data: filesData, isLoading } = useQuery<DealDocument[]>({
    queryKey: [`/api/crm/files?entityType=deal&entityId=${dealId}`],
    enabled: !!dealId,
  });

  // Fallback to generic files endpoint
  const { data: fallbackFiles } = useQuery<DealDocument[]>({
    queryKey: [`/api/files?dealId=${dealId}`],
    enabled: !!dealId && !filesData?.length,
  });

  const files = filesData?.length ? filesData : (fallbackFiles || []);

  // Group by category
  const groupedFiles = useMemo(() => {
    const groups: Record<string, DealDocument[]> = {};
    DOCUMENT_CATEGORIES.forEach(cat => { groups[cat.key] = []; });

    files.forEach(file => {
      const cat = file.category || categorizeFile(file.name || file.type || "");
      if (groups[cat]) {
        groups[cat].push(file);
      } else {
        groups["other"].push(file);
      }
    });

    return groups;
  }, [files]);

  const totalFiles = files.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">Documents</h4>
          {totalFiles > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {totalFiles}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onVDRClick && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onVDRClick}>
              <FolderOpen className="h-3 w-3" />
              VDR
            </Button>
          )}
          {onUploadClick && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onUploadClick}>
              <Upload className="h-3 w-3" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea style={{ maxHeight }} className="pr-1">
        {isLoading ? (
          <DocumentsSkeleton />
        ) : totalFiles === 0 ? (
          <EmptyDocuments onUploadClick={onUploadClick} />
        ) : (
          <div className="space-y-1">
            {DOCUMENT_CATEGORIES.map(cat => {
              const catFiles = groupedFiles[cat.key];
              if (catFiles.length === 0) return null;
              
              const Icon = cat.icon;
              const isExpanded = expandedCategory === cat.key;

              return (
                <div key={cat.key} className="border rounded-md overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-3.5 w-3.5", cat.color)} />
                      <span className="text-xs font-medium">{cat.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {catFiles.length}
                    </Badge>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {catFiles.map(file => (
                        <DocumentRow key={file.id} file={file} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* DD Checklist Preview */}
      {totalFiles > 0 && (
        <div className="border rounded-md p-2.5 bg-muted/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">DD Completeness</span>
            <span className="text-[10px] font-semibold">
              {DOCUMENT_CATEGORIES.filter(c => (groupedFiles[c.key]?.length ?? 0) > 0).length}
              /{DOCUMENT_CATEGORIES.length} categories
            </span>
          </div>
          <div className="flex gap-0.5">
            {DOCUMENT_CATEGORIES.map(cat => (
              <TooltipProvider key={cat.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      (groupedFiles[cat.key]?.length ?? 0) > 0 ? "bg-green-500" : "bg-muted-foreground/20"
                    )} />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    {cat.label}: {(groupedFiles[cat.key]?.length ?? 0) > 0 ? "✓ Has files" : "Missing"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────

function DocumentRow({ file }: { file: DealDocument }) {
  const fileIcon = getFileIcon(file.name || "");

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 group">
      <div className="flex-shrink-0 text-muted-foreground">
        {fileIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name || "Untitled"}</p>
        <p className="text-[10px] text-muted-foreground">
          {file.uploadedAt ? formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true }) : ""}
          {file.size ? ` · ${formatFileSize(file.size)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.url && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" asChild>
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {file.status && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-[9px] h-4 px-1",
              file.status === "final" && "text-green-600 border-green-300",
              file.status === "draft" && "text-amber-600 border-amber-300",
              file.status === "expired" && "text-red-600 border-red-300"
            )}
          >
            {file.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyDocuments({ onUploadClick }: { onUploadClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">No documents yet</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5 max-w-[200px]">
        Upload LOIs, financials, environmental reports, and other deal documents.
      </p>
      {onUploadClick && (
        <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1" onClick={onUploadClick}>
          <Upload className="h-3 w-3" />
          Upload Documents
        </Button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────

function DocumentsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="border rounded-md p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────

function categorizeFile(nameOrType: string): string {
  const lower = nameOrType.toLowerCase();
  if (lower.includes("loi") || lower.includes("offer") || lower.includes("letter of intent")) return "loi";
  if (lower.includes("psa") || lower.includes("contract") || lower.includes("purchase")) return "psa";
  if (lower.includes("p&l") || lower.includes("financial") || lower.includes("income") || lower.includes("balance")) return "financials";
  if (lower.includes("phase") || lower.includes("environmental") || lower.includes("esa")) return "environmental";
  if (lower.includes("due diligence") || lower.includes("inspection") || lower.includes("report")) return "dd_report";
  if (lower.includes("title") || lower.includes("survey") || lower.includes("deed")) return "title";
  if (lower.includes("appraisal") || lower.includes("valuation")) return "appraisal";
  return "other";
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return <FileType className="h-3.5 w-3.5 text-red-500" />;
    case "xlsx": case "xls": case "csv": return <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />;
    case "jpg": case "jpeg": case "png": case "gif": return <FileImage className="h-3.5 w-3.5 text-purple-500" />;
    case "doc": case "docx": return <FileText className="h-3.5 w-3.5 text-blue-500" />;
    default: return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export default DealDocumentsPanel;

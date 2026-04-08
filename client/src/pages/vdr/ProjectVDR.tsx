import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Upload,
  Download,
  Share2,
  Trash2,
  Shield,
  Clock,
  ChevronRight,
  ArrowLeft,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Lock,
  Users,
  Plus,
  FolderLock,
  CheckSquare,
  Activity,
  BarChart3,
  ClipboardList,
  Image,
  FileSpreadsheet,
  FileArchive,
  ChevronDown,
  Copy,
  ExternalLink,
} from "lucide-react";
import { DocumentsWorkspace } from "@/components/vdr/DocumentsWorkspace";
import { PermissionViewer } from "@/components/vdr/PermissionViewer";
import { ExternalUsersTab } from "@/components/vdr/ExternalUsersTab";
import { DiligenceRequestsTab } from "@/components/vdr/DiligenceRequestsTab";
import { AuditLogViewer } from "@/components/vdr/AuditLogViewer";
import { AnalyticsDashboard } from "@/components/vdr/AnalyticsDashboard";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEFAULT_FOLDERS = [
  { name: "Legal", icon: "legal" },
  { name: "Financial", icon: "financial" },
  { name: "Environmental", icon: "environmental" },
  { name: "Insurance", icon: "insurance" },
  { name: "Permits & Licenses", icon: "permits" },
  { name: "Operations", icon: "operations" },
  { name: "Miscellaneous", icon: "misc" },
] as const;

type VdrFile = {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  size: number;
  folderId: string;
  folderName?: string;
  uploadedBy: string;
  uploadedAt: string;
  version: number;
  description: string | null;
};

type ActivityEntry = {
  id: string;
  eventType: string;
  userId: string;
  userName: string;
  details: string;
  resourceName: string;
  createdAt: string;
  ipAddress?: string;
};

type FolderNode = {
  id: string;
  name: string;
  parentFolderId: string | null;
  documentCount?: number;
  children?: FolderNode[];
};

function getFileIcon(fileType: string) {
  if (!fileType) return <File className="h-4 w-4 text-gray-400" />;
  const type = fileType.toLowerCase();
  if (type.includes("image") || type.includes("png") || type.includes("jpg") || type.includes("jpeg") || type.includes("gif"))
    return <Image className="h-4 w-4 text-purple-500" />;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv") || type.includes("xlsx"))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (type.includes("zip") || type.includes("archive") || type.includes("rar") || type.includes("7z"))
    return <FileArchive className="h-4 w-4 text-yellow-600" />;
  if (type.includes("pdf") || type.includes("doc") || type.includes("text") || type.includes("word"))
    return <FileText className="h-4 w-4 text-blue-600" />;
  return <File className="h-4 w-4 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "archived":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function FolderTreeNode({
  folder,
  depth,
  selectedFolderId,
  expandedFolders,
  onSelectFolder,
  onToggleExpand,
}: {
  folder: FolderNode;
  depth: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  onSelectFolder: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          onSelectFolder(folder.id);
          if (hasChildren) onToggleExpand(folder.id);
        }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 group",
          isSelected && "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium",
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-gray-400 transition-transform shrink-0",
              isExpanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{folder.name}</span>
        {folder.documentCount !== undefined && folder.documentCount > 0 && (
          <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px] font-medium shrink-0">
            {folder.documentCount}
          </Badge>
        )}
      </button>
      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onSelectFolder={onSelectFolder}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileBrowserSidebar({
  folders,
  isLoading,
  selectedFolderId,
  onSelectFolder,
}: {
  folders: FolderNode[];
  isLoading: boolean;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const filteredFolders = searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : folders;

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const displayFolders =
    filteredFolders.length > 0
      ? filteredFolders
      : DEFAULT_FOLDERS.map((df, i) => ({
          id: `default-${i}`,
          name: df.name,
          parentFolderId: null,
          documentCount: 0,
          children: [],
        }));

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <button
          onClick={() => onSelectFolder(null)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
            selectedFolderId === null && "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium",
          )}
        >
          <FolderLock className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="truncate text-left">All Documents</span>
        </button>
        {displayFolders.map((folder) => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            depth={0}
            selectedFolderId={selectedFolderId}
            expandedFolders={expandedFolders}
            onSelectFolder={(id) => onSelectFolder(id)}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {displayFolders.length} folder{displayFolders.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

function UploadDropZone({
  projectId,
  selectedFolderId,
  onUploadComplete,
}: {
  projectId: string;
  selectedFolderId: string | null;
  onUploadComplete?: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await uploadFiles(files);
      }
    },
    [selectedFolderId]
  );

  const uploadFiles = async (files: File[]) => {
    if (!selectedFolderId) {
      toast({
        title: "Select a folder",
        description: "Please select a folder before uploading files.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(`/api/vdr/folders/${selectedFolderId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      toast({ title: "Success", description: `${files.length} file(s) uploaded successfully.` });
      onUploadComplete?.();
    } catch {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await uploadFiles(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
        isDragOver
          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-300 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isUploading && "opacity-50 pointer-events-none"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="flex flex-col items-center gap-2">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-full">
          <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isUploading ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {selectedFolderId
              ? "PDF, DOC, XLS, images and more"
              : "Select a folder first to upload files"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-1"
          disabled={isUploading || !selectedFolderId}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Choose Files
        </Button>
      </div>
    </div>
  );
}

function FileTable({
  files,
  isLoading,
  folderName,
  onDownload,
  onShare,
  onDelete,
  onView,
}: {
  files: VdrFile[];
  isLoading: boolean;
  folderName?: string;
  onDownload: (file: VdrFile) => void;
  onShare: (file: VdrFile) => void;
  onDelete: (file: VdrFile) => void;
  onView: (file: VdrFile) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("date");

  const filteredFiles = files
    .filter(
      (f) =>
        !searchQuery ||
        (f.name || f.originalName || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "size":
          return (b.size || 0) - (a.size || 0);
        case "date":
          return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
        default:
          return 0;
      }
    });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[140px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="date">Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredFiles.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {folderName ? `No files in "${folderName}"` : "No files found"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Upload files using the drop zone above
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead className="w-[10%]">Type</TableHead>
                <TableHead className="w-[10%]">Size</TableHead>
                <TableHead className="w-[15%]">Uploaded By</TableHead>
                <TableHead className="w-[15%]">Date</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow
                  key={file.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  onClick={() => onView(file)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {getFileIcon(file.fileType)}
                      <span className="text-sm font-medium truncate max-w-[300px]">
                        {file.name || file.originalName || "Untitled"}
                      </span>
                      {file.version > 1 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          v{file.version}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500 uppercase">
                      {(file.fileType || "").split("/").pop()?.substring(0, 10) || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {file.uploadedBy || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500">{formatDate(file.uploadedAt)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDownload(file)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(file)}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownload(file)}>
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onShare(file)}>
                            <Share2 className="h-3.5 w-3.5 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => onDelete(file)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>
          {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
        <span>
          Total: {formatFileSize(filteredFiles.reduce((acc, f) => acc + (f.size || 0), 0))}
        </span>
      </div>
    </div>
  );
}

function PermissionControls({
  projectId,
  folders,
}: {
  projectId: string;
  folders: FolderNode[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderPermissions, setFolderPermissions] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/vdr/projects", projectId, "activity"],
  });

  const handlePermissionChange = (folderId: string, level: string) => {
    setFolderPermissions((prev) => ({ ...prev, [folderId]: level }));
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/vdr/projects/${projectId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied", description: "Project link has been copied to clipboard." });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Permission Controls</span>
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Folder Access Levels</CardTitle>
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Link
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {folders.length === 0 ? (
              <p className="text-xs text-gray-500">No folders configured yet.</p>
            ) : (
              folders.map((folder) => (
                <div key={folder.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
                    <span className="text-sm truncate">{folder.name}</span>
                  </div>
                  <Select
                    value={folderPermissions[folder.id] || "view_only"}
                    onValueChange={(v) => handlePermissionChange(folder.id, v)}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_access">Full Access</SelectItem>
                      <SelectItem value="view_only">View Only</SelectItem>
                      <SelectItem value="no_access">No Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {activity.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 p-2 rounded-md bg-gray-50 dark:bg-gray-800/30"
                  >
                    <Activity className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{entry.userName || "System"}</span>{" "}
                        {entry.details || entry.eventType}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ProjectVDR() {
  const [, params] = useRoute("/vdr/projects/:id");
  const projectId = params?.id;
  const { toast } = useToast();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/dd/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery<FolderNode[]>({
    queryKey: [`/api/vdr/projects/${projectId}/folders`],
    enabled: !!projectId,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<VdrFile[]>({
    queryKey: ["/api/vdr/projects", projectId, "files"],
    enabled: !!projectId,
  });

  const { data: activity = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/vdr/projects", projectId, "activity"],
    enabled: !!projectId,
  });

  const folderTree: FolderNode[] = (() => {
    if (folders.length === 0) return [];
    const rootFolders = folders.filter((f) => !f.parentFolderId);
    const buildChildren = (parentId: string): FolderNode[] => {
      return folders
        .filter((f) => f.parentFolderId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ ...f, children: buildChildren(f.id) }));
    };
    return rootFolders
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({ ...f, children: buildChildren(f.id) }));
  })();

  const selectedFolderFiles = selectedFolderId
    ? files.filter((f) => f.folderId === selectedFolderId)
    : files;

  const selectedFolderName = selectedFolderId
    ? folders.find((f) => f.id === selectedFolderId)?.name
    : "All Documents";

  const handleDownload = (file: VdrFile) => {
    window.open(`/api/vdr/documents/${file.id}/download`, "_blank");
  };

  const handleShare = (file: VdrFile) => {
    const link = `${window.location.origin}/api/vdr/documents/${file.id}/download`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied", description: `Share link for "${file.name || file.originalName}" copied to clipboard.` });
  };

  const handleDelete = async (file: VdrFile) => {
    try {
      const response = await fetch(`/api/vdr/documents/${file.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Delete failed");
      toast({ title: "Deleted", description: `"${file.name || file.originalName}" has been deleted.` });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete the file.",
        variant: "destructive",
      });
    }
  };

  const handleView = (file: VdrFile) => {
    window.open(`/api/vdr/documents/${file.id}/download`, "_blank");
  };

  if (projectLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-10 w-96" />
        </div>
        <div className="flex gap-6">
          <Skeleton className="h-[600px] w-72" />
          <Skeleton className="h-[600px] flex-1" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <FolderLock className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Project Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              The requested project could not be found.
            </p>
            <Link href="/vdr">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to VDR
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
            <Link href="/vdr" className="hover:text-blue-600 transition-colors">
              Virtual Data Room
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {(project as any).name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/vdr">
                <Button variant="ghost" size="icon" data-testid="button-back-to-vdr">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <FolderLock className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-project-name">
                      {(project as any).name}
                    </h1>
                    <Badge className={cn("text-xs", getStatusColor((project as any).status))}>
                      {((project as any).status || "active").charAt(0).toUpperCase() +
                        ((project as any).status || "active").slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(project as any).description || `${(project as any).name} Data Room`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/projects/${projectId}`}>
                <Button variant="outline" size="sm" data-testid="link-dd-project">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  DD Project
                </Button>
              </Link>
              <Link href={`/vdr/${projectId}/data-request`}>
                <Button variant="outline" size="sm">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Doc Request
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-blue-100 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Files</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {files.length}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800 border-amber-100 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Folders</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {folders.length}
                    </p>
                  </div>
                  <Folder className="h-8 w-8 text-amber-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border-green-100 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Size</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {formatFileSize(files.reduce((acc, f) => acc + (f.size || 0), 0))}
                    </p>
                  </div>
                  <Download className="h-8 w-8 text-green-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 border-purple-100 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Activity</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {activity.length}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="external-users" data-testid="tab-external-users">
              <Users className="h-4 w-4 mr-2" />
              External Users
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              <ClipboardList className="h-4 w-4 mr-2" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <Activity className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <div className="flex gap-6">
              <Card className="w-72 shrink-0 overflow-hidden">
                <FileBrowserSidebar
                  folders={folderTree}
                  isLoading={foldersLoading}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                />
              </Card>

              <div className="flex-1 space-y-4">
                <UploadDropZone
                  projectId={projectId!}
                  selectedFolderId={selectedFolderId}
                  onUploadComplete={() => {}}
                />

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {selectedFolderId ? (
                          <FolderOpen className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FolderLock className="h-5 w-5 text-blue-600" />
                        )}
                        {selectedFolderName}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {selectedFolderFiles.length} file{selectedFolderFiles.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FileTable
                      files={selectedFolderFiles}
                      isLoading={filesLoading}
                      folderName={selectedFolderName}
                      onDownload={handleDownload}
                      onShare={handleShare}
                      onDelete={handleDelete}
                      onView={handleView}
                    />
                  </CardContent>
                </Card>

                <PermissionControls projectId={projectId!} folders={folders} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsDashboard projectId={projectId!} />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <PermissionViewer
              resourceType="project"
              resourceId={projectId!}
              projectId={projectId!}
            />
          </TabsContent>

          <TabsContent value="external-users" className="space-y-4">
            <ExternalUsersTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <DiligenceRequestsTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogViewer projectId={projectId!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

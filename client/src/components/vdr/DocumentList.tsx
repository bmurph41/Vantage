import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FileText, Upload, Download, Trash2, MoreVertical, FolderOpen, History, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { VersionHistoryDrawer } from "./VersionHistoryDrawer";
import { queryClient } from "@/lib/queryClient";

type VdrDocument = {
  id: string;
  folderId: string;
  projectId: string;
  name: string;
  originalName: string;
  fileType: string;
  size: number;
  checksum: string;
  description: string | null;
  version: number;
  orgId: string;
  uploadedBy: string;
  uploadedAt: string;
};

type DocumentListProps = {
  folderId: string | null;
  projectId: string;
  uploadDocumentAsync: (params: { folderId: string; formData: FormData }) => Promise<any>;
  onDelete: (documentId: string) => void;
  isUploading: boolean;
  isDeleting: boolean;
};

export function DocumentList({
  folderId,
  projectId,
  uploadDocumentAsync,
  onDelete,
  isUploading,
  isDeleting,
}: DocumentListProps) {
  const { toast} = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyDocument, setHistoryDocument] = useState<{ id: string; name: string } | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: documents = [], isLoading } = useQuery<VdrDocument[]>({
    queryKey: ['/api/vdr/folders', folderId, 'documents'],
    enabled: !!folderId && !isSearching,
  });

  const { data: searchResults = [], isLoading: isSearchLoading } = useQuery<VdrDocument[]>({
    queryKey: ['/api/vdr/projects', projectId, 'documents/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/vdr/projects/${projectId}/documents/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: isSearching && searchQuery.trim().length > 0,
  });

  const displayDocuments = isSearching ? searchResults : documents;
  const showLoading = isSearching ? isSearchLoading : isLoading;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!folderId) {
      toast({
        title: "No folder selected",
        description: "Please select a folder before uploading documents",
        variant: "destructive",
      });
      return;
    }

    const fileArray = Array.from(files);

    if (fileArray.length === 1) {
      const formData = new FormData();
      formData.append("file", fileArray[0]);
      try {
        await uploadDocumentAsync({ folderId, formData });
      } catch (error: any) {
        if (error.error === 'Duplicate document name') {
          toast({
            title: "Duplicate Document",
            description: (
              <div className="space-y-1">
                <p>{error.message}</p>
                <p className="text-sm text-muted-foreground">
                  Location: <span className="font-mono">{error.duplicateLocation}</span>
                </p>
              </div>
            ),
            variant: "destructive",
          });
        } else {
          toast({
            title: "Upload failed",
            description: error.message || "Failed to upload document",
            variant: "destructive",
          });
        }
      } finally {
        event.target.value = "";
      }
      return;
    }

    setBulkUploading(true);
    
    const uploadPromises = fileArray.map(async (file) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await uploadDocumentAsync({ folderId, formData });
        return { success: true, file: file.name };
      } catch (error: any) {
        return { 
          success: false, 
          file: file.name,
          isDuplicate: error.error === 'Duplicate document name',
          location: error.duplicateLocation
        };
      }
    });

    const results = await Promise.all(uploadPromises);
    
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const duplicates = results.filter(r => !r.success && r.isDuplicate);
    
    setBulkUploading(false);
    event.target.value = "";
    
    if (succeeded > 0 || failed > 0) {
      const description = succeeded > 0 
        ? `${succeeded} file${succeeded !== 1 ? 's' : ''} uploaded successfully${failed > 0 ? `, ${failed} failed` : ''}`
        : duplicates.length > 0
          ? `${duplicates.length} duplicate${duplicates.length !== 1 ? 's' : ''} detected: ${duplicates.map(d => d.file).join(', ')}`
          : `${failed} file${failed !== 1 ? 's' : ''} failed to upload`;
      
      toast({
        title: succeeded > 0 ? "Upload complete" : "Upload failed",
        description,
        variant: failed > 0 && succeeded === 0 ? "destructive" : "default",
      });
    }
  };

  const handleDownload = async (documentId: string, name: string) => {
    try {
      const response = await fetch(`/api/vdr/documents/${documentId}/download`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `Downloading ${name}`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the document",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (documentId: string) => {
    setDocumentToDelete(documentId);
    setDeleteDialogOpen(true);
  };

  const handleViewHistory = (documentId: string, documentName: string) => {
    setHistoryDocument({ id: documentId, name: documentName });
    setHistoryDrawerOpen(true);
  };

  const confirmDelete = () => {
    if (documentToDelete) {
      onDelete(documentToDelete);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!folderId) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <FolderOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Folder Selected</h3>
          <p className="text-gray-600 mt-1">
            Select a folder from the left to view its documents
          </p>
        </div>
      </div>
    );
  }

  if (showLoading) {
    return (
      <div className="h-full bg-white p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-6 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileSelect}
              disabled={bulkUploading || isUploading}
              multiple
            />
            <Button asChild disabled={bulkUploading || isUploading} data-testid="button-upload-document">
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                {bulkUploading || isUploading ? "Uploading..." : "Upload Documents"}
              </label>
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search documents by name, description, or type..."
            className="pl-10 pr-10"
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              setIsSearching(value.trim().length > 0);
            }}
            data-testid="input-search-documents"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setIsSearching(false);
                if (folderId) {
                  queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', folderId, 'documents'] });
                }
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {bulkUploading && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Upload className="h-4 w-4 animate-pulse" />
            <span>Uploading files...</span>
          </div>
        )}
        
        {isSearching && (
          <div className="text-sm text-gray-600">
            {isSearchLoading ? "Searching..." : `Found ${displayDocuments.length} document${displayDocuments.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {displayDocuments.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                {isSearching ? "No Results Found" : "No Documents"}
              </h3>
              <p className="text-gray-600 mt-1">
                {isSearching 
                  ? "Try a different search term"
                  : "Upload your first document to this folder"}
              </p>
              {!isSearching && (
                <Button asChild className="mt-4" data-testid="button-upload-first-document">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </label>
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayDocuments.map((doc) => (
                <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {doc.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {doc.fileType.toUpperCase()}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {formatFileSize(doc.size)}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(doc.uploadedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`document-menu-${doc.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleViewHistory(doc.id, doc.name)}
                          data-testid={`history-document-${doc.id}`}
                        >
                          <History className="h-4 w-4 mr-2" />
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownload(doc.id, doc.name)}
                          data-testid={`download-document-${doc.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(doc.id)}
                          className="text-red-600"
                          data-testid={`delete-document-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this document. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {historyDocument && (
        <VersionHistoryDrawer
          documentId={historyDocument.id}
          documentName={historyDocument.name}
          folderId={folderId}
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
        />
      )}
    </div>
  );
}

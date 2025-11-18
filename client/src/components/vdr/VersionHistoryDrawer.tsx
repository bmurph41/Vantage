import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, RotateCcw, FileText } from "lucide-react";
import { format } from "date-fns";

type VdrDocument = {
  id: string;
  folderId: string;
  projectId: string;
  name: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  version: number;
  isCurrentVersion: boolean;
  uploadedBy: string;
  uploadedAt: string;
  description: string | null;
};

type VersionHistoryDrawerProps = {
  documentId: string;
  documentName: string;
  folderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VersionHistoryDrawer({
  documentId,
  documentName,
  folderId,
  open,
  onOpenChange,
}: VersionHistoryDrawerProps) {
  const { toast } = useToast();
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<VdrDocument | null>(null);

  const { data: versions = [], isLoading } = useQuery<VdrDocument[]>({
    queryKey: ['/api/vdr/documents', documentId, 'versions'],
    enabled: open,
    staleTime: 0,
  });

  const currentVersion = versions.find(v => v.isCurrentVersion);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('POST', `/api/vdr/documents/${documentId}/versions`, formData);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/documents', documentId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', folderId, 'documents'] });
      toast({
        title: "New version uploaded",
        description: `Version ${data.version} created successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Could not upload new version",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      return apiRequest('POST', `/api/vdr/documents/${documentId}/versions/${versionId}/restore`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/documents', documentId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', folderId, 'documents'] });
      setRestoreDialogOpen(false);
      setVersionToRestore(null);
      toast({
        title: "Version restored",
        description: `Created new version ${data.version} from previous version`,
      });
    },
    onError: () => {
      toast({
        title: "Restore failed",
        description: "Could not restore version",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    uploadMutation.mutate(formData);
    event.target.value = "";
  };

  const handleDownload = async (doc: VdrDocument) => {
    try {
      const response = await fetch(`/api/vdr/documents/${doc.id}/download`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `Downloading ${doc.filename}`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the document",
        variant: "destructive",
      });
    }
  };

  const handleRestoreClick = (version: VdrDocument) => {
    setVersionToRestore(version);
    setRestoreDialogOpen(true);
  };

  const confirmRestore = () => {
    if (versionToRestore) {
      restoreMutation.mutate(versionToRestore.id);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl w-full" data-testid="sheet-version-history">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Version History
            </SheetTitle>
            <SheetDescription>{documentName}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {currentVersion && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Version</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Version:</span>
                    <span className="ml-2 font-medium">{currentVersion.version}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Size:</span>
                    <span className="ml-2 font-medium">{formatFileSize(currentVersion.size)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="ml-2 font-medium">
                      {currentVersion.uploadedAt ? format(new Date(currentVersion.uploadedAt), "MMM d, yyyy HH:mm") : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="upload-new-version">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={uploadMutation.isPending}
                  asChild
                  data-testid="button-upload-new-version"
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadMutation.isPending ? "Uploading..." : "Upload New Version"}
                    <Input
                      id="upload-new-version"
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={uploadMutation.isPending}
                    />
                  </span>
                </Button>
              </label>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Version History</h3>
              <ScrollArea className="h-[calc(100vh-400px)]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No version history available
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((version) => (
                        <TableRow key={version.id} data-testid={`row-version-${version.version}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              v{version.version}
                              {version.isCurrentVersion && (
                                <Badge variant="default" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {version.uploadedAt ? format(new Date(version.uploadedAt), "MMM d, yyyy HH:mm") : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatFileSize(version.size)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(version)}
                                data-testid={`button-download-version-${version.version}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {!version.isCurrentVersion && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreClick(version)}
                                  disabled={restoreMutation.isPending}
                                  data-testid={`button-restore-version-${version.version}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent data-testid="dialog-restore-version">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version?</AlertDialogTitle>
            <AlertDialogDescription>
              {versionToRestore && (
                <>
                  This will create a new version (v{(currentVersion?.version || 0) + 1}) using the
                  content from version {versionToRestore.version}. The current version will be
                  preserved in history.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-restore">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={restoreMutation.isPending}
              data-testid="button-confirm-restore"
            >
              {restoreMutation.isPending ? "Restoring..." : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Trash2, FileSpreadsheet, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface UploadedFile {
  id: string;
  projectId: string;
  uploaderId: string;
  sourceFileName: string;
  mimeType: string;
  byteSize: number;
  parsedSheetName: string | null;
  importStatus: string;
  rowsImported: number;
  uploadedAt: string;
}

interface UploadedFilesTabProps {
  locationId: string;
}

export default function UploadedFilesTab({ locationId }: UploadedFilesTabProps) {
  const { toast } = useToast();
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null);

  const { data: files, isLoading } = useQuery<UploadedFile[]>({
    queryKey: ["/api/rent-roll/locations", locationId, "uploads"],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/locations/${locationId}/uploads`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch uploaded files');
      }
      return response.json();
    },
    enabled: !!locationId,
  });

  const downloadMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/rent-roll/uploads/${fileId}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const file = files?.find(f => f.id === fileId);
      const fileName = file?.sourceFileName || 'download';

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "File downloaded",
        description: "The file has been downloaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest('DELETE', `/api/rent-roll/uploads/${fileId}`);
      if (!response.ok) {
        throw new Error('Failed to delete file');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/locations", locationId, "uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      
      toast({
        title: "File deleted",
        description: "The file and all associated leases have been deleted",
      });
      
      setFileToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="h-8 w-8 text-primary" />;
    }
    if (mimeType.includes('csv')) {
      return <FileText className="h-8 w-8 text-primary" />;
    }
    return <FileText className="h-8 w-8 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="p-6">
        <Alert data-testid="alert-no-files">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No files have been uploaded yet. Import leases to automatically track uploaded files.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-4">
        {files.map(file => (
          <Card key={file.id} data-testid={`card-file-${file.id}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <div className="flex items-center gap-3 flex-1">
                {getFileIcon(file.mimeType)}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate" data-testid={`text-filename-${file.id}`}>
                    {file.sourceFileName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {file.parsedSheetName && (
                      <span className="mr-2">Sheet: {file.parsedSheetName}</span>
                    )}
                    {formatFileSize(file.byteSize)}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadMutation.mutate(file.id)}
                  disabled={downloadMutation.isPending}
                  data-testid={`button-download-${file.id}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFileToDelete(file)}
                  data-testid={`button-delete-${file.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Uploaded:</span>{" "}
                  <span data-testid={`text-upload-date-${file.id}`}>
                    {format(new Date(file.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Leases imported:</span>{" "}
                  <Badge variant="secondary" data-testid={`badge-count-${file.id}`}>
                    {file.rowsImported}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete uploaded file?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete <strong>{fileToDelete?.sourceFileName}</strong> and all {fileToDelete?.rowsImported} leases imported from it.
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone. Associated tenants will also be removed if they have no other leases.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fileToDelete && deleteMutation.mutate(fileToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete File & Leases"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

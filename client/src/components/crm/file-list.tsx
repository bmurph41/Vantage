import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { File, FileText, Image as ImageIcon, FileSpreadsheet, Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { CrmFile } from "@shared/schema";
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
import { useState } from "react";

interface FileListProps {
  entityType: string;
  entityId: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return <FileSpreadsheet className="w-5 h-5" />;
  }
  return <File className="w-5 h-5" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileList({ entityType, entityId }: FileListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fileToDelete, setFileToDelete] = useState<CrmFile | null>(null);

  const { data: files = [], isLoading } = useQuery<CrmFile[]>({
    queryKey: ['/api/crm/files', entityType, entityId],
    queryFn: async () => {
      const response = await fetch(`/api/crm/files/${entityType}/${entityId}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/crm/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete file');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/files', entityType, entityId] });
      toast({
        title: "File deleted",
        description: "The file has been deleted successfully.",
      });
      setFileToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = (file: CrmFile) => {
    window.open(`/api/crm/files/${file.id}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No files attached yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2" data-testid="file-list">
        {files.map((file) => (
          <div
            key={file.id}
            data-testid={`file-item-${file.id}`}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="text-gray-600 dark:text-gray-400">
                {getFileIcon(file.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" data-testid={`file-name-${file.id}`}>
                  {file.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span data-testid={`file-size-${file.id}`}>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span data-testid={`file-date-${file.id}`}>
                    {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(file)}
                data-testid={`button-download-file-${file.id}`}
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFileToDelete(file)}
                data-testid={`button-delete-file-${file.id}`}
                title="Delete file"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => fileToDelete && deleteMutation.mutate(fileToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

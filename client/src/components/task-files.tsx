import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  File, 
  Image, 
  Clock, 
  User,
  AlertCircle,
  CheckCircle,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { TaskFile } from "@shared/schema";

interface TaskFilesProps {
  taskId: string;
  taskTitle: string;
  compact?: boolean;
  readOnly?: boolean;
}

interface FileUploadDialogProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to get file type icon
const getFileIcon = (mimeType: string, fileName: string) => {
  if (mimeType.startsWith('image/')) {
    return <Image className="h-4 w-4 text-blue-500" />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  if (mimeType.includes('spreadsheet') || fileName.endsWith('.xlsx')) {
    return <File className="h-4 w-4 text-green-500" />;
  }
  if (mimeType.includes('wordprocessing') || fileName.endsWith('.docx')) {
    return <FileText className="h-4 w-4 text-blue-600" />;
  }
  return <File className="h-4 w-4 text-gray-500" />;
};

function FileUploadDialog({ taskId, isOpen, onClose }: FileUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, notes }: { file: File; notes: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch(`/api/dd/tasks/${taskId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', taskId, 'files'] });
      setSelectedFile(null);
      setNotes("");
      onClose();
      toast({
        title: "File uploaded successfully",
        description: `${selectedFile?.name} has been attached to the task`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    
    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 20MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, DOCX, XLSX, PNG, and JPG files are allowed",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate({ file: selectedFile, notes });
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-upload">Upload File</DialogTitle>
          <DialogDescription>
            Attach a file to this task. Supported formats: PDF, DOCX, XLSX, PNG, JPG (max 20MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedFile ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              data-testid="file-drop-zone"
            >
              <Upload className="h-10 w-10 mx-auto text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Drag and drop your file here, or{' '}
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-browse-files"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-gray-500">
                  PDF, DOCX, XLSX, PNG, JPG • Max 20MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                data-testid="input-file"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getFileIcon(selectedFile.type, selectedFile.name)}
                  <div>
                    <p className="text-sm font-medium text-gray-900" data-testid="text-filename">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500" data-testid="text-filesize">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  data-testid="button-remove-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-notes">Notes</Label>
                <Textarea
                  id="file-notes"
                  placeholder="Add notes about this file..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-cancel-upload"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
            data-testid="button-upload-file"
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskFiles({ taskId, taskTitle, compact = false, readOnly = false }: TaskFilesProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch files for this task
  const { data: files = [], isLoading } = useQuery<TaskFile[]>({
    queryKey: ['/api/dd/tasks', taskId, 'files'],
    enabled: !!taskId,
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest("DELETE", `/api/dd/files/${fileId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', taskId, 'files'] });
      toast({
        title: "File deleted",
        description: "The file has been removed from the task",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: "Failed to delete the file",
        variant: "destructive",
      });
    },
  });

  // Download file handler
  const handleDownload = async (file: TaskFile) => {
    try {
      const response = await fetch(`/api/dd/files/${file.id}`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the file",
        variant: "destructive",
      });
    }
  };

  if (compact && files.length === 0) {
    return null;
  }

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      <CardHeader className={compact ? "px-0 py-2" : "pb-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${compact ? "text-sm" : "text-base"}`}>
            <FileText className="h-4 w-4" />
            {compact ? "Files" : "Attached Files"}
            {files.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {files.length}
              </Badge>
            )}
          </CardTitle>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadDialogOpen(true)}
              data-testid="button-add-file"
            >
              <Upload className="h-4 w-4 mr-1" />
              {compact ? "Add" : "Upload File"}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className={compact ? "px-0 pt-0" : ""}>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-gray-500">Loading files...</div>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-4">
            <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No files attached</p>
            {!readOnly && (
              <p className="text-xs text-gray-400 mt-1">
                Click "Upload File" to attach documents, images, or other files
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                data-testid={`file-item-${file.id}`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(file.mimeType, file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" data-testid={`text-filename-${file.id}`}>
                      {file.name}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span data-testid={`text-filesize-${file.id}`}>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        <span data-testid={`text-uploaded-${file.id}`}>
                          {format(new Date(file.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    {file.notes && (
                      <p className="text-xs text-gray-600 mt-1 truncate" data-testid={`text-notes-${file.id}`}>
                        {file.notes}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    data-testid={`button-download-${file.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readOnly && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-delete-${file.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete File</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{file.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`button-cancel-delete-${file.id}`}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(file.id)}
                            className="bg-red-600 hover:bg-red-700"
                            data-testid={`button-confirm-delete-${file.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <FileUploadDialog
        taskId={taskId}
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
      />
    </Card>
  );
}
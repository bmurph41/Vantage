import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, File, FileText, Image, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FileUploaderProps {
  entityType: string;
  entityId: string;
  onUploadComplete?: () => void;
}

export function FileUploader({ entityType, entityId, onUploadComplete }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      const response = await fetch('/api/crm/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/files', entityType, entityId] });
      toast({
        title: "File uploaded",
        description: "The file has been uploaded successfully.",
      });
      onUploadComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of acceptedFiles) {
        await uploadFileMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
    }
  }, [uploadFileMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
  });

  return (
    <div
      {...getRootProps()}
      data-testid="file-uploader"
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-700'}
        ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400 dark:hover:border-gray-600'}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      {uploading ? (
        <p className="text-gray-600 dark:text-gray-300">Uploading...</p>
      ) : isDragActive ? (
        <p className="text-blue-600 dark:text-blue-400">Drop the files here...</p>
      ) : (
        <>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Drag and drop files here, or click to select
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Supports images, PDFs, Word, Excel, CSV, and text files (max 10MB)
          </p>
        </>
      )}
    </div>
  );
}

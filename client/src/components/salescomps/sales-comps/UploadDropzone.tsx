import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatFileSize } from '@/lib/salescomps/format';

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  maxSize?: number;
  accept?: Record<string, string[]>;
}

export default function UploadDropzone({
  onFileSelect,
  isUploading = false,
  maxSize = 50 * 1024 * 1024, // 50MB
  accept = {
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  }
}: UploadDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles[0].errors;
      if (errors.find((e: any) => e.code === 'file-too-large')) {
        alert(`File is too large. Maximum size is ${formatFileSize(maxSize)}`);
      } else if (errors.find((e: any) => e.code === 'file-invalid-type')) {
        alert('Invalid file type. Please upload a CSV or Excel file.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect, maxSize]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    maxSize,
    disabled: isUploading,
  });

  return (
    <Card className="border-2 border-dashed">
      <div
        {...getRootProps()}
        className={`
          p-8 text-center cursor-pointer transition-colors
          ${isDragActive && !isDragReject ? 'border-primary bg-primary/5' : ''}
          ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'}
        `}
        data-testid="upload-dropzone"
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          {isDragReject ? (
            <AlertCircle className="h-12 w-12 text-destructive" />
          ) : (
            <Upload className="h-12 w-12 text-muted-foreground" />
          )}
          
          <div>
            <h4 className="text-lg font-medium text-foreground mb-2">
              {isDragActive ? (
                isDragReject ? 'Invalid file type' : 'Drop your file here'
              ) : (
                'Drop your file here'
              )}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <Button 
              variant="default" 
              disabled={isUploading}
              data-testid="button-choose-file"
            >
              {isUploading ? 'Uploading...' : 'Choose File'}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Supports CSV, Excel (.xlsx, .xls)</p>
            <p>Max {formatFileSize(maxSize)} • Up to 1M rows</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  disabled?: boolean;
  title?: string;
  description?: string;
}

export function FileUpload({
  onUpload,
  acceptedFileTypes = ['.txt', '.csv', '.pdf', '.docx', '.xlsx'],
  maxFiles = 5,
  disabled = false,
  title = "Upload Files",
  description = "Drag and drop files here, or click to select"
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled || isUploading) return;

    try {
      setIsUploading(true);
      setUploadedFiles(acceptedFiles);
      await onUpload(acceptedFiles);
      
      toast({
        title: "Upload successful",
        description: `${acceptedFiles.length} file(s) processed successfully`,
      });
      
      // Clear uploaded files after successful processing
      setUploadedFiles([]);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, disabled, isUploading, toast]);

  // Map file extensions to MIME types for dropzone
  const getMimeTypes = (extensions: string[]) => {
    const mimeMap: Record<string, string[]> = {
      '.txt': ['text/plain'],
      '.csv': ['text/csv', 'application/csv'],
      '.pdf': ['application/pdf'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    };
    
    const accept: Record<string, string[]> = {};
    extensions.forEach(ext => {
      const mimes = mimeMap[ext];
      if (mimes) {
        mimes.forEach(mime => {
          accept[mime] = [ext];
        });
      }
    });
    return accept;
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections
  } = useDropzone({
    onDrop,
    accept: getMimeTypes(acceptedFileTypes),
    maxFiles,
    disabled: disabled || isUploading
  });

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles(files => files.filter(file => file !== fileToRemove));
  };

  return (
    <div className="w-full space-y-4" data-testid="file-upload-container">
      <Card
        {...getRootProps()}
        className={`
          border-2 border-dashed p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-600'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
        `}
        data-testid="file-drop-zone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        
        <div className="flex flex-col items-center space-y-4">
          {isUploading ? (
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" data-testid="upload-spinner" />
          ) : (
            <Upload className="h-12 w-12 text-gray-400" data-testid="upload-icon" />
          )}
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100" data-testid="upload-title">
              {isUploading ? 'Processing files...' : title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1" data-testid="upload-description">
              {isUploading ? 'AI is parsing your data...' : description}
            </p>
          </div>
          
          {!isUploading && (
            <Button variant="outline" size="sm" disabled={disabled} data-testid="button-select-files">
              Select Files
            </Button>
          )}
        </div>
        
        <div className="mt-4 text-xs text-gray-400" data-testid="file-types-info">
          Supported formats: {acceptedFileTypes.join(', ')} (max {maxFiles} files)
        </div>
      </Card>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <div className="space-y-2" data-testid="file-rejections">
          {fileRejections.map(({ file, errors }: FileRejection) => (
            <Card key={file.name} className="p-3 border-red-200 bg-red-50 dark:bg-red-950" data-testid={`rejection-${file.name}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300" data-testid={`rejected-file-name-${file.name}`}>
                    {file.name}
                  </span>
                </div>
                <div className="text-xs text-red-600 dark:text-red-400" data-testid={`rejection-errors-${file.name}`}>
                  {errors.map((e: any) => e.message).join(', ')}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Uploaded Files (while processing) */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2" data-testid="uploaded-files">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Processing Files:
          </h4>
          {uploadedFiles.map((file) => (
            <Card key={file.name} className="p-3" data-testid={`uploaded-file-${file.name}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium" data-testid={`file-name-${file.name}`}>
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500" data-testid={`file-size-${file.name}`}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file)}
                    data-testid={`button-remove-${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
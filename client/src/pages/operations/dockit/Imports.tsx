import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import DockitAppShell from "@/components/dockit/DockitAppShell";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function DockitImports() {
  const [uploading, setUploading] = useState(false);

  const { data: imports, isLoading } = useQuery({
    queryKey: ["/dockit/api/imports"],
    retry: false,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);
    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'customers');

    try {
      const response = await fetch('/dockit/api/imports/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/dockit/api/imports"] });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <DockitAppShell title="Data Import" description="Import customers, boats, and marina data from CSV or Excel files">
      <div className="space-y-6">
        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Data File
            </CardTitle>
            <CardDescription>
              Drag and drop a CSV or Excel file to import marina data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
                ${uploading ? 'pointer-events-none opacity-50' : ''}
              `}
              data-testid="dropzone-import"
            >
              <input {...getInputProps()} data-testid="input-file-upload" />
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              {uploading ? (
                <p className="text-muted-foreground">Uploading...</p>
              ) : isDragActive ? (
                <p className="text-primary font-medium">Drop the file here...</p>
              ) : (
                <>
                  <p className="font-medium mb-1">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">CSV, XLS, XLSX (max 10MB)</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${Array.isArray(imports) ? imports.length : 0} imports`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !imports || (Array.isArray(imports) && imports.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No imports yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a file above to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(imports) && imports.map((job: any, index: number) => (
                  <div 
                    key={job.id || index} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`import-item-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium">{job.fileName || 'Unknown file'}</p>
                        <p className="text-sm text-muted-foreground">
                          {job.entityType || 'customers'} • {job.rowsProcessed || 0} rows
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                        {job.status || 'pending'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DockitAppShell>
  );
}

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";

interface FileUploadZoneProps {
  onFileUpload: (file: File) => void;
  isUploading: boolean;
}

export default function FileUploadZone({ onFileUpload, isUploading }: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    // File size validation (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 20MB`;
    }

    // File type validation
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return `File type ${fileExtension} is not supported. Please upload Excel (.xlsx, .xls) or CSV (.csv) files only.`;
    }

    return null;
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    const filesArray = Array.from(files);
    if (filesArray.length === 0) return;

    const file = filesArray[0]; // Only handle the first file
    
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    onFileUpload(file);
  }, [onFileUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload Data File
          </CardTitle>
          <CardDescription>
            Upload your rent roll or customer data file. Supported formats: Excel (.xlsx, .xls) and CSV (.csv)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            data-testid="file-upload-zone"
          >
            {isUploading ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-500" />
                <div>
                  <p className="text-lg font-medium">Uploading and parsing file...</p>
                  <p className="text-sm text-muted-foreground">Please wait while we process your file</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                <div>
                  <p className="text-lg font-medium">Drop your file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    Maximum file size: 20MB
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-input"
                  data-testid="file-input"
                  disabled={isUploading}
                />
                <Button asChild variant="outline" data-testid="button-browse-files">
                  <label htmlFor="file-input" className="cursor-pointer">
                    Browse Files
                  </label>
                </Button>
              </div>
            )}
          </div>

          {validationError && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="validation-error">
                {validationError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Supported Formats</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Excel Workbook (.xlsx)</li>
                <li>• Excel 97-2003 (.xls)</li>
                <li>• Comma Separated Values (.csv)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">File Structure</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• First row should contain column headers</li>
                <li>• Maximum 20MB file size</li>
                <li>• No password protection</li>
              </ul>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Common Column Names We Recognize</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
              <div>
                <strong>Customer:</strong>
                <br />First Name, Last Name, Email, Phone, Address
              </div>
              <div>
                <strong>Boat:</strong>
                <br />Boat Name, Make, Model, Year, Length, Beam
              </div>
              <div>
                <strong>Slip:</strong>
                <br />Slip Number, Type, Section, Rate, Max Length
              </div>
              <div>
                <strong>Lease:</strong>
                <br />Start Date, End Date, Monthly Rate, Deposit
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Download,
  AlertCircle
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

type WizardStep = 'upload' | 'map' | 'preview' | 'import';
type EntityType = 'contacts' | 'companies' | 'properties';

const CONTACT_FIELDS = [
  { value: '', label: 'Do not import' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job Title' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zipCode', label: 'Zip Code' },
  { value: 'country', label: 'Country' },
  { value: 'website', label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'notes', label: 'Notes' },
];

const COMPANY_FIELDS = [
  { value: '', label: 'Do not import' },
  { value: 'name', label: 'Company Name' },
  { value: 'industry', label: 'Industry' },
  { value: 'website', label: 'Website' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zipCode', label: 'Zip Code' },
  { value: 'country', label: 'Country' },
  { value: 'employees', label: 'Number of Employees' },
  { value: 'revenue', label: 'Annual Revenue' },
  { value: 'description', label: 'Description' },
];

const PROPERTY_FIELDS = [
  { value: '', label: 'Do not import' },
  { value: 'name', label: 'Property Name' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zipCode', label: 'Zip Code' },
  { value: 'country', label: 'Country' },
  { value: 'propertyType', label: 'Property Type' },
  { value: 'slips', label: 'Number of Slips' },
  { value: 'askingPrice', label: 'Asking Price' },
  { value: 'yearBuilt', label: 'Year Built' },
  { value: 'description', label: 'Description' },
];

export default function ImportContacts() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<EntityType>('contacts');
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const getFieldsForEntityType = () => {
    switch (entityType) {
      case 'contacts':
        return CONTACT_FIELDS;
      case 'companies':
        return COMPANY_FIELDS;
      case 'properties':
        return PROPERTY_FIELDS;
      default:
        return CONTACT_FIELDS;
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (fileContent: string) => {
        fileName: file?.name,
        entityType,
        contentLength: fileContent.length,
        firstChars: fileContent.substring(0, 100)
      });
      const response = await apiRequest('/api/imports', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file?.name || 'import.csv',
          csvContent: fileContent,
          entityType,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      setImportJobId(data.importJob.id);
      setCsvHeaders(data.preview.headers);
      setFieldMappings(data.preview.mappings);
      setCurrentStep('map');
      toast({
        title: "CSV Uploaded",
        description: `${data.preview.totalRows} rows detected`,
      });
    },
    onError: (error: any) => {
      console.error('❌ Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message || 'An error occurred while uploading the file',
        variant: "destructive",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/imports/${importJobId}/preview`, {
        method: 'POST',
        body: JSON.stringify({ fieldMappings }),
      });
      return response;
    },
    onSuccess: (data) => {
      setPreviewData(data.preview);
      setCurrentStep('preview');
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/imports/${importJobId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ duplicateStrategy }),
      });
      return response;
    },
    onSuccess: (data) => {
      setCurrentStep('import');
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.summary.successful} contacts`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: importJob } = useQuery({
    queryKey: ['/api/imports', importJobId],
    enabled: !!importJobId && currentStep === 'import',
    refetchInterval: currentStep === 'import' && importJob?.status === 'processing' ? 1000 : false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      uploadMutation.mutate(content);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please drop a CSV file",
        variant: "destructive",
      });
    }
  };

  const renderUploadStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Step 1: Upload CSV File
        </CardTitle>
        <CardDescription>
          Upload a CSV file exported from Pipedrive or any CRM. The file should contain contact information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Entity Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="entity-type" className="text-base font-semibold">What are you importing?</Label>
          <Select value={entityType} onValueChange={(value) => setEntityType(value as EntityType)}>
            <SelectTrigger id="entity-type" data-testid="select-entity-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contacts">Contacts</SelectItem>
              <SelectItem value="companies">Companies</SelectItem>
              <SelectItem value="properties">Properties</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* File Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
          data-testid="upload-dropzone"
        >
          {file ? (
            <div className="space-y-3">
              <FileText className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="font-medium" data-testid="text-filename">{file.name}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-filesize">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                data-testid="button-remove-file"
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Drop CSV file here or click to browse</p>
                <p className="text-sm text-muted-foreground">Supports CSV files up to 10MB</p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
                data-testid="input-file"
              />
              <label htmlFor="file-input">
                <Button variant="outline" asChild data-testid="button-browse">
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            data-testid="button-upload"
          >
            {uploadMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Processing...
              </>
            ) : (
              <>
                Upload & Map Fields
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderMapStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Step 2: Map Fields
        </CardTitle>
        <CardDescription>
          Map CSV columns to {entityType} fields. Auto-detected mappings are pre-filled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {csvHeaders.map((header) => (
            <div key={header} className="flex items-center gap-4">
              <div className="w-1/3">
                <Label className="font-medium">{header}</Label>
              </div>
              <div className="w-2/3">
                <Select
                  value={fieldMappings[header] || ''}
                  onValueChange={(value) => setFieldMappings({ ...fieldMappings, [header]: value })}
                >
                  <SelectTrigger data-testid={`select-mapping-${header}`}>
                    <SelectValue placeholder={`Select ${entityType} field...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {getFieldsForEntityType().map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('upload')}
            data-testid="button-back-to-upload"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
            data-testid="button-preview"
          >
            {previewMutation.isPending ? (
              "Loading Preview..."
            ) : (
              <>
                Next: Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderPreviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Step 3: Preview & Review
        </CardTitle>
        <CardDescription>
          Review the first 50 rows. Duplicates and validation issues are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span data-testid="text-preview-total">Total: {previewData.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            <span data-testid="text-preview-duplicates">
              Duplicates: {previewData.filter(r => r.duplicateStatus !== 'None').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <span data-testid="text-preview-warnings">
              Warnings: {previewData.filter(r => r.validationIssues.length > 0).length}
            </span>
          </div>
        </div>

        <div className="border rounded-lg overflow-auto max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row) => (
                <TableRow
                  key={row.rowNumber}
                  className={
                    row.duplicateStatus === 'Exact' ? 'bg-red-50 dark:bg-red-950' :
                    row.duplicateStatus === 'Possible' ? 'bg-yellow-50 dark:bg-yellow-950' :
                    ''
                  }
                  data-testid={`row-preview-${row.rowNumber}`}
                >
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell>
                    {row.data.firstName} {row.data.lastName}
                  </TableCell>
                  <TableCell>{row.data.email}</TableCell>
                  <TableCell>{row.data.phone}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          row.duplicateStatus === 'Exact' ? 'destructive' :
                          row.duplicateStatus === 'Possible' ? 'secondary' :
                          'outline'
                        }
                        data-testid={`badge-status-${row.rowNumber}`}
                      >
                        {row.duplicateStatus === 'None' ? 'New' : row.duplicateStatus}
                      </Badge>
                      {row.validationIssues.length > 0 && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 pt-4">
          <Label className="font-medium">Duplicate Handling Strategy</Label>
          <RadioGroup value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as 'skip' | 'update')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skip" id="skip" data-testid="radio-skip" />
              <Label htmlFor="skip" className="cursor-pointer">
                Skip duplicates (recommended)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="update" id="update" data-testid="radio-update" />
              <Label htmlFor="update" className="cursor-pointer">
                Update existing contacts with new data
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('map')}
            data-testid="button-back-to-map"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending}
            data-testid="button-import"
          >
            {executeMutation.isPending ? (
              "Starting Import..."
            ) : (
              <>
                Start Import
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderImportStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          Step 4: Import Progress
        </CardTitle>
        <CardDescription>
          Importing contacts... Please wait.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span data-testid="text-progress">{importJob?.progress || 0}%</span>
          </div>
          <Progress value={importJob?.progress || 0} data-testid="progress-import" />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <p className="text-2xl font-bold" data-testid="text-total-rows">{importJob?.totalRows || 0}</p>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <p className="text-2xl font-bold text-green-600" data-testid="text-successful">{importJob?.successfulRows || 0}</p>
            <p className="text-sm text-muted-foreground">Successful</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <p className="text-2xl font-bold text-red-600" data-testid="text-failed">{importJob?.failedRows || 0}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <p className="text-2xl font-bold text-yellow-600" data-testid="text-duplicates">{importJob?.duplicatesFound || 0}</p>
            <p className="text-sm text-muted-foreground">Duplicates</p>
          </div>
        </div>

        {importJob?.status === 'completed' && (
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium" data-testid="text-import-complete">Import completed successfully!</p>
            </div>
          </div>
        )}

        {importJob?.status === 'failed' && (
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium" data-testid="text-import-failed">Import failed. Please check the error log.</p>
            </div>
          </div>
        )}

        {(importJob?.status === 'completed' || importJob?.status === 'completed_with_errors' || importJob?.status === 'failed') && (
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/import-history')}
              data-testid="button-view-history"
            >
              View Import History
            </Button>
            <Button
              onClick={() => {
                setCurrentStep('upload');
                setFile(null);
                setImportJobId(null);
                setFieldMappings({});
                setCsvHeaders([]);
                setPreviewData([]);
              }}
              data-testid="button-new-import"
            >
              Start New Import
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Contacts</h1>
        <p className="text-muted-foreground">
          Import contacts from CSV files with automatic field mapping and duplicate detection
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['upload', 'map', 'preview', 'import'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  currentStep === step
                    ? 'bg-primary text-primary-foreground'
                    : ['upload', 'map', 'preview', 'import'].indexOf(currentStep) > index
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
                data-testid={`step-indicator-${step}`}
              >
                {['upload', 'map', 'preview', 'import'].indexOf(currentStep) > index ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              {index < 3 && (
                <div className={`h-1 w-20 ${
                  ['upload', 'map', 'preview', 'import'].indexOf(currentStep) > index
                    ? 'bg-green-500'
                    : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {currentStep === 'upload' && renderUploadStep()}
      {currentStep === 'map' && renderMapStep()}
      {currentStep === 'preview' && renderPreviewStep()}
      {currentStep === 'import' && renderImportStep()}
    </div>
  );
}

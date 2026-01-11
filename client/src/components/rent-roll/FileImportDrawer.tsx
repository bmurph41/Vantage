import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2,
  ArrowRight,
  X,
  FileText,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";

type FieldMapping = {
  sourceColumn: string;
  targetField: string;
  sampleValues: string[];
};

type ImportPreview = {
  headers: string[];
  rows: string[][];
  totalRows: number;
  mappings: FieldMapping[];
};

const LEASE_FIELDS = [
  { value: 'skip', label: 'Skip this column' },
  { value: 'tenantName', label: 'Tenant Name' },
  { value: 'tenantEmail', label: 'Tenant Email' },
  { value: 'tenantPhone', label: 'Tenant Phone' },
  { value: 'leaseType', label: 'Lease Type' },
  { value: 'storageType', label: 'Storage Type' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'endDate', label: 'End Date' },
  { value: 'baseRent', label: 'Base Rent' },
  { value: 'rentPeriod', label: 'Rent Period' },
  { value: 'discountType', label: 'Discount Type' },
  { value: 'discountValue', label: 'Discount Value' },
  { value: 'slipNumber', label: 'Slip/Unit Number' },
  { value: 'vesselName', label: 'Vessel Name' },
  { value: 'vesselType', label: 'Vessel Type' },
  { value: 'vesselLength', label: 'Vessel Length' },
  { value: 'vesselBeam', label: 'Vessel Beam' },
  { value: 'notes', label: 'Notes' },
];

function guessFieldMapping(header: string): string {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (normalized.includes('tenant') && normalized.includes('name')) return 'tenantName';
  if (normalized.includes('name') && !normalized.includes('vessel')) return 'tenantName';
  if (normalized.includes('email')) return 'tenantEmail';
  if (normalized.includes('phone')) return 'tenantPhone';
  if (normalized.includes('leasetype') || normalized.includes('type')) return 'leaseType';
  if (normalized.includes('storage')) return 'storageType';
  if (normalized.includes('start') && normalized.includes('date')) return 'startDate';
  if (normalized.includes('end') && normalized.includes('date')) return 'endDate';
  if (normalized.includes('rent') && !normalized.includes('period')) return 'baseRent';
  if (normalized.includes('period') || normalized.includes('frequency')) return 'rentPeriod';
  if (normalized.includes('discount') && normalized.includes('type')) return 'discountType';
  if (normalized.includes('discount') && (normalized.includes('value') || normalized.includes('amount'))) return 'discountValue';
  if (normalized.includes('slip') || normalized.includes('unit') || normalized.includes('dock')) return 'slipNumber';
  if (normalized.includes('vessel') && normalized.includes('name')) return 'vesselName';
  if (normalized.includes('vessel') && normalized.includes('type')) return 'vesselType';
  if (normalized.includes('length') || normalized.includes('loa')) return 'vesselLength';
  if (normalized.includes('beam') || normalized.includes('width')) return 'vesselBeam';
  if (normalized.includes('note') || normalized.includes('comment')) return 'notes';
  
  return 'skip';
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function FileImportDrawer({
  open,
  onOpenChange,
  locationId,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId?: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; errorDetails: string[] }>({ success: 0, errors: 0, errorDetails: [] });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const parsedDataRef = useRef<{ headers: string[]; allRows: string[][] }>({ headers: [], allRows: [] });

  // Helper to find the header row (first row with multiple non-empty cells)
  const findHeaderRowIndex = (rows: string[][]): number => {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      const nonEmptyCells = row.filter(cell => cell && cell.trim().length > 0);
      // A header row typically has at least 3 non-empty cells
      if (nonEmptyCells.length >= 3) {
        return i;
      }
    }
    return 0; // Default to first row
  };

  const parseFile = async (file: File) => {
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isPDF = file.name.endsWith('.pdf');
      
      let headers: string[] = [];
      let allRows: string[][] = [];

      if (isPDF) {
        // Send PDF to server for parsing
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/rent-roll/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to parse PDF');
        }
        
        const { headers: pdfHeaders, rows: pdfRows } = await response.json();
        headers = pdfHeaders;
        allRows = pdfRows;
      } else if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' });
        
        if (jsonData.length < 2) {
          toast({
            title: "Invalid file",
            description: "File must have at least a header row and one data row.",
            variant: "destructive",
          });
          return;
        }
        
        // Convert all rows to string arrays
        const allRowsRaw = jsonData.map(row => 
          (row as any[]).map(cell => String(cell ?? '').trim())
        );
        
        // Find the actual header row (skip title rows, empty rows)
        const headerRowIndex = findHeaderRowIndex(allRowsRaw);
        headers = allRowsRaw[headerRowIndex];
        allRows = allRowsRaw.slice(headerRowIndex + 1).filter(row => 
          row.some(cell => cell && cell.trim().length > 0) // Skip completely empty rows
        );
      } else {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "Invalid file",
            description: "File must have at least a header row and one data row.",
            variant: "destructive",
          });
          return;
        }

        headers = parseCSVLine(lines[0]);
        allRows = lines.slice(1).map(line => parseCSVLine(line));
      }

      parsedDataRef.current = { headers, allRows };
      const previewRows = allRows.slice(0, 5);
      
      const initialMappings: Record<string, string> = {};
      headers.forEach(header => {
        initialMappings[header] = guessFieldMapping(header);
      });
      
      setMappings(initialMappings);
      setPreview({
        headers,
        rows: previewRows,
        totalRows: allRows.length,
        mappings: headers.map(header => ({
          sourceColumn: header,
          targetField: initialMappings[header],
          sampleValues: previewRows.map(row => row[headers.indexOf(header)] || ''),
        })),
      });
      
      setStep('mapping');
    } catch (error) {
      console.error('File parse error:', error);
      toast({
        title: "Failed to parse file",
        description: "Please ensure the file is a valid CSV or Excel file.",
        variant: "destructive",
      });
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const updateMapping = (sourceColumn: string, targetField: string) => {
    setMappings(prev => ({
      ...prev,
      [sourceColumn]: targetField,
    }));
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !preview) throw new Error("No file to import");
      
      const { headers, allRows: dataRows } = parsedDataRef.current;
      
      if (!headers.length || !dataRows.length) {
        throw new Error("No data to import");
      }
      
      const results = { success: 0, errors: 0, errorDetails: [] as string[] };
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        try {
          const leaseData: Record<string, any> = {};
          const tenantData: Record<string, any> = {};
          const vesselData: Record<string, any> = {};
          
          headers.forEach((header, idx) => {
            const targetField = mappings[header];
            const value = row[idx] || '';
            
            if (targetField === 'skip' || !value) return;
            
            if (targetField.startsWith('tenant')) {
              const field = targetField.replace('tenant', '').charAt(0).toLowerCase() + targetField.replace('tenant', '').slice(1);
              tenantData[field === 'Name' ? 'displayName' : field.toLowerCase()] = value;
            } else if (targetField.startsWith('vessel')) {
              const field = targetField.replace('vessel', '').toLowerCase();
              vesselData[field] = value;
            } else {
              leaseData[targetField] = value;
            }
          });

          if (!tenantData.displayName && !tenantData.name) {
            throw new Error(`Row ${i + 1}: Tenant name is required`);
          }

          const tenantRes = await apiRequest('POST', '/api/rent-roll/tenants', {
            displayName: tenantData.displayName || tenantData.name,
            email: tenantData.email,
            phone: tenantData.phone,
            entityType: 'individual',
          });
          const tenant = await tenantRes.json();

          await apiRequest('POST', '/api/rent-roll/leases', {
            tenantId: tenant.id,
            locationId: locationId || null,
            leaseType: leaseData.leaseType || 'slip',
            storageType: leaseData.storageType,
            startDate: leaseData.startDate,
            endDate: leaseData.endDate,
            baseRent: leaseData.baseRent,
            rentPeriod: leaseData.rentPeriod || 'month',
            discountType: leaseData.discountType,
            discountValue: leaseData.discountValue,
            notes: leaseData.notes,
            vessel: Object.keys(vesselData).length > 0 ? vesselData : null,
          });

          results.success++;
        } catch (error: any) {
          results.errors++;
          results.errorDetails.push(error.message || `Row ${i + 1}: Unknown error`);
        }
        
        setImportProgress(Math.round(((i + 1) / dataRows.length) * 100));
      }
      
      return results;
    },
    onSuccess: (results) => {
      setImportResults(results);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/leases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setStep('mapping');
    },
  });

  const handleStartImport = () => {
    setStep('importing');
    setImportProgress(0);
    importMutation.mutate();
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setMappings({});
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0, errorDetails: [] });
    onOpenChange(false);
    if (importResults.success > 0) {
      onSuccess();
    }
  };

  const getMappedFieldsCount = () => {
    return Object.values(mappings).filter(v => v !== 'skip').length;
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import Leases</SheetTitle>
          <SheetDescription>
            Upload a CSV, Excel, or PDF file to import lease data into the rent roll.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={step === 'upload' ? 'default' : 'secondary'}>1. Upload</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === 'mapping' ? 'default' : 'secondary'}>2. Map Fields</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === 'preview' || step === 'importing' ? 'default' : 'secondary'}>3. Import</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === 'complete' ? 'default' : 'secondary'}>4. Complete</Badge>
          </div>

          {step === 'upload' && (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
              data-testid="file-dropzone"
            >
              <input {...getInputProps()} data-testid="file-input" />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? "Drop the file here" : "Drag & drop a file here"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  CSV
                </Badge>
                <Badge variant="outline">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  XLSX
                </Badge>
                <Badge variant="outline">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  XLS
                </Badge>
              </div>
            </div>
          )}

          {step === 'mapping' && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">{file?.name}</span>
                  <Badge variant="secondary">{preview.totalRows} rows</Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setStep('upload'); setFile(null); setPreview(null); }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Change file
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Source Column</TableHead>
                      <TableHead className="w-[200px]">Map To</TableHead>
                      <TableHead>Sample Values</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.headers.map((header, idx) => (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select 
                            value={mappings[header]} 
                            onValueChange={(value) => updateMapping(header, value)}
                          >
                            <SelectTrigger className="w-full" data-testid={`mapping-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEASE_FIELDS.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {preview.rows.slice(0, 3).map(row => row[idx] || '-').join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">{getMappedFieldsCount()}</span> of {preview.headers.length} columns mapped
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back
                  </Button>
                  <Button 
                    onClick={handleStartImport}
                    disabled={getMappedFieldsCount() === 0}
                    data-testid="btn-start-import"
                  >
                    Import {preview.totalRows} Rows
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center space-y-6">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <div>
                <p className="text-lg font-medium mb-2">Importing leases...</p>
                <p className="text-sm text-muted-foreground">
                  Please wait while we process your data.
                </p>
              </div>
              <div className="max-w-xs mx-auto">
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">{importProgress}% complete</p>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-8 text-center space-y-6">
              {importResults.errors === 0 ? (
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              ) : (
                <AlertCircle className="h-16 w-16 mx-auto text-yellow-500" />
              )}
              
              <div>
                <p className="text-xl font-bold mb-2">Import Complete</p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <Badge variant="default" className="bg-green-500">
                    {importResults.success} imported
                  </Badge>
                  {importResults.errors > 0 && (
                    <Badge variant="destructive">
                      {importResults.errors} errors
                    </Badge>
                  )}
                </div>
              </div>

              {importResults.errorDetails.length > 0 && (
                <div className="text-left max-h-40 overflow-y-auto border rounded-lg p-4 bg-muted/50">
                  <p className="text-sm font-medium mb-2">Error Details:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {importResults.errorDetails.slice(0, 10).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {importResults.errorDetails.length > 10 && (
                      <li>...and {importResults.errorDetails.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              <Button onClick={handleClose} data-testid="btn-close-import">
                Done
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default FileImportDrawer;

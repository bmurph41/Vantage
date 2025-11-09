import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
}

interface CSVRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface DuplicateWarning {
  row: number;
  message: string;
}

interface FieldMapping {
  transactionDate?: string;
  fuelType?: string;
  quantityGallons?: string;
  pricePerGallon?: string;
  totalAmount?: string;
  customerName?: string;
  boatName?: string;
  slipNumber?: string;
  paymentMethod?: string;
  notes?: string;
}

const REQUIRED_FIELDS = [
  { key: "transactionDate", label: "Transaction Date" },
  { key: "fuelType", label: "Fuel Type" },
  { key: "quantityGallons", label: "Quantity (Gallons)" },
  { key: "pricePerGallon", label: "Price per Gallon" },
  { key: "totalAmount", label: "Total Amount" },
] as const;

const OPTIONAL_FIELDS = [
  { key: "customerName", label: "Customer Name" },
  { key: "boatName", label: "Boat/Vessel Name" },
  { key: "slipNumber", label: "Pump/Slip Number" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "notes", label: "Notes" },
] as const;

const FUEL_TYPES = ["diesel", "regular_gas", "premium_gas", "ethanol_free"];
const PAYMENT_METHODS = ["cash", "credit_card", "debit_card", "account_charge", "check"];

export function CSVImportModal({ open, onClose }: CSVImportModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [step, setStep] = useState<"upload" | "mapping" | "validation" | "summary">("upload");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    if (uploadedFile.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    setFile(uploadedFile);
    
    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CSVRow[];
        setCsvData(data);
        setCsvHeaders(results.meta.fields || []);
        
        // Auto-map fields based on header names
        const autoMapping: FieldMapping = {};
        const headers = results.meta.fields || [];
        
        headers.forEach((header) => {
          const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          if (lowerHeader.includes('date') || lowerHeader.includes('transaction')) {
            autoMapping.transactionDate = header;
          } else if (lowerHeader.includes('fuel') && lowerHeader.includes('type')) {
            autoMapping.fuelType = header;
          } else if (lowerHeader.includes('quantity') || lowerHeader.includes('gallon')) {
            autoMapping.quantityGallons = header;
          } else if (lowerHeader.includes('price') && !lowerHeader.includes('total')) {
            autoMapping.pricePerGallon = header;
          } else if (lowerHeader.includes('total') || lowerHeader.includes('amount')) {
            autoMapping.totalAmount = header;
          } else if (lowerHeader.includes('customer') && !lowerHeader.includes('email')) {
            autoMapping.customerName = header;
          } else if (lowerHeader.includes('boat') || lowerHeader.includes('vessel')) {
            autoMapping.boatName = header;
          } else if (lowerHeader.includes('slip') || lowerHeader.includes('pump')) {
            autoMapping.slipNumber = header;
          } else if (lowerHeader.includes('payment')) {
            autoMapping.paymentMethod = header;
          } else if (lowerHeader.includes('note')) {
            autoMapping.notes = header;
          }
        });
        
        setFieldMapping(autoMapping);
        setStep("mapping");
      },
      error: (error) => {
        toast({
          title: "Parse Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const validateData = () => {
    const errors: ValidationError[] = [];
    const duplicates: DuplicateWarning[] = [];
    const seen = new Set<string>();

    csvData.forEach((row, index) => {
      // Check required fields are mapped and have values
      REQUIRED_FIELDS.forEach(({ key, label }) => {
        const mappedHeader = fieldMapping[key as keyof FieldMapping];
        if (!mappedHeader) {
          errors.push({ row: index + 1, field: label, message: "Field not mapped" });
          return;
        }
        
        const value = row[mappedHeader]?.trim();
        if (!value) {
          errors.push({ row: index + 1, field: label, message: "Missing value" });
          return;
        }

        // Validate specific field types
        if (key === "transactionDate") {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({ row: index + 1, field: label, message: "Invalid date format" });
          }
        } else if (key === "fuelType") {
          const normalizedValue = value.toLowerCase().replace(/\s+/g, '_');
          if (!FUEL_TYPES.includes(normalizedValue)) {
            errors.push({ row: index + 1, field: label, message: `Invalid fuel type. Must be one of: ${FUEL_TYPES.join(', ')}` });
          }
        } else if (key === "quantityGallons" || key === "pricePerGallon" || key === "totalAmount") {
          const num = parseFloat(value);
          if (isNaN(num) || num <= 0) {
            errors.push({ row: index + 1, field: label, message: "Must be a positive number" });
          }
        }
      });

      // Check payment method if mapped
      if (fieldMapping.paymentMethod) {
        const paymentValue = row[fieldMapping.paymentMethod]?.trim().toLowerCase().replace(/\s+/g, '_');
        if (paymentValue && !PAYMENT_METHODS.includes(paymentValue)) {
          errors.push({ 
            row: index + 1, 
            field: "Payment Method", 
            message: `Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}` 
          });
        }
      }

      // Check for duplicates (same date + customer + gallons)
      if (fieldMapping.transactionDate && fieldMapping.quantityGallons) {
        const dateValue = row[fieldMapping.transactionDate];
        const gallonsValue = row[fieldMapping.quantityGallons];
        const customerValue = fieldMapping.customerName ? row[fieldMapping.customerName] : "";
        
        const duplicateKey = `${dateValue}|${customerValue}|${gallonsValue}`;
        if (seen.has(duplicateKey)) {
          duplicates.push({ 
            row: index + 1, 
            message: `Possible duplicate: same date, customer, and gallons` 
          });
        }
        seen.add(duplicateKey);
      }
    });

    setValidationErrors(errors);
    setDuplicateWarnings(duplicates);
    setStep("summary");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      // Map CSV data to fuel sales format
      const mappedData = csvData.map((row) => {
        const transactionDate = fieldMapping.transactionDate ? row[fieldMapping.transactionDate] : "";
        const fuelType = fieldMapping.fuelType ? row[fieldMapping.fuelType].toLowerCase().replace(/\s+/g, '_') : "";
        const quantityGallons = fieldMapping.quantityGallons ? row[fieldMapping.quantityGallons] : "";
        const pricePerGallon = fieldMapping.pricePerGallon ? row[fieldMapping.pricePerGallon] : "";
        const totalAmount = fieldMapping.totalAmount ? row[fieldMapping.totalAmount] : "";
        const customerName = fieldMapping.customerName ? row[fieldMapping.customerName] : undefined;
        const boatName = fieldMapping.boatName ? row[fieldMapping.boatName] : undefined;
        const slipNumber = fieldMapping.slipNumber ? row[fieldMapping.slipNumber] : undefined;
        const paymentMethod = fieldMapping.paymentMethod ? row[fieldMapping.paymentMethod]?.toLowerCase().replace(/\s+/g, '_') : undefined;
        const notes = fieldMapping.notes ? row[fieldMapping.notes] : undefined;

        return {
          transactionDate: new Date(transactionDate).toISOString(),
          fuelType,
          quantityGallons,
          pricePerGallon,
          totalAmount,
          customerName,
          boatName,
          slipNumber,
          paymentMethod,
          notes,
        };
      });

      return await apiRequest("/api/operations/fuel-sales/import-csv", {
        method: "POST",
        body: JSON.stringify({ data: mappedData }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-sales'] });
      toast({
        title: "Import Successful",
        description: `${result.imported} records imported, ${result.skipped} skipped, ${result.errors.length} errors`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setFieldMapping({});
    setValidationErrors([]);
    setDuplicateWarnings([]);
    setStep("upload");
    onClose();
  };

  const handleImport = () => {
    importMutation.mutate();
  };

  const downloadTemplate = () => {
    const template = [
      ["Transaction Date", "Fuel Type", "Quantity Gallons", "Price Per Gallon", "Total Amount", "Customer Name", "Boat Name", "Slip Number", "Payment Method", "Notes"],
      ["2025-01-15", "diesel", "50.5", "3.45", "174.23", "John Doe", "Sea Breeze", "A-12", "credit_card", "Regular fill-up"],
      ["2025-01-15", "regular_gas", "25.0", "3.20", "80.00", "Jane Smith", "Wave Rider", "B-5", "cash", ""],
    ];

    const csv = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fuel-sales-import-template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Fuel Sales from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import fuel sales transactions
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              data-testid="dropzone-upload"
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg">Drop your CSV file here...</p>
              ) : (
                <>
                  <p className="text-lg mb-2">Drag and drop a CSV file here, or click to select</p>
                  <p className="text-sm text-muted-foreground">Maximum file size: 5MB</p>
                </>
              )}
            </div>

            {file && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  File selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Map your CSV columns to the required fields. Fields marked with * are required.
              </AlertDescription>
            </Alert>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-3">Required Fields</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {REQUIRED_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label} *</Label>
                        <Select
                          value={fieldMapping[key as keyof FieldMapping] || ""}
                          onValueChange={(value) => setFieldMapping({ ...fieldMapping, [key]: value })}
                        >
                          <SelectTrigger data-testid={`select-map-${key}`}>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Not mapped --</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Optional Fields</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {OPTIONAL_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <Select
                          value={fieldMapping[key as keyof FieldMapping] || ""}
                          onValueChange={(value) => setFieldMapping({ ...fieldMapping, [key]: value })}
                        >
                          <SelectTrigger data-testid={`select-map-${key}`}>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Not mapped --</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Data Preview (First 10 Rows)</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {csvHeaders.map((header) => (
                            <th key={header} className="p-2 text-left font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {csvData.slice(0, 10).map((row, index) => (
                          <tr key={index}>
                            {csvHeaders.map((header) => (
                              <td key={header} className="p-2">
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back">
                Back
              </Button>
              <Button onClick={validateData} data-testid="button-validate">
                Next: Validate Data
              </Button>
            </div>
          </div>
        )}

        {step === "summary" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600" data-testid="text-ready-count">
                  {csvData.length - validationErrors.length}
                </div>
                <div className="text-sm text-muted-foreground">Rows ready to import</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600" data-testid="text-duplicates-count">
                  {duplicateWarnings.length}
                </div>
                <div className="text-sm text-muted-foreground">Duplicate warnings</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600" data-testid="text-errors-count">
                  {validationErrors.length}
                </div>
                <div className="text-sm text-muted-foreground">Validation errors</div>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please fix the validation errors before importing
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="flex-1">
              {validationErrors.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <X className="w-4 h-4 text-red-600" />
                    Validation Errors
                  </h3>
                  <div className="space-y-2">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="text-sm border-l-4 border-red-500 pl-3 py-1">
                        Row {error.row}, {error.field}: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {duplicateWarnings.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    Duplicate Warnings
                  </h3>
                  <div className="space-y-2">
                    {duplicateWarnings.map((warning, index) => (
                      <div key={index} className="text-sm border-l-4 border-yellow-500 pl-3 py-1">
                        Row {warning.row}: {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationErrors.length === 0 && duplicateWarnings.length === 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    All data validated successfully! Ready to import {csvData.length} records.
                  </AlertDescription>
                </Alert>
              )}
            </ScrollArea>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-to-mapping">
                Back to Mapping
              </Button>
              <Button
                onClick={handleImport}
                disabled={validationErrors.length > 0 || importMutation.isPending}
                data-testid="button-import"
              >
                {importMutation.isPending ? "Importing..." : `Import ${csvData.length} Records`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

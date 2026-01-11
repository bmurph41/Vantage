import { useState, useRef } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ParsedImportRow } from "@shared/schema";

interface BulkLeaseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkLeaseImportDialog({ open, onOpenChange }: BulkLeaseImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File upload state
  const [fileName, setFileName] = useState<string>("");
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Parsing state
  const [parsedData, setParsedData] = useState<ParsedImportRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string>("");
  
  // Import options
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  
  // Step tracking (0=upload, 1=preview, 2=importing, 3=complete)
  const [step, setStep] = useState<number>(0);

  // Parse mutation - calls backend to validate rows
  const parseMutation = useMutation({
    mutationFn: async (data: { rows: any[]; headers: string[] }) => {
      const response = await apiRequest("POST", "/api/rent-roll/leases/import/parse", data);
      return response.json();
    },
    onSuccess: (data) => {
      setParsedData(data.parsedRows);
      setColumnMapping(data.columnMapping);
      setStep(1); // Move to preview step
    },
    onError: (error: any) => {
      toast({
        title: "Parse error",
        description: error.message || "Failed to parse CSV data",
        variant: "destructive",
      });
    },
  });

  // Import mutation - executes the import
  const importMutation = useMutation({
    mutationFn: async (data: { rows: ParsedImportRow[]; skipDuplicates: boolean }) => {
      const response = await apiRequest("POST", "/api/rent-roll/leases/import", data);
      return response.json();
    },
    onSuccess: (data) => {
      const imported = data.imported || 0;
      const skipped = data.skipped || 0;
      const errors = data.errors || 0;

      toast({
        title: "Import complete",
        description: `Imported ${imported} leases${skipped > 0 ? `, skipped ${skipped} duplicates` : ""}${errors > 0 ? `, ${errors} errors` : ""}`,
        variant: imported > 0 ? "default" : "destructive",
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });

      // Close dialog after brief delay
      if (imported > 0) {
        setTimeout(() => handleClose(), 500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import leases",
        variant: "destructive",
      });
    },
  });

  const resetState = () => {
    setFileName("");
    setRawRows([]);
    setHeaders([]);
    setParsedData([]);
    setColumnMapping({});
    setParseError("");
    setSkipDuplicates(true);
    setStep(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }

        if (results.data.length === 0) {
          setParseError("CSV file is empty");
          return;
        }

        // Extract headers and rows
        const csvHeaders = results.meta.fields || [];
        const csvRows = results.data;

        setHeaders(csvHeaders);
        setRawRows(csvRows);

        // Automatically parse with backend
        parseMutation.mutate({ rows: csvRows, headers: csvHeaders });
      },
      error: (error) => {
        setParseError(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  const handleImport = () => {
    const validRows = parsedData.filter(row => row.errors.length === 0);
    
    if (validRows.length === 0) {
      toast({
        title: "No valid rows",
        description: "Please fix all validation errors before importing",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate({ rows: validRows, skipDuplicates });
  };

  const validCount = parsedData.filter(r => r.errors.length === 0 && !r.isDuplicate).length;
  const errorCount = parsedData.filter(r => r.errors.length > 0).length;
  const duplicateCount = parsedData.filter(r => r.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Import Leases</DialogTitle>
          <DialogDescription>
            Upload a file with tenant and lease information. Columns will be automatically mapped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 pb-6">
          {/* Step 0: File Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-md p-8 text-center hover-elevate cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-upload"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file"
                />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Click to upload file</p>
                <p className="text-xs text-muted-foreground">CSV or Excel files with tenant and lease data</p>
              </div>

              {fileName && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{fileName}</span>
                  {parseMutation.isPending && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                      <span className="text-sm text-muted-foreground">Parsing...</span>
                    </>
                  )}
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Validation Preview */}
          {step === 1 && (
            <div className="space-y-4 h-full flex flex-col">
              {/* Summary badges */}
              <div className="flex gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} Valid
                </Badge>
                {duplicateCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {duplicateCount} Duplicates
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errorCount} Errors
                  </Badge>
                )}
              </div>

              {/* Column mapping info */}
              <div className="text-sm text-muted-foreground">
                <strong>Detected columns:</strong> {Object.keys(columnMapping).length} of {headers.length} mapped
              </div>

              {/* Preview table */}
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Commencement</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row) => (
                      <TableRow
                        key={row.rowIndex}
                        className={row.errors.length > 0 ? "bg-destructive/5" : row.isDuplicate ? "bg-yellow-500/5" : ""}
                        data-testid={`row-preview-${row.rowIndex}`}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.rowIndex + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.tenantData.name || <span className="text-muted-foreground italic">Missing</span>}
                        </TableCell>
                        <TableCell>
                          {row.leaseData.leaseCommencement || <span className="text-muted-foreground italic">Missing</span>}
                        </TableCell>
                        <TableCell>
                          {row.leaseData.leaseAmount ? `$${row.leaseData.leaseAmount}` : <span className="text-muted-foreground italic">Missing</span>}
                        </TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </Badge>
                          ) : row.isDuplicate ? (
                            <Badge variant="secondary" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Duplicate
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Valid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-destructive">
                          {row.errors.join(", ")}
                          {row.isDuplicate && !row.errors.length && (
                            <span className="text-yellow-600">{row.duplicateMatchReason}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Import options */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-duplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                  data-testid="checkbox-skip-duplicates"
                />
                <Label htmlFor="skip-duplicates" className="text-sm cursor-pointer">
                  Skip duplicate leases ({duplicateCount} detected)
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t px-6 py-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>

          <div className="flex gap-2">
            {step === 1 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep(0)}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0 || importMutation.isPending}
                  data-testid="button-import"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${validCount} ${validCount === 1 ? "Lease" : "Leases"}`
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

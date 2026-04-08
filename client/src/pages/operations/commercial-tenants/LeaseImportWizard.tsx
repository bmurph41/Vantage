import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Upload, 
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FileX,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedLease {
  tenantName: string | null;
  suiteNumber: string | null;
  squareFootage: number | null;
  currentBaseRent: number | null;
  leaseCommencementDate: string | null;
  leaseExpirationDate: string | null;
  leaseType: string | null;
  escalationType: string | null;
  escalationRate: number | null;
  selected?: boolean;
}

interface ParseResult {
  success: boolean;
  fileType: string;
  extractionMethod: string;
  confidence: string;
  leases: ParsedLease[];
  warnings: string[];
  errors: string[];
  metadata: {
    totalLeases: number;
    aiPowered: boolean;
    processingTimeMs: number;
    pageCount?: number;
  };
  rawText?: string;
}

interface LeaseImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelingProjectId?: string;
  marinaId?: string;
}

export function LeaseImportWizard({ 
  open, 
  onOpenChange, 
  modelingProjectId, 
  marinaId 
}: LeaseImportWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedLeases, setSelectedLeases] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/commercial-tenants/parse?useAI=true', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Parse failed');
      }
      
      return response.json() as Promise<ParseResult>;
    },
    onSuccess: (result) => {
      setParseResult(result);
      if (result.leases.length > 0) {
        setSelectedLeases(new Set(result.leases.map((_, i) => i)));
        setStep('preview');
      } else {
        toast({
          title: "No leases found",
          description: "The document did not contain recognizable lease data",
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Parse failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (leases: ParsedLease[]) => {
      return apiRequest('/api/commercial-tenants/bulk-import', {
        method: 'POST',
        body: JSON.stringify({
          leases,
          modelingProjectId,
          marinaId,
        }),
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/commercial-tenants'] });
      toast({
        title: "Import complete",
        description: `Successfully imported ${result.imported} tenants`,
      });
      handleClose();
    },
    onError: (err: any) => {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParseResult(null);
    setSelectedLeases(new Set());
    onOpenChange(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.toLowerCase().split('.').pop();
      if (['pdf', 'xlsx', 'xls', 'csv'].includes(ext || '')) {
        setFile(droppedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, Excel, or CSV file",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleParse = () => {
    if (file) {
      parseMutation.mutate(file);
    }
  };

  const handleImport = () => {
    if (parseResult) {
      const leasesToImport = parseResult.leases
        .filter((_, i) => selectedLeases.has(i))
        .map(lease => ({
          ...lease,
          leaseCommencementDate: lease.leaseCommencementDate || new Date().toISOString().split('T')[0],
          leaseExpirationDate: lease.leaseExpirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }));
      importMutation.mutate(leasesToImport);
    }
  };

  const toggleLease = (index: number) => {
    const newSelected = new Set(selectedLeases);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLeases(newSelected);
  };

  const toggleAll = () => {
    if (selectedLeases.size === parseResult?.leases.length) {
      setSelectedLeases(new Set());
    } else {
      setSelectedLeases(new Set(parseResult?.leases.map((_, i) => i)));
    }
  };

  const formatCurrency = (val: number | null) => {
    if (!val) return "-";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Lease Abstracts
          </DialogTitle>
          <DialogDescription>
            Upload a lease abstract document (PDF, Excel, or CSV) to automatically extract tenant data
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
            <span>Upload</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
          <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
            <span>Review</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
          <div className={`flex items-center gap-2 ${step === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3</div>
            <span>Import</span>
          </div>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    {file.name.endsWith('.pdf') ? (
                      <FileText className="h-12 w-12 text-red-500" />
                    ) : (
                      <FileSpreadsheet className="h-12 w-12 text-green-500" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                    Choose Different File
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Drop your file here</p>
                  <p className="text-muted-foreground mb-4">or click to browse</p>
                  <Input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    className="hidden"
                    id="file-upload"
                    onChange={handleFileSelect}
                  />
                  <Label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Select File</span>
                    </Button>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-4">
                    Supported formats: PDF, Excel (.xlsx, .xls), CSV
                  </p>
                </>
              )}
            </div>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">AI-Powered Extraction</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Our AI will automatically extract lease terms including tenant names, rent amounts, 
                  escalations, NNN charges, renewal options, and more from your document.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'preview' && parseResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant={parseResult.confidence === 'high' ? 'default' : 'secondary'}>
                  {parseResult.confidence} confidence
                </Badge>
                <Badge variant="outline">
                  {parseResult.extractionMethod === 'ai' ? (
                    <><Sparkles className="h-3 w-3 mr-1" /> AI extracted</>
                  ) : (
                    parseResult.extractionMethod
                  )}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {parseResult.metadata.processingTimeMs}ms
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedLeases.size} of {parseResult.leases.length} selected
              </div>
            </div>

            {parseResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Warnings</span>
                </div>
                <ul className="text-sm text-yellow-700 mt-1 ml-6 list-disc">
                  {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="border rounded-lg overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedLeases.size === parseResult.leases.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead>Suite</TableHead>
                    <TableHead>SF</TableHead>
                    <TableHead>Base Rent</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.leases.map((lease, index) => (
                    <TableRow key={index} className={selectedLeases.has(index) ? '' : 'opacity-50'}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeases.has(index)}
                          onCheckedChange={() => toggleLease(index)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {lease.tenantName || <span className="text-red-500">Missing</span>}
                      </TableCell>
                      <TableCell>{lease.suiteNumber || "-"}</TableCell>
                      <TableCell>{lease.squareFootage?.toLocaleString() || "-"}</TableCell>
                      <TableCell>{formatCurrency(lease.currentBaseRent)}</TableCell>
                      <TableCell className="text-xs">
                        {lease.leaseCommencementDate || "?"} - {lease.leaseExpirationDate || "?"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lease.leaseType || "nnn"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

            {parseResult.leases.length === 0 && (
              <div className="text-center py-8">
                <FileX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No lease data extracted</p>
                <p className="text-sm text-muted-foreground">
                  The document may not contain recognizable lease information
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleParse} 
                disabled={!file || parseMutation.isPending}
              >
                {parseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {parseMutation.isPending ? 'Parsing...' : 'Parse Document'}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={selectedLeases.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {selectedLeases.size} Tenant{selectedLeases.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

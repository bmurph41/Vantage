import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, FileText, Download } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface ImportResult {
  filename: string;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  rowErrors?: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
}

interface ImportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: ImportResult[];
  entityType: 'contacts' | 'companies' | 'properties';
}

export function ImportResultsModal({ 
  isOpen, 
  onClose, 
  results, 
  entityType 
}: ImportResultsModalProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFileExpansion = (filename: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filename)) {
      newExpanded.delete(filename);
    } else {
      newExpanded.add(filename);
    }
    setExpandedFiles(newExpanded);
  };

  const totalStats = results.reduce(
    (acc, result) => ({
      processed: acc.processed + result.processed,
      created: acc.created + result.created,
      updated: acc.updated + result.updated,
      skipped: acc.skipped + result.skipped,
      errors: acc.errors + (result.rowErrors?.length || 0)
    }),
    { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 }
  );

  const downloadErrorReport = () => {
    const errorData = results.flatMap(result => 
      result.rowErrors?.map(error => ({
        file: result.filename,
        row: error.row,
        errors: error.errors.join('; '),
        data: JSON.stringify(error.data)
      })) || []
    );

    if (errorData.length === 0) return;

    const csvContent = [
      'File,Row,Errors,Data',
      ...errorData.map(row => 
        `"${row.file}",${row.row},"${row.errors}","${row.data}"`
      )
    ].join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}-import-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Results - {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-4">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{totalStats.processed}</div>
              <div className="text-sm text-gray-600">Processed</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{totalStats.created}</div>
              <div className="text-sm text-gray-600">Created</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{totalStats.updated}</div>
              <div className="text-sm text-gray-600">Updated</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">{totalStats.skipped}</div>
              <div className="text-sm text-gray-600">Skipped</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{totalStats.errors}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </Card>
          </div>

          {/* File Results */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {results.map((result, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">{result.filename}</div>
                      <div className="text-sm text-gray-600">
                        {result.processed} processed • {result.created} created
                        {result.rowErrors && result.rowErrors.length > 0 && (
                          <span className="text-red-600"> • {result.rowErrors.length} errors</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={result.created > 0 ? "default" : "secondary"}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {result.created} created
                    </Badge>
                    
                    {result.rowErrors && result.rowErrors.length > 0 && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        {result.rowErrors.length} errors
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Error Details */}
                {result.rowErrors && result.rowErrors.length > 0 && (
                  <Collapsible
                    open={expandedFiles.has(result.filename)}
                    onOpenChange={() => toggleFileExpansion(result.filename)}
                  >
                    <CollapsibleTrigger className="w-full mt-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start text-red-600 hover:text-red-700"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {expandedFiles.has(result.filename) ? 'Hide' : 'Show'} Error Details ({result.rowErrors.length})
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="mt-2">
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-40 overflow-y-auto">
                        {result.rowErrors.map((error, errorIndex) => (
                          <div key={errorIndex} className="mb-2 last:mb-0">
                            <div className="text-sm font-medium text-red-800">
                              Row {error.row}:
                            </div>
                            <ul className="text-sm text-red-700 ml-3 list-disc">
                              {error.errors.map((err, errIndex) => (
                                <li key={errIndex}>{err}</li>
                              ))}
                            </ul>
                            {Object.keys(error.data).length > 0 && (
                              <div className="text-xs text-red-600 mt-1 font-mono bg-red-100 p-1 rounded">
                                Data: {JSON.stringify(error.data, null, 2)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              {totalStats.errors > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadErrorReport}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Error Report
                </Button>
              )}
            </div>
            
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
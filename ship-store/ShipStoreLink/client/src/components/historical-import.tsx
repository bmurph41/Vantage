import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface ParsedData {
  headers: string[];
  rows: any[][];
}

interface ColumnMapping {
  revenue?: string;
  cogs?: string;
  grossProfit?: string;
  operatingExpenses?: string;
  netIncome?: string;
  transactionCount?: string;
  averageOrderValue?: string;
  periodYear?: string;
  periodMonth?: string;
  periodQuarter?: string;
}

export function HistoricalDataImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [dataSource, setDataSource] = useState<string>("import");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setImportResult(null);

    const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(uploadedFile, {
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const headers = results.data[0] as string[];
            const rows = results.data.slice(1) as any[][];
            setParsedData({ headers, rows: rows.filter(row => row.some(cell => cell)) });
            autoMapColumns(headers);
          }
        },
        error: (error) => {
          toast({
            title: "Parse Error",
            description: `Failed to parse CSV: ${error.message}`,
            variant: "destructive",
          });
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          
          if (jsonData.length > 0) {
            const headers = jsonData[0].map(String);
            const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
            setParsedData({ headers, rows });
            autoMapColumns(headers);
          }
        } catch (error: any) {
          toast({
            title: "Parse Error",
            description: `Failed to parse Excel: ${error.message}`,
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(uploadedFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
    }
  };

  const autoMapColumns = (headers: string[]) => {
    const mapping: ColumnMapping = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    // Auto-detect common column names
    const patterns = {
      revenue: ['revenue', 'sales', 'total revenue', 'total sales'],
      cogs: ['cogs', 'cost of goods sold', 'cost of sales'],
      grossProfit: ['gross profit', 'gross margin', 'gp'],
      operatingExpenses: ['operating expenses', 'opex', 'expenses', 'operating costs'],
      netIncome: ['net income', 'net profit', 'profit', 'net earnings'],
      transactionCount: ['transactions', 'transaction count', 'orders', 'order count'],
      averageOrderValue: ['aov', 'average order value', 'avg order', 'average transaction'],
      periodYear: ['year', 'fiscal year', 'period year'],
      periodMonth: ['month', 'period month', 'fiscal month'],
      periodQuarter: ['quarter', 'period quarter', 'fiscal quarter'],
    };

    Object.entries(patterns).forEach(([key, patterns]) => {
      const matchIndex = lowerHeaders.findIndex(h => patterns.some(p => h.includes(p)));
      if (matchIndex !== -1) {
        mapping[key as keyof ColumnMapping] = headers[matchIndex];
      }
    });

    setColumnMapping(mapping);
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload a file with data",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Transform rows into records based on column mapping
      const records = parsedData.rows.map((row) => {
        const getColumnValue = (mappedColumn?: string) => {
          if (!mappedColumn) return null;
          const index = parsedData.headers.indexOf(mappedColumn);
          return index !== -1 ? row[index] : null;
        };

        const parseNumber = (val: any) => {
          if (!val) return null;
          const cleaned = String(val).replace(/[$,]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? null : parsed.toFixed(2);
        };

        const parseInteger = (val: any) => {
          if (!val) return null;
          const parsed = parseInt(String(val).replace(/[^0-9]/g, ''));
          return isNaN(parsed) ? null : parsed;
        };

        const record: any = {
          dataSource,
          period,
          periodYear: parseInteger(getColumnValue(columnMapping.periodYear)),
          periodMonth: period === 'monthly' ? parseInteger(getColumnValue(columnMapping.periodMonth)) : null,
          periodQuarter: period === 'quarterly' ? parseInteger(getColumnValue(columnMapping.periodQuarter)) : null,
          revenue: parseNumber(getColumnValue(columnMapping.revenue)),
          cogs: parseNumber(getColumnValue(columnMapping.cogs)),
          grossProfit: parseNumber(getColumnValue(columnMapping.grossProfit)),
          operatingExpenses: parseNumber(getColumnValue(columnMapping.operatingExpenses)),
          netIncome: parseNumber(getColumnValue(columnMapping.netIncome)),
          transactionCount: parseInteger(getColumnValue(columnMapping.transactionCount)),
          averageOrderValue: parseNumber(getColumnValue(columnMapping.averageOrderValue)),
        };

        // Calculate derived fields if not provided
        if (record.revenue && record.cogs && !record.grossProfit) {
          record.grossProfit = (parseFloat(record.revenue) - parseFloat(record.cogs)).toFixed(2);
        }
        if (record.grossProfit && record.operatingExpenses && !record.netIncome) {
          record.netIncome = (parseFloat(record.grossProfit) - parseFloat(record.operatingExpenses)).toFixed(2);
        }

        return record;
      }).filter(record => record.periodYear); // Filter out records without required year

      if (records.length === 0) {
        toast({
          title: "No Valid Records",
          description: "No records could be imported. Please check your column mappings.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      const response = await apiRequest("POST", "/api/historical-data/import", { records });
      const result = await response.json();

      setImportResult({ success: true, message: result.message });
      toast({
        title: "Import Successful",
        description: result.message,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/historical-data"] });

      // Reset form
      setFile(null);
      setParsedData(null);
      setColumnMapping({});
    } catch (error: any) {
      const errorMessage = error.message || "Failed to import data";
      setImportResult({ success: false, message: errorMessage });
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Historical Financial Data</CardTitle>
          <CardDescription>
            Upload CSV or Excel files containing historical revenue, costs, and profitability data.
            This data will be used to establish baselines for financial projections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload File</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                data-testid="file-upload-input"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="w-12 h-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">CSV or Excel files accepted</p>
                  </div>
                  {file && (
                    <div className="flex items-center space-x-2 text-sm text-green-600 mt-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{file.name}</span>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {parsedData && (
            <>
              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Type</Label>
                  <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
                    <SelectTrigger data-testid="period-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Source</Label>
                  <Select value={dataSource} onValueChange={setDataSource}>
                    <SelectTrigger data-testid="source-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="import">Manual Import</SelectItem>
                      <SelectItem value="quickbooks">QuickBooks</SelectItem>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                      <SelectItem value="pos">POS System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="space-y-4">
                <h3 className="font-medium">Map Columns</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Revenue Column</Label>
                    <Select 
                      value={columnMapping.revenue} 
                      onValueChange={(val) => setColumnMapping({...columnMapping, revenue: val})}
                    >
                      <SelectTrigger data-testid="map-revenue">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>COGS Column</Label>
                    <Select 
                      value={columnMapping.cogs} 
                      onValueChange={(val) => setColumnMapping({...columnMapping, cogs: val})}
                    >
                      <SelectTrigger data-testid="map-cogs">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Operating Expenses Column</Label>
                    <Select 
                      value={columnMapping.operatingExpenses} 
                      onValueChange={(val) => setColumnMapping({...columnMapping, operatingExpenses: val})}
                    >
                      <SelectTrigger data-testid="map-opex">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Net Income Column</Label>
                    <Select 
                      value={columnMapping.netIncome} 
                      onValueChange={(val) => setColumnMapping({...columnMapping, netIncome: val})}
                    >
                      <SelectTrigger data-testid="map-netincome">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Year Column *</Label>
                    <Select 
                      value={columnMapping.periodYear} 
                      onValueChange={(val) => setColumnMapping({...columnMapping, periodYear: val})}
                    >
                      <SelectTrigger data-testid="map-year">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {period === 'monthly' && (
                    <div className="space-y-2">
                      <Label>Month Column *</Label>
                      <Select 
                        value={columnMapping.periodMonth} 
                        onValueChange={(val) => setColumnMapping({...columnMapping, periodMonth: val})}
                      >
                        <SelectTrigger data-testid="map-month">
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {parsedData.headers.map(header => (
                            <SelectItem key={header} value={header}>{header}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {period === 'quarterly' && (
                    <div className="space-y-2">
                      <Label>Quarter Column *</Label>
                      <Select 
                        value={columnMapping.periodQuarter} 
                        onValueChange={(val) => setColumnMapping({...columnMapping, periodQuarter: val})}
                      >
                        <SelectTrigger data-testid="map-quarter">
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {parsedData.headers.map(header => (
                            <SelectItem key={header} value={header}>{header}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <h3 className="font-medium">Data Preview</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {parsedData.headers.slice(0, 6).map(header => (
                          <th key={header} className="p-2 text-left font-medium">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.rows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="border-t">
                          {row.slice(0, 6).map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-2">{String(cell || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing first 5 rows of {parsedData.rows.length} total rows
                </p>
              </div>

              {/* Import Result */}
              {importResult && (
                <Alert variant={importResult.success ? "default" : "destructive"}>
                  {importResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{importResult.message}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setParsedData(null);
                    setColumnMapping({});
                    setImportResult(null);
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || !columnMapping.periodYear}
                  data-testid="button-import"
                >
                  {isImporting ? "Importing..." : "Import Data"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

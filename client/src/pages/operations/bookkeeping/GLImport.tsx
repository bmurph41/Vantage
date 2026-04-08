import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
  XCircle,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OwnedAsset {
  id: string;
  name: string;
}

interface ParsedRow {
  accountName: string;
  accountType: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  valid: boolean;
  error?: string;
}

interface ImportHistory {
  importDate: string;
  rowCount: number;
  marinaId: string;
  earliest: string;
  latest: string;
}

const VALID_ACCOUNT_TYPES = ["revenue", "expense", "asset", "liability", "equity"];

function parseCsvText(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());

  // Find header indices (flexible matching)
  const findIdx = (name: string) =>
    headers.findIndex(
      (h) => h.replace(/[_\s]/g, "").toLowerCase() === name.toLowerCase()
    );

  const nameIdx = findIdx("accountname");
  const typeIdx = findIdx("accounttype");
  const amountIdx = findIdx("amount");
  const startIdx = findIdx("periodstart");
  const endIdx = findIdx("periodend");

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const accountName = nameIdx >= 0 ? cols[nameIdx] || "" : "";
    const accountType = typeIdx >= 0 ? (cols[typeIdx] || "").toLowerCase() : "";
    const amount = amountIdx >= 0 ? cols[amountIdx] || "" : "";
    const periodStart = startIdx >= 0 ? cols[startIdx] || "" : "";
    const periodEnd = endIdx >= 0 ? cols[endIdx] || "" : "";

    const errors: string[] = [];
    if (!accountName) errors.push("missing account name");
    if (!VALID_ACCOUNT_TYPES.includes(accountType))
      errors.push(`invalid type "${accountType}"`);
    if (!amount || isNaN(parseFloat(amount))) errors.push("invalid amount");
    if (!periodStart) errors.push("missing period start");
    if (!periodEnd) errors.push("missing period end");

    rows.push({
      accountName,
      accountType,
      amount,
      periodStart,
      periodEnd,
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });
  }

  return { headers, rows };
}

export default function GLImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMarinaId, setSelectedMarinaId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const { data: ownedAssets = [] } = useQuery<OwnedAsset[]>({
    queryKey: ["/api/operations-context/assets/owned"],
  });

  const { data: importHistory = [], isLoading: historyLoading } =
    useQuery<ImportHistory[]>({
      queryKey: ["/api/bookkeeping/gl/import-history"],
      queryFn: async () => {
        const res = await fetch("/api/bookkeeping/gl/import-history");
        if (!res.ok) throw new Error("Failed to fetch import history");
        return res.json();
      },
    });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookkeeping/gl/csv-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marinaId: selectedMarinaId, csvText }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `${data.imported} rows imported${
          data.skipped > 0 ? `, ${data.skipped} skipped` : ""
        }.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping"] });
      setCsvText("");
      setParsedRows([]);
      setFileName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileRead = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      const { rows } = parseCsvText(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
        handleFileRead(file);
      } else {
        toast({
          title: "Invalid file",
          description: "Please upload a CSV file.",
          variant: "destructive",
        });
      }
    },
    [handleFileRead, toast]
  );

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  // Find marina name by id
  const getMarinaName = (id: string) => {
    const asset = ownedAssets.find((a) => a.id === id);
    return asset?.name ?? id;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">GL Import</h2>
        <p className="text-sm text-muted-foreground">
          Upload CSV files to bulk import general ledger entries
        </p>
      </div>

      {/* Marina Selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4">
            <div className="w-full sm:w-[300px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Target Asset / Marina *
              </Label>
              <Select value={selectedMarinaId} onValueChange={setSelectedMarinaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset for import..." />
                </SelectTrigger>
                <SelectContent>
                  {ownedAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              All imported rows will be associated with this asset.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#1E4FAB]" />
            Upload CSV
          </CardTitle>
          <CardDescription>
            CSV must include headers: accountName, accountType, amount,
            periodStart, periodEnd
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {fileName ? (
              <div className="space-y-2">
                <FileText className="w-10 h-10 mx-auto text-[#1E4FAB]" />
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {parsedRows.length} rows parsed
                  {invalidCount > 0 && (
                    <span className="text-red-600">
                      {" "}
                      ({invalidCount} with errors)
                    </span>
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCsvText("");
                    setParsedRows([]);
                    setFileName("");
                  }}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <FileUp className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">
                  Drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .csv files
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Preview
              <Badge variant="secondary">{validCount} valid</Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">{invalidCount} errors</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review the parsed data before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Period Start</TableHead>
                    <TableHead>Period End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row, i) => (
                    <TableRow
                      key={i}
                      className={!row.valid ? "bg-red-50/50" : undefined}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <span title={row.error}>
                            <XCircle className="w-4 h-4 text-red-600" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.accountName || (
                          <span className="text-red-500 text-xs">missing</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.valid ? (
                          <Badge variant="outline">{row.accountType}</Badge>
                        ) : (
                          <span className="text-red-500 text-xs">
                            {row.accountType || "missing"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {!isNaN(parseFloat(row.amount))
                          ? parseFloat(row.amount).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })
                          : row.amount || "--"}
                      </TableCell>
                      <TableCell>{row.periodStart || "--"}</TableCell>
                      <TableCell>{row.periodEnd || "--"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
            {parsedRows.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing first 100 of {parsedRows.length} rows
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setCsvText("");
                  setParsedRows([]);
                  setFileName("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                disabled={
                  validCount === 0 ||
                  !selectedMarinaId ||
                  importMutation.isPending
                }
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import {validCount} Rows
              </Button>
            </div>
            {!selectedMarinaId && validCount > 0 && (
              <p className="text-xs text-orange-600 text-right mt-1">
                Select a target asset above before importing.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#1E4FAB]" />
            Import History
          </CardTitle>
          <CardDescription>Past CSV import batches</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : importHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm">No import history yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Import Date</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>Period Range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>{h.importDate}</TableCell>
                    <TableCell className="font-medium">
                      {getMarinaName(h.marinaId)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{h.rowCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {h.earliest} to {h.latest}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

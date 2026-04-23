import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CloudUpload, AlertCircle, CheckCircle2, FileQuestion, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MigrationDetail {
  id: string;
  orgId: string;
  filename: string;
  localPath: string;
  outcome: "uploaded" | "missing" | "error";
  newStoragePath?: string;
  errorMessage?: string;
}

interface MigrationResult {
  total: number;
  uploaded: number;
  missing: number;
  errors: number;
  details: MigrationDetail[];
}

export default function DocIntelMigrationAdmin() {
  const { toast } = useToast();
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/doc-intel/migrate-to-object-storage");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server returned ${res.status}`);
      }
      return res.json() as Promise<MigrationResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setApiError(null);
      toast({
        title: "Migration complete",
        description: `${data.uploaded} file(s) uploaded, ${data.missing} missing, ${data.errors} error(s).`,
      });
    },
    onError: (err: Error) => {
      setApiError(err.message);
      toast({
        title: "Migration failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const outcomeIcon = (outcome: MigrationDetail["outcome"]) => {
    if (outcome === "uploaded") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (outcome === "missing") return <FileQuestion className="w-4 h-4 text-yellow-500" />;
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  const outcomeBadge = (outcome: MigrationDetail["outcome"]) => {
    const variants: Record<string, string> = {
      uploaded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      missing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variants[outcome]}`}>
        {outcomeIcon(outcome)}
        {outcome}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Doc-Intel Storage Migration</h1>
        <p className="text-muted-foreground mt-1">
          Recover document intelligence uploads that were stored locally before the object-storage
          migration. Files still on disk are uploaded; files lost to ephemeral restarts are flagged
          for re-upload.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5" />
            Run Migration
          </CardTitle>
          <CardDescription>
            This operation is idempotent — rows already recovered or flagged by a previous run are
            skipped. Safe to run multiple times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            {mutation.isPending ? "Running migration…" : "Start Migration"}
          </Button>

          {apiError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{result.total}</div>
                <div className="text-sm text-muted-foreground mt-1">Files processed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.uploaded}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Uploaded to cloud</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {result.missing}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Missing (need re-upload)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.errors}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Errors</div>
              </CardContent>
            </Card>
          </div>

          {result.missing > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{result.missing} file(s)</strong> could not be recovered because they were
                lost when the ephemeral filesystem was wiped. Those users will need to re-upload
                their documents through the Doc-Intel interface.
              </AlertDescription>
            </Alert>
          )}

          {result.details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Migration Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead>Org ID</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead className="max-w-xs">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.details.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">
                            {row.filename}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.orgId}
                          </TableCell>
                          <TableCell>{outcomeBadge(row.outcome)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {row.outcome === "uploaded" && row.newStoragePath
                              ? row.newStoragePath
                              : row.errorMessage ?? (row.outcome === "missing" ? "Local file not found — please re-upload" : "")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {result.total === 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                No files required migration. All doc-intel uploads are already stored in object
                storage.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}

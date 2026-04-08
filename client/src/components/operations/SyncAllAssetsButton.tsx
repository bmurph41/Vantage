import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, Loader2, CheckCircle } from "lucide-react";

interface OwnedAsset {
  id: string;
  name: string;
  assetType: string;
}

interface SyncResult {
  assetId: string;
  assetName: string;
  assetType: string;
  rowsWritten: number;
}

interface SyncResponse {
  success: boolean;
  assetsSynced: number;
  results: SyncResult[];
}

export default function SyncAllAssetsButton() {
  const [open, setOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets } = useQuery<OwnedAsset[]>({
    queryKey: ["/api/owned-assets"],
    enabled: open,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/operations-context/push-portfolio-to-model", {
        rangeStart,
        rangeEnd,
      });
      return (await res.json()) as SyncResponse;
    },
    onSuccess: (data) => {
      setResults(data.results);
      const totalRows = data.results.reduce((sum, r) => sum + r.rowsWritten, 0);
      toast({
        title: "Portfolio sync complete",
        description: `${data.assetsSynced} assets synced, ${totalRows} total rows written.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Portfolio sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function resetForm() {
    setRangeStart("");
    setRangeEnd("");
    setResults(null);
  }

  const canSubmit = rangeStart && rangeEnd;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync All Assets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sync All Portfolio Assets to Models</DialogTitle>
          <DialogDescription>
            Push operational data for all owned assets into their linked modeling projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio-range-start">Start Date</Label>
              <Input
                id="portfolio-range-start"
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio-range-end">End Date</Label>
              <Input
                id="portfolio-range-end"
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Asset list preview */}
          {!results && assets && assets.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground">
                The following {assets.length} asset(s) will be synced:
              </Label>
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{asset.assetType}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!results && (!assets || assets.length === 0) && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No owned assets found.
            </div>
          )}

          {/* Results table */}
          {results && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Label className="text-sm font-medium text-green-700">Sync completed</Label>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Rows Written</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.assetId}>
                        <TableCell className="font-medium">{result.assetName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{result.assetType}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{result.rowsWritten}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {results ? (
            <Button onClick={() => { setOpen(false); resetForm(); }}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={!canSubmit || syncMutation.isPending || !assets?.length}
              >
                {syncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {syncMutation.isPending ? "Syncing..." : "Sync All Assets"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

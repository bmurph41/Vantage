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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, Loader2 } from "lucide-react";

interface OwnedAsset {
  id: string;
  name: string;
  assetType: string;
}

export default function SyncToLedgerButton() {
  const [open, setOpen] = useState(false);
  const [ownedAssetId, setOwnedAssetId] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets } = useQuery<OwnedAsset[]>({
    queryKey: ["/api/owned-assets"],
    enabled: open,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/operations-context/sync-to-returns-ledger", {
        ownedAssetId,
        rangeStart,
        rangeEnd,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync complete",
        description: `${data.entriesWritten} entries written to returns ledger.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function resetForm() {
    setOwnedAssetId("");
    setRangeStart("");
    setRangeEnd("");
  }

  const canSubmit = ownedAssetId && rangeStart && rangeEnd;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync to Returns Ledger
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Operations to Returns Ledger</DialogTitle>
          <DialogDescription>
            Push operational data for the selected asset and date range into the returns ledger for return calculations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="asset-select">Owned Asset</Label>
            <Select value={ownedAssetId} onValueChange={setOwnedAssetId}>
              <SelectTrigger id="asset-select">
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent>
                {(assets || []).map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name} ({asset.assetType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="range-start">Start Date</Label>
              <Input
                id="range-start"
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="range-end">End Date</Label>
              <Input
                id="range-end"
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={!canSubmit || syncMutation.isPending}
          >
            {syncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sync to Returns
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

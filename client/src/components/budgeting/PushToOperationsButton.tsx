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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Loader2 } from "lucide-react";

interface OwnedAsset {
  id: string;
  name: string;
  assetType: string;
}

interface BudgetSummary {
  id: string;
  name: string;
  fiscalYear: number;
  status: string;
}

export default function PushToOperationsButton() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ownedAssetId, setOwnedAssetId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets } = useQuery<OwnedAsset[]>({
    queryKey: ["/api/owned-assets"],
    enabled: open,
  });

  const { data: budgetsList } = useQuery<BudgetSummary[]>({
    queryKey: ["/api/budgets"],
    enabled: open,
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/operations-context/push-budget-to-asset", {
        ownedAssetId,
        budgetId,
        fiscalYear: parseInt(fiscalYear, 10),
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Budget pushed successfully",
        description: `${data.targetsWritten} budget targets written to asset performance snapshots.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/owned-assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context"] });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Budget push failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function resetForm() {
    setOwnedAssetId("");
    setBudgetId("");
    setFiscalYear(new Date().getFullYear().toString());
  }

  const selectedAsset = assets?.find((a) => a.id === ownedAssetId);
  const selectedBudget = budgetsList?.find((b) => b.id === budgetId);
  const canSubmit = ownedAssetId && budgetId && fiscalYear;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Push Budget to Asset
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push Budget to Operations Asset</DialogTitle>
            <DialogDescription>
              Write budget line items as performance targets for the selected owned asset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget-asset-select">Target Asset</Label>
              <Select value={ownedAssetId} onValueChange={setOwnedAssetId}>
                <SelectTrigger id="budget-asset-select">
                  <SelectValue placeholder="Select target asset" />
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

            <div className="space-y-2">
              <Label htmlFor="budget-select">Budget</Label>
              <Select value={budgetId} onValueChange={setBudgetId}>
                <SelectTrigger id="budget-select">
                  <SelectValue placeholder="Select a budget" />
                </SelectTrigger>
                <SelectContent>
                  {(budgetsList || []).map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.name || `Budget ${budget.fiscalYear}`} (FY{budget.fiscalYear})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscal-year">Fiscal Year</Label>
              <Input
                id="fiscal-year"
                type="number"
                min={2020}
                max={2040}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
              />
            </div>

            {selectedAsset && selectedBudget && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  Budget <strong>{selectedBudget.name || `Budget ${selectedBudget.fiscalYear}`}</strong>{" "}
                  will be pushed to asset <strong>{selectedAsset.name}</strong> for fiscal year{" "}
                  <strong>{fiscalYear}</strong>.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
            >
              Push Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Budget Push</AlertDialogTitle>
            <AlertDialogDescription>
              This will write budget targets to the asset performance snapshots for{" "}
              <strong>{selectedAsset?.name}</strong>. Existing targets for the same periods may be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pushMutation.mutate()}
              disabled={pushMutation.isPending}
            >
              {pushMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Push
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

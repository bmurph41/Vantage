import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowRight, Loader2, Minus } from "lucide-react";
import { ASSET_CLASS_LIST } from "@/components/AssetClassPicker";
import { ASSET_CLASS_TIERS, getAssetClassTier } from "@shared/billing-constants";

interface OrgEntitlements {
  assetClasses: string[];
  userRole: string | null;
  assetClassTier: string;
  assetClassTierName: string;
  assetClassCount: number;
  maxAssetClasses: number;
  priceMonthly: number;
  priceAnnual: number;
}

interface AssetClassImpact {
  [assetClass: string]: { deals: number; projects: number; total: number };
}

interface AssetClassDowngradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Keys to remove from the current set. */
  keysToRemove: string[];
}

export function AssetClassDowngradeModal({
  open,
  onOpenChange,
  keysToRemove,
}: AssetClassDowngradeModalProps) {
  const { toast } = useToast();

  const { data: entitlements, isLoading, isError } = useQuery<OrgEntitlements>({
    queryKey: ["/api/orgs/me/entitlements"],
    enabled: open,
  });

  const { data: impact } = useQuery<AssetClassImpact>({
    queryKey: ["/api/orgs/me/asset-class-impact", keysToRemove.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams({ classes: keysToRemove.join(",") });
      const res = await fetch(`/api/orgs/me/asset-class-impact?${params}`);
      if (!res.ok) throw new Error("Failed to load impact data");
      return res.json();
    },
    enabled: open && keysToRemove.length > 0,
  });

  const undoRemoval = useMutation({
    mutationFn: async (originalClasses: string[]) => {
      const res = await apiRequest("POST", "/api/onboarding/set-asset-classes", {
        assetClasses: originalClasses,
        userRole: entitlements?.userRole ?? undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orgs/me/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-settings/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orgs/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/modules"] });
      toast({ title: "Removal undone", description: "Your asset classes have been restored." });
    },
    onError: (e: Error) => {
      toast({ title: "Undo failed", description: e.message, variant: "destructive" });
    },
  });

  const confirmDowngrade = useMutation({
    mutationFn: async () => {
      if (!entitlements) throw new Error("Entitlements not loaded — please try again.");
      const remaining = entitlements.assetClasses.filter((k) => !keysToRemove.includes(k));
      const res = await apiRequest("POST", "/api/onboarding/set-asset-classes", {
        assetClasses: remaining,
        userRole: entitlements.userRole ?? undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orgs/me/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-settings/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orgs/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/modules"] });
      const originalClasses = entitlements?.assetClasses ?? [];
      const remaining = originalClasses.filter((k) => !keysToRemove.includes(k));
      const newTier = getAssetClassTier(remaining.length);
      const { dismiss } = toast({
        title: "Asset classes removed",
        description: `${remaining.length} asset class${remaining.length !== 1 ? "es" : ""} active — now on ${newTier.name} tier.`,
        action: (
          <ToastAction
            altText="Undo removal"
            onClick={() => {
              undoRemoval.mutate(originalClasses);
              dismiss();
            }}
          >
            Undo
          </ToastAction>
        ),
      });
      setTimeout(dismiss, 8000);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Removal failed", description: e.message, variant: "destructive" });
    },
  });

  const currentClasses = entitlements?.assetClasses ?? [];
  const remainingClasses = currentClasses.filter((k) => !keysToRemove.includes(k));
  const currentTier = entitlements ? getAssetClassTier(currentClasses.length) : null;
  const newTier = getAssetClassTier(remainingClasses.length);
  const tierChanged = currentTier?.key !== newTier.key;
  const priceSaving = (currentTier?.priceMonthly ?? 0) - newTier.priceMonthly;

  const labelFor = (key: string) =>
    ASSET_CLASS_LIST.find((a) => a.key === key)?.label ?? key.replace(/_/g, " ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5 text-destructive" />
            Remove asset classes
          </DialogTitle>
          <DialogDescription>
            Review which classes will be removed and confirm the change.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Warning banner */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">Removing these classes will hide related dashboards, analytics, and templates.</p>
                <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                  Your existing data is preserved and can be restored by re-adding the class later.
                </p>
              </div>
            </div>

            {/* Classes being removed */}
            <div>
              <p className="text-sm font-medium mb-2">
                Removing {keysToRemove.length} class{keysToRemove.length !== 1 ? "es" : ""}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {keysToRemove.map((key) => {
                  const entry = ASSET_CLASS_LIST.find((a) => a.key === key);
                  const classImpact = impact?.[key];
                  return (
                    <div key={key} className="flex items-center gap-1">
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 opacity-60 line-through"
                        style={entry ? { borderLeft: `3px solid ${entry.color}` } : {}}
                      >
                        {entry?.icon} {labelFor(key)}
                      </Badge>
                      {classImpact && classImpact.total > 0 && (
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                          {classImpact.total} active {classImpact.total === 1 ? "deal/project" : "deals/projects"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {remainingClasses.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Remaining ({remainingClasses.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {remainingClasses.map((key) => {
                    const entry = ASSET_CLASS_LIST.find((a) => a.key === key);
                    return (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="flex items-center gap-1"
                        style={entry ? { borderLeft: `3px solid ${entry.color}` } : {}}
                      >
                        {entry?.icon} {labelFor(key)}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {remainingClasses.length === 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                You are removing all asset classes. Your account will have no class specializations active.
              </div>
            )}

            <Separator />

            {/* Tier transition */}
            <div>
              <p className="text-sm font-medium mb-3">Tier change:</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="font-semibold">{currentTier?.name ?? entitlements?.assetClassTierName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentClasses.length} class{currentClasses.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-xs font-medium mt-1">
                    {(currentTier?.priceMonthly ?? 0) === 0 ? "Included" : `+$${currentTier?.priceMonthly}/mo`}
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                <div className={`flex-1 rounded-lg border p-3 text-center ${tierChanged ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="font-semibold">{newTier.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {remainingClasses.length} class{remainingClasses.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-xs font-medium mt-1">
                    {newTier.priceMonthly === 0 ? "Included" : `+$${newTier.priceMonthly}/mo`}
                  </p>
                </div>
              </div>

              {tierChanged && priceSaving > 0 && (
                <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-300">
                    Save ${priceSaving}/mo (billed on next cycle)
                  </p>
                  <p className="text-green-700 dark:text-green-400 text-xs mt-0.5">
                    The credit will be applied to your next invoice automatically.
                  </p>
                </div>
              )}

              {!tierChanged && (
                <p className="text-sm text-muted-foreground mt-2">
                  No tier change — you will remain on the {currentTier?.name} tier.
                </p>
              )}
            </div>

            {/* Tier comparison mini-grid */}
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">All tiers</p>
              <div className="grid grid-cols-3 gap-2">
                {ASSET_CLASS_TIERS.map((t) => {
                  const isNew = t.key === newTier.key;
                  return (
                    <div
                      key={t.key}
                      className={`rounded-md border p-2 text-center text-xs ${isNew ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "opacity-60"}`}
                    >
                      {isNew && <p className="text-amber-700 dark:text-amber-400 font-semibold text-xs mb-0.5">New tier</p>}
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground">{t.minClasses}–{t.maxClasses ?? "∞"} classes</p>
                      <p className="font-medium mt-0.5">
                        {t.priceMonthly === 0 ? "Included" : `+$${t.priceMonthly}/mo`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmDowngrade.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => confirmDowngrade.mutate()}
            disabled={confirmDowngrade.isPending || isLoading || isError || !entitlements || keysToRemove.length === 0}
          >
            {confirmDowngrade.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removing…
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 mr-2" />
                Confirm removal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

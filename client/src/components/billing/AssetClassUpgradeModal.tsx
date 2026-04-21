import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { ArrowRight, Layers, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { ASSET_CLASS_LIST } from "@/components/AssetClassPicker";
import { ASSET_CLASS_TIERS } from "@shared/billing-constants";
import { getAssetClassTier } from "@shared/billing-constants";

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

interface AssetClassUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Additional (new) asset class keys the user wants to add. */
  pendingKeys: string[];
}

export function AssetClassUpgradeModal({
  open,
  onOpenChange,
  pendingKeys,
}: AssetClassUpgradeModalProps) {
  const { toast } = useToast();

  const { data: entitlements, isLoading, isError } = useQuery<OrgEntitlements>({
    queryKey: ["/api/orgs/me/entitlements"],
    enabled: open,
  });

  const confirmUpgrade = useMutation({
    mutationFn: async () => {
      if (!entitlements) throw new Error("Entitlements not loaded — please try again.");
      const currentClasses = entitlements.assetClasses;
      const merged = Array.from(new Set([...currentClasses, ...pendingKeys]));
      const res = await apiRequest("POST", "/api/onboarding/set-asset-classes", {
        assetClasses: merged,
        userRole: entitlements.userRole ?? undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orgs/me/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-settings/entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orgs/me"] });
      toast({
        title: `Upgraded to ${newTier.name}`,
        description: `${mergedClasses.length} asset class${mergedClasses.length !== 1 ? "es" : ""} are now active on your account.`,
      });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Upgrade failed", description: e.message, variant: "destructive" });
    },
  });

  const currentClasses = entitlements?.assetClasses ?? [];
  const mergedClasses = Array.from(new Set([...currentClasses, ...pendingKeys]));
  const currentTier = entitlements ? getAssetClassTier(currentClasses.length) : null;
  const newTier = getAssetClassTier(mergedClasses.length);
  const tierChanged = currentTier?.key !== newTier.key;

  const priceDelta = newTier.priceMonthly - (currentTier?.priceMonthly ?? 0);

  const labelFor = (key: string) =>
    ASSET_CLASS_LIST.find((a) => a.key === key)?.label ?? key.replace(/_/g, " ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Unlock more asset classes
          </DialogTitle>
          <DialogDescription>
            Review your asset class changes and confirm the upgrade.
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
            {/* Classes being added */}
            <div>
              <p className="text-sm font-medium mb-2">Adding {pendingKeys.length} class{pendingKeys.length !== 1 ? "es" : ""}:</p>
              <div className="flex flex-wrap gap-1.5">
                {pendingKeys.map((key) => {
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

                <div className={`flex-1 rounded-lg border p-3 text-center ${tierChanged ? "border-primary bg-primary/5 shadow-sm" : ""}`}>
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="font-semibold">{newTier.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mergedClasses.length} class{mergedClasses.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-xs font-medium mt-1">
                    {newTier.priceMonthly === 0 ? "Included" : `+$${newTier.priceMonthly}/mo`}
                  </p>
                </div>
              </div>

              {tierChanged && priceDelta > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    +${priceDelta}/mo add-on ({`$${newTier.priceAnnual}/mo`} billed annually)
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                    Billed on your next billing cycle. Payment is handled through your existing billing method.
                  </p>
                </div>
              )}

              {!tierChanged && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  No tier change — still within your current {currentTier?.name} tier.
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
                      className={`rounded-md border p-2 text-center text-xs ${isNew ? "border-primary bg-primary/5" : "opacity-60"}`}
                    >
                      {isNew && <p className="text-primary font-semibold text-xs mb-0.5">Selected</p>}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmUpgrade.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => confirmUpgrade.mutate()}
            disabled={confirmUpgrade.isPending || isLoading || isError || !entitlements || pendingKeys.length === 0}
          >
            {confirmUpgrade.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Confirm upgrade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

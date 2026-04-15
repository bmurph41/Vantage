import { useQuery } from "@tanstack/react-query";
import { Lock, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface TierDefinition {
  name: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  features: string[];
  limits: Record<string, number>;
}

interface SubscriptionResponse {
  subscription: {
    tier: string;
    status: string;
    currentPeriodEnd?: string;
    trialEnd?: string;
  } | null;
}

const TIER_ORDER = ["starter", "growth", "institutional", "enterprise"];

function findRequiredTier(
  plans: Record<string, TierDefinition>,
  feature: string
): { tier: string; tierDef: TierDefinition } | null {
  for (const tierKey of TIER_ORDER) {
    const t = plans[tierKey];
    if (!t) continue;
    if (t.features.includes(feature) || t.features.includes("everything")) {
      return { tier: tierKey, tierDef: t };
    }
  }
  return null;
}

interface BillingGateProps {
  feature: string;
  children: React.ReactNode;
  title?: string;
  description?: string;
  showBlurredPreview?: boolean;
}

export function BillingGate({
  feature,
  children,
  title,
  description,
  showBlurredPreview = true,
}: BillingGateProps) {
  const { data: subData, isLoading: subLoading } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Record<string, TierDefinition>>({
    queryKey: ["/api/billing/plans"],
  });

  if (subLoading || plansLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  const currentTier = subData?.subscription?.tier;
  const currentStatus = subData?.subscription?.status;

  const isActive =
    currentStatus === "active" || currentStatus === "trialing";

  let hasAccess = false;
  if (currentTier && plans && isActive) {
    const tierDef = plans[currentTier];
    if (tierDef) {
      hasAccess =
        tierDef.features.includes(feature) ||
        tierDef.features.includes("everything");
    }
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  const requiredInfo = plans ? findRequiredTier(plans, feature) : null;

  return (
    <div className="relative min-h-[300px]">
      {showBlurredPreview && (
        <div className="blur-sm pointer-events-none select-none opacity-40 overflow-hidden max-h-[400px]">
          {children}
        </div>
      )}
      <div
        className={
          showBlurredPreview
            ? "absolute inset-0 flex items-center justify-center"
            : "flex items-center justify-center min-h-[300px]"
        }
      >
        <Card className="max-w-md w-full shadow-lg border-2 border-primary/20">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>

            <h2 className="text-xl font-semibold mb-2">
              {title ?? "Upgrade to Access This Feature"}
            </h2>

            <p className="text-muted-foreground text-sm mb-5">
              {description ??
                "This feature isn't included in your current plan."}
            </p>

            {requiredInfo && (
              <div className="bg-muted/50 rounded-lg p-4 mb-5 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {requiredInfo.tierDef.name} Plan
                  </span>
                  <Badge variant="secondary">Required</Badge>
                </div>
                {requiredInfo.tierDef.priceMonthly != null && (
                  <p className="text-sm text-muted-foreground">
                    From ${requiredInfo.tierDef.priceMonthly}/mo
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/settings/billing?upgrade=true&feature=${feature}`}>
                <Button className="w-full sm:w-auto gap-2">
                  <Zap className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              </Link>
              <Link href="/settings/billing">
                <Button variant="outline" className="w-full sm:w-auto gap-2">
                  View Plans
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface BillingGateInlineProps {
  feature: string;
  children: React.ReactNode;
}

export function BillingGateInline({ feature, children }: BillingGateInlineProps) {
  return (
    <BillingGate feature={feature} showBlurredPreview={false}>
      {children}
    </BillingGate>
  );
}

import { useEffect, useState, useRef } from "react";
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
import { AssetClassPicker } from "@/components/AssetClassPicker";
import { AssetClassUpgradeModal } from "@/components/billing/AssetClassUpgradeModal";
import { AssetClassDowngradeModal } from "@/components/billing/AssetClassDowngradeModal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import {
  CreditCard,
  Package,
  ExternalLink,
  Check,
  Zap,
  Download,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Users,
  FileText,
  Database,
  ChevronUp,
  ChevronDown,
  Layers,
  Home,
  Tag,
  ArrowRight,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { ASSET_CLASS_TIERS } from "@shared/billing-constants";
import { cn } from "@/lib/utils";

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

interface TierDef {
  name: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  features: string[];
  limits: {
    deals: number;
    seats: number;
    storageGb: number;
    aiQueries: number;
    lpInvestors?: number;
  };
}

interface BillingSubscription {
  id: string;
  orgId: string;
  tier: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId: string | null;
  seatLimit: number | null;
  dealLimit: number | null;
  aiQueryLimit: number | null;
}

interface UsageData {
  deals: number;
  models: number;
  users: number;
  aiQueries?: number;
}

interface BillingInvoice {
  id: string;
  stripeInvoiceId: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  invoiceUrl: string | null;
  pdfUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
}

const TIER_ORDER = ["starter", "growth", "institutional"];

const TIER_FEATURE_LABELS: Record<string, string[]> = {
  starter: [
    "Deal workspace",
    "Basic CRM",
    "Financial modeling",
    "Document vault",
    "DD checklist",
    "Basic reporting",
  ],
  growth: [
    "Everything in Starter",
    "LP Portal & capital calls",
    "Workflow automation",
    "Gantt view",
    "AI narratives",
    "Email & SMS alerts",
    "Lease abstractor",
  ],
  institutional: [
    "Everything in Growth",
    "Portfolio dashboard",
    "Benchmark engine",
    "AI underwriting",
    "Document intelligence",
    "Fund accounting",
    "SSO & audit trail",
    "White label & API access",
  ],
};

function formatCurrency(cents: number | null, currency = "usd") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function statusColor(status: string | null): BadgeVariant {
  if (!status) return "secondary";
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  if (status === "paid") return "default";
  if (status === "past_due" || status === "failed") return "destructive";
  if (status === "canceled" || status === "cancelled") return "destructive";
  return "secondary";
}

function UsageBar({
  label,
  icon: Icon,
  used,
  limit,
}: {
  label: string;
  icon: React.ElementType;
  used: number;
  limit: number | null;
}) {
  const unlimited = limit === null || limit === -1;
  const pct = unlimited || limit === 0 ? 0 : Math.min((used / limit) * 100, 100);
  const warning = pct >= 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </div>
        <span className="text-sm text-muted-foreground">
          {unlimited ? `${used} / Unlimited` : `${used} / ${limit}`}
        </span>
      </div>
      <Progress
        value={unlimited ? 0 : pct}
        className={warning ? "accent-destructive" : ""}
      />
      {warning && !unlimited && (
        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {Math.round(pct)}% used — consider upgrading
        </p>
      )}
    </div>
  );
}

function formatLimitValue(v: number): string {
  return v === -1 ? "Unlimited" : v.toLocaleString();
}

const PLAN_FEATURE_LABELS: Record<string, string> = {
  deal_workspace: "Deal workspace",
  crm_basic: "Basic CRM",
  financial_model: "Financial modeling",
  document_vault: "Document vault",
  dd_checklist: "DD checklist",
  basic_reporting: "Basic reporting",
  lp_portal: "LP Portal",
  capital_calls: "Capital calls",
  distributions: "Distributions",
  workflow_automation: "Workflow automation",
  gantt_view: "Gantt view",
  ai_narratives: "AI narratives",
  lease_abstractor: "Lease abstractor",
  email_integration: "Email integration",
  sms_alerts: "SMS alerts",
  vendor_management: "Vendor management",
  work_orders: "Work orders",
  portfolio_dashboard: "Portfolio dashboard",
  benchmark_engine: "Benchmark engine",
  stress_testing: "Stress testing",
  fund_accounting: "Fund accounting",
  kyc_aml: "KYC / AML compliance",
  capital_account_ledger: "Capital account ledger",
  construction_module: "Construction module",
  custom_report_builder: "Custom report builder",
  performance_attribution: "Performance attribution",
  ai_underwriting: "AI underwriting",
  document_intelligence: "Document intelligence",
  sso: "SSO",
  audit_trail: "Audit trail",
  white_label: "White label",
  api_access: "API access",
  custom_deal_stages: "Custom deal stages",
  waterfall_engine: "Waterfall engine",
  everything: "All features",
};

interface LimitDiff {
  label: string;
  current: number;
  pending: number;
}

function PlanChangeDiff({
  currentTierKey,
  pendingTierKey,
  planFeatureMap,
}: {
  currentTierKey: string | undefined;
  pendingTierKey: string;
  planFeatureMap: Record<string, TierDef>;
}) {
  const currentTierDef = currentTierKey ? planFeatureMap[currentTierKey] : undefined;
  const pendingTierDef = planFeatureMap[pendingTierKey];

  if (!currentTierDef || !pendingTierDef) return null;

  const currentFeatures: string[] = currentTierDef.features ?? [];
  const pendingFeatures: string[] = pendingTierDef.features ?? [];

  const isDowngrade =
    TIER_ORDER.indexOf(pendingTierKey) < TIER_ORDER.indexOf(currentTierKey ?? "");

  const featuresLost = isDowngrade
    ? currentFeatures.filter((f) => !pendingFeatures.includes(f))
    : [];
  const featuresGained = !isDowngrade
    ? pendingFeatures.filter((f) => !currentFeatures.includes(f))
    : [];

  const labelFor = (key: string) =>
    PLAN_FEATURE_LABELS[key] ?? key.replace(/_/g, " ");

  const limitDiffs: LimitDiff[] = [];
  const maybeDiff = (label: string, cur: number | undefined, pend: number | undefined) => {
    if (cur !== undefined && pend !== undefined && cur !== pend) {
      limitDiffs.push({ label, current: cur, pending: pend });
    }
  };
  maybeDiff("Deals", currentTierDef.limits.deals, pendingTierDef.limits.deals);
  maybeDiff("Seats", currentTierDef.limits.seats, pendingTierDef.limits.seats);
  maybeDiff("Storage (GB)", currentTierDef.limits.storageGb, pendingTierDef.limits.storageGb);
  maybeDiff("AI Queries", currentTierDef.limits.aiQueries, pendingTierDef.limits.aiQueries);
  if (
    currentTierDef.limits.lpInvestors !== undefined &&
    pendingTierDef.limits.lpInvestors !== undefined
  ) {
    maybeDiff("LP Investors", currentTierDef.limits.lpInvestors, pendingTierDef.limits.lpInvestors);
  }

  if (featuresLost.length === 0 && featuresGained.length === 0 && limitDiffs.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 text-sm border rounded-lg p-3 bg-muted/30">
      {featuresLost.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1.5">
            Features you'll lose
          </p>
          <ul className="space-y-1">
            {featuresLost.map((f) => (
              <li key={f} className="flex items-center gap-2 text-muted-foreground">
                <X className="h-3 w-3 text-destructive flex-shrink-0" />
                <span className="line-through">{labelFor(f)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {featuresGained.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-1.5">
            Features you'll gain
          </p>
          <ul className="space-y-1">
            {featuresGained.map((f) => (
              <li key={f} className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="h-3 w-3 flex-shrink-0" />
                {labelFor(f)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {limitDiffs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Limit changes
          </p>
          <div className="space-y-1.5">
            {limitDiffs.map(({ label, current, pending }) => {
              const isReduction =
                pending !== -1 && (current === -1 || pending < current);
              return (
                <div key={label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="text-muted-foreground">{formatLimitValue(current)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={isReduction ? "text-destructive" : "text-green-600 dark:text-green-400"}>
                      {formatLimitValue(pending)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingSettingsPage() {
  const { toast } = useToast();
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  const previousPlanTier = useRef<string | undefined>(undefined);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showAddClassesDialog, setShowAddClassesDialog] = useState(false);
  const [pendingAddClasses, setPendingAddClasses] = useState<string[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRemoveClassesDialog, setShowRemoveClassesDialog] = useState(false);
  const [selectedAfterRemoval, setSelectedAfterRemoval] = useState<string[]>([]);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  const {
    data: subData,
    isLoading: subLoading,
  } = useQuery<{ subscription: BillingSubscription | null; usage: UsageData }>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: entitlements, isLoading: entitlementsLoading } = useQuery<OrgEntitlements>({
    queryKey: ["/api/orgs/me/entitlements"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Record<string, TierDef>>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<BillingInvoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  const { data: appConfig } = useQuery<any>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000,
  });
  const stripeConfigured = appConfig?.stripeConfigured ?? false;

  const openPortal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {
        returnUrl: window.location.href,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({
        title: "Portal unavailable",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const isUndoPlanMutation = useRef(false);

  const changePlan = useMutation({
    mutationFn: async (newTier: string) => {
      const res = await apiRequest("POST", "/api/billing/change-plan", { newTier });
      return res.json();
    },
    onSuccess: (_data, newTier: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/plans"] });
      setShowChangePlanDialog(false);

      const wasUndo = isUndoPlanMutation.current;
      isUndoPlanMutation.current = false;

      const prev = previousPlanTier.current;
      const isDowngrade = !wasUndo && prev !== undefined && getTierIndex(newTier) < getTierIndex(prev);

      if (isDowngrade && prev) {
        const restoredTier = prev;
        const autoCloseTimeout = { current: null as ReturnType<typeof setTimeout> | null };
        const { dismiss } = toast({
          title: "Plan downgraded",
          description: `You have switched to the ${planFeatureMap[newTier]?.name ?? newTier} plan.`,
          action: (
            <ToastAction
              altText="Undo downgrade"
              onClick={() => {
                if (autoCloseTimeout.current) {
                  clearTimeout(autoCloseTimeout.current);
                  autoCloseTimeout.current = null;
                }
                isUndoPlanMutation.current = true;
                previousPlanTier.current = newTier;
                changePlan.mutate(restoredTier);
                dismiss();
              }}
            >
              Undo
            </ToastAction>
          ),
          // use-toast.ts calls dismiss() before this fires, so only cancel the timer.
          onOpenChange: (open) => {
            if (!open && autoCloseTimeout.current) {
              clearTimeout(autoCloseTimeout.current);
              autoCloseTimeout.current = null;
            }
          },
        });
        autoCloseTimeout.current = setTimeout(dismiss, 8000);
      } else {
        toast({
          title: wasUndo ? "Plan restored" : "Plan updated",
          description: wasUndo
            ? `You have been restored to the ${planFeatureMap[newTier]?.name ?? newTier} plan.`
            : "Your subscription has been updated.",
        });
      }
      setPendingTier(null);
    },
    onError: (err: Error) => {
      isUndoPlanMutation.current = false;
      toast({ title: "Plan change failed", description: err.message, variant: "destructive" });
    },
  });

  const checkout = useMutation({
    mutationFn: async ({ tier, billingCycle }: { tier: string; billingCycle: string }) => {
      const res = await apiRequest("POST", "/api/billing/checkout", {
        tier,
        billingCycle,
      });
      return res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Subscription created", description: "Your plan is now active." });
        queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get("success");
  const canceled = urlParams.get("canceled");
  const highlightFeature = urlParams.get("feature");
  const showUpgrade = urlParams.get("upgrade") === "true";

  useEffect(() => {
    if (success === "true") {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    }
  }, [success]);

  const sub = subData?.subscription;
  const usage = subData?.usage;
  const currentTier = sub?.tier;

  function getTierIndex(tier: string | undefined) {
    if (!tier) return -1;
    return TIER_ORDER.indexOf(tier);
  }

  function handlePlanAction(tier: string) {
    if (!sub) {
      checkout.mutate({ tier, billingCycle: "monthly" });
      return;
    }
    setPendingTier(tier);
    setShowChangePlanDialog(true);
  }

  const planFeatureMap = plans ?? {};

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your plan, payment method, invoices, and usage
        </p>
      </div>

      {success === "true" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="pt-5 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">
                Payment successful!
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">
                Your subscription is now active. Features are available immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {canceled === "true" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-5 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-amber-800 dark:text-amber-300">
              Checkout was canceled. You can try again anytime below.
            </p>
          </CardContent>
        </Card>
      )}

      {showUpgrade && highlightFeature && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm">
              The feature{" "}
              <span className="font-mono bg-muted px-1 rounded text-xs">
                {highlightFeature}
              </span>{" "}
              requires a higher plan. Upgrade below to unlock it.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Current Plan Card ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : sub ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xl font-bold capitalize">
                      {planFeatureMap[sub.tier]?.name ?? sub.tier}
                    </p>
                    <Badge variant={statusColor(sub.status)}>
                      {sub.status}
                    </Badge>
                    {sub.billingCycle && (
                      <Badge variant="outline" className="capitalize">
                        {sub.billingCycle}
                      </Badge>
                    )}
                  </div>
                  {sub.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
                      {formatDate(sub.currentPeriodEnd)}
                    </p>
                  )}
                  {sub.trialEnd && sub.status === "trialing" && (
                    <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Trial ends {formatDate(sub.trialEnd)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {stripeConfigured && sub.stripeCustomerId && (
                    <Button
                      variant="outline"
                      onClick={() => openPortal.mutate()}
                      disabled={openPortal.isPending}
                      size="sm"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Subscription
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>

              {usage && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
                      Usage
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <UsageBar
                        label="Deals"
                        icon={FileText}
                        used={usage.deals ?? 0}
                        limit={sub.dealLimit}
                      />
                      <UsageBar
                        label="Team Members"
                        icon={Users}
                        used={usage.users ?? 0}
                        limit={sub.seatLimit}
                      />
                      <UsageBar
                        label="AI Queries"
                        icon={Zap}
                        used={usage.aiQueries ?? 0}
                        limit={sub.aiQueryLimit}
                      />
                      <UsageBar
                        label="Storage"
                        icon={Database}
                        used={0}
                        limit={null}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-1">No active subscription</p>
              <p className="text-sm text-muted-foreground">
                Choose a plan below to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Asset Class Tier Card ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Asset Class Tier
          </CardTitle>
          <CardDescription>
            Your subscription includes access to the asset classes your organization selected during setup.
            Add more to unlock deeper tools and templates for each class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entitlementsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : entitlements ? (
            <div className="space-y-4">
              {/* Tier + count summary */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xl font-bold">
                      {entitlements.assetClassTierName}
                    </p>
                    <Badge variant="secondary">
                      {entitlements.assetClassCount} {entitlements.assetClassCount === 1 ? "class" : "classes"}
                    </Badge>
                    {entitlements.userRole && (
                      <Badge variant="outline" className="capitalize flex items-center gap-1">
                        {entitlements.userRole === "owner" && <Home className="h-3 w-3" />}
                        {entitlements.userRole === "broker" && <Tag className="h-3 w-3" />}
                        {entitlements.userRole === "investor" && <TrendingUp className="h-3 w-3" />}
                        {entitlements.userRole}
                      </Badge>
                    )}
                  </div>
                  {entitlements.assetClasses.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {entitlements.assetClasses.join(", ").replace(/_/g, " ")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No asset classes selected yet.</p>
                  )}
                  {entitlements.priceMonthly > 0 && (
                    <p className="text-sm font-medium mt-1">
                      +${entitlements.priceMonthly}/mo <span className="text-muted-foreground font-normal">(${entitlements.priceAnnual}/mo billed annually)</span>
                    </p>
                  )}
                  {entitlements.priceMonthly === 0 && entitlements.assetClassCount > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-1">Included in your subscription</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => {
                      setPendingAddClasses([]);
                      setShowAddClassesDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add asset classes
                  </Button>
                  {entitlements.assetClasses.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAfterRemoval(entitlements.assetClasses);
                        setShowRemoveClassesDialog(true);
                      }}
                    >
                      <Minus className="h-4 w-4 mr-2" />
                      Remove classes
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/onboarding"}
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Manage
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Tier progression bar */}
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Asset Class Tiers</p>
                <div className="grid grid-cols-3 gap-3">
                  {ASSET_CLASS_TIERS.map((t) => {
                    const isCurrent = t.key === entitlements.assetClassTier;
                    return (
                      <div
                        key={t.key}
                        className={cn(
                          "rounded-lg border p-3 text-center transition-all",
                          isCurrent ? "border-primary bg-primary/5 shadow-sm" : "border-border opacity-60"
                        )}
                      >
                        {isCurrent && (
                          <div className="text-xs font-semibold text-primary mb-1">Current</div>
                        )}
                        <p className="text-sm font-bold">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.minClasses}–{t.maxClasses ?? "∞"} classes</p>
                        <p className="text-xs font-medium mt-1">
                          {t.priceMonthly === 0 ? "Included" : `+$${t.priceMonthly}/mo`}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Upgrade to add more asset classes and unlock specialized tools, dashboards, and templates for each class.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-1">No asset classes configured</p>
              <p className="text-sm text-muted-foreground mb-3">
                Select your asset classes during onboarding to tailor your platform experience.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/onboarding"}>
                Configure asset classes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Add Asset Classes Dialog ─── */}
      <Dialog
        open={showAddClassesDialog}
        onOpenChange={(v) => {
          setShowAddClassesDialog(v);
          if (!v) setPendingAddClasses([]);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Asset Classes
            </DialogTitle>
            <DialogDescription>
              Your current classes are shown pre-selected and locked. Select additional classes to add.
              {entitlements && entitlements.assetClassCount > 0 && (
                <span className="block mt-1 text-xs">
                  Currently: {entitlements.assetClasses.map((k) => k.replace(/_/g, " ")).join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <AssetClassPicker
              selected={[...(entitlements?.assetClasses ?? []), ...pendingAddClasses]}
              onChange={(keys) => {
                const existing = entitlements?.assetClasses ?? [];
                const newlySelected = keys.filter((k) => !existing.includes(k));
                setPendingAddClasses(newlySelected);
              }}
              disabledKeys={entitlements?.assetClasses ?? []}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddClassesDialog(false);
                setPendingAddClasses([]);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={pendingAddClasses.length === 0}
              onClick={() => {
                setShowAddClassesDialog(false);
                setShowUpgradeModal(true);
              }}
            >
              Review upgrade ({pendingAddClasses.length} new)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Asset Class Upgrade Modal ─── */}
      <AssetClassUpgradeModal
        open={showUpgradeModal}
        onOpenChange={(v) => {
          setShowUpgradeModal(v);
          if (!v) setPendingAddClasses([]);
        }}
        pendingKeys={pendingAddClasses}
      />

      {/* ─── Remove Asset Classes Dialog ─── */}
      <Dialog
        open={showRemoveClassesDialog}
        onOpenChange={(v) => {
          setShowRemoveClassesDialog(v);
          if (!v) setSelectedAfterRemoval(entitlements?.assetClasses ?? []);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5" />
              Remove Asset Classes
            </DialogTitle>
            <DialogDescription>
              Deselect the classes you want to remove. Your remaining selection will stay active.
              {entitlements && entitlements.assetClassCount > 0 && (
                <span className="block mt-1 text-xs">
                  Currently active: {entitlements.assetClasses.map((k) => k.replace(/_/g, " ")).join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <AssetClassPicker
              selected={selectedAfterRemoval}
              onChange={setSelectedAfterRemoval}
              allowedKeys={entitlements?.assetClasses}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveClassesDialog(false);
                setSelectedAfterRemoval(entitlements?.assetClasses ?? []);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                selectedAfterRemoval.length === (entitlements?.assetClasses ?? []).length
              }
              onClick={() => {
                setShowRemoveClassesDialog(false);
                setShowDowngradeModal(true);
              }}
            >
              Review removal (
              {(entitlements?.assetClasses ?? []).filter((k) => !selectedAfterRemoval.includes(k)).length} to remove)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Asset Class Downgrade Modal ─── */}
      <AssetClassDowngradeModal
        open={showDowngradeModal}
        onOpenChange={(v) => {
          setShowDowngradeModal(v);
          if (!v) setSelectedAfterRemoval(entitlements?.assetClasses ?? []);
        }}
        keysToRemove={(entitlements?.assetClasses ?? []).filter((k) => !selectedAfterRemoval.includes(k))}
      />

      {/* ─── Plan Comparison / Upgrade-Downgrade ─── */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Available Plans
        </h2>
        {plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TIER_ORDER.map((tierKey) => {
              const tier = planFeatureMap[tierKey];
              if (!tier) return null;
              const isCurrent = currentTier === tierKey;
              const currentIdx = getTierIndex(currentTier);
              const tierIdx = getTierIndex(tierKey);
              const isUpgrade = currentIdx !== -1 && tierIdx > currentIdx;
              const isDowngrade = currentIdx !== -1 && tierIdx < currentIdx;

              return (
                <Card
                  key={tierKey}
                  className={
                    isCurrent
                      ? "border-2 border-primary shadow-sm"
                      : "border"
                  }
                >
                  {isCurrent && (
                    <div className="bg-primary text-primary-foreground text-xs text-center py-1 rounded-t-lg font-medium">
                      Current Plan
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      {tierKey === "growth" && (
                        <Badge variant="secondary">Popular</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {tier.priceMonthly != null ? (
                        <>
                          <span className="text-2xl font-bold text-foreground">
                            ${tier.priceMonthly}
                          </span>
                          <span className="text-muted-foreground">/mo</span>
                          {tier.priceAnnual && (
                            <span className="text-xs text-muted-foreground block">
                              ${tier.priceAnnual}/mo billed annually
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-lg font-semibold">
                          Custom pricing
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1.5">
                      {(TIER_FEATURE_LABELS[tierKey] ?? tier.features.slice(0, 7)).map(
                        (f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        )
                      )}
                    </ul>

                    <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-3">
                      <p>
                        Deals:{" "}
                        {tier.limits.deals === -1 ? "Unlimited" : tier.limits.deals}
                      </p>
                      <p>
                        Seats:{" "}
                        {tier.limits.seats === -1 ? "Unlimited" : tier.limits.seats}
                      </p>
                    </div>

                    {!isCurrent && (
                      <Button
                        className="w-full"
                        variant={isUpgrade ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePlanAction(tierKey)}
                        disabled={
                          changePlan.isPending ||
                          checkout.isPending
                        }
                      >
                        {isUpgrade ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Upgrade to {tier.name}
                          </>
                        ) : isDowngrade ? (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Downgrade to {tier.name}
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-1" />
                            Select {tier.name}
                          </>
                        )}
                      </Button>
                    )}
                    {isCurrent && (
                      <Button className="w-full" variant="outline" size="sm" disabled>
                        <Check className="h-4 w-4 mr-1" />
                        Active Plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Invoice History ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>
            Download receipts and review past charges
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No invoices yet</p>
              <p className="text-xs mt-1">
                Invoices appear here once you have an active paid subscription.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Date</th>
                    <th className="text-left py-2 pr-4 font-medium">Period</th>
                    <th className="text-left py-2 pr-4 font-medium">Amount</th>
                    <th className="text-left py-2 pr-4 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-2.5 pr-4">
                        {formatDate(inv.paidAt ?? inv.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {inv.periodStart && inv.periodEnd
                          ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {formatCurrency(inv.amount, inv.currency ?? "usd")}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={statusColor(inv.status)}
                          className="capitalize"
                        >
                          {inv.status ?? "—"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost" className="h-7 gap-1">
                              <Download className="h-3.5 w-3.5" />
                              PDF
                            </Button>
                          </a>
                        ) : inv.invoiceUrl ? (
                          <a
                            href={inv.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost" className="h-7 gap-1">
                              <ExternalLink className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Change Plan Confirmation Dialog ─── */}
      <AlertDialog
        open={showChangePlanDialog}
        onOpenChange={setShowChangePlanDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingTier && getTierIndex(pendingTier) > getTierIndex(currentTier)
                ? "Upgrade Plan"
                : "Downgrade Plan"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {pendingTier && (
                  <>
                    You are about to switch from{" "}
                    <strong className="capitalize">
                      {planFeatureMap[currentTier ?? ""]?.name ?? currentTier ?? "your current plan"}
                    </strong>{" "}
                    to{" "}
                    <strong className="capitalize">
                      {planFeatureMap[pendingTier]?.name ?? pendingTier}
                    </strong>
                    .
                    <PlanChangeDiff
                      currentTierKey={currentTier}
                      pendingTierKey={pendingTier}
                      planFeatureMap={planFeatureMap}
                    />
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowChangePlanDialog(false);
                setPendingTier(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTier) {
                  previousPlanTier.current = currentTier;
                  changePlan.mutate(pendingTier);
                }
              }}
              disabled={changePlan.isPending}
            >
              {changePlan.isPending ? "Updating…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

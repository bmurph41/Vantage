import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Sparkles, Lock, CreditCard, ArrowLeft, Shield, TrendingUp, Handshake, Building2, Crown, Compass } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeStatus } from "@/hooks/useStripeStatus";
import { formatCurrency } from "@/lib/utils";
import { ProvisioningAnimation } from "@/components/subscription/ProvisioningAnimation";
import { useSidebarHighlight } from "@/contexts/SidebarHighlightContext";
import { getNewlyUnlockedSectionIds } from "@/lib/tierSectionMap";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// TIER DEFINITIONS (mirrors server-side SUBSCRIPTION_TIERS)
// ═══════════════════════════════════════════════════════════════

interface TierDef {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number; // per-year total
  icon: typeof TrendingUp;
  accentClass: string;      // tailwind color class prefix
  accentBg: string;         // bg for icon circle
  accentText: string;       // text color for accent elements
  accentBorder: string;     // border color
  packs: string[];
  features: string[];
  popular?: boolean;
  recommended?: boolean;
}

const TIERS: TierDef[] = [
  {
    slug: 'starter',
    name: 'Explorer',
    tagline: 'Look around',
    description: 'Get oriented with market news, sample analytics, and a taste of what Vantage can do.',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    icon: Compass,
    accentClass: 'slate',
    accentBg: 'bg-slate-100 dark:bg-slate-800',
    accentText: 'text-slate-600 dark:text-slate-300',
    accentBorder: 'border-slate-200 dark:border-slate-700',
    packs: [],
    features: ['Dashboard', 'The Docket', 'Marketplace (browse)', '3 sample comps', 'Demographics preview'],
  },
  {
    slug: 'investor',
    name: 'Analyst',
    tagline: 'Underwrite with confidence',
    description: 'Institutional-grade modeling, comps, and market data to evaluate any deal.',
    monthlyPriceCents: 8900,
    annualPriceCents: 89000, // $890/yr = $74.17/mo effective (save $178)
    icon: TrendingUp,
    accentClass: 'emerald',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBorder: 'border-emerald-200 dark:border-emerald-800',
    packs: ['modeling_tools', 'analysis', 'investor'],
    features: ['Unlimited deal workspaces', 'Pro Forma, DCF & Monte Carlo', 'Exit Strategy Suite', 'Sales & Rate Comps (full)', 'Demographics & Capital Markets', 'Secure Data Room'],
  },
  {
    slug: 'broker',
    name: 'Broker',
    tagline: 'Close more deals',
    description: 'Win listings and manage your pipeline with CRM, prospecting, and marketing tools.',
    monthlyPriceCents: 17900,
    annualPriceCents: 179000, // $1,790/yr = $149.17/mo effective (save $358)
    icon: Handshake,
    accentClass: 'blue',
    accentBg: 'bg-blue-50 dark:bg-blue-950/40',
    accentText: 'text-blue-600 dark:text-blue-400',
    accentBorder: 'border-blue-200 dark:border-blue-800',
    packs: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'investor', 'broker'],
    features: ['Everything in Analyst', 'Full CRM — contacts, companies, properties', 'Deal Pipeline & Kanban board', 'Tasks, Follow-ups & Forecasting', 'Prospecting & Marketing suite', 'OM Builder & Due Diligence'],
    popular: true,
  },
  {
    slug: 'owner-operator',
    name: 'Owner',
    tagline: 'Run your assets',
    description: 'End-to-end asset management — deals, tenants, operations, and financials.',
    monthlyPriceCents: 26900,
    annualPriceCents: 269000, // $2,690/yr = $224.17/mo effective (save $538)
    icon: Building2,
    accentClass: 'amber',
    accentBg: 'bg-amber-50 dark:bg-amber-950/40',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-amber-200 dark:border-amber-800',
    packs: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'operations', 'investor', 'broker', 'owner'],
    features: ['Everything in Broker', 'Full Operations suite', 'Tenant & Rent Roll management', 'Bookkeeping & Payroll', 'Portfolio Analytics', 'Revenue center tracking'],
  },
  {
    slug: 'institutional',
    name: 'Institutional',
    tagline: 'Manage the fund',
    description: 'Enterprise-grade platform for PE firms, family offices, and fund managers.',
    monthlyPriceCents: 44900,
    annualPriceCents: 449000, // $4,490/yr = $374.17/mo effective (save $898)
    icon: Crown,
    accentClass: 'violet',
    accentBg: 'bg-violet-50 dark:bg-violet-950/40',
    accentText: 'text-violet-600 dark:text-violet-400',
    accentBorder: 'border-violet-200 dark:border-violet-800',
    packs: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'operations', 'fund_management', 'lp_portal', 'analytics_pro', 'investor', 'broker', 'owner'],
    features: ['Everything in Owner', 'Fund Management — capital calls, distributions, NAV', 'LP Portal with investor statements', 'Analytics Pro — predictive & benchmarking', 'API access', 'Priority support & onboarding'],
    recommended: true,
  },
];

/**
 * Given a pack type the user needs, return the minimum tier that includes it
 */
function getMinimumTierForPack(packType: string): TierDef {
  for (const tier of TIERS) {
    if (tier.packs.includes(packType)) return tier;
  }
  return TIERS[TIERS.length - 1]; // Institutional fallback
}

// Re-export for use in PackContext etc.
export const PACK_DISPLAY_NAMES: Record<string, string> = {
  crm_pipeline: 'CRM & Pipeline',
  modeling_tools: 'Analysis Tools',
  analysis: 'Market Intelligence',
  operations: 'Operations',
  fund_management: 'Fund Management',
  lp_portal: 'LP Portal',
  prospecting: 'Prospecting',
  analytics_pro: 'Analytics Pro',
};

export function getPackDisplayName(packType: string, dbName?: string | null): string {
  // Return the tier name instead of the raw pack name
  const tier = getMinimumTierForPack(packType);
  return tier.name;
}

function formatPrice(cents: number): string {
  return formatCurrency(cents / 100);
}

function getAnnualMonthlyPrice(tier: TierDef): number {
  return Math.round(tier.annualPriceCents / 12);
}

function getAnnualSavings(tier: TierDef): number {
  return (tier.monthlyPriceCents * 12) - tier.annualPriceCents;
}

// ═══════════════════════════════════════════════════════════════
// CARD ELEMENT STYLES
// ═══════════════════════════════════════════════════════════════
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: 'hsl(var(--foreground))',
      fontFamily: 'Inter, system-ui, sans-serif',
      '::placeholder': { color: 'hsl(var(--muted-foreground))' },
    },
    invalid: { color: '#ef4444' },
  },
};

// ═══════════════════════════════════════════════════════════════
// INLINE PAYMENT FORM (uses Stripe Elements)
// ═══════════════════════════════════════════════════════════════
interface InlinePaymentFormProps {
  tierSlug: string;
  tierName: string;
  priceCents: number;
  billingCycle: 'monthly' | 'annual';
  onSuccess: () => void;
  onBack: () => void;
}

function InlinePaymentForm({ tierSlug, tierName, priceCents, billingCycle, onSuccess, onBack }: InlinePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const displayPrice = billingCycle === 'annual'
    ? formatPrice(Math.round(priceCents / 12))
    : formatPrice(priceCents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setCardError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        setCardError(error.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      // Subscribe to tier (server activates all packs in the tier)
      const res = await apiRequest('POST', '/api/stripe/subscribe-pack', {
        packType: tierSlug, // The subscribe-pack endpoint handles tier lookup
        paymentMethodId: paymentMethod.id,
        billingCycle,
      });

      const data = await res.json();

      if (data.clientSecret && data.status === 'incomplete') {
        const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
        if (confirmError) {
          setCardError(confirmError.message || 'Payment confirmation failed');
          setProcessing(false);
          return;
        }
      }

      onSuccess();
    } catch (err: any) {
      setCardError(err.message || 'Something went wrong');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">{tierName}</span>
          <span className="font-semibold">{displayPrice}/mo</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {billingCycle === 'annual'
            ? `Billed annually (${formatPrice(priceCents)}/year). Cancel anytime.`
            : 'Billed monthly. Cancel anytime.'}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Card Details
        </label>
        <div className="border rounded-lg p-3.5 bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onChange={(e) => {
              setCardComplete(e.complete);
              setCardError(e.error?.message || null);
            }}
          />
        </div>
        {cardError && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-destructive flex-shrink-0" />
            {cardError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>Secured by Stripe. Your card info never touches our servers.</span>
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={processing || !stripe || !cardComplete}
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>Subscribe for {displayPrice}/mo</>
        )}
      </Button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAYWALL MODAL (main export)
// ═══════════════════════════════════════════════════════════════

type ModalView = 'info' | 'payment' | 'provisioning';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packType: string;       // The pack that triggered the paywall
  featureName?: string;   // Human-readable name of the locked section
}

export function PaywallModal({ open, onOpenChange, packType, featureName }: PaywallModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isStripeConfigured, publishableKey } = useStripeStatus();
  const [view, setView] = useState<ModalView>('info');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const { setHighlight, clearHighlight } = useSidebarHighlight();

  // Determine the minimum tier needed for this pack
  const recommendedTier = getMinimumTierForPack(packType);
  const TierIcon = recommendedTier.icon;

  // Fetch the user's current active packs so we can highlight only NEWLY unlocked sections
  const { data: bootstrapData } = useQuery<{ activePacks?: string[] }>({
    queryKey: ['/api/bootstrap'],
    staleTime: 60_000,
  });

  const currentActivePacks: string[] = useMemo(
    () => bootstrapData?.activePacks || [],
    [bootstrapData],
  );

  // Trigger sidebar glow highlight when modal opens — only newly unlocked sections
  useEffect(() => {
    if (open) {
      const newIds = getNewlyUnlockedSectionIds(recommendedTier.slug, currentActivePacks);
      if (newIds.length > 0) {
        setHighlight(newIds);
      }
    } else {
      clearHighlight();
    }
    return () => {
      clearHighlight();
    };
  }, [open, recommendedTier.slug, currentActivePacks, setHighlight, clearHighlight]);

  // Use publishable key from the shared Stripe status hook for Stripe Elements
  const stripePromise = isStripeConfigured && publishableKey
    ? loadStripe(publishableKey)
    : null;

  // Subscribe to tier (activates all packs at once)
  const subscribeMutation = useMutation({
    mutationFn: async ({ tierSlug, isTrial }: { tierSlug: string; isTrial?: boolean }) => {
      const res = await apiRequest('POST', '/api/subscription/subscribe-tier', { tierSlug, isTrial });
      return res.json();
    },
    onSuccess: () => {
      setView('provisioning');
    },
    onError: (error: any) => {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate subscription.",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = () => {
    subscribeMutation.mutate({ tierSlug: recommendedTier.slug });
  };

  const handleStartTrial = () => {
    subscribeMutation.mutate({ tierSlug: recommendedTier.slug, isTrial: true });
  };

  const handlePaymentSuccess = () => {
    setView('provisioning');
  };

  const handleProvisioningComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/organization/packs/active'] });
    queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
    queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/current-tier'] });

    toast({
      title: "Welcome aboard!",
      description: `You're now on the ${recommendedTier.name} plan.`,
    });
    onOpenChange(false);
    setTimeout(() => setView('info'), 300);
  }, [recommendedTier, toast, onOpenChange]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => setView('info'), 300);
    }
    onOpenChange(isOpen);
  };

  // Price calculations
  const monthlyPriceCents = recommendedTier.monthlyPriceCents;
  const annualPriceCents = recommendedTier.annualPriceCents;
  const effectiveMonthlyCents = billingCycle === 'annual'
    ? getAnnualMonthlyPrice(recommendedTier)
    : monthlyPriceCents;
  const savingsCents = getAnnualSavings(recommendedTier);
  const isPaid = monthlyPriceCents > 0;

  // For payment form
  const paymentPriceCents = billingCycle === 'annual' ? annualPriceCents : monthlyPriceCents;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden"
        data-testid="dialog-paywall"
        onInteractOutside={(e) => view === 'provisioning' && e.preventDefault()}
      >
        {/* ── INFO VIEW ── */}
        {view === 'info' && (
          <div className="flex flex-col">
            {/* Role-colored header band */}
            <div className={cn(
              "px-6 pt-6 pb-5",
              recommendedTier.accentBg,
            )}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-3 rounded-xl border",
                  recommendedTier.accentBorder,
                  "bg-white/80 dark:bg-white/10"
                )}>
                  <TierIcon className={cn("h-6 w-6", recommendedTier.accentText)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-lg font-bold" data-testid="text-paywall-title">
                      {recommendedTier.name}
                    </h2>
                    {recommendedTier.popular && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white uppercase tracking-wider">
                        Popular
                      </span>
                    )}
                    {recommendedTier.recommended && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500 text-white uppercase tracking-wider">
                        Best Value
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs font-medium mb-1", recommendedTier.accentText)}>
                    {recommendedTier.tagline}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-paywall-description">
                    {featureName
                      ? `Upgrade to ${recommendedTier.name} to unlock ${featureName} and more.`
                      : recommendedTier.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Billing cycle toggle + price */}
              {isPaid && (
                <div className="space-y-3">
                  {/* Toggle */}
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center bg-muted rounded-lg p-0.5 text-sm">
                      <button
                        onClick={() => setBillingCycle('monthly')}
                        className={cn(
                          "px-3.5 py-1.5 rounded-md font-medium transition-all text-xs",
                          billingCycle === 'monthly'
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => setBillingCycle('annual')}
                        className={cn(
                          "px-3.5 py-1.5 rounded-md font-medium transition-all text-xs flex items-center gap-1.5",
                          billingCycle === 'annual'
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Annual
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Save {formatPrice(savingsCents / 100)}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Price display */}
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold tracking-tight">
                        {formatPrice(effectiveMonthlyCents / 100)}
                      </span>
                      <span className="text-muted-foreground text-sm">/month</span>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Billed as {formatPrice(annualPriceCents / 100)}/year
                        <span className="mx-1.5">·</span>
                        <span className="line-through opacity-60">{formatPrice(monthlyPriceCents / 100)}/mo</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="space-y-2">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Included</h4>
                <ul className="space-y-1.5">
                  {recommendedTier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm">
                      <Check className={cn("h-4 w-4 mt-0.5 flex-shrink-0", recommendedTier.accentText)} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Primary CTA */}
                {isStripeConfigured && stripePromise && isPaid ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setView('payment')}
                    data-testid="button-subscribe"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Subscribe — {formatPrice(effectiveMonthlyCents / 100)}/mo
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubscribe}
                    disabled={subscribeMutation.isPending}
                    data-testid="button-subscribe"
                  >
                    {subscribeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Activate {recommendedTier.name}
                  </Button>
                )}

                {/* Trial */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleStartTrial}
                  disabled={subscribeMutation.isPending}
                  data-testid="button-trial"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start 14-Day Free Trial
                </Button>

                {/* View all plans */}
                <Button
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => { setLocation('/pricing'); onOpenChange(false); }}
                >
                  Compare all plans
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT VIEW ── */}
        {view === 'payment' && stripePromise && (
          <div className="p-6">
            <Elements stripe={stripePromise}>
              <InlinePaymentForm
                tierSlug={recommendedTier.slug}
                tierName={recommendedTier.name}
                priceCents={paymentPriceCents}
                billingCycle={billingCycle}
                onSuccess={handlePaymentSuccess}
                onBack={() => setView('info')}
              />
            </Elements>
          </div>
        )}

        {/* ── PROVISIONING VIEW ── */}
        {view === 'provisioning' && (
          <div className="p-6">
            <ProvisioningAnimation
              packName={recommendedTier.name}
              onComplete={handleProvisioningComplete}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// usePaywall HOOK
// ═══════════════════════════════════════════════════════════════

interface UsePaywallOptions {
  packType: string;
  featureName?: string;
}

export function usePaywall({ packType, featureName }: UsePaywallOptions) {
  const [isOpen, setIsOpen] = useState(false);

  const showPaywall = () => setIsOpen(true);
  const hidePaywall = () => setIsOpen(false);

  const PaywallModalComponent = () => (
    <PaywallModal
      open={isOpen}
      onOpenChange={setIsOpen}
      packType={packType}
      featureName={featureName}
    />
  );

  return {
    showPaywall,
    hidePaywall,
    isOpen,
    PaywallModal: PaywallModalComponent,
  };
}

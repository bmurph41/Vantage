import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Sparkles, Lock, CreditCard, ArrowLeft, Shield, TrendingUp, Handshake, Anchor, Building2, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeStatus } from "@/hooks/useStripeStatus";
import { formatCurrency } from "@/lib/utils";
import { ProvisioningAnimation } from "@/components/subscription/ProvisioningAnimation";

// ═══════════════════════════════════════════════════════════════
// TIER DEFINITIONS (mirrors server-side SUBSCRIPTION_TIERS)
// ═══════════════════════════════════════════════════════════════

interface TierDef {
  slug: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  icon: typeof TrendingUp;
  packs: string[];
  features: string[];
  popular?: boolean;
  recommended?: boolean;
}

const TIERS: TierDef[] = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'Explore the platform with market news and sample analytics.',
    monthlyPriceCents: 0,
    icon: Sparkles,
    packs: [],
    features: ['Dashboard', 'The Docket', 'Marketplace (browse)', '3 sample comps', 'Demographics preview'],
  },
  {
    slug: 'investor',
    name: 'Investor',
    description: 'Full analysis and modeling tools for evaluating acquisitions.',
    monthlyPriceCents: 9900,
    icon: TrendingUp,
    packs: ['modeling_tools', 'analysis', 'investor'],
    features: ['Unlimited deal workspaces', 'Financial modeling (Pro Forma, DCF, Monte Carlo)', 'Exit Strategy Suite', 'Sales & Rate Comps (full)', 'Demographics & Capital Markets', 'Secure Data Room'],
  },
  {
    slug: 'broker',
    name: 'Broker',
    description: 'Complete deal management toolkit for brokers and advisors.',
    monthlyPriceCents: 19900,
    icon: Handshake,
    packs: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'investor', 'broker'],
    features: ['Everything in Investor', 'Full CRM & Deal Pipeline', 'Tasks, Follow-ups & Forecasting', 'Prospecting & Marketing', 'OM Builder & Investment Materials'],
    popular: true,
  },
  {
    slug: 'owner-operator',
    name: 'Owner / Operator',
    description: 'End-to-end marina management — deals, operations, and financials.',
    monthlyPriceCents: 24900,
    icon: Anchor,
    packs: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'operations', 'investor', 'broker', 'owner'],
    features: ['Everything in Broker', 'Full Operations suite', 'Rent Roll management', 'Bookkeeping & Payroll', 'Portfolio Analytics'],
  },
  {
    slug: 'institutional',
    name: 'Institutional',
    description: 'Enterprise-grade platform for PE firms and institutional investors.',
    monthlyPriceCents: 49900,
    icon: Crown,
    packs: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'operations', 'fund_management', 'lp_portal', 'analytics_pro', 'investor', 'broker', 'owner'],
    features: ['Everything in Owner / Operator', 'Fund Management', 'LP Portal', 'Analytics Pro', 'API access', 'Priority support'],
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
  onSuccess: () => void;
  onBack: () => void;
}

function InlinePaymentForm({ tierSlug, tierName, priceCents, onSuccess, onBack }: InlinePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

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
        billingCycle: 'monthly',
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
          <span className="font-semibold">{formatPrice(priceCents)}/mo</span>
        </div>
        <p className="text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
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
          <>Subscribe for {formatPrice(priceCents)}/mo</>
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
  const { isStripeConfigured } = useStripeStatus();
  const [view, setView] = useState<ModalView>('info');

  // Determine the minimum tier needed for this pack
  const recommendedTier = getMinimumTierForPack(packType);
  const TierIcon = recommendedTier.icon;

  // Fetch publishable key for Stripe Elements
  const { data: stripeKeyData } = useQuery<{ publishableKey: string | null }>({
    queryKey: ['/api/stripe/publishable-key'],
    enabled: open && isStripeConfigured,
  });

  const stripePromise = stripeKeyData?.publishableKey
    ? loadStripe(stripeKeyData.publishableKey)
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

  const priceCents = recommendedTier.monthlyPriceCents;
  const priceStr = priceCents > 0 ? formatPrice(priceCents) : 'Free';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="dialog-paywall"
        onInteractOutside={(e) => view === 'provisioning' && e.preventDefault()}
      >
        {/* ── INFO VIEW ── */}
        {view === 'info' && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                <TierIcon className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-xl" data-testid="text-paywall-title">
                {featureName
                  ? `Upgrade to unlock ${featureName}`
                  : `Upgrade to ${recommendedTier.name}`}
              </DialogTitle>
              <DialogDescription data-testid="text-paywall-description">
                {recommendedTier.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Price */}
              {priceCents > 0 && (
                <div className="text-center">
                  <span className="text-4xl font-bold">{priceStr}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              )}

              {/* Tier badge */}
              {recommendedTier.popular && (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              {/* Features */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">What you'll get:</h4>
                <ul className="space-y-2">
                  {recommendedTier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {/* Primary CTA */}
              {isStripeConfigured && stripePromise && priceCents > 0 ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setView('payment')}
                  data-testid="button-subscribe"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscribe to {recommendedTier.name} — {priceStr}/mo
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
          </>
        )}

        {/* ── PAYMENT VIEW ── */}
        {view === 'payment' && stripePromise && (
          <Elements stripe={stripePromise}>
            <InlinePaymentForm
              tierSlug={recommendedTier.slug}
              tierName={recommendedTier.name}
              priceCents={priceCents}
              onSuccess={handlePaymentSuccess}
              onBack={() => setView('info')}
            />
          </Elements>
        )}

        {/* ── PROVISIONING VIEW ── */}
        {view === 'provisioning' && (
          <ProvisioningAnimation
            packName={recommendedTier.name}
            onComplete={handleProvisioningComplete}
          />
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

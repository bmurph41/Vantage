import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Building, Calculator, ChartLine, Anchor, Briefcase, Users, Target, BarChart3, Lock, CreditCard, ArrowLeft, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeStatus } from "@/hooks/useStripeStatus";
import { formatCurrency } from "@/lib/utils";
import { ProvisioningAnimation } from "@/components/subscription/ProvisioningAnimation";

type CorePackType = 'crm_pipeline' | 'modeling_tools' | 'analysis' | 'operations';
type AddonPackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';
type PackType = CorePackType | AddonPackType;

interface PackInfo {
  name: string;
  description: string;
  features: string[];
  isCore?: boolean;
  monthlyPriceCents?: number;
}

interface PackWithStatus {
  packType: PackType;
  info: PackInfo;
  isActive: boolean;
  dependencies: PackType[];
  canActivate: boolean;
}

const PACK_ICONS: Record<PackType, typeof Briefcase> = {
  crm_pipeline: Building,
  modeling_tools: Calculator,
  analysis: ChartLine,
  operations: Anchor,
  fund_management: Briefcase,
  lp_portal: Users,
  prospecting: Target,
  analytics_pro: BarChart3,
};

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
  packType: PackType;
  packName: string;
  priceCents: number;
  onSuccess: () => void;
  onBack: () => void;
}

function InlinePaymentForm({ packType, packName, priceCents, onSuccess, onBack }: InlinePaymentFormProps) {
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
      // Create payment method from card element
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

      // Subscribe to pack with payment method
      const res = await apiRequest('POST', '/api/stripe/subscribe-pack', {
        packType,
        paymentMethodId: paymentMethod.id,
        billingCycle: 'monthly',
      });

      const data = await res.json();

      if (data.clientSecret && data.status === 'incomplete') {
        // Confirm payment if needed
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
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Order summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">{packName}</span>
          <span className="font-semibold">{formatPrice(priceCents)}/mo</span>
        </div>
        <p className="text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
      </div>

      {/* Card input */}
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

      {/* Security badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>Secured by Stripe. Your card info never touches our servers.</span>
      </div>

      {/* Submit */}
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
  packType: PackType;
  featureName?: string;
}

export function PaywallModal({ open, onOpenChange, packType, featureName }: PaywallModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isStripeConfigured } = useStripeStatus();
  const [view, setView] = useState<ModalView>('info');

  // Fetch publishable key for Stripe Elements
  const { data: stripeKeyData } = useQuery<{ publishableKey: string | null }>({
    queryKey: ['/api/stripe/publishable-key'],
    enabled: open && isStripeConfigured,
  });

  const stripePromise = stripeKeyData?.publishableKey
    ? loadStripe(stripeKeyData.publishableKey)
    : null;

  const { data: packsWithStatus = [] } = useQuery<PackWithStatus[]>({
    queryKey: ['/api/organization/packs'],
    enabled: open,
  });

  const packDetails = packsWithStatus.find(p => p.packType === packType);
  const Icon = PACK_ICONS[packType] || Briefcase;
  const price = packDetails?.info.monthlyPriceCents ? formatPrice(packDetails.info.monthlyPriceCents) : null;
  const priceCents = packDetails?.info.monthlyPriceCents || 0;

  const missingDependencies = packDetails?.dependencies.filter(dep => {
    const depPack = packsWithStatus.find(p => p.packType === dep);
    return !depPack?.isActive;
  }) || [];

  // Trial activation (no Stripe)
  const activateMutation = useMutation({
    mutationFn: async ({ packType, isTrial }: { packType: PackType; isTrial?: boolean }) => {
      await apiRequest('POST', `/api/organization/packs/${packType}/activate`, { isTrial });
    },
    onSuccess: () => {
      setView('provisioning');
    },
    onError: (error: any) => {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate pack.",
        variant: "destructive",
      });
    },
  });

  const handleStartTrial = () => {
    if (missingDependencies.length > 0) {
      setLocation('/settings/packs');
      onOpenChange(false);
    } else {
      activateMutation.mutate({ packType, isTrial: true });
    }
  };

  const handlePaymentSuccess = () => {
    setView('provisioning');
  };

  const handleProvisioningComplete = useCallback(() => {
    // Invalidate all relevant queries so the app reflects the new state
    queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/organization/packs/active'] });
    queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
    queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });

    toast({
      title: "Welcome aboard!",
      description: `${packDetails?.info.name || packType.replace(/_/g, ' ')} is now active.`,
    });
    onOpenChange(false);
    // Reset view for next open
    setTimeout(() => setView('info'), 300);
  }, [packDetails, packType, toast, onOpenChange]);

  // Reset view when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => setView('info'), 300);
    }
    onOpenChange(isOpen);
  };

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
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-xl" data-testid="text-paywall-title">
                {featureName ? `Unlock ${featureName}` : `Upgrade to ${packDetails?.info.name || 'Premium'}`}
              </DialogTitle>
              <DialogDescription data-testid="text-paywall-description">
                {packDetails?.info.description || 'Access premium features with this pack'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {price && (
                <div className="text-center">
                  <span className="text-4xl font-bold">{price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              )}

              {packDetails?.info.features && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">What you'll get:</h4>
                  <ul className="space-y-2">
                    {packDetails.info.features.slice(0, 5).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {missingDependencies.length > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
                    <Lock className="h-4 w-4" />
                    <span>
                      Requires{' '}
                      {missingDependencies.map(d => {
                        const depPack = packsWithStatus.find(p => p.packType === d);
                        return depPack?.info.name || d.replace(/_/g, ' ');
                      }).join(' and ')}{' '}
                      pack{missingDependencies.length > 1 ? 's' : ''} first
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {/* Primary CTA: go to payment if Stripe is ready and no missing deps */}
              {missingDependencies.length === 0 && isStripeConfigured && stripePromise ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setView('payment')}
                  data-testid="button-subscribe"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscribe Now
                </Button>
              ) : missingDependencies.length > 0 ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => { setLocation('/settings/packs'); onOpenChange(false); }}
                  data-testid="button-subscribe"
                >
                  View Required Packs
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStartTrial}
                  disabled={activateMutation.isPending}
                  data-testid="button-subscribe"
                >
                  {activateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Activate Now
                </Button>
              )}

              {/* Trial option */}
              {missingDependencies.length === 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleStartTrial}
                  disabled={activateMutation.isPending}
                  data-testid="button-trial"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start 14-Day Free Trial
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Maybe Later
              </Button>
            </div>
          </>
        )}

        {/* ── PAYMENT VIEW ── */}
        {view === 'payment' && stripePromise && (
          <Elements stripe={stripePromise}>
            <InlinePaymentForm
              packType={packType}
              packName={packDetails?.info.name || packType.replace(/_/g, ' ')}
              priceCents={priceCents}
              onSuccess={handlePaymentSuccess}
              onBack={() => setView('info')}
            />
          </Elements>
        )}

        {/* ── PROVISIONING VIEW ── */}
        {view === 'provisioning' && (
          <ProvisioningAnimation
            packName={packDetails?.info.name || packType.replace(/_/g, ' ')}
            onComplete={handleProvisioningComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// usePaywall HOOK (convenience)
// ═══════════════════════════════════════════════════════════════

interface UsePaywallOptions {
  packType: PackType;
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

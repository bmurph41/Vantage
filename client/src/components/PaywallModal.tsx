import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Building, Calculator, ChartLine, Anchor, Briefcase, Users, Target, BarChart3, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeStatus } from "@/hooks/useStripeStatus";
import { formatCurrency } from "@/lib/utils";

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

  const { data: packsWithStatus = [] } = useQuery<PackWithStatus[]>({
    queryKey: ['/api/organization/packs'],
    enabled: open,
  });

  const packDetails = packsWithStatus.find(p => p.packType === packType);
  const Icon = PACK_ICONS[packType] || Briefcase;
  const price = packDetails?.info.monthlyPriceCents ? formatPrice(packDetails.info.monthlyPriceCents) : null;

  const missingDependencies = packDetails?.dependencies.filter(dep => {
    const depPack = packsWithStatus.find(p => p.packType === dep);
    return !depPack?.isActive;
  }) || [];

  const activateMutation = useMutation({
    mutationFn: async ({ packType, isTrial }: { packType: PackType; isTrial?: boolean }) => {
      await apiRequest('POST', `/api/organization/packs/${packType}/activate`, { isTrial });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organization/packs/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({
        title: "Pack Activated",
        description: `The ${packDetails?.info.name || packType.replace(/_/g, ' ')} pack is now active.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate pack. Please try again.",
        variant: "destructive",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ packType, billingCycle }: { packType: string; billingCycle: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { packType, billingCycle });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubscribe = () => {
    if (missingDependencies.length > 0) {
      setLocation('/settings/packs');
      onOpenChange(false);
    } else if (isStripeConfigured) {
      checkoutMutation.mutate({ packType, billingCycle: "monthly" });
    } else {
      activateMutation.mutate({ packType });
    }
  };

  const handleStartTrial = () => {
    if (missingDependencies.length > 0) {
      setLocation('/settings/packs');
      onOpenChange(false);
    } else {
      activateMutation.mutate({ packType, isTrial: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-paywall">
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

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={handleSubscribe}
            disabled={activateMutation.isPending || checkoutMutation.isPending}
            data-testid="button-subscribe"
          >
            {(activateMutation.isPending || checkoutMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {missingDependencies.length > 0 ? 'View Required Packs' : 'Subscribe Now'}
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, Lock, Briefcase, Users, Target, BarChart3, Building, Calculator, ChartLine, Anchor, DollarSign, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeStatus } from "@/hooks/useStripeStatus";
import { formatCurrency } from "@/lib/utils";

// Core packs that users purchase first
type CorePackType = 'crm_pipeline' | 'modeling_tools' | 'analysis' | 'operations';

// Add-on packs that require core packs
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

export default function PacksSettingsPage() {
  const { toast } = useToast();
  const { isStripeConfigured, isLoading: isStripeLoading } = useStripeStatus();

  const { data: packs = [], isLoading } = useQuery<PackWithStatus[]>({
    queryKey: ['/api/organization/packs'],
    staleTime: 60 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: async ({ packType, isTrial }: { packType: PackType; isTrial?: boolean }) => {
      await apiRequest('POST', `/api/organization/packs/${packType}/activate`, { isTrial });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({
        title: "Pack Activated",
        description: `The ${variables.packType.replace(/_/g, ' ')} pack has been activated.`,
      });
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

  const deactivateMutation = useMutation({
    mutationFn: async (packType: PackType) => {
      await apiRequest('POST', `/api/organization/packs/${packType}/deactivate`);
    },
    onSuccess: (_, packType) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({
        title: "Pack Deactivated",
        description: `The ${packType.replace(/_/g, ' ')} pack has been deactivated.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deactivation Failed",
        description: error.message || "Failed to deactivate pack. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const corePacks = packs.filter(p => p.info.isCore);
  const addonPacks = packs.filter(p => !p.info.isCore);

  const renderPackCard = (pack: PackWithStatus) => {
    const Icon = PACK_ICONS[pack.packType] || Briefcase;
    const isPending = activateMutation.isPending || deactivateMutation.isPending;
    const price = pack.info.monthlyPriceCents ? formatPrice(pack.info.monthlyPriceCents) : null;

    return (
      <Card key={pack.packType} className={pack.isActive ? "border-primary" : ""} data-testid={`card-pack-${pack.packType}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pack.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2" data-testid={`text-pack-name-${pack.packType}`}>
                  {pack.info.name}
                  {pack.isActive && (
                    <Badge variant="default" className="ml-2" data-testid={`badge-active-${pack.packType}`}>
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                  {pack.info.isCore && !pack.isActive && (
                    <Badge variant="secondary" className="ml-2">Core</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1" data-testid={`text-pack-description-${pack.packType}`}>
                  {pack.info.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {price && !pack.isActive && (
                <div className="text-right">
                  <span className="text-2xl font-bold" data-testid={`text-price-${pack.packType}`}>{price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
              )}
              <div className="flex gap-2">
                {pack.isActive ? (
                  <Button
                    variant="outline"
                    onClick={() => deactivateMutation.mutate(pack.packType)}
                    disabled={isPending}
                    data-testid={`button-deactivate-${pack.packType}`}
                  >
                    {deactivateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Deactivate
                  </Button>
                ) : pack.canActivate ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => activateMutation.mutate({ packType: pack.packType, isTrial: true })}
                      disabled={isPending}
                      data-testid={`button-trial-${pack.packType}`}
                    >
                      Start 14-Day Trial
                    </Button>
                    <Button
                      onClick={() => {
                        if (isStripeConfigured) {
                          checkoutMutation.mutate({ packType: pack.packType, billingCycle: "monthly" });
                        } else {
                          activateMutation.mutate({ packType: pack.packType });
                        }
                      }}
                      disabled={isPending || checkoutMutation.isPending}
                      data-testid={`button-activate-${pack.packType}`}
                    >
                      {(activateMutation.isPending || checkoutMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Subscribe
                    </Button>
                  </>
                ) : (
                  <Button disabled variant="outline" data-testid={`button-locked-${pack.packType}`}>
                    <Lock className="h-4 w-4 mr-2" />
                    Requires {pack.dependencies.map(d => d.replace(/_/g, ' ')).join(', ')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Features included:</h4>
            <ul className="grid gap-2 sm:grid-cols-2">
              {pack.info.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`text-feature-${pack.packType}-${idx}`}>
                  <Check className={`h-4 w-4 ${pack.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          {pack.dependencies.length > 0 && !pack.isActive && (
            <div className="mt-4 p-3 bg-muted rounded-lg" data-testid={`text-dependency-notice-${pack.packType}`}>
              <p className="text-sm text-muted-foreground">
                <Lock className="h-4 w-4 inline mr-2" />
                This pack requires the{' '}
                <strong>{pack.dependencies.map(d => d.replace(/_/g, ' ')).join(' and ')}</strong>{' '}
                pack{pack.dependencies.length > 1 ? 's' : ''} to be active first.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">Manage Packs</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Build your Vantage platform with the packs you need. Start with core packs and add specialized features as your business grows.
        </p>
      </div>

      {!isStripeLoading && !isStripeConfigured && (
        <Alert className="mb-6" data-testid="alert-stripe-not-configured">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Beta Access:</strong> During this testing phase, all packs are available for free trial. 
            Paid subscriptions will be available once payment processing is configured.
          </AlertDescription>
        </Alert>
      )}

      {corePacks.length > 0 && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Core Packs</h2>
            <p className="text-sm text-muted-foreground">
              Essential modules for marina management and deal-making. Each pack unlocks a complete feature set.
            </p>
          </div>
          <div className="grid gap-6 mb-8">
            {corePacks.map(renderPackCard)}
          </div>
        </>
      )}

      {addonPacks.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Add-on Packs</h2>
            <p className="text-sm text-muted-foreground">
              Specialized features that extend your core packs. Some add-ons require specific core packs to be active.
            </p>
          </div>
          <div className="grid gap-6">
            {addonPacks.map(renderPackCard)}
          </div>
        </>
      )}
    </div>
  );
}

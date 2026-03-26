import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Package, ExternalLink, Check, Zap } from "lucide-react";

export default function BillingSettingsPage() {
  const { toast } = useToast();

  const { data: plans = [] } = useQuery<any[]>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: subscription } = useQuery<any>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: stripeStatus } = useQuery<any>({
    queryKey: ["/api/stripe/status"],
  });

  const checkout = useMutation({
    mutationFn: async ({ packType, billingCycle }: { packType: string; billingCycle: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { packType, billingCycle });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Checkout session created", description: "Redirecting to payment..." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const openPortal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Portal unavailable", description: err.message, variant: "destructive" });
    },
  });

  const sub = subscription?.subscription;
  const usage = subscription?.usage;

  // Check URL params for success/cancel
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get("success");
  const canceled = urlParams.get("canceled");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, payment method, and invoices</p>
      </div>

      {success === "true" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <Check className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Payment successful!</p>
              <p className="text-sm text-green-600">Your subscription is now active. Features will be available immediately.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {canceled === "true" && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-orange-800">Checkout was canceled. You can try again anytime.</p>
          </CardContent>
        </Card>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {sub ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{sub.planName || sub.planKey || "Free"}</p>
                  <Badge variant={sub.status === "active" ? "default" : sub.status === "trialing" ? "secondary" : "destructive"}>
                    {sub.status}
                  </Badge>
                </div>
                <Button variant="outline" onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Subscription
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
              {sub.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              {usage && (
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div><p className="text-sm text-muted-foreground">Deals</p><p className="font-bold">{usage.deals || 0}</p></div>
                  <div><p className="text-sm text-muted-foreground">Models</p><p className="font-bold">{usage.models || 0}</p></div>
                  <div><p className="text-sm text-muted-foreground">Users</p><p className="font-bold">{usage.users || 0}</p></div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-3">No active subscription. Choose a plan below to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Packs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(plans) ? plans : Object.values(plans)).map((plan: any) => (
            <Card key={plan.key || plan.packType || plan.name} className="relative">
              <CardHeader>
                <CardTitle className="text-lg">{plan.name || plan.key}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold">${((plan.monthlyPriceCents || plan.price || 0) / 100).toFixed(0)}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {plan.features && (
                  <ul className="space-y-1 mb-4">
                    {((plan.features || []) as string[]).slice(0, 5).map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-3 w-3 text-green-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="w-full"
                  variant={plan.isCore ? "default" : "outline"}
                  onClick={() => checkout.mutate({
                    packType: plan.packType || plan.key,
                    billingCycle: "monthly",
                  })}
                  disabled={checkout.isPending || !stripeStatus?.configured}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {stripeStatus?.configured ? "Subscribe" : "Coming Soon"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

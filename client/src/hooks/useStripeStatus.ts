import { useQuery } from "@tanstack/react-query";

interface AppConfig {
  stripePublishableKey: string | null;
  stripeConfigured: boolean;
  featureFlags?: Record<string, boolean>;
}

export function useStripeStatus() {
  const { data, isLoading } = useQuery<AppConfig>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000,
  });

  return {
    isStripeConfigured: data?.stripeConfigured ?? false,
    message: data?.stripeConfigured ? "Stripe is configured" : "Stripe is not configured",
    publishableKey: data?.stripePublishableKey ?? null,
    isLoading,
  };
}

import { useQuery } from "@tanstack/react-query";

interface StripeStatus {
  configured: boolean;
  message: string;
}

export function useStripeStatus() {
  const { data, isLoading } = useQuery<StripeStatus>({
    queryKey: ['/api/stripe/status'],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    isStripeConfigured: data?.configured ?? false,
    message: data?.message ?? "Checking payment status...",
    isLoading,
  };
}

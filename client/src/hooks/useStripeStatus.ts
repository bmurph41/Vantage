// Stripe integration is coming soon - always return not configured
export function useStripeStatus() {
  return {
    isStripeConfigured: false,
    message: "Payment processing coming soon - free trials available during beta",
    isLoading: false,
  };
}

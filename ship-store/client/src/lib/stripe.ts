import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    
    if (!publishableKey) {
      console.warn('VITE_STRIPE_PUBLIC_KEY is not set. Stripe functionality will be limited.');
      return Promise.resolve(null);
    }
    
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatStripeAmount = (amount: number): number => {
  // Stripe requires amounts in cents
  return Math.round(amount * 100);
};

export const formatFromStripeAmount = (amount: number): number => {
  // Convert from Stripe cents to dollars
  return amount / 100;
};

export const validateStripeKey = (key: string): boolean => {
  if (!key) return false;
  
  // Publishable keys start with pk_
  // Secret keys start with sk_
  const isPublishable = key.startsWith('pk_');
  const isSecret = key.startsWith('sk_');
  
  return isPublishable || isSecret;
};

export const getPaymentMethodIcon = (paymentMethod: string): string => {
  switch (paymentMethod.toLowerCase()) {
    case 'stripe':
      return 'fab fa-stripe';
    case 'square':
      return 'fas fa-square';
    case 'cash':
      return 'fas fa-money-bill';
    case 'card':
      return 'fas fa-credit-card';
    default:
      return 'fas fa-payment';
  }
};

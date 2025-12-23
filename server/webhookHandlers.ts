import { getUncachableStripeClient, getStripeSync } from './stripeClient';
import { stripePackService } from './services/stripe-pack-service';
import type Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = await getUncachableStripeClient();
    
    let event: Stripe.Event;
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } else {
        console.warn('STRIPE_WEBHOOK_SECRET not set - using stripe-replit-sync for webhook processing');
        const sync = await getStripeSync();
        await sync.processWebhook(payload, signature);
        return;
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    try {
      await WebhookHandlers.handleEvent(event);
    } catch (error: any) {
      console.error(`[Stripe Webhook] Error handling event ${event.type}:`, error.message);
      throw error;
    }
  }

  private static async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await stripePackService.handleSubscriptionCancelled(
          subscription.id,
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Stripe Webhook] Payment failed for invoice ${invoice.id}`);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);
        if (session.subscription && session.customer) {
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          await stripePackService.handleSubscriptionCreated(subscriptionId, customerId);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  }

  private static async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;

    const status = subscription.status;
    console.log(`[Stripe Webhook] Subscription ${subscription.id} status: ${status}`);

    if (status === 'active' || status === 'trialing') {
      await stripePackService.handleSubscriptionCreated(subscription.id, customerId);
    } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
      await stripePackService.handleSubscriptionCancelled(subscription.id, customerId);
    }
  }
}

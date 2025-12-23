import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient';
import { packService, PackType } from './pack-service';
import { db } from '../db';
import { organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';

const PACK_LOOKUP_KEYS: Record<PackType, string> = {
  crm_pipeline: 'price_crm_pipeline',
  modeling_tools: 'price_modeling_tools',
  analysis: 'price_analysis',
  operations: 'price_operations',
  fund_management: 'price_fund_management',
  lp_portal: 'price_lp_portal',
  prospecting: 'price_prospecting',
  analytics_pro: 'price_analytics_pro',
};

let priceIdCache: Record<string, string> | null = null;

class StripePackService {
  private async getPriceIdForPack(packType: PackType): Promise<string> {
    if (priceIdCache && priceIdCache[packType]) {
      return priceIdCache[packType];
    }

    const stripe = await getUncachableStripeClient();
    const lookupKey = PACK_LOOKUP_KEYS[packType];
    
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });

    if (prices.data.length === 0) {
      throw new Error(`No active price found for pack: ${packType}. Run the seed-stripe-products script first.`);
    }

    if (!priceIdCache) {
      priceIdCache = {};
    }
    priceIdCache[packType] = prices.data[0].id;
    
    return prices.data[0].id;
  }

  private getPackTypeFromPriceMetadata(metadata: Record<string, string> | null): PackType | undefined {
    if (!metadata?.pack_type) return undefined;
    const packTypes = Object.keys(PACK_LOOKUP_KEYS);
    if (packTypes.includes(metadata.pack_type)) {
      return metadata.pack_type as PackType;
    }
    return undefined;
  }
  async getPublishableKey() {
    return getStripePublishableKey();
  }

  async createCheckoutSession(
    orgId: string,
    packTypes: PackType[],
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) {
      throw new Error('Organization not found');
    }

    let customerId = org.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { orgId },
      });
      customerId = customer.id;
      
      await db.update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, orgId));
    }

    const lineItems = await Promise.all(packTypes.map(async (packType) => {
      const priceId = await this.getPriceIdForPack(packType);
      return {
        price: priceId,
        quantity: 1,
      };
    }));

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orgId,
        packTypes: packTypes.join(','),
      },
    });

    return session;
  }

  async createCustomerPortalSession(orgId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer found for organization');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }

  async handleSubscriptionCreated(subscriptionId: string, customerId: string) {
    console.log(`[StripePackService] Processing subscription created: ${subscriptionId}`);
    const stripe = await getUncachableStripeClient();
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) {
      console.error('[StripePackService] Customer was deleted:', customerId);
      return;
    }

    const orgId = (customer as any).metadata?.orgId;
    if (!orgId) {
      console.error('[StripePackService] No orgId found in customer metadata:', customerId);
      return;
    }

    console.log(`[StripePackService] Activating packs for org ${orgId} from subscription ${subscriptionId}`);

    for (const item of subscription.items.data) {
      const packType = this.getPackTypeFromPriceMetadata(item.price.metadata as Record<string, string>);

      if (packType) {
        try {
          const existingPack = await packService.getOrgPack(orgId, packType);
          
          if (existingPack.isActive && existingPack.pack?.stripeSubscriptionId === subscriptionId) {
            console.log(`[StripePackService] Pack ${packType} already active with subscription ${subscriptionId} for org ${orgId}, skipping`);
            continue;
          }
          
          if (existingPack.pack?.status === 'cancelled' && existingPack.pack?.stripeSubscriptionId === subscriptionId) {
            console.log(`[StripePackService] Pack ${packType} was cancelled for same subscription ${subscriptionId}, ignoring stale activation event`);
            continue;
          }
          
          await packService.activatePack(orgId, packType, undefined, {
            notes: `Activated via Stripe subscription ${subscriptionId}`,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            stripePriceId: item.price.id,
          });
          console.log(`[StripePackService] Activated pack ${packType} for org ${orgId}`);
        } catch (error: any) {
          console.error(`[StripePackService] Failed to activate pack ${packType}:`, error.message);
        }
      }
    }
  }

  async handleSubscriptionCancelled(subscriptionId: string, customerId: string) {
    console.log(`[StripePackService] Processing subscription cancelled: ${subscriptionId}`);
    const stripe = await getUncachableStripeClient();
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) {
      console.error('[StripePackService] Customer was deleted:', customerId);
      return;
    }

    const orgId = (customer as any).metadata?.orgId;
    if (!orgId) {
      console.error('[StripePackService] No orgId found in customer metadata:', customerId);
      return;
    }

    console.log(`[StripePackService] Deactivating packs for org ${orgId} from subscription ${subscriptionId}`);

    for (const item of subscription.items.data) {
      const packType = this.getPackTypeFromPriceMetadata(item.price.metadata as Record<string, string>);

      if (packType) {
        try {
          const existingPack = await packService.getOrgPack(orgId, packType);
          if (existingPack.pack?.stripeSubscriptionId !== subscriptionId) {
            console.log(`[StripePackService] Pack ${packType} subscription ID mismatch (expected ${existingPack.pack?.stripeSubscriptionId}, got ${subscriptionId}), skipping deactivation`);
            continue;
          }
          
          await packService.deactivatePack(orgId, packType);
          console.log(`[StripePackService] Deactivated pack ${packType} for org ${orgId}`);
        } catch (error: any) {
          console.error(`[StripePackService] Failed to deactivate pack ${packType}:`, error.message);
        }
      }
    }
  }
}


export const stripePackService = new StripePackService();

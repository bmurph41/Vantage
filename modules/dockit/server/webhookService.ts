import crypto from 'crypto';
import { storage } from './storage';

interface WebhookPayload {
  id: string;
  type: string;
  created: string;
  data: {
    object: Record<string, any>;
  };
  marinaId?: string;
  organizationId?: string;
}

async function generateSignature(payload: WebhookPayload, secret: string): Promise<string> {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function deliverWebhook(
  webhookId: string,
  webhookUrl: string,
  webhookSecret: string,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const delivery = await storage.createWebhookDelivery({
    webhookId,
    eventType: payload.type,
    payload,
    status: 'pending',
    attempts: 0,
  });

  try {
    const signature = await generateSignature(payload, webhookSecret);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.type,
        'X-Webhook-Delivery': delivery.id,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text().catch(() => '');

    await storage.updateWebhookDelivery(delivery.id, {
      status: response.ok ? 'delivered' : 'failed',
      responseCode: response.status,
      responseBody: responseBody.substring(0, 5000),
      attempts: 1,
    });

    if (response.ok) {
      await storage.resetWebhookFailures(webhookId);
    } else {
      await storage.incrementWebhookFailure(webhookId);
    }

    return { 
      success: response.ok, 
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}` 
    };
  } catch (error: any) {
    await storage.updateWebhookDelivery(delivery.id, {
      status: 'failed',
      errorMessage: error.message,
      attempts: 1,
    });
    await storage.incrementWebhookFailure(webhookId);

    return { 
      success: false, 
      error: error.message 
    };
  }
}

export async function triggerWebhooks(
  eventType: string,
  data: Record<string, any>,
  marinaId?: string,
  organizationId?: string
): Promise<void> {
  try {
    const webhooks = await storage.getActiveWebhooksForEvent(eventType, marinaId);
    
    if (webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      id: `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      type: eventType,
      created: new Date().toISOString(),
      data: {
        object: data,
      },
      marinaId,
      organizationId,
    };

    const deliveryPromises = webhooks.map(webhook => 
      deliverWebhook(webhook.id, webhook.url, webhook.secret, payload)
        .catch(error => {
          console.error(`Failed to deliver webhook ${webhook.id}:`, error);
          return { success: false, error: error.message };
        })
    );

    await Promise.allSettled(deliveryPromises);
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export const WEBHOOK_EVENTS = {
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_UPDATED: 'reservation.updated',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_OVERDUE: 'payment.overdue',
  LAUNCH_SCHEDULED: 'launch.scheduled',
  LAUNCH_COMPLETED: 'launch.completed',
  CONTRACT_SIGNED: 'contract.signed',
  CUSTOMER_CREATED: 'customer.created',
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];

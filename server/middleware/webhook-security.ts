import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';

const WEBHOOK_SECRETS: Record<string, string | undefined> = {
  stripe: process.env.STRIPE_WEBHOOK_SECRET,
  sendgrid: process.env.SENDGRID_WEBHOOK_SECRET,
  generic: process.env.WEBHOOK_SECRET,
};

const TIMESTAMP_TOLERANCE_SECONDS = 300;

export function verifyWebhookSignature(provider: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = WEBHOOK_SECRETS[provider];
    
    if (!secret) {
      logger.warn({
        type: 'webhook_secret_missing',
        provider,
        path: req.path,
      });
      return next();
    }

    try {
      switch (provider) {
        case 'stripe':
          verifyStripeSignature(req, secret);
          break;
        case 'sendgrid':
          verifySendGridSignature(req, secret);
          break;
        default:
          verifyGenericSignature(req, secret);
      }
      next();
    } catch (error) {
      logger.warn({
        type: 'webhook_signature_invalid',
        provider,
        path: req.path,
        error: (error as Error).message,
        ip: req.ip,
      });
      return res.status(401).json({ 
        error: 'Invalid webhook signature', 
        code: 'INVALID_SIGNATURE' 
      });
    }
  };
}

function verifyStripeSignature(req: Request, secret: string): void {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }

  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parseInt(parts.t, 10);
  const now = Math.floor(Date.now() / 1000);
  
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp too old');
  }

  const payload = `${timestamp}.${(req as any).rawBody || JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(parts.v1 || ''), 
    Buffer.from(expectedSignature)
  )) {
    throw new Error('Signature verification failed');
  }
}

function verifySendGridSignature(req: Request, secret: string): void {
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
  
  if (!signature || !timestamp) {
    throw new Error('Missing SendGrid signature headers');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp too old');
  }

  const payload = `${timestamp}${(req as any).rawBody || JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature), 
    Buffer.from(expectedSignature)
  )) {
    throw new Error('Signature verification failed');
  }
}

function verifyGenericSignature(req: Request, secret: string): void {
  const signature = req.headers['x-webhook-signature'] as string || 
                    req.headers['x-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;

  if (!signature) {
    throw new Error('Missing webhook signature header');
  }

  if (timestamp) {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > TIMESTAMP_TOLERANCE_SECONDS) {
      throw new Error('Webhook timestamp too old');
    }
  }

  const payload = (req as any).rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const signatureValue = signature.startsWith('sha256=') 
    ? signature.slice(7) 
    : signature;

  if (!crypto.timingSafeEqual(
    Buffer.from(signatureValue), 
    Buffer.from(expectedSignature)
  )) {
    throw new Error('Signature verification failed');
  }
}

export function captureRawBody(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/webhook') || req.path.includes('/stripe')) {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk.toString();
    });
    req.on('end', () => {
      (req as any).rawBody = rawBody;
      next();
    });
  } else {
    next();
  }
}

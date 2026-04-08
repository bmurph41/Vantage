import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendEmail } from '../services/email-service';
import { logger } from '../lib/logger';

export const supportRouter = Router();

const SUPPORT_EMAIL = 'support@vantage.com';

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  category: z.enum(['bug', 'feature', 'quickbooks', 'billing', 'general']),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  quickbooks: 'QuickBooks / Integration Support',
  billing: 'Billing',
  general: 'General Help',
};

supportRouter.post('/contact', async (req: Request, res: Response) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const { name, email, category, subject, message } = parsed.data;
  const categoryLabel = CATEGORY_LABELS[category] || category;
  const user = (req as any).user;
  const orgId = (req as any).orgId || 'unknown';

  const internalHtml = `
    <h2 style="margin:0 0 16px">New Support Request — ${categoryLabel}</h2>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:140px">Category</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${categoryLabel}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Name</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${name}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Subject</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${subject}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Org ID</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${orgId}</td></tr>
      ${user?.id ? `<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">User ID</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${user.id}</td></tr>` : ''}
    </table>
    <h3 style="margin:24px 0 8px">Message</h3>
    <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6">${message}</div>
    <p style="margin:24px 0 0;font-size:12px;color:#888">Submitted via Vantage in-app support — ${new Date().toISOString()}</p>
  `;

  const confirmationHtml = `
    <h2 style="margin:0 0 8px">We received your message</h2>
    <p style="color:#555;margin:0 0 24px">Thanks for reaching out, ${name}. Our team will get back to you within 1 business day.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:120px">Category</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${categoryLabel}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Subject</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${subject}</td></tr>
    </table>
    <p style="margin:24px 0 0;color:#555">If your issue is urgent, reply directly to this email.</p>
    <p style="margin:8px 0 0;font-size:12px;color:#888">— The Vantage Team</p>
  `;

  try {
    const [internalSent, confirmSent] = await Promise.all([
      sendEmail({
        to: SUPPORT_EMAIL,
        subject: `[${categoryLabel}] ${subject}`,
        text: `From: ${name} <${email}>\nCategory: ${categoryLabel}\n\n${message}`,
        html: internalHtml,
        from: { email: SUPPORT_EMAIL, name: `${name} via Vantage` },
      }),
      sendEmail({
        to: email,
        subject: `We received your message — ${subject}`,
        text: `Hi ${name},\n\nWe received your support request and will respond within 1 business day.\n\nCategory: ${categoryLabel}\nSubject: ${subject}\n\n— The Vantage Team`,
        html: confirmationHtml,
      }),
    ]);

    logger.info({ name, email, category, internalSent, confirmSent }, 'Support contact form submitted');

    return res.json({ success: true, confirmationSent: confirmSent });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Support contact email failed');
    return res.status(500).json({ error: 'Failed to send support request' });
  }
});

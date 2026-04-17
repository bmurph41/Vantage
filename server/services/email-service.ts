import sgMail from '@sendgrid/mail';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@vantage.com';
const DEFAULT_FROM_NAME = 'Vantage';
const APP_URL = process.env.APP_URL || 'https://vantage.com';

/**
 * Unified email sender that tries providers in order:
 * 1. SendGrid (if SENDGRID_API_KEY or Replit connector available)
 * 2. Resend (if RESEND_API_KEY available)
 * 3. Console log fallback — dev-only success, production-failure.
 *
 * Return value is ONLY `true` when an actual provider accepted the message.
 * In production with no provider configured, returns `false` so callers can
 * surface the failure (prior behavior silently returned true, making outages
 * invisible — passwords never reset, invites never delivered, etc).
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: { email: string; name: string };
}): Promise<boolean> {
  const from = options.from || { email: DEFAULT_FROM_EMAIL, name: DEFAULT_FROM_NAME };

  // Try SendGrid first — skip quickly if clearly not configured to avoid a
  // noisy warn-log on every email when Resend is the intended provider.
  const sendgridCouldWork =
    !!process.env.SENDGRID_API_KEY ||
    (!!process.env.REPLIT_CONNECTORS_HOSTNAME &&
      !!(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL));
  if (sendgridCouldWork) {
    try {
      const { client, fromEmail } = await getSendGridClient();
      await client.send({
        to: options.to,
        from: { email: fromEmail, name: from.name },
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      logger.info({ to: options.to, subject: options.subject, provider: 'sendgrid' }, 'Email sent via SendGrid');
      return true;
    } catch (sgError: any) {
      logger.warn({ error: sgError.message, to: options.to }, 'SendGrid failed, trying Resend fallback');
    }
  }

  // Try Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${from.name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });
      if (res.ok) {
        logger.info({ to: options.to, subject: options.subject, provider: 'resend' }, 'Email sent via Resend');
        return true;
      }
      const err = await res.text();
      logger.warn({ error: err, to: options.to, status: res.status }, 'Resend API returned error');
    } catch (resendError: any) {
      logger.warn({ error: resendError.message, to: options.to }, 'Resend failed');
    }
  }

  // No provider succeeded. In production, this is a real failure — surface it
  // so callers can alert the user (e.g. "we couldn't send the reset email"
  // rather than silently no-op). In dev, log to console and return true so
  // local development doesn't require a real provider.
  const isProduction = process.env.NODE_ENV === 'production';
  logger.warn({
    to: options.to,
    subject: options.subject,
    provider: 'none',
    isProduction,
    sendgridConfigured: sendgridCouldWork,
    resendConfigured: !!resendKey,
  }, 'No email provider delivered the message');

  if (!isProduction) {
    console.log(`\n========== EMAIL (console fallback) ==========`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body: ${options.text.substring(0, 300)}...`);
    console.log(`===============================================\n`);
    return true;
  }
  return false;
}

export async function getSendGridClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken || !hostname) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@vantage.com';

    if (!apiKey) {
      throw new Error('SendGrid not configured');
    }

    sgMail.setApiKey(apiKey);
    return { client: sgMail, fromEmail };
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }

  sgMail.setApiKey(connectionSettings.settings.api_key);
  return {
    client: sgMail,
    fromEmail: connectionSettings.settings.from_email
  };
}

// ── Email Template Helpers ──────────────────────────────────────────────

export function wrapEmailTemplate(bodyContent: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #343E5C; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #EFEFF4;">
  <div style="background: white; border-radius: 8px; padding: 40px; margin: 20px 0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #22d3ee, #2563eb); border-radius: 10px; line-height: 40px; color: white; font-weight: 700; font-size: 20px;">M</div>
      <h1 style="color: #0891b2; margin: 8px 0 0 0; font-size: 22px;">Vantage</h1>
    </div>
    ${bodyContent}
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 20px;">
    <p>&copy; ${new Date().getFullYear()} Vantage. All rights reserved.</p>
    <p><a href="${APP_URL}/settings" style="color: #94a3b8;">Manage preferences</a></p>
  </div>
</body></html>`;
}

function emailButton(label: string, url: string): string {
  return `<div style="text-align: center; margin: 32px 0;">
    <a href="${url}" style="background: linear-gradient(135deg, #0891b2, #2563eb); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">${label}</a>
  </div>`;
}

// ── Transactional Emails ───────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string, userName?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Reset Your Vantage Password',
    text: `Hi${userName ? ' ' + userName : ''},\n\nYou requested to reset your password.\n\nClick this link to reset (expires in 1 hour): ${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b;">Reset Your Password</h2>
      <p>Hi${userName ? ' ' + userName : ''},</p>
      <p>You requested to reset your password for Vantage. Click the button below to create a new password:</p>
      ${emailButton('Reset Password', resetUrl)}
      <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
      <p style="color: #64748b; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendEmailVerification(to: string, verificationUrl: string, userName?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Verify Your Vantage Email',
    text: `Hi${userName ? ' ' + userName : ''},\n\nWelcome to Vantage! Verify your email: ${verificationUrl}\n\nLink expires in 24 hours.\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b; text-align: center;">Welcome to Vantage!</h2>
      <p>Hi${userName ? ' ' + userName : ''},</p>
      <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
      ${emailButton('Verify Email Address', verificationUrl)}
      <p style="color: #64748b; font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
    `),
  });
}

export async function sendMagicLinkEmail(to: string, magicLinkUrl: string, userName?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Your Vantage Login Link',
    text: `Hi${userName ? ' ' + userName : ''},\n\nLog in to Vantage: ${magicLinkUrl}\n\nLink expires in 15 minutes.\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b; text-align: center;">Log In to Vantage</h2>
      <p>Hi${userName ? ' ' + userName : ''},</p>
      <p>Click the button below to securely log in to your account without entering a password:</p>
      ${emailButton('Log In to Vantage', magicLinkUrl)}
      <p style="color: #64748b; font-size: 14px;">This link will expire in 15 minutes for security reasons.</p>
    `),
  });
}

// ── Trial Reminder Emails ──────────────────────────────────────────────

export async function sendTrialDay3Email(to: string, userName?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Getting the most out of your Vantage trial',
    text: `Hi${userName ? ' ' + userName : ''},\n\nYou're 3 days into your free trial! Here are some tips to get the most out of Vantage:\n\n1. Upload your first sales comps to see market intelligence\n2. Create a deal in your pipeline to track opportunities\n3. Invite your team to collaborate\n4. Explore the modeling tools for valuations\n\nYour trial ends in 4 days. Visit ${APP_URL} to continue.\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b;">Getting the Most Out of Vantage</h2>
      <p>Hi${userName ? ' ' + userName : ''},</p>
      <p>You're 3 days into your free trial! Here are the top things to try:</p>
      <div style="background: #f0fdfa; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-size: 14px;">1. <strong>Upload sales comps</strong> — see market intelligence in action</td></tr>
          <tr><td style="padding: 8px 0; font-size: 14px;">2. <strong>Create a deal</strong> — track opportunities through your pipeline</td></tr>
          <tr><td style="padding: 8px 0; font-size: 14px;">3. <strong>Invite your team</strong> — collaborate in real time</td></tr>
          <tr><td style="padding: 8px 0; font-size: 14px;">4. <strong>Try the modeling tools</strong> — build pro formas and valuations</td></tr>
        </table>
      </div>
      <p style="color: #64748b; font-size: 14px;">Your trial ends in 4 days.</p>
      ${emailButton('Explore Vantage', APP_URL)}
    `),
  });
}

export async function sendTrialDay5Email(to: string, userName?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Your Vantage trial expires in 2 days',
    text: `Hi${userName ? ' ' + userName : ''},\n\nYour 7-day free trial expires in 2 days. After the trial, your card on file will be charged for your selected packs.\n\nTo continue using Vantage, no action is needed — your subscription will activate automatically.\n\nTo cancel, visit ${APP_URL}/settings/billing before your trial ends.\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b;">Your Trial Expires in 2 Days</h2>
      <p>Hi${userName ? ' ' + userName : ''},</p>
      <p>Your 7-day free trial expires in <strong>2 days</strong>.</p>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>What happens next:</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 14px;">Your card on file will be charged for your selected packs. To continue, no action is needed.</p>
      </div>
      <p>To cancel or change your packs, visit your billing settings before the trial ends:</p>
      ${emailButton('Manage Subscription', APP_URL + '/settings/billing')}
    `),
  });
}

export async function sendTrialLastDayEmail(to: string, userName?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Your Vantage trial ends today',
    text: `Hi${userName ? ' ' + userName : ''},\n\nYour free trial ends today. Your subscription will begin and your card on file will be charged.\n\nTo cancel before you're charged, visit ${APP_URL}/settings/billing.\n\nThank you for trying Vantage!\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b;">Your Trial Ends Today</h2>
      <p>Hi${userName ? ' ' + userName : ''},</p>
      <p>Your free trial ends <strong>today</strong>. Here's what to expect:</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>Your subscription begins today.</strong> Your card on file will be charged for your selected packs.</p>
      </div>
      <p>If you'd like to cancel before you're charged:</p>
      ${emailButton('Manage Billing', APP_URL + '/settings/billing')}
      <p style="color: #64748b; font-size: 14px;">Thank you for trying Vantage! We hope you love it.</p>
    `),
  });
}

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  options: { inviteeName?: string; inviterName?: string; orgName?: string } = {}
): Promise<boolean> {
  const { inviteeName, inviterName, orgName } = options;
  const greeting = inviteeName ? `Hi ${inviteeName},` : 'Hi,';
  const inviterText = inviterName ? `<strong>${inviterName}</strong>` : 'A team member';
  const orgText = orgName ? ` to <strong>${orgName}</strong> on Vantage` : ' to Vantage';

  return sendEmail({
    to,
    subject: `You've been invited to Vantage`,
    text: `${greeting}\n\n${inviterName || 'A team member'} has invited you${orgName ? ' to ' + orgName + ' on' : ' to'} Vantage — the institutional-grade marina & CRE investment platform.\n\nClick the link below to accept your invitation and set up your account (link expires in 7 days):\n${inviteUrl}\n\n— The Vantage Team`,
    html: wrapEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e293b;">You're Invited to Vantage</h2>
      <p>${greeting}</p>
      <p>${inviterText} has invited you${orgText} — the institutional-grade marina &amp; CRE investment platform.</p>
      <p>Click the button below to accept your invitation and set up your account:</p>
      ${emailButton('Accept Invitation', inviteUrl)}
      <p style="color: #64748b; font-size: 13px;">This invitation link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
    `),
  });
}

import sgMail from '@sendgrid/mail';
import { logger } from '../lib/logger';
import crypto from 'crypto';

export async function getSendGridClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@marinamatch.com';
    
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

export async function sendPasswordResetEmail(to: string, resetUrl: string, userName?: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getSendGridClient();
    
    const msg = {
      to,
      from: {
        email: fromEmail,
        name: 'MarinaMatch'
      },
      subject: 'Reset Your MarinaMatch Password',
      text: `Hi${userName ? ' ' + userName : ''},

You requested to reset your password for MarinaMatch.

Click this link to reset your password (expires in 1 hour):
${resetUrl}

If you didn't request this, you can safely ignore this email.

Best regards,
The MarinaMatch Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0891b2; margin: 0;">MarinaMatch</h1>
  </div>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #1e293b;">Reset Your Password</h2>
    <p>Hi${userName ? ' ' + userName : ''},</p>
    <p>You requested to reset your password for MarinaMatch. Click the button below to create a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #0891b2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
    <p style="color: #64748b; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>
  </div>
  
  <div style="text-align: center; color: #94a3b8; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} MarinaMatch. All rights reserved.</p>
  </div>
</body>
</html>
      `
    };
    
    await client.send(msg);
    logger.info({ to }, 'Password reset email sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send password reset email');
    return false;
  }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendEmailVerification(to: string, verificationUrl: string, userName?: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getSendGridClient();
    
    const msg = {
      to,
      from: {
        email: fromEmail,
        name: 'MarinaMatch'
      },
      subject: 'Verify Your MarinaMatch Email',
      text: `Hi${userName ? ' ' + userName : ''},

Welcome to MarinaMatch! Please verify your email address to complete your registration.

Click this link to verify your email (expires in 24 hours):
${verificationUrl}

If you didn't create an account, you can safely ignore this email.

Best regards,
The MarinaMatch Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #343E5C; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #EFEFF4;">
  <div style="background: white; border-radius: 8px; padding: 40px; margin: 20px 0;">
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="width: 48px; height: 48px; background: #29C2AF; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </div>
      <h1 style="color: #343E5C; margin: 0; font-size: 24px;">Welcome to MarinaMatch!</h1>
    </div>
    
    <p>Hi${userName ? ' ' + userName : ''},</p>
    <p>Thank you for signing up! Please verify your email address to complete your registration and start managing marina acquisitions.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}" style="background: #29C2AF; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email Address</a>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
    <p style="color: #64748b; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
  </div>
  
  <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 20px;">
    <p>&copy; ${new Date().getFullYear()} MarinaMatch. All rights reserved.</p>
  </div>
</body>
</html>
      `
    };
    
    await client.send(msg);
    logger.info({ to }, 'Email verification sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send email verification');
    return false;
  }
}

export async function sendMagicLinkEmail(to: string, magicLinkUrl: string, userName?: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getSendGridClient();
    
    const msg = {
      to,
      from: {
        email: fromEmail,
        name: 'MarinaMatch'
      },
      subject: 'Your MarinaMatch Login Link',
      text: `Hi${userName ? ' ' + userName : ''},

Click this link to log in to MarinaMatch (expires in 15 minutes):
${magicLinkUrl}

If you didn't request this link, you can safely ignore this email.

Best regards,
The MarinaMatch Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #343E5C; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #EFEFF4;">
  <div style="background: white; border-radius: 8px; padding: 40px; margin: 20px 0;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #343E5C; margin: 0; font-size: 24px;">Log In to MarinaMatch</h1>
    </div>
    
    <p>Hi${userName ? ' ' + userName : ''},</p>
    <p>Click the button below to securely log in to your account without entering a password:</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLinkUrl}" style="background: #29C2AF; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Log In to MarinaMatch</a>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">This link will expire in 15 minutes for security reasons.</p>
    <p style="color: #64748b; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>
  </div>
  
  <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 20px;">
    <p>&copy; ${new Date().getFullYear()} MarinaMatch. All rights reserved.</p>
  </div>
</body>
</html>
      `
    };
    
    await client.send(msg);
    logger.info({ to }, 'Magic link email sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send magic link email');
    return false;
  }
}

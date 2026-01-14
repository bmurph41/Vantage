import sgMail from '@sendgrid/mail';
import { logger } from '../lib/logger';

async function getSendGridClient() {
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

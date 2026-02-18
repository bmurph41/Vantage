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

export async function sendDashboardReportEmail(to: string, htmlContent: string, dashboardData?: any): Promise<boolean> {
  try {
    const { client, fromEmail } = await getSendGridClient();
    
    const attachments: any[] = [];
    if (dashboardData) {
      const jsonStr = JSON.stringify(dashboardData, null, 2);
      attachments.push({
        content: Buffer.from(jsonStr).toString('base64'),
        filename: `dashboard-report-${new Date().toISOString().split('T')[0]}.json`,
        type: 'application/json',
        disposition: 'attachment',
      });
    }
    
    const msg: any = {
      to,
      from: {
        email: fromEmail,
        name: 'MarinaMatch'
      },
      subject: `MarinaMatch Dashboard Report - ${new Date().toLocaleDateString()}`,
      text: 'Dashboard Report - See HTML version for details',
      html: htmlContent,
    };
    
    if (attachments.length > 0) {
      msg.attachments = attachments;
    }
    
    await client.send(msg);
    logger.info({ to }, 'Dashboard report email sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send dashboard report email');
    return false;
  }
}

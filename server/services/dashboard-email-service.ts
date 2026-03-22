import { logger } from '../lib/logger';
import { getSendGridClient } from './email-service';

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

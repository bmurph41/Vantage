// Notification service for marina launch scheduling
// TODO: Add SendGrid API key when ready to launch for production email notifications

interface NotificationData {
  type: 'launch_scheduled' | 'launch_updated' | 'launch_cancelled';
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  launchId: string;
  scheduledTime: string;
  boatInfo?: string;
  notes?: string;
}

interface StaffNotificationData extends NotificationData {
  staffEmails?: string[];
  priority?: 'normal' | 'high' | 'urgent';
}

class NotificationService {
  private isProduction = process.env.NODE_ENV === 'production';
  
  async notifyCustomer(data: NotificationData): Promise<boolean> {
    try {
      // For now, log the notification (replace with SendGrid when ready)
      console.log('📧 Customer Notification:', {
        to: data.customerEmail || 'customer@example.com',
        type: data.type,
        launchId: data.launchId,
        scheduledTime: data.scheduledTime,
        message: this.getCustomerMessage(data)
      });
      
      // TODO: When ready to launch, uncomment and implement SendGrid
      // if (process.env.SENDGRID_API_KEY) {
      //   return await this.sendEmail({
      //     to: data.customerEmail,
      //     subject: this.getSubject(data.type),
      //     html: this.getCustomerEmailTemplate(data)
      //   });
      // }
      
      return true;
    } catch (error) {
      console.error('Customer notification error:', error);
      return false;
    }
  }
  
  async notifyStaff(data: StaffNotificationData): Promise<boolean> {
    try {
      // Log staff notification
      console.log('📱 Staff Notification:', {
        type: data.type,
        priority: data.priority || 'normal',
        launchId: data.launchId,
        customerName: data.customerName,
        scheduledTime: data.scheduledTime,
        message: this.getStaffMessage(data)
      });
      
      // TODO: When ready to launch, implement email/SMS to staff
      // if (process.env.SENDGRID_API_KEY) {
      //   const staffEmails = data.staffEmails || ['dock@marina.com', 'operations@marina.com'];
      //   return await this.sendBulkEmail(staffEmails, {
      //     subject: `${data.priority === 'urgent' ? '🚨 URGENT: ' : ''}New Launch ${data.type}`,
      //     html: this.getStaffEmailTemplate(data)
      //   });
      // }
      
      return true;
    } catch (error) {
      console.error('Staff notification error:', error);
      return false;
    }
  }
  
  private getCustomerMessage(data: NotificationData): string {
    switch (data.type) {
      case 'launch_scheduled':
        return `Your boat launch has been scheduled for ${new Date(data.scheduledTime).toLocaleString()}. Please arrive 15 minutes early for check-in.`;
      case 'launch_updated':
        return `Your boat launch has been updated. New time: ${new Date(data.scheduledTime).toLocaleString()}.`;
      case 'launch_cancelled':
        return `Your boat launch scheduled for ${new Date(data.scheduledTime).toLocaleString()} has been cancelled.`;
      default:
        return 'Your boat launch status has been updated.';
    }
  }
  
  private getStaffMessage(data: StaffNotificationData): string {
    const timeStr = new Date(data.scheduledTime).toLocaleString();
    switch (data.type) {
      case 'launch_scheduled':
        return `New launch scheduled: ${data.customerName} at ${timeStr}. Boat: ${data.boatInfo || 'Unknown'}`;
      case 'launch_updated':
        return `Launch updated: ${data.customerName} new time ${timeStr}`;
      case 'launch_cancelled':
        return `Launch cancelled: ${data.customerName} was scheduled for ${timeStr}`;
      default:
        return `Launch status update for ${data.customerName}`;
    }
  }
  
  private getSubject(type: string): string {
    switch (type) {
      case 'launch_scheduled':
        return '🚤 Your Boat Launch is Scheduled - Marina Manager';
      case 'launch_updated':
        return '📅 Your Boat Launch has been Updated - Marina Manager';
      case 'launch_cancelled':
        return '❌ Your Boat Launch has been Cancelled - Marina Manager';
      default:
        return '📧 Boat Launch Update - Marina Manager';
    }
  }
}

export const notificationService = new NotificationService();
export type { NotificationData, StaffNotificationData };
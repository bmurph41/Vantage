import { db } from './db';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { notificationService } from './notifications';
import { 
  billingSchedules, payments, customers, 
  type BillingSchedule, type InsertBillingSchedule, type Payment 
} from '@shared/schema';
import { eq, and, lte, gte, sql, lt, or } from 'drizzle-orm';

export class BillingService {
  async createBillingSchedule(schedule: InsertBillingSchedule): Promise<BillingSchedule> {
    const [created] = await db
      .insert(billingSchedules)
      .values(schedule)
      .returning();
    return created;
  }

  async getBillingSchedule(id: string): Promise<BillingSchedule | undefined> {
    const [schedule] = await db
      .select()
      .from(billingSchedules)
      .where(eq(billingSchedules.id, id));
    return schedule;
  }

  async getBillingSchedulesByCustomer(customerId: string): Promise<BillingSchedule[]> {
    return await db
      .select()
      .from(billingSchedules)
      .where(eq(billingSchedules.customerId, customerId));
  }

  async getActiveBillingSchedules(marinaId?: string): Promise<BillingSchedule[]> {
    const conditions = [eq(billingSchedules.status, 'active')];
    if (marinaId) {
      conditions.push(eq(billingSchedules.marinaId, marinaId));
    }
    return await db
      .select()
      .from(billingSchedules)
      .where(and(...conditions));
  }

  async updateBillingSchedule(
    id: string, 
    updates: Partial<InsertBillingSchedule>
  ): Promise<BillingSchedule | undefined> {
    const [updated] = await db
      .update(billingSchedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingSchedules.id, id))
      .returning();
    return updated;
  }

  async pauseBillingSchedule(id: string): Promise<BillingSchedule | undefined> {
    return this.updateBillingSchedule(id, { status: 'paused' } as any);
  }

  async resumeBillingSchedule(id: string): Promise<BillingSchedule | undefined> {
    return this.updateBillingSchedule(id, { status: 'active' } as any);
  }

  async cancelBillingSchedule(id: string): Promise<BillingSchedule | undefined> {
    const schedule = await this.getBillingSchedule(id);
    if (schedule?.stripeSubscriptionId) {
      try {
        await stripeService.cancelSubscription(schedule.stripeSubscriptionId);
      } catch (error) {
        console.error('Failed to cancel Stripe subscription:', error);
      }
    }
    return this.updateBillingSchedule(id, { status: 'cancelled' } as any);
  }

  async enableAutopay(customerId: string, scheduleId: string): Promise<BillingSchedule | undefined> {
    const customer = await storage.getCustomer(customerId);
    if (!customer) throw new Error('Customer not found');

    await storage.updateCustomer(customerId, { autopayEnabled: true });
    return this.updateBillingSchedule(scheduleId, { autopayEnabled: true } as any);
  }

  async disableAutopay(customerId: string, scheduleId: string): Promise<BillingSchedule | undefined> {
    return this.updateBillingSchedule(scheduleId, { autopayEnabled: false } as any);
  }

  async getDueSchedules(): Promise<BillingSchedule[]> {
    const today = new Date();
    return await db
      .select()
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.status, 'active'),
          lte(billingSchedules.nextBillingDate, today),
          or(
            sql`${billingSchedules.endDate} IS NULL`,
            gte(billingSchedules.endDate, today)
          )
        )
      );
  }

  async processRecurringBilling(): Promise<{ processed: number; errors: number; completed: number }> {
    let processed = 0;
    let errors = 0;
    let completed = 0;

    const dueSchedules = await this.getDueSchedules();
    const today = new Date();

    for (const schedule of dueSchedules) {
      try {
        // Check if schedule has expired
        if (schedule.endDate && new Date(schedule.endDate) < today) {
          await this.updateBillingSchedule(schedule.id, { status: 'completed' } as any);
          completed++;
          continue;
        }

        await this.generatePaymentForSchedule(schedule);
        
        // Check if next billing date would be past end date
        const nextDate = this.calculateNextBillingDate(schedule);
        if (schedule.endDate && nextDate > new Date(schedule.endDate)) {
          await this.updateBillingSchedule(schedule.id, { status: 'completed' } as any);
          completed++;
        }
        
        processed++;
      } catch (error) {
        console.error(`Failed to process billing schedule ${schedule.id}:`, error);
        errors++;
      }
    }

    return { processed, errors, completed };
  }

  async generatePaymentForSchedule(schedule: BillingSchedule): Promise<Payment> {
    const dueDate = new Date(schedule.nextBillingDate);
    
    const [payment] = await db
      .insert(payments)
      .values({
        marinaId: schedule.marinaId,
        customerId: schedule.customerId,
        leaseId: schedule.leaseId || undefined,
        amount: schedule.amount,
        dueDate,
        status: 'pending',
        description: schedule.name,
        category: schedule.category || 'recurring',
        billingScheduleId: schedule.id,
      })
      .returning();

    const nextBillingDate = this.calculateNextBillingDate(schedule);
    await this.updateBillingSchedule(schedule.id, { 
      nextBillingDate, 
      lastBilledDate: new Date() 
    } as any);

    if (schedule.autopayEnabled) {
      await this.processAutopayment(payment, schedule);
    } else {
      await this.sendPaymentDueNotification(payment, schedule);
    }

    return payment;
  }

  async processAutopayment(payment: Payment, schedule: BillingSchedule): Promise<void> {
    const customer = await storage.getCustomer(schedule.customerId);
    if (!customer?.stripeCustomerId) {
      console.warn(`Customer ${schedule.customerId} has no Stripe customer ID for autopay`);
      await this.sendPaymentDueNotification(payment, schedule);
      return;
    }

    try {
      const amount = Math.round(parseFloat(payment.amount) * 100);
      const invoice = await stripeService.createInvoice(
        customer.stripeCustomerId,
        [{ description: payment.description || schedule.name, amount }]
      );

      await db
        .update(payments)
        .set({ 
          stripeInvoiceId: invoice.id,
          status: invoice.status === 'paid' ? 'paid' : 'pending',
          paidDate: invoice.status === 'paid' ? new Date() : null,
          paymentMethod: 'autopay'
        })
        .where(eq(payments.id, payment.id));

    } catch (error) {
      console.error('Autopay processing failed:', error);
      await this.sendPaymentDueNotification(payment, schedule);
    }
  }

  private calculateNextBillingDate(schedule: BillingSchedule): Date {
    const current = new Date(schedule.nextBillingDate);
    const next = new Date(current);

    switch (schedule.frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        if (schedule.dayOfMonth) {
          next.setDate(Math.min(schedule.dayOfMonth, this.getDaysInMonth(next)));
        }
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'annually':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }

    return next;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private async sendPaymentDueNotification(payment: Payment, schedule: BillingSchedule): Promise<void> {
    const customer = await storage.getCustomer(schedule.customerId);
    if (!customer) return;

    await notificationService.sendPaymentDueReminder(
      customer,
      parseFloat(payment.amount),
      new Date(payment.dueDate)
    );
  }

  async getOverduePayments(marinaId?: string): Promise<Payment[]> {
    const today = new Date();
    const conditions = [
      eq(payments.status, 'pending'),
      lt(payments.dueDate, today)
    ];
    
    if (marinaId) {
      conditions.push(eq(payments.marinaId, marinaId));
    }

    return await db
      .select()
      .from(payments)
      .where(and(...conditions));
  }

  async getCustomerAccountStatus(customerId: string): Promise<{
    hasOverduePayments: boolean;
    overdueAmount: number;
    oldestOverdueDays: number;
    isBlocked: boolean;
  }> {
    const today = new Date();
    const overduePayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.customerId, customerId),
          eq(payments.status, 'pending'),
          lt(payments.dueDate, today)
        )
      );

    const overdueAmount = overduePayments.reduce(
      (sum, p) => sum + parseFloat(p.amount), 
      0
    );

    let oldestOverdueDays = 0;
    if (overduePayments.length > 0) {
      const oldest = overduePayments.reduce((oldest, p) => {
        const pDate = new Date(p.dueDate);
        return pDate < oldest ? pDate : oldest;
      }, new Date(overduePayments[0].dueDate));
      
      oldestOverdueDays = Math.floor(
        (today.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const isBlocked = oldestOverdueDays > 30 || overdueAmount > 500;

    return {
      hasOverduePayments: overduePayments.length > 0,
      overdueAmount,
      oldestOverdueDays,
      isBlocked
    };
  }

  async checkServiceEligibility(customerId: string): Promise<{
    eligible: boolean;
    reason?: string;
    overdueAmount?: number;
  }> {
    const status = await this.getCustomerAccountStatus(customerId);
    
    if (status.isBlocked) {
      return {
        eligible: false,
        reason: status.oldestOverdueDays > 30 
          ? `Account has payments overdue by ${status.oldestOverdueDays} days`
          : `Outstanding balance of $${status.overdueAmount.toFixed(2)} exceeds limit`,
        overdueAmount: status.overdueAmount
      };
    }

    return { eligible: true };
  }

  async getAgingReport(marinaId?: string): Promise<{
    current: { count: number; total: number };
    days1to30: { count: number; total: number };
    days31to60: { count: number; total: number };
    days61to90: { count: number; total: number };
    over90: { count: number; total: number };
  }> {
    const today = new Date();
    const day30 = new Date(today);
    day30.setDate(day30.getDate() - 30);
    const day60 = new Date(today);
    day60.setDate(day60.getDate() - 60);
    const day90 = new Date(today);
    day90.setDate(day90.getDate() - 90);

    const pendingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'pending'),
          marinaId ? eq(payments.marinaId, marinaId) : sql`1=1`
        )
      );

    const aging = {
      current: { count: 0, total: 0 },
      days1to30: { count: 0, total: 0 },
      days31to60: { count: 0, total: 0 },
      days61to90: { count: 0, total: 0 },
      over90: { count: 0, total: 0 }
    };

    for (const payment of pendingPayments) {
      const dueDate = new Date(payment.dueDate);
      const amount = parseFloat(payment.amount);

      if (dueDate >= today) {
        aging.current.count++;
        aging.current.total += amount;
      } else if (dueDate >= day30) {
        aging.days1to30.count++;
        aging.days1to30.total += amount;
      } else if (dueDate >= day60) {
        aging.days31to60.count++;
        aging.days31to60.total += amount;
      } else if (dueDate >= day90) {
        aging.days61to90.count++;
        aging.days61to90.total += amount;
      } else {
        aging.over90.count++;
        aging.over90.total += amount;
      }
    }

    return aging;
  }

  async getAccountsReceivableSummary(marinaId?: string): Promise<{
    totalOutstanding: number;
    totalOverdue: number;
    autopayEnrolled: number;
    upcomingBillings: number;
    customersWithOverdue: number;
  }> {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const allPending = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'pending'),
          marinaId ? eq(payments.marinaId, marinaId) : sql`1=1`
        )
      );

    const totalOutstanding = allPending.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    const overdue = allPending.filter(p => new Date(p.dueDate) < today);
    const totalOverdue = overdue.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const customersWithOverdueSet = new Set(overdue.map(p => p.customerId));
    
    const activeSchedules = await this.getActiveBillingSchedules(marinaId);
    const autopayEnrolled = activeSchedules.filter(s => s.autopayEnabled).length;
    
    const upcomingBillings = activeSchedules.filter(s => {
      const nextDate = new Date(s.nextBillingDate);
      return nextDate >= today && nextDate <= nextMonth;
    }).length;

    return {
      totalOutstanding,
      totalOverdue,
      autopayEnrolled,
      upcomingBillings,
      customersWithOverdue: customersWithOverdueSet.size
    };
  }
}

export const billingService = new BillingService();

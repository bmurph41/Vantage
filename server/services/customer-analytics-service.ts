import { db } from "../db";
import { marinaCustomers, slipAssignments, boatRegistry, serviceUsage, rentRollEntries } from "@shared/schema";
import { eq, sql, and, gte, lte, desc, count, sum, isNotNull, or } from "drizzle-orm";

/**
 * Customer Analytics Service
 * Provides analytics calculations for marina customers including LTV, tenure, engagement, and churn risk
 * 
 * Revenue Sources:
 * 1. service_usage - Direct service transactions (fuel, repairs, dockage fees)
 * 2. slip_assignments - Monthly slip rental rates (calculated as monthlyRate * tenure months)
 * 3. rent_roll_entries - Monthly rental rates linked to customers
 * 
 * KPI Formulas:
 * - Total Customers: COUNT(marina_customers WHERE orgId = X)
 * - Active Customers: COUNT(marina_customers WHERE status = 'active')
 * - Retention Rate: (Active Customers / Total Customers) * 100
 * - Churn Rate: (Churned Customers / Total Customers) * 100
 * - Avg LTV: AVG(total service_usage.amount per customer + slip revenue)
 * - Avg Tenure: AVG(months since joinDate for active customers)
 */

interface CustomerOverview {
  totalCustomers: number;
  activeCustomers: number;
  prospectCustomers: number;
  churnedCustomers: number;
  avgLifetimeValue: number;
  avgTenure: number; // months
  retentionRate: number; // percentage
  churnRate: number; // percentage
}

interface TopCustomer {
  customerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  lifetimeValue: number;
  tenureMonths: number;
  lastActivityDate: string | null;
  accountType: string;
  slipCount: number;
}

interface CustomerSegment {
  segment: string;
  customerCount: number;
  totalRevenue: number;
  avgRevenue: number;
  percentage: number;
}

export class CustomerAnalyticsService {
  /**
   * Calculate customer lifetime value including all revenue sources
   * Combines: service_usage transactions + slip assignment monthly revenue
   */
  private async calculateCustomerLtv(orgId: string): Promise<Map<string, number>> {
    const customerLtvMap = new Map<string, number>();

    // Get service usage revenue per customer
    const serviceRevenue = await db
      .select({
        customerId: serviceUsage.customerId,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${serviceUsage.amount} AS DECIMAL)), 0)`,
      })
      .from(serviceUsage)
      .where(eq(serviceUsage.orgId, orgId))
      .groupBy(serviceUsage.customerId);

    for (const row of serviceRevenue) {
      customerLtvMap.set(row.customerId, Number(row.totalAmount) || 0);
    }

    // Add slip assignment revenue (monthly rate * months active)
    // Formula: monthlyRate * max(0, months between startDate and endDate/today)
    // Skip entries without valid startDate to avoid inflating revenue
    const slipRevenue = await db
      .select({
        customerId: slipAssignments.customerId,
        slipRevenue: sql<number>`
          COALESCE(SUM(
            CASE 
              WHEN ${slipAssignments.startDate} IS NOT NULL THEN
                CAST(${slipAssignments.monthlyRate} AS DECIMAL) * 
                GREATEST(0, EXTRACT(EPOCH FROM AGE(COALESCE(${slipAssignments.endDate}::date, CURRENT_DATE), ${slipAssignments.startDate}::date)) / 2592000)
              ELSE 0
            END
          ), 0)
        `,
      })
      .from(slipAssignments)
      .where(eq(slipAssignments.orgId, orgId))
      .groupBy(slipAssignments.customerId);

    for (const row of slipRevenue) {
      const existing = customerLtvMap.get(row.customerId) || 0;
      customerLtvMap.set(row.customerId, existing + (Number(row.slipRevenue) || 0));
    }

    // Add rent roll entry revenue (monthly rate * tenure)
    // Formula: monthlyRate * max(0, months between startDate and endDate/today)
    // Skip entries without valid startDate to avoid inflating revenue
    const rentRollRevenue = await db
      .select({
        customerId: rentRollEntries.customerId,
        rentRevenue: sql<number>`
          COALESCE(SUM(
            CASE 
              WHEN ${rentRollEntries.startDate} IS NOT NULL THEN
                CAST(${rentRollEntries.monthlyRate} AS DECIMAL) * 
                GREATEST(0, EXTRACT(EPOCH FROM AGE(COALESCE(${rentRollEntries.endDate}::date, CURRENT_DATE), ${rentRollEntries.startDate}::date)) / 2592000)
              ELSE 0
            END
          ), 0)
        `,
      })
      .from(rentRollEntries)
      .where(
        and(
          eq(rentRollEntries.orgId, orgId),
          isNotNull(rentRollEntries.customerId)
        )
      )
      .groupBy(rentRollEntries.customerId);

    for (const row of rentRollRevenue) {
      if (row.customerId) {
        const existing = customerLtvMap.get(row.customerId) || 0;
        customerLtvMap.set(row.customerId, existing + (Number(row.rentRevenue) || 0));
      }
    }

    return customerLtvMap;
  }

  /**
   * Get overview metrics for customer analytics dashboard
   */
  async getOverview(orgId: string): Promise<CustomerOverview> {
    // Count customers by status
    const statusCounts = await db
      .select({
        status: marinaCustomers.status,
        count: count(),
      })
      .from(marinaCustomers)
      .where(eq(marinaCustomers.orgId, orgId))
      .groupBy(marinaCustomers.status);

    const totalCustomers = statusCounts.reduce((sum, row) => sum + Number(row.count), 0);
    const activeCustomers = Number(statusCounts.find(r => r.status === 'active')?.count || 0);
    const prospectCustomers = Number(statusCounts.find(r => r.status === 'prospect')?.count || 0);
    const churnedCustomers = Number(statusCounts.find(r => r.status === 'churned')?.count || 0);

    // Calculate comprehensive LTV using all revenue sources
    const customerLtvMap = await this.calculateCustomerLtv(orgId);
    const ltvValues = Array.from(customerLtvMap.values());
    const avgLifetimeValue = ltvValues.length > 0 
      ? ltvValues.reduce((sum, val) => sum + val, 0) / ltvValues.length 
      : 0;

    // Calculate average tenure (months since join date for active customers)
    // Edge case: Handle null joinDate values
    const tenureResult = await db
      .select({
        avgTenure: sql<number>`
          COALESCE(
            AVG(
              CASE 
                WHEN ${marinaCustomers.joinDate} IS NOT NULL 
                THEN EXTRACT(EPOCH FROM AGE(CURRENT_DATE, ${marinaCustomers.joinDate})) / 2592000
                ELSE 0
              END
            ),
            0
          )
        `,
      })
      .from(marinaCustomers)
      .where(
        and(
          eq(marinaCustomers.orgId, orgId),
          eq(marinaCustomers.status, 'active')
        )
      );

    const avgTenure = Math.max(0, Number(tenureResult[0]?.avgTenure || 0));

    // Calculate retention and churn rates
    // Note: Retention = Active / (Active + Churned) is more accurate industry formula
    // But current formula uses Active / Total which includes prospects
    const activeAndChurned = activeCustomers + churnedCustomers;
    const retentionRate = activeAndChurned > 0 
      ? (activeCustomers / activeAndChurned) * 100 
      : (activeCustomers > 0 ? 100 : 0);
    const churnRate = activeAndChurned > 0 
      ? (churnedCustomers / activeAndChurned) * 100 
      : 0;

    return {
      totalCustomers,
      activeCustomers,
      prospectCustomers,
      churnedCustomers,
      avgLifetimeValue: Math.round(avgLifetimeValue * 100) / 100, // Round to 2 decimals
      avgTenure: Math.round(avgTenure * 10) / 10, // Round to 1 decimal
      retentionRate: Math.round(retentionRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
    };
  }

  /**
   * Get top customers by lifetime value
   */
  async getTopCustomers(orgId: string, limit: number = 20): Promise<TopCustomer[]> {
    // Get all customers for the org
    const customers = await db
      .select({
        customerId: marinaCustomers.id,
        firstName: marinaCustomers.firstName,
        lastName: marinaCustomers.lastName,
        email: marinaCustomers.email,
        joinDate: marinaCustomers.joinDate,
        lastActivityDate: marinaCustomers.lastActivityDate,
        accountType: marinaCustomers.accountType,
      })
      .from(marinaCustomers)
      .where(eq(marinaCustomers.orgId, orgId));

    // Get comprehensive LTV map
    const customerLtvMap = await this.calculateCustomerLtv(orgId);

    // Get slip counts per customer
    const slipCounts = await db
      .select({
        customerId: slipAssignments.customerId,
        count: count(),
      })
      .from(slipAssignments)
      .where(
        and(
          eq(slipAssignments.orgId, orgId),
          eq(slipAssignments.status, 'active')
        )
      )
      .groupBy(slipAssignments.customerId);

    const slipCountMap = new Map(slipCounts.map(s => [s.customerId, Number(s.count)]));

    // Calculate tenure and combine data
    const now = new Date();
    const customersWithLtv = customers.map(customer => {
      const joinDate = customer.joinDate ? new Date(customer.joinDate) : now;
      const tenureMonths = Math.max(0, Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));

      return {
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        lifetimeValue: customerLtvMap.get(customer.customerId) || 0,
        tenureMonths,
        lastActivityDate: customer.lastActivityDate?.toString() || null,
        accountType: customer.accountType,
        slipCount: slipCountMap.get(customer.customerId) || 0,
      };
    });

    // Sort by LTV descending and limit
    return customersWithLtv
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, limit)
      .map(c => ({
        ...c,
        lifetimeValue: Math.round(c.lifetimeValue * 100) / 100,
      }));
  }

  /**
   * Get customer segments (by account type and value)
   */
  async getCustomerSegments(orgId: string): Promise<CustomerSegment[]> {
    // Get all customers with their account types
    const customers = await db
      .select({
        customerId: marinaCustomers.id,
        accountType: marinaCustomers.accountType,
      })
      .from(marinaCustomers)
      .where(eq(marinaCustomers.orgId, orgId));

    // Get comprehensive LTV map
    const customerLtvMap = await this.calculateCustomerLtv(orgId);

    // Group by account type
    const segmentMap = new Map<string, { count: number; revenue: number }>();
    
    for (const customer of customers) {
      const accountType = customer.accountType || 'unknown';
      const revenue = customerLtvMap.get(customer.customerId) || 0;
      
      const existing = segmentMap.get(accountType) || { count: 0, revenue: 0 };
      segmentMap.set(accountType, {
        count: existing.count + 1,
        revenue: existing.revenue + revenue,
      });
    }

    const totalCustomers = customers.length;
    
    // Convert to array and calculate percentages
    const segments: CustomerSegment[] = Array.from(segmentMap.entries())
      .map(([segment, data]) => ({
        segment,
        customerCount: data.count,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        avgRevenue: data.count > 0 
          ? Math.round((data.revenue / data.count) * 100) / 100 
          : 0,
        percentage: totalCustomers > 0 
          ? Math.round((data.count / totalCustomers) * 10000) / 100 
          : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return segments;
  }

  /**
   * Get customers at churn risk (no activity in 90+ days and active status)
   * Risk levels:
   * - High: > 180 days since last activity
   * - Medium: > 90 days since last activity
   * - Low: Active customers with recent activity (not included in results)
   */
  async getChurnRiskCustomers(orgId: string): Promise<Array<{
    customerId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    daysSinceLastActivity: number;
    lifetimeValue: number;
    riskLevel: 'high' | 'medium' | 'low';
  }>> {
    // Get active customers
    const activeCustomers = await db
      .select({
        customerId: marinaCustomers.id,
        firstName: marinaCustomers.firstName,
        lastName: marinaCustomers.lastName,
        email: marinaCustomers.email,
        lastActivityDate: marinaCustomers.lastActivityDate,
        joinDate: marinaCustomers.joinDate,
      })
      .from(marinaCustomers)
      .where(
        and(
          eq(marinaCustomers.orgId, orgId),
          eq(marinaCustomers.status, 'active')
        )
      );

    // Get comprehensive LTV map
    const customerLtvMap = await this.calculateCustomerLtv(orgId);

    const now = Date.now();
    const result = activeCustomers
      .map(customer => {
        // Use lastActivityDate, fallback to joinDate, fallback to very old date
        let lastActivity: Date;
        if (customer.lastActivityDate) {
          lastActivity = new Date(customer.lastActivityDate);
        } else if (customer.joinDate) {
          lastActivity = new Date(customer.joinDate);
        } else {
          lastActivity = new Date(0); // Jan 1, 1970 - will be high risk
        }

        const daysSince = Math.max(0, Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)));
        
        let riskLevel: 'high' | 'medium' | 'low' = 'low';
        if (daysSince > 180) riskLevel = 'high';
        else if (daysSince > 90) riskLevel = 'medium';

        return {
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          daysSinceLastActivity: daysSince,
          lifetimeValue: Math.round((customerLtvMap.get(customer.customerId) || 0) * 100) / 100,
          riskLevel,
        };
      })
      .filter(c => c.riskLevel !== 'low') // Only include at-risk customers
      .sort((a, b) => {
        // Sort by risk level (high first) then by days since activity
        const riskOrder = { high: 0, medium: 1, low: 2 };
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }
        return b.daysSinceLastActivity - a.daysSinceLastActivity;
      });

    return result;
  }

  /**
   * Get LTV distribution (buckets of customers by revenue)
   * Buckets are designed for marina industry typical values
   */
  async getLtvDistribution(orgId: string): Promise<Array<{
    bucket: string;
    customerCount: number;
    minValue: number;
    maxValue: number;
  }>> {
    // Define LTV buckets with proper formatting
    const buckets = [
      { name: '$0 - $500', min: 0, max: 500 },
      { name: '$500 - $1,000', min: 500, max: 1000 },
      { name: '$1,000 - $2,500', min: 1000, max: 2500 },
      { name: '$2,500 - $5,000', min: 2500, max: 5000 },
      { name: '$5,000 - $10,000', min: 5000, max: 10000 },
      { name: '$10,000 - $25,000', min: 10000, max: 25000 },
      { name: '$25,000 - $50,000', min: 25000, max: 50000 },
      { name: '$50,000+', min: 50000, max: Number.MAX_SAFE_INTEGER },
    ];

    // Get comprehensive LTV for all customers
    const customerLtvMap = await this.calculateCustomerLtv(orgId);
    const ltvValues = Array.from(customerLtvMap.values());

    // Also count customers with zero LTV (no transactions)
    const allCustomers = await db
      .select({ id: marinaCustomers.id })
      .from(marinaCustomers)
      .where(eq(marinaCustomers.orgId, orgId));

    // Ensure all customers are represented
    for (const customer of allCustomers) {
      if (!customerLtvMap.has(customer.id)) {
        customerLtvMap.set(customer.id, 0);
      }
    }

    const allLtvValues = Array.from(customerLtvMap.values());

    const distribution = buckets.map(bucket => {
      const count = allLtvValues.filter(ltv => {
        return ltv >= bucket.min && ltv < bucket.max;
      }).length;

      return {
        bucket: bucket.name,
        customerCount: count,
        minValue: bucket.min,
        maxValue: bucket.max === Number.MAX_SAFE_INTEGER ? -1 : bucket.max, // Use -1 to indicate unbounded
      };
    });

    return distribution;
  }
}

export const customerAnalyticsService = new CustomerAnalyticsService();

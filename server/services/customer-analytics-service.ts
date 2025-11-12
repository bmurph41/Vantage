import { db } from "../db";
import { marinaCustomers, slipAssignments, boatRegistry, serviceUsage, fuelSales } from "@shared/schema";
import { eq, sql, and, gte, lte, desc, count, sum } from "drizzle-orm";

/**
 * Customer Analytics Service
 * Provides analytics calculations for marina customers including LTV, tenure, engagement, and churn risk
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
    const activeCustomers = statusCounts.find(r => r.status === 'active')?.count || 0;
    const prospectCustomers = statusCounts.find(r => r.status === 'prospect')?.count || 0;
    const churnedCustomers = statusCounts.find(r => r.status === 'churned')?.count || 0;

    // Calculate average LTV
    const ltvResult = await db
      .select({
        avgLtv: sql<number>`AVG(lifetime_revenue)`,
      })
      .from(
        db.$with('customer_ltv').as(
          db
            .select({
              customerId: serviceUsage.customerId,
              lifetime_revenue: sql<number>`COALESCE(SUM(${serviceUsage.amount}), 0)`,
            })
            .from(serviceUsage)
            .where(eq(serviceUsage.orgId, orgId))
            .groupBy(serviceUsage.customerId)
        )
      )
      .from(sql`customer_ltv`);

    const avgLifetimeValue = Number(ltvResult[0]?.avgLtv || 0);

    // Calculate average tenure (months since join date for active customers)
    const tenureResult = await db
      .select({
        avgTenure: sql<number>`AVG(EXTRACT(EPOCH FROM AGE(CURRENT_DATE, ${marinaCustomers.joinDate})) / 2592000)`, // seconds to months
      })
      .from(marinaCustomers)
      .where(
        and(
          eq(marinaCustomers.orgId, orgId),
          eq(marinaCustomers.status, 'active')
        )
      );

    const avgTenure = Number(tenureResult[0]?.avgTenure || 0);

    // Calculate retention and churn rates
    const retentionRate = totalCustomers > 0 
      ? (Number(activeCustomers) / totalCustomers) * 100 
      : 0;
    const churnRate = totalCustomers > 0 
      ? (Number(churnedCustomers) / totalCustomers) * 100 
      : 0;

    return {
      totalCustomers,
      activeCustomers: Number(activeCustomers),
      prospectCustomers: Number(prospectCustomers),
      churnedCustomers: Number(churnedCustomers),
      avgLifetimeValue,
      avgTenure,
      retentionRate,
      churnRate,
    };
  }

  /**
   * Get top customers by lifetime value
   */
  async getTopCustomers(orgId: string, limit: number = 20): Promise<TopCustomer[]> {
    const topCustomers = await db
      .select({
        customerId: marinaCustomers.id,
        firstName: marinaCustomers.firstName,
        lastName: marinaCustomers.lastName,
        email: marinaCustomers.email,
        lifetimeValue: sql<number>`COALESCE(SUM(${serviceUsage.amount}), 0)`,
        tenureMonths: sql<number>`EXTRACT(EPOCH FROM AGE(CURRENT_DATE, ${marinaCustomers.joinDate})) / 2592000`,
        lastActivityDate: marinaCustomers.lastActivityDate,
        accountType: marinaCustomers.accountType,
        slipCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${slipAssignments} 
          WHERE ${slipAssignments.customerId} = ${marinaCustomers.id} 
          AND ${slipAssignments.status} = 'active'
        )`,
      })
      .from(marinaCustomers)
      .leftJoin(serviceUsage, eq(serviceUsage.customerId, marinaCustomers.id))
      .where(eq(marinaCustomers.orgId, orgId))
      .groupBy(
        marinaCustomers.id,
        marinaCustomers.firstName,
        marinaCustomers.lastName,
        marinaCustomers.email,
        marinaCustomers.joinDate,
        marinaCustomers.lastActivityDate,
        marinaCustomers.accountType
      )
      .orderBy(desc(sql`COALESCE(SUM(${serviceUsage.amount}), 0)`))
      .limit(limit);

    return topCustomers.map(customer => ({
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      lifetimeValue: Number(customer.lifetimeValue),
      tenureMonths: Math.round(Number(customer.tenureMonths)),
      lastActivityDate: customer.lastActivityDate?.toString() || null,
      accountType: customer.accountType,
      slipCount: Number(customer.slipCount),
    }));
  }

  /**
   * Get customer segments (by account type and value)
   */
  async getCustomerSegments(orgId: string): Promise<CustomerSegment[]> {
    // Segment by account type
    const accountTypeSegments = await db
      .select({
        accountType: marinaCustomers.accountType,
        customerCount: count(),
        totalRevenue: sql<number>`COALESCE(SUM(revenue), 0)`,
      })
      .from(
        db.$with('customer_revenue').as(
          db
            .select({
              customerId: marinaCustomers.id,
              accountType: marinaCustomers.accountType,
              revenue: sql<number>`COALESCE(SUM(${serviceUsage.amount}), 0)`,
            })
            .from(marinaCustomers)
            .leftJoin(serviceUsage, eq(serviceUsage.customerId, marinaCustomers.id))
            .where(eq(marinaCustomers.orgId, orgId))
            .groupBy(marinaCustomers.id, marinaCustomers.accountType)
        )
      )
      .from(sql`customer_revenue`)
      .groupBy(sql`account_type`)
      .orderBy(desc(sql`COALESCE(SUM(revenue), 0)`));

    const totalCustomers = accountTypeSegments.reduce((sum, seg) => sum + Number(seg.customerCount), 0);
    const totalRevenue = accountTypeSegments.reduce((sum, seg) => sum + Number(seg.totalRevenue), 0);

    return accountTypeSegments.map(seg => ({
      segment: seg.accountType,
      customerCount: Number(seg.customerCount),
      totalRevenue: Number(seg.totalRevenue),
      avgRevenue: Number(seg.customerCount) > 0 
        ? Number(seg.totalRevenue) / Number(seg.customerCount) 
        : 0,
      percentage: totalCustomers > 0 
        ? (Number(seg.customerCount) / totalCustomers) * 100 
        : 0,
    }));
  }

  /**
   * Get customers at churn risk (no activity in 90+ days and active status)
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
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const atRiskCustomers = await db
      .select({
        customerId: marinaCustomers.id,
        firstName: marinaCustomers.firstName,
        lastName: marinaCustomers.lastName,
        email: marinaCustomers.email,
        lastActivityDate: marinaCustomers.lastActivityDate,
        lifetimeValue: sql<number>`COALESCE(SUM(${serviceUsage.amount}), 0)`,
      })
      .from(marinaCustomers)
      .leftJoin(serviceUsage, eq(serviceUsage.customerId, marinaCustomers.id))
      .where(
        and(
          eq(marinaCustomers.orgId, orgId),
          eq(marinaCustomers.status, 'active')
        )
      )
      .groupBy(
        marinaCustomers.id,
        marinaCustomers.firstName,
        marinaCustomers.lastName,
        marinaCustomers.email,
        marinaCustomers.lastActivityDate
      );

    const result = atRiskCustomers
      .map(customer => {
        const lastActivity = customer.lastActivityDate 
          ? new Date(customer.lastActivityDate)
          : new Date(0); // Very old date if no activity
        const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        
        let riskLevel: 'high' | 'medium' | 'low' = 'low';
        if (daysSince > 180) riskLevel = 'high';
        else if (daysSince > 90) riskLevel = 'medium';

        return {
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          daysSinceLastActivity: daysSince,
          lifetimeValue: Number(customer.lifetimeValue),
          riskLevel,
        };
      })
      .filter(c => c.daysSinceLastActivity > 90) // Only include at-risk customers
      .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);

    return result;
  }

  /**
   * Get LTV distribution (buckets of customers by revenue)
   */
  async getLtvDistribution(orgId: string): Promise<Array<{
    bucket: string;
    customerCount: number;
    minValue: number;
    maxValue: number;
  }>> {
    // Define LTV buckets
    const buckets = [
      { name: '$0 - $500', min: 0, max: 500 },
      { name: '$500 - $1,000', min: 500, max: 1000 },
      { name: '$1,000 - $2,500', min: 1000, max: 2500 },
      { name: '$2,500 - $5,000', min: 2500, max: 5000 },
      { name: '$5,000 - $10,000', min: 5000, max: 10000 },
      { name: '$10,000+', min: 10000, max: Number.MAX_SAFE_INTEGER },
    ];

    const customerLtvs = await db
      .select({
        customerId: serviceUsage.customerId,
        ltv: sql<number>`SUM(${serviceUsage.amount})`,
      })
      .from(serviceUsage)
      .where(eq(serviceUsage.orgId, orgId))
      .groupBy(serviceUsage.customerId);

    const distribution = buckets.map(bucket => {
      const count = customerLtvs.filter(c => {
        const ltv = Number(c.ltv);
        return ltv >= bucket.min && ltv < bucket.max;
      }).length;

      return {
        bucket: bucket.name,
        customerCount: count,
        minValue: bucket.min,
        maxValue: bucket.max === Number.MAX_SAFE_INTEGER ? Infinity : bucket.max,
      };
    });

    return distribution;
  }
}

export const customerAnalyticsService = new CustomerAnalyticsService();

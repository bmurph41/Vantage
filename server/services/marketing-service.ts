import { db } from '../db';
import {
  marketingCampaigns,
  marketingExpenses,
  leadAttribution,
  emailCampaigns,
  contacts,
  leads,
  deals,
} from '@shared/schema';
import { eq, and, desc, sql, inArray, gte, lte } from 'drizzle-orm';
import type {
  MarketingCampaign,
  InsertMarketingCampaign,
  UpdateMarketingCampaign,
  MarketingExpense,
  InsertMarketingExpense,
  UpdateMarketingExpense,
  LeadAttribution,
  InsertLeadAttribution,
  EmailCampaign,
  InsertEmailCampaign,
} from '@shared/schema';

export class MarketingService {
  // ================================================================================
  // MARKETING CAMPAIGNS
  // ================================================================================

  /**
   * Get all marketing campaigns for an organization
   */
  async getCampaigns(
    orgId: string,
    filters?: {
      status?: string;
      channel?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<MarketingCampaign[]> {
    let conditions = eq(marketingCampaigns.orgId, orgId);

    if (filters?.status) {
      conditions = and(conditions, eq(marketingCampaigns.status, filters.status as any));
    }
    if (filters?.channel) {
      conditions = and(conditions, eq(marketingCampaigns.channel, filters.channel as any));
    }
    if (filters?.startDate) {
      conditions = and(conditions, gte(marketingCampaigns.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions = and(conditions, lte(marketingCampaigns.endDate, filters.endDate));
    }

    const campaigns = await db
      .select()
      .from(marketingCampaigns)
      .where(conditions)
      .orderBy(desc(marketingCampaigns.createdAt));

    return campaigns;
  }

  /**
   * Get a single campaign by ID
   */
  async getCampaignById(id: string, orgId: string): Promise<MarketingCampaign | null> {
    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.orgId, orgId)))
      .limit(1);

    return campaign || null;
  }

  /**
   * Create a new marketing campaign
   */
  async createCampaign(orgId: string, data: InsertMarketingCampaign): Promise<MarketingCampaign> {
    const [campaign] = await db
      .insert(marketingCampaigns)
      .values({
        ...data,
        orgId,
      })
      .returning();

    return campaign;
  }

  /**
   * Update a marketing campaign
   */
  async updateCampaign(
    id: string,
    orgId: string,
    data: UpdateMarketingCampaign
  ): Promise<MarketingCampaign | null> {
    const [campaign] = await db
      .update(marketingCampaigns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.orgId, orgId)))
      .returning();

    return campaign || null;
  }

  /**
   * Delete a marketing campaign
   */
  async deleteCampaign(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(marketingCampaigns)
      .where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.orgId, orgId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // MARKETING EXPENSES
  // ================================================================================

  /**
   * Get all marketing expenses for an organization
   */
  async getExpenses(
    orgId: string,
    filters?: {
      campaignId?: string;
      status?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<MarketingExpense[]> {
    let conditions = eq(marketingExpenses.orgId, orgId);

    if (filters?.campaignId) {
      conditions = and(conditions, eq(marketingExpenses.campaignId, filters.campaignId));
    }
    if (filters?.status) {
      conditions = and(conditions, eq(marketingExpenses.status, filters.status as any));
    }
    if (filters?.category) {
      conditions = and(conditions, eq(marketingExpenses.category, filters.category as any));
    }
    if (filters?.startDate) {
      conditions = and(conditions, gte(marketingExpenses.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions = and(conditions, lte(marketingExpenses.date, filters.endDate));
    }

    const expenses = await db
      .select()
      .from(marketingExpenses)
      .where(conditions)
      .orderBy(desc(marketingExpenses.date));

    return expenses;
  }

  /**
   * Get a single expense by ID
   */
  async getExpenseById(id: string, orgId: string): Promise<MarketingExpense | null> {
    const [expense] = await db
      .select()
      .from(marketingExpenses)
      .where(and(eq(marketingExpenses.id, id), eq(marketingExpenses.orgId, orgId)))
      .limit(1);

    return expense || null;
  }

  /**
   * Create a new marketing expense
   */
  async createExpense(
    orgId: string,
    userId: string,
    data: InsertMarketingExpense
  ): Promise<MarketingExpense> {
    // Validate campaign ownership if campaignId is provided
    if (data.campaignId) {
      const campaign = await this.getCampaignById(data.campaignId, orgId);
      if (!campaign) {
        throw new Error('Campaign not found or does not belong to your organization');
      }
    }

    const [expense] = await db
      .insert(marketingExpenses)
      .values({
        ...data,
        orgId,
        createdBy: userId,
      })
      .returning();

    return expense;
  }

  /**
   * Update a marketing expense
   */
  async updateExpense(
    id: string,
    orgId: string,
    data: UpdateMarketingExpense
  ): Promise<MarketingExpense | null> {
    // Validate campaign ownership if campaignId is being updated
    if (data.campaignId) {
      const campaign = await this.getCampaignById(data.campaignId, orgId);
      if (!campaign) {
        throw new Error('Campaign not found or does not belong to your organization');
      }
    }

    const [expense] = await db
      .update(marketingExpenses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(marketingExpenses.id, id), eq(marketingExpenses.orgId, orgId)))
      .returning();

    return expense || null;
  }

  /**
   * Approve a marketing expense
   */
  async approveExpense(id: string, orgId: string, userId: string): Promise<MarketingExpense | null> {
    const [expense] = await db
      .update(marketingExpenses)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(marketingExpenses.id, id), eq(marketingExpenses.orgId, orgId)))
      .returning();

    return expense || null;
  }

  /**
   * Mark expense as paid
   */
  async markExpensePaid(
    id: string,
    orgId: string,
    paidDate: string
  ): Promise<MarketingExpense | null> {
    const [expense] = await db
      .update(marketingExpenses)
      .set({
        status: 'paid',
        paidDate,
        updatedAt: new Date(),
      })
      .where(and(eq(marketingExpenses.id, id), eq(marketingExpenses.orgId, orgId)))
      .returning();

    return expense || null;
  }

  /**
   * Delete a marketing expense
   */
  async deleteExpense(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(marketingExpenses)
      .where(and(eq(marketingExpenses.id, id), eq(marketingExpenses.orgId, orgId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // LEAD ATTRIBUTION
  // ================================================================================

  /**
   * Get all lead attributions for an organization
   */
  async getAttributions(
    orgId: string,
    filters?: {
      campaignId?: string;
      attributionType?: string;
    }
  ): Promise<LeadAttribution[]> {
    let conditions = eq(leadAttribution.orgId, orgId);

    if (filters?.campaignId) {
      conditions = and(conditions, eq(leadAttribution.campaignId, filters.campaignId));
    }
    if (filters?.attributionType) {
      conditions = and(conditions, eq(leadAttribution.attributionType, filters.attributionType as any));
    }

    const attributions = await db
      .select()
      .from(leadAttribution)
      .where(conditions)
      .orderBy(desc(leadAttribution.touchDate));

    return attributions;
  }

  /**
   * Create a new lead attribution
   */
  async createAttribution(orgId: string, data: InsertLeadAttribution): Promise<LeadAttribution> {
    // Validate campaign ownership if campaignId is provided
    if (data.campaignId) {
      const campaign = await this.getCampaignById(data.campaignId, orgId);
      if (!campaign) {
        throw new Error('Campaign not found or does not belong to your organization');
      }
    }

    // Validate contact/lead/deal ownership if provided
    if (data.contactId) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, data.contactId), eq(contacts.orgId, orgId)))
        .limit(1);
      if (!contact) {
        throw new Error('Contact not found or does not belong to your organization');
      }
    }

    if (data.leadId) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, data.leadId), eq(leads.orgId, orgId)))
        .limit(1);
      if (!lead) {
        throw new Error('Lead not found or does not belong to your organization');
      }
    }

    if (data.dealId) {
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, data.dealId), eq(deals.orgId, orgId)))
        .limit(1);
      if (!deal) {
        throw new Error('Deal not found or does not belong to your organization');
      }
    }

    const [attribution] = await db
      .insert(leadAttribution)
      .values({
        ...data,
        orgId,
      })
      .returning();

    return attribution;
  }

  /**
   * Delete a lead attribution
   */
  async deleteAttribution(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(leadAttribution)
      .where(and(eq(leadAttribution.id, id), eq(leadAttribution.orgId, orgId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // EMAIL CAMPAIGNS
  // ================================================================================

  /**
   * Get all email campaigns for an organization
   */
  async getEmailCampaigns(
    orgId: string,
    filters?: {
      campaignId?: string;
      platform?: string;
    }
  ): Promise<EmailCampaign[]> {
    let conditions = eq(emailCampaigns.orgId, orgId);

    if (filters?.campaignId) {
      conditions = and(conditions, eq(emailCampaigns.campaignId, filters.campaignId));
    }
    if (filters?.platform) {
      conditions = and(conditions, eq(emailCampaigns.platform, filters.platform as any));
    }

    const campaigns = await db
      .select()
      .from(emailCampaigns)
      .where(conditions)
      .orderBy(desc(emailCampaigns.sentDate));

    return campaigns;
  }

  /**
   * Create or update an email campaign (from sync)
   */
  async upsertEmailCampaign(
    orgId: string,
    data: InsertEmailCampaign
  ): Promise<EmailCampaign> {
    // Validate campaign ownership if campaignId is provided
    if (data.campaignId) {
      const campaign = await this.getCampaignById(data.campaignId, orgId);
      if (!campaign) {
        throw new Error('Campaign not found or does not belong to your organization');
      }
    }

    // Check if email campaign already exists by externalId
    const [existing] = await db
      .select()
      .from(emailCampaigns)
      .where(
        and(
          eq(emailCampaigns.orgId, orgId),
          eq(emailCampaigns.externalId, data.externalId),
          eq(emailCampaigns.platform, data.platform)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(emailCampaigns)
        .set({
          ...data,
          syncedAt: new Date(),
        })
        .where(eq(emailCampaigns.id, existing.id))
        .returning();

      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(emailCampaigns)
        .values({
          ...data,
          orgId,
        })
        .returning();

      return created;
    }
  }

  // ================================================================================
  // ANALYTICS & METRICS
  // ================================================================================

  /**
   * Get campaign performance metrics
   */
  async getCampaignMetrics(campaignId: string, orgId: string) {
    // Validate campaign ownership
    const campaign = await this.getCampaignById(campaignId, orgId);
    if (!campaign) {
      throw new Error('Campaign not found or does not belong to your organization');
    }

    // Get total expenses
    const expenseResults = await db
      .select({
        totalSpent: sql<number>`COALESCE(SUM(${marketingExpenses.amount}), 0)`,
        expenseCount: sql<number>`COUNT(*)`,
      })
      .from(marketingExpenses)
      .where(
        and(
          eq(marketingExpenses.campaignId, campaignId),
          eq(marketingExpenses.orgId, orgId)
        )
      );

    // Get attribution metrics
    const attributionResults = await db
      .select({
        totalLeads: sql<number>`COUNT(DISTINCT CASE WHEN ${leadAttribution.leadId} IS NOT NULL THEN ${leadAttribution.leadId} END)`,
        totalContacts: sql<number>`COUNT(DISTINCT CASE WHEN ${leadAttribution.contactId} IS NOT NULL THEN ${leadAttribution.contactId} END)`,
        totalDeals: sql<number>`COUNT(DISTINCT CASE WHEN ${leadAttribution.dealId} IS NOT NULL THEN ${leadAttribution.dealId} END)`,
        totalRevenue: sql<number>`COALESCE(SUM(${leadAttribution.revenue}), 0)`,
      })
      .from(leadAttribution)
      .where(
        and(
          eq(leadAttribution.campaignId, campaignId),
          eq(leadAttribution.orgId, orgId)
        )
      );

    const totalSpent = Number(expenseResults[0]?.totalSpent || 0);
    const totalRevenue = Number(attributionResults[0]?.totalRevenue || 0);
    const roas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

    return {
      totalSpent,
      totalRevenue,
      roas,
      expenseCount: Number(expenseResults[0]?.expenseCount || 0),
      totalLeads: Number(attributionResults[0]?.totalLeads || 0),
      totalContacts: Number(attributionResults[0]?.totalContacts || 0),
      totalDeals: Number(attributionResults[0]?.totalDeals || 0),
    };
  }

  /**
   * Get organization-wide marketing metrics
   */
  async getOrganizationMetrics(orgId: string) {
    // Total spend across all campaigns
    const expenseResults = await db
      .select({
        totalSpent: sql<number>`COALESCE(SUM(${marketingExpenses.amount}), 0)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${marketingExpenses.status} = 'paid' THEN ${marketingExpenses.amount} ELSE 0 END), 0)`,
      })
      .from(marketingExpenses)
      .where(eq(marketingExpenses.orgId, orgId));

    // Campaign counts
    const campaignResults = await db
      .select({
        totalCampaigns: sql<number>`COUNT(*)`,
        activeCampaigns: sql<number>`COUNT(CASE WHEN ${marketingCampaigns.status} = 'active' THEN 1 END)`,
      })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.orgId, orgId));

    // Attribution totals
    const attributionResults = await db
      .select({
        totalLeads: sql<number>`COUNT(DISTINCT ${leadAttribution.leadId})`,
        totalRevenue: sql<number>`COALESCE(SUM(${leadAttribution.revenue}), 0)`,
      })
      .from(leadAttribution)
      .where(eq(leadAttribution.orgId, orgId));

    const totalSpent = Number(expenseResults[0]?.totalSpent || 0);
    const totalRevenue = Number(attributionResults[0]?.totalRevenue || 0);
    const roas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

    return {
      totalSpent,
      paidAmount: Number(expenseResults[0]?.paidAmount || 0),
      totalCampaigns: Number(campaignResults[0]?.totalCampaigns || 0),
      activeCampaigns: Number(campaignResults[0]?.activeCampaigns || 0),
      totalLeads: Number(attributionResults[0]?.totalLeads || 0),
      totalRevenue,
      roas,
    };
  }
}

export const marketingService = new MarketingService();

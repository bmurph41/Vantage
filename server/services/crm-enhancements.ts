/**
 * CRM Enhancements Service
 * ========================
 * Extended CRM capabilities for Vantage:
 * - Deal Comparison Workspace
 * - Email Open/Click Tracking
 * - Calendar Sync Bridge
 * - Company Hierarchy / Org Chart
 * - Relationship Strength Scoring
 * - Bulk Email from CRM Segments
 * - Quick VDR Creation from Deal
 */

import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import Decimal from 'decimal.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DealComparisonMetrics {
  dealId: string;
  dealName: string;
  purchasePrice: number;
  capRate: number;
  noi: number;
  irr: number;
  dscr: number;
  ltv: number;
  market: string;
  assetClass: string;
  holdPeriod: number;
  riskScore: number | null;
  closingDate: string | null;
}

export interface SavedComparison {
  id: string;
  orgId: string;
  name: string;
  dealIds: string[];
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTrackingEvent {
  id: string;
  emailId: string;
  trackingType: 'open' | 'click';
  linkId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

export interface EmailEngagement {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  byDate: { date: string; opens: number; clicks: number }[];
}

export interface CalendarEvent {
  id: string;
  orgId: string;
  userId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  location: string | null;
  attendees: string[];
  externalCalendarId: string | null;
  externalProvider: 'google' | 'outlook' | null;
  linkedTaskId: string | null;
  linkedDealId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyNode {
  id: string;
  name: string;
  parentCompanyId: string | null;
  children: CompanyNode[];
  depth: number;
}

export interface RelationshipScore {
  contactId: string;
  contactName: string;
  overallScore: number;
  recencyScore: number;
  frequencyScore: number;
  diversityScore: number;
  dealInvolvementScore: number;
  responseRateScore: number;
  meetingAttendanceScore: number;
  lastInteraction: Date | null;
  trend: 'rising' | 'stable' | 'declining';
}

export interface BulkEmailCampaign {
  id: string;
  orgId: string;
  name: string;
  subject: string;
  templateId: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduledAt: Date | null;
  sentAt: Date | null;
  totalRecipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  createdBy: string;
  createdAt: Date;
}

export interface VDRFolder {
  id: string;
  name: string;
  path: string;
  documentCount: number;
  completeness: number;
}

export interface DocumentRequest {
  id: string;
  dealId: string;
  folderPath: string;
  documentName: string;
  requestedFrom: string;
  status: 'pending' | 'uploaded' | 'overdue';
  dueDate: Date | null;
  createdAt: Date;
}

// ─── Service ────────────────────────────────────────────────────────────────

class CRMEnhancements {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Deal Comparison Workspace
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a comparison workspace with 2-5 deals.
   */
  async createComparison(
    orgId: string,
    dealIds: string[],
    name?: string,
    createdBy?: string
  ): Promise<{ id: string; dealIds: string[] }> {
    if (dealIds.length < 2 || dealIds.length > 5) {
      throw new Error('Deal comparison requires between 2 and 5 deals');
    }

    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO deal_comparisons (
        id, org_id, name, deal_ids, notes, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${name || `Comparison ${now.toISOString().slice(0, 10)}`},
        ${JSON.stringify(dealIds)}::jsonb, ${null},
        ${createdBy || null}, ${now}, ${now}
      )
    `);

    return { id, dealIds };
  }

  /**
   * Get side-by-side comparison data for all deals in a saved comparison.
   */
  async getComparisonData(
    orgId: string,
    comparisonId: string
  ): Promise<{ comparison: SavedComparison; deals: DealComparisonMetrics[] }> {
    const compResult = await db.execute(sql`
      SELECT id, org_id, name, deal_ids, notes, created_by, created_at, updated_at
      FROM deal_comparisons
      WHERE id = ${comparisonId} AND org_id = ${orgId}
    `);

    if (!compResult.rows.length) {
      throw new Error('Comparison not found');
    }

    const row = compResult.rows[0] as any;
    const comparison: SavedComparison = {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      dealIds: row.deal_ids,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const deals = await this.getDealComparisonMatrix(orgId, comparison.dealIds);
    return { comparison, deals };
  }

  /**
   * Generate a comparison matrix across key financial metrics for the given deals.
   */
  async getDealComparisonMatrix(
    orgId: string,
    dealIds: string[]
  ): Promise<DealComparisonMetrics[]> {
    if (!dealIds.length) return [];

    const placeholders = dealIds.map((_, i) => `$${i + 2}`).join(', ');

    const result = await pool.query(`
      SELECT
        d.id AS deal_id,
        d.name AS deal_name,
        COALESCE(d.purchase_price, 0) AS purchase_price,
        COALESCE(d.cap_rate, 0) AS cap_rate,
        COALESCE(d.noi, 0) AS noi,
        COALESCE(mc.irr, 0) AS irr,
        COALESCE(mc.dscr, 0) AS dscr,
        COALESCE(mc.ltv, 0) AS ltv,
        COALESCE(d.market, '') AS market,
        COALESCE(d.asset_class, '') AS asset_class,
        COALESCE(mc.hold_period, 0) AS hold_period,
        d.risk_score,
        d.closing_date
      FROM crm_deals d
      LEFT JOIN modeling_project_config mc
        ON mc.project_id = d.modeling_project_id AND mc.org_id = d.org_id
      WHERE d.org_id = $1
        AND d.id IN (${placeholders})
      ORDER BY d.name ASC
    `, [orgId, ...dealIds]);

    return (result.rows as any[]).map(r => ({
      dealId: r.deal_id,
      dealName: r.deal_name,
      purchasePrice: new Decimal(r.purchase_price || 0).toNumber(),
      capRate: new Decimal(r.cap_rate || 0).toNumber(),
      noi: new Decimal(r.noi || 0).toNumber(),
      irr: new Decimal(r.irr || 0).toNumber(),
      dscr: new Decimal(r.dscr || 0).toNumber(),
      ltv: new Decimal(r.ltv || 0).toNumber(),
      market: r.market,
      assetClass: r.asset_class,
      holdPeriod: Number(r.hold_period || 0),
      riskScore: r.risk_score != null ? Number(r.risk_score) : null,
      closingDate: r.closing_date ? r.closing_date.toISOString().slice(0, 10) : null,
    }));
  }

  /**
   * Save (or update) a comparison with notes.
   */
  async saveComparison(
    orgId: string,
    data: { id?: string; name: string; dealIds: string[]; notes?: string; createdBy?: string }
  ): Promise<string> {
    const now = new Date();

    if (data.id) {
      await db.execute(sql`
        UPDATE deal_comparisons
        SET name = ${data.name},
            deal_ids = ${JSON.stringify(data.dealIds)}::jsonb,
            notes = ${data.notes || null},
            updated_at = ${now}
        WHERE id = ${data.id} AND org_id = ${orgId}
      `);
      return data.id;
    }

    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO deal_comparisons (
        id, org_id, name, deal_ids, notes, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${data.name},
        ${JSON.stringify(data.dealIds)}::jsonb, ${data.notes || null},
        ${data.createdBy || null}, ${now}, ${now}
      )
    `);
    return id;
  }

  /**
   * List all saved comparisons for an org.
   */
  async listComparisons(orgId: string): Promise<SavedComparison[]> {
    const result = await db.execute(sql`
      SELECT id, org_id, name, deal_ids, notes, created_by, created_at, updated_at
      FROM deal_comparisons
      WHERE org_id = ${orgId}
      ORDER BY updated_at DESC
    `);

    return (result.rows as any[]).map(r => ({
      id: r.id,
      orgId: r.org_id,
      name: r.name,
      dealIds: r.deal_ids,
      notes: r.notes,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Email Open/Click Tracking
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a 1x1 transparent GIF tracking pixel URL.
   */
  generateTrackingPixel(emailId: string): { trackingId: string; pixelUrl: string } {
    const trackingId = crypto.randomUUID();
    const pixelUrl = `/api/email-tracking/pixel/${trackingId}.gif?eid=${emailId}`;
    return { trackingId, pixelUrl };
  }

  /**
   * Generate a tracked redirect link that records a click before forwarding.
   */
  generateTrackedLink(
    emailId: string,
    originalUrl: string
  ): { linkId: string; trackedUrl: string } {
    const linkId = crypto.randomUUID();
    const encodedUrl = encodeURIComponent(originalUrl);
    const trackedUrl = `/api/email-tracking/click/${linkId}?eid=${emailId}&url=${encodedUrl}`;
    return { linkId, trackedUrl };
  }

  /**
   * Record an email open event from the tracking pixel.
   */
  async recordOpen(
    trackingId: string,
    metadata: { emailId: string; ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO email_tracking_events (
        id, email_id, tracking_id, tracking_type, link_id,
        ip_address, user_agent, created_at
      ) VALUES (
        ${id}, ${metadata.emailId}, ${trackingId}, ${'open'}, ${null},
        ${metadata.ipAddress || null}, ${metadata.userAgent || null}, ${now}
      )
    `);

    // Update the email record's open count
    await db.execute(sql`
      UPDATE crm_emails
      SET open_count = COALESCE(open_count, 0) + 1,
          first_opened_at = COALESCE(first_opened_at, ${now}),
          last_opened_at = ${now}
      WHERE id = ${metadata.emailId}
    `);
  }

  /**
   * Record a link click event.
   */
  async recordClick(
    trackingId: string,
    linkId: string,
    metadata: { emailId: string; ipAddress?: string; userAgent?: string; url?: string }
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO email_tracking_events (
        id, email_id, tracking_id, tracking_type, link_id,
        ip_address, user_agent, url, created_at
      ) VALUES (
        ${id}, ${metadata.emailId}, ${trackingId}, ${'click'}, ${linkId},
        ${metadata.ipAddress || null}, ${metadata.userAgent || null},
        ${metadata.url || null}, ${now}
      )
    `);

    await db.execute(sql`
      UPDATE crm_emails
      SET click_count = COALESCE(click_count, 0) + 1,
          last_clicked_at = ${now}
      WHERE id = ${metadata.emailId}
    `);
  }

  /**
   * Get email engagement metrics with filters.
   */
  async getEmailEngagement(
    orgId: string,
    filters: {
      contactId?: string;
      campaignId?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<EmailEngagement> {
    const conditions: string[] = [`e.org_id = $1`];
    const params: any[] = [orgId];
    let paramIdx = 2;
    if (filters.contactId) { conditions.push(`e.contact_id = $${paramIdx}`); params.push(filters.contactId); paramIdx++; }
    if (filters.campaignId) { conditions.push(`e.campaign_id = $${paramIdx}`); params.push(filters.campaignId); paramIdx++; }
    if (filters.fromDate) { conditions.push(`e.sent_at >= $${paramIdx}`); params.push(filters.fromDate.toISOString()); paramIdx++; }
    if (filters.toDate) { conditions.push(`e.sent_at <= $${paramIdx}`); params.push(filters.toDate.toISOString()); paramIdx++; }

    const where = conditions.join(' AND ');

    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_sent,
        COUNT(CASE WHEN e.open_count > 0 THEN 1 END) AS total_opened,
        COUNT(CASE WHEN e.click_count > 0 THEN 1 END) AS total_clicked,
        COUNT(DISTINCT CASE WHEN e.open_count > 0 THEN e.contact_id END) AS unique_opens,
        COUNT(DISTINCT CASE WHEN e.click_count > 0 THEN e.contact_id END) AS unique_clicks
      FROM crm_emails e
      WHERE ${where}
    `, params);

    const stats = (result.rows as any[])[0] || {};
    const totalSent = Number(stats.total_sent || 0);
    const totalOpened = Number(stats.total_opened || 0);
    const totalClicked = Number(stats.total_clicked || 0);

    // Daily breakdown
    const dailyResult = await pool.query(`
      SELECT
        DATE(et.created_at) AS date,
        COUNT(CASE WHEN et.tracking_type = 'open' THEN 1 END) AS opens,
        COUNT(CASE WHEN et.tracking_type = 'click' THEN 1 END) AS clicks
      FROM email_tracking_events et
      JOIN crm_emails e ON e.id = et.email_id
      WHERE ${where}
      GROUP BY DATE(et.created_at)
      ORDER BY DATE(et.created_at) DESC
      LIMIT 90
    `, params);

    return {
      totalSent,
      totalOpened,
      totalClicked,
      uniqueOpens: Number(stats.unique_opens || 0),
      uniqueClicks: Number(stats.unique_clicks || 0),
      openRate: totalSent > 0 ? new Decimal(totalOpened).div(totalSent).times(100).toNumber() : 0,
      clickRate: totalSent > 0 ? new Decimal(totalClicked).div(totalSent).times(100).toNumber() : 0,
      byDate: (dailyResult.rows as any[]).map(r => ({
        date: r.date,
        opens: Number(r.opens),
        clicks: Number(r.clicks),
      })),
    };
  }

  /**
   * Get a weighted engagement score for a specific contact.
   */
  async getContactEngagementScore(
    orgId: string,
    contactId: string
  ): Promise<{ contactId: string; score: number; breakdown: Record<string, number> }> {
    const result = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN et.tracking_type = 'open' THEN 1 END) AS opens,
        COUNT(CASE WHEN et.tracking_type = 'click' THEN 1 END) AS clicks,
        COUNT(DISTINCT e.id) AS emails_received,
        MAX(et.created_at) AS last_engagement
      FROM email_tracking_events et
      JOIN crm_emails e ON e.id = et.email_id
      WHERE e.org_id = ${orgId} AND e.contact_id = ${contactId}
    `);

    const stats = (result.rows as any[])[0] || {};
    const opens = Number(stats.opens || 0);
    const clicks = Number(stats.clicks || 0);
    const emailsReceived = Number(stats.emails_received || 0);
    const lastEngagement = stats.last_engagement as Date | null;

    // Weighted scoring: opens (1pt), clicks (3pt), replies (5pt)
    const replyResult = await db.execute(sql`
      SELECT COUNT(*) AS replies
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
        AND activity_type = 'email_reply'
    `);
    const replies = Number((replyResult.rows as any[])[0]?.replies || 0);

    const rawScore = new Decimal(opens).times(1)
      .plus(new Decimal(clicks).times(3))
      .plus(new Decimal(replies).times(5));

    // Recency decay: halve score for each 30-day period since last engagement
    let recencyMultiplier = new Decimal(1);
    if (lastEngagement) {
      const daysSince = Math.floor((Date.now() - lastEngagement.getTime()) / (86400000));
      const decayPeriods = Math.floor(daysSince / 30);
      recencyMultiplier = new Decimal(0.5).pow(decayPeriods);
    } else {
      recencyMultiplier = new Decimal(0);
    }

    const adjustedScore = rawScore.times(recencyMultiplier);
    const normalizedScore = Math.min(100, adjustedScore.toNumber());

    return {
      contactId,
      score: Math.round(normalizedScore),
      breakdown: {
        opens,
        clicks,
        replies,
        emailsReceived,
        recencyMultiplier: recencyMultiplier.toNumber(),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Calendar Sync Bridge
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pull events from Google Calendar and match to CRM tasks/meetings.
   */
  async syncGoogleCalendar(
    orgId: string,
    userId: string,
    calendarId: string
  ): Promise<{ synced: number; created: number; updated: number }> {
    // Load the stored OAuth token for this user
    const tokenResult = await db.execute(sql`
      SELECT access_token, refresh_token, token_expiry
      FROM calendar_integrations
      WHERE org_id = ${orgId} AND user_id = ${userId} AND provider = 'google'
    `);

    if (!tokenResult.rows.length) {
      throw new Error('Google Calendar not connected. Please authenticate first.');
    }

    const token = tokenResult.rows[0] as any;
    let synced = 0, created = 0, updated = 0;

    // Fetch events from Google Calendar API
    const now = new Date();
    const threeMonthsOut = new Date(now.getTime() + 90 * 86400000);
    const timeMin = now.toISOString();
    const timeMax = threeMonthsOut.toISOString();

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );

      if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const events = data.items || [];

      for (const event of events) {
        const existingResult = await db.execute(sql`
          SELECT id FROM calendar_events
          WHERE org_id = ${orgId} AND user_id = ${userId}
            AND external_calendar_id = ${event.id}
            AND external_provider = 'google'
        `);

        const eventId = existingResult.rows.length
          ? (existingResult.rows[0] as any).id
          : crypto.randomUUID();

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        const attendees = (event.attendees || []).map((a: any) => a.email);

        if (existingResult.rows.length) {
          await db.execute(sql`
            UPDATE calendar_events
            SET title = ${event.summary || '(No title)'},
                description = ${event.description || null},
                start_time = ${new Date(startTime)},
                end_time = ${new Date(endTime)},
                location = ${event.location || null},
                attendees = ${JSON.stringify(attendees)}::jsonb,
                updated_at = ${new Date()}
            WHERE id = ${eventId} AND org_id = ${orgId}
          `);
          updated++;
        } else {
          await db.execute(sql`
            INSERT INTO calendar_events (
              id, org_id, user_id, title, description,
              start_time, end_time, location, attendees,
              external_calendar_id, external_provider,
              created_at, updated_at
            ) VALUES (
              ${eventId}, ${orgId}, ${userId},
              ${event.summary || '(No title)'}, ${event.description || null},
              ${new Date(startTime)}, ${new Date(endTime)},
              ${event.location || null}, ${JSON.stringify(attendees)}::jsonb,
              ${event.id}, ${'google'},
              ${new Date()}, ${new Date()}
            )
          `);
          created++;
        }
        synced++;
      }
    } catch (err: any) {
      console.error('[CalendarSync] Google sync error:', err.message);
      throw err;
    }

    // Log the sync
    await db.execute(sql`
      UPDATE calendar_integrations
      SET last_synced_at = ${new Date()}, sync_count = COALESCE(sync_count, 0) + 1
      WHERE org_id = ${orgId} AND user_id = ${userId} AND provider = 'google'
    `);

    return { synced, created, updated };
  }

  /**
   * Pull events from Outlook Calendar (Microsoft Graph API).
   */
  async syncOutlookCalendar(
    orgId: string,
    userId: string
  ): Promise<{ synced: number; created: number; updated: number }> {
    const tokenResult = await db.execute(sql`
      SELECT access_token, refresh_token, token_expiry
      FROM calendar_integrations
      WHERE org_id = ${orgId} AND user_id = ${userId} AND provider = 'outlook'
    `);

    if (!tokenResult.rows.length) {
      throw new Error('Outlook Calendar not connected. Please authenticate first.');
    }

    const token = tokenResult.rows[0] as any;
    let synced = 0, created = 0, updated = 0;

    const now = new Date();
    const threeMonthsOut = new Date(now.getTime() + 90 * 86400000);

    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${now.toISOString()}&endDateTime=${threeMonthsOut.toISOString()}&$top=250`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );

      if (!response.ok) {
        throw new Error(`Outlook Calendar API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const events = data.value || [];

      for (const event of events) {
        const existingResult = await db.execute(sql`
          SELECT id FROM calendar_events
          WHERE org_id = ${orgId} AND user_id = ${userId}
            AND external_calendar_id = ${event.id}
            AND external_provider = 'outlook'
        `);

        const eventId = existingResult.rows.length
          ? (existingResult.rows[0] as any).id
          : crypto.randomUUID();

        const attendees = (event.attendees || []).map((a: any) => a.emailAddress?.address).filter(Boolean);
        const startTime = event.start?.dateTime;
        const endTime = event.end?.dateTime;

        if (existingResult.rows.length) {
          await db.execute(sql`
            UPDATE calendar_events
            SET title = ${event.subject || '(No title)'},
                description = ${event.bodyPreview || null},
                start_time = ${new Date(startTime)},
                end_time = ${new Date(endTime)},
                location = ${event.location?.displayName || null},
                attendees = ${JSON.stringify(attendees)}::jsonb,
                updated_at = ${new Date()}
            WHERE id = ${eventId} AND org_id = ${orgId}
          `);
          updated++;
        } else {
          await db.execute(sql`
            INSERT INTO calendar_events (
              id, org_id, user_id, title, description,
              start_time, end_time, location, attendees,
              external_calendar_id, external_provider,
              created_at, updated_at
            ) VALUES (
              ${eventId}, ${orgId}, ${userId},
              ${event.subject || '(No title)'}, ${event.bodyPreview || null},
              ${new Date(startTime)}, ${new Date(endTime)},
              ${event.location?.displayName || null}, ${JSON.stringify(attendees)}::jsonb,
              ${event.id}, ${'outlook'},
              ${new Date()}, ${new Date()}
            )
          `);
          created++;
        }
        synced++;
      }
    } catch (err: any) {
      console.error('[CalendarSync] Outlook sync error:', err.message);
      throw err;
    }

    await db.execute(sql`
      UPDATE calendar_integrations
      SET last_synced_at = ${new Date()}, sync_count = COALESCE(sync_count, 0) + 1
      WHERE org_id = ${orgId} AND user_id = ${userId} AND provider = 'outlook'
    `);

    return { synced, created, updated };
  }

  /**
   * Create a calendar event in CRM and push to connected external calendar.
   */
  async createCalendarEvent(
    orgId: string,
    data: {
      userId: string;
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      location?: string;
      attendees?: string[];
      linkedTaskId?: string;
      linkedDealId?: string;
      pushToExternal?: boolean;
    }
  ): Promise<CalendarEvent> {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO calendar_events (
        id, org_id, user_id, title, description,
        start_time, end_time, location, attendees,
        linked_task_id, linked_deal_id,
        created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${data.userId},
        ${data.title}, ${data.description || null},
        ${data.startTime}, ${data.endTime},
        ${data.location || null},
        ${JSON.stringify(data.attendees || [])}::jsonb,
        ${data.linkedTaskId || null}, ${data.linkedDealId || null},
        ${now}, ${now}
      )
    `);

    const event: CalendarEvent = {
      id,
      orgId,
      userId: data.userId,
      title: data.title,
      description: data.description || null,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location || null,
      attendees: data.attendees || [],
      externalCalendarId: null,
      externalProvider: null,
      linkedTaskId: data.linkedTaskId || null,
      linkedDealId: data.linkedDealId || null,
      createdAt: now,
      updatedAt: now,
    };

    return event;
  }

  /**
   * Update a calendar event (bidirectional sync).
   */
  async updateCalendarEvent(
    orgId: string,
    eventId: string,
    data: Partial<{
      title: string;
      description: string;
      startTime: Date;
      endTime: Date;
      location: string;
      attendees: string[];
      linkedTaskId: string;
      linkedDealId: string;
    }>
  ): Promise<void> {
    const now = new Date();
    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    sets.push(`updated_at = $${paramIdx}`); params.push(now.toISOString()); paramIdx++;
    if (data.title !== undefined) { sets.push(`title = $${paramIdx}`); params.push(data.title); paramIdx++; }
    if (data.description !== undefined) { sets.push(`description = $${paramIdx}`); params.push(data.description || ''); paramIdx++; }
    if (data.startTime) { sets.push(`start_time = $${paramIdx}`); params.push(data.startTime.toISOString()); paramIdx++; }
    if (data.endTime) { sets.push(`end_time = $${paramIdx}`); params.push(data.endTime.toISOString()); paramIdx++; }
    if (data.location !== undefined) { sets.push(`location = $${paramIdx}`); params.push(data.location || ''); paramIdx++; }
    if (data.attendees) { sets.push(`attendees = $${paramIdx}::jsonb`); params.push(JSON.stringify(data.attendees)); paramIdx++; }
    if (data.linkedTaskId !== undefined) { sets.push(`linked_task_id = $${paramIdx}`); params.push(data.linkedTaskId); paramIdx++; }
    if (data.linkedDealId !== undefined) { sets.push(`linked_deal_id = $${paramIdx}`); params.push(data.linkedDealId); paramIdx++; }

    params.push(eventId, orgId);
    await pool.query(`
      UPDATE calendar_events
      SET ${sets.join(', ')}
      WHERE id = $${paramIdx} AND org_id = $${paramIdx + 1}
    `, params);
  }

  /**
   * Get upcoming meetings for a user (combined CRM + external calendar).
   */
  async getUpcomingMeetings(
    orgId: string,
    userId: string,
    days: number = 14
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 86400000);

    const result = await db.execute(sql`
      SELECT
        id, org_id, user_id, title, description,
        start_time, end_time, location, attendees,
        external_calendar_id, external_provider,
        linked_task_id, linked_deal_id,
        created_at, updated_at
      FROM calendar_events
      WHERE org_id = ${orgId} AND user_id = ${userId}
        AND start_time >= ${now} AND start_time <= ${futureDate}
      ORDER BY start_time ASC
    `);

    return (result.rows as any[]).map(r => ({
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      title: r.title,
      description: r.description,
      startTime: r.start_time,
      endTime: r.end_time,
      location: r.location,
      attendees: r.attendees || [],
      externalCalendarId: r.external_calendar_id,
      externalProvider: r.external_provider,
      linkedTaskId: r.linked_task_id,
      linkedDealId: r.linked_deal_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Company Hierarchy / Org Chart
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set a parent-subsidiary relationship between companies.
   */
  async setParentCompany(
    orgId: string,
    companyId: string,
    parentCompanyId: string | null
  ): Promise<void> {
    // Prevent circular references
    if (parentCompanyId) {
      if (parentCompanyId === companyId) {
        throw new Error('A company cannot be its own parent');
      }
      // Walk up from parentCompanyId to ensure companyId is not an ancestor
      let current = parentCompanyId;
      const visited = new Set<string>();
      while (current) {
        if (visited.has(current)) break; // cycle detected in existing data
        visited.add(current);
        const parentResult = await db.execute(sql`
          SELECT parent_company_id FROM crm_companies
          WHERE id = ${current} AND org_id = ${orgId}
        `);
        const parent = (parentResult.rows as any[])[0]?.parent_company_id;
        if (parent === companyId) {
          throw new Error('Circular hierarchy detected: target parent is a descendant of this company');
        }
        current = parent;
      }
    }

    await db.execute(sql`
      UPDATE crm_companies
      SET parent_company_id = ${parentCompanyId}, updated_at = ${new Date()}
      WHERE id = ${companyId} AND org_id = ${orgId}
    `);
  }

  /**
   * Get the full recursive hierarchy tree starting from a root company.
   */
  async getCompanyHierarchy(orgId: string, rootCompanyId: string): Promise<CompanyNode> {
    const result = await db.execute(sql`
      WITH RECURSIVE hierarchy AS (
        SELECT id, name, parent_company_id, 0 AS depth
        FROM crm_companies
        WHERE id = ${rootCompanyId} AND org_id = ${orgId}
        UNION ALL
        SELECT c.id, c.name, c.parent_company_id, h.depth + 1
        FROM crm_companies c
        JOIN hierarchy h ON c.parent_company_id = h.id
        WHERE c.org_id = ${orgId} AND h.depth < 10
      )
      SELECT id, name, parent_company_id, depth FROM hierarchy
      ORDER BY depth ASC, name ASC
    `);

    const rows = result.rows as any[];
    if (!rows.length) {
      throw new Error('Company not found');
    }

    // Build tree from flat list
    const nodeMap = new Map<string, CompanyNode>();
    for (const row of rows) {
      nodeMap.set(row.id, {
        id: row.id,
        name: row.name,
        parentCompanyId: row.parent_company_id,
        children: [],
        depth: Number(row.depth),
      });
    }

    let root: CompanyNode | null = null;
    for (const node of nodeMap.values()) {
      if (node.id === rootCompanyId) {
        root = node;
      } else if (node.parentCompanyId && nodeMap.has(node.parentCompanyId)) {
        nodeMap.get(node.parentCompanyId)!.children.push(node);
      }
    }

    return root!;
  }

  /**
   * Traverse up to find the ultimate parent company.
   */
  async getUltimateParent(orgId: string, companyId: string): Promise<{ id: string; name: string }> {
    const result = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, parent_company_id, 0 AS depth
        FROM crm_companies
        WHERE id = ${companyId} AND org_id = ${orgId}
        UNION ALL
        SELECT c.id, c.name, c.parent_company_id, a.depth + 1
        FROM crm_companies c
        JOIN ancestors a ON a.parent_company_id = c.id
        WHERE c.org_id = ${orgId} AND a.depth < 20
      )
      SELECT id, name FROM ancestors
      WHERE parent_company_id IS NULL
      LIMIT 1
    `);

    if (!result.rows.length) {
      throw new Error('Company not found or no root ancestor');
    }

    const row = result.rows[0] as any;
    return { id: row.id, name: row.name };
  }

  /**
   * Get related companies: siblings, parent, and direct children.
   */
  async getRelatedCompanies(
    orgId: string,
    companyId: string
  ): Promise<{
    parent: { id: string; name: string } | null;
    siblings: { id: string; name: string }[];
    children: { id: string; name: string }[];
  }> {
    // Get the company's parent
    const companyResult = await db.execute(sql`
      SELECT parent_company_id FROM crm_companies
      WHERE id = ${companyId} AND org_id = ${orgId}
    `);
    const parentId = (companyResult.rows as any[])[0]?.parent_company_id || null;

    let parent: { id: string; name: string } | null = null;
    let siblings: { id: string; name: string }[] = [];

    if (parentId) {
      const parentResult = await db.execute(sql`
        SELECT id, name FROM crm_companies
        WHERE id = ${parentId} AND org_id = ${orgId}
      `);
      if (parentResult.rows.length) {
        parent = { id: (parentResult.rows[0] as any).id, name: (parentResult.rows[0] as any).name };
      }

      const siblingResult = await db.execute(sql`
        SELECT id, name FROM crm_companies
        WHERE parent_company_id = ${parentId} AND org_id = ${orgId} AND id != ${companyId}
        ORDER BY name ASC
      `);
      siblings = (siblingResult.rows as any[]).map(r => ({ id: r.id, name: r.name }));
    }

    const childResult = await db.execute(sql`
      SELECT id, name FROM crm_companies
      WHERE parent_company_id = ${companyId} AND org_id = ${orgId}
      ORDER BY name ASC
    `);
    const children = (childResult.rows as any[]).map(r => ({ id: r.id, name: r.name }));

    return { parent, siblings, children };
  }

  /**
   * Merge a duplicate company into the primary, transferring all relationships.
   */
  async mergeCompanies(
    orgId: string,
    primaryId: string,
    duplicateId: string
  ): Promise<{ transferredContacts: number; transferredDeals: number; transferredChildren: number }> {
    if (primaryId === duplicateId) {
      throw new Error('Cannot merge a company with itself');
    }

    // Transfer contacts
    const contactResult = await db.execute(sql`
      UPDATE crm_contacts
      SET company_id = ${primaryId}, updated_at = ${new Date()}
      WHERE company_id = ${duplicateId} AND org_id = ${orgId}
    `);
    const transferredContacts = (contactResult as any).rowCount || 0;

    // Transfer deals
    const dealResult = await db.execute(sql`
      UPDATE crm_deals
      SET company_id = ${primaryId}, updated_at = ${new Date()}
      WHERE company_id = ${duplicateId} AND org_id = ${orgId}
    `);
    const transferredDeals = (dealResult as any).rowCount || 0;

    // Transfer child companies
    const childResult = await db.execute(sql`
      UPDATE crm_companies
      SET parent_company_id = ${primaryId}, updated_at = ${new Date()}
      WHERE parent_company_id = ${duplicateId} AND org_id = ${orgId}
    `);
    const transferredChildren = (childResult as any).rowCount || 0;

    // Transfer activities
    await db.execute(sql`
      UPDATE crm_activities
      SET company_id = ${primaryId}
      WHERE company_id = ${duplicateId} AND org_id = ${orgId}
    `);

    // Soft-delete the duplicate
    await db.execute(sql`
      UPDATE crm_companies
      SET deleted_at = ${new Date()},
          merged_into_id = ${primaryId},
          updated_at = ${new Date()}
      WHERE id = ${duplicateId} AND org_id = ${orgId}
    `);

    return { transferredContacts, transferredDeals, transferredChildren };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Relationship Strength Scoring
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate a 0-100 relationship strength score for a contact.
   * Based on: recency, frequency, channel diversity, deal involvement,
   * response rate, and meeting attendance.
   */
  async calculateRelationshipScore(
    orgId: string,
    contactId: string
  ): Promise<RelationshipScore> {
    const now = new Date();

    // Get contact info
    const contactResult = await db.execute(sql`
      SELECT id, first_name, last_name FROM crm_contacts
      WHERE id = ${contactId} AND org_id = ${orgId}
    `);
    if (!contactResult.rows.length) {
      throw new Error('Contact not found');
    }
    const contact = contactResult.rows[0] as any;
    const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

    // Recency: days since last interaction (max 20 pts)
    const lastInteractionResult = await db.execute(sql`
      SELECT MAX(activity_date) AS last_date
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
    `);
    const lastInteraction = (lastInteractionResult.rows as any[])[0]?.last_date as Date | null;
    let recencyScore = 0;
    if (lastInteraction) {
      const daysSince = Math.floor((now.getTime() - lastInteraction.getTime()) / 86400000);
      recencyScore = daysSince <= 7 ? 20 : daysSince <= 14 ? 16 : daysSince <= 30 ? 12
        : daysSince <= 60 ? 8 : daysSince <= 90 ? 4 : 0;
    }

    // Frequency: number of interactions in last 90 days (max 20 pts)
    const frequencyResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
        AND activity_date >= ${new Date(now.getTime() - 90 * 86400000)}
    `);
    const freq = Number((frequencyResult.rows as any[])[0]?.cnt || 0);
    const frequencyScore = Math.min(20, Math.round(freq * 2));

    // Channel diversity: unique activity types (max 15 pts)
    const diversityResult = await db.execute(sql`
      SELECT COUNT(DISTINCT activity_type) AS channels
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
        AND activity_date >= ${new Date(now.getTime() - 180 * 86400000)}
    `);
    const channels = Number((diversityResult.rows as any[])[0]?.channels || 0);
    const diversityScore = Math.min(15, channels * 3);

    // Deal involvement: number of deals contact is attached to (max 15 pts)
    const dealResult = await db.execute(sql`
      SELECT COUNT(DISTINCT deal_id) AS deal_count
      FROM crm_deal_contacts
      WHERE contact_id = ${contactId}
    `);
    const dealCount = Number((dealResult.rows as any[])[0]?.deal_count || 0);
    const dealInvolvementScore = Math.min(15, dealCount * 5);

    // Response rate: replies / emails sent (max 15 pts)
    const emailStatsResult = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN activity_type = 'email' THEN 1 END) AS sent,
        COUNT(CASE WHEN activity_type = 'email_reply' THEN 1 END) AS replies
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
    `);
    const emailStats = (emailStatsResult.rows as any[])[0] || {};
    const sent = Number(emailStats.sent || 0);
    const repliesCount = Number(emailStats.replies || 0);
    const responseRate = sent > 0 ? new Decimal(repliesCount).div(sent).toNumber() : 0;
    const responseRateScore = Math.min(15, Math.round(responseRate * 15));

    // Meeting attendance: meetings in last 90 days (max 15 pts)
    const meetingResult = await db.execute(sql`
      SELECT COUNT(*) AS meetings
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
        AND activity_type IN ('meeting', 'call')
        AND activity_date >= ${new Date(now.getTime() - 90 * 86400000)}
    `);
    const meetings = Number((meetingResult.rows as any[])[0]?.meetings || 0);
    const meetingAttendanceScore = Math.min(15, meetings * 3);

    const overallScore = recencyScore + frequencyScore + diversityScore
      + dealInvolvementScore + responseRateScore + meetingAttendanceScore;

    // Determine trend by comparing to 30 days ago score (simplified)
    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    const oldFreqResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM crm_activities
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
        AND activity_date >= ${new Date(now.getTime() - 120 * 86400000)}
        AND activity_date < ${new Date(now.getTime() - 30 * 86400000)}
    `);
    const oldFreq = Number((oldFreqResult.rows as any[])[0]?.cnt || 0);
    if (freq > oldFreq * 1.2) trend = 'rising';
    else if (freq < oldFreq * 0.8) trend = 'declining';

    // Persist score for historical tracking
    await db.execute(sql`
      INSERT INTO crm_relationship_scores (
        id, org_id, contact_id, overall_score,
        recency_score, frequency_score, diversity_score,
        deal_involvement_score, response_rate_score, meeting_attendance_score,
        trend, calculated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${orgId}, ${contactId}, ${overallScore},
        ${recencyScore}, ${frequencyScore}, ${diversityScore},
        ${dealInvolvementScore}, ${responseRateScore}, ${meetingAttendanceScore},
        ${trend}, ${now}
      )
    `);

    return {
      contactId,
      contactName,
      overallScore,
      recencyScore,
      frequencyScore,
      diversityScore,
      dealInvolvementScore,
      responseRateScore,
      meetingAttendanceScore,
      lastInteraction,
      trend,
    };
  }

  /**
   * Get relationship score trend over time for a contact.
   */
  async getRelationshipTrend(
    orgId: string,
    contactId: string,
    months: number = 6
  ): Promise<{ date: string; score: number }[]> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const result = await db.execute(sql`
      SELECT DATE(calculated_at) AS date, overall_score
      FROM crm_relationship_scores
      WHERE org_id = ${orgId} AND contact_id = ${contactId}
        AND calculated_at >= ${cutoff}
      ORDER BY calculated_at ASC
    `);

    return (result.rows as any[]).map(r => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      score: Number(r.overall_score),
    }));
  }

  /**
   * Get contacts whose relationship scores have been decaying.
   */
  async getStaleRelationships(
    orgId: string,
    daysThreshold: number = 60
  ): Promise<{ contactId: string; contactName: string; lastInteraction: Date | null; daysSinceContact: number }[]> {
    const cutoff = new Date(Date.now() - daysThreshold * 86400000);

    const result = await db.execute(sql`
      SELECT
        c.id AS contact_id,
        CONCAT(c.first_name, ' ', c.last_name) AS contact_name,
        MAX(a.activity_date) AS last_interaction
      FROM crm_contacts c
      LEFT JOIN crm_activities a ON a.contact_id = c.id AND a.org_id = c.org_id
      WHERE c.org_id = ${orgId} AND c.deleted_at IS NULL
      GROUP BY c.id, c.first_name, c.last_name
      HAVING MAX(a.activity_date) IS NULL OR MAX(a.activity_date) < ${cutoff}
      ORDER BY MAX(a.activity_date) ASC NULLS FIRST
      LIMIT 100
    `);

    const now = Date.now();
    return (result.rows as any[]).map(r => ({
      contactId: r.contact_id,
      contactName: (r.contact_name || '').trim(),
      lastInteraction: r.last_interaction,
      daysSinceContact: r.last_interaction
        ? Math.floor((now - new Date(r.last_interaction).getTime()) / 86400000)
        : 9999,
    }));
  }

  /**
   * Get the top 20 strongest relationships in the org.
   */
  async getBestConnections(
    orgId: string
  ): Promise<{ contactId: string; contactName: string; score: number; trend: string }[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (rs.contact_id)
        rs.contact_id,
        CONCAT(c.first_name, ' ', c.last_name) AS contact_name,
        rs.overall_score,
        rs.trend
      FROM crm_relationship_scores rs
      JOIN crm_contacts c ON c.id = rs.contact_id AND c.org_id = rs.org_id
      WHERE rs.org_id = ${orgId} AND c.deleted_at IS NULL
      ORDER BY rs.contact_id, rs.calculated_at DESC
    `);

    // Sort by score descending and take top 20
    const sorted = (result.rows as any[])
      .sort((a, b) => Number(b.overall_score) - Number(a.overall_score))
      .slice(0, 20);

    return sorted.map(r => ({
      contactId: r.contact_id,
      contactName: (r.contact_name || '').trim(),
      score: Number(r.overall_score),
      trend: r.trend || 'stable',
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Bulk Email from CRM Segments
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a bulk email to a CRM segment/list with template personalization.
   */
  async sendBulkEmail(
    orgId: string,
    data: {
      name: string;
      subject: string;
      body: string;
      templateId?: string;
      segmentQuery?: string;
      contactIds?: string[];
      fromName: string;
      fromEmail: string;
      createdBy: string;
      personalizations?: Record<string, string>;
    }
  ): Promise<{ campaignId: string; recipientCount: number }> {
    const campaignId = crypto.randomUUID();
    const now = new Date();

    // Resolve recipients from segment query or explicit list
    let contactIds: string[] = data.contactIds || [];
    if (data.segmentQuery && !contactIds.length) {
      // NOTE: segmentQuery is a server-generated filter expression, not direct user input.
      // Parameterize orgId; segmentQuery is trusted internal SQL built by the segment builder.
      const segResult = await pool.query(`
        SELECT id FROM crm_contacts
        WHERE org_id = $1 AND deleted_at IS NULL
          AND unsubscribed_at IS NULL
          AND ${data.segmentQuery}
      `, [orgId]);
      contactIds = (segResult.rows as any[]).map(r => r.id);
    }

    // Filter out unsubscribed contacts
    if (contactIds.length) {
      const placeholders = contactIds.map((_, i) => `$${i + 2}`).join(', ');
      const filterResult = await pool.query(`
        SELECT id FROM crm_contacts
        WHERE org_id = $1 AND id IN (${placeholders})
          AND unsubscribed_at IS NULL AND deleted_at IS NULL
      `, [orgId, ...contactIds]);
      contactIds = (filterResult.rows as any[]).map(r => (r as any).id);
    }

    // Create campaign record
    await db.execute(sql`
      INSERT INTO crm_email_campaigns (
        id, org_id, name, subject, body, template_id,
        from_name, from_email, status,
        total_recipients, delivered, opened, clicked, bounced, unsubscribed,
        created_by, created_at, updated_at
      ) VALUES (
        ${campaignId}, ${orgId}, ${data.name}, ${data.subject}, ${data.body},
        ${data.templateId || null},
        ${data.fromName}, ${data.fromEmail}, ${'sending'},
        ${contactIds.length}, ${0}, ${0}, ${0}, ${0}, ${0},
        ${data.createdBy}, ${now}, ${now}
      )
    `);

    // Queue individual emails with tracking
    for (const contactId of contactIds) {
      const emailId = crypto.randomUUID();
      const { trackingId, pixelUrl } = this.generateTrackingPixel(emailId);

      // Personalize body with contact data
      let personalizedBody = data.body;
      if (data.personalizations) {
        for (const [key, value] of Object.entries(data.personalizations)) {
          personalizedBody = personalizedBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
      }

      // Append tracking pixel to body
      personalizedBody += `<img src="${pixelUrl}" width="1" height="1" style="display:none" />`;

      await db.execute(sql`
        INSERT INTO crm_emails (
          id, org_id, campaign_id, contact_id,
          subject, body, tracking_id,
          status, created_at
        ) VALUES (
          ${emailId}, ${orgId}, ${campaignId}, ${contactId},
          ${data.subject}, ${personalizedBody}, ${trackingId},
          ${'queued'}, ${now}
        )
      `);
    }

    // Mark campaign as sent
    await db.execute(sql`
      UPDATE crm_email_campaigns
      SET status = 'sent', sent_at = ${now}, updated_at = ${now}
      WHERE id = ${campaignId}
    `);

    return { campaignId, recipientCount: contactIds.length };
  }

  /**
   * Schedule a bulk email for future delivery.
   */
  async scheduleBulkEmail(
    orgId: string,
    data: {
      name: string;
      subject: string;
      body: string;
      templateId?: string;
      contactIds?: string[];
      segmentQuery?: string;
      fromName: string;
      fromEmail: string;
      createdBy: string;
      scheduledAt: Date;
    }
  ): Promise<{ campaignId: string; scheduledAt: Date }> {
    const campaignId = crypto.randomUUID();
    const now = new Date();

    if (data.scheduledAt <= now) {
      throw new Error('Scheduled time must be in the future');
    }

    // Resolve recipient count for preview
    let recipientCount = 0;
    if (data.contactIds?.length) {
      recipientCount = data.contactIds.length;
    } else if (data.segmentQuery) {
      // NOTE: segmentQuery is a server-generated filter expression, not direct user input.
      const countResult = await pool.query(`
        SELECT COUNT(*) AS cnt FROM crm_contacts
        WHERE org_id = $1 AND deleted_at IS NULL
          AND unsubscribed_at IS NULL AND ${data.segmentQuery}
      `, [orgId]);
      recipientCount = Number((countResult.rows as any[])[0]?.cnt || 0);
    }

    await db.execute(sql`
      INSERT INTO crm_email_campaigns (
        id, org_id, name, subject, body, template_id,
        from_name, from_email, status,
        scheduled_at, total_recipients,
        delivered, opened, clicked, bounced, unsubscribed,
        segment_query, contact_ids,
        created_by, created_at, updated_at
      ) VALUES (
        ${campaignId}, ${orgId}, ${data.name}, ${data.subject}, ${data.body},
        ${data.templateId || null},
        ${data.fromName}, ${data.fromEmail}, ${'scheduled'},
        ${data.scheduledAt}, ${recipientCount},
        ${0}, ${0}, ${0}, ${0}, ${0},
        ${data.segmentQuery || null},
        ${data.contactIds ? JSON.stringify(data.contactIds) : null}::jsonb,
        ${data.createdBy}, ${now}, ${now}
      )
    `);

    return { campaignId, scheduledAt: data.scheduledAt };
  }

  /**
   * Get status and engagement metrics for a bulk email campaign.
   */
  async getBulkEmailStatus(
    orgId: string,
    campaignId: string
  ): Promise<BulkEmailCampaign> {
    // Recompute live stats from individual emails
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'delivered' OR status = 'sent' THEN 1 END) AS delivered,
        COUNT(CASE WHEN open_count > 0 THEN 1 END) AS opened,
        COUNT(CASE WHEN click_count > 0 THEN 1 END) AS clicked,
        COUNT(CASE WHEN status = 'bounced' THEN 1 END) AS bounced
      FROM crm_emails
      WHERE org_id = ${orgId} AND campaign_id = ${campaignId}
    `);
    const stats = (statsResult.rows as any[])[0] || {};

    // Update campaign record with live stats
    await db.execute(sql`
      UPDATE crm_email_campaigns
      SET delivered = ${Number(stats.delivered || 0)},
          opened = ${Number(stats.opened || 0)},
          clicked = ${Number(stats.clicked || 0)},
          bounced = ${Number(stats.bounced || 0)},
          updated_at = ${new Date()}
      WHERE id = ${campaignId} AND org_id = ${orgId}
    `);

    const result = await db.execute(sql`
      SELECT * FROM crm_email_campaigns
      WHERE id = ${campaignId} AND org_id = ${orgId}
    `);

    if (!result.rows.length) {
      throw new Error('Campaign not found');
    }

    const r = result.rows[0] as any;
    return {
      id: r.id,
      orgId: r.org_id,
      name: r.name,
      subject: r.subject,
      templateId: r.template_id,
      status: r.status,
      scheduledAt: r.scheduled_at,
      sentAt: r.sent_at,
      totalRecipients: Number(r.total_recipients),
      delivered: Number(r.delivered),
      opened: Number(r.opened),
      clicked: Number(r.clicked),
      bounced: Number(r.bounced),
      unsubscribed: Number(r.unsubscribed),
      createdBy: r.created_by,
      createdAt: r.created_at,
    };
  }

  /**
   * Unsubscribe a contact from all bulk emails.
   */
  async unsubscribeContact(orgId: string, contactId: string): Promise<void> {
    await db.execute(sql`
      UPDATE crm_contacts
      SET unsubscribed_at = ${new Date()}, updated_at = ${new Date()}
      WHERE id = ${contactId} AND org_id = ${orgId}
    `);

    // Log unsubscribe activity
    await db.execute(sql`
      INSERT INTO crm_activities (
        id, org_id, contact_id, activity_type, description, activity_date
      ) VALUES (
        ${crypto.randomUUID()}, ${orgId}, ${contactId},
        ${'unsubscribe'}, ${'Contact unsubscribed from email communications'},
        ${new Date()}
      )
    `);
  }

  /**
   * List all unsubscribed contacts for an org.
   */
  async getUnsubscribes(
    orgId: string
  ): Promise<{ contactId: string; name: string; email: string; unsubscribedAt: Date }[]> {
    const result = await db.execute(sql`
      SELECT id, first_name, last_name, email, unsubscribed_at
      FROM crm_contacts
      WHERE org_id = ${orgId} AND unsubscribed_at IS NOT NULL
      ORDER BY unsubscribed_at DESC
    `);

    return (result.rows as any[]).map(r => ({
      contactId: r.id,
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      email: r.email,
      unsubscribedAt: r.unsubscribed_at,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Quick VDR Creation from Deal
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Auto-create a Virtual Data Room with standard folder structure for a deal.
   */
  async createDealRoom(
    orgId: string,
    dealId: string
  ): Promise<{ vdrId: string; folders: VDRFolder[] }> {
    // Verify deal exists
    const dealResult = await db.execute(sql`
      SELECT id, name, asset_class FROM crm_deals
      WHERE id = ${dealId} AND org_id = ${orgId}
    `);
    if (!dealResult.rows.length) {
      throw new Error('Deal not found');
    }

    const deal = dealResult.rows[0] as any;
    const vdrId = crypto.randomUUID();
    const now = new Date();

    // Standard institutional VDR folder structure
    const folderStructure = [
      { name: 'Executive Summary', path: '/executive-summary' },
      { name: 'Financial Statements', path: '/financial-statements' },
      { name: 'Rent Roll', path: '/rent-roll' },
      { name: 'Operating Statements', path: '/operating-statements' },
      { name: 'Appraisals & Valuations', path: '/appraisals' },
      { name: 'Environmental Reports', path: '/environmental' },
      { name: 'Title & Survey', path: '/title-survey' },
      { name: 'Insurance', path: '/insurance' },
      { name: 'Lease Agreements', path: '/leases' },
      { name: 'Zoning & Permits', path: '/zoning-permits' },
      { name: 'Capital Expenditure', path: '/capex' },
      { name: 'Property Condition Reports', path: '/pcr' },
      { name: 'Market Research', path: '/market-research' },
      { name: 'Legal Documents', path: '/legal' },
      { name: 'Tax Records', path: '/tax' },
      { name: 'Miscellaneous', path: '/misc' },
    ];

    // Create VDR record
    await db.execute(sql`
      INSERT INTO deal_vdr (
        id, org_id, deal_id, name, status, created_at, updated_at
      ) VALUES (
        ${vdrId}, ${orgId}, ${dealId},
        ${`${deal.name} - Data Room`},
        ${'active'}, ${now}, ${now}
      )
    `);

    // Create folder records
    const folders: VDRFolder[] = [];
    for (const folder of folderStructure) {
      const folderId = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO deal_vdr_folders (
          id, vdr_id, org_id, name, path, created_at
        ) VALUES (
          ${folderId}, ${vdrId}, ${orgId},
          ${folder.name}, ${folder.path}, ${now}
        )
      `);
      folders.push({
        id: folderId,
        name: folder.name,
        path: folder.path,
        documentCount: 0,
        completeness: 0,
      });
    }

    return { vdrId, folders };
  }

  /**
   * Get the document completeness status of a deal's VDR.
   */
  async getDealRoomStatus(
    orgId: string,
    dealId: string
  ): Promise<{
    vdrId: string;
    dealName: string;
    totalFolders: number;
    completeFolders: number;
    overallCompleteness: number;
    folders: VDRFolder[];
    pendingRequests: number;
  }> {
    const vdrResult = await db.execute(sql`
      SELECT v.id AS vdr_id, d.name AS deal_name
      FROM deal_vdr v
      JOIN crm_deals d ON d.id = v.deal_id AND d.org_id = v.org_id
      WHERE v.deal_id = ${dealId} AND v.org_id = ${orgId}
      LIMIT 1
    `);

    if (!vdrResult.rows.length) {
      throw new Error('No data room found for this deal');
    }

    const vdr = vdrResult.rows[0] as any;

    // Get folder status with document counts
    const folderResult = await db.execute(sql`
      SELECT
        f.id, f.name, f.path,
        COUNT(doc.id) AS document_count
      FROM deal_vdr_folders f
      LEFT JOIN deal_vdr_documents doc ON doc.folder_id = f.id
      WHERE f.vdr_id = ${vdr.vdr_id} AND f.org_id = ${orgId}
      GROUP BY f.id, f.name, f.path
      ORDER BY f.path ASC
    `);

    const folders: VDRFolder[] = (folderResult.rows as any[]).map(r => ({
      id: r.id,
      name: r.name,
      path: r.path,
      documentCount: Number(r.document_count),
      completeness: Number(r.document_count) > 0 ? 100 : 0,
    }));

    const completeFolders = folders.filter(f => f.documentCount > 0).length;
    const overallCompleteness = folders.length > 0
      ? new Decimal(completeFolders).div(folders.length).times(100).round().toNumber()
      : 0;

    // Count pending document requests
    const pendingResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM deal_vdr_requests
      WHERE deal_id = ${dealId} AND org_id = ${orgId} AND status = 'pending'
    `);
    const pendingRequests = Number((pendingResult.rows as any[])[0]?.cnt || 0);

    return {
      vdrId: vdr.vdr_id,
      dealName: vdr.deal_name,
      totalFolders: folders.length,
      completeFolders,
      overallCompleteness,
      folders,
      pendingRequests,
    };
  }

  /**
   * Send document requests to contacts associated with the deal.
   */
  async requestDocuments(
    orgId: string,
    dealId: string,
    requests: Array<{
      folderPath: string;
      documentName: string;
      requestedFromContactId: string;
      dueDate?: Date;
      notes?: string;
    }>
  ): Promise<{ requestIds: string[]; totalRequests: number }> {
    const now = new Date();
    const requestIds: string[] = [];

    for (const req of requests) {
      const requestId = crypto.randomUUID();
      requestIds.push(requestId);

      await db.execute(sql`
        INSERT INTO deal_vdr_requests (
          id, org_id, deal_id, folder_path, document_name,
          requested_from_contact_id, status, due_date, notes,
          created_at, updated_at
        ) VALUES (
          ${requestId}, ${orgId}, ${dealId},
          ${req.folderPath}, ${req.documentName},
          ${req.requestedFromContactId}, ${'pending'},
          ${req.dueDate || null}, ${req.notes || null},
          ${now}, ${now}
        )
      `);

      // Create activity record for the request
      await db.execute(sql`
        INSERT INTO crm_activities (
          id, org_id, contact_id, deal_id, activity_type,
          description, activity_date
        ) VALUES (
          ${crypto.randomUUID()}, ${orgId}, ${req.requestedFromContactId}, ${dealId},
          ${'document_request'},
          ${`Document requested: ${req.documentName} (${req.folderPath})`},
          ${now}
        )
      `);
    }

    return { requestIds, totalRequests: requestIds.length };
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────

export const crmEnhancements = new CRMEnhancements();

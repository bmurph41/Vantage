/**
 * CRM Relationship Intelligence Routes (Sections 7.1–7.5)
 * 7.1 Relationship Graph
 * 7.2 Deal Sourcing Score
 * 7.3 Follow-Up AI
 * 7.4 Contact Intelligence Feed
 * 7.5 Meeting Prep Brief
 */

import { Router } from 'express';
import { db } from '../db';
import {
  contactRelationships,
  contactNewsMentions,
  crmContacts,
  crmDeals,
  crmActivities,
} from '@shared/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export const crmRelationshipIntelligenceRouter = Router();

const anthropic = new Anthropic();
const AI_MODEL = 'claude-sonnet-4-5-20250514';

// =============================================================================
// 7.1 — Relationship Graph
// =============================================================================

// GET /relationships — list relationships for org, optionally filter by contactId or dealId
crmRelationshipIntelligenceRouter.get('/relationships', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactId, dealId } = req.query as { contactId?: string; dealId?: string };

    const conditions: any[] = [eq(contactRelationships.orgId, orgId)];
    if (contactId) {
      conditions.push(
        sql`(${contactRelationships.fromContactId} = ${contactId} OR ${contactRelationships.toContactId} = ${contactId})`
      );
    }
    if (dealId) {
      conditions.push(eq(contactRelationships.dealId, dealId));
    }

    const rows = await db
      .select()
      .from(contactRelationships)
      .where(and(...conditions))
      .orderBy(desc(contactRelationships.createdAt));

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /relationships — create relationship
crmRelationshipIntelligenceRouter.post('/relationships', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { fromContactId, toContactId, relationshipType, strength, dealId, notes } = req.body;
    if (!fromContactId || !toContactId) {
      return res.status(400).json({ error: 'fromContactId and toContactId are required' });
    }

    const [row] = await db
      .insert(contactRelationships)
      .values({ orgId, fromContactId, toContactId, relationshipType, strength, dealId, notes })
      .returning();

    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /relationships/:id — update relationship
crmRelationshipIntelligenceRouter.put('/relationships/:id', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { fromContactId, toContactId, relationshipType, strength, dealId, notes } = req.body;

    const [row] = await db
      .update(contactRelationships)
      .set({ fromContactId, toContactId, relationshipType, strength, dealId, notes })
      .where(and(eq(contactRelationships.id, id), eq(contactRelationships.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: 'Relationship not found' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /relationships/:id — delete relationship
crmRelationshipIntelligenceRouter.delete('/relationships/:id', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const [row] = await db
      .delete(contactRelationships)
      .where(and(eq(contactRelationships.id, id), eq(contactRelationships.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /relationships/graph/:contactId — full graph centered on contact (2 degrees)
crmRelationshipIntelligenceRouter.get('/relationships/graph/:contactId', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactId } = req.params;

    // Degree 1: direct connections
    const degree1 = await db
      .select()
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.orgId, orgId),
          sql`(${contactRelationships.fromContactId} = ${contactId} OR ${contactRelationships.toContactId} = ${contactId})`
        )
      );

    // Collect all contact IDs from degree 1
    const degree1ContactIds = new Set<string>();
    degree1ContactIds.add(contactId);
    for (const r of degree1) {
      degree1ContactIds.add(r.fromContactId);
      degree1ContactIds.add(r.toContactId);
    }

    // Degree 2: connections of degree-1 contacts (excluding already known)
    const d1Ids = Array.from(degree1ContactIds);
    let degree2: typeof degree1 = [];
    if (d1Ids.length > 1) {
      degree2 = await db
        .select()
        .from(contactRelationships)
        .where(
          and(
            eq(contactRelationships.orgId, orgId),
            sql`(${contactRelationships.fromContactId} = ANY(${d1Ids}) OR ${contactRelationships.toContactId} = ANY(${d1Ids}))`
          )
        );
    }

    // Collect all unique contact IDs across both degrees
    const allContactIds = new Set<string>(degree1ContactIds);
    for (const r of degree2) {
      allContactIds.add(r.fromContactId);
      allContactIds.add(r.toContactId);
    }

    // Fetch contact details for all nodes
    const contactIds = Array.from(allContactIds);
    const contacts = contactIds.length > 0
      ? await db
          .select({
            id: crmContacts.id,
            firstName: crmContacts.firstName,
            lastName: crmContacts.lastName,
            email: crmContacts.email,
            company: crmContacts.company,
          })
          .from(crmContacts)
          .where(
            and(
              eq(crmContacts.orgId, orgId),
              sql`${crmContacts.id} = ANY(${contactIds})`
            )
          )
      : [];

    // Deduplicate edges
    const edgeMap = new Map<string, (typeof degree1)[0]>();
    for (const r of [...degree1, ...degree2]) {
      edgeMap.set(r.id, r);
    }

    res.json({
      centerId: contactId,
      nodes: contacts,
      edges: Array.from(edgeMap.values()),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// 7.2 — Deal Sourcing Score
// =============================================================================

// GET /sourcing-scores — list broker/contact sourcing scores
crmRelationshipIntelligenceRouter.get('/sourcing-scores', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // For each contact that has deals linked, compute sourcing metrics
    const scores = await db.execute(sql`
      SELECT
        c.id AS "contactId",
        c.first_name AS "firstName",
        c.last_name AS "lastName",
        c.email,
        c.company,
        COUNT(d.id)::int AS "totalDeals",
        COUNT(d.id) FILTER (WHERE d.stage = 'closed_won')::int AS "closedDeals",
        CASE
          WHEN COUNT(d.id) > 0
          THEN ROUND(COUNT(d.id) FILTER (WHERE d.stage = 'closed_won')::numeric / COUNT(d.id), 4)
          ELSE 0
        END AS "closedRate",
        COALESCE(SUM(d.deal_amount) FILTER (WHERE d.stage = 'closed_won'), 0) AS "closedVolume",
        ROUND(
          (COUNT(d.id) * 0.3
           + COUNT(d.id) FILTER (WHERE d.stage = 'closed_won') * 0.4
           + CASE WHEN COUNT(d.id) > 0
               THEN COUNT(d.id) FILTER (WHERE d.stage = 'closed_won')::numeric / COUNT(d.id) * 30
               ELSE 0
             END
          )::numeric, 2
        ) AS "compositeScore"
      FROM crm_contacts c
      INNER JOIN crm_deals d ON d.contact_id = c.id AND d.org_id = c.org_id
      WHERE c.org_id = ${orgId}
      GROUP BY c.id, c.first_name, c.last_name, c.email, c.company
      ORDER BY "compositeScore" DESC
    `);

    res.json(scores.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /sourcing-scores/:contactId — detailed sourcing metrics for single contact
crmRelationshipIntelligenceRouter.get('/sourcing-scores/:contactId', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactId } = req.params;

    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.id, contactId), eq(crmContacts.orgId, orgId)));

    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const deals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.contactId, contactId), eq(crmDeals.orgId, orgId)));

    const totalDeals = deals.length;
    const closedDeals = deals.filter((d) => d.stage === 'closed_won').length;
    const closedRate = totalDeals > 0 ? closedDeals / totalDeals : 0;
    const closedVolume = deals
      .filter((d) => d.stage === 'closed_won')
      .reduce((sum, d) => sum + (Number(d.dealAmount) || 0), 0);
    const compositeScore =
      totalDeals * 0.3 + closedDeals * 0.4 + closedRate * 30;

    const recentActivities = await db
      .select()
      .from(crmActivities)
      .where(and(eq(crmActivities.contactId, contactId), eq(crmActivities.orgId, orgId)))
      .orderBy(desc(crmActivities.createdAt))
      .limit(10);

    res.json({
      contact,
      metrics: {
        totalDeals,
        closedDeals,
        closedRate: Math.round(closedRate * 10000) / 10000,
        closedVolume,
        compositeScore: Math.round(compositeScore * 100) / 100,
      },
      deals,
      recentActivities,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// 7.3 — Follow-Up AI
// =============================================================================

// POST /follow-up/draft — generate AI follow-up email draft
crmRelationshipIntelligenceRouter.post('/follow-up/draft', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactId, followUpType, additionalContext } = req.body;
    if (!contactId || !followUpType) {
      return res.status(400).json({ error: 'contactId and followUpType are required' });
    }

    const validTypes = [
      'deal_check_in',
      'market_update',
      'new_deal_inquiry',
      'post_deal_thanks',
      'annual_catchup',
    ];
    if (!validTypes.includes(followUpType)) {
      return res.status(400).json({ error: `followUpType must be one of: ${validTypes.join(', ')}` });
    }

    // Fetch contact details
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.id, contactId), eq(crmContacts.orgId, orgId)));

    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    // Fetch recent activities
    const recentActivities = await db
      .select()
      .from(crmActivities)
      .where(and(eq(crmActivities.contactId, contactId), eq(crmActivities.orgId, orgId)))
      .orderBy(desc(crmActivities.createdAt))
      .limit(10);

    // Fetch shared deals
    const sharedDeals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.contactId, contactId), eq(crmDeals.orgId, orgId)))
      .orderBy(desc(crmDeals.createdAt))
      .limit(10);

    const prompt = `You are a professional CRM assistant for a commercial real estate / marina investment firm.
Draft a follow-up email for the following scenario.

Follow-up type: ${followUpType}
Contact: ${contact.firstName} ${contact.lastName}${contact.company ? ` (${contact.company})` : ''}${contact.title ? `, ${contact.title}` : ''}
Email: ${contact.email || 'N/A'}

Recent activities with this contact:
${recentActivities.length > 0 ? recentActivities.map((a) => `- ${a.type}: ${a.subject || a.description || 'No description'} (${a.createdAt})`).join('\n') : 'No recent activities.'}

Shared deals:
${sharedDeals.length > 0 ? sharedDeals.map((d) => `- ${d.name}: stage=${d.stage}, amount=${d.dealAmount || 'N/A'}`).join('\n') : 'No shared deals.'}

${additionalContext ? `Additional context: ${additionalContext}` : ''}

Write a professional, warm, concise email. Include a subject line. Format as:
Subject: ...
Body: ...`;

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const generatedText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    res.json({
      contactId,
      followUpType,
      generatedText,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// 7.4 — Contact Intelligence / News
// =============================================================================

// GET /news/:contactId — list news mentions for a contact
crmRelationshipIntelligenceRouter.get('/news/:contactId', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactId } = req.params;

    const mentions = await db
      .select()
      .from(contactNewsMentions)
      .where(
        and(
          eq(contactNewsMentions.orgId, orgId),
          eq(contactNewsMentions.contactId, contactId)
        )
      )
      .orderBy(desc(contactNewsMentions.publishedAt));

    res.json(mentions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /news — create news mention
crmRelationshipIntelligenceRouter.post('/news', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      contactId,
      articleUrl,
      headline,
      snippet,
      source,
      publishedAt,
      relevanceScore,
      mentionType,
      actionableNote,
    } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    const [row] = await db
      .insert(contactNewsMentions)
      .values({
        orgId,
        contactId,
        articleUrl,
        headline,
        snippet,
        source,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        relevanceScore,
        mentionType,
        actionableNote,
      })
      .returning();

    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /news/feed — org-wide contact news feed
crmRelationshipIntelligenceRouter.get('/news/feed', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const mentions = await db
      .select({
        id: contactNewsMentions.id,
        contactId: contactNewsMentions.contactId,
        articleUrl: contactNewsMentions.articleUrl,
        headline: contactNewsMentions.headline,
        snippet: contactNewsMentions.snippet,
        source: contactNewsMentions.source,
        publishedAt: contactNewsMentions.publishedAt,
        relevanceScore: contactNewsMentions.relevanceScore,
        mentionType: contactNewsMentions.mentionType,
        actionableNote: contactNewsMentions.actionableNote,
        createdAt: contactNewsMentions.createdAt,
        contactFirstName: crmContacts.firstName,
        contactLastName: crmContacts.lastName,
        contactCompany: crmContacts.company,
      })
      .from(contactNewsMentions)
      .leftJoin(crmContacts, eq(contactNewsMentions.contactId, crmContacts.id))
      .where(eq(contactNewsMentions.orgId, orgId))
      .orderBy(desc(contactNewsMentions.publishedAt))
      .limit(50);

    res.json(mentions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// 7.5 — Meeting Prep Brief
// =============================================================================

// POST /meeting-prep/:contactId — generate AI meeting prep brief
crmRelationshipIntelligenceRouter.post('/meeting-prep/:contactId', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactId } = req.params;

    // Fetch contact
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.id, contactId), eq(crmContacts.orgId, orgId)));

    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    // Fetch shared deals
    const deals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.contactId, contactId), eq(crmDeals.orgId, orgId)))
      .orderBy(desc(crmDeals.createdAt))
      .limit(20);

    // Fetch recent activities
    const activities = await db
      .select()
      .from(crmActivities)
      .where(and(eq(crmActivities.contactId, contactId), eq(crmActivities.orgId, orgId)))
      .orderBy(desc(crmActivities.createdAt))
      .limit(15);

    // Fetch news mentions
    const news = await db
      .select()
      .from(contactNewsMentions)
      .where(
        and(
          eq(contactNewsMentions.orgId, orgId),
          eq(contactNewsMentions.contactId, contactId)
        )
      )
      .orderBy(desc(contactNewsMentions.publishedAt))
      .limit(10);

    const prompt = `You are a CRM intelligence assistant for a commercial real estate / marina investment firm.
Generate a comprehensive meeting preparation brief for an upcoming meeting with the contact below.

Contact:
- Name: ${contact.firstName} ${contact.lastName}
- Company: ${contact.company || 'N/A'}
- Title: ${contact.title || 'N/A'}
- Email: ${contact.email || 'N/A'}
- Phone: ${contact.phone || 'N/A'}

Deal History:
${deals.length > 0 ? deals.map((d) => `- ${d.name}: stage=${d.stage}, amount=${d.dealAmount || 'N/A'}, created=${d.createdAt}`).join('\n') : 'No deals on record.'}

Recent Activities:
${activities.length > 0 ? activities.map((a) => `- [${a.type}] ${a.subject || a.description || 'No description'} (${a.createdAt})`).join('\n') : 'No recent activities.'}

Recent News Mentions:
${news.length > 0 ? news.map((n) => `- ${n.headline || 'No headline'}: ${n.snippet || ''} (source: ${n.source || 'unknown'}, ${n.publishedAt || ''})`).join('\n') : 'No recent news.'}

Produce a JSON object with these keys:
- "contactSummary": A 2-3 sentence overview of who this contact is and their relationship with us.
- "dealHistory": A summary of past and current deal activity.
- "recentNews": Key news items and their relevance.
- "suggestedTalkingPoints": An array of 3-5 conversation topics.
- "potentialAsks": An array of 2-3 potential requests or opportunities to raise in the meeting.

Return ONLY valid JSON, no markdown fences.`;

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText =
      message.content[0].type === 'text' ? message.content[0].text : '{}';

    let brief: any;
    try {
      brief = JSON.parse(rawText);
    } catch {
      // If the AI didn't return valid JSON, wrap the text
      brief = { rawBrief: rawText };
    }

    res.json({
      contactId,
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
      },
      brief,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

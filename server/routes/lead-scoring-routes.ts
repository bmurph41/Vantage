/**
 * CRM Lead Scoring Routes
 *
 * Scoring rules, behavioral events, score history, and engagement metrics.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

function classifyTemperature(score: number): string {
  if (score >= 80) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// ============================================================================
// SCORING RULES
// ============================================================================

// GET /rules - list scoring rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const conditions = [eq(schema.crmScoringRules.orgId, orgId)];

    if (req.query.active !== 'false') {
      conditions.push(eq(schema.crmScoringRules.isActive, true));
    }

    const rules = await db
      .select()
      .from(schema.crmScoringRules)
      .where(and(...conditions))
      .orderBy(desc(schema.crmScoringRules.createdAt));

    res.json(rules);
  } catch (error) {
    console.error('Error fetching scoring rules:', error);
    res.status(500).json({ error: 'Failed to fetch scoring rules' });
  }
});

// POST /rules - create rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [rule] = await db
      .insert(schema.crmScoringRules)
      .values({
        ...req.body,
        orgId,
        createdById: userId,
      })
      .returning();

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating scoring rule:', error);
    res.status(500).json({ error: 'Failed to create scoring rule' });
  }
});

// PATCH /rules/:id - update rule
router.patch('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.crmScoringRules)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmScoringRules.id, req.params.id),
          eq(schema.crmScoringRules.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Rule not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating scoring rule:', error);
    res.status(500).json({ error: 'Failed to update scoring rule' });
  }
});

// DELETE /rules/:id - deactivate rule (soft delete)
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [deactivated] = await db
      .update(schema.crmScoringRules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmScoringRules.id, req.params.id),
          eq(schema.crmScoringRules.orgId, orgId)
        )
      )
      .returning();

    if (!deactivated) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true, rule: deactivated });
  } catch (error) {
    console.error('Error deactivating scoring rule:', error);
    res.status(500).json({ error: 'Failed to deactivate scoring rule' });
  }
});

// ============================================================================
// SCORING EVENTS
// ============================================================================

// POST /events - record scoring event (auto-updates score history)
router.post('/events', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    // Look up matching scoring rule to determine points
    let pointsAwarded = req.body.pointsAwarded || 0;
    let scoringRuleId = req.body.scoringRuleId || null;

    if (!pointsAwarded && req.body.eventType) {
      const matchingRules = await db
        .select()
        .from(schema.crmScoringRules)
        .where(
          and(
            eq(schema.crmScoringRules.orgId, orgId),
            eq(schema.crmScoringRules.triggerEvent, req.body.eventType),
            eq(schema.crmScoringRules.isActive, true)
          )
        );

      if (matchingRules.length > 0) {
        pointsAwarded = matchingRules[0].points;
        scoringRuleId = matchingRules[0].id;
      }
    }

    // Insert the event
    const [event] = await db
      .insert(schema.crmLeadScoringEvents)
      .values({
        ...req.body,
        orgId,
        pointsAwarded,
        scoringRuleId,
      })
      .returning();

    // Auto-update score history if points were awarded
    if (pointsAwarded !== 0) {
      const contactId = req.body.contactId;
      const leadId = req.body.leadId;

      // Get the most recent score for this contact/lead
      const historyConditions = [eq(schema.crmLeadScoringHistory.orgId, orgId)];
      if (contactId) {
        historyConditions.push(eq(schema.crmLeadScoringHistory.contactId, contactId));
      } else if (leadId) {
        historyConditions.push(eq(schema.crmLeadScoringHistory.leadId, leadId));
      }

      const [latestHistory] = await db
        .select()
        .from(schema.crmLeadScoringHistory)
        .where(and(...historyConditions))
        .orderBy(desc(schema.crmLeadScoringHistory.createdAt))
        .limit(1);

      const previousScore = latestHistory?.newScore || 0;
      const newScore = previousScore + pointsAwarded;
      const previousTemperature = latestHistory?.newTemperature || 'cold';
      const newTemperature = classifyTemperature(newScore);

      await db.insert(schema.crmLeadScoringHistory).values({
        leadId: leadId || null,
        contactId: contactId || null,
        previousScore,
        newScore,
        scoreDelta: pointsAwarded,
        previousTemperature,
        newTemperature,
        triggerEventId: event.id,
        triggerEventType: req.body.eventType,
        changeReason: 'rule_triggered',
        scoringRuleId,
        orgId,
      });
    }

    res.status(201).json(event);
  } catch (error) {
    console.error('Error recording scoring event:', error);
    res.status(500).json({ error: 'Failed to record scoring event' });
  }
});

// GET /events/:contactId - get events for contact
router.get('/events/:contactId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const events = await db
      .select()
      .from(schema.crmLeadScoringEvents)
      .where(
        and(
          eq(schema.crmLeadScoringEvents.contactId, req.params.contactId),
          eq(schema.crmLeadScoringEvents.orgId, orgId)
        )
      )
      .orderBy(desc(schema.crmLeadScoringEvents.createdAt));

    res.json(events);
  } catch (error) {
    console.error('Error fetching scoring events:', error);
    res.status(500).json({ error: 'Failed to fetch scoring events' });
  }
});

// ============================================================================
// SCORE HISTORY
// ============================================================================

// GET /history/:contactId - get score history for contact
router.get('/history/:contactId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const history = await db
      .select()
      .from(schema.crmLeadScoringHistory)
      .where(
        and(
          eq(schema.crmLeadScoringHistory.contactId, req.params.contactId),
          eq(schema.crmLeadScoringHistory.orgId, orgId)
        )
      )
      .orderBy(desc(schema.crmLeadScoringHistory.createdAt));

    res.json(history);
  } catch (error) {
    console.error('Error fetching score history:', error);
    res.status(500).json({ error: 'Failed to fetch score history' });
  }
});

// ============================================================================
// ENGAGEMENT METRICS
// ============================================================================

// GET /engagement/:leadId - get engagement metrics for lead
router.get('/engagement/:leadId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [metrics] = await db
      .select()
      .from(schema.crmLeadEngagementMetrics)
      .where(
        and(
          eq(schema.crmLeadEngagementMetrics.leadId, req.params.leadId),
          eq(schema.crmLeadEngagementMetrics.orgId, orgId)
        )
      )
      .orderBy(desc(schema.crmLeadEngagementMetrics.calculatedAt))
      .limit(1);

    if (!metrics) return res.status(404).json({ error: 'Engagement metrics not found' });
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching engagement metrics:', error);
    res.status(500).json({ error: 'Failed to fetch engagement metrics' });
  }
});

// POST /engagement/recalculate - recalculate engagement for a lead
router.post('/engagement/recalculate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { leadId, contactId, periodDays = 30 } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId is required' });

    const db = await getDb();
    const schema = await getSchema();

    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Aggregate events for this lead in the period
    const eventConditions = [
      eq(schema.crmLeadScoringEvents.orgId, orgId),
      sql`${schema.crmLeadScoringEvents.createdAt} >= ${cutoffDate}`,
    ];

    if (contactId) {
      eventConditions.push(eq(schema.crmLeadScoringEvents.contactId, contactId));
    } else {
      eventConditions.push(eq(schema.crmLeadScoringEvents.leadId, leadId));
    }

    const events = await db
      .select()
      .from(schema.crmLeadScoringEvents)
      .where(and(...eventConditions));

    // Calculate engagement metrics from events
    const emailOpens = events.filter((e) => e.eventType === 'email_open').length;
    const emailClicks = events.filter((e) => e.eventType === 'email_click').length;
    const pageVisits = events.filter((e) => e.eventType === 'page_visit').length;
    const formSubmissions = events.filter((e) => e.eventType === 'form_submit').length;
    const callsMade = events.filter((e) => e.eventType === 'call_made').length;
    const meetingsAttended = events.filter((e) => e.eventType === 'meeting_attended').length;

    // Calculate composite engagement score (0-100)
    const engagementScore = Math.min(100,
      (emailOpens * 2) +
      (emailClicks * 5) +
      (pageVisits * 3) +
      (formSubmissions * 15) +
      (callsMade * 10) +
      (meetingsAttended * 20)
    );

    // Determine activity level
    const totalEvents = events.length;
    const activityLevel = totalEvents >= 20 ? 'high' : totalEvents >= 5 ? 'medium' : 'low';

    // Days since last activity
    const lastEvent = events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const daysSinceLastActivity = lastEvent
      ? Math.floor((Date.now() - new Date(lastEvent.createdAt).getTime()) / (24 * 60 * 60 * 1000))
      : periodDays;

    // Determine engagement trend by comparing to prior period
    const priorCutoff = new Date(cutoffDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const priorConditions = [
      eq(schema.crmLeadScoringEvents.orgId, orgId),
      sql`${schema.crmLeadScoringEvents.createdAt} >= ${priorCutoff}`,
      sql`${schema.crmLeadScoringEvents.createdAt} < ${cutoffDate}`,
    ];
    if (contactId) {
      priorConditions.push(eq(schema.crmLeadScoringEvents.contactId, contactId));
    } else {
      priorConditions.push(eq(schema.crmLeadScoringEvents.leadId, leadId));
    }

    const [priorCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.crmLeadScoringEvents)
      .where(and(...priorConditions));

    const priorEvents = Number(priorCount?.count || 0);
    const engagementTrend = totalEvents > priorEvents * 1.2
      ? 'increasing'
      : totalEvents < priorEvents * 0.8
        ? 'decreasing'
        : 'stable';

    // Upsert engagement metrics
    const metricsData = {
      leadId,
      contactId: contactId || null,
      emailsOpened: emailOpens,
      emailsClicked: emailClicks,
      pageVisits,
      formsCompleted: formSubmissions,
      callsReceived: callsMade,
      meetingsAttended,
      engagementScore: String(engagementScore),
      engagementTrend,
      activityLevel,
      daysSinceLastActivity,
      calculatedAt: new Date(),
      calculationPeriod: periodDays,
      orgId,
      updatedAt: new Date(),
    };

    // Check if metrics already exist for this lead
    const [existing] = await db
      .select()
      .from(schema.crmLeadEngagementMetrics)
      .where(
        and(
          eq(schema.crmLeadEngagementMetrics.leadId, leadId),
          eq(schema.crmLeadEngagementMetrics.orgId, orgId)
        )
      )
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(schema.crmLeadEngagementMetrics)
        .set(metricsData)
        .where(eq(schema.crmLeadEngagementMetrics.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(schema.crmLeadEngagementMetrics)
        .values(metricsData)
        .returning();
    }

    res.json(result);
  } catch (error) {
    console.error('Error recalculating engagement:', error);
    res.status(500).json({ error: 'Failed to recalculate engagement metrics' });
  }
});

// ============================================================================
// LEADERBOARD
// ============================================================================

// GET /leaderboard - top scored leads
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);

    // Get latest score for each contact from history using a subquery approach
    // Get all latest history entries, deduplicated by contactId
    const latestScores = await db
      .select({
        contactId: schema.crmLeadScoringHistory.contactId,
        leadId: schema.crmLeadScoringHistory.leadId,
        newScore: schema.crmLeadScoringHistory.newScore,
        newTemperature: schema.crmLeadScoringHistory.newTemperature,
        createdAt: schema.crmLeadScoringHistory.createdAt,
      })
      .from(schema.crmLeadScoringHistory)
      .where(eq(schema.crmLeadScoringHistory.orgId, orgId))
      .orderBy(desc(schema.crmLeadScoringHistory.newScore))
      .limit(limit * 3); // Fetch extra to account for duplicates

    // Deduplicate by contactId or leadId, keeping highest score
    const seen = new Set<string>();
    const leaderboard = latestScores.filter((entry) => {
      const key = entry.contactId || entry.leadId || '';
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;

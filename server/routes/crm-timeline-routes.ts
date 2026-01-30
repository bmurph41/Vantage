import { Router } from 'express';
import { db } from '../db';
import { crmTimelineEvents, crmActivities, crmNotes, users } from '@shared/schema';
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    const filter = req.query.filter as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }
    
    const conditions = [
      eq(crmTimelineEvents.orgId, orgId),
      eq(crmTimelineEvents.entityType, entityType),
      eq(crmTimelineEvents.entityId, entityId),
    ];
    
    if (filter && filter !== 'all') {
      if (filter === 'notes') {
        conditions.push(or(
          eq(crmTimelineEvents.eventType, 'note_created'),
          eq(crmTimelineEvents.eventType, 'note_updated')
        )!);
      } else if (filter === 'activities') {
        conditions.push(or(
          eq(crmTimelineEvents.eventType, 'activity_created'),
          eq(crmTimelineEvents.eventType, 'activity_completed'),
          eq(crmTimelineEvents.eventType, 'activity_reopened')
        )!);
      } else if (filter === 'emails') {
        conditions.push(eq(crmTimelineEvents.eventType, 'email_logged'));
      } else if (filter === 'files') {
        conditions.push(eq(crmTimelineEvents.eventType, 'file_uploaded'));
      } else if (filter === 'changelog') {
        conditions.push(or(
          eq(crmTimelineEvents.eventType, 'stage_changed'),
          eq(crmTimelineEvents.eventType, 'deal_updated')
        )!);
      }
    }
    
    const events = await db
      .select({
        event: crmTimelineEvents,
        actor: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmTimelineEvents)
      .leftJoin(users, eq(crmTimelineEvents.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(crmTimelineEvents.occurredAt))
      .limit(limit)
      .offset(offset);
    
    res.json({
      items: events.map(row => ({
        ...row.event,
        actor: row.actor
      })),
      nextCursor: events.length === limit ? String(offset + limit) : undefined,
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

router.get('/focus', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    
    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    const overdueActivities = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        eq(crmActivities.entityType, entityType),
        eq(crmActivities.entityId, entityId),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        sql`${crmActivities.scheduledAt} < ${startOfToday}`
      ))
      .orderBy(crmActivities.scheduledAt)
      .limit(5);
    
    const todayActivities = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        eq(crmActivities.entityType, entityType),
        eq(crmActivities.entityId, entityId),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        sql`${crmActivities.scheduledAt} >= ${startOfToday}`,
        sql`${crmActivities.scheduledAt} <= ${endOfToday}`
      ))
      .orderBy(crmActivities.scheduledAt)
      .limit(5);
    
    const upcomingActivities = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        eq(crmActivities.entityType, entityType),
        eq(crmActivities.entityId, entityId),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        sql`${crmActivities.scheduledAt} > ${endOfToday}`
      ))
      .orderBy(crmActivities.scheduledAt)
      .limit(5);
    
    const pinnedNotes = await db
      .select()
      .from(crmNotes)
      .where(and(
        eq(crmNotes.orgId, orgId),
        eq(crmNotes.entityType, entityType),
        eq(crmNotes.entityId, entityId),
        eq(crmNotes.isPinned, true)
      ))
      .orderBy(desc(crmNotes.createdAt))
      .limit(3);
    
    res.json({
      overdue: overdueActivities,
      today: todayActivities,
      upcoming: upcomingActivities,
      pinnedNotes,
    });
  } catch (error) {
    console.error('Error fetching focus data:', error);
    res.status(500).json({ error: 'Failed to fetch focus data' });
  }
});

export default router;

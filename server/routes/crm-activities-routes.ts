import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { crmActivities, users } from '@shared/schema';
import { eq, and, or, gte, lte, lt, ilike, sql, desc, asc } from 'drizzle-orm';
import { createTimelineEvent } from '../services/timeline-event-service';

const router = Router();

const activityTypeSchema = z.enum(['call', 'email', 'follow_up', 'task', 'deadline', 'meeting', 'site_visit', 'note', 'sms', 'showing', 'document']);

router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const status = (req.query.status as string) || 'open';
    const timeWindow = req.query.timeWindow as string;
    const customStart = req.query.customStart as string;
    const customEnd = req.query.customEnd as string;
    const type = req.query.type as string;
    const ownerId = req.query.ownerId as string;
    const dealId = req.query.dealId as string;
    const leadId = req.query.leadId as string;
    const contactId = req.query.contactId as string;
    const q = req.query.q as string;
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const conditions: any[] = [eq(crmActivities.orgId, orgId)];
    
    if (status === 'open') {
      conditions.push(or(
        eq(crmActivities.status, 'scheduled'),
        eq(crmActivities.status, 'in_progress')
      ));
    } else if (status === 'done') {
      conditions.push(eq(crmActivities.status, 'completed'));
    }
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    if (timeWindow === 'overdue') {
      conditions.push(lt(crmActivities.scheduledAt, startOfToday));
      conditions.push(or(
        eq(crmActivities.status, 'scheduled'),
        eq(crmActivities.status, 'in_progress')
      ));
    } else if (timeWindow === 'today') {
      conditions.push(gte(crmActivities.scheduledAt, startOfToday));
      conditions.push(lte(crmActivities.scheduledAt, endOfToday));
    } else if (timeWindow === 'tomorrow') {
      const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000 - 1);
      conditions.push(gte(crmActivities.scheduledAt, startOfTomorrow));
      conditions.push(lte(crmActivities.scheduledAt, endOfTomorrow));
    } else if (timeWindow === 'this_week') {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      conditions.push(gte(crmActivities.scheduledAt, startOfWeek));
      conditions.push(lte(crmActivities.scheduledAt, endOfWeek));
    } else if (timeWindow === 'next_week') {
      const dayOfWeek = now.getDay();
      const startOfNextWeek = new Date(startOfToday.getTime() + (7 - dayOfWeek) * 24 * 60 * 60 * 1000);
      const endOfNextWeek = new Date(startOfNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      conditions.push(gte(crmActivities.scheduledAt, startOfNextWeek));
      conditions.push(lte(crmActivities.scheduledAt, endOfNextWeek));
    } else if (timeWindow === 'custom' && customStart && customEnd) {
      conditions.push(gte(crmActivities.scheduledAt, new Date(customStart)));
      conditions.push(lte(crmActivities.scheduledAt, new Date(customEnd)));
    }
    
    if (type && type !== 'all') {
      conditions.push(eq(crmActivities.type, type));
    }
    
    if (ownerId) {
      conditions.push(eq(crmActivities.userId, ownerId));
    }
    
    if (entityType && entityId) {
      conditions.push(eq(crmActivities.entityType, entityType));
      conditions.push(eq(crmActivities.entityId, entityId));
    }
    
    if (q) {
      conditions.push(
        or(
          ilike(crmActivities.subject, `%${q}%`),
          ilike(crmActivities.description, `%${q}%`)
        )
      );
    }
    
    const items = await db
      .select({
        activity: crmActivities,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmActivities)
      .leftJoin(users, eq(crmActivities.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(crmActivities.scheduledAt))
      .limit(limit)
      .offset(offset);
    
    const [overdueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        lt(crmActivities.scheduledAt, startOfToday)
      ));
    
    const [todayCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        gte(crmActivities.scheduledAt, startOfToday),
        lte(crmActivities.scheduledAt, endOfToday)
      ));
    
    const [upcomingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        gte(crmActivities.scheduledAt, new Date(endOfToday.getTime() + 1))
      ));
    
    res.json({
      items: items.map(row => ({
        ...row.activity,
        owner: row.owner
      })),
      nextCursor: items.length === limit ? String(offset + limit) : undefined,
      counts: {
        overdue: overdueCount?.count || 0,
        today: todayCount?.count || 0,
        upcoming: upcomingCount?.count || 0,
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.post('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      type: activityTypeSchema,
      subject: z.string().optional(),
      description: z.string().min(1),
      scheduledAt: z.string().datetime().optional(),
      duration: z.number().optional(),
      entityType: z.string(),
      entityId: z.string(),
      ownerId: z.string().uuid().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const [activity] = await db.insert(crmActivities).values({
      type: data.type,
      subject: data.subject,
      description: data.description,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      duration: data.duration,
      entityType: data.entityType,
      entityId: data.entityId,
      userId: data.ownerId || userId,
      orgId: orgId,
      status: data.scheduledAt ? 'scheduled' : 'completed',
    }).returning();
    
    if (data.entityType && data.entityId) {
      await createTimelineEvent({
        orgId,
        actorId: userId,
        entityType: data.entityType,
        entityId: data.entityId,
        eventType: 'activity_created',
        title: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} scheduled: ${data.subject || data.description.substring(0, 50)}`,
        description: data.description,
        metadata: { activityId: activity.id, activityType: data.type },
      });
    }
    
    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating activity:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create activity' });
    }
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    const { id } = req.params;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [activity] = await db
      .update(crmActivities)
      .set({ 
        status: 'completed', 
        completedAt: new Date(),
      })
      .where(and(
        eq(crmActivities.id, id),
        eq(crmActivities.orgId, orgId)
      ))
      .returning();
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    if (activity.entityType && activity.entityId) {
      await createTimelineEvent({
        orgId,
        actorId: userId,
        entityType: activity.entityType,
        entityId: activity.entityId,
        eventType: 'activity_completed',
        title: `Completed: ${activity.subject || activity.description?.substring(0, 50)}`,
        metadata: { activityId: activity.id, activityType: activity.type },
      });
    }
    
    res.json(activity);
  } catch (error) {
    console.error('Error completing activity:', error);
    res.status(500).json({ error: 'Failed to complete activity' });
  }
});

router.post('/:id/reopen', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [activity] = await db
      .update(crmActivities)
      .set({ 
        status: 'scheduled', 
        completedAt: null,
      })
      .where(and(
        eq(crmActivities.id, id),
        eq(crmActivities.orgId, orgId)
      ))
      .returning();
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json(activity);
  } catch (error) {
    console.error('Error reopening activity:', error);
    res.status(500).json({ error: 'Failed to reopen activity' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      type: activityTypeSchema.optional(),
      subject: z.string().optional(),
      description: z.string().optional(),
      scheduledAt: z.string().datetime().optional().nullable(),
      duration: z.number().optional(),
      ownerId: z.string().uuid().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.ownerId) updateData.userId = data.ownerId;
    
    const [activity] = await db
      .update(crmActivities)
      .set(updateData)
      .where(and(
        eq(crmActivities.id, id),
        eq(crmActivities.orgId, orgId)
      ))
      .returning();
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json(activity);
  } catch (error) {
    console.error('Error updating activity:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update activity' });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [deleted] = await db
      .delete(crmActivities)
      .where(and(
        eq(crmActivities.id, id),
        eq(crmActivities.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;

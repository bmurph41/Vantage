import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  crmRedFlags,
  crmRedFlagEscalations,
  crmRedFlagRules,
  crmDeals,
  users,
  insertCrmRedFlagSchema,
  insertCrmRedFlagEscalationSchema,
  insertCrmRedFlagRuleSchema,
} from '@shared/schema';
import { eq, and, desc, asc, sql, or, inArray, isNull, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

router.get('/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { status } = req.query;

    let whereClause = eq(crmRedFlags.dealId, dealId);
    if (status && status !== 'all') {
      whereClause = and(whereClause, eq(crmRedFlags.status, status as any))!;
    }

    const flags = await db.select({
      flag: crmRedFlags,
      raisedBy: {
        id: users.id,
        name: users.name,
      },
    })
    .from(crmRedFlags)
    .leftJoin(users, eq(crmRedFlags.raisedById, users.id))
    .where(whereClause)
    .orderBy(desc(crmRedFlags.raisedAt));

    res.json(flags);
  } catch (error) {
    console.error('[Red Flags] Error fetching deal flags:', error);
    res.status(500).json({ error: 'Failed to fetch red flags' });
  }
});

router.get('/my-escalations', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'user-1';

    const escalations = await db.select({
      escalation: crmRedFlagEscalations,
      redFlag: crmRedFlags,
      deal: {
        id: crmDeals.id,
        title: crmDeals.title,
        value: crmDeals.value,
      },
    })
    .from(crmRedFlagEscalations)
    .innerJoin(crmRedFlags, eq(crmRedFlagEscalations.redFlagId, crmRedFlags.id))
    .innerJoin(crmDeals, eq(crmRedFlags.dealId, crmDeals.id))
    .where(
      and(
        eq(crmRedFlagEscalations.escalatedToId, userId),
        eq(crmRedFlagEscalations.responseStatus, 'pending')
      )
    )
    .orderBy(desc(crmRedFlagEscalations.createdAt));

    res.json(escalations);
  } catch (error) {
    console.error('[Red Flags] Error fetching my escalations:', error);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'user-1';

    const openCount = await db.select({ count: sql<number>`count(*)` })
      .from(crmRedFlags)
      .where(eq(crmRedFlags.status, 'open'));

    const myEscalationsCount = await db.select({ count: sql<number>`count(*)` })
      .from(crmRedFlagEscalations)
      .where(
        and(
          eq(crmRedFlagEscalations.escalatedToId, userId),
          eq(crmRedFlagEscalations.responseStatus, 'pending')
        )
      );

    const bySeverity = await db.select({
      severity: crmRedFlags.severity,
      count: sql<number>`count(*)`,
    })
    .from(crmRedFlags)
    .where(eq(crmRedFlags.status, 'open'))
    .groupBy(crmRedFlags.severity);

    const byCategory = await db.select({
      category: crmRedFlags.category,
      count: sql<number>`count(*)`,
    })
    .from(crmRedFlags)
    .where(eq(crmRedFlags.status, 'open'))
    .groupBy(crmRedFlags.category);

    res.json({
      openCount: Number(openCount[0]?.count || 0),
      myEscalationsCount: Number(myEscalationsCount[0]?.count || 0),
      bySeverity: bySeverity.map(s => ({ severity: s.severity, count: Number(s.count) })),
      byCategory: byCategory.map(c => ({ category: c.category, count: Number(c.count) })),
    });
  } catch (error) {
    console.error('[Red Flags] Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'user-1';
    const parsed = insertCrmRedFlagSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    const data = {
      ...parsed.data,
      raisedById: userId,
      triggeredBy: 'manual',
    };

    const [flag] = await db.insert(crmRedFlags).values(data).returning();

    const [deal] = await db.select({ ownerId: crmDeals.ownerId })
      .from(crmDeals)
      .where(eq(crmDeals.id, flag.dealId));

    if (deal?.ownerId && deal.ownerId !== userId) {
      await db.insert(crmRedFlagEscalations).values({
        redFlagId: flag.id,
        escalationLevel: 1,
        escalatedToId: deal.ownerId,
        escalatedToRole: 'deal_owner',
        notificationMethod: 'in_app',
      });
    }

    res.status(201).json(flag);
  } catch (error) {
    console.error('[Red Flags] Error creating flag:', error);
    res.status(500).json({ error: 'Failed to create red flag' });
  }
});

router.patch('/:flagId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const userId = (req as any).userId || 'user-1';

    const [updated] = await db.update(crmRedFlags)
      .set({
        status: 'acknowledged',
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmRedFlags.id, flagId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Red flag not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Red Flags] Error acknowledging flag:', error);
    res.status(500).json({ error: 'Failed to acknowledge red flag' });
  }
});

router.patch('/:flagId/resolve', async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const userId = (req as any).userId || 'user-1';
    const { resolutionNotes } = req.body;

    const [updated] = await db.update(crmRedFlags)
      .set({
        status: 'resolved',
        resolvedById: userId,
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(eq(crmRedFlags.id, flagId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Red flag not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Red Flags] Error resolving flag:', error);
    res.status(500).json({ error: 'Failed to resolve red flag' });
  }
});

router.patch('/:flagId/dismiss', async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const userId = (req as any).userId || 'user-1';
    const { dismissReason } = req.body;

    const [updated] = await db.update(crmRedFlags)
      .set({
        status: 'dismissed',
        dismissedById: userId,
        dismissedAt: new Date(),
        dismissReason,
        updatedAt: new Date(),
      })
      .where(eq(crmRedFlags.id, flagId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Red flag not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Red Flags] Error dismissing flag:', error);
    res.status(500).json({ error: 'Failed to dismiss red flag' });
  }
});

router.post('/:flagId/escalate', async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const { escalatedToId, escalatedToRole, notificationMethod } = req.body;

    const [flag] = await db.select().from(crmRedFlags).where(eq(crmRedFlags.id, flagId));
    if (!flag) {
      return res.status(404).json({ error: 'Red flag not found' });
    }

    const existingEscalations = await db.select({
      maxLevel: sql<number>`MAX(${crmRedFlagEscalations.escalationLevel})`,
    })
    .from(crmRedFlagEscalations)
    .where(eq(crmRedFlagEscalations.redFlagId, flagId));

    const nextLevel = (existingEscalations[0]?.maxLevel || 0) + 1;

    const [escalation] = await db.insert(crmRedFlagEscalations).values({
      redFlagId: flagId,
      escalationLevel: nextLevel,
      escalatedToId,
      escalatedToRole,
      notificationMethod: notificationMethod || 'in_app',
    }).returning();

    res.status(201).json(escalation);
  } catch (error) {
    console.error('[Red Flags] Error escalating flag:', error);
    res.status(500).json({ error: 'Failed to escalate red flag' });
  }
});

router.patch('/escalations/:escalationId/respond', async (req: Request, res: Response) => {
  try {
    const { escalationId } = req.params;
    const { responseNotes } = req.body;

    const [updated] = await db.update(crmRedFlagEscalations)
      .set({
        responseStatus: 'responded',
        respondedAt: new Date(),
        responseNotes,
      })
      .where(eq(crmRedFlagEscalations.id, escalationId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Red Flags] Error responding to escalation:', error);
    res.status(500).json({ error: 'Failed to respond to escalation' });
  }
});

router.get('/:flagId/escalations', async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;

    const escalations = await db.select({
      escalation: crmRedFlagEscalations,
      escalatedTo: {
        id: users.id,
        name: users.name,
      },
    })
    .from(crmRedFlagEscalations)
    .leftJoin(users, eq(crmRedFlagEscalations.escalatedToId, users.id))
    .where(eq(crmRedFlagEscalations.redFlagId, flagId))
    .orderBy(asc(crmRedFlagEscalations.escalationLevel));

    res.json(escalations);
  } catch (error) {
    console.error('[Red Flags] Error fetching escalations:', error);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

router.get('/rules', async (req: Request, res: Response) => {
  try {
    const rules = await db.select()
      .from(crmRedFlagRules)
      .orderBy(desc(crmRedFlagRules.createdAt));

    res.json(rules);
  } catch (error) {
    console.error('[Red Flags] Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

router.post('/rules', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'user-1';
    const parsed = insertCrmRedFlagRuleSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    const [rule] = await db.insert(crmRedFlagRules).values({
      ...parsed.data,
      ownerId: userId,
    }).returning();

    res.status(201).json(rule);
  } catch (error) {
    console.error('[Red Flags] Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.patch('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const updateData = req.body;

    const [updated] = await db.update(crmRedFlagRules)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(crmRedFlagRules.id, ruleId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Red Flags] Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    const [deleted] = await db.delete(crmRedFlagRules)
      .where(eq(crmRedFlagRules.id, ruleId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Red Flags] Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

router.post('/scan-deals', async (req: Request, res: Response) => {
  try {
    const rules = await db.select()
      .from(crmRedFlagRules)
      .where(eq(crmRedFlagRules.isActive, true));

    const flagsCreated: any[] = [];

    for (const rule of rules) {
      const conditions = rule.conditions as any[];
      
      if (conditions.some(c => c.type === 'stale_days')) {
        const staleDaysCondition = conditions.find(c => c.type === 'stale_days');
        const staleDays = staleDaysCondition?.value || 14;
        const staleDate = new Date();
        staleDate.setDate(staleDate.getDate() - staleDays);

        const staleDeals = await db.select()
          .from(crmDeals)
          .where(
            and(
              lte(crmDeals.lastActivityDate, staleDate),
              eq(crmDeals.isClosed, false)
            )
          );

        for (const deal of staleDeals) {
          const [existingFlag] = await db.select()
            .from(crmRedFlags)
            .where(
              and(
                eq(crmRedFlags.dealId, deal.id),
                eq(crmRedFlags.category, 'stale_deal'),
                eq(crmRedFlags.status, 'open')
              )
            );

          if (!existingFlag) {
            const [newFlag] = await db.insert(crmRedFlags).values({
              dealId: deal.id,
              category: 'stale_deal',
              severity: rule.severity,
              title: `Deal inactive for ${staleDays}+ days`,
              description: `No activity recorded since ${staleDate.toLocaleDateString()}`,
              triggeredBy: 'automation',
              triggerCondition: { ruleId: rule.id, staleDays },
              autoEscalateAfterDays: rule.autoEscalateAfterDays,
            }).returning();

            if (deal.ownerId) {
              await db.insert(crmRedFlagEscalations).values({
                redFlagId: newFlag.id,
                escalationLevel: 1,
                escalatedToId: deal.ownerId,
                escalatedToRole: 'deal_owner',
                notificationMethod: 'in_app',
              });
            }

            flagsCreated.push(newFlag);
          }
        }
      }

      if (conditions.some(c => c.type === 'deadline_proximity')) {
        const deadlineCondition = conditions.find(c => c.type === 'deadline_proximity');
        const daysBeforeDeadline = deadlineCondition?.value || 7;
        const deadlineThreshold = new Date();
        deadlineThreshold.setDate(deadlineThreshold.getDate() + daysBeforeDeadline);

        const dealsNearDeadline = await db.select()
          .from(crmDeals)
          .where(
            and(
              lte(crmDeals.expectedCloseDate, deadlineThreshold),
              gte(crmDeals.expectedCloseDate, new Date()),
              eq(crmDeals.isClosed, false)
            )
          );

        for (const deal of dealsNearDeadline) {
          const [existingFlag] = await db.select()
            .from(crmRedFlags)
            .where(
              and(
                eq(crmRedFlags.dealId, deal.id),
                eq(crmRedFlags.category, 'deadline_missed'),
                eq(crmRedFlags.status, 'open')
              )
            );

          if (!existingFlag && deal.expectedCloseDate) {
            const daysUntil = Math.ceil((deal.expectedCloseDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            const [newFlag] = await db.insert(crmRedFlags).values({
              dealId: deal.id,
              category: 'deadline_missed',
              severity: daysUntil <= 3 ? 'critical' : rule.severity,
              title: `Close date approaching in ${daysUntil} days`,
              description: `Expected close date: ${deal.expectedCloseDate.toLocaleDateString()}`,
              triggeredBy: 'automation',
              triggerCondition: { ruleId: rule.id, daysUntil },
              dueDate: deal.expectedCloseDate,
              autoEscalateAfterDays: rule.autoEscalateAfterDays,
            }).returning();

            if (deal.ownerId) {
              await db.insert(crmRedFlagEscalations).values({
                redFlagId: newFlag.id,
                escalationLevel: 1,
                escalatedToId: deal.ownerId,
                escalatedToRole: 'deal_owner',
                notificationMethod: 'in_app',
              });
            }

            flagsCreated.push(newFlag);
          }
        }
      }
    }

    res.json({
      success: true,
      flagsCreated: flagsCreated.length,
      flags: flagsCreated,
    });
  } catch (error) {
    console.error('[Red Flags] Error scanning deals:', error);
    res.status(500).json({ error: 'Failed to scan deals' });
  }
});

export default router;

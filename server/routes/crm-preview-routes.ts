import { Router } from 'express';
import { db } from '../db';
import { crmDeals, crmLeads, crmActivities, users } from '@shared/schema';
import { eq, and, gte, asc, or } from 'drizzle-orm';

const router = Router();

router.get('/deals/:id/preview', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const deal = await db
      .select({
        deal: crmDeals,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmDeals)
      .leftJoin(users, eq(crmDeals.ownerId, users.id))
      .where(eq(crmDeals.id, id))
      .limit(1);
    
    if (!deal.length) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const [nextActivity] = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        eq(crmActivities.entityType, 'deal'),
        eq(crmActivities.entityId, id),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        gte(crmActivities.scheduledAt, new Date())
      ))
      .orderBy(asc(crmActivities.scheduledAt))
      .limit(1);
    
    res.json({
      id: deal[0].deal.id,
      name: deal[0].deal.name,
      value: deal[0].deal.value,
      stage: deal[0].deal.stage,
      owner: deal[0].owner,
      nextActivity: nextActivity || null,
    });
  } catch (error) {
    console.error('Error fetching deal preview:', error);
    res.status(500).json({ error: 'Failed to fetch deal preview' });
  }
});

router.get('/leads/:id/preview', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const lead = await db
      .select({
        lead: crmLeads,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmLeads)
      .leftJoin(users, eq(crmLeads.ownerId, users.id))
      .where(and(
        eq(crmLeads.id, id),
        eq(crmLeads.orgId, orgId)
      ))
      .limit(1);
    
    if (!lead.length) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const [nextActivity] = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        eq(crmActivities.entityType, 'lead'),
        eq(crmActivities.entityId, id),
        or(
          eq(crmActivities.status, 'scheduled'),
          eq(crmActivities.status, 'in_progress')
        ),
        gte(crmActivities.scheduledAt, new Date())
      ))
      .orderBy(asc(crmActivities.scheduledAt))
      .limit(1);
    
    res.json({
      id: lead[0].lead.id,
      name: lead[0].lead.name,
      status: lead[0].lead.status,
      source: lead[0].lead.source,
      owner: lead[0].owner,
      nextActivity: nextActivity || null,
    });
  } catch (error) {
    console.error('Error fetching lead preview:', error);
    res.status(500).json({ error: 'Failed to fetch lead preview' });
  }
});

export default router;

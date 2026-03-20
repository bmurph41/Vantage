import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emailCampaignSchedules } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || (req as any).user?.organizationId || null;
}

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
  audienceType: z.enum(['all', 'segment', 'list', 'manual']).default('all'),
  audienceFilter: z.record(z.any()).optional().default({}),
  recipientCount: z.number().int().min(0).optional().default(0),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'scheduled']).default('draft'),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  audienceType: z.enum(['all', 'segment', 'list', 'manual']).optional(),
  audienceFilter: z.record(z.any()).optional(),
  recipientCount: z.number().int().min(0).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'cancelled']).optional(),
});

// GET /campaigns/scheduled - list scheduled campaigns
router.get('/campaigns/scheduled', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const campaigns = await db
      .select()
      .from(emailCampaignSchedules)
      .where(eq(emailCampaignSchedules.orgId, orgId))
      .orderBy(desc(emailCampaignSchedules.createdAt));

    res.json(campaigns);
  } catch (error: any) {
    console.error('Error fetching scheduled campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled campaigns' });
  }
});

// POST /campaigns/schedule - create & schedule a campaign
router.post('/campaigns/schedule', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(', ') });
    }

    const data = parsed.data;
    const status = data.scheduledAt ? 'scheduled' : data.status;

    const [campaign] = await db
      .insert(emailCampaignSchedules)
      .values({
        orgId,
        name: data.name,
        subject: data.subject,
        body: data.body,
        audienceType: data.audienceType,
        audienceFilter: data.audienceFilter,
        recipientCount: data.recipientCount,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(campaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// PUT /campaigns/:id - update draft/scheduled campaign
router.put('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const parsed = updateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(', ') });
    }

    // Check campaign exists and belongs to org
    const existing = await db
      .select()
      .from(emailCampaignSchedules)
      .where(and(eq(emailCampaignSchedules.id, id), eq(emailCampaignSchedules.orgId, orgId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (['sent', 'sending'].includes(existing[0].status)) {
      return res.status(400).json({ error: 'Cannot modify a campaign that is already sent or sending' });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    const data = parsed.data;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.audienceType !== undefined) updateData.audienceType = data.audienceType;
    if (data.audienceFilter !== undefined) updateData.audienceFilter = data.audienceFilter;
    if (data.recipientCount !== undefined) updateData.recipientCount = data.recipientCount;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.status !== undefined) updateData.status = data.status;

    const [updated] = await db
      .update(emailCampaignSchedules)
      .set(updateData)
      .where(and(eq(emailCampaignSchedules.id, id), eq(emailCampaignSchedules.orgId, orgId)))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// DELETE /campaigns/:id - cancel/delete campaign
router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const existing = await db
      .select()
      .from(emailCampaignSchedules)
      .where(and(eq(emailCampaignSchedules.id, id), eq(emailCampaignSchedules.orgId, orgId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (existing[0].status === 'sending') {
      return res.status(400).json({ error: 'Cannot delete a campaign that is currently sending' });
    }

    await db
      .delete(emailCampaignSchedules)
      .where(and(eq(emailCampaignSchedules.id, id), eq(emailCampaignSchedules.orgId, orgId)));

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// POST /campaigns/:id/send-now - immediately send a scheduled campaign
router.post('/campaigns/:id/send-now', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const existing = await db
      .select()
      .from(emailCampaignSchedules)
      .where(and(eq(emailCampaignSchedules.id, id), eq(emailCampaignSchedules.orgId, orgId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (['sent', 'sending'].includes(existing[0].status)) {
      return res.status(400).json({ error: 'Campaign has already been sent or is sending' });
    }

    // Mark as sending, then sent
    const [updated] = await db
      .update(emailCampaignSchedules)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(emailCampaignSchedules.id, id), eq(emailCampaignSchedules.orgId, orgId)))
      .returning();

    // In production, this would trigger the actual email sending via SendGrid/etc.
    // For now, we mark it as sent immediately.
    res.json(updated);
  } catch (error: any) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
});

export default router;

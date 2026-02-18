import { Router } from 'express';
import { db } from '../db';
import { crmSavedViews } from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';

const router = Router();

router.get('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.orgId;
    const { objectType } = req.query;

    let conditions = [
      or(
        eq(crmSavedViews.userId, userId),
        and(eq(crmSavedViews.isShared, true), eq(crmSavedViews.orgId, orgId))
      )
    ];

    if (objectType) {
      conditions.push(eq(crmSavedViews.objectType, objectType as string));
    }

    const views = await db.select().from(crmSavedViews)
      .where(and(...conditions))
      .orderBy(desc(crmSavedViews.updatedAt));

    res.json(views);
  } catch (error: any) {
    console.error('Failed to fetch saved views:', error);
    res.status(500).json({ error: 'Failed to fetch saved views' });
  }
});

router.post('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.orgId;
    const { name, objectType, filters, columns, sortBy, sortOrder, isDefault, isShared } = req.body;

    if (!name || !objectType) {
      return res.status(400).json({ error: 'Name and objectType are required' });
    }

    if (isDefault) {
      await db.update(crmSavedViews)
        .set({ isDefault: false })
        .where(and(
          eq(crmSavedViews.userId, userId),
          eq(crmSavedViews.objectType, objectType),
          eq(crmSavedViews.isDefault, true)
        ));
    }

    const [view] = await db.insert(crmSavedViews).values({
      name,
      objectType,
      filters: filters || {},
      columns: columns || [],
      sortBy: sortBy || null,
      sortOrder: sortOrder || 'asc',
      isDefault: isDefault || false,
      isShared: isShared || false,
      userId,
      orgId,
    }).returning();

    res.json(view);
  } catch (error: any) {
    console.error('Failed to create saved view:', error);
    res.status(500).json({ error: 'Failed to create saved view' });
  }
});

router.patch('/:id', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    if (updates.isDefault) {
      await db.update(crmSavedViews)
        .set({ isDefault: false })
        .where(and(
          eq(crmSavedViews.userId, userId),
          eq(crmSavedViews.objectType, updates.objectType || ''),
          eq(crmSavedViews.isDefault, true)
        ));
    }

    const [view] = await db.update(crmSavedViews)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, userId)))
      .returning();

    if (!view) {
      return res.status(404).json({ error: 'View not found' });
    }

    res.json(view);
  } catch (error: any) {
    console.error('Failed to update saved view:', error);
    res.status(500).json({ error: 'Failed to update saved view' });
  }
});

router.delete('/:id', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await db.delete(crmSavedViews)
      .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, userId)));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete saved view:', error);
    res.status(500).json({ error: 'Failed to delete saved view' });
  }
});

export default router;

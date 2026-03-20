// ============================================================
// Docket (M&A Intelligence) Extended Routes — CRUD for docket sub-tables
// File: server/routes/docket-extended-routes.ts
//
// Mount in server/routes.ts:
//   import { docketExtendedRouter } from './routes/docket-extended-routes';
//   app.use('/api/docket', docketExtendedRouter);
// ============================================================

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  docketEntities,
  docketPortfolioCompanies,
  docketSavedSearches,
  docketWatchlists,
  docketWatchlistEntities,
  docketUserPreferences,
  docketNotificationPreferences,
  insertDocketEntitySchema,
  insertDocketPortfolioCompanySchema,
  insertDocketSavedSearchSchema,
  insertDocketWatchlistSchema,
  insertDocketWatchlistEntitySchema,
  insertDocketUserPreferencesSchema,
  insertDocketNotificationPreferencesSchema,
} from '@shared/schema';

const router = Router();

// ============================================================
// Entities
// ============================================================

// GET /entities - list docket entities
router.get('/entities', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const entities = await db.select()
      .from(docketEntities)
      .where(orgId ? eq(docketEntities.orgId, orgId) : undefined as any)
      .orderBy(desc(docketEntities.createdAt));
    res.json(entities);
  } catch (error: any) {
    console.error('Error listing docket entities:', error);
    res.status(500).json({ error: 'Failed to list entities', message: error.message });
  }
});

// GET /entities/:id - get entity detail
router.get('/entities/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [entity] = await db.select()
      .from(docketEntities)
      .where(and(
        eq(docketEntities.id, req.params.id),
        orgId ? eq(docketEntities.orgId, orgId) : undefined as any,
      ))
      .limit(1);
    if (!entity) return res.status(404).json({ error: 'Entity not found' });
    res.json(entity);
  } catch (error: any) {
    console.error('Error getting docket entity:', error);
    res.status(500).json({ error: 'Failed to get entity', message: error.message });
  }
});

// ============================================================
// Portfolio Companies
// ============================================================

// GET /portfolio-companies - list portfolio companies
router.get('/portfolio-companies', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const companies = await db.select()
      .from(docketPortfolioCompanies)
      .where(orgId ? eq(docketPortfolioCompanies.orgId, orgId) : undefined as any)
      .orderBy(desc(docketPortfolioCompanies.createdAt));
    res.json(companies);
  } catch (error: any) {
    console.error('Error listing portfolio companies:', error);
    res.status(500).json({ error: 'Failed to list portfolio companies', message: error.message });
  }
});

// POST /portfolio-companies - create portfolio company
router.post('/portfolio-companies', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const parsed = insertDocketPortfolioCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [company] = await db.insert(docketPortfolioCompanies)
      .values({ ...parsed.data, orgId, userId })
      .returning();
    res.status(201).json(company);
  } catch (error: any) {
    console.error('Error creating portfolio company:', error);
    res.status(500).json({ error: 'Failed to create portfolio company', message: error.message });
  }
});

// ============================================================
// Saved Searches
// ============================================================

// GET /saved-searches - list saved searches
router.get('/saved-searches', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const searches = await db.select()
      .from(docketSavedSearches)
      .where(and(
        orgId ? eq(docketSavedSearches.orgId, orgId) : undefined as any,
        userId ? eq(docketSavedSearches.userId, userId) : undefined as any,
      ))
      .orderBy(desc(docketSavedSearches.createdAt));
    res.json(searches);
  } catch (error: any) {
    console.error('Error listing saved searches:', error);
    res.status(500).json({ error: 'Failed to list saved searches', message: error.message });
  }
});

// POST /saved-searches - create saved search
router.post('/saved-searches', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const parsed = insertDocketSavedSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [search] = await db.insert(docketSavedSearches)
      .values({ ...parsed.data, orgId, userId })
      .returning();
    res.status(201).json(search);
  } catch (error: any) {
    console.error('Error creating saved search:', error);
    res.status(500).json({ error: 'Failed to create saved search', message: error.message });
  }
});

// DELETE /saved-searches/:id - delete saved search
router.delete('/saved-searches/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [deleted] = await db.delete(docketSavedSearches)
      .where(and(
        eq(docketSavedSearches.id, req.params.id),
        orgId ? eq(docketSavedSearches.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Saved search not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error deleting saved search:', error);
    res.status(500).json({ error: 'Failed to delete saved search', message: error.message });
  }
});

// ============================================================
// Watchlists
// ============================================================

// GET /watchlists - list watchlists
router.get('/watchlists', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const watchlists = await db.select()
      .from(docketWatchlists)
      .where(and(
        orgId ? eq(docketWatchlists.orgId, orgId) : undefined as any,
        userId ? eq(docketWatchlists.userId, userId) : undefined as any,
      ))
      .orderBy(desc(docketWatchlists.createdAt));
    res.json(watchlists);
  } catch (error: any) {
    console.error('Error listing watchlists:', error);
    res.status(500).json({ error: 'Failed to list watchlists', message: error.message });
  }
});

// POST /watchlists - create watchlist
router.post('/watchlists', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const parsed = insertDocketWatchlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [watchlist] = await db.insert(docketWatchlists)
      .values({ ...parsed.data, orgId, userId })
      .returning();
    res.status(201).json(watchlist);
  } catch (error: any) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ error: 'Failed to create watchlist', message: error.message });
  }
});

// DELETE /watchlists/:id - delete watchlist
router.delete('/watchlists/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [deleted] = await db.delete(docketWatchlists)
      .where(and(
        eq(docketWatchlists.id, req.params.id),
        orgId ? eq(docketWatchlists.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Watchlist not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error deleting watchlist:', error);
    res.status(500).json({ error: 'Failed to delete watchlist', message: error.message });
  }
});

// ============================================================
// Watchlist Entities
// ============================================================

// POST /watchlists/:id/entities - add entity to watchlist
router.post('/watchlists/:id/entities', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { entityId } = req.body;
    if (!entityId) {
      return res.status(400).json({ error: 'entityId is required' });
    }
    const [entry] = await db.insert(docketWatchlistEntities)
      .values({
        orgId,
        watchlistId: req.params.id,
        entityId,
      })
      .returning();
    res.status(201).json(entry);
  } catch (error: any) {
    console.error('Error adding entity to watchlist:', error);
    res.status(500).json({ error: 'Failed to add entity to watchlist', message: error.message });
  }
});

// DELETE /watchlists/:id/entities/:entityId - remove entity from watchlist
router.delete('/watchlists/:id/entities/:entityId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [deleted] = await db.delete(docketWatchlistEntities)
      .where(and(
        eq(docketWatchlistEntities.watchlistId, req.params.id),
        eq(docketWatchlistEntities.entityId, req.params.entityId),
        orgId ? eq(docketWatchlistEntities.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Watchlist entity not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error removing entity from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove entity from watchlist', message: error.message });
  }
});

// ============================================================
// User Preferences
// ============================================================

// GET /preferences - get user preferences
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const [prefs] = await db.select()
      .from(docketUserPreferences)
      .where(and(
        orgId ? eq(docketUserPreferences.orgId, orgId) : undefined as any,
        userId ? eq(docketUserPreferences.userId, userId) : undefined as any,
      ))
      .limit(1);
    if (!prefs) return res.json(null);
    res.json(prefs);
  } catch (error: any) {
    console.error('Error getting user preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences', message: error.message });
  }
});

// PATCH /preferences - upsert user preferences
router.patch('/preferences', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { defaultFilters, favoriteCategories, favoriteSources } = req.body;

    // Check if preferences exist
    const [existing] = await db.select()
      .from(docketUserPreferences)
      .where(and(
        eq(docketUserPreferences.orgId, orgId),
        eq(docketUserPreferences.userId, userId),
      ))
      .limit(1);

    if (existing) {
      const [updated] = await db.update(docketUserPreferences)
        .set({
          ...(defaultFilters !== undefined && { defaultFilters }),
          ...(favoriteCategories !== undefined && { favoriteCategories }),
          ...(favoriteSources !== undefined && { favoriteSources }),
          updatedAt: new Date(),
        })
        .where(eq(docketUserPreferences.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(docketUserPreferences)
        .values({
          orgId,
          userId,
          defaultFilters: defaultFilters ?? {},
          favoriteCategories: favoriteCategories ?? [],
          favoriteSources: favoriteSources ?? [],
        })
        .returning();
      res.status(201).json(created);
    }
  } catch (error: any) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences', message: error.message });
  }
});

// ============================================================
// Notification Preferences
// ============================================================

// GET /notification-preferences - get notification preferences
router.get('/notification-preferences', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const [prefs] = await db.select()
      .from(docketNotificationPreferences)
      .where(and(
        orgId ? eq(docketNotificationPreferences.orgId, orgId) : undefined as any,
        userId ? eq(docketNotificationPreferences.userId, userId) : undefined as any,
      ))
      .limit(1);
    if (!prefs) return res.json(null);
    res.json(prefs);
  } catch (error: any) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences', message: error.message });
  }
});

// PATCH /notification-preferences - upsert notification preferences
router.patch('/notification-preferences', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { emailAddress, categories, frequency, deliveryTime, timezone, enabled } = req.body;

    // Check if preferences exist
    const [existing] = await db.select()
      .from(docketNotificationPreferences)
      .where(and(
        eq(docketNotificationPreferences.orgId, orgId),
        eq(docketNotificationPreferences.userId, userId),
      ))
      .limit(1);

    if (existing) {
      const [updated] = await db.update(docketNotificationPreferences)
        .set({
          ...(emailAddress !== undefined && { emailAddress }),
          ...(categories !== undefined && { categories }),
          ...(frequency !== undefined && { frequency }),
          ...(deliveryTime !== undefined && { deliveryTime }),
          ...(timezone !== undefined && { timezone }),
          ...(enabled !== undefined && { enabled }),
          updatedAt: new Date(),
        })
        .where(eq(docketNotificationPreferences.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      if (!emailAddress) {
        return res.status(400).json({ error: 'emailAddress is required for new notification preferences' });
      }
      const [created] = await db.insert(docketNotificationPreferences)
        .values({
          orgId,
          userId,
          emailAddress,
          categories: categories ?? [],
          frequency: frequency ?? 'none',
          deliveryTime: deliveryTime ?? '09:00',
          timezone: timezone ?? 'America/New_York',
          enabled: enabled ?? true,
        })
        .returning();
      res.status(201).json(created);
    }
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences', message: error.message });
  }
});

export default router;
export { router as docketExtendedRouter };

/**
 * DD Checklist Item Period Routes
 * 
 * Manages year/month/trailing period slots for checklist items.
 * Periods contribute to item-level progress, which rolls up to section and overall progress.
 */

import { Router, Request, Response } from 'express';
import { eq, and, sql, asc } from 'drizzle-orm';

// These routes should be added to the existing dd-checklist-routes.ts router

// ─── GET /api/dd-items/:id/periods ───────────────────────────────────────────
// Returns all period slots for a checklist item
router.get('/api/dd-items/:id/periods', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;

    const periods = await db
      .select()
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, id))
      .orderBy(asc(schema.ddChecklistItemPeriods.periodSort));

    const total = periods.length;
    const received = periods.filter((p: any) => p.isReceived).length;

    res.json({ 
      periods, 
      progress: { total, received, pct: total > 0 ? Math.round((received / total) * 100) : 0 }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch periods' });
  }
});

// ─── POST /api/dd-items/:id/periods ──────────────────────────────────────────
// Add period slots to an item. Accepts: { type: 'year'|'month'|'trailing', values: string[] }
router.post('/api/dd-items/:id/periods', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;
    const { type, values } = req.body;

    if (!type || !values?.length) {
      return res.status(400).json({ error: 'type and values are required' });
    }

    // Validate type
    if (!['year', 'month', 'trailing'].includes(type)) {
      return res.status(400).json({ error: 'type must be year, month, or trailing' });
    }

    // Get existing periods to avoid duplicates
    const existing = await db
      .select({ label: schema.ddChecklistItemPeriods.periodLabel })
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, id));
    
    const existingLabels = new Set(existing.map((e: any) => e.label));

    // Build sort order based on type
    const getSortOrder = (label: string, idx: number) => {
      if (type === 'year') return parseInt(label) || idx;
      if (type === 'month') {
        // Parse "Jan 2024" format
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const parts = label.split(' ');
        const monthIdx = months.indexOf(parts[0]);
        const year = parseInt(parts[1]) || 2024;
        return year * 100 + (monthIdx >= 0 ? monthIdx : idx);
      }
      if (type === 'trailing') {
        // T12 = 12, T24 = 24, T36 = 36
        return parseInt(label.replace(/\D/g, '')) || idx;
      }
      return idx;
    };

    const newValues = values.filter((v: string) => !existingLabels.has(v));
    
    if (newValues.length === 0) {
      return res.json({ added: 0, message: 'All periods already exist' });
    }

    const rows = newValues.map((label: string, idx: number) => ({
      itemId: id,
      periodType: type,
      periodLabel: label,
      periodSort: getSortOrder(label, idx),
      isReceived: false,
    }));

    await db.insert(schema.ddChecklistItemPeriods).values(rows);

    // Update item's period_config and has_periods flag
    await db.update(schema.ddChecklistItems).set({
      hasPeriods: true,
      periodConfig: { type, values: [...existingLabels, ...newValues] },
      updatedAt: new Date(),
    }).where(eq(schema.ddChecklistItems.id, id));

    res.status(201).json({ added: newValues.length, skipped: values.length - newValues.length });
  } catch (err: any) {
    console.error('Error adding periods:', err);
    res.status(500).json({ error: 'Failed to add periods' });
  }
});

// ─── PATCH /api/dd-item-periods/:id ──────────────────────────────────────────
// Toggle received status or update notes on a period slot
router.patch('/api/dd-item-periods/:id', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;
    const userId = req.user?.id || req.userId;
    const { isReceived, notes, fileId } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (isReceived !== undefined) {
      updates.isReceived = isReceived;
      updates.receivedAt = isReceived ? new Date() : null;
      updates.receivedBy = isReceived ? userId : null;
    }
    if (notes !== undefined) updates.notes = notes;
    if (fileId !== undefined) updates.fileId = fileId;

    const [updated] = await db
      .update(schema.ddChecklistItemPeriods)
      .set(updates)
      .where(eq(schema.ddChecklistItemPeriods.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Period not found' });

    // Recompute item status based on periods
    const itemId = updated.itemId;
    const allPeriods = await db
      .select()
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, itemId));

    const total = allPeriods.length;
    const received = allPeriods.filter((p: any) => p.isReceived).length;

    // Auto-update item status based on period completion
    let newStatus = undefined;
    if (total > 0) {
      if (received === 0) newStatus = 'open';
      else if (received === total) newStatus = 'provided';
      else newStatus = 'in_progress';
    }

    if (newStatus) {
      await db.update(schema.ddChecklistItems).set({
        status: newStatus,
        updatedAt: new Date(),
      }).where(eq(schema.ddChecklistItems.id, itemId));
    }

    res.json({ 
      period: updated, 
      itemProgress: { total, received, pct: total > 0 ? Math.round((received / total) * 100) : 0 },
      autoStatus: newStatus,
    });
  } catch (err: any) {
    console.error('Error updating period:', err);
    res.status(500).json({ error: 'Failed to update period' });
  }
});

// ─── DELETE /api/dd-item-periods/:id ─────────────────────────────────────────
router.delete('/api/dd-item-periods/:id', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;

    const [deleted] = await db
      .delete(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.id, id))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Period not found' });

    // Check if item still has periods
    const remaining = await db
      .select({ count: sql`count(*)` })
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, deleted.itemId));

    if (parseInt(remaining[0]?.count) === 0) {
      await db.update(schema.ddChecklistItems).set({
        hasPeriods: false,
        periodConfig: null,
        updatedAt: new Date(),
      }).where(eq(schema.ddChecklistItems.id, deleted.itemId));
    }

    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete period' });
  }
});

// ─── POST /api/dd-items/:id/periods/bulk-toggle ─────────────────────────────
// Mark all periods as received or unreceived
router.post('/api/dd-items/:id/periods/bulk-toggle', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;
    const userId = req.user?.id || req.userId;
    const { isReceived } = req.body;

    await db.update(schema.ddChecklistItemPeriods).set({
      isReceived: !!isReceived,
      receivedAt: isReceived ? new Date() : null,
      receivedBy: isReceived ? userId : null,
      updatedAt: new Date(),
    }).where(eq(schema.ddChecklistItemPeriods.itemId, id));

    // Update item status
    const newStatus = isReceived ? 'provided' : 'open';
    await db.update(schema.ddChecklistItems).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(schema.ddChecklistItems.id, id));

    res.json({ updated: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to bulk toggle' });
  }
});

// ─── GET /api/workspaces/:id/dd-checklist/progress ──────────────────────────
// Returns hierarchical progress: overall → sections → items (with period breakdown)
router.get('/api/workspaces/:id/dd-checklist/progress', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id: workspaceId } = req.params;

    // Get checklist
    const [checklist] = await db
      .select()
      .from(schema.ddChecklists)
      .where(eq(schema.ddChecklists.workspaceId, workspaceId))
      .limit(1);

    if (!checklist) return res.json({ overall: 0, sections: [] });

    // Get all sections with items and their periods
    const sections = await db
      .select()
      .from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id))
      .orderBy(asc(schema.ddChecklistSections.sortOrder));

    const sectionProgress = [];

    for (const section of sections) {
      const items = await db
        .select()
        .from(schema.ddChecklistItems)
        .where(eq(schema.ddChecklistItems.sectionId, section.id))
        .orderBy(asc(schema.ddChecklistItems.sortOrder));

      const itemProgress = [];

      for (const item of items) {
        if (item.hasPeriods) {
          // Period-based progress
          const periods = await db
            .select()
            .from(schema.ddChecklistItemPeriods)
            .where(eq(schema.ddChecklistItemPeriods.itemId, item.id));

          const total = periods.length;
          const received = periods.filter((p: any) => p.isReceived).length;
          itemProgress.push({
            id: item.id,
            title: item.title,
            hasPeriods: true,
            pct: total > 0 ? (received / total) * 100 : 0,
            received,
            total,
          });
        } else {
          // Binary: approved/provided = 100%, everything else = 0%
          const done = ['approved', 'provided', 'waived'].includes(item.status);
          itemProgress.push({
            id: item.id,
            title: item.title,
            hasPeriods: false,
            pct: done ? 100 : 0,
          });
        }
      }

      const sectionPct = itemProgress.length > 0
        ? itemProgress.reduce((sum, ip) => sum + ip.pct, 0) / itemProgress.length
        : 0;

      sectionProgress.push({
        id: section.id,
        title: section.title,
        pct: Math.round(sectionPct),
        items: itemProgress,
      });
    }

    const overallPct = sectionProgress.length > 0
      ? Math.round(sectionProgress.reduce((sum, sp) => sum + sp.pct, 0) / sectionProgress.length)
      : 0;

    res.json({
      overall: overallPct,
      sections: sectionProgress,
    });
  } catch (err: any) {
    console.error('Error computing progress:', err);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

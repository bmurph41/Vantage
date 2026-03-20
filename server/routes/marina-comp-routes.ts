import { Router } from 'express';
import { db } from '../db';
import { 
  marinaSubjects, 
  compSets, 
  compSetItems, 
  marinaFieldSources,
  marinaCompAuditEvents,
  rateComps,
  salesComps,
  insertMarinaSubjectSchema,
  updateMarinaSubjectSchema,
  insertCompSetSchema,
  updateCompSetSchema,
  insertCompSetItemSchema,
} from '@shared/schema';
import { eq, and, sql, desc, like, or, isNull, inArray } from 'drizzle-orm';
import { computeCompSet, computeCapacityIndex } from '../services/marina-comp-engine';
import { z } from 'zod';
import { exportCompPackToExcel } from '../services/comp-pack-export';

const router = Router();

// ============================================================================
// MARINA SUBJECTS
// ============================================================================

// Create subject marina
router.post('/subjects', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    
    const validated = insertMarinaSubjectSchema.parse({
      ...req.body,
      orgId,
      createdBy: user.id,
    });
    
    // Compute capacity index
    const capacityIndex = computeCapacityIndex(
      validated.slipsTotal ?? 0,
      validated.racksTotal ?? 0
    );
    
    const [subject] = await db
      .insert(marinaSubjects)
      .values({
        ...validated,
        capacityIndex: String(capacityIndex),
      })
      .returning();
    
    res.status(201).json(subject);
  } catch (error) {
    console.error('Error creating subject:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Get subject marina
router.get('/subjects/:id', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const [subject] = await db
      .select()
      .from(marinaSubjects)
      .where(and(
        eq(marinaSubjects.id, id),
        eq(marinaSubjects.orgId, orgId),
        isNull(marinaSubjects.deletedAt)
      ));
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(subject);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// List subjects
router.get('/subjects', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { search, limit = '50' } = req.query;
    
    let query = db
      .select()
      .from(marinaSubjects)
      .where(and(
        eq(marinaSubjects.orgId, orgId),
        isNull(marinaSubjects.deletedAt)
      ))
      .orderBy(desc(marinaSubjects.createdAt))
      .limit(parseInt(limit as string, 10));
    
    const subjects = await query;
    
    // Filter by search if provided
    const filtered = search 
      ? subjects.filter(s => 
          s.name.toLowerCase().includes((search as string).toLowerCase()) ||
          s.city?.toLowerCase().includes((search as string).toLowerCase()) ||
          s.state?.toLowerCase().includes((search as string).toLowerCase())
        )
      : subjects;
    
    res.json(filtered);
  } catch (error) {
    console.error('Error listing subjects:', error);
    res.status(500).json({ error: 'Failed to list subjects' });
  }
});

// Update subject marina
router.patch('/subjects/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const validated = updateMarinaSubjectSchema.parse(req.body);
    
    // Compute capacity index if slips or racks updated
    let capacityIndex: string | undefined;
    if (validated.slipsTotal !== undefined || validated.racksTotal !== undefined) {
      const [existing] = await db
        .select()
        .from(marinaSubjects)
        .where(and(eq(marinaSubjects.id, id), eq(marinaSubjects.orgId, orgId)));
      
      if (existing) {
        capacityIndex = String(computeCapacityIndex(
          validated.slipsTotal ?? existing.slipsTotal ?? 0,
          validated.racksTotal ?? existing.racksTotal ?? 0
        ));
      }
    }
    
    const [updated] = await db
      .update(marinaSubjects)
      .set({
        ...validated,
        ...(capacityIndex && { capacityIndex }),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(
        eq(marinaSubjects.id, id),
        eq(marinaSubjects.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating subject:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete subject marina (soft delete)
router.delete('/subjects/:id', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const [deleted] = await db
      .update(marinaSubjects)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(marinaSubjects.id, id),
        eq(marinaSubjects.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// ============================================================================
// COMP SETS
// ============================================================================

// Create comp set
router.post('/sets', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    
    const validated = insertCompSetSchema.parse({
      ...req.body,
      orgId,
      createdBy: user.id,
    });
    
    const [compSet] = await db
      .insert(compSets)
      .values(validated)
      .returning();
    
    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'create_set',
      compSetId: compSet.id,
      subjectId: compSet.subjectId,
      details: { compType: compSet.compType },
    });
    
    res.status(201).json(compSet);
  } catch (error) {
    console.error('Error creating comp set:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create comp set' });
  }
});

// Get comp set with items
router.get('/sets/:id', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const [compSet] = await db
      .select()
      .from(compSets)
      .where(and(
        eq(compSets.id, id),
        eq(compSets.orgId, orgId),
        isNull(compSets.deletedAt)
      ));
    
    if (!compSet) {
      return res.status(404).json({ error: 'Comp set not found' });
    }
    
    // Get items with comp details
    const items = await db
      .select()
      .from(compSetItems)
      .where(and(
        eq(compSetItems.compSetId, id),
        eq(compSetItems.orgId, orgId)
      ));
    
    // Get subject if exists (with orgId filter for multi-tenant security)
    let subject = null;
    if (compSet.subjectId) {
      const [s] = await db
        .select()
        .from(marinaSubjects)
        .where(and(
          eq(marinaSubjects.id, compSet.subjectId),
          eq(marinaSubjects.orgId, orgId),
          isNull(marinaSubjects.deletedAt)
        ));
      subject = s || null;
    }
    
    res.json({ ...compSet, items, subject });
  } catch (error) {
    console.error('Error fetching comp set:', error);
    res.status(500).json({ error: 'Failed to fetch comp set' });
  }
});

// List comp sets
router.get('/sets', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { compType, subjectId, limit = '50' } = req.query;
    
    let conditions = [
      eq(compSets.orgId, orgId),
      isNull(compSets.deletedAt)
    ];
    
    if (compType) {
      conditions.push(eq(compSets.compType, compType as string));
    }
    
    if (subjectId) {
      conditions.push(eq(compSets.subjectId, subjectId as string));
    }
    
    const sets = await db
      .select()
      .from(compSets)
      .where(and(...conditions))
      .orderBy(desc(compSets.createdAt))
      .limit(parseInt(limit as string, 10));
    
    res.json(sets);
  } catch (error) {
    console.error('Error listing comp sets:', error);
    res.status(500).json({ error: 'Failed to list comp sets' });
  }
});

// Update comp set
router.patch('/sets/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const validated = updateCompSetSchema.parse(req.body);
    
    const [updated] = await db
      .update(compSets)
      .set({
        ...validated,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(
        eq(compSets.id, id),
        eq(compSets.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Comp set not found' });
    }
    
    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'update_set',
      compSetId: id,
      details: { updatedFields: Object.keys(validated) },
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating comp set:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update comp set' });
  }
});

// Delete comp set (soft delete)
router.delete('/sets/:id', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const [deleted] = await db
      .update(compSets)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(compSets.id, id),
        eq(compSets.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Comp set not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comp set:', error);
    res.status(500).json({ error: 'Failed to delete comp set' });
  }
});

// ============================================================================
// COMP SET ITEMS
// ============================================================================

// Add item to comp set
router.post('/sets/:id/items', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { id: compSetId } = req.params;
    
    // Verify comp set exists
    const [compSet] = await db
      .select()
      .from(compSets)
      .where(and(
        eq(compSets.id, compSetId),
        eq(compSets.orgId, orgId)
      ));
    
    if (!compSet) {
      return res.status(404).json({ error: 'Comp set not found' });
    }
    
    const validated = insertCompSetItemSchema.parse({
      ...req.body,
      orgId,
      compSetId,
      addedBy: user.id,
    });
    
    const [item] = await db
      .insert(compSetItems)
      .values(validated)
      .returning();
    
    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'add_comp',
      compSetId,
      details: { 
        rateCompId: validated.rateCompId,
        salesCompId: validated.salesCompId,
      },
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item to comp set:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to add item to comp set' });
  }
});

// Update comp set item
router.patch('/sets/:setId/items/:itemId', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const { setId, itemId } = req.params;
    const { included, notes, manualWeightOverride } = req.body;
    
    const [updated] = await db
      .update(compSetItems)
      .set({
        ...(included !== undefined && { included }),
        ...(notes !== undefined && { notes }),
        ...(manualWeightOverride !== undefined && { 
          manualWeightOverride: manualWeightOverride !== null 
            ? String(manualWeightOverride) 
            : null 
        }),
      })
      .where(and(
        eq(compSetItems.id, itemId),
        eq(compSetItems.compSetId, setId),
        eq(compSetItems.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating comp set item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Remove item from comp set
router.delete('/sets/:setId/items/:itemId', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { setId, itemId } = req.params;
    
    const [deleted] = await db
      .delete(compSetItems)
      .where(and(
        eq(compSetItems.id, itemId),
        eq(compSetItems.compSetId, setId),
        eq(compSetItems.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'remove_comp',
      compSetId: setId,
      details: { itemId },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing item from comp set:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// ============================================================================
// COMPUTE & EXPORT
// ============================================================================

// Compute comp set
router.post('/sets/:id/compute', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { id } = req.params;
    
    const result = await computeCompSet(id, orgId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'compute',
      compSetId: id,
      details: { 
        compsUsed: result.result?.compsUsed,
        computedAt: result.result?.computedAt,
      },
    });
    
    res.json(result.result);
  } catch (error) {
    console.error('Error computing comp set:', error);
    res.status(500).json({ error: 'Failed to compute comp set' });
  }
});

// Export to Excel
router.post('/sets/:id/export/excel', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { id } = req.params;

    // Get comp set to validate it exists
    const [compSet] = await db
      .select()
      .from(compSets)
      .where(and(
        eq(compSets.id, id),
        eq(compSets.orgId, orgId)
      ));

    if (!compSet) {
      return res.status(404).json({ error: 'Comp set not found' });
    }

    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'export_excel',
      compSetId: id,
      details: { format: 'xlsx' },
    });

    // Generate real Excel file using comp-pack-export service
    const buffer = await exportCompPackToExcel({
      compSetId: id,
      orgId,
      userId: user.id,
    });

    const filename = `comp-set-${compSet.name?.replace(/[^a-zA-Z0-9]/g, '-') || id}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error exporting comp set:', error);
    res.status(500).json({ error: 'Failed to export comp set' });
  }
});

// Export to PDF
router.post('/sets/:id/export/pdf', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId;
    const { id } = req.params;

    // Get comp set with details
    const [compSet] = await db
      .select()
      .from(compSets)
      .where(and(
        eq(compSets.id, id),
        eq(compSets.orgId, orgId)
      ));

    if (!compSet) {
      return res.status(404).json({ error: 'Comp set not found' });
    }

    // Get subject marina
    let subjectName = 'N/A';
    let subjectCity = '';
    let subjectState = '';
    if (compSet.subjectId) {
      const [subject] = await db
        .select()
        .from(marinaSubjects)
        .where(and(
          eq(marinaSubjects.id, compSet.subjectId),
          eq(marinaSubjects.orgId, orgId),
          isNull(marinaSubjects.deletedAt)
        ));
      if (subject) {
        subjectName = subject.name || 'N/A';
        subjectCity = subject.city || '';
        subjectState = subject.state || '';
      }
    }

    // Get comp set items with their comps
    const items = await db
      .select()
      .from(compSetItems)
      .where(and(eq(compSetItems.compSetId, id), eq(compSetItems.orgId, orgId)));

    let compsData: any[] = [];
    if (compSet.compType === 'RATE') {
      const rateCompIds = items.filter(i => i.rateCompId).map(i => i.rateCompId!);
      if (rateCompIds.length > 0) {
        compsData = await db.select().from(rateComps)
          .where(and(inArray(rateComps.id, rateCompIds), eq(rateComps.orgId, orgId)));
      }
    } else {
      const salesCompIds = items.filter(i => i.salesCompId).map(i => i.salesCompId!);
      if (salesCompIds.length > 0) {
        compsData = await db.select().from(salesComps)
          .where(and(inArray(salesComps.id, salesCompIds), eq(salesComps.orgId, orgId)));
      }
    }

    // Log audit event
    await db.insert(marinaCompAuditEvents).values({
      orgId,
      userId: user.id,
      eventType: 'export_pdf',
      compSetId: id,
      details: { format: 'pdf' },
    });

    // Generate PDF using pdf-lib
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // -- Page 1: Cover & Summary --
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { height } = page.getSize();
    let y = height - 60;

    page.drawText('Marina Comp Pack Report', { x: 50, y, size: 22, font: fontBold, color: rgb(0.1, 0.1, 0.4) });
    y -= 30;
    page.drawText(`Comp Set: ${compSet.name || 'Untitled'}`, { x: 50, y, size: 14, font: fontBold });
    y -= 20;
    page.drawText(`Type: ${compSet.compType} Comparables`, { x: 50, y, size: 11, font });
    y -= 16;
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: 50, y, size: 11, font });
    y -= 30;

    // Subject section
    page.drawText('Subject Marina', { x: 50, y, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.4) });
    y -= 20;
    page.drawText(`Name: ${subjectName}`, { x: 60, y, size: 11, font });
    y -= 16;
    if (subjectCity || subjectState) {
      page.drawText(`Location: ${subjectCity}${subjectCity && subjectState ? ', ' : ''}${subjectState}`, { x: 60, y, size: 11, font });
      y -= 16;
    }
    y -= 10;

    // Indicated Values
    const result = compSet.lastComputeResult as Record<string, unknown> | null;
    if (result) {
      page.drawText('Indicated Values', { x: 50, y, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.4) });
      y -= 20;
      if (compSet.compType === 'RATE') {
        const fmtRate = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : 'N/A';
        page.drawText(`Wet Slip Rate: ${fmtRate(result.indicatedWetRate)}`, { x: 60, y, size: 11, font });
        y -= 16;
        page.drawText(`Rack Rate: ${fmtRate(result.indicatedRackRate)}`, { x: 60, y, size: 11, font });
        y -= 16;
        page.drawText(`Land Rate: ${fmtRate(result.indicatedLandRate)}`, { x: 60, y, size: 11, font });
        y -= 16;
      } else {
        const fmtPrice = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : 'N/A';
        page.drawText(`Price/Slip: ${fmtPrice(result.indicatedPricePerSlip)}`, { x: 60, y, size: 11, font });
        y -= 16;
        page.drawText(`Price/Rack: ${fmtPrice(result.indicatedPricePerRack)}`, { x: 60, y, size: 11, font });
        y -= 16;
        page.drawText(`Total Indicated Value: ${fmtPrice(result.indicatedTotalValue)}`, { x: 60, y, size: 11, font });
        y -= 16;
      }
      page.drawText(`Comps Used: ${result.compsUsed || 0}`, { x: 60, y, size: 11, font });
      y -= 30;
    }

    // -- Page 2: Comparables Table --
    page = pdfDoc.addPage([792, 612]); // Landscape for table
    y = 612 - 50;

    page.drawText('Comparable Properties', { x: 50, y, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.4) });
    y -= 25;

    // Table headers
    const cols = compSet.compType === 'RATE'
      ? [{ label: 'Marina', x: 50, w: 140 }, { label: 'City', x: 190, w: 80 }, { label: 'State', x: 270, w: 40 },
         { label: 'Wet Slips', x: 310, w: 55 }, { label: 'Dry Racks', x: 365, w: 55 }, { label: 'Rate', x: 420, w: 60 },
         { label: 'Score', x: 480, w: 50 }, { label: 'Weight', x: 530, w: 50 }, { label: 'Included', x: 580, w: 50 }]
      : [{ label: 'Marina', x: 50, w: 130 }, { label: 'City', x: 180, w: 70 }, { label: 'State', x: 250, w: 40 },
         { label: 'Sale Price', x: 290, w: 80 }, { label: 'Slips', x: 370, w: 45 }, { label: '$/Slip', x: 415, w: 65 },
         { label: 'Date', x: 480, w: 60 }, { label: 'Score', x: 540, w: 50 }, { label: 'Weight', x: 590, w: 50 }, { label: 'Incl', x: 640, w: 40 }];

    // Draw header row
    page.drawRectangle({ x: 45, y: y - 4, width: 700, height: 18, color: rgb(0.9, 0.92, 0.96) });
    for (const col of cols) {
      page.drawText(col.label, { x: col.x, y, size: 9, font: fontBold });
    }
    y -= 20;

    // Draw data rows
    for (const item of items) {
      if (y < 50) {
        page = pdfDoc.addPage([792, 612]);
        y = 612 - 50;
      }
      const comp = compsData.find((c: any) => c.id === (compSet.compType === 'RATE' ? item.rateCompId : item.salesCompId));
      if (!comp) continue;

      const truncate = (s: string, max: number) => s && s.length > max ? s.substring(0, max - 2) + '..' : (s || '');

      if (compSet.compType === 'RATE') {
        page.drawText(truncate(comp.marina, 22), { x: 50, y, size: 8, font });
        page.drawText(truncate(comp.city || '', 12), { x: 190, y, size: 8, font });
        page.drawText(comp.state || '', { x: 270, y, size: 8, font });
        page.drawText(String(comp.wetSlips || ''), { x: 310, y, size: 8, font });
        page.drawText(String(comp.dryRacks || ''), { x: 365, y, size: 8, font });
        page.drawText(comp.wetRateValue ? `$${comp.wetRateValue}` : '', { x: 420, y, size: 8, font });
      } else {
        page.drawText(truncate(comp.marina, 20), { x: 50, y, size: 8, font });
        page.drawText(truncate(comp.city || '', 10), { x: 180, y, size: 8, font });
        page.drawText(comp.state || '', { x: 250, y, size: 8, font });
        page.drawText(comp.salePrice ? `$${Number(comp.salePrice).toLocaleString()}` : '', { x: 290, y, size: 8, font });
        page.drawText(String(comp.wetSlips || ''), { x: 370, y, size: 8, font });
        page.drawText(comp.pricePerSlip ? `$${Number(comp.pricePerSlip).toLocaleString()}` : '', { x: 415, y, size: 8, font });
        page.drawText(comp.saleYear ? `${comp.saleMonth || 1}/${comp.saleYear}` : '', { x: 480, y, size: 8, font });
      }

      const scoreX = compSet.compType === 'RATE' ? 480 : 540;
      const weightX = compSet.compType === 'RATE' ? 530 : 590;
      const inclX = compSet.compType === 'RATE' ? 580 : 640;
      page.drawText(item.similarityScore != null ? `${Math.round(Number(item.similarityScore))}` : '', { x: scoreX, y, size: 8, font });
      page.drawText(item.normalizedWeight != null ? `${(Number(item.normalizedWeight) * 100).toFixed(1)}%` : '', { x: weightX, y, size: 8, font });
      page.drawText(item.included ? 'Yes' : 'No', { x: inclX, y, size: 8, font });

      y -= 14;
    }

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const filename = `comp-set-${compSet.name?.replace(/[^a-zA-Z0-9]/g, '-') || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error exporting comp set:', error);
    res.status(500).json({ error: 'Failed to export comp set' });
  }
});

// ============================================================================
// OVERLAYS (FEMA & NOAA)
// ============================================================================

// Query FEMA flood zones (using ArcGIS REST API)
router.post('/overlays/fema/query', async (req, res) => {
  try {
    const { bbox, subjectId } = req.body;
    const orgId = (req as any).orgId;
    
    let bounds = bbox;
    
    // If subjectId provided, get bounds from subject location
    if (subjectId && !bbox) {
      const [subject] = await db
        .select()
        .from(marinaSubjects)
        .where(and(
          eq(marinaSubjects.id, subjectId),
          eq(marinaSubjects.orgId, orgId)
        ));
      
      if (subject && subject.lat && subject.lng) {
        // Create ~5 mile bbox around subject
        const lat = Number(subject.lat);
        const lng = Number(subject.lng);
        const offset = 0.072; // ~5 miles at mid-latitudes
        bounds = {
          xmin: lng - offset,
          ymin: lat - offset,
          xmax: lng + offset,
          ymax: lat + offset,
        };
      }
    }
    
    if (!bounds) {
      return res.status(400).json({ error: 'bbox or subjectId required' });
    }
    
    // FEMA NFHL ArcGIS REST Service
    const femaUrl = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';
    const params = new URLSearchParams({
      geometry: JSON.stringify(bounds),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE,ZONE_SUBTY,STATIC_BFE',
      returnGeometry: 'true',
      f: 'geojson',
    });
    
    const response = await fetch(`${femaUrl}?${params}`);
    
    if (!response.ok) {
      console.error('FEMA API error:', response.status);
      return res.status(502).json({ error: 'Failed to query FEMA flood zones' });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error querying FEMA:', error);
    res.status(500).json({ error: 'Failed to query flood zones' });
  }
});

// Get nearest NOAA CO-OPS station
router.get('/overlays/noaa/nearest', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    
    // NOAA CO-OPS stations list API
    const noaaUrl = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json';
    const response = await fetch(noaaUrl);
    
    if (!response.ok) {
      console.error('NOAA API error:', response.status);
      return res.status(502).json({ error: 'Failed to query NOAA stations' });
    }
    
    const data = await response.json();
    const stations = data.stations || [];
    
    // Find nearest station
    const targetLat = parseFloat(lat as string);
    const targetLng = parseFloat(lng as string);
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const station of stations) {
      if (!station.lat || !station.lng) continue;
      
      const d = Math.sqrt(
        Math.pow(station.lat - targetLat, 2) + 
        Math.pow(station.lng - targetLng, 2)
      );
      
      if (d < minDistance) {
        minDistance = d;
        nearest = station;
      }
    }
    
    if (!nearest) {
      return res.status(404).json({ error: 'No stations found' });
    }
    
    res.json({
      stationId: nearest.id,
      name: nearest.name,
      lat: nearest.lat,
      lng: nearest.lng,
      state: nearest.state,
      distanceDegrees: minDistance,
    });
  } catch (error) {
    console.error('Error querying NOAA:', error);
    res.status(500).json({ error: 'Failed to find nearest station' });
  }
});

export default router;

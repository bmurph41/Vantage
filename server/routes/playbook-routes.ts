import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  crmPlaybooks, 
  crmPlaybookItems, 
  crmDealPlaybookProgress,
  crmPipelines,
  crmPipelineStages,
  crmDeals,
  insertCrmPlaybookSchema,
  insertCrmPlaybookItemSchema,
  insertCrmDealPlaybookProgressSchema
} from '@shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

const router = Router();

router.get('/playbooks', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const { pipelineId, stageId, dealType } = req.query;

    let query = db.select()
      .from(crmPlaybooks)
      .where(eq(crmPlaybooks.orgId, orgId))
      .orderBy(asc(crmPlaybooks.sortOrder));

    const playbooks = await query;
    
    let filtered = playbooks;
    if (pipelineId) {
      filtered = filtered.filter(p => p.pipelineId === pipelineId || !p.pipelineId);
    }
    if (stageId) {
      filtered = filtered.filter(p => p.stageId === stageId || !p.stageId);
    }
    if (dealType) {
      filtered = filtered.filter(p => p.dealType === dealType || !p.dealType);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    res.status(500).json({ error: 'Failed to fetch playbooks' });
  }
});

router.get('/playbooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';

    const [playbook] = await db.select()
      .from(crmPlaybooks)
      .where(and(eq(crmPlaybooks.id, id), eq(crmPlaybooks.orgId, orgId)));

    if (!playbook) {
      return res.status(404).json({ error: 'Playbook not found' });
    }

    const items = await db.select()
      .from(crmPlaybookItems)
      .where(eq(crmPlaybookItems.playbookId, id))
      .orderBy(asc(crmPlaybookItems.sortOrder));

    res.json({ ...playbook, items });
  } catch (error) {
    console.error('Error fetching playbook:', error);
    res.status(500).json({ error: 'Failed to fetch playbook' });
  }
});

router.post('/playbooks', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const userId = (req as any).userId || 'user-1';

    const parsed = insertCrmPlaybookSchema.safeParse({
      ...req.body,
      orgId,
      createdById: userId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid playbook data', details: parsed.error.errors });
    }

    const [playbook] = await db.insert(crmPlaybooks).values(parsed.data).returning();
    res.status(201).json(playbook);
  } catch (error) {
    console.error('Error creating playbook:', error);
    res.status(500).json({ error: 'Failed to create playbook' });
  }
});

router.patch('/playbooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';

    const [existing] = await db.select()
      .from(crmPlaybooks)
      .where(and(eq(crmPlaybooks.id, id), eq(crmPlaybooks.orgId, orgId)));

    if (!existing) {
      return res.status(404).json({ error: 'Playbook not found' });
    }

    const [updated] = await db.update(crmPlaybooks)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(crmPlaybooks.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating playbook:', error);
    res.status(500).json({ error: 'Failed to update playbook' });
  }
});

router.delete('/playbooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';

    const [existing] = await db.select()
      .from(crmPlaybooks)
      .where(and(eq(crmPlaybooks.id, id), eq(crmPlaybooks.orgId, orgId)));

    if (!existing) {
      return res.status(404).json({ error: 'Playbook not found' });
    }

    await db.delete(crmPlaybooks).where(eq(crmPlaybooks.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting playbook:', error);
    res.status(500).json({ error: 'Failed to delete playbook' });
  }
});

router.get('/playbooks/:playbookId/items', async (req: Request, res: Response) => {
  try {
    const { playbookId } = req.params;

    const items = await db.select()
      .from(crmPlaybookItems)
      .where(eq(crmPlaybookItems.playbookId, playbookId))
      .orderBy(asc(crmPlaybookItems.sortOrder));

    res.json(items);
  } catch (error) {
    console.error('Error fetching playbook items:', error);
    res.status(500).json({ error: 'Failed to fetch playbook items' });
  }
});

router.post('/playbooks/:playbookId/items', async (req: Request, res: Response) => {
  try {
    const { playbookId } = req.params;

    const parsed = insertCrmPlaybookItemSchema.safeParse({
      ...req.body,
      playbookId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid item data', details: parsed.error.errors });
    }

    const [item] = await db.insert(crmPlaybookItems).values(parsed.data).returning();
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating playbook item:', error);
    res.status(500).json({ error: 'Failed to create playbook item' });
  }
});

router.patch('/playbooks/:playbookId/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    const [updated] = await db.update(crmPlaybookItems)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(crmPlaybookItems.id, itemId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating playbook item:', error);
    res.status(500).json({ error: 'Failed to update playbook item' });
  }
});

router.delete('/playbooks/:playbookId/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    await db.delete(crmPlaybookItems).where(eq(crmPlaybookItems.id, itemId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting playbook item:', error);
    res.status(500).json({ error: 'Failed to delete playbook item' });
  }
});

router.post('/playbooks/:playbookId/items/reorder', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    for (let i = 0; i < items.length; i++) {
      await db.update(crmPlaybookItems)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(crmPlaybookItems.id, items[i].id));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering items:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

router.get('/deals/:dealId/playbook-progress', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const progress = await db.select({
      progress: crmDealPlaybookProgress,
      item: crmPlaybookItems,
      playbook: crmPlaybooks,
    })
      .from(crmDealPlaybookProgress)
      .innerJoin(crmPlaybookItems, eq(crmDealPlaybookProgress.playbookItemId, crmPlaybookItems.id))
      .innerJoin(crmPlaybooks, eq(crmDealPlaybookProgress.playbookId, crmPlaybooks.id))
      .where(eq(crmDealPlaybookProgress.dealId, dealId))
      .orderBy(asc(crmPlaybookItems.sortOrder));

    res.json(progress);
  } catch (error) {
    console.error('Error fetching deal playbook progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.post('/deals/:dealId/apply-playbook/:playbookId', async (req: Request, res: Response) => {
  try {
    const { dealId, playbookId } = req.params;

    const items = await db.select()
      .from(crmPlaybookItems)
      .where(eq(crmPlaybookItems.playbookId, playbookId))
      .orderBy(asc(crmPlaybookItems.sortOrder));

    const [deal] = await db.select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const stageEnteredAt = deal.currentStageEnteredAt || new Date();
    
    const progressRecords = items.map(item => ({
      dealId,
      playbookId,
      playbookItemId: item.id,
      status: 'pending' as const,
      dueDate: item.dueDaysOffset 
        ? new Date(stageEnteredAt.getTime() + item.dueDaysOffset * 24 * 60 * 60 * 1000)
        : null,
    }));

    if (progressRecords.length > 0) {
      await db.insert(crmDealPlaybookProgress)
        .values(progressRecords)
        .onConflictDoNothing({
          target: [crmDealPlaybookProgress.dealId, crmDealPlaybookProgress.playbookItemId]
        });
    }

    const existingCount = await db.select({ count: sql`count(*)` })
      .from(crmDealPlaybookProgress)
      .where(and(
        eq(crmDealPlaybookProgress.dealId, dealId),
        eq(crmDealPlaybookProgress.playbookId, playbookId)
      ));

    res.json({ success: true, itemsApplied: Number(existingCount[0]?.count || 0) });
  } catch (error) {
    console.error('Error applying playbook to deal:', error);
    res.status(500).json({ error: 'Failed to apply playbook' });
  }
});

router.patch('/deals/:dealId/playbook-progress/:progressId', async (req: Request, res: Response) => {
  try {
    const { progressId } = req.params;
    const userId = (req as any).userId || 'user-1';
    const { status, notes, skippedReason } = req.body;

    const updateData: any = {
      status,
      notes,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.completedById = userId;
      updateData.completedAt = new Date();
    } else if (status === 'skipped') {
      updateData.skippedReason = skippedReason;
    }

    const [updated] = await db.update(crmDealPlaybookProgress)
      .set(updateData)
      .where(eq(crmDealPlaybookProgress.id, progressId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Progress record not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating playbook progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

router.get('/playbook-templates', async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'marina-acquisition',
        name: 'Marina Acquisition',
        description: 'Standard checklist for marina acquisition deals',
        dealType: 'marina_acquisition',
        items: [
          { title: 'Initial Site Visit Scheduled', itemType: 'checklist', isRequired: true, dueDaysOffset: 7 },
          { title: 'NDA Executed', itemType: 'document', isRequired: true, documentType: 'nda' },
          { title: 'LOI Submitted', itemType: 'document', isRequired: true, documentType: 'loi', dueDaysOffset: 14 },
          { title: 'LOI Negotiation Complete', itemType: 'approval', isRequired: true, dueDaysOffset: 21 },
          { title: 'PSA Executed', itemType: 'document', isRequired: true, documentType: 'psa', dueDaysOffset: 30 },
          { title: 'Deposit Wired', itemType: 'milestone', isRequired: true, dueDaysOffset: 35 },
          { title: 'Environmental Assessment Ordered', itemType: 'task', isRequired: true, dueDaysOffset: 37 },
          { title: 'Title Search Complete', itemType: 'task', isRequired: true, dueDaysOffset: 45 },
          { title: 'Survey Complete', itemType: 'task', isRequired: true, dueDaysOffset: 50 },
          { title: 'Financing Approved', itemType: 'approval', isRequired: true, dueDaysOffset: 60 },
          { title: 'Final IC Approval', itemType: 'approval', isRequired: true, dueDaysOffset: 75 },
          { title: 'Closing Complete', itemType: 'milestone', isRequired: true, dueDaysOffset: 90 },
        ],
      },
      {
        id: 'storage-lease',
        name: 'Storage Lease',
        description: 'Standard checklist for slip/storage lease deals',
        dealType: 'storage_lease',
        items: [
          { title: 'Customer Qualification Complete', itemType: 'checklist', isRequired: true, dueDaysOffset: 1 },
          { title: 'Slip Availability Confirmed', itemType: 'checklist', isRequired: true, dueDaysOffset: 1 },
          { title: 'Lease Agreement Sent', itemType: 'document', isRequired: true, documentType: 'lease', dueDaysOffset: 2 },
          { title: 'Lease Agreement Signed', itemType: 'document', isRequired: true, documentType: 'lease', dueDaysOffset: 7 },
          { title: 'Deposit Received', itemType: 'milestone', isRequired: true, dueDaysOffset: 7 },
          { title: 'Insurance Certificate Received', itemType: 'document', isRequired: true, documentType: 'insurance', dueDaysOffset: 10 },
          { title: 'Move-in Complete', itemType: 'milestone', isRequired: true, dueDaysOffset: 14 },
        ],
      },
      {
        id: 'due-diligence',
        name: 'Due Diligence',
        description: 'Comprehensive due diligence checklist',
        dealType: 'marina_acquisition',
        items: [
          { title: 'Financial Statements (3 years)', itemType: 'document', isRequired: true, documentType: 'financials' },
          { title: 'Tax Returns (3 years)', itemType: 'document', isRequired: true, documentType: 'tax_returns' },
          { title: 'Rent Roll', itemType: 'document', isRequired: true, documentType: 'rent_roll' },
          { title: 'Customer List', itemType: 'document', isRequired: true, documentType: 'customer_list' },
          { title: 'Lease Agreements', itemType: 'document', isRequired: true, documentType: 'leases' },
          { title: 'Insurance Policies', itemType: 'document', isRequired: true, documentType: 'insurance' },
          { title: 'Permits & Licenses', itemType: 'document', isRequired: true, documentType: 'permits' },
          { title: 'Environmental Reports', itemType: 'document', isRequired: true, documentType: 'environmental' },
          { title: 'Title Report', itemType: 'document', isRequired: true, documentType: 'title' },
          { title: 'Survey', itemType: 'document', isRequired: true, documentType: 'survey' },
          { title: 'Equipment List', itemType: 'document', isRequired: false, documentType: 'equipment' },
          { title: 'Vendor Contracts', itemType: 'document', isRequired: false, documentType: 'contracts' },
        ],
      },
    ];

    res.json(templates);
  } catch (error) {
    console.error('Error fetching playbook templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/playbooks/from-template/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const orgId = (req as any).tenantId || 'org-1';
    const userId = (req as any).userId || 'user-1';
    const { pipelineId, stageId, name, description } = req.body;

    const templatesResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/crm/playbook-templates`);
    const templates = await templatesResponse.json();
    const template = templates.find((t: any) => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const [playbook] = await db.insert(crmPlaybooks).values({
      orgId,
      name: name || template.name,
      description: description || template.description,
      pipelineId,
      stageId,
      dealType: template.dealType,
      createdById: userId,
      isActive: true,
    }).returning();

    if (template.items && template.items.length > 0) {
      const items = template.items.map((item: any, index: number) => ({
        playbookId: playbook.id,
        title: item.title,
        description: item.description,
        itemType: item.itemType,
        sortOrder: index,
        isRequired: item.isRequired,
        dueDaysOffset: item.dueDaysOffset,
        documentType: item.documentType,
        assigneeType: 'deal_owner',
      }));

      await db.insert(crmPlaybookItems).values(items);
    }

    res.status(201).json(playbook);
  } catch (error) {
    console.error('Error creating playbook from template:', error);
    res.status(500).json({ error: 'Failed to create playbook from template' });
  }
});

export default router;

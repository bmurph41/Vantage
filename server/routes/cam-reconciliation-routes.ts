import { Router, Request, Response } from 'express';
import { db } from '../db';
import { camExpensePools, camReconciliations, opsCommercialLeases } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || (req as any).user?.organizationId || null;
}

const expensePoolSchema = z.object({
  marinaId: z.string().min(1, 'Marina is required'),
  fiscalYear: z.number().int().min(2000).max(2100),
  category: z.enum(['insurance', 'taxes', 'maintenance', 'utilities', 'management', 'landscaping', 'security', 'other']),
  description: z.string().optional(),
  budgetAmount: z.string().or(z.number()).transform(v => String(v)),
  actualAmount: z.string().or(z.number()).transform(v => String(v)).nullable().optional(),
});

// GET /expense-pool - Get expense pool items for a marina/year
router.get('/expense-pool', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const marinaId = req.query.marinaId as string;
    const fiscalYear = parseInt(req.query.fiscalYear as string, 10);

    if (!marinaId || isNaN(fiscalYear)) {
      return res.status(400).json({ error: 'marinaId and fiscalYear are required' });
    }

    const pools = await db
      .select()
      .from(camExpensePools)
      .where(
        and(
          eq(camExpensePools.orgId, orgId),
          eq(camExpensePools.marinaId, marinaId),
          eq(camExpensePools.fiscalYear, fiscalYear)
        )
      )
      .orderBy(camExpensePools.category);

    res.json(pools);
  } catch (error: any) {
    console.error('Error fetching expense pool:', error);
    res.status(500).json({ error: 'Failed to fetch expense pool' });
  }
});

// POST /expense-pool - Add/update expense pool entry
router.post('/expense-pool', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = expensePoolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(', ') });
    }

    const data = parsed.data;
    const id = req.body.id as string | undefined;

    if (id) {
      // Update existing
      const [updated] = await db
        .update(camExpensePools)
        .set({
          category: data.category,
          description: data.description || null,
          budgetAmount: data.budgetAmount,
          actualAmount: data.actualAmount || null,
          updatedAt: new Date(),
        })
        .where(and(eq(camExpensePools.id, id), eq(camExpensePools.orgId, orgId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Expense pool entry not found' });
      }
      return res.json(updated);
    }

    // Create new
    const [created] = await db
      .insert(camExpensePools)
      .values({
        orgId,
        marinaId: data.marinaId,
        fiscalYear: data.fiscalYear,
        category: data.category,
        description: data.description || null,
        budgetAmount: data.budgetAmount,
        actualAmount: data.actualAmount || null,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error saving expense pool entry:', error);
    res.status(500).json({ error: 'Failed to save expense pool entry' });
  }
});

// GET /reconciliation - Get reconciliation for a marina/year
router.get('/reconciliation', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const marinaId = req.query.marinaId as string;
    const fiscalYear = parseInt(req.query.fiscalYear as string, 10);

    if (!marinaId || isNaN(fiscalYear)) {
      return res.status(400).json({ error: 'marinaId and fiscalYear are required' });
    }

    const reconciliations = await db
      .select({
        id: camReconciliations.id,
        leaseId: camReconciliations.leaseId,
        tenantName: opsCommercialLeases.tenantName,
        unit: opsCommercialLeases.unit,
        sqft: opsCommercialLeases.sqft,
        tenantProRataShare: camReconciliations.tenantProRataShare,
        estimatedCam: camReconciliations.estimatedCam,
        actualCam: camReconciliations.actualCam,
        varianceAmount: camReconciliations.varianceAmount,
        status: camReconciliations.status,
        reconciledAt: camReconciliations.reconciledAt,
        fiscalYear: camReconciliations.fiscalYear,
      })
      .from(camReconciliations)
      .innerJoin(opsCommercialLeases, eq(camReconciliations.leaseId, opsCommercialLeases.id))
      .where(
        and(
          eq(camReconciliations.orgId, orgId),
          eq(camReconciliations.marinaId, marinaId),
          eq(camReconciliations.fiscalYear, fiscalYear)
        )
      )
      .orderBy(opsCommercialLeases.tenantName);

    res.json(reconciliations);
  } catch (error: any) {
    console.error('Error fetching reconciliation:', error);
    res.status(500).json({ error: 'Failed to fetch reconciliation' });
  }
});

// POST /reconciliation/compute - Compute reconciliation for all tenants
router.post('/reconciliation/compute', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { marinaId, fiscalYear } = req.body;
    if (!marinaId || !fiscalYear) {
      return res.status(400).json({ error: 'marinaId and fiscalYear are required' });
    }

    // 1. Get total CAM expenses for the year
    const expenseRows = await db
      .select()
      .from(camExpensePools)
      .where(
        and(
          eq(camExpensePools.orgId, orgId),
          eq(camExpensePools.marinaId, marinaId),
          eq(camExpensePools.fiscalYear, fiscalYear)
        )
      );

    const totalActualCam = expenseRows.reduce((sum, row) => {
      return sum + parseFloat(row.actualAmount || row.budgetAmount || '0');
    }, 0);

    // 2. Get all active leases for this marina
    const leases = await db
      .select()
      .from(opsCommercialLeases)
      .where(
        and(
          eq(opsCommercialLeases.orgId, orgId),
          eq(opsCommercialLeases.marinaId, marinaId),
          eq(opsCommercialLeases.status, 'active')
        )
      );

    if (!leases.length) {
      return res.status(400).json({ error: 'No active leases found for this marina' });
    }

    // 3. Calculate total leasable SF
    const totalSF = leases.reduce((sum, lease) => sum + (lease.sqft || 0), 0);

    if (totalSF === 0) {
      return res.status(400).json({ error: 'Total leasable square footage is 0. Update lease square footage first.' });
    }

    // 4. Delete existing reconciliation records for this period
    await db
      .delete(camReconciliations)
      .where(
        and(
          eq(camReconciliations.orgId, orgId),
          eq(camReconciliations.marinaId, marinaId),
          eq(camReconciliations.fiscalYear, fiscalYear)
        )
      );

    // 5. Compute and insert reconciliation for each tenant
    const results = [];
    for (const lease of leases) {
      const tenantSF = lease.sqft || 0;
      const proRataShare = tenantSF / totalSF; // decimal (e.g. 0.1234 = 12.34%)
      const actualCamAllocation = totalActualCam * proRataShare;
      const estimatedCam = parseFloat(lease.cam || '0') * 12; // CAM field is monthly
      const variance = actualCamAllocation - estimatedCam;

      const [rec] = await db
        .insert(camReconciliations)
        .values({
          orgId,
          marinaId,
          leaseId: lease.id,
          fiscalYear,
          tenantProRataShare: (proRataShare * 100).toFixed(4), // stored as percentage
          estimatedCam: estimatedCam.toFixed(2),
          actualCam: actualCamAllocation.toFixed(2),
          varianceAmount: variance.toFixed(2),
          status: 'reconciled',
          reconciledAt: new Date(),
        })
        .returning();

      results.push({
        ...rec,
        tenantName: lease.tenantName,
        unit: lease.unit,
        sqft: lease.sqft,
      });
    }

    res.json({
      totalActualCam,
      totalLeasableSF: totalSF,
      tenantCount: leases.length,
      reconciliations: results,
    });
  } catch (error: any) {
    console.error('Error computing reconciliation:', error);
    res.status(500).json({ error: 'Failed to compute reconciliation' });
  }
});

// POST /reconciliation/:id/mark-invoiced - Update status to invoiced
router.post('/reconciliation/:id/mark-invoiced', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const [updated] = await db
      .update(camReconciliations)
      .set({
        status: 'invoiced',
        updatedAt: new Date(),
      })
      .where(and(eq(camReconciliations.id, id), eq(camReconciliations.orgId, orgId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Reconciliation record not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating reconciliation status:', error);
    res.status(500).json({ error: 'Failed to update reconciliation status' });
  }
});

export default router;

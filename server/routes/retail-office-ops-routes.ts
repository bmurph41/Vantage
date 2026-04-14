import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  opsCommercialLeases, opsRetailTiAllowances, opsMarinas,
} from '@shared/schema';
import { eq, and, sql, ilike, or, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ============================================================================
// AUTH HELPERS
// ============================================================================

function getOrgId(req: Request): string {
  const orgId = (req as any).auth?.tenantId || (req as any).orgId;
  if (!orgId) {
    if (process.env.NODE_ENV === 'development') {
      return 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
    }
    throw new Error('Missing organization context');
  }
  return orgId;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const tiAllowanceSchema = z.object({
  marinaId: z.string().min(1),
  leaseId: z.string().optional().nullable(),
  tenantName: z.string().min(1),
  suite: z.string().optional().nullable(),
  tiAllowance: z.string().or(z.number()).transform(v => String(v)),
  amountDrawn: z.string().or(z.number()).optional().default('0').transform(v => String(v)),
  drawSchedule: z.any().optional().default([]),
  status: z.string().default('active'),
  expirationDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// GET /stats — Dashboard statistics
// ============================================================================
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let leaseConditions: any[] = [eq(opsCommercialLeases.orgId, orgId)];
    if (marinaId) leaseConditions.push(eq(opsCommercialLeases.marinaId, marinaId as string));

    const leases = await db.select().from(opsCommercialLeases).where(and(...leaseConditions));

    const now = new Date();
    const activeLeases = leases.filter(l => l.status === 'active');

    // Calculate SF metrics
    const occupiedSF = activeLeases.reduce((sum, l) => sum + (l.sqft || 0), 0);
    const allSF = leases.reduce((sum, l) => sum + (l.sqft || 0), 0);
    const vacantSF = Math.max(0, allSF - occupiedSF);
    const totalSF = occupiedSF + vacantSF;
    const occupancyPct = totalSF > 0 ? (occupiedSF / totalSF) * 100 : 0;

    // WALT (Weighted Average Lease Term) in years
    let waltNumerator = 0;
    let waltDenominator = 0;
    for (const l of activeLeases) {
      if (l.endDate && l.sqft) {
        const yearsRemaining = Math.max(0, (new Date(l.endDate).getTime() - now.getTime()) / (365.25 * 86400000));
        waltNumerator += yearsRemaining * l.sqft;
        waltDenominator += l.sqft;
      }
    }
    const weightedAvgLeaseTerm = waltDenominator > 0 ? waltNumerator / waltDenominator : 0;

    // NOI per SF (using base rent + CAM as proxy for gross revenue)
    const totalRent = activeLeases.reduce((sum, l) => {
      return sum + parseFloat(l.baseRent || '0') + parseFloat(l.cam || '0');
    }, 0);
    const annualRent = totalRent * 12;
    const noiPerSF = occupiedSF > 0 ? annualRent / occupiedSF : 0;

    // Tenant diversification
    const tenantRevenues: Record<string, number> = {};
    for (const l of activeLeases) {
      const rent = parseFloat(l.baseRent || '0');
      tenantRevenues[l.tenantName] = (tenantRevenues[l.tenantName] || 0) + rent;
    }
    const totalTenantRevenue = Object.values(tenantRevenues).reduce((a, b) => a + b, 0);
    const tenantDiversification = Object.entries(tenantRevenues)
      .map(([tenant, revenue]) => ({
        tenant,
        revenuePct: totalTenantRevenue > 0 ? Math.round((revenue / totalTenantRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenuePct - a.revenuePct)
      .slice(0, 8);

    // Lease rollover by year
    const yearRollovers: Record<string, number> = {};
    for (const l of activeLeases) {
      if (l.endDate) {
        const year = new Date(l.endDate).getFullYear().toString();
        yearRollovers[year] = (yearRollovers[year] || 0) + (l.sqft || 0);
      }
    }
    const leaseRollover = Object.entries(yearRollovers)
      .map(([year, sf]) => ({ year, sf }))
      .sort((a, b) => a.year.localeCompare(b.year));

    res.json({
      occupiedSF,
      vacantSF,
      occupancyPct: Math.round(occupancyPct * 10) / 10,
      occupancyChange: 0,
      weightedAvgLeaseTerm: Math.round(weightedAvgLeaseTerm * 10) / 10,
      noiPerSF: Math.round(noiPerSF * 100) / 100,
      noiChange: 0,
      tenantDiversification,
      leaseRollover,
    });
  } catch (err: any) {
    console.error('Retail/office stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /tenants — List tenants from commercial leases
// ============================================================================
router.get('/tenants', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { status, search, marinaId } = req.query;

    let conditions: any[] = [eq(opsCommercialLeases.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsCommercialLeases.marinaId, marinaId as string));
    if (search) {
      conditions.push(
        or(
          ilike(opsCommercialLeases.tenantName, `%${search}%`),
          ilike(opsCommercialLeases.unit, `%${search}%`),
        )
      );
    }

    const leases = await db.select().from(opsCommercialLeases).where(and(...conditions));

    const now = new Date();
    const mapped = leases.map(l => {
      const baseRent = parseFloat(l.baseRent || '0');
      const cam = parseFloat(l.cam || '0');
      const totalRent = baseRent + cam;

      // Determine display status
      let displayStatus: string = l.status || 'active';
      if (l.endDate) {
        const endDate = new Date(l.endDate);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
        if (daysLeft < 0 && l.status === 'active') {
          displayStatus = 'expired';
        } else if (daysLeft <= 90 && daysLeft >= 0 && l.status === 'active') {
          displayStatus = 'expiring';
        }
      }

      if (status && status !== 'all' && displayStatus !== status) return null;

      return {
        id: l.id,
        tenant: l.tenantName,
        suite: l.unit || '',
        sf: l.sqft || 0,
        leaseStart: l.startDate,
        leaseEnd: l.endDate || '',
        baseRent,
        cam,
        totalRent,
        status: displayStatus,
      };
    }).filter(Boolean);

    res.json(mapped);
  } catch (err: any) {
    console.error('Retail/office tenants error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /ti-allowances — TI tracking data
// ============================================================================
router.get('/ti-allowances', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsRetailTiAllowances.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsRetailTiAllowances.marinaId, marinaId as string));

    const tiRecords = await db.select().from(opsRetailTiAllowances).where(and(...conditions));

    let totalAllowance = 0;
    let totalDrawn = 0;

    const records = tiRecords.map(r => {
      const allowance = parseFloat(r.tiAllowance || '0');
      const drawn = parseFloat(r.amountDrawn || '0');
      const remaining = allowance - drawn;
      totalAllowance += allowance;
      totalDrawn += drawn;

      return {
        id: r.id,
        tenant: r.tenantName,
        suite: r.suite || '',
        tiAllowance: allowance,
        amountDrawn: drawn,
        remaining,
        drawSchedule: Array.isArray(r.drawSchedule) ? (r.drawSchedule as any[]).map(d => typeof d === 'string' ? d : JSON.stringify(d)).join(', ') : '',
        status: r.status,
      };
    });

    res.json({
      totalAllowance,
      totalDrawn,
      totalRemaining: totalAllowance - totalDrawn,
      records,
    });
  } catch (err: any) {
    console.error('Retail/office TI allowances error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /ti-allowances — Create TI allowance
// ============================================================================
router.post('/ti-allowances', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = tiAllowanceSchema.parse(req.body);

    const [record] = await db.insert(opsRetailTiAllowances).values({
      orgId,
      ...parsed,
    }).returning();

    res.status(201).json(record);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Retail/office TI allowance create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /ti-allowances/:id — Update TI allowance (record draws)
// ============================================================================
router.put('/ti-allowances/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const parsed = tiAllowanceSchema.partial().parse(req.body);

    const [updated] = await db.update(opsRetailTiAllowances)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(opsRetailTiAllowances.id, id), eq(opsRetailTiAllowances.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'TI allowance not found' });

    // Auto-update status if fully drawn
    const allowance = parseFloat(updated.tiAllowance || '0');
    const drawn = parseFloat(updated.amountDrawn || '0');
    if (drawn >= allowance && updated.status === 'active') {
      await db.update(opsRetailTiAllowances)
        .set({ status: 'fully_drawn', updatedAt: new Date() })
        .where(eq(opsRetailTiAllowances.id, id));
      updated.status = 'fully_drawn';
    }

    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Retail/office TI allowance update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /dashboard — Aggregated dashboard data (stats + active tenants)
// ============================================================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let leaseConds: any[] = [eq(opsCommercialLeases.orgId, orgId)];
    if (marinaId) leaseConds.push(eq(opsCommercialLeases.marinaId, marinaId as string));

    const leases = await db.select().from(opsCommercialLeases).where(and(...leaseConds));
    const activeLeases = leases.filter(l => l.status === 'active');
    const totalSF = leases.reduce((sum, l) => sum + (l.leasedSF || 0), 0);
    const occupiedSF = activeLeases.reduce((sum, l) => sum + (l.leasedSF || 0), 0);
    const vacantSF = totalSF - occupiedSF;
    const occupancyPct = totalSF > 0 ? (occupiedSF / totalSF) * 100 : 0;

    const totalBaseRent = activeLeases.reduce((sum, l) => sum + parseFloat(l.baseRent || '0'), 0);
    const totalCAM = activeLeases.reduce((sum, l) => sum + parseFloat(l.camCharges || '0'), 0);
    const totalNOI = totalBaseRent + totalCAM;
    const noiPerSF = occupiedSF > 0 ? totalNOI / occupiedSF : 0;

    const now = new Date();
    const in180Days = new Date(now.getTime() + 180 * 86400000).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    const upcomingRenewals = activeLeases
      .filter(l => l.leaseEnd && l.leaseEnd >= todayStr && l.leaseEnd <= in180Days)
      .sort((a, b) => (a.leaseEnd! > b.leaseEnd! ? 1 : -1))
      .slice(0, 10)
      .map(l => ({ id: l.id, tenant: l.tenantName, suite: l.suiteNumber, sf: l.leasedSF, leaseEnd: l.leaseEnd, baseRent: l.baseRent }));

    const tenants = activeLeases.slice(0, 20).map(l => ({
      id: l.id,
      tenant: l.tenantName,
      suite: l.suiteNumber,
      sf: l.leasedSF,
      leaseStart: l.leaseStart,
      leaseEnd: l.leaseEnd,
      baseRent: parseFloat(l.baseRent || '0'),
      cam: parseFloat(l.camCharges || '0'),
      totalRent: parseFloat(l.baseRent || '0') + parseFloat(l.camCharges || '0'),
      status: l.status,
    }));

    res.json({
      occupiedSF,
      vacantSF,
      occupancyPct: Math.round(occupancyPct * 10) / 10,
      noiPerSF: Math.round(noiPerSF * 100) / 100,
      totalMonthlyRevenue: Math.round(totalNOI * 100) / 100,
      upcomingRenewals,
      tenants,
    });
  } catch (err: any) {
    console.error('Retail/office dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

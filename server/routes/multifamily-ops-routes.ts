import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  opsMultifamilyUnits, opsMultifamilyTurns, opsMarinas,
} from '@shared/schema';
import { eq, and, sql, gte, lte, ilike, or, desc } from 'drizzle-orm';
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

const unitSchema = z.object({
  marinaId: z.string().min(1),
  unitNumber: z.string().min(1),
  unitType: z.string().default('1br'),
  sqft: z.number().int().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  bathrooms: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  status: z.string().default('vacant'),
  currentRent: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  marketRent: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  tenantName: z.string().optional().nullable(),
  leaseStart: z.string().optional().nullable(),
  leaseEnd: z.string().optional().nullable(),
  moveInDate: z.string().optional().nullable(),
  amenities: z.any().optional().default([]),
  notes: z.string().optional().nullable(),
});

const turnSchema = z.object({
  marinaId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  unitNumber: z.string().min(1),
  moveOutDate: z.string().min(1),
  targetMoveIn: z.string().optional().nullable(),
  actualMoveIn: z.string().optional().nullable(),
  scope: z.string().default('standard'),
  estimatedCost: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  actualCost: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  status: z.string().default('pending'),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// GET /stats — Dashboard statistics
// ============================================================================
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsMultifamilyUnits.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsMultifamilyUnits.marinaId, marinaId as string));

    const units = await db.select().from(opsMultifamilyUnits).where(and(...conditions));

    const totalUnits = units.length;
    const occupiedUnits = units.filter(u => u.status === 'occupied').length;
    const occupancyPct = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const rents = units.filter(u => u.currentRent).map(u => parseFloat(u.currentRent || '0'));
    const averageRent = rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : 0;

    // Unit status breakdown
    const statusCounts: Record<string, number> = {};
    for (const u of units) {
      const s = u.status || 'vacant';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const unitStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status: status.replace(/_/g, ' '),
      count,
    }));

    // Lease expiry wall (next 12 months)
    const now = new Date();
    const leaseExpiryWall: Array<{ month: string; count: number }> = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mStart = d.toISOString().split('T')[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const count = units.filter(u => u.leaseEnd && u.leaseEnd >= mStart && u.leaseEnd <= mEnd).length;
      leaseExpiryWall.push({
        month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        count,
      });
    }

    res.json({
      totalUnits,
      occupancyPct: Math.round(occupancyPct * 10) / 10,
      occupancyChange: 0,
      averageRent: Math.round(averageRent * 100) / 100,
      rentChange: 0,
      delinquencyRate: 0,
      delinquencyChange: 0,
      leaseExpiryWall,
      unitStatusBreakdown,
    });
  } catch (err: any) {
    console.error('Multifamily stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /units — List units
// ============================================================================
router.get('/units', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { status, type, search, marinaId } = req.query;

    let conditions: any[] = [eq(opsMultifamilyUnits.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsMultifamilyUnits.marinaId, marinaId as string));
    if (status && status !== 'all') conditions.push(eq(opsMultifamilyUnits.status, status as string));
    if (type && type !== 'all') conditions.push(eq(opsMultifamilyUnits.unitType, type as string));
    if (search) {
      conditions.push(
        or(
          ilike(opsMultifamilyUnits.unitNumber, `%${search}%`),
          ilike(opsMultifamilyUnits.tenantName, `%${search}%`),
        )
      );
    }

    const units = await db.select().from(opsMultifamilyUnits).where(and(...conditions));

    const mapped = units.map(u => ({
      id: u.id,
      unitNumber: u.unitNumber,
      type: u.unitType,
      sqFt: u.sqft || 0,
      status: u.status,
      currentRent: parseFloat(u.currentRent || '0'),
      marketRent: parseFloat(u.marketRent || '0'),
      tenant: u.tenantName || null,
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error('Multifamily units list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /units — Create unit
// ============================================================================
router.post('/units', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = unitSchema.parse(req.body);

    const [unit] = await db.insert(opsMultifamilyUnits).values({
      orgId,
      ...parsed,
    }).returning();

    res.status(201).json(unit);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Multifamily unit create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /units/:id — Update unit
// ============================================================================
router.put('/units/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const parsed = unitSchema.partial().parse(req.body);

    const [updated] = await db.update(opsMultifamilyUnits)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(opsMultifamilyUnits.id, id), eq(opsMultifamilyUnits.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Unit not found' });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Multifamily unit update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /units/:id — Delete unit
// ============================================================================
router.delete('/units/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const [deleted] = await db.delete(opsMultifamilyUnits)
      .where(and(eq(opsMultifamilyUnits.id, id), eq(opsMultifamilyUnits.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Unit not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Multifamily unit delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /lease-expiry — Lease expiration data
// ============================================================================
router.get('/lease-expiry', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsMultifamilyUnits.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsMultifamilyUnits.marinaId, marinaId as string));

    const units = await db.select().from(opsMultifamilyUnits).where(and(...conditions));

    const now = new Date();
    const leases = units
      .filter(u => u.leaseEnd && u.tenantName)
      .map(u => {
        const leaseEndDate = new Date(u.leaseEnd!);
        const daysUntilExpiry = Math.ceil((leaseEndDate.getTime() - now.getTime()) / 86400000);
        const currentRent = parseFloat(u.currentRent || '0');
        const marketRent = parseFloat(u.marketRent || '0');
        const variancePct = marketRent > 0 ? ((marketRent - currentRent) / marketRent) * 100 : 0;

        // Determine renewal status based on expiry
        let renewalStatus: string;
        if (daysUntilExpiry < 0) {
          renewalStatus = 'month_to_month';
        } else {
          renewalStatus = 'pending';
        }

        return {
          id: u.id,
          unitNumber: u.unitNumber,
          tenant: u.tenantName!,
          leaseEnd: u.leaseEnd!,
          currentRent,
          marketRent,
          variancePct: Math.round(variancePct * 10) / 10,
          renewalStatus,
          daysUntilExpiry: Math.max(0, daysUntilExpiry),
        };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    res.json(leases);
  } catch (err: any) {
    console.error('Multifamily lease-expiry error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /turns — Active/completed turns
// ============================================================================
router.get('/turns', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsMultifamilyTurns.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsMultifamilyTurns.marinaId, marinaId as string));

    const turns = await db.select().from(opsMultifamilyTurns)
      .where(and(...conditions))
      .orderBy(desc(opsMultifamilyTurns.createdAt));

    const now = new Date();
    const activeTurns = turns.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

    const completedTurns = turns.filter(t => t.status === 'completed');
    const avgTurnDays = completedTurns.length > 0
      ? completedTurns.reduce((sum, t) => {
          const moveOut = new Date(t.moveOutDate);
          const moveIn = t.actualMoveIn ? new Date(t.actualMoveIn) : now;
          return sum + Math.ceil((moveIn.getTime() - moveOut.getTime()) / 86400000);
        }, 0) / completedTurns.length
      : 0;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mtdTurns = turns.filter(t => new Date(t.createdAt) >= monthStart);
    const totalTurnCostMtd = mtdTurns.reduce((sum, t) => sum + parseFloat(t.actualCost || t.estimatedCost || '0'), 0);
    const avgTurnCost = turns.length > 0
      ? turns.reduce((sum, t) => sum + parseFloat(t.actualCost || t.estimatedCost || '0'), 0) / turns.length
      : 0;

    const turnRecords = turns.map(t => {
      const moveOut = new Date(t.moveOutDate);
      const daysVacant = Math.max(0, Math.ceil((now.getTime() - moveOut.getTime()) / 86400000));
      return {
        id: t.id,
        unitNumber: t.unitNumber,
        moveOutDate: t.moveOutDate,
        targetMoveIn: t.targetMoveIn || '',
        daysVacant: t.status === 'completed' && t.actualMoveIn
          ? Math.ceil((new Date(t.actualMoveIn).getTime() - moveOut.getTime()) / 86400000)
          : daysVacant,
        scope: t.scope,
        cost: parseFloat(t.actualCost || t.estimatedCost || '0'),
        status: t.status,
      };
    });

    res.json({
      activeTurns,
      averageTurnDays: Math.round(avgTurnDays),
      totalTurnCostMtd: Math.round(totalTurnCostMtd),
      averageTurnCost: Math.round(avgTurnCost),
      turns: turnRecords,
    });
  } catch (err: any) {
    console.error('Multifamily turns error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /turns — Create turn
// ============================================================================
router.post('/turns', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = turnSchema.parse(req.body);

    const [turn] = await db.insert(opsMultifamilyTurns).values({
      orgId,
      ...parsed,
    }).returning();

    res.status(201).json(turn);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Multifamily turn create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /turns/:id — Update turn
// ============================================================================
router.put('/turns/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const parsed = turnSchema.partial().parse(req.body);

    const [updated] = await db.update(opsMultifamilyTurns)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(opsMultifamilyTurns.id, id), eq(opsMultifamilyTurns.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Turn not found' });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Multifamily turn update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /rent-collection — Rent payment status by unit (derived from unit status)
// ============================================================================
router.get('/rent-collection', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsMultifamilyUnits.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsMultifamilyUnits.marinaId, marinaId as string));

    const units = await db.select().from(opsMultifamilyUnits).where(and(...conditions));

    const statusToPayment = (status: string): { paymentStatus: string; paymentLabel: string } => {
      switch (status) {
        case 'occupied':        return { paymentStatus: 'paid',        paymentLabel: 'Paid' };
        case 'delinquent':      return { paymentStatus: 'delinquent',  paymentLabel: 'Delinquent' };
        case 'on_notice':       return { paymentStatus: 'at_risk',     paymentLabel: 'At Risk' };
        case 'down_for_turn':   return { paymentStatus: 'vacant',      paymentLabel: 'Vacant' };
        case 'vacant':          return { paymentStatus: 'vacant',      paymentLabel: 'Vacant' };
        default:                return { paymentStatus: 'unknown',     paymentLabel: 'Unknown' };
      }
    };

    const records = units
      .filter(u => u.status !== 'vacant' && u.status !== 'down_for_turn')
      .map(u => {
        const { paymentStatus, paymentLabel } = statusToPayment(u.status);
        return {
          id: u.id,
          unitNumber: u.unitNumber,
          unitType: u.unitType,
          tenantName: u.tenantName || '—',
          currentRent: parseFloat(u.currentRent || '0'),
          paymentStatus,
          paymentLabel,
        };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { delinquent: 0, at_risk: 1, paid: 2, vacant: 3, unknown: 4 };
        return (order[a.paymentStatus] || 9) - (order[b.paymentStatus] || 9);
      });

    const summary = {
      paid: records.filter(r => r.paymentStatus === 'paid').length,
      delinquent: records.filter(r => r.paymentStatus === 'delinquent').length,
      atRisk: records.filter(r => r.paymentStatus === 'at_risk').length,
      totalCollectable: records.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + r.currentRent, 0),
      totalDelinquent: records.filter(r => r.paymentStatus === 'delinquent').reduce((s, r) => s + r.currentRent, 0),
    };

    res.json({ summary, records });
  } catch (err: any) {
    console.error('Multifamily rent-collection error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /maintenance — Maintenance request queue (derived from turns + unit status)
// ============================================================================
router.get('/maintenance', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let unitConds: any[] = [eq(opsMultifamilyUnits.orgId, orgId)];
    let turnConds: any[] = [eq(opsMultifamilyTurns.orgId, orgId)];
    if (marinaId) {
      unitConds.push(eq(opsMultifamilyUnits.marinaId, marinaId as string));
      turnConds.push(eq(opsMultifamilyTurns.marinaId, marinaId as string));
    }

    const [units, turns] = await Promise.all([
      db.select().from(opsMultifamilyUnits).where(and(...unitConds)),
      db.select().from(opsMultifamilyTurns).where(and(...turnConds)).orderBy(desc(opsMultifamilyTurns.createdAt)),
    ]);

    // Derive priority from turn scope
    const scopePriority = (scope: string): 'high' | 'medium' | 'low' => {
      switch (scope) {
        case 'flooring':
        case 'full_rehab':
          return 'high';
        case 'paint':
        case 'deep_clean':
          return 'medium';
        default:
          return 'low';
      }
    };

    const activeTurns = turns.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const requests = activeTurns.map(t => ({
      id: t.id,
      unitNumber: t.unitNumber,
      type: t.scope.replace(/_/g, ' '),
      priority: scopePriority(t.scope),
      status: t.status,
      requestedDate: t.moveOutDate,
      estimatedCost: parseFloat(t.estimatedCost || '0'),
    })).sort((a, b) => {
      const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] || 9) - (p[b.priority] || 9);
    });

    const priorityCounts = {
      high: requests.filter(r => r.priority === 'high').length,
      medium: requests.filter(r => r.priority === 'medium').length,
      low: requests.filter(r => r.priority === 'low').length,
    };

    res.json({ priorityCounts, requests });
  } catch (err: any) {
    console.error('Multifamily maintenance error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

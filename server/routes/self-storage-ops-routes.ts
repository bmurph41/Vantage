import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  opsSelfStorageUnits, opsMarinas,
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

const unitSchema = z.object({
  marinaId: z.string().min(1),
  unitNumber: z.string().min(1),
  size: z.string().default('10x10'),
  unitType: z.string().default('standard'),
  status: z.string().default('available'),
  monthlyRate: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  streetRate: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  tenantName: z.string().optional().nullable(),
  moveInDate: z.string().optional().nullable(),
  insuranceActive: z.boolean().optional().default(false),
  autopayEnabled: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
});

const rateAdjustSchema = z.object({
  marinaId: z.string().min(1),
  size: z.string().optional(),
  unitType: z.string().optional(),
  newRate: z.string().or(z.number()).transform(v => String(v)),
  effectiveDate: z.string().min(1),
});

// ============================================================================
// Helper: Parse unit size to sq ft
// ============================================================================
function sizeToSqFt(size: string): number {
  const match = size.match(/(\d+)x(\d+)/);
  if (match) return parseInt(match[1]) * parseInt(match[2]);
  return 100; // default
}

// ============================================================================
// GET /stats — Dashboard statistics
// ============================================================================
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    const statsConds: string[] = [`org_id = '${orgId}'`];
    if (marinaId) statsConds.push(`marina_id = '${marinaId}'`);
    const units: any[] = (await db.execute(
      sql.raw(`SELECT *, move_out_date FROM ops_self_storage_units WHERE ${statsConds.join(' AND ')}`)
    )).rows;

    const totalUnits = units.length;
    const occupiedUnits = units.filter(u => u.status === 'occupied').length;
    const occupancyPct = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const rates = units.filter(u => u.monthly_rate).map(u => parseFloat(u.monthly_rate || '0'));
    const averageUnitRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

    // Revenue per SF + total monthly revenue
    const totalMonthlyRevenue = units
      .filter(u => u.status === 'occupied' && u.monthly_rate)
      .reduce((sum, u) => sum + parseFloat(u.monthly_rate || '0'), 0);
    const totalSF = units
      .filter(u => u.status === 'occupied')
      .reduce((sum, u) => sum + sizeToSqFt(u.size), 0);
    const revenuePerSF = totalSF > 0 ? totalMonthlyRevenue / totalSF : 0;

    // Unit occupancy grid: size × status breakdown
    const sizeGrid: Record<string, { occupied: number; available: number; delinquent: number; reserved: number; maintenance: number }> = {};
    for (const u of units) {
      if (!sizeGrid[u.size]) sizeGrid[u.size] = { occupied: 0, available: 0, delinquent: 0, reserved: 0, maintenance: 0 };
      const s = u.status as string;
      if (s === 'occupied') sizeGrid[u.size].occupied++;
      else if (s === 'available') sizeGrid[u.size].available++;
      else if (s === 'delinquent') sizeGrid[u.size].delinquent++;
      else if (s === 'reserved') sizeGrid[u.size].reserved++;
      else if (s === 'maintenance') sizeGrid[u.size].maintenance++;
    }
    const unitOccupancyGrid = Object.entries(sizeGrid)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([size, counts]) => ({
        size,
        ...counts,
        total: counts.occupied + counts.available + counts.delinquent + counts.reserved + counts.maintenance,
      }));
    const unitSizeMix = unitOccupancyGrid.map(g => ({ size: g.size, count: g.total }));

    // Move-in/out trend (last 6 months)
    const now = new Date();
    const moveInOutTrend: Array<{ month: string; moveIns: number; moveOuts: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = d.toISOString().split('T')[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const moveIns = units.filter(u => {
        const mid = u.move_in_date ? String(u.move_in_date).slice(0, 10) : null;
        return mid && mid >= mStart && mid <= mEnd;
      }).length;
      const moveOuts = units.filter(u => {
        const mod = u.move_out_date ? String(u.move_out_date).slice(0, 10) : null;
        return mod && mod >= mStart && mod <= mEnd;
      }).length;
      moveInOutTrend.push({ month: d.toLocaleString('default', { month: 'short' }), moveIns, moveOuts });
    }

    res.json({
      totalUnits,
      occupancyPct: Math.round(occupancyPct * 10) / 10,
      occupancyChange: 0,
      totalMonthlyRevenue: Math.round(totalMonthlyRevenue * 100) / 100,
      revenuePerSF: Math.round(revenuePerSF * 100) / 100,
      revenuePerSFChange: 0,
      averageUnitRate: Math.round(averageUnitRate * 100) / 100,
      rateChange: 0,
      unitSizeMix,
      unitOccupancyGrid,
      moveInOutTrend,
    });
  } catch (err: any) {
    console.error('Self-storage stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /units — List units
// ============================================================================
router.get('/units', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { size, type, status, search, marinaId } = req.query;

    const unitsConds: string[] = [`org_id = '${orgId}'`];
    if (marinaId) unitsConds.push(`marina_id = '${marinaId}'`);
    if (size && size !== 'all') unitsConds.push(`size = '${size}'`);
    if (type && type !== 'all') unitsConds.push(`unit_type = '${type}'`);
    if (status && status !== 'all') unitsConds.push(`status = '${status}'`);
    if (search) {
      const s = String(search).replace(/'/g, "''");
      unitsConds.push(`(unit_number ILIKE '%${s}%' OR tenant_name ILIKE '%${s}%')`);
    }

    const rawUnits: any[] = (await db.execute(
      sql.raw(`SELECT *, move_out_date FROM ops_self_storage_units WHERE ${unitsConds.join(' AND ')} ORDER BY unit_number`)
    )).rows;

    const mapped = rawUnits.map(u => ({
      id: u.id,
      unitNumber: u.unit_number,
      size: u.size,
      unitType: u.unit_type,
      status: u.status,
      monthlyRate: u.monthly_rate || null,
      tenantName: u.tenant_name || null,
      moveInDate: u.move_in_date ? String(u.move_in_date).slice(0, 10) : null,
      moveOutDate: u.move_out_date ? String(u.move_out_date).slice(0, 10) : null,
      autopayEnabled: u.autopay_enabled ?? false,
      insuranceActive: u.insurance_active ?? false,
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error('Self-storage units list error:', err);
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

    const [unit] = await db.insert(opsSelfStorageUnits).values({
      orgId,
      ...parsed,
    }).returning();

    res.status(201).json(unit);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Self-storage unit create error:', err);
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

    const [updated] = await db.update(opsSelfStorageUnits)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(opsSelfStorageUnits.id, id), eq(opsSelfStorageUnits.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Unit not found' });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Self-storage unit update error:', err);
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

    const [deleted] = await db.delete(opsSelfStorageUnits)
      .where(and(eq(opsSelfStorageUnits.id, id), eq(opsSelfStorageUnits.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Unit not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Self-storage unit delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /rates — Rate sheet by size/type
// ============================================================================
router.get('/rates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsSelfStorageUnits.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsSelfStorageUnits.marinaId, marinaId as string));

    const units = await db.select().from(opsSelfStorageUnits).where(and(...conditions));

    // Group by size + type
    const groups: Record<string, typeof units> = {};
    for (const u of units) {
      const key = `${u.size}|${u.unitType}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    }

    const rates = Object.entries(groups).map(([key, groupUnits]) => {
      const [size, type] = key.split('|');
      const currentRates = groupUnits.filter(u => u.monthlyRate).map(u => parseFloat(u.monthlyRate || '0'));
      const streetRates = groupUnits.filter(u => u.streetRate).map(u => parseFloat(u.streetRate || '0'));
      const currentRate = currentRates.length > 0 ? currentRates.reduce((a, b) => a + b, 0) / currentRates.length : 0;
      const marketRate = streetRates.length > 0 ? streetRates.reduce((a, b) => a + b, 0) / streetRates.length : currentRate;
      const variance = marketRate > 0 ? ((currentRate - marketRate) / marketRate) * 100 : 0;
      const occupiedCount = groupUnits.filter(u => u.status === 'occupied').length;

      return {
        size,
        type,
        currentRate: Math.round(currentRate * 100) / 100,
        marketRate: Math.round(marketRate * 100) / 100,
        variance: Math.round(variance * 10) / 10,
        unitCount: groupUnits.length,
        occupiedCount,
      };
    });

    res.json({
      rates,
      competitorRates: [],
    });
  } catch (err: any) {
    console.error('Self-storage rates error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /rates/adjust — Bulk rate adjustment
// ============================================================================
router.post('/rates/adjust', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = rateAdjustSchema.parse(req.body);

    let conditions: any[] = [
      eq(opsSelfStorageUnits.orgId, orgId),
      eq(opsSelfStorageUnits.marinaId, parsed.marinaId),
    ];
    if (parsed.size && parsed.size !== 'all') {
      conditions.push(eq(opsSelfStorageUnits.size, parsed.size));
    }
    if (parsed.unitType && parsed.unitType !== 'all') {
      conditions.push(eq(opsSelfStorageUnits.unitType, parsed.unitType));
    }

    const result = await db.update(opsSelfStorageUnits)
      .set({
        monthlyRate: parsed.newRate,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    res.json({ updated: result.length, effectiveDate: parsed.effectiveDate });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Self-storage rate adjust error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

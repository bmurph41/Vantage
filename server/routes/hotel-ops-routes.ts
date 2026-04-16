import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  opsHotelRooms, opsHotelReservations, opsMarinas, opsHotelCompetitorRates,
} from '@shared/schema';
import { eq, and, sql, gte, lte, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ============================================================================
// AUTH HELPERS
// ============================================================================

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.orgId || (req as any).tenantId;
  if (!orgId) {
    throw new Error('Missing organization context');
  }
  return orgId;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const roomSchema = z.object({
  marinaId: z.string().min(1),
  roomNumber: z.string().min(1),
  roomType: z.string().default('standard'),
  floor: z.number().int().optional().nullable(),
  status: z.string().default('available'),
  baseRate: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  currentRate: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  amenities: z.any().optional().default([]),
  notes: z.string().optional().nullable(),
});

const reservationSchema = z.object({
  marinaId: z.string().min(1),
  roomId: z.string().optional().nullable(),
  guestName: z.string().min(1),
  guestEmail: z.string().optional().nullable(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  nightlyRate: z.string().or(z.number()).transform(v => String(v)),
  totalAmount: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  status: z.string().default('confirmed'),
  source: z.string().default('direct'),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// GET /stats — Dashboard statistics
// ============================================================================
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    const roomConditions = marinaId
      ? and(eq(opsHotelRooms.orgId, orgId), eq(opsHotelRooms.marinaId, marinaId))
      : eq(opsHotelRooms.orgId, orgId);

    const rooms = await db.select().from(opsHotelRooms).where(roomConditions);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const resConditions = marinaId
      ? and(
          eq(opsHotelReservations.orgId, orgId),
          eq(opsHotelReservations.marinaId, marinaId),
        )
      : eq(opsHotelReservations.orgId, orgId);

    const reservations = await db.select().from(opsHotelReservations).where(resConditions);

    // Current month reservations
    const mtdReservations = reservations.filter(r => {
      return r.checkIn <= monthEnd && r.checkOut >= monthStart &&
        (r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'checked_out');
    });

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const occupancyPct = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // ADR = total room revenue / number of occupied room-nights
    let totalRevenue = 0;
    let totalNights = 0;
    for (const r of mtdReservations) {
      const amount = parseFloat(r.totalAmount || '0') || (parseFloat(r.nightlyRate || '0') * Math.max(1, Math.ceil((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000)));
      totalRevenue += amount;
      totalNights += Math.max(1, Math.ceil((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000));
    }

    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
    const revpar = totalRooms > 0 ? totalRevenue / (totalRooms * 30) : 0;

    // Occupancy trend (last 6 months placeholder from reservations)
    const occupancyTrend: Array<{ date: string; occupancy: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = d.toISOString().split('T')[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const monthRes = reservations.filter(r =>
        r.checkIn <= mEnd && r.checkOut >= mStart &&
        (r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'checked_out')
      );
      const roomNights = monthRes.reduce((sum, r) => {
        const ci = new Date(Math.max(new Date(r.checkIn).getTime(), d.getTime()));
        const co = new Date(Math.min(new Date(r.checkOut).getTime(), new Date(mEnd).getTime()));
        return sum + Math.max(0, Math.ceil((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const occ = totalRooms > 0 ? (roomNights / (totalRooms * daysInMonth)) * 100 : 0;
      occupancyTrend.push({
        date: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        occupancy: Math.min(100, Math.round(occ * 10) / 10),
      });
    }

    // Revenue by room type (join reservations to rooms via roomId)
    const roomTypeMap: Record<string, string> = {};
    for (const r of rooms) {
      roomTypeMap[r.id] = r.roomType;
    }
    const revenueByRoomTypeAgg: Record<string, number> = {};
    for (const r of mtdReservations) {
      const roomType = r.roomId ? (roomTypeMap[r.roomId] || 'Other') : 'Other';
      const nights = Math.max(1, Math.ceil((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000));
      const amount = parseFloat(r.totalAmount || '0') || (parseFloat(r.nightlyRate || '0') * nights);
      revenueByRoomTypeAgg[roomType] = (revenueByRoomTypeAgg[roomType] || 0) + amount;
    }
    // If no reservations linked to rooms, show all rooms' base rates as potential revenue
    if (Object.keys(revenueByRoomTypeAgg).length === 0) {
      const roomTypeBaseRevenue: Record<string, number> = {};
      for (const r of rooms) {
        roomTypeBaseRevenue[r.roomType] = (roomTypeBaseRevenue[r.roomType] || 0) + parseFloat(r.baseRate || '0');
      }
      for (const [rt, rev] of Object.entries(roomTypeBaseRevenue)) {
        revenueByRoomTypeAgg[rt] = rev;
      }
    }
    const revenueByRoomType = Object.entries(revenueByRoomTypeAgg)
      .map(([roomType, revenue]) => ({ roomType: roomType.replace(/_/g, ' '), revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      adr: Math.round(adr * 100) / 100,
      adrChange: 0,
      revpar: Math.round(revpar * 100) / 100,
      revparChange: 0,
      occupancyPct: Math.round(occupancyPct * 10) / 10,
      occupancyChange: 0,
      totalRoomRevenueMtd: Math.round(totalRevenue * 100) / 100,
      revenueChange: 0,
      occupancyTrend,
      revenueByRoomType,
    });
  } catch (err: any) {
    console.error('Hotel stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /rooms — List rooms
// ============================================================================
router.get('/rooms', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { status, type, search, marinaId } = req.query;

    let conditions: any[] = [eq(opsHotelRooms.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsHotelRooms.marinaId, marinaId as string));
    if (status && status !== 'all') conditions.push(eq(opsHotelRooms.status, status as string));
    if (type && type !== 'all') conditions.push(eq(opsHotelRooms.roomType, type as string));
    if (search) {
      conditions.push(
        or(
          ilike(opsHotelRooms.roomNumber, `%${search}%`),
          ilike(opsHotelRooms.roomType, `%${search}%`),
        )
      );
    }

    const rooms = await db.select().from(opsHotelRooms).where(and(...conditions));

    // Map to frontend shape
    const mapped = rooms.map(r => ({
      id: r.id,
      roomNumber: r.roomNumber,
      roomType: r.roomType,
      status: r.status,
      currentRate: r.currentRate || r.baseRate || null,
      floor: r.floor ?? null,
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error('Hotel rooms list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /rooms — Create room
// ============================================================================
router.post('/rooms', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = roomSchema.parse(req.body);

    const [room] = await db.insert(opsHotelRooms).values({
      orgId,
      ...parsed,
    }).returning();

    res.status(201).json(room);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Hotel room create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /rooms/:id — Update room
// ============================================================================
router.put('/rooms/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const parsed = roomSchema.partial().parse(req.body);

    const [updated] = await db.update(opsHotelRooms)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(opsHotelRooms.id, id), eq(opsHotelRooms.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Room not found' });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Hotel room update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /rooms/:id — Delete room
// ============================================================================
router.delete('/rooms/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const [deleted] = await db.delete(opsHotelRooms)
      .where(and(eq(opsHotelRooms.id, id), eq(opsHotelRooms.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Room not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Hotel room delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /reservations — List reservations
// ============================================================================
router.get('/reservations', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId, startDate, endDate } = req.query;

    let conditions: any[] = [eq(opsHotelReservations.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsHotelReservations.marinaId, marinaId as string));
    if (startDate) conditions.push(gte(opsHotelReservations.checkIn, startDate as string));
    if (endDate) conditions.push(lte(opsHotelReservations.checkOut, endDate as string));

    const reservations = await db.select().from(opsHotelReservations).where(and(...conditions));
    res.json(reservations);
  } catch (err: any) {
    console.error('Hotel reservations list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /reservations — Create reservation
// ============================================================================
router.post('/reservations', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = reservationSchema.parse(req.body);

    const [reservation] = await db.insert(opsHotelReservations).values({
      orgId,
      ...parsed,
    }).returning();

    res.status(201).json(reservation);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Hotel reservation create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /rates — Rate calendar data
// ============================================================================
router.get('/rates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;

    let conditions: any[] = [eq(opsHotelRooms.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsHotelRooms.marinaId, marinaId as string));

    const rooms = await db.select().from(opsHotelRooms).where(and(...conditions));

    // Get distinct room types and their base rates
    const roomTypeRates: Record<string, number> = {};
    for (const r of rooms) {
      if (!roomTypeRates[r.roomType]) {
        roomTypeRates[r.roomType] = parseFloat(r.baseRate || '0');
      }
    }

    const roomTypes = Object.keys(roomTypeRates);
    const rateCalendar: Array<{ date: string; rates: Record<string, number> }> = [];

    // Generate 14 days of rate data
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const rates: Record<string, number> = {};
      for (const type of roomTypes) {
        rates[type] = roomTypeRates[type];
      }
      rateCalendar.push({ date: dateStr, rates });
    }

    res.json({
      rateCalendar,
      roomTypes,
      seasonalRates: [],
    });
  } catch (err: any) {
    console.error('Hotel rates error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /competitor-rates — List competitor rates
// ============================================================================
router.get('/competitor-rates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const marinaId = req.query.marinaId as string | undefined;
    let conditions: any[] = [eq(opsHotelCompetitorRates.orgId, orgId)];
    if (marinaId) conditions.push(eq(opsHotelCompetitorRates.marinaId, marinaId));
    const rows = await db.select().from(opsHotelCompetitorRates).where(and(...conditions));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /competitor-rates — Create competitor rate entry
// ============================================================================
const competitorRateSchema = z.object({
  marinaId: z.string().optional().nullable(),
  competitorName: z.string().min(1),
  slipType: z.string().default('standard'),
  dailyRate: z.string().or(z.number()).optional().nullable().transform(v => v != null ? String(v) : null),
  weeklyRate: z.string().or(z.number()).optional().nullable().transform(v => v != null ? String(v) : null),
  monthlyRate: z.string().or(z.number()).optional().nullable().transform(v => v != null ? String(v) : null),
  notes: z.string().optional().nullable(),
});

router.post('/competitor-rates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = competitorRateSchema.parse(req.body);
    const [row] = await db.insert(opsHotelCompetitorRates).values({ orgId, ...parsed }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /competitor-rates/:id — Delete competitor rate entry
// ============================================================================
router.delete('/competitor-rates/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const [deleted] = await db.delete(opsHotelCompetitorRates)
      .where(and(eq(opsHotelCompetitorRates.id, id), eq(opsHotelCompetitorRates.orgId, orgId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

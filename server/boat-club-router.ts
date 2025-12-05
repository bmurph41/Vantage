import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import {
  boatClubFleet, boatClubMemberships, boatClubBookings,
  type BoatClubFleet, type BoatClubMembership, type BoatClubBooking,
  insertBoatClubFleetSchema, insertBoatClubMembershipSchema, insertBoatClubBookingSchema
} from '@shared/schema';
import { eq, desc, sql, and, gte, lte, or } from 'drizzle-orm';

const router = Router();

function requireManager(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const role = user.role?.toLowerCase();
  if (role === 'owner' || role === 'editor' || role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Manager access required' });
}

// ===== FLEET =====

router.get('/fleet', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, tier, search } = req.query;
    const conditions = [eq(boatClubFleet.orgId, user.orgId)];
    if (status) conditions.push(eq(boatClubFleet.status, status as string));
    if (tier) conditions.push(eq(boatClubFleet.minimumMembershipTier, tier as string));

    const result = await db.select().from(boatClubFleet)
      .where(and(...conditions))
      .orderBy(boatClubFleet.name);

    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(b => 
        b.name.toLowerCase().includes(searchLower) ||
        b.make?.toLowerCase().includes(searchLower) ||
        b.model?.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching club fleet:', error);
    res.status(500).json({ message: 'Error fetching club fleet' });
  }
});

router.get('/fleet/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [boat] = await db.select().from(boatClubFleet)
      .where(and(eq(boatClubFleet.id, req.params.id), eq(boatClubFleet.orgId, user.orgId)));
    if (!boat) return res.status(404).json({ message: 'Boat not found' });
    res.json(boat);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching boat' });
  }
});

router.post('/fleet', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const data = insertBoatClubFleetSchema.parse({ ...req.body, orgId: user.orgId });
    const [boat] = await db.insert(boatClubFleet).values(data).returning();
    res.json(boat);
  } catch (error) {
    console.error('Error creating club boat:', error);
    res.status(400).json({ message: 'Error creating club boat' });
  }
});

router.patch('/fleet/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [boat] = await db.update(boatClubFleet)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(boatClubFleet.id, req.params.id), eq(boatClubFleet.orgId, user.orgId)))
      .returning();
    if (!boat) return res.status(404).json({ message: 'Boat not found' });
    res.json(boat);
  } catch (error) {
    res.status(400).json({ message: 'Error updating boat' });
  }
});

router.delete('/fleet/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(boatClubFleet)
      .where(and(eq(boatClubFleet.id, req.params.id), eq(boatClubFleet.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting boat' });
  }
});

// ===== MEMBERSHIPS =====

router.get('/memberships', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, tier, search } = req.query;
    const conditions = [eq(boatClubMemberships.orgId, user.orgId)];
    if (status) conditions.push(eq(boatClubMemberships.status, status as string));
    if (tier) conditions.push(eq(boatClubMemberships.tier, tier as string));

    const result = await db.select().from(boatClubMemberships)
      .where(and(...conditions))
      .orderBy(boatClubMemberships.lastName);

    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(m => 
        m.firstName.toLowerCase().includes(searchLower) ||
        m.lastName.toLowerCase().includes(searchLower) ||
        m.email.toLowerCase().includes(searchLower) ||
        m.memberNumber.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching memberships:', error);
    res.status(500).json({ message: 'Error fetching memberships' });
  }
});

router.get('/memberships/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const memberships = await db.select().from(boatClubMemberships)
      .where(eq(boatClubMemberships.orgId, user.orgId));

    const active = memberships.filter(m => m.status === 'active');
    const stats = {
      totalMembers: memberships.length,
      activeMembers: active.length,
      pendingMembers: memberships.filter(m => m.status === 'pending').length,
      suspendedMembers: memberships.filter(m => m.status === 'suspended').length,
      expiredMembers: memberships.filter(m => m.status === 'expired').length,
      monthlyRecurringRevenue: active.reduce((sum, m) => sum + Number(m.monthlyFee || 0), 0),
      membersByTier: Object.entries(
        active.reduce((acc, m) => {
          acc[m.tier] = (acc[m.tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([tier, count]) => ({ tier, count })),
      avgHoursUsed: active.length > 0 
        ? active.reduce((sum, m) => sum + Number(m.hoursUsedThisMonth || 0), 0) / active.length 
        : 0,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching membership stats' });
  }
});

router.get('/memberships/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [membership] = await db.select().from(boatClubMemberships)
      .where(and(eq(boatClubMemberships.id, req.params.id), eq(boatClubMemberships.orgId, user.orgId)));
    if (!membership) return res.status(404).json({ message: 'Membership not found' });

    const bookings = await db.select().from(boatClubBookings)
      .where(eq(boatClubBookings.membershipId, req.params.id))
      .orderBy(desc(boatClubBookings.startDateTime))
      .limit(10);

    res.json({ ...membership, recentBookings: bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching membership' });
  }
});

router.post('/memberships', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(boatClubMemberships)
      .where(eq(boatClubMemberships.orgId, user.orgId));
    const memberNumber = `MBR-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertBoatClubMembershipSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      memberNumber,
      createdBy: user.id 
    });
    const [membership] = await db.insert(boatClubMemberships).values(data).returning();
    res.json(membership);
  } catch (error) {
    console.error('Error creating membership:', error);
    res.status(400).json({ message: 'Error creating membership' });
  }
});

router.patch('/memberships/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [membership] = await db.update(boatClubMemberships)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(boatClubMemberships.id, req.params.id), eq(boatClubMemberships.orgId, user.orgId)))
      .returning();
    if (!membership) return res.status(404).json({ message: 'Membership not found' });
    res.json(membership);
  } catch (error) {
    res.status(400).json({ message: 'Error updating membership' });
  }
});

router.delete('/memberships/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(boatClubMemberships)
      .where(and(eq(boatClubMemberships.id, req.params.id), eq(boatClubMemberships.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting membership' });
  }
});

// ===== BOOKINGS =====

router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, membershipId, boatId, startDate, endDate } = req.query;
    const conditions = [eq(boatClubBookings.orgId, user.orgId)];
    if (status) conditions.push(eq(boatClubBookings.status, status as string));
    if (membershipId) conditions.push(eq(boatClubBookings.membershipId, membershipId as string));
    if (boatId) conditions.push(eq(boatClubBookings.boatId, boatId as string));
    if (startDate) conditions.push(gte(boatClubBookings.startDateTime, new Date(startDate as string)));
    if (endDate) conditions.push(lte(boatClubBookings.startDateTime, new Date(endDate as string)));

    const result = await db.select().from(boatClubBookings)
      .where(and(...conditions))
      .orderBy(desc(boatClubBookings.startDateTime));

    res.json(result);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

router.get('/bookings/calendar', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates required' });
    }

    const bookings = await db.select({
      booking: boatClubBookings,
      boat: boatClubFleet,
      membership: boatClubMemberships
    })
    .from(boatClubBookings)
    .leftJoin(boatClubFleet, eq(boatClubBookings.boatId, boatClubFleet.id))
    .leftJoin(boatClubMemberships, eq(boatClubBookings.membershipId, boatClubMemberships.id))
    .where(and(
      eq(boatClubBookings.orgId, user.orgId),
      gte(boatClubBookings.startDateTime, new Date(start as string)),
      lte(boatClubBookings.endDateTime, new Date(end as string))
    ));

    const calendarEvents = bookings.map(b => ({
      id: b.booking.id,
      title: `${b.boat?.name || 'Unknown Boat'} - ${b.membership?.firstName} ${b.membership?.lastName}`,
      start: b.booking.startDateTime,
      end: b.booking.endDateTime,
      status: b.booking.status,
      boatId: b.booking.boatId,
      boatName: b.boat?.name,
      memberName: b.membership ? `${b.membership.firstName} ${b.membership.lastName}` : 'Unknown',
      memberNumber: b.membership?.memberNumber,
      bookingNumber: b.booking.bookingNumber,
    }));

    res.json(calendarEvents);
  } catch (error) {
    console.error('Error fetching booking calendar:', error);
    res.status(500).json({ message: 'Error fetching calendar' });
  }
});

router.get('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select({
      booking: boatClubBookings,
      boat: boatClubFleet,
      membership: boatClubMemberships
    })
    .from(boatClubBookings)
    .leftJoin(boatClubFleet, eq(boatClubBookings.boatId, boatClubFleet.id))
    .leftJoin(boatClubMemberships, eq(boatClubBookings.membershipId, boatClubMemberships.id))
    .where(and(eq(boatClubBookings.id, req.params.id), eq(boatClubBookings.orgId, user.orgId)));

    if (!result[0]) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ...result[0].booking, boat: result[0].boat, membership: result[0].membership });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching booking' });
  }
});

router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(boatClubBookings)
      .where(eq(boatClubBookings.orgId, user.orgId));
    const bookingNumber = `BKG-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertBoatClubBookingSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      bookingNumber
    });
    const [booking] = await db.insert(boatClubBookings).values(data).returning();
    res.json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(400).json({ message: 'Error creating booking' });
  }
});

router.patch('/bookings/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const updateData: any = { ...req.body, updatedAt: new Date() };
    
    if (req.body.status === 'checked_out') {
      updateData.checkedOutBy = user.id;
    }
    if (req.body.status === 'returned') {
      updateData.checkedInBy = user.id;
      updateData.actualReturnTime = new Date();
      
      const [existingBooking] = await db.select().from(boatClubBookings)
        .where(eq(boatClubBookings.id, req.params.id));
      if (existingBooking) {
        await db.update(boatClubMemberships)
          .set({ 
            hoursUsedThisMonth: sql`${boatClubMemberships.hoursUsedThisMonth} + ${req.body.hoursUsed || existingBooking.hoursBooked}`,
            updatedAt: new Date()
          })
          .where(eq(boatClubMemberships.id, existingBooking.membershipId));
      }
    }

    const [booking] = await db.update(boatClubBookings)
      .set(updateData)
      .where(and(eq(boatClubBookings.id, req.params.id), eq(boatClubBookings.orgId, user.orgId)))
      .returning();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(400).json({ message: 'Error updating booking' });
  }
});

router.delete('/bookings/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(boatClubBookings)
      .where(and(eq(boatClubBookings.id, req.params.id), eq(boatClubBookings.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting booking' });
  }
});

// ===== ANALYTICS =====

router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    
    const memberships = await db.select().from(boatClubMemberships)
      .where(eq(boatClubMemberships.orgId, user.orgId));
    
    const bookingConditions = [eq(boatClubBookings.orgId, user.orgId)];
    if (startDate) bookingConditions.push(gte(boatClubBookings.startDateTime, new Date(startDate as string)));
    if (endDate) bookingConditions.push(lte(boatClubBookings.startDateTime, new Date(endDate as string)));
    
    const bookings = await db.select().from(boatClubBookings).where(and(...bookingConditions));
    const fleet = await db.select().from(boatClubFleet)
      .where(eq(boatClubFleet.orgId, user.orgId));

    const active = memberships.filter(m => m.status === 'active');
    const completed = bookings.filter(b => b.status === 'returned');

    const summary = {
      totalMembers: memberships.length,
      activeMembers: active.length,
      monthlyRecurringRevenue: active.reduce((sum, m) => sum + Number(m.monthlyFee || 0), 0),
      annualRecurringRevenue: active.reduce((sum, m) => sum + Number(m.monthlyFee || 0), 0) * 12,
      totalBookings: bookings.length,
      completedBookings: completed.length,
      totalHoursBooked: bookings.reduce((sum, b) => sum + Number(b.hoursBooked || 0), 0),
      totalHoursUsed: completed.reduce((sum, b) => sum + Number(b.hoursUsed || 0), 0),
      additionalCharges: completed.reduce((sum, b) => sum + Number(b.totalCharges || 0), 0),
      fleetSize: fleet.length,
      avgBookingsPerMember: active.length > 0 ? bookings.length / active.length : 0,
      membersByTier: Object.entries(
        active.reduce((acc, m) => {
          acc[m.tier] = (acc[m.tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([tier, count]) => ({ tier, count })),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching club analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

export default router;

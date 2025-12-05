import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import {
  boatRentalFleet, boatRentals,
  type BoatRentalFleet, type BoatRental,
  insertBoatRentalFleetSchema, insertBoatRentalSchema
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

    const { status, search } = req.query;
    const conditions = [eq(boatRentalFleet.orgId, user.orgId)];
    if (status) conditions.push(eq(boatRentalFleet.status, status as string));

    const result = await db.select().from(boatRentalFleet)
      .where(and(...conditions))
      .orderBy(boatRentalFleet.name);

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
    console.error('Error fetching rental fleet:', error);
    res.status(500).json({ message: 'Error fetching rental fleet' });
  }
});

router.get('/fleet/available', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    
    const availableBoats = await db.select().from(boatRentalFleet)
      .where(and(
        eq(boatRentalFleet.orgId, user.orgId),
        eq(boatRentalFleet.status, 'available'),
        eq(boatRentalFleet.isActive, true)
      ))
      .orderBy(boatRentalFleet.name);

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const conflictingRentals = await db.select().from(boatRentals)
        .where(and(
          eq(boatRentals.orgId, user.orgId),
          or(
            eq(boatRentals.status, 'confirmed'),
            eq(boatRentals.status, 'checked_out')
          ),
          or(
            and(gte(boatRentals.startDateTime, start), lte(boatRentals.startDateTime, end)),
            and(gte(boatRentals.endDateTime, start), lte(boatRentals.endDateTime, end)),
            and(lte(boatRentals.startDateTime, start), gte(boatRentals.endDateTime, end))
          )
        ));

      const bookedBoatIds = new Set(conflictingRentals.map(r => r.boatId));
      const available = availableBoats.filter(b => !bookedBoatIds.has(b.id));
      return res.json(available);
    }

    res.json(availableBoats);
  } catch (error) {
    console.error('Error fetching available boats:', error);
    res.status(500).json({ message: 'Error fetching available boats' });
  }
});

router.get('/fleet/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [boat] = await db.select().from(boatRentalFleet)
      .where(and(eq(boatRentalFleet.id, req.params.id), eq(boatRentalFleet.orgId, user.orgId)));
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

    const data = insertBoatRentalFleetSchema.parse({ ...req.body, orgId: user.orgId });
    const [boat] = await db.insert(boatRentalFleet).values(data).returning();
    res.json(boat);
  } catch (error) {
    console.error('Error creating rental boat:', error);
    res.status(400).json({ message: 'Error creating rental boat' });
  }
});

router.patch('/fleet/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [boat] = await db.update(boatRentalFleet)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(boatRentalFleet.id, req.params.id), eq(boatRentalFleet.orgId, user.orgId)))
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

    await db.delete(boatRentalFleet)
      .where(and(eq(boatRentalFleet.id, req.params.id), eq(boatRentalFleet.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting boat' });
  }
});

// ===== RENTALS =====

router.get('/rentals', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, boatId, startDate, endDate, search } = req.query;
    const conditions = [eq(boatRentals.orgId, user.orgId)];
    if (status) conditions.push(eq(boatRentals.status, status as string));
    if (boatId) conditions.push(eq(boatRentals.boatId, boatId as string));
    if (startDate) conditions.push(gte(boatRentals.startDateTime, new Date(startDate as string)));
    if (endDate) conditions.push(lte(boatRentals.startDateTime, new Date(endDate as string)));

    const result = await db.select().from(boatRentals)
      .where(and(...conditions))
      .orderBy(desc(boatRentals.startDateTime));

    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(r => 
        r.rentalNumber.toLowerCase().includes(searchLower) ||
        r.customerName.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching rentals:', error);
    res.status(500).json({ message: 'Error fetching rentals' });
  }
});

router.get('/rentals/calendar', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates required' });
    }

    const rentals = await db.select({
      rental: boatRentals,
      boat: boatRentalFleet
    })
    .from(boatRentals)
    .leftJoin(boatRentalFleet, eq(boatRentals.boatId, boatRentalFleet.id))
    .where(and(
      eq(boatRentals.orgId, user.orgId),
      gte(boatRentals.startDateTime, new Date(start as string)),
      lte(boatRentals.endDateTime, new Date(end as string))
    ));

    const calendarEvents = rentals.map(r => ({
      id: r.rental.id,
      title: `${r.boat?.name || 'Unknown Boat'} - ${r.rental.customerName}`,
      start: r.rental.startDateTime,
      end: r.rental.endDateTime,
      status: r.rental.status,
      boatId: r.rental.boatId,
      boatName: r.boat?.name,
      customerName: r.rental.customerName,
      rentalNumber: r.rental.rentalNumber,
    }));

    res.json(calendarEvents);
  } catch (error) {
    console.error('Error fetching rental calendar:', error);
    res.status(500).json({ message: 'Error fetching calendar' });
  }
});

router.get('/rentals/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    const conditions = [eq(boatRentals.orgId, user.orgId)];
    if (startDate) conditions.push(gte(boatRentals.startDateTime, new Date(startDate as string)));
    if (endDate) conditions.push(lte(boatRentals.startDateTime, new Date(endDate as string)));

    const rentals = await db.select().from(boatRentals).where(and(...conditions));
    const fleet = await db.select().from(boatRentalFleet)
      .where(and(eq(boatRentalFleet.orgId, user.orgId), eq(boatRentalFleet.isActive, true)));

    const completed = rentals.filter(r => r.status === 'returned');
    const stats = {
      totalRentals: rentals.length,
      pendingRentals: rentals.filter(r => r.status === 'pending').length,
      confirmedRentals: rentals.filter(r => r.status === 'confirmed').length,
      activeRentals: rentals.filter(r => r.status === 'checked_out').length,
      completedRentals: completed.length,
      cancelledRentals: rentals.filter(r => r.status === 'cancelled').length,
      totalRevenue: completed.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
      avgRentalValue: completed.length > 0 
        ? completed.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0) / completed.length 
        : 0,
      fleetSize: fleet.length,
      availableBoats: fleet.filter(b => b.status === 'available').length,
      utilizationRate: fleet.length > 0 
        ? (fleet.length - fleet.filter(b => b.status === 'available').length) / fleet.length * 100 
        : 0,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rental stats' });
  }
});

router.get('/rentals/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select({
      rental: boatRentals,
      boat: boatRentalFleet
    })
    .from(boatRentals)
    .leftJoin(boatRentalFleet, eq(boatRentals.boatId, boatRentalFleet.id))
    .where(and(eq(boatRentals.id, req.params.id), eq(boatRentals.orgId, user.orgId)));

    if (!result[0]) return res.status(404).json({ message: 'Rental not found' });
    res.json({ ...result[0].rental, boat: result[0].boat });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rental' });
  }
});

router.post('/rentals', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(boatRentals)
      .where(eq(boatRentals.orgId, user.orgId));
    const rentalNumber = `RNT-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertBoatRentalSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      rentalNumber,
      createdBy: user.id 
    });
    const [rental] = await db.insert(boatRentals).values(data).returning();
    res.json(rental);
  } catch (error) {
    console.error('Error creating rental:', error);
    res.status(400).json({ message: 'Error creating rental' });
  }
});

router.patch('/rentals/:id', requireManager, async (req: Request, res: Response) => {
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
    }

    const [rental] = await db.update(boatRentals)
      .set(updateData)
      .where(and(eq(boatRentals.id, req.params.id), eq(boatRentals.orgId, user.orgId)))
      .returning();
    if (!rental) return res.status(404).json({ message: 'Rental not found' });
    res.json(rental);
  } catch (error) {
    res.status(400).json({ message: 'Error updating rental' });
  }
});

router.delete('/rentals/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(boatRentals)
      .where(and(eq(boatRentals.id, req.params.id), eq(boatRentals.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting rental' });
  }
});

// ===== ANALYTICS =====

router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    const conditions = [eq(boatRentals.orgId, user.orgId)];
    if (startDate) conditions.push(gte(boatRentals.startDateTime, new Date(startDate as string)));
    if (endDate) conditions.push(lte(boatRentals.startDateTime, new Date(endDate as string)));

    const rentals = await db.select().from(boatRentals).where(and(...conditions));
    const fleet = await db.select().from(boatRentalFleet)
      .where(eq(boatRentalFleet.orgId, user.orgId));

    const completed = rentals.filter(r => r.status === 'returned');
    
    const revenueByBoat = completed.reduce((acc, r) => {
      acc[r.boatId] = (acc[r.boatId] || 0) + Number(r.totalAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    const rentalsByPricingType = Object.entries(
      rentals.reduce((acc, r) => {
        acc[r.pricingType] = (acc[r.pricingType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([type, count]) => ({ type, count }));

    const summary = {
      totalRentals: rentals.length,
      completedRentals: completed.length,
      totalRevenue: completed.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
      fuelRevenue: completed.reduce((sum, r) => sum + Number(r.fuelCharge || 0), 0),
      damageCharges: completed.reduce((sum, r) => sum + Number(r.damageCharge || 0), 0),
      lateCharges: completed.reduce((sum, r) => sum + Number(r.lateCharge || 0), 0),
      avgRentalDuration: completed.length > 0 
        ? completed.reduce((sum, r) => sum + Number(r.hoursRented || 0), 0) / completed.length 
        : 0,
      topPerformingBoats: Object.entries(revenueByBoat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([boatId, revenue]) => {
          const boat = fleet.find(b => b.id === boatId);
          return { boatId, boatName: boat?.name || 'Unknown', revenue };
        }),
      rentalsByPricingType,
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching rental analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

export default router;

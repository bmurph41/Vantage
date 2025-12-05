import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import {
  serviceTechnicians, serviceWorkOrders, serviceLaborEntries, servicePartsUsed, serviceParts,
  type ServiceTechnician, type ServiceWorkOrder, type ServiceLaborEntry, type ServicePartUsed, type ServicePart,
  insertServiceTechnicianSchema, insertServiceWorkOrderSchema, insertServiceLaborEntrySchema, 
  insertServicePartsUsedSchema, insertServicePartSchema
} from '@shared/schema';
import { eq, desc, sql, and, gte, lte, like, or, asc } from 'drizzle-orm';

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

// ===== TECHNICIANS =====

router.get('/technicians', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select().from(serviceTechnicians)
      .where(eq(serviceTechnicians.orgId, user.orgId))
      .orderBy(serviceTechnicians.lastName);
    res.json(result);
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ message: 'Error fetching technicians' });
  }
});

router.get('/technicians/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [technician] = await db.select().from(serviceTechnicians)
      .where(and(eq(serviceTechnicians.id, req.params.id), eq(serviceTechnicians.orgId, user.orgId)));
    if (!technician) return res.status(404).json({ message: 'Technician not found' });
    res.json(technician);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching technician' });
  }
});

router.post('/technicians', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const data = insertServiceTechnicianSchema.parse({ ...req.body, orgId: user.orgId });
    const [technician] = await db.insert(serviceTechnicians).values(data).returning();
    res.json(technician);
  } catch (error) {
    console.error('Error creating technician:', error);
    res.status(400).json({ message: 'Error creating technician' });
  }
});

router.patch('/technicians/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [technician] = await db.update(serviceTechnicians)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(serviceTechnicians.id, req.params.id), eq(serviceTechnicians.orgId, user.orgId)))
      .returning();
    if (!technician) return res.status(404).json({ message: 'Technician not found' });
    res.json(technician);
  } catch (error) {
    res.status(400).json({ message: 'Error updating technician' });
  }
});

router.delete('/technicians/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(serviceTechnicians)
      .where(and(eq(serviceTechnicians.id, req.params.id), eq(serviceTechnicians.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting technician' });
  }
});

// ===== PARTS =====

router.get('/parts', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { category, search, lowStock } = req.query;
    let query = db.select().from(serviceParts).where(eq(serviceParts.orgId, user.orgId));

    if (category) {
      query = db.select().from(serviceParts).where(
        and(eq(serviceParts.orgId, user.orgId), eq(serviceParts.category, category as string))
      );
    }
    
    const result = await query.orderBy(serviceParts.name);
    
    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) || 
        p.partNumber.toLowerCase().includes(searchLower)
      );
    }
    if (lowStock === 'true') {
      filtered = filtered.filter(p => p.quantityOnHand <= p.reorderPoint);
    }
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching parts:', error);
    res.status(500).json({ message: 'Error fetching parts' });
  }
});

router.get('/parts/low-stock', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select().from(serviceParts)
      .where(and(
        eq(serviceParts.orgId, user.orgId),
        eq(serviceParts.isActive, true),
        sql`${serviceParts.quantityOnHand} <= ${serviceParts.reorderPoint}`
      ))
      .orderBy(serviceParts.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock parts' });
  }
});

router.get('/parts/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [part] = await db.select().from(serviceParts)
      .where(and(eq(serviceParts.id, req.params.id), eq(serviceParts.orgId, user.orgId)));
    if (!part) return res.status(404).json({ message: 'Part not found' });
    res.json(part);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching part' });
  }
});

router.post('/parts', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const data = insertServicePartSchema.parse({ ...req.body, orgId: user.orgId });
    const [part] = await db.insert(serviceParts).values(data).returning();
    res.json(part);
  } catch (error) {
    console.error('Error creating part:', error);
    res.status(400).json({ message: 'Error creating part' });
  }
});

router.patch('/parts/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [part] = await db.update(serviceParts)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(serviceParts.id, req.params.id), eq(serviceParts.orgId, user.orgId)))
      .returning();
    if (!part) return res.status(404).json({ message: 'Part not found' });
    res.json(part);
  } catch (error) {
    res.status(400).json({ message: 'Error updating part' });
  }
});

router.delete('/parts/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(serviceParts)
      .where(and(eq(serviceParts.id, req.params.id), eq(serviceParts.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting part' });
  }
});

// ===== WORK ORDERS =====

router.get('/work-orders', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, technicianId, startDate, endDate, search } = req.query;
    
    const conditions = [eq(serviceWorkOrders.orgId, user.orgId)];
    if (status) conditions.push(eq(serviceWorkOrders.status, status as string));
    if (technicianId) conditions.push(eq(serviceWorkOrders.assignedTechnicianId, technicianId as string));
    if (startDate) conditions.push(gte(serviceWorkOrders.scheduledDate, new Date(startDate as string)));
    if (endDate) conditions.push(lte(serviceWorkOrders.scheduledDate, new Date(endDate as string)));

    const result = await db.select().from(serviceWorkOrders)
      .where(and(...conditions))
      .orderBy(desc(serviceWorkOrders.createdAt));
    
    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(wo => 
        wo.workOrderNumber.toLowerCase().includes(searchLower) ||
        wo.description?.toLowerCase().includes(searchLower) ||
        wo.boatName?.toLowerCase().includes(searchLower)
      );
    }
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ message: 'Error fetching work orders' });
  }
});

router.get('/work-orders/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const workOrders = await db.select().from(serviceWorkOrders)
      .where(eq(serviceWorkOrders.orgId, user.orgId));

    const stats = {
      total: workOrders.length,
      pending: workOrders.filter(wo => wo.status === 'pending').length,
      inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
      completed: workOrders.filter(wo => wo.status === 'completed').length,
      onHold: workOrders.filter(wo => wo.status === 'on_hold').length,
      totalRevenue: workOrders.reduce((sum, wo) => sum + Number(wo.totalAmount || 0), 0),
      avgLaborHours: workOrders.length > 0 
        ? workOrders.reduce((sum, wo) => sum + Number(wo.actualHours || 0), 0) / workOrders.length 
        : 0,
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work order stats' });
  }
});

router.get('/work-orders/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [workOrder] = await db.select().from(serviceWorkOrders)
      .where(and(eq(serviceWorkOrders.id, req.params.id), eq(serviceWorkOrders.orgId, user.orgId)));
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });

    const laborEntries = await db.select().from(serviceLaborEntries)
      .where(eq(serviceLaborEntries.workOrderId, req.params.id));
    const partsUsed = await db.select().from(servicePartsUsed)
      .where(eq(servicePartsUsed.workOrderId, req.params.id));

    res.json({ ...workOrder, laborEntries, partsUsed });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work order' });
  }
});

router.post('/work-orders', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(serviceWorkOrders)
      .where(eq(serviceWorkOrders.orgId, user.orgId));
    const workOrderNumber = `WO-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertServiceWorkOrderSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      workOrderNumber,
      createdBy: user.id 
    });
    const [workOrder] = await db.insert(serviceWorkOrders).values(data).returning();
    res.json(workOrder);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(400).json({ message: 'Error creating work order' });
  }
});

router.patch('/work-orders/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const updateData: any = { ...req.body, updatedAt: new Date() };
    if (req.body.status === 'in_progress' && !req.body.startedAt) {
      updateData.startedAt = new Date();
    }
    if (req.body.status === 'completed' && !req.body.completedAt) {
      updateData.completedAt = new Date();
    }

    const [workOrder] = await db.update(serviceWorkOrders)
      .set(updateData)
      .where(and(eq(serviceWorkOrders.id, req.params.id), eq(serviceWorkOrders.orgId, user.orgId)))
      .returning();
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });
    res.json(workOrder);
  } catch (error) {
    res.status(400).json({ message: 'Error updating work order' });
  }
});

router.delete('/work-orders/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(serviceWorkOrders)
      .where(and(eq(serviceWorkOrders.id, req.params.id), eq(serviceWorkOrders.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting work order' });
  }
});

// ===== LABOR ENTRIES =====

router.get('/work-orders/:workOrderId/labor', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select().from(serviceLaborEntries)
      .where(and(
        eq(serviceLaborEntries.workOrderId, req.params.workOrderId),
        eq(serviceLaborEntries.orgId, user.orgId)
      ))
      .orderBy(desc(serviceLaborEntries.workDate));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching labor entries' });
  }
});

router.post('/work-orders/:workOrderId/labor', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const totalAmount = Number(req.body.hours) * Number(req.body.hourlyRate);
    const data = insertServiceLaborEntrySchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      workOrderId: req.params.workOrderId,
      totalAmount: String(totalAmount)
    });
    const [entry] = await db.insert(serviceLaborEntries).values(data).returning();

    await updateWorkOrderTotals(req.params.workOrderId);
    res.json(entry);
  } catch (error) {
    console.error('Error creating labor entry:', error);
    res.status(400).json({ message: 'Error creating labor entry' });
  }
});

router.delete('/labor/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [entry] = await db.select().from(serviceLaborEntries)
      .where(and(eq(serviceLaborEntries.id, req.params.id), eq(serviceLaborEntries.orgId, user.orgId)));
    if (!entry) return res.status(404).json({ message: 'Labor entry not found' });

    await db.delete(serviceLaborEntries).where(eq(serviceLaborEntries.id, req.params.id));
    await updateWorkOrderTotals(entry.workOrderId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting labor entry' });
  }
});

// ===== PARTS USED =====

router.get('/work-orders/:workOrderId/parts', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select().from(servicePartsUsed)
      .where(and(
        eq(servicePartsUsed.workOrderId, req.params.workOrderId),
        eq(servicePartsUsed.orgId, user.orgId)
      ));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parts used' });
  }
});

router.post('/work-orders/:workOrderId/parts', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const totalAmount = Number(req.body.quantity) * Number(req.body.unitPrice);
    const data = insertServicePartsUsedSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      workOrderId: req.params.workOrderId,
      totalAmount: String(totalAmount)
    });
    const [entry] = await db.insert(servicePartsUsed).values(data).returning();

    await db.update(serviceParts)
      .set({ quantityOnHand: sql`${serviceParts.quantityOnHand} - ${req.body.quantity}` })
      .where(eq(serviceParts.id, req.body.partId));

    await updateWorkOrderTotals(req.params.workOrderId);
    res.json(entry);
  } catch (error) {
    console.error('Error adding part to work order:', error);
    res.status(400).json({ message: 'Error adding part to work order' });
  }
});

router.delete('/parts-used/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [entry] = await db.select().from(servicePartsUsed)
      .where(and(eq(servicePartsUsed.id, req.params.id), eq(servicePartsUsed.orgId, user.orgId)));
    if (!entry) return res.status(404).json({ message: 'Part entry not found' });

    await db.update(serviceParts)
      .set({ quantityOnHand: sql`${serviceParts.quantityOnHand} + ${entry.quantity}` })
      .where(eq(serviceParts.id, entry.partId));

    await db.delete(servicePartsUsed).where(eq(servicePartsUsed.id, req.params.id));
    await updateWorkOrderTotals(entry.workOrderId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error removing part from work order' });
  }
});

// ===== HELPER FUNCTIONS =====

async function updateWorkOrderTotals(workOrderId: string) {
  const laborEntries = await db.select().from(serviceLaborEntries)
    .where(eq(serviceLaborEntries.workOrderId, workOrderId));
  const partsUsed = await db.select().from(servicePartsUsed)
    .where(eq(servicePartsUsed.workOrderId, workOrderId));

  const laborTotal = laborEntries.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  const partsTotal = partsUsed.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
  const actualHours = laborEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  await db.update(serviceWorkOrders)
    .set({
      laborTotal: String(laborTotal),
      partsTotal: String(partsTotal),
      totalAmount: String(laborTotal + partsTotal),
      actualHours: String(actualHours),
      updatedAt: new Date()
    })
    .where(eq(serviceWorkOrders.id, workOrderId));
}

// ===== ANALYTICS =====

router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    const conditions = [eq(serviceWorkOrders.orgId, user.orgId)];
    if (startDate) conditions.push(gte(serviceWorkOrders.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(serviceWorkOrders.createdAt, new Date(endDate as string)));

    const workOrders = await db.select().from(serviceWorkOrders).where(and(...conditions));

    const summary = {
      totalWorkOrders: workOrders.length,
      completedWorkOrders: workOrders.filter(wo => wo.status === 'completed').length,
      pendingWorkOrders: workOrders.filter(wo => wo.status === 'pending').length,
      inProgressWorkOrders: workOrders.filter(wo => wo.status === 'in_progress').length,
      totalRevenue: workOrders.reduce((sum, wo) => sum + Number(wo.totalAmount || 0), 0),
      laborRevenue: workOrders.reduce((sum, wo) => sum + Number(wo.laborTotal || 0), 0),
      partsRevenue: workOrders.reduce((sum, wo) => sum + Number(wo.partsTotal || 0), 0),
      avgJobValue: workOrders.length > 0 
        ? workOrders.reduce((sum, wo) => sum + Number(wo.totalAmount || 0), 0) / workOrders.length 
        : 0,
      totalLaborHours: workOrders.reduce((sum, wo) => sum + Number(wo.actualHours || 0), 0),
      jobsByType: Object.entries(
        workOrders.reduce((acc, wo) => {
          acc[wo.jobType] = (acc[wo.jobType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, count]) => ({ type, count })),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching service analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

export default router;

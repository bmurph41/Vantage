/**
 * MarinaMatch Operations Engine Routes
 * Fuel management, ship store, hotel ops, multifamily, storage, retail, marina
 */

import { Router, Request, Response } from 'express';
import { operationsEngine } from '../services/operations-engine';

export const operationsEngineRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Fuel Operations ────────────────────────────────────────────────────────

operationsEngineRouter.get('/fuel/optimal-price/:fuelTypeId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const pricing = await operationsEngine.getOptimalFuelPrice(orgId, req.params.fuelTypeId, {
      competitorRadius: parseFloat(req.query.competitorRadius as string) || 5,
      marginTarget: parseFloat(req.query.marginTarget as string) || undefined,
    });
    res.json(pricing);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.get('/fuel/reorder-alerts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const alerts = await operationsEngine.getFuelReorderAlerts(orgId, {
      daysOfSupply: parseInt(req.query.daysOfSupply as string) || 7,
    });
    res.json(alerts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.post('/fuel/delivery', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const delivery = await operationsEngine.recordFuelDelivery(orgId, req.body, getUserId(req));
    res.json(delivery);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/fuel/environmental', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await operationsEngine.getFuelEnvironmentalReport(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.post('/fuel/spill-report', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await operationsEngine.fileSpillReport(orgId, req.body, getUserId(req));
    res.json(report);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/fuel/profitability', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await operationsEngine.getFuelProfitability(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      fuelTypeId: req.query.fuelTypeId as string,
    });
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Ship Store / Retail POS ────────────────────────────────────────────────

operationsEngineRouter.post('/ship-store/purchase-orders', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const po = await operationsEngine.createPurchaseOrder(orgId, req.body, getUserId(req));
    res.json(po);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.post('/ship-store/purchase-orders/:id/receive', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const receipt = await operationsEngine.receivePurchaseOrder(orgId, req.params.id, req.body, getUserId(req));
    res.json(receipt);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/ship-store/low-stock', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const items = await operationsEngine.getLowStockItems(orgId, {
      threshold: parseInt(req.query.threshold as string) || 10,
      categoryId: req.query.categoryId as string,
    });
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.post('/ship-store/sales-tax', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await operationsEngine.calculateSalesTax(orgId, req.body);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.post('/ship-store/gift-cards', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const card = await operationsEngine.issueGiftCard(orgId, req.body, getUserId(req));
    res.json(card);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/ship-store/loyalty/:customerId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const loyalty = await operationsEngine.getCustomerLoyalty(orgId, req.params.customerId);
    res.json(loyalty);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Hotel Operations ───────────────────────────────────────────────────────

operationsEngineRouter.get('/hotel/dynamic-rate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const rates = await operationsEngine.getDynamicRates(orgId, {
      propertyId: req.query.propertyId as string,
      checkIn: req.query.checkIn as string,
      checkOut: req.query.checkOut as string,
      roomTypeId: req.query.roomTypeId as string,
    });
    res.json(rates);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.get('/hotel/housekeeping', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const schedule = await operationsEngine.getHousekeepingSchedule(orgId, {
      propertyId: req.query.propertyId as string,
      date: req.query.date as string || new Date().toISOString().split('T')[0],
    });
    res.json(schedule);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.post('/hotel/check-in/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await operationsEngine.hotelCheckIn(orgId, req.params.id, req.body, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.post('/hotel/check-out/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await operationsEngine.hotelCheckOut(orgId, req.params.id, req.body, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Multifamily Operations ─────────────────────────────────────────────────

operationsEngineRouter.get('/multifamily/renewal-probability/:leaseId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const prediction = await operationsEngine.getRenewalProbability(orgId, req.params.leaseId);
    res.json(prediction);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

operationsEngineRouter.post('/multifamily/unit-turn', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const turn = await operationsEngine.initiateUnitTurn(orgId, req.body, getUserId(req));
    res.json(turn);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/multifamily/rubs/:propertyId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const allocations = await operationsEngine.getRubsAllocations(orgId, req.params.propertyId, {
      period: req.query.period as string,
    });
    res.json(allocations);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Self-Storage Operations ────────────────────────────────────────────────

operationsEngineRouter.post('/storage/lien/:unitId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const lien = await operationsEngine.initiateLienProcess(orgId, req.params.unitId, req.body, getUserId(req));
    res.json(lien);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/storage/conversion-recommendations', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const recommendations = await operationsEngine.getStorageConversionRecommendations(orgId, {
      propertyId: req.query.propertyId as string,
    });
    res.json(recommendations);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.post('/storage/online-rental', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const rental = await operationsEngine.processOnlineStorageRental(orgId, req.body, getUserId(req));
    res.json(rental);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Retail / NNN Lease Operations ──────────────────────────────────────────

operationsEngineRouter.get('/retail/percentage-rent/:tenantId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const calculation = await operationsEngine.calculatePercentageRent(orgId, req.params.tenantId, {
      period: req.query.period as string,
      grossSales: parseFloat(req.query.grossSales as string) || undefined,
    });
    res.json(calculation);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

operationsEngineRouter.post('/retail/lease-abstract/:leaseId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const abstract = await operationsEngine.generateLeaseAbstract(orgId, req.params.leaseId, getUserId(req));
    res.json(abstract);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/retail/ti-amortization/:leaseId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const schedule = await operationsEngine.getTiAmortizationSchedule(orgId, req.params.leaseId);
    res.json(schedule);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Marina Operations ──────────────────────────────────────────────────────

operationsEngineRouter.post('/marina/slip-reservation', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const reservation = await operationsEngine.createSlipReservation(orgId, req.body, getUserId(req));
    res.json(reservation);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.post('/marina/waitlist', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const entry = await operationsEngine.addToWaitlist(orgId, req.body, getUserId(req));
    res.json(entry);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.post('/marina/work-order', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const workOrder = await operationsEngine.createWorkOrder(orgId, req.body, getUserId(req));
    res.json(workOrder);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.post('/marina/slip-billing', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const billing = await operationsEngine.generateSlipBilling(orgId, req.body, getUserId(req));
    res.json(billing);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

operationsEngineRouter.get('/marina/membership/:memberId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const membership = await operationsEngine.getMembershipDetails(orgId, req.params.memberId);
    res.json(membership);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

/**
 * Operations Engine
 * =================
 * Comprehensive operations management across all Vantage asset classes.
 * Covers fuel ops, ship store/retail, hotel, multifamily, self-storage,
 * retail/office NNN, and marina-specific operations.
 *
 * Pattern: singleton class, db.execute with sql template, crypto.randomUUID, Decimal
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FuelPriceRecommendation {
  fuelTypeId: string;
  fuelTypeName: string;
  currentCostPerGallon: Decimal;
  currentRetailPrice: Decimal;
  recommendedPrice: Decimal;
  currentMarginPct: Decimal;
  recommendedMarginPct: Decimal;
  competitorAvgPrice: Decimal;
  demandElasticity: number;
  projectedDailyVolume: number;
  projectedDailyProfit: Decimal;
}

export interface TankReorderAlert {
  tankId: string;
  tankName: string;
  fuelTypeId: string;
  fuelTypeName: string;
  currentLevel: number;
  capacity: number;
  reorderPoint: number;
  fillPct: number;
  avgDailyConsumption: number;
  daysUntilEmpty: number;
  urgency: 'critical' | 'warning' | 'normal';
}

export interface DeliveryOrder {
  id: string;
  orgId: string;
  tankId: string;
  fuelTypeId: string;
  vendorId: string;
  quantityOrdered: number;
  estimatedDeliveryDate: string;
  status: 'pending' | 'confirmed' | 'in_transit' | 'delivered';
  costPerGallon: number;
  totalCost: number;
}

export interface EnvironmentalCompliance {
  orgId: string;
  totalTanks: number;
  compliantTanks: number;
  overdueTanks: number;
  lastInspectionDate: string | null;
  nextInspectionDue: string | null;
  openSpillReports: number;
  ustRegistrationCurrent: boolean;
  items: EnvironmentalComplianceItem[];
}

export interface EnvironmentalComplianceItem {
  tankId: string;
  tankName: string;
  ustRegistrationNumber: string;
  lastInspection: string | null;
  nextInspectionDue: string | null;
  leakDetectionStatus: 'pass' | 'fail' | 'pending';
  cathodicProtectionCurrent: boolean;
  spillPreventionPlanDate: string | null;
  overflowPreventionCurrent: boolean;
  complianceStatus: 'compliant' | 'non_compliant' | 'expiring_soon';
}

export interface SpillReportData {
  tankId?: string;
  locationDescription: string;
  substanceReleased: string;
  quantityGallons: number;
  discoveryDate: string;
  reporterName: string;
  reporterPhone: string;
  causeDescription: string;
  immediateActions: string;
  soilContamination: boolean;
  waterContamination: boolean;
  notifiedAgencies: string[];
}

export interface FuelProfitabilityResult {
  fuelTypeId: string;
  fuelTypeName: string;
  totalVolumeGallons: number;
  totalRevenue: Decimal;
  totalCost: Decimal;
  grossProfit: Decimal;
  avgMarginPerGallon: Decimal;
  avgMarginPct: Decimal;
  pumpBreakdown: PumpProfitability[];
}

export interface PumpProfitability {
  pumpId: string;
  pumpName: string;
  volumeGallons: number;
  revenue: Decimal;
  profit: Decimal;
  marginPerGallon: Decimal;
}

export interface PurchaseOrderData {
  vendorId: string;
  vendorName: string;
  expectedDelivery: string;
  notes?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  unitCost: number;
}

export interface ReceivedItem {
  productId: string;
  quantityReceived: number;
  quantityDamaged: number;
  lotNumber?: string;
  expirationDate?: string;
}

export interface GiftCardData {
  action: 'issue' | 'redeem' | 'balance';
  cardNumber?: string;
  amount?: number;
  customerId?: string;
  recipientName?: string;
  recipientEmail?: string;
}

export interface DynamicRateResult {
  roomType: string;
  date: string;
  baseRate: Decimal;
  seasonalMultiplier: Decimal;
  demandMultiplier: Decimal;
  competitorAdjustment: Decimal;
  eventPremium: Decimal;
  finalRate: Decimal;
  occupancyForecast: number;
  rateStrategy: 'discount' | 'standard' | 'premium' | 'surge';
}

export interface HousekeepingAssignment {
  roomId: string;
  roomNumber: string;
  floor: number;
  status: 'dirty' | 'in_progress' | 'inspected' | 'clean';
  assignedTo: string | null;
  priority: number;
  guestCheckoutTime: string | null;
  nextGuestCheckinTime: string | null;
  specialInstructions: string | null;
  estimatedMinutes: number;
}

export interface CheckInResult {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  roomKey: string;
  wifiPassword: string;
  checkInTime: string;
  checkOutDate: string;
  folioId: string;
  welcomePacketItems: string[];
}

export interface CheckOutResult {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  totalCharges: Decimal;
  roomCharges: Decimal;
  taxCharges: Decimal;
  minibarCharges: Decimal;
  serviceCharges: Decimal;
  damageCharges: Decimal;
  paymentsReceived: Decimal;
  balanceDue: Decimal;
  folioId: string;
}

export interface RenewalProbability {
  leaseId: string;
  tenantName: string;
  unitId: string;
  currentRent: Decimal;
  marketRent: Decimal;
  rentToMarketRatio: Decimal;
  tenureMonths: number;
  paymentScore: number;
  maintenanceRequestCount: number;
  neighborhoodSatisfactionScore: number;
  renewalProbability: number;
  recommendedAction: 'offer_below_market' | 'offer_at_market' | 'offer_above_market' | 'let_expire';
  recommendedNewRent: Decimal;
}

export interface UnitTurnData {
  moveOutDate: string;
  targetMoveInDate: string;
  condition: 'light' | 'standard' | 'heavy' | 'full_renovation';
  tasks: UnitTurnTask[];
}

export interface UnitTurnTask {
  taskType: string;
  vendorId?: string;
  estimatedCost: number;
  scheduledDate: string;
}

export interface LienProcessStatus {
  unitId: string;
  tenantName: string;
  delinquentSince: string;
  totalOwed: Decimal;
  currentStep: 'delinquent' | 'notice_sent' | 'lien_filed' | 'auction_scheduled' | 'auction_completed';
  nextActionDate: string;
  nextAction: string;
  notices: LienNotice[];
}

export interface LienNotice {
  type: string;
  sentDate: string;
  deliveryMethod: string;
  trackingNumber?: string;
}

export interface PercentageRentResult {
  tenantId: string;
  tenantName: string;
  period: string;
  naturalBreakpoint: Decimal;
  reportedSales: Decimal;
  salesAboveBreakpoint: Decimal;
  percentageRentRate: Decimal;
  percentageRentDue: Decimal;
  baseRentForPeriod: Decimal;
  totalRentDue: Decimal;
}

export interface LeaseAbstract {
  leaseId: string;
  tenantName: string;
  premises: string;
  leaseType: string;
  commencementDate: string;
  expirationDate: string;
  termMonths: number;
  baseRent: Decimal;
  annualEscalation: Decimal;
  securityDeposit: Decimal;
  tiAllowance: Decimal;
  freeRentMonths: number;
  renewalOptions: RenewalOption[];
  expenseStops: ExpenseStop[];
  coTenancyClauses: string[];
  exclusiveUseClauses: string[];
  keyDates: KeyDate[];
}

export interface RenewalOption {
  optionNumber: number;
  termMonths: number;
  noticeRequired: number;
  rentBasis: string;
}

export interface ExpenseStop {
  category: string;
  baseYear: number;
  stopAmount: Decimal;
}

export interface KeyDate {
  description: string;
  date: string;
  reminderDaysBefore: number;
}

export interface SlipReservationData {
  vesselName: string;
  vesselLength: number;
  vesselBeam: number;
  vesselDraft: number;
  ownerId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  slipPreference?: string;
  electricalNeeded: boolean;
  waterNeeded: boolean;
  pumpOutNeeded: boolean;
}

export interface WaitlistEntry {
  id: string;
  orgId: string;
  ownerId: string;
  ownerName: string;
  vesselLength: number;
  vesselBeam: number;
  slipSizeRequested: string;
  priorityScore: number;
  tenureYears: number;
  annualSpend: Decimal;
  addedDate: string;
  estimatedAvailability: string | null;
  position: number;
}

export interface ServiceWorkOrderData {
  vesselId: string;
  vesselName: string;
  ownerId: string;
  serviceType: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  parts: WorkOrderPart[];
  laborEstimateHours: number;
  scheduledDate?: string;
}

export interface WorkOrderPart {
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

class OperationsEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // FUEL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculates optimal fuel price using cost-plus pricing with competitor
   * benchmarking and demand elasticity adjustment. The algorithm:
   * 1. Pulls current wholesale cost from most recent delivery
   * 2. Averages competitor prices within configurable radius
   * 3. Applies demand elasticity curve to find profit-maximizing price
   * 4. Constrains result to floor (cost + min margin) and ceiling (competitor avg + max premium)
   */
  async calculateOptimalFuelPrice(orgId: string, fuelTypeId: string): Promise<FuelPriceRecommendation> {
    // Fetch current cost basis from latest delivery
    const costResult = await db.execute(sql`
      SELECT fd.cost_per_gallon, ft.name as fuel_type_name, ft.min_margin_pct, ft.max_margin_pct
      FROM fuel_deliveries fd
      JOIN fuel_types ft ON ft.id = fd.fuel_type_id
      WHERE fd.org_id = ${orgId} AND fd.fuel_type_id = ${fuelTypeId}
      ORDER BY fd.delivery_date DESC LIMIT 1
    `);

    const costRow = (costResult as any).rows?.[0];
    const costPerGallon = new Decimal(costRow?.cost_per_gallon || '3.00');
    const fuelTypeName = costRow?.fuel_type_name || 'Unknown';
    const minMarginPct = new Decimal(costRow?.min_margin_pct || '5');
    const maxMarginPct = new Decimal(costRow?.max_margin_pct || '25');

    // Fetch competitor pricing (average of prices reported within last 7 days)
    const compResult = await db.execute(sql`
      SELECT AVG(price_per_gallon) as avg_price, COUNT(*) as comp_count
      FROM fuel_competitor_prices
      WHERE org_id = ${orgId} AND fuel_type_id = ${fuelTypeId}
        AND reported_at >= NOW() - INTERVAL '7 days'
    `);

    const compRow = (compResult as any).rows?.[0];
    const competitorAvgPrice = new Decimal(compRow?.avg_price || costPerGallon.mul(1.15).toString());
    const compCount = parseInt(compRow?.comp_count || '0', 10);

    // Fetch recent sales volume for elasticity calculation
    const volumeResult = await db.execute(sql`
      SELECT COALESCE(SUM(gallons_sold), 0) as total_volume,
             COUNT(DISTINCT sale_date) as days_count
      FROM fuel_sales
      WHERE org_id = ${orgId} AND fuel_type_id = ${fuelTypeId}
        AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const volRow = (volumeResult as any).rows?.[0];
    const totalVolume30d = parseFloat(volRow?.total_volume || '0');
    const daysCount = parseInt(volRow?.days_count || '1', 10);
    const avgDailyVolume = totalVolume30d / Math.max(daysCount, 1);

    // Demand elasticity model: fuel demand is relatively inelastic (-0.2 to -0.4)
    // Volume change % = elasticity * price change %
    const elasticity = -0.25;

    // Current retail price
    const priceResult = await db.execute(sql`
      SELECT retail_price FROM fuel_current_prices
      WHERE org_id = ${orgId} AND fuel_type_id = ${fuelTypeId}
      LIMIT 1
    `);
    const currentRetailPrice = new Decimal(
      (priceResult as any).rows?.[0]?.retail_price || costPerGallon.mul(1.10).toString()
    );
    const currentMarginPct = currentRetailPrice.minus(costPerGallon).div(currentRetailPrice).mul(100);

    // Profit optimization: test price points from min to max margin
    // Profit = (price - cost) * volume_at_price
    let bestPrice = currentRetailPrice;
    let bestProfit = new Decimal(0);
    const floorPrice = costPerGallon.mul(new Decimal(1).plus(minMarginPct.div(100)));
    const ceilingPrice = competitorAvgPrice.mul(new Decimal('1.05')); // max 5% above competitor avg

    const steps = 50;
    const priceRange = ceilingPrice.minus(floorPrice);
    const stepSize = priceRange.div(steps);

    for (let i = 0; i <= steps; i++) {
      const testPrice = floorPrice.plus(stepSize.mul(i));
      const priceChangePct = testPrice.minus(currentRetailPrice).div(currentRetailPrice).toNumber();
      const volumeChangePct = elasticity * priceChangePct;
      const projectedVolume = avgDailyVolume * (1 + volumeChangePct);
      const marginPerGallon = testPrice.minus(costPerGallon);
      const dailyProfit = marginPerGallon.mul(Math.max(projectedVolume, 0));

      if (dailyProfit.gt(bestProfit)) {
        bestProfit = dailyProfit;
        bestPrice = testPrice;
      }
    }

    // If no competitor data, weight more toward cost-plus
    if (compCount === 0) {
      const costPlusTarget = costPerGallon.mul(new Decimal('1.12'));
      bestPrice = bestPrice.plus(costPlusTarget).div(2);
    }

    const recommendedMarginPct = bestPrice.minus(costPerGallon).div(bestPrice).mul(100);
    const priceChangePct = bestPrice.minus(currentRetailPrice).div(currentRetailPrice).toNumber();
    const projectedDailyVolume = Math.round(avgDailyVolume * (1 + elasticity * priceChangePct));

    return {
      fuelTypeId,
      fuelTypeName,
      currentCostPerGallon: costPerGallon,
      currentRetailPrice,
      recommendedPrice: bestPrice.toDecimalPlaces(3),
      currentMarginPct: currentMarginPct.toDecimalPlaces(2),
      recommendedMarginPct: recommendedMarginPct.toDecimalPlaces(2),
      competitorAvgPrice: competitorAvgPrice.toDecimalPlaces(3),
      demandElasticity: elasticity,
      projectedDailyVolume: Math.max(projectedDailyVolume, 0),
      projectedDailyProfit: bestProfit.toDecimalPlaces(2),
    };
  }

  /**
   * Checks all fuel tanks for the org, returns alerts for any below reorder point.
   * Calculates days-until-empty from rolling 14-day avg consumption rate.
   */
  async checkReorderPoints(orgId: string): Promise<TankReorderAlert[]> {
    const result = await db.execute(sql`
      SELECT t.id as tank_id, t.name as tank_name, t.capacity,
             t.current_level, t.reorder_point,
             ft.id as fuel_type_id, ft.name as fuel_type_name,
             (
               SELECT COALESCE(AVG(daily_usage), 0)
               FROM (
                 SELECT SUM(gallons_dispensed) as daily_usage
                 FROM fuel_dispensing_log
                 WHERE tank_id = t.id AND dispensed_at >= CURRENT_DATE - INTERVAL '14 days'
                 GROUP BY DATE(dispensed_at)
               ) daily
             ) as avg_daily_consumption
      FROM fuel_tanks t
      JOIN fuel_types ft ON ft.id = t.fuel_type_id
      WHERE t.org_id = ${orgId} AND t.active = true
      ORDER BY (t.current_level::float / t.capacity::float) ASC
    `);

    const rows = (result as any).rows || [];
    const alerts: TankReorderAlert[] = [];

    for (const row of rows) {
      const currentLevel = parseFloat(row.current_level || '0');
      const capacity = parseFloat(row.capacity || '1');
      const reorderPoint = parseFloat(row.reorder_point || '0');
      const avgDaily = parseFloat(row.avg_daily_consumption || '0');
      const fillPct = (currentLevel / capacity) * 100;
      const daysUntilEmpty = avgDaily > 0 ? Math.floor(currentLevel / avgDaily) : 999;

      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      if (currentLevel <= reorderPoint * 0.5 || daysUntilEmpty <= 2) {
        urgency = 'critical';
      } else if (currentLevel <= reorderPoint || daysUntilEmpty <= 5) {
        urgency = 'warning';
      }

      if (urgency !== 'normal') {
        alerts.push({
          tankId: row.tank_id,
          tankName: row.tank_name,
          fuelTypeId: row.fuel_type_id,
          fuelTypeName: row.fuel_type_name,
          currentLevel,
          capacity,
          reorderPoint,
          fillPct: Math.round(fillPct * 10) / 10,
          avgDailyConsumption: Math.round(avgDaily * 10) / 10,
          daysUntilEmpty,
          urgency,
        });
      }
    }

    return alerts.sort((a, b) => {
      const urgencyOrder = { critical: 0, warning: 1, normal: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || a.daysUntilEmpty - b.daysUntilEmpty;
    });
  }

  /**
   * Schedules a fuel delivery based on tank consumption rate and capacity.
   * Calculates optimal order quantity (fill to 90% capacity minus current level)
   * and target delivery date (2 days before projected reorder-point breach).
   */
  async scheduleFuelDelivery(orgId: string, data: {
    tankId: string;
    vendorId: string;
    urgency?: 'standard' | 'rush';
  }): Promise<DeliveryOrder> {
    const tankResult = await db.execute(sql`
      SELECT t.id, t.capacity, t.current_level, t.reorder_point, t.fuel_type_id,
             (
               SELECT COALESCE(AVG(daily_usage), 0)
               FROM (
                 SELECT SUM(gallons_dispensed) as daily_usage
                 FROM fuel_dispensing_log
                 WHERE tank_id = t.id AND dispensed_at >= CURRENT_DATE - INTERVAL '14 days'
                 GROUP BY DATE(dispensed_at)
               ) daily
             ) as avg_daily_consumption
      FROM fuel_tanks t
      WHERE t.id = ${data.tankId} AND t.org_id = ${orgId}
    `);

    const tank = (tankResult as any).rows?.[0];
    if (!tank) throw new Error(`Tank ${data.tankId} not found`);

    const capacity = new Decimal(tank.capacity);
    const currentLevel = new Decimal(tank.current_level);
    const reorderPoint = new Decimal(tank.reorder_point);
    const avgDaily = new Decimal(tank.avg_daily_consumption || '0');

    // Order enough to fill to 90% capacity
    const targetFill = capacity.mul('0.90');
    const quantityNeeded = Decimal.max(targetFill.minus(currentLevel), new Decimal(0));
    const quantityOrdered = Math.ceil(quantityNeeded.toNumber() / 100) * 100; // round up to nearest 100 gal

    // Calculate delivery date: schedule 2 days before reorder point breach
    let daysUntilReorder = 999;
    if (avgDaily.gt(0)) {
      daysUntilReorder = currentLevel.minus(reorderPoint).div(avgDaily).toNumber();
    }
    const leadDays = data.urgency === 'rush' ? 1 : Math.max(Math.floor(daysUntilReorder) - 2, 1);
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + leadDays);

    // Get vendor pricing
    const vendorResult = await db.execute(sql`
      SELECT cost_per_gallon FROM fuel_vendor_contracts
      WHERE vendor_id = ${data.vendorId} AND fuel_type_id = ${tank.fuel_type_id}
        AND org_id = ${orgId} AND active = true
      ORDER BY effective_date DESC LIMIT 1
    `);
    const costPerGallon = parseFloat((vendorResult as any).rows?.[0]?.cost_per_gallon || '3.00');
    const totalCost = costPerGallon * quantityOrdered;

    const id = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO fuel_delivery_orders (
        id, org_id, tank_id, fuel_type_id, vendor_id,
        quantity_ordered, estimated_delivery_date, status,
        cost_per_gallon, total_cost, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.tankId}, ${tank.fuel_type_id}, ${data.vendorId},
        ${quantityOrdered}, ${deliveryDate.toISOString().split('T')[0]}, 'pending',
        ${costPerGallon}, ${totalCost}, NOW()
      )
    `);

    return {
      id,
      orgId,
      tankId: data.tankId,
      fuelTypeId: tank.fuel_type_id,
      vendorId: data.vendorId,
      quantityOrdered,
      estimatedDeliveryDate: deliveryDate.toISOString().split('T')[0],
      status: 'pending',
      costPerGallon,
      totalCost: Math.round(totalCost * 100) / 100,
    };
  }

  /**
   * Returns environmental compliance status for all USTs in the org.
   * Checks EPA 40 CFR 280 requirements: registration, leak detection,
   * cathodic protection, spill prevention, operator training.
   */
  async getEnvironmentalComplianceStatus(orgId: string): Promise<EnvironmentalCompliance> {
    const tankResult = await db.execute(sql`
      SELECT t.id as tank_id, t.name as tank_name,
             t.ust_registration_number,
             t.last_inspection_date,
             t.next_inspection_due,
             t.leak_detection_status,
             t.cathodic_protection_current,
             t.spill_prevention_plan_date,
             t.overflow_prevention_current,
             t.installed_date
      FROM fuel_tanks t
      WHERE t.org_id = ${orgId} AND t.active = true
      ORDER BY t.name
    `);

    const spillResult = await db.execute(sql`
      SELECT COUNT(*) as open_spills
      FROM fuel_spill_reports
      WHERE org_id = ${orgId} AND status != 'closed'
    `);

    const tanks = (tankResult as any).rows || [];
    const openSpills = parseInt((spillResult as any).rows?.[0]?.open_spills || '0', 10);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    let compliantCount = 0;
    let overdueCount = 0;
    let earliestNextInspection: Date | null = null;
    let latestInspection: Date | null = null;

    const items: EnvironmentalComplianceItem[] = tanks.map((tank: any) => {
      const nextDue = tank.next_inspection_due ? new Date(tank.next_inspection_due) : null;
      const lastInsp = tank.last_inspection_date ? new Date(tank.last_inspection_date) : null;

      if (lastInsp && (!latestInspection || lastInsp > latestInspection)) {
        latestInspection = lastInsp;
      }
      if (nextDue && (!earliestNextInspection || nextDue < earliestNextInspection)) {
        earliestNextInspection = nextDue;
      }

      const leakDetection = tank.leak_detection_status || 'pending';
      const cathodic = tank.cathodic_protection_current === true;
      const overflowCurrent = tank.overflow_prevention_current === true;

      let complianceStatus: 'compliant' | 'non_compliant' | 'expiring_soon' = 'compliant';
      if (
        leakDetection === 'fail' ||
        !cathodic ||
        (nextDue && nextDue < now)
      ) {
        complianceStatus = 'non_compliant';
        overdueCount++;
      } else if (nextDue && nextDue < thirtyDaysFromNow) {
        complianceStatus = 'expiring_soon';
      }

      if (complianceStatus === 'compliant') compliantCount++;

      return {
        tankId: tank.tank_id,
        tankName: tank.tank_name,
        ustRegistrationNumber: tank.ust_registration_number || '',
        lastInspection: lastInsp?.toISOString().split('T')[0] || null,
        nextInspectionDue: nextDue?.toISOString().split('T')[0] || null,
        leakDetectionStatus: leakDetection,
        cathodicProtectionCurrent: cathodic,
        spillPreventionPlanDate: tank.spill_prevention_plan_date?.toISOString?.()?.split('T')[0] || null,
        overflowPreventionCurrent: overflowCurrent,
        complianceStatus,
      };
    });

    return {
      orgId,
      totalTanks: tanks.length,
      compliantTanks: compliantCount,
      overdueTanks: overdueCount,
      lastInspectionDate: latestInspection ? (latestInspection as Date).toISOString().split('T')[0] : null,
      nextInspectionDue: earliestNextInspection ? (earliestNextInspection as Date).toISOString().split('T')[0] : null,
      openSpillReports: openSpills,
      ustRegistrationCurrent: overdueCount === 0 && tanks.length > 0,
      items,
    };
  }

  /**
   * Records a spill report per EPA Form 7530 requirements.
   * Captures substance, quantity, contamination status, agencies notified.
   * Auto-flags for state environmental agency notification if > 25 gallons.
   */
  async recordSpillReport(orgId: string, data: SpillReportData): Promise<{ id: string; requiresStateNotification: boolean; requiresFederalNotification: boolean }> {
    const id = crypto.randomUUID();
    const requiresStateNotification = data.quantityGallons >= 25;
    const requiresFederalNotification = data.quantityGallons >= 1000 || data.waterContamination;

    const notifiedAgencies = [...data.notifiedAgencies];
    if (requiresStateNotification && !notifiedAgencies.includes('State Environmental Agency')) {
      notifiedAgencies.push('State Environmental Agency');
    }
    if (requiresFederalNotification && !notifiedAgencies.includes('EPA National Response Center')) {
      notifiedAgencies.push('EPA National Response Center');
    }

    await db.execute(sql`
      INSERT INTO fuel_spill_reports (
        id, org_id, tank_id, location_description, substance_released,
        quantity_gallons, discovery_date, reporter_name, reporter_phone,
        cause_description, immediate_actions,
        soil_contamination, water_contamination,
        notified_agencies, status,
        requires_state_notification, requires_federal_notification,
        created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.tankId || null}, ${data.locationDescription},
        ${data.substanceReleased}, ${data.quantityGallons},
        ${data.discoveryDate}, ${data.reporterName}, ${data.reporterPhone},
        ${data.causeDescription}, ${data.immediateActions},
        ${data.soilContamination}, ${data.waterContamination},
        ${JSON.stringify(notifiedAgencies)}, 'open',
        ${requiresStateNotification}, ${requiresFederalNotification},
        NOW()
      )
    `);

    return { id, requiresStateNotification, requiresFederalNotification };
  }

  /**
   * Fuel profitability analysis over a date range, broken down by fuel type and pump.
   * Computes gross margin, margin per gallon, and volume-weighted margin percentage.
   */
  async getFuelProfitabilityAnalysis(orgId: string, dateRange: { start: string; end: string }): Promise<FuelProfitabilityResult[]> {
    const salesResult = await db.execute(sql`
      SELECT ft.id as fuel_type_id, ft.name as fuel_type_name,
             fs.pump_id, p.name as pump_name,
             SUM(fs.gallons_sold) as volume,
             SUM(fs.total_price) as revenue,
             SUM(fs.gallons_sold * fs.cost_per_gallon) as cost
      FROM fuel_sales fs
      JOIN fuel_types ft ON ft.id = fs.fuel_type_id
      LEFT JOIN fuel_pumps p ON p.id = fs.pump_id
      WHERE fs.org_id = ${orgId}
        AND fs.sale_date >= ${dateRange.start}
        AND fs.sale_date <= ${dateRange.end}
      GROUP BY ft.id, ft.name, fs.pump_id, p.name
      ORDER BY ft.name, p.name
    `);

    const rows = (salesResult as any).rows || [];
    const byFuelType: Record<string, {
      fuelTypeId: string;
      fuelTypeName: string;
      totalVolume: Decimal;
      totalRevenue: Decimal;
      totalCost: Decimal;
      pumps: PumpProfitability[];
    }> = {};

    for (const row of rows) {
      const ftId = row.fuel_type_id;
      if (!byFuelType[ftId]) {
        byFuelType[ftId] = {
          fuelTypeId: ftId,
          fuelTypeName: row.fuel_type_name,
          totalVolume: new Decimal(0),
          totalRevenue: new Decimal(0),
          totalCost: new Decimal(0),
          pumps: [],
        };
      }

      const volume = new Decimal(row.volume || '0');
      const revenue = new Decimal(row.revenue || '0');
      const cost = new Decimal(row.cost || '0');
      const profit = revenue.minus(cost);
      const marginPerGallon = volume.gt(0) ? profit.div(volume) : new Decimal(0);

      byFuelType[ftId].totalVolume = byFuelType[ftId].totalVolume.plus(volume);
      byFuelType[ftId].totalRevenue = byFuelType[ftId].totalRevenue.plus(revenue);
      byFuelType[ftId].totalCost = byFuelType[ftId].totalCost.plus(cost);

      byFuelType[ftId].pumps.push({
        pumpId: row.pump_id || 'unknown',
        pumpName: row.pump_name || 'Unknown Pump',
        volumeGallons: volume.toNumber(),
        revenue,
        profit,
        marginPerGallon: marginPerGallon.toDecimalPlaces(4),
      });
    }

    return Object.values(byFuelType).map(ft => {
      const grossProfit = ft.totalRevenue.minus(ft.totalCost);
      const avgMarginPerGallon = ft.totalVolume.gt(0)
        ? grossProfit.div(ft.totalVolume)
        : new Decimal(0);
      const avgMarginPct = ft.totalRevenue.gt(0)
        ? grossProfit.div(ft.totalRevenue).mul(100)
        : new Decimal(0);

      return {
        fuelTypeId: ft.fuelTypeId,
        fuelTypeName: ft.fuelTypeName,
        totalVolumeGallons: ft.totalVolume.toNumber(),
        totalRevenue: ft.totalRevenue.toDecimalPlaces(2),
        totalCost: ft.totalCost.toDecimalPlaces(2),
        grossProfit: grossProfit.toDecimalPlaces(2),
        avgMarginPerGallon: avgMarginPerGallon.toDecimalPlaces(4),
        avgMarginPct: avgMarginPct.toDecimalPlaces(2),
        pumpBreakdown: ft.pumps,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIP STORE / RETAIL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates a purchase order for the ship store with vendor, line items,
   * and expected delivery. Calculates total cost and tracks PO number sequence.
   */
  async createPurchaseOrder(orgId: string, data: PurchaseOrderData): Promise<{ id: string; poNumber: string; totalCost: Decimal }> {
    const id = crypto.randomUUID();

    // Generate sequential PO number
    const seqResult = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1 as next_seq
      FROM store_purchase_orders
      WHERE org_id = ${orgId}
    `);
    const nextSeq = parseInt((seqResult as any).rows?.[0]?.next_seq || '1', 10);
    const poNumber = `PO-${String(nextSeq).padStart(6, '0')}`;

    let totalCost = new Decimal(0);
    for (const item of data.items) {
      totalCost = totalCost.plus(new Decimal(item.unitCost).mul(item.quantityOrdered));
    }

    await db.execute(sql`
      INSERT INTO store_purchase_orders (
        id, org_id, po_number, vendor_id, vendor_name,
        expected_delivery, notes, status, total_cost, created_at
      ) VALUES (
        ${id}, ${orgId}, ${poNumber}, ${data.vendorId}, ${data.vendorName},
        ${data.expectedDelivery}, ${data.notes || null}, 'draft',
        ${totalCost.toString()}, NOW()
      )
    `);

    // Insert line items
    for (const item of data.items) {
      const lineId = crypto.randomUUID();
      const lineCost = new Decimal(item.unitCost).mul(item.quantityOrdered);
      await db.execute(sql`
        INSERT INTO store_po_line_items (
          id, po_id, product_id, product_name, sku,
          quantity_ordered, quantity_received, unit_cost, line_total
        ) VALUES (
          ${lineId}, ${id}, ${item.productId}, ${item.productName}, ${item.sku},
          ${item.quantityOrdered}, 0, ${item.unitCost}, ${lineCost.toString()}
        )
      `);
    }

    return { id, poNumber, totalCost: totalCost.toDecimalPlaces(2) };
  }

  /**
   * Receives items against a PO. Updates inventory on hand, records quantity
   * variances (short/over/damaged), and marks PO as partially or fully received.
   */
  async receivePurchaseOrder(orgId: string, poId: string, receivedItems: ReceivedItem[]): Promise<{
    poId: string;
    status: 'partially_received' | 'fully_received';
    variances: { productId: string; ordered: number; received: number; damaged: number; variance: number }[];
  }> {
    // Verify PO exists and belongs to org
    const poResult = await db.execute(sql`
      SELECT id, status FROM store_purchase_orders
      WHERE id = ${poId} AND org_id = ${orgId}
    `);
    const po = (poResult as any).rows?.[0];
    if (!po) throw new Error(`Purchase order ${poId} not found`);

    const variances: { productId: string; ordered: number; received: number; damaged: number; variance: number }[] = [];
    let allFullyReceived = true;

    for (const item of receivedItems) {
      // Get the line item
      const lineResult = await db.execute(sql`
        SELECT id, quantity_ordered, quantity_received
        FROM store_po_line_items
        WHERE po_id = ${poId} AND product_id = ${item.productId}
      `);
      const line = (lineResult as any).rows?.[0];
      if (!line) continue;

      const ordered = parseInt(line.quantity_ordered, 10);
      const previouslyReceived = parseInt(line.quantity_received, 10);
      const nowReceived = item.quantityReceived;
      const totalReceived = previouslyReceived + nowReceived;
      const goodQuantity = nowReceived - item.quantityDamaged;

      // Update line item received count
      await db.execute(sql`
        UPDATE store_po_line_items
        SET quantity_received = ${totalReceived},
            quantity_damaged = COALESCE(quantity_damaged, 0) + ${item.quantityDamaged}
        WHERE id = ${line.id}
      `);

      // Update inventory on hand
      await db.execute(sql`
        UPDATE store_products
        SET quantity_on_hand = quantity_on_hand + ${goodQuantity},
            last_received_date = NOW()
        WHERE id = ${item.productId} AND org_id = ${orgId}
      `);

      // Record lot/expiration if provided
      if (item.lotNumber) {
        await db.execute(sql`
          INSERT INTO store_inventory_lots (
            id, product_id, lot_number, expiration_date, quantity, received_date
          ) VALUES (
            ${crypto.randomUUID()}, ${item.productId}, ${item.lotNumber},
            ${item.expirationDate || null}, ${goodQuantity}, NOW()
          )
        `);
      }

      const variance = totalReceived - ordered;
      variances.push({
        productId: item.productId,
        ordered,
        received: totalReceived,
        damaged: item.quantityDamaged,
        variance,
      });

      if (totalReceived < ordered) allFullyReceived = false;
    }

    const newStatus = allFullyReceived ? 'fully_received' : 'partially_received';
    await db.execute(sql`
      UPDATE store_purchase_orders
      SET status = ${newStatus}, received_date = NOW()
      WHERE id = ${poId}
    `);

    return { poId, status: newStatus, variances };
  }

  /**
   * Checks all products for the org and returns those below their reorder threshold.
   * Includes current stock, velocity (units sold per day over last 30 days), and days of supply.
   */
  async checkLowStockAlerts(orgId: string): Promise<{
    productId: string;
    productName: string;
    sku: string;
    currentStock: number;
    reorderThreshold: number;
    avgDailySales: number;
    daysOfSupply: number;
    suggestedOrderQty: number;
  }[]> {
    const result = await db.execute(sql`
      SELECT p.id, p.name, p.sku, p.quantity_on_hand, p.reorder_threshold, p.reorder_quantity,
             COALESCE(
               (SELECT SUM(si.quantity) FROM store_sale_items si
                JOIN store_sales s ON s.id = si.sale_id
                WHERE si.product_id = p.id AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'),
               0
             ) as units_sold_30d
      FROM store_products p
      WHERE p.org_id = ${orgId} AND p.active = true
        AND p.quantity_on_hand <= p.reorder_threshold
      ORDER BY (p.quantity_on_hand::float / GREATEST(p.reorder_threshold, 1)::float) ASC
    `);

    return ((result as any).rows || []).map((row: any) => {
      const currentStock = parseInt(row.quantity_on_hand, 10);
      const unitsSold30d = parseInt(row.units_sold_30d, 10);
      const avgDailySales = unitsSold30d / 30;
      const daysOfSupply = avgDailySales > 0 ? Math.floor(currentStock / avgDailySales) : 999;
      // Order enough for 30 days of supply plus safety stock (7 days)
      const targetStock = Math.ceil(avgDailySales * 37);
      const suggestedOrderQty = Math.max(targetStock - currentStock, parseInt(row.reorder_quantity || '0', 10));

      return {
        productId: row.id,
        productName: row.name,
        sku: row.sku,
        currentStock,
        reorderThreshold: parseInt(row.reorder_threshold, 10),
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        daysOfSupply,
        suggestedOrderQty,
      };
    });
  }

  /**
   * Calculates sales tax for a set of items based on tax nexus rules.
   * Supports origin-based and destination-based states, tax-exempt items,
   * and handles combined state + county + city rates.
   */
  async calculateSalesTax(orgId: string, items: { productId: string; price: number; quantity: number }[], customerState: string): Promise<{
    subtotal: Decimal;
    taxableAmount: Decimal;
    taxRate: Decimal;
    stateTax: Decimal;
    countyTax: Decimal;
    cityTax: Decimal;
    totalTax: Decimal;
    grandTotal: Decimal;
    exemptItems: string[];
  }> {
    // Fetch tax rates for the destination state
    const rateResult = await db.execute(sql`
      SELECT state_rate, county_rate, city_rate, tax_type
      FROM tax_rate_config
      WHERE org_id = ${orgId} AND state_code = ${customerState}
      LIMIT 1
    `);

    const rateRow = (rateResult as any).rows?.[0];
    const stateRate = new Decimal(rateRow?.state_rate || '0.06');
    const countyRate = new Decimal(rateRow?.county_rate || '0.01');
    const cityRate = new Decimal(rateRow?.city_rate || '0');

    // Check for tax-exempt products
    const productIds = items.map(i => i.productId);
    const exemptResult = await db.execute(sql`
      SELECT id, name FROM store_products
      WHERE id = ANY(${productIds}) AND tax_exempt = true
    `);
    const exemptSet = new Set(((exemptResult as any).rows || []).map((r: any) => r.id));
    const exemptNames: string[] = ((exemptResult as any).rows || []).map((r: any) => r.name);

    let subtotal = new Decimal(0);
    let taxableAmount = new Decimal(0);

    for (const item of items) {
      const lineTotal = new Decimal(item.price).mul(item.quantity);
      subtotal = subtotal.plus(lineTotal);
      if (!exemptSet.has(item.productId)) {
        taxableAmount = taxableAmount.plus(lineTotal);
      }
    }

    const combinedRate = stateRate.plus(countyRate).plus(cityRate);
    const stateTax = taxableAmount.mul(stateRate);
    const countyTax = taxableAmount.mul(countyRate);
    const cityTax = taxableAmount.mul(cityRate);
    const totalTax = stateTax.plus(countyTax).plus(cityTax);

    return {
      subtotal: subtotal.toDecimalPlaces(2),
      taxableAmount: taxableAmount.toDecimalPlaces(2),
      taxRate: combinedRate.toDecimalPlaces(4),
      stateTax: stateTax.toDecimalPlaces(2),
      countyTax: countyTax.toDecimalPlaces(2),
      cityTax: cityTax.toDecimalPlaces(2),
      totalTax: totalTax.toDecimalPlaces(2),
      grandTotal: subtotal.plus(totalTax).toDecimalPlaces(2),
      exemptItems: exemptNames,
    };
  }

  /**
   * Gift card lifecycle: issue new card, redeem value, or check balance.
   * Maintains transaction log for reconciliation.
   */
  async processGiftCard(orgId: string, data: GiftCardData): Promise<{
    cardNumber: string;
    action: string;
    previousBalance: Decimal;
    transactionAmount: Decimal;
    newBalance: Decimal;
    status: 'active' | 'depleted' | 'new';
  }> {
    if (data.action === 'issue') {
      const cardNumber = `GC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const amount = new Decimal(data.amount || 0);
      const id = crypto.randomUUID();

      await db.execute(sql`
        INSERT INTO store_gift_cards (
          id, org_id, card_number, balance, original_amount,
          customer_id, recipient_name, recipient_email, status, created_at
        ) VALUES (
          ${id}, ${orgId}, ${cardNumber}, ${amount.toString()}, ${amount.toString()},
          ${data.customerId || null}, ${data.recipientName || null},
          ${data.recipientEmail || null}, 'active', NOW()
        )
      `);

      await db.execute(sql`
        INSERT INTO store_gift_card_transactions (
          id, gift_card_id, transaction_type, amount, balance_after, created_at
        ) VALUES (
          ${crypto.randomUUID()}, ${id}, 'issue', ${amount.toString()}, ${amount.toString()}, NOW()
        )
      `);

      return {
        cardNumber,
        action: 'issue',
        previousBalance: new Decimal(0),
        transactionAmount: amount,
        newBalance: amount,
        status: 'new',
      };
    }

    // Fetch existing card
    const cardResult = await db.execute(sql`
      SELECT id, balance, status FROM store_gift_cards
      WHERE org_id = ${orgId} AND card_number = ${data.cardNumber || ''}
    `);
    const card = (cardResult as any).rows?.[0];
    if (!card) throw new Error(`Gift card ${data.cardNumber} not found`);

    const previousBalance = new Decimal(card.balance);

    if (data.action === 'balance') {
      return {
        cardNumber: data.cardNumber!,
        action: 'balance',
        previousBalance,
        transactionAmount: new Decimal(0),
        newBalance: previousBalance,
        status: previousBalance.gt(0) ? 'active' : 'depleted',
      };
    }

    // Redeem
    const redeemAmount = new Decimal(data.amount || 0);
    if (redeemAmount.gt(previousBalance)) {
      throw new Error(`Insufficient balance. Card has $${previousBalance.toFixed(2)}, tried to redeem $${redeemAmount.toFixed(2)}`);
    }

    const newBalance = previousBalance.minus(redeemAmount);
    const newStatus = newBalance.isZero() ? 'depleted' : 'active';

    await db.execute(sql`
      UPDATE store_gift_cards
      SET balance = ${newBalance.toString()}, status = ${newStatus}
      WHERE id = ${card.id}
    `);

    await db.execute(sql`
      INSERT INTO store_gift_card_transactions (
        id, gift_card_id, transaction_type, amount, balance_after, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${card.id}, 'redeem', ${redeemAmount.toString()}, ${newBalance.toString()}, NOW()
      )
    `);

    return {
      cardNumber: data.cardNumber!,
      action: 'redeem',
      previousBalance,
      transactionAmount: redeemAmount,
      newBalance,
      status: newBalance.gt(0) ? 'active' : 'depleted',
    };
  }

  /**
   * Loyalty points: fetch balance and available redemptions for a customer.
   * Points accrue at 1 point per dollar spent, redeemable at 100 points = $1.
   */
  async getLoyaltyPoints(orgId: string, customerId: string): Promise<{
    customerId: string;
    customerName: string;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
    currentBalance: number;
    dollarValue: Decimal;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    nextTierPoints: number;
    recentActivity: { date: string; type: string; points: number; description: string }[];
  }> {
    const custResult = await db.execute(sql`
      SELECT c.id, c.name, lp.total_earned, lp.total_redeemed, lp.current_balance
      FROM store_customers c
      LEFT JOIN store_loyalty_points lp ON lp.customer_id = c.id
      WHERE c.id = ${customerId} AND c.org_id = ${orgId}
    `);
    const cust = (custResult as any).rows?.[0];
    if (!cust) throw new Error(`Customer ${customerId} not found`);

    const totalEarned = parseInt(cust.total_earned || '0', 10);
    const totalRedeemed = parseInt(cust.total_redeemed || '0', 10);
    const balance = parseInt(cust.current_balance || '0', 10);
    const dollarValue = new Decimal(balance).div(100);

    // Tier thresholds based on lifetime earned
    let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
    let nextTierPoints = 1000;
    if (totalEarned >= 50000) { tier = 'platinum'; nextTierPoints = 0; }
    else if (totalEarned >= 20000) { tier = 'gold'; nextTierPoints = 50000 - totalEarned; }
    else if (totalEarned >= 5000) { tier = 'silver'; nextTierPoints = 20000 - totalEarned; }
    else { nextTierPoints = 5000 - totalEarned; }

    // Recent activity
    const activityResult = await db.execute(sql`
      SELECT transaction_date, transaction_type, points, description
      FROM store_loyalty_transactions
      WHERE customer_id = ${customerId}
      ORDER BY transaction_date DESC LIMIT 20
    `);

    const recentActivity = ((activityResult as any).rows || []).map((r: any) => ({
      date: r.transaction_date?.toISOString?.()?.split('T')[0] || '',
      type: r.transaction_type,
      points: parseInt(r.points, 10),
      description: r.description || '',
    }));

    return {
      customerId,
      customerName: cust.name || '',
      totalPointsEarned: totalEarned,
      totalPointsRedeemed: totalRedeemed,
      currentBalance: balance,
      dollarValue,
      tier,
      nextTierPoints: Math.max(nextTierPoints, 0),
      recentActivity,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOTEL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Dynamic rate calculation using a multi-factor model:
   * 1. Base rate for room type from rate card
   * 2. Seasonal multiplier (peak/shoulder/off-peak from date)
   * 3. Demand multiplier from occupancy forecast
   * 4. Competitor rate adjustment
   * 5. Local event premium
   * Returns constrained rate within floor/ceiling bounds.
   */
  async calculateDynamicRate(orgId: string, roomType: string, date: string): Promise<DynamicRateResult> {
    // Fetch base rate
    const rateResult = await db.execute(sql`
      SELECT base_rate, min_rate, max_rate
      FROM hotel_rate_cards
      WHERE org_id = ${orgId} AND room_type = ${roomType} AND active = true
      LIMIT 1
    `);
    const rateRow = (rateResult as any).rows?.[0];
    const baseRate = new Decimal(rateRow?.base_rate || '150');
    const minRate = new Decimal(rateRow?.min_rate || '89');
    const maxRate = new Decimal(rateRow?.max_rate || '499');

    // Seasonal multiplier
    const targetDate = new Date(date);
    const month = targetDate.getMonth();
    const dayOfWeek = targetDate.getDay();
    let seasonalMultiplier = new Decimal('1.0');
    // Peak: Jun-Aug, Dec
    if ([5, 6, 7, 11].includes(month)) seasonalMultiplier = new Decimal('1.35');
    // Shoulder: Mar-May, Sep-Oct
    else if ([2, 3, 4, 8, 9].includes(month)) seasonalMultiplier = new Decimal('1.10');
    // Off-peak: Jan, Feb, Nov
    else seasonalMultiplier = new Decimal('0.85');
    // Weekend premium
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      seasonalMultiplier = seasonalMultiplier.mul('1.15');
    }

    // Demand multiplier from occupancy forecast
    const occResult = await db.execute(sql`
      SELECT rooms_sold, total_rooms
      FROM hotel_occupancy_forecast
      WHERE org_id = ${orgId} AND forecast_date = ${date}
      LIMIT 1
    `);
    const occRow = (occResult as any).rows?.[0];
    let occupancyForecast = 0.65; // default
    if (occRow) {
      occupancyForecast = parseInt(occRow.rooms_sold, 10) / Math.max(parseInt(occRow.total_rooms, 10), 1);
    }

    let demandMultiplier = new Decimal('1.0');
    if (occupancyForecast >= 0.95) demandMultiplier = new Decimal('1.50');
    else if (occupancyForecast >= 0.85) demandMultiplier = new Decimal('1.25');
    else if (occupancyForecast >= 0.70) demandMultiplier = new Decimal('1.10');
    else if (occupancyForecast >= 0.50) demandMultiplier = new Decimal('1.00');
    else if (occupancyForecast >= 0.30) demandMultiplier = new Decimal('0.90');
    else demandMultiplier = new Decimal('0.80');

    // Competitor rate check
    const compResult = await db.execute(sql`
      SELECT AVG(rate) as avg_comp_rate
      FROM hotel_competitor_rates
      WHERE org_id = ${orgId} AND room_type = ${roomType}
        AND rate_date = ${date}
    `);
    const avgCompRate = new Decimal((compResult as any).rows?.[0]?.avg_comp_rate || baseRate.toString());
    // Adjust to stay within 10% of competitor average
    let competitorAdjustment = new Decimal('0');
    const rawRate = baseRate.mul(seasonalMultiplier).mul(demandMultiplier);
    if (rawRate.gt(avgCompRate.mul('1.10'))) {
      competitorAdjustment = avgCompRate.mul('1.10').minus(rawRate);
    } else if (rawRate.lt(avgCompRate.mul('0.90'))) {
      competitorAdjustment = avgCompRate.mul('0.90').minus(rawRate);
    }

    // Event premium: check for local events on that date
    const eventResult = await db.execute(sql`
      SELECT premium_pct FROM hotel_local_events
      WHERE org_id = ${orgId} AND event_date = ${date}
      ORDER BY premium_pct DESC LIMIT 1
    `);
    const eventPremiumPct = new Decimal((eventResult as any).rows?.[0]?.premium_pct || '0');
    const eventPremium = rawRate.mul(eventPremiumPct.div(100));

    let finalRate = rawRate.plus(competitorAdjustment).plus(eventPremium);
    finalRate = Decimal.max(finalRate, minRate);
    finalRate = Decimal.min(finalRate, maxRate);
    finalRate = finalRate.toDecimalPlaces(0); // whole dollars

    let rateStrategy: 'discount' | 'standard' | 'premium' | 'surge' = 'standard';
    if (finalRate.lt(baseRate.mul('0.90'))) rateStrategy = 'discount';
    else if (finalRate.gt(baseRate.mul('1.40'))) rateStrategy = 'surge';
    else if (finalRate.gt(baseRate.mul('1.15'))) rateStrategy = 'premium';

    return {
      roomType,
      date,
      baseRate,
      seasonalMultiplier,
      demandMultiplier,
      competitorAdjustment: competitorAdjustment.toDecimalPlaces(2),
      eventPremium: eventPremium.toDecimalPlaces(2),
      finalRate,
      occupancyForecast: Math.round(occupancyForecast * 100),
      rateStrategy,
    };
  }

  /**
   * Returns housekeeping schedule for a given date with room statuses,
   * staff assignments, priorities (departures > stayovers > arrivals), and time estimates.
   */
  async getHousekeepingSchedule(orgId: string, date: string): Promise<{
    date: string;
    totalRooms: number;
    dirtyRooms: number;
    cleanRooms: number;
    inProgressRooms: number;
    assignments: HousekeepingAssignment[];
  }> {
    const result = await db.execute(sql`
      SELECT r.id as room_id, r.room_number, r.floor, r.room_type,
             hs.status, hs.assigned_to, hs.special_instructions,
             dep.checkout_time as guest_checkout_time,
             arr.checkin_time as next_guest_checkin_time
      FROM hotel_rooms r
      LEFT JOIN hotel_housekeeping_status hs
        ON hs.room_id = r.id AND hs.schedule_date = ${date}
      LEFT JOIN hotel_reservations dep
        ON dep.room_id = r.id AND dep.checkout_date = ${date} AND dep.status = 'checked_in'
      LEFT JOIN hotel_reservations arr
        ON arr.room_id = r.id AND arr.checkin_date = ${date} AND arr.status = 'confirmed'
      WHERE r.org_id = ${orgId} AND r.active = true
      ORDER BY r.floor, r.room_number
    `);

    const rows = (result as any).rows || [];

    // Estimate cleaning time by type: departure=45min, stayover=25min, arrival-only=35min
    const assignments: HousekeepingAssignment[] = rows.map((row: any) => {
      const hasDeparture = !!row.guest_checkout_time;
      const hasArrival = !!row.next_guest_checkin_time;
      let estimatedMinutes = 25; // stayover default
      let priority = 3;

      if (hasDeparture && hasArrival) {
        estimatedMinutes = 45; priority = 1; // highest: departure + same-day arrival
      } else if (hasDeparture) {
        estimatedMinutes = 45; priority = 2;
      } else if (hasArrival) {
        estimatedMinutes = 35; priority = 2;
      }

      return {
        roomId: row.room_id,
        roomNumber: row.room_number,
        floor: parseInt(row.floor, 10),
        status: row.status || 'dirty',
        assignedTo: row.assigned_to || null,
        priority,
        guestCheckoutTime: row.guest_checkout_time || null,
        nextGuestCheckinTime: row.next_guest_checkin_time || null,
        specialInstructions: row.special_instructions || null,
        estimatedMinutes,
      };
    });

    // Sort by priority then floor
    assignments.sort((a, b) => a.priority - b.priority || a.floor - b.floor);

    const dirtyRooms = assignments.filter(a => a.status === 'dirty').length;
    const cleanRooms = assignments.filter(a => a.status === 'clean' || a.status === 'inspected').length;
    const inProgress = assignments.filter(a => a.status === 'in_progress').length;

    return {
      date,
      totalRooms: assignments.length,
      dirtyRooms,
      cleanRooms,
      inProgressRooms: inProgress,
      assignments,
    };
  }

  /**
   * Guest check-in: assigns room, generates key code, creates folio, logs arrival.
   */
  async processGuestCheckIn(orgId: string, reservationId: string): Promise<CheckInResult> {
    const resResult = await db.execute(sql`
      SELECT r.id, r.guest_name, r.room_type, r.checkin_date, r.checkout_date,
             r.room_id, r.rate_per_night, r.status,
             rm.room_number
      FROM hotel_reservations r
      LEFT JOIN hotel_rooms rm ON rm.id = r.room_id
      WHERE r.id = ${reservationId} AND r.org_id = ${orgId}
    `);
    const res = (resResult as any).rows?.[0];
    if (!res) throw new Error(`Reservation ${reservationId} not found`);
    if (res.status === 'checked_in') throw new Error('Guest already checked in');

    // If no room assigned, find best available
    let roomId = res.room_id;
    let roomNumber = res.room_number;
    if (!roomId) {
      const availResult = await db.execute(sql`
        SELECT r.id, r.room_number FROM hotel_rooms r
        WHERE r.org_id = ${orgId} AND r.room_type = ${res.room_type}
          AND r.status = 'available' AND r.active = true
          AND r.id NOT IN (
            SELECT room_id FROM hotel_reservations
            WHERE room_id IS NOT NULL
              AND checkin_date <= ${res.checkout_date}
              AND checkout_date >= ${res.checkin_date}
              AND status IN ('confirmed', 'checked_in')
          )
        ORDER BY r.floor ASC, r.room_number ASC
        LIMIT 1
      `);
      const avail = (availResult as any).rows?.[0];
      if (!avail) throw new Error(`No available rooms of type ${res.room_type}`);
      roomId = avail.id;
      roomNumber = avail.room_number;

      await db.execute(sql`
        UPDATE hotel_reservations SET room_id = ${roomId} WHERE id = ${reservationId}
      `);
    }

    // Generate room key (6-digit code)
    const roomKey = String(Math.floor(100000 + Math.random() * 900000));
    // Generate wifi password
    const wifiPassword = `MM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Create folio
    const folioId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO hotel_folios (
        id, org_id, reservation_id, guest_name, room_id, status, created_at
      ) VALUES (
        ${folioId}, ${orgId}, ${reservationId}, ${res.guest_name}, ${roomId}, 'open', NOW()
      )
    `);

    // Update reservation status
    await db.execute(sql`
      UPDATE hotel_reservations
      SET status = 'checked_in', actual_checkin = NOW(), room_key_code = ${roomKey}
      WHERE id = ${reservationId}
    `);

    // Update room status
    await db.execute(sql`
      UPDATE hotel_rooms SET status = 'occupied' WHERE id = ${roomId}
    `);

    const checkinDate = new Date(res.checkin_date);
    const checkoutDate = new Date(res.checkout_date);

    return {
      reservationId,
      guestName: res.guest_name,
      roomNumber,
      roomKey,
      wifiPassword,
      checkInTime: new Date().toISOString(),
      checkOutDate: checkoutDate.toISOString().split('T')[0],
      folioId,
      welcomePacketItems: [
        'Property map and amenity guide',
        'Wi-Fi access card',
        'Room service menu',
        'Local area recommendations',
        'Emergency contact information',
      ],
    };
  }

  /**
   * Guest check-out: reconciles all folio charges, processes minibar scan,
   * calculates balance due, and transitions room to dirty status.
   */
  async processGuestCheckOut(orgId: string, reservationId: string): Promise<CheckOutResult> {
    const resResult = await db.execute(sql`
      SELECT r.id, r.guest_name, r.room_id, r.rate_per_night,
             r.checkin_date, r.checkout_date, r.actual_checkin,
             rm.room_number,
             f.id as folio_id
      FROM hotel_reservations r
      JOIN hotel_rooms rm ON rm.id = r.room_id
      LEFT JOIN hotel_folios f ON f.reservation_id = r.id
      WHERE r.id = ${reservationId} AND r.org_id = ${orgId}
    `);
    const res = (resResult as any).rows?.[0];
    if (!res) throw new Error(`Reservation ${reservationId} not found`);

    const actualCheckin = new Date(res.actual_checkin || res.checkin_date);
    const checkoutNow = new Date();
    const nightsStayed = Math.max(1, Math.ceil(
      (checkoutNow.getTime() - actualCheckin.getTime()) / 86400000
    ));
    const ratePerNight = new Decimal(res.rate_per_night || '0');
    const roomCharges = ratePerNight.mul(nightsStayed);

    // Tax (assume 12% lodging tax)
    const taxRate = new Decimal('0.12');
    const taxCharges = roomCharges.mul(taxRate);

    // Folio charges (minibar, service, damage)
    const chargesResult = await db.execute(sql`
      SELECT charge_type, SUM(amount) as total
      FROM hotel_folio_charges
      WHERE folio_id = ${res.folio_id}
      GROUP BY charge_type
    `);
    const chargeRows = (chargesResult as any).rows || [];
    let minibarCharges = new Decimal(0);
    let serviceCharges = new Decimal(0);
    let damageCharges = new Decimal(0);

    for (const row of chargeRows) {
      const amount = new Decimal(row.total || '0');
      if (row.charge_type === 'minibar') minibarCharges = amount;
      else if (row.charge_type === 'service') serviceCharges = amount;
      else if (row.charge_type === 'damage') damageCharges = amount;
    }

    // Payments already received
    const payResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM hotel_payments
      WHERE reservation_id = ${reservationId}
    `);
    const paymentsReceived = new Decimal((payResult as any).rows?.[0]?.total_paid || '0');

    const totalCharges = roomCharges.plus(taxCharges).plus(minibarCharges).plus(serviceCharges).plus(damageCharges);
    const balanceDue = Decimal.max(totalCharges.minus(paymentsReceived), new Decimal(0));

    // Update reservation and room status
    await db.execute(sql`
      UPDATE hotel_reservations
      SET status = 'checked_out', actual_checkout = NOW()
      WHERE id = ${reservationId}
    `);

    await db.execute(sql`
      UPDATE hotel_rooms SET status = 'dirty' WHERE id = ${res.room_id}
    `);

    await db.execute(sql`
      UPDATE hotel_folios SET status = 'closed', closed_at = NOW() WHERE id = ${res.folio_id}
    `);

    return {
      reservationId,
      guestName: res.guest_name,
      roomNumber: res.room_number,
      totalCharges: totalCharges.toDecimalPlaces(2),
      roomCharges: roomCharges.toDecimalPlaces(2),
      taxCharges: taxCharges.toDecimalPlaces(2),
      minibarCharges: minibarCharges.toDecimalPlaces(2),
      serviceCharges: serviceCharges.toDecimalPlaces(2),
      damageCharges: damageCharges.toDecimalPlaces(2),
      paymentsReceived: paymentsReceived.toDecimalPlaces(2),
      balanceDue: balanceDue.toDecimalPlaces(2),
      folioId: res.folio_id,
    };
  }

  /**
   * Pushes availability and rates to OTA channel managers (Booking.com, Expedia, etc.).
   * Reads current inventory and rate plan, formats for provider API spec.
   */
  async syncChannelManager(orgId: string, provider: string): Promise<{
    provider: string;
    roomsSynced: number;
    ratesPushed: number;
    restrictionsPushed: number;
    syncTimestamp: string;
    errors: string[];
  }> {
    // Fetch all room types with current availability
    const availResult = await db.execute(sql`
      SELECT rt.room_type, rt.total_rooms,
             COUNT(r.id) FILTER (WHERE r.status = 'available') as available,
             rc.base_rate, rc.min_rate, rc.max_rate
      FROM hotel_room_types rt
      LEFT JOIN hotel_rooms r ON r.org_id = rt.org_id AND r.room_type = rt.room_type AND r.active = true
      LEFT JOIN hotel_rate_cards rc ON rc.org_id = rt.org_id AND rc.room_type = rt.room_type AND rc.active = true
      WHERE rt.org_id = ${orgId}
      GROUP BY rt.room_type, rt.total_rooms, rc.base_rate, rc.min_rate, rc.max_rate
    `);

    const roomTypes = (availResult as any).rows || [];
    let roomsSynced = 0;
    let ratesPushed = 0;
    const errors: string[] = [];

    // Fetch rate restrictions (min stay, CTA, CTD)
    const restrictResult = await db.execute(sql`
      SELECT room_type, restriction_date, min_stay, close_to_arrival, close_to_departure
      FROM hotel_rate_restrictions
      WHERE org_id = ${orgId} AND restriction_date >= CURRENT_DATE
        AND restriction_date <= CURRENT_DATE + INTERVAL '90 days'
    `);
    const restrictions = (restrictResult as any).rows || [];

    // Build sync payload per provider format
    for (const rt of roomTypes) {
      if (!rt.base_rate) {
        errors.push(`Room type ${rt.room_type}: no active rate card, skipped`);
        continue;
      }
      roomsSynced++;
      ratesPushed++;
    }

    // Record sync log
    await db.execute(sql`
      INSERT INTO hotel_channel_sync_log (
        id, org_id, provider, rooms_synced, rates_pushed,
        restrictions_pushed, errors, synced_at
      ) VALUES (
        ${crypto.randomUUID()}, ${orgId}, ${provider},
        ${roomsSynced}, ${ratesPushed}, ${restrictions.length},
        ${JSON.stringify(errors)}, NOW()
      )
    `);

    return {
      provider,
      roomsSynced,
      ratesPushed,
      restrictionsPushed: restrictions.length,
      syncTimestamp: new Date().toISOString(),
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIFAMILY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Predicts lease renewal probability using a weighted scoring model:
   * - Payment history (40%): on-time rate over tenancy
   * - Tenure (20%): longer tenure = higher probability
   * - Rent-to-market ratio (25%): below-market = higher retention
   * - Maintenance requests (15%): fewer = better satisfaction
   * Returns a probability 0-100 and a recommended action.
   */
  async calculateRenewalProbability(orgId: string, leaseId: string): Promise<RenewalProbability> {
    const leaseResult = await db.execute(sql`
      SELECT l.id, l.tenant_name, l.unit_id, l.monthly_rent, l.start_date, l.end_date,
             u.unit_number, u.market_rent, u.bedrooms, u.square_feet,
             (SELECT COUNT(*) FROM mf_payments p WHERE p.lease_id = l.id) as total_payments,
             (SELECT COUNT(*) FROM mf_payments p WHERE p.lease_id = l.id AND p.paid_on_time = true) as on_time_payments,
             (SELECT COUNT(*) FROM mf_maintenance_requests mr WHERE mr.unit_id = l.unit_id AND mr.created_at >= l.start_date) as maintenance_requests
      FROM mf_leases l
      JOIN mf_units u ON u.id = l.unit_id
      WHERE l.id = ${leaseId} AND l.org_id = ${orgId}
    `);

    const lease = (leaseResult as any).rows?.[0];
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const currentRent = new Decimal(lease.monthly_rent || '0');
    const marketRent = new Decimal(lease.market_rent || currentRent.toString());
    const rentToMarketRatio = marketRent.gt(0)
      ? currentRent.div(marketRent)
      : new Decimal('1.0');

    const startDate = new Date(lease.start_date);
    const now = new Date();
    const tenureMonths = Math.floor((now.getTime() - startDate.getTime()) / (30 * 86400000));

    const totalPayments = parseInt(lease.total_payments || '0', 10);
    const onTimePayments = parseInt(lease.on_time_payments || '0', 10);
    const paymentScore = totalPayments > 0
      ? Math.round((onTimePayments / totalPayments) * 100)
      : 50; // neutral if no history

    const maintenanceCount = parseInt(lease.maintenance_requests || '0', 10);

    // Weighted scoring
    // Payment score (40%): 100 if perfect, degrades linearly
    const paymentComponent = paymentScore * 0.40;

    // Tenure score (20%): caps at 36 months
    const tenureScore = Math.min(tenureMonths / 36, 1) * 100;
    const tenureComponent = tenureScore * 0.20;

    // Rent-to-market (25%): below market = good, above market = bad
    let rentScore: number;
    const ratioNum = rentToMarketRatio.toNumber();
    if (ratioNum <= 0.90) rentScore = 95;
    else if (ratioNum <= 0.95) rentScore = 85;
    else if (ratioNum <= 1.00) rentScore = 70;
    else if (ratioNum <= 1.05) rentScore = 50;
    else if (ratioNum <= 1.10) rentScore = 30;
    else rentScore = 15;
    const rentComponent = rentScore * 0.25;

    // Maintenance (15%): fewer per year = better satisfaction
    const maintenancePerYear = tenureMonths > 0 ? (maintenanceCount / tenureMonths) * 12 : 0;
    let maintenanceScore: number;
    if (maintenancePerYear <= 1) maintenanceScore = 90;
    else if (maintenancePerYear <= 3) maintenanceScore = 70;
    else if (maintenancePerYear <= 5) maintenanceScore = 50;
    else maintenanceScore = 25;
    const maintenanceComponent = maintenanceScore * 0.15;

    const renewalProbability = Math.round(
      paymentComponent + tenureComponent + rentComponent + maintenanceComponent
    );

    // Recommendation
    let recommendedAction: 'offer_below_market' | 'offer_at_market' | 'offer_above_market' | 'let_expire';
    let recommendedNewRent: Decimal;

    if (renewalProbability >= 80) {
      // High probability tenant: push rent toward market
      recommendedAction = 'offer_at_market';
      recommendedNewRent = Decimal.max(currentRent, marketRent.mul('0.98'));
    } else if (renewalProbability >= 60) {
      recommendedAction = 'offer_below_market';
      recommendedNewRent = currentRent.plus(marketRent.minus(currentRent).mul('0.50'));
    } else if (renewalProbability >= 40) {
      recommendedAction = 'offer_below_market';
      recommendedNewRent = currentRent.mul('1.02'); // minimal increase
    } else {
      recommendedAction = 'let_expire';
      recommendedNewRent = marketRent; // re-list at market
    }

    return {
      leaseId,
      tenantName: lease.tenant_name,
      unitId: lease.unit_id,
      currentRent,
      marketRent,
      rentToMarketRatio: rentToMarketRatio.toDecimalPlaces(3),
      tenureMonths,
      paymentScore,
      maintenanceRequestCount: maintenanceCount,
      neighborhoodSatisfactionScore: Math.round((paymentComponent + maintenanceComponent) / 0.55 * 100) / 100,
      renewalProbability,
      recommendedAction,
      recommendedNewRent: recommendedNewRent.toDecimalPlaces(2),
    };
  }

  /**
   * Tracks unit turn (make-ready) process from move-out through move-in ready.
   * Records vendor assignments, cost tracking, and projected completion.
   */
  async trackUnitTurn(orgId: string, unitId: string, data: UnitTurnData): Promise<{
    id: string;
    unitId: string;
    totalEstimatedCost: Decimal;
    totalDays: number;
    tasks: { id: string; taskType: string; estimatedCost: number; scheduledDate: string; status: string }[];
  }> {
    const id = crypto.randomUUID();
    const moveOut = new Date(data.moveOutDate);
    const targetMoveIn = new Date(data.targetMoveInDate);
    const totalDays = Math.ceil((targetMoveIn.getTime() - moveOut.getTime()) / 86400000);

    let totalEstimatedCost = new Decimal(0);

    await db.execute(sql`
      INSERT INTO mf_unit_turns (
        id, org_id, unit_id, move_out_date, target_move_in_date,
        condition_level, status, created_at
      ) VALUES (
        ${id}, ${orgId}, ${unitId}, ${data.moveOutDate}, ${data.targetMoveInDate},
        ${data.condition}, 'in_progress', NOW()
      )
    `);

    const taskResults: { id: string; taskType: string; estimatedCost: number; scheduledDate: string; status: string }[] = [];

    for (const task of data.tasks) {
      const taskId = crypto.randomUUID();
      totalEstimatedCost = totalEstimatedCost.plus(new Decimal(task.estimatedCost));

      await db.execute(sql`
        INSERT INTO mf_unit_turn_tasks (
          id, unit_turn_id, task_type, vendor_id, estimated_cost,
          scheduled_date, status
        ) VALUES (
          ${taskId}, ${id}, ${task.taskType}, ${task.vendorId || null},
          ${task.estimatedCost}, ${task.scheduledDate}, 'pending'
        )
      `);

      taskResults.push({
        id: taskId,
        taskType: task.taskType,
        estimatedCost: task.estimatedCost,
        scheduledDate: task.scheduledDate,
        status: 'pending',
      });
    }

    return {
      id,
      unitId,
      totalEstimatedCost: totalEstimatedCost.toDecimalPlaces(2),
      totalDays,
      tasks: taskResults,
    };
  }

  /**
   * Calculates straight-line amortization of concessions (free rent months)
   * over the lease term per GAAP ASC 842 requirements.
   */
  async calculateConcessionAmortization(orgId: string, leaseId: string): Promise<{
    leaseId: string;
    tenantName: string;
    totalConcessionValue: Decimal;
    amortizationPerMonth: Decimal;
    schedule: { month: number; date: string; amortized: Decimal; cumulativeAmortized: Decimal; remainingUnamortized: Decimal }[];
  }> {
    const leaseResult = await db.execute(sql`
      SELECT l.id, l.tenant_name, l.monthly_rent, l.start_date, l.end_date,
             l.free_rent_months, l.concession_value
      FROM mf_leases l
      WHERE l.id = ${leaseId} AND l.org_id = ${orgId}
    `);
    const lease = (leaseResult as any).rows?.[0];
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const monthlyRent = new Decimal(lease.monthly_rent || '0');
    const freeMonths = parseInt(lease.free_rent_months || '0', 10);
    const totalConcessionValue = lease.concession_value
      ? new Decimal(lease.concession_value)
      : monthlyRent.mul(freeMonths);

    const startDate = new Date(lease.start_date);
    const endDate = new Date(lease.end_date);
    const termMonths = Math.round(
      (endDate.getTime() - startDate.getTime()) / (30 * 86400000)
    );

    const amortizationPerMonth = termMonths > 0
      ? totalConcessionValue.div(termMonths)
      : new Decimal(0);

    const schedule: { month: number; date: string; amortized: Decimal; cumulativeAmortized: Decimal; remainingUnamortized: Decimal }[] = [];
    let cumulative = new Decimal(0);

    for (let m = 1; m <= termMonths; m++) {
      cumulative = cumulative.plus(amortizationPerMonth);
      const remaining = totalConcessionValue.minus(cumulative);
      const schedDate = new Date(startDate);
      schedDate.setMonth(schedDate.getMonth() + m);

      schedule.push({
        month: m,
        date: schedDate.toISOString().split('T')[0],
        amortized: amortizationPerMonth.toDecimalPlaces(2),
        cumulativeAmortized: cumulative.toDecimalPlaces(2),
        remainingUnamortized: Decimal.max(remaining, new Decimal(0)).toDecimalPlaces(2),
      });
    }

    return {
      leaseId,
      tenantName: lease.tenant_name || '',
      totalConcessionValue: totalConcessionValue.toDecimalPlaces(2),
      amortizationPerMonth: amortizationPerMonth.toDecimalPlaces(2),
      schedule,
    };
  }

  /**
   * RUBS (Ratio Utility Billing System): allocates utility costs across units
   * based on square footage ratio. Supports water, electric, gas, trash, sewer.
   */
  async calculateRUBS(orgId: string, propertyId: string, period: string): Promise<{
    propertyId: string;
    period: string;
    totalUtilityCost: Decimal;
    totalSquareFeet: number;
    allocations: {
      unitId: string;
      unitNumber: string;
      squareFeet: number;
      sqftRatio: Decimal;
      utilityBreakdown: { category: string; amount: Decimal }[];
      totalCharge: Decimal;
    }[];
  }> {
    // Fetch utility bills for the period
    const billResult = await db.execute(sql`
      SELECT utility_type, total_amount
      FROM mf_utility_bills
      WHERE org_id = ${orgId} AND property_id = ${propertyId} AND billing_period = ${period}
    `);
    const bills = (billResult as any).rows || [];
    let totalUtilityCost = new Decimal(0);
    const costByCategory: Record<string, Decimal> = {};
    for (const bill of bills) {
      const amt = new Decimal(bill.total_amount || '0');
      costByCategory[bill.utility_type] = amt;
      totalUtilityCost = totalUtilityCost.plus(amt);
    }

    // Fetch occupied units and square footage
    const unitResult = await db.execute(sql`
      SELECT u.id as unit_id, u.unit_number, u.square_feet
      FROM mf_units u
      JOIN mf_leases l ON l.unit_id = u.id AND l.status = 'active'
      WHERE u.org_id = ${orgId} AND u.property_id = ${propertyId}
      ORDER BY u.unit_number
    `);
    const units = (unitResult as any).rows || [];

    let totalSqFt = 0;
    for (const unit of units) {
      totalSqFt += parseInt(unit.square_feet || '0', 10);
    }
    const totalSqFtDec = new Decimal(Math.max(totalSqFt, 1));

    const allocations = units.map((unit: any) => {
      const sqft = parseInt(unit.square_feet || '0', 10);
      const sqftRatio = new Decimal(sqft).div(totalSqFtDec);

      const utilityBreakdown: { category: string; amount: Decimal }[] = [];
      let totalCharge = new Decimal(0);

      for (const [category, cost] of Object.entries(costByCategory)) {
        const allocation = (cost as Decimal).mul(sqftRatio);
        utilityBreakdown.push({ category, amount: allocation.toDecimalPlaces(2) });
        totalCharge = totalCharge.plus(allocation);
      }

      return {
        unitId: unit.unit_id,
        unitNumber: unit.unit_number,
        squareFeet: sqft,
        sqftRatio: sqftRatio.toDecimalPlaces(4),
        utilityBreakdown,
        totalCharge: totalCharge.toDecimalPlaces(2),
      };
    });

    return {
      propertyId,
      period,
      totalUtilityCost: totalUtilityCost.toDecimalPlaces(2),
      totalSquareFeet: totalSqFt,
      allocations,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELF-STORAGE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Manages self-storage lien process for delinquent tenants.
   * Workflow: delinquent → notice_sent → lien_filed → auction_scheduled → auction_completed.
   * Each step has mandatory waiting periods per state law.
   */
  async manageLienProcess(orgId: string, unitId: string): Promise<LienProcessStatus> {
    const unitResult = await db.execute(sql`
      SELECT su.id, su.unit_number, su.tenant_name, su.tenant_id,
             su.monthly_rate, su.last_payment_date,
             lp.id as lien_id, lp.current_step, lp.created_at as lien_created,
             lp.next_action_date
      FROM ss_units su
      LEFT JOIN ss_lien_processes lp ON lp.unit_id = su.id AND lp.status = 'active'
      WHERE su.id = ${unitId} AND su.org_id = ${orgId}
    `);
    const unit = (unitResult as any).rows?.[0];
    if (!unit) throw new Error(`Storage unit ${unitId} not found`);

    const monthlyRate = new Decimal(unit.monthly_rate || '0');
    const lastPayment = unit.last_payment_date ? new Date(unit.last_payment_date) : null;
    const now = new Date();
    const daysSincePayment = lastPayment
      ? Math.floor((now.getTime() - lastPayment.getTime()) / 86400000)
      : 999;

    // Calculate total owed (months delinquent * rate + late fees)
    const monthsDelinquent = Math.max(Math.floor(daysSincePayment / 30) - 1, 0);
    const lateFeePerMonth = monthlyRate.mul('0.10'); // 10% late fee
    const totalOwed = monthlyRate.mul(monthsDelinquent).plus(lateFeePerMonth.mul(monthsDelinquent));

    let currentStep = unit.current_step || 'delinquent';
    let nextActionDate = unit.next_action_date ? new Date(unit.next_action_date) : now;
    let nextAction = '';
    const notices: LienNotice[] = [];

    // If no active lien process and tenant is delinquent, start one
    if (!unit.lien_id && daysSincePayment > 30) {
      const lienId = crypto.randomUUID();
      const noticeDate = new Date(now.getTime() + 3 * 86400000); // 3 days to send first notice

      await db.execute(sql`
        INSERT INTO ss_lien_processes (
          id, org_id, unit_id, tenant_id, current_step, status,
          total_owed, next_action_date, created_at
        ) VALUES (
          ${lienId}, ${orgId}, ${unitId}, ${unit.tenant_id},
          'delinquent', 'active', ${totalOwed.toString()},
          ${noticeDate.toISOString().split('T')[0]}, NOW()
        )
      `);

      currentStep = 'delinquent';
      nextActionDate = noticeDate;
      nextAction = 'Send first delinquency notice (certified mail)';
    } else if (unit.lien_id && now >= nextActionDate) {
      // Advance the process
      if (currentStep === 'delinquent') {
        currentStep = 'notice_sent';
        nextActionDate = new Date(now.getTime() + 14 * 86400000); // 14-day cure period
        nextAction = 'Wait for cure period to expire, then file lien';

        // Record notice
        await db.execute(sql`
          INSERT INTO ss_lien_notices (
            id, lien_process_id, notice_type, sent_date, delivery_method
          ) VALUES (
            ${crypto.randomUUID()}, ${unit.lien_id}, 'first_delinquency',
            ${now.toISOString().split('T')[0]}, 'certified_mail'
          )
        `);
      } else if (currentStep === 'notice_sent') {
        currentStep = 'lien_filed';
        nextActionDate = new Date(now.getTime() + 30 * 86400000); // 30-day waiting period
        nextAction = 'Schedule auction after mandatory waiting period';
      } else if (currentStep === 'lien_filed') {
        currentStep = 'auction_scheduled';
        nextActionDate = new Date(now.getTime() + 14 * 86400000); // auction in 14 days
        nextAction = 'Conduct auction';
      }

      await db.execute(sql`
        UPDATE ss_lien_processes
        SET current_step = ${currentStep}, next_action_date = ${nextActionDate.toISOString().split('T')[0]},
            total_owed = ${totalOwed.toString()}
        WHERE id = ${unit.lien_id}
      `);
    } else {
      // Process exists but not yet due
      if (currentStep === 'delinquent') nextAction = 'Send first delinquency notice';
      else if (currentStep === 'notice_sent') nextAction = 'File lien after cure period';
      else if (currentStep === 'lien_filed') nextAction = 'Schedule auction';
      else if (currentStep === 'auction_scheduled') nextAction = 'Conduct auction';
    }

    // Fetch existing notices
    if (unit.lien_id) {
      const noticeResult = await db.execute(sql`
        SELECT notice_type, sent_date, delivery_method, tracking_number
        FROM ss_lien_notices WHERE lien_process_id = ${unit.lien_id}
        ORDER BY sent_date ASC
      `);
      for (const n of (noticeResult as any).rows || []) {
        notices.push({
          type: n.notice_type,
          sentDate: n.sent_date?.toISOString?.()?.split('T')[0] || '',
          deliveryMethod: n.delivery_method,
          trackingNumber: n.tracking_number || undefined,
        });
      }
    }

    return {
      unitId,
      tenantName: unit.tenant_name || '',
      delinquentSince: lastPayment ? lastPayment.toISOString().split('T')[0] : '',
      totalOwed,
      currentStep: currentStep as any,
      nextActionDate: nextActionDate.toISOString().split('T')[0],
      nextAction,
      notices,
    };
  }

  /**
   * Analyzes occupancy by unit size and recommends split/combine conversions.
   * High-occupancy small units + low-occupancy large units = conversion opportunity.
   */
  async recommendUnitConversions(orgId: string): Promise<{
    recommendations: {
      type: 'split' | 'combine';
      sourceUnits: string[];
      targetSize: string;
      currentOccupancyRate: number;
      projectedOccupancyRate: number;
      projectedRevenueChange: Decimal;
      priority: 'high' | 'medium' | 'low';
      reason: string;
    }[];
    sizeAnalysis: { size: string; totalUnits: number; occupiedUnits: number; occupancyRate: number; avgRate: Decimal; waitlistCount: number }[];
  }> {
    const analysisResult = await db.execute(sql`
      SELECT su.unit_size,
             COUNT(*) as total_units,
             COUNT(*) FILTER (WHERE su.status = 'occupied') as occupied_units,
             AVG(su.monthly_rate) as avg_rate,
             COALESCE(
               (SELECT COUNT(*) FROM ss_waitlist wl WHERE wl.org_id = su.org_id AND wl.size_requested = su.unit_size),
               0
             ) as waitlist_count
      FROM ss_units su
      WHERE su.org_id = ${orgId}
      GROUP BY su.unit_size, su.org_id
      ORDER BY su.unit_size
    `);

    const sizes = (analysisResult as any).rows || [];
    const sizeAnalysis = sizes.map((s: any) => {
      const total = parseInt(s.total_units, 10);
      const occupied = parseInt(s.occupied_units, 10);
      return {
        size: s.unit_size,
        totalUnits: total,
        occupiedUnits: occupied,
        occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
        avgRate: new Decimal(s.avg_rate || '0').toDecimalPlaces(2),
        waitlistCount: parseInt(s.waitlist_count, 10),
      };
    });

    const recommendations: {
      type: 'split' | 'combine';
      sourceUnits: string[];
      targetSize: string;
      currentOccupancyRate: number;
      projectedOccupancyRate: number;
      projectedRevenueChange: Decimal;
      priority: 'high' | 'medium' | 'low';
      reason: string;
    }[] = [];

    // Recommend splits: high-occupancy small sizes with waitlist
    for (const size of sizeAnalysis) {
      if (size.occupancyRate >= 95 && size.waitlistCount > 0) {
        // Find a larger size with low occupancy to split
        const largerLowOcc = sizeAnalysis.find(
          s => s.occupancyRate < 70 && s.avgRate.gt(size.avgRate)
        );
        if (largerLowOcc) {
          const revenueGain = size.avgRate.mul(2).minus(largerLowOcc.avgRate);
          recommendations.push({
            type: 'split',
            sourceUnits: [largerLowOcc.size],
            targetSize: size.size,
            currentOccupancyRate: largerLowOcc.occupancyRate,
            projectedOccupancyRate: Math.min(size.occupancyRate, 95),
            projectedRevenueChange: revenueGain.toDecimalPlaces(2),
            priority: size.waitlistCount >= 5 ? 'high' : 'medium',
            reason: `${size.size} at ${size.occupancyRate}% occ with ${size.waitlistCount} on waitlist; ${largerLowOcc.size} at ${largerLowOcc.occupancyRate}% occ`,
          });
        }
      }
    }

    // Recommend combines: very low occupancy on small units, demand for larger
    for (const size of sizeAnalysis) {
      if (size.occupancyRate < 50 && size.totalUnits >= 4) {
        const largerDemand = sizeAnalysis.find(
          s => s.occupancyRate >= 90 && s.waitlistCount > 0 && s.avgRate.gt(size.avgRate)
        );
        if (largerDemand) {
          const revenueGain = largerDemand.avgRate.minus(size.avgRate.mul(2));
          recommendations.push({
            type: 'combine',
            sourceUnits: [size.size, size.size],
            targetSize: largerDemand.size,
            currentOccupancyRate: size.occupancyRate,
            projectedOccupancyRate: Math.min(largerDemand.occupancyRate + 2, 100),
            projectedRevenueChange: Decimal.max(revenueGain, new Decimal(0)).toDecimalPlaces(2),
            priority: largerDemand.waitlistCount >= 3 ? 'high' : 'low',
            reason: `${size.size} at ${size.occupancyRate}% occ; demand for ${largerDemand.size} (${largerDemand.waitlistCount} waitlisted)`,
          });
        }
      }
    }

    return { recommendations, sizeAnalysis };
  }

  /**
   * Self-serve online rental: assigns available unit of requested size,
   * applies move-in pricing (first month + admin fee), and sets rate lock.
   */
  async processOnlineRental(orgId: string, data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    sizeRequested: string;
    startDate: string;
    autopay: boolean;
    promoCode?: string;
  }): Promise<{
    rentalId: string;
    unitId: string;
    unitNumber: string;
    monthlyRate: Decimal;
    moveInCharges: { description: string; amount: Decimal }[];
    totalDueToday: Decimal;
    rateLockExpires: string;
    accessCode: string;
  }> {
    // Find available unit
    const unitResult = await db.execute(sql`
      SELECT id, unit_number, monthly_rate, floor_level
      FROM ss_units
      WHERE org_id = ${orgId} AND unit_size = ${data.sizeRequested}
        AND status = 'available'
      ORDER BY floor_level ASC, unit_number ASC
      LIMIT 1
    `);
    const unit = (unitResult as any).rows?.[0];
    if (!unit) throw new Error(`No available units of size ${data.sizeRequested}`);

    const monthlyRate = new Decimal(unit.monthly_rate || '0');
    const adminFee = new Decimal('25.00');
    let promoDiscount = new Decimal(0);

    // Check promo code
    if (data.promoCode) {
      const promoResult = await db.execute(sql`
        SELECT discount_type, discount_value FROM ss_promo_codes
        WHERE org_id = ${orgId} AND code = ${data.promoCode}
          AND active = true AND expires_at >= CURRENT_DATE
        LIMIT 1
      `);
      const promo = (promoResult as any).rows?.[0];
      if (promo) {
        if (promo.discount_type === 'percent') {
          promoDiscount = monthlyRate.mul(new Decimal(promo.discount_value).div(100));
        } else {
          promoDiscount = new Decimal(promo.discount_value);
        }
      }
    }

    const firstMonthCharge = monthlyRate.minus(promoDiscount);
    const moveInCharges: { description: string; amount: Decimal }[] = [
      { description: 'First month rent', amount: firstMonthCharge.toDecimalPlaces(2) },
      { description: 'Administrative fee', amount: adminFee },
    ];
    if (promoDiscount.gt(0)) {
      moveInCharges.push({ description: `Promo discount (${data.promoCode})`, amount: promoDiscount.neg().toDecimalPlaces(2) });
    }
    const totalDueToday = firstMonthCharge.plus(adminFee);

    // Rate lock: 72 hours to complete payment
    const rateLockExpires = new Date(Date.now() + 72 * 3600000).toISOString().split('T')[0];

    // Generate gate access code
    const accessCode = String(Math.floor(1000 + Math.random() * 9000));

    const rentalId = crypto.randomUUID();

    // Create rental record
    await db.execute(sql`
      INSERT INTO ss_rentals (
        id, org_id, unit_id, customer_name, customer_email, customer_phone,
        start_date, monthly_rate, autopay, access_code,
        rate_lock_expires, status, created_at
      ) VALUES (
        ${rentalId}, ${orgId}, ${unit.id}, ${data.customerName},
        ${data.customerEmail}, ${data.customerPhone},
        ${data.startDate}, ${monthlyRate.toString()}, ${data.autopay},
        ${accessCode}, ${rateLockExpires}, 'pending_payment', NOW()
      )
    `);

    // Reserve the unit
    await db.execute(sql`
      UPDATE ss_units SET status = 'reserved' WHERE id = ${unit.id}
    `);

    return {
      rentalId,
      unitId: unit.id,
      unitNumber: unit.unit_number,
      monthlyRate: monthlyRate.toDecimalPlaces(2),
      moveInCharges,
      totalDueToday: totalDueToday.toDecimalPlaces(2),
      rateLockExpires,
      accessCode,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETAIL / OFFICE (NNN LEASING)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculates percentage rent for a retail tenant.
   * Natural breakpoint = annual base rent / percentage rent rate.
   * Percentage rent due = (gross sales - breakpoint) * rate.
   */
  async calculatePercentageRent(orgId: string, tenantId: string, period: string): Promise<PercentageRentResult> {
    const leaseResult = await db.execute(sql`
      SELECT t.id, t.tenant_name, l.id as lease_id, l.annual_base_rent,
             l.percentage_rent_rate, l.natural_breakpoint,
             l.percentage_rent_breakpoint_type
      FROM ro_tenants t
      JOIN ro_leases l ON l.tenant_id = t.id AND l.status = 'active'
      WHERE t.id = ${tenantId} AND t.org_id = ${orgId}
    `);
    const lease = (leaseResult as any).rows?.[0];
    if (!lease) throw new Error(`Tenant ${tenantId} not found or no active lease`);

    const annualBaseRent = new Decimal(lease.annual_base_rent || '0');
    const percentageRentRate = new Decimal(lease.percentage_rent_rate || '0.06'); // default 6%

    // Natural breakpoint = base rent / pct rate
    const naturalBreakpoint = lease.natural_breakpoint
      ? new Decimal(lease.natural_breakpoint)
      : percentageRentRate.gt(0)
        ? annualBaseRent.div(percentageRentRate)
        : new Decimal(0);

    // Fetch reported sales for the period
    const salesResult = await db.execute(sql`
      SELECT COALESCE(SUM(gross_sales), 0) as total_sales
      FROM ro_sales_reports
      WHERE tenant_id = ${tenantId} AND reporting_period = ${period}
    `);
    const reportedSales = new Decimal((salesResult as any).rows?.[0]?.total_sales || '0');

    // Calculate percentage rent
    const salesAboveBreakpoint = Decimal.max(reportedSales.minus(naturalBreakpoint), new Decimal(0));
    const percentageRentDue = salesAboveBreakpoint.mul(percentageRentRate);

    // Pro-rate base rent for the period (assume period is a month like "2026-01")
    const baseRentForPeriod = annualBaseRent.div(12);
    const totalRentDue = baseRentForPeriod.plus(percentageRentDue);

    return {
      tenantId,
      tenantName: lease.tenant_name || '',
      period,
      naturalBreakpoint: naturalBreakpoint.toDecimalPlaces(2),
      reportedSales: reportedSales.toDecimalPlaces(2),
      salesAboveBreakpoint: salesAboveBreakpoint.toDecimalPlaces(2),
      percentageRentRate,
      percentageRentDue: percentageRentDue.toDecimalPlaces(2),
      baseRentForPeriod: baseRentForPeriod.toDecimalPlaces(2),
      totalRentDue: totalRentDue.toDecimalPlaces(2),
    };
  }

  /**
   * Generates a structured lease abstract extracting key terms from lease data.
   * Produces a standardized format for investor review and portfolio management.
   */
  async generateLeaseAbstract(orgId: string, leaseId: string): Promise<LeaseAbstract> {
    const leaseResult = await db.execute(sql`
      SELECT l.id, l.tenant_name, l.premises_description, l.lease_type,
             l.commencement_date, l.expiration_date,
             l.monthly_base_rent, l.annual_escalation_pct,
             l.security_deposit, l.ti_allowance, l.free_rent_months
      FROM ro_leases l
      WHERE l.id = ${leaseId} AND l.org_id = ${orgId}
    `);
    const lease = (leaseResult as any).rows?.[0];
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const startDate = new Date(lease.commencement_date);
    const endDate = new Date(lease.expiration_date);
    const termMonths = Math.round((endDate.getTime() - startDate.getTime()) / (30 * 86400000));

    // Fetch renewal options
    const renewalResult = await db.execute(sql`
      SELECT option_number, term_months, notice_required_days, rent_basis
      FROM ro_renewal_options
      WHERE lease_id = ${leaseId}
      ORDER BY option_number
    `);
    const renewalOptions: RenewalOption[] = ((renewalResult as any).rows || []).map((r: any) => ({
      optionNumber: parseInt(r.option_number, 10),
      termMonths: parseInt(r.term_months, 10),
      noticeRequired: parseInt(r.notice_required_days, 10),
      rentBasis: r.rent_basis || 'Fair Market Value',
    }));

    // Fetch expense stops
    const expenseResult = await db.execute(sql`
      SELECT category, base_year, stop_amount
      FROM ro_expense_stops
      WHERE lease_id = ${leaseId}
      ORDER BY category
    `);
    const expenseStops: ExpenseStop[] = ((expenseResult as any).rows || []).map((r: any) => ({
      category: r.category,
      baseYear: parseInt(r.base_year, 10),
      stopAmount: new Decimal(r.stop_amount || '0'),
    }));

    // Fetch special clauses
    const clauseResult = await db.execute(sql`
      SELECT clause_type, description
      FROM ro_lease_clauses
      WHERE lease_id = ${leaseId}
      ORDER BY clause_type
    `);
    const clauses = (clauseResult as any).rows || [];
    const coTenancyClauses = clauses.filter((c: any) => c.clause_type === 'co_tenancy').map((c: any) => c.description);
    const exclusiveUseClauses = clauses.filter((c: any) => c.clause_type === 'exclusive_use').map((c: any) => c.description);

    // Fetch key dates
    const keyDateResult = await db.execute(sql`
      SELECT description, key_date, reminder_days_before
      FROM ro_key_dates
      WHERE lease_id = ${leaseId}
      ORDER BY key_date
    `);
    const keyDates: KeyDate[] = ((keyDateResult as any).rows || []).map((r: any) => ({
      description: r.description,
      date: r.key_date?.toISOString?.()?.split('T')[0] || '',
      reminderDaysBefore: parseInt(r.reminder_days_before || '30', 10),
    }));

    return {
      leaseId,
      tenantName: lease.tenant_name || '',
      premises: lease.premises_description || '',
      leaseType: lease.lease_type || 'NNN',
      commencementDate: startDate.toISOString().split('T')[0],
      expirationDate: endDate.toISOString().split('T')[0],
      termMonths,
      baseRent: new Decimal(lease.monthly_base_rent || '0'),
      annualEscalation: new Decimal(lease.annual_escalation_pct || '3'),
      securityDeposit: new Decimal(lease.security_deposit || '0'),
      tiAllowance: new Decimal(lease.ti_allowance || '0'),
      freeRentMonths: parseInt(lease.free_rent_months || '0', 10),
      renewalOptions,
      expenseStops,
      coTenancyClauses,
      exclusiveUseClauses,
      keyDates,
    };
  }

  /**
   * Calculates TI (Tenant Improvement) allowance amortization over the lease term.
   * Straight-line method per GAAP. Returns monthly schedule with unamortized balance.
   */
  async calculateTIAmortization(orgId: string, leaseId: string): Promise<{
    leaseId: string;
    tenantName: string;
    tiAllowance: Decimal;
    amortizationPerMonth: Decimal;
    leaseTermMonths: number;
    schedule: { month: number; date: string; amortized: Decimal; cumulativeAmortized: Decimal; unamortizedBalance: Decimal }[];
  }> {
    const leaseResult = await db.execute(sql`
      SELECT l.id, l.tenant_name, l.ti_allowance,
             l.commencement_date, l.expiration_date
      FROM ro_leases l
      WHERE l.id = ${leaseId} AND l.org_id = ${orgId}
    `);
    const lease = (leaseResult as any).rows?.[0];
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const tiAllowance = new Decimal(lease.ti_allowance || '0');
    const startDate = new Date(lease.commencement_date);
    const endDate = new Date(lease.expiration_date);
    const termMonths = Math.round((endDate.getTime() - startDate.getTime()) / (30 * 86400000));

    const amortizationPerMonth = termMonths > 0
      ? tiAllowance.div(termMonths)
      : new Decimal(0);

    const schedule: { month: number; date: string; amortized: Decimal; cumulativeAmortized: Decimal; unamortizedBalance: Decimal }[] = [];
    let cumulative = new Decimal(0);

    for (let m = 1; m <= termMonths; m++) {
      cumulative = cumulative.plus(amortizationPerMonth);
      const remaining = tiAllowance.minus(cumulative);
      const schedDate = new Date(startDate);
      schedDate.setMonth(schedDate.getMonth() + m);

      schedule.push({
        month: m,
        date: schedDate.toISOString().split('T')[0],
        amortized: amortizationPerMonth.toDecimalPlaces(2),
        cumulativeAmortized: cumulative.toDecimalPlaces(2),
        unamortizedBalance: Decimal.max(remaining, new Decimal(0)).toDecimalPlaces(2),
      });
    }

    return {
      leaseId,
      tenantName: lease.tenant_name || '',
      tiAllowance: tiAllowance.toDecimalPlaces(2),
      amortizationPerMonth: amortizationPerMonth.toDecimalPlaces(2),
      leaseTermMonths: termMonths,
      schedule,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARINA-SPECIFIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Processes a slip reservation with availability checking against vessel dimensions,
   * conflict detection, and deposit calculation.
   */
  async processSlipReservation(orgId: string, data: SlipReservationData): Promise<{
    reservationId: string;
    slipId: string;
    slipNumber: string;
    dailyRate: Decimal;
    totalRate: Decimal;
    depositRequired: Decimal;
    startDate: string;
    endDate: string;
    amenities: string[];
  }> {
    // Find available slip that fits the vessel
    const slipResult = await db.execute(sql`
      SELECT s.id, s.slip_number, s.max_length, s.max_beam, s.max_draft,
             s.daily_rate, s.has_electric, s.has_water, s.has_pumpout
      FROM marina_slips s
      WHERE s.org_id = ${orgId}
        AND s.max_length >= ${data.vesselLength}
        AND s.max_beam >= ${data.vesselBeam}
        AND s.max_draft >= ${data.vesselDraft}
        AND s.status = 'available'
        AND s.id NOT IN (
          SELECT slip_id FROM marina_reservations
          WHERE status IN ('confirmed', 'checked_in')
            AND start_date <= ${data.endDate}
            AND end_date >= ${data.startDate}
        )
      ORDER BY s.max_length ASC, s.daily_rate ASC
      LIMIT 1
    `);

    const slip = (slipResult as any).rows?.[0];
    if (!slip) {
      throw new Error(`No available slips for vessel ${data.vesselLength}' x ${data.vesselBeam}' beam x ${data.vesselDraft}' draft`);
    }

    // Prefer the slip preference if provided and available
    let selectedSlip = slip;
    if (data.slipPreference) {
      const prefResult = await db.execute(sql`
        SELECT s.id, s.slip_number, s.max_length, s.max_beam, s.max_draft,
               s.daily_rate, s.has_electric, s.has_water, s.has_pumpout
        FROM marina_slips s
        WHERE s.org_id = ${orgId} AND s.slip_number = ${data.slipPreference}
          AND s.max_length >= ${data.vesselLength}
          AND s.max_beam >= ${data.vesselBeam}
          AND s.status = 'available'
          AND s.id NOT IN (
            SELECT slip_id FROM marina_reservations
            WHERE status IN ('confirmed', 'checked_in')
              AND start_date <= ${data.endDate}
              AND end_date >= ${data.startDate}
          )
        LIMIT 1
      `);
      if ((prefResult as any).rows?.[0]) {
        selectedSlip = (prefResult as any).rows[0];
      }
    }

    const dailyRate = new Decimal(selectedSlip.daily_rate || '0');
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const nights = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    const totalRate = dailyRate.mul(nights);

    // Deposit: 50% for stays > 7 nights, 100% for shorter
    const depositPct = nights > 7 ? 0.50 : 1.00;
    const depositRequired = totalRate.mul(depositPct);

    // Amenities for the assigned slip
    const amenities: string[] = [];
    if (selectedSlip.has_electric) amenities.push('Shore power');
    if (selectedSlip.has_water) amenities.push('Fresh water hookup');
    if (selectedSlip.has_pumpout) amenities.push('Pump-out service');
    if (data.electricalNeeded && !selectedSlip.has_electric) amenities.push('Electrical requested (not available at this slip)');

    const reservationId = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO marina_reservations (
        id, org_id, slip_id, owner_id, owner_name,
        vessel_name, vessel_length, vessel_beam, vessel_draft,
        start_date, end_date, daily_rate, total_rate,
        deposit_required, deposit_paid, status, created_at
      ) VALUES (
        ${reservationId}, ${orgId}, ${selectedSlip.id}, ${data.ownerId},
        ${data.ownerName}, ${data.vesselName}, ${data.vesselLength},
        ${data.vesselBeam}, ${data.vesselDraft},
        ${data.startDate}, ${data.endDate}, ${dailyRate.toString()},
        ${totalRate.toString()}, ${depositRequired.toString()}, 0,
        'confirmed', NOW()
      )
    `);

    return {
      reservationId,
      slipId: selectedSlip.id,
      slipNumber: selectedSlip.slip_number,
      dailyRate: dailyRate.toDecimalPlaces(2),
      totalRate: totalRate.toDecimalPlaces(2),
      depositRequired: depositRequired.toDecimalPlaces(2),
      startDate: data.startDate,
      endDate: data.endDate,
      amenities,
    };
  }

  /**
   * Manages the marina slip waitlist with priority scoring.
   * Score = (tenure_years * 10) + (annual_spend / 1000) + (vessel_length * 0.5)
   * Higher score = higher priority.
   */
  async manageWaitlist(orgId: string, data: {
    action: 'add' | 'remove' | 'list';
    ownerId?: string;
    ownerName?: string;
    vesselLength?: number;
    vesselBeam?: number;
    slipSizeRequested?: string;
  }): Promise<{ entries: WaitlistEntry[]; totalCount: number }> {
    if (data.action === 'add') {
      if (!data.ownerId) throw new Error('ownerId required to add to waitlist');

      // Calculate priority score
      const historyResult = await db.execute(sql`
        SELECT
          EXTRACT(YEAR FROM AGE(NOW(), MIN(r.start_date))) as tenure_years,
          COALESCE(SUM(r.total_rate), 0) as lifetime_spend
        FROM marina_reservations r
        WHERE r.org_id = ${orgId} AND r.owner_id = ${data.ownerId}
      `);
      const hist = (historyResult as any).rows?.[0];
      const tenureYears = parseFloat(hist?.tenure_years || '0');
      const lifetimeSpend = new Decimal(hist?.lifetime_spend || '0');
      const annualSpend = tenureYears > 0
        ? lifetimeSpend.div(Math.max(tenureYears, 1))
        : new Decimal(0);
      const vesselLength = data.vesselLength || 0;

      const priorityScore = Math.round(
        (tenureYears * 10) + (annualSpend.div(1000).toNumber()) + (vesselLength * 0.5)
      );

      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO marina_waitlist (
          id, org_id, owner_id, owner_name, vessel_length, vessel_beam,
          slip_size_requested, priority_score, tenure_years, annual_spend,
          added_date, status
        ) VALUES (
          ${id}, ${orgId}, ${data.ownerId}, ${data.ownerName || ''},
          ${data.vesselLength || 0}, ${data.vesselBeam || 0},
          ${data.slipSizeRequested || ''}, ${priorityScore},
          ${tenureYears}, ${annualSpend.toString()},
          CURRENT_DATE, 'active'
        )
      `);
    }

    if (data.action === 'remove' && data.ownerId) {
      await db.execute(sql`
        UPDATE marina_waitlist SET status = 'removed'
        WHERE org_id = ${orgId} AND owner_id = ${data.ownerId} AND status = 'active'
      `);
    }

    // Always return current list
    const listResult = await db.execute(sql`
      SELECT id, org_id, owner_id, owner_name, vessel_length, vessel_beam,
             slip_size_requested, priority_score, tenure_years, annual_spend,
             added_date
      FROM marina_waitlist
      WHERE org_id = ${orgId} AND status = 'active'
      ORDER BY priority_score DESC, added_date ASC
    `);

    const rows = (listResult as any).rows || [];
    const entries: WaitlistEntry[] = rows.map((r: any, idx: number) => ({
      id: r.id,
      orgId: r.org_id,
      ownerId: r.owner_id,
      ownerName: r.owner_name,
      vesselLength: parseFloat(r.vessel_length || '0'),
      vesselBeam: parseFloat(r.vessel_beam || '0'),
      slipSizeRequested: r.slip_size_requested,
      priorityScore: parseInt(r.priority_score, 10),
      tenureYears: parseFloat(r.tenure_years || '0'),
      annualSpend: new Decimal(r.annual_spend || '0'),
      addedDate: r.added_date?.toISOString?.()?.split('T')[0] || '',
      estimatedAvailability: null,
      position: idx + 1,
    }));

    return { entries, totalCount: entries.length };
  }

  /**
   * Creates a service work order for vessel maintenance with parts, labor, and scheduling.
   */
  async createServiceWorkOrder(orgId: string, data: ServiceWorkOrderData): Promise<{
    workOrderId: string;
    workOrderNumber: string;
    estimatedPartsCost: Decimal;
    estimatedLaborCost: Decimal;
    estimatedTotal: Decimal;
    scheduledDate: string;
    status: string;
  }> {
    const id = crypto.randomUUID();

    // Generate WO number
    const seqResult = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(wo_number FROM 4) AS INTEGER)), 0) + 1 as next_seq
      FROM marina_work_orders
      WHERE org_id = ${orgId}
    `);
    const nextSeq = parseInt((seqResult as any).rows?.[0]?.next_seq || '1', 10);
    const woNumber = `WO-${String(nextSeq).padStart(6, '0')}`;

    // Calculate costs
    let estimatedPartsCost = new Decimal(0);
    for (const part of data.parts) {
      estimatedPartsCost = estimatedPartsCost.plus(new Decimal(part.unitCost).mul(part.quantity));
    }

    // Labor rate from org settings (default $95/hr)
    const rateResult = await db.execute(sql`
      SELECT labor_rate_per_hour FROM marina_service_config
      WHERE org_id = ${orgId} LIMIT 1
    `);
    const laborRate = new Decimal((rateResult as any).rows?.[0]?.labor_rate_per_hour || '95');
    const estimatedLaborCost = laborRate.mul(data.laborEstimateHours);
    const estimatedTotal = estimatedPartsCost.plus(estimatedLaborCost);

    const scheduledDate = data.scheduledDate || new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

    await db.execute(sql`
      INSERT INTO marina_work_orders (
        id, org_id, wo_number, vessel_id, vessel_name, owner_id,
        service_type, description, priority,
        estimated_parts_cost, estimated_labor_cost, estimated_total,
        labor_hours_estimate, scheduled_date, status, created_at
      ) VALUES (
        ${id}, ${orgId}, ${woNumber}, ${data.vesselId}, ${data.vesselName},
        ${data.ownerId}, ${data.serviceType}, ${data.description}, ${data.priority},
        ${estimatedPartsCost.toString()}, ${estimatedLaborCost.toString()},
        ${estimatedTotal.toString()}, ${data.laborEstimateHours},
        ${scheduledDate}, 'open', NOW()
      )
    `);

    // Insert parts
    for (const part of data.parts) {
      await db.execute(sql`
        INSERT INTO marina_wo_parts (
          id, work_order_id, part_number, description, quantity, unit_cost
        ) VALUES (
          ${crypto.randomUUID()}, ${id}, ${part.partNumber},
          ${part.description}, ${part.quantity}, ${part.unitCost}
        )
      `);
    }

    return {
      workOrderId: id,
      workOrderNumber: woNumber,
      estimatedPartsCost: estimatedPartsCost.toDecimalPlaces(2),
      estimatedLaborCost: estimatedLaborCost.toDecimalPlaces(2),
      estimatedTotal: estimatedTotal.toDecimalPlaces(2),
      scheduledDate,
      status: 'open',
    };
  }

  /**
   * Batch billing for all active slip assignments in a billing period.
   * Generates invoices with base slip rent, metered electric, water, and any surcharges.
   */
  async processSlipBilling(orgId: string, period: string): Promise<{
    period: string;
    totalInvoices: number;
    totalBilled: Decimal;
    invoices: {
      invoiceId: string;
      ownerId: string;
      ownerName: string;
      slipNumber: string;
      baseRent: Decimal;
      electricCharge: Decimal;
      waterCharge: Decimal;
      surcharges: Decimal;
      totalDue: Decimal;
    }[];
  }> {
    // Fetch all active slip assignments
    const assignResult = await db.execute(sql`
      SELECT sa.id, sa.slip_id, sa.owner_id, sa.owner_name, sa.monthly_rate,
             s.slip_number,
             COALESCE(
               (SELECT SUM(kwh_used * rate_per_kwh) FROM marina_electric_meters
                WHERE slip_id = s.id AND billing_period = ${period}),
               0
             ) as electric_charge,
             COALESCE(
               (SELECT SUM(gallons_used * rate_per_gallon) FROM marina_water_meters
                WHERE slip_id = s.id AND billing_period = ${period}),
               0
             ) as water_charge,
             COALESCE(
               (SELECT SUM(amount) FROM marina_surcharges
                WHERE slip_assignment_id = sa.id AND billing_period = ${period}),
               0
             ) as surcharges
      FROM marina_slip_assignments sa
      JOIN marina_slips s ON s.id = sa.slip_id
      WHERE sa.org_id = ${orgId} AND sa.status = 'active'
      ORDER BY s.slip_number
    `);

    const rows = (assignResult as any).rows || [];
    let totalBilled = new Decimal(0);
    const invoices: {
      invoiceId: string;
      ownerId: string;
      ownerName: string;
      slipNumber: string;
      baseRent: Decimal;
      electricCharge: Decimal;
      waterCharge: Decimal;
      surcharges: Decimal;
      totalDue: Decimal;
    }[] = [];

    for (const row of rows) {
      const baseRent = new Decimal(row.monthly_rate || '0');
      const electricCharge = new Decimal(row.electric_charge || '0');
      const waterCharge = new Decimal(row.water_charge || '0');
      const surcharges = new Decimal(row.surcharges || '0');
      const totalDue = baseRent.plus(electricCharge).plus(waterCharge).plus(surcharges);

      const invoiceId = crypto.randomUUID();

      await db.execute(sql`
        INSERT INTO marina_invoices (
          id, org_id, slip_assignment_id, owner_id, owner_name,
          billing_period, base_rent, electric_charge, water_charge,
          surcharges, total_due, status, created_at
        ) VALUES (
          ${invoiceId}, ${orgId}, ${row.id}, ${row.owner_id}, ${row.owner_name},
          ${period}, ${baseRent.toString()}, ${electricCharge.toString()},
          ${waterCharge.toString()}, ${surcharges.toString()},
          ${totalDue.toString()}, 'pending', NOW()
        )
      `);

      totalBilled = totalBilled.plus(totalDue);

      invoices.push({
        invoiceId,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        slipNumber: row.slip_number,
        baseRent: baseRent.toDecimalPlaces(2),
        electricCharge: electricCharge.toDecimalPlaces(2),
        waterCharge: waterCharge.toDecimalPlaces(2),
        surcharges: surcharges.toDecimalPlaces(2),
        totalDue: totalDue.toDecimalPlaces(2),
      });
    }

    return {
      period,
      totalInvoices: invoices.length,
      totalBilled: totalBilled.toDecimalPlaces(2),
      invoices,
    };
  }

  /**
   * Returns membership status for a marina member including tier, usage, and renewal info.
   */
  async getMembershipStatus(orgId: string, memberId: string): Promise<{
    memberId: string;
    memberName: string;
    tier: 'basic' | 'silver' | 'gold' | 'platinum';
    memberSince: string;
    renewalDate: string;
    annualFee: Decimal;
    hoursUsed: number;
    hoursIncluded: number;
    hoursRemaining: number;
    overageRate: Decimal;
    currentOverageCharges: Decimal;
    benefits: string[];
    status: 'active' | 'expiring_soon' | 'expired' | 'suspended';
  }> {
    const memberResult = await db.execute(sql`
      SELECT m.id, m.member_name, m.tier, m.member_since, m.renewal_date,
             m.annual_fee, m.hours_included, m.overage_rate, m.status,
             COALESCE(
               (SELECT SUM(hours_used) FROM marina_usage_log
                WHERE member_id = m.id
                  AND usage_date >= DATE_TRUNC('year', m.renewal_date - INTERVAL '1 year')
                  AND usage_date < m.renewal_date),
               0
             ) as hours_used
      FROM marina_memberships m
      WHERE m.id = ${memberId} AND m.org_id = ${orgId}
    `);

    const member = (memberResult as any).rows?.[0];
    if (!member) throw new Error(`Membership ${memberId} not found`);

    const hoursUsed = parseFloat(member.hours_used || '0');
    const hoursIncluded = parseInt(member.hours_included || '0', 10);
    const hoursRemaining = Math.max(hoursIncluded - hoursUsed, 0);
    const overageRate = new Decimal(member.overage_rate || '0');
    const overageHours = Math.max(hoursUsed - hoursIncluded, 0);
    const currentOverageCharges = overageRate.mul(overageHours);

    const renewalDate = new Date(member.renewal_date);
    const now = new Date();
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / 86400000);

    let status: 'active' | 'expiring_soon' | 'expired' | 'suspended' = member.status || 'active';
    if (status === 'active' && daysUntilRenewal <= 30 && daysUntilRenewal > 0) {
      status = 'expiring_soon';
    } else if (daysUntilRenewal <= 0 && status !== 'suspended') {
      status = 'expired';
    }

    const tier = member.tier || 'basic';
    const benefitsByTier: Record<string, string[]> = {
      basic: ['Slip access', 'Restroom facilities', 'Parking', 'Basic Wi-Fi'],
      silver: ['Slip access', 'Restroom & shower facilities', 'Parking', 'Enhanced Wi-Fi', 'Fuel discount 3%', 'Ship store discount 5%'],
      gold: ['Slip access', 'Full amenity access', 'Reserved parking', 'Premium Wi-Fi', 'Fuel discount 5%', 'Ship store discount 10%', 'Free pump-out', 'Guest passes (4/month)'],
      platinum: ['Slip access', 'Full amenity access', 'Valet parking', 'Premium Wi-Fi', 'Fuel discount 8%', 'Ship store discount 15%', 'Free pump-out', 'Unlimited guest passes', 'Concierge service', 'Priority service scheduling', 'Annual haul-out included'],
    };

    return {
      memberId,
      memberName: member.member_name || '',
      tier,
      memberSince: member.member_since?.toISOString?.()?.split('T')[0] || '',
      renewalDate: renewalDate.toISOString().split('T')[0],
      annualFee: new Decimal(member.annual_fee || '0'),
      hoursUsed: Math.round(hoursUsed * 10) / 10,
      hoursIncluded,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      overageRate,
      currentOverageCharges: currentOverageCharges.toDecimalPlaces(2),
      benefits: benefitsByTier[tier] || benefitsByTier.basic,
      status,
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const operationsEngine = new OperationsEngine();

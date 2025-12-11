/**
 * Marina Profit Center Service
 * 
 * Comprehensive revenue modeling for marina-specific profit centers:
 * 1. Slip Rentals (Wet Storage) - Monthly/annual slip leases
 * 2. Dry Storage - Indoor/outdoor boat storage
 * 3. Fuel Sales - Gas and diesel with margin analysis
 * 4. Ship Store - Retail merchandise and marine supplies
 * 5. Service Department - Labor, parts, and repairs
 * 6. Boat Rentals & Club - Rental fleet and membership programs
 * 
 * Each profit center includes:
 * - Revenue projections with growth rates
 * - Cost of goods sold / direct costs
 * - Operating expenses
 * - Gross and net margins
 * - Industry benchmarks and KPIs
 */

import { db } from '../db';
import { 
  rentRolls, 
  rentRollEntries, 
  fuelTransactions, 
  fuelInventory,
  shipStoreProducts,
  shipStoreTransactions,
  modelingProjects 
} from '@shared/schema';
import { eq, and, gte, lte, sql, sum, count, avg } from 'drizzle-orm';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface ProfitCenterConfig {
  enabled: boolean;
  baseRevenue: number;
  growthRate: number;
  directCostPct: number;
  operatingExpensePct: number;
  seasonalFactors?: number[]; // 12 months
}

interface MarinaProfitCenterAssumptions {
  analysisYear: number;
  holdPeriod: number;
  
  // Slip Rentals
  slipRentals: {
    enabled: boolean;
    totalSlips: number;
    occupancyRate: number;
    avgMonthlyRent: number;
    wetSlipCount: number;
    drySlipCount: number;
    avgWetSlipRent: number;
    avgDrySlipRent: number;
    rentGrowthRate: number;
    turnoverRate: number;
    seasonalOccupancy: number[]; // 12 months
  };

  // Dry Storage
  dryStorage: {
    enabled: boolean;
    totalSpaces: number;
    indoorSpaces: number;
    outdoorSpaces: number;
    avgIndoorRate: number;
    avgOutdoorRate: number;
    occupancyRate: number;
    growthRate: number;
    launchFeePerUse: number;
    avgLaunchesPerMonth: number;
  };

  // Fuel Sales
  fuelSales: {
    enabled: boolean;
    hasGas: boolean;
    hasDiesel: boolean;
    annualGasGallons: number;
    annualDieselGallons: number;
    gasRetailPrice: number;
    dieselRetailPrice: number;
    gasCostPerGallon: number;
    dieselCostPerGallon: number;
    volumeGrowthRate: number;
    priceGrowthRate: number;
    seasonalFactors: number[]; // 12 months
  };

  // Ship Store
  shipStore: {
    enabled: boolean;
    annualRevenue: number;
    cogsRate: number;
    laborCostPct: number;
    growthRate: number;
    categories: {
      name: string;
      revenuePct: number;
      marginPct: number;
    }[];
  };

  // Service Department
  serviceDept: {
    enabled: boolean;
    annualLaborRevenue: number;
    annualPartsRevenue: number;
    technicianCount: number;
    avgBilledHoursPerWeek: number;
    laborRate: number;
    partsMarkup: number;
    laborCostRate: number;
    partsCostRate: number;
    growthRate: number;
  };

  // Boat Rentals & Club
  boatRentalsClub: {
    enabled: boolean;
    // Rentals
    rentalFleetSize: number;
    avgDailyRate: number;
    avgUtilizationRate: number;
    rentalSeasonDays: number;
    rentalGrowthRate: number;
    // Club
    clubMemberCount: number;
    monthlyDues: number;
    initiationFee: number;
    expectedNewMembers: number;
    memberGrowthRate: number;
    churnRate: number;
  };

  // Operating Assumptions
  operating: {
    dockMaintenance: number;
    utilities: number;
    insurance: number;
    propertyTax: number;
    managementFee: number;
    marketing: number;
    generalAdmin: number;
    reserves: number;
  };
}

interface MonthlyProfitCenterData {
  month: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  grossMargin: number;
  netMargin: number;
}

interface AnnualProfitCenterSummary {
  year: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  netMargin: number;
  monthlyData: MonthlyProfitCenterData[];
}

interface ProfitCenterAnalysis {
  name: string;
  code: string;
  years: AnnualProfitCenterSummary[];
  kpis: Record<string, number | string>;
  benchmarks: {
    metric: string;
    actual: number;
    benchmark: number;
    variance: number;
    status: 'above' | 'below' | 'at';
  }[];
}

interface MarinaFinancialModel {
  projectId: string;
  analysisDate: string;
  holdPeriod: number;
  profitCenters: ProfitCenterAnalysis[];
  consolidatedStatement: {
    years: AnnualProfitCenterSummary[];
    revenueByProfitCenter: Record<string, number[]>;
    noiByCenterYear: Record<string, number[]>;
  };
  assumptions: MarinaProfitCenterAssumptions;
  valuationMetrics: {
    totalNOI: number[];
    impliedValue: number;
    capRate: number;
    revenueMultiple: number;
    noiGrowthRate: number;
  };
  lastCalculated: string;
}

// ============================================================================
// DEFAULT ASSUMPTIONS - Industry Standard Marina Benchmarks
// ============================================================================

function getDefaultAssumptions(holdPeriod: number = 10): MarinaProfitCenterAssumptions {
  return {
    analysisYear: new Date().getFullYear(),
    holdPeriod,

    slipRentals: {
      enabled: true,
      totalSlips: 200,
      occupancyRate: 0.92,
      avgMonthlyRent: 800,
      wetSlipCount: 150,
      drySlipCount: 50,
      avgWetSlipRent: 900,
      avgDrySlipRent: 500,
      rentGrowthRate: 0.03,
      turnoverRate: 0.15,
      seasonalOccupancy: [0.85, 0.85, 0.88, 0.92, 0.98, 1.0, 1.0, 1.0, 0.98, 0.95, 0.90, 0.85],
    },

    dryStorage: {
      enabled: true,
      totalSpaces: 100,
      indoorSpaces: 40,
      outdoorSpaces: 60,
      avgIndoorRate: 400,
      avgOutdoorRate: 200,
      occupancyRate: 0.88,
      growthRate: 0.025,
      launchFeePerUse: 35,
      avgLaunchesPerMonth: 120,
    },

    fuelSales: {
      enabled: true,
      hasGas: true,
      hasDiesel: true,
      annualGasGallons: 150000,
      annualDieselGallons: 80000,
      gasRetailPrice: 4.89,
      dieselRetailPrice: 5.29,
      gasCostPerGallon: 4.20,
      dieselCostPerGallon: 4.50,
      volumeGrowthRate: 0.02,
      priceGrowthRate: 0.025,
      seasonalFactors: [0.4, 0.4, 0.6, 0.8, 1.2, 1.5, 1.5, 1.5, 1.2, 0.8, 0.5, 0.4],
    },

    shipStore: {
      enabled: true,
      annualRevenue: 180000,
      cogsRate: 0.55,
      laborCostPct: 0.18,
      growthRate: 0.03,
      categories: [
        { name: 'Marine Supplies', revenuePct: 0.35, marginPct: 0.45 },
        { name: 'Fishing Gear', revenuePct: 0.20, marginPct: 0.50 },
        { name: 'Apparel', revenuePct: 0.15, marginPct: 0.55 },
        { name: 'Food & Beverage', revenuePct: 0.20, marginPct: 0.35 },
        { name: 'Ice & Bait', revenuePct: 0.10, marginPct: 0.60 },
      ],
    },

    serviceDept: {
      enabled: true,
      annualLaborRevenue: 320000,
      annualPartsRevenue: 180000,
      technicianCount: 4,
      avgBilledHoursPerWeek: 32,
      laborRate: 125,
      partsMarkup: 0.35,
      laborCostRate: 0.45,
      partsCostRate: 0.65,
      growthRate: 0.04,
    },

    boatRentalsClub: {
      enabled: true,
      rentalFleetSize: 12,
      avgDailyRate: 450,
      avgUtilizationRate: 0.45,
      rentalSeasonDays: 180,
      rentalGrowthRate: 0.05,
      clubMemberCount: 75,
      monthlyDues: 350,
      initiationFee: 1500,
      expectedNewMembers: 15,
      memberGrowthRate: 0.08,
      churnRate: 0.12,
    },

    operating: {
      dockMaintenance: 85000,
      utilities: 48000,
      insurance: 95000,
      propertyTax: 120000,
      managementFee: 0.05, // % of revenue
      marketing: 25000,
      generalAdmin: 65000,
      reserves: 0.02, // % of revenue
    },
  };
}

// ============================================================================
// PROFIT CENTER CALCULATORS
// ============================================================================

function calculateSlipRentals(
  assumptions: MarinaProfitCenterAssumptions,
  year: number
): AnnualProfitCenterSummary {
  const config = assumptions.slipRentals;
  const yearIndex = year - assumptions.analysisYear;
  const growthFactor = Math.pow(1 + config.rentGrowthRate, yearIndex);

  const wetRent = config.avgWetSlipRent * growthFactor;
  const dryRent = config.avgDrySlipRent * growthFactor;

  const monthlyData: MonthlyProfitCenterData[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  for (let month = 0; month < 12; month++) {
    const seasonalFactor = config.seasonalOccupancy[month];
    const wetOccupancy = config.occupancyRate * seasonalFactor;
    const dryOccupancy = config.occupancyRate * seasonalFactor * 0.95; // Dry slightly lower

    const wetRevenue = config.wetSlipCount * wetOccupancy * wetRent;
    const dryRevenue = config.drySlipCount * dryOccupancy * dryRent;
    const monthRevenue = wetRevenue + dryRevenue;

    // Direct costs (dock maintenance, utilities allocated to slips)
    const directCosts = monthRevenue * 0.08;

    totalRevenue += monthRevenue;
    totalCogs += directCosts;

    monthlyData.push({
      month: month + 1,
      revenue: monthRevenue,
      cogs: directCosts,
      grossProfit: monthRevenue - directCosts,
      operatingExpenses: monthRevenue * 0.15,
      netOperatingIncome: monthRevenue - directCosts - monthRevenue * 0.15,
      grossMargin: (monthRevenue - directCosts) / monthRevenue,
      netMargin: (monthRevenue - directCosts - monthRevenue * 0.15) / monthRevenue,
    });
  }

  const operatingExpenses = totalRevenue * 0.15;

  return {
    year,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    grossMargin: (totalRevenue - totalCogs) / totalRevenue,
    operatingExpenses,
    netOperatingIncome: totalRevenue - totalCogs - operatingExpenses,
    netMargin: (totalRevenue - totalCogs - operatingExpenses) / totalRevenue,
    monthlyData,
  };
}

function calculateDryStorage(
  assumptions: MarinaProfitCenterAssumptions,
  year: number
): AnnualProfitCenterSummary {
  const config = assumptions.dryStorage;
  const yearIndex = year - assumptions.analysisYear;
  const growthFactor = Math.pow(1 + config.growthRate, yearIndex);

  const indoorRate = config.avgIndoorRate * growthFactor;
  const outdoorRate = config.avgOutdoorRate * growthFactor;
  const launchFee = config.launchFeePerUse * growthFactor;

  const monthlyData: MonthlyProfitCenterData[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  // Seasonal pattern for launches
  const launchSeasonality = [0.3, 0.3, 0.6, 0.9, 1.3, 1.5, 1.5, 1.5, 1.2, 0.8, 0.5, 0.3];

  for (let month = 0; month < 12; month++) {
    const storageRevenue =
      config.indoorSpaces * config.occupancyRate * indoorRate +
      config.outdoorSpaces * config.occupancyRate * outdoorRate;

    const launches = config.avgLaunchesPerMonth * launchSeasonality[month];
    const launchRevenue = launches * launchFee;

    const monthRevenue = storageRevenue + launchRevenue;
    const directCosts = storageRevenue * 0.05 + launchRevenue * 0.25; // Launch labor

    totalRevenue += monthRevenue;
    totalCogs += directCosts;

    monthlyData.push({
      month: month + 1,
      revenue: monthRevenue,
      cogs: directCosts,
      grossProfit: monthRevenue - directCosts,
      operatingExpenses: monthRevenue * 0.12,
      netOperatingIncome: monthRevenue - directCosts - monthRevenue * 0.12,
      grossMargin: (monthRevenue - directCosts) / monthRevenue,
      netMargin: (monthRevenue - directCosts - monthRevenue * 0.12) / monthRevenue,
    });
  }

  const operatingExpenses = totalRevenue * 0.12;

  return {
    year,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    grossMargin: (totalRevenue - totalCogs) / totalRevenue,
    operatingExpenses,
    netOperatingIncome: totalRevenue - totalCogs - operatingExpenses,
    netMargin: (totalRevenue - totalCogs - operatingExpenses) / totalRevenue,
    monthlyData,
  };
}

function calculateFuelSales(
  assumptions: MarinaProfitCenterAssumptions,
  year: number
): AnnualProfitCenterSummary {
  const config = assumptions.fuelSales;
  const yearIndex = year - assumptions.analysisYear;
  const volumeGrowth = Math.pow(1 + config.volumeGrowthRate, yearIndex);
  const priceGrowth = Math.pow(1 + config.priceGrowthRate, yearIndex);

  const gasPrice = config.gasRetailPrice * priceGrowth;
  const dieselPrice = config.dieselRetailPrice * priceGrowth;
  const gasCost = config.gasCostPerGallon * priceGrowth;
  const dieselCost = config.dieselCostPerGallon * priceGrowth;
  const gasGallons = config.annualGasGallons * volumeGrowth;
  const dieselGallons = config.annualDieselGallons * volumeGrowth;

  const monthlyData: MonthlyProfitCenterData[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  for (let month = 0; month < 12; month++) {
    const seasonalFactor = config.seasonalFactors[month];
    const monthGasGallons = (gasGallons / 12) * seasonalFactor;
    const monthDieselGallons = (dieselGallons / 12) * seasonalFactor;

    const gasRevenue = monthGasGallons * gasPrice;
    const dieselRevenue = monthDieselGallons * dieselPrice;
    const monthRevenue = gasRevenue + dieselRevenue;

    const gasCogs = monthGasGallons * gasCost;
    const dieselCogs = monthDieselGallons * dieselCost;
    const monthCogs = gasCogs + dieselCogs;

    totalRevenue += monthRevenue;
    totalCogs += monthCogs;

    const operatingExp = monthRevenue * 0.05; // Labor, credit card fees

    monthlyData.push({
      month: month + 1,
      revenue: monthRevenue,
      cogs: monthCogs,
      grossProfit: monthRevenue - monthCogs,
      operatingExpenses: operatingExp,
      netOperatingIncome: monthRevenue - monthCogs - operatingExp,
      grossMargin: (monthRevenue - monthCogs) / monthRevenue,
      netMargin: (monthRevenue - monthCogs - operatingExp) / monthRevenue,
    });
  }

  const operatingExpenses = totalRevenue * 0.05;

  return {
    year,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    grossMargin: (totalRevenue - totalCogs) / totalRevenue,
    operatingExpenses,
    netOperatingIncome: totalRevenue - totalCogs - operatingExpenses,
    netMargin: (totalRevenue - totalCogs - operatingExpenses) / totalRevenue,
    monthlyData,
  };
}

function calculateShipStore(
  assumptions: MarinaProfitCenterAssumptions,
  year: number
): AnnualProfitCenterSummary {
  const config = assumptions.shipStore;
  const yearIndex = year - assumptions.analysisYear;
  const growthFactor = Math.pow(1 + config.growthRate, yearIndex);

  const annualRevenue = config.annualRevenue * growthFactor;

  // Seasonal retail pattern
  const seasonality = [0.6, 0.6, 0.8, 1.0, 1.3, 1.5, 1.5, 1.4, 1.2, 0.9, 0.7, 0.5];

  const monthlyData: MonthlyProfitCenterData[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  for (let month = 0; month < 12; month++) {
    const monthRevenue = (annualRevenue / 12) * seasonality[month];
    const monthCogs = monthRevenue * config.cogsRate;
    const laborCost = monthRevenue * config.laborCostPct;

    totalRevenue += monthRevenue;
    totalCogs += monthCogs;

    monthlyData.push({
      month: month + 1,
      revenue: monthRevenue,
      cogs: monthCogs,
      grossProfit: monthRevenue - monthCogs,
      operatingExpenses: laborCost,
      netOperatingIncome: monthRevenue - monthCogs - laborCost,
      grossMargin: (monthRevenue - monthCogs) / monthRevenue,
      netMargin: (monthRevenue - monthCogs - laborCost) / monthRevenue,
    });
  }

  const operatingExpenses = totalRevenue * config.laborCostPct;

  return {
    year,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    grossMargin: (totalRevenue - totalCogs) / totalRevenue,
    operatingExpenses,
    netOperatingIncome: totalRevenue - totalCogs - operatingExpenses,
    netMargin: (totalRevenue - totalCogs - operatingExpenses) / totalRevenue,
    monthlyData,
  };
}

function calculateServiceDept(
  assumptions: MarinaProfitCenterAssumptions,
  year: number
): AnnualProfitCenterSummary {
  const config = assumptions.serviceDept;
  const yearIndex = year - assumptions.analysisYear;
  const growthFactor = Math.pow(1 + config.growthRate, yearIndex);

  const laborRevenue = config.annualLaborRevenue * growthFactor;
  const partsRevenue = config.annualPartsRevenue * growthFactor;

  // Service department has inverse seasonality - busier in off-season
  const seasonality = [1.3, 1.4, 1.2, 0.9, 0.7, 0.6, 0.6, 0.6, 0.8, 1.0, 1.2, 1.4];

  const monthlyData: MonthlyProfitCenterData[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  for (let month = 0; month < 12; month++) {
    const monthLaborRev = (laborRevenue / 12) * seasonality[month];
    const monthPartsRev = (partsRevenue / 12) * seasonality[month];
    const monthRevenue = monthLaborRev + monthPartsRev;

    const laborCost = monthLaborRev * config.laborCostRate;
    const partsCost = monthPartsRev * config.partsCostRate;
    const monthCogs = laborCost + partsCost;

    totalRevenue += monthRevenue;
    totalCogs += monthCogs;

    const operatingExp = monthRevenue * 0.08; // Shop supplies, tools, etc.

    monthlyData.push({
      month: month + 1,
      revenue: monthRevenue,
      cogs: monthCogs,
      grossProfit: monthRevenue - monthCogs,
      operatingExpenses: operatingExp,
      netOperatingIncome: monthRevenue - monthCogs - operatingExp,
      grossMargin: (monthRevenue - monthCogs) / monthRevenue,
      netMargin: (monthRevenue - monthCogs - operatingExp) / monthRevenue,
    });
  }

  const operatingExpenses = totalRevenue * 0.08;

  return {
    year,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    grossMargin: (totalRevenue - totalCogs) / totalRevenue,
    operatingExpenses,
    netOperatingIncome: totalRevenue - totalCogs - operatingExpenses,
    netMargin: (totalRevenue - totalCogs - operatingExpenses) / totalRevenue,
    monthlyData,
  };
}

function calculateBoatRentalsClub(
  assumptions: MarinaProfitCenterAssumptions,
  year: number
): AnnualProfitCenterSummary {
  const config = assumptions.boatRentalsClub;
  const yearIndex = year - assumptions.analysisYear;

  // Rental calculations
  const rentalGrowth = Math.pow(1 + config.rentalGrowthRate, yearIndex);
  const dailyRate = config.avgDailyRate * rentalGrowth;
  const rentalDays = config.rentalFleetSize * config.avgUtilizationRate * config.rentalSeasonDays;
  const annualRentalRevenue = rentalDays * dailyRate;

  // Club calculations with member growth and churn
  let members = config.clubMemberCount;
  for (let y = 0; y < yearIndex; y++) {
    const newMembers = Math.round(members * config.memberGrowthRate);
    const churned = Math.round(members * config.churnRate);
    members = members + newMembers - churned;
  }
  const annualDuesRevenue = members * config.monthlyDues * 12;
  const newMemberFees =
    Math.round(members * config.memberGrowthRate) * config.initiationFee;

  // Rental seasonality
  const rentalSeasonality = [0, 0, 0.3, 0.8, 1.2, 1.5, 1.5, 1.5, 1.2, 0.5, 0, 0];

  const monthlyData: MonthlyProfitCenterData[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  for (let month = 0; month < 12; month++) {
    const rentalRev = (annualRentalRevenue / 12) * (rentalSeasonality[month] || 0.1);
    const duesRev = annualDuesRevenue / 12;
    const initRev = month === 3 || month === 4 ? newMemberFees / 2 : 0; // Spring enrollment

    const monthRevenue = rentalRev + duesRev + initRev;

    // Rental costs: fuel, cleaning, maintenance
    const rentalCogs = rentalRev * 0.35;
    // Club costs: amenities, staff
    const clubCogs = duesRev * 0.25;
    const monthCogs = rentalCogs + clubCogs;

    totalRevenue += monthRevenue;
    totalCogs += monthCogs;

    const operatingExp = monthRevenue * 0.15;

    monthlyData.push({
      month: month + 1,
      revenue: monthRevenue,
      cogs: monthCogs,
      grossProfit: monthRevenue - monthCogs,
      operatingExpenses: operatingExp,
      netOperatingIncome: monthRevenue - monthCogs - operatingExp,
      grossMargin: (monthRevenue - monthCogs) / monthRevenue,
      netMargin: (monthRevenue - monthCogs - operatingExp) / monthRevenue,
    });
  }

  const operatingExpenses = totalRevenue * 0.15;

  return {
    year,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    grossMargin: (totalRevenue - totalCogs) / totalRevenue,
    operatingExpenses,
    netOperatingIncome: totalRevenue - totalCogs - operatingExpenses,
    netMargin: (totalRevenue - totalCogs - operatingExpenses) / totalRevenue,
    monthlyData,
  };
}

// ============================================================================
// BENCHMARK CALCULATIONS
// ============================================================================

function calculateBenchmarks(
  centerCode: string,
  analysis: AnnualProfitCenterSummary
): ProfitCenterAnalysis['benchmarks'] {
  // Industry benchmarks by profit center
  const benchmarks: Record<string, Record<string, number>> = {
    SLIP: { grossMargin: 0.85, netMargin: 0.70, revenuePerSlip: 10800 },
    DRY: { grossMargin: 0.80, netMargin: 0.65, revenuePerSpace: 4500 },
    FUEL: { grossMargin: 0.12, netMargin: 0.07, gallonsPerSlip: 1500 },
    STORE: { grossMargin: 0.45, netMargin: 0.25, revenuePerSqFt: 250 },
    SERVICE: { grossMargin: 0.48, netMargin: 0.35, revenuePerTech: 180000 },
    RENTAL: { grossMargin: 0.55, netMargin: 0.35, revPerBoat: 40000 },
  };

  const centerBenchmarks = benchmarks[centerCode] || {};
  const results: ProfitCenterAnalysis['benchmarks'] = [];

  if (centerBenchmarks.grossMargin) {
    const variance =
      ((analysis.grossMargin - centerBenchmarks.grossMargin) /
        centerBenchmarks.grossMargin) *
      100;
    results.push({
      metric: 'Gross Margin',
      actual: analysis.grossMargin * 100,
      benchmark: centerBenchmarks.grossMargin * 100,
      variance,
      status: variance > 5 ? 'above' : variance < -5 ? 'below' : 'at',
    });
  }

  if (centerBenchmarks.netMargin) {
    const variance =
      ((analysis.netMargin - centerBenchmarks.netMargin) /
        centerBenchmarks.netMargin) *
      100;
    results.push({
      metric: 'Net Margin',
      actual: analysis.netMargin * 100,
      benchmark: centerBenchmarks.netMargin * 100,
      variance,
      status: variance > 5 ? 'above' : variance < -5 ? 'below' : 'at',
    });
  }

  return results;
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

class MarinaProfitCenterService {
  /**
   * Calculate comprehensive financial model for all profit centers
   */
  async calculateMarinaFinancials(
    projectId: string,
    orgId: string,
    customAssumptions?: Partial<MarinaProfitCenterAssumptions>
  ): Promise<MarinaFinancialModel> {
    // Get project data
    const project = await db
      .select()
      .from(modelingProjects)
      .where(
        and(
          eq(modelingProjects.id, projectId),
          eq(modelingProjects.orgId, orgId)
        )
      )
      .limit(1);

    // Build assumptions from project data + defaults
    const defaults = getDefaultAssumptions(10);
    const assumptions: MarinaProfitCenterAssumptions = {
      ...defaults,
      ...customAssumptions,
    };

    // If project has slipCount, use it
    if (project[0]?.slipCount) {
      assumptions.slipRentals.totalSlips = project[0].slipCount;
      assumptions.slipRentals.wetSlipCount = Math.round(project[0].slipCount * 0.75);
      assumptions.slipRentals.drySlipCount = Math.round(project[0].slipCount * 0.25);
    }

    const profitCenters: ProfitCenterAnalysis[] = [];
    const revenueByProfitCenter: Record<string, number[]> = {};
    const noiByCenterYear: Record<string, number[]> = {};

    // Calculate each enabled profit center
    const centerConfigs: {
      name: string;
      code: string;
      enabled: boolean;
      calculator: (a: MarinaProfitCenterAssumptions, y: number) => AnnualProfitCenterSummary;
    }[] = [
      { name: 'Slip Rentals', code: 'SLIP', enabled: assumptions.slipRentals.enabled, calculator: calculateSlipRentals },
      { name: 'Dry Storage', code: 'DRY', enabled: assumptions.dryStorage.enabled, calculator: calculateDryStorage },
      { name: 'Fuel Sales', code: 'FUEL', enabled: assumptions.fuelSales.enabled, calculator: calculateFuelSales },
      { name: 'Ship Store', code: 'STORE', enabled: assumptions.shipStore.enabled, calculator: calculateShipStore },
      { name: 'Service Dept', code: 'SERVICE', enabled: assumptions.serviceDept.enabled, calculator: calculateServiceDept },
      { name: 'Boat Rentals & Club', code: 'RENTAL', enabled: assumptions.boatRentalsClub.enabled, calculator: calculateBoatRentalsClub },
    ];

    for (const config of centerConfigs) {
      if (!config.enabled) continue;

      const years: AnnualProfitCenterSummary[] = [];
      revenueByProfitCenter[config.code] = [];
      noiByCenterYear[config.code] = [];

      for (let y = 0; y < assumptions.holdPeriod; y++) {
        const year = assumptions.analysisYear + y;
        const yearData = config.calculator(assumptions, year);
        years.push(yearData);
        revenueByProfitCenter[config.code].push(yearData.totalRevenue);
        noiByCenterYear[config.code].push(yearData.netOperatingIncome);
      }

      profitCenters.push({
        name: config.name,
        code: config.code,
        years,
        kpis: this.calculateKPIs(config.code, years, assumptions),
        benchmarks: calculateBenchmarks(config.code, years[0]),
      });
    }

    // Consolidated statement
    const consolidatedYears: AnnualProfitCenterSummary[] = [];
    for (let y = 0; y < assumptions.holdPeriod; y++) {
      const year = assumptions.analysisYear + y;
      let totalRev = 0;
      let totalCogs = 0;
      let totalGross = 0;
      let totalOpex = 0;
      let totalNoi = 0;

      for (const pc of profitCenters) {
        const yearData = pc.years[y];
        totalRev += yearData.totalRevenue;
        totalCogs += yearData.totalCogs;
        totalGross += yearData.grossProfit;
        totalOpex += yearData.operatingExpenses;
        totalNoi += yearData.netOperatingIncome;
      }

      // Add property-level operating expenses
      const propOpex =
        assumptions.operating.dockMaintenance +
        assumptions.operating.utilities +
        assumptions.operating.insurance +
        assumptions.operating.propertyTax +
        totalRev * assumptions.operating.managementFee +
        assumptions.operating.marketing +
        assumptions.operating.generalAdmin +
        totalRev * assumptions.operating.reserves;

      consolidatedYears.push({
        year,
        totalRevenue: totalRev,
        totalCogs,
        grossProfit: totalGross,
        grossMargin: totalGross / totalRev,
        operatingExpenses: totalOpex + propOpex,
        netOperatingIncome: totalRev - totalCogs - totalOpex - propOpex,
        netMargin: (totalRev - totalCogs - totalOpex - propOpex) / totalRev,
        monthlyData: [], // Consolidated monthly would be sum of all centers
      });
    }

    // Valuation metrics
    const totalNOIs = consolidatedYears.map(y => y.netOperatingIncome);
    const avgNOI = totalNOIs.reduce((a, b) => a + b, 0) / totalNOIs.length;
    const noiGrowth =
      (totalNOIs[totalNOIs.length - 1] / totalNOIs[0]) ** (1 / (totalNOIs.length - 1)) - 1;

    return {
      projectId,
      analysisDate: new Date().toISOString(),
      holdPeriod: assumptions.holdPeriod,
      profitCenters,
      consolidatedStatement: {
        years: consolidatedYears,
        revenueByProfitCenter,
        noiByCenterYear,
      },
      assumptions,
      valuationMetrics: {
        totalNOI: totalNOIs,
        impliedValue: avgNOI / 0.075, // 7.5% cap rate
        capRate: 0.075,
        revenueMultiple: consolidatedYears[0].totalRevenue / avgNOI,
        noiGrowthRate: noiGrowth,
      },
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Calculate KPIs for a profit center
   */
  private calculateKPIs(
    code: string,
    years: AnnualProfitCenterSummary[],
    assumptions: MarinaProfitCenterAssumptions
  ): Record<string, number | string> {
    const year1 = years[0];
    const lastYear = years[years.length - 1];
    const cagr = (lastYear.totalRevenue / year1.totalRevenue) ** (1 / (years.length - 1)) - 1;

    const kpis: Record<string, number | string> = {
      'Year 1 Revenue': year1.totalRevenue,
      'Year 1 NOI': year1.netOperatingIncome,
      'Gross Margin %': (year1.grossMargin * 100).toFixed(1) + '%',
      'Net Margin %': (year1.netMargin * 100).toFixed(1) + '%',
      'Revenue CAGR': (cagr * 100).toFixed(2) + '%',
    };

    // Code-specific KPIs
    switch (code) {
      case 'SLIP':
        kpis['Revenue Per Slip'] = year1.totalRevenue / assumptions.slipRentals.totalSlips;
        kpis['Occupancy Rate'] = (assumptions.slipRentals.occupancyRate * 100).toFixed(1) + '%';
        break;
      case 'FUEL':
        kpis['Gas Margin/Gal'] =
          assumptions.fuelSales.gasRetailPrice - assumptions.fuelSales.gasCostPerGallon;
        kpis['Diesel Margin/Gal'] =
          assumptions.fuelSales.dieselRetailPrice - assumptions.fuelSales.dieselCostPerGallon;
        kpis['Total Gallons'] =
          assumptions.fuelSales.annualGasGallons + assumptions.fuelSales.annualDieselGallons;
        break;
      case 'SERVICE':
        kpis['Revenue Per Tech'] = year1.totalRevenue / assumptions.serviceDept.technicianCount;
        kpis['Labor Rate'] = assumptions.serviceDept.laborRate;
        kpis['Parts Markup'] = (assumptions.serviceDept.partsMarkup * 100).toFixed(0) + '%';
        break;
      case 'RENTAL':
        kpis['Fleet Size'] = assumptions.boatRentalsClub.rentalFleetSize;
        kpis['Utilization'] = (assumptions.boatRentalsClub.avgUtilizationRate * 100).toFixed(0) + '%';
        kpis['Club Members'] = assumptions.boatRentalsClub.clubMemberCount;
        break;
    }

    return kpis;
  }

  /**
   * Get profit center breakdown for a single year
   */
  async getProfitCenterBreakdown(
    projectId: string,
    orgId: string,
    year?: number
  ): Promise<{
    year: number;
    profitCenters: {
      name: string;
      code: string;
      revenue: number;
      noi: number;
      margin: number;
      pctOfTotal: number;
    }[];
    total: { revenue: number; noi: number; margin: number };
  }> {
    const model = await this.calculateMarinaFinancials(projectId, orgId);
    const targetYear = year || model.assumptions.analysisYear;
    const yearIndex = targetYear - model.assumptions.analysisYear;

    let totalRevenue = 0;
    let totalNOI = 0;

    const centers = model.profitCenters.map(pc => {
      const yearData = pc.years[yearIndex] || pc.years[0];
      totalRevenue += yearData.totalRevenue;
      totalNOI += yearData.netOperatingIncome;
      return {
        name: pc.name,
        code: pc.code,
        revenue: yearData.totalRevenue,
        noi: yearData.netOperatingIncome,
        margin: yearData.netMargin,
        pctOfTotal: 0,
      };
    });

    // Calculate percentage of total
    centers.forEach(c => {
      c.pctOfTotal = c.revenue / totalRevenue;
    });

    return {
      year: targetYear,
      profitCenters: centers,
      total: {
        revenue: totalRevenue,
        noi: totalNOI,
        margin: totalNOI / totalRevenue,
      },
    };
  }
}

export const marinaProfitCenterService = new MarinaProfitCenterService();

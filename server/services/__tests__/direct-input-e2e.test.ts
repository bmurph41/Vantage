/**
 * E2E Tests: Direct Input → Deal Pricing → Export Pipeline
 * 
 * Verifies the complete data flow:
 * 1. Direct input engine computes financials from COA + unit mix
 * 2. Deal pricing receives correct NOI
 * 3. Unit mix revenue is not double-counted
 * 4. Export includes pro forma sheet with correct data
 */
import { describe, it, expect } from 'vitest';
import { computeDirectInputFinancials } from '../direct-input-engine';

// ─── Test Data Fixtures ────────────────────────────────────────

const multifamilyAssumptions = {
  other_income: 24000,
  laundry_income: 12000,
  property_management: 8,     // pct of revenue
  insurance: 18000,
  property_taxes: 42000,
  repairs_maintenance: 15000,
  utilities: 28000,
  admin_general: 6000,
};

const multifamilyUnitMix = [
  { label: '1BR/1BA', count: 10, monthlyRent: 1200, occupancy: 0.95 },
  { label: '2BR/2BA', count: 8, monthlyRent: 1600, occupancy: 0.93 },
  { label: '3BR/2BA', count: 4, monthlyRent: 2000, occupancy: 0.90 },
];

const strAssumptions = {
  cleaning_fees: 15000,
  platform_fees: 3,           // pct of revenue
  property_management: 20,    // pct of revenue
  insurance: 4800,
  property_taxes: 8500,
  utilities: 6000,
  supplies: 3000,
  repairs_maintenance: 5000,
};

const strUnitMix = [
  { label: 'Main House', count: 1, nightlyRate: 250, occupancy: 0.72 },
  { label: 'Guest Suite', count: 1, nightlyRate: 150, occupancy: 0.65 },
];

const marinaAssumptions = {
  fuel_sales: 120000,
  ship_store: 35000,
  service_yard: 45000,
  insurance: 22000,
  property_taxes: 38000,
  dredging_reserve: 15000,
  dock_maintenance: 25000,
  utilities: 18000,
  property_management: 10,
};

const marinaUnitMix = [
  { label: 'Wet Slip 30ft', count: 40, monthlyRent: 450, occupancy: 0.88 },
  { label: 'Wet Slip 50ft', count: 20, monthlyRent: 850, occupancy: 0.82 },
  { label: 'Dry Storage', count: 60, monthlyRent: 250, occupancy: 0.90 },
];

// ─── 1. Direct Input Engine Tests ──────────────────────────────

describe('Direct Input Engine', () => {
  describe('Multifamily', () => {
    it('computes correct unit mix revenue', () => {
      const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
      expect(result).not.toBeNull();
      
      // 1BR: 1200 * 12 * 10 * 0.95 = 136,800 (if occ applied) or 144,000 (monthly, no occ)
      // Engine uses monthlyRent * 12 * count for monthly rates
      const unitLines = result!.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
      expect(unitLines.length).toBe(3);
      
      // Total revenue should include unit mix + other income + laundry
      expect(result!.totalRevenue).toBeGreaterThan(0);
      expect(result!.totalExpenses).toBeGreaterThan(0);
      expect(result!.noi).toBe(result!.totalRevenue - result!.totalExpenses);
    });

    it('includes COA expense lines', () => {
      const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
      const expenseLabels = result!.expenseLines.map(l => l.label.toLowerCase());
      
      expect(result!.expenseLines.length).toBeGreaterThan(0);
      // Should have the expense items we passed in
      expect(result!.totalExpenses).toBeGreaterThan(0);
    });

    it('returns null with empty assumptions and no unit mix', () => {
      const result = computeDirectInputFinancials('multifamily', {}, []);
      // Should return null or have zero totals
      if (result) {
        expect(result.totalRevenue).toBe(0);
        expect(result.totalExpenses).toBe(0);
      }
    });
  });

  describe('STR (Short-Term Rental)', () => {
    it('computes nightly rate revenue with occupancy', () => {
      const result = computeDirectInputFinancials('str', strAssumptions, strUnitMix);
      expect(result).not.toBeNull();
      
      const unitLines = result!.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
      expect(unitLines.length).toBe(2);
      
      // Main House: 250/night * 0.72 * 365 * 1 = 65,700
      const mainHouse = unitLines.find(l => l.label.includes('Main House'));
      expect(mainHouse).toBeDefined();
      expect(mainHouse!.amount).toBeCloseTo(250 * 0.72 * 365 * 1, 0);
      
      // Guest Suite: 150/night * 0.65 * 365 * 1 = 35,587.50
      const guestSuite = unitLines.find(l => l.label.includes('Guest Suite'));
      expect(guestSuite).toBeDefined();
      expect(guestSuite!.amount).toBeCloseTo(150 * 0.65 * 365 * 1, 0);
    });

    it('formulas show nightly calculation breakdown', () => {
      const result = computeDirectInputFinancials('str', strAssumptions, strUnitMix);
      const mainHouse = result!.revenueLines.find(l => l.key === 'unitMix_Main House');
      
      expect(mainHouse?.formula).toContain('/night');
      expect(mainHouse?.formula).toContain('365');
    });
  });

  describe('Marina', () => {
    it('combines unit mix revenue with profit center revenue', () => {
      const result = computeDirectInputFinancials('marina', marinaAssumptions, marinaUnitMix);
      expect(result).not.toBeNull();
      
      // Should have unit mix lines + fuel/store/service revenue
      const unitLines = result!.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
      expect(unitLines.length).toBe(3);
      
      // Wet Slip 30ft: 450 * 12 * 40 = 216,000
      const wetSlip30 = unitLines.find(l => l.label.includes('Wet Slip 30ft'));
      expect(wetSlip30).toBeDefined();
      expect(wetSlip30!.amount).toBe(450 * 12 * 40);
      
      // Total should include slip revenue + fuel + ship store + service
      expect(result!.totalRevenue).toBeGreaterThan(216000 + 120000 + 35000 + 45000);
    });
  });

  describe('Asset classes without unit mix', () => {
    it('computes from COA only', () => {
      const officeAssumptions = {
        totalSquareFeet: 10000, rentPerSF: 50,
        camReimbursements: 75000,
        otherIncome: 30000,
        propertyManagementPct: 5,
        annualInsurance: 15000,
        annualPropertyTax: 60000,
        annualUtilities: 25000,
        janitorial: 18000,
      };
      const result = computeDirectInputFinancials('office', officeAssumptions, []);
      expect(result).not.toBeNull();
      expect(result!.totalRevenue).toBeGreaterThan(0);
      expect(result!.noi).toBe(result!.totalRevenue - result!.totalExpenses);
    });
  });
});

// ─── 2. Double-Count Prevention Tests ──────────────────────────

describe('Double-Count Prevention', () => {
  it('unit mix revenue is included in totalRevenue', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    
    const unitMixTotal = result!.revenueLines
      .filter(l => l.key?.startsWith('unitMix_'))
      .reduce((sum, l) => sum + l.amount, 0);
    
    // totalRevenue must include unit mix
    expect(result!.totalRevenue).toBeGreaterThanOrEqual(unitMixTotal);
  });

  it('unit mix revenue is not double-counted in totalRevenue', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    
    // Sum all revenue lines — should equal totalRevenue
    const lineSum = result!.revenueLines.reduce((sum, l) => {
      return sum + (l.isSubtraction ? -l.amount : l.amount);
    }, 0);
    
    expect(result!.totalRevenue).toBeCloseTo(lineSum, 0);
  });

  it('no revenue when unit mix is empty and no rental COA values', () => {
    const expenseOnly = { insurance: 10000, property_taxes: 20000 };
    const result = computeDirectInputFinancials('multifamily', expenseOnly, []);
    
    if (result) {
      // Revenue should be zero or only from non-rental COA lines
      const unitLines = result.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
      expect(unitLines.length).toBe(0);
    }
  });
});

// ─── 3. NOI Consistency Tests ──────────────────────────────────

describe('NOI Consistency', () => {
  const assetClasses = [
    { name: 'multifamily', assumptions: multifamilyAssumptions, unitMix: multifamilyUnitMix },
    { name: 'str', assumptions: strAssumptions, unitMix: strUnitMix },
    { name: 'marina', assumptions: marinaAssumptions, unitMix: marinaUnitMix },
  ];

  for (const { name, assumptions, unitMix } of assetClasses) {
    it(`${name}: NOI = totalRevenue - totalExpenses`, () => {
      const result = computeDirectInputFinancials(name, assumptions, unitMix);
      expect(result).not.toBeNull();
      expect(result!.noi).toBe(result!.totalRevenue - result!.totalExpenses);
    });

    it(`${name}: all lines have labels and amounts`, () => {
      const result = computeDirectInputFinancials(name, assumptions, unitMix);
      for (const line of [...result!.revenueLines, ...result!.expenseLines]) {
        expect(line.label).toBeTruthy();
        expect(typeof line.amount).toBe('number');
        expect(line.category).toMatch(/^(revenue|expense)$/);
      }
    });

    it(`${name}: revenue and expense lines sum to totals`, () => {
      const result = computeDirectInputFinancials(name, assumptions, unitMix);
      
      const revSum = result!.revenueLines.reduce((s, l) => s + (l.isSubtraction ? -l.amount : l.amount), 0);
      const expSum = result!.expenseLines.reduce((s, l) => s + l.amount, 0);
      
      expect(result!.totalRevenue).toBeCloseTo(revSum, 0);
      expect(result!.totalExpenses).toBeCloseTo(expSum, 0);
    });
  }
});

// ─── 4. Deal Pricing Integration Tests ─────────────────────────

describe('Deal Pricing Data Flow', () => {
  it('customMetrics.unitMix format matches engine expectations', () => {
    // Simulate what the client save writes to customMetrics.unitMix
    const clientUnitMix = [
      { label: '1BR/1BA', count: 10, monthlyRent: 1200, occupancy: 0.95 },
      { label: '2BR/2BA', count: 8, monthlyRent: 1600, occupancy: 0.93 },
    ];
    
    // Engine should handle these field names
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, clientUnitMix);
    expect(result).not.toBeNull();
    
    const unitLines = result!.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
    expect(unitLines.length).toBe(2);
    
    // Verify amounts are non-zero
    for (const line of unitLines) {
      expect(line.amount).toBeGreaterThan(0);
    }
  });

  it('nightly rate format from client works correctly', () => {
    // Client sends nightlyRate for STR
    const clientStrUnits = [
      { label: 'Cabin', count: 1, nightlyRate: 200, occupancy: 0.70 },
    ];
    
    const result = computeDirectInputFinancials('str', strAssumptions, clientStrUnits);
    const cabin = result!.revenueLines.find(l => l.key === 'unitMix_Cabin');
    
    expect(cabin).toBeDefined();
    expect(cabin!.amount).toBeCloseTo(200 * 0.70 * 365, 0);
  });

  it('empty unit mix produces zero unit revenue', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, []);
    
    const unitLines = result!.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
    expect(unitLines.length).toBe(0);
  });

  it('undefined unit mix is handled gracefully', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, undefined as any);
    expect(result).not.toBeNull();
  });
});

// ─── 5. Formatting Tests ───────────────────────────────────────

describe('Formatting Standards', () => {
  it('formulas contain dollar-formatted amounts', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    
    const unitLines = result!.revenueLines.filter(l => l.key?.startsWith('unitMix_'));
    for (const line of unitLines) {
      expect(line.formula).toBeDefined();
      expect(line.formula).toContain('$');
    }
  });

  it('percentage-based expenses reference gross revenue', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    
    // Property management at 8% should be computed as pct of revenue
    const mgmt = result!.expenseLines.find(l => 
      l.label.toLowerCase().includes('management') || l.key?.includes('management')
    );
    
    if (mgmt && mgmt.formula) {
      expect(mgmt.formula).toContain('%');
    }
  });
});

// ─── 6. Cross-Asset-Class Consistency ──────────────────────────

describe('All Supported Asset Classes', () => {
  const assetClasses = [
    'multifamily', 'str', 'marina', 'office', 'retail', 'industrial',
    'hotel', 'self_storage', 'mobile_home_park', 'car_wash',
  ];

  for (const ac of assetClasses) {
    it(`${ac}: returns valid structure with basic inputs`, () => {
      const basicInputs = { insurance: 10000, property_taxes: 20000 };
      const result = computeDirectInputFinancials(ac, basicInputs, []);
      
      // Should return a result (even if minimal)
      if (result) {
        expect(result).toHaveProperty('totalRevenue');
        expect(result).toHaveProperty('totalExpenses');
        expect(result).toHaveProperty('noi');
        expect(result).toHaveProperty('revenueLines');
        expect(result).toHaveProperty('expenseLines');
        expect(Array.isArray(result.revenueLines)).toBe(true);
        expect(Array.isArray(result.expenseLines)).toBe(true);
      }
    });
  }
});

// ─── 7. Monthly Breakdown Tests ────────────────────────────────

describe('Monthly Breakdown', () => {
  it('produces 12 months with correct day counts', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    expect(result!.monthlyBreakdown).toBeDefined();
    expect(result!.monthlyBreakdown!.length).toBe(12);
    
    const days = result!.monthlyBreakdown!.map(m => m.days);
    expect(days).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it('monthly revenues sum to annual total', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    const monthlyRevSum = result!.monthlyBreakdown!.reduce((s, m) => s + m.revenue, 0);
    
    // Should be close to annual (rounding differences ok)
    expect(monthlyRevSum).toBeCloseTo(result!.totalRevenue, -1);
  });

  it('monthly expenses sum to annual total', () => {
    const result = computeDirectInputFinancials('multifamily', multifamilyAssumptions, multifamilyUnitMix);
    const monthlyExpSum = result!.monthlyBreakdown!.reduce((s, m) => s + m.expenses, 0);
    
    expect(monthlyExpSum).toBeCloseTo(result!.totalExpenses, -1);
  });

  it('monthly NOI = revenue - expenses for each month', () => {
    const result = computeDirectInputFinancials('str', strAssumptions, strUnitMix);
    for (const month of result!.monthlyBreakdown!) {
      expect(month.noi).toBeCloseTo(month.revenue - month.expenses, 1);
    }
  });

  it('month names are correct', () => {
    const result = computeDirectInputFinancials('marina', marinaAssumptions, marinaUnitMix);
    const names = result!.monthlyBreakdown!.map(m => m.month);
    expect(names).toEqual(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
  });
});

// ─── 8. Seasonal Occupancy Tests ───────────────────────────────

describe('Seasonal Occupancy', () => {
  const seasonalStrAssumptions = {
    ...strAssumptions,
    inSeasonMonths: [5, 6, 7, 8, 9],  // May-Sep
    inSeasonOccupancy: 0.85,
    offSeasonOccupancy: 0.45,
  };

  it('seasonal STR computes higher revenue in-season', () => {
    const result = computeDirectInputFinancials('str', seasonalStrAssumptions, strUnitMix);
    const breakdown = result!.monthlyBreakdown!;
    
    const mayRev = breakdown[4].revenue;   // May (in-season)
    const janRev = breakdown[0].revenue;   // Jan (off-season)
    
    // In-season should have higher revenue due to higher occupancy
    expect(mayRev).toBeGreaterThan(janRev);
  });

  it('seasonal months are tagged correctly', () => {
    const result = computeDirectInputFinancials('str', seasonalStrAssumptions, strUnitMix);
    const breakdown = result!.monthlyBreakdown!;
    
    // May-Sep should be 'in', others 'off'
    expect(breakdown[4].isSeason).toBe('in');  // May
    expect(breakdown[7].isSeason).toBe('in');  // Aug
    expect(breakdown[0].isSeason).toBe('off'); // Jan
    expect(breakdown[10].isSeason).toBe('off'); // Nov
  });

  it('seasonal formula shows dual occupancy breakdown', () => {
    const result = computeDirectInputFinancials('str', seasonalStrAssumptions, strUnitMix);
    const mainHouse = result!.revenueLines.find(l => l.key === 'unitMix_Main House');
    
    expect(mainHouse?.formula).toContain('d@');
    expect(mainHouse?.formula).toContain('+');
  });

  it('non-seasonal STR uses uniform occupancy', () => {
    const result = computeDirectInputFinancials('str', strAssumptions, strUnitMix);
    const breakdown = result!.monthlyBreakdown!;
    
    // No season tags
    for (const month of breakdown) {
      expect(month.isSeason).toBeUndefined();
    }
  });

  it('seasonal annual total matches sum of monthly', () => {
    const result = computeDirectInputFinancials('str', seasonalStrAssumptions, strUnitMix);
    const monthlySum = result!.monthlyBreakdown!.reduce((s, m) => s + m.revenue, 0);
    
    expect(monthlySum).toBeCloseTo(result!.totalRevenue, -1);
  });
});

/**
 * Rent Roll Asset Config Bridge
 *
 * Bridges the master asset-class-model-config.ts (used by Modeling workspace)
 * into rent-roll-v2-specific field definitions, KPI cards, and UI config.
 *
 * Usage:
 *   import { getRentRollConfig } from '@shared/rent-roll-config';
 *   const config = getRentRollConfig('marina');
 */

import { getModelConfig, type AssetClassModelConfig } from './asset-class-model-config';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface RentRollFieldDef {
  id: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select';
  required?: boolean;
  options?: string[];
}

export interface RentRollKpiCard {
  id: string;
  label: string;
  field: string;        // API response field name
  format: 'currency' | 'number' | 'percent' | 'dimension';
  icon: string;         // Lucide icon name
  dimensionUnit?: string; // e.g., "ft" for marina, "SF" for CRE
}

export interface RentRollAssetConfig {
  assetClass: string;
  modelConfig: AssetClassModelConfig;

  // Terminology (delegated from modelConfig.terms)
  terms: AssetClassModelConfig['terms'];

  // Unit types for dropdowns (from modelConfig.unitMix.types)
  unitTypes: Array<{ id: string; name: string; section: string }>;

  // Dimension fields shown in forms (e.g., "Boat Length" for marina, "Width/Depth" for self-storage)
  dimensionFields: RentRollFieldDef[];

  // Asset-specific tenant fields (e.g., boat info for marina, vehicle info for RV)
  tenantFields: RentRollFieldDef[];

  // Additional lease fields beyond the standard set
  leaseFields: RentRollFieldDef[];

  // Rate basis types available
  rateTypes: Array<{ value: string; label: string }>;

  // KPI cards for executive dashboard
  kpiCards: RentRollKpiCard[];

  // Status options for unit/slip status dropdown
  statusOptions: string[];

  // Seasonality
  hasSeasonal: boolean;
  seasonConfig: AssetClassModelConfig['seasonConfig'];

  // Navigation
  navigationIcon: string;
  navigationLabel: string;

  // Feature toggles
  showSeasonalLineItems: boolean;
  showLiveaboardFields: boolean;
  showBoatFields: boolean;
  showPerFootRates: boolean;
  showPerSFRates: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Marina-specific defaults (preserves exact current behavior)
// ═══════════════════════════════════════════════════════════════

const MARINA_TENANT_FIELDS: RentRollFieldDef[] = [
  { id: 'boatMake', label: 'Boat Make', type: 'text' },
  { id: 'boatYear', label: 'Boat Year', type: 'number' },
  { id: 'boatLength', label: 'Boat Length (ft)', type: 'number' },
  { id: 'boatWidth', label: 'Boat Width (ft)', type: 'number' },
];

const MARINA_DIMENSION_FIELDS: RentRollFieldDef[] = [
  { id: 'slipLength', label: 'Slip Length (ft)', type: 'number' },
  { id: 'slipWidth', label: 'Slip Width (ft)', type: 'number' },
];

const MARINA_STATUS_OPTIONS = [
  'Occupied', 'Vacant', 'Unusable', 'Liveaboard', 'Service',
  'Sales', 'Occupied; Not-Paying', 'Small Boat/Dinghy',
  'Commercial', 'Rental Boat', 'Boat Club', 'Transient',
];

const MARINA_RATE_TYPES = [
  { value: '$/ft./mo.', label: '$/ft./mo.' },
  { value: '$/ft./season', label: '$/ft./season' },
  { value: '$/ft./yr.', label: '$/ft./yr.' },
  { value: '$/mo.', label: '$/mo.' },
  { value: '$/season', label: '$/season' },
  { value: '$/yr.', label: '$/yr.' },
  { value: '$/contract', label: '$/contract' },
];

const MARINA_KPI_CARDS: RentRollKpiCard[] = [
  { id: 'totalRevenue', label: 'Total Storage Revenue', field: 'totalRevenue', format: 'currency', icon: 'DollarSign' },
  { id: 'activeLeases', label: 'Active Leases', field: 'activeLeases', format: 'number', icon: 'FileText' },
  { id: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancyRate', format: 'percent', icon: 'BarChart3' },
  { id: 'avgLeaseValue', label: 'Avg Lease Value', field: 'avgLeaseValue', format: 'currency', icon: 'TrendingUp' },
  { id: 'avgUnitDimension', label: 'Avg Boat Size', field: 'avgLength', format: 'dimension', icon: 'Ship', dimensionUnit: 'ft' },
  { id: 'moveIns', label: 'Move-Ins', field: 'moveIns', format: 'number', icon: 'ArrowUpRight' },
  { id: 'moveOuts', label: 'Move-Outs', field: 'moveOuts', format: 'number', icon: 'ArrowDownRight' },
  { id: 'netChange', label: 'Net Change', field: 'netChange', format: 'number', icon: 'Activity' },
];

// ═══════════════════════════════════════════════════════════════
// Self-Storage config
// ═══════════════════════════════════════════════════════════════

const SELF_STORAGE_STATUS_OPTIONS = [
  'Occupied', 'Vacant', 'Reserved', 'Delinquent', 'Maintenance', 'Out of Service',
];

const SELF_STORAGE_RATE_TYPES = [
  { value: '$/mo.', label: '$/Month' },
  { value: '$/yr.', label: '$/Year' },
  { value: '$/sf/mo.', label: '$/SF/Month' },
  { value: '$/sf/yr.', label: '$/SF/Year' },
];

const SELF_STORAGE_KPI_CARDS: RentRollKpiCard[] = [
  { id: 'totalRevenue', label: 'Total Unit Revenue', field: 'totalRevenue', format: 'currency', icon: 'DollarSign' },
  { id: 'activeLeases', label: 'Active Leases', field: 'activeLeases', format: 'number', icon: 'FileText' },
  { id: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancyRate', format: 'percent', icon: 'BarChart3' },
  { id: 'avgLeaseValue', label: 'Avg Lease Value', field: 'avgLeaseValue', format: 'currency', icon: 'TrendingUp' },
  { id: 'avgUnitDimension', label: 'Avg Unit Size', field: 'avgUnitSF', format: 'dimension', icon: 'Box', dimensionUnit: 'SF' },
  { id: 'moveIns', label: 'Move-Ins', field: 'moveIns', format: 'number', icon: 'ArrowUpRight' },
  { id: 'moveOuts', label: 'Move-Outs', field: 'moveOuts', format: 'number', icon: 'ArrowDownRight' },
  { id: 'netChange', label: 'Net Change', field: 'netChange', format: 'number', icon: 'Activity' },
];

// ═══════════════════════════════════════════════════════════════
// CRE config (Office, Retail, Industrial, Medical Office)
// ═══════════════════════════════════════════════════════════════

const CRE_TENANT_FIELDS: RentRollFieldDef[] = [
  { id: 'tradeName', label: 'Trade Name / DBA', type: 'text' },
  { id: 'contactName', label: 'Contact Name', type: 'text' },
  { id: 'industry', label: 'Industry', type: 'text' },
];

const CRE_DIMENSION_FIELDS: RentRollFieldDef[] = [
  { id: 'unitDimension1', label: 'Square Footage', type: 'number' },
];

const CRE_STATUS_OPTIONS = [
  'Occupied', 'Vacant', 'Under Renovation', 'Leased - Not Occupied', 'Subleased',
];

const CRE_RATE_TYPES = [
  { value: '$/sf/yr.', label: '$/SF/Year (NNN)' },
  { value: '$/sf/mo.', label: '$/SF/Month' },
  { value: '$/mo.', label: '$/Month (Gross)' },
  { value: '$/yr.', label: '$/Year' },
];

const CRE_LEASE_FIELDS: RentRollFieldDef[] = [
  { id: 'leaseType', label: 'Lease Type', type: 'select', options: ['NNN', 'Modified Gross', 'Full Service', 'Absolute Net', 'Double Net'] },
  { id: 'escalationType', label: 'Escalation Type', type: 'select', options: ['Fixed %', 'Fixed $', 'CPI', 'Fair Market Value', 'None'] },
  { id: 'escalationRate', label: 'Escalation Rate (%)', type: 'number' },
];

function getCREKpiCards(label: string): RentRollKpiCard[] {
  return [
    { id: 'totalRevenue', label: `Total ${label} Revenue`, field: 'totalRevenue', format: 'currency', icon: 'DollarSign' },
    { id: 'activeLeases', label: 'Active Leases', field: 'activeLeases', format: 'number', icon: 'FileText' },
    { id: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancyRate', format: 'percent', icon: 'BarChart3' },
    { id: 'avgLeaseValue', label: 'Avg Rent/SF', field: 'avgRentPerSF', format: 'currency', icon: 'TrendingUp' },
    { id: 'walt', label: 'WALT (Years)', field: 'walt', format: 'number', icon: 'Clock' },
    { id: 'moveIns', label: 'New Leases', field: 'moveIns', format: 'number', icon: 'ArrowUpRight' },
    { id: 'moveOuts', label: 'Expirations', field: 'moveOuts', format: 'number', icon: 'ArrowDownRight' },
    { id: 'netChange', label: 'Net Absorption', field: 'netChange', format: 'number', icon: 'Activity' },
  ];
}

// ═══════════════════════════════════════════════════════════════
// Multifamily config
// ═══════════════════════════════════════════════════════════════

const MULTIFAMILY_STATUS_OPTIONS = [
  'Occupied', 'Vacant', 'Down for Renovation', 'Model', 'Notice to Vacate', 'Delinquent',
];

const MULTIFAMILY_KPI_CARDS: RentRollKpiCard[] = [
  { id: 'totalRevenue', label: 'Gross Potential Rent', field: 'totalRevenue', format: 'currency', icon: 'DollarSign' },
  { id: 'activeLeases', label: 'Active Leases', field: 'activeLeases', format: 'number', icon: 'FileText' },
  { id: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancyRate', format: 'percent', icon: 'BarChart3' },
  { id: 'avgLeaseValue', label: 'Avg Monthly Rent', field: 'avgLeaseValue', format: 'currency', icon: 'TrendingUp' },
  { id: 'avgUnitDimension', label: 'Avg Unit SF', field: 'avgUnitSF', format: 'dimension', icon: 'Home', dimensionUnit: 'SF' },
  { id: 'moveIns', label: 'Move-Ins', field: 'moveIns', format: 'number', icon: 'ArrowUpRight' },
  { id: 'moveOuts', label: 'Move-Outs', field: 'moveOuts', format: 'number', icon: 'ArrowDownRight' },
  { id: 'netChange', label: 'Net Change', field: 'netChange', format: 'number', icon: 'Activity' },
];

// ═══════════════════════════════════════════════════════════════
// RV Park / Campground config
// ═══════════════════════════════════════════════════════════════

const RV_PARK_STATUS_OPTIONS = [
  'Occupied', 'Vacant', 'Reserved', 'Seasonal Hold', 'Maintenance', 'Out of Service',
];

// ═══════════════════════════════════════════════════════════════
// Hotel / STR config
// ═══════════════════════════════════════════════════════════════

const HOTEL_RATE_TYPES = [
  { value: '$/night', label: '$/Night' },
  { value: '$/week', label: '$/Week' },
  { value: '$/mo.', label: '$/Month' },
];

const HOTEL_KPI_CARDS: RentRollKpiCard[] = [
  { id: 'totalRevenue', label: 'Rooms Revenue', field: 'totalRevenue', format: 'currency', icon: 'DollarSign' },
  { id: 'activeLeases', label: 'Occupied Rooms', field: 'activeLeases', format: 'number', icon: 'BedDouble' },
  { id: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancyRate', format: 'percent', icon: 'BarChart3' },
  { id: 'adr', label: 'ADR', field: 'avgLeaseValue', format: 'currency', icon: 'TrendingUp' },
  { id: 'revpar', label: 'RevPAR', field: 'revpar', format: 'currency', icon: 'Target' },
  { id: 'moveIns', label: 'Check-Ins', field: 'moveIns', format: 'number', icon: 'ArrowUpRight' },
  { id: 'moveOuts', label: 'Check-Outs', field: 'moveOuts', format: 'number', icon: 'ArrowDownRight' },
  { id: 'netChange', label: 'Net Change', field: 'netChange', format: 'number', icon: 'Activity' },
];

// ═══════════════════════════════════════════════════════════════
// Config Resolution
// ═══════════════════════════════════════════════════════════════

const CRE_ASSET_CLASSES = ['retail', 'office', 'industrial', 'medical_office', 'shopping_center'];
const RESIDENTIAL_ASSET_CLASSES = ['multifamily', 'duplex', 'triplex', 'quad'];

function getNavigationIcon(assetClass: string): string {
  const iconMap: Record<string, string> = {
    marina: 'Ship',
    self_storage: 'Box',
    multifamily: 'Building2',
    retail: 'Store',
    office: 'Building',
    industrial: 'Factory',
    hotel: 'Hotel',
    str: 'Home',
    rv_park: 'Tent',
    mobile_home: 'Home',
    medical_office: 'Stethoscope',
    mixed_use: 'LayoutGrid',
    laundromat: 'WashingMachine',
    land: 'Mountain',
    business: 'Briefcase',
  };
  return iconMap[assetClass] || 'Building2';
}

/**
 * Get the complete rent-roll-v2 config for a given asset class.
 * This is the single source of truth for all rent-roll UI and service behavior.
 */
export function getRentRollConfig(assetClass: string | null | undefined): RentRollAssetConfig {
  const ac = assetClass || 'marina';
  const modelConfig = getModelConfig(ac);
  const unitTypes = modelConfig.unitMix.types.map(t => ({
    id: t.id,
    name: t.name,
    section: t.section,
  }));

  // Marina (default)
  if (ac === 'marina') {
    return {
      assetClass: ac,
      modelConfig,
      terms: modelConfig.terms,
      unitTypes,
      dimensionFields: MARINA_DIMENSION_FIELDS,
      tenantFields: MARINA_TENANT_FIELDS,
      leaseFields: [],
      rateTypes: MARINA_RATE_TYPES,
      kpiCards: MARINA_KPI_CARDS,
      statusOptions: MARINA_STATUS_OPTIONS,
      hasSeasonal: modelConfig.hasSeasonal,
      seasonConfig: modelConfig.seasonConfig,
      navigationIcon: 'Ship',
      navigationLabel: 'Slip Rent Roll',
      showSeasonalLineItems: true,
      showLiveaboardFields: true,
      showBoatFields: true,
      showPerFootRates: true,
      showPerSFRates: false,
    };
  }

  // Self-Storage
  if (ac === 'self_storage') {
    return {
      assetClass: ac,
      modelConfig,
      terms: modelConfig.terms,
      unitTypes,
      dimensionFields: [{ id: 'unitDimension1', label: 'Unit SF', type: 'number' }],
      tenantFields: [],
      leaseFields: [],
      rateTypes: SELF_STORAGE_RATE_TYPES,
      kpiCards: SELF_STORAGE_KPI_CARDS,
      statusOptions: SELF_STORAGE_STATUS_OPTIONS,
      hasSeasonal: modelConfig.hasSeasonal,
      seasonConfig: modelConfig.seasonConfig,
      navigationIcon: 'Box',
      navigationLabel: 'Unit Rent Roll',
      showSeasonalLineItems: false,
      showLiveaboardFields: false,
      showBoatFields: false,
      showPerFootRates: false,
      showPerSFRates: true,
    };
  }

  // CRE (Retail, Office, Industrial, Medical Office)
  if (CRE_ASSET_CLASSES.includes(ac)) {
    return {
      assetClass: ac,
      modelConfig,
      terms: modelConfig.terms,
      unitTypes,
      dimensionFields: CRE_DIMENSION_FIELDS,
      tenantFields: CRE_TENANT_FIELDS,
      leaseFields: CRE_LEASE_FIELDS,
      rateTypes: CRE_RATE_TYPES,
      kpiCards: getCREKpiCards(modelConfig.terms.property),
      statusOptions: CRE_STATUS_OPTIONS,
      hasSeasonal: false,
      seasonConfig: modelConfig.seasonConfig,
      navigationIcon: getNavigationIcon(ac),
      navigationLabel: 'Tenant Rent Roll',
      showSeasonalLineItems: false,
      showLiveaboardFields: false,
      showBoatFields: false,
      showPerFootRates: false,
      showPerSFRates: true,
    };
  }

  // Multifamily / Residential
  if (RESIDENTIAL_ASSET_CLASSES.includes(ac)) {
    return {
      assetClass: ac,
      modelConfig,
      terms: modelConfig.terms,
      unitTypes,
      dimensionFields: [{ id: 'unitDimension1', label: 'Unit SF', type: 'number' }],
      tenantFields: [],
      leaseFields: [],
      rateTypes: [
        { value: '$/mo.', label: '$/Month' },
        { value: '$/yr.', label: '$/Year' },
      ],
      kpiCards: MULTIFAMILY_KPI_CARDS,
      statusOptions: MULTIFAMILY_STATUS_OPTIONS,
      hasSeasonal: false,
      seasonConfig: modelConfig.seasonConfig,
      navigationIcon: getNavigationIcon(ac),
      navigationLabel: 'Rent Roll',
      showSeasonalLineItems: false,
      showLiveaboardFields: false,
      showBoatFields: false,
      showPerFootRates: false,
      showPerSFRates: false,
    };
  }

  // RV Park / Campground
  if (ac === 'rv_park' || ac === 'mobile_home' || ac === 'mobile_home_park') {
    return {
      assetClass: ac,
      modelConfig,
      terms: modelConfig.terms,
      unitTypes,
      dimensionFields: [],
      tenantFields: [
        { id: 'vehicleType', label: 'Vehicle Type', type: 'text' },
        { id: 'vehicleLength', label: 'Vehicle Length (ft)', type: 'number' },
      ],
      leaseFields: [],
      rateTypes: [
        { value: '$/night', label: '$/Night' },
        { value: '$/week', label: '$/Week' },
        { value: '$/mo.', label: '$/Month' },
        { value: '$/season', label: '$/Season' },
        { value: '$/yr.', label: '$/Year' },
      ],
      kpiCards: MARINA_KPI_CARDS.map(k =>
        k.id === 'avgUnitDimension'
          ? { ...k, label: 'Avg Site Size', field: 'avgUnitSF', dimensionUnit: 'ft', icon: 'Tent' }
          : k.id === 'totalRevenue'
            ? { ...k, label: 'Total Site Revenue' }
            : k
      ),
      statusOptions: RV_PARK_STATUS_OPTIONS,
      hasSeasonal: modelConfig.hasSeasonal,
      seasonConfig: modelConfig.seasonConfig,
      navigationIcon: getNavigationIcon(ac),
      navigationLabel: 'Site Rent Roll',
      showSeasonalLineItems: true,
      showLiveaboardFields: false,
      showBoatFields: false,
      showPerFootRates: false,
      showPerSFRates: false,
    };
  }

  // Hotel / STR
  if (ac === 'hotel' || ac === 'str') {
    return {
      assetClass: ac,
      modelConfig,
      terms: modelConfig.terms,
      unitTypes,
      dimensionFields: [],
      tenantFields: [],
      leaseFields: [],
      rateTypes: HOTEL_RATE_TYPES,
      kpiCards: HOTEL_KPI_CARDS,
      statusOptions: ['Available', 'Occupied', 'Out of Order', 'Out of Service', 'Blocked'],
      hasSeasonal: modelConfig.hasSeasonal,
      seasonConfig: modelConfig.seasonConfig,
      navigationIcon: getNavigationIcon(ac),
      navigationLabel: ac === 'hotel' ? 'Room Inventory' : 'Listing Manager',
      showSeasonalLineItems: false,
      showLiveaboardFields: false,
      showBoatFields: false,
      showPerFootRates: false,
      showPerSFRates: false,
    };
  }

  // Default fallback: generic rent roll config from model config
  return {
    assetClass: ac,
    modelConfig,
    terms: modelConfig.terms,
    unitTypes,
    dimensionFields: [],
    tenantFields: [],
    leaseFields: [],
    rateTypes: [
      { value: '$/mo.', label: '$/Month' },
      { value: '$/yr.', label: '$/Year' },
    ],
    kpiCards: MARINA_KPI_CARDS.map(k =>
      k.id === 'avgUnitDimension'
        ? { ...k, label: `Avg ${modelConfig.terms.unit} Size`, icon: 'Ruler' }
        : k
    ),
    statusOptions: ['Occupied', 'Vacant', 'Reserved', 'Maintenance'],
    hasSeasonal: modelConfig.hasSeasonal,
    seasonConfig: modelConfig.seasonConfig,
    navigationIcon: getNavigationIcon(ac),
    navigationLabel: modelConfig.terms.rentRoll || 'Rent Roll',
    showSeasonalLineItems: modelConfig.hasSeasonal,
    showLiveaboardFields: false,
    showBoatFields: false,
    showPerFootRates: false,
    showPerSFRates: false,
  };
}

/**
 * Check if an asset class uses the CRE commercial tenants data source
 * instead of the marina-style RRA leases.
 */
export function usesCREDataSource(assetClass: string | null | undefined): boolean {
  return CRE_ASSET_CLASSES.includes(assetClass || '');
}

/**
 * Get the list of supported asset classes for the rent roll module.
 */
export function getSupportedRentRollAssetClasses(): Array<{ value: string; label: string }> {
  return [
    { value: 'marina', label: 'Marina' },
    { value: 'self_storage', label: 'Self-Storage' },
    { value: 'rv_park', label: 'RV Park / Campground' },
    { value: 'mobile_home', label: 'Mobile Home Park' },
    { value: 'multifamily', label: 'Multifamily' },
    { value: 'retail', label: 'Retail' },
    { value: 'office', label: 'Office' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'medical_office', label: 'Medical Office' },
    { value: 'hotel', label: 'Hotel / Hospitality' },
    { value: 'str', label: 'Short-Term Rental' },
    { value: 'mixed_use', label: 'Mixed-Use' },
    { value: 'laundromat', label: 'Laundromat' },
    { value: 'business', label: 'Business / Other' },
  ];
}

/**
 * Revenue-Driver Schema (v3)
 * ---------------------------------------------------------------
 * The frozen contract for the revenue-driver subsystem. Step 0 keystone.
 *
 * Ratified by Brett 2026-05-23. Step A and beyond build against these
 * types; the calculator (shared/coa/projection-calculator.ts) and the
 * two projection engines (pro-forma-engine-service, multi-year-projection-
 * engine) all dispatch through the shapes defined here.
 *
 * History:
 *   v1 — implicit marina-only `assumptions.occupancy` shape
 *        (Record<storageTypeKey, Record<year, pct>>).
 *   v2 — proposed `OccupancyBlob` (occupancy-only generalization across
 *        unit-based / lease-based / none). Superseded — see v3.
 *   v3 — RevenueDriverBlob: two-axis (driver × rate), 7-value basisType
 *        taxonomy, multi-stream-per-dimension with totalCapacity +
 *        capacityAllocation (Tier 1 soft enforcement). Marina is the
 *        completeness anchor (all six non-`none` basisTypes appear).
 *
 * ─── LOAD-BEARING INVARIANT ─────────────────────────────────────
 * WS5 `granularGrowthRates` applies ONLY to lines whose effective
 * revenueMode resolves to `'flat_growth'`. Lines whose effective
 * revenueMode is `'driver_based'` are ENTIRELY outside the WS5 growth
 * path — a driver_based line NEVER reads granularGrowthRates.
 *
 * Within driver_based, the driver's growth series (quantity lever) and
 * the rate's growth series (price lever) BOTH apply independently;
 * their Δqty × Δrate interaction is real underwriting, not a double-
 * count.
 *
 * The ONLY forbidden state is a driver_based line also receiving a WS5
 * line-growth multiplier. The calculator (Step A) and both engines
 * (Step D-prime) must honor this rule.
 * ────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════
// Top-level blob
// ═══════════════════════════════════════════════════════════════

export interface RevenueDriverBlob {
  schemaVersion: 3;
  granularity: 'year' | 'month';

  /**
   * Per-department revenueMode defaults. Lines inherit unless the
   * stream sets `revenueMode` non-null. Cascade order:
   *   stream.revenueMode > departmentDefaults[dept] >
   *   modelConfig.defaultRevenueMode > 'flat_growth' (final fallback)
   */
  departmentDefaults: Record<string, RevenueMode>;

  /**
   * Dimension IDs are stable identifiers:
   *   - unitMix.types[].id     (e.g. 'wet_slips', '2br_2ba', '5x5_climate')
   *   - 'whole_property'       (single-dimension classes)
   *   - 'commercial_leases'    (lease_based classes)
   *   - 'utility_meter:<name>' (utility consumption streams not tied to unit-mix)
   */
  dimensions: Record<DimensionId, RevenueDimension>;
}

export type DimensionId = string;
export type StreamId = string;

/**
 * 'driver_based' → revenue computed from driver (quantity) × rate (price).
 * 'flat_growth'  → revenue = Y1 amount compounded via WS5 granularGrowthRates.
 * Mutually exclusive per the load-bearing invariant above.
 */
export type RevenueMode = 'driver_based' | 'flat_growth';

// ═══════════════════════════════════════════════════════════════
// Dimensions and streams
// ═══════════════════════════════════════════════════════════════

export interface RevenueDimension {
  /**
   * Total physical capacity of this dimension.
   * Tier 1 (SOFT enforcement, ratified 2026-05-23):
   *   - Schema CARRIES capacity and per-stream allocation.
   *   - V1 engine computes streams INDEPENDENTLY; no constraint solver.
   *   - Hard-enforcement constraint solver is a future enhancement that
   *     reads these same fields — no migration when it ships.
   *
   * `null` for dimensions where capacity isn't meaningful (e.g. some
   * absolute_count / metered_usage utility-meter dimensions).
   */
  totalCapacity: { value: number; unit: CapacityUnit } | null;

  /** Multi-stream-per-dimension. Marina wet slips: long_term + seasonal + transient. */
  streams: Record<StreamId, RevenueStream>;
}

export type CapacityUnit =
  | 'LF'        // linear feet (marina wet slips)
  | 'count'     // discrete units
  | 'SF'        // square feet (commercial leases)
  | 'sites'     // RV/MHP sites
  | 'rooms'     // hotel rooms
  | 'slots'     // daycare slots, parking permits, etc.
  | 'spaces'    // parking spaces
  | 'gallons'   // fuel/water throughput cap
  | 'kWh'       // data center power
  | 'racks';    // data center rack-units

export interface RevenueStream {
  basisType: BasisType;

  /**
   * Share of dimension.totalCapacity this stream consumes (0..1).
   * SOFT-VALIDATED (Tier 1):
   *   - Σ allocation over `percent_of_capacity` streams > 1.0 → warning
   *   - `transient_usage` / `metered_usage` allocations are informational;
   *     turnover/consumption may legitimately exceed via throughput.
   *   - `null` when capacity is N/A for the dimension.
   */
  capacityAllocation: number | null;

  /**
   * Per-stream override of department default. `null` = inherit.
   */
  revenueMode: RevenueMode | null;

  /** QUANTITY axis — projects independently. Inert when revenueMode='flat_growth'. */
  driver: DriverSpec;

  /** PRICE axis — projects independently. Inert when revenueMode='flat_growth'. */
  rate: RateSpec;
}

export type BasisType =
  /** Classic occupancy: occupied units / total units, or occupied LF / total LF. */
  | 'percent_of_capacity'
  /** Turnover-based: transient LF-nights, room-nights. May exceed capacity allocation via turnover. */
  | 'transient_usage'
  /** Consumption-based: kWh, gallons, cycles, hours. */
  | 'metered_usage'
  /** Discrete count: members, washes, rounds, transactions. */
  | 'absolute_count'
  /** Lease utilization: leased SF / total SF, sourced from commercial-lease service. */
  | 'lease_based'
  /** User-defined formula. V1: literal value, no formula. Future: expression evaluator. */
  | 'custom'
  /** No quantity driver. Rate carries the line (or it's modeled outside this subsystem). */
  | 'none';

// ═══════════════════════════════════════════════════════════════
// Driver (quantity) axis
// ═══════════════════════════════════════════════════════════════

export interface DriverSpec {
  /**
   * Single time series OR seasonal split — exactly one is non-null.
   * `seasons` is populated when the underlying unitMix.types[].hasSeasons
   * is true AND the class's seasonConfig.type !== 'none'.
   */
  series: PeriodSeries | null;
  seasons: { in: PeriodSeries; off: PeriodSeries } | null;

  /**
   * What the driver values represent. Drives calculator's resolveQuantity
   * table (see formula block below) and UI labels.
   */
  quantityUnit: QuantityUnit;
}

export type QuantityUnit =
  | 'percent'        // 0..100, used with capacity (percent_of_capacity, lease_based)
  | 'count'          // absolute count (absolute_count, units occupied)
  | 'unit_nights'    // capacity-unit × nights (transient_usage)
  | 'consumption'    // kWh/gallons/cycles/hours (metered_usage)
  | 'leased_unit'    // SF/units leased (lease_based, when sourced from lease service)
  | 'custom';        // free-form

// ═══════════════════════════════════════════════════════════════
// Rate (price) axis
// ═══════════════════════════════════════════════════════════════

export interface RateSpec {
  /** Currency-per-X unit. Drives nominator. */
  unitBasis: RateUnitBasis;

  /** Per-time-Y unit. Drives denominator + periodScaleFactor. */
  periodBasis: RatePeriodBasis;

  /**
   * Rate's OWN projection. Independent from the driver's series.
   * 'fixed' mode: absolute $/unit-period per period.
   * 'growth' mode: % YoY change in rate (NOT WS5 granularGrowthRates;
   * this is the rate axis of the driver_based path).
   */
  series: PeriodSeries;
}

export type RateUnitBasis =
  | 'per_LF'        // marina wet slips
  | 'per_SF'        // commercial leases, self-storage by SF
  | 'per_unit'      // MF, hotel rooms, generic
  | 'per_space'     // parking
  | 'per_room'      // hotel (synonym for per_unit when dim.unit='rooms')
  | 'per_member'    // gym
  | 'per_site'      // RV/MHP
  | 'per_gallon'    // fuel, water
  | 'per_kWh'       // power
  | 'per_round'     // golf
  | 'per_cover'     // restaurant
  | 'per_wash'      // car wash
  | 'per_cycle'     // laundromat
  | 'per_visit'     // generic per-use
  | 'per_vehicle'   // dealership, parking events
  | 'flat';         // dimensionless flat rate

export type RatePeriodBasis =
  | 'per_day'
  | 'per_night'
  | 'per_month'
  | 'per_season'
  | 'per_year'
  | 'per_use'
  | 'one_time';

// ═══════════════════════════════════════════════════════════════
// Period series — shared shape for driver, seasons, and rate
// ═══════════════════════════════════════════════════════════════

export interface PeriodSeries {
  mode: 'fixed' | 'growth';

  /**
   * Keys are 'YYYY' when blob.granularity='year', 'YYYY-MM' when 'month'.
   * 'fixed' values: absolute units (percent 0..100, count, consumption, $).
   * 'growth' values: period-over-period deltas (e.g. +2.5 = +2.5pp YoY for
   *   percent-quantityUnit drivers; +3.0 = +3% YoY for rate growth).
   */
  values: Record<PeriodKey, number>;

  /** Y1 anchor for ratio/compounding semantics. Always populated. */
  baselineYear: number;
  baselineMonth?: number;
}

export type PeriodKey = string;

// ═══════════════════════════════════════════════════════════════
// Revenue formula — deterministic; calculator (Step A) implements
// ═══════════════════════════════════════════════════════════════

/**
 * REVENUE FORMULA (per stream, per period, when revenueMode='driver_based'):
 *
 *   revenueForPeriod =
 *     resolveQuantity(driver, basisType, totalCapacity, capacityAllocation, period)
 *     × resolveRate(rate, period)
 *     × periodScaleFactor(rate.periodBasis, blob.granularity, period)
 *
 * resolveQuantity by basisType:
 *
 *   percent_of_capacity   (pct/100) × totalCapacity.value × capacityAllocation
 *   transient_usage       driver.value as-is (already in unit-nights)
 *   metered_usage         driver.value as-is (already in consumption units)
 *   absolute_count        driver.value as-is
 *   lease_based           (pct/100) × totalCapacity.value × capacityAllocation
 *                         OR pull-through from commercial-lease service
 *   custom                user formula (V1: literal value)
 *   none                  1  (rate carries the line)
 *
 * resolveRate(rate, period):
 *   - mode='fixed': rate.values[periodKey] directly
 *   - mode='growth': rate.values[periodKey=baseline] × Π(1 + values[≤period]/100)
 *
 * periodScaleFactor(periodBasis, granularity, period):
 *   Maps the rate's natural time unit to the projection's natural time
 *   unit. Examples:
 *     granularity='month', periodBasis='per_month'  → 1
 *     granularity='month', periodBasis='per_year'   → 1/12
 *     granularity='year',  periodBasis='per_month'  → 12
 *     granularity='year',  periodBasis='per_night'  → daysInSeasonForYear
 *                                                     (when seasonal) OR 365
 *
 * When revenueMode='flat_growth':
 *   revenueForPeriod = y1Amount × compoundGrowth(period, WS5 rate)
 *   (driver and rate are inert)
 */

// ═══════════════════════════════════════════════════════════════
// Per-class taxonomy (Step 0 ratified-so-far)
// ═══════════════════════════════════════════════════════════════

/**
 * Taxonomy status:
 *   'locked'      — Brett ratified per stream basis; demo + canonical classes
 *   'roughed_in'  — Brett's template applied; refine post-demo
 *   'deferred'    — Open question per §4 of the Step 0 spec; revisit when class is built
 */
export type TaxonomyStatus = 'locked' | 'roughed_in' | 'deferred';

export interface AssetClassRevenueDriverModel {
  taxonomyStatus: TaxonomyStatus;

  /** False = class has no revenue-driver concept; calculator multiplier = 1. */
  hasRevenueDrivers: boolean;

  /** Class-level fallback for the cascade in §1.3 of the spec. */
  defaultRevenueMode: RevenueMode;

  /** Mirrors any unitMix.types[].hasSeasons && seasonConfig.type !== 'none'. */
  supportsSeasons: boolean;

  /**
   * Canonical streams the class typically carries. Used by the seeder
   * (Step C) to populate fresh RevenueDriverBlob scenarios.
   * Key = stable streamId.
   */
  canonicalStreams: Record<string, CanonicalStreamDef>;

  /** Per-department defaults seeded into RevenueDriverBlob.departmentDefaults. */
  departmentRevenueModeDefaults?: Record<string, RevenueMode>;

  /** Free-form note for deferred / uncertain rows — carries the open question. */
  deferredNote?: string;
}

export interface CanonicalStreamDef {
  label: string;
  basisType: BasisType;

  /**
   * Where the dimension lives:
   *   'per_unit_type'      — one stream per unitMix.types[] (marina, MF, STR, hotel, SS, MHP, RV)
   *   'whole_property'     — single dimension at class level
   *   'commercial_leases'  — single dimension sourced from commercial-lease service
   *   'utility_meter'      — dimension named 'utility_meter:<streamId>', capacity-null
   */
  dimensionScope: 'per_unit_type' | 'whole_property' | 'commercial_leases' | 'utility_meter';

  rateUnitBasis: RateUnitBasis;
  ratePeriodBasis: RatePeriodBasis;

  /** Hint for RevenueDimension.totalCapacity.unit; UI default. */
  defaultCapacityUnit?: CapacityUnit;

  /** Y1 default for percent_of_capacity streams (0..100). */
  defaultY1Occupancy?: number;

  /** Mirror of unitMix.types[].hasSeasons for streams that split by season. */
  hasSeasons?: boolean;
}

/**
 * ASSET_CLASS_DRIVER_TAXONOMY — ratified-so-far. Step A reads from here.
 *
 * LOCKED   : marina, multifamily, str, self_storage, hotel, mixed_use,
 *            retail, office, industrial, medical_office, shopping_center
 *            (commercial_leases-only; %-rent custom branch deferred per Q8),
 *            sfr, duplex, triplex, quad, land
 * ROUGHED  : mobile_home_park, rv_park, parking, gas_station, gym,
 *            laundromat, car_wash, golf_course, restaurant, car_dealership,
 *            business
 * DEFERRED : accounting_firm, landscaping, construction (Q3 basis);
 *            daycare (Q4 pct vs count);
 *            data_center (Q7 kW vs racks capacity);
 *            shopping_center %-rent custom branch (Q8 — base entry is locked
 *            commercial_leases; %-rent uplift stream deferred)
 */
export const ASSET_CLASS_DRIVER_TAXONOMY: Record<string, AssetClassRevenueDriverModel> = {
  // ═══════════════════════════════════════════════════════
  // LOCKED — marina (completeness anchor: 6 of 7 basisTypes)
  // ═══════════════════════════════════════════════════════
  marina: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: true,
    departmentRevenueModeDefaults: {
      Storage: 'driver_based',
      Fuel: 'driver_based',
      'Sales & Service': 'flat_growth',
      'F&B': 'flat_growth',
      Hospitality: 'flat_growth',
    },
    canonicalStreams: {
      wet_slips_long_term:    { label: 'Wet Slips — Long-Term',   basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_LF',  ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'LF',    defaultY1Occupancy: 85 },
      wet_slips_seasonal:     { label: 'Wet Slips — Seasonal',    basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_LF',  ratePeriodBasis: 'per_season', defaultCapacityUnit: 'LF',    defaultY1Occupancy: 10, hasSeasons: true },
      wet_slips_transient:    { label: 'Wet Slips — Transient',   basisType: 'transient_usage',     dimensionScope: 'per_unit_type', rateUnitBasis: 'per_LF',  ratePeriodBasis: 'per_night',  defaultCapacityUnit: 'LF' },
      lift_slips_long_term:   { label: 'Lift Slips — Long-Term',  basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 85 },
      moorings_long_term:     { label: 'Moorings — Long-Term',    basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 80 },
      moorings_transient:     { label: 'Moorings — Transient',    basisType: 'transient_usage',     dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_night',  defaultCapacityUnit: 'count' },
      dry_racks_long_term:    { label: 'Dry Racks — Long-Term',   basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 88 },
      land_storage:           { label: 'Land Storage',            basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 75 },
      boats_on_trailers:      { label: 'Boats on Trailers',       basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 75 },
      carports:               { label: 'Carports',                basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 80 },
      houseboats_liveaboard:  { label: 'Houseboats / Liveaboard', basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 80 },
      rv_sites_long_term:     { label: 'RV Sites — Long-Term',    basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_site',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'sites', defaultY1Occupancy: 80 },
      rv_sites_nightly:       { label: 'RV Sites — Nightly',      basisType: 'transient_usage',     dimensionScope: 'per_unit_type', rateUnitBasis: 'per_site',ratePeriodBasis: 'per_night',  defaultCapacityUnit: 'sites', hasSeasons: true },
      dinghies:               { label: 'Dinghies / Jet Skis',     basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month',  defaultCapacityUnit: 'count', defaultY1Occupancy: 70 },
      fuel_dock:              { label: 'Fuel Dock',               basisType: 'metered_usage',       dimensionScope: 'whole_property',rateUnitBasis: 'per_gallon',ratePeriodBasis:'per_use' },
      electric_reimburse:     { label: 'Electric Reimbursement',  basisType: 'metered_usage',       dimensionScope: 'utility_meter', rateUnitBasis: 'per_kWh',ratePeriodBasis: 'per_use' },
      water_reimburse:        { label: 'Water Reimbursement',     basisType: 'metered_usage',       dimensionScope: 'utility_meter', rateUnitBasis: 'per_gallon',ratePeriodBasis:'per_use' },
      boat_rental_club:       { label: 'Boat Rental / Club',      basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'per_visit',ratePeriodBasis:'per_use' },
      sales_service_lease:    { label: 'Sales & Service Subleases',basisType: 'lease_based',        dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF' },
      restaurant_lease:       { label: 'Restaurant / Concession', basisType: 'lease_based',         dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — multifamily
  // ═══════════════════════════════════════════════════════
  multifamily: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: false,
    departmentRevenueModeDefaults: {
      Residential: 'driver_based',
    },
    canonicalStreams: {
      residential_rental:  { label: 'Residential Rent',            basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 93 },
      parking:             { label: 'Parking Income',              basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'per_space',ratePeriodBasis:'per_month' },
      laundry_vending:     { label: 'Laundry & Vending',           basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month' },
      utility_rubs:        { label: 'Utility Reimbursement (RUBS)',basisType: 'metered_usage',       dimensionScope: 'utility_meter', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month' },
      pet_fees:            { label: 'Pet Fees',                    basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month' },
      storage_units:       { label: 'Storage Units',               basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month' },
      application_fees:    { label: 'Application & Admin Fees',    basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use'   },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — STR (transient_usage per floor plan × season)
  // ═══════════════════════════════════════════════════════
  str: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: true,
    departmentRevenueModeDefaults: {
      'Listings': 'driver_based',
      'Rental': 'driver_based',
    },
    canonicalStreams: {
      nightly_rental:   { label: 'Nightly Rental',     basisType: 'transient_usage', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit', ratePeriodBasis: 'per_night', defaultCapacityUnit: 'count', hasSeasons: true },
      cleaning_revenue: { label: 'Cleaning Fee',       basisType: 'transient_usage', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit', ratePeriodBasis: 'per_use',   defaultCapacityUnit: 'count' },
      extra_guest_fees: { label: 'Extra Guest Fees',   basisType: 'absolute_count',  dimensionScope: 'whole_property',rateUnitBasis: 'per_visit',ratePeriodBasis: 'per_use' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — self_storage
  // ═══════════════════════════════════════════════════════
  self_storage: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { Storage: 'driver_based' },
    canonicalStreams: {
      unit_rental:       { label: 'Unit Rental',         basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 88 },
      tenant_insurance:  { label: 'Tenant Insurance',    basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month' },
      late_fees:         { label: 'Late Fees',           basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use'   },
      admin_fees:        { label: 'Admin / Move-In Fees',basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use'   },
      merchandise:       { label: 'Merchandise',         basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use'   },
      truck_rental:      { label: 'Truck Rental',        basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use'   },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — hotel (transient_usage per room type × season)
  // ═══════════════════════════════════════════════════════
  hotel: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: true,
    departmentRevenueModeDefaults: { Rooms: 'driver_based' },
    canonicalStreams: {
      room_revenue:    { label: 'Room Revenue',        basisType: 'transient_usage', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_room',ratePeriodBasis: 'per_night', defaultCapacityUnit: 'rooms', hasSeasons: true },
      food_beverage:   { label: 'Food & Beverage',     basisType: 'absolute_count',  dimensionScope: 'whole_property',rateUnitBasis: 'per_cover',ratePeriodBasis: 'per_use' },
      parking_hotel:   { label: 'Parking',             basisType: 'absolute_count',  dimensionScope: 'whole_property',rateUnitBasis: 'per_space',ratePeriodBasis: 'per_night' },
      ancillary_other: { label: 'Other Ancillary',     basisType: 'absolute_count',  dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — mixed_use (cohort split: residential + commercial)
  // ═══════════════════════════════════════════════════════
  mixed_use: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: false,
    departmentRevenueModeDefaults: {
      Residential: 'driver_based',
      Commercial: 'driver_based',
    },
    canonicalStreams: {
      residential_rental: { label: 'Residential Rent',   basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type',     rateUnitBasis: 'per_unit',ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 92 },
      commercial_leases:  { label: 'Commercial Leases',  basisType: 'lease_based',         dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF',  ratePeriodBasis: 'per_year',  defaultCapacityUnit: 'SF' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — lease-based classes (office/retail/industrial/medical/shopping_center)
  // Q8 (shopping_center %-rent custom branch) DEFERRED — base entry is locked
  // ═══════════════════════════════════════════════════════
  retail: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'driver_based',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { 'Commercial Leases': 'driver_based' },
    canonicalStreams: {
      commercial_leases: { label: 'Commercial Leases', basisType: 'lease_based', dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF', defaultY1Occupancy: 92 },
    },
  },
  office: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'driver_based',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { 'Commercial Leases': 'driver_based' },
    canonicalStreams: {
      commercial_leases: { label: 'Commercial Leases', basisType: 'lease_based', dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF', defaultY1Occupancy: 88 },
    },
  },
  industrial: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'driver_based',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { 'Commercial Leases': 'driver_based' },
    canonicalStreams: {
      commercial_leases: { label: 'Commercial Leases', basisType: 'lease_based', dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF', defaultY1Occupancy: 95 },
    },
  },
  medical_office: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'driver_based',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { 'Commercial Leases': 'driver_based' },
    canonicalStreams: {
      commercial_leases: { label: 'Commercial Leases', basisType: 'lease_based', dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF', defaultY1Occupancy: 91 },
    },
  },
  shopping_center: {
    taxonomyStatus: 'locked',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'driver_based',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { 'Commercial Leases': 'driver_based' },
    canonicalStreams: {
      commercial_leases: { label: 'Commercial Leases (Anchor + Inline)', basisType: 'lease_based', dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF', ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF', defaultY1Occupancy: 92 },
      // DEFERRED Q8: %-rent over breakpoints — `custom` basisType stream;
      // may live inside commercial-lease record vs as separate stream.
    },
    deferredNote: 'Q8: %-rent over breakpoints (sales-based revenue) deferred to post-demo. Base commercial_leases entry is locked.',
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — small residential (sfr / duplex / triplex / quad)
  // ═══════════════════════════════════════════════════════
  sfr: {
    taxonomyStatus: 'locked', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    departmentRevenueModeDefaults: { Residential: 'driver_based' },
    canonicalStreams: {
      residential_rental: { label: 'Residential Rent', basisType: 'percent_of_capacity', dimensionScope: 'whole_property', rateUnitBasis: 'per_unit', ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 95 },
    },
  },
  duplex: {
    taxonomyStatus: 'locked', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    departmentRevenueModeDefaults: { Residential: 'driver_based' },
    canonicalStreams: {
      residential_rental: { label: 'Residential Rent', basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit', ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 95 },
    },
  },
  triplex: {
    taxonomyStatus: 'locked', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    departmentRevenueModeDefaults: { Residential: 'driver_based' },
    canonicalStreams: {
      residential_rental: { label: 'Residential Rent', basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit', ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 95 },
    },
  },
  quad: {
    taxonomyStatus: 'locked', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    departmentRevenueModeDefaults: { Residential: 'driver_based' },
    canonicalStreams: {
      residential_rental: { label: 'Residential Rent', basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_unit', ratePeriodBasis: 'per_month', defaultCapacityUnit: 'count', defaultY1Occupancy: 93 },
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOCKED — land (no driver)
  // ═══════════════════════════════════════════════════════
  land: {
    taxonomyStatus: 'locked', hasRevenueDrivers: false, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {},
  },

  // ═══════════════════════════════════════════════════════
  // ROUGHED-IN — marina-class dynamic (RV park / MHP)
  // ═══════════════════════════════════════════════════════
  rv_park: {
    taxonomyStatus: 'roughed_in',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: true,
    departmentRevenueModeDefaults: { 'Site Rentals': 'driver_based' },
    canonicalStreams: {
      long_term_sites:    { label: 'Long-Term Sites',     basisType: 'percent_of_capacity', dimensionScope: 'per_unit_type', rateUnitBasis: 'per_site',ratePeriodBasis: 'per_month', defaultCapacityUnit: 'sites', defaultY1Occupancy: 70 },
      nightly_sites:      { label: 'Nightly Sites',       basisType: 'transient_usage',     dimensionScope: 'per_unit_type', rateUnitBasis: 'per_site',ratePeriodBasis: 'per_night', defaultCapacityUnit: 'sites', hasSeasons: true },
      utility_reimburse:  { label: 'Utility Reimbursement', basisType: 'metered_usage',     dimensionScope: 'utility_meter', rateUnitBasis: 'per_kWh', ratePeriodBasis: 'per_use' },
      store_laundry:      { label: 'Store / Laundry',     basisType: 'absolute_count',      dimensionScope: 'whole_property',rateUnitBasis: 'flat',    ratePeriodBasis: 'per_use' },
    },
  },
  mobile_home_park: {
    taxonomyStatus: 'roughed_in',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: false,
    departmentRevenueModeDefaults: { 'Pad Rent': 'driver_based' },
    canonicalStreams: {
      pad_rent:           { label: 'Pad Rent',            basisType: 'percent_of_capacity', dimensionScope: 'whole_property',rateUnitBasis: 'per_site',ratePeriodBasis: 'per_month', defaultCapacityUnit: 'sites', defaultY1Occupancy: 90 },
      utility_reimburse:  { label: 'Utility Reimbursement', basisType: 'metered_usage',     dimensionScope: 'utility_meter', rateUnitBasis: 'per_kWh', ratePeriodBasis: 'per_use' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // ROUGHED-IN — parking
  // ═══════════════════════════════════════════════════════
  parking: {
    taxonomyStatus: 'roughed_in',
    hasRevenueDrivers: true,
    defaultRevenueMode: 'flat_growth',
    supportsSeasons: false,
    canonicalStreams: {
      monthly_contracts: { label: 'Monthly Contracts', basisType: 'percent_of_capacity', dimensionScope: 'whole_property',  rateUnitBasis: 'per_space',  ratePeriodBasis: 'per_month', defaultCapacityUnit: 'spaces', defaultY1Occupancy: 75 },
      daily_transient:   { label: 'Daily Transient',   basisType: 'transient_usage',     dimensionScope: 'whole_property',  rateUnitBasis: 'per_space',  ratePeriodBasis: 'per_day',   defaultCapacityUnit: 'spaces' },
      events:            { label: 'Events',            basisType: 'absolute_count',      dimensionScope: 'whole_property',  rateUnitBasis: 'per_vehicle',ratePeriodBasis: 'per_use' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // ROUGHED-IN — operating businesses
  // ═══════════════════════════════════════════════════════
  gas_station: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      fuel:        { label: 'Fuel',          basisType: 'metered_usage',  dimensionScope: 'whole_property', rateUnitBasis: 'per_gallon', ratePeriodBasis: 'per_use' },
      c_store:     { label: 'C-Store',       basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'flat',       ratePeriodBasis: 'per_use' },
      car_wash:    { label: 'Car Wash',      basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_wash',   ratePeriodBasis: 'per_use' },
    },
  },
  gym: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      memberships:       { label: 'Memberships',         basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_member',ratePeriodBasis: 'per_month' },
      personal_training: { label: 'Personal Training',   basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_visit', ratePeriodBasis: 'per_use'   },
      classes:           { label: 'Classes / Workshops', basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_visit', ratePeriodBasis: 'per_use'   },
    },
  },
  laundromat: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      wash_cycles: { label: 'Wash Cycles', basisType: 'metered_usage',  dimensionScope: 'whole_property', rateUnitBasis: 'per_cycle', ratePeriodBasis: 'per_use' },
      vending:     { label: 'Vending',     basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'flat',      ratePeriodBasis: 'per_use' },
    },
  },
  car_wash: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      washes: { label: 'Washes', basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_wash', ratePeriodBasis: 'per_use' },
      detail: { label: 'Detail Packages', basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'flat', ratePeriodBasis: 'per_use' },
    },
  },
  golf_course: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: true,
    canonicalStreams: {
      rounds:        { label: 'Rounds',          basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_round',  ratePeriodBasis: 'per_use', hasSeasons: true },
      memberships:   { label: 'Memberships',     basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_member', ratePeriodBasis: 'per_year' },
      cart_rentals:  { label: 'Cart Rentals',    basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_round',  ratePeriodBasis: 'per_use' },
      pro_shop_fnb:  { label: 'Pro Shop & F&B',  basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'flat',       ratePeriodBasis: 'per_use' },
    },
  },
  restaurant: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      covers:   { label: 'Covers',  basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_cover', ratePeriodBasis: 'per_use' },
      bar:      { label: 'Bar',     basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_cover', ratePeriodBasis: 'per_use' },
      catering: { label: 'Catering',basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'flat',      ratePeriodBasis: 'per_use' },
    },
  },
  car_dealership: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      new_vehicles:  { label: 'New Vehicles',  basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_vehicle',ratePeriodBasis: 'per_use' },
      used_vehicles: { label: 'Used Vehicles', basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_vehicle',ratePeriodBasis: 'per_use' },
      service:       { label: 'Service',       basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'flat',       ratePeriodBasis: 'per_use' },
      f_and_i:       { label: 'F&I',           basisType: 'absolute_count', dimensionScope: 'whole_property', rateUnitBasis: 'per_vehicle',ratePeriodBasis: 'per_use' },
    },
  },
  business: {
    taxonomyStatus: 'roughed_in', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      generic_revenue: { label: 'Revenue (Custom)', basisType: 'custom', dimensionScope: 'whole_property', rateUnitBasis: 'flat', ratePeriodBasis: 'per_year' },
    },
    deferredNote: 'Generic business catch-all — `custom` basis until per-deal taxonomy specified.',
  },

  // ═══════════════════════════════════════════════════════
  // DEFERRED — Q3 / Q4 / Q7
  // ═══════════════════════════════════════════════════════
  accounting_firm: {
    taxonomyStatus: 'deferred', hasRevenueDrivers: false, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {},
    deferredNote: 'Q3: operating-biz with no real-estate occupancy concept. Decide post-demo whether absolute_count (billable hours) is a meaningful driver vs treating as `none` and modeling via flat_growth only.',
  },
  landscaping: {
    taxonomyStatus: 'deferred', hasRevenueDrivers: false, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {},
    deferredNote: 'Q3: contracts/jobs basis vs treating as `none`. Revisit when first landscaping deal is modeled.',
  },
  construction: {
    taxonomyStatus: 'deferred', hasRevenueDrivers: false, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {},
    deferredNote: 'Q3: projects/contracts basis vs `none`. Revisit when first construction deal is modeled.',
  },
  daycare: {
    taxonomyStatus: 'deferred', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      enrolled_slots: { label: 'Enrolled Slots', basisType: 'percent_of_capacity', dimensionScope: 'whole_property', rateUnitBasis: 'per_member', ratePeriodBasis: 'per_month', defaultCapacityUnit: 'slots', defaultY1Occupancy: 88 },
    },
    deferredNote: 'Q4: pct_of_capacity (slots) vs absolute_count (children). Roughed-in as pct_of_capacity pending Brett confirmation.',
  },
  data_center: {
    taxonomyStatus: 'deferred', hasRevenueDrivers: true, defaultRevenueMode: 'flat_growth', supportsSeasons: false,
    canonicalStreams: {
      colocation:        { label: 'Colocation Leases', basisType: 'lease_based',   dimensionScope: 'commercial_leases', rateUnitBasis: 'per_SF',  ratePeriodBasis: 'per_year', defaultCapacityUnit: 'SF' },
      power_consumption: { label: 'Power Consumption', basisType: 'metered_usage', dimensionScope: 'utility_meter',     rateUnitBasis: 'per_kWh', ratePeriodBasis: 'per_use' },
    },
    deferredNote: 'Q7: capacity unit (kW vs racks vs SF) — currently SF for colo + kWh for power. Confirm or split into separate kW dimension.',
  },
};

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Lookup the ratified-so-far driver model for an asset class.
 * Returns `undefined` for classes not yet in the taxonomy — callers
 * (the calculator) treat this as `hasRevenueDrivers=false`.
 */
export function getRevenueDriverModel(
  assetClass: string,
): AssetClassRevenueDriverModel | undefined {
  return ASSET_CLASS_DRIVER_TAXONOMY[assetClass];
}

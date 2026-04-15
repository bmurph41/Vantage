/**
 * Asset Class Field Configuration
 * 
 * Drives dynamic field rendering in detail drawers and form modals.
 * Each asset class defines its unique metrics, KPIs, and field groups.
 * 
 * Supports: Marina, Multifamily, Retail, Office, Industrial, Self-Storage, Mixed-Use
 */

import {
  Anchor, Building2, Store, Briefcase, Warehouse, Box, Layers,
  DollarSign, TrendingUp, Users, MapPin, Calendar, BarChart3,
  Droplets, Ship, Fuel, Car, Ruler, Home, Key, Clock
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

export type AssetClass =
  | "marina"
  | "multifamily"
  | "retail"
  | "office"
  | "industrial"
  | "self_storage"
  | "mixed_use"
  | "business";

export interface FieldDefinition {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "percent" | "select" | "date" | "textarea";
  group: string;
  icon?: LucideIcon;
  placeholder?: string;
  options?: { value: string; label: string }[];
  suffix?: string;
  required?: boolean;
  tooltip?: string;
}

export interface KPIDefinition {
  key: string;
  label: string;
  format: "currency" | "percent" | "number" | "ratio";
  icon: LucideIcon;
  color: string;       // Tailwind color class
  compute?: (entity: Record<string, any>) => number | null;
  tooltip?: string;
}

export interface AssetClassConfig {
  id: AssetClass;
  label: string;
  icon: LucideIcon;
  color: string;        // Tailwind bg class for badges
  textColor: string;    // Tailwind text class
  borderColor: string;  // Tailwind border class
  fields: FieldDefinition[];
  kpis: KPIDefinition[];
  fieldGroups: { key: string; label: string; icon: LucideIcon; defaultOpen?: boolean }[];
}

// ─── Shared Fields (appear in all asset classes) ──────────────────

const sharedFields: FieldDefinition[] = [
  { key: "askingPrice", label: "Asking Price", type: "currency", group: "financials", icon: DollarSign, required: true },
  { key: "offerPrice", label: "Offer Price", type: "currency", group: "financials", icon: DollarSign },
  { key: "noi", label: "NOI", type: "currency", group: "financials", icon: TrendingUp, tooltip: "Net Operating Income" },
  { key: "capRate", label: "Cap Rate", type: "percent", group: "financials", icon: BarChart3 },
  { key: "pricePerUnit", label: "Price / Unit", type: "currency", group: "financials", icon: DollarSign },
  { key: "yearBuilt", label: "Year Built", type: "number", group: "property", icon: Calendar },
  { key: "lotSize", label: "Lot Size (acres)", type: "number", group: "property", icon: MapPin, suffix: "ac" },
  { key: "zoning", label: "Zoning", type: "text", group: "property", icon: Ruler },
  { key: "market", label: "Market / MSA", type: "text", group: "location", icon: MapPin },
  { key: "submarket", label: "Submarket", type: "text", group: "location" },
];

const sharedKPIs: KPIDefinition[] = [
  {
    key: "capRate",
    label: "Cap Rate",
    format: "percent",
    icon: BarChart3,
    color: "text-blue-600",
    compute: (e) => e.noi && e.askingPrice ? (e.noi / e.askingPrice) * 100 : null,
    tooltip: "NOI / Purchase Price"
  },
  {
    key: "noi",
    label: "NOI",
    format: "currency",
    icon: TrendingUp,
    color: "text-green-600",
    compute: (e) => e.noi ?? null
  },
];

// ─── Marina ───────────────────────────────────────────────────────

const marinaConfig: AssetClassConfig = {
  id: "marina",
  label: "Marina",
  icon: Anchor,
  color: "bg-blue-100 dark:bg-blue-900/30",
  textColor: "text-blue-700 dark:text-blue-300",
  borderColor: "border-blue-300 dark:border-blue-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "capacity", label: "Marina Capacity", icon: Ship, defaultOpen: true },
    { key: "operations", label: "Operations", icon: TrendingUp, defaultOpen: false },
    { key: "revenue", label: "Revenue Streams", icon: Fuel, defaultOpen: false },
    { key: "physical", label: "Physical Details", icon: MapPin, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    // Capacity
    { key: "wetSlips", label: "Wet Slips", type: "number", group: "capacity", icon: Anchor, required: true },
    { key: "drySlips", label: "Dry Storage Units", type: "number", group: "capacity", icon: Warehouse },
    { key: "moorings", label: "Moorings", type: "number", group: "capacity", icon: Anchor },
    { key: "transientSlips", label: "Transient Slips", type: "number", group: "capacity", icon: Ship, tooltip: "Slips reserved for transient/short-term guests" },
    { key: "liveaboardSlips", label: "Liveaboard Slips", type: "number", group: "capacity", icon: Anchor, tooltip: "Slips designated for liveaboards" },
    { key: "coveredSlips", label: "Covered Slips", type: "number", group: "capacity", icon: Warehouse },
    { key: "endTieSlips", label: "End-Tie Slips", type: "number", group: "capacity", icon: Anchor },
    { key: "totalCapacity", label: "Total Capacity", type: "number", group: "capacity", icon: Ship },
    { key: "waitlistCount", label: "Waitlist Slots", type: "number", group: "capacity", icon: Users, tooltip: "Number of boaters on the waiting list" },
    { key: "maxBoatLength", label: "Max LOA (ft)", type: "number", group: "capacity", icon: Ruler, suffix: "ft" },
    { key: "maxDraft", label: "Max Draft (ft)", type: "number", group: "capacity", icon: Droplets, suffix: "ft" },
    { key: "maxBeam", label: "Max Beam (ft)", type: "number", group: "capacity", icon: Ruler, suffix: "ft" },
    // Operations
    { key: "occupancyRate", label: "Occupancy Rate", type: "percent", group: "operations", icon: BarChart3 },
    { key: "avgMonthlySlipRate", label: "Avg Monthly Slip Rate", type: "currency", group: "operations", icon: DollarSign, suffix: "/mo", tooltip: "Average monthly rental rate per slip" },
    { key: "peakOccupancy", label: "Peak Season Occupancy", type: "percent", group: "operations", icon: TrendingUp },
    { key: "offSeasonOccupancy", label: "Off-Season Occupancy", type: "percent", group: "operations", icon: TrendingUp },
    { key: "annualContractPct", label: "Annual Contract %", type: "percent", group: "operations", tooltip: "% of slips on annual contracts vs. transient" },
    { key: "noi", label: "NOI", type: "currency", group: "operations", icon: DollarSign, tooltip: "Net Operating Income" },
    { key: "ebitda", label: "EBITDA", type: "currency", group: "operations", icon: DollarSign },
    { key: "opexRatio", label: "OpEx Ratio", type: "percent", group: "operations", icon: BarChart3, tooltip: "Operating Expenses / EGI" },
    // Revenue Streams
    { key: "slipRevenue", label: "Slip Revenue", type: "currency", group: "revenue", icon: DollarSign },
    { key: "fuelRevenue", label: "Fuel Revenue", type: "currency", group: "revenue", icon: Fuel },
    { key: "serviceRevenue", label: "Service/Repair Revenue", type: "currency", group: "revenue", icon: DollarSign },
    { key: "retailRevenue", label: "Ship Store / Retail", type: "currency", group: "revenue", icon: Store },
    { key: "storageRevenue", label: "Storage Revenue", type: "currency", group: "revenue", icon: Box },
    { key: "otherRevenue", label: "Other Revenue", type: "currency", group: "revenue", icon: DollarSign },
    { key: "hasFuelDock", label: "Fuel Dock", type: "select", group: "revenue", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    { key: "fuelType", label: "Fuel Types", type: "select", group: "revenue", options: [
      { value: "gas_diesel", label: "Gas & Diesel" }, { value: "gas_only", label: "Gas Only" },
      { value: "diesel_only", label: "Diesel Only" }, { value: "none", label: "None" },
    ]},
    { key: "hasBoatyard", label: "Boatyard/Haul-out", type: "select", group: "revenue", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    { key: "hasShipStore", label: "Ship Store", type: "select", group: "revenue", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    { key: "hasRestaurant", label: "Restaurant / Bar", type: "select", group: "revenue", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    // Physical Details
    { key: "acreage", label: "Acreage", type: "number", group: "physical", icon: MapPin, suffix: "ac" },
    { key: "waterFrontageFt", label: "Water Frontage (ft)", type: "number", group: "physical", icon: Droplets, suffix: "ft" },
    { key: "buildingSqFt", label: "Building SF", type: "number", group: "physical", icon: Warehouse, suffix: "SF" },
    { key: "bathrooms", label: "Restrooms / Showers", type: "number", group: "physical", icon: Anchor },
    { key: "parkingSpaces", label: "Parking Spaces", type: "number", group: "physical" },
    { key: "dockMaterial", label: "Dock Material", type: "select", group: "physical", options: [
      { value: "concrete", label: "Concrete" }, { value: "wood", label: "Wood" },
      { value: "aluminum", label: "Aluminum" }, { value: "composite", label: "Composite" },
      { value: "floating_concrete", label: "Floating Concrete" }, { value: "mixed", label: "Mixed" },
    ]},
    { key: "hasPhaseI", label: "Phase I ESA", type: "select", group: "physical", options: [{ value: "yes", label: "Completed" }, { value: "no", label: "Not Done" }, { value: "pending", label: "In Progress" }], tooltip: "Phase I Environmental Site Assessment" },
    { key: "inFloodZone", label: "Flood Zone", type: "select", group: "physical", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    { key: "hasWetlands", label: "Wetlands Present", type: "select", group: "physical", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "revenuePerSlip",
      label: "Rev / Slip",
      format: "currency",
      icon: Anchor,
      color: "text-cyan-600",
      compute: (e) => {
        const totalSlips = (e.wetSlips || 0) + (e.drySlips || 0);
        const totalRev = (e.slipRevenue || 0) + (e.fuelRevenue || 0) + (e.serviceRevenue || 0) + (e.retailRevenue || 0) + (e.storageRevenue || 0);
        return totalSlips > 0 ? totalRev / totalSlips : null;
      },
      tooltip: "Total Revenue / Total Slips"
    },
    {
      key: "pricePerSlip",
      label: "Price / Slip",
      format: "currency",
      icon: Ship,
      color: "text-blue-700",
      compute: (e) => {
        const totalSlips = (e.wetSlips || 0) + (e.drySlips || 0) + (e.moorings || 0);
        return totalSlips > 0 && e.askingPrice ? e.askingPrice / totalSlips : null;
      },
      tooltip: "Asking Price / Total Slips"
    },
    {
      key: "occupancyRate",
      label: "Occupancy",
      format: "percent",
      icon: Ship,
      color: "text-indigo-600",
      compute: (e) => e.occupancyRate ?? null
    },
    {
      key: "noiPerSlip",
      label: "NOI / Slip",
      format: "currency",
      icon: DollarSign,
      color: "text-emerald-600",
      compute: (e) => {
        const totalSlips = (e.wetSlips || 0) + (e.drySlips || 0);
        return totalSlips > 0 && e.noi ? e.noi / totalSlips : null;
      },
      tooltip: "NOI / Total Slips"
    },
  ],
};

// ─── Multifamily ──────────────────────────────────────────────────

const multifamilyConfig: AssetClassConfig = {
  id: "multifamily",
  label: "Multifamily",
  icon: Home,
  color: "bg-purple-100 dark:bg-purple-900/30",
  textColor: "text-purple-700 dark:text-purple-300",
  borderColor: "border-purple-300 dark:border-purple-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "units", label: "Unit Mix", icon: Home, defaultOpen: true },
    { key: "operations", label: "Operations", icon: TrendingUp, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    // Unit Mix
    { key: "totalUnits", label: "Total Units", type: "number", group: "units", icon: Home, required: true },
    { key: "studios", label: "Studios", type: "number", group: "units" },
    { key: "oneBed", label: "1-Bed", type: "number", group: "units" },
    { key: "twoBed", label: "2-Bed", type: "number", group: "units" },
    { key: "threePlusBed", label: "3+ Bed", type: "number", group: "units" },
    { key: "avgSqFt", label: "Avg Unit SF", type: "number", group: "units", suffix: "SF" },
    { key: "buildingClass", label: "Building Class", type: "select", group: "units", options: [
      { value: "A", label: "Class A" }, { value: "B", label: "Class B" },
      { value: "C", label: "Class C" }, { value: "D", label: "Class D" },
    ]},
    // Operations
    { key: "avgRent", label: "Avg Rent / Unit", type: "currency", group: "operations", icon: DollarSign },
    { key: "marketRent", label: "Market Rent / Unit", type: "currency", group: "operations", icon: DollarSign },
    { key: "occupancyRate", label: "Occupancy Rate", type: "percent", group: "operations", icon: BarChart3 },
    { key: "rentGrowth", label: "YoY Rent Growth", type: "percent", group: "operations", icon: TrendingUp },
    { key: "opexRatio", label: "OpEx Ratio", type: "percent", group: "operations", icon: BarChart3, tooltip: "Operating Expenses / EGI" },
    { key: "turnoverRate", label: "Turnover Rate", type: "percent", group: "operations" },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "pricePerUnit",
      label: "Price / Unit",
      format: "currency",
      icon: Home,
      color: "text-purple-600",
      compute: (e) => e.totalUnits && e.askingPrice ? e.askingPrice / e.totalUnits : null
    },
    {
      key: "rentSpread",
      label: "Rent Spread",
      format: "percent",
      icon: TrendingUp,
      color: "text-amber-600",
      compute: (e) => e.avgRent && e.marketRent ? ((e.marketRent - e.avgRent) / e.avgRent) * 100 : null,
      tooltip: "(Market Rent - In-Place) / In-Place"
    },
  ],
};

// ─── Retail ───────────────────────────────────────────────────────

const retailConfig: AssetClassConfig = {
  id: "retail",
  label: "Retail",
  icon: Store,
  color: "bg-amber-100 dark:bg-amber-900/30",
  textColor: "text-amber-700 dark:text-amber-300",
  borderColor: "border-amber-300 dark:border-amber-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "tenants", label: "Tenant Profile", icon: Users, defaultOpen: true },
    { key: "lease", label: "Lease Details", icon: Key, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    // Tenants
    { key: "totalSF", label: "Total SF", type: "number", group: "tenants", icon: Ruler, required: true, suffix: "SF" },
    { key: "tenantCount", label: "Tenant Count", type: "number", group: "tenants", icon: Users },
    { key: "anchorTenant", label: "Anchor Tenant", type: "text", group: "tenants" },
    { key: "anchorPctGLA", label: "Anchor % of GLA", type: "percent", group: "tenants" },
    { key: "occupancyRate", label: "Occupancy Rate", type: "percent", group: "tenants", icon: BarChart3 },
    { key: "retailType", label: "Property Type", type: "select", group: "tenants", options: [
      { value: "strip", label: "Strip Center" }, { value: "neighborhood", label: "Neighborhood Center" },
      { value: "power", label: "Power Center" }, { value: "lifestyle", label: "Lifestyle Center" },
      { value: "outlet", label: "Outlet Mall" }, { value: "single_tenant", label: "Single Tenant NNN" },
    ]},
    // Lease
    { key: "walt", label: "WALT (years)", type: "number", group: "lease", icon: Clock, suffix: "yrs", tooltip: "Weighted Average Lease Term" },
    { key: "avgRentPSF", label: "Avg Rent / SF", type: "currency", group: "lease", suffix: "/SF" },
    { key: "nnnPct", label: "NNN %", type: "percent", group: "lease", tooltip: "% of tenants on NNN leases" },
    { key: "nearTermExpiry", label: "Near-Term Expiry %", type: "percent", group: "lease", tooltip: "% of GLA expiring in 24 months" },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "pricePerSF",
      label: "Price / SF",
      format: "currency",
      icon: Ruler,
      color: "text-amber-600",
      compute: (e) => e.totalSF && e.askingPrice ? e.askingPrice / e.totalSF : null
    },
    {
      key: "walt",
      label: "WALT",
      format: "number",
      icon: Clock,
      color: "text-orange-600",
      compute: (e) => e.walt ?? null,
      tooltip: "Weighted Average Lease Term"
    },
  ],
};

// ─── Office ───────────────────────────────────────────────────────

const officeConfig: AssetClassConfig = {
  id: "office",
  label: "Office",
  icon: Briefcase,
  color: "bg-slate-100 dark:bg-slate-900/30",
  textColor: "text-slate-700 dark:text-slate-300",
  borderColor: "border-slate-300 dark:border-slate-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "tenants", label: "Tenant Profile", icon: Users, defaultOpen: true },
    { key: "lease", label: "Lease Details", icon: Key, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    { key: "totalSF", label: "Total RSF", type: "number", group: "tenants", icon: Ruler, required: true, suffix: "SF" },
    { key: "tenantCount", label: "Tenant Count", type: "number", group: "tenants", icon: Users },
    { key: "majorTenant", label: "Major Tenant", type: "text", group: "tenants" },
    { key: "majorTenantPct", label: "Major Tenant % GLA", type: "percent", group: "tenants" },
    { key: "occupancyRate", label: "Occupancy Rate", type: "percent", group: "tenants", icon: BarChart3 },
    { key: "officeClass", label: "Office Class", type: "select", group: "tenants", options: [
      { value: "A", label: "Class A" }, { value: "B", label: "Class B" },
      { value: "C", label: "Class C" }, { value: "trophy", label: "Trophy" },
    ]},
    { key: "walt", label: "WALT (years)", type: "number", group: "lease", icon: Clock, suffix: "yrs" },
    { key: "avgRentPSF", label: "Avg Rent / SF", type: "currency", group: "lease", suffix: "/SF" },
    { key: "parkingRatio", label: "Parking Ratio", type: "text", group: "property", icon: Car, placeholder: "e.g. 4:1000" },
    { key: "floors", label: "Floors", type: "number", group: "property", icon: Building2 },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "pricePerSF",
      label: "Price / SF",
      format: "currency",
      icon: Ruler,
      color: "text-slate-600",
      compute: (e) => e.totalSF && e.askingPrice ? e.askingPrice / e.totalSF : null
    },
    {
      key: "walt",
      label: "WALT",
      format: "number",
      icon: Clock,
      color: "text-gray-600",
      compute: (e) => e.walt ?? null,
    },
  ],
};

// ─── Industrial ───────────────────────────────────────────────────

const industrialConfig: AssetClassConfig = {
  id: "industrial",
  label: "Industrial",
  icon: Warehouse,
  color: "bg-orange-100 dark:bg-orange-900/30",
  textColor: "text-orange-700 dark:text-orange-300",
  borderColor: "border-orange-300 dark:border-orange-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "specs", label: "Building Specs", icon: Warehouse, defaultOpen: true },
    { key: "lease", label: "Lease Details", icon: Key, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    { key: "totalSF", label: "Total SF", type: "number", group: "specs", icon: Ruler, required: true, suffix: "SF" },
    { key: "clearHeight", label: "Clear Height (ft)", type: "number", group: "specs", suffix: "ft" },
    { key: "dockDoors", label: "Dock Doors", type: "number", group: "specs" },
    { key: "driveInDoors", label: "Drive-In Doors", type: "number", group: "specs" },
    { key: "officePct", label: "Office %", type: "percent", group: "specs" },
    { key: "industrialType", label: "Type", type: "select", group: "specs", options: [
      { value: "warehouse", label: "Warehouse/Distribution" },
      { value: "flex", label: "Flex" },
      { value: "manufacturing", label: "Manufacturing" },
      { value: "cold_storage", label: "Cold Storage" },
      { value: "last_mile", label: "Last Mile" },
    ]},
    { key: "occupancyRate", label: "Occupancy Rate", type: "percent", group: "specs", icon: BarChart3 },
    { key: "walt", label: "WALT (years)", type: "number", group: "lease", icon: Clock, suffix: "yrs" },
    { key: "avgRentPSF", label: "Avg Rent / SF", type: "currency", group: "lease", suffix: "/SF" },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "pricePerSF",
      label: "Price / SF",
      format: "currency",
      icon: Ruler,
      color: "text-orange-600",
      compute: (e) => e.totalSF && e.askingPrice ? e.askingPrice / e.totalSF : null
    },
    {
      key: "occupancyRate",
      label: "Occupancy",
      format: "percent",
      icon: Warehouse,
      color: "text-orange-500",
      compute: (e) => e.occupancyRate ?? null
    },
  ],
};

// ─── Self-Storage ─────────────────────────────────────────────────

const selfStorageConfig: AssetClassConfig = {
  id: "self_storage",
  label: "Self-Storage",
  icon: Box,
  color: "bg-teal-100 dark:bg-teal-900/30",
  textColor: "text-teal-700 dark:text-teal-300",
  borderColor: "border-teal-300 dark:border-teal-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "units", label: "Unit Mix", icon: Box, defaultOpen: true },
    { key: "operations", label: "Operations", icon: TrendingUp, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    { key: "totalUnits", label: "Total Units", type: "number", group: "units", icon: Box, required: true },
    { key: "netRentableSF", label: "Net Rentable SF", type: "number", group: "units", suffix: "SF" },
    { key: "climatePct", label: "Climate Controlled %", type: "percent", group: "units" },
    { key: "avgUnitSize", label: "Avg Unit Size (SF)", type: "number", group: "units", suffix: "SF" },
    { key: "occupancyRate", label: "Occupancy Rate", type: "percent", group: "operations", icon: BarChart3 },
    { key: "ecri", label: "ECRI Upside", type: "percent", group: "operations", tooltip: "Existing Customer Rate Increase potential" },
    { key: "streetRate", label: "Avg Street Rate / SF", type: "currency", group: "operations", suffix: "/SF" },
    { key: "revenuePerSF", label: "Revenue / SF", type: "currency", group: "operations", suffix: "/SF" },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "pricePerSF",
      label: "Price / SF",
      format: "currency",
      icon: Ruler,
      color: "text-teal-600",
      compute: (e) => e.netRentableSF && e.askingPrice ? e.askingPrice / e.netRentableSF : null
    },
    {
      key: "occupancyRate",
      label: "Occupancy",
      format: "percent",
      icon: Box,
      color: "text-teal-500",
      compute: (e) => e.occupancyRate ?? null
    },
  ],
};

// ─── Mixed-Use ────────────────────────────────────────────────────

const mixedUseConfig: AssetClassConfig = {
  id: "mixed_use",
  label: "Mixed-Use",
  icon: Layers,
  color: "bg-rose-100 dark:bg-rose-900/30",
  textColor: "text-rose-700 dark:text-rose-300",
  borderColor: "border-rose-300 dark:border-rose-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "components", label: "Component Breakdown", icon: Layers, defaultOpen: true },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    { key: "totalSF", label: "Total SF", type: "number", group: "components", icon: Ruler, required: true, suffix: "SF" },
    { key: "residentialUnits", label: "Residential Units", type: "number", group: "components", icon: Home },
    { key: "retailSF", label: "Retail SF", type: "number", group: "components", suffix: "SF" },
    { key: "officeSF", label: "Office SF", type: "number", group: "components", suffix: "SF" },
    { key: "otherSF", label: "Other SF", type: "number", group: "components", suffix: "SF" },
    { key: "occupancyRate", label: "Blended Occupancy", type: "percent", group: "components", icon: BarChart3 },
  ],
  kpis: [
    ...sharedKPIs,
    {
      key: "pricePerSF",
      label: "Price / SF",
      format: "currency",
      icon: Ruler,
      color: "text-rose-600",
      compute: (e) => e.totalSF && e.askingPrice ? e.askingPrice / e.totalSF : null
    },
    {
      key: "occupancyRate",
      label: "Occupancy",
      format: "percent",
      icon: Layers,
      color: "text-rose-500",
      compute: (e) => e.occupancyRate ?? null
    },
  ],
};

// ─── Business / Operating Company ────────────────────────────────

const businessConfig: AssetClassConfig = {
  id: "business",
  label: "Business Acquisition",
  icon: Briefcase,
  color: "bg-emerald-100 dark:bg-emerald-900/30",
  textColor: "text-emerald-700 dark:text-emerald-300",
  borderColor: "border-emerald-300 dark:border-emerald-700",
  fieldGroups: [
    { key: "financials", label: "Deal Financials", icon: DollarSign, defaultOpen: true },
    { key: "operations", label: "Operations", icon: Users, defaultOpen: true },
    { key: "revenue", label: "Revenue Profile", icon: TrendingUp, defaultOpen: false },
    { key: "property", label: "Property Details", icon: MapPin, defaultOpen: false },
    { key: "location", label: "Location", icon: MapPin, defaultOpen: false },
  ],
  fields: [
    ...sharedFields,
    // Financials — override pricePerUnit label
    { key: "sde", label: "SDE", type: "currency", group: "financials", icon: DollarSign, tooltip: "Seller's Discretionary Earnings" },
    { key: "ebitda", label: "EBITDA", type: "currency", group: "financials", icon: DollarSign },
    { key: "grossMargin", label: "Gross Margin", type: "percent", group: "financials", icon: BarChart3 },
    { key: "annualRevenue", label: "Annual Revenue", type: "currency", group: "financials", icon: TrendingUp },
    // Operations
    { key: "employeeCount", label: "Employees (FTEs)", type: "number", group: "operations", icon: Users },
    { key: "yearsInOperation", label: "Years in Operation", type: "number", group: "operations", icon: Calendar },
    { key: "numberOfLocations", label: "Locations", type: "number", group: "operations" },
    { key: "ownerInvolved", label: "Owner Involvement", type: "select", group: "operations", options: [
      { value: "absentee", label: "Absentee" }, { value: "semi_absentee", label: "Semi-Absentee" },
      { value: "owner_operated", label: "Owner-Operated" },
    ]},
    // Revenue Profile
    { key: "recurringRevenuePct", label: "Recurring Revenue %", type: "percent", group: "revenue", icon: TrendingUp, tooltip: "% of revenue from contracts or repeat customers" },
    { key: "customerConcentration", label: "Top Customer % Rev", type: "percent", group: "revenue", tooltip: "Revenue from single largest customer" },
    { key: "contractBacklog", label: "Contract Backlog", type: "currency", group: "revenue", tooltip: "Signed but unperformed contracts" },
    { key: "customerCount", label: "Active Customers", type: "number", group: "revenue" },
    { key: "avgContractValue", label: "Avg Contract Value", type: "currency", group: "revenue" },
  ],
  kpis: [
    {
      key: "sdeMultiple",
      label: "SDE Multiple",
      format: "ratio",
      icon: BarChart3,
      color: "text-emerald-600",
      compute: (e) => e.sde && e.askingPrice ? e.askingPrice / e.sde : null,
      tooltip: "Asking Price / SDE"
    },
    {
      key: "ebitdaMultiple",
      label: "EBITDA Multiple",
      format: "ratio",
      icon: TrendingUp,
      color: "text-emerald-500",
      compute: (e) => e.ebitda && e.askingPrice ? e.askingPrice / e.ebitda : null,
      tooltip: "Asking Price / EBITDA"
    },
    {
      key: "revenuePerEmployee",
      label: "Rev / Employee",
      format: "currency",
      icon: Users,
      color: "text-blue-600",
      compute: (e) => e.annualRevenue && e.employeeCount ? e.annualRevenue / e.employeeCount : null,
      tooltip: "Annual Revenue / Headcount"
    },
    {
      key: "recurringRevenuePct",
      label: "Recurring Rev %",
      format: "percent",
      icon: TrendingUp,
      color: "text-green-600",
      compute: (e) => e.recurringRevenuePct ?? null,
      tooltip: "Contracted or repeat revenue share"
    },
  ],
};

// ─── Registry ─────────────────────────────────────────────────────

export const ASSET_CLASS_CONFIGS: Record<AssetClass, AssetClassConfig> = {
  marina: marinaConfig,
  multifamily: multifamilyConfig,
  retail: retailConfig,
  office: officeConfig,
  industrial: industrialConfig,
  self_storage: selfStorageConfig,
  mixed_use: mixedUseConfig,
  business: businessConfig,
};

/**
 * Returns the static icon/KPI field config for a given asset class key.
 * For DB-driven label and enabled state, use the `useAssetClasses()` hook instead.
 */
export function getAssetClassConfig(assetClass: string | null | undefined): AssetClassConfig {
  return ASSET_CLASS_CONFIGS[(assetClass as AssetClass)] || ASSET_CLASS_CONFIGS.marina;
}

// ─── Formatting Utilities ─────────────────────────────────────────

export function formatKPIValue(value: number | null, format: KPIDefinition["format"]): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  switch (format) {
    case "currency":
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value.toLocaleString()}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2);
    case "number":
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    default:
      return String(value);
  }
}

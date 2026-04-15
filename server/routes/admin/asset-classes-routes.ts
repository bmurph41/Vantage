/**
 * Dynamic Asset Class Routes
 *
 * Public:
 *   GET  /api/asset-classes           — List ALL asset classes (enabled + disabled) with cache headers
 *
 * Admin (requireRole "owner"):
 *   GET    /api/admin/asset-classes        — List all (including disabled)
 *   POST   /api/admin/asset-classes        — Create new asset class
 *   PATCH  /api/admin/asset-classes/:key   — Update existing
 *   DELETE /api/admin/asset-classes/:key   — Delete
 *   POST   /api/admin/asset-classes/seed   — Seed all 36 canonical types (idempotent)
 */

import { Router, Request, Response } from "express";
import { db } from "../../db";
import { platformAssetClasses } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "../../middleware/rbac";

// Helper: cast a value to the unknown type required by Drizzle's jsonb columns
function jsonb<T>(val: T): unknown { return val as unknown; }

export const publicAssetClassRouter = Router();
export const adminAssetClassRouter = Router();

// ─── Startup Seed Function (canonical 36 types) ───────────────────────────────

/**
 * Seeds all 36 canonical asset class types at startup.
 * Idempotent: inserts new rows and backfills dynamic fields on existing ones.
 * Called from server/index.ts alongside other startup seeds (seedMarinaTaxonomyPack, etc).
 * CANONICAL_ASSET_CLASSES is initialized before this is ever invoked (module-level const).
 */
export async function seedCanonicalAssetClasses(): Promise<void> {
  let seeded = 0;
  let updated = 0;
  for (const item of CANONICAL_ASSET_CLASSES) {
    const existing = await db
      .select({ id: platformAssetClasses.id })
      .from(platformAssetClasses)
      .where(eq(platformAssetClasses.key, item.key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(platformAssetClasses).values({
        key: item.key,
        label: item.label,
        shortLabel: item.shortLabel ?? null,
        category: item.category,
        icon: item.icon ?? null,
        enabled: item.enabled ?? false,
        sortOrder: item.sortOrder ?? 0,
        sizeLabel: item.sizeLabel ?? null,
        occLabel: item.occLabel ?? null,
        priceUnit: item.priceUnit ?? null,
        revenueStreams: jsonb(item.revenueStreams ?? []),
        demandKey: item.demandKey ?? null,
        group: item.group ?? null,
        color: item.color ?? null,
        config: jsonb({}),
        enabledModules: jsonb(item.enabledModules ?? []),
        defaultDataSources: jsonb(item.defaultDataSources ?? []),
      });
      seeded++;
    } else {
      // Update ALL canonical fields so preexisting rows stay fully normalized
      await db.update(platformAssetClasses)
        .set({
          label: item.label,
          shortLabel: item.shortLabel ?? null,
          category: item.category,
          icon: item.icon ?? null,
          sortOrder: item.sortOrder ?? 0,
          enabledModules: jsonb(item.enabledModules ?? []),
          defaultDataSources: jsonb(item.defaultDataSources ?? []),
          sizeLabel: item.sizeLabel ?? null,
          occLabel: item.occLabel ?? null,
          priceUnit: item.priceUnit ?? null,
          revenueStreams: jsonb(item.revenueStreams ?? []),
          demandKey: item.demandKey ?? null,
          group: item.group ?? null,
          color: item.color ?? null,
          updatedAt: new Date(),
        })
        .where(eq(platformAssetClasses.key, item.key));
      updated++;
    }
  }
  console.log(`[AssetClass] Startup seed: ${seeded} new, ${updated} updated`);
}

// ─── Canonical 36 Asset Class Registry ───────────────────────────────────────

const CANONICAL_ASSET_CLASSES = [
  // Waterfront
  { key: "marina", label: "Marina", shortLabel: "Marina", group: "Waterfront", category: "specialty",
    color: "#00d4ff", icon: "Anchor", sizeLabel: "Slips", occLabel: "Slip Occ %", priceUnit: "Slip",
    revenueStreams: ["Fuel Revenue", "Storage Revenue", "Service Revenue"], demandKey: "Boat Ownership %",
    enabled: true, sortOrder: 1,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","fuelSales","shipStore","vdr","dueDiligence","docket"],
    defaultDataSources: [] },
  { key: "dry_stack", label: "Dry Stack / Boatyard", shortLabel: "Dry Stack", group: "Waterfront", category: "specialty",
    color: "#06b6d4", icon: "Warehouse", sizeLabel: "Rack Units", occLabel: "Rack Occ %", priceUnit: "Rack",
    revenueStreams: ["Storage Fees", "Launch Fees", "Service Revenue"], demandKey: "Boat Ownership %",
    enabled: true, sortOrder: 2,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "yacht_club", label: "Yacht Club", shortLabel: "Yacht Club", group: "Waterfront", category: "specialty",
    color: "#38bdf8", icon: "Anchor", sizeLabel: "Slips", occLabel: "Membership Occ", priceUnit: "Slip",
    revenueStreams: ["Membership Dues", "Slip Fees", "F&B Revenue"], demandKey: "HH Boat Ownership %",
    enabled: false, sortOrder: 3,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "waterfront_resort", label: "Waterfront Resort", shortLabel: "WF Resort", group: "Waterfront", category: "hospitality",
    color: "#0ea5e9", icon: "Hotel", sizeLabel: "Keys", occLabel: "Occ %", priceUnit: "Key",
    revenueStreams: ["Room Revenue", "Marina Fees", "F&B Revenue"], demandKey: "Tourism Index",
    enabled: false, sortOrder: 4,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "boat_rental", label: "Boat Rental / Charter", shortLabel: "Boat Rental", group: "Waterfront", category: "specialty",
    color: "#22d3ee", icon: "Anchor", sizeLabel: "Vessels", occLabel: "Utilization %", priceUnit: "Vessel",
    revenueStreams: ["Charter Revenue", "Rental Revenue", "Fuel/Ancillary"], demandKey: "Visitor Spend Index",
    enabled: false, sortOrder: 5,
    enabledModules: ["crm","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },

  // Hospitality
  { key: "hotel", label: "Hotel", shortLabel: "Hotel", group: "Hospitality", category: "hospitality",
    color: "#a78bfa", icon: "Hotel", sizeLabel: "Keys", occLabel: "Occ % / RevPAR", priceUnit: "Key",
    revenueStreams: ["Room Revenue", "F&B Revenue", "Ancillary"], demandKey: "Tourism Index",
    enabled: false, sortOrder: 6,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "boutique_hotel", label: "Boutique Hotel", shortLabel: "Boutique Hotel", group: "Hospitality", category: "hospitality",
    color: "#8b5cf6", icon: "Hotel", sizeLabel: "Keys", occLabel: "Occ %", priceUnit: "Key",
    revenueStreams: ["Room Revenue", "F&B Revenue", "Events Revenue"], demandKey: "ADR vs Market",
    enabled: false, sortOrder: 7,
    enabledModules: ["crm","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "motel", label: "Motel / Motor Inn", shortLabel: "Motel", group: "Hospitality", category: "hospitality",
    color: "#c084fc", icon: "Hotel", sizeLabel: "Keys", occLabel: "Occ %", priceUnit: "Key",
    revenueStreams: ["Room Revenue", "Vending", "Ancillary"], demandKey: "Drive-by Traffic",
    enabled: false, sortOrder: 8,
    enabledModules: ["crm","salesComps","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "extended_stay", label: "Extended Stay", shortLabel: "Extended Stay", group: "Hospitality", category: "hospitality",
    color: "#e879f9", icon: "Hotel", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Weekly Room Rev", "Monthly Room Rev", "Ancillary"], demandKey: "Corporate Demand Idx",
    enabled: false, sortOrder: 9,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "rv_park", label: "RV Park / Campground", shortLabel: "RV Park", group: "Hospitality", category: "specialty",
    color: "#f59e0b", icon: "Home", sizeLabel: "Sites", occLabel: "Occ %", priceUnit: "Site",
    revenueStreams: ["Site Rental", "Hook-Ups", "Store/Amenity"], demandKey: "Snowbird Season %",
    enabled: false, sortOrder: 10,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "glamping", label: "Glamping / Eco-Resort", shortLabel: "Glamping", group: "Hospitality", category: "hospitality",
    color: "#fbbf24", icon: "Home", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Accommodation Rev", "Experience Rev", "F&B"], demandKey: "Experiential Travel Idx",
    enabled: false, sortOrder: 11,
    enabledModules: ["crm","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },

  // Residential
  { key: "multifamily", label: "Multifamily", shortLabel: "Multifamily", group: "Residential", category: "residential",
    color: "#4ade80", icon: "Building2", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Rental Revenue", "Parking Revenue", "Ancillary"], demandKey: "Renter Demand Index",
    enabled: false, sortOrder: 12,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: ["zillow_bridge","mls_reso"] },
  { key: "garden_apt", label: "Garden Apartments", shortLabel: "Garden Apts", group: "Residential", category: "residential",
    color: "#22c55e", icon: "Building2", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Rental Revenue", "Laundry/Vend", "Storage"], demandKey: "Rent Growth YoY %",
    enabled: false, sortOrder: 13,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "senior_housing", label: "Senior Housing", shortLabel: "Senior Housing", group: "Residential", category: "residential",
    color: "#16a34a", icon: "Building2", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Rental Revenue", "Care Fees", "Ancillary Services"], demandKey: "65+ Population Growth",
    enabled: false, sortOrder: 14,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "student_housing", label: "Student Housing", shortLabel: "Student Housing", group: "Residential", category: "residential",
    color: "#15803d", icon: "Building2", sizeLabel: "Beds", occLabel: "Bed Occ %", priceUnit: "Bed",
    revenueStreams: ["Rental Revenue", "Parking Revenue", "Amenity Fees"], demandKey: "University Enrollment",
    enabled: false, sortOrder: 15,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "mobile_home_park", label: "Mobile Home Park", shortLabel: "MHP", group: "Residential", category: "residential",
    color: "#166534", icon: "Home", sizeLabel: "Pads", occLabel: "Pad Occ %", priceUnit: "Pad",
    revenueStreams: ["Pad Rental Revenue", "Utility Revenue", "Ancillary"], demandKey: "Affordable Housing Demand",
    enabled: false, sortOrder: 16,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "condo", label: "Condo / Condo-tel", shortLabel: "Condo", group: "Residential", category: "residential",
    color: "#86efac", icon: "Building", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["HOA Fees", "Rental Revenue", "Ancillary"], demandKey: "Condo Demand Index",
    enabled: false, sortOrder: 17,
    enabledModules: ["crm","salesComps","modeling","proForma","vdr","dueDiligence"], defaultDataSources: ["zillow_bridge"] },
  { key: "sfr", label: "Single Family Rental", shortLabel: "SFR", group: "Residential", category: "residential",
    color: "#bbf7d0", icon: "Home", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Rental Revenue", "Ancillary Fees", "Storage"], demandKey: "SFR Demand Index",
    enabled: false, sortOrder: 18,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: ["zillow_bridge","mls_reso"] },

  // Industrial
  { key: "industrial", label: "Industrial", shortLabel: "Industrial", group: "Industrial", category: "commercial",
    color: "#fb923c", icon: "Factory", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "NNN Recoveries", "Ancillary"], demandKey: "Industrial Absorption Rate",
    enabled: false, sortOrder: 19,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "warehouse", label: "Warehouse / Distribution", shortLabel: "Warehouse", group: "Industrial", category: "commercial",
    color: "#f97316", icon: "Warehouse", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "NNN Recoveries", "Loading Dock Fees"], demandKey: "E-Commerce Growth Rate",
    enabled: false, sortOrder: 20,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "cold_storage", label: "Cold Storage / Refrigerated", shortLabel: "Cold Storage", group: "Industrial", category: "commercial",
    color: "#ea580c", icon: "Warehouse", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "Utility Recoveries", "Handling Fees"], demandKey: "Food Supply Chain Index",
    enabled: false, sortOrder: 21,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "self_storage", label: "Self Storage", shortLabel: "Self Storage", group: "Industrial", category: "commercial",
    color: "#c2410c", icon: "Box", sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Rental Revenue", "Insurance Revenue", "Ancillary"], demandKey: "Self Storage Demand",
    enabled: false, sortOrder: 22,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "data_center", label: "Data Center", shortLabel: "Data Center", group: "Industrial", category: "commercial",
    color: "#9a3412", icon: "Warehouse", sizeLabel: "MW / Sq Ft", occLabel: "Power Util %", priceUnit: "MW",
    revenueStreams: ["Colocation Revenue", "Power Revenue", "Connectivity Fees"], demandKey: "Cloud Demand Index",
    enabled: false, sortOrder: 23,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "truck_terminal", label: "Truck Terminal / Flex Industrial", shortLabel: "Truck Terminal", group: "Industrial", category: "commercial",
    color: "#7c2d12", icon: "Truck", sizeLabel: "Sq Ft / Doors", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "NNN Recoveries", "Trailer Storage"], demandKey: "Freight Volume Index",
    enabled: false, sortOrder: 24,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },

  // Office
  { key: "office", label: "Office", shortLabel: "Office", group: "Office", category: "commercial",
    color: "#60a5fa", icon: "Building2", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "Operating Expense Recoveries", "Parking Revenue"], demandKey: "Office Absorption Rate",
    enabled: false, sortOrder: 25,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "medical_office", label: "Medical Office", shortLabel: "Medical Office", group: "Office", category: "commercial",
    color: "#3b82f6", icon: "Building2", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "NNN Recoveries", "Procedure Revenue"], demandKey: "Healthcare Demand Index",
    enabled: false, sortOrder: 26,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "coworking", label: "Co-working / Flex Office", shortLabel: "Co-working", group: "Office", category: "commercial",
    color: "#2563eb", icon: "Building2", sizeLabel: "Desks / Sq Ft", occLabel: "Desk Occ %", priceUnit: "Desk",
    revenueStreams: ["Membership Revenue", "Day Pass Revenue", "Conference Room Fees"], demandKey: "Remote Work Index",
    enabled: false, sortOrder: 27,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "creative_office", label: "Creative Office / Loft", shortLabel: "Creative Office", group: "Office", category: "commercial",
    color: "#1d4ed8", icon: "Building2", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "CAM Recoveries", "Ancillary"], demandKey: "Creative Industry Employment",
    enabled: false, sortOrder: 28,
    enabledModules: ["crm","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },

  // Retail
  { key: "retail", label: "Retail Strip Center", shortLabel: "Retail", group: "Retail", category: "commercial",
    color: "#f43f5e", icon: "Store", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "CAM Recoveries", "Percentage Rent"], demandKey: "Retail Sales Index",
    enabled: false, sortOrder: 29,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "anchored_retail", label: "Anchored Shopping Center", shortLabel: "Anchored Retail", group: "Retail", category: "commercial",
    color: "#e11d48", icon: "Store", sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "CAM Recoveries", "Outparcel Revenue"], demandKey: "Anchor Tenant Sales PSF",
    enabled: false, sortOrder: 30,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "nnn_single_tenant", label: "NNN Single Tenant / Net Lease", shortLabel: "NNN", group: "Retail", category: "commercial",
    color: "#be123c", icon: "Store", sizeLabel: "Sq Ft", occLabel: "Occ %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "Lease Escalations", "Ancillary"], demandKey: "Tenant Credit Rating",
    enabled: false, sortOrder: 31,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "car_wash", label: "Car Wash", shortLabel: "Car Wash", group: "Retail", category: "specialty",
    color: "#9f1239", icon: "Store", sizeLabel: "Bays", occLabel: "Wash Volume", priceUnit: "Bay",
    revenueStreams: ["Wash Revenue", "Membership Revenue", "Ancillary"], demandKey: "Vehicle Count Index",
    enabled: false, sortOrder: 32,
    enabledModules: ["crm","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "laundromat", label: "Laundromat", shortLabel: "Laundromat", group: "Retail", category: "specialty",
    color: "#881337", icon: "Store", sizeLabel: "Machines", occLabel: "Util %", priceUnit: "Machine",
    revenueStreams: ["Wash Revenue", "Dry Revenue", "Ancillary"], demandKey: "Population Density",
    enabled: false, sortOrder: 33,
    enabledModules: ["crm","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },

  // Other
  { key: "business", label: "Business Acquisition", shortLabel: "Business", group: "Other", category: "specialty",
    color: "#854d0e", icon: "Briefcase", sizeLabel: "Revenue", occLabel: "Utilization %", priceUnit: "EBITDA",
    revenueStreams: ["Operating Revenue", "Service Revenue", "Ancillary"], demandKey: "Industry Growth Rate",
    enabled: false, sortOrder: 34,
    enabledModules: ["crm","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "mixed_use", label: "Mixed Use", shortLabel: "Mixed Use", group: "Other", category: "commercial",
    color: "#713f12", icon: "Layers", sizeLabel: "Sq Ft / Units", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Retail Rent", "Residential Rent", "Parking Revenue"], demandKey: "Mixed-Use Demand Index",
    enabled: false, sortOrder: 35,
    enabledModules: ["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"], defaultDataSources: [] },
  { key: "land", label: "Land", shortLabel: "Land", group: "Other", category: "land",
    color: "#a3a3a3", icon: "LandPlot", sizeLabel: "Acres", occLabel: "Coverage %", priceUnit: "Acre",
    revenueStreams: ["Land Lease Revenue", "Timber Revenue", "Mineral Revenue"], demandKey: "Land Price Index",
    enabled: false, sortOrder: 36,
    enabledModules: ["crm","salesComps","modeling","proForma","vdr","dueDiligence"], defaultDataSources: [] },
];

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createAssetClassSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers, and underscores"),
  label: z.string().min(1).max(100),
  shortLabel: z.string().max(30).optional(),
  category: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  enabled: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  sizeLabel: z.string().optional(),
  occLabel: z.string().optional(),
  priceUnit: z.string().optional(),
  revenueStreams: z.array(z.string()).optional().default([]),
  demandKey: z.string().optional(),
  group: z.string().optional(),
  color: z.string().optional(),
  config: z.record(z.any()).optional().default({}),
  enabledModules: z.array(z.string()).optional().default([]),
  defaultDataSources: z.array(z.string()).optional().default([]),
  coaTaxonomyPackKey: z.string().optional(),
  ddTemplateKey: z.string().optional(),
});

const updateAssetClassSchema = createAssetClassSchema.partial().omit({ key: true });

// ─── Public Route: GET /api/asset-classes ────────────────────────────────────

publicAssetClassRouter.get("/", async (_req: Request, res: Response) => {
  try {
    // Return all asset classes (enabled + disabled) so clients can resolve labels/configs
    // for any known key. The `enabled` field controls visibility in dropdowns/forms.
    const classes = await db
      .select()
      .from(platformAssetClasses)
      .orderBy(asc(platformAssetClasses.sortOrder));

    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    res.json({ assetClasses: classes });
  } catch (error) {
    console.error("Error fetching asset classes:", error);
    res.status(500).json({ error: "Failed to fetch asset classes" });
  }
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

adminAssetClassRouter.get("/", requireRole("owner"), async (_req: Request, res: Response) => {
  try {
    const classes = await db
      .select()
      .from(platformAssetClasses)
      .orderBy(asc(platformAssetClasses.sortOrder));
    res.json({ assetClasses: classes });
  } catch (error) {
    console.error("Error fetching admin asset classes:", error);
    res.status(500).json({ error: "Failed to fetch asset classes" });
  }
});

adminAssetClassRouter.post("/seed", requireRole("owner"), async (_req: Request, res: Response) => {
  try {
    // Reuses the same seed function called at startup (idempotent)
    await seedCanonicalAssetClasses();

    const all = await db
      .select()
      .from(platformAssetClasses)
      .orderBy(asc(platformAssetClasses.sortOrder));

    res.json({ message: `Canonical asset classes seeded (${all.length} total)`, assetClasses: all });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error seeding asset classes:", error);
    res.status(500).json({ error: "Failed to seed asset classes", details: msg });
  }
});

adminAssetClassRouter.post("/", requireRole("owner"), async (req: Request, res: Response) => {
  try {
    const data = createAssetClassSchema.parse(req.body);

    const existing = await db
      .select({ id: platformAssetClasses.id })
      .from(platformAssetClasses)
      .where(eq(platformAssetClasses.key, data.key))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "Asset class with this key already exists" });
    }

    const [created] = await db
      .insert(platformAssetClasses)
      .values({
        key: data.key,
        label: data.label,
        shortLabel: data.shortLabel ?? null,
        category: data.category,
        description: data.description ?? null,
        icon: data.icon ?? null,
        enabled: data.enabled ?? false,
        sortOrder: data.sortOrder ?? 0,
        sizeLabel: data.sizeLabel ?? null,
        occLabel: data.occLabel ?? null,
        priceUnit: data.priceUnit ?? null,
        revenueStreams: jsonb(data.revenueStreams ?? []),
        demandKey: data.demandKey ?? null,
        group: data.group ?? null,
        color: data.color ?? null,
        config: jsonb(data.config ?? {}),
        enabledModules: jsonb(data.enabledModules ?? []),
        defaultDataSources: jsonb(data.defaultDataSources ?? []),
        coaTaxonomyPackKey: data.coaTaxonomyPackKey ?? null,
        ddTemplateKey: data.ddTemplateKey ?? null,
      })
      .returning();

    res.status(201).json({ assetClass: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating asset class:", error);
    res.status(500).json({ error: "Failed to create asset class" });
  }
});

adminAssetClassRouter.patch("/:key", requireRole("owner"), async (req: Request, res: Response) => {
  try {
    const data = updateAssetClassSchema.parse(req.body);

    const setValues: Partial<typeof platformAssetClasses.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.shortLabel !== undefined && { shortLabel: data.shortLabel }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.sizeLabel !== undefined && { sizeLabel: data.sizeLabel }),
      ...(data.occLabel !== undefined && { occLabel: data.occLabel }),
      ...(data.priceUnit !== undefined && { priceUnit: data.priceUnit }),
      ...(data.revenueStreams !== undefined && { revenueStreams: jsonb(data.revenueStreams) }),
      ...(data.demandKey !== undefined && { demandKey: data.demandKey }),
      ...(data.group !== undefined && { group: data.group }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.config !== undefined && { config: jsonb(data.config) }),
      ...(data.enabledModules !== undefined && { enabledModules: jsonb(data.enabledModules) }),
      ...(data.defaultDataSources !== undefined && { defaultDataSources: jsonb(data.defaultDataSources) }),
      ...(data.coaTaxonomyPackKey !== undefined && { coaTaxonomyPackKey: data.coaTaxonomyPackKey }),
      ...(data.ddTemplateKey !== undefined && { ddTemplateKey: data.ddTemplateKey }),
    };

    const [updated] = await db
      .update(platformAssetClasses)
      .set(setValues)
      .where(eq(platformAssetClasses.key, req.params.key))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Asset class not found" });
    }

    res.json({ assetClass: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating asset class:", error);
    res.status(500).json({ error: "Failed to update asset class" });
  }
});

adminAssetClassRouter.delete("/:key", requireRole("owner"), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db
      .delete(platformAssetClasses)
      .where(eq(platformAssetClasses.key, req.params.key))
      .returning({ key: platformAssetClasses.key });

    if (!deleted) {
      return res.status(404).json({ error: "Asset class not found" });
    }

    res.json({ message: "Asset class deleted", key: deleted.key });
  } catch (error) {
    console.error("Error deleting asset class:", error);
    res.status(500).json({ error: "Failed to delete asset class" });
  }
});

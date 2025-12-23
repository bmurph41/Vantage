import { db } from "../db";
import { organizationPacks, packCatalog } from "@shared/schema";
import { eq, and, or, asc } from "drizzle-orm";
import type { OrganizationPack, InsertOrganizationPack, PackCatalog } from "@shared/schema";

// Core packs that users purchase first
export type CorePackType = "crm_pipeline" | "modeling_tools" | "analysis" | "operations";

// Add-on packs that require core packs
export type AddonPackType = "fund_management" | "lp_portal" | "prospecting" | "analytics_pro";

export type PackType = CorePackType | AddonPackType;

// Pack dependencies - which packs are required before activation
const PACK_DEPENDENCIES: Record<PackType, PackType[]> = {
  // Core packs have no dependencies
  crm_pipeline: [],
  modeling_tools: [],
  analysis: [],
  operations: [],
  // Add-on packs require their parent core pack
  fund_management: ["modeling_tools"],
  lp_portal: ["fund_management", "modeling_tools"],
  prospecting: ["crm_pipeline"],
  analytics_pro: ["analysis"],
};

// Static pack information (fallback if catalog not in DB)
const PACK_INFO: Record<PackType, { name: string; description: string; features: string[]; isCore: boolean; monthlyPriceCents: number }> = {
  crm_pipeline: {
    name: "CRM & Pipeline",
    description: "Complete CRM with deal pipeline management, contacts, companies, activities, and follow-up tracking.",
    features: [
      "Deal board with drag-and-drop pipeline",
      "Contact and company management",
      "Activity logging and tracking",
      "Follow-up reminders",
      "Email sequences",
      "Pipeline forecasting",
    ],
    isCore: true,
    monthlyPriceCents: 9900, // $99/month
  },
  modeling_tools: {
    name: "Modeling Tools",
    description: "Financial modeling suite for marina valuations including OM Builder, exit strategies, and waterfall analysis.",
    features: [
      "Modeling projects workspace",
      "OM Builder with PDF export",
      "Exit Strategy Suite",
      "Waterfall distribution modeling",
      "Multi-case scenario analysis",
      "Debt & equity modeling",
    ],
    isCore: true,
    monthlyPriceCents: 14900, // $149/month
  },
  analysis: {
    name: "Analysis",
    description: "Market analytics tools including sales comparables, rate comparables, and market research.",
    features: [
      "Sales comps database",
      "Rate comps tracking",
      "Market analytics dashboard",
      "Comp adjustment grid",
      "CSV import/export",
      "Google Maps integration",
    ],
    isCore: true,
    monthlyPriceCents: 7900, // $79/month
  },
  operations: {
    name: "Operations",
    description: "Marina operations management including rent roll, fuel sales, ship store, and launch scheduling.",
    features: [
      "Rent roll management",
      "Fuel sales tracking",
      "Ship store inventory",
      "Dockit launch scheduling",
      "Marketing campaigns",
      "Customer analytics",
    ],
    isCore: true,
    monthlyPriceCents: 12900, // $129/month
  },
  fund_management: {
    name: "Fund Management",
    description: "Comprehensive PE fund lifecycle management with capital allocation, fund-level returns tracking, and investor capital accounts.",
    features: [
      "Fund creation and lifecycle management",
      "Deal allocation across funds",
      "Capital call and distribution tracking",
      "Fund-level IRR and performance metrics",
      "Capital stack inheritance to projects",
    ],
    isCore: false,
    monthlyPriceCents: 19900, // $199/month
  },
  lp_portal: {
    name: "LP Portal",
    description: "Dedicated portal for limited partners to access fund information, view commitments, and track distributions.",
    features: [
      "LP investor management",
      "Capital account statements",
      "Distribution notifications",
      "Document sharing with LPs",
      "K-1 distribution tracking",
    ],
    isCore: false,
    monthlyPriceCents: 9900, // $99/month
  },
  prospecting: {
    name: "Premium Prospecting",
    description: "Advanced prospecting and outreach tools for deal sourcing.",
    features: [
      "Outreach campaign management",
      "Call and email tracking",
      "Market target analysis",
      "Lead scoring and prioritization",
      "Automated follow-up sequences",
    ],
    isCore: false,
    monthlyPriceCents: 7900, // $79/month
  },
  analytics_pro: {
    name: "Analytics Pro",
    description: "Advanced analytics and reporting capabilities for deeper insights.",
    features: [
      "Custom report builder",
      "Advanced data visualization",
      "Comparative analysis tools",
      "Export to PDF/Excel",
      "Scheduled reports",
    ],
    isCore: false,
    monthlyPriceCents: 4900, // $49/month
  },
};

class PackService {
  async getOrganizationPacks(orgId: string): Promise<OrganizationPack[]> {
    return db
      .select()
      .from(organizationPacks)
      .where(eq(organizationPacks.orgId, orgId));
  }

  async getOrgPack(orgId: string, packType: PackType): Promise<{ isActive: boolean; pack: OrganizationPack | null }> {
    const [pack] = await db
      .select()
      .from(organizationPacks)
      .where(
        and(
          eq(organizationPacks.orgId, orgId),
          eq(organizationPacks.packType, packType)
        )
      )
      .limit(1);
    
    if (!pack) {
      return { isActive: false, pack: null };
    }
    
    const now = new Date();
    const isActive = 
      (pack.status === 'active' || pack.status === 'trial') &&
      (!pack.expiresAt || pack.expiresAt > now) &&
      (!pack.trialEndsAt || pack.status !== 'trial' || pack.trialEndsAt > now);
    
    return { isActive, pack };
  }

  async getActivePacks(orgId: string): Promise<PackType[]> {
    const packs = await db
      .select()
      .from(organizationPacks)
      .where(
        and(
          eq(organizationPacks.orgId, orgId),
          or(
            eq(organizationPacks.status, "active"),
            eq(organizationPacks.status, "trial")
          )
        )
      );

    const now = new Date();
    return packs
      .filter((pack) => {
        if (pack.status === "trial" && pack.trialEndsAt && pack.trialEndsAt < now) {
          return false;
        }
        if (pack.expiresAt && pack.expiresAt < now) {
          return false;
        }
        return true;
      })
      .map((pack) => pack.packType as PackType);
  }

  async hasPackAccess(orgId: string, packType: PackType): Promise<boolean> {
    const activePacks = await this.getActivePacks(orgId);
    return activePacks.includes(packType);
  }

  async hasFundManagementAccess(orgId: string): Promise<boolean> {
    return this.hasPackAccess(orgId, "fund_management");
  }

  async hasLpPortalAccess(orgId: string): Promise<boolean> {
    const hasFundAccess = await this.hasPackAccess(orgId, "fund_management");
    const hasLpAccess = await this.hasPackAccess(orgId, "lp_portal");
    return hasFundAccess && hasLpAccess;
  }

  async hasProspectingAccess(orgId: string): Promise<boolean> {
    return this.hasPackAccess(orgId, "prospecting");
  }

  async activatePack(
    orgId: string,
    packType: PackType,
    userId?: string,
    options?: {
      isTrial?: boolean;
      trialDays?: number;
      expiresAt?: Date;
      notes?: string;
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
      stripePriceId?: string;
    }
  ): Promise<OrganizationPack> {
    const requiredPacks = PACK_DEPENDENCIES[packType];
    for (const requiredPack of requiredPacks) {
      const hasRequired = await this.hasPackAccess(orgId, requiredPack);
      if (!hasRequired) {
        throw new Error(
          `Cannot activate ${packType} without ${requiredPack} pack`
        );
      }
    }

    const existingPack = await db
      .select()
      .from(organizationPacks)
      .where(
        and(
          eq(organizationPacks.orgId, orgId),
          eq(organizationPacks.packType, packType)
        )
      )
      .limit(1);

    if (existingPack.length > 0) {
      const [updated] = await db
        .update(organizationPacks)
        .set({
          status: options?.isTrial ? "trial" : "active",
          expiresAt: options?.expiresAt || null,
          trialEndsAt: options?.isTrial && options.trialDays
            ? new Date(Date.now() + options.trialDays * 24 * 60 * 60 * 1000)
            : null,
          notes: options?.notes,
          stripeSubscriptionId: options?.stripeSubscriptionId || existingPack[0].stripeSubscriptionId,
          stripeCustomerId: options?.stripeCustomerId || existingPack[0].stripeCustomerId,
          stripePriceId: options?.stripePriceId || existingPack[0].stripePriceId,
          updatedAt: new Date(),
        })
        .where(eq(organizationPacks.id, existingPack[0].id))
        .returning();
      return updated;
    }

    const [newPack] = await db
      .insert(organizationPacks)
      .values({
        orgId,
        packType,
        status: options?.isTrial ? "trial" : "active",
        purchasedBy: userId,
        expiresAt: options?.expiresAt || null,
        trialEndsAt: options?.isTrial && options.trialDays
          ? new Date(Date.now() + options.trialDays * 24 * 60 * 60 * 1000)
          : null,
        notes: options?.notes,
        stripeSubscriptionId: options?.stripeSubscriptionId,
        stripeCustomerId: options?.stripeCustomerId,
        stripePriceId: options?.stripePriceId,
      })
      .returning();

    return newPack;
  }

  async deactivatePack(orgId: string, packType: PackType): Promise<OrganizationPack | null> {
    const dependentPacks = Object.entries(PACK_DEPENDENCIES)
      .filter(([_, deps]) => deps.includes(packType))
      .map(([pack]) => pack as PackType);

    for (const dependentPack of dependentPacks) {
      const isActive = await this.hasPackAccess(orgId, dependentPack);
      if (isActive) {
        await this.deactivatePack(orgId, dependentPack);
      }
    }

    const [updated] = await db
      .update(organizationPacks)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationPacks.orgId, orgId),
          eq(organizationPacks.packType, packType)
        )
      )
      .returning();

    return updated || null;
  }

  async getPackInfo(packType: PackType) {
    // Try to get from database catalog first
    try {
      const [catalogEntry] = await db
        .select()
        .from(packCatalog)
        .where(eq(packCatalog.packType, packType))
        .limit(1);
      
      if (catalogEntry) {
        return {
          name: catalogEntry.name,
          description: catalogEntry.description,
          features: (catalogEntry.features as string[]) || [],
          isCore: catalogEntry.isCore,
          monthlyPriceCents: catalogEntry.monthlyPriceCents,
        };
      }
    } catch (error) {
      // Fall through to static data if DB read fails
    }
    
    // Fallback to static data
    const info = PACK_INFO[packType];
    return {
      name: info.name,
      description: info.description,
      features: info.features,
      isCore: info.isCore,
      monthlyPriceCents: info.monthlyPriceCents,
    };
  }

  async getAllPacksWithStatus(orgId: string) {
    const activePacks = await this.getActivePacks(orgId);
    const allPacks: PackType[] = [
      // Core packs first
      "crm_pipeline",
      "modeling_tools", 
      "analysis",
      "operations",
      // Then add-on packs
      "fund_management",
      "lp_portal",
      "prospecting",
      "analytics_pro",
    ];

    return Promise.all(
      allPacks.map(async (packType) => {
        const info = await this.getPackInfo(packType);
        return {
          packType,
          info,
          isActive: activePacks.includes(packType),
          dependencies: PACK_DEPENDENCIES[packType],
          canActivate: PACK_DEPENDENCIES[packType].every((dep) =>
            activePacks.includes(dep)
          ),
        };
      })
    );
  }

  async getCorePacks() {
    const corePacks: CorePackType[] = ["crm_pipeline", "modeling_tools", "analysis", "operations"];
    return corePacks.map(packType => ({
      packType,
      ...PACK_INFO[packType],
    }));
  }

  async getAddonPacks() {
    const addonPacks: AddonPackType[] = ["fund_management", "lp_portal", "prospecting", "analytics_pro"];
    return addonPacks.map(packType => ({
      packType,
      ...PACK_INFO[packType],
      dependencies: PACK_DEPENDENCIES[packType],
    }));
  }

  // Check if user has access to core pack features
  async hasCrmPipelineAccess(orgId: string): Promise<boolean> {
    return this.hasPackAccess(orgId, "crm_pipeline");
  }

  async hasModelingToolsAccess(orgId: string): Promise<boolean> {
    return this.hasPackAccess(orgId, "modeling_tools");
  }

  async hasAnalysisAccess(orgId: string): Promise<boolean> {
    return this.hasPackAccess(orgId, "analysis");
  }

  async hasOperationsAccess(orgId: string): Promise<boolean> {
    return this.hasPackAccess(orgId, "operations");
  }
}

export const packService = new PackService();

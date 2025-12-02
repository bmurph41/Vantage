import { db } from "../db";
import { organizationPacks } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import type { OrganizationPack, InsertOrganizationPack } from "@shared/schema";

export type PackType = "fund_management" | "lp_portal" | "prospecting" | "analytics_pro";

const PACK_DEPENDENCIES: Record<PackType, PackType[]> = {
  fund_management: [],
  lp_portal: ["fund_management"],
  prospecting: [],
  analytics_pro: [],
};

class PackService {
  async getOrganizationPacks(orgId: string): Promise<OrganizationPack[]> {
    return db
      .select()
      .from(organizationPacks)
      .where(eq(organizationPacks.orgId, orgId));
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
    const packInfo: Record<PackType, { name: string; description: string; features: string[] }> = {
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
      },
    };

    return packInfo[packType];
  }

  async getAllPacksWithStatus(orgId: string) {
    const activePacks = await this.getActivePacks(orgId);
    const allPacks: PackType[] = ["fund_management", "lp_portal", "prospecting", "analytics_pro"];

    return Promise.all(
      allPacks.map(async (packType) => ({
        packType,
        info: await this.getPackInfo(packType),
        isActive: activePacks.includes(packType),
        dependencies: PACK_DEPENDENCIES[packType],
        canActivate: PACK_DEPENDENCIES[packType].every((dep) =>
          activePacks.includes(dep)
        ),
      }))
    );
  }
}

export const packService = new PackService();

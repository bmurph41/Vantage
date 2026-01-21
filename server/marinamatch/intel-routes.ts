import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, desc, asc, sql, gte, lte, like, or, isNull, inArray, notInArray, ne } from "drizzle-orm";
import crypto from "crypto";
import { validateListingUrl, validateUrlAccessibility, getPlatformFromUrl } from "./utils/url-validation";
import {
  marinaListings,
  investmentCriteriaProfiles,
  investmentCriteriaLocation,
  investmentCriteriaFinancial,
  investmentCriteriaOperational,
  investmentCriteriaSize,
  investmentCriteriaCapital,
  investmentCriteriaInvolvement,
  investmentCriteriaCapex,
  marinaMatchGoals,
  marinaMatchGoalProgress,
  marinaScrapeources,
  marinaScrapeRuns,
  marinaListingMatches,
  marinaMatchAlerts,
  marinaMatchAlertHistory,
  marinaListingFeedback,
  marinaAiFilterPatterns,
  userHiddenListings,
  listingFeedbackReasons,
  insertMarinaListingSchema,
  updateMarinaListingSchema,
  insertInvestmentCriteriaProfileSchema,
  updateInvestmentCriteriaProfileSchema,
  insertMarinaMatchGoalSchema,
  updateMarinaMatchGoalSchema,
  insertMarinaScrapeSourceSchema,
  updateMarinaScrapeSourceSchema,
  insertMarinaMatchAlertSchema,
  updateMarinaMatchAlertSchema,
  insertListingFeedbackSchema,
  type MarinaListing,
  type InvestmentCriteriaProfile,
  type MarinaMatchGoal,
  type MarinaScrapeSource,
  type ListingFeedback,
} from "@shared/schema";
import { getScrapeStatus, ensureListingsExist, getLastScrapeRun } from "./services/intel-cron";
import { PLATFORM_CAPABILITIES, getPlatformCapabilities, getRecommendedMethod, invalidateLearnedPatternsCache } from "./services/cre-scraper";
import { matchScoringService, MARINA_DEPARTMENTS, STORAGE_DEPARTMENTS } from "./services/match-scoring-service";
const router = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).session?.user?.orgId || null;
}

function getUserId(req: Request): string | null {
  return (req as any).user?.id || (req as any).session?.user?.id || null;
}

function generateListingDedupeHash(listing: Partial<MarinaListing>): string {
  const normalizedAddress = (listing.propertyAddress || "").toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedName = (listing.propertyName || listing.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  const city = (listing.city || "").toLowerCase().trim();
  const state = (listing.state || "").toLowerCase().trim();
  const source = (listing.sourcePlatform || "").toLowerCase().trim();
  
  const input = `${source}|${normalizedName}|${normalizedAddress}|${city}|${state}`;
  return crypto.createHash("md5").update(input).digest("hex");
}

// ============================================
// PLATFORM CAPABILITIES
// ============================================

router.get("/platform-capabilities", async (req: Request, res: Response) => {
  try {
    const { platform } = req.query;
    
    if (platform) {
      const capabilities = getPlatformCapabilities(platform as string);
      const recommendedMethod = getRecommendedMethod(platform as string);
      res.json({ ...capabilities, recommendedMethod });
    } else {
      res.json({
        platforms: Object.values(PLATFORM_CAPABILITIES),
        summary: {
          totalPlatforms: Object.keys(PLATFORM_CAPABILITIES).length,
          platformsWithAPI: Object.values(PLATFORM_CAPABILITIES).filter(p => p.apiInfo?.available).length,
          blockedPlatforms: Object.values(PLATFORM_CAPABILITIES).filter(p => p.scrapingStatus === "blocked").length,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching platform capabilities:", error);
    res.status(500).json({ error: "Failed to fetch platform capabilities" });
  }
});

// ============================================
// MARINA LISTINGS (Scraped Data)
// ============================================

router.get("/sync-status", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const scrapeStatus = getScrapeStatus();
    const lastRun = await getLastScrapeRun(orgId);
    
    const listingsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(marinaListings)
      .where(eq(marinaListings.orgId, orgId));

    res.json({
      ...scrapeStatus,
      lastRun,
      listingsCount: Number(listingsCount[0]?.count || 0),
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    res.status(500).json({ error: "Failed to fetch sync status" });
  }
});

router.get("/listings", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { status, state, city, source, minScore, sortBy, limit = "100", offset = "0", includeGlobal = "true" } = req.query;

    // Get user's active packs for filtering global listings
    const userPacks = (req as any).user?.activePacks || (req as any).user?.packs || [];
    const hasIntelPack = userPacks.includes("intel") || userPacks.includes("marinamatch_intel");
    const hasAnalysisPack = userPacks.includes("analysis") || userPacks.includes("analytics_pro");
    
    // Include both org-specific listings AND global listings (if user has pack access)
    // Global listings are curated by the MarinaMatch team and available to subscribers
    // For global listings, filter by requiredPack - show only listings user has access to
    const scopeCondition = includeGlobal === "true"
      ? or(
          eq(marinaListings.orgId, orgId),
          and(
            eq(marinaListings.scope, "global"),
            // Pack-gated access: show global listings that don't require a pack OR user has required pack
            or(
              isNull(marinaListings.requiredPack),
              ...(hasIntelPack ? [eq(marinaListings.requiredPack, "intel")] : []),
              ...(hasAnalysisPack ? [eq(marinaListings.requiredPack, "analysis")] : [])
            )
          )
        )
      : eq(marinaListings.orgId, orgId);
    
    const conditions: any[] = [scopeCondition];

    if (status && status !== "all") {
      conditions.push(eq(marinaListings.status, status as string));
    }
    if (state && state !== "all") {
      conditions.push(sql`UPPER(${marinaListings.state}) = UPPER(${state as string})`);
    }
    if (city && city !== "all") {
      conditions.push(sql`LOWER(${marinaListings.city}) = LOWER(${city as string})`);
    }
    if (source && source !== "all") {
      conditions.push(eq(marinaListings.sourcePlatform, source as string));
    }
    if (minScore && parseInt(minScore as string) > 0) {
      conditions.push(gte(marinaListings.bestMatchScore, parseInt(minScore as string)));
    }

    // Filter out listings hidden by the current user
    let hiddenListingIds: string[] = [];
    if (userId) {
      const hiddenListings = await db
        .select({ listingId: userHiddenListings.listingId })
        .from(userHiddenListings)
        .where(eq(userHiddenListings.userId, userId));
      hiddenListingIds = hiddenListings.map(h => h.listingId);
    }

    if (hiddenListingIds.length > 0) {
      conditions.push(sql`${marinaListings.id} NOT IN (${sql.join(hiddenListingIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const listings = await db
      .select()
      .from(marinaListings)
      .where(and(...conditions))
      .orderBy(desc(marinaListings.bestMatchScore), desc(marinaListings.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json(listings);
  } catch (error) {
    console.error("Error fetching marina listings:", error);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

router.get("/listings/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // First try to find by org-scoped or global listing
    const [listing] = await db
      .select()
      .from(marinaListings)
      .where(and(
        eq(marinaListings.id, req.params.id),
        or(
          eq(marinaListings.orgId, orgId),
          eq(marinaListings.scope, "global")
        )
      ));

    if (!listing) return res.status(404).json({ error: "Listing not found" });

    // Pack-gated access for global listings
    if (listing.scope === "global" && listing.requiredPack) {
      const userPacks = (req as any).user?.activePacks || (req as any).user?.packs || [];
      const hasIntelPack = userPacks.includes("intel") || userPacks.includes("marinamatch_intel");
      const hasAnalysisPack = userPacks.includes("analysis") || userPacks.includes("analytics_pro");
      
      const packRequired = listing.requiredPack;
      const hasAccess = 
        (packRequired === "intel" && hasIntelPack) ||
        (packRequired === "analysis" && hasAnalysisPack);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Pack subscription required", requiredPack: packRequired });
      }
    }

    const matches = await db
      .select()
      .from(marinaListingMatches)
      .where(eq(marinaListingMatches.listingId, listing.id))
      .orderBy(desc(marinaListingMatches.overallScore));

    res.json({ ...listing, matches });
  } catch (error) {
    console.error("Error fetching listing:", error);
    res.status(500).json({ error: "Failed to fetch listing" });
  }
});

router.post("/listings", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    if (req.body.sourceUrl) {
      const urlValidation = validateListingUrl(req.body.sourceUrl, req.body.sourcePlatform);
      if (!urlValidation.isValid) {
        return res.status(400).json({ 
          error: "Invalid source URL",
          details: urlValidation.reason
        });
      }
    }

    const dedupeHash = generateListingDedupeHash(req.body);
    
    const [existingListing] = await db
      .select()
      .from(marinaListings)
      .where(and(eq(marinaListings.orgId, orgId), eq(marinaListings.dedupeHash, dedupeHash)))
      .limit(1);

    if (existingListing) {
      const [updated] = await db
        .update(marinaListings)
        .set({ ...req.body, lastScrapedAt: new Date(), updatedAt: new Date() })
        .where(eq(marinaListings.id, existingListing.id))
        .returning();
      return res.json({ ...updated, wasUpdated: true });
    }

    const validated = insertMarinaListingSchema.parse({ ...req.body, orgId, dedupeHash });
    const [listing] = await db.insert(marinaListings).values(validated).returning();

    await scoreListingAgainstCriteria(listing.id, orgId);

    const [scoredListing] = await db
      .select()
      .from(marinaListings)
      .where(eq(marinaListings.id, listing.id));

    res.status(201).json(scoredListing);
  } catch (error: any) {
    console.error("Error creating listing:", error);
    res.status(400).json({ error: error.message || "Failed to create listing" });
  }
});

router.patch("/listings/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    if (req.body.sourceUrl) {
      const urlValidation = validateListingUrl(req.body.sourceUrl, req.body.sourcePlatform);
      if (!urlValidation.isValid) {
        return res.status(400).json({ 
          error: "Invalid source URL",
          details: urlValidation.reason
        });
      }
    }

    const validated = updateMarinaListingSchema.parse(req.body);
    const [updated] = await db
      .update(marinaListings)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(marinaListings.id, req.params.id), eq(marinaListings.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Listing not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating listing:", error);
    res.status(400).json({ error: error.message || "Failed to update listing" });
  }
});

router.delete("/listings/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(marinaListings)
      .where(and(eq(marinaListings.id, req.params.id), eq(marinaListings.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Listing not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting listing:", error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

// ============================================
// BROKER DIRECT POSTING
// ============================================

router.post("/broker-submit", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const {
      title,
      propertyName,
      propertyAddress,
      city,
      state,
      zipCode,
      marinaType,
      dealType,
      askingPrice,
      totalSlips,
      wetSlips,
      dryStorageSpaces,
      acreage,
      waterFrontage,
      hasFuel,
      hasShipStore,
      hasRestaurant,
      hasRepairShop,
      hasDryStorage,
      hasBoatRamp,
      grossRevenue,
      noi,
      capRate,
      occupancyRate,
      brokerName,
      brokerCompany,
      brokerPhone,
      brokerEmail,
      originalDescription,
      contactUrl,
      images,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Listing title is required" });
    }

    if (contactUrl) {
      const urlValidation = validateListingUrl(contactUrl, "direct");
      if (!urlValidation.valid) {
        return res.status(400).json({ 
          error: `Invalid contact URL: ${urlValidation.reason}`,
          suggestedFix: urlValidation.suggestedFix 
        });
      }
    }

    const sourceUrl = contactUrl || (brokerEmail ? `mailto:${brokerEmail}` : "#direct-listing");
    
    const toNumericString = (val: any): string | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]/g, "")) : val;
      return isNaN(num) ? null : String(num);
    };
    
    const listingData = {
      orgId,
      sourcePlatform: "direct",
      sourceUrl,
      sourceListingId: `DIRECT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      propertyName: propertyName || title,
      propertyAddress: propertyAddress || null,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      marinaType: marinaType || "marina",
      propertyType: "marina",
      dealType: dealType || "acquisition",
      askingPrice: toNumericString(askingPrice),
      totalSlips: totalSlips || null,
      wetSlips: wetSlips || null,
      dryStorageSpaces: dryStorageSpaces || null,
      acreage: toNumericString(acreage),
      waterFrontage: toNumericString(waterFrontage),
      hasFuel: hasFuel || false,
      hasShipStore: hasShipStore || false,
      hasRestaurant: hasRestaurant || false,
      hasRepairShop: hasRepairShop || false,
      hasDryStorage: hasDryStorage || false,
      hasBoatRamp: hasBoatRamp || false,
      grossRevenue: toNumericString(grossRevenue),
      noi: toNumericString(noi),
      capRate: toNumericString(capRate),
      occupancyRate: toNumericString(occupancyRate),
      brokerName: brokerName || null,
      brokerCompany: brokerCompany || null,
      brokerPhone: brokerPhone || null,
      brokerEmail: brokerEmail || null,
      originalDescription: originalDescription || null,
      images: images || null,
      attributionText: brokerCompany 
        ? `Direct Listing from ${brokerCompany}` 
        : brokerName 
          ? `Direct Listing from ${brokerName}`
          : "Direct Broker Listing",
      status: "active",
      isReviewed: false,
      listingDate: new Date(),
      lastScrapedAt: new Date(),
    };

    const dedupeHash = generateListingDedupeHash(listingData);

    const [existingListing] = await db
      .select()
      .from(marinaListings)
      .where(and(eq(marinaListings.orgId, orgId), eq(marinaListings.dedupeHash, dedupeHash)))
      .limit(1);

    if (existingListing) {
      const [updated] = await db
        .update(marinaListings)
        .set({ ...listingData, updatedAt: new Date() })
        .where(eq(marinaListings.id, existingListing.id))
        .returning();
      return res.json({ 
        ...updated, 
        wasUpdated: true,
        message: "Listing updated successfully" 
      });
    }

    const validated = insertMarinaListingSchema.parse({ ...listingData, dedupeHash });
    const [listing] = await db.insert(marinaListings).values(validated).returning();

    await scoreListingAgainstCriteria(listing.id, orgId);

    const [scoredListing] = await db
      .select()
      .from(marinaListings)
      .where(eq(marinaListings.id, listing.id));

    res.status(201).json({
      ...scoredListing,
      message: "Listing posted successfully"
    });
  } catch (error: any) {
    console.error("Error creating broker listing:", error);
    res.status(400).json({ error: error.message || "Failed to create broker listing" });
  }
});

router.get("/broker-listings", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const listings = await db
      .select()
      .from(marinaListings)
      .where(and(
        eq(marinaListings.orgId, orgId),
        eq(marinaListings.sourcePlatform, "direct")
      ))
      .orderBy(desc(marinaListings.createdAt));

    res.json(listings);
  } catch (error) {
    console.error("Error fetching broker listings:", error);
    res.status(500).json({ error: "Failed to fetch broker listings" });
  }
});

// ============================================
// ADMIN BULK IMPORT (Curated Data)
// ============================================

interface BulkListingImport {
  title: string;
  propertyName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  marinaType?: string;
  dealType?: string;
  askingPrice?: number | string;
  totalSlips?: number;
  wetSlips?: number;
  dryStorageSpaces?: number;
  acreage?: number | string;
  waterFrontage?: number | string;
  hasFuel?: boolean;
  hasShipStore?: boolean;
  hasRestaurant?: boolean;
  hasRepairShop?: boolean;
  hasDryStorage?: boolean;
  hasBoatRamp?: boolean;
  grossRevenue?: number | string;
  noi?: number | string;
  capRate?: number | string;
  occupancyRate?: number | string;
  brokerName?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  brokerEmail?: string;
  originalDescription?: string;
  sourceUrl?: string;
  sourceListingId?: string;
  sourcePlatform?: string;
  listingDate?: string;
  images?: string[];
}

router.post("/admin/bulk-import", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { listings, source = "manual_import", attributionPrefix = "Manual Import" } = req.body as {
      listings: BulkListingImport[];
      source?: string;
      attributionPrefix?: string;
    };

    if (!listings || !Array.isArray(listings)) {
      return res.status(400).json({ error: "listings array is required" });
    }

    if (listings.length === 0) {
      return res.status(400).json({ error: "listings array cannot be empty" });
    }

    if (listings.length > 100) {
      return res.status(400).json({ error: "Maximum 100 listings per import" });
    }

    const toNumericString = (val: any): string | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]/g, "")) : val;
      return isNaN(num) ? null : String(num);
    };

    const results: { imported: number; updated: number; failed: number; errors: string[] } = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const item of listings) {
      try {
        if (!item.title) {
          results.failed++;
          results.errors.push(`Missing title for listing`);
          continue;
        }

        const sourcePlatform = item.sourcePlatform || source;
        
        if (!item.sourceUrl && sourcePlatform !== "direct" && sourcePlatform !== "manual_import") {
          results.failed++;
          results.errors.push(`Missing sourceUrl for listing "${item.title}" - external platform listings require valid URLs`);
          continue;
        }
        
        const sourceUrl = item.sourceUrl || `#direct-${Date.now()}`;
        
        if (item.sourceUrl && sourcePlatform !== "direct") {
          const urlValidation = validateListingUrl(item.sourceUrl, sourcePlatform);
          if (!urlValidation.valid) {
            results.failed++;
            results.errors.push(`Invalid sourceUrl for "${item.title}": ${urlValidation.reason}${urlValidation.suggestedFix ? ` (${urlValidation.suggestedFix})` : ""}`);
            continue;
          }
        }
        const sourceListingId = item.sourceListingId || `${sourcePlatform.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const listingData = {
          orgId,
          sourcePlatform,
          sourceUrl,
          sourceListingId,
          title: item.title,
          propertyName: item.propertyName || item.title,
          propertyAddress: item.propertyAddress || null,
          city: item.city || null,
          state: item.state || null,
          zipCode: item.zipCode || null,
          marinaType: item.marinaType || "marina",
          propertyType: "marina",
          dealType: item.dealType || "acquisition",
          askingPrice: toNumericString(item.askingPrice),
          totalSlips: item.totalSlips || null,
          wetSlips: item.wetSlips || null,
          dryStorageSpaces: item.dryStorageSpaces || null,
          acreage: toNumericString(item.acreage),
          waterFrontage: toNumericString(item.waterFrontage),
          hasFuel: item.hasFuel || false,
          hasShipStore: item.hasShipStore || false,
          hasRestaurant: item.hasRestaurant || false,
          hasRepairShop: item.hasRepairShop || false,
          hasDryStorage: item.hasDryStorage || false,
          hasBoatRamp: item.hasBoatRamp || false,
          grossRevenue: toNumericString(item.grossRevenue),
          noi: toNumericString(item.noi),
          capRate: toNumericString(item.capRate),
          occupancyRate: toNumericString(item.occupancyRate),
          brokerName: item.brokerName || null,
          brokerCompany: item.brokerCompany || null,
          brokerPhone: item.brokerPhone || null,
          brokerEmail: item.brokerEmail || null,
          originalDescription: item.originalDescription || null,
          images: item.images || null,
          attributionText: `${attributionPrefix} - ${item.brokerCompany || item.brokerName || sourcePlatform}`,
          status: "active",
          isReviewed: false,
          listingDate: item.listingDate ? new Date(item.listingDate) : new Date(),
          lastScrapedAt: new Date(),
        };

        const dedupeHash = generateListingDedupeHash(listingData);

        const [existing] = await db
          .select()
          .from(marinaListings)
          .where(and(eq(marinaListings.orgId, orgId), eq(marinaListings.dedupeHash, dedupeHash)))
          .limit(1);

        if (existing) {
          await db
            .update(marinaListings)
            .set({ ...listingData, updatedAt: new Date() })
            .where(eq(marinaListings.id, existing.id));
          results.updated++;
        } else {
          const validated = insertMarinaListingSchema.parse({ ...listingData, dedupeHash });
          const [newListing] = await db.insert(marinaListings).values(validated).returning();
          await scoreListingAgainstCriteria(newListing.id, orgId);
          results.imported++;
        }
      } catch (itemError: any) {
        results.failed++;
        results.errors.push(`Error importing "${item.title}": ${itemError.message}`);
      }
    }

    res.json({
      success: true,
      results,
      message: `Imported ${results.imported} new listings, updated ${results.updated}, ${results.failed} failed`,
    });
  } catch (error: any) {
    console.error("Error in bulk import:", error);
    res.status(400).json({ error: error.message || "Failed to import listings" });
  }
});

// ============================================
// INVESTMENT CRITERIA PROFILES
// ============================================

router.get("/criteria-profiles", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const profiles = await db
      .select()
      .from(investmentCriteriaProfiles)
      .where(eq(investmentCriteriaProfiles.orgId, orgId))
      .orderBy(desc(investmentCriteriaProfiles.isDefault), asc(investmentCriteriaProfiles.name));

    res.json(profiles);
  } catch (error) {
    console.error("Error fetching criteria profiles:", error);
    res.status(500).json({ error: "Failed to fetch criteria profiles" });
  }
});

router.get("/criteria-profiles/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [profile] = await db
      .select()
      .from(investmentCriteriaProfiles)
      .where(and(eq(investmentCriteriaProfiles.id, req.params.id), eq(investmentCriteriaProfiles.orgId, orgId)));

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const [location] = await db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, profile.id));
    const [financial] = await db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, profile.id));
    const [operational] = await db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, profile.id));
    const [size] = await db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, profile.id));
    const [capital] = await db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, profile.id));
    const [involvement] = await db.select().from(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, profile.id));
    const [capex] = await db.select().from(investmentCriteriaCapex).where(eq(investmentCriteriaCapex.profileId, profile.id));

    res.json({
      ...profile,
      criteria: { location, financial, operational, size, capital, involvement, capex }
    });
  } catch (error) {
    console.error("Error fetching criteria profile:", error);
    res.status(500).json({ error: "Failed to fetch criteria profile" });
  }
});

router.post("/criteria-profiles", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { criteria, ...profileData } = req.body;
    const validated = insertInvestmentCriteriaProfileSchema.parse({ ...profileData, orgId, createdBy: userId });
    
    const [profile] = await db.insert(investmentCriteriaProfiles).values(validated).returning();

    if (criteria) {
      if (criteria.location) {
        await db.insert(investmentCriteriaLocation).values({ ...criteria.location, profileId: profile.id, orgId });
      }
      if (criteria.financial) {
        await db.insert(investmentCriteriaFinancial).values({ ...criteria.financial, profileId: profile.id, orgId });
      }
      if (criteria.operational) {
        await db.insert(investmentCriteriaOperational).values({ ...criteria.operational, profileId: profile.id, orgId });
      }
      if (criteria.size) {
        await db.insert(investmentCriteriaSize).values({ ...criteria.size, profileId: profile.id, orgId });
      }
      if (criteria.capital) {
        await db.insert(investmentCriteriaCapital).values({ ...criteria.capital, profileId: profile.id, orgId });
      }
      if (criteria.involvement) {
        await db.insert(investmentCriteriaInvolvement).values({ ...criteria.involvement, profileId: profile.id, orgId });
      }
      if (criteria.capex) {
        await db.insert(investmentCriteriaCapex).values({ ...criteria.capex, profileId: profile.id, orgId });
      }
    }

    res.status(201).json(profile);
  } catch (error: any) {
    console.error("Error creating criteria profile:", error);
    res.status(400).json({ error: error.message || "Failed to create criteria profile" });
  }
});

router.patch("/criteria-profiles/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { criteria, ...profileData } = req.body;
    const validated = updateInvestmentCriteriaProfileSchema.parse(profileData);
    
    const [updated] = await db
      .update(investmentCriteriaProfiles)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(investmentCriteriaProfiles.id, req.params.id), eq(investmentCriteriaProfiles.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Profile not found" });

    if (criteria) {
      const profileId = updated.id;
      
      if (criteria.location) {
        await db.delete(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, profileId));
        await db.insert(investmentCriteriaLocation).values({ ...criteria.location, profileId, orgId });
      }
      if (criteria.financial) {
        await db.delete(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, profileId));
        await db.insert(investmentCriteriaFinancial).values({ ...criteria.financial, profileId, orgId });
      }
      if (criteria.operational) {
        await db.delete(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, profileId));
        await db.insert(investmentCriteriaOperational).values({ ...criteria.operational, profileId, orgId });
      }
      if (criteria.size) {
        await db.delete(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, profileId));
        await db.insert(investmentCriteriaSize).values({ ...criteria.size, profileId, orgId });
      }
      if (criteria.capital) {
        await db.delete(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, profileId));
        await db.insert(investmentCriteriaCapital).values({ ...criteria.capital, profileId, orgId });
      }
      if (criteria.involvement) {
        await db.delete(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, profileId));
        await db.insert(investmentCriteriaInvolvement).values({ ...criteria.involvement, profileId, orgId });
      }
      if (criteria.capex) {
        await db.delete(investmentCriteriaCapex).where(eq(investmentCriteriaCapex.profileId, profileId));
        await db.insert(investmentCriteriaCapex).values({ ...criteria.capex, profileId, orgId });
      }
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating criteria profile:", error);
    res.status(400).json({ error: error.message || "Failed to update criteria profile" });
  }
});

router.delete("/criteria-profiles/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(investmentCriteriaProfiles)
      .where(and(eq(investmentCriteriaProfiles.id, req.params.id), eq(investmentCriteriaProfiles.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Profile not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting criteria profile:", error);
    res.status(500).json({ error: "Failed to delete criteria profile" });
  }
});

// ============================================
// GOALS
// ============================================

router.get("/goals", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const goals = await db
      .select()
      .from(marinaMatchGoals)
      .where(eq(marinaMatchGoals.orgId, orgId))
      .orderBy(asc(marinaMatchGoals.priority), desc(marinaMatchGoals.isPrimary));

    res.json(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

router.post("/goals", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertMarinaMatchGoalSchema.parse({ ...req.body, orgId, createdBy: userId });
    const [goal] = await db.insert(marinaMatchGoals).values(validated).returning();
    res.status(201).json(goal);
  } catch (error: any) {
    console.error("Error creating goal:", error);
    res.status(400).json({ error: error.message || "Failed to create goal" });
  }
});

router.patch("/goals/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateMarinaMatchGoalSchema.parse(req.body);
    const [updated] = await db
      .update(marinaMatchGoals)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(marinaMatchGoals.id, req.params.id), eq(marinaMatchGoals.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Goal not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating goal:", error);
    res.status(400).json({ error: error.message || "Failed to update goal" });
  }
});

router.delete("/goals/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(marinaMatchGoals)
      .where(and(eq(marinaMatchGoals.id, req.params.id), eq(marinaMatchGoals.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Goal not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

router.post("/goals/:id/progress", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { recordedValue, notes } = req.body;
    
    const [progress] = await db.insert(marinaMatchGoalProgress).values({
      goalId: req.params.id,
      orgId,
      recordedValue,
      notes,
    }).returning();

    await db
      .update(marinaMatchGoals)
      .set({ currentValue: recordedValue, updatedAt: new Date() })
      .where(eq(marinaMatchGoals.id, req.params.id));

    res.status(201).json(progress);
  } catch (error: any) {
    console.error("Error recording goal progress:", error);
    res.status(400).json({ error: error.message || "Failed to record progress" });
  }
});

// ============================================
// SCRAPE SOURCES HELPERS
// ============================================

function normalizeToArray(value: any): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  }
  return null;
}

function normalizeCrawlFields(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  
  if (result.seedUrls !== undefined) {
    result.seedUrls = normalizeToArray(result.seedUrls);
  }
  if (result.maxPagesPerRun !== undefined) {
    result.maxPagesPerRun = parseInt(result.maxPagesPerRun) || 10;
  }
  if (result.maxCrawlDepth !== undefined) {
    result.maxCrawlDepth = parseInt(result.maxCrawlDepth) || 2;
  }
  if (result.tokenBudgetPerRun !== undefined) {
    const parsed = parseFloat(result.tokenBudgetPerRun);
    result.tokenBudgetPerRun = (isNaN(parsed) ? 1.00 : parsed).toFixed(4);
  }
  
  return result;
}

// ============================================
// SCRAPE SOURCES
// ============================================

router.get("/scrape-sources", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const sources = await db
      .select()
      .from(marinaScrapeources)
      .where(eq(marinaScrapeources.orgId, orgId))
      .orderBy(asc(marinaScrapeources.platform), asc(marinaScrapeources.name));

    res.json(sources);
  } catch (error) {
    console.error("Error fetching scrape sources:", error);
    res.status(500).json({ error: "Failed to fetch scrape sources" });
  }
});

router.post("/scrape-sources", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    console.log("[MarinaMatch Intel] Creating scrape source with body:", JSON.stringify(req.body, null, 2));

    const {
      platform,
      name,
      baseUrl,
      searchUrl,
      config,
      rateLimitRpm,
      respectRobotsTxt,
      userAgent,
      isActive,
      ingestionMethod,
      propertyType,
      keywordsInclude,
      keywordsExclude,
      geographyStates,
      geographyRegion,
      geographyRadius,
      minPrice,
      maxPrice,
      minSlips,
      maxSlips,
      pollingIntervalMinutes,
      capabilities,
      capabilityNotes,
      crawlMode,
      seedUrls,
      maxPagesPerRun,
      maxCrawlDepth,
      tokenBudgetPerRun,
      paginationSelector,
      paginationUrlPattern,
      listingLinkSelector,
    } = req.body;

    // Validate required fields
    if (!platform || !name) {
      console.log("[MarinaMatch Intel] Missing required fields: platform or name");
      return res.status(400).json({ error: "Platform and name are required" });
    }

    const [source] = await db.insert(marinaScrapeources).values({
      orgId,
      platform,
      name,
      baseUrl,
      searchUrl,
      config,
      rateLimitRpm: rateLimitRpm || 30,
      respectRobotsTxt: respectRobotsTxt ?? true,
      userAgent: userAgent || "MarinaMatchBot/1.0",
      isActive: isActive ?? true,
      ingestionMethod: ingestionMethod || "scraping",
      propertyType: propertyType || "marina",
      keywordsInclude: keywordsInclude || ["marina", "boatyard", "yacht club", "boat slip", "dock", "waterfront marina"],
      keywordsExclude: keywordsExclude || ["rv storage", "self-storage", "warehouse", "mini storage"],
      geographyStates: geographyStates || null,
      geographyRegion: geographyRegion || null,
      geographyRadius: geographyRadius || null,
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
      minSlips: minSlips || null,
      maxSlips: maxSlips || null,
      pollingIntervalMinutes: pollingIntervalMinutes || 60,
      capabilities: capabilities || ["scraping"],
      capabilityNotes: capabilityNotes || null,
      crawlMode: crawlMode || "single",
      seedUrls: normalizeToArray(seedUrls),
      maxPagesPerRun: parseInt(maxPagesPerRun) || 10,
      maxCrawlDepth: parseInt(maxCrawlDepth) || 2,
      tokenBudgetPerRun: (parseFloat(tokenBudgetPerRun) || 1.00).toFixed(4),
      paginationSelector: paginationSelector || null,
      paginationUrlPattern: paginationUrlPattern || null,
      listingLinkSelector: listingLinkSelector || null,
    }).returning();
    
    res.status(201).json(source);
  } catch (error: any) {
    console.error("[MarinaMatch Intel] Error creating scrape source:", error);
    console.error("[MarinaMatch Intel] Error details:", error.message, error.stack);
    res.status(400).json({ error: error.message || "Failed to create scrape source" });
  }
});

router.patch("/scrape-sources/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const updateData: Record<string, any> = { updatedAt: new Date() };
    
    const allowedFields = [
      "platform", "name", "baseUrl", "searchUrl", "config",
      "rateLimitRpm", "respectRobotsTxt", "userAgent", "isActive",
      "ingestionMethod", "propertyType", "keywordsInclude", "keywordsExclude",
      "geographyStates", "geographyRegion", "geographyRadius",
      "minPrice", "maxPrice", "minSlips", "maxSlips",
      "pollingIntervalMinutes", "capabilities", "capabilityNotes",
      "lastSeenListingId", "lastSeenContentHash", "lastDeltaCheckAt",
      "crawlMode", "seedUrls", "maxPagesPerRun", "maxCrawlDepth",
      "tokenBudgetPerRun", "paginationSelector", "paginationUrlPattern",
      "listingLinkSelector",
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const normalizedData = normalizeCrawlFields(updateData);

    const [updated] = await db
      .update(marinaScrapeources)
      .set(normalizedData)
      .where(and(eq(marinaScrapeources.id, req.params.id), eq(marinaScrapeources.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Scrape source not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating scrape source:", error);
    res.status(400).json({ error: error.message || "Failed to update scrape source" });
  }
});

router.delete("/scrape-sources/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(marinaScrapeources)
      .where(and(eq(marinaScrapeources.id, req.params.id), eq(marinaScrapeources.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Scrape source not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting scrape source:", error);
    res.status(500).json({ error: "Failed to delete scrape source" });
  }
});

// ============================================
// MATCHING ENGINE
// ============================================

async function scoreListingAgainstCriteria(listingId: string, orgId: string): Promise<void> {
  const [listing] = await db.select().from(marinaListings).where(eq(marinaListings.id, listingId));
  if (!listing) return;

  const profiles = await db
    .select()
    .from(investmentCriteriaProfiles)
    .where(and(eq(investmentCriteriaProfiles.orgId, orgId), eq(investmentCriteriaProfiles.isActive, true)));

  let bestScore = 0;
  let bestProfileId: string | null = null;
  const allScores: any[] = [];

  for (const profile of profiles) {
    const score = await calculateMatchScore(listing, profile);
    allScores.push({
      profileId: profile.id,
      profileName: profile.name,
      overallScore: score.overall,
      breakdown: score.breakdown,
    });

    await db.delete(marinaListingMatches).where(
      and(eq(marinaListingMatches.listingId, listingId), eq(marinaListingMatches.criteriaProfileId, profile.id))
    );

    await db.insert(marinaListingMatches).values({
      listingId,
      criteriaProfileId: profile.id,
      orgId,
      overallScore: score.overall,
      locationScore: score.breakdown.location,
      financialScore: score.breakdown.financial,
      operationalScore: score.breakdown.operational,
      sizeScore: score.breakdown.size,
      capitalScore: score.breakdown.capital,
      involvementScore: score.breakdown.involvement,
      capexScore: score.breakdown.capex,
      scoreBreakdown: score.breakdown,
      passesHardRequirements: score.passesHardRequirements,
      disqualificationReasons: score.disqualificationReasons,
    });

    if (score.overall > bestScore) {
      bestScore = score.overall;
      bestProfileId = profile.id;
    }
  }

  await db
    .update(marinaListings)
    .set({
      bestCriteriaId: bestProfileId,
      bestMatchScore: bestScore,
      matchScores: allScores,
      updatedAt: new Date(),
    })
    .where(eq(marinaListings.id, listingId));
}

async function calculateMatchScore(listing: MarinaListing, profile: InvestmentCriteriaProfile) {
  const breakdown: any = {
    location: 0,
    financial: 0,
    operational: 0,
    size: 0,
    capital: 0,
    involvement: 0,
    capex: 0,
  };
  const disqualificationReasons: string[] = [];
  let passesHardRequirements = true;

  const [location] = await db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, profile.id));
  const [financial] = await db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, profile.id));
  const [operational] = await db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, profile.id));
  const [size] = await db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, profile.id));
  const [capital] = await db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, profile.id));
  const [involvement] = await db.select().from(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, profile.id));
  const [capex] = await db.select().from(investmentCriteriaCapex).where(eq(investmentCriteriaCapex.profileId, profile.id));

  if (location) {
    let locationScore = 100;
    if (location.targetStates?.length && listing.state) {
      if (!location.targetStates.includes(listing.state.toUpperCase())) {
        locationScore = 0;
        disqualificationReasons.push(`State ${listing.state} not in target states`);
      }
    }
    if (location.excludedStates?.length && listing.state) {
      if (location.excludedStates.includes(listing.state.toUpperCase())) {
        locationScore = 0;
        passesHardRequirements = false;
        disqualificationReasons.push(`State ${listing.state} is excluded`);
      }
    }
    breakdown.location = locationScore;
  } else {
    breakdown.location = 50;
  }

  if (financial) {
    let financialScore = 100;
    const askingPrice = listing.askingPrice ? parseFloat(listing.askingPrice) : null;
    const capRate = listing.capRate ? parseFloat(listing.capRate) : null;
    
    if (askingPrice && financial.minAskingPrice && askingPrice < parseFloat(financial.minAskingPrice)) {
      financialScore -= 30;
    }
    if (askingPrice && financial.maxAskingPrice && askingPrice > parseFloat(financial.maxAskingPrice)) {
      financialScore -= 30;
      disqualificationReasons.push("Exceeds max price");
    }
    if (capRate && financial.minCapRate && capRate < parseFloat(financial.minCapRate)) {
      financialScore -= 20;
    }
    if (capRate && financial.maxCapRate && capRate > parseFloat(financial.maxCapRate)) {
      financialScore -= 20;
    }
    breakdown.financial = Math.max(0, financialScore);
  } else {
    breakdown.financial = 50;
  }

  if (operational) {
    let operationalScore = 100;
    if (operational.requireFuelDock && !listing.hasFuel) {
      operationalScore -= 25;
      disqualificationReasons.push("No fuel dock");
    }
    if (operational.requireShipStore && !listing.hasShipStore) {
      operationalScore -= 15;
    }
    if (operational.requireRepairShop && !listing.hasRepairShop) {
      operationalScore -= 15;
    }
    if (operational.requireDryStorage && !listing.hasDryStorage) {
      operationalScore -= 20;
    }
    breakdown.operational = Math.max(0, operationalScore);
  } else {
    breakdown.operational = 50;
  }

  if (size) {
    let sizeScore = 100;
    if (listing.totalSlips) {
      if (size.minTotalSlips && listing.totalSlips < size.minTotalSlips) {
        sizeScore -= 30;
      }
      if (size.maxTotalSlips && listing.totalSlips > size.maxTotalSlips) {
        sizeScore -= 30;
      }
    }
    if (listing.acreage) {
      const acreage = parseFloat(listing.acreage);
      if (size.minAcreage && acreage < parseFloat(size.minAcreage)) {
        sizeScore -= 20;
      }
      if (size.maxAcreage && acreage > parseFloat(size.maxAcreage)) {
        sizeScore -= 20;
      }
    }
    breakdown.size = Math.max(0, sizeScore);
  } else {
    breakdown.size = 50;
  }

  breakdown.capital = capital ? 75 : 50;
  breakdown.involvement = involvement ? 75 : 50;
  breakdown.capex = capex ? 75 : 50;

  const weights = {
    location: profile.locationWeight || 20,
    financial: profile.financialWeight || 25,
    operational: profile.operationalWeight || 15,
    size: profile.sizeWeight || 15,
    capital: profile.capitalWeight || 10,
    involvement: profile.involvementWeight || 5,
    capex: profile.capexWeight || 10,
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let weightedScore = 0;
  for (const [key, score] of Object.entries(breakdown)) {
    weightedScore += (score * (weights[key as keyof typeof weights] || 0)) / totalWeight;
  }

  return {
    overall: Math.round(weightedScore),
    breakdown,
    passesHardRequirements,
    disqualificationReasons,
  };
}

router.post("/listings/:id/rescore", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    await scoreListingAgainstCriteria(req.params.id, orgId);

    const [listing] = await db
      .select()
      .from(marinaListings)
      .where(eq(marinaListings.id, req.params.id));

    res.json(listing);
  } catch (error) {
    console.error("Error rescoring listing:", error);
    res.status(500).json({ error: "Failed to rescore listing" });
  }
});

router.post("/bulk-rescore", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const listings = await db
      .select()
      .from(marinaListings)
      .where(eq(marinaListings.orgId, orgId));

    let rescored = 0;
    for (const listing of listings) {
      await scoreListingAgainstCriteria(listing.id, orgId);
      rescored++;
    }

    res.json({ success: true, rescored });
  } catch (error) {
    console.error("Error bulk rescoring:", error);
    res.status(500).json({ error: "Failed to bulk rescore" });
  }
});

// ============================================
// ENHANCED SCORING ROUTES (Using Match Scoring Service)
// ============================================

// Get available marina departments for criteria configuration
router.get("/departments", async (_req: Request, res: Response) => {
  res.json({
    allDepartments: MARINA_DEPARTMENTS,
    storageDepartments: STORAGE_DEPARTMENTS,
  });
});

// Get detailed match breakdown for a listing against a specific profile
router.get("/criteria-profiles/:profileId/matches/:listingId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { profileId, listingId } = req.params;

    // Load the criteria profile
    const criteria = await matchScoringService.loadFullCriteriaProfile(profileId, orgId);
    if (!criteria) {
      return res.status(404).json({ error: "Criteria profile not found" });
    }

    // Load the listing
    const [listing] = await db.select()
      .from(marinaListings)
      .where(eq(marinaListings.id, listingId));

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Compute detailed match score
    const matchResult = matchScoringService.computeMatchScore(criteria, listing);

    res.json({
      listing: {
        id: listing.id,
        title: listing.title,
        propertyName: listing.propertyName,
        city: listing.city,
        state: listing.state,
        askingPrice: listing.askingPrice,
      },
      profile: {
        id: criteria.profile.id,
        name: criteria.profile.name,
      },
      match: {
        overallScore: Math.round(matchResult.overallScore * 100),
        passesAllMustHave: matchResult.passesAllMustHave,
        hardFilterFailed: matchResult.hardFilterFailed,
        failedReasons: matchResult.failedReasons,
        breakdown: matchResult.breakdown.map(b => ({
          ...b,
          scorePercentage: Math.round(b.score * 100),
        })),
      },
    });
  } catch (error) {
    console.error("Error getting match breakdown:", error);
    res.status(500).json({ error: "Failed to get match breakdown" });
  }
});

// Get all matches for a criteria profile with pagination
router.get("/criteria-profiles/:profileId/matches", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { profileId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const minScore = parseInt(req.query.minScore as string) || 0;
    const onlyPassing = req.query.onlyPassing === 'true';

    // Load criteria profile
    const criteria = await matchScoringService.loadFullCriteriaProfile(profileId, orgId);
    if (!criteria) {
      return res.status(404).json({ error: "Criteria profile not found" });
    }

    // Get all active listings
    const listings = await db.select()
      .from(marinaListings)
      .where(and(
        eq(marinaListings.status, 'active'),
        eq(marinaListings.orgId, orgId)
      ));

    // Score each listing
    const scoredListings = listings.map(listing => {
      const matchResult = matchScoringService.computeMatchScore(criteria, listing);
      return {
        listing,
        score: Math.round(matchResult.overallScore * 100),
        passesAllMustHave: matchResult.passesAllMustHave,
        failedReasons: matchResult.failedReasons,
        breakdown: matchResult.breakdown,
      };
    });

    // Filter by minimum score and passing status
    let filteredListings = scoredListings.filter(l => l.score >= minScore);
    if (onlyPassing) {
      filteredListings = filteredListings.filter(l => l.passesAllMustHave);
    }

    // Sort by score descending
    filteredListings.sort((a, b) => b.score - a.score);

    // Paginate
    const total = filteredListings.length;
    const start = (page - 1) * pageSize;
    const paginatedListings = filteredListings.slice(start, start + pageSize);

    res.json({
      profile: {
        id: criteria.profile.id,
        name: criteria.profile.name,
      },
      listings: paginatedListings.map(l => ({
        id: l.listing.id,
        title: l.listing.title,
        propertyName: l.listing.propertyName,
        city: l.listing.city,
        state: l.listing.state,
        askingPrice: l.listing.askingPrice,
        totalSlips: l.listing.totalSlips,
        score: l.score,
        passesAllMustHave: l.passesAllMustHave,
        failedReasons: l.failedReasons,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error getting profile matches:", error);
    res.status(500).json({ error: "Failed to get profile matches" });
  }
});

// Rescore all listings for a specific profile using enhanced scoring
router.post("/criteria-profiles/:profileId/rescore-all", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { profileId } = req.params;

    const scoredCount = await matchScoringService.scoreAllListingsForProfile(profileId, orgId);

    res.json({ 
      success: true, 
      rescored: scoredCount,
      message: `Scored ${scoredCount} listings against criteria profile` 
    });
  } catch (error) {
    console.error("Error rescoring listings for profile:", error);
    res.status(500).json({ error: "Failed to rescore listings" });
  }
});

// ============================================
// ANALYTICS
// ============================================

router.get("/analytics/overview", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const allListings = await db.select().from(marinaListings).where(eq(marinaListings.orgId, orgId));
    const goals = await db.select().from(marinaMatchGoals).where(eq(marinaMatchGoals.orgId, orgId));
    const profiles = await db.select().from(investmentCriteriaProfiles).where(eq(investmentCriteriaProfiles.orgId, orgId));
    const sources = await db.select().from(marinaScrapeources).where(eq(marinaScrapeources.orgId, orgId));

    // Filter out listings hidden by the current user (same as listings endpoint)
    let hiddenListingIds: string[] = [];
    if (userId) {
      const hiddenListings = await db
        .select({ listingId: userHiddenListings.listingId })
        .from(userHiddenListings)
        .where(eq(userHiddenListings.userId, userId));
      hiddenListingIds = hiddenListings.map(h => h.listingId);
    }
    
    const listings = allListings.filter(l => !hiddenListingIds.includes(l.id));

    const activeListings = listings.filter(l => l.status === "active");
    const highMatchListings = listings.filter(l => (l.bestMatchScore || 0) >= 70);
    const avgMatchScore = activeListings.length > 0
      ? activeListings.reduce((sum, l) => sum + (l.bestMatchScore || 0), 0) / activeListings.length
      : 0;

    const listingsBySource = listings.reduce((acc: any, l) => {
      acc[l.sourcePlatform] = (acc[l.sourcePlatform] || 0) + 1;
      return acc;
    }, {});

    const listingsByState = listings.reduce((acc: any, l) => {
      if (l.state) {
        acc[l.state] = (acc[l.state] || 0) + 1;
      }
      return acc;
    }, {});

    res.json({
      totalListings: listings.length,
      activeListings: activeListings.length,
      highMatchListings: highMatchListings.length,
      avgMatchScore: Math.round(avgMatchScore),
      totalGoals: goals.length,
      activeProfiles: profiles.filter(p => p.isActive).length,
      activeSources: sources.filter(s => s.isActive).length,
      listingsBySource,
      listingsByState,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ============================================
// SCRAPING
// ============================================

router.get("/scrape-runs", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const runs = await db
      .select()
      .from(marinaScrapeRuns)
      .where(eq(marinaScrapeRuns.orgId, orgId))
      .orderBy(desc(marinaScrapeRuns.startedAt))
      .limit(20);

    res.json(runs);
  } catch (error) {
    console.error("Error fetching scrape runs:", error);
    res.status(500).json({ error: "Failed to fetch scrape runs" });
  }
});

router.post("/scrape/trigger", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { platforms = ["crexi", "bizbuysell"] } = req.body;
    
    const { runScrapeJob } = await import("./services/cre-scraper");
    const result = await runScrapeJob(orgId, platforms);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error triggering scrape:", error);
    res.status(500).json({ error: error.message || "Failed to trigger scrape" });
  }
});

router.get("/scrape/stats", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { getScrapingStats } = await import("./services/cre-scraper");
    const stats = await getScrapingStats(orgId);

    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching scrape stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scrape stats" });
  }
});

router.post("/seed-demo-data", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const sampleListings = [
      {
        id: `listing-${crypto.randomUUID()}`,
        orgId,
        title: "Gulf Breeze Marina - Full Service",
        propertyName: "Gulf Breeze Marina",
        propertyAddress: "4200 Marina Way",
        city: "Pensacola",
        state: "FL",
        zipCode: "32507",
        askingPrice: "8500000",
        totalSlips: 185,
        wetSlips: 150,
        dryStorage: 35,
        grossRevenue: "2100000",
        noi: "890000",
        capRate: "10.47",
        occupancyRate: "94",
        acreage: "12.5",
        waterDepth: "8",
        sourcePlatform: "Crexi",
        sourceUrl: "https://www.crexi.com/properties/example-1",
        status: "active",
        hasFuel: true,
        hasShipStore: true,
        hasRepairShop: true,
        hasDryStorage: true,
        bestMatchScore: 87,
        attributionText: "Listing sourced from Crexi. All data provided for informational purposes only.",
        brokerName: "John Marine Brokers",
        brokerCompany: "Coastal CRE Group",
        brokerPhone: "(850) 555-0123",
        brokerEmail: "john@coastalcre.com",
        originalDescription: "Premier full-service marina located in the heart of Pensacola's waterfront district. Features 185 slips with deep-water access, on-site fuel dock, fully stocked ship store, and certified repair facility. Strong cash flow with excellent upside potential through slip rate optimization.",
        listingDate: "2024-01-15",
        dedupeHash: crypto.createHash("md5").update("crexi|gulf breeze marina|4200 marina way|pensacola|fl").digest("hex"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `listing-${crypto.randomUUID()}`,
        orgId,
        title: "Sunset Cove Marina",
        propertyName: "Sunset Cove Marina",
        propertyAddress: "789 Harbor Drive",
        city: "Naples",
        state: "FL",
        zipCode: "34102",
        askingPrice: "12750000",
        totalSlips: 245,
        wetSlips: 200,
        dryStorage: 45,
        grossRevenue: "3200000",
        noi: "1450000",
        capRate: "11.37",
        occupancyRate: "97",
        acreage: "18.2",
        waterDepth: "10",
        sourcePlatform: "LoopNet",
        sourceUrl: "https://www.loopnet.com/listing/example-2",
        status: "active",
        hasFuel: true,
        hasShipStore: true,
        hasRepairShop: false,
        hasDryStorage: true,
        bestMatchScore: 92,
        attributionText: "Listing sourced from LoopNet. All data provided for informational purposes only.",
        brokerName: "Sarah Waters",
        brokerCompany: "Premier Marine Realty",
        brokerPhone: "(239) 555-0456",
        brokerEmail: "swaters@premiermarinerealty.com",
        originalDescription: "Exceptional marina opportunity in Naples' prestigious waterfront location. Featuring 245 total slips with premium amenities, this property offers strong NOI with room for revenue enhancement through rate increases and additional services.",
        listingDate: "2024-02-01",
        dedupeHash: crypto.createHash("md5").update("loopnet|sunset cove marina|789 harbor drive|naples|fl").digest("hex"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `listing-${crypto.randomUUID()}`,
        orgId,
        title: "Bay Harbor Marine Center",
        propertyName: "Bay Harbor Marine Center",
        propertyAddress: "1500 Waterfront Blvd",
        city: "Sarasota",
        state: "FL",
        zipCode: "34236",
        askingPrice: "6200000",
        totalSlips: 120,
        wetSlips: 100,
        dryStorage: 20,
        grossRevenue: "1450000",
        noi: "580000",
        capRate: "9.35",
        occupancyRate: "91",
        acreage: "8.3",
        waterDepth: "7",
        sourcePlatform: "BizBuySell",
        sourceUrl: "https://www.bizbuysell.com/listing/example-3",
        status: "active",
        hasFuel: true,
        hasShipStore: false,
        hasRepairShop: true,
        hasDryStorage: true,
        bestMatchScore: 74,
        attributionText: "Listing sourced from BizBuySell. All data provided for informational purposes only.",
        brokerName: "Michael Anchor",
        brokerCompany: "Gulf Coast Business Brokers",
        brokerPhone: "(941) 555-0789",
        brokerEmail: "manchor@gcbb.com",
        originalDescription: "Well-maintained marina with established customer base in growing Sarasota market. Full-service repair shop and fuel dock provide strong ancillary revenue streams. Ideal for owner-operator or addition to existing portfolio.",
        listingDate: "2024-01-28",
        dedupeHash: crypto.createHash("md5").update("bizbuysell|bay harbor marine center|1500 waterfront blvd|sarasota|fl").digest("hex"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `listing-${crypto.randomUUID()}`,
        orgId,
        title: "Charleston Harbor Marina",
        propertyName: "Charleston Harbor Marina",
        propertyAddress: "2100 Coastal Way",
        city: "Charleston",
        state: "SC",
        zipCode: "29401",
        askingPrice: "9800000",
        totalSlips: 175,
        wetSlips: 160,
        dryStorage: 15,
        grossRevenue: "2400000",
        noi: "1020000",
        capRate: "10.41",
        occupancyRate: "96",
        acreage: "14.1",
        waterDepth: "9",
        sourcePlatform: "Crexi",
        sourceUrl: "https://www.crexi.com/properties/example-4",
        status: "active",
        hasFuel: true,
        hasShipStore: true,
        hasRepairShop: true,
        hasDryStorage: false,
        bestMatchScore: 81,
        attributionText: "Listing sourced from Crexi. All data provided for informational purposes only.",
        brokerName: "Robert Maritime",
        brokerCompany: "Lowcountry CRE",
        brokerPhone: "(843) 555-0321",
        brokerEmail: "rmaritime@lowcountrycre.com",
        originalDescription: "Historic Charleston marina with deep-water access and stunning harbor views. Prime location attracts high-net-worth boaters and transient traffic. Recent infrastructure upgrades including new floating docks and electrical systems.",
        listingDate: "2024-02-10",
        dedupeHash: crypto.createHash("md5").update("crexi|charleston harbor marina|2100 coastal way|charleston|sc").digest("hex"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `listing-${crypto.randomUUID()}`,
        orgId,
        title: "Lake Travis Marina & Resort",
        propertyName: "Lake Travis Marina & Resort",
        propertyAddress: "500 Lakefront Road",
        city: "Austin",
        state: "TX",
        zipCode: "78734",
        askingPrice: "15500000",
        totalSlips: 320,
        wetSlips: 280,
        dryStorage: 40,
        grossRevenue: "4100000",
        noi: "1845000",
        capRate: "11.9",
        occupancyRate: "99",
        acreage: "22.5",
        waterDepth: "12",
        sourcePlatform: "LoopNet",
        sourceUrl: "https://www.loopnet.com/listing/example-5",
        status: "active",
        hasFuel: true,
        hasShipStore: true,
        hasRepairShop: true,
        hasDryStorage: true,
        bestMatchScore: 95,
        attributionText: "Listing sourced from LoopNet. All data provided for informational purposes only.",
        brokerName: "Texas Marina Specialists",
        brokerCompany: "Hill Country Brokers",
        brokerPhone: "(512) 555-0654",
        brokerEmail: "sales@texasmarinasales.com",
        originalDescription: "Trophy marina asset on Lake Travis with exceptional demand metrics. Nearly 100% occupancy with extensive waitlist. Multiple revenue streams including boat rentals, restaurant lease, and event space. Rare opportunity in undersupplied Austin market.",
        listingDate: "2024-02-05",
        dedupeHash: crypto.createHash("md5").update("loopnet|lake travis marina & resort|500 lakefront road|austin|tx").digest("hex"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const existingListings = await db
      .select({ id: marinaListings.id })
      .from(marinaListings)
      .where(eq(marinaListings.orgId, orgId))
      .limit(1);

    if (existingListings.length > 0) {
      return res.json({ 
        message: "Demo data already exists", 
        listingsCount: existingListings.length 
      });
    }

    await db.insert(marinaListings).values(sampleListings);

    res.json({
      success: true,
      message: "Demo marina listings seeded successfully",
      listingsCount: sampleListings.length,
    });
  } catch (error: any) {
    console.error("Error seeding demo data:", error);
    res.status(500).json({ error: error.message || "Failed to seed demo data" });
  }
});

// ============================================
// LISTING FEEDBACK SYSTEM
// Global feedback collection for AI training
// ============================================

router.get("/feedback/reasons", async (req: Request, res: Response) => {
  try {
    const reasons = [
      { value: "sold_closed", label: "Sold / Closed", description: "This listing has been sold or the deal is closed" },
      { value: "under_contract", label: "Under Contract", description: "This listing is under contract or pending sale" },
      { value: "off_market", label: "Off Market", description: "This listing is no longer actively for sale" },
      { value: "duplicate_listing", label: "Duplicate", description: "This appears to be a duplicate of another listing" },
      { value: "not_a_marina", label: "Not a Marina", description: "This is not a marina property" },
      { value: "incorrect_information", label: "Incorrect Info", description: "The listing contains incorrect information" },
      { value: "spam_or_fake", label: "Spam / Fake", description: "This appears to be spam or a fake listing" },
      { value: "broken_link", label: "Broken Link", description: "The original listing link no longer works" },
      { value: "other", label: "Other", description: "Other issue not listed above" },
    ];
    res.json(reasons);
  } catch (error) {
    console.error("Error fetching feedback reasons:", error);
    res.status(500).json({ error: "Failed to fetch feedback reasons" });
  }
});

const AUTO_APPROVAL_THRESHOLD = 3;

router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { listingId, reason, customReason, details } = req.body;

    if (!listingId || !reason) {
      return res.status(400).json({ error: "listingId and reason are required" });
    }

    if (!listingFeedbackReasons.includes(reason)) {
      return res.status(400).json({ error: "Invalid feedback reason" });
    }

    const listing = await db
      .select()
      .from(marinaListings)
      .where(eq(marinaListings.id, listingId))
      .limit(1);

    if (!listing.length) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const [feedback] = await db.insert(marinaListingFeedback).values({
      listingId,
      userId,
      orgId,
      reason,
      customReason: customReason || null,
      details: details || null,
      listingTitle: listing[0].title,
      listingSource: listing[0].sourcePlatform,
      listingUrl: listing[0].sourceUrl,
      status: "pending",
    }).returning();

    // Immediately hide the listing from the reporting user's feed
    if (userId && orgId) {
      const existingHidden = await db
        .select()
        .from(userHiddenListings)
        .where(and(
          eq(userHiddenListings.userId, userId),
          eq(userHiddenListings.listingId, listingId)
        ))
        .limit(1);

      if (!existingHidden.length) {
        await db.insert(userHiddenListings).values({
          userId,
          orgId,
          listingId,
          reason,
        });
        console.log(`[MarinaMatch Intel] Listing hidden from user feed:`, { userId, listingId, reason });
      }
    }

    // Check for auto-approval threshold
    const [{ feedbackCount }] = await db
      .select({ feedbackCount: sql<number>`count(DISTINCT user_id)::int` })
      .from(marinaListingFeedback)
      .where(and(
        eq(marinaListingFeedback.listingId, listingId),
        eq(marinaListingFeedback.status, "pending")
      ));

    let autoApproved = false;
    if (feedbackCount >= AUTO_APPROVAL_THRESHOLD) {
      // Auto-approve: enough users have reported the same listing
      await db
        .update(marinaListingFeedback)
        .set({ status: "approved", reviewNotes: "Auto-approved: threshold reached" })
        .where(and(
          eq(marinaListingFeedback.listingId, listingId),
          eq(marinaListingFeedback.status, "pending")
        ));

      // Mark the listing as removed
      await db
        .update(marinaListings)
        .set({ status: "removed" })
        .where(eq(marinaListings.id, listingId));

      // Create an AI pattern for this listing to filter similar ones
      const patternData = {
        patternType: "listing_url",
        pattern: listing[0].sourceUrl || "",
        reason,
        source: listing[0].sourcePlatform,
        feedbackCount,
        isActive: true,
        confidence: "1.00",
        createdFromFeedbackId: feedback.id,
      };

      await db.insert(marinaAiFilterPatterns).values(patternData);

      // Invalidate learned patterns cache
      invalidateLearnedPatternsCache();

      autoApproved = true;
      console.log(`[MarinaMatch Intel] Auto-approved feedback - threshold reached:`, {
        listingId,
        feedbackCount,
        threshold: AUTO_APPROVAL_THRESHOLD,
        listingRemoved: true,
        patternCreated: true,
      });
    }

    // Log feedback submission for audit trail and AI training pipeline
    console.log(`[MarinaMatch Intel] Feedback submitted:`, {
      feedbackId: feedback.id,
      listingId,
      reason,
      listingTitle: listing[0].title,
      listingSource: listing[0].sourcePlatform,
      userId,
      orgId,
      timestamp: new Date().toISOString(),
      aiTrainingStatus: autoApproved ? "auto_approved" : "pending_review",
      hiddenFromUserFeed: true,
    });

    res.json({
      success: true,
      message: autoApproved 
        ? "Thank you! Multiple users reported this listing - it has been removed for all users."
        : "Thank you for your feedback. This listing has been removed from your feed.",
      feedbackId: feedback.id,
      listingHidden: true,
      autoApproved,
    });
  } catch (error: any) {
    console.error("[MarinaMatch Intel] Error submitting feedback:", error);
    res.status(500).json({ error: error.message || "Failed to submit feedback" });
  }
});

router.get("/feedback", async (req: Request, res: Response) => {
  try {
    const { status, reason, page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let conditions = [];
    if (status) {
      conditions.push(eq(marinaListingFeedback.status, status as string));
    }
    if (reason) {
      conditions.push(eq(marinaListingFeedback.reason, reason as string));
    }

    const feedbackList = await db
      .select()
      .from(marinaListingFeedback)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(marinaListingFeedback.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marinaListingFeedback)
      .where(conditions.length ? and(...conditions) : undefined);

    const [{ pendingCount }] = await db
      .select({ pendingCount: sql<number>`count(*)::int` })
      .from(marinaListingFeedback)
      .where(eq(marinaListingFeedback.status, "pending"));

    res.json({
      feedback: feedbackList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
      stats: {
        pending: pendingCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: error.message || "Failed to fetch feedback" });
  }
});

router.get("/feedback/stats", async (req: Request, res: Response) => {
  try {
    const [totals] = await db
      .select({ 
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        approved: sql<number>`count(*) filter (where status = 'approved')::int`,
        dismissed: sql<number>`count(*) filter (where status = 'dismissed')::int`,
      })
      .from(marinaListingFeedback);

    const byReason = await db
      .select({
        reason: marinaListingFeedback.reason,
        count: sql<number>`count(*)::int`,
      })
      .from(marinaListingFeedback)
      .groupBy(marinaListingFeedback.reason)
      .orderBy(desc(sql`count(*)`));

    const bySource = await db
      .select({
        source: marinaListingFeedback.listingSource,
        count: sql<number>`count(*)::int`,
      })
      .from(marinaListingFeedback)
      .groupBy(marinaListingFeedback.listingSource)
      .orderBy(desc(sql`count(*)`));

    const [patterns] = await db
      .select({ 
        totalPatterns: sql<number>`count(*)::int`,
        activePatterns: sql<number>`count(*) filter (where is_active = true)::int`,
      })
      .from(marinaAiFilterPatterns);

    res.json({
      totals,
      byReason,
      bySource,
      patterns,
    });
  } catch (error: any) {
    console.error("Error fetching feedback stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch feedback stats" });
  }
});

router.patch("/feedback/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { status, reviewNotes, createPattern } = req.body;

    if (!status || !["approved", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'dismissed'" });
    }

    const [feedback] = await db
      .select()
      .from(marinaListingFeedback)
      .where(eq(marinaListingFeedback.id, id))
      .limit(1);

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const [updated] = await db
      .update(marinaListingFeedback)
      .set({
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      })
      .where(eq(marinaListingFeedback.id, id))
      .returning();

    if (status === "approved" && createPattern && feedback.listingTitle) {
      const titleWords = feedback.listingTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const patternKeywords = titleWords.slice(0, 5).join(" ");
      
      if (patternKeywords) {
        const [newPattern] = await db.insert(marinaAiFilterPatterns).values({
          patternType: "title_keyword",
          pattern: patternKeywords,
          reason: feedback.reason,
          source: feedback.listingSource || undefined,
          createdFromFeedbackId: feedback.id,
          isActive: true,
          confidence: "0.75",
        }).returning();

        await db
          .update(marinaListingFeedback)
          .set({ aiPatternApplied: true })
          .where(eq(marinaListingFeedback.id, id));

        // Invalidate cache so new pattern takes effect immediately
        invalidateLearnedPatternsCache();

        // Log AI pattern creation for training audit
        console.log(`[MarinaMatch Intel] AI Pattern Created from Feedback:`, {
          patternId: newPattern.id,
          patternType: "title_keyword",
          pattern: patternKeywords,
          reason: feedback.reason,
          source: feedback.listingSource,
          feedbackId: feedback.id,
          reviewedBy: userId,
          timestamp: new Date().toISOString(),
          aiTrainingStatus: "pattern_active",
        });
      }
    }

    // Log feedback review action
    console.log(`[MarinaMatch Intel] Feedback Reviewed:`, {
      feedbackId: id,
      status,
      reason: feedback.reason,
      listingTitle: feedback.listingTitle,
      reviewedBy: userId,
      patternCreated: status === "approved" && createPattern,
      timestamp: new Date().toISOString(),
    });

    if (status === "approved") {
      await db
        .update(marinaListings)
        .set({ status: "removed" })
        .where(eq(marinaListings.id, feedback.listingId));
    }

    res.json({
      success: true,
      feedback: updated,
      message: status === "approved" 
        ? "Feedback approved. Listing marked as removed." 
        : "Feedback dismissed.",
    });
  } catch (error: any) {
    console.error("[MarinaMatch Intel] Error updating feedback:", error);
    res.status(500).json({ error: error.message || "Failed to update feedback" });
  }
});

router.get("/ai-patterns", async (req: Request, res: Response) => {
  try {
    const { active, patternType, limit = "100" } = req.query;
    
    let conditions = [];
    if (active === "true") {
      conditions.push(eq(marinaAiFilterPatterns.isActive, true));
    }
    if (patternType) {
      conditions.push(eq(marinaAiFilterPatterns.patternType, patternType as string));
    }

    const patterns = await db
      .select()
      .from(marinaAiFilterPatterns)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(marinaAiFilterPatterns.feedbackCount), desc(marinaAiFilterPatterns.createdAt))
      .limit(parseInt(limit as string));

    res.json(patterns);
  } catch (error: any) {
    console.error("Error fetching AI patterns:", error);
    res.status(500).json({ error: error.message || "Failed to fetch AI patterns" });
  }
});

router.patch("/ai-patterns/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, pattern, confidence } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (pattern) updates.pattern = pattern;
    if (confidence) updates.confidence = confidence;

    const [updated] = await db
      .update(marinaAiFilterPatterns)
      .set(updates)
      .where(eq(marinaAiFilterPatterns.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    // Invalidate pattern cache so changes take effect immediately
    invalidateLearnedPatternsCache();

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating AI pattern:", error);
    res.status(500).json({ error: error.message || "Failed to update AI pattern" });
  }
});

router.delete("/ai-patterns/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(marinaAiFilterPatterns)
      .where(eq(marinaAiFilterPatterns.id, id));

    // Invalidate pattern cache so changes take effect immediately
    invalidateLearnedPatternsCache();

    res.json({ success: true, message: "Pattern deleted" });
  } catch (error: any) {
    console.error("Error deleting AI pattern:", error);
    res.status(500).json({ error: error.message || "Failed to delete AI pattern" });
  }
});

export default router;

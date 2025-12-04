import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, desc, asc, sql, gte, lte, like, or, isNull, inArray } from "drizzle-orm";
import crypto from "crypto";
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
  type MarinaListing,
  type InvestmentCriteriaProfile,
  type MarinaMatchGoal,
  type MarinaScrapeSource,
} from "@shared/schema";
import { getScrapeStatus, ensureListingsExist, getLastScrapeRun } from "./services/intel-cron";
import { PLATFORM_CAPABILITIES, getPlatformCapabilities, getRecommendedMethod } from "./services/cre-scraper";
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
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // No auto-seeding - only show real data from configured sources
    const { status, state, source, minScore, sortBy, limit = "50", offset = "0" } = req.query;

    let listings = await db
      .select()
      .from(marinaListings)
      .where(eq(marinaListings.orgId, orgId))
      .orderBy(desc(marinaListings.bestMatchScore), desc(marinaListings.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    if (status) {
      listings = listings.filter(l => l.status === status);
    }
    if (state) {
      listings = listings.filter(l => l.state?.toLowerCase() === (state as string).toLowerCase());
    }
    if (source) {
      listings = listings.filter(l => l.sourcePlatform === source);
    }
    if (minScore) {
      listings = listings.filter(l => (l.bestMatchScore || 0) >= parseInt(minScore as string));
    }

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

    const [listing] = await db
      .select()
      .from(marinaListings)
      .where(and(eq(marinaListings.id, req.params.id), eq(marinaListings.orgId, orgId)));

    if (!listing) return res.status(404).json({ error: "Listing not found" });

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
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const [updated] = await db
      .update(marinaScrapeources)
      .set(updateData)
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
// ANALYTICS
// ============================================

router.get("/analytics/overview", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const listings = await db.select().from(marinaListings).where(eq(marinaListings.orgId, orgId));
    const goals = await db.select().from(marinaMatchGoals).where(eq(marinaMatchGoals.orgId, orgId));
    const profiles = await db.select().from(investmentCriteriaProfiles).where(eq(investmentCriteriaProfiles.orgId, orgId));
    const sources = await db.select().from(marinaScrapeources).where(eq(marinaScrapeources.orgId, orgId));

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

export default router;

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
import { requireProspecting } from "../middleware/pack-guard";

const router = Router();

function getOrgId(req: Request): string | null {
  return (req as any).session?.user?.orgId || null;
}

function getUserId(req: Request): string | null {
  return (req as any).session?.user?.id || null;
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
// MARINA LISTINGS (Scraped Data)
// ============================================

router.get("/listings", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

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

router.get("/listings/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/listings", requireProspecting, async (req: Request, res: Response) => {
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

router.patch("/listings/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.delete("/listings/:id", requireProspecting, async (req: Request, res: Response) => {
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
// INVESTMENT CRITERIA PROFILES
// ============================================

router.get("/criteria-profiles", requireProspecting, async (req: Request, res: Response) => {
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

router.get("/criteria-profiles/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/criteria-profiles", requireProspecting, async (req: Request, res: Response) => {
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

router.patch("/criteria-profiles/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.delete("/criteria-profiles/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.get("/goals", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/goals", requireProspecting, async (req: Request, res: Response) => {
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

router.patch("/goals/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.delete("/goals/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/goals/:id/progress", requireProspecting, async (req: Request, res: Response) => {
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

router.get("/scrape-sources", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/scrape-sources", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertMarinaScrapeSourceSchema.parse({ ...req.body, orgId });
    const [source] = await db.insert(marinaScrapeources).values(validated).returning();
    res.status(201).json(source);
  } catch (error: any) {
    console.error("Error creating scrape source:", error);
    res.status(400).json({ error: error.message || "Failed to create scrape source" });
  }
});

router.patch("/scrape-sources/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateMarinaScrapeSourceSchema.parse(req.body);
    const [updated] = await db
      .update(marinaScrapeources)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(marinaScrapeources.id, req.params.id), eq(marinaScrapeources.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Scrape source not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating scrape source:", error);
    res.status(400).json({ error: error.message || "Failed to update scrape source" });
  }
});

router.delete("/scrape-sources/:id", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/listings/:id/rescore", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/bulk-rescore", requireProspecting, async (req: Request, res: Response) => {
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

router.get("/analytics/overview", requireProspecting, async (req: Request, res: Response) => {
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

router.get("/scrape-runs", requireProspecting, async (req: Request, res: Response) => {
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

router.post("/scrape/trigger", requireProspecting, async (req: Request, res: Response) => {
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

router.get("/scrape/stats", requireProspecting, async (req: Request, res: Response) => {
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

export default router;

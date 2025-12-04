import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, desc, asc, sql, gte, lte, like, or, isNull } from "drizzle-orm";
import crypto from "crypto";
import intelRouter from "./intel-routes";
import {
  dealSources,
  investmentMandates,
  mandateCriteria,
  brokerRelationships,
  sourcedDeals,
  dealAttributions,
  brokerActivityLog,
  insertDealSourceSchema,
  updateDealSourceSchema,
  insertInvestmentMandateSchema,
  updateInvestmentMandateSchema,
  insertMandateCriteriaSchema,
  updateMandateCriteriaSchema,
  insertBrokerRelationshipSchema,
  updateBrokerRelationshipSchema,
  insertSourcedDealSchema,
  updateSourcedDealSchema,
  insertDealAttributionSchema,
  updateDealAttributionSchema,
  insertBrokerActivityLogSchema,
  type DealSource,
  type InvestmentMandate,
  type MandateCriteria,
  type BrokerRelationship,
  type SourcedDeal,
  type DealAttribution,
  type BrokerActivityLog,
} from "@shared/schema";
import { requireProspecting } from "../middleware/pack-guard";

const router = Router();

// Helper to extract orgId from session
function getOrgId(req: Request): string | null {
  return (req as any).session?.user?.orgId || null;
}

// Helper to generate dedupe hash for deal
function generateDedupeHash(deal: Partial<SourcedDeal>): string {
  const normalizedAddress = (deal.propertyAddress || "").toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedName = (deal.propertyName || "").toLowerCase().replace(/\s+/g, " ").trim();
  const city = (deal.city || "").toLowerCase().trim();
  const state = (deal.state || "").toLowerCase().trim();
  
  const input = `${normalizedName}|${normalizedAddress}|${city}|${state}`;
  return crypto.createHash("md5").update(input).digest("hex");
}

// ============================================
// DEAL SOURCES (Broker & Marketplace Feeds)
// ============================================

router.get("/deal-sources", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const sources = await db
      .select()
      .from(dealSources)
      .where(eq(dealSources.orgId, orgId))
      .orderBy(desc(dealSources.createdAt));

    res.json(sources);
  } catch (error) {
    console.error("Error fetching deal sources:", error);
    res.status(500).json({ error: "Failed to fetch deal sources" });
  }
});

router.get("/deal-sources/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [source] = await db
      .select()
      .from(dealSources)
      .where(and(eq(dealSources.id, req.params.id), eq(dealSources.orgId, orgId)));

    if (!source) return res.status(404).json({ error: "Deal source not found" });
    res.json(source);
  } catch (error) {
    console.error("Error fetching deal source:", error);
    res.status(500).json({ error: "Failed to fetch deal source" });
  }
});

router.post("/deal-sources", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertDealSourceSchema.parse({ ...req.body, orgId });
    const [source] = await db.insert(dealSources).values(validated).returning();
    res.status(201).json(source);
  } catch (error: any) {
    console.error("Error creating deal source:", error);
    res.status(400).json({ error: error.message || "Failed to create deal source" });
  }
});

router.patch("/deal-sources/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateDealSourceSchema.parse(req.body);
    const [updated] = await db
      .update(dealSources)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(dealSources.id, req.params.id), eq(dealSources.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Deal source not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating deal source:", error);
    res.status(400).json({ error: error.message || "Failed to update deal source" });
  }
});

router.delete("/deal-sources/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(dealSources)
      .where(and(eq(dealSources.id, req.params.id), eq(dealSources.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Deal source not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal source:", error);
    res.status(500).json({ error: "Failed to delete deal source" });
  }
});

// ============================================
// INVESTMENT MANDATES
// ============================================

router.get("/investment-mandates", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const mandates = await db
      .select()
      .from(investmentMandates)
      .where(eq(investmentMandates.orgId, orgId))
      .orderBy(asc(investmentMandates.priority), desc(investmentMandates.createdAt));

    res.json(mandates);
  } catch (error) {
    console.error("Error fetching investment mandates:", error);
    res.status(500).json({ error: "Failed to fetch investment mandates" });
  }
});

router.get("/investment-mandates/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [mandate] = await db
      .select()
      .from(investmentMandates)
      .where(and(eq(investmentMandates.id, req.params.id), eq(investmentMandates.orgId, orgId)));

    if (!mandate) return res.status(404).json({ error: "Investment mandate not found" });
    res.json(mandate);
  } catch (error) {
    console.error("Error fetching investment mandate:", error);
    res.status(500).json({ error: "Failed to fetch investment mandate" });
  }
});

router.post("/investment-mandates", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = (req as any).session?.user?.id;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertInvestmentMandateSchema.parse({ ...req.body, orgId, createdBy: userId });
    const [mandate] = await db.insert(investmentMandates).values(validated).returning();
    res.status(201).json(mandate);
  } catch (error: any) {
    console.error("Error creating investment mandate:", error);
    res.status(400).json({ error: error.message || "Failed to create investment mandate" });
  }
});

router.patch("/investment-mandates/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateInvestmentMandateSchema.parse(req.body);
    const [updated] = await db
      .update(investmentMandates)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(investmentMandates.id, req.params.id), eq(investmentMandates.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Investment mandate not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating investment mandate:", error);
    res.status(400).json({ error: error.message || "Failed to update investment mandate" });
  }
});

router.delete("/investment-mandates/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(investmentMandates)
      .where(and(eq(investmentMandates.id, req.params.id), eq(investmentMandates.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Investment mandate not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting investment mandate:", error);
    res.status(500).json({ error: "Failed to delete investment mandate" });
  }
});

// ============================================
// MANDATE CRITERIA
// ============================================

router.get("/mandate-criteria", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { mandateId } = req.query;
    
    let whereClause = eq(mandateCriteria.orgId, orgId);
    if (mandateId) {
      whereClause = and(whereClause, eq(mandateCriteria.mandateId, mandateId as string))!;
    }

    const criteria = await db
      .select()
      .from(mandateCriteria)
      .where(whereClause)
      .orderBy(asc(mandateCriteria.sortOrder));

    res.json(criteria);
  } catch (error) {
    console.error("Error fetching mandate criteria:", error);
    res.status(500).json({ error: "Failed to fetch mandate criteria" });
  }
});

router.get("/mandate-criteria/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [criterion] = await db
      .select()
      .from(mandateCriteria)
      .where(and(eq(mandateCriteria.id, req.params.id), eq(mandateCriteria.orgId, orgId)));

    if (!criterion) return res.status(404).json({ error: "Mandate criterion not found" });
    res.json(criterion);
  } catch (error) {
    console.error("Error fetching mandate criterion:", error);
    res.status(500).json({ error: "Failed to fetch mandate criterion" });
  }
});

router.post("/mandate-criteria", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertMandateCriteriaSchema.parse({ ...req.body, orgId });
    const [criterion] = await db.insert(mandateCriteria).values(validated).returning();
    res.status(201).json(criterion);
  } catch (error: any) {
    console.error("Error creating mandate criterion:", error);
    res.status(400).json({ error: error.message || "Failed to create mandate criterion" });
  }
});

router.patch("/mandate-criteria/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateMandateCriteriaSchema.parse(req.body);
    const [updated] = await db
      .update(mandateCriteria)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(mandateCriteria.id, req.params.id), eq(mandateCriteria.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Mandate criterion not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating mandate criterion:", error);
    res.status(400).json({ error: error.message || "Failed to update mandate criterion" });
  }
});

router.delete("/mandate-criteria/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(mandateCriteria)
      .where(and(eq(mandateCriteria.id, req.params.id), eq(mandateCriteria.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Mandate criterion not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting mandate criterion:", error);
    res.status(500).json({ error: "Failed to delete mandate criterion" });
  }
});

// Bulk update criteria for a mandate
router.post("/investment-mandates/:id/criteria", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const mandateId = req.params.id;
    const { criteria } = req.body;

    if (!Array.isArray(criteria)) {
      return res.status(400).json({ error: "Criteria must be an array" });
    }

    // Delete existing criteria for this mandate
    await db
      .delete(mandateCriteria)
      .where(and(eq(mandateCriteria.mandateId, mandateId), eq(mandateCriteria.orgId, orgId)));

    // Insert new criteria
    if (criteria.length > 0) {
      const toInsert = criteria.map((c: any, idx: number) => ({
        mandateId,
        orgId,
        criteriaType: c.criteriaType,
        criteriaKey: c.criteriaKey,
        operator: c.operator || "equals",
        criteriaValue: String(c.criteriaValue),
        weight: c.weight || 10,
        isRequired: c.isRequired || false,
        sortOrder: idx,
      }));

      await db.insert(mandateCriteria).values(toInsert);
    }

    const updatedCriteria = await db
      .select()
      .from(mandateCriteria)
      .where(and(eq(mandateCriteria.mandateId, mandateId), eq(mandateCriteria.orgId, orgId)))
      .orderBy(asc(mandateCriteria.sortOrder));

    res.json(updatedCriteria);
  } catch (error: any) {
    console.error("Error updating mandate criteria:", error);
    res.status(400).json({ error: error.message || "Failed to update mandate criteria" });
  }
});

// ============================================
// DEAL SCORING ENGINE
// ============================================

interface CriterionEvaluation {
  criteriaKey: string;
  criteriaType: string;
  operator: string;
  expected: string;
  actual: any;
  weight: number;
  isRequired: boolean;
  passed: boolean;
  score: number;
}

interface MandateScore {
  mandateId: string;
  mandateName: string;
  totalScore: number;
  maxPossibleScore: number;
  percentScore: number;
  passedRequired: boolean;
  evaluations: CriterionEvaluation[];
}

function evaluateCriterion(criterion: MandateCriteria, deal: Partial<SourcedDeal>): CriterionEvaluation {
  const { criteriaKey, criteriaType, operator, criteriaValue, weight, isRequired } = criterion;
  
  // Map criteria key to deal field
  let actualValue: any;
  switch (criteriaKey) {
    case "slips_min":
    case "slips_max":
    case "slips":
      actualValue = deal.slipCount;
      break;
    case "asking_price_min":
    case "asking_price_max":
    case "asking_price":
      actualValue = deal.askingPrice ? parseFloat(deal.askingPrice) : null;
      break;
    case "state":
      actualValue = deal.state?.toLowerCase();
      break;
    case "region":
      actualValue = deal.region?.toLowerCase();
      break;
    case "property_type":
    case "marina_type":
      actualValue = deal.marinaType?.toLowerCase();
      break;
    case "deal_type":
      actualValue = deal.dealType?.toLowerCase();
      break;
    case "has_fuel":
      actualValue = deal.hasFuel;
      break;
    case "has_ship_store":
      actualValue = deal.hasShipStore;
      break;
    case "has_dry_storage":
      actualValue = deal.hasDryStorage;
      break;
    default:
      actualValue = (deal as any)[criteriaKey];
  }

  const expectedValue = criteriaValue.toLowerCase();
  let passed = false;

  // Evaluate based on operator
  switch (operator) {
    case "equals":
      passed = String(actualValue).toLowerCase() === expectedValue;
      break;
    case "not_equals":
      passed = String(actualValue).toLowerCase() !== expectedValue;
      break;
    case "contains":
      passed = String(actualValue).toLowerCase().includes(expectedValue);
      break;
    case "greater_than":
      passed = actualValue !== null && Number(actualValue) > Number(criteriaValue);
      break;
    case "less_than":
      passed = actualValue !== null && Number(actualValue) < Number(criteriaValue);
      break;
    case "greater_equal":
      passed = actualValue !== null && Number(actualValue) >= Number(criteriaValue);
      break;
    case "less_equal":
      passed = actualValue !== null && Number(actualValue) <= Number(criteriaValue);
      break;
    case "in_list":
      const listValues = criteriaValue.split(",").map(v => v.trim().toLowerCase());
      passed = listValues.includes(String(actualValue).toLowerCase());
      break;
    case "is_true":
      passed = actualValue === true;
      break;
    case "is_false":
      passed = actualValue === false;
      break;
    default:
      passed = String(actualValue).toLowerCase() === expectedValue;
  }

  return {
    criteriaKey,
    criteriaType: criteriaType || "general",
    operator: operator || "equals",
    expected: criteriaValue,
    actual: actualValue,
    weight: weight || 10,
    isRequired: isRequired || false,
    passed,
    score: passed ? (weight || 10) : 0,
  };
}

async function scoreDealAgainstMandates(deal: Partial<SourcedDeal>, orgId: string): Promise<MandateScore[]> {
  // Fetch all active mandates for the org
  const mandates = await db
    .select()
    .from(investmentMandates)
    .where(and(eq(investmentMandates.orgId, orgId), eq(investmentMandates.isActive, true)));

  const scores: MandateScore[] = [];

  for (const mandate of mandates) {
    // Fetch criteria for this mandate
    const criteria = await db
      .select()
      .from(mandateCriteria)
      .where(eq(mandateCriteria.mandateId, mandate.id))
      .orderBy(asc(mandateCriteria.sortOrder));

    if (criteria.length === 0) {
      // No criteria defined, give neutral score
      scores.push({
        mandateId: mandate.id,
        mandateName: mandate.name,
        totalScore: 50,
        maxPossibleScore: 100,
        percentScore: 50,
        passedRequired: true,
        evaluations: [],
      });
      continue;
    }

    const evaluations = criteria.map(c => evaluateCriterion(c, deal));
    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const maxPossibleScore = evaluations.reduce((sum, e) => sum + e.weight, 0);
    const passedRequired = evaluations.filter(e => e.isRequired).every(e => e.passed);

    scores.push({
      mandateId: mandate.id,
      mandateName: mandate.name,
      totalScore,
      maxPossibleScore,
      percentScore: maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0,
      passedRequired,
      evaluations,
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.percentScore - a.percentScore);

  return scores;
}

// Score a deal against all mandates
router.post("/score-deal", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { deal } = req.body;
    if (!deal) return res.status(400).json({ error: "Deal data required" });

    const scores = await scoreDealAgainstMandates(deal, orgId);
    
    const bestScore = scores[0];
    const result = {
      scores,
      bestMandateId: bestScore?.mandateId || null,
      bestMandateName: bestScore?.mandateName || null,
      bestMandateScore: bestScore?.percentScore || 0,
      passesAnyRequirements: scores.some(s => s.passedRequired && s.percentScore >= 50),
    };

    res.json(result);
  } catch (error) {
    console.error("Error scoring deal:", error);
    res.status(500).json({ error: "Failed to score deal" });
  }
});

// Score an existing sourced deal and update it
router.post("/sourced-deals/:id/score", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch the deal
    const [deal] = await db
      .select()
      .from(sourcedDeals)
      .where(and(eq(sourcedDeals.id, req.params.id), eq(sourcedDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const scores = await scoreDealAgainstMandates(deal, orgId);
    const bestScore = scores[0];

    // Update deal with scoring results
    const [updated] = await db
      .update(sourcedDeals)
      .set({
        bestMandateId: bestScore?.mandateId || null,
        bestMandateScore: bestScore?.percentScore || null,
        mandateScores: scores.map(s => ({
          mandateId: s.mandateId,
          mandateName: s.mandateName,
          score: s.percentScore,
          passedRequired: s.passedRequired,
        })),
        updatedAt: new Date(),
      })
      .where(eq(sourcedDeals.id, req.params.id))
      .returning();

    res.json({
      deal: updated,
      scores,
      bestMandateId: bestScore?.mandateId || null,
      bestMandateName: bestScore?.mandateName || null,
      bestMandateScore: bestScore?.percentScore || 0,
    });
  } catch (error) {
    console.error("Error scoring sourced deal:", error);
    res.status(500).json({ error: "Failed to score deal" });
  }
});

// Bulk score all deals for the org
router.post("/bulk-score-deals", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const deals = await db
      .select()
      .from(sourcedDeals)
      .where(eq(sourcedDeals.orgId, orgId));

    let scored = 0;
    for (const deal of deals) {
      const scores = await scoreDealAgainstMandates(deal, orgId);
      const bestScore = scores[0];

      await db
        .update(sourcedDeals)
        .set({
          bestMandateId: bestScore?.mandateId || null,
          bestMandateScore: bestScore?.percentScore || null,
          mandateScores: scores.map(s => ({
            mandateId: s.mandateId,
            mandateName: s.mandateName,
            score: s.percentScore,
            passedRequired: s.passedRequired,
          })),
          updatedAt: new Date(),
        })
        .where(eq(sourcedDeals.id, deal.id));
      
      scored++;
    }

    res.json({ success: true, dealsScored: scored });
  } catch (error) {
    console.error("Error bulk scoring deals:", error);
    res.status(500).json({ error: "Failed to bulk score deals" });
  }
});

// ============================================
// BROKER RELATIONSHIPS
// ============================================

router.get("/broker-relationships", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { tier, isActive } = req.query;
    
    let query = db
      .select()
      .from(brokerRelationships)
      .where(eq(brokerRelationships.orgId, orgId));

    const brokers = await query.orderBy(
      desc(brokerRelationships.totalDealValue),
      desc(brokerRelationships.totalDealsConverted)
    );

    // Filter in memory if needed
    let filtered = brokers;
    if (tier) {
      filtered = filtered.filter(b => b.tier === tier);
    }
    if (isActive !== undefined) {
      filtered = filtered.filter(b => b.isActive === (isActive === "true"));
    }

    res.json(filtered);
  } catch (error) {
    console.error("Error fetching broker relationships:", error);
    res.status(500).json({ error: "Failed to fetch broker relationships" });
  }
});

router.get("/broker-relationships/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [broker] = await db
      .select()
      .from(brokerRelationships)
      .where(and(eq(brokerRelationships.id, req.params.id), eq(brokerRelationships.orgId, orgId)));

    if (!broker) return res.status(404).json({ error: "Broker relationship not found" });
    res.json(broker);
  } catch (error) {
    console.error("Error fetching broker relationship:", error);
    res.status(500).json({ error: "Failed to fetch broker relationship" });
  }
});

router.get("/broker-relationships/:id/activity", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const activities = await db
      .select()
      .from(brokerActivityLog)
      .where(and(
        eq(brokerActivityLog.brokerId, req.params.id),
        eq(brokerActivityLog.orgId, orgId)
      ))
      .orderBy(desc(brokerActivityLog.activityDate))
      .limit(50);

    res.json(activities);
  } catch (error) {
    console.error("Error fetching broker activity:", error);
    res.status(500).json({ error: "Failed to fetch broker activity" });
  }
});

router.post("/broker-relationships", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertBrokerRelationshipSchema.parse({ ...req.body, orgId });
    const [broker] = await db.insert(brokerRelationships).values(validated).returning();
    res.status(201).json(broker);
  } catch (error: any) {
    console.error("Error creating broker relationship:", error);
    res.status(400).json({ error: error.message || "Failed to create broker relationship" });
  }
});

router.patch("/broker-relationships/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateBrokerRelationshipSchema.parse(req.body);
    const [updated] = await db
      .update(brokerRelationships)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(brokerRelationships.id, req.params.id), eq(brokerRelationships.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Broker relationship not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating broker relationship:", error);
    res.status(400).json({ error: error.message || "Failed to update broker relationship" });
  }
});

router.delete("/broker-relationships/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(brokerRelationships)
      .where(and(eq(brokerRelationships.id, req.params.id), eq(brokerRelationships.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Broker relationship not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting broker relationship:", error);
    res.status(500).json({ error: "Failed to delete broker relationship" });
  }
});

// Log broker activity
router.post("/broker-relationships/:id/activity", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = (req as any).session?.user?.id;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertBrokerActivityLogSchema.parse({
      ...req.body,
      orgId,
      brokerId: req.params.id,
      performedBy: userId,
    });
    
    const [activity] = await db.insert(brokerActivityLog).values(validated).returning();
    
    // Update last contact date on broker
    await db
      .update(brokerRelationships)
      .set({ lastContactDate: new Date(), updatedAt: new Date() })
      .where(eq(brokerRelationships.id, req.params.id));

    res.status(201).json(activity);
  } catch (error: any) {
    console.error("Error logging broker activity:", error);
    res.status(400).json({ error: error.message || "Failed to log broker activity" });
  }
});

// ============================================
// SOURCED DEALS (Incoming Deal Queue)
// ============================================

router.get("/sourced-deals", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { status, sourceId, brokerId, minScore, state, includeDuplicates } = req.query;

    const deals = await db
      .select()
      .from(sourcedDeals)
      .where(eq(sourcedDeals.orgId, orgId))
      .orderBy(desc(sourcedDeals.bestMandateScore), desc(sourcedDeals.importedAt));

    // Filter in memory
    let filtered = deals;
    
    if (status) {
      filtered = filtered.filter(d => d.status === status);
    }
    if (sourceId) {
      filtered = filtered.filter(d => d.dealSourceId === sourceId);
    }
    if (brokerId) {
      filtered = filtered.filter(d => d.brokerId === brokerId);
    }
    if (minScore) {
      const minScoreNum = parseFloat(minScore as string);
      filtered = filtered.filter(d => d.bestMandateScore && parseFloat(d.bestMandateScore) >= minScoreNum);
    }
    if (state) {
      filtered = filtered.filter(d => d.state?.toLowerCase() === (state as string).toLowerCase());
    }
    if (includeDuplicates !== "true") {
      filtered = filtered.filter(d => !d.isDuplicate);
    }

    res.json(filtered);
  } catch (error) {
    console.error("Error fetching sourced deals:", error);
    res.status(500).json({ error: "Failed to fetch sourced deals" });
  }
});

router.get("/sourced-deals/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deal] = await db
      .select()
      .from(sourcedDeals)
      .where(and(eq(sourcedDeals.id, req.params.id), eq(sourcedDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Sourced deal not found" });
    res.json(deal);
  } catch (error) {
    console.error("Error fetching sourced deal:", error);
    res.status(500).json({ error: "Failed to fetch sourced deal" });
  }
});

router.post("/sourced-deals", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // Generate dedupe hash
    const dedupeHash = generateDedupeHash(req.body);
    
    // Check for duplicates
    const [existingDeal] = await db
      .select()
      .from(sourcedDeals)
      .where(and(eq(sourcedDeals.orgId, orgId), eq(sourcedDeals.dedupeHash, dedupeHash)))
      .limit(1);

    const validated = insertSourcedDealSchema.parse({
      ...req.body,
      orgId,
      dedupeHash,
      isDuplicate: !!existingDeal,
      duplicateOfId: existingDeal?.id,
    });

    const [deal] = await db.insert(sourcedDeals).values(validated).returning();
    
    // Score against mandates
    const scores = await scoreDealAgainstMandates(deal, orgId);
    const bestScore = scores[0];
    
    // Update deal with scores
    const [updatedDeal] = await db
      .update(sourcedDeals)
      .set({
        bestMandateId: bestScore?.mandateId || null,
        bestMandateScore: bestScore?.percentScore?.toString() || null,
        mandateScores: scores.map(s => ({
          mandateId: s.mandateId,
          mandateName: s.mandateName,
          score: s.percentScore,
          passedRequired: s.passedRequired,
        })),
        updatedAt: new Date(),
      })
      .where(eq(sourcedDeals.id, deal.id))
      .returning();

    res.status(201).json(updatedDeal);
  } catch (error: any) {
    console.error("Error creating sourced deal:", error);
    res.status(400).json({ error: error.message || "Failed to create sourced deal" });
  }
});

router.patch("/sourced-deals/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateSourcedDealSchema.parse(req.body);
    const [updated] = await db
      .update(sourcedDeals)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(sourcedDeals.id, req.params.id), eq(sourcedDeals.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Sourced deal not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating sourced deal:", error);
    res.status(400).json({ error: error.message || "Failed to update sourced deal" });
  }
});

// Review a sourced deal
router.post("/sourced-deals/:id/review", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = (req as any).session?.user?.id;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { status, notes, disqualificationReason } = req.body;
    
    const [updated] = await db
      .update(sourcedDeals)
      .set({
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        disqualificationReason,
        updatedAt: new Date(),
      })
      .where(and(eq(sourcedDeals.id, req.params.id), eq(sourcedDeals.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Sourced deal not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error reviewing sourced deal:", error);
    res.status(400).json({ error: error.message || "Failed to review sourced deal" });
  }
});

// Convert sourced deal to CRM deal
router.post("/sourced-deals/:id/convert", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = (req as any).session?.user?.id;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deal] = await db
      .select()
      .from(sourcedDeals)
      .where(and(eq(sourcedDeals.id, req.params.id), eq(sourcedDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Sourced deal not found" });
    if (deal.convertedToDealId) {
      return res.status(400).json({ error: "Deal already converted" });
    }

    // For now, just mark as converted - actual CRM deal creation would happen here
    // This would integrate with your existing CRM deals table
    const [updated] = await db
      .update(sourcedDeals)
      .set({
        status: "converted",
        convertedAt: new Date(),
        convertedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(sourcedDeals.id, req.params.id))
      .returning();

    res.json({ 
      success: true, 
      message: "Deal marked for conversion. Create CRM deal to complete.",
      sourcedDeal: updated 
    });
  } catch (error: any) {
    console.error("Error converting sourced deal:", error);
    res.status(400).json({ error: error.message || "Failed to convert sourced deal" });
  }
});

// Rescore all deals against mandates
router.post("/sourced-deals/rescore", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const deals = await db
      .select()
      .from(sourcedDeals)
      .where(and(
        eq(sourcedDeals.orgId, orgId),
        or(eq(sourcedDeals.status, "new"), eq(sourcedDeals.status, "under_review"))
      ));

    let scored = 0;
    for (const deal of deals) {
      const scores = await scoreDealAgainstMandates(deal, orgId);
      const bestScore = scores[0];
      
      await db
        .update(sourcedDeals)
        .set({
          bestMandateId: bestScore?.mandateId || null,
          bestMandateScore: bestScore?.percentScore?.toString() || null,
          mandateScores: scores.map(s => ({
            mandateId: s.mandateId,
            mandateName: s.mandateName,
            score: s.percentScore,
            passedRequired: s.passedRequired,
          })),
          updatedAt: new Date(),
        })
        .where(eq(sourcedDeals.id, deal.id));
      
      scored++;
    }

    res.json({ success: true, dealsScored: scored });
  } catch (error) {
    console.error("Error rescoring deals:", error);
    res.status(500).json({ error: "Failed to rescore deals" });
  }
});

router.delete("/sourced-deals/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(sourcedDeals)
      .where(and(eq(sourcedDeals.id, req.params.id), eq(sourcedDeals.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Sourced deal not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting sourced deal:", error);
    res.status(500).json({ error: "Failed to delete sourced deal" });
  }
});

// ============================================
// DEAL ATTRIBUTION
// ============================================

router.get("/deal-attributions", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { dealId, brokerId, sourceType } = req.query;

    const attributions = await db
      .select()
      .from(dealAttributions)
      .where(eq(dealAttributions.orgId, orgId))
      .orderBy(desc(dealAttributions.createdAt));

    // Filter in memory
    let filtered = attributions;
    if (dealId) {
      filtered = filtered.filter(a => a.dealId === parseInt(dealId as string));
    }
    if (brokerId) {
      filtered = filtered.filter(a => a.brokerId === brokerId);
    }
    if (sourceType) {
      filtered = filtered.filter(a => a.sourceType === sourceType);
    }

    res.json(filtered);
  } catch (error) {
    console.error("Error fetching deal attributions:", error);
    res.status(500).json({ error: "Failed to fetch deal attributions" });
  }
});

router.post("/deal-attributions", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = insertDealAttributionSchema.parse({ ...req.body, orgId });
    const [attribution] = await db.insert(dealAttributions).values(validated).returning();

    // Update broker stats if applicable
    if (validated.brokerId) {
      await updateBrokerStats(validated.brokerId, orgId);
    }

    res.status(201).json(attribution);
  } catch (error: any) {
    console.error("Error creating deal attribution:", error);
    res.status(400).json({ error: error.message || "Failed to create deal attribution" });
  }
});

router.patch("/deal-attributions/:id", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const validated = updateDealAttributionSchema.parse(req.body);
    const [updated] = await db
      .update(dealAttributions)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(dealAttributions.id, req.params.id), eq(dealAttributions.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Deal attribution not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating deal attribution:", error);
    res.status(400).json({ error: error.message || "Failed to update deal attribution" });
  }
});

// ============================================
// ANALYTICS & DASHBOARD
// ============================================

router.get("/analytics/overview", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // Get deal counts by status
    const allDeals = await db
      .select()
      .from(sourcedDeals)
      .where(eq(sourcedDeals.orgId, orgId));

    const statusCounts = allDeals.reduce((acc, deal) => {
      acc[deal.status] = (acc[deal.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get source performance
    const sources = await db
      .select()
      .from(dealSources)
      .where(eq(dealSources.orgId, orgId));

    // Get top brokers
    const brokers = await db
      .select()
      .from(brokerRelationships)
      .where(and(eq(brokerRelationships.orgId, orgId), eq(brokerRelationships.isActive, true)))
      .orderBy(desc(brokerRelationships.totalDealsConverted))
      .limit(5);

    // Get mandate match distribution
    const mandates = await db
      .select()
      .from(investmentMandates)
      .where(and(eq(investmentMandates.orgId, orgId), eq(investmentMandates.isActive, true)));

    const highScoreDeals = allDeals.filter(d => 
      d.bestMandateScore && parseFloat(d.bestMandateScore) >= 70
    ).length;

    res.json({
      totalDeals: allDeals.length,
      statusBreakdown: statusCounts,
      activeSources: sources.filter(s => s.isActive).length,
      totalSources: sources.length,
      topBrokers: brokers,
      activeMandates: mandates.length,
      highScoreDeals,
      conversionRate: allDeals.length > 0 
        ? ((statusCounts.converted || 0) / allDeals.length * 100).toFixed(1)
        : 0,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.get("/analytics/source-performance", requireProspecting, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const sources = await db
      .select()
      .from(dealSources)
      .where(eq(dealSources.orgId, orgId));

    const deals = await db
      .select()
      .from(sourcedDeals)
      .where(eq(sourcedDeals.orgId, orgId));

    const performance = sources.map(source => {
      const sourceDeals = deals.filter(d => d.dealSourceId === source.id);
      const converted = sourceDeals.filter(d => d.status === "converted").length;
      const qualified = sourceDeals.filter(d => d.status === "qualified").length;
      const avgScore = sourceDeals.length > 0
        ? sourceDeals.reduce((sum, d) => sum + (parseFloat(d.bestMandateScore || "0")), 0) / sourceDeals.length
        : 0;

      return {
        source,
        totalDeals: sourceDeals.length,
        converted,
        qualified,
        conversionRate: sourceDeals.length > 0 ? (converted / sourceDeals.length * 100).toFixed(1) : 0,
        avgMandateScore: avgScore.toFixed(1),
      };
    });

    res.json(performance);
  } catch (error) {
    console.error("Error fetching source performance:", error);
    res.status(500).json({ error: "Failed to fetch source performance" });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function updateBrokerStats(brokerId: string, orgId: string): Promise<void> {
  // Get all attributions for this broker
  const attributions = await db
    .select()
    .from(dealAttributions)
    .where(and(
      eq(dealAttributions.brokerId, brokerId),
      eq(dealAttributions.orgId, orgId)
    ));

  const totalDeals = attributions.length;
  const totalValue = attributions.reduce((sum, a) => 
    sum + (a.commissionAmount ? parseFloat(a.commissionAmount) : 0), 0
  );

  // Count sourced deals from this broker
  const brokerDeals = await db
    .select()
    .from(sourcedDeals)
    .where(and(
      eq(sourcedDeals.brokerId, brokerId),
      eq(sourcedDeals.orgId, orgId)
    ));

  await db
    .update(brokerRelationships)
    .set({
      totalDealsSubmitted: brokerDeals.length,
      totalDealsConverted: totalDeals,
      totalDealValue: totalValue.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(brokerRelationships.id, brokerId));
}

router.use("/intel", intelRouter);

export default router;

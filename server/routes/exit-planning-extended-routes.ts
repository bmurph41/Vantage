// ============================================================
// Exit Planning Extended Routes — CRUD for exit scenario sub-tables
// File: server/routes/exit-planning-extended-routes.ts
//
// Mount in server/routes.ts:
//   import { exitPlanningExtendedRouter } from './routes/exit-planning-extended-routes';
//   app.use('/api/exit-planning', exitPlanningExtendedRouter);
// ============================================================

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { eq, and, desc, asc } from 'drizzle-orm';
import {
  exitScenarioTemplates,
  exitScenarioLoans,
  exitScenarioBasisLedger,
  exitScenarioMultiYearCashflows,
  exitScenarioTaxProfiles,
  exit1031ReplacementProperties,
  exitDstInterests,
  exitWaterfallTiers,
  exitCapitalCalls,
  exitScenarioComparisons,
  insertExitScenarioTemplateSchema,
  updateExitScenarioTemplateSchema,
  insertExitScenarioLoanSchema,
  updateExitScenarioLoanSchema,
  insertExitScenarioBasisLedgerSchema,
  updateExitScenarioBasisLedgerSchema,
  insertExitScenarioMultiYearCashflowSchema,
  insertExitScenarioTaxProfileSchema,
  updateExitScenarioTaxProfileSchema,
  insertExit1031ReplacementPropertySchema,
  insertExitDstInterestSchema,
  insertExitWaterfallTierSchema,
  insertExitCapitalCallSchema,
  insertExitScenarioComparisonSchema,
  updateExitScenarioComparisonSchema,
} from '@shared/schema';

const router = Router();

// ============================================================
// Templates
// ============================================================

// GET /templates - list exit scenario templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await db.select()
      .from(exitScenarioTemplates)
      .where(eq(exitScenarioTemplates.isActive, true))
      .orderBy(asc(exitScenarioTemplates.sortOrder));
    res.json(templates);
  } catch (error: any) {
    console.error('Error listing exit scenario templates:', error);
    res.status(500).json({ error: 'Failed to list templates', message: error.message });
  }
});

// POST /templates - create template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const parsed = insertExitScenarioTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [template] = await db.insert(exitScenarioTemplates)
      .values(parsed.data)
      .returning();
    res.status(201).json(template);
  } catch (error: any) {
    console.error('Error creating exit scenario template:', error);
    res.status(500).json({ error: 'Failed to create template', message: error.message });
  }
});

// GET /templates/:id - get template
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const [template] = await db.select()
      .from(exitScenarioTemplates)
      .where(eq(exitScenarioTemplates.id, req.params.id))
      .limit(1);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error: any) {
    console.error('Error getting exit scenario template:', error);
    res.status(500).json({ error: 'Failed to get template', message: error.message });
  }
});

// PATCH /templates/:id - update template
router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const parsed = updateExitScenarioTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [template] = await db.update(exitScenarioTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(exitScenarioTemplates.id, req.params.id))
      .returning();
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error: any) {
    console.error('Error updating exit scenario template:', error);
    res.status(500).json({ error: 'Failed to update template', message: error.message });
  }
});

// ============================================================
// Scenario Loans
// ============================================================

// GET /scenarios/:id/loans - get loans for scenario
router.get('/scenarios/:id/loans', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const loans = await db.select()
      .from(exitScenarioLoans)
      .where(and(
        eq(exitScenarioLoans.exitScenarioId, req.params.id),
        orgId ? eq(exitScenarioLoans.orgId, orgId) : undefined as any,
      ))
      .orderBy(asc(exitScenarioLoans.priority));
    res.json(loans);
  } catch (error: any) {
    console.error('Error listing scenario loans:', error);
    res.status(500).json({ error: 'Failed to list loans', message: error.message });
  }
});

// POST /scenarios/:id/loans - add loan to scenario
router.post('/scenarios/:id/loans', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitScenarioLoanSchema.safeParse({
      ...req.body,
      exitScenarioId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [loan] = await db.insert(exitScenarioLoans)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(loan);
  } catch (error: any) {
    console.error('Error adding scenario loan:', error);
    res.status(500).json({ error: 'Failed to add loan', message: error.message });
  }
});

// ============================================================
// Basis Ledger
// ============================================================

// GET /scenarios/:id/basis-ledger - get basis entries
router.get('/scenarios/:id/basis-ledger', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const entries = await db.select()
      .from(exitScenarioBasisLedger)
      .where(and(
        eq(exitScenarioBasisLedger.exitScenarioId, req.params.id),
        orgId ? eq(exitScenarioBasisLedger.orgId, orgId) : undefined as any,
      ));
    res.json(entries);
  } catch (error: any) {
    console.error('Error listing basis ledger entries:', error);
    res.status(500).json({ error: 'Failed to list basis ledger', message: error.message });
  }
});

// POST /scenarios/:id/basis-ledger - add basis entry
router.post('/scenarios/:id/basis-ledger', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitScenarioBasisLedgerSchema.safeParse({
      ...req.body,
      exitScenarioId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [entry] = await db.insert(exitScenarioBasisLedger)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(entry);
  } catch (error: any) {
    console.error('Error adding basis ledger entry:', error);
    res.status(500).json({ error: 'Failed to add basis entry', message: error.message });
  }
});

// ============================================================
// Multi-Year Cashflows
// ============================================================

// GET /scenarios/:id/cashflows - get multi-year cashflows
router.get('/scenarios/:id/cashflows', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const cashflows = await db.select()
      .from(exitScenarioMultiYearCashflows)
      .where(and(
        eq(exitScenarioMultiYearCashflows.exitScenarioId, req.params.id),
        orgId ? eq(exitScenarioMultiYearCashflows.orgId, orgId) : undefined as any,
      ))
      .orderBy(asc(exitScenarioMultiYearCashflows.year));
    res.json(cashflows);
  } catch (error: any) {
    console.error('Error listing cashflows:', error);
    res.status(500).json({ error: 'Failed to list cashflows', message: error.message });
  }
});

// POST /scenarios/:id/cashflows - generate/save cashflows
router.post('/scenarios/:id/cashflows', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitScenarioMultiYearCashflowSchema.safeParse({
      ...req.body,
      exitScenarioId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [cashflow] = await db.insert(exitScenarioMultiYearCashflows)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(cashflow);
  } catch (error: any) {
    console.error('Error saving cashflow:', error);
    res.status(500).json({ error: 'Failed to save cashflow', message: error.message });
  }
});

// ============================================================
// Tax Profiles
// ============================================================

// GET /scenarios/:id/tax-profile - get tax profile
router.get('/scenarios/:id/tax-profile', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [profile] = await db.select()
      .from(exitScenarioTaxProfiles)
      .where(and(
        eq(exitScenarioTaxProfiles.exitScenarioId, req.params.id),
        orgId ? eq(exitScenarioTaxProfiles.orgId, orgId) : undefined as any,
      ))
      .limit(1);
    if (!profile) return res.status(404).json({ error: 'Tax profile not found' });
    res.json(profile);
  } catch (error: any) {
    console.error('Error getting tax profile:', error);
    res.status(500).json({ error: 'Failed to get tax profile', message: error.message });
  }
});

// POST /scenarios/:id/tax-profile - save tax profile
router.post('/scenarios/:id/tax-profile', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitScenarioTaxProfileSchema.safeParse({
      ...req.body,
      exitScenarioId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [profile] = await db.insert(exitScenarioTaxProfiles)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(profile);
  } catch (error: any) {
    console.error('Error saving tax profile:', error);
    res.status(500).json({ error: 'Failed to save tax profile', message: error.message });
  }
});

// ============================================================
// 1031 Replacement Properties
// ============================================================

// GET /scenarios/:id/1031-properties - get replacement properties
router.get('/scenarios/:id/1031-properties', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    // Note: 1031 properties reference exchange1031Id, not exitScenarioId directly.
    // The :id here is the exchange1031Id for this endpoint.
    const properties = await db.select()
      .from(exit1031ReplacementProperties)
      .where(and(
        eq(exit1031ReplacementProperties.exchange1031Id, req.params.id),
        orgId ? eq(exit1031ReplacementProperties.orgId, orgId) : undefined as any,
      ))
      .orderBy(asc(exit1031ReplacementProperties.sortOrder));
    res.json(properties);
  } catch (error: any) {
    console.error('Error listing 1031 replacement properties:', error);
    res.status(500).json({ error: 'Failed to list 1031 properties', message: error.message });
  }
});

// POST /scenarios/:id/1031-properties - add replacement property
router.post('/scenarios/:id/1031-properties', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExit1031ReplacementPropertySchema.safeParse({
      ...req.body,
      exchange1031Id: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [property] = await db.insert(exit1031ReplacementProperties)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(property);
  } catch (error: any) {
    console.error('Error adding 1031 replacement property:', error);
    res.status(500).json({ error: 'Failed to add 1031 property', message: error.message });
  }
});

// ============================================================
// DST Interests
// ============================================================

// GET /scenarios/:id/dst-interests - get DST interests
router.get('/scenarios/:id/dst-interests', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const interests = await db.select()
      .from(exitDstInterests)
      .where(and(
        eq(exitDstInterests.exitScenarioId, req.params.id),
        orgId ? eq(exitDstInterests.orgId, orgId) : undefined as any,
      ))
      .orderBy(asc(exitDstInterests.sortOrder));
    res.json(interests);
  } catch (error: any) {
    console.error('Error listing DST interests:', error);
    res.status(500).json({ error: 'Failed to list DST interests', message: error.message });
  }
});

// POST /scenarios/:id/dst-interests - add DST interest
router.post('/scenarios/:id/dst-interests', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitDstInterestSchema.safeParse({
      ...req.body,
      exitScenarioId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [interest] = await db.insert(exitDstInterests)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(interest);
  } catch (error: any) {
    console.error('Error adding DST interest:', error);
    res.status(500).json({ error: 'Failed to add DST interest', message: error.message });
  }
});

// ============================================================
// Waterfall Tiers
// ============================================================

// GET /scenarios/:id/waterfall - get waterfall tiers
router.get('/scenarios/:id/waterfall', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const tiers = await db.select()
      .from(exitWaterfallTiers)
      .where(and(
        eq(exitWaterfallTiers.waterfallStructureId, req.params.id),
        orgId ? eq(exitWaterfallTiers.orgId, orgId) : undefined as any,
      ))
      .orderBy(asc(exitWaterfallTiers.tierNumber));
    res.json(tiers);
  } catch (error: any) {
    console.error('Error listing waterfall tiers:', error);
    res.status(500).json({ error: 'Failed to list waterfall tiers', message: error.message });
  }
});

// POST /scenarios/:id/waterfall - save waterfall tiers
router.post('/scenarios/:id/waterfall', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitWaterfallTierSchema.safeParse({
      ...req.body,
      waterfallStructureId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [tier] = await db.insert(exitWaterfallTiers)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(tier);
  } catch (error: any) {
    console.error('Error saving waterfall tier:', error);
    res.status(500).json({ error: 'Failed to save waterfall tier', message: error.message });
  }
});

// ============================================================
// Capital Calls
// ============================================================

// GET /scenarios/:id/capital-calls - get capital calls
router.get('/scenarios/:id/capital-calls', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const calls = await db.select()
      .from(exitCapitalCalls)
      .where(and(
        eq(exitCapitalCalls.waterfallStructureId, req.params.id),
        orgId ? eq(exitCapitalCalls.orgId, orgId) : undefined as any,
      ))
      .orderBy(asc(exitCapitalCalls.callNumber));
    res.json(calls);
  } catch (error: any) {
    console.error('Error listing capital calls:', error);
    res.status(500).json({ error: 'Failed to list capital calls', message: error.message });
  }
});

// POST /scenarios/:id/capital-calls - add capital call
router.post('/scenarios/:id/capital-calls', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const parsed = insertExitCapitalCallSchema.safeParse({
      ...req.body,
      waterfallStructureId: req.params.id,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [call] = await db.insert(exitCapitalCalls)
      .values({ ...parsed.data, orgId })
      .returning();
    res.status(201).json(call);
  } catch (error: any) {
    console.error('Error adding capital call:', error);
    res.status(500).json({ error: 'Failed to add capital call', message: error.message });
  }
});

// ============================================================
// Scenario Comparisons
// ============================================================

// POST /comparisons - create comparison
router.post('/comparisons', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const parsed = insertExitScenarioComparisonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [comparison] = await db.insert(exitScenarioComparisons)
      .values({ ...parsed.data, orgId, createdBy: userId })
      .returning();
    res.status(201).json(comparison);
  } catch (error: any) {
    console.error('Error creating scenario comparison:', error);
    res.status(500).json({ error: 'Failed to create comparison', message: error.message });
  }
});

// GET /comparisons - list comparisons
router.get('/comparisons', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const comparisons = await db.select()
      .from(exitScenarioComparisons)
      .where(orgId ? eq(exitScenarioComparisons.orgId, orgId) : undefined as any)
      .orderBy(desc(exitScenarioComparisons.createdAt));
    res.json(comparisons);
  } catch (error: any) {
    console.error('Error listing scenario comparisons:', error);
    res.status(500).json({ error: 'Failed to list comparisons', message: error.message });
  }
});

// GET /comparisons/:id - get comparison detail
router.get('/comparisons/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [comparison] = await db.select()
      .from(exitScenarioComparisons)
      .where(and(
        eq(exitScenarioComparisons.id, req.params.id),
        orgId ? eq(exitScenarioComparisons.orgId, orgId) : undefined as any,
      ))
      .limit(1);
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    res.json(comparison);
  } catch (error: any) {
    console.error('Error getting scenario comparison:', error);
    res.status(500).json({ error: 'Failed to get comparison', message: error.message });
  }
});

export default router;
export { router as exitPlanningExtendedRouter };

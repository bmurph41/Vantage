import { Router, Request, Response } from "express";
import { db } from "../db";
import { wizardDrafts } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const DRAFT_EXPIRATION_DAYS = 14;

const WizardTypeSchema = z.enum(["modeling", "valuator", "newProject"]);

const UpsertDraftSchema = z.object({
  currentStepId: z.string().min(1),
  completedStepIds: z.array(z.string()),
  payload: z.record(z.any()),
  version: z.string().optional().default("1"),
});

function isDraftExpired(updatedAt: Date): boolean {
  const expirationMs = DRAFT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - updatedAt.getTime() > expirationMs;
}

// GET /api/wizard-drafts/:wizardType
router.get("/:wizardType", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { wizardType } = req.params;

  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: "AUTH_ERROR", message: "Authentication required" } });
  }

  const typeResult = WizardTypeSchema.safeParse(wizardType);
  if (!typeResult.success) {
    return res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid wizard type" } });
  }

  try {
    const [draft] = await db
      .select()
      .from(wizardDrafts)
      .where(and(eq(wizardDrafts.userId, userId), eq(wizardDrafts.wizardType, typeResult.data), eq(wizardDrafts.status, "draft")))
      .limit(1);

    if (!draft) {
      return res.json({ ok: true, draft: null });
    }

    if (isDraftExpired(draft.updatedAt)) {
      await db.update(wizardDrafts).set({ status: "abandoned", updatedAt: new Date() }).where(eq(wizardDrafts.id, draft.id));
      return res.json({ ok: true, draft: null, expired: true });
    }

    return res.json({
      ok: true,
      draft: {
        id: draft.id,
        wizardType: draft.wizardType,
        currentStepId: draft.currentStepId,
        completedStepIds: draft.completedStepIds || [],
        payload: draft.payload || {},
        version: draft.version,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[WIZARD_DRAFT_GET_ERROR]", error);
    return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Failed to fetch draft" } });
  }
});

// POST /api/wizard-drafts/:wizardType
router.post("/:wizardType", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { wizardType } = req.params;

  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: "AUTH_ERROR", message: "Authentication required" } });
  }

  const typeResult = WizardTypeSchema.safeParse(wizardType);
  if (!typeResult.success) {
    return res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid wizard type" } });
  }

  const bodyResult = UpsertDraftSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body" } });
  }

  const { currentStepId, completedStepIds, payload, version } = bodyResult.data;

  try {
    const [existing] = await db
      .select()
      .from(wizardDrafts)
      .where(and(eq(wizardDrafts.userId, userId), eq(wizardDrafts.wizardType, typeResult.data), eq(wizardDrafts.status, "draft")))
      .limit(1);

    const now = new Date();

    if (existing) {
      await db.update(wizardDrafts).set({ currentStepId, completedStepIds, payload, version, updatedAt: now }).where(eq(wizardDrafts.id, existing.id));
      return res.json({
        ok: true,
        draft: { id: existing.id, wizardType: typeResult.data, currentStepId, completedStepIds, payload, version, createdAt: existing.createdAt.toISOString(), updatedAt: now.toISOString() },
      });
    } else {
      const [newDraft] = await db.insert(wizardDrafts).values({ userId, wizardType: typeResult.data, status: "draft", currentStepId, completedStepIds, payload, version, createdAt: now, updatedAt: now }).returning();
      return res.status(201).json({
        ok: true,
        draft: { id: newDraft.id, wizardType: typeResult.data, currentStepId, completedStepIds, payload, version, createdAt: newDraft.createdAt.toISOString(), updatedAt: newDraft.updatedAt.toISOString() },
      });
    }
  } catch (error: any) {
    console.error("[WIZARD_DRAFT_UPSERT_ERROR]", error);
    return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Failed to save draft" } });
  }
});

// DELETE /api/wizard-drafts/:wizardType
router.delete("/:wizardType", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { wizardType } = req.params;

  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: "AUTH_ERROR", message: "Authentication required" } });
  }

  const typeResult = WizardTypeSchema.safeParse(wizardType);
  if (!typeResult.success) {
    return res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid wizard type" } });
  }

  try {
    const result = await db.delete(wizardDrafts).where(and(eq(wizardDrafts.userId, userId), eq(wizardDrafts.wizardType, typeResult.data), eq(wizardDrafts.status, "draft"))).returning({ id: wizardDrafts.id });
    return res.json({ ok: true, deleted: result.length > 0 });
  } catch (error: any) {
    console.error("[WIZARD_DRAFT_DELETE_ERROR]", error);
    return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Failed to delete draft" } });
  }
});

// POST /api/wizard-drafts/:wizardType/submit
router.post("/:wizardType/submit", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { wizardType } = req.params;

  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: "AUTH_ERROR", message: "Authentication required" } });
  }

  const typeResult = WizardTypeSchema.safeParse(wizardType);
  if (!typeResult.success) {
    return res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid wizard type" } });
  }

  try {
    await db.update(wizardDrafts).set({ status: "submitted", updatedAt: new Date() }).where(and(eq(wizardDrafts.userId, userId), eq(wizardDrafts.wizardType, typeResult.data), eq(wizardDrafts.status, "draft")));
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("[WIZARD_DRAFT_SUBMIT_ERROR]", error);
    return res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Failed to submit draft" } });
  }
});

export default router;
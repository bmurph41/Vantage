import { Router } from "express";
import { db } from "../db";
import { userTourProgress } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth-resolver";

const router = Router();

router.get("/api/tour-progress/:tourId", async (req: AuthenticatedRequest, res) => {
  try {
    // Use validatedUserId/validatedOrgId from auth resolver (supports dev mock auth)
    const userId = (req as any).validatedUserId || req.user?.id;
    const orgId = (req as any).validatedOrgId || req.user?.orgId;
    const { tourId } = req.params;

    if (!userId || !orgId) {
      return res.json({ completed: false });
    }

    const progress = await db.query.userTourProgress.findFirst({
      where: and(
        eq(userTourProgress.userId, userId),
        eq(userTourProgress.tourId, tourId)
      ),
    });

    return res.json({ completed: !!progress });
  } catch (error) {
    console.error("Error fetching tour progress:", error);
    return res.json({ completed: false });
  }
});

router.get("/api/tour-progress", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = (req as any).validatedUserId || req.user?.id;
    const orgId = (req as any).validatedOrgId || req.user?.orgId;

    if (!userId || !orgId) {
      return res.json({ tours: [] });
    }

    const allProgress = await db.query.userTourProgress.findMany({
      where: eq(userTourProgress.userId, userId),
    });

    const tourMap = allProgress.reduce((acc, p) => {
      acc[p.tourId] = true;
      return acc;
    }, {} as Record<string, boolean>);

    return res.json({ tours: tourMap });
  } catch (error) {
    console.error("Error fetching all tour progress:", error);
    return res.json({ tours: {} });
  }
});

const completeTourSchema = z.object({
  tourId: z.string().min(1).max(100),
  status: z.enum(["completed", "skipped", "in_progress"]).optional().default("completed"),
  lastStepIndex: z.number().int().min(0).optional(),
  totalSteps: z.number().int().min(0).optional(),
});

router.post("/api/tour-progress", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = (req as any).validatedUserId || req.user?.id;
    const orgId = (req as any).validatedOrgId || req.user?.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parseResult = completeTourSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid tour data" });
    }

    const { tourId, status, lastStepIndex, totalSteps } = parseResult.data;

    const existing = await db.query.userTourProgress.findFirst({
      where: and(
        eq(userTourProgress.userId, userId),
        eq(userTourProgress.tourId, tourId)
      ),
    });

    if (existing) {
      // Update existing record with new status/step info
      await db.update(userTourProgress)
        .set({
          status: status || existing.status,
          lastStepIndex: lastStepIndex ?? existing.lastStepIndex,
          totalSteps: totalSteps ?? existing.totalSteps,
          completedAt: new Date(),
        })
        .where(and(
          eq(userTourProgress.userId, userId),
          eq(userTourProgress.tourId, tourId)
        ));
      return res.json({ success: true, message: "Tour progress updated" });
    }

    await db.insert(userTourProgress).values({
      userId,
      orgId,
      tourId,
      status: status || "completed",
      lastStepIndex: lastStepIndex ?? 0,
      totalSteps: totalSteps ?? null,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error saving tour progress:", error);
    return res.status(500).json({ error: "Failed to save tour progress" });
  }
});

router.delete("/api/tour-progress/:tourId", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = (req as any).validatedUserId || req.user?.id;
    const orgId = (req as any).validatedOrgId || req.user?.orgId;
    const { tourId } = req.params;

    if (!userId || !orgId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await db.delete(userTourProgress).where(
      and(
        eq(userTourProgress.userId, userId),
        eq(userTourProgress.orgId, orgId),
        eq(userTourProgress.tourId, tourId)
      )
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error resetting tour progress:", error);
    return res.status(500).json({ error: "Failed to reset tour progress" });
  }
});

router.delete("/api/tour-progress", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = (req as any).validatedUserId || req.user?.id;
    const orgId = (req as any).validatedOrgId || req.user?.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await db.delete(userTourProgress).where(
      and(
        eq(userTourProgress.userId, userId),
        eq(userTourProgress.orgId, orgId)
      )
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error resetting all tours:", error);
    return res.status(500).json({ error: "Failed to reset tours" });
  }
});

export default router;

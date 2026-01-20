import { Router } from "express";
import { db } from "../db";
import { userTourProgress } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/api/tour-progress/:tourId", async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
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

router.get("/api/tour-progress", async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

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
});

router.post("/api/tour-progress", async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parseResult = completeTourSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid tour ID" });
    }

    const { tourId } = parseResult.data;

    const existing = await db.query.userTourProgress.findFirst({
      where: and(
        eq(userTourProgress.userId, userId),
        eq(userTourProgress.tourId, tourId)
      ),
    });

    if (existing) {
      return res.json({ success: true, message: "Tour already completed" });
    }

    await db.insert(userTourProgress).values({
      userId,
      orgId,
      tourId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error saving tour progress:", error);
    return res.status(500).json({ error: "Failed to save tour progress" });
  }
});

router.delete("/api/tour-progress/:tourId", async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
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

router.delete("/api/tour-progress", async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

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

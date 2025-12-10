import { Router } from "express";
import { storage } from "../storage";
import { insertOmSchema, insertOmPageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

const router = Router();

router.get("/project/:projectId", async (req, res) => {
  try {
    const oms = await storage.getOmsByProjectId(req.params.projectId);
    res.json(oms);
  } catch (error) {
    console.error("Error fetching OMs:", error);
    res.status(500).json({ error: "Failed to fetch OMs" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const om = await storage.getOmById(req.params.id);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.json(om);
  } catch (error) {
    console.error("Error fetching OM:", error);
    res.status(500).json({ error: "Failed to fetch OM" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertOmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const om = await storage.createOm(parsed.data);
    res.status(201).json(om);
  } catch (error) {
    console.error("Error creating OM:", error);
    res.status(500).json({ error: "Failed to create OM" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = insertOmSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const om = await storage.updateOm(req.params.id, parsed.data);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.json(om);
  } catch (error) {
    console.error("Error updating OM:", error);
    res.status(500).json({ error: "Failed to update OM" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteOm(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting OM:", error);
    res.status(500).json({ error: "Failed to delete OM" });
  }
});

router.post("/:id/clone", async (req, res) => {
  try {
    const cloned = await storage.cloneOm(req.params.id);
    if (!cloned) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.status(201).json(cloned);
  } catch (error) {
    console.error("Error cloning OM:", error);
    res.status(500).json({ error: "Failed to clone OM" });
  }
});

router.get("/:omId/pages", async (req, res) => {
  try {
    const pages = await storage.getPagesByOmId(req.params.omId);
    res.json(pages);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

router.post("/:omId/pages/reorder", async (req, res) => {
  try {
    const schema = z.object({ pageIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    await storage.reorderPages(req.params.omId, parsed.data.pageIds);
    res.status(204).send();
  } catch (error) {
    console.error("Error reordering pages:", error);
    res.status(500).json({ error: "Failed to reorder pages" });
  }
});

export default router;

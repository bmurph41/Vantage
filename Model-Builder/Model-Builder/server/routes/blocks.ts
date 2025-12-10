import { Router } from "express";
import { storage } from "../storage";
import { insertOmBlockSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

const router = Router();

router.get("/page/:pageId", async (req, res) => {
  try {
    const blocks = await storage.getBlocksByPageId(req.params.pageId);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const block = await storage.getBlockById(req.params.id);
    if (!block) {
      return res.status(404).json({ error: "Block not found" });
    }
    res.json(block);
  } catch (error) {
    console.error("Error fetching block:", error);
    res.status(500).json({ error: "Failed to fetch block" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertOmBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const block = await storage.createBlock(parsed.data);
    res.status(201).json(block);
  } catch (error) {
    console.error("Error creating block:", error);
    res.status(500).json({ error: "Failed to create block" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = insertOmBlockSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const block = await storage.updateBlock(req.params.id, parsed.data);
    if (!block) {
      return res.status(404).json({ error: "Block not found" });
    }
    res.json(block);
  } catch (error) {
    console.error("Error updating block:", error);
    res.status(500).json({ error: "Failed to update block" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteBlock(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting block:", error);
    res.status(500).json({ error: "Failed to delete block" });
  }
});

router.post("/page/:pageId/reorder", async (req, res) => {
  try {
    const schema = z.object({ blockIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    await storage.reorderBlocks(req.params.pageId, parsed.data.blockIds);
    res.status(204).send();
  } catch (error) {
    console.error("Error reordering blocks:", error);
    res.status(500).json({ error: "Failed to reorder blocks" });
  }
});

export default router;

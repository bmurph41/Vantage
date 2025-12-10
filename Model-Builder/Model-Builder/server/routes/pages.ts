import { Router } from "express";
import { storage } from "../storage";
import { insertOmPageSchema, insertOmBlockSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

const router = Router();

router.get("/:id", async (req, res) => {
  try {
    const page = await storage.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json(page);
  } catch (error) {
    console.error("Error fetching page:", error);
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertOmPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const page = await storage.createPage(parsed.data);
    res.status(201).json(page);
  } catch (error) {
    console.error("Error creating page:", error);
    res.status(500).json({ error: "Failed to create page" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = insertOmPageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const page = await storage.updatePage(req.params.id, parsed.data);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json(page);
  } catch (error) {
    console.error("Error updating page:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deletePage(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting page:", error);
    res.status(500).json({ error: "Failed to delete page" });
  }
});

router.post("/om/:omId/reorder", async (req, res) => {
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

router.post("/:pageId/save-as-template", async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Template name is required" });
    }

    const page = await storage.getPageById(req.params.pageId);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    const blocks = await storage.getBlocksByPageId(page.id);
    const layout = page.layout as any || {};
    
    const templateData = {
      title: page.title,
      layoutType: layout.layoutType || 'single-column',
      columns: layout.columns,
      heroImageUrl: layout.heroImageUrl,
      heroOverlay: layout.heroOverlay,
      showHeader: layout.showHeader,
      showFooter: layout.showFooter,
      showPageNumber: layout.showPageNumber,
      blocks: blocks.map(b => ({
        type: b.type,
        content: b.content,
        style: b.style,
        order: b.orderIndex,
      })),
    };

    const template = await storage.createTemplate({
      ownerType: "user",
      ownerId: null,
      name,
      scope: "page",
      category: category || "custom",
      templateData,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Error saving page as template:", error);
    res.status(500).json({ error: "Failed to save page as template" });
  }
});

router.get("/:pageId/blocks", async (req, res) => {
  try {
    const blocks = await storage.getBlocksByPageId(req.params.pageId);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.post("/:pageId/blocks/reorder", async (req, res) => {
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

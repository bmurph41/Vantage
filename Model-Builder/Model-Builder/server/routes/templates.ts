import { Router } from "express";
import { storage } from "../storage";
import { insertOmTemplateSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const filters = {
      scope: req.query.scope as string | undefined,
      category: req.query.category as string | undefined,
    };
    const templates = await storage.getTemplates(filters);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertOmTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const template = await storage.createTemplate(parsed.data);
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteTemplate(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/:id/apply", async (req, res) => {
  try {
    const { omId } = req.body;
    if (!omId) {
      return res.status(400).json({ error: "omId is required" });
    }

    const templates = await storage.getTemplates();
    const template = templates.find(t => t.id === req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const templateData = template.templateData as any;
    const existingPages = await storage.getPagesByOmId(omId);
    const newOrder = existingPages.length + 1;

    const newPage = await storage.createPage({
      omId,
      title: templateData.title || template.name,
      orderIndex: newOrder,
      layout: {
        layoutType: templateData.layoutType || 'single-column',
        heroImageUrl: templateData.heroImageUrl,
        heroOverlay: templateData.heroOverlay,
        columns: templateData.columns,
        showHeader: templateData.showHeader,
        showFooter: templateData.showFooter,
        showPageNumber: templateData.showPageNumber,
      },
    });

    if (templateData.blocks && Array.isArray(templateData.blocks)) {
      for (const blockData of templateData.blocks) {
        await storage.createBlock({
          pageId: newPage.id,
          type: blockData.type,
          content: blockData.content || {},
          orderIndex: blockData.order || 1,
          style: blockData.style || {},
        });
      }
    }

    const pageWithBlocks = await storage.getPagesByOmId(omId);
    const createdPage = pageWithBlocks.find(p => p.id === newPage.id);
    
    res.status(201).json(createdPage);
  } catch (error) {
    console.error("Error applying template:", error);
    res.status(500).json({ error: "Failed to apply template" });
  }
});

export default router;

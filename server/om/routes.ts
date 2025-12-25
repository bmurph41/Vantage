import { Router } from "express";
import { omStorage } from "./storage";
import { db } from "../db";
import { 
  insertOmSchema, 
  insertOmPageSchema, 
  insertOmBlockSchema, 
  insertOmTemplateSchema, 
  insertOmDatasetSchema,
  insertOmBrandKitSchema,
  crmDeals,
  modelingProjects
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { eq } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";
import { generateOmContent, improveContent, suggestLayout, type GenerateRequest } from "./ai-service";
import { seedSystemTemplates } from "./seed-templates";
import { scanBrandFromUrl } from "./brand-scan";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
    ];
    const ext = file.originalname.toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  }
});

// ============================================================================
// OM CRUD Routes
// ============================================================================

router.get("/oms/project/:projectId", async (req, res) => {
  try {
    const oms = await omStorage.getOmsByProjectId(req.params.projectId);
    res.json(oms);
  } catch (error) {
    console.error("Error fetching OMs:", error);
    res.status(500).json({ error: "Failed to fetch OMs" });
  }
});

router.get("/oms/organization/:organizationId", async (req, res) => {
  try {
    const oms = await omStorage.getOmsByOrganizationId(req.params.organizationId);
    res.json(oms);
  } catch (error) {
    console.error("Error fetching OMs:", error);
    res.status(500).json({ error: "Failed to fetch OMs" });
  }
});

router.get("/oms/:id", async (req, res) => {
  try {
    const om = await omStorage.getOmById(req.params.id);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.json(om);
  } catch (error) {
    console.error("Error fetching OM:", error);
    res.status(500).json({ error: "Failed to fetch OM" });
  }
});

router.get("/oms/:id/full", async (req, res) => {
  try {
    const om = await omStorage.getOmById(req.params.id);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }
    
    const pages = await omStorage.getPagesByOmId(om.id);
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page) => {
        const blocks = await omStorage.getBlocksByPageId(page.id);
        return { ...page, blocks };
      })
    );
    
    res.json({ ...om, pages: pagesWithBlocks });
  } catch (error) {
    console.error("Error fetching full OM:", error);
    res.status(500).json({ error: "Failed to fetch OM" });
  }
});

router.post("/oms", async (req, res) => {
  try {
    const parsed = insertOmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const om = await omStorage.createOm(parsed.data);
    res.status(201).json(om);
  } catch (error) {
    console.error("Error creating OM:", error);
    res.status(500).json({ error: "Failed to create OM" });
  }
});

router.patch("/oms/:id", async (req, res) => {
  try {
    const parsed = insertOmSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const om = await omStorage.updateOm(req.params.id, parsed.data);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.json(om);
  } catch (error) {
    console.error("Error updating OM:", error);
    res.status(500).json({ error: "Failed to update OM" });
  }
});

router.delete("/oms/:id", async (req, res) => {
  try {
    await omStorage.deleteOm(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting OM:", error);
    res.status(500).json({ error: "Failed to delete OM" });
  }
});

router.post("/oms/:id/clone", async (req, res) => {
  try {
    const cloned = await omStorage.cloneOm(req.params.id);
    if (!cloned) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.status(201).json(cloned);
  } catch (error) {
    console.error("Error cloning OM:", error);
    res.status(500).json({ error: "Failed to clone OM" });
  }
});

// ============================================================================
// Page Routes
// ============================================================================

router.get("/oms/:omId/pages", async (req, res) => {
  try {
    const pages = await omStorage.getPagesByOmId(req.params.omId);
    res.json(pages);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

router.get("/pages/:id", async (req, res) => {
  try {
    const page = await omStorage.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json(page);
  } catch (error) {
    console.error("Error fetching page:", error);
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

router.post("/pages", async (req, res) => {
  try {
    const parsed = insertOmPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const page = await omStorage.createPage(parsed.data);
    res.status(201).json(page);
  } catch (error) {
    console.error("Error creating page:", error);
    res.status(500).json({ error: "Failed to create page" });
  }
});

router.patch("/pages/:id", async (req, res) => {
  try {
    const parsed = insertOmPageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const page = await omStorage.updatePage(req.params.id, parsed.data);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json(page);
  } catch (error) {
    console.error("Error updating page:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
});

router.delete("/pages/:id", async (req, res) => {
  try {
    await omStorage.deletePage(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting page:", error);
    res.status(500).json({ error: "Failed to delete page" });
  }
});

router.post("/oms/:omId/pages/reorder", async (req, res) => {
  try {
    const schema = z.object({ pageIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    await omStorage.reorderPages(req.params.omId, parsed.data.pageIds);
    res.status(204).send();
  } catch (error) {
    console.error("Error reordering pages:", error);
    res.status(500).json({ error: "Failed to reorder pages" });
  }
});

router.post("/pages/:pageId/save-as-template", async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Template name is required" });
    }

    const page = await omStorage.getPageById(req.params.pageId);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    const blocks = await omStorage.getBlocksByPageId(page.id);
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

    const template = await omStorage.createTemplate({
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

// ============================================================================
// Block Routes
// ============================================================================

router.get("/pages/:pageId/blocks", async (req, res) => {
  try {
    const blocks = await omStorage.getBlocksByPageId(req.params.pageId);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.get("/blocks/:id", async (req, res) => {
  try {
    const block = await omStorage.getBlockById(req.params.id);
    if (!block) {
      return res.status(404).json({ error: "Block not found" });
    }
    res.json(block);
  } catch (error) {
    console.error("Error fetching block:", error);
    res.status(500).json({ error: "Failed to fetch block" });
  }
});

router.post("/blocks", async (req, res) => {
  try {
    const parsed = insertOmBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const block = await omStorage.createBlock(parsed.data);
    res.status(201).json(block);
  } catch (error) {
    console.error("Error creating block:", error);
    res.status(500).json({ error: "Failed to create block" });
  }
});

router.patch("/blocks/:id", async (req, res) => {
  try {
    const parsed = insertOmBlockSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const block = await omStorage.updateBlock(req.params.id, parsed.data);
    if (!block) {
      return res.status(404).json({ error: "Block not found" });
    }
    res.json(block);
  } catch (error) {
    console.error("Error updating block:", error);
    res.status(500).json({ error: "Failed to update block" });
  }
});

router.delete("/blocks/:id", async (req, res) => {
  try {
    await omStorage.deleteBlock(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting block:", error);
    res.status(500).json({ error: "Failed to delete block" });
  }
});

router.post("/pages/:pageId/blocks/reorder", async (req, res) => {
  try {
    const schema = z.object({ blockIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    await omStorage.reorderBlocks(req.params.pageId, parsed.data.blockIds);
    res.status(204).send();
  } catch (error) {
    console.error("Error reordering blocks:", error);
    res.status(500).json({ error: "Failed to reorder blocks" });
  }
});

// ============================================================================
// Template Routes
// ============================================================================

router.get("/templates", async (req, res) => {
  try {
    const filters = {
      scope: req.query.scope as string | undefined,
      category: req.query.category as string | undefined,
    };
    const templates = await omStorage.getTemplates(filters);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const parsed = insertOmTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const template = await omStorage.createTemplate(parsed.data);
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    await omStorage.deleteTemplate(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/templates/:id/apply", async (req, res) => {
  try {
    const { omId } = req.body;
    if (!omId) {
      return res.status(400).json({ error: "omId is required" });
    }

    const template = await omStorage.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const templateData = template.templateData as any;
    const existingPages = await omStorage.getPagesByOmId(omId);
    const newOrder = existingPages.length;

    const newPage = await omStorage.createPage({
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
      for (let i = 0; i < templateData.blocks.length; i++) {
        const blockData = templateData.blocks[i];
        await omStorage.createBlock({
          pageId: newPage.id,
          type: blockData.type,
          content: blockData.content || {},
          orderIndex: blockData.order ?? i,
          style: blockData.style || {},
        });
      }
    }

    const blocks = await omStorage.getBlocksByPageId(newPage.id);
    res.status(201).json({ ...newPage, blocks });
  } catch (error) {
    console.error("Error applying template:", error);
    res.status(500).json({ error: "Failed to apply template" });
  }
});

// ============================================================================
// Dataset Routes
// ============================================================================

router.get("/datasets/project/:projectId", async (req, res) => {
  try {
    const datasets = await omStorage.getDatasetsByProjectId(req.params.projectId);
    res.json(datasets);
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ error: "Failed to fetch datasets" });
  }
});

router.get("/datasets/:id", async (req, res) => {
  try {
    const dataset = await omStorage.getDatasetById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    res.json(dataset);
  } catch (error) {
    console.error("Error fetching dataset:", error);
    res.status(500).json({ error: "Failed to fetch dataset" });
  }
});

router.post("/datasets/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { projectId, name, type } = req.body;
    if (!projectId || !name || !type) {
      return res.status(400).json({ error: "Missing required fields: projectId, name, type" });
    }

    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const sheetNames = workbook.SheetNames;
    const parsedData: Record<string, any[]> = {};
    const metadata: Record<string, any> = {
      totalSheets: sheetNames.length,
      sheets: {},
    };

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);
      
      const dataWithHeaders = rows.map((row: any) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index];
          }
        });
        return obj;
      }).filter((row: Record<string, any>) => Object.values(row).some(v => v !== undefined && v !== null && v !== ''));

      parsedData[sheetName] = dataWithHeaders;
      metadata.sheets[sheetName] = {
        headers,
        rowCount: dataWithHeaders.length,
      };
    }

    const dataset = await omStorage.createDataset({
      projectId,
      name,
      type: type as any,
      sourceFileName: req.file.originalname,
      data: parsedData,
      sheetNames,
      metadata,
    });

    res.status(201).json(dataset);
  } catch (error) {
    console.error("Error uploading dataset:", error);
    res.status(500).json({ error: "Failed to upload and parse file" });
  }
});

router.patch("/datasets/:id", async (req, res) => {
  try {
    const parsed = insertOmDatasetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const dataset = await omStorage.updateDataset(req.params.id, parsed.data);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    res.json(dataset);
  } catch (error) {
    console.error("Error updating dataset:", error);
    res.status(500).json({ error: "Failed to update dataset" });
  }
});

router.delete("/datasets/:id", async (req, res) => {
  try {
    await omStorage.deleteDataset(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting dataset:", error);
    res.status(500).json({ error: "Failed to delete dataset" });
  }
});

router.get("/datasets/:id/sheet/:sheetName", async (req, res) => {
  try {
    const dataset = await omStorage.getDatasetById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    
    const data = dataset.data as Record<string, any[]>;
    const sheetData = data[req.params.sheetName];
    
    if (!sheetData) {
      return res.status(404).json({ error: "Sheet not found" });
    }
    
    res.json({
      sheetName: req.params.sheetName,
      data: sheetData,
      metadata: (dataset.metadata as any)?.sheets?.[req.params.sheetName] || {},
    });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    res.status(500).json({ error: "Failed to fetch sheet data" });
  }
});

// ============================================================================
// Data Facade Routes (for data binding)
// ============================================================================

router.get("/data-facade/sources/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { omId } = req.query;
    const datasets = await omStorage.getDatasetsByProjectId(projectId);
    
    const sources: Array<{
      id: string;
      name: string;
      type: string;
      sourceType: string;
      sheetNames?: string[];
      metadata?: any;
    }> = [
      ...datasets.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        sourceType: 'dataset',
        sheetNames: d.sheetNames ?? [],
        metadata: d.metadata,
      })),
      { id: "underwriting", name: "Underwriting Model", type: "internal", sourceType: 'marinamatch' },
      { id: "sales-comps", name: "Sales Comparables", type: "internal", sourceType: 'marinamatch' },
      { id: "rent-roll", name: "Rent Roll", type: "internal", sourceType: 'marinamatch' },
      { id: "market-demographics", name: "Market Demographics", type: "api", sourceType: 'external' },
    ];
    
    if (omId && typeof omId === 'string') {
      const om = await omStorage.getOmById(omId);
      if (om?.dealId) {
        sources.push({ id: `deal-${om.dealId}`, name: "Linked CRM Deal", type: "internal", sourceType: 'crm' });
      }
      if (om?.modelingProjectId) {
        sources.push({ id: `modeling-${om.modelingProjectId}`, name: "Linked Modeling Project", type: "internal", sourceType: 'modeling' });
      }
    }
    
    res.json(sources);
  } catch (error) {
    console.error("Error fetching data sources:", error);
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

router.get("/data-facade/data/:sourceId", async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { sheet, projectId } = req.query;
    
    if (sourceId.startsWith('deal-')) {
      const dealId = sourceId.replace('deal-', '');
      const deal = await db.query.crmDeals.findFirst({
        where: eq(crmDeals.id, dealId),
      });
      if (deal) {
        return res.json({
          id: deal.id,
          name: deal.name,
          propertyName: deal.propertyName,
          propertyType: deal.propertyType,
          address: deal.address,
          city: deal.city,
          state: deal.state,
          asking_price: deal.purchasePrice,
          stage: deal.stage,
          status: deal.status,
          probability: deal.probability,
          noi: deal.noi,
          capRate: deal.capRate,
          slips: deal.slips,
          square_footage: deal.squareFootage,
          notes: deal.notes,
        });
      }
      return res.status(404).json({ error: "Deal not found" });
    }
    
    if (sourceId.startsWith('modeling-')) {
      const modelingProjectId = sourceId.replace('modeling-', '');
      const project = await db.query.modelingProjects.findFirst({
        where: eq(modelingProjects.id, modelingProjectId),
      });
      if (project) {
        return res.json({
          id: project.id,
          name: project.name,
          propertyType: project.propertyType,
          address: project.address,
          city: project.city,
          state: project.state,
          zip: project.zip,
          purchasePrice: project.purchasePrice,
          status: project.status,
          slipCount: project.slipCount,
          totalSquareFeet: project.totalSquareFeet,
          notes: project.notes,
        });
      }
      return res.status(404).json({ error: "Modeling project not found" });
    }
    
    const dataset = await omStorage.getDatasetById(sourceId);
    if (dataset) {
      const data = dataset.data as Record<string, any[]>;
      if (sheet && typeof sheet === 'string') {
        return res.json(data[sheet] || []);
      }
      const firstSheet = dataset.sheetNames?.[0];
      return res.json(firstSheet ? data[firstSheet] : []);
    }
    
    res.status(404).json({ error: "Data source not found" });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// ============================================================================
// AI Routes
// ============================================================================

const generateRequestSchema = z.object({
  type: z.enum(['executive_summary', 'investment_highlights', 'market_commentary', 'financial_analysis', 'property_description', 'marina_overview', 'custom']),
  propertyContext: z.object({
    propertyName: z.string().optional(),
    propertyType: z.string().optional(),
    location: z.string().optional(),
    size: z.string().optional(),
    yearBuilt: z.string().optional(),
    occupancy: z.string().optional(),
    askingPrice: z.string().optional(),
    noi: z.string().optional(),
    capRate: z.string().optional(),
    tenants: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    additionalNotes: z.string().optional(),
  }).optional(),
  marketContext: z.object({
    location: z.string().optional(),
    medianRent: z.number().optional(),
    vacancyRate: z.number().optional(),
    population: z.number().optional(),
    employmentGrowth: z.number().optional(),
    medianIncome: z.number().optional(),
    marketTrends: z.string().optional(),
  }).optional(),
  customPrompt: z.string().optional(),
  existingContent: z.string().optional(),
  tone: z.enum(['professional', 'compelling', 'conservative']).optional(),
});

router.post("/ai/generate", async (req, res) => {
  try {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }

    const content = await generateOmContent(parsed.data as GenerateRequest);
    res.json({ content });
  } catch (error: any) {
    console.error("Error generating AI content:", error);
    if (error.message?.includes("AI integration not configured")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    res.status(500).json({ error: "Failed to generate content. Please try again." });
  }
});

router.post("/ai/improve", async (req, res) => {
  try {
    const schema = z.object({
      content: z.string().min(1),
      instruction: z.string().min(1),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }

    const improved = await improveContent(parsed.data.content, parsed.data.instruction);
    res.json({ content: improved });
  } catch (error: any) {
    console.error("Error improving content:", error);
    if (error.message?.includes("AI integration not configured")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    res.status(500).json({ error: "Failed to improve content. Please try again." });
  }
});

router.post("/ai/suggest-layout", async (req, res) => {
  try {
    const schema = z.object({
      contentDescription: z.string().min(1),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }

    const suggestion = await suggestLayout(parsed.data.contentDescription);
    res.json(suggestion);
  } catch (error: any) {
    console.error("Error suggesting layout:", error);
    if (error.message?.includes("AI integration not configured")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    res.status(500).json({ error: "Failed to suggest layout. Please try again." });
  }
});

// ============================================================================
// VDR Integration Routes
// ============================================================================

router.post("/oms/:id/export-to-vdr", async (req, res) => {
  try {
    const { folderId, projectId } = req.body;
    if (!folderId || !projectId) {
      return res.status(400).json({ error: "folderId and projectId are required" });
    }

    const om = await omStorage.getOmById(req.params.id);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }

    const pages = await omStorage.getPagesByOmId(om.id);
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page) => {
        const blocks = await omStorage.getBlocksByPageId(page.id);
        return { ...page, blocks };
      })
    );

    res.json({
      success: true,
      message: `OM "${om.name}" exported to VDR successfully`,
      omId: om.id,
      folderId,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error exporting OM to VDR:", error);
    res.status(500).json({ error: "Failed to export OM to VDR" });
  }
});

router.get("/oms/by-deal/:dealId", async (req, res) => {
  try {
    const oms = await omStorage.getOmsByDealId(req.params.dealId);
    res.json(oms);
  } catch (error) {
    console.error("Error fetching OMs by deal:", error);
    res.status(500).json({ error: "Failed to fetch OMs" });
  }
});

router.get("/oms/by-modeling-project/:modelingProjectId", async (req, res) => {
  try {
    const oms = await omStorage.getOmsByModelingProjectId(req.params.modelingProjectId);
    res.json(oms);
  } catch (error) {
    console.error("Error fetching OMs by modeling project:", error);
    res.status(500).json({ error: "Failed to fetch OMs" });
  }
});

// ============================================================================
// Brand Kit Routes
// ============================================================================

router.get("/brand-kits", async (req, res) => {
  try {
    const organizationId = req.query.organizationId as string | undefined;
    const kits = await omStorage.getBrandKits(organizationId);
    res.json(kits);
  } catch (error) {
    console.error("Error fetching brand kits:", error);
    res.status(500).json({ error: "Failed to fetch brand kits" });
  }
});

router.get("/brand-kits/:id", async (req, res) => {
  try {
    const kit = await omStorage.getBrandKitById(req.params.id);
    if (!kit) {
      return res.status(404).json({ error: "Brand kit not found" });
    }
    res.json(kit);
  } catch (error) {
    console.error("Error fetching brand kit:", error);
    res.status(500).json({ error: "Failed to fetch brand kit" });
  }
});

router.post("/brand-kits", async (req, res) => {
  try {
    const parsed = insertOmBrandKitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const kit = await omStorage.createBrandKit(parsed.data);
    res.status(201).json(kit);
  } catch (error) {
    console.error("Error creating brand kit:", error);
    res.status(500).json({ error: "Failed to create brand kit" });
  }
});

router.patch("/brand-kits/:id", async (req, res) => {
  try {
    const parsed = insertOmBrandKitSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const kit = await omStorage.updateBrandKit(req.params.id, parsed.data);
    if (!kit) {
      return res.status(404).json({ error: "Brand kit not found" });
    }
    res.json(kit);
  } catch (error) {
    console.error("Error updating brand kit:", error);
    res.status(500).json({ error: "Failed to update brand kit" });
  }
});

router.delete("/brand-kits/:id", async (req, res) => {
  try {
    await omStorage.deleteBrandKit(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting brand kit:", error);
    res.status(500).json({ error: "Failed to delete brand kit" });
  }
});

// ============================================================================
// Document Version Routes
// ============================================================================

router.get("/oms/:omId/versions", async (req, res) => {
  try {
    const versions = await omStorage.getVersionsByOmId(req.params.omId);
    res.json(versions);
  } catch (error) {
    console.error("Error fetching versions:", error);
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

router.get("/versions/:id", async (req, res) => {
  try {
    const version = await omStorage.getVersionById(req.params.id);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json(version);
  } catch (error) {
    console.error("Error fetching version:", error);
    res.status(500).json({ error: "Failed to fetch version" });
  }
});

router.post("/oms/:omId/versions", async (req, res) => {
  try {
    const om = await omStorage.getOmById(req.params.omId);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }

    const pages = await omStorage.getPagesByOmId(om.id);
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page) => {
        const blocks = await omStorage.getBlocksByPageId(page.id);
        return { ...page, blocks };
      })
    );

    const snapshot = {
      om,
      pages: pagesWithBlocks,
      savedAt: new Date().toISOString(),
    };

    const userId = req.body.userId;
    const version = await omStorage.createVersion(req.params.omId, snapshot, userId);
    res.status(201).json(version);
  } catch (error) {
    console.error("Error creating version:", error);
    res.status(500).json({ error: "Failed to create version" });
  }
});

router.post("/oms/:omId/restore/:versionId", async (req, res) => {
  try {
    const version = await omStorage.getVersionById(req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    const snapshot = version.snapshotJson as any;
    if (!snapshot || !snapshot.pages) {
      return res.status(400).json({ error: "Invalid version snapshot" });
    }

    const existingPages = await omStorage.getPagesByOmId(req.params.omId);
    for (const page of existingPages) {
      await omStorage.deletePage(page.id);
    }

    for (const pageData of snapshot.pages) {
      const { id, blocks, ...pageInsert } = pageData;
      const newPage = await omStorage.createPage({
        ...pageInsert,
        omId: req.params.omId,
      });

      if (blocks && Array.isArray(blocks)) {
        for (const blockData of blocks) {
          const { id: blockId, ...blockInsert } = blockData;
          await omStorage.createBlock({
            ...blockInsert,
            pageId: newPage.id,
          });
        }
      }
    }

    res.json({ success: true, message: `Restored to version ${version.versionNumber}` });
  } catch (error) {
    console.error("Error restoring version:", error);
    res.status(500).json({ error: "Failed to restore version" });
  }
});

// ============================================================================
// PDF Export Route
// ============================================================================

router.post("/oms/:id/export-pdf", async (req, res) => {
  try {
    const om = await omStorage.getOmById(req.params.id);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }

    const pages = await omStorage.getPagesByOmId(om.id);
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page) => {
        const blocks = await omStorage.getBlocksByPageId(page.id);
        return { ...page, blocks };
      })
    );

    const { includeToc = true, includeAppendix = false, brandKitId } = req.body;
    let brandKit = null;
    if (brandKitId) {
      brandKit = await omStorage.getBrandKitById(brandKitId);
    }

    const exportData = {
      om,
      pages: pagesWithBlocks,
      options: {
        includeToc,
        includeAppendix,
        brandKit,
      },
      exportedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: "PDF export data prepared",
      exportData,
    });
  } catch (error) {
    console.error("Error preparing PDF export:", error);
    res.status(500).json({ error: "Failed to prepare PDF export" });
  }
});

// ============================================================================
// Data Binding Resolver Route
// ============================================================================

router.post("/resolve-bindings", async (req, res) => {
  try {
    const { bindings, projectId, modelingProjectId, dealId } = req.body;

    if (!bindings || !Array.isArray(bindings)) {
      return res.status(400).json({ error: "bindings array is required" });
    }

    const resolved: Record<string, any> = {};

    for (const binding of bindings) {
      const { key, source, field } = binding;
      
      switch (source) {
        case 'underwriting':
          resolved[key] = getUnderwritingStub(field);
          break;
        case 'salesComps':
          resolved[key] = getSalesCompsStub(field);
          break;
        case 'rentComps':
          resolved[key] = getRentCompsStub(field);
          break;
        case 'demographics':
          resolved[key] = getDemographicsStub(field);
          break;
        case 'dataset':
          resolved[key] = `[Dataset: ${field}]`;
          break;
        default:
          resolved[key] = `[Unknown source: ${source}]`;
      }
    }

    res.json({ resolved });
  } catch (error) {
    console.error("Error resolving bindings:", error);
    res.status(500).json({ error: "Failed to resolve bindings" });
  }
});

function getUnderwritingStub(field: string): any {
  const stubs: Record<string, any> = {
    'purchasePrice': 5500000,
    'noi': 425000,
    'capRate': 0.0773,
    'totalSlips': 150,
    'occupancy': 0.92,
    'grossRevenue': 850000,
    'operatingExpenses': 425000,
    'debtService': 320000,
    'cashOnCash': 0.125,
    'irr': 0.185,
    'projectedExitValue': 7200000,
  };
  return stubs[field] ?? `[Underwriting: ${field}]`;
}

function getSalesCompsStub(field: string): any {
  const stubs: Record<string, any> = {
    'averagePricePerSlip': 42500,
    'medianCapRate': 0.072,
    'recentSalesCount': 8,
    'priceRange': { min: 2500000, max: 12000000 },
  };
  return stubs[field] ?? `[Sales Comps: ${field}]`;
}

function getRentCompsStub(field: string): any {
  const stubs: Record<string, any> = {
    'averageRentPerFoot': 28.50,
    'occupancyRate': 0.89,
    'marketGrowthRate': 0.035,
  };
  return stubs[field] ?? `[Rent Comps: ${field}]`;
}

function getDemographicsStub(field: string): any {
  const stubs: Record<string, any> = {
    'medianIncome': 95000,
    'populationGrowth': 0.025,
    'boatRegistrations': 45000,
    'waterAccessHouseholds': 125000,
  };
  return stubs[field] ?? `[Demographics: ${field}]`;
}

// ============================================================================
// System Templates Seeding
// ============================================================================

router.post("/seed-templates", async (req, res) => {
  try {
    const result = await seedSystemTemplates();
    res.json({
      success: true,
      message: `Templates seeded: ${result.created} created, ${result.skipped} already existed`,
      ...result,
    });
  } catch (error) {
    console.error("Error seeding templates:", error);
    res.status(500).json({ error: "Failed to seed templates" });
  }
});

// ============================================================================
// Phase 2: Autosave, Publish, Share Routes
// ============================================================================

router.post("/oms/:id/autosave", async (req, res) => {
  try {
    const { snapshot, userId } = req.body;
    if (!snapshot) {
      return res.status(400).json({ error: "snapshot is required" });
    }

    const om = await omStorage.saveWorkingSnapshot(req.params.id, snapshot, userId);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error autosaving OM:", error);
    res.status(500).json({ error: "Failed to autosave" });
  }
});

router.post("/oms/:id/publish", async (req, res) => {
  try {
    const { userId, changeSummary } = req.body;
    const version = await omStorage.publishOm(req.params.id, userId, changeSummary);
    res.status(201).json({
      success: true,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error publishing OM:", error);
    if (error.message === 'OM not found') {
      return res.status(404).json({ error: "OM not found" });
    }
    res.status(500).json({ error: "Failed to publish OM" });
  }
});

router.post("/oms/:id/share", async (req, res) => {
  try {
    const om = await omStorage.getOmById(req.params.id);
    if (!om) {
      return res.status(404).json({ error: "OM not found" });
    }

    let token = om.shareToken;
    if (!token) {
      token = await omStorage.generateShareToken(req.params.id);
    }

    res.json({
      shareToken: token,
      shareUrl: `/shared/om/${token}`,
    });
  } catch (error) {
    console.error("Error generating share link:", error);
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

router.get("/shared/:token", async (req, res) => {
  try {
    const om = await omStorage.getOmByShareToken(req.params.token);
    if (!om) {
      return res.status(404).json({ error: "Shared document not found or link expired" });
    }

    if (om.status !== 'published') {
      return res.status(403).json({ error: "Document is not published for sharing" });
    }

    const pages = await omStorage.getPagesByOmId(om.id);
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page) => {
        const blocks = await omStorage.getBlocksByPageId(page.id);
        return { ...page, blocks };
      })
    );

    res.json({
      name: om.name,
      docType: om.docType,
      version: om.version,
      pages: pagesWithBlocks,
      workingSnapshot: om.workingSnapshotJson,
    });
  } catch (error) {
    console.error("Error fetching shared OM:", error);
    res.status(500).json({ error: "Failed to fetch shared document" });
  }
});

// ============================================================================
// Phase 2: Asset Library Routes
// ============================================================================

const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  }
});

router.get("/assets", async (req, res) => {
  try {
    const { organizationId, userId, folder, q } = req.query;
    
    if (q && typeof q === 'string') {
      const assets = await omStorage.searchAssets(
        q,
        organizationId as string | undefined,
        folder as string | undefined
      );
      return res.json(assets);
    }

    if (organizationId && typeof organizationId === 'string') {
      const assets = await omStorage.getAssetsByOrganization(organizationId);
      return res.json(assets);
    }

    if (userId && typeof userId === 'string') {
      const assets = await omStorage.getAssetsByUser(userId);
      return res.json(assets);
    }

    res.status(400).json({ error: "organizationId or userId is required" });
  } catch (error) {
    console.error("Error fetching assets:", error);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.post("/assets/upload", assetUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { userId, organizationId, folder, tags } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const crypto = await import('crypto');
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const existingAsset = await omStorage.getAssetBySha256(sha256, organizationId);
    if (existingAsset) {
      return res.json({
        asset: existingAsset,
        deduplicated: true,
        message: "File already exists, returning existing asset",
      });
    }

    const fileName = req.file.originalname;
    const fileUrl = `/uploads/om-assets/${Date.now()}-${fileName}`;

    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    const uploadDir = path.join(process.cwd(), 'uploads', 'om-assets');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, `${Date.now()}-${fileName}`), req.file.buffer);

    let width: number | undefined;
    let height: number | undefined;
    if (req.file.mimetype.startsWith('image/')) {
    }

    const asset = await omStorage.createAsset({
      userId,
      organizationId,
      fileUrl,
      mimeType: req.file.mimetype,
      fileName,
      sha256,
      folder: folder || null,
      width,
      height,
      byteSize: req.file.size,
      tags: tags ? JSON.parse(tags) : null,
    });

    res.status(201).json({ asset, deduplicated: false });
  } catch (error) {
    console.error("Error uploading asset:", error);
    res.status(500).json({ error: "Failed to upload asset" });
  }
});

router.delete("/assets/:id", async (req, res) => {
  try {
    await omStorage.deleteAsset(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting asset:", error);
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

// ============================================================================
// Phase 2: Bindings Catalog
// ============================================================================

router.post("/brand-kits/scan-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "url is required" });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const scanResult = await scanBrandFromUrl(url);
    res.json(scanResult);
  } catch (error: any) {
    console.error("Error scanning brand:", error);
    res.status(500).json({ error: error.message || "Failed to scan brand from URL" });
  }
});

router.post("/brand-kits/auto-import", async (req, res) => {
  try {
    const { url, userId, organizationId, name } = req.body;
    if (!url || !userId) {
      return res.status(400).json({ error: "url and userId are required" });
    }

    const scanResult = await scanBrandFromUrl(url);

    const brandKit = await omStorage.createBrandKit({
      userId,
      organizationId,
      name: name || scanResult.siteName || 'Imported Brand Kit',
      tokens: {},
      primaryColors: scanResult.primaryColors,
      secondaryColors: scanResult.secondaryColors,
      accentColors: scanResult.accentColors,
      fontFamilies: scanResult.fontFamilies,
      autoImportedFromUrl: url,
      sourceScanData: scanResult.scanData,
    });

    res.status(201).json({
      brandKit,
      scanResult,
    });
  } catch (error: any) {
    console.error("Error auto-importing brand kit:", error);
    res.status(500).json({ error: error.message || "Failed to auto-import brand kit" });
  }
});

router.get("/bindings/catalog", async (req, res) => {
  try {
    const catalog = {
      underwriting: {
        label: "Underwriting Model",
        fields: [
          { key: "purchasePrice", label: "Purchase Price", type: "currency" },
          { key: "noi", label: "Net Operating Income", type: "currency" },
          { key: "capRate", label: "Cap Rate", type: "percent" },
          { key: "totalSlips", label: "Total Slips", type: "number" },
          { key: "occupancy", label: "Occupancy Rate", type: "percent" },
          { key: "grossRevenue", label: "Gross Revenue", type: "currency" },
          { key: "operatingExpenses", label: "Operating Expenses", type: "currency" },
          { key: "debtService", label: "Debt Service", type: "currency" },
          { key: "cashOnCash", label: "Cash-on-Cash Return", type: "percent" },
          { key: "irr", label: "Internal Rate of Return", type: "percent" },
          { key: "projectedExitValue", label: "Projected Exit Value", type: "currency" },
        ],
      },
      salesComps: {
        label: "Sales Comparables",
        fields: [
          { key: "averagePricePerSlip", label: "Avg Price/Slip", type: "currency" },
          { key: "medianCapRate", label: "Median Cap Rate", type: "percent" },
          { key: "recentSalesCount", label: "Recent Sales Count", type: "number" },
          { key: "compsTable", label: "Comps Table", type: "table" },
        ],
      },
      rentComps: {
        label: "Rent Comparables",
        fields: [
          { key: "averageRentPerFoot", label: "Avg Rent/Foot", type: "currency" },
          { key: "occupancyRate", label: "Occupancy Rate", type: "percent" },
          { key: "marketGrowthRate", label: "Market Growth Rate", type: "percent" },
        ],
      },
      demographics: {
        label: "Market Demographics",
        fields: [
          { key: "medianIncome", label: "Median Household Income", type: "currency" },
          { key: "populationGrowth", label: "Population Growth", type: "percent" },
          { key: "boatRegistrations", label: "Boat Registrations", type: "number" },
          { key: "waterAccessHouseholds", label: "Waterfront Households", type: "number" },
        ],
      },
      deal: {
        label: "CRM Deal",
        fields: [
          { key: "name", label: "Deal Name", type: "text" },
          { key: "propertyName", label: "Property Name", type: "text" },
          { key: "address", label: "Address", type: "text" },
          { key: "askingPrice", label: "Asking Price", type: "currency" },
          { key: "stage", label: "Pipeline Stage", type: "text" },
        ],
      },
    };

    res.json(catalog);
  } catch (error) {
    console.error("Error fetching bindings catalog:", error);
    res.status(500).json({ error: "Failed to fetch bindings catalog" });
  }
});

export default router;

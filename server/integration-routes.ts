import { Router } from "express";
import { z } from "zod";
import { integrationStorage } from "./integration-storage";

const router = Router();

// ============================================================================
// DEAL ↔ SALES COMPS INTEGRATION
// ============================================================================

router.get("/deals/:dealId/sales-comps", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const comps = await integrationStorage.getSalesCompsForDeal(dealId, orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching deal sales comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/sales-comps", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      salesCompId: z.string(),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      comparisonType: z.string().optional(),
      notes: z.string().optional(),
      distanceMiles: z.number().optional(),
      priceDifferencePercent: z.number().optional(),
      sizeDifferencePercent: z.number().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkDealToSalesComp({
      orgId,
      dealId,
      ...data,
      createdBy: userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking deal to sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:dealId/sales-comps/:salesCompId", async (req, res) => {
  try {
    const { dealId, salesCompId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    await integrationStorage.unlinkDealFromSalesComp(dealId, salesCompId, orgId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking deal from sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEAL ↔ RATE COMPS INTEGRATION
// ============================================================================

router.get("/deals/:dealId/rate-comps", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const comps = await integrationStorage.getRateCompsForDeal(dealId, orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching deal rate comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/rate-comps", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      rateCompId: z.string(),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      comparisonType: z.string().optional(),
      notes: z.string().optional(),
      rateVariancePercent: z.number().optional(),
      occupancyComparison: z.number().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkDealToRateComp({
      orgId,
      dealId,
      ...data,
      createdBy: userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking deal to rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:dealId/rate-comps/:rateCompId", async (req, res) => {
  try {
    const { dealId, rateCompId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    await integrationStorage.unlinkDealFromRateComp(dealId, rateCompId, orgId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking deal from rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEAL ↔ VDR INTEGRATION
// ============================================================================

router.get("/deals/:dealId/vdr-folders", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const folders = await integrationStorage.getVdrFoldersForDeal(dealId, orgId);
    res.json(folders);
  } catch (error: any) {
    console.error("Error fetching deal VDR folders:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/vdr-folders", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      vdrFolderId: z.string(),
      linkType: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkDealToVdr({
      orgId,
      dealId,
      ...data,
      createdBy: userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking deal to VDR folder:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:dealId/vdr-folders/:vdrFolderId", async (req, res) => {
  try {
    const { dealId, vdrFolderId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    await integrationStorage.unlinkDealFromVdr(dealId, vdrFolderId, orgId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking deal from VDR folder:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEAL → DD PROJECT CONVERSION
// ============================================================================

router.get("/deals/:dealId/conversions", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const conversions = await integrationStorage.getDealDdConversions(dealId, orgId);
    res.json(conversions);
  } catch (error: any) {
    console.error("Error fetching deal conversions:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/convert-to-project", async (req, res) => {
  try {
    const { dealId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      templateId: z.string().optional(),
      createVdrFolder: z.boolean().optional(),
      vdrTemplateId: z.string().optional(),
    });

    const options = schema.parse(req.body);
    
    const result = await integrationStorage.convertDealToProject(dealId, userId, orgId, options);
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Error converting deal to project:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PROPERTY ↔ SALES COMPS INTEGRATION
// ============================================================================

router.get("/properties/:propertyId/sales-comps", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const comps = await integrationStorage.getPropertySalesComps(propertyId, orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching property sales comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/properties/:propertyId/sales-comps", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      salesCompId: z.string(),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkPropertyToSalesComp({
      orgId,
      propertyId,
      ...data,
      createdBy: userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking property to sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/properties/:propertyId/sales-comps/:salesCompId", async (req, res) => {
  try {
    const { propertyId, salesCompId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    await integrationStorage.unlinkPropertyFromSalesComp(propertyId, salesCompId, orgId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking property from sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PROPERTY ↔ RATE COMPS INTEGRATION
// ============================================================================

router.get("/properties/:propertyId/rate-comps", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const comps = await integrationStorage.getPropertyRateComps(propertyId, orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching property rate comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/properties/:propertyId/rate-comps", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      rateCompId: z.string(),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkPropertyToRateComp({
      orgId,
      propertyId,
      ...data,
      createdBy: userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking property to rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/properties/:propertyId/rate-comps/:rateCompId", async (req, res) => {
  try {
    const { propertyId, rateCompId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    await integrationStorage.unlinkPropertyFromRateComp(propertyId, rateCompId, orgId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking property from rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MODELING PROJECT ↔ COMPS INTEGRATION
// ============================================================================

router.get("/modeling-projects/:projectId/comps", async (req, res) => {
  try {
    const { projectId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    const comps = await integrationStorage.getModelingProjectComps(projectId, orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching modeling project comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/modeling-projects/:projectId/comps", async (req, res) => {
  try {
    const { projectId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const userId = req.headers["x-user-id"] as string || "user-1";
    
    const schema = z.object({
      salesCompId: z.string().optional(),
      rateCompId: z.string().optional(),
      compType: z.enum(["sales", "rate"]),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      usedInValuation: z.boolean().optional(),
      weight: z.number().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    if (data.compType === "sales" && !data.salesCompId) {
      return res.status(400).json({ error: "salesCompId required when compType is 'sales'" });
    }
    if (data.compType === "rate" && !data.rateCompId) {
      return res.status(400).json({ error: "rateCompId required when compType is 'rate'" });
    }
    
    const link = await integrationStorage.linkModelingProjectToComp({
      orgId,
      modelingProjectId: projectId,
      ...data,
      createdBy: userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking modeling project to comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/modeling-projects/:projectId/comps/:compLinkId", async (req, res) => {
  try {
    const { compLinkId } = req.params;
    const orgId = req.headers["x-org-id"] as string || "org-1";
    
    await integrationStorage.unlinkModelingProjectFromComp(compLinkId, orgId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking modeling project from comp:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CROSS-MODULE AUDIT LOG
// ============================================================================

router.get("/audit-log", async (req, res) => {
  try {
    const orgId = req.headers["x-org-id"] as string || "org-1";
    const { sourceModule, targetModule, action, limit } = req.query;
    
    const logs = await integrationStorage.getCrossModuleAuditLog(orgId, {
      sourceModule: sourceModule as string,
      targetModule: targetModule as string,
      action: action as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json(logs);
  } catch (error: any) {
    console.error("Error fetching cross-module audit log:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

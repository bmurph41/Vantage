import { Router, Request, Response } from "express";
import { z } from "zod";
import { integrationStorage } from "./integration-storage";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    orgId: string;
    role: string;
  };
}

const requireAuth = (req: AuthenticatedRequest, res: Response): { userId: string; orgId: string } | null => {
  if (!req.user || !req.user.id || !req.user.orgId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return { userId: req.user.id, orgId: req.user.orgId };
};

router.get("/deals/:dealId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    const comps = await integrationStorage.getSalesCompsForDeal(dealId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching deal sales comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    
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
      orgId: auth.orgId,
      dealId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking deal to sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:dealId/sales-comps/:salesCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId, salesCompId } = req.params;
    
    const deleted = await integrationStorage.unlinkDealFromSalesComp(dealId, salesCompId, auth.orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking deal from sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/deals/:dealId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    const comps = await integrationStorage.getRateCompsForDeal(dealId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching deal rate comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    
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
      orgId: auth.orgId,
      dealId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking deal to rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:dealId/rate-comps/:rateCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId, rateCompId } = req.params;
    
    const deleted = await integrationStorage.unlinkDealFromRateComp(dealId, rateCompId, auth.orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking deal from rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/deals/:dealId/vdr-folders", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    const folders = await integrationStorage.getVdrFoldersForDeal(dealId, auth.orgId);
    res.json(folders);
  } catch (error: any) {
    console.error("Error fetching deal VDR folders:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/vdr-folders", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    
    const schema = z.object({
      vdrFolderId: z.string(),
      linkType: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkDealToVdr({
      orgId: auth.orgId,
      dealId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking deal to VDR folder:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:dealId/vdr-folders/:vdrFolderId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId, vdrFolderId } = req.params;
    
    const deleted = await integrationStorage.unlinkDealFromVdr(dealId, vdrFolderId, auth.orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking deal from VDR folder:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/deals/:dealId/conversions", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    const conversions = await integrationStorage.getDealDdConversions(dealId, auth.orgId);
    res.json(conversions);
  } catch (error: any) {
    console.error("Error fetching deal conversions:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals/:dealId/convert-to-project", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    
    const schema = z.object({
      templateId: z.string().optional(),
      createVdrFolder: z.boolean().optional(),
      vdrTemplateId: z.string().optional(),
    });

    const options = schema.parse(req.body);
    
    const result = await integrationStorage.convertDealToProject(dealId, auth.userId, auth.orgId, options);
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Error converting deal to project:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/properties/:propertyId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    const comps = await integrationStorage.getPropertySalesComps(propertyId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching property sales comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/properties/:propertyId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    
    const schema = z.object({
      salesCompId: z.string(),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkPropertyToSalesComp({
      orgId: auth.orgId,
      propertyId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking property to sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/properties/:propertyId/sales-comps/:salesCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId, salesCompId } = req.params;
    
    const deleted = await integrationStorage.unlinkPropertyFromSalesComp(propertyId, salesCompId, auth.orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking property from sales comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/properties/:propertyId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    const comps = await integrationStorage.getPropertyRateComps(propertyId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching property rate comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/properties/:propertyId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    
    const schema = z.object({
      rateCompId: z.string(),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const link = await integrationStorage.linkPropertyToRateComp({
      orgId: auth.orgId,
      propertyId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking property to rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/properties/:propertyId/rate-comps/:rateCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId, rateCompId } = req.params;
    
    const deleted = await integrationStorage.unlinkPropertyFromRateComp(propertyId, rateCompId, auth.orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking property from rate comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/modeling-projects/:projectId/comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { projectId } = req.params;
    const comps = await integrationStorage.getModelingProjectComps(projectId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    console.error("Error fetching modeling project comps:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/modeling-projects/:projectId/comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { projectId } = req.params;
    
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
      orgId: auth.orgId,
      modelingProjectId: projectId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    console.error("Error linking modeling project to comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/modeling-projects/:projectId/comps/:compLinkId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { compLinkId } = req.params;
    
    const deleted = await integrationStorage.unlinkModelingProjectFromComp(compLinkId, auth.orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unlinking modeling project from comp:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit-log", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { sourceModule, targetModule, action, limit } = req.query;
    
    const logs = await integrationStorage.getCrossModuleAuditLog(auth.orgId, {
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

import { Router, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { integrationStorage } from "./integration-storage";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    orgId: string;
    role: string;
  };
}

interface IntegrationError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

class ValidationError extends Error implements IntegrationError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
  details: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.details = details;
  }
}

class NotFoundError extends Error implements IntegrationError {
  code = 'NOT_FOUND';
  statusCode = 404;
  
  constructor(message: string = 'Resource not found') {
    super(message);
  }
}

class ConflictError extends Error implements IntegrationError {
  code = 'CONFLICT';
  statusCode = 409;
  details: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.details = details;
  }
}

const formatZodErrors = (error: ZodError): string => {
  return error.errors.map(e => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  }).join(', ');
};

const handleError = (error: any, res: Response, context: string) => {
  console.error(`[Integration Error] ${context}:`, error);
  
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formatZodErrors(error),
    });
  }
  
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
  }
  
  if (error instanceof ConflictError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }
  
  if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
    return res.status(409).json({
      error: 'A link with these parameters already exists',
      code: 'DUPLICATE_ENTRY',
    });
  }
  
  if (error.code === '23503') {
    return res.status(400).json({
      error: 'Referenced resource does not exist',
      code: 'FOREIGN_KEY_VIOLATION',
    });
  }
  
  if (error.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate entry exists',
      code: 'UNIQUE_VIOLATION',
    });
  }
  
  const safeMessage = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : error.message;
    
  return res.status(500).json({
    error: safeMessage,
    code: 'INTERNAL_ERROR',
  });
};

const requireAuth = (req: AuthenticatedRequest, res: Response): { userId: string; orgId: string } | null => {
  if (!req.user || !req.user.id || !req.user.orgId) {
    res.status(401).json({ 
      error: "Authentication required",
      code: "UNAUTHORIZED" 
    });
    return null;
  }
  return { userId: req.user.id, orgId: req.user.orgId };
};

const sanitizeString = (value: string | undefined | null, maxLength: number = 5000): string | undefined => {
  if (!value) return undefined;
  return value.trim().slice(0, maxLength);
};

const validateUUID = (value: string, fieldName: string): void => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const simpleIdRegex = /^[a-zA-Z0-9_-]+$/;
  
  if (!uuidRegex.test(value) && !simpleIdRegex.test(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
};

router.get("/deals/:dealId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const comps = await integrationStorage.getSalesCompsForDeal(dealId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    handleError(error, res, "fetching deal sales comps");
  }
});

router.post("/deals/:dealId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const schema = z.object({
      salesCompId: z.string().min(1, 'salesCompId is required'),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      comparisonType: z.string().max(100).optional(),
      notes: z.string().max(5000).optional(),
      distanceMiles: z.number().min(0).max(10000).optional(),
      priceDifferencePercent: z.number().min(-1000).max(1000).optional(),
      sizeDifferencePercent: z.number().min(-1000).max(1000).optional(),
    });

    const data = schema.parse(req.body);
    validateUUID(data.salesCompId, 'salesCompId');
    
    const link = await integrationStorage.linkDealToSalesComp({
      orgId: auth.orgId,
      dealId,
      ...data,
      notes: sanitizeString(data.notes),
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    handleError(error, res, "linking deal to sales comp");
  }
});

router.delete("/deals/:dealId/sales-comps/:salesCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId, salesCompId } = req.params;
    validateUUID(dealId, 'dealId');
    validateUUID(salesCompId, 'salesCompId');
    
    const deleted = await integrationStorage.unlinkDealFromSalesComp(dealId, salesCompId, auth.orgId);
    if (!deleted) {
      throw new NotFoundError("Link not found");
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(error, res, "unlinking deal from sales comp");
  }
});

router.post("/deals/:dealId/sales-comps/bulk", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const schema = z.object({
      salesCompIds: z.array(z.string().min(1)).min(1, 'At least one salesCompId required').max(50, 'Maximum 50 items allowed'),
      isPrimary: z.boolean().optional(),
      notes: z.string().max(5000).optional(),
    });

    const data = schema.parse(req.body);
    data.salesCompIds.forEach(id => validateUUID(id, 'salesCompId'));
    
    const result = await integrationStorage.bulkLinkDealToSalesComps(
      dealId,
      data.salesCompIds,
      auth.orgId,
      auth.userId,
      { isPrimary: data.isPrimary, notes: sanitizeString(data.notes) }
    );

    res.status(200).json(result);
  } catch (error: any) {
    handleError(error, res, "bulk linking deal to sales comps");
  }
});

router.get("/deals/:dealId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const comps = await integrationStorage.getRateCompsForDeal(dealId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    handleError(error, res, "fetching deal rate comps");
  }
});

router.post("/deals/:dealId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const schema = z.object({
      rateCompId: z.string().min(1, 'rateCompId is required'),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      comparisonType: z.string().max(100).optional(),
      notes: z.string().max(5000).optional(),
      rateVariancePercent: z.number().min(-100).max(1000).optional(),
      occupancyComparison: z.number().min(0).max(100).optional(),
    });

    const data = schema.parse(req.body);
    validateUUID(data.rateCompId, 'rateCompId');
    
    const link = await integrationStorage.linkDealToRateComp({
      orgId: auth.orgId,
      dealId,
      ...data,
      notes: sanitizeString(data.notes),
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    handleError(error, res, "linking deal to rate comp");
  }
});

router.delete("/deals/:dealId/rate-comps/:rateCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId, rateCompId } = req.params;
    validateUUID(dealId, 'dealId');
    validateUUID(rateCompId, 'rateCompId');
    
    const deleted = await integrationStorage.unlinkDealFromRateComp(dealId, rateCompId, auth.orgId);
    if (!deleted) {
      throw new NotFoundError("Link not found");
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(error, res, "unlinking deal from rate comp");
  }
});

router.post("/deals/:dealId/rate-comps/bulk", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const schema = z.object({
      rateCompIds: z.array(z.string().min(1)).min(1, 'At least one rateCompId required').max(50, 'Maximum 50 items allowed'),
      isPrimary: z.boolean().optional(),
      notes: z.string().max(5000).optional(),
    });

    const data = schema.parse(req.body);
    data.rateCompIds.forEach(id => validateUUID(id, 'rateCompId'));
    
    const result = await integrationStorage.bulkLinkDealToRateComps(
      dealId,
      data.rateCompIds,
      auth.orgId,
      auth.userId,
      { isPrimary: data.isPrimary, notes: sanitizeString(data.notes) }
    );

    res.status(200).json(result);
  } catch (error: any) {
    handleError(error, res, "bulk linking deal to rate comps");
  }
});

router.get("/deals/:dealId/vdr-folders", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const folders = await integrationStorage.getVdrFoldersForDeal(dealId, auth.orgId);
    res.json(folders);
  } catch (error: any) {
    handleError(error, res, "fetching deal VDR folders");
  }
});

router.post("/deals/:dealId/vdr-folders", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const schema = z.object({
      vdrFolderId: z.string().min(1, 'vdrFolderId is required'),
      linkType: z.string().max(50).optional(),
    });

    const data = schema.parse(req.body);
    validateUUID(data.vdrFolderId, 'vdrFolderId');
    
    const link = await integrationStorage.linkDealToVdr({
      orgId: auth.orgId,
      dealId,
      ...data,
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    handleError(error, res, "linking deal to VDR folder");
  }
});

router.delete("/deals/:dealId/vdr-folders/:vdrFolderId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId, vdrFolderId } = req.params;
    validateUUID(dealId, 'dealId');
    validateUUID(vdrFolderId, 'vdrFolderId');
    
    const deleted = await integrationStorage.unlinkDealFromVdr(dealId, vdrFolderId, auth.orgId);
    if (!deleted) {
      throw new NotFoundError("Link not found");
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(error, res, "unlinking deal from VDR folder");
  }
});

router.get("/deals/:dealId/conversions", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const conversions = await integrationStorage.getDealDdConversions(dealId, auth.orgId);
    res.json(conversions);
  } catch (error: any) {
    handleError(error, res, "fetching deal conversions");
  }
});

router.post("/deals/:dealId/convert-to-project", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { dealId } = req.params;
    validateUUID(dealId, 'dealId');
    
    const schema = z.object({
      templateId: z.string().optional(),
      createVdrFolder: z.boolean().optional(),
      vdrTemplateId: z.string().optional(),
    });

    const options = schema.parse(req.body);
    if (options.templateId) validateUUID(options.templateId, 'templateId');
    if (options.vdrTemplateId) validateUUID(options.vdrTemplateId, 'vdrTemplateId');
    
    const result = await integrationStorage.convertDealToProject(dealId, auth.userId, auth.orgId, options);
    res.status(201).json(result);
  } catch (error: any) {
    handleError(error, res, "converting deal to project");
  }
});

router.get("/properties/:propertyId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    validateUUID(propertyId, 'propertyId');
    
    const comps = await integrationStorage.getPropertySalesComps(propertyId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    handleError(error, res, "fetching property sales comps");
  }
});

router.post("/properties/:propertyId/sales-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    validateUUID(propertyId, 'propertyId');
    
    const schema = z.object({
      salesCompId: z.string().min(1, 'salesCompId is required'),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().max(5000).optional(),
    });

    const data = schema.parse(req.body);
    validateUUID(data.salesCompId, 'salesCompId');
    
    const link = await integrationStorage.linkPropertyToSalesComp({
      orgId: auth.orgId,
      propertyId,
      ...data,
      notes: sanitizeString(data.notes),
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    handleError(error, res, "linking property to sales comp");
  }
});

router.delete("/properties/:propertyId/sales-comps/:salesCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId, salesCompId } = req.params;
    validateUUID(propertyId, 'propertyId');
    validateUUID(salesCompId, 'salesCompId');
    
    const deleted = await integrationStorage.unlinkPropertyFromSalesComp(propertyId, salesCompId, auth.orgId);
    if (!deleted) {
      throw new NotFoundError("Link not found");
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(error, res, "unlinking property from sales comp");
  }
});

router.get("/properties/:propertyId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    validateUUID(propertyId, 'propertyId');
    
    const comps = await integrationStorage.getPropertyRateComps(propertyId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    handleError(error, res, "fetching property rate comps");
  }
});

router.post("/properties/:propertyId/rate-comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId } = req.params;
    validateUUID(propertyId, 'propertyId');
    
    const schema = z.object({
      rateCompId: z.string().min(1, 'rateCompId is required'),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().max(5000).optional(),
    });

    const data = schema.parse(req.body);
    validateUUID(data.rateCompId, 'rateCompId');
    
    const link = await integrationStorage.linkPropertyToRateComp({
      orgId: auth.orgId,
      propertyId,
      ...data,
      notes: sanitizeString(data.notes),
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    handleError(error, res, "linking property to rate comp");
  }
});

router.delete("/properties/:propertyId/rate-comps/:rateCompId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { propertyId, rateCompId } = req.params;
    validateUUID(propertyId, 'propertyId');
    validateUUID(rateCompId, 'rateCompId');
    
    const deleted = await integrationStorage.unlinkPropertyFromRateComp(propertyId, rateCompId, auth.orgId);
    if (!deleted) {
      throw new NotFoundError("Link not found");
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(error, res, "unlinking property from rate comp");
  }
});

router.get("/modeling-projects/:projectId/comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { projectId } = req.params;
    validateUUID(projectId, 'projectId');
    
    const comps = await integrationStorage.getModelingProjectComps(projectId, auth.orgId);
    res.json(comps);
  } catch (error: any) {
    handleError(error, res, "fetching modeling project comps");
  }
});

router.post("/modeling-projects/:projectId/comps", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { projectId } = req.params;
    validateUUID(projectId, 'projectId');
    
    const schema = z.object({
      salesCompId: z.string().optional(),
      rateCompId: z.string().optional(),
      compType: z.enum(["sales", "rate"]),
      relevanceScore: z.number().min(0).max(100).optional(),
      isPrimary: z.boolean().optional(),
      usedInValuation: z.boolean().optional(),
      weight: z.number().min(0).max(100).optional(),
      notes: z.string().max(5000).optional(),
    });

    const data = schema.parse(req.body);
    
    if (data.compType === "sales" && !data.salesCompId) {
      throw new ValidationError("salesCompId required when compType is 'sales'");
    }
    if (data.compType === "rate" && !data.rateCompId) {
      throw new ValidationError("rateCompId required when compType is 'rate'");
    }
    
    if (data.salesCompId) validateUUID(data.salesCompId, 'salesCompId');
    if (data.rateCompId) validateUUID(data.rateCompId, 'rateCompId');
    
    const link = await integrationStorage.linkModelingProjectToComp({
      orgId: auth.orgId,
      modelingProjectId: projectId,
      ...data,
      notes: sanitizeString(data.notes),
      createdBy: auth.userId,
    });

    res.status(201).json(link);
  } catch (error: any) {
    handleError(error, res, "linking modeling project to comp");
  }
});

router.delete("/modeling-projects/:projectId/comps/:compLinkId", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { projectId, compLinkId } = req.params;
    validateUUID(projectId, 'projectId');
    validateUUID(compLinkId, 'compLinkId');
    
    const deleted = await integrationStorage.unlinkModelingProjectFromComp(compLinkId, auth.orgId);
    if (!deleted) {
      throw new NotFoundError("Link not found");
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(error, res, "unlinking modeling project from comp");
  }
});

router.get("/audit-log", async (req: AuthenticatedRequest, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    
    const { sourceModule, targetModule, action, limit } = req.query;
    
    const limitValue = limit ? parseInt(limit as string, 10) : undefined;
    if (limitValue !== undefined && (isNaN(limitValue) || limitValue < 1 || limitValue > 1000)) {
      throw new ValidationError("limit must be between 1 and 1000");
    }
    
    const logs = await integrationStorage.getCrossModuleAuditLog(auth.orgId, {
      sourceModule: sanitizeString(sourceModule as string, 100),
      targetModule: sanitizeString(targetModule as string, 100),
      action: sanitizeString(action as string, 100),
      limit: limitValue,
    });
    
    res.json(logs);
  } catch (error: any) {
    handleError(error, res, "fetching cross-module audit log");
  }
});

export default router;

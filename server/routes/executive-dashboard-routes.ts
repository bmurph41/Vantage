import { Router, Request, Response, NextFunction } from "express";
import * as rentRollService from "../services/rent-roll-v2/rentRollService";
import { AuthenticatedRequest } from "../middleware/auth-resolver";

const router = Router();

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) {
    return authReq.validatedOrgId;
  }
  return (req as any).tenantId || (req as any).user?.orgId || (req as any).session?.orgId || 'org-1';
}

router.get("/metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate, projectType, projectIds, seasonMode, storageType } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const metrics = await rentRollService.getExecutiveDashboardMetrics(
      orgId,
      startDate as string,
      endDate as string,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
        seasonMode: seasonMode as string | undefined,
        storageType: storageType as string | undefined,
      }
    );
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/revenue-trend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate, projectType, projectIds } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const trend = await rentRollService.getExecutiveRevenueTrend(
      orgId,
      startDate as string,
      endDate as string,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
      }
    );
    res.json(trend);
  } catch (error) {
    next(error);
  }
});

router.get("/revenue-trend-by-storage-type", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate, projectType, projectIds, storageTypes } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const trend = await rentRollService.getExecutiveRevenueTrendByStorageType(
      orgId,
      startDate as string,
      endDate as string,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
        storageTypes: storageTypes ? (storageTypes as string).split(',') : undefined,
      }
    );
    res.json(trend);
  } catch (error) {
    next(error);
  }
});

router.get("/ancillary-revenue-trend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate, projectType, projectIds } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const trend = await rentRollService.getExecutiveAncillaryRevenueTrend(
      orgId,
      startDate as string,
      endDate as string,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
      }
    );
    res.json(trend);
  } catch (error) {
    next(error);
  }
});

router.get("/transient-revenue-trend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate, projectType, projectIds } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const trend = await rentRollService.getExecutiveTransientRevenueTrend(
      orgId,
      startDate as string,
      endDate as string,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
      }
    );
    res.json(trend);
  } catch (error) {
    next(error);
  }
});

router.get("/contract-term-occupancy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectType, projectIds, storageType } = req.query;
    
    const metrics = await rentRollService.getExecutiveContractTermOccupancy(
      orgId,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
        storageType: storageType as string | undefined,
      }
    );
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/available-storage-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectIds } = req.query;
    
    const types = await rentRollService.getExecutiveAvailableStorageTypes(
      orgId,
      projectIds ? (projectIds as string).split(',') : undefined
    );
    res.json(types);
  } catch (error) {
    next(error);
  }
});

router.get("/avg-boat-size", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectType, projectIds, storageType } = req.query;
    
    const metrics = await rentRollService.getExecutiveAvgBoatSize(
      orgId,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
        storageType: storageType as string | undefined,
      }
    );
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/seasonal-move-events", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { startDate, endDate, projectType, projectIds, storageType } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const events = await rentRollService.getExecutiveSeasonalMoveEvents(
      orgId,
      startDate as string,
      endDate as string,
      {
        projectType: projectType as string | undefined,
        projectIds: projectIds ? (projectIds as string).split(',') : undefined,
        storageType: storageType as string | undefined,
      }
    );
    res.json(events);
  } catch (error) {
    next(error);
  }
});

export default router;

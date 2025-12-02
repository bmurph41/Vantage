import { Request, Response, NextFunction } from "express";
import { packService, PackType } from "../services/pack-service";

declare global {
  namespace Express {
    interface Request {
      activePacks?: PackType[];
    }
  }
}

/**
 * Middleware factory to require specific pack(s) for route access.
 * All specified packs must be active for the user's organization.
 * 
 * Usage:
 *   app.use("/api/funds", authenticateUser, requirePack("fund_management"));
 *   app.get("/api/lp-data", authenticateUser, requirePack("fund_management", "lp_portal"), handler);
 */
export function requirePack(...requiredPacks: PackType[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.orgId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activePacks = await packService.getActivePacks(user.orgId);
      req.activePacks = activePacks;

      for (const requiredPack of requiredPacks) {
        if (!activePacks.includes(requiredPack)) {
          const packInfo = await packService.getPackInfo(requiredPack);
          return res.status(403).json({
            error: "Pack required",
            code: "PACK_REQUIRED",
            packType: requiredPack,
            packName: packInfo.name,
            message: `This feature requires the ${packInfo.name} add-on. Please upgrade your subscription to access this functionality.`,
            upgradeUrl: `/settings/packs?upgrade=${requiredPack}`,
          });
        }
      }

      next();
    } catch (error) {
      console.error("Pack guard error:", error);
      res.status(500).json({ error: "Failed to verify pack access" });
    }
  };
}

/**
 * Require Fund Management pack for PE fund operations.
 * Protects: /api/funds/* routes for fund CRUD, allocations, investors, capital movements
 */
export function requireFundManagement() {
  return requirePack("fund_management");
}

/**
 * Require both Fund Management and LP Portal packs.
 * LP Portal is a UI-layer add-on that provides investor-facing features.
 * Backend routes are shared with Fund Management, so this is primarily for
 * LP Portal-specific API endpoints if any are added.
 */
export function requireLpPortal() {
  return requirePack("fund_management", "lp_portal");
}

/**
 * Require Prospecting pack for premium outreach tools.
 * Protects: /api/prospecting/* routes
 */
export function requireProspecting() {
  return requirePack("prospecting");
}

/**
 * Require Analytics Pro pack for advanced analytics features.
 */
export function requireAnalyticsPro() {
  return requirePack("analytics_pro");
}

/**
 * Pre-load active packs into request for conditional UI logic.
 * Does not block requests - just adds pack info to req.activePacks
 */
export async function loadActivePacks(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (user?.orgId) {
      req.activePacks = await packService.getActivePacks(user.orgId);
    }
    next();
  } catch (error) {
    console.error("Error loading active packs:", error);
    next();
  }
}

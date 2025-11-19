import type { Request, Response, NextFunction } from "express";

// Extended Request type with DockTalk user
export interface DockTalkRequest extends Request {
  dockTalkUser?: {
    id: string;
    marinaUserId: string;
    orgId: string;
    role: string;
    subscriptionTier: string;
  };
}

// Unified auth middleware - bridges MarinaMatch and DockTalk authentication
export async function requireMarinaMatchAuth(req: DockTalkRequest, res: Response, next: NextFunction) {
  try {
    // Check MarinaMatch session
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const marinaUser = req.session.user;
    const { storage } = await import("../storage");

    // Check if organization has DockTalk feature enabled
    const orgFeature = await storage.getOrganizationFeature(marinaUser.orgId);
    if (!orgFeature || !orgFeature.isActive) {
      return res.status(403).json({ 
        error: "DockTalk not enabled",
        message: "DockTalk is not enabled for your organization. Contact your administrator to enable this feature."
      });
    }

    // Find or create linked DockTalk user (shadow record)
    let dockTalkUser = await storage.getDockTalkUserByMarinaUserId(marinaUser.id);
    
    if (!dockTalkUser) {
      // Create shadow DockTalk user linked to MarinaMatch user
      dockTalkUser = await storage.createDockTalkUserFromMarinaUser({
        marinaUserId: marinaUser.id,
        orgId: marinaUser.orgId,
        email: marinaUser.email || null,
        role: "viewer", // Default role, can be customized
        subscriptionTier: orgFeature.tier === "docktalk_pro" ? "pro" : "free",
        isActive: true,
      });
    }

    // Add DockTalk user to request for downstream handlers
    req.dockTalkUser = {
      id: dockTalkUser.id,
      marinaUserId: marinaUser.id,
      orgId: marinaUser.orgId,
      role: dockTalkUser.role,
      subscriptionTier: dockTalkUser.subscriptionTier,
    };

    next();
  } catch (error) {
    console.error("MarinaMatch auth bridge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Legacy DockTalk-only auth (for standalone DockTalk users if needed)
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { storage } = await import("../storage");
    const user = await storage.getUser(req.session.user.id);
    
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isActive) {
      req.session.destroy(() => {});
      return res.status(403).json({ error: "Account is inactive" });
    }

    req.session.user = { ...req.session.user, role: user.role };
    next();
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { storage } = await import("../storage");
      const user = await storage.getUser(req.session.user.id);
      
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      if (!user.isActive) {
        req.session.destroy(() => {});
        return res.status(403).json({ error: "Account is inactive" });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          error: "Insufficient permissions",
          required: allowedRoles,
          current: user.role
        });
      }

      req.session.user = { ...req.session.user, role: user.role };
      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin")(req, res, next);
}

export function requireAnalystOrHigher(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin", "analyst", "partner")(req, res, next);
}

export async function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { storage } = await import("../storage");
    const user = await storage.getUser(req.session.user.id);
    
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isActive) {
      req.session.destroy(() => {});
      return res.status(403).json({ error: "Account is inactive" });
    }

    // Admins always get Pro access for building/testing features
    if (user.subscriptionTier !== "pro" && user.role !== "admin") {
      return res.status(403).json({ 
        error: "Pro subscription required",
        message: "This feature requires a Pro subscription. Upgrade to access AI-powered category summaries and advanced analytics.",
        currentTier: user.subscriptionTier,
        requiredTier: "pro"
      });
    }

    req.session.user = { ...req.session.user, role: user.role, subscriptionTier: user.subscriptionTier };
    next();
  } catch (error) {
    console.error("Pro subscription check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

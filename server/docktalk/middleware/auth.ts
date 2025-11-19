import type { Request, Response, NextFunction } from "express";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

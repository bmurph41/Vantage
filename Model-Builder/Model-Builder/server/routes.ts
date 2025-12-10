import type { Express } from "express";
import { type Server } from "http";
import omRouter from "./routes/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Mount all OM Builder routes under /api/om namespace for clean integration
  app.use("/api/om", omRouter);
  
  // Legacy route aliases for backward compatibility during migration
  // These can be removed once the frontend is updated to use /api/om/* paths
  app.use("/api/oms", (req, res, next) => {
    req.url = req.url;
    req.baseUrl = "/api/om/oms";
    res.redirect(307, `/api/om/oms${req.url}`);
  });
  
  app.use("/api/pages", (req, res, next) => {
    res.redirect(307, `/api/om/pages${req.url}`);
  });
  
  app.use("/api/blocks", (req, res, next) => {
    res.redirect(307, `/api/om/blocks${req.url}`);
  });
  
  app.use("/api/templates", (req, res, next) => {
    res.redirect(307, `/api/om/templates${req.url}`);
  });
  
  app.use("/api/datasets", (req, res, next) => {
    res.redirect(307, `/api/om/datasets${req.url}`);
  });
  
  app.use("/api/data-facade", (req, res, next) => {
    res.redirect(307, `/api/om/data-facade${req.url}`);
  });
  
  app.use("/api/ai", (req, res, next) => {
    res.redirect(307, `/api/om/ai${req.url}`);
  });

  return httpServer;
}

import { Router } from "express";
import { migrateDocIntelFilesToObjectStorage } from "../../scripts/migrateDocIntelToObjectStorage";
import { isObjectStorageAvailable } from "../../utils/doc-intel-storage";

const router = Router();

const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user || (user.role !== "owner" && !user.isAdmin)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.post("/migrate-to-object-storage", requireAdmin, async (req: any, res) => {

  if (!isObjectStorageAvailable()) {
    return res.status(503).json({
      error: "Object storage is not configured on this deployment. Cannot perform migration.",
    });
  }

  try {
    const result = await migrateDocIntelFilesToObjectStorage();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Migration failed" });
  }
});

export default router;

import { Router } from "express";
import curatedDataRouter from "./curated-data-routes";
import customerRouter from "./customer-routes";
import organizationRouter from "./organization-routes";
import docIntelMigrationRouter from "./doc-intel-migration-routes";

export const adminRouter = Router();

// Mount curated data management routes
adminRouter.use("/curated", curatedDataRouter);

// Mount admin customers dashboard routes
adminRouter.use("/customers", customerRouter);

// Mount admin organizations dashboard routes
adminRouter.use("/organizations", organizationRouter);

// Mount doc-intel migration routes
adminRouter.use("/doc-intel", docIntelMigrationRouter);

export default adminRouter;

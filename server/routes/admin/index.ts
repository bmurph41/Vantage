import { Router } from "express";
import curatedDataRouter from "./curated-data-routes";
import customerRouter from "./customer-routes";

export const adminRouter = Router();

// Mount curated data management routes
adminRouter.use("/curated", curatedDataRouter);

// Mount admin customers dashboard routes
adminRouter.use("/customers", customerRouter);

export default adminRouter;

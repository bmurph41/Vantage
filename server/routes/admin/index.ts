import { Router } from "express";
import curatedDataRouter from "./curated-data-routes";

export const adminRouter = Router();

// Mount curated data management routes
adminRouter.use("/curated", curatedDataRouter);

export default adminRouter;

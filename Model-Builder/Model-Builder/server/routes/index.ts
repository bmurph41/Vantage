import { Router } from "express";
import omsRouter from "./oms";
import pagesRouter from "./pages";
import blocksRouter from "./blocks";
import templatesRouter from "./templates";
import datasetsRouter from "./datasets";
import dataFacadeRouter from "./data-facade";
import aiRouter from "./ai";
import { omAuth } from "../middleware/auth";

const router = Router();

router.use(omAuth);

router.use("/oms", omsRouter);
router.use("/pages", pagesRouter);
router.use("/blocks", blocksRouter);
router.use("/templates", templatesRouter);
router.use("/datasets", datasetsRouter);
router.use("/data-facade", dataFacadeRouter);
router.use("/ai", aiRouter);

export default router;

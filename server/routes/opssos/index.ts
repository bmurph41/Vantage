import { Router } from "express";
import { inboxRouter } from "./inbox-routes";
import { automationRouter } from "./automation-routes";
import { taskRouter } from "./task-routes";
import { statementRouter } from "./statement-routes";
import { integrationRouter } from "./integration-routes";
import { webhookRouter } from "./webhook-routes";

export const opssosRouter = Router();

// Mount all OpsOS subrouters
opssosRouter.use("/inbox", inboxRouter);
opssosRouter.use("/automations", automationRouter);
opssosRouter.use("/tasks", taskRouter);
opssosRouter.use("/statements", statementRouter);
opssosRouter.use("/integrations", integrationRouter);
opssosRouter.use("/webhooks", webhookRouter);

export default opssosRouter;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import processingRouter from "./processing";
import dashboardRouter from "./dashboard";
import billingRouter from "./billing";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(filesRouter);
router.use(processingRouter);
router.use(dashboardRouter);
router.use(billingRouter);

export default router;

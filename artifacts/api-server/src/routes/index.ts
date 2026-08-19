import { Router, type IRouter } from "express";
import healthRouter from "./health";
import elBaffaRouter from "./el-baffa";

const router: IRouter = Router();

router.use(healthRouter);
router.use(elBaffaRouter);

export default router;

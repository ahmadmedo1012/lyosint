import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import statsRouter from "./stats";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(healthRouter);
router.use(searchRouter);
router.use(statsRouter);

export default router;

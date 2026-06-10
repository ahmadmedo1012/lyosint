import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import statsRouter from "./stats";
import authRouter from "./auth";
import adminRouter from "./admin";
import entitiesRouter from "./entities";

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(healthRouter);
router.use(searchRouter);
router.use(statsRouter);
router.use(entitiesRouter);

export default router;

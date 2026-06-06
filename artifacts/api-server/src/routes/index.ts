import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(searchRouter);
router.use(statsRouter);

export default router;

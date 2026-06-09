import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const healthHandler = (_req: unknown, res: import("express").Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;

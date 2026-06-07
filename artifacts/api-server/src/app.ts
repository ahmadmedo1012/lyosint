import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const corsOrigin = process.env["CORS_ORIGIN"]?.trim();
app.use(
  cors({
    origin: corsOrigin && corsOrigin !== "*" ? corsOrigin.split(",").map((o) => o.trim()) : corsOrigin === "*" ? true : true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.get("/", (_req, res) => {
  res.json({ name: "LYOSINT API", version: "0.1.0", docs: "/api/health" });
});

export default app;

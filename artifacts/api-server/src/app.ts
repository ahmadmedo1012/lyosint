import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
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
    origin:
      corsOrigin && corsOrigin !== "*"
        ? corsOrigin.split(",").map((o) => o.trim())
        : true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const spaDir = path.resolve(import.meta.dirname, "../../lyosint/dist/public");
app.use(
  express.static(spaDir, {
    index: "index.html",
    maxAge: "1h",
    fallthrough: true,
  }),
);

app.get(/^\/(?!api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(spaDir, "index.html"), (err) => {
    if (err) next();
  });
});

export default app;

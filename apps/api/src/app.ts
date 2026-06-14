import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env, isProd } from "./config";
import { api } from "./routes";
import { errorHandler, notFound } from "./errors";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: isProd ? 120 : 1000,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use("/api/v1", api);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// src/server/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { feedRoutes } from "./routes/feed.js";
import { syncRoutes } from "./routes/sync.js";
import { sourcesRoutes } from "./routes/sources.js";
import type { Connector, SourceType } from "../connectors/types.js";

export function buildApp(
  connectors?: Map<SourceType, Connector>
): ReturnType<typeof Fastify> {
  const app = Fastify({ logger: false });
  app.register(cors);
  app.register(feedRoutes);

  const connectorsMap = connectors ?? new Map();
  syncRoutes(app, connectorsMap);
  sourcesRoutes(app, connectorsMap);

  return app;
}

// src/server/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import path from "node:path";
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

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.register(fastifyStatic, {
    root: path.join(__dirname, "../../web/dist"),
    prefix: "/",
    wildcard: false,
  });

  // SPA fallback: serve index.html for non-API routes
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  return app;
}

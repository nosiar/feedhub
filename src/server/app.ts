// src/server/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { feedRoutes } from "./routes/feed.js";
import { syncRoutes } from "./routes/sync.js";
import { sourcesRoutes } from "./routes/sources.js";
import { settingsRoutes } from "./routes/settings.js";
import { kakaoRoutes } from "./routes/kakao.js";
import { dismissRoutes } from "./routes/dismiss.js";
import { ogRoutes } from "./routes/og.js";
import type { Connector, SourceType } from "../connectors/types.js";
import type { Settings } from "../db/settings-repo.js";

export function buildApp(
  connectors: Map<SourceType, Connector>,
  onSettingsChanged: (settings: Settings) => void
): ReturnType<typeof Fastify> {
  const app = Fastify({ logger: false });
  app.register(cors);
  app.register(feedRoutes);

  syncRoutes(app, connectors);
  sourcesRoutes(app, connectors);
  settingsRoutes(app, onSettingsChanged);
  kakaoRoutes(app);
  dismissRoutes(app, connectors);
  ogRoutes(app);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.register(fastifyStatic, {
    root: path.join(__dirname, "../../web/dist"),
    prefix: "/",
    wildcard: false,
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  return app;
}

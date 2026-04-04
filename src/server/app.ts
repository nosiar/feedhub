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
import type { Connector, SourceType } from "../connectors/types.js";
import type { Settings } from "../db/settings-repo.js";
import { GmailConnector } from "../connectors/gmail.js";
import { getDb } from "../db/client.js";

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

  app.delete<{ Params: { id: string } }>("/api/gmail/:id", async (req, reply) => {
    const gmail = connectors.get("gmail");
    if (!gmail || !(gmail instanceof GmailConnector)) {
      return reply.status(400).send({ error: "Gmail not connected" });
    }
    await gmail.trash(req.params.id);
    const db = await getDb();
    await db.collection("feed_items").deleteOne({ source: "gmail", id: req.params.id });
    return { ok: true };
  });

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

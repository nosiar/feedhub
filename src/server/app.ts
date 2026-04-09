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
import { telegramRoutes } from "./routes/telegram.js";
import type { Connector, SourceType } from "../connectors/types.js";
import type { Settings } from "../db/settings-repo.js";
import { GmailConnector } from "../connectors/gmail.js";
import { NaverMailConnector } from "../connectors/naver-mail.js";

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
  telegramRoutes(app);

  app.get<{ Params: { id: string } }>("/api/gmail/:id/body", async (req, reply) => {
    const gmail = connectors.get("gmail");
    if (!gmail || !(gmail instanceof GmailConnector)) {
      return reply.status(400).send({ error: "Gmail not connected" });
    }
    const body = await gmail.getBody(req.params.id);
    return { body };
  });

  app.get<{ Querystring: { folder: string; uid: string } }>("/api/naver/body", async (req, reply) => {
    const naver = connectors.get("naver");
    if (!naver || !(naver instanceof NaverMailConnector)) {
      return reply.status(400).send({ error: "Naver Mail not connected" });
    }
    const { folder, uid } = req.query;
    const body = await naver.getBody(folder, parseInt(uid, 10));
    return { body };
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

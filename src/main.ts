// src/main.ts
import { config } from "./config.js";
import { getDb, closeDb } from "./db/client.js";
import { ensureIndexes } from "./db/indexes.js";
import { buildApp } from "./server/app.js";
import { startScheduler } from "./scheduler.js";
import { RssConnector } from "./connectors/rss.js";
import { GmailConnector } from "./connectors/gmail.js";
import { SlackConnector } from "./connectors/slack.js";
import { KakaotalkConnector } from "./connectors/kakaotalk.js";
import type { Connector, SourceType } from "./connectors/types.js";

async function main() {
  const db = await getDb();
  await ensureIndexes(db);

  const connectors = new Map<SourceType, Connector>();

  if (config.rss.feeds.length > 0) {
    connectors.set("rss", new RssConnector(config.rss.feeds));
  }
  if (config.gmail.refreshToken) {
    connectors.set("gmail", new GmailConnector(config.gmail));
  }
  if (config.slack.botToken) {
    connectors.set("slack", new SlackConnector(config.slack.botToken));
  }
  if (config.kakaocli.enabled && config.kakaocli.chats.length > 0) {
    connectors.set("kakaotalk", new KakaotalkConnector(config.kakaocli.path, config.kakaocli.chats));
  }

  console.log(`[feedhub] Active connectors: ${[...connectors.keys()].join(", ")}`);

  const app = buildApp(connectors);
  startScheduler(connectors, config.syncInterval);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`[feedhub] Server running at http://localhost:${config.port}`);

  const shutdown = async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[feedhub] Fatal error:", err);
  process.exit(1);
});

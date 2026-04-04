// src/main.ts
import { config } from "./config.js";
import { getDb, closeDb } from "./db/client.js";
import { ensureIndexes } from "./db/indexes.js";
import { buildApp } from "./server/app.js";
import { startScheduler } from "./scheduler.js";
import { getSettings, seedSettings } from "./db/settings-repo.js";
import { buildConnectors } from "./connectors/registry.js";
import type { Connector, SourceType } from "./connectors/types.js";

async function main() {
  const db = await getDb();
  await ensureIndexes(db);

  // Seed settings from .env on first run
  await seedSettings(config.rss.feeds, config.kakaocli.chats);

  const settings = await getSettings();
  const connectors = buildConnectors(settings);

  console.log(`[feedhub] Active connectors: ${[...connectors.keys()].join(", ")}`);

  const onSettingsChanged = (newSettings: typeof settings) => {
    const updated = buildConnectors(newSettings);
    connectors.clear();
    for (const [k, v] of updated) connectors.set(k, v);
    console.log(`[feedhub] Connectors rebuilt: ${[...connectors.keys()].join(", ")}`);
  };

  const app = buildApp(connectors, onSettingsChanged);
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

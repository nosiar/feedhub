// src/server/routes/sources.ts
import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { getDb } from "../../db/client.js";

export function sourcesRoutes(
  app: FastifyInstance,
  connectors: Map<SourceType, Connector>
): void {
  app.get("/api/sources", async () => {
    const db = await getDb();
    const cursors = db.collection("sync_cursors");
    const allCursors = await cursors.find().toArray();
    const cursorMap = new Map(allCursors.map((c) => [c.source, c]));

    const sources = [];
    for (const [name] of connectors) {
      const c = cursorMap.get(name);
      sources.push({
        name,
        lastSyncedAt: c?.lastSyncedAt ?? null,
        cursor: c?.cursor ?? null,
      });
    }
    return { sources };
  });
}

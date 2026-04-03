// src/server/routes/sync.ts
import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { upsertFeedItems } from "../../db/feed-repo.js";
import { getDb } from "../../db/client.js";

const CURSORS_COLLECTION = "sync_cursors";

export async function runSync(connector: Connector): Promise<{ count: number }> {
  const db = await getDb();
  const cursors = db.collection(CURSORS_COLLECTION);
  const cursorDoc = await cursors.findOne({ source: connector.name });
  const cursor = cursorDoc?.cursor ?? null;

  const { items, newCursor } = await connector.sync(cursor);
  await upsertFeedItems(items);
  await cursors.updateOne(
    { source: connector.name },
    { $set: { cursor: newCursor, lastSyncedAt: new Date() } },
    { upsert: true }
  );
  return { count: items.length };
}

export function syncRoutes(
  app: FastifyInstance,
  connectors: Map<SourceType, Connector>
): void {
  app.post("/api/sync", async () => {
    const entries = await Promise.allSettled(
      [...connectors.entries()].map(async ([name, connector]) => {
        const { count } = await runSync(connector);
        return [name, count] as const;
      })
    );
    const results: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.status === "fulfilled") {
        results[entry.value[0]] = entry.value[1];
      }
    }
    return { results };
  });

  app.post<{ Params: { source: string } }>(
    "/api/sync/:source",
    async (req, reply) => {
      const source = req.params.source as SourceType;
      const connector = connectors.get(source);
      if (!connector) {
        return reply.status(404).send({ error: `Unknown source: ${source}` });
      }
      const { count } = await runSync(connector);
      return { source, count };
    }
  );
}

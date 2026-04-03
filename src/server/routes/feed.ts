// src/server/routes/feed.ts
import type { FastifyInstance } from "fastify";
import { queryFeed, searchFeed } from "../../db/feed-repo.js";
import type { SourceType } from "../../connectors/types.js";

export async function feedRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/feed", async (req) => {
    const { source, cursor, limit } = req.query as {
      source?: string;
      cursor?: string;
      limit?: string;
    };
    const sources = source ? (source.split(",") as SourceType[]) : undefined;
    const items = await queryFeed({
      sources,
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { items };
  });

  app.get("/api/feed/search", async (req) => {
    const { q, source, limit } = req.query as {
      q?: string;
      source?: string;
      limit?: string;
    };
    if (!q) return { items: [] };
    const sources = source ? (source.split(",") as SourceType[]) : undefined;
    const items = await searchFeed(q, {
      sources,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { items };
  });
}

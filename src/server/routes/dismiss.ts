import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { dismissFeedItem } from "../../db/feed-repo.js";
import { GmailConnector } from "../../connectors/gmail.js";

export function dismissRoutes(
  app: FastifyInstance,
  connectors: Map<SourceType, Connector>
): void {
  app.delete("/api/feed/dismiss", async (req) => {
    const { source, id } = req.query as { source: string; id: string };

    if (source === "gmail") {
      const gmail = connectors.get("gmail");
      if (gmail instanceof GmailConnector) {
        await gmail.trash(id);
      }
    }

    await dismissFeedItem(source as SourceType, id);
    return { ok: true };
  });
}

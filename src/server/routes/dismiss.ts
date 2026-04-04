import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { dismissFeedItem } from "../../db/feed-repo.js";
import { GmailConnector } from "../../connectors/gmail.js";

export function dismissRoutes(
  app: FastifyInstance,
  connectors: Map<SourceType, Connector>
): void {
  app.delete<{ Params: { source: string; id: string } }>(
    "/api/feed/:source/:id",
    async (req) => {
      const { source, id } = req.params;

      // Gmail: also trash in Gmail
      if (source === "gmail") {
        const gmail = connectors.get("gmail");
        if (gmail instanceof GmailConnector) {
          await gmail.trash(id);
        }
      }

      await dismissFeedItem(source as SourceType, id);
      return { ok: true };
    }
  );
}

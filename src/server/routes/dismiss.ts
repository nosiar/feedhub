import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { dismissFeedItem } from "../../db/feed-repo.js";
import { GmailConnector } from "../../connectors/gmail.js";
import { NaverMailConnector } from "../../connectors/naver-mail.js";

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

    if (source === "naver") {
      const naver = connectors.get("naver");
      if (naver instanceof NaverMailConnector) {
        // id format: naver_{folder}_{uid}
        const parts = id.split("_");
        const uid = parseInt(parts.pop()!, 10);
        const folder = parts.slice(1).join("_");
        await naver.trash(folder, uid);
      }
    }

    await dismissFeedItem(source as SourceType, id);
    return { ok: true };
  });
}

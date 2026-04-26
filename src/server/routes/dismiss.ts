import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { dismissFeedItem, getFeedItem } from "../../db/feed-repo.js";
import { deleteKakaoImagesByFeedItem } from "../../db/kakao-images-repo.js";
import { GmailConnector } from "../../connectors/gmail.js";
import { NaverMailConnector } from "../../connectors/naver-mail.js";

export function dismissRoutes(
  app: FastifyInstance,
  connectors: Map<SourceType, Connector>
): void {
  app.delete("/api/feed/dismiss", async (req, reply) => {
    const { source, id } = req.query as { source: string; id: string };

    const existing = await getFeedItem(source as SourceType, id);
    if (existing?.pinned) {
      return reply.status(409).send({ error: "pinned" });
    }

    if (source === "gmail") {
      const gmail = connectors.get("gmail");
      if (gmail instanceof GmailConnector) {
        await gmail.trash(id);
      }
    }

    if (source === "naver") {
      const naver = connectors.get("naver");
      if (naver instanceof NaverMailConnector) {
        const parts = id.split("_");
        const uid = parseInt(parts.pop()!, 10);
        const folder = parts.slice(1).join("_");
        await naver.trash(folder, uid);
      }
    }

    await dismissFeedItem(source as SourceType, id);

    if (source === "kakaotalk") {
      await deleteKakaoImagesByFeedItem(id);
    }

    return { ok: true };
  });
}

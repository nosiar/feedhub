import type { FastifyInstance } from "fastify";
import type { SourceType } from "../../connectors/types.js";
import { setPinned } from "../../db/feed-repo.js";
import {
  pinKakaoImagesByFeedItem,
  unpinKakaoImagesByFeedItem,
} from "../../db/kakao-images-repo.js";

interface PinBody {
  source: SourceType;
  id: string;
  pinned: boolean;
}

export function pinRoutes(app: FastifyInstance): void {
  app.put<{ Body: PinBody }>("/api/feed/pin", async (req, reply) => {
    const { source, id, pinned } = req.body;
    if (!source || !id || typeof pinned !== "boolean") {
      return reply.status(400).send({ error: "invalid body" });
    }
    await setPinned(source, id, pinned);
    if (source === "kakaotalk") {
      if (pinned) await pinKakaoImagesByFeedItem(id);
      else await unpinKakaoImagesByFeedItem(id);
    }
    return { ok: true };
  });
}

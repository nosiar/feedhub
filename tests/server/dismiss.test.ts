import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import { dismissRoutes } from "../../src/server/routes/dismiss.js";
import { insertKakaoImage } from "../../src/db/kakao-images-repo.js";
import { upsertFeedItems } from "../../src/db/feed-repo.js";

describe("DELETE /api/feed/dismiss with kakao image cascade", () => {
  let db: Db;
  let app: ReturnType<typeof Fastify>;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
    app = Fastify({ logger: false });
    dismissRoutes(app, new Map());
    await app.ready();
  });
  afterAll(async () => { await app.close(); await stopTestMongo(); });
  beforeEach(async () => {
    await clearCollections(db, ["kakao_images", "feed_items"]);
  });

  it("deletes kakao_images for the dismissed kakaotalk item", async () => {
    await upsertFeedItems([{
      id: "msg-1", source: "kakaotalk", title: "T", body: "B", author: "A",
      timestamp: new Date(), metadata: {},
    }]);
    await insertKakaoImage({
      feedItemId: "msg-1", chatId: "c", originalUrl: "u1",
      data: Buffer.from("a"), mime: "image/webp", width: 1, height: 1, pinned: false,
    });
    await insertKakaoImage({
      feedItemId: "msg-1", chatId: "c", originalUrl: "u2",
      data: Buffer.from("b"), mime: "image/webp", width: 1, height: 1, pinned: false,
    });
    await insertKakaoImage({
      feedItemId: "msg-other", chatId: "c", originalUrl: "u3",
      data: Buffer.from("c"), mime: "image/webp", width: 1, height: 1, pinned: false,
    });
    const res = await app.inject({
      method: "DELETE", url: "/api/feed/dismiss?source=kakaotalk&id=msg-1",
    });
    expect(res.statusCode).toBe(200);
    expect(await db.collection("kakao_images").countDocuments()).toBe(1);
    const remaining = await db.collection("kakao_images").findOne({});
    expect(remaining?.feedItemId).toBe("msg-other");
  });

  it("does nothing to kakao_images on non-kakao dismiss", async () => {
    await upsertFeedItems([{
      id: "rss-1", source: "rss", title: "T", body: "B", author: "A",
      timestamp: new Date(), metadata: {},
    }]);
    await insertKakaoImage({
      feedItemId: "rss-1", chatId: "c", originalUrl: "u",
      data: Buffer.from("x"), mime: "image/webp", width: 1, height: 1, pinned: false,
    });
    await app.inject({ method: "DELETE", url: "/api/feed/dismiss?source=rss&id=rss-1" });
    expect(await db.collection("kakao_images").countDocuments()).toBe(1);
  });
});

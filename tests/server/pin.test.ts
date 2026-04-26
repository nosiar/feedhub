import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import { pinRoutes } from "../../src/server/routes/pin.js";
import { insertKakaoImage, TTL_DAYS } from "../../src/db/kakao-images-repo.js";

describe("PUT /api/feed/pin with kakao image expireAt toggle", () => {
  let db: Db;
  let app: ReturnType<typeof Fastify>;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
    app = Fastify({ logger: false });
    pinRoutes(app);
    await app.ready();
  });
  afterAll(async () => { await app.close(); await stopTestMongo(); });
  beforeEach(async () => { await clearCollections(db, ["kakao_images", "feed_items"]); });

  async function seed(feedItemId: string, n: number) {
    for (let i = 0; i < n; i++) {
      await insertKakaoImage({
        feedItemId, chatId: "c", originalUrl: `u-${i}`,
        data: Buffer.from("x"), mime: "image/webp", width: 1, height: 1, pinned: false,
      });
    }
  }

  it("removes expireAt on pin=true for kakaotalk", async () => {
    await seed("msg-1", 2);
    const res = await app.inject({
      method: "PUT", url: "/api/feed/pin",
      payload: { source: "kakaotalk", id: "msg-1", pinned: true },
    });
    expect(res.statusCode).toBe(200);
    const docs = await db.collection("kakao_images").find({ feedItemId: "msg-1" }).toArray();
    expect(docs.every((d) => d.expireAt === undefined)).toBe(true);
  });

  it("restores expireAt on pin=false for kakaotalk", async () => {
    await seed("msg-2", 1);
    await app.inject({
      method: "PUT", url: "/api/feed/pin",
      payload: { source: "kakaotalk", id: "msg-2", pinned: true },
    });
    await app.inject({
      method: "PUT", url: "/api/feed/pin",
      payload: { source: "kakaotalk", id: "msg-2", pinned: false },
    });
    const doc = await db.collection("kakao_images").findOne({ feedItemId: "msg-2" });
    expect(doc?.expireAt).toBeInstanceOf(Date);
    const target = Date.now() + TTL_DAYS * 86400_000;
    expect(Math.abs((doc!.expireAt as Date).getTime() - target)).toBeLessThan(5000);
  });

  it("does not touch images for non-kakaotalk pin toggles", async () => {
    await seed("msg-3", 1);
    await app.inject({
      method: "PUT", url: "/api/feed/pin",
      payload: { source: "rss", id: "msg-3", pinned: true },
    });
    const doc = await db.collection("kakao_images").findOne({ feedItemId: "msg-3" });
    expect(doc?.expireAt).toBeInstanceOf(Date);
  });

  it("returns 400 for invalid body", async () => {
    const missing = await app.inject({
      method: "PUT", url: "/api/feed/pin",
      payload: { source: "kakaotalk", pinned: true },
    });
    expect(missing.statusCode).toBe(400);

    const wrongType = await app.inject({
      method: "PUT", url: "/api/feed/pin",
      payload: { source: "kakaotalk", id: "x", pinned: "true" },
    });
    expect(wrongType.statusCode).toBe(400);
  });
});

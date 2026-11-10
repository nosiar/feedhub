import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import { dismissRoutes } from "../../src/server/routes/dismiss.js";
import { insertKakaoImage } from "../../src/db/kakao-images-repo.js";
import { upsertFeedItems, setPinned } from "../../src/db/feed-repo.js";

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

describe("DELETE /api/feed/dismiss pinned guard", () => {
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

  it("returns 409 for pinned items and does not dismiss or cascade-delete", async () => {
    await upsertFeedItems([{
      id: "msg-pinned", source: "kakaotalk", title: "T", body: "B", author: "A",
      timestamp: new Date(), metadata: {},
    }]);
    await setPinned("kakaotalk", "msg-pinned", true);
    await insertKakaoImage({
      feedItemId: "msg-pinned", chatId: "c", originalUrl: "u",
      data: Buffer.from("x"), mime: "image/webp", width: 1, height: 1, pinned: true,
    });
    const res = await app.inject({
      method: "DELETE", url: "/api/feed/dismiss?source=kakaotalk&id=msg-pinned",
    });
    expect(res.statusCode).toBe(409);
    // Item still not dismissed
    const item = await db.collection("feed_items").findOne({ id: "msg-pinned" });
    expect(item?.dismissed).not.toBe(true);
    // Image not cascaded
    expect(await db.collection("kakao_images").countDocuments()).toBe(1);
  });

  it("rolls back the dismiss when the remote trash call fails", async () => {
    const { GmailConnector } = await import("../../src/connectors/gmail.js");
    const gmail = Object.create(GmailConnector.prototype);
    gmail.trash = async () => { throw new Error("gmail down"); };
    const failing = Fastify({ logger: false });
    dismissRoutes(failing, new Map([["gmail", gmail]]));
    await failing.ready();

    await upsertFeedItems([{
      id: "mail-1", source: "gmail", title: "T", body: "B", author: "A",
      timestamp: new Date(), metadata: {},
    }]);
    const res = await failing.inject({ method: "DELETE", url: "/api/feed/dismiss?source=gmail&id=mail-1" });
    await failing.close();

    expect(res.statusCode).toBe(500);
    const item = await db.collection("feed_items").findOne({ id: "mail-1" });
    expect(item?.dismissed).toBe(false);
  });
});


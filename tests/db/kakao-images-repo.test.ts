import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import {
  insertKakaoImage,
  getKakaoImage,
  TTL_DAYS,
} from "../../src/db/kakao-images-repo.js";

describe("kakao-images-repo: insert + get", () => {
  let db: Db;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => { await clearCollections(db, ["kakao_images"]); });

  it("stores bytes with expireAt for non-pinned and returns them by id", async () => {
    const bytes = Buffer.from("fake-webp");
    const id = await insertKakaoImage({
      feedItemId: "msg-1", chatId: "chat-1", originalUrl: "https://kakao/x.jpg",
      data: bytes, mime: "image/webp", width: 800, height: 600, pinned: false,
    });
    const got = await getKakaoImage(id);
    expect(got?.mime).toBe("image/webp");
    expect(got?.data.equals(bytes)).toBe(true);

    const raw = await db.collection("kakao_images").findOne({});
    expect(raw?.expireAt).toBeInstanceOf(Date);
    const expected = Date.now() + TTL_DAYS * 86400_000;
    expect(Math.abs((raw!.expireAt as Date).getTime() - expected)).toBeLessThan(5000);
  });

  it("omits expireAt for pinned inserts", async () => {
    await insertKakaoImage({
      feedItemId: "msg-2", chatId: "chat-1", originalUrl: "https://kakao/y.jpg",
      data: Buffer.from("y"), mime: "image/webp", width: 1, height: 1, pinned: true,
    });
    const raw = await db.collection("kakao_images").findOne({});
    expect(raw?.expireAt).toBeUndefined();
  });

  it("returns null for unknown id", async () => {
    expect(await getKakaoImage("507f1f77bcf86cd799439011")).toBeNull();
    expect(await getKakaoImage("not-an-objectid")).toBeNull();
  });
});

import {
  deleteKakaoImagesByFeedItem,
  pinKakaoImagesByFeedItem,
  unpinKakaoImagesByFeedItem,
  listKakaoImagesByFeedItem,
} from "../../src/db/kakao-images-repo.js";

describe("kakao-images-repo: lifecycle", () => {
  let db: Db;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => { await clearCollections(db, ["kakao_images"]); });

  async function seed(feedItemId: string, urls: string[], pinned = false) {
    return Promise.all(
      urls.map((u) =>
        insertKakaoImage({
          feedItemId, chatId: "c", originalUrl: u,
          data: Buffer.from("x"), mime: "image/webp", width: 1, height: 1, pinned,
        }),
      ),
    );
  }

  it("deletes all images for a feed item", async () => {
    await seed("msg-1", ["a", "b", "c"]);
    await seed("msg-2", ["x"]);
    const deleted = await deleteKakaoImagesByFeedItem("msg-1");
    expect(deleted).toBe(3);
    const remaining = await db.collection("kakao_images").countDocuments();
    expect(remaining).toBe(1);
  });

  it("pin removes expireAt; unpin restores it ~15d in the future", async () => {
    await seed("msg-1", ["a", "b"]);
    await pinKakaoImagesByFeedItem("msg-1");
    let docs = await db.collection("kakao_images").find({ feedItemId: "msg-1" }).toArray();
    expect(docs.every((d) => d.expireAt === undefined)).toBe(true);

    await unpinKakaoImagesByFeedItem("msg-1");
    docs = await db.collection("kakao_images").find({ feedItemId: "msg-1" }).toArray();
    const target = Date.now() + TTL_DAYS * 86400_000;
    for (const d of docs) {
      expect(d.expireAt).toBeInstanceOf(Date);
      expect(Math.abs((d.expireAt as Date).getTime() - target)).toBeLessThan(5000);
    }
  });

  it("lists images for a feed item with originalUrl", async () => {
    await seed("msg-1", ["url-1", "url-2"]);
    const list = await listKakaoImagesByFeedItem("msg-1");
    const urls = list.map((d) => d.originalUrl).sort();
    expect(urls).toEqual(["url-1", "url-2"]);
    expect(list[0]._id).toBeDefined();
  });
});

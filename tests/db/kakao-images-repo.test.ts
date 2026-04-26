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

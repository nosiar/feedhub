import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import { kakaoImageRoutes } from "../../src/server/routes/kakao-image.js";
import { insertKakaoImage } from "../../src/db/kakao-images-repo.js";

describe("GET /api/kakao/image/:id", () => {
  let db: Db;
  let app: ReturnType<typeof Fastify>;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
    app = Fastify({ logger: false });
    kakaoImageRoutes(app);
    await app.ready();
  });
  afterAll(async () => { await app.close(); await stopTestMongo(); });
  beforeEach(async () => { await clearCollections(db, ["kakao_images"]); });

  it("returns the stored bytes with correct content-type", async () => {
    const id = await insertKakaoImage({
      feedItemId: "f1", chatId: "c1", originalUrl: "u",
      data: Buffer.from("payload-bytes"),
      mime: "image/webp", width: 1, height: 1, pinned: false,
    });
    const res = await app.inject({ method: "GET", url: `/api/kakao/image/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.rawPayload.equals(Buffer.from("payload-bytes"))).toBe(true);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/kakao/image/507f1f77bcf86cd799439011",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for malformed id", async () => {
    const res = await app.inject({ method: "GET", url: "/api/kakao/image/not-an-id" });
    expect(res.statusCode).toBe(404);
  });
});

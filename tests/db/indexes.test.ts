// tests/db/indexes.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";

describe("ensureIndexes", () => {
  let db: Db;
  beforeAll(async () => { ({ db } = await startTestMongo()); });
  afterAll(async () => { await stopTestMongo(); });

  it("creates TTL and lookup indexes for kakao_images", async () => {
    await ensureIndexes(db);
    const indexes = await db.collection("kakao_images").indexes();
    const ttl = indexes.find((i) => i.key.expireAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl?.expireAfterSeconds).toBe(0);
    const lookup = indexes.find(
      (i) => i.key.source === 1 && i.key.feedItemId === 1,
    );
    expect(lookup).toBeDefined();
  });
});

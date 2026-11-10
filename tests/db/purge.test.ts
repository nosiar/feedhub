import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import { insertKakaoImage } from "../../src/db/kakao-images-repo.js";
import { runPurge } from "../../src/purge.js";

const NOW = new Date("2026-11-10T00:00:00Z");
const OLD = new Date("2026-10-01T00:00:00Z");
const RECENT = new Date("2026-10-20T00:00:00Z");

describe("runPurge", () => {
  let db: Db;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => { await clearCollections(db, ["kakao_images", "feed_items"]); });

  async function seed(id: string, source: string, timestamp: Date, dismissed: boolean, pinned = false) {
    await db.collection("feed_items").insertOne({
      id, source, title: "T", body: "B", author: "A", timestamp, metadata: {}, dismissed, pinned,
    });
  }

  it("deletes only dismissed, unpinned items older than one month", async () => {
    await seed("old-dismissed", "rss", OLD, true);
    await seed("old-active", "rss", OLD, false);
    await seed("old-pinned", "rss", OLD, true, true);
    await seed("recent-dismissed", "rss", RECENT, true);

    expect(await runPurge(NOW)).toBe(1);
    const left = (await db.collection("feed_items").find().toArray()).map((d) => d.id).sort();
    expect(left).toEqual(["old-active", "old-pinned", "recent-dismissed"]);
  });

  it("removes kakao_images belonging to purged kakaotalk items", async () => {
    await seed("k-old", "kakaotalk", OLD, true);
    await seed("k-recent", "kakaotalk", RECENT, true);
    for (const feedItemId of ["k-old", "k-recent"]) {
      await insertKakaoImage({
        feedItemId, chatId: "c", originalUrl: `u-${feedItemId}`,
        data: Buffer.from("x"), mime: "image/webp", width: 1, height: 1, pinned: false,
      });
    }

    await runPurge(NOW);
    const images = await db.collection("kakao_images").find().toArray();
    expect(images.map((d) => d.feedItemId)).toEqual(["k-recent"]);
  });
});

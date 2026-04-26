import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("sharp", () => {
  const transformer = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from("encoded-webp"),
      info: { width: 1280, height: 720 },
    }),
  };
  const sharp = vi.fn(() => transformer);
  return { default: sharp };
});

const { fetchAndStoreImage } = await import("../../src/connectors/kakao-image-fetcher.js");

describe("fetchAndStoreImage", () => {
  let db: Db;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => {
    fetchMock.mockReset();
    await clearCollections(db, ["kakao_images"]);
  });

  it("downscales, stores, and returns internal URL on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const url = await fetchAndStoreImage({
      url: "https://kakao/x.jpg",
      feedItemId: "msg-1",
      chatId: "chat-1",
      pinned: false,
    });
    expect(url).toMatch(/^\/api\/kakao\/image\/[a-f0-9]{24}$/);
    const docs = await db.collection("kakao_images").find({}).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].mime).toBe("image/webp");
    expect(docs[0].width).toBe(1280);
  });

  it("returns null on non-2xx fetch", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0) });
    const url = await fetchAndStoreImage({
      url: "https://kakao/expired.jpg",
      feedItemId: "msg-2",
      chatId: "chat-1",
      pinned: false,
    });
    expect(url).toBeNull();
    expect(await db.collection("kakao_images").countDocuments()).toBe(0);
  });

  it("returns null on fetch throw", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const url = await fetchAndStoreImage({
      url: "https://kakao/err.jpg",
      feedItemId: "msg-3",
      chatId: "chat-1",
      pinned: false,
    });
    expect(url).toBeNull();
  });
});

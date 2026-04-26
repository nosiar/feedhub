import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo, clearCollections } from "../_mongo.js";
import { ensureIndexes } from "../../src/db/indexes.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("sharp", () => {
  const transformer = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from("w"),
      info: { width: 100, height: 100 },
    }),
  };
  return { default: vi.fn(() => transformer) };
});

const mockExecFile = vi.mocked(execFile);

mockExecFile.mockImplementation(
  (_cmd: string, _args: readonly string[] | undefined, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error | null, stdout: string) => void;
    callback(
      null,
      JSON.stringify([
        {
          id: "100",
          chat_id: "chat-1",
          sender_id: "user-1",
          sender: "Kim",
          text: "Hello",
          type: "text",
          is_from_me: false,
          timestamp: "2026-04-03T10:00:00Z",
        },
      ])
    );
    return {} as ReturnType<typeof execFile>;
  }
);

const { KakaotalkConnector } = await import("../../src/connectors/kakaotalk.js");

describe("KakaotalkConnector", () => {
  beforeEach(() => vi.clearAllMocks());
  it("fetches messages for configured chats", async () => {
    const connector = new KakaotalkConnector("kakaocli", [
      { id: "chat-1", name: "Dev Team" },
    ]);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      source: "kakaotalk",
      title: "Dev Team",
      body: "Hello",
      author: "Kim",
    });
  });

  it("fetches multiple chats in parallel", async () => {
    const connector = new KakaotalkConnector("kakaocli", [
      { id: "chat-1", name: "A" },
      { id: "chat-2", name: "B" },
    ]);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(2);
    expect(mockExecFile).toHaveBeenCalledTimes(2);
  });

  it("returns empty when no chats configured", async () => {
    const connector = new KakaotalkConnector("kakaocli", []);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(0);
  });
});

describe("KakaotalkConnector image rewrite", () => {
  let db: Db;
  beforeAll(async () => {
    ({ db } = await startTestMongo());
    await ensureIndexes(db);
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => {
    fetchMock.mockReset();
    await clearCollections(db, ["kakao_images", "feed_items"]);
  });

  it("rewrites imageUrls to internal paths when fetch succeeds", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    });
    const att = JSON.stringify({ imageUrls: ["https://k/a.jpg", "https://k/b.jpg"] });
    mockExecFile.mockImplementation(
      (_cmd, _args, _opts, cb: unknown) => {
        const callback = cb as (e: Error | null, s: string) => void;
        callback(null, JSON.stringify([
          { id: "10", chat_id: "c1", sender_id: "s", sender: "Sender",
            text: "", attachment: att, type: "unknown",
            is_from_me: false, timestamp: "2026-04-20T01:00:00Z" },
        ]));
        return {} as ReturnType<typeof execFile>;
      },
    );
    const c = new (await import("../../src/connectors/kakaotalk.js")).KakaotalkConnector(
      "kakaocli", [{ id: "c1", name: "C1" }],
    );
    const { items } = await c.sync(null);
    const urls = (items[0].metadata as { imageUrls: string[] }).imageUrls;
    expect(urls).toHaveLength(2);
    for (const u of urls) expect(u).toMatch(/^\/api\/kakao\/image\/[a-f0-9]{24}$/);
  });

  it("keeps original URL when fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 410, arrayBuffer: async () => new ArrayBuffer(0) });
    const att = JSON.stringify({ imageUrls: ["https://k/dead.jpg"] });
    mockExecFile.mockImplementation(
      (_cmd, _args, _opts, cb: unknown) => {
        const callback = cb as (e: Error | null, s: string) => void;
        callback(null, JSON.stringify([
          { id: "11", chat_id: "c1", sender_id: "s", sender: "S",
            text: "", attachment: att, type: "unknown",
            is_from_me: false, timestamp: "2026-04-20T01:00:00Z" },
        ]));
        return {} as ReturnType<typeof execFile>;
      },
    );
    const c = new (await import("../../src/connectors/kakaotalk.js")).KakaotalkConnector(
      "kakaocli", [{ id: "c1", name: "C1" }],
    );
    const { items } = await c.sync(null);
    const urls = (items[0].metadata as { imageUrls: string[] }).imageUrls;
    expect(urls).toEqual(["https://k/dead.jpg"]);
  });

  it("reuses cached internal URL from kakao_images for the same originalUrl (idempotent re-sync)", async () => {
    const { insertKakaoImage } = await import("../../src/db/kakao-images-repo.js");
    const cachedId = await insertKakaoImage({
      feedItemId: "20", chatId: "c1", originalUrl: "https://k/a.jpg",
      data: Buffer.from("cached"), mime: "image/webp",
      width: 1, height: 1, pinned: false,
    });
    const att = JSON.stringify({ imageUrls: ["https://k/a.jpg", "https://k/b.jpg"] });
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    });
    mockExecFile.mockImplementation(
      (_cmd, _args, _opts, cb: unknown) => {
        const callback = cb as (e: Error | null, s: string) => void;
        callback(null, JSON.stringify([
          { id: "20", chat_id: "c1", sender_id: "s", sender: "S",
            text: "", attachment: att, type: "unknown",
            is_from_me: false, timestamp: "2026-04-20T01:00:00Z" },
        ]));
        return {} as ReturnType<typeof execFile>;
      },
    );
    const c = new (await import("../../src/connectors/kakaotalk.js")).KakaotalkConnector(
      "kakaocli", [{ id: "c1", name: "C1" }],
    );
    const { items } = await c.sync(null);
    const urls = (items[0].metadata as { imageUrls: string[] }).imageUrls;
    expect(urls[0]).toBe(`/api/kakao/image/${cachedId}`);
    expect(urls[1]).toMatch(/^\/api\/kakao\/image\/[a-f0-9]{24}$/);
    expect(urls[1]).not.toBe(`/api/kakao/image/${cachedId}`);
    // Only one fetch — for the new URL, not the cached one.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://k/b.jpg");
  });
});

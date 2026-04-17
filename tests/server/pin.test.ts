// tests/server/pin.test.ts
import { describe, it, expect, vi, afterAll } from "vitest";

const setPinned = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  closeDb: vi.fn(),
}));

vi.mock("../../src/db/feed-repo.js", () => ({
  queryFeed: vi.fn().mockResolvedValue([]),
  searchFeed: vi.fn().mockResolvedValue([]),
  setPinned,
  getFeedItem: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/db/indexes.js", () => ({ ensureIndexes: vi.fn() }));
vi.mock("../../src/db/settings-repo.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ rssFeeds: [], kakaoChats: [] }),
  saveSettings: vi.fn(),
}));

const { buildApp } = await import("../../src/server/app.js");

describe("Pin API", () => {
  const app = buildApp(new Map(), () => {});
  afterAll(async () => { await app.close(); });

  it("PUT /api/feed/pin sets pinned flag", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/feed/pin",
      payload: { source: "rss", id: "rss-1", pinned: true },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
    expect(setPinned).toHaveBeenCalledWith("rss", "rss-1", true);
  });

  it("PUT /api/feed/pin can unpin", async () => {
    setPinned.mockClear();
    const res = await app.inject({
      method: "PUT",
      url: "/api/feed/pin",
      payload: { source: "rss", id: "rss-1", pinned: false },
    });
    expect(res.statusCode).toBe(200);
    expect(setPinned).toHaveBeenCalledWith("rss", "rss-1", false);
  });
});

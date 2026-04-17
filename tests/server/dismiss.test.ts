// tests/server/dismiss.test.ts
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

const dismissFeedItem = vi.fn().mockResolvedValue(undefined);
const getFeedItem = vi.fn();

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  closeDb: vi.fn(),
}));

vi.mock("../../src/db/feed-repo.js", () => ({
  queryFeed: vi.fn().mockResolvedValue([]),
  searchFeed: vi.fn().mockResolvedValue([]),
  setPinned: vi.fn(),
  getFeedItem,
  dismissFeedItem,
}));

vi.mock("../../src/db/indexes.js", () => ({ ensureIndexes: vi.fn() }));
vi.mock("../../src/db/settings-repo.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ rssFeeds: [], kakaoChats: [] }),
  saveSettings: vi.fn(),
}));

const { buildApp } = await import("../../src/server/app.js");

describe("Dismiss API pinned guard", () => {
  const app = buildApp(new Map(), () => {});
  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    dismissFeedItem.mockClear();
    getFeedItem.mockReset();
  });

  it("DELETE /api/feed/dismiss dismisses unpinned items", async () => {
    getFeedItem.mockResolvedValue({ source: "rss", id: "rss-1", pinned: false });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/feed/dismiss?source=rss&id=rss-1",
    });
    expect(res.statusCode).toBe(200);
    expect(dismissFeedItem).toHaveBeenCalledWith("rss", "rss-1");
  });

  it("DELETE /api/feed/dismiss returns 409 for pinned items and does not dismiss", async () => {
    getFeedItem.mockResolvedValue({ source: "rss", id: "rss-2", pinned: true });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/feed/dismiss?source=rss&id=rss-2",
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).error).toBe("pinned");
    expect(dismissFeedItem).not.toHaveBeenCalled();
  });
});

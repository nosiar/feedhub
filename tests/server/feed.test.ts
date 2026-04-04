// tests/server/feed.test.ts
import { describe, it, expect, vi, afterAll } from "vitest";

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  closeDb: vi.fn(),
}));

vi.mock("../../src/db/feed-repo.js", () => ({
  queryFeed: vi.fn().mockResolvedValue([
    {
      id: "1",
      source: "rss",
      title: "Test",
      body: "Hello",
      author: "Author",
      timestamp: new Date("2026-04-03"),
      metadata: {},
    },
  ]),
  searchFeed: vi.fn().mockResolvedValue([
    {
      id: "2",
      source: "gmail",
      title: "Search Result",
      body: "Found",
      author: "Sender",
      timestamp: new Date("2026-04-03"),
      metadata: {},
    },
  ]),
}));

vi.mock("../../src/db/indexes.js", () => ({
  ensureIndexes: vi.fn(),
}));

vi.mock("../../src/db/settings-repo.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ rssFeeds: [], kakaoChats: [] }),
  saveSettings: vi.fn(),
}));

const { buildApp } = await import("../../src/server/app.js");

describe("Feed API", () => {
  const app = buildApp(new Map(), () => {});

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/feed returns feed items", async () => {
    const res = await app.inject({ method: "GET", url: "/api/feed" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Test");
  });

  it("GET /api/feed?source=rss filters by source", async () => {
    const res = await app.inject({ method: "GET", url: "/api/feed?source=rss" });
    expect(res.statusCode).toBe(200);
  });

  it("GET /api/feed/search?q=keyword returns results", async () => {
    const res = await app.inject({ method: "GET", url: "/api/feed/search?q=test" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Search Result");
  });
});

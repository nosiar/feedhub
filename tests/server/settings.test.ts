// tests/server/settings.test.ts
import { describe, it, expect, vi, afterAll } from "vitest";

const mockSettings = {
  rssFeeds: [{ url: "http://example.com/rss", title: "Test" }],
  kakaoChats: [{ id: "123", name: "Chat" }],
};

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  closeDb: vi.fn(),
}));

vi.mock("../../src/db/settings-repo.js", () => ({
  getSettings: vi.fn().mockResolvedValue(mockSettings),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/db/feed-repo.js", () => ({
  queryFeed: vi.fn().mockResolvedValue([]),
  searchFeed: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/db/indexes.js", () => ({
  ensureIndexes: vi.fn(),
}));

const { buildApp } = await import("../../src/server/app.js");

describe("Settings API", () => {
  const connectors = new Map();
  const app = buildApp(connectors, () => {});

  afterAll(async () => { await app.close(); });

  it("GET /api/settings returns current settings", async () => {
    const res = await app.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.rssFeeds).toHaveLength(1);
    expect(body.kakaoChats).toHaveLength(1);
    expect(body.gmail).toHaveProperty("connected");
    expect(body.slack).toHaveProperty("connected");
  });

  it("PUT /api/settings saves and returns ok", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { rssFeeds: [{ url: "http://new.com/rss", title: "New" }], kakaoChats: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
  });
});

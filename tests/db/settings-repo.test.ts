import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindOne = vi.fn();
const mockReplaceOne = vi.fn().mockResolvedValue({});
const mockCollection = { findOne: mockFindOne, replaceOne: mockReplaceOne };
const mockDb = { collection: vi.fn().mockReturnValue(mockCollection) };

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

const { getSettings, saveSettings } = await import("../../src/db/settings-repo.js");

describe("settings-repo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns default settings when none exist", async () => {
    mockFindOne.mockResolvedValue(null);
    const settings = await getSettings();
    expect(settings).toEqual({ rssFeeds: [], kakaoChats: [] });
  });

  it("returns stored settings", async () => {
    mockFindOne.mockResolvedValue({
      _id: "global",
      rssFeeds: [{ url: "http://example.com/rss", title: "Test" }],
      kakaoChats: [{ id: "123", name: "Chat" }],
    });
    const settings = await getSettings();
    expect(settings.rssFeeds).toHaveLength(1);
    expect(settings.kakaoChats).toHaveLength(1);
  });

  it("saves settings with upsert", async () => {
    await saveSettings({
      rssFeeds: [{ url: "http://example.com/rss", title: "Test" }],
      kakaoChats: [],
    });
    expect(mockReplaceOne).toHaveBeenCalledWith(
      { _id: "global" },
      expect.objectContaining({ rssFeeds: expect.any(Array) }),
      { upsert: true }
    );
  });
});

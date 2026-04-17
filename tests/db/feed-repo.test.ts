import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FeedItem } from "../../src/connectors/types.js";

const mockCollection = {
  bulkWrite: vi.fn().mockResolvedValue({ upsertedCount: 2 }),
  find: vi.fn(),
  countDocuments: vi.fn().mockResolvedValue(0),
  updateOne: vi.fn(),
  findOne: vi.fn(),
};

const mockDb = {
  collection: vi.fn().mockReturnValue(mockCollection),
};

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

const { upsertFeedItems, queryFeed, searchFeed } = await import(
  "../../src/db/feed-repo.js"
);

describe("feed-repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertFeedItems", () => {
    it("bulk upserts items by source+id", async () => {
      const items: FeedItem[] = [
        {
          id: "rss-1",
          source: "rss",
          title: "Hello",
          body: "World",
          author: "Test",
          timestamp: new Date("2026-04-03"),
          metadata: {},
        },
      ];
      await upsertFeedItems(items);
      expect(mockCollection.bulkWrite).toHaveBeenCalledOnce();
      const ops = mockCollection.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.filter).toEqual({
        source: "rss",
        id: "rss-1",
      });
    });
  });

  describe("queryFeed", () => {
    it("queries with source filter and cursor", async () => {
      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockToArray = vi.fn().mockResolvedValue([]);
      mockCollection.find.mockReturnValue({
        sort: mockSort,
        limit: mockLimit,
        toArray: mockToArray,
      });

      await queryFeed({ sources: ["gmail"], limit: 10 });
      const filter = mockCollection.find.mock.calls[0][0];
      expect(filter.source).toEqual({ $in: ["gmail"] });
    });
  });

  describe("searchFeed", () => {
    it("searches using text index", async () => {
      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockToArray = vi.fn().mockResolvedValue([]);
      mockCollection.find.mockReturnValue({
        sort: mockSort,
        limit: mockLimit,
        toArray: mockToArray,
      });

      await searchFeed("keyword", {});
      const filter = mockCollection.find.mock.calls[0][0];
      expect(filter.$text).toEqual({ $search: "keyword" });
    });
  });

  describe("upsertFeedItems pinned default", () => {
    it("sets pinned: false on insert only", async () => {
      const items: FeedItem[] = [
        {
          id: "rss-2",
          source: "rss",
          title: "T",
          body: "B",
          author: "A",
          timestamp: new Date("2026-04-17"),
          metadata: {},
        },
      ];
      await upsertFeedItems(items);
      const ops = mockCollection.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$setOnInsert).toEqual({
        dismissed: false,
        pinned: false,
      });
    });
  });

  describe("setPinned", () => {
    it("updates the pinned flag for the given item", async () => {
      const updateOne = vi.fn().mockResolvedValue({});
      mockCollection.updateOne = updateOne;
      const { setPinned } = await import("../../src/db/feed-repo.js");
      await setPinned("rss", "rss-3", true);
      expect(updateOne).toHaveBeenCalledWith(
        { source: "rss", id: "rss-3" },
        { $set: { pinned: true } }
      );
    });
  });

  describe("getFeedItem", () => {
    it("returns the single matching item or null", async () => {
      const findOne = vi.fn().mockResolvedValue({ source: "rss", id: "rss-4", pinned: true });
      mockCollection.findOne = findOne;
      const { getFeedItem } = await import("../../src/db/feed-repo.js");
      const result = await getFeedItem("rss", "rss-4");
      expect(findOne).toHaveBeenCalledWith({ source: "rss", id: "rss-4" });
      expect(result?.pinned).toBe(true);
    });
  });
});

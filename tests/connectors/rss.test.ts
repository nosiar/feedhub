import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("rss-parser", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      parseURL: vi.fn().mockResolvedValue({
        title: "Test Blog",
        items: [
          {
            guid: "post-1",
            title: "First Post",
            contentSnippet: "Hello world",
            creator: "Author",
            link: "https://example.com/post-1",
            isoDate: "2026-04-03T10:00:00Z",
          },
          {
            guid: "post-2",
            title: "Second Post",
            contentSnippet: "Goodbye world",
            creator: "Author",
            link: "https://example.com/post-2",
            isoDate: "2026-04-02T10:00:00Z",
          },
        ],
      }),
    })),
  };
});

const { RssConnector } = await import("../../src/connectors/rss.js");

describe("RssConnector", () => {
  it("parses feed items into FeedItem format", async () => {
    const connector = new RssConnector(["https://example.com/feed"]);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      source: "rss",
      title: "First Post",
      body: "Hello world",
      author: "Test Blog",
      url: "https://example.com/post-1",
    });
    expect(result.newCursor).toBeDefined();
  });

  it("filters items after cursor timestamp", async () => {
    const connector = new RssConnector(["https://example.com/feed"]);
    const result = await connector.sync("2026-04-03T00:00:00Z");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("First Post");
  });
});

import Parser from "rss-parser";
import type { Connector, FeedItem } from "./types.js";

export class RssConnector implements Connector {
  name = "rss" as const;
  private parser = new Parser();
  private feedUrls: string[];

  constructor(feedUrls: string[]) {
    this.feedUrls = feedUrls;
  }

  async sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }> {
    const allItems: FeedItem[] = [];
    const cursorDate = cursor ? new Date(cursor) : null;

    const results = await Promise.allSettled(
      this.feedUrls.map(async (url) => {
        const feed = await this.parser.parseURL(url);
        const items: FeedItem[] = [];
        for (const entry of feed.items) {
          const timestamp = new Date(entry.isoDate ?? entry.pubDate ?? Date.now());
          if (cursorDate && timestamp <= cursorDate) continue;
          items.push({
            id: entry.guid ?? entry.link ?? `${url}:${timestamp.toISOString()}`,
            source: "rss",
            title: entry.title ?? "(no title)",
            body: entry.contentSnippet ?? entry.content ?? "",
            author: feed.title ?? entry.creator ?? "Unknown",
            url: entry.link,
            timestamp,
            metadata: { feedUrl: url, feedTitle: feed.title },
          });
        }
        return items;
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") allItems.push(...result.value);
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const newCursor = allItems.length > 0
      ? allItems[0].timestamp.toISOString()
      : cursor ?? new Date().toISOString();

    return { items: allItems, newCursor };
  }
}

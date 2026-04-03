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

    for (const url of this.feedUrls) {
      const feed = await this.parser.parseURL(url);
      for (const entry of feed.items) {
        const timestamp = new Date(entry.isoDate ?? entry.pubDate ?? Date.now());
        if (cursorDate && timestamp <= cursorDate) continue;
        allItems.push({
          id: entry.guid ?? entry.link ?? `${url}:${timestamp.toISOString()}`,
          source: "rss",
          title: entry.title ?? "(no title)",
          body: entry.contentSnippet ?? entry.content ?? "",
          author: entry.creator ?? feed.title ?? "Unknown",
          url: entry.link,
          timestamp,
          metadata: { feedUrl: url, feedTitle: feed.title },
        });
      }
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const newCursor = allItems.length > 0
      ? allItems[0].timestamp.toISOString()
      : cursor ?? new Date().toISOString();

    return { items: allItems, newCursor };
  }
}

import Parser from "rss-parser";
import type { Connector, FeedItem } from "./types.js";

interface YouTubeChannel {
  channelId: string;
  name: string;
}

type YouTubeItem = {
  id?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  author?: string;
  mediaGroup?: {
    "media:thumbnail"?: { $: { url: string; width: string; height: string } }[];
    "media:description"?: string[];
    "media:community"?: {
      "media:statistics"?: { $: { views: string } }[];
    }[];
  };
};

export class YouTubeConnector implements Connector {
  name = "youtube" as const;
  private parser: Parser<Record<string, unknown>, YouTubeItem>;
  private channels: YouTubeChannel[];

  constructor(channels: YouTubeChannel[]) {
    this.channels = channels;
    this.parser = new Parser({
      customFields: { item: [["media:group", "mediaGroup"]] },
    });
  }

  async sync(
    cursor: string | null
  ): Promise<{ items: FeedItem[]; newCursor: string }> {
    const allItems: FeedItem[] = [];
    const cursorDate = cursor ? new Date(cursor) : null;

    const results = await Promise.allSettled(
      this.channels.map(async (ch) => {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`;
        const feed = await this.parser.parseURL(feedUrl);
        const items: FeedItem[] = [];

        for (const entry of feed.items) {
          const timestamp = new Date(
            entry.isoDate ?? entry.pubDate ?? Date.now()
          );
          if (cursorDate && timestamp <= cursorDate) continue;

          const videoId = entry.id?.replace("yt:video:", "") ?? "";
          const mg = entry.mediaGroup;
          const thumbnail =
            mg?.["media:thumbnail"]?.[0]?.["$"]?.url ??
            (videoId
              ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
              : "");
          const description = mg?.["media:description"]?.[0] ?? "";
          const views =
            mg?.["media:community"]?.[0]?.["media:statistics"]?.[0]?.["$"]
              ?.views ?? null;

          items.push({
            id: `youtube_${videoId}`,
            source: "youtube",
            title: entry.title ?? "(no title)",
            body: description,
            author: ch.name || (feed.title as string) || "Unknown",
            url: entry.link,
            timestamp,
            metadata: {
              channelId: ch.channelId,
              videoId,
              thumbnail,
              ...(views ? { views: parseInt(views, 10) } : {}),
            },
          });
        }
        return items;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") allItems.push(...result.value);
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const newCursor =
      allItems.length > 0
        ? allItems[0].timestamp.toISOString()
        : cursor ?? new Date().toISOString();

    return { items: allItems, newCursor };
  }
}

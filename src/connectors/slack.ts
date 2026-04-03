import { WebClient } from "@slack/web-api";
import type { Connector, FeedItem } from "./types.js";

export class SlackConnector implements Connector {
  name = "slack" as const;
  private client: WebClient;
  private userCache = new Map<string, string>();

  constructor(botToken: string) {
    this.client = new WebClient(botToken);
  }

  private async getUserName(userId: string): Promise<string> {
    if (this.userCache.has(userId)) return this.userCache.get(userId)!;
    const info = await this.client.users.info({ user: userId });
    const name = info.user?.real_name ?? userId;
    this.userCache.set(userId, name);
    return name;
  }

  async sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }> {
    const channelsRes = await this.client.conversations.list({
      types: "public_channel,private_channel",
      limit: 100,
    });
    const channels = channelsRes.channels ?? [];
    const allItems: FeedItem[] = [];
    let latestTs = cursor ?? "0";

    for (const channel of channels) {
      const historyRes = await this.client.conversations.history({
        channel: channel.id!,
        oldest: cursor ?? undefined,
        limit: 50,
      });

      for (const msg of historyRes.messages ?? []) {
        if (!msg.text || msg.subtype) continue;
        const author = msg.user ? await this.getUserName(msg.user) : "Unknown";
        const ts = msg.ts!;
        if (ts > latestTs) latestTs = ts;

        allItems.push({
          id: `${channel.id}-${ts}`,
          source: "slack",
          title: `#${channel.name}`,
          body: msg.text,
          author,
          url: undefined,
          timestamp: new Date(parseFloat(ts) * 1000),
          metadata: { channelId: channel.id, channelName: channel.name, ts },
        });
      }
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { items: allItems, newCursor: latestTs };
  }
}

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import type { Connector, FeedItem } from "./types.js";

interface TelegramConfig {
  apiId: number;
  apiHash: string;
  session: string;
  chats: string[];
}

interface LinkPreview {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

export class TelegramConnector implements Connector {
  name = "telegram" as const;
  private config: TelegramConfig;
  private client: TelegramClient | null = null;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  private async getClient(): Promise<TelegramClient> {
    if (this.client?.connected) return this.client;
    this.client = new TelegramClient(
      new StringSession(this.config.session),
      this.config.apiId,
      this.config.apiHash,
      { connectionRetries: 3 }
    );
    await this.client.connect();
    return this.client;
  }

  async sync(
    cursor: string | null
  ): Promise<{ items: FeedItem[]; newCursor: string }> {
    const client = await this.getClient();
    const allItems: FeedItem[] = [];
    let maxId = cursor ? parseInt(cursor, 10) : 0;

    const chatIds = this.config.chats;

    const targets: { id: string; title: string }[] = [];
    if (chatIds.length > 0) {
      for (const chatId of chatIds) {
        try {
          const entity = await client.getEntity(chatId);
          const title = "title" in entity ? entity.title :
            "firstName" in entity ? `${entity.firstName ?? ""} ${entity.lastName ?? ""}`.trim() :
            chatId;
          targets.push({ id: chatId, title });
        } catch {
          targets.push({ id: chatId, title: chatId });
        }
      }
    } else {
      const dialogs = await client.getDialogs({ limit: 20 });
      for (const d of dialogs) {
        if (d.id) {
          targets.push({ id: d.id.toString(), title: d.title ?? d.id.toString() });
        }
      }
    }

    const results = await Promise.allSettled(
      targets.map(async (chat) => {
        const msgs = await client.getMessages(chat.id, {
          limit: 50,
          minId: cursor ? parseInt(cursor, 10) : undefined,
        });

        return msgs.map((msg) => {
          const msgId = msg.id;
          if (msgId > maxId) maxId = msgId;

          const senderName = msg.sender && "firstName" in msg.sender
            ? `${msg.sender.firstName ?? ""} ${msg.sender.lastName ?? ""}`.trim()
            : msg.sender && "title" in msg.sender
              ? msg.sender.title
              : "";

          // Extract images
          const imageUrls: string[] = [];
          if (msg.photo && msg.photo instanceof Api.Photo) {
            // Photo messages don't have direct URLs in GramJS
            // We'd need to download them, skip for now
          }

          // Extract link preview from webpage
          let linkPreview: LinkPreview | undefined;
          if (msg.media && msg.media instanceof Api.MessageMediaWebPage) {
            const page = msg.media.webpage;
            if (page && page instanceof Api.WebPage) {
              linkPreview = {
                title: page.title ?? "",
                description: page.description ?? "",
                imageUrl: page.photo && page.photo instanceof Api.Photo ? "" : "",
                url: page.url ?? "",
              };
            }
          }

          return {
            id: `${chat.id}_${msgId}`,
            source: "telegram" as const,
            title: chat.title,
            body: msg.text ?? "",
            author: senderName,
            timestamp: new Date(msg.date * 1000),
            metadata: {
              chatId: chat.id,
              messageId: msgId,
              imageUrls,
              ...(linkPreview ? { linkPreview } : {}),
            },
          } satisfies FeedItem;
        });
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") allItems.push(...result.value);
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return {
      items: allItems,
      newCursor: maxId > 0 ? maxId.toString() : cursor ?? "0",
    };
  }
}

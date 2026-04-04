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

function parseCursors(cursor: string | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!cursor) return map;
  for (const entry of cursor.split(",")) {
    const [chatId, id] = entry.split(":");
    if (chatId && id) map.set(chatId, parseInt(id, 10));
  }
  return map;
}

function serializeCursors(cursors: Map<string, number>): string {
  return [...cursors.entries()].map(([k, v]) => `${k}:${v}`).join(",");
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
    const cursors = parseCursors(cursor);

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
        const chatCursor = cursors.get(chat.id) ?? 0;

        const msgs = await client.getMessages(chat.id, {
          limit: 50,
          minId: chatCursor || undefined,
        });

        let maxId = chatCursor;
        const items = msgs.map((msg) => {
          const msgId = msg.id;
          if (msgId > maxId) maxId = msgId;

          const senderName = msg.sender && "firstName" in msg.sender
            ? `${msg.sender.firstName ?? ""} ${msg.sender.lastName ?? ""}`.trim()
            : msg.sender && "title" in msg.sender
              ? msg.sender.title
              : "";

          const imageUrls: string[] = [];

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

        return { chatId: chat.id, items, maxId };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { chatId, items, maxId } = result.value;
      allItems.push(...items);
      cursors.set(chatId, maxId);
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return {
      items: allItems,
      newCursor: serializeCursors(cursors),
    };
  }
}

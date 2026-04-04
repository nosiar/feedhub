import { execFile } from "node:child_process";
import type { Connector, FeedItem } from "./types.js";

export interface KakaoChat {
  id: string;
  name: string;
}

interface KakaocliMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender: string;
  text: string;
  attachment?: string;
  type: string;
  is_from_me: boolean;
  timestamp: string;
}

interface ParsedAttachment {
  imageUrls: string[];
  linkPreview?: { title: string; description: string; imageUrl: string; url: string };
}

function parseAttachment(attachment?: string): ParsedAttachment {
  if (!attachment) return { imageUrls: [] };
  try {
    const data = JSON.parse(attachment);

    // Link preview (OG data)
    const scrap = data.universalScrapData;
    let linkPreview: ParsedAttachment["linkPreview"];
    if (scrap) {
      const title = scrap.title ?? scrap.universal?.C?.TI?.txt ?? "";
      const description = scrap.description ?? "";
      const imageUrl = scrap.image_url ?? scrap.universal?.C?.TH?.src ?? "";
      const url = scrap.canonical_url ?? scrap.requested_url ?? "";
      if (title && url) {
        linkPreview = { title, description, imageUrl, url };
      }
    }

    // Images
    let imageUrls: string[] = [];
    if (Array.isArray(data.imageUrls)) imageUrls = data.imageUrls;
    else if (data.url && !scrap) imageUrls = [data.url];

    return { imageUrls, linkPreview };
  } catch {
    return { imageUrls: [] };
  }
}

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 50 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

export class KakaotalkConnector implements Connector {
  name = "kakaotalk" as const;
  private bin: string;
  private chats: KakaoChat[];

  constructor(bin: string, chats: KakaoChat[]) {
    this.bin = bin;
    this.chats = chats;
  }

  async sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }> {
    const results = await Promise.allSettled(
      this.chats.map(async (chat) => {
        const args = [
          "messages", "--chat-id", chat.id, "--json", "--limit", cursor ? "10000" : "100", "--since", "7d",
        ];
        if (cursor) args.push("--after-id", cursor);

        const output = await run(this.bin, args);
        const messages: KakaocliMessage[] = JSON.parse(output);

        return messages.map((msg) => ({
          item: {
            id: msg.id,
            source: "kakaotalk" as const,
            title: chat.name,
            body: msg.text,
            author: msg.sender ?? (msg.is_from_me ? "나" : ""),
            timestamp: new Date(msg.timestamp),
            metadata: {
              chatId: msg.chat_id,
              senderId: msg.sender_id,
              isFromMe: msg.is_from_me,
              ...parseAttachment(msg.attachment),
            },
          } satisfies FeedItem,
          msgId: msg.id,
        }));
      })
    );

    const allItems: FeedItem[] = [];
    let maxId = cursor ?? "0";

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const { item, msgId } of result.value) {
        allItems.push(item);
        if (BigInt(msgId) > BigInt(maxId)) maxId = msgId;
      }
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { items: allItems, newCursor: maxId };
  }
}

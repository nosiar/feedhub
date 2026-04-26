import { execFile } from "node:child_process";
import { fetchAndStoreImage } from "./kakao-image-fetcher.js";
import { listKakaoImagesByFeedItem } from "../db/kakao-images-repo.js";
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

const FETCH_CONCURRENCY = 4;
const ITEM_CONCURRENCY = 4;
const INTERNAL_PREFIX = "/api/kakao/image/";

function parseAttachment(attachment?: string): ParsedAttachment {
  if (!attachment) return { imageUrls: [] };
  try {
    const data = JSON.parse(attachment);
    const scrap = data.universalScrapData;
    let linkPreview: ParsedAttachment["linkPreview"];
    if (scrap) {
      const title = scrap.title ?? scrap.universal?.C?.TI?.txt ?? "";
      const description = scrap.description ?? "";
      const imageUrl = scrap.image_url ?? scrap.universal?.C?.TH?.src ?? "";
      const url = scrap.canonical_url ?? scrap.requested_url ?? "";
      if (title && url) linkPreview = { title, description, imageUrl, url };
    }
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
    execFile(bin, args, { maxBuffer: 50 * 1024 * 1024, timeout: 15_000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let next = 0;
  const workers = Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function rewriteImagesForItem(item: FeedItem): Promise<void> {
  const meta = item.metadata as {
    imageUrls?: string[];
    linkPreview?: { imageUrl: string };
    chatId?: string;
  };
  const chatId = String(meta.chatId ?? "");

  const hasInlineImages = Array.isArray(meta.imageUrls) && meta.imageUrls.length > 0;
  const hasLinkImage = !!(meta.linkPreview && meta.linkPreview.imageUrl);
  if (!hasInlineImages && !hasLinkImage) return;

  const cached = await listKakaoImagesByFeedItem(item.id);
  const cachedByOrigUrl = new Map(
    cached.map((c) => [c.originalUrl, `${INTERNAL_PREFIX}${c._id}`]),
  );

  if (hasInlineImages) {
    meta.imageUrls = await mapWithConcurrency(meta.imageUrls!, FETCH_CONCURRENCY, async (url) => {
      if (url.startsWith(INTERNAL_PREFIX)) return url;
      const reused = cachedByOrigUrl.get(url);
      if (reused) return reused;
      const internal = await fetchAndStoreImage({
        url, feedItemId: item.id, chatId, pinned: false,
      });
      return internal ?? url;
    });
  }

  if (hasLinkImage) {
    const original = meta.linkPreview!.imageUrl;
    if (!original.startsWith(INTERNAL_PREFIX)) {
      const reused = cachedByOrigUrl.get(original);
      if (reused) {
        meta.linkPreview!.imageUrl = reused;
      } else {
        const internal = await fetchAndStoreImage({
          url: original, feedItemId: item.id, chatId, pinned: false,
        });
        if (internal) meta.linkPreview!.imageUrl = internal;
      }
    }
  }
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
          "messages", "--chat-id", chat.id, "--json", "--limit",
          cursor ? "10000" : "100", "--since", "7d",
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
      }),
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

    await mapWithConcurrency(allItems, ITEM_CONCURRENCY, (item) => rewriteImagesForItem(item));

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { items: allItems, newCursor: maxId };
  }
}

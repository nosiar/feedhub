import { getDb } from "./client.js";
import type { FeedItem, SourceType } from "../connectors/types.js";

const COLLECTION = "feed_items";

export async function upsertFeedItems(items: FeedItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const ops = items.map((item) => ({
    updateOne: {
      filter: { source: item.source, id: item.id },
      update: { $set: item },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops);
}

export interface QueryOptions {
  sources?: SourceType[];
  cursor?: string;
  limit?: number;
  chatId?: string;
}

export async function queryFeed(opts: QueryOptions): Promise<FeedItem[]> {
  const db = await getDb();
  const col = db.collection<FeedItem>(COLLECTION);
  const filter: Record<string, unknown> = {};
  if (opts.sources && opts.sources.length > 0) {
    filter.source = { $in: opts.sources };
  }
  if (opts.cursor) {
    filter.timestamp = { $lt: new Date(opts.cursor) };
  }
  if (opts.chatId) {
    filter["metadata.chatId"] = opts.chatId;
  }
  return col
    .find(filter)
    .sort({ timestamp: -1 })
    .limit(opts.limit ?? 20)
    .toArray();
}

export async function searchFeed(
  query: string,
  opts: { sources?: SourceType[]; limit?: number }
): Promise<FeedItem[]> {
  const db = await getDb();
  const col = db.collection<FeedItem>(COLLECTION);
  const filter: Record<string, unknown> = {
    $text: { $search: query },
  };
  if (opts.sources && opts.sources.length > 0) {
    filter.source = { $in: opts.sources };
  }
  return col
    .find(filter)
    .sort({ timestamp: -1 })
    .limit(opts.limit ?? 20)
    .toArray();
}

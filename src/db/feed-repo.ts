import { getDb } from "./client.js";
import type { FeedItem, SourceType } from "../connectors/types.js";

const COLLECTION = "feed_items";

export async function upsertFeedItems(
  items: FeedItem[]
): Promise<{ upserted: number; modified: number }> {
  if (items.length === 0) return { upserted: 0, modified: 0 };
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const ops = items.map((item) => ({
    updateOne: {
      filter: { source: item.source, id: item.id },
      update: {
        $set: item,
        $setOnInsert: { dismissed: false, pinned: false },
      },
      upsert: true,
    },
  }));
  const result = await col.bulkWrite(ops);
  return {
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

export async function dismissFeedItem(source: SourceType, id: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { source, id },
    { $set: { dismissed: true } }
  );
}

export async function setPinned(
  source: SourceType,
  id: string,
  pinned: boolean
): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { source, id },
    { $set: { pinned } }
  );
}

export async function getFeedItem(
  source: SourceType,
  id: string
): Promise<FeedItem | null> {
  const db = await getDb();
  const doc = await db
    .collection<FeedItem>(COLLECTION)
    .findOne({ source, id });
  return doc ?? null;
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
  const filter: Record<string, unknown> = { dismissed: { $ne: true } };
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
    dismissed: { $ne: true },
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

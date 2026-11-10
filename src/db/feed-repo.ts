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

// Pinned and dismissed are mutually exclusive; the guard lives in the filter so a
// concurrent pin/dismiss can't both win. Returns false when the guard blocked it.
export async function dismissFeedItem(source: SourceType, id: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.collection(COLLECTION).updateOne(
    { source, id, pinned: { $ne: true } },
    { $set: { dismissed: true } }
  );
  return r.matchedCount > 0;
}

export async function undismissFeedItem(source: SourceType, id: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { source, id },
    { $set: { dismissed: false } }
  );
}

export async function setPinned(
  source: SourceType,
  id: string,
  pinned: boolean
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { source, id };
  if (pinned) filter.dismissed = { $ne: true };
  const r = await db.collection(COLLECTION).updateOne(filter, { $set: { pinned } });
  return r.matchedCount > 0;
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

const PURGE_BATCH = 1000;

// Dismissed docs double as "already seen" markers, so only purge items old enough
// that no connector cursor will fetch them again.
export async function purgeDismissedFeedItems(olderThan: Date): Promise<number> {
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const filter = { dismissed: true, pinned: { $ne: true }, timestamp: { $lt: olderThan } };
  let deleted = 0;
  for (;;) {
    const batch = await col
      .find(filter, { projection: { _id: 1, source: 1, id: 1 } })
      .limit(PURGE_BATCH)
      .toArray();
    if (batch.length === 0) return deleted;
    const kakaoIds = batch.filter((d) => d.source === "kakaotalk").map((d) => d.id);
    if (kakaoIds.length > 0) {
      await db.collection("kakao_images").deleteMany({
        source: "kakaotalk",
        feedItemId: { $in: kakaoIds },
      });
    }
    const r = await col.deleteMany({ _id: { $in: batch.map((d) => d._id) } });
    deleted += r.deletedCount ?? 0;
  }
}

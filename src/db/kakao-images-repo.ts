import { ObjectId, Binary } from "mongodb";
import { getDb } from "./client.js";

export const TTL_DAYS = 15;
const COLLECTION = "kakao_images";

export interface InsertImageInput {
  feedItemId: string;
  chatId: string;
  originalUrl: string;
  data: Buffer;
  mime: string;
  width: number;
  height: number;
  pinned: boolean;
}

export async function insertKakaoImage(input: InsertImageInput): Promise<string> {
  const db = await getDb();
  const now = new Date();
  const doc: Record<string, unknown> = {
    source: "kakaotalk",
    feedItemId: input.feedItemId,
    chatId: input.chatId,
    originalUrl: input.originalUrl,
    mime: input.mime,
    width: input.width,
    height: input.height,
    data: new Binary(input.data),
    createdAt: now,
  };
  if (!input.pinned) {
    doc.expireAt = new Date(now.getTime() + TTL_DAYS * 86400_000);
  }
  const r = await db.collection(COLLECTION).insertOne(doc);
  return r.insertedId.toHexString();
}

export async function getKakaoImage(
  id: string,
): Promise<{ data: Buffer; mime: string } | null> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!doc) return null;
  const bin = doc.data as Binary;
  return { data: Buffer.from(bin.buffer), mime: String(doc.mime) };
}

export async function deleteKakaoImagesByFeedItem(feedItemId: string): Promise<number> {
  const db = await getDb();
  const r = await db.collection(COLLECTION).deleteMany({ source: "kakaotalk", feedItemId });
  return r.deletedCount ?? 0;
}

export async function pinKakaoImagesByFeedItem(feedItemId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateMany(
    { source: "kakaotalk", feedItemId },
    { $unset: { expireAt: "" } },
  );
}

export async function unpinKakaoImagesByFeedItem(feedItemId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateMany(
    { source: "kakaotalk", feedItemId },
    { $set: { expireAt: new Date(Date.now() + TTL_DAYS * 86400_000) } },
  );
}

export interface StoredImage {
  _id: string;
  originalUrl: string;
}

export async function listKakaoImagesByFeedItem(feedItemId: string): Promise<StoredImage[]> {
  const db = await getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ source: "kakaotalk", feedItemId }, { projection: { originalUrl: 1 } })
    .toArray();
  return docs.map((d) => ({
    _id: (d._id as ObjectId).toHexString(),
    originalUrl: String(d.originalUrl),
  }));
}

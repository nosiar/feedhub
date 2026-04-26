import { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  const feed = db.collection("feed_items");
  await feed.createIndex({ timestamp: -1 });
  await feed.createIndex({ source: 1, timestamp: -1 });
  await feed.createIndex({ source: 1, id: 1 }, { unique: true });
  await feed.createIndex({ title: "text", body: "text", author: "text" });

  const images = db.collection("kakao_images");
  await images.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await images.createIndex({ source: 1, feedItemId: 1 });
  await images.createIndex(
    { source: 1, feedItemId: 1, originalUrl: 1 },
    { unique: true },
  );
}

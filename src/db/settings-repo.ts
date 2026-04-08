import { getDb } from "./client.js";

export interface Settings {
  rssFeeds: { url: string; title: string }[];
  kakaoChats: { id: string; name: string }[];
  telegramChats: { id: string; name: string }[];
  youtubeChannels: { channelId: string; name: string }[];
}

const COLLECTION = "settings";

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: "global" as any });
  if (!doc) return { rssFeeds: [], kakaoChats: [], telegramChats: [], youtubeChannels: [] };
  return {
    rssFeeds: doc.rssFeeds ?? [],
    kakaoChats: doc.kakaoChats ?? [],
    telegramChats: doc.telegramChats ?? [],
    youtubeChannels: doc.youtubeChannels ?? [],
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).replaceOne(
    { _id: "global" as any },
    { _id: "global" as any, ...settings },
    { upsert: true }
  );
}

export async function seedSettings(
  envRssFeeds: string[],
  envKakaoChats: { id: string; name: string }[]
): Promise<void> {
  const db = await getDb();
  const existing = await db.collection(COLLECTION).findOne({ _id: "global" as any });
  if (existing) return;
  const rssFeeds = envRssFeeds.map((url) => ({ url, title: "" }));
  await saveSettings({ rssFeeds, kakaoChats: envKakaoChats, telegramChats: [], youtubeChannels: [] });
}

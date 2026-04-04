const BASE = "/api";

export interface FeedItem {
  id: string;
  source: "gmail" | "kakaotalk" | "slack" | "rss";
  title: string;
  body: string;
  author: string;
  url?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export async function fetchFeed(params: {
  source?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: FeedItem[] }> {
  const qs = new URLSearchParams();
  if (params.source) qs.set("source", params.source);
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${BASE}/feed?${qs}`);
  return res.json();
}

export async function searchFeed(params: {
  q: string;
  source?: string;
}): Promise<{ items: FeedItem[] }> {
  const qs = new URLSearchParams({ q: params.q });
  if (params.source) qs.set("source", params.source);
  const res = await fetch(`${BASE}/feed/search?${qs}`);
  return res.json();
}

export async function triggerSync(source?: string): Promise<unknown> {
  const url = source ? `${BASE}/sync/${source}` : `${BASE}/sync`;
  const res = await fetch(url, { method: "POST" });
  return res.json();
}

export async function trashGmail(messageId: string): Promise<void> {
  await fetch(`${BASE}/gmail/${messageId}`, { method: "DELETE" });
}

export async function fetchChatMessages(chatId: string): Promise<{ items: FeedItem[] }> {
  const qs = new URLSearchParams({
    source: "kakaotalk",
    chatId,
    limit: "30",
  });
  const res = await fetch(`${BASE}/feed?${qs}`);
  return res.json();
}

export interface RssFeed {
  url: string;
  title: string;
}

export interface KakaoChat {
  id: string;
  name: string;
}

export interface SettingsResponse {
  rssFeeds: RssFeed[];
  kakaoChats: KakaoChat[];
  gmail: { connected: boolean };
  slack: { connected: boolean };
}

export async function getSettings(): Promise<SettingsResponse> {
  const res = await fetch(`${BASE}/settings`);
  return res.json();
}

export async function saveSettings(data: {
  rssFeeds: RssFeed[];
  kakaoChats: KakaoChat[];
}): Promise<void> {
  await fetch(`${BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchKakaoChats(): Promise<{
  chats: { id: string; name: string; type: string; memberCount: number }[];
}> {
  const res = await fetch(`${BASE}/kakao/chats`);
  return res.json();
}

export async function fetchRssTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`${BASE}/settings/rss-title?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return data.title ?? url;
  } catch {
    return url;
  }
}

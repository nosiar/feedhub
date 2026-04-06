const BASE = "/api";

export interface FeedItem {
  id: string;
  source: "gmail" | "kakaotalk" | "slack" | "rss" | "telegram";
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

export async function dismissFeedItem(source: string, id: string): Promise<void> {
  const qs = new URLSearchParams({ source, id });
  await fetch(`${BASE}/feed/dismiss?${qs}`, { method: "DELETE" });
}

export async function fetchGmailBody(messageId: string): Promise<string> {
  const res = await fetch(`${BASE}/gmail/${messageId}/body`);
  const data = await res.json();
  return data.body ?? "";
}

export async function fetchOgPreview(
  url: string
): Promise<{ title: string; description: string; imageUrl: string; url: string } | null> {
  try {
    const res = await fetch(`${BASE}/og?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return data.preview ?? null;
  } catch {
    return null;
  }
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

export interface TelegramChat {
  id: string;
  name: string;
}

export interface SettingsResponse {
  rssFeeds: RssFeed[];
  kakaoChats: KakaoChat[];
  telegramChats: TelegramChat[];
  gmail: { connected: boolean };
  slack: { connected: boolean };
  telegram: { connected: boolean };
}

export async function getSettings(): Promise<SettingsResponse> {
  const res = await fetch(`${BASE}/settings`);
  return res.json();
}

export async function saveSettings(data: {
  rssFeeds: RssFeed[];
  kakaoChats: KakaoChat[];
  telegramChats: TelegramChat[];
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

export async function fetchTelegramChats(): Promise<{
  chats: { id: string; name: string; type: string; unreadCount: number }[];
}> {
  const res = await fetch(`${BASE}/telegram/chats`);
  return res.json();
}

export interface PollResult {
  question: string;
  closed: boolean;
  answers: { text: string; voters: number }[];
  totalVoters: number;
}

export async function fetchPollResults(pollUrl: string): Promise<PollResult | null> {
  try {
    const res = await fetch(pollUrl);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface ReplyItem {
  id: number;
  text: string;
  author: string;
  isChannel?: boolean;
  replyTo?: { msgId: number; text: string; author: string };
  photoUrl?: string;
  timestamp: string | null;
}

export interface RepliesResult {
  replies: ReplyItem[];
  hasMore: boolean;
}

export async function fetchReplies(
  repliesUrl: string,
  offsetId?: number
): Promise<RepliesResult> {
  const url = offsetId ? `${repliesUrl}?offsetId=${offsetId}&limit=10` : `${repliesUrl}?limit=10`;
  const res = await fetch(url);
  if (!res.ok) return { replies: [], hasMore: false };
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

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

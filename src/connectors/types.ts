export type SourceType = "gmail" | "kakaotalk" | "slack" | "rss";

export interface FeedItem {
  id: string;
  source: SourceType;
  title: string;
  body: string;
  author: string;
  url?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface SyncCursor {
  source: SourceType;
  cursor: string;
  lastSyncedAt: Date;
}

export interface Connector {
  name: SourceType;
  sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }>;
}

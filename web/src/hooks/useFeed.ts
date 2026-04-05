import { useState, useEffect, useCallback } from "react";
import { fetchFeed, searchFeed, type FeedItem } from "../api.js";

export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [source, setSource] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (query) {
        const res = await searchFeed({ q: query, source });
        setItems(res.items);
        setCursor(undefined);
      } else {
        const res = await fetchFeed({ source, limit: 20 });
        setItems(res.items);
        setCursor(
          res.items.length > 0
            ? res.items[res.items.length - 1].timestamp
            : undefined
        );
      }
    } finally {
      setLoading(false);
    }
  }, [source, query]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || query) return;
    setLoading(true);
    try {
      const res = await fetchFeed({ source, cursor, limit: 20 });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(
        res.items.length > 0
          ? res.items[res.items.length - 1].timestamp
          : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [source, cursor, loading, query]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 60 seconds: prepend only newer items
  const pollNew = useCallback(async () => {
    if (query) return;
    const newest = items[0]?.timestamp;
    const res = await fetchFeed({ source, limit: 20 });
    if (!newest) {
      setItems(res.items);
      setCursor(
        res.items.length > 0
          ? res.items[res.items.length - 1].timestamp
          : undefined
      );
      return;
    }
    const fresh = res.items.filter((i) => i.timestamp > newest);
    if (fresh.length > 0) {
      setItems((prev) => [...fresh, ...prev]);
    }
  }, [source, query, items]);

  useEffect(() => {
    if (query) return;
    const interval = setInterval(pollNew, 60_000);
    return () => clearInterval(interval);
  }, [pollNew, query]);

  return { items, source, setSource, query, setQuery, loading, loadMore, cursor, reload: load };
}

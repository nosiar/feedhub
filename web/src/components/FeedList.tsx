import { useEffect, useRef } from "react";
import type { FeedItem } from "../api.js";
import { FeedCard } from "./FeedCard.js";

export function FeedList({
  items,
  loading,
  onLoadMore,
  hasMore,
}: {
  items: FeedItem[];
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinel.current || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) onLoadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (items.length === 0 && !loading) {
    return <p style={{ textAlign: "center", color: "#999" }}>No items</p>;
  }

  return (
    <div>
      {items.map((item) => (
        <FeedCard key={`${item.source}-${item.id}`} item={item} />
      ))}
      {hasMore && <div ref={sentinel} style={{ height: 1 }} />}
      {loading && (
        <p style={{ textAlign: "center", color: "#999" }}>Loading...</p>
      )}
    </div>
  );
}

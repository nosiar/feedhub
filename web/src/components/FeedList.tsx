import { useEffect, useRef, createRef } from "react";
import type { FeedItem } from "../api.js";
import { FeedCard } from "./FeedCard.js";

export function FeedList({
  items,
  loading,
  onLoadMore,
  hasMore,
  expandAll,
  onDelete,
  focusedIndex,
  expandedIndex,
  onToggleExpand,
}: {
  items: FeedItem[];
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  expandAll?: boolean;
  onDelete?: (item: FeedItem) => void;
  focusedIndex?: number;
  expandedIndex?: number | null;
  onToggleExpand?: (index: number) => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, React.RefObject<HTMLDivElement | null>>>(new Map());

  items.forEach((_, i) => {
    if (!cardRefs.current.has(i)) {
      cardRefs.current.set(i, createRef<HTMLDivElement>());
    }
  });

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

  useEffect(() => {
    if (focusedIndex == null) return;
    const ref = cardRefs.current.get(focusedIndex);
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedIndex]);

  if (items.length === 0 && !loading) {
    return <p style={{ textAlign: "center", color: "#999" }}>No items</p>;
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={`${item.source}-${item.id}`} style={{ position: "relative" }}>
          {hasMore && i === items.length - 3 && (
            <div ref={sentinel} style={{ position: "absolute", top: 0, height: 1 }} />
          )}
          <FeedCard
            item={item}
            defaultExpanded={expandAll}
            onDelete={onDelete}
            focused={focusedIndex === i}
            expanded={expandedIndex === i ? true : undefined}
            cardRef={cardRefs.current.get(i)}
            onToggleExpand={() => onToggleExpand?.(i)}
          />
        </div>
      ))}
      {loading && (
        <p style={{ textAlign: "center", color: "#999" }}>Loading...</p>
      )}
    </div>
  );
}

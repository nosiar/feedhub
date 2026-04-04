// web/src/App.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useFeed } from "./hooks/useFeed.js";
import { SourceFilter, SOURCES } from "./components/SourceFilter.js";
import { SearchBar } from "./components/SearchBar.js";
import { FeedList } from "./components/FeedList.js";
import { SettingsPage } from "./components/SettingsPage.js";
import { Toast } from "./components/Toast.js";
import { triggerSync, dismissFeedItem, type FeedItem } from "./api.js";

const UNDO_DELAY = 4000;

export function App() {
  const { items, source, setSource, setQuery, loading, loadMore, cursor, reload } =
    useFeed();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [view, setView] = useState<"feed" | "settings">("feed");
  const [expandAll, setExpandAll] = useState(false);
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ item: FeedItem } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasChat = items.some((i) => i.source === "kakaotalk" || i.source === "telegram");
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleDismiss = useCallback((item: FeedItem) => {
    // Cancel previous pending dismiss
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      // Execute previous dismiss immediately
      if (toast) {
        dismissFeedItem(toast.item.source, toast.item.id);
      }
    }

    // Hide from UI immediately
    const key = `${item.source}-${item.id}`;
    setDismissedItems((prev) => new Set(prev).add(key));
    setToast({ item });

    // Schedule server dismiss
    dismissTimer.current = setTimeout(() => {
      dismissFeedItem(item.source, item.id);
      setToast(null);
      dismissTimer.current = null;
    }, UNDO_DELAY);
  }, [toast]);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    const key = `${toast.item.source}-${toast.item.id}`;
    setDismissedItems((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setToast(null);
  }, [toast]);

  const visibleItems = items.filter((i) => !dismissedItems.has(`${i.source}-${i.id}`));

  // Keyboard shortcuts
  useEffect(() => {
    if (view !== "feed") return;

    const handler = (e: KeyboardEvent) => {
      // Don't handle when typing in input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Use e.code for IME-independent key detection (works in Korean mode)
      const code = e.code;

      if (code === "KeyJ") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, visibleItems.length - 1));
        setExpandedIndex(null);
      } else if (code === "KeyK") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        setExpandedIndex(null);
      } else if (e.key === "Enter" || code === "KeyO") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
          setExpandedIndex((prev) => (prev === focusedIndex ? null : focusedIndex));
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setExpandedIndex(null);
      } else if (code === "KeyD" || code === "KeyX") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
          handleDismiss(visibleItems[focusedIndex]);
          if (focusedIndex >= visibleItems.length - 1) {
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
          }
          setExpandedIndex(null);
        }
      } else if (code === "KeyV") {
        if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
          const url = visibleItems[focusedIndex].url;
          if (url) {
            e.preventDefault();
            window.open(url, "_blank");
          }
        }
      } else if (code >= "Digit1" && code <= "Digit9") {
        const tabIndex = parseInt(code.charAt(5), 10) - 1;
        if (tabIndex < SOURCES.length) {
          e.preventDefault();
          setSource(SOURCES[tabIndex].key as string | undefined);
          setFocusedIndex(-1);
          setExpandedIndex(null);
        }
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [view, focusedIndex, visibleItems, handleDismiss]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = (await triggerSync()) as { results?: Record<string, number> };
      const total = res.results
        ? Object.values(res.results).reduce((a, b) => a + b, 0)
        : 0;
      setSyncResult(`${total}개 항목 동기화 완료`);
      reload();
    } catch {
      setSyncResult("동기화 실패");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 3000);
    }
  };

  if (view === "settings") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <SettingsPage onBack={() => { setView("feed"); reload(); }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24 }}>feedhub</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {syncResult && (
            <span
              style={{
                fontSize: 13,
                color: syncResult.includes("실패") ? "#EA4335" : "#34A853",
              }}
            >
              {syncResult}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: "8px 16px",
              background: syncing ? "#93b5f1" : "#4285F4",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: syncing ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <span
            onClick={() => setView("settings")}
            style={{ fontSize: 20, cursor: "pointer" }}
          >
            ⚙️
          </span>
        </div>
      </div>
      <SearchBar onSearch={setQuery} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SourceFilter current={source} onChange={setSource} />
        {hasChat && (
          <button
            onClick={() => setExpandAll(!expandAll)}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: 20,
              background: expandAll ? "#4285F4" : "#fff",
              color: expandAll ? "#fff" : "#333",
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
              marginBottom: 16,
            }}
          >
            {expandAll ? "▲ Collapse" : "▼ Expand All"}
          </button>
        )}
      </div>
      <FeedList
        items={visibleItems}
        loading={loading}
        onLoadMore={loadMore}
        hasMore={!!cursor}
        expandAll={expandAll}
        onDelete={handleDismiss}
        focusedIndex={focusedIndex}
        expandedIndex={expandedIndex}
        onToggleExpand={(i) => setExpandedIndex((prev) => (prev === i ? null : i))}
      />
      {toast && (
        <Toast
          message={toast.item.source === "gmail" ? "메일을 휴지통으로 이동합니다" : "피드에서 숨겼습니다"}
          onUndo={handleUndo}
        />
      )}
    </div>
  );
}

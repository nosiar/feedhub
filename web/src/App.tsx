import { useState } from "react";
import { useFeed } from "./hooks/useFeed.js";
import { SourceFilter } from "./components/SourceFilter.js";
import { SearchBar } from "./components/SearchBar.js";
import { FeedList } from "./components/FeedList.js";
import { triggerSync } from "./api.js";

export function App() {
  const { items, source, setSource, setQuery, loading, loadMore, cursor, reload } =
    useFeed();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await triggerSync() as { results?: Record<string, number> };
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
            <span style={{ fontSize: 13, color: syncResult.includes("실패") ? "#EA4335" : "#34A853" }}>
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
        </div>
      </div>
      <SearchBar onSearch={setQuery} />
      <SourceFilter current={source} onChange={setSource} />
      <FeedList
        items={items}
        loading={loading}
        onLoadMore={loadMore}
        hasMore={!!cursor}
      />
    </div>
  );
}

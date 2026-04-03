import { useFeed } from "./hooks/useFeed.js";
import { SourceFilter } from "./components/SourceFilter.js";
import { SearchBar } from "./components/SearchBar.js";
import { FeedList } from "./components/FeedList.js";
import { triggerSync } from "./api.js";

export function App() {
  const { items, source, setSource, setQuery, loading, loadMore, cursor, reload } =
    useFeed();

  const handleSync = async () => {
    await triggerSync();
    reload();
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
        <button
          onClick={handleSync}
          style={{
            padding: "8px 16px",
            background: "#4285F4",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sync
        </button>
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

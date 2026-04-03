import { useState } from "react";
import type { RssFeed } from "../api.js";
import { fetchRssTitle } from "../api.js";

export function RssFeedManager({
  feeds,
  onChange,
}: {
  feeds: RssFeed[];
  onChange: (feeds: RssFeed[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      const title = await fetchRssTitle(url.trim());
      onChange([...feeds, { url: url.trim(), title }]);
      setUrl("");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onChange(feeds.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding: 16, borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>📰 RSS Feeds</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {feeds.map((feed, i) => (
          <div key={feed.url} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8f9fa", borderRadius: 6 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{feed.title || feed.url}</div>
              {feed.title && <div style={{ fontSize: 11, color: "#999" }}>{feed.url}</div>}
            </div>
            <span onClick={() => handleRemove(i)} style={{ color: "#EA4335", cursor: "pointer", fontSize: 11 }}>삭제</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="RSS feed URL을 입력하세요" style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }} />
        <button onClick={handleAdd} disabled={adding} style={{ padding: "8px 14px", background: adding ? "#93b5f1" : "#4285F4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: adding ? "not-allowed" : "pointer" }}>
          {adding ? "..." : "추가"}
        </button>
      </div>
    </div>
  );
}

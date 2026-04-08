import { useState } from "react";
import type { YouTubeChannel } from "../api.js";
import { resolveYouTubeChannel } from "../api.js";

export function YouTubeChannelManager({
  channels,
  onChange,
}: {
  channels: YouTubeChannel[];
  onChange: (channels: YouTubeChannel[]) => void;
}) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!input.trim()) return;
    setAdding(true);
    setError("");
    try {
      const channel = await resolveYouTubeChannel(input.trim());
      if (channels.some((c) => c.channelId === channel.channelId)) {
        setError("이미 추가된 채널입니다");
        return;
      }
      onChange([...channels, channel]);
      setInput("");
    } catch {
      setError("채널을 찾을 수 없습니다");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onChange(channels.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding: 16, borderBottom: "1px solid #f0f0f0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 15, margin: 0 }}>▶ YouTube Channels</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {channels.map((ch, i) => (
          <div
            key={ch.channelId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              background: "#f8f9fa",
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{ch.name}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{ch.channelId}</div>
            </div>
            <span
              onClick={() => handleRemove(i)}
              style={{ color: "#EA4335", cursor: "pointer", fontSize: 11 }}
            >
              삭제
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="채널 URL 또는 채널 ID"
          style={{
            flex: 1,
            padding: 8,
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{
            padding: "8px 14px",
            background: adding ? "#93b5f1" : "#4285F4",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            cursor: adding ? "not-allowed" : "pointer",
          }}
        >
          {adding ? "..." : "추가"}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#EA4335" }}>
          {error}
        </div>
      )}
    </div>
  );
}

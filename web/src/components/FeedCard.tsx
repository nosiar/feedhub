import { useState } from "react";
import type { FeedItem } from "../api.js";
import { fetchChatMessages } from "../api.js";

const SOURCE_ICONS: Record<string, string> = {
  gmail: "\u{1F4E7}",
  kakaotalk: "\u{1F4AC}",
  slack: "\u{1F4AC}",
  rss: "\u{1F4F0}",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function ChatThread({ messages }: { messages: FeedItem[] }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        background: "#f8f9fa",
        borderRadius: 8,
        maxHeight: 400,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {messages.map((msg) => (
        <div key={msg.id} style={{ fontSize: 13 }}>
          <span style={{ color: "#4285F4", fontWeight: 500 }}>
            {msg.author || "unknown"}
          </span>
          <span style={{ color: "#999", marginLeft: 6, fontSize: 11 }}>
            {formatTime(msg.timestamp)}
          </span>
          <div style={{ color: "#333", marginTop: 2, whiteSpace: "pre-wrap" }}>
            {msg.body}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedCard({ item }: { item: FeedItem }) {
  const icon = SOURCE_ICONS[item.source] ?? "\u{1F4CB}";
  const isKakao = item.source === "kakaotalk";
  const [expanded, setExpanded] = useState(false);
  const [thread, setThread] = useState<FeedItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!thread) {
      setLoading(true);
      try {
        const chatId = item.metadata.chatId as string;
        const res = await fetchChatMessages(chatId);
        setThread(res.items.reverse());
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  return (
    <div
      onClick={isKakao ? handleExpand : undefined}
      style={{
        padding: 16,
        background: "#fff",
        borderRadius: 8,
        marginBottom: 8,
        border: expanded ? "1px solid #4285F4" : "1px solid #e0e0e0",
        cursor: isKakao ? "pointer" : "default",
        transition: "border-color 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 12,
          color: "#5f6368",
        }}
      >
        <span>
          {icon} {isKakao ? item.title : item.source}
          {item.author ? ` · ${item.author}` : ""}
        </span>
        <span>
          {isKakao && (expanded ? "▲" : "▼")} {timeAgo(item.timestamp)}
        </span>
      </div>
      {!isKakao && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1a73e8", textDecoration: "none" }}
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </div>
      )}
      {!expanded && (
        <div
          style={{
            fontSize: 14,
            color: "#3c4043",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.body}
        </div>
      )}
      {isKakao && expanded && loading && (
        <div style={{ padding: 12, color: "#999", fontSize: 13 }}>로딩 중...</div>
      )}
      {isKakao && expanded && thread && <ChatThread messages={thread} />}
    </div>
  );
}

import { useState, type MouseEvent, type ReactNode } from "react";
import type { FeedItem } from "../api.js";
import { fetchChatMessages } from "../api.js";

const SOURCE_ICONS: Record<string, string> = {
  gmail: "\u{1F4E7}",
  kakaotalk: "\u{1F4AC}",
  slack: "\u{1F4AC}",
  rss: "\u{1F4F0}",
};

const URL_RE = /(https?:\/\/[^\s]+)/g;

function Linkify({ text }: { text: string }): ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    URL_RE.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{ color: "#1a73e8", textDecoration: "underline" }}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

function ImageGallery({ urls, compact }: { urls: string[]; compact?: boolean }) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const maxShow = compact ? 3 : urls.length;
  const visible = urls.slice(0, maxShow);
  const remaining = urls.length - maxShow;

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        marginTop: 4,
      }}
      onClick={(e: MouseEvent) => e.stopPropagation()}
    >
      {visible.map((url, i) =>
        failedUrls.has(url) ? (
          <span
            key={i}
            style={{
              padding: "8px 12px",
              background: "#f0f0f0",
              borderRadius: 6,
              fontSize: 12,
              color: "#999",
            }}
          >
            📷 만료됨
          </span>
        ) : (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt=""
              onError={() => setFailedUrls((prev) => new Set(prev).add(url))}
              style={{
                maxWidth: compact ? 80 : 300,
                maxHeight: compact ? 80 : 300,
                borderRadius: 6,
                objectFit: "cover",
                display: "block",
              }}
            />
          </a>
        )
      )}
      {remaining > 0 && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: 12,
            color: "#999",
          }}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

function getImageUrls(item: FeedItem): string[] {
  const urls = item.metadata?.imageUrls;
  if (Array.isArray(urls) && urls.length > 0) return urls as string[];
  return [];
}

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

function MessageBody({ item, compact }: { item: FeedItem; compact?: boolean }) {
  const images = getImageUrls(item);
  const isPhotoOnly =
    images.length > 0 && (!item.body || item.body === "사진" || item.body.match(/^사진 \d+장$/));

  if (isPhotoOnly) {
    return <ImageGallery urls={images} compact={compact} />;
  }

  return (
    <>
      <div style={{ whiteSpace: compact ? undefined : "pre-wrap" }}>
        <Linkify text={item.body ?? ""} />
      </div>
      {images.length > 0 && <ImageGallery urls={images} compact={compact} />}
    </>
  );
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
          <div style={{ color: "#333", marginTop: 2 }}>
            <MessageBody item={msg} />
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
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
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
          {isKakao ? <MessageBody item={item} compact /> : item.body}
        </div>
      )}
      {isKakao && expanded && loading && (
        <div style={{ padding: 12, color: "#999", fontSize: 13 }}>로딩 중...</div>
      )}
      {isKakao && expanded && thread && <ChatThread messages={thread} />}
    </div>
  );
}

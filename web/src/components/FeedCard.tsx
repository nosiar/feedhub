import type { FeedItem } from "../api.js";

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

export function FeedCard({ item }: { item: FeedItem }) {
  const icon = SOURCE_ICONS[item.source] ?? "\u{1F4CB}";
  return (
    <div
      style={{
        padding: 16,
        background: "#fff",
        borderRadius: 8,
        marginBottom: 8,
        border: "1px solid #e0e0e0",
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
          {icon} {item.source === "kakaotalk" ? item.title : item.source}
          {item.author ? ` · ${item.author}` : ""}
        </span>
        <span>{timeAgo(item.timestamp)}</span>
      </div>
      {item.source !== "kakaotalk" && (
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
    </div>
  );
}

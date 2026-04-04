import { useState, useEffect, useCallback, type MouseEvent, type ReactNode } from "react";
import type { FeedItem } from "../api.js";
import { fetchOgPreview, fetchGmailBody } from "../api.js";

// --- Chat-like sources: kakaotalk, telegram (expand to show full content) ---
const CHAT_SOURCES = new Set(["kakaotalk", "telegram"]);

function Lightbox({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);

  const prev = useCallback(() => setCurrent((c) => (c > 0 ? c - 1 : urls.length - 1)), [urls.length]);
  const next = useCallback(() => setCurrent((c) => (c < urls.length - 1 ? c + 1 : 0)), [urls.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      {urls.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            fontSize: 28, width: 44, height: 44, borderRadius: 22, cursor: "pointer",
          }}
        >
          ‹
        </button>
      )}
      <img
        src={urls[current]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
      />
      {urls.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            fontSize: 28, width: 44, height: 44, borderRadius: 22, cursor: "pointer",
          }}
        >
          ›
        </button>
      )}
      <span style={{ position: "absolute", top: 16, right: 20, color: "#fff", fontSize: 12, opacity: 0.7 }}>
        {current + 1} / {urls.length} · ESC to close
      </span>
    </div>
  );
}

const SOURCE_ICONS: Record<string, string> = {
  gmail: "\u{1F4E7}",
  kakaotalk: "\u{1F4AC}",
  slack: "\u{1F4AC}",
  rss: "\u{1F4F0}",
  telegram: "\u{2708}\u{FE0F}",
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const maxShow = compact ? 3 : urls.length;
  const visible = urls.slice(0, maxShow);
  const remaining = urls.length - maxShow;

  return (
    <>
      <div
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {visible.map((url, i) =>
          failedUrls.has(url) ? (
            <span key={i} style={{ padding: "8px 12px", background: "#f0f0f0", borderRadius: 6, fontSize: 12, color: "#999" }}>
              📷 만료됨
            </span>
          ) : (
            <img
              key={i}
              src={url}
              alt=""
              onClick={() => setLightboxIndex(i)}
              onError={() => setFailedUrls((prev) => new Set(prev).add(url))}
              style={{
                width: compact ? 80 : 200, height: compact ? 80 : 200,
                borderRadius: 6, objectFit: "cover", display: "block", cursor: "pointer",
              }}
            />
          )
        )}
        {remaining > 0 && (
          <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontSize: 12, color: "#999" }}>
            +{remaining}
          </span>
        )}
      </div>
      {lightboxIndex !== null && (
        <Lightbox urls={urls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}

const SHIMMER_CSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;

function ImageShimmer() {
  return (
    <>
      <div style={{ width: "100%", height: 120, background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <style>{SHIMMER_CSS}</style>
    </>
  );
}

function LinkPreviewCard({
  preview,
  imageLoading,
}: {
  preview: { title: string; description: string; imageUrl: string; url: string };
  imageLoading?: boolean;
}) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e: MouseEvent) => e.stopPropagation()}
      style={{ textDecoration: "none", color: "inherit", display: "block", marginTop: 6 }}
    >
      <div style={{ border: "1px solid #e0e0e0", borderRadius: 10, overflow: "hidden", background: "#fafafa", maxWidth: 320 }}>
        {preview.imageUrl ? (
          <img src={preview.imageUrl} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block", background: "#f0f0f0" }} />
        ) : imageLoading ? (
          <ImageShimmer />
        ) : null}
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "#202124" }}>{preview.title}</div>
          {preview.description && (
            <div style={{ fontSize: 12, color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {preview.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
            {(() => { try { return new URL(preview.url).hostname; } catch { return preview.url; } })()}
          </div>
        </div>
      </div>
    </a>
  );
}

function getLinkPreview(item: FeedItem): { title: string; description: string; imageUrl: string; url: string } | null {
  const p = item.metadata?.linkPreview;
  if (p && typeof p === "object" && "title" in p && (p as { title: string }).title) {
    return p as { title: string; description: string; imageUrl: string; url: string };
  }
  return null;
}

function getImageUrls(item: FeedItem): string[] {
  const urls = item.metadata?.imageUrls;
  if (Array.isArray(urls) && urls.length > 0) return urls as string[];
  return [];
}

function getPhotoUrl(item: FeedItem): string | null {
  return (item.metadata?.photoUrl as string) ?? null;
}

/** Render markdown-like formatting: **bold** and __italic__ */
function MarkdownText({ text }: { text: string }): ReactNode {
  // Split by **bold** patterns, then linkify each part
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}><Linkify text={part.slice(2, -2)} /></strong>;
    }
    return <Linkify key={i} text={part} />;
  });
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

function extractFirstUrl(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s]+)/);
  return match?.[1] ?? null;
}

/** Shared message body for chat-like sources (kakaotalk, telegram) */
function MessageBody({ item, compact }: { item: FeedItem; compact?: boolean }) {
  const images = getImageUrls(item);
  const photoUrl = getPhotoUrl(item);
  const isTelegram = item.source === "telegram";
  const storedPreview = getLinkPreview(item);
  const [fetchedPreview, setFetchedPreview] = useState<{
    title: string; description: string; imageUrl: string; url: string;
  } | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [ogDone, setOgDone] = useState(false);

  const needsOgFetch = !compact && (!storedPreview || !storedPreview.imageUrl);
  const preview = storedPreview && storedPreview.imageUrl
    ? storedPreview
    : fetchedPreview
      ? { ...(storedPreview ?? {}), ...fetchedPreview }
      : storedPreview;
  const bodyUrl = needsOgFetch ? extractFirstUrl(item.body ?? "") : null;
  const showSkeleton = !compact && !!bodyUrl && !preview && ogLoading;

  useEffect(() => {
    if (!bodyUrl || ogDone) return;
    setOgLoading(true);
    setOgDone(true);
    fetchOgPreview(bodyUrl).then((p) => { if (p) setFetchedPreview(p); }).finally(() => setOgLoading(false));
  }, [bodyUrl, ogDone]);

  const isPhotoOnly =
    images.length > 0 && (!item.body || item.body === "사진" || item.body.match(/^사진 \d+장$/));

  if (isPhotoOnly) {
    return <ImageGallery urls={images} compact={compact} />;
  }

  const TextContent = isTelegram ? MarkdownText : Linkify;

  return (
    <>
      <div style={{ whiteSpace: compact ? undefined : "pre-wrap" }}>
        <TextContent text={item.body ?? ""} />
      </div>
      {images.length > 0 && <ImageGallery urls={images} compact={compact} />}
      {photoUrl && (
        <div style={{ marginTop: 6 }} onClick={(e: MouseEvent) => e.stopPropagation()}>
          <img
            src={photoUrl}
            alt=""
            style={{ maxWidth: 400, maxHeight: 300, borderRadius: 8, display: "block" }}
          />
        </div>
      )}
      {preview && !compact && <LinkPreviewCard preview={preview} imageLoading={ogLoading} />}
      {showSkeleton && (
        <div style={{ marginTop: 6, maxWidth: 320, border: "1px solid #e0e0e0", borderRadius: 10, overflow: "hidden", background: "#fafafa" }}>
          <ImageShimmer />
          <div style={{ padding: "10px 12px" }}>
            <div style={{ height: 14, width: "70%", background: "#e8e8e8", borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 10, width: "90%", background: "#f0f0f0", borderRadius: 4 }} />
          </div>
        </div>
      )}
    </>
  );
}

/** Compact media only (images/photos, no text) for collapsed cards */
function CompactMedia({ item }: { item: FeedItem }) {
  const images = getImageUrls(item);
  const photoUrl = getPhotoUrl(item);
  const unsupported = item.metadata?.unsupportedMedia;
  const isPhotoOnly =
    images.length > 0 && (!item.body || item.body === "사진" || item.body.match(/^사진 \d+장$/));

  return (
    <>
      {(isPhotoOnly || images.length > 0) && <ImageGallery urls={images} compact />}
      {photoUrl && (
        <div style={{ marginTop: 4 }} onClick={(e: MouseEvent) => e.stopPropagation()}>
          <img src={photoUrl} alt="" style={{ width: 80, height: 80, borderRadius: 6, objectFit: "cover", display: "block" }} />
        </div>
      )}
      {unsupported && (
        <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", background: "#f0f0f0", borderRadius: 4, fontSize: 11, color: "#999" }}>
          미지원 미디어 (투표 등)
        </span>
      )}
    </>
  );
}

export function FeedCard({ item, defaultExpanded, onDelete, focused, expanded: expandedProp, cardRef, onToggleExpand }: {
  item: FeedItem;
  defaultExpanded?: boolean;
  onDelete?: (item: FeedItem) => void;
  focused?: boolean;
  expanded?: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  onToggleExpand?: () => void;
}) {
  const icon = SOURCE_ICONS[item.source] ?? "\u{1F4CB}";
  const isChat = CHAT_SOURCES.has(item.source);
  const isGmail = item.source === "gmail";
  const isExpandable = isChat || isGmail;

  const expanded = expandedProp ?? (isChat && !!defaultExpanded);
  const [gmailBody, setGmailBody] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  // Fetch Gmail body when expanded
  useEffect(() => {
    if (expanded && isGmail && !gmailBody && !gmailLoading) {
      setGmailLoading(true);
      fetchGmailBody(item.id).then(setGmailBody).finally(() => setGmailLoading(false));
    }
  }, [expanded, isGmail, gmailBody, gmailLoading, item.id]);

  const handleDismiss = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete?.(item);
  };

  const handleClick = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    onToggleExpand?.();
  };

  // Header: chat sources show chat name, others show source type
  const headerLabel = isChat ? item.title : item.source;

  return (
    <div
      ref={cardRef}
      onClick={isExpandable ? handleClick : undefined}
      style={{
        padding: 16, background: focused ? "#f0f6ff" : "#fff", borderRadius: 8, marginBottom: 8,
        border: expanded ? "1px solid #4285F4" : focused ? "1px solid #90b8f8" : "1px solid #e0e0e0",
        cursor: isExpandable ? "pointer" : "default",
        transition: "all 0.15s",
        outline: "none",
      }}
    >
      {/* Top row: source + author | dismiss + expand + time */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#5f6368" }}>
        <span>
          {icon} {headerLabel}
          {item.author ? ` · ${item.author}` : ""}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            onClick={handleDismiss}
            style={{ cursor: "pointer", opacity: 0.6, fontSize: 14 }}
            title={isGmail ? "휴지통으로 이동" : "피드에서 숨기기"}
          >
            ✕
          </span>
          {isExpandable && (expanded ? "▲" : "▼")}{" "}
          <span title={new Date(item.timestamp).toLocaleString("ko-KR", { hour12: false })}>{timeAgo(item.timestamp)}</span>
        </span>
      </div>

      {/* Title row: non-chat sources show clickable title */}
      {!isChat && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e: MouseEvent) => e.stopPropagation()} style={{ color: "#1a73e8", textDecoration: "none" }}>
              {item.title}
            </a>
          ) : item.title}
        </div>
      )}

      {/* Body */}
      {isGmail && expanded ? (
        gmailLoading ? (
          <div style={{ padding: 12, color: "#999", fontSize: 13 }}>로딩 중...</div>
        ) : gmailBody ? (
          <div
            key="gmail-shadow"
            ref={(el) => {
              if (!el || el.shadowRoot) return;
              const shadow = el.attachShadow({ mode: "open" });
              const wrapper = document.createElement("div");
              wrapper.tabIndex = 0;
              wrapper.style.cssText = "font-size:14px;color:#3c4043;line-height:1.6;outline:none;overflow:auto;max-height:80vh;";
              wrapper.innerHTML = gmailBody;
              shadow.appendChild(wrapper);
              wrapper.focus();
            }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            style={{ outline: "none" }}
          />
        ) : null
      ) : isChat && expanded ? (
        <div style={{ fontSize: 14, color: "#3c4043", whiteSpace: "pre-wrap" }}>
          <MessageBody item={item} />
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "#3c4043" }}>
          <div style={{
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {isChat ? <Linkify text={item.body ?? ""} /> : item.body}
          </div>
          {isChat && <CompactMedia item={item} />}
        </div>
      )}
    </div>
  );
}

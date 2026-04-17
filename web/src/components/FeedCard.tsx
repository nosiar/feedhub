import { useState, useEffect, useCallback, type MouseEvent, type ReactNode } from "react";
import type { FeedItem } from "../api.js";
import { fetchOgPreview, fetchGmailBody, fetchNaverBody, fetchPollResults, fetchReplies, type PollResult, type ReplyItem } from "../api.js";

// --- Chat-like sources: kakaotalk, telegram (expand to show full content) ---
const CHAT_SOURCES = new Set(["kakaotalk", "telegram"]);

const EMAIL_SOURCES = new Set(["gmail", "naver"]);

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
  naver: "\u{1F4E9}",
  kakaotalk: "\u{1F4AC}",
  slack: "\u{1F4AC}",
  rss: "\u{1F4F0}",
  telegram: "\u{2708}\u{FE0F}",
  youtube: "\u{25B6}\u{FE0F}",
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
          <img src={preview.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block", background: "#f0f0f0" }} />
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

function getVideoUrl(item: FeedItem): string | null {
  return (item.metadata?.videoUrl as string) ?? null;
}

function getVideoPosterUrl(item: FeedItem): string | null {
  return (item.metadata?.videoPosterUrl as string) ?? null;
}

function getReplies(item: FeedItem): { replyCount: number; repliesUrl: string } | null {
  const count = item.metadata?.replyCount as number | undefined;
  const url = item.metadata?.repliesUrl as string | undefined;
  if (url && typeof count === "number") return { replyCount: count, repliesUrl: url };
  return null;
}

function getFileAttachment(item: FeedItem): { fileName: string; fileSize: number; mimeType: string; fileUrl: string } | null {
  const f = item.metadata?.fileAttachment;
  if (f && typeof f === "object" && "fileUrl" in f) return f as { fileName: string; fileSize: number; mimeType: string; fileUrl: string };
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPoll(item: FeedItem): { question: string; answers: string[]; pollUrl: string } | null {
  const poll = item.metadata?.poll as { question: string; answers: string[] } | undefined;
  const pollUrl = item.metadata?.pollUrl as string | undefined;
  if (poll && pollUrl) return { ...poll, pollUrl };
  return null;
}

function getYouTubeMeta(item: FeedItem): { videoId: string; thumbnail: string; views?: number } | null {
  if (item.source !== "youtube") return null;
  const videoId = item.metadata?.videoId as string | undefined;
  const thumbnail = item.metadata?.thumbnail as string | undefined;
  if (!videoId || !thumbnail) return null;
  const views = item.metadata?.views as number | undefined;
  return { videoId, thumbnail, ...(views !== undefined ? { views } : {}) };
}

function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return String(n);
}

function PollCard({ pollUrl, poll, expanded }: {
  pollUrl: string;
  poll: { question: string; answers: string[] };
  expanded?: boolean;
}) {
  const [results, setResults] = useState<PollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!expanded || fetched) return;
    setFetched(true);
    setLoading(true);
    fetchPollResults(pollUrl).then(setResults).finally(() => setLoading(false));
  }, [expanded, fetched, pollUrl]);

  const answers = results?.answers ?? poll.answers.map((text) => ({ text, voters: 0 }));
  const totalVoters = results?.totalVoters ?? 0;
  const hasResults = totalVoters > 0;

  return (
    <div
      onClick={(e: MouseEvent) => e.stopPropagation()}
      style={{ marginTop: 8, padding: 12, background: "#f8f9fa", borderRadius: 10, border: "1px solid #e0e0e0", maxWidth: 360 }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
        📊 {results?.question ?? poll.question}
      </div>
      {answers.map((a, i) => {
        const pct = hasResults ? Math.round((a.voters / totalVoters) * 100) : 0;
        return (
          <div key={i} style={{ marginBottom: 4, position: "relative" }}>
            {hasResults && (
              <div style={{
                position: "absolute", top: 0, left: 0, height: "100%",
                width: `${pct}%`, background: "#e8f0fe", borderRadius: 6, transition: "width 0.3s",
              }} />
            )}
            <div style={{ position: "relative", padding: "6px 10px", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
              <span>{a.text}</span>
              {hasResults && <span style={{ color: "#5f6368", fontSize: 12 }}>{pct}%</span>}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
        {loading ? "결과 불러오는 중..." : hasResults ? `👥 ${totalVoters}명 투표` : "투표 결과 없음"}
        {results?.closed && " · 마감됨"}
      </div>
    </div>
  );
}

function ReplyQuote({ replyTo }: { replyTo: { msgId: number; text: string; author: string } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={(e: MouseEvent) => { e.stopPropagation(); setExpanded((v) => !v); }}
      style={{
        borderLeft: "2px solid #dadce0", paddingLeft: 8, marginBottom: 4,
        fontSize: 12, color: "#5f6368", cursor: "pointer",
        ...(!expanded ? {
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        } : { whiteSpace: "pre-wrap" }),
      }}
    >
      <span style={{ fontWeight: 600, marginRight: 4 }}>{replyTo.author || "익명"}</span>
      {replyTo.text}
    </div>
  );
}

function RepliesSection({ repliesUrl, expanded }: { repliesUrl: string; expanded?: boolean }) {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!expanded || fetched) return;
    setFetched(true);
    setLoading(true);
    fetchReplies(repliesUrl).then((res) => {
      setReplies(res.replies);
      setHasMore(res.hasMore);
    }).finally(() => setLoading(false));
  }, [expanded, fetched, repliesUrl]);

  const loadAll = useCallback(async () => {
    if (loading || !hasMore || replies.length === 0) return;
    setLoading(true);
    let all = [...replies];
    let offsetId = all[all.length - 1].id;
    let more = true;
    while (more) {
      const res = await fetchReplies(repliesUrl, offsetId);
      all = [...all, ...res.replies];
      more = res.hasMore;
      if (res.replies.length > 0) offsetId = res.replies[res.replies.length - 1].id;
    }
    setReplies(all);
    setHasMore(false);
    setLoading(false);
  }, [repliesUrl, replies, hasMore, loading]);

  if (!expanded || (!fetched && replies.length === 0)) return null;

  return (
    <div
      onClick={(e: MouseEvent) => e.stopPropagation()}
      style={{ marginTop: 10, borderTop: "1px solid #e0e0e0", paddingTop: 8 }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#5f6368", marginBottom: 6 }}>
        💬 댓글
      </div>
      {replies.map((r) => (
        <div key={r.id} style={{
          marginBottom: 6, fontSize: 13,
          ...(r.isChannel ? { background: "#f0f6ff", padding: "6px 8px", borderRadius: 6, borderLeft: "3px solid #4285F4" } : {}),
        }}>
          {r.replyTo && <ReplyQuote replyTo={r.replyTo} />}
          <span style={{ fontWeight: 600, color: r.isChannel ? "#4285F4" : "#1a73e8", marginRight: 6 }}>
            {r.isChannel ? `📢 ${r.author}` : (r.author || "익명")}
          </span>
          <span style={{ color: "#3c4043", whiteSpace: "pre-wrap" }}>{r.text}</span>
          {r.photoUrl && (
            <div style={{ marginTop: 4 }}>
              <img
                src={r.photoUrl}
                alt=""
                style={{ maxWidth: 300, maxHeight: 300, borderRadius: 6, display: "block", cursor: "pointer" }}
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  window.open(r.photoUrl, "_blank");
                }}
              />
            </div>
          )}
        </div>
      ))}
      {loading && <div style={{ fontSize: 12, color: "#999" }}>불러오는 중...</div>}
      {hasMore && !loading && (
        <button
          onClick={loadAll}
          style={{
            background: "none", border: "none", color: "#1a73e8",
            fontSize: 12, cursor: "pointer", padding: "4px 0",
          }}
        >
          더 보기
        </button>
      )}
    </div>
  );
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
  const videoUrl = getVideoUrl(item);
  const videoPosterUrl = getVideoPosterUrl(item);
  const poll = getPoll(item);
  const fileAttachment = getFileAttachment(item);
  const repliesInfo = getReplies(item);
  const allUrls = [...images, ...(photoUrl ? [photoUrl] : [])];
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
    allUrls.length > 0 && (!item.body || item.body === "사진" || item.body.match(/^사진 \d+장$/));

  if (isPhotoOnly) {
    return <ImageGallery urls={allUrls} />;
  }

  const TextContent = isTelegram ? MarkdownText : Linkify;

  return (
    <>
      <div style={{ whiteSpace: compact ? undefined : "pre-wrap" }}>
        <TextContent text={item.body ?? ""} />
      </div>
      {videoUrl && (
        <div style={{ marginTop: 6 }} onClick={(e: MouseEvent) => e.stopPropagation()}>
          <video
            src={videoUrl}
            controls
            preload="metadata"
            poster={videoPosterUrl ?? undefined}
            style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, display: "block" }}
          />
        </div>
      )}
      {fileAttachment && (
        <a
          href={fileAttachment.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e: MouseEvent) => e.stopPropagation()}
          style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "10px 12px",
            background: "#f8f9fa", borderRadius: 8, border: "1px solid #e0e0e0",
            textDecoration: "none", color: "inherit", maxWidth: 360,
          }}
        >
          <span style={{ fontSize: 24 }}>📎</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#202124", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fileAttachment.fileName}
            </div>
            <div style={{ fontSize: 11, color: "#5f6368" }}>
              {formatFileSize(fileAttachment.fileSize)}
            </div>
          </div>
          <span style={{ fontSize: 18, color: "#1a73e8" }}>⬇</span>
        </a>
      )}
      {poll && <PollCard pollUrl={poll.pollUrl} poll={poll} expanded={!compact} />}
      {allUrls.length > 0 && <ImageGallery urls={allUrls} />}
      {repliesInfo && repliesInfo.replyCount > 0 && (
        <RepliesSection repliesUrl={repliesInfo.repliesUrl} expanded={!compact} />
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
  const videoUrl = getVideoUrl(item);
  const poll = getPoll(item);
  const fileAttachment = getFileAttachment(item);
  const repliesInfo = getReplies(item);
  const unsupported = item.metadata?.unsupportedMedia;
  const allUrls = [...images, ...(photoUrl ? [photoUrl] : [])];

  return (
    <>
      {videoUrl && (
        <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", background: "#e8f0fe", borderRadius: 4, fontSize: 11, color: "#1a73e8" }}>
          🎬 영상
        </span>
      )}
      {fileAttachment && (
        <span style={{ display: "inline-block", marginTop: 4, marginLeft: videoUrl ? 4 : 0, padding: "2px 8px", background: "#e8f5e9", borderRadius: 4, fontSize: 11, color: "#2e7d32" }}>
          📎 {fileAttachment.fileName}
        </span>
      )}
      {poll && (
        <span style={{ display: "inline-block", marginTop: 4, marginLeft: videoUrl ? 4 : 0, padding: "2px 8px", background: "#fef7e0", borderRadius: 4, fontSize: 11, color: "#b5880a" }}>
          📊 투표
        </span>
      )}
      {repliesInfo && repliesInfo.replyCount > 0 && (
        <span style={{ display: "inline-block", marginTop: 4, marginLeft: (videoUrl || poll) ? 4 : 0, padding: "2px 8px", background: "#f0f0f0", borderRadius: 4, fontSize: 11, color: "#5f6368" }}>
          💬 {repliesInfo.replyCount}
        </span>
      )}
      {allUrls.length > 0 && <ImageGallery urls={allUrls} compact />}
      {unsupported && (
        <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", background: "#f0f0f0", borderRadius: 4, fontSize: 11, color: "#999" }}>
          미지원 미디어 (투표 등)
        </span>
      )}
    </>
  );
}

export function FeedCard({ item, defaultExpanded, onDelete, onTogglePin, focused, expanded: expandedProp, cardRef, onToggleExpand }: {
  item: FeedItem;
  defaultExpanded?: boolean;
  onDelete?: (item: FeedItem) => void;
  onTogglePin?: (item: FeedItem) => void;
  focused?: boolean;
  expanded?: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  onToggleExpand?: () => void;
}) {
  const icon = SOURCE_ICONS[item.source] ?? "\u{1F4CB}";
  const isChat = CHAT_SOURCES.has(item.source);
  const isEmail = EMAIL_SOURCES.has(item.source);
  const isExpandable = isChat || isEmail;

  const expanded = expandedProp ?? (isChat && !!defaultExpanded);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Fetch email body when expanded
  useEffect(() => {
    if (expanded && isEmail && !emailBody && !emailLoading) {
      setEmailLoading(true);
      const fetchBody = item.source === "naver" ? fetchNaverBody : fetchGmailBody;
      fetchBody(item.id).then(setEmailBody).finally(() => setEmailLoading(false));
    }
  }, [expanded, isEmail, emailBody, emailLoading, item.id, item.source]);

  const handleDismiss = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete?.(item);
  };

  const handleTogglePin = (e: MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.(item);
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
        overflow: "hidden", wordBreak: "break-word" as const,
        outline: "none",
      }}
    >
      {/* Top row: source + author | dismiss + expand + time */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#5f6368" }}>
        <span>
          {icon} {headerLabel}
          {item.author ? ` · ${item.author}` : ""}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            onClick={handleTogglePin}
            aria-label={item.pinned ? "고정 해제" : "고정"}
            title={item.pinned ? "고정 해제" : "고정"}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              minWidth: 44,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: item.pinned ? 1 : 0.5,
              fontSize: 14,
              lineHeight: 1,
              color: "inherit",
              filter: item.pinned ? "none" : "grayscale(1)",
            }}
          >
            📌
          </button>
          {!item.pinned && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={isEmail ? "휴지통으로 이동" : "피드에서 숨기기"}
              title={isEmail ? "휴지통으로 이동" : "피드에서 숨기기"}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                minWidth: 44,
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                opacity: 0.6,
                fontSize: 14,
                lineHeight: 1,
                color: "inherit",
              }}
            >
              ✕
            </button>
          )}
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
      {isEmail && expanded ? (
        emailLoading ? (
          <div style={{ padding: 12, color: "#999", fontSize: 13 }}>로딩 중...</div>
        ) : emailBody ? (
          <div
            key="email-shadow"
            ref={(el) => {
              if (!el || el.shadowRoot) return;
              const shadow = el.attachShadow({ mode: "open" });
              const wrapper = document.createElement("div");
              wrapper.tabIndex = 0;
              wrapper.style.cssText = "font-size:14px;color:#3c4043;line-height:1.6;outline:none;overflow:auto;max-height:80vh;word-break:break-word;";
              wrapper.innerHTML = emailBody;
              shadow.appendChild(wrapper);
              wrapper.focus();
            }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            style={{ outline: "none" }}
          />
        ) : null
      ) : isChat ? (
        <>
          <div style={{ fontSize: 14, color: "#3c4043", whiteSpace: "pre-wrap", display: expanded ? undefined : "none" }}>
            <MessageBody item={item} />
          </div>
          {!expanded && (
            <div style={{ fontSize: 14, color: "#3c4043" }}>
              <div style={{
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {item.source === "telegram" ? <MarkdownText text={item.body ?? ""} /> : <Linkify text={item.body ?? ""} />}
              </div>
              <CompactMedia item={item} />
            </div>
          )}
        </>
      ) : (() => {
        const yt = getYouTubeMeta(item);
        if (yt) {
          return (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: MouseEvent) => e.stopPropagation()}
              style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <div style={{ flexShrink: 0, width: 168, borderRadius: 8, overflow: "hidden", background: "#000" }}>
                <img
                  src={yt.thumbnail}
                  alt=""
                  style={{ width: 168, height: 94, display: "block", objectFit: "cover" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  fontSize: 13, color: "#5f6368", lineHeight: 1.4,
                }}>
                  {item.body}
                </div>
                {yt.views !== undefined && (
                  <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                    조회수 {formatViews(yt.views)}회
                  </div>
                )}
              </div>
            </a>
          );
        }
        return (
          <div style={{ fontSize: 14, color: "#3c4043" }}>
            <div style={{
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {item.body}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

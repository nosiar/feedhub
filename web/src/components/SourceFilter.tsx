export const SOURCES = [
  { key: undefined, label: "All" },
  { key: "gmail", label: "Gmail" },
  { key: "kakaotalk", label: "Kakao" },
  { key: "slack", label: "Slack" },
  { key: "rss", label: "RSS" },
  { key: "telegram", label: "Telegram" },
] as const;

export function SourceFilter({
  current,
  onChange,
}: {
  current: string | undefined;
  onChange: (s: string | undefined) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {SOURCES.map((s) => (
        <button
          key={s.label}
          onClick={() => onChange(s.key)}
          style={{
            padding: "6px 12px",
            border: "1px solid #ddd",
            borderRadius: 20,
            background: current === s.key ? "#4285F4" : "#fff",
            color: current === s.key ? "#fff" : "#333",
            cursor: "pointer",
            fontWeight: current === s.key ? 600 : 400,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

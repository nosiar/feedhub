export function SourceStatus({
  name,
  icon,
  connected,
}: {
  name: string;
  icon: string;
  connected: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 500 }}>
        {icon} {name}
      </span>
      <span
        style={{
          padding: "4px 10px",
          background: connected ? "#e8f5e9" : "#fff3e0",
          color: connected ? "#34A853" : "#FF6D01",
          borderRadius: 12,
          fontSize: 11,
        }}
      >
        {connected ? "연결됨" : "미연결"}
      </span>
    </div>
  );
}

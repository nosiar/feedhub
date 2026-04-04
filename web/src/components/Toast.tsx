export function Toast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#333",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 8,
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        gap: 16,
        zIndex: 9999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <span>{message}</span>
      <span
        onClick={onUndo}
        style={{
          color: "#8ab4f8",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        실행취소
      </span>
    </div>
  );
}

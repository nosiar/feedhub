const SHORTCUTS = [
  { key: "j / k", desc: "다음 / 이전 아이템" },
  { key: "Enter / o", desc: "펼치기 / 접기" },
  { key: "d / x", desc: "삭제 (실행취소 가능)" },
  { key: "v", desc: "링크 새 탭에서 열기" },
  { key: "Esc", desc: "접기" },
  { key: "e", desc: "전체 펼치기 / 접기" },
  { key: "Shift+D", desc: "현재 탭 전체 삭제" },
  { key: "1 ~ 6", desc: "소스 탭 전환" },
  { key: "?", desc: "단축키 도움말" },
];

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "24px 32px",
          minWidth: 320,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Keyboard Shortcuts</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.key}>
                <td style={{ padding: "6px 16px 6px 0", whiteSpace: "nowrap" }}>
                  <kbd style={{
                    background: "#f0f0f0",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}>
                    {s.key}
                  </kbd>
                </td>
                <td style={{ padding: "6px 0", color: "#555" }}>{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: "right", fontSize: 12, color: "#999" }}>
          아무 곳이나 클릭하거나 Esc로 닫기
        </div>
      </div>
    </div>
  );
}

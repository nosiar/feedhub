import { useState } from "react";
import type { KakaoChat } from "../api.js";
import { fetchKakaoChats } from "../api.js";

export function KakaoChatManager({
  chats,
  onChange,
}: {
  chats: KakaoChat[];
  onChange: (chats: KakaoChat[]) => void;
}) {
  const [allChats, setAllChats] = useState<{ id: string; name: string; type: string; memberCount: number }[] | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleLoadChats = async () => {
    setShowPicker(true);
    if (allChats) return;
    setLoading(true);
    try {
      const res = await fetchKakaoChats();
      setAllChats(res.chats);
    } catch {
      setAllChats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (chat: { id: string; name: string }) => {
    if (chats.some((c) => c.id === chat.id)) return;
    onChange([...chats, { id: chat.id, name: chat.name }]);
  };

  const handleRemove = (id: string) => {
    onChange(chats.filter((c) => c.id !== id));
  };

  const selectedIds = new Set(chats.map((c) => c.id));
  const filtered = (allChats ?? []).filter((c) => !selectedIds.has(c.id) && c.name.includes(search));

  return (
    <div style={{ padding: 16, borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>💬 KakaoTalk</h3>
        <span onClick={handleLoadChats} style={{ color: "#4285F4", fontSize: 12, cursor: "pointer" }}>+ 채팅방 추가</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chats.map((chat) => (
          <div key={chat.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8f9fa", borderRadius: 6 }}>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{chat.name}</span>
            <span onClick={() => handleRemove(chat.id)} style={{ color: "#EA4335", cursor: "pointer", fontSize: 11 }}>삭제</span>
          </div>
        ))}
      </div>
      {showPicker && (
        <div style={{ marginTop: 10 }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="채팅방 이름으로 검색..." style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }} />
          <div style={{ marginTop: 6, border: "1px solid #e0e0e0", borderRadius: 6, maxHeight: 160, overflow: "auto" }}>
            {loading && <div style={{ padding: 12, color: "#999", fontSize: 12 }}>로딩 중...</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 12, color: "#999", fontSize: 12 }}>{search ? "검색 결과 없음" : "채팅방 없음"}</div>}
            {filtered.map((chat) => (
              <div key={chat.id} onClick={() => handleAdd(chat)} style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", cursor: "pointer", fontSize: 12 }}>
                {chat.name}
                <span style={{ color: "#999", marginLeft: 8, fontSize: 11 }}>({chat.memberCount}명)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

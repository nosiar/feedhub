import { useState } from "react";

export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");

  const handleClear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <input
        type="text"
        placeholder="Search feeds..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch(value);
          if (e.key === "Escape") handleClear();
        }}
        style={{
          width: "100%",
          padding: "10px 36px 10px 16px",
          border: "1px solid #ddd",
          borderRadius: 8,
          fontSize: 14,
        }}
      />
      {value && (
        <span
          onClick={handleClear}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            cursor: "pointer",
            color: "#999",
            fontSize: 16,
          }}
        >
          ✕
        </span>
      )}
    </div>
  );
}

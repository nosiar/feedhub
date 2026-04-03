import { useState } from "react";

export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <input
      type="text"
      placeholder="Search feeds..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSearch(value);
      }}
      style={{
        width: "100%",
        padding: "10px 16px",
        border: "1px solid #ddd",
        borderRadius: 8,
        fontSize: 14,
        marginBottom: 16,
      }}
    />
  );
}

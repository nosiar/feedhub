// web/src/components/SettingsPage.tsx
import { useState, useEffect } from "react";
import { getSettings, saveSettings, type SettingsResponse, type RssFeed, type KakaoChat, type TelegramChat } from "../api.js";
import { RssFeedManager } from "./RssFeedManager.js";
import { KakaoChatManager } from "./KakaoChatManager.js";
import { TelegramChatManager } from "./TelegramChatManager.js";
import { YouTubeChannelManager } from "./YouTubeChannelManager.js";
import { SourceStatus } from "./SourceStatus.js";

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const save = async (patch: Partial<Pick<SettingsResponse, "rssFeeds" | "kakaoChats" | "telegramChats" | "youtubeChannels">>) => {
    if (!settings) return;
    setSaving(true);
    const updated = {
      rssFeeds: patch.rssFeeds ?? settings.rssFeeds,
      kakaoChats: patch.kakaoChats ?? settings.kakaoChats,
      telegramChats: patch.telegramChats ?? settings.telegramChats,
      youtubeChannels: patch.youtubeChannels ?? settings.youtubeChannels,
    };
    try {
      await saveSettings(updated);
      setSettings((prev) => (prev ? { ...prev, ...updated } : prev));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <p style={{ textAlign: "center", color: "#999", padding: 40 }}>Loading...</p>;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 0",
          marginBottom: 8,
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <span onClick={onBack} style={{ cursor: "pointer", fontSize: 18 }}>
          ←
        </span>
        <h2 style={{ fontSize: 18, margin: 0 }}>Settings</h2>
        {saving && <span style={{ fontSize: 12, color: "#999" }}>저장 중...</span>}
      </div>

      <RssFeedManager
        feeds={settings.rssFeeds}
        onChange={(feeds) => save({ rssFeeds: feeds })}
      />
      <KakaoChatManager
        chats={settings.kakaoChats}
        onChange={(chats) => save({ kakaoChats: chats })}
      />
      <TelegramChatManager
        chats={settings.telegramChats}
        onChange={(chats) => save({ telegramChats: chats })}
      />
      <YouTubeChannelManager
        channels={settings.youtubeChannels}
        onChange={(channels) => save({ youtubeChannels: channels })}
      />
      <SourceStatus name="Gmail" icon="📧" connected={settings.gmail.connected} />
      <SourceStatus name="Slack" icon="💬" connected={settings.slack.connected} />
      <SourceStatus name="Naver Mail" icon="📩" connected={settings.naver.connected} />
    </div>
  );
}

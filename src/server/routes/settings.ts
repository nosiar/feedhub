// src/server/routes/settings.ts
import type { FastifyInstance } from "fastify";
import { getSettings, saveSettings, type Settings } from "../../db/settings-repo.js";
import { config } from "../../config.js";

export function settingsRoutes(
  app: FastifyInstance,
  onSettingsChanged: (settings: Settings) => void
): void {
  app.get("/api/settings", async () => {
    const settings = await getSettings();
    return {
      ...settings,
      gmail: { connected: !!config.gmail.refreshToken },
      slack: { connected: !!config.slack.botToken },
      telegram: { connected: !!config.telegram.session },
    };
  });

  app.put("/api/settings", async (req) => {
    const { rssFeeds, kakaoChats, telegramChats, youtubeChannels } = req.body as Settings;
    const settings = { rssFeeds, kakaoChats, telegramChats, youtubeChannels };
    await saveSettings(settings);
    onSettingsChanged(settings);
    return { ok: true };
  });

  app.get("/api/settings/rss-title", async (req, reply) => {
    const { url } = req.query as { url?: string };
    if (!url) return reply.status(400).send({ error: "url required" });
    try {
      const Parser = (await import("rss-parser")).default;
      const parser = new Parser({ timeout: 5000 });
      const feed = await parser.parseURL(url);
      return { title: feed.title ?? url };
    } catch {
      return { title: url };
    }
  });

  app.get("/api/settings/youtube-channel", async (req, reply) => {
    const { input } = req.query as { input?: string };
    if (!input) return reply.status(400).send({ error: "input required" });

    // Extract channel ID from URL format or treat as raw ID
    let channelId = input.trim();
    const channelUrlMatch = channelId.match(
      /youtube\.com\/channel\/(UC[\w-]{22})/
    );
    if (channelUrlMatch) {
      channelId = channelUrlMatch[1];
    }

    // Validate by fetching the RSS feed
    try {
      const Parser = (await import("rss-parser")).default;
      const parser = new Parser();
      const feed = await parser.parseURL(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      );
      return { channelId, name: feed.title ?? channelId };
    } catch {
      return reply.status(400).send({ error: "Invalid channel ID or URL" });
    }
  });
}

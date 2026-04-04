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
    const { rssFeeds, kakaoChats, telegramChats } = req.body as Settings;
    const settings = { rssFeeds, kakaoChats, telegramChats };
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
}

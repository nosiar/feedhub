import { config } from "../config.js";
import type { Connector, SourceType } from "./types.js";
import type { Settings } from "../db/settings-repo.js";
import { RssConnector } from "./rss.js";
import { GmailConnector } from "./gmail.js";
import { SlackConnector } from "./slack.js";
import { KakaotalkConnector } from "./kakaotalk.js";
import { TelegramConnector } from "./telegram.js";

export function buildConnectors(settings: Settings): Map<SourceType, Connector> {
  const connectors = new Map<SourceType, Connector>();

  if (settings.rssFeeds.length > 0) {
    connectors.set("rss", new RssConnector(settings.rssFeeds.map((f) => f.url)));
  }
  if (config.gmail.refreshToken) {
    connectors.set("gmail", new GmailConnector(config.gmail));
  }
  if (config.slack.botToken) {
    connectors.set("slack", new SlackConnector(config.slack.botToken));
  }
  if (config.kakaocli.enabled && settings.kakaoChats.length > 0) {
    connectors.set("kakaotalk", new KakaotalkConnector(config.kakaocli.path, settings.kakaoChats));
  }
  if (config.telegram.session && settings.telegramChats.length > 0) {
    connectors.set("telegram", new TelegramConnector({
      ...config.telegram,
      chats: settings.telegramChats,
    }));
  }

  return connectors;
}

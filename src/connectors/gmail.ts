import { google } from "googleapis";
import type { Connector, FeedItem } from "./types.js";

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

export class GmailConnector implements Connector {
  name = "gmail" as const;
  private config: GmailConfig;

  constructor(config: GmailConfig) {
    this.config = config;
  }

  private getClient() {
    const auth = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
    auth.setCredentials({ refresh_token: this.config.refreshToken });
    return google.gmail({ version: "v1", auth });
  }

  async sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }> {
    const gmail = this.getClient();
    let q = "in:inbox";
    if (cursor) {
      const epoch = Math.floor(new Date(cursor).getTime() / 1000);
      q += ` after:${epoch}`;
    }

    const list = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 50,
    });

    const messages = list.data.messages ?? [];
    const items: FeedItem[] = [];

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const headers = detail.data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name === name)?.value ?? "";

      items.push({
        id: msg.id!,
        source: "gmail",
        title: getHeader("Subject") || "(no subject)",
        body: detail.data.snippet ?? "",
        author: getHeader("From"),
        url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
        timestamp: new Date(getHeader("Date") || Date.now()),
        metadata: { labelIds: detail.data.labelIds },
      });
    }

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const newCursor = items.length > 0
      ? items[0].timestamp.toISOString()
      : cursor ?? new Date().toISOString();

    return { items, newCursor };
  }
}

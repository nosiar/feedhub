import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { Connector, FeedItem } from "./types.js";

interface NaverMailConfig {
  email: string;
  password: string;
}

export class NaverMailConnector implements Connector {
  name = "naver" as const;
  private config: NaverMailConfig;

  constructor(config: NaverMailConfig) {
    this.config = config;
  }

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: "imap.naver.com",
      port: 993,
      secure: true,
      auth: {
        user: this.config.email,
        pass: this.config.password,
      },
      logger: false,
    });
  }

  async sync(
    cursor: string | null
  ): Promise<{ items: FeedItem[]; newCursor: string }> {
    const client = this.createClient();
    await client.connect();

    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const since = cursor ? new Date(cursor) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const uids = await client.search({ since }, { uid: true });
        if (!uids || uids.length === 0) {
          return {
            items: [],
            newCursor: cursor ?? new Date().toISOString(),
          };
        }

        const items: FeedItem[] = [];
        const fetchRange = (uids as number[]).join(",");
        for await (const msg of client.fetch(fetchRange, {
          uid: true,
          envelope: true,
          bodyStructure: true,
        }, { uid: true })) {
          const env = msg.envelope;
          if (!env) continue;

          const from = env.from?.[0];
          const author = from
            ? from.name || `${from.address}`
            : "Unknown";
          const timestamp = env.date ? new Date(env.date) : new Date();

          items.push({
            id: `naver_${msg.uid}`,
            source: "naver",
            title: env.subject ?? "(제목 없음)",
            body: "",
            author,
            timestamp,
            metadata: {
              uid: msg.uid,
            },
          });
        }

        items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const newCursor = items.length > 0
          ? items[0].timestamp.toISOString()
          : cursor ?? new Date().toISOString();

        return { items, newCursor };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async getBody(uid: number): Promise<string> {
    const client = this.createClient();
    await client.connect();

    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const downloaded = await client.download(String(uid), undefined, { uid: true });
        const parsed = await simpleParser(downloaded.content);
        return parsed.html || parsed.textAsHtml || parsed.text || "";
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async trash(uid: number): Promise<void> {
    const client = this.createClient();
    await client.connect();

    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.messageMove(String(uid), "지운편지함", { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}

import { execFile } from "node:child_process";
import type { Connector, FeedItem } from "./types.js";

interface KakaocliChat {
  id: string;
  display_name: string;
  type: string;
  member_count: number;
}

interface KakaocliMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender: string;
  text: string;
  type: string;
  is_from_me: boolean;
  timestamp: string;
}

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

export class KakaotalkConnector implements Connector {
  name = "kakaotalk" as const;
  private bin: string;
  private chatIds: string[];

  constructor(bin: string, chatIds: string[]) {
    this.bin = bin;
    this.chatIds = chatIds;
  }

  private async getChats(): Promise<KakaocliChat[]> {
    const output = await run(this.bin, ["chats", "--json", "--limit", "999999"]);
    const chats: KakaocliChat[] = JSON.parse(output);
    if (this.chatIds.length > 0) {
      const idSet = new Set(this.chatIds);
      return chats.filter((c) => idSet.has(c.id));
    }
    return chats;
  }

  async sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }> {
    const chats = await this.getChats();

    const results = await Promise.allSettled(
      chats.map(async (chat) => {
        const args = [
          "messages", "--chat-id", chat.id, "--json", "--limit", "100", "--since", "7d",
        ];
        if (cursor) args.push("--after-id", cursor);

        const msgsOutput = await run(this.bin, args);
        const messages: KakaocliMessage[] = JSON.parse(msgsOutput);

        return messages.map((msg) => ({
          item: {
            id: msg.id,
            source: "kakaotalk" as const,
            title: chat.display_name,
            body: msg.text,
            author: msg.sender,
            timestamp: new Date(msg.timestamp),
            metadata: {
              chatId: msg.chat_id,
              senderId: msg.sender_id,
              chatType: chat.type,
              isFromMe: msg.is_from_me,
            },
          } satisfies FeedItem,
          msgId: msg.id,
        }));
      })
    );

    const allItems: FeedItem[] = [];
    let maxId = cursor ?? "0";

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const { item, msgId } of result.value) {
        allItems.push(item);
        if (BigInt(msgId) > BigInt(maxId)) maxId = msgId;
      }
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { items: allItems, newCursor: maxId };
  }
}

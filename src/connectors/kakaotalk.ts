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

  constructor(bin: string) {
    this.bin = bin;
  }

  async sync(cursor: string | null): Promise<{ items: FeedItem[]; newCursor: string }> {
    const chatsOutput = await run(this.bin, ["chats", "--json", "--limit", "999999"]);
    const chats: KakaocliChat[] = JSON.parse(chatsOutput);

    const allItems: FeedItem[] = [];
    let maxId = cursor ?? "0";

    for (const chat of chats) {
      const args = [
        "messages", "--chat-id", chat.id, "--json", "--limit", "999999", "--since", "180d",
      ];
      if (cursor) args.push("--after-id", cursor);

      const msgsOutput = await run(this.bin, args);
      const messages: KakaocliMessage[] = JSON.parse(msgsOutput);

      for (const msg of messages) {
        if (BigInt(msg.id) > BigInt(maxId)) maxId = msg.id;
        allItems.push({
          id: msg.id,
          source: "kakaotalk",
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
        });
      }
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { items: allItems, newCursor: maxId };
  }
}

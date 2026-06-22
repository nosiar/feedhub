import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import type { Connector, FeedItem } from "./types.js";

interface TelegramConfig {
  apiId: number;
  apiHash: string;
  session: string;
  chats: { id: string; name: string }[];
}

interface LinkPreview {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

function parseCursors(cursor: string | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!cursor) return map;
  for (const entry of cursor.split(",")) {
    const [chatId, id] = entry.split(":");
    if (chatId && id) map.set(chatId, parseInt(id, 10));
  }
  return map;
}

function serializeCursors(cursors: Map<string, number>): string {
  return [...cursors.entries()].map(([k, v]) => `${k}:${v}`).join(",");
}

export class TelegramConnector implements Connector {
  name = "telegram" as const;
  private config: TelegramConfig;
  private client: TelegramClient | null = null;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  private async getClient(): Promise<TelegramClient> {
    if (this.client?.connected) return this.client;
    this.client = new TelegramClient(
      new StringSession(this.config.session),
      this.config.apiId,
      this.config.apiHash,
      { connectionRetries: 3 }
    );
    await this.client.connect();
    return this.client;
  }

  async sync(
    cursor: string | null
  ): Promise<{ items: FeedItem[]; newCursor: string }> {
    const client = await this.getClient();
    const allItems: FeedItem[] = [];
    const cursors = parseCursors(cursor);

    const targets: { id: string; title: string }[] = [];
    if (this.config.chats.length > 0) {
      for (const chat of this.config.chats) {
        targets.push({ id: chat.id, title: chat.name });
      }
    } else {
      const dialogs = await client.getDialogs({ limit: 20 });
      for (const d of dialogs) {
        if (d.id) {
          targets.push({ id: d.id.toString(), title: d.title ?? d.id.toString() });
        }
      }
    }

    const RECENT_REFRESH_LIMIT = 100;

    const results = await Promise.allSettled(
      targets.map(async (chat) => {
        const chatCursor = cursors.get(chat.id) ?? 0;

        const newMsgs = chatCursor
          ? await client.getMessages(chat.id, { limit: 1000, minId: chatCursor })
          : [];

        // Always re-fetch recent messages to pick up edits
        const recentMsgs = await client.getMessages(chat.id, {
          limit: chatCursor ? RECENT_REFRESH_LIMIT : 50,
        });

        const seen = new Set<number>();
        const msgs = [...newMsgs, ...recentMsgs].filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        const isVideo = (m: (typeof msgs)[number]): boolean =>
          m.media instanceof Api.MessageMediaDocument
          && m.media.document instanceof Api.Document
          && (m.media.document.mimeType?.startsWith("video/") ?? false);

        // Album images/videos are separate messages sharing a groupedId; group
        // them so the whole album renders as a single feed item.
        const groups: { members: typeof msgs }[] = [];
        const groupIndex = new Map<string, number>();
        for (const msg of msgs) {
          const key = msg.groupedId ? `g:${msg.groupedId.toString()}` : `m:${msg.id}`;
          const idx = groupIndex.get(key);
          if (idx === undefined) {
            groupIndex.set(key, groups.length);
            groups.push({ members: [msg] });
          } else {
            groups[idx].members.push(msg);
          }
        }

        let maxId = chatCursor;
        const items = groups.map(({ members }) => {
          members.sort((a, b) => a.id - b.id);
          const rep = members[0];
          const msgId = rep.id;
          for (const m of members) if (m.id > maxId) maxId = m.id;

          const senderName = rep.sender && "firstName" in rep.sender
            ? `${rep.sender.firstName ?? ""} ${rep.sender.lastName ?? ""}`.trim()
            : rep.sender && "title" in rep.sender
              ? rep.sender.title
              : "";

          // Caption can live on any album member; the rest are media-only.
          const body = members.map((m) => m.text).find((t) => t) ?? "";

          // Photos across the album → imageUrls; first video → videoUrl.
          const imageUrls = members
            .filter((m) => m.media instanceof Api.MessageMediaPhoto)
            .map((m) => `/api/telegram/photo/${chat.id}/${m.id}`);
          const videoMember = members.find(isVideo);

          // Non-album media (file/poll/link/replies) comes from a member that has it.
          const fileMsg = members.find(
            (m) =>
              m.media instanceof Api.MessageMediaDocument
              && m.media.document instanceof Api.Document
              && !isVideo(m)
          );
          let fileAttachment: { fileName: string; fileSize: number; mimeType: string; fileUrl: string } | undefined;
          if (
            fileMsg
            && fileMsg.media instanceof Api.MessageMediaDocument
            && fileMsg.media.document instanceof Api.Document
          ) {
            const doc = fileMsg.media.document;
            const fileNameAttr = doc.attributes?.find(
              (a): a is Api.DocumentAttributeFilename => a instanceof Api.DocumentAttributeFilename
            );
            if (fileNameAttr) {
              fileAttachment = {
                fileName: fileNameAttr.fileName,
                fileSize: Number(doc.size),
                mimeType: doc.mimeType ?? "application/octet-stream",
                fileUrl: `/api/telegram/file/${chat.id}/${fileMsg.id}`,
              };
            }
          }

          const pollMsg = members.find((m) => m.media instanceof Api.MessageMediaPoll);
          let poll: { question: string; answers: string[] } | undefined;
          if (pollMsg && pollMsg.media instanceof Api.MessageMediaPoll) {
            poll = {
              question: pollMsg.media.poll.question.text ?? "",
              answers: pollMsg.media.poll.answers.map((a) => a.text.text ?? ""),
            };
          }

          const webMsg = members.find((m) => m.media instanceof Api.MessageMediaWebPage);
          let linkPreview: LinkPreview | undefined;
          if (webMsg && webMsg.media instanceof Api.MessageMediaWebPage) {
            const page = webMsg.media.webpage;
            if (page && page instanceof Api.WebPage) {
              linkPreview = {
                title: page.title ?? "",
                description: page.description ?? "",
                imageUrl: page.photo && page.photo instanceof Api.Photo ? "" : "",
                url: page.url ?? "",
              };
            }
          }

          const repliesMsg = members.find((m) => m.replies?.comments);

          return {
            id: `${chat.id}_${msgId}`,
            source: "telegram" as const,
            title: chat.title,
            body,
            author: senderName,
            timestamp: new Date(rep.date * 1000),
            metadata: {
              chatId: chat.id,
              messageId: msgId,
              imageUrls,
              ...(videoMember ? { videoUrl: `/api/telegram/video/${chat.id}/${videoMember.id}`, videoPosterUrl: `/api/telegram/video-thumb/${chat.id}/${videoMember.id}` } : {}),
              ...(fileAttachment ? { fileAttachment } : {}),
              ...(poll && pollMsg ? { poll, pollUrl: `/api/telegram/poll/${chat.id}/${pollMsg.id}` } : {}),
              ...(linkPreview ? { linkPreview } : {}),
              ...(repliesMsg?.replies ? {
                replyCount: repliesMsg.replies.replies ?? 0,
                repliesUrl: `/api/telegram/replies/${chat.id}/${repliesMsg.id}`,
              } : {}),
              ...(rep.media?.className === "MessageMediaUnsupported" ? { unsupportedMedia: true } : {}),
            },
          } satisfies FeedItem;
        });

        return { chatId: chat.id, items, maxId };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { chatId, items, maxId } = result.value;
      allItems.push(...items);
      cursors.set(chatId, maxId);
    }

    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return {
      items: allItems,
      newCursor: serializeCursors(cursors),
    };
  }
}

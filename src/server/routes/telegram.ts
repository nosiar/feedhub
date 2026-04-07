import type { FastifyInstance } from "fastify";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import { config } from "../../config.js";

// In-memory media cache (cleared on server restart)
const photoCache = new Map<string, { data: Buffer; mime: string }>();
const videoCache = new Map<string, { data: Buffer; mime: string }>();

let sharedClient: TelegramClient | null = null;

async function getClient(): Promise<TelegramClient> {
  if (sharedClient?.connected) return sharedClient;
  sharedClient = new TelegramClient(
    new StringSession(config.telegram.session),
    config.telegram.apiId,
    config.telegram.apiHash,
    { connectionRetries: 3 }
  );
  await sharedClient.connect();
  return sharedClient;
}

export function telegramRoutes(app: FastifyInstance): void {
  app.get("/api/telegram/chats", async (_req, reply) => {
    if (!config.telegram.session) {
      return reply.status(400).send({ error: "Telegram not connected" });
    }

    const client = await getClient();
    const dialogs = await client.getDialogs({ limit: 50 });
    const chats = dialogs
      .filter((d) => d.id && d.title)
      .map((d) => ({
        id: d.id!.toString(),
        name: d.title!,
        type: d.isChannel ? "channel" : d.isGroup ? "group" : "private",
        unreadCount: d.unreadCount ?? 0,
      }));

    return { chats };
  });

  app.get<{ Params: { chatId: string; msgId: string } }>(
    "/api/telegram/photo/:chatId/:msgId",
    async (req, reply) => {
      if (!config.telegram.session) {
        return reply.status(400).send({ error: "Telegram not connected" });
      }

      const { chatId, msgId } = req.params;
      const cacheKey = `${chatId}_${msgId}`;

      // Check cache
      const cached = photoCache.get(cacheKey);
      if (cached) {
        return reply
          .header("Content-Type", cached.mime)
          .header("Cache-Control", "public, max-age=86400")
          .send(cached.data);
      }

      const client = await getClient();
      const msgs = await client.getMessages(chatId, { ids: [parseInt(msgId, 10)] });
      const msg = msgs[0];

      if (!msg?.media || !(msg.media instanceof Api.MessageMediaPhoto)) {
        return reply.status(404).send({ error: "Photo not found" });
      }

      const buffer = (await client.downloadMedia(msg.media, {})) as Buffer;
      if (!buffer) {
        return reply.status(404).send({ error: "Download failed" });
      }

      const mime = "image/jpeg";
      photoCache.set(cacheKey, { data: buffer, mime });

      return reply
        .header("Content-Type", mime)
        .header("Cache-Control", "public, max-age=86400")
        .send(buffer);
    }
  );

  app.get<{ Params: { chatId: string; msgId: string } }>(
    "/api/telegram/video/:chatId/:msgId",
    async (req, reply) => {
      if (!config.telegram.session) {
        return reply.status(400).send({ error: "Telegram not connected" });
      }

      const { chatId, msgId } = req.params;
      const cacheKey = `${chatId}_${msgId}`;

      let cached = videoCache.get(cacheKey);
      if (!cached) {
        const client = await getClient();
        const msgs = await client.getMessages(chatId, { ids: [parseInt(msgId, 10)] });
        const msg = msgs[0];

        if (
          !msg?.media
          || !(msg.media instanceof Api.MessageMediaDocument)
          || !(msg.media.document instanceof Api.Document)
          || !msg.media.document.mimeType?.startsWith("video/")
        ) {
          return reply.status(404).send({ error: "Video not found" });
        }

        const buffer = (await client.downloadMedia(msg.media, {})) as Buffer;
        if (!buffer) {
          return reply.status(404).send({ error: "Download failed" });
        }
        cached = { data: buffer, mime: msg.media.document.mimeType };
        videoCache.set(cacheKey, cached);
      }

      const { data, mime } = cached;
      const total = data.length;
      const range = req.headers.range;

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : Math.min(start + 1024 * 1024 - 1, total - 1);
        return reply
          .status(206)
          .header("Content-Type", mime)
          .header("Content-Range", `bytes ${start}-${end}/${total}`)
          .header("Content-Length", end - start + 1)
          .header("Accept-Ranges", "bytes")
          .header("Cache-Control", "public, max-age=86400")
          .send(data.subarray(start, end + 1));
      }

      return reply
        .header("Content-Type", mime)
        .header("Content-Length", total)
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "public, max-age=86400")
        .send(data);
    }
  );

  app.get<{ Params: { chatId: string; msgId: string } }>(
    "/api/telegram/video-thumb/:chatId/:msgId",
    async (req, reply) => {
      if (!config.telegram.session) {
        return reply.status(400).send({ error: "Telegram not connected" });
      }

      const { chatId, msgId } = req.params;
      const cacheKey = `thumb_${chatId}_${msgId}`;

      const cached = photoCache.get(cacheKey);
      if (cached) {
        return reply
          .header("Content-Type", cached.mime)
          .header("Cache-Control", "public, max-age=86400")
          .send(cached.data);
      }

      const client = await getClient();
      const msgs = await client.getMessages(chatId, { ids: [parseInt(msgId, 10)] });
      const msg = msgs[0];

      if (
        !msg?.media
        || !(msg.media instanceof Api.MessageMediaDocument)
        || !(msg.media.document instanceof Api.Document)
        || !msg.media.document.thumbs?.length
      ) {
        return reply.status(404).send({ error: "Thumbnail not found" });
      }

      const thumb = msg.media.document.thumbs.at(-1)!;
      const buffer = (await client.downloadMedia(msg.media, { thumb })) as Buffer;
      if (!buffer) {
        return reply.status(404).send({ error: "Download failed" });
      }

      const mime = "image/jpeg";
      photoCache.set(cacheKey, { data: buffer, mime });

      return reply
        .header("Content-Type", mime)
        .header("Cache-Control", "public, max-age=86400")
        .send(buffer);
    }
  );

  app.get<{ Params: { chatId: string; msgId: string } }>(
    "/api/telegram/poll/:chatId/:msgId",
    async (req, reply) => {
      if (!config.telegram.session) {
        return reply.status(400).send({ error: "Telegram not connected" });
      }

      const { chatId, msgId } = req.params;
      const client = await getClient();
      const msgs = await client.getMessages(chatId, { ids: [parseInt(msgId, 10)] });
      const msg = msgs[0];

      if (!msg?.media || !(msg.media instanceof Api.MessageMediaPoll)) {
        return reply.status(404).send({ error: "Poll not found" });
      }

      const { poll, results } = msg.media;
      return {
        question: poll.question.text ?? "",
        closed: poll.closed ?? false,
        answers: poll.answers.map((a, i) => ({
          text: a.text.text ?? "",
          voters: results.results?.[i]?.voters ?? 0,
        })),
        totalVoters: results.totalVoters ?? 0,
      };
    }
  );

  app.get<{ Params: { chatId: string; msgId: string }; Querystring: { offsetId?: string; limit?: string } }>(
    "/api/telegram/replies/:chatId/:msgId",
    async (req, reply) => {
      if (!config.telegram.session) {
        return reply.status(400).send({ error: "Telegram not connected" });
      }

      const { chatId, msgId } = req.params;
      const offsetId = parseInt(req.query.offsetId ?? "0", 10);
      const limit = Math.min(parseInt(req.query.limit ?? "10", 10), 50);

      const client = await getClient();
      const result = await client.invoke(
        new Api.messages.GetReplies({
          peer: chatId,
          msgId: parseInt(msgId, 10),
          offsetId,
          offsetDate: 0,
          addOffset: 0,
          limit,
          maxId: 0,
          minId: 0,
          hash: BigInt(0) as unknown as Api.long,
        })
      );

      const users = new Map<string, string>();
      if ("users" in result && Array.isArray(result.users)) {
        for (const u of result.users) {
          if ("id" in u && "firstName" in u) {
            const user = u as Api.User;
            users.set(user.id.toString(), `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim());
          }
        }
      }

      // Channel name and discussion group ID for anonymous admin replies
      let channelName = "";
      let discussionChatId = chatId;
      if ("chats" in result && Array.isArray(result.chats) && result.chats[0]) {
        const ch = result.chats[0];
        if ("title" in ch) channelName = (ch as Api.Channel).title ?? "";
        discussionChatId = `-100${ch.id.toString()}`;
      }

      const messages = ("messages" in result && Array.isArray(result.messages))
        ? result.messages as Api.Message[] : [];

      // Build map of current batch message IDs for quick lookup
      const batchMap = new Map<number, Api.Message>();
      for (const m of messages) batchMap.set(m.id, m);

      // Collect replyToMsgIds that are NOT in the current batch
      // Only for replies-to-replies (replyToTopId exists), not direct replies to the top post
      const missingIds = new Set<number>();
      for (const m of messages) {
        const rt = m.replyTo && "replyToMsgId" in m.replyTo ? m.replyTo : undefined;
        const replyId = rt?.replyToMsgId;
        const isReplyToReply = rt && "replyToTopId" in rt && rt.replyToTopId;
        if (replyId && isReplyToReply && !batchMap.has(replyId)) {
          missingIds.add(replyId);
        }
      }

      // Batch-fetch missing referenced messages from the discussion group
      const refMap = new Map<number, { text: string; author: string }>();
      if (missingIds.size > 0) {
        try {
          const refMsgs = await client.getMessages(discussionChatId, {
            ids: [...missingIds],
          });
          for (const rm of refMsgs) {
            if (!rm) continue;
            let refAuthor = "";
            if (rm.fromId && "userId" in rm.fromId) {
              refAuthor = users.get(rm.fromId.userId.toString()) ?? "";
            } else if (!rm.fromId) {
              refAuthor = channelName;
            }
            // If author not in users map, try to get from the message's sender
            if (!refAuthor && rm.sender && "firstName" in rm.sender) {
              refAuthor = `${rm.sender.firstName ?? ""} ${rm.sender.lastName ?? ""}`.trim();
            }
            refMap.set(rm.id, { text: rm.message ?? "", author: refAuthor });
          }
        } catch {
          // Ignore fetch errors for referenced messages
        }
      }

      return {
        replies: messages.map((m) => {
          let author = "";
          if (m.fromId && "userId" in m.fromId) {
            author = users.get(m.fromId.userId.toString()) ?? "";
          } else if (!m.fromId) {
            author = channelName;
          }

          const rt = m.replyTo && "replyToMsgId" in m.replyTo ? m.replyTo : undefined;
          const isReplyToReply = rt && "replyToTopId" in rt && rt.replyToTopId;
          const replyToMsgId = isReplyToReply ? rt.replyToMsgId : undefined;

          let replyTo: { msgId: number; text: string; author: string } | undefined;
          if (replyToMsgId) {
            const inBatch = batchMap.get(replyToMsgId);
            const inRef = refMap.get(replyToMsgId);
            if (inBatch) {
              let batchAuthor = "";
              if (inBatch.fromId && "userId" in inBatch.fromId) {
                batchAuthor = users.get(inBatch.fromId.userId.toString()) ?? "";
              } else if (!inBatch.fromId) {
                batchAuthor = channelName;
              }
              replyTo = { msgId: replyToMsgId, text: inBatch.message ?? "", author: batchAuthor };
            } else if (inRef) {
              replyTo = { msgId: replyToMsgId, ...inRef };
            }
          }

          const hasPhoto = m.media instanceof Api.MessageMediaPhoto;

          return {
            id: m.id,
            text: m.message ?? "",
            author,
            isChannel: !m.fromId,
            replyTo,
            ...(hasPhoto ? { photoUrl: `/api/telegram/photo/${discussionChatId}/${m.id}` } : {}),
            timestamp: m.date ? new Date(m.date * 1000).toISOString() : null,
          };
        }),
        hasMore: messages.length === limit,
      };
    }
  );
}

import type { FastifyInstance } from "fastify";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import { config } from "../../config.js";

// In-memory photo cache (cleared on server restart)
const photoCache = new Map<string, { data: Buffer; mime: string }>();

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

      const mime = msg.media.document.mimeType;
      const buffer = (await client.downloadMedia(msg.media, {})) as Buffer;
      if (!buffer) {
        return reply.status(404).send({ error: "Download failed" });
      }

      return reply
        .header("Content-Type", mime)
        .header("Cache-Control", "public, max-age=86400")
        .send(buffer);
    }
  );
}

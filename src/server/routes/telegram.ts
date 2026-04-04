import type { FastifyInstance } from "fastify";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { config } from "../../config.js";

export function telegramRoutes(app: FastifyInstance): void {
  app.get("/api/telegram/chats", async (_req, reply) => {
    if (!config.telegram.session) {
      return reply.status(400).send({ error: "Telegram not connected" });
    }

    const client = new TelegramClient(
      new StringSession(config.telegram.session),
      config.telegram.apiId,
      config.telegram.apiHash,
      { connectionRetries: 3 }
    );
    await client.connect();

    const dialogs = await client.getDialogs({ limit: 50 });
    const chats = dialogs
      .filter((d) => d.id && d.title)
      .map((d) => ({
        id: d.id!.toString(),
        name: d.title!,
        type: d.isChannel ? "channel" : d.isGroup ? "group" : "private",
        unreadCount: d.unreadCount ?? 0,
      }));

    await client.disconnect();
    return { chats };
  });
}

import "dotenv/config";

export const config = {
  mongoUri: process.env.MONGODB_URI ?? "",
  port: parseInt(process.env.PORT ?? "3000", 10),
  syncInterval: parseInt(process.env.SYNC_INTERVAL ?? "5", 10),
  kakaocli: {
    path: process.env.KAKAOCLI_PATH ?? "kakaocli",
    enabled: process.env.ENABLE_KAKAOTALK === "true",
    chats: (process.env.KAKAO_CHATS ?? "")
      .split(",")
      .filter(Boolean)
      .map((entry) => {
        const [id, ...rest] = entry.split(":");
        return { id, name: rest.join(":") || id };
      }),
  },
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID ?? "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
    redirectUri: process.env.GMAIL_REDIRECT_URI ?? "",
    refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN ?? "",
  },
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID ?? "0", 10),
    apiHash: process.env.TELEGRAM_API_HASH ?? "",
    session: process.env.TELEGRAM_SESSION ?? "",
    chats: (process.env.TELEGRAM_CHATS ?? "").split(",").filter(Boolean).map((entry) => {
      const [id, ...rest] = entry.split(":");
      return { id, name: rest.join(":") || id };
    }),
  },
  rss: {
    feeds: (process.env.RSS_FEEDS ?? "").split(",").filter(Boolean),
  },
};

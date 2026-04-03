import "dotenv/config";

export const config = {
  mongoUri: process.env.MONGODB_URI ?? "",
  port: parseInt(process.env.PORT ?? "3000", 10),
  syncInterval: parseInt(process.env.SYNC_INTERVAL ?? "5", 10),
  kakaocliPath: process.env.KAKAOCLI_PATH ?? "kakaocli",
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID ?? "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
    redirectUri: process.env.GMAIL_REDIRECT_URI ?? "",
    refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN ?? "",
  },
  rss: {
    feeds: (process.env.RSS_FEEDS ?? "").split(",").filter(Boolean),
  },
};

import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));

const apiId = parseInt(process.env.TELEGRAM_API_ID ?? "0", 10);
const apiHash = process.env.TELEGRAM_API_HASH ?? "";

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => await ask("Phone number (with country code, e.g. +821012345678): "),
  password: async () => await ask("2FA password (if enabled, otherwise press Enter): "),
  phoneCode: async () => await ask("Telegram code: "),
  onError: (err) => console.error(err),
});

const session = client.session.save() as unknown as string;
console.log("\n=== SUCCESS ===\n");
console.log(`TELEGRAM_SESSION=${session}`);
console.log("\nAdd this to your .env file.\n");

rl.close();
await client.disconnect();

// src/server/routes/kakao.ts
import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import { config } from "../../config.js";

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 50 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

export function kakaoRoutes(app: FastifyInstance): void {
  app.get("/api/kakao/chats", async (_req, reply) => {
    if (!config.kakaocli.enabled) {
      return reply.status(400).send({ error: "KakaoTalk is not enabled" });
    }
    const output = await run(config.kakaocli.path, ["chats", "--json", "--limit", "999999"]);
    const raw = JSON.parse(output) as {
      id: string;
      display_name: string;
      type: string;
      member_count: number;
    }[];
    return {
      chats: raw.map((c) => ({
        id: c.id,
        name: c.display_name,
        type: c.type,
        memberCount: c.member_count,
      })),
    };
  });
}

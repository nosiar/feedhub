import type { FastifyInstance } from "fastify";
import { getKakaoImage } from "../../db/kakao-images-repo.js";

export function kakaoImageRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>("/api/kakao/image/:id", async (req, reply) => {
    const got = await getKakaoImage(req.params.id);
    if (!got) return reply.status(404).send({ error: "not found" });
    reply.header("Content-Type", got.mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(got.data);
  });
}

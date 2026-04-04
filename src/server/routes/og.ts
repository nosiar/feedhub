import type { FastifyInstance } from "fastify";

async function fetchOgMeta(url: string): Promise<{
  title: string;
  description: string;
  imageUrl: string;
  url: string;
} | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; feedhub/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const get = (property: string): string => {
      const match = html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i")
      ) ?? html.match(
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i")
      );
      return match?.[1] ?? "";
    };

    const title = get("og:title") || get("twitter:title") || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "");
    if (!title) return null;

    return {
      title,
      description: get("og:description") || get("twitter:description") || get("description"),
      imageUrl: get("og:image") || get("twitter:image"),
      url: get("og:url") || url,
    };
  } catch {
    return null;
  }
}

export function ogRoutes(app: FastifyInstance): void {
  app.get("/api/og", async (req, reply) => {
    const { url } = req.query as { url?: string };
    if (!url) return reply.status(400).send({ error: "url required" });
    const meta = await fetchOgMeta(url);
    return { preview: meta };
  });
}

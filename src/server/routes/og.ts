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

    // Detect charset from Content-Type header or HTML meta
    const contentType = res.headers.get("content-type") ?? "";
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    const buf = Buffer.from(await res.arrayBuffer());

    let charset = charsetMatch?.[1]?.toLowerCase() ?? "utf-8";
    // MS949/EUC-KR → "euc-kr" for TextDecoder
    if (charset === "ms949" || charset === "ks_c_5601-1987") charset = "euc-kr";

    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = buf.toString("utf-8");
    }

    const decodeEntities = (s: string): string =>
      s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

    const get = (property: string): string => {
      const match = html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content="([^"]*)"`, "i")
      ) ?? html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content='([^']*)'`, "i")
      ) ?? html.match(
        new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)=["']${property}["']`, "i")
      ) ?? html.match(
        new RegExp(`<meta[^>]+content='([^']*)'[^>]+(?:property|name)=["']${property}["']`, "i")
      );
      return decodeEntities(match?.[1] ?? "");
    };

    const title = get("og:title") || get("twitter:title") || decodeEntities(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "");
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

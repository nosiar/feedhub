/**
 * Naver blog RSS feeds only expose a truncated `<description>` preview (no
 * `content:encoded`). This module scrapes the full post body from the mobile
 * blog page, which is server-rendered and needs no JS execution or login.
 */

interface NaverBlogRef {
  blogId: string;
  logNo: string;
}

/** Parse blogId/logNo out of a Naver blog post URL (desktop or mobile). */
export function parseNaverBlogUrl(url: string | undefined): NaverBlogRef | null {
  if (!url) return null;
  const m = url.match(/^https?:\/\/(?:m\.)?blog\.naver\.com\/([^/?#]+)\/(\d+)/);
  if (!m) return null;
  return { blogId: m[1], logNo: m[2] };
}

export function isNaverBlogUrl(url: string | undefined): boolean {
  return parseNaverBlogUrl(url) !== null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#xa0;|&#160;/gi, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'");
}

/**
 * Remove whole <div> blocks whose opening tag matches `opener`, using depth
 * matching so nested <div>s inside the block are removed too. Used to drop
 * SmartEditor link-preview cards (se-oglink), whose title/summary/domain text
 * would otherwise be flattened into the body as a duplicate snippet.
 */
function removeDivBlocks(html: string, opener: RegExp): string {
  const openRe = new RegExp(opener.source, "g");
  let out = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html))) {
    out += html.slice(cursor, m.index);
    const tagRe = /<(\/?)div\b[^>]*>/g;
    tagRe.lastIndex = m.index;
    let depth = 0;
    let end = html.length;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(html))) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        end = tagRe.lastIndex;
        break;
      }
    }
    cursor = end;
    openRe.lastIndex = end;
  }
  out += html.slice(cursor);
  return out;
}

/** Slice out the post container HTML using <div> depth matching. */
function sliceContainer(html: string): string | null {
  // Modern SmartEditor (se-main-container); fall back to the legacy editor.
  let start = html.search(/<div[^>]*class="[^"]*se-main-container[^"]*"/);
  if (start === -1) start = html.search(/<div[^>]*id="postViewArea"/);
  if (start === -1) return null;

  const tagRe = /<(\/?)div\b[^>]*>/g;
  tagRe.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tagRe.lastIndex);
  }
  return html.slice(start);
}

/** Convert post-container HTML to plain text (pure; exported for testing). */
export function extractNaverBlogBody(html: string): string | null {
  const container = sliceContainer(html);
  if (!container) return null;

  // Drop embedded link-preview cards; their text duplicates linked content.
  const cleaned = removeDivBlocks(container, /<div[^>]*class="[^"]*se-oglink[^"]*"/);

  const text = decodeEntities(
    cleaned
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t​ ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}

/**
 * Fetch the full plain-text body of a Naver blog post.
 * Returns null on any failure so callers can fall back to the RSS preview.
 */
export async function fetchNaverBlogBody(url: string): Promise<string | null> {
  const ref = parseNaverBlogUrl(url);
  if (!ref) return null;
  const mobileUrl = `https://m.blog.naver.com/${ref.blogId}/${ref.logNo}`;

  try {
    const res = await fetch(mobileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    const charset = contentType.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    const decoder =
      charset === "ms949" || charset === "ks_c_5601-1987" || charset === "euc-kr"
        ? "euc-kr"
        : "utf-8";

    let html: string;
    try {
      html = new TextDecoder(decoder).decode(buf);
    } catch {
      html = buf.toString("utf-8");
    }

    return extractNaverBlogBody(html);
  } catch {
    return null;
  }
}

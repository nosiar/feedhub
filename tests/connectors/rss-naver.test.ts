import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixture = readFileSync(
  fileURLToPath(new URL("../fixtures/naver-blog-mobile.html", import.meta.url)),
  "utf8"
);

vi.mock("rss-parser", () => ({
  default: vi.fn().mockImplementation(() => ({
    parseURL: vi.fn().mockResolvedValue({
      title: "중도",
      items: [
        {
          guid: "post-naver",
          title: "빨대효과로 서울로 돈이 더 몰릴것.Ver.2",
          contentSnippet: "빨대효과로 서울로 돈이 더 몰릴것. ... 이런 글.......",
          link: "https://blog.naver.com/withnesta/224320643438?fromRss=true",
          isoDate: "2026-06-19T10:40:00Z",
        },
      ],
    }),
  })),
}));

const { RssConnector } = await import("../../src/connectors/rss.js");

describe("RssConnector + Naver blog scraping", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the truncated body with the scraped full post", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html; charset=UTF-8" },
      arrayBuffer: async () => new TextEncoder().encode(fixture).buffer,
    });

    const result = await new RssConnector(["https://rss.blog.naver.com/withnesta.xml"]).sync(null);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].body).toContain("이런 글을 2020년 6월 19일에 썼다");
    expect(result.items[0].body.length).toBeGreaterThan(500);
  });

  it("falls back to the RSS preview when the fetch fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    const result = await new RssConnector(["https://rss.blog.naver.com/withnesta.xml"]).sync(null);
    expect(result.items[0].body).toBe("빨대효과로 서울로 돈이 더 몰릴것. ... 이런 글.......");
  });
});

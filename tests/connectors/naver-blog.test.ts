import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseNaverBlogUrl,
  isNaverBlogUrl,
  extractNaverBlogBody,
} from "../../src/connectors/naver-blog.js";

const fixture = readFileSync(
  fileURLToPath(new URL("../fixtures/naver-blog-mobile.html", import.meta.url)),
  "utf8"
);

describe("parseNaverBlogUrl", () => {
  it("parses desktop blog URLs with query params", () => {
    expect(
      parseNaverBlogUrl("https://blog.naver.com/withnesta/224320643438?fromRss=true")
    ).toEqual({ blogId: "withnesta", logNo: "224320643438" });
  });

  it("parses mobile blog URLs", () => {
    expect(parseNaverBlogUrl("https://m.blog.naver.com/withnesta/224320643438")).toEqual({
      blogId: "withnesta",
      logNo: "224320643438",
    });
  });

  it("returns null for non-blog URLs", () => {
    expect(parseNaverBlogUrl("https://example.com/post-1")).toBeNull();
    expect(parseNaverBlogUrl("https://blog.naver.com/withnesta")).toBeNull();
    expect(parseNaverBlogUrl(undefined)).toBeNull();
  });
});

describe("isNaverBlogUrl", () => {
  it("detects Naver blog post URLs", () => {
    expect(isNaverBlogUrl("https://blog.naver.com/withnesta/224320643438")).toBe(true);
    expect(isNaverBlogUrl("https://example.com/post-1")).toBe(false);
  });
});

describe("extractNaverBlogBody", () => {
  it("extracts the full post text, well beyond the RSS preview", () => {
    const body = extractNaverBlogBody(fixture);
    expect(body).toBeTruthy();
    // Content that appears only after the RSS truncation point ("이런 글.......")
    expect(body).toContain("이런 글을 2020년 6월 19일에 썼다");
    expect(body).toContain("매매가격 상승률 TOP10");
  });

  it("does not leak the hidden social-plugin JSON that sits after the container", () => {
    const body = extractNaverBlogBody(fixture);
    expect(body).not.toContain("social_plugin");
    expect(body).not.toContain('"blogName"');
  });

  it("strips embedded link-preview cards (se-oglink)", () => {
    const body = extractNaverBlogBody(fixture)!;
    // The card duplicated the post heading and injected a truncated summary +
    // a standalone domain line. After stripping, the heading appears once...
    expect((body.match(/빨대효과로 서울로 돈이 더 몰릴것\./g) ?? []).length).toBe(1);
    // ...the truncated-with-ellipsis summary is gone...
    expect(body).not.toContain("핵심지역으…");
    expect(body).not.toMatch(/(^|\n)m\.blog\.naver\.com(\n|$)/);
    // ...but the author's actual typed link and prose remain.
    expect(body).toContain("https://m.blog.naver.com/withnesta/222005627780");
    expect(body).toContain("이런 글을 2020년 6월 19일에 썼다");
  });

  it("returns null when no post container is present", () => {
    expect(extractNaverBlogBody("<html><body>nothing here</body></html>")).toBeNull();
  });
});

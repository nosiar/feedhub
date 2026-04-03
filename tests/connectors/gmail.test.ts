import { describe, it, expect, vi } from "vitest";

const mockList = vi.fn().mockResolvedValue({
  data: {
    messages: [{ id: "msg-1" }, { id: "msg-2" }],
  },
});
const mockGet = vi.fn().mockImplementation(({ id }: { id: string }) =>
  Promise.resolve({
    data: {
      id,
      payload: {
        headers: [
          { name: "Subject", value: `Subject ${id}` },
          { name: "From", value: `sender-${id}@example.com` },
          { name: "Date", value: "Thu, 03 Apr 2026 10:00:00 +0000" },
        ],
      },
      snippet: `Snippet for ${id}`,
    },
  })
);

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    gmail: vi.fn().mockReturnValue({
      users: {
        messages: {
          list: mockList,
          get: mockGet,
        },
      },
    }),
  },
}));

const { GmailConnector } = await import("../../src/connectors/gmail.js");

describe("GmailConnector", () => {
  it("fetches messages and converts to FeedItem", async () => {
    const connector = new GmailConnector({
      clientId: "test",
      clientSecret: "test",
      redirectUri: "http://localhost",
      refreshToken: "test",
    });
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      source: "gmail",
      title: "Subject msg-1",
      author: "sender-msg-1@example.com",
    });
  });

  it("passes cursor as query for after date", async () => {
    const connector = new GmailConnector({
      clientId: "test",
      clientSecret: "test",
      redirectUri: "http://localhost",
      refreshToken: "test",
    });
    await connector.sync("2026-04-01T00:00:00Z");
    const listCall = mockList.mock.calls[1][0];
    expect(listCall.q).toContain("after:");
  });
});

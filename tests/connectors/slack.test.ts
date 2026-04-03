import { describe, it, expect, vi } from "vitest";

const mockConversationsList = vi.fn().mockResolvedValue({
  channels: [
    { id: "C001", name: "general" },
    { id: "C002", name: "engineering" },
  ],
});

const mockConversationsHistory = vi.fn().mockResolvedValue({
  messages: [
    { ts: "1743674400.000001", text: "Hello from Slack", user: "U001" },
    { ts: "1743674500.000002", text: "Another message", user: "U002" },
  ],
});

const mockUsersInfo = vi.fn().mockImplementation(({ user }: { user: string }) =>
  Promise.resolve({
    user: { real_name: `User ${user}` },
  })
);

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    conversations: {
      list: mockConversationsList,
      history: mockConversationsHistory,
    },
    users: {
      info: mockUsersInfo,
    },
  })),
}));

const { SlackConnector } = await import("../../src/connectors/slack.js");

describe("SlackConnector", () => {
  it("fetches channel messages and converts to FeedItem", async () => {
    const connector = new SlackConnector("xoxb-test-token");
    const result = await connector.sync(null);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      source: "slack",
      body: expect.any(String),
      author: expect.stringContaining("User"),
    });
  });

  it("uses cursor as oldest param", async () => {
    const connector = new SlackConnector("xoxb-test-token");
    await connector.sync("1743674400");
    const historyCall = mockConversationsHistory.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).oldest === "1743674400"
    );
    expect(historyCall).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

mockExecFile.mockImplementation(
  (_cmd: string, args: readonly string[] | undefined, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error | null, stdout: string) => void;
    const argsArr = args as string[];
    if (argsArr[0] === "chats") {
      callback(
        null,
        JSON.stringify([
          {
            id: "chat-1",
            display_name: "Dev Team",
            type: "group",
            member_count: 5,
          },
        ])
      );
    } else if (argsArr[0] === "messages") {
      callback(
        null,
        JSON.stringify([
          {
            id: "100",
            chat_id: "chat-1",
            sender_id: "user-1",
            sender: "Kim",
            text: "Hello",
            type: "text",
            is_from_me: false,
            timestamp: "2026-04-03T10:00:00Z",
          },
        ])
      );
    }
    return {} as ReturnType<typeof execFile>;
  }
);

const { KakaotalkConnector } = await import("../../src/connectors/kakaotalk.js");

describe("KakaotalkConnector", () => {
  it("fetches chats and messages as FeedItems", async () => {
    const connector = new KakaotalkConnector("kakaocli");
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      source: "kakaotalk",
      title: "Dev Team",
      body: "Hello",
      author: "Kim",
    });
  });
});

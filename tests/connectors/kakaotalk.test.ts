import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

mockExecFile.mockImplementation(
  (_cmd: string, _args: readonly string[] | undefined, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error | null, stdout: string) => void;
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
    return {} as ReturnType<typeof execFile>;
  }
);

const { KakaotalkConnector } = await import("../../src/connectors/kakaotalk.js");

describe("KakaotalkConnector", () => {
  beforeEach(() => vi.clearAllMocks());
  it("fetches messages for configured chats", async () => {
    const connector = new KakaotalkConnector("kakaocli", [
      { id: "chat-1", name: "Dev Team" },
    ]);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      source: "kakaotalk",
      title: "Dev Team",
      body: "Hello",
      author: "Kim",
    });
  });

  it("fetches multiple chats in parallel", async () => {
    const connector = new KakaotalkConnector("kakaocli", [
      { id: "chat-1", name: "A" },
      { id: "chat-2", name: "B" },
    ]);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(2);
    expect(mockExecFile).toHaveBeenCalledTimes(2);
  });

  it("returns empty when no chats configured", async () => {
    const connector = new KakaotalkConnector("kakaocli", []);
    const result = await connector.sync(null);
    expect(result.items).toHaveLength(0);
  });
});

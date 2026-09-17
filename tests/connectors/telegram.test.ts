import { describe, it, expect, vi, beforeEach } from "vitest";
import { Api } from "telegram/tl/index.js";

const mockGetMessages = vi.fn();

vi.mock("telegram", () => ({
  TelegramClient: vi.fn().mockImplementation(() => ({
    connected: true,
    connect: vi.fn().mockResolvedValue(undefined),
    getMessages: mockGetMessages,
    getDialogs: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("telegram/sessions/index.js", () => ({
  StringSession: vi.fn().mockImplementation(() => ({})),
}));

const { TelegramConnector } = await import("../../src/connectors/telegram.js");

const photo = () => new Api.MessageMediaPhoto({ photo: new Api.PhotoEmpty({ id: 0n }) });

function albumMessage(id: number, groupedId: bigint, text = "") {
  return {
    id,
    groupedId,
    text,
    date: 1757571769,
    media: photo(),
    sender: { title: "채널" },
    replies: undefined,
  };
}

function connector() {
  return new TelegramConnector({
    apiId: 1,
    apiHash: "hash",
    session: "session",
    chats: [{ id: "-100123", name: "채널" }],
  });
}

beforeEach(() => {
  mockGetMessages.mockReset();
});

describe("TelegramConnector album grouping", () => {
  it("groups album members sharing a groupedId into one item", async () => {
    const album = [1, 2, 3].map((i) => albumMessage(100 + i, 7n, i === 1 ? "캡션" : ""));
    mockGetMessages.mockResolvedValue(album);

    const { items } = await connector().sync(null);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("-100123_101");
    expect(items[0].metadata.imageUrls).toHaveLength(3);
  });

  it("completes an album truncated by the refresh window instead of emitting a suffix", async () => {
    // The refresh window only reaches back to id 103, cutting the album 101..105
    // in half. The older members are still fetchable by id.
    const album = [101, 102, 103, 104, 105].map((id) => albumMessage(id, 7n, id === 101 ? "캡션" : ""));
    mockGetMessages.mockImplementation((_chat: string, opts: Record<string, unknown>) => {
      if (opts.ids) {
        const ids = opts.ids as number[];
        return Promise.resolve(ids.map((id) => album.find((m) => m.id === id) ?? new Api.MessageEmpty({ id })));
      }
      return Promise.resolve(album.filter((m) => m.id >= 103));
    });

    const { items } = await connector().sync(null);

    expect(items).toHaveLength(1);
    // Not "-100123_103": a partial album must never claim its own feed id.
    expect(items[0].id).toBe("-100123_101");
    expect(items[0].metadata.imageUrls).toHaveLength(5);
    expect(items[0].body).toBe("캡션");
  });

  it("keeps walking back for an album longer than one lookback block", async () => {
    // Telegram caps an album at 10 today, but the walk must not depend on that:
    // here 14 members are visible only from id 111 up.
    const album = Array.from({ length: 14 }, (_, i) =>
      albumMessage(101 + i, 7n, i === 0 ? "캡션" : "")
    );
    mockGetMessages.mockImplementation((_chat: string, opts: Record<string, unknown>) => {
      if (opts.ids) {
        const ids = opts.ids as number[];
        return Promise.resolve(
          ids.map((id) => album.find((m) => m.id === id) ?? new Api.MessageEmpty({ id }))
        );
      }
      return Promise.resolve(album.filter((m) => m.id >= 111));
    });

    const { items } = await connector().sync(null);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("-100123_101");
    expect(items[0].metadata.imageUrls).toHaveLength(14);
    // One block back reaches 101..110, a second proves nothing older belongs.
    expect(mockGetMessages.mock.calls.filter((c) => (c[1] as Record<string, unknown>)?.ids)).toHaveLength(2);
  });

  it("does not refetch when the oldest fetched message is not part of an album", async () => {
    mockGetMessages.mockResolvedValue([albumMessage(200, undefined as unknown as bigint, "단일")]);

    await connector().sync(null);

    expect(mockGetMessages.mock.calls.some((c) => (c[1] as Record<string, unknown>)?.ids)).toBe(false);
  });
});

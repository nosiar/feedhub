import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import bigInt from "big-integer";
import { Api } from "telegram/tl/index.js";

const mockGetMessages = vi.fn();
const mockInvoke = vi.fn();

vi.mock("telegram", () => ({
  TelegramClient: vi.fn().mockImplementation(() => ({
    connected: true,
    connect: vi.fn().mockResolvedValue(undefined),
    getMessages: mockGetMessages,
    invoke: mockInvoke,
  })),
}));

vi.mock("telegram/sessions/index.js", () => ({
  StringSession: vi.fn().mockImplementation(() => ({})),
}));

process.env.TELEGRAM_SESSION = "session";
process.env.TELEGRAM_API_ID = "1";
process.env.TELEGRAM_API_HASH = "hash";

const { telegramRoutes } = await import("../../src/server/routes/telegram.js");

const OPTIONS = ["a", "b", "c"];

function poll(opts: { multipleChoice?: boolean; closed?: boolean } = {}) {
  return new Api.Poll({
    id: bigInt(1) as unknown as Api.long,
    question: new Api.TextWithEntities({ text: "질문", entities: [] }),
    answers: OPTIONS.map((key, i) => new Api.PollAnswer({
      text: new Api.TextWithEntities({ text: `답${i}`, entities: [] }),
      option: Buffer.from(key),
    })),
    multipleChoice: opts.multipleChoice ?? false,
    closed: opts.closed ?? false,
  });
}

function results(chosenKeys: string[] = []) {
  return new Api.PollResults({
    results: OPTIONS.map((key) => new Api.PollAnswerVoters({
      option: Buffer.from(key),
      voters: chosenKeys.includes(key) ? 1 : 0,
      chosen: chosenKeys.includes(key),
    })),
    totalVoters: chosenKeys.length,
    min: false,
  });
}

function pollMessage(p = poll(), r = results()) {
  return { id: 5, media: new Api.MessageMediaPoll({ poll: p, results: r }) };
}

function sentOptions(): string[] {
  const req = mockInvoke.mock.calls[0]?.[0] as Api.messages.SendVote;
  return req.options.map((b) => Buffer.from(b).toString());
}

describe("GET /api/telegram/poll/:chatId/:msgId", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    telegramRoutes(app);
    await app.ready();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { mockGetMessages.mockReset(); mockInvoke.mockReset(); });

  it("tells the client whether the poll takes several answers", async () => {
    mockGetMessages.mockResolvedValue([pollMessage(poll({ multipleChoice: true }))]);

    const res = await app.inject({ method: "GET", url: "/api/telegram/poll/-100123/5" });

    expect(res.json().multipleChoice).toBe(true);
  });
});

describe("POST /api/telegram/poll/:chatId/:msgId/vote", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    telegramRoutes(app);
    await app.ready();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    mockGetMessages.mockReset();
    mockInvoke.mockReset();
  });

  function vote(options: number[]) {
    return app.inject({
      method: "POST",
      url: "/api/telegram/poll/-100123/5/vote",
      payload: { options },
    });
  }

  it("sends the option bytes behind the chosen indexes", async () => {
    mockGetMessages.mockResolvedValue([pollMessage(poll({ multipleChoice: true }))]);
    mockInvoke.mockResolvedValue(new Api.Updates({
      updates: [new Api.UpdateMessagePoll({
        pollId: bigInt(1) as unknown as Api.long,
        results: results(["a", "c"]),
      })],
      users: [], chats: [], date: 0, seq: 0,
    }));

    const res = await vote([0, 2]);

    expect(res.statusCode).toBe(200);
    expect(sentOptions()).toEqual(["a", "c"]);
  });

  it("answers with the updated results, shaped like the poll endpoint", async () => {
    mockGetMessages.mockResolvedValue([pollMessage(poll({ multipleChoice: true }))]);
    mockInvoke.mockResolvedValue(new Api.Updates({
      updates: [new Api.UpdateMessagePoll({
        pollId: bigInt(1) as unknown as Api.long,
        results: results(["a"]),
      })],
      users: [], chats: [], date: 0, seq: 0,
    }));

    const res = await vote([0]);

    expect(res.json()).toMatchObject({
      question: "질문",
      totalVoters: 1,
      answers: [
        { text: "답0", voters: 1, chosen: true },
        { text: "답1", voters: 0, chosen: false },
        { text: "답2", voters: 0, chosen: false },
      ],
    });
  });

  it("refuses a second option on a single-choice poll", async () => {
    mockGetMessages.mockResolvedValue([pollMessage(poll({ multipleChoice: false }))]);

    const res = await vote([0, 1]);

    expect(res.statusCode).toBe(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("refuses voting on a closed poll", async () => {
    mockGetMessages.mockResolvedValue([pollMessage(poll({ closed: true }))]);

    const res = await vote([0]);

    expect(res.statusCode).toBe(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("refuses voting again once the account has voted", async () => {
    mockGetMessages.mockResolvedValue([pollMessage(poll(), results(["b"]))]);

    const res = await vote([0]);

    expect(res.statusCode).toBe(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("refuses an index outside the answer list", async () => {
    mockGetMessages.mockResolvedValue([pollMessage()]);

    const res = await vote([7]);

    expect(res.statusCode).toBe(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("refuses an empty selection", async () => {
    mockGetMessages.mockResolvedValue([pollMessage()]);

    const res = await vote([]);

    expect(res.statusCode).toBe(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("reports a telegram rejection as a bad request, not a crash", async () => {
    mockGetMessages.mockResolvedValue([pollMessage()]);
    mockInvoke.mockRejectedValue(new Error("POLL_OPTION_INVALID"));

    const res = await vote([0]);

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("POLL_OPTION_INVALID");
  });
});

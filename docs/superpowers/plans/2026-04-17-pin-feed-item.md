# Pin Feed Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pin feed items so they are protected from both single-item dismiss (X / `D` / `X` key) and "Dismiss All" until explicitly unpinned.

**Architecture:** New `pinned: boolean` field in the `feed_items` MongoDB collection with a `$setOnInsert` default. New `PUT /api/feed/pin` endpoint to toggle the flag. The existing `DELETE /api/feed/dismiss` route gains a guard that returns `409` when the item is pinned (so Gmail/Naver trash is not called either). Frontend adds a pin button on each FeedCard, a keyboard shortcut `P`, hides the X on pinned cards, and skips pinned items when executing "Dismiss All".

**Tech Stack:** TypeScript, Fastify, MongoDB, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-17-pin-feed-item-design.md`

---

## File Structure

**Backend — create/modify:**
- Modify: `src/connectors/types.ts` — add `pinned?: boolean` to `FeedItem`.
- Modify: `src/db/feed-repo.ts` — `$setOnInsert.pinned: false` in `upsertFeedItems`; new `setPinned` and `getFeedItem` functions.
- Create: `src/server/routes/pin.ts` — `PUT /api/feed/pin` route factory.
- Modify: `src/server/routes/dismiss.ts` — guard against pinned items (read first, return 409).
- Modify: `src/server/app.ts` — register `pinRoutes`.

**Backend — tests:**
- Modify: `tests/db/feed-repo.test.ts` — tests for `setPinned` and `$setOnInsert.pinned: false`.
- Create: `tests/server/pin.test.ts` — tests for `PUT /api/feed/pin`.
- Create: `tests/server/dismiss.test.ts` — tests for the pinned-guard on `DELETE /api/feed/dismiss`.

**Frontend — modify:**
- Modify: `web/src/api.ts` — add `pinned?: boolean` to `FeedItem`; new `pinFeedItem(source, id, pinned)`.
- Modify: `web/src/components/FeedCard.tsx` — pin button, hide X when pinned, new `onTogglePin` prop.
- Modify: `web/src/components/FeedList.tsx` — thread `onTogglePin` through.
- Modify: `web/src/App.tsx` — `pinnedOverrides` optimistic layer, `handleTogglePin`, exclude pinned from `handleDismissAll`, guard `handleDismiss`, keyboard `P`.
- Modify: `web/src/components/KeyboardHelp.tsx` — add `P` shortcut row.

---

## Task 1: Add `pinned` field to `FeedItem` type

**Files:**
- Modify: `src/connectors/types.ts`

- [ ] **Step 1: Add the field to the interface**

Edit `src/connectors/types.ts` — change the `FeedItem` interface:

```ts
export interface FeedItem {
  id: string;
  source: SourceType;
  title: string;
  body: string;
  author: string;
  url?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  pinned?: boolean;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (There may be pre-existing errors unrelated to this change; only confirm nothing new.)

- [ ] **Step 3: Commit**

```bash
git add src/connectors/types.ts
git commit -m "feat: add optional pinned flag to FeedItem type"
```

---

## Task 2: `setPinned` + `getFeedItem` repo functions with default insert

**Files:**
- Modify: `src/db/feed-repo.ts`
- Test: `tests/db/feed-repo.test.ts`

- [ ] **Step 1: Add the failing tests**

Edit `tests/db/feed-repo.test.ts` — append these test blocks inside the top-level `describe("feed-repo", ...)`:

```ts
describe("upsertFeedItems pinned default", () => {
  it("sets pinned: false on insert only", async () => {
    const items: FeedItem[] = [
      {
        id: "rss-2",
        source: "rss",
        title: "T",
        body: "B",
        author: "A",
        timestamp: new Date("2026-04-17"),
        metadata: {},
      },
    ];
    await upsertFeedItems(items);
    const ops = mockCollection.bulkWrite.mock.calls[0][0];
    expect(ops[0].updateOne.update.$setOnInsert).toEqual({
      dismissed: false,
      pinned: false,
    });
  });
});

describe("setPinned", () => {
  it("updates the pinned flag for the given item", async () => {
    const updateOne = vi.fn().mockResolvedValue({});
    mockCollection.updateOne = updateOne;
    const { setPinned } = await import("../../src/db/feed-repo.js");
    await setPinned("rss", "rss-3", true);
    expect(updateOne).toHaveBeenCalledWith(
      { source: "rss", id: "rss-3" },
      { $set: { pinned: true } }
    );
  });
});

describe("getFeedItem", () => {
  it("returns the single matching item or null", async () => {
    const findOne = vi.fn().mockResolvedValue({ source: "rss", id: "rss-4", pinned: true });
    mockCollection.findOne = findOne;
    const { getFeedItem } = await import("../../src/db/feed-repo.js");
    const result = await getFeedItem("rss", "rss-4");
    expect(findOne).toHaveBeenCalledWith({ source: "rss", id: "rss-4" });
    expect(result?.pinned).toBe(true);
  });
});
```

Also add `updateOne: vi.fn(),` and `findOne: vi.fn(),` to the `mockCollection` object at the top of the file:

```ts
const mockCollection = {
  bulkWrite: vi.fn().mockResolvedValue({ upsertedCount: 2 }),
  find: vi.fn(),
  countDocuments: vi.fn().mockResolvedValue(0),
  updateOne: vi.fn(),
  findOne: vi.fn(),
};
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/db/feed-repo.test.ts`
Expected: FAIL — the new `setPinned` and `getFeedItem` functions don't exist, and `$setOnInsert` only contains `dismissed`.

- [ ] **Step 3: Implement the changes in `feed-repo.ts`**

Edit `src/db/feed-repo.ts` — update `upsertFeedItems` and add the two new functions:

```ts
export async function upsertFeedItems(
  items: FeedItem[]
): Promise<{ upserted: number; modified: number }> {
  if (items.length === 0) return { upserted: 0, modified: 0 };
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const ops = items.map((item) => ({
    updateOne: {
      filter: { source: item.source, id: item.id },
      update: {
        $set: item,
        $setOnInsert: { dismissed: false, pinned: false },
      },
      upsert: true,
    },
  }));
  const result = await col.bulkWrite(ops);
  return {
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

export async function setPinned(
  source: SourceType,
  id: string,
  pinned: boolean
): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { source, id },
    { $set: { pinned } }
  );
}

export async function getFeedItem(
  source: SourceType,
  id: string
): Promise<FeedItem | null> {
  const db = await getDb();
  const doc = await db
    .collection<FeedItem>(COLLECTION)
    .findOne({ source, id });
  return doc ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/db/feed-repo.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/db/feed-repo.ts tests/db/feed-repo.test.ts
git commit -m "feat: add setPinned and getFeedItem; default pinned to false"
```

---

## Task 3: `PUT /api/feed/pin` route

**Files:**
- Create: `src/server/routes/pin.ts`
- Modify: `src/server/app.ts`
- Test: `tests/server/pin.test.ts`

- [ ] **Step 1: Add the failing test**

Create `tests/server/pin.test.ts`:

```ts
// tests/server/pin.test.ts
import { describe, it, expect, vi, afterAll } from "vitest";

const setPinned = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  closeDb: vi.fn(),
}));

vi.mock("../../src/db/feed-repo.js", () => ({
  queryFeed: vi.fn().mockResolvedValue([]),
  searchFeed: vi.fn().mockResolvedValue([]),
  setPinned,
  getFeedItem: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/db/indexes.js", () => ({ ensureIndexes: vi.fn() }));
vi.mock("../../src/db/settings-repo.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ rssFeeds: [], kakaoChats: [] }),
  saveSettings: vi.fn(),
}));

const { buildApp } = await import("../../src/server/app.js");

describe("Pin API", () => {
  const app = buildApp(new Map(), () => {});
  afterAll(async () => { await app.close(); });

  it("PUT /api/feed/pin sets pinned flag", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/feed/pin",
      payload: { source: "rss", id: "rss-1", pinned: true },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
    expect(setPinned).toHaveBeenCalledWith("rss", "rss-1", true);
  });

  it("PUT /api/feed/pin can unpin", async () => {
    setPinned.mockClear();
    const res = await app.inject({
      method: "PUT",
      url: "/api/feed/pin",
      payload: { source: "rss", id: "rss-1", pinned: false },
    });
    expect(res.statusCode).toBe(200);
    expect(setPinned).toHaveBeenCalledWith("rss", "rss-1", false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/pin.test.ts`
Expected: FAIL — route doesn't exist (404) or import fails because `pin.ts` isn't created yet.

- [ ] **Step 3: Create the route file**

Create `src/server/routes/pin.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { SourceType } from "../../connectors/types.js";
import { setPinned } from "../../db/feed-repo.js";

interface PinBody {
  source: SourceType;
  id: string;
  pinned: boolean;
}

export function pinRoutes(app: FastifyInstance): void {
  app.put<{ Body: PinBody }>("/api/feed/pin", async (req, reply) => {
    const { source, id, pinned } = req.body;
    if (!source || !id || typeof pinned !== "boolean") {
      return reply.status(400).send({ error: "invalid body" });
    }
    await setPinned(source, id, pinned);
    return { ok: true };
  });
}
```

- [ ] **Step 4: Register the route in `app.ts`**

Edit `src/server/app.ts` — add the import and the registration call:

Add near the other route imports:

```ts
import { pinRoutes } from "./routes/pin.js";
```

Add in `buildApp` after `dismissRoutes(app, connectors);`:

```ts
  pinRoutes(app);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/server/pin.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/pin.ts src/server/app.ts tests/server/pin.test.ts
git commit -m "feat: add PUT /api/feed/pin endpoint"
```

---

## Task 4: Guard `DELETE /api/feed/dismiss` against pinned items

**Files:**
- Modify: `src/server/routes/dismiss.ts`
- Test: `tests/server/dismiss.test.ts`

- [ ] **Step 1: Add the failing test**

Create `tests/server/dismiss.test.ts`:

```ts
// tests/server/dismiss.test.ts
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

const dismissFeedItem = vi.fn().mockResolvedValue(undefined);
const getFeedItem = vi.fn();

vi.mock("../../src/db/client.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  closeDb: vi.fn(),
}));

vi.mock("../../src/db/feed-repo.js", () => ({
  queryFeed: vi.fn().mockResolvedValue([]),
  searchFeed: vi.fn().mockResolvedValue([]),
  setPinned: vi.fn(),
  getFeedItem,
  dismissFeedItem,
}));

vi.mock("../../src/db/indexes.js", () => ({ ensureIndexes: vi.fn() }));
vi.mock("../../src/db/settings-repo.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ rssFeeds: [], kakaoChats: [] }),
  saveSettings: vi.fn(),
}));

const { buildApp } = await import("../../src/server/app.js");

describe("Dismiss API pinned guard", () => {
  const app = buildApp(new Map(), () => {});
  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    dismissFeedItem.mockClear();
    getFeedItem.mockReset();
  });

  it("DELETE /api/feed/dismiss dismisses unpinned items", async () => {
    getFeedItem.mockResolvedValue({ source: "rss", id: "rss-1", pinned: false });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/feed/dismiss?source=rss&id=rss-1",
    });
    expect(res.statusCode).toBe(200);
    expect(dismissFeedItem).toHaveBeenCalledWith("rss", "rss-1");
  });

  it("DELETE /api/feed/dismiss returns 409 for pinned items and does not dismiss", async () => {
    getFeedItem.mockResolvedValue({ source: "rss", id: "rss-2", pinned: true });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/feed/dismiss?source=rss&id=rss-2",
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).error).toBe("pinned");
    expect(dismissFeedItem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/dismiss.test.ts`
Expected: FAIL — the second test fails because the route currently calls `dismissFeedItem` unconditionally.

- [ ] **Step 3: Add the guard in `dismiss.ts`**

Edit `src/server/routes/dismiss.ts` — replace the body with:

```ts
import type { FastifyInstance } from "fastify";
import type { Connector, SourceType } from "../../connectors/types.js";
import { dismissFeedItem, getFeedItem } from "../../db/feed-repo.js";
import { GmailConnector } from "../../connectors/gmail.js";
import { NaverMailConnector } from "../../connectors/naver-mail.js";

export function dismissRoutes(
  app: FastifyInstance,
  connectors: Map<SourceType, Connector>
): void {
  app.delete("/api/feed/dismiss", async (req, reply) => {
    const { source, id } = req.query as { source: string; id: string };

    const existing = await getFeedItem(source as SourceType, id);
    if (existing?.pinned) {
      return reply.status(409).send({ error: "pinned" });
    }

    if (source === "gmail") {
      const gmail = connectors.get("gmail");
      if (gmail instanceof GmailConnector) {
        await gmail.trash(id);
      }
    }

    if (source === "naver") {
      const naver = connectors.get("naver");
      if (naver instanceof NaverMailConnector) {
        const parts = id.split("_");
        const uid = parseInt(parts.pop()!, 10);
        const folder = parts.slice(1).join("_");
        await naver.trash(folder, uid);
      }
    }

    await dismissFeedItem(source as SourceType, id);
    return { ok: true };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/dismiss.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite to catch regressions**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/dismiss.ts tests/server/dismiss.test.ts
git commit -m "feat: guard dismiss route against pinned items"
```

---

## Task 5: Frontend API client — `pinFeedItem`

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Add `pinned` to the `FeedItem` type and the function**

Edit `web/src/api.ts`:

Update the `FeedItem` interface:

```ts
export interface FeedItem {
  id: string;
  source: "gmail" | "kakaotalk" | "slack" | "rss" | "telegram" | "youtube" | "naver";
  title: string;
  body: string;
  author: string;
  url?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  pinned?: boolean;
}
```

Add near `dismissFeedItem`:

```ts
export async function pinFeedItem(
  source: string,
  id: string,
  pinned: boolean
): Promise<void> {
  const res = await fetch(`${BASE}/feed/pin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, id, pinned }),
  });
  if (!res.ok) {
    throw new Error(`pin failed: ${res.status}`);
  }
}
```

- [ ] **Step 2: Typecheck the web project**

Run: `cd web && npx tsc --noEmit && cd ..`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/api.ts
git commit -m "feat: add pinFeedItem API client"
```

---

## Task 6: FeedCard — pin button + hide X when pinned

**Files:**
- Modify: `web/src/components/FeedCard.tsx`

- [ ] **Step 1: Add `onTogglePin` prop and render logic**

Edit `web/src/components/FeedCard.tsx` — update the `FeedCard` props and the action-area JSX.

Change the signature (line ~606):

```tsx
export function FeedCard({ item, defaultExpanded, onDelete, onTogglePin, focused, expanded: expandedProp, cardRef, onToggleExpand }: {
  item: FeedItem;
  defaultExpanded?: boolean;
  onDelete?: (item: FeedItem) => void;
  onTogglePin?: (item: FeedItem) => void;
  focused?: boolean;
  expanded?: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  onToggleExpand?: () => void;
}) {
```

Add near `handleDismiss`:

```tsx
  const handleTogglePin = (e: MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.(item);
  };
```

Replace the top-row action area (currently renders the ✕ span) so it has a pin icon and hides the ✕ when pinned:

```tsx
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            onClick={handleTogglePin}
            style={{
              cursor: "pointer",
              opacity: item.pinned ? 1 : 0.5,
              fontSize: 14,
              filter: item.pinned ? "none" : "grayscale(1)",
            }}
            title={item.pinned ? "고정 해제" : "고정"}
          >
            📌
          </span>
          {!item.pinned && (
            <span
              onClick={handleDismiss}
              style={{ cursor: "pointer", opacity: 0.6, fontSize: 14 }}
              title={isEmail ? "휴지통으로 이동" : "피드에서 숨기기"}
            >
              ✕
            </span>
          )}
          {isExpandable && (expanded ? "▲" : "▼")}{" "}
          <span title={new Date(item.timestamp).toLocaleString("ko-KR", { hour12: false })}>{timeAgo(item.timestamp)}</span>
        </span>
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit && cd ..`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/FeedCard.tsx
git commit -m "feat: add pin button on FeedCard; hide dismiss when pinned"
```

---

## Task 7: FeedList — thread `onTogglePin` prop through

**Files:**
- Modify: `web/src/components/FeedList.tsx`

- [ ] **Step 1: Replace `FeedList.tsx` with the updated version**

Replace the full file contents of `web/src/components/FeedList.tsx` with:

```tsx
import { useEffect, useRef, createRef } from "react";
import type { FeedItem } from "../api.js";
import { FeedCard } from "./FeedCard.js";

export function FeedList({
  items,
  loading,
  onLoadMore,
  hasMore,
  expandAll,
  onDelete,
  onTogglePin,
  focusedIndex,
  expandedIndex,
  onToggleExpand,
}: {
  items: FeedItem[];
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  expandAll?: boolean;
  onDelete?: (item: FeedItem) => void;
  onTogglePin?: (item: FeedItem) => void;
  focusedIndex?: number;
  expandedIndex?: number | null;
  onToggleExpand?: (index: number) => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, React.RefObject<HTMLDivElement | null>>>(new Map());

  items.forEach((_, i) => {
    if (!cardRefs.current.has(i)) {
      cardRefs.current.set(i, createRef<HTMLDivElement>());
    }
  });

  useEffect(() => {
    if (!sentinel.current || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) onLoadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    if (focusedIndex == null) return;
    const ref = cardRefs.current.get(focusedIndex);
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedIndex]);

  if (items.length === 0 && !loading) {
    return <p style={{ textAlign: "center", color: "#999" }}>No items</p>;
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={`${item.source}-${item.id}`} style={{ position: "relative" }}>
          {hasMore && i === items.length - 3 && (
            <div ref={sentinel} style={{ position: "absolute", top: 0, height: 1 }} />
          )}
          <FeedCard
            item={item}
            defaultExpanded={expandAll}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
            focused={focusedIndex === i}
            expanded={expandedIndex === i ? true : undefined}
            cardRef={cardRefs.current.get(i)}
            onToggleExpand={() => onToggleExpand?.(i)}
          />
        </div>
      ))}
      {loading && (
        <p style={{ textAlign: "center", color: "#999" }}>Loading...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit && cd ..`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/FeedList.tsx
git commit -m "feat: thread onTogglePin through FeedList"
```

---

## Task 8: App — optimistic pin state, dismiss-all filter, keyboard `P`

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add the `pinnedOverrides` state and derived getter**

Edit `web/src/App.tsx`. Add the import:

```ts
import { triggerSync, dismissFeedItem, pinFeedItem, type FeedItem } from "./api.js";
```

Add inside `App()` near the other `useState` hooks (alongside `dismissedItems`):

```ts
  const [pinnedOverrides, setPinnedOverrides] = useState<Map<string, boolean>>(new Map());

  const isPinned = useCallback(
    (item: FeedItem) => {
      const key = `${item.source}-${item.id}`;
      const override = pinnedOverrides.get(key);
      return override ?? !!item.pinned;
    },
    [pinnedOverrides]
  );
```

- [ ] **Step 2: Add `handleTogglePin` with optimistic update**

Add (next to `handleDismiss`):

```ts
  const handleTogglePin = useCallback(
    (item: FeedItem) => {
      const key = `${item.source}-${item.id}`;
      const next = !isPinned(item);
      setPinnedOverrides((prev) => {
        const map = new Map(prev);
        map.set(key, next);
        return map;
      });
      pinFeedItem(item.source, item.id, next).catch(() => {
        setPinnedOverrides((prev) => {
          const map = new Map(prev);
          map.set(key, !next);
          return map;
        });
      });
    },
    [isPinned]
  );
```

- [ ] **Step 3: Guard `handleDismiss` and filter `handleDismissAll`**

Replace `handleDismiss` with:

```ts
  const handleDismiss = useCallback((item: FeedItem) => {
    if (isPinned(item)) return;

    // Cancel previous pending dismiss
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      // Execute previous dismiss immediately
      if (toast) {
        dismissFeedItem(toast.item.source, toast.item.id);
      }
    }

    // Hide from UI immediately
    const key = `${item.source}-${item.id}`;
    setDismissedItems((prev) => new Set(prev).add(key));
    setToast({ item });

    // Adjust focusedIndex: compute dismissed item's position from current items
    setFocusedIndex((prev) => {
      const currentVisible = items.filter((i) => !dismissedItems.has(`${i.source}-${i.id}`) && `${i.source}-${i.id}` !== key);
      if (prev >= currentVisible.length) return Math.max(currentVisible.length - 1, 0);
      return prev;
    });

    // Schedule server dismiss
    dismissTimer.current = setTimeout(() => {
      dismissFeedItem(item.source, item.id);
      setToast(null);
      dismissTimer.current = null;
    }, UNDO_DELAY);
  }, [toast, items, dismissedItems, isPinned]);
```

Replace `handleDismissAll`:

```ts
  const handleDismissAll = useCallback(() => {
    const dismissible = visibleItems.filter((i) => !isPinned(i));
    const pinnedCount = visibleItems.length - dismissible.length;
    if (dismissible.length === 0) return;
    const suffix = pinnedCount > 0 ? ` (고정 ${pinnedCount}개 제외)` : "";
    if (!confirm(`${dismissible.length}개 항목을 모두 숨길까요?${suffix}`)) return;
    setDismissedItems((prev) => {
      const next = new Set(prev);
      for (const item of dismissible) next.add(`${item.source}-${item.id}`);
      return next;
    });
    for (const item of dismissible) {
      dismissFeedItem(item.source, item.id);
    }
    setFocusedIndex(-1);
    setExpandedIndex(null);
  }, [visibleItems, isPinned]);
```

- [ ] **Step 4: Expose current pin state to FeedList**

Below `const visibleItems = ...`, build a decorated list that reflects the optimistic overrides, and pass that to `<FeedList>`:

```ts
  const decoratedItems = visibleItems.map((i) => {
    const key = `${i.source}-${i.id}`;
    const override = pinnedOverrides.get(key);
    return override === undefined ? i : { ...i, pinned: override };
  });
```

Change the `<FeedList ... items={visibleItems} ... />` call site to use `decoratedItems` and pass `onTogglePin`:

```tsx
      <FeedList
        items={decoratedItems}
        loading={loading}
        onLoadMore={loadMore}
        hasMore={!!cursor}
        expandAll={expandAll}
        onDelete={handleDismiss}
        onTogglePin={handleTogglePin}
        focusedIndex={focusedIndex}
        expandedIndex={expandedIndex}
        onToggleExpand={(i) => { setFocusedIndex(i); setExpandedIndex((prev) => (prev === i ? null : i)); }}
      />
```

- [ ] **Step 5: Add the `P` keyboard shortcut**

Inside the keyboard `handler` (next to the `KeyD`/`KeyX` branches), add:

```ts
      } else if (code === "KeyP" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
          handleTogglePin(visibleItems[focusedIndex]);
        }
```

Add `handleTogglePin` to the `useEffect` dependency array for the keyboard listener.

- [ ] **Step 6: Typecheck**

Run: `cd web && npx tsc --noEmit && cd ..`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: pin toggle, dismiss-all skip pinned, keyboard P shortcut"
```

---

## Task 9: KeyboardHelp — document `P`

**Files:**
- Modify: `web/src/components/KeyboardHelp.tsx`

- [ ] **Step 1: Add the shortcut row**

Edit `web/src/components/KeyboardHelp.tsx` — insert a new entry in the `SHORTCUTS` array (between `d / x` and `v`):

```ts
const SHORTCUTS = [
  { key: "j / k", desc: "다음 / 이전 아이템" },
  { key: "Enter / o", desc: "펼치기 / 접기" },
  { key: "d / x", desc: "삭제 (실행취소 가능)" },
  { key: "p", desc: "고정 / 고정 해제" },
  { key: "v", desc: "링크 새 탭에서 열기" },
  { key: "Esc", desc: "접기" },
  { key: "e", desc: "전체 펼치기 / 접기" },
  { key: "Shift+D", desc: "현재 탭 전체 삭제" },
  { key: "1 ~ 6", desc: "소스 탭 전환" },
  { key: "?", desc: "단축키 도움말" },
];
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit && cd ..`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/KeyboardHelp.tsx
git commit -m "docs: list P shortcut in keyboard help"
```

---

## Task 10: Run full test suite + manual verification

- [ ] **Step 1: Full backend test suite**

Run: `npm test`
Expected: all tests pass (including the two new server test files and the expanded feed-repo tests).

- [ ] **Step 2: Start the dev server and the web client**

In one terminal: `npm run dev`
In another: `npm run dev:web`

Open http://localhost:5173.

- [ ] **Step 3: Manual scenarios**

Verify each:

1. Click the 📌 icon on an RSS item → icon becomes colored/filled; X disappears on that card.
2. Refresh the page → the item is still pinned (state persisted in MongoDB).
3. Click "Dismiss All" while a pinned item is in the current filter → confirm dialog says `N개 항목을 모두 숨길까요? (고정 M개 제외)`. Confirm → the pinned item remains; others are dismissed.
4. Focus the pinned item (`j`/`k`) and press `P` → unpins (icon goes muted, X reappears).
5. Focus the pinned item and press `D` → nothing happens (guard).
6. Pin a Gmail item → click X is unavailable. Unpin → X reappears and clicking it trashes the email as before.
7. Open `?` help modal → the `p` shortcut row is listed.

- [ ] **Step 4: Final commit if any follow-up tweaks were needed**

If manual testing surfaced issues not covered by the plan, fix them, rerun tests, commit with a descriptive message. Otherwise no commit needed.

---

## Done Criteria

- `pinned` persists in MongoDB across re-syncs.
- `PUT /api/feed/pin` toggles the flag; `DELETE /api/feed/dismiss` returns 409 for pinned items.
- FeedCard shows the pin icon and hides X when pinned.
- `handleDismissAll` skips pinned items; confirm dialog reflects the excluded count.
- Keyboard `P` toggles pin on the focused item.
- Full `npm test` passes.

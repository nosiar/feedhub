# Pin Feed Item — Design

## Summary

Users can pin feed items so they are never dismissed — neither by clicking X on the card, nor by "Dismiss All" — until the user explicitly unpins them. Pinned items keep their chronological position in the feed.

## Goals

- Protect specific items from both single and bulk dismiss actions.
- Persist pin state across browsers and re-syncs.
- Simple, discoverable UI affordance with a keyboard shortcut.

## Non-Goals

- Reordering pinned items to the top of the feed.
- Cross-device sync beyond what MongoDB already provides.
- Bulk pin/unpin actions.
- A separate "Pinned" filter tab (out of scope for v1).

## Data Model

Add a `pinned: boolean` field to documents in the `feed_items` MongoDB collection.

Upsert behavior in `upsertFeedItems` (`src/db/feed-repo.ts`) gains `pinned: false` in `$setOnInsert` alongside the existing `dismissed: false`. Re-sync does not overwrite `pinned` on existing items.

No new index required — queries still filter on `dismissed`, and pin is a per-document read.

## Backend Changes

### New endpoint: `PUT /api/feed/pin`

Body: `{ source: SourceType, id: string, pinned: boolean }`.
Sets `pinned` to the given value for that item. Returns `{ ok: true }`.

Implementation: `setPinned(source, id, pinned)` in `feed-repo.ts`, invoked from a new `pinRoutes` handler registered alongside `dismissRoutes`.

### Dismiss guard

`DELETE /api/feed/dismiss` reads the item first. If `pinned === true`, responds `409 Conflict` with `{ error: "pinned" }` and does NOT call Gmail/Naver trash. This is defensive: the UI hides the X on pinned items, but trash is an irreversible external action, so the backend enforces the invariant too.

### Item shape

`FeedItem` interface in `src/connectors/types.ts` gains `pinned?: boolean` (optional so connector constructors don't need to set it; DB defaults handle persistence).

## Frontend Changes

### Types & API

- `FeedItem` in `web/src/api.ts` gains `pinned?: boolean`.
- New `pinFeedItem(source, id, pinned)` in `web/src/api.ts`.

### FeedCard (`web/src/components/FeedCard.tsx`)

- Add a pin icon (📌) button always visible in the card's action area, next to where the X sits today.
  - Filled/colored when `item.pinned === true`.
  - Outline/muted when not pinned.
- When `item.pinned === true`, the X (dismiss) button is not rendered.
- Clicking the pin icon calls the parent's `onTogglePin(item)` handler.

### App (`web/src/App.tsx`)

- New `handleTogglePin(item)`:
  - Optimistically flips `pinned` in local state.
  - Calls `pinFeedItem(source, id, nextValue)`.
  - On error, reverts and shows a brief error toast.
- `handleDismiss(item)` becomes a no-op if `item.pinned === true` (guard for keyboard `D`/`X` on a focused pinned item).
- `handleDismissAll`:
  - Filters `visibleItems` to exclude pinned items before confirming.
  - Confirm text: `"N개 항목을 모두 숨길까요?"`, with ` (고정 M개 제외)` appended when at least one visible item is pinned.
  - Only dismisses the non-pinned subset.
- Keyboard shortcut `P`:
  - When `focusedIndex` points at a visible item, toggles that item's pin via `handleTogglePin`.
  - Uses `e.code === "KeyP"` for IME-independent detection, matching existing patterns.
- Local optimistic pin state lives inline on the item (the local `items` list is re-derived from `useFeed`, so toggling calls `reload()` or mutates via a ref — see "Open details" below).

### Keyboard help

Add `P — Pin/unpin focused item` to `web/src/components/KeyboardHelp.tsx`.

## Data Flow

1. User clicks pin icon (or presses `P`) on an item.
2. Frontend optimistically updates the item's `pinned` flag in local state.
3. `PUT /api/feed/pin` is sent.
4. Server updates MongoDB.
5. On error, the frontend reverts and toasts.
6. Subsequent `Dismiss All` / single dismiss actions and their Gmail/Naver trash calls skip any pinned item.

## Error Handling

- **Network failure on pin toggle:** revert local state, show toast `"고정 상태 변경 실패"`.
- **Dismiss guard triggers (409):** shouldn't happen from the UI, but if it does, log to console and no-op.
- **Re-sync:** pin state is preserved by `$setOnInsert` (only sets the default on first insert).

## Testing

Add Vitest unit tests:

- `tests/feed-repo.test.ts` (extend if present): `setPinned` sets the flag; `upsertFeedItems` preserves pin on existing docs and defaults to `false` on insert.
- `tests/routes-pin.test.ts` (new): `PUT /api/feed/pin` toggles the flag.
- `tests/routes-dismiss.test.ts` (new or extend): dismissing a pinned item returns 409 and does not call Gmail trash.

Frontend: manual verification via the dev server — pin a Gmail item, try dismiss all, confirm it's skipped; try clicking X (should be hidden); try keyboard `P`.

## Open Details (decide at implementation time)

- Exact icon rendering (emoji vs SVG, filled vs outline styling). Start with emoji + subtle color change to match the existing card's minimal style.
- Whether `handleTogglePin` mutates the shared `items` array from `useFeed` in place or via a new optimistic layer (like `dismissedItems: Set<string>`). A small `pinnedOverrides: Map<string, boolean>` mirrors the `dismissedItems` pattern and avoids touching `useFeed`.

## Rollout

Single PR. No migration needed — MongoDB documents without `pinned` are treated as not pinned (frontend reads `item.pinned === true`; backend `setPinned` writes the field; dismiss guard reads `pinned === true`).

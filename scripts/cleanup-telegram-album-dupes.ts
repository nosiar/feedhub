import "dotenv/config";
import { getDb, closeDb } from "../src/db/client.js";

/**
 * Removes telegram feed items that hold only a subset of another item's album.
 *
 * Before the refresh-window fix, an album sliced by the 100-message window was
 * emitted as its own feed item keyed on the oldest *visible* member, so the same
 * album could land in the DB several times, each copy holding a shorter tail.
 * Those copies are unreachable by the connector now — nothing will ever update
 * or replace them — so they have to be deleted once.
 *
 * A copy can hold as little as one photo, when the window left only the album's
 * last member visible, so single-image items have to be examined too. A message
 * belongs to exactly one album, so an item whose photos all appear in a longer
 * item is always a copy of it.
 */

const DRY_RUN = !process.argv.includes("--apply");

interface AlbumItem {
  _id: unknown;
  id: string;
  chatId: string;
  msgIds: number[];
  pinned: boolean;
}

function msgIdsOf(imageUrls: string[]): number[] {
  return imageUrls
    .map((u) => parseInt(u.slice(u.lastIndexOf("/") + 1), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

async function main(): Promise<void> {
  const db = await getDb();
  const docs = await db
    .collection("feed_items")
    .find({ source: "telegram", "metadata.imageUrls.0": { $exists: true } })
    .toArray();

  const byChat = new Map<string, AlbumItem[]>();
  for (const doc of docs) {
    const meta = doc.metadata as { chatId?: string; imageUrls?: string[] };
    if (!meta?.chatId || !meta.imageUrls) continue;
    const item: AlbumItem = {
      _id: doc._id,
      id: doc.id as string,
      chatId: meta.chatId,
      msgIds: msgIdsOf(meta.imageUrls),
      pinned: doc.pinned === true,
    };
    const bucket = byChat.get(item.chatId);
    if (bucket) bucket.push(item);
    else byChat.set(item.chatId, [item]);
  }

  let deleted = 0;
  let keptPinned = 0;

  for (const items of byChat.values()) {
    for (const item of items) {
      const superset = items.find(
        (other) =>
          other !== item
          && other.msgIds.length > item.msgIds.length
          && item.msgIds.every((n) => other.msgIds.includes(n))
      );
      if (!superset) continue;

      // A pinned duplicate is something the user deliberately kept; leave it
      // alone rather than making a pin disappear.
      if (item.pinned) {
        console.log(`[skip-pinned] ${item.id} (${item.msgIds.length}) ⊂ ${superset.id} (${superset.msgIds.length})`);
        keptPinned++;
        continue;
      }

      console.log(
        `[${DRY_RUN ? "dry" : "apply"}] ${item.id} (${item.msgIds.length} imgs) ⊂ ${superset.id} (${superset.msgIds.length} imgs)`
      );
      if (!DRY_RUN) {
        await db.collection("feed_items").deleteOne({ _id: item._id });
      }
      deleted++;
    }
  }

  console.log("");
  console.log(`Album items scanned: ${docs.length}`);
  console.log(`Partial duplicates ${DRY_RUN ? "found" : "deleted"}: ${deleted}`);
  console.log(`Pinned duplicates left in place: ${keptPinned}`);
  if (DRY_RUN) console.log("(dry-run; pass --apply to delete)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

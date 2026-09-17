import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { getDb, closeDb } from "../src/db/client.js";
import { config } from "../src/config.js";
import type { FileAttachment } from "../src/connectors/types.js";

/**
 * Moves feed items from a single `fileAttachment` to a `fileAttachments` list,
 * then merges telegram document albums that were split across several items.
 *
 * A telegram album is a run of messages sharing a groupedId, and each document
 * lives on its own member. The connector used to keep only the first, so an
 * album of two PDFs could surface as two items holding one file each. Grouping
 * is decided by asking Telegram for the real groupedId rather than by guessing
 * from timestamps.
 */

const DRY_RUN = !process.argv.includes("--apply");
const TELEGRAM_ID_BATCH = 100;

interface ItemDoc {
  _id: unknown;
  id: string;
  pinned?: boolean;
  metadata: {
    chatId?: string;
    messageId?: number;
    fileAttachment?: FileAttachment;
    fileAttachments?: FileAttachment[];
  };
}

function attachmentsOf(doc: ItemDoc): FileAttachment[] {
  if (Array.isArray(doc.metadata.fileAttachments)) return doc.metadata.fileAttachments;
  return doc.metadata.fileAttachment ? [doc.metadata.fileAttachment] : [];
}

async function migrateToList(): Promise<number> {
  const db = await getDb();
  const docs = (await db
    .collection("feed_items")
    .find({ "metadata.fileAttachment": { $exists: true } })
    .toArray()) as unknown as ItemDoc[];

  for (const doc of docs) {
    console.log(`[${DRY_RUN ? "dry" : "apply"}] ${doc.id} → fileAttachments(1)`);
    if (DRY_RUN) continue;
    await db.collection("feed_items").updateOne(
      { _id: doc._id },
      {
        $set: { "metadata.fileAttachments": attachmentsOf(doc) },
        $unset: { "metadata.fileAttachment": "" },
      }
    );
  }
  return docs.length;
}

async function groupedIdsFor(
  client: TelegramClient,
  chatId: string,
  messageIds: number[]
): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  for (let i = 0; i < messageIds.length; i += TELEGRAM_ID_BATCH) {
    const batch = messageIds.slice(i, i + TELEGRAM_ID_BATCH);
    const msgs = await client.getMessages(chatId, { ids: batch });
    for (const m of msgs) {
      if (m?.groupedId) found.set(m.id, m.groupedId.toString());
    }
  }
  return found;
}

async function mergeTelegramAlbums(): Promise<{ merged: number; deleted: number }> {
  const db = await getDb();
  const docs = (await db
    .collection("feed_items")
    .find({
      source: "telegram",
      $or: [
        { "metadata.fileAttachment": { $exists: true } },
        { "metadata.fileAttachments": { $exists: true } },
      ],
    })
    .toArray()) as unknown as ItemDoc[];

  const byChat = new Map<string, ItemDoc[]>();
  for (const doc of docs) {
    const chatId = doc.metadata.chatId;
    if (!chatId || typeof doc.metadata.messageId !== "number") continue;
    const bucket = byChat.get(chatId);
    if (bucket) bucket.push(doc);
    else byChat.set(chatId, [doc]);
  }

  const client = new TelegramClient(
    new StringSession(config.telegram.session),
    config.telegram.apiId,
    config.telegram.apiHash,
    { connectionRetries: 3 }
  );
  await client.connect();

  let merged = 0;
  let deleted = 0;
  try {
    for (const [chatId, items] of byChat) {
      const grouped = await groupedIdsFor(
        client,
        chatId,
        items.map((i) => i.metadata.messageId as number)
      );

      const albums = new Map<string, ItemDoc[]>();
      for (const item of items) {
        const albumId = grouped.get(item.metadata.messageId as number);
        if (!albumId) continue;
        const bucket = albums.get(albumId);
        if (bucket) bucket.push(item);
        else albums.set(albumId, [item]);
      }

      for (const album of albums.values()) {
        if (album.length < 2) continue;
        album.sort((a, b) => (a.metadata.messageId as number) - (b.metadata.messageId as number));
        const [survivor, ...dupes] = album;

        const files: FileAttachment[] = [];
        const seenUrls = new Set<string>();
        for (const item of album) {
          for (const f of attachmentsOf(item)) {
            if (seenUrls.has(f.fileUrl)) continue;
            seenUrls.add(f.fileUrl);
            files.push(f);
          }
        }
        // A pin on any copy is a pin the user set on this album; keep it.
        const pinned = album.some((i) => i.pinned === true);

        console.log(
          `[${DRY_RUN ? "dry" : "apply"}] ${survivor.id} ← ${files.length} files, drops ${dupes.map((d) => d.id).join(" ")}${pinned ? " (pinned)" : ""}`
        );
        merged++;
        deleted += dupes.length;
        if (DRY_RUN) continue;

        await db.collection("feed_items").updateOne(
          { _id: survivor._id },
          {
            $set: { "metadata.fileAttachments": files, pinned },
            $unset: { "metadata.fileAttachment": "" },
          }
        );
        await db
          .collection("feed_items")
          .deleteMany({ _id: { $in: dupes.map((d) => d._id) } });
      }
    }
  } finally {
    await client.disconnect();
  }
  return { merged, deleted };
}

async function main(): Promise<void> {
  console.log("— 1단계: fileAttachment → fileAttachments —");
  const moved = await migrateToList();
  console.log("— 2단계: 텔레그램 문서 앨범 병합 —");
  const { merged, deleted } = await mergeTelegramAlbums();

  console.log("");
  console.log(`Moved to list: ${moved}`);
  console.log(`Albums merged: ${merged}`);
  console.log(`Duplicate items ${DRY_RUN ? "to delete" : "deleted"}: ${deleted}`);
  if (DRY_RUN) console.log("(dry-run; pass --apply to write)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

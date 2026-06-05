import "dotenv/config";
import { getDb, closeDb } from "../src/db/client.js";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm"]);

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  txt: "text/plain",
  csv: "text/csv",
};

function extOf(url: string): string {
  try {
    const path = new URL(url).pathname;
    const dot = path.lastIndexOf(".");
    if (dot < 0) return "";
    return path.slice(dot + 1).toLowerCase();
  } catch {
    return "";
  }
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const slash = path.lastIndexOf("/");
    return slash < 0 ? path : path.slice(slash + 1);
  } catch {
    return "file";
  }
}

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const db = await getDb();
  const cursor = db.collection("feed_items").find({
    source: "kakaotalk",
    "metadata.imageUrls.0": { $regex: "^https://" },
  });

  let scanned = 0;
  let videoCount = 0;
  let fileCount = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    scanned++;
    const meta = (doc.metadata ?? {}) as Record<string, unknown>;
    const urls = (meta.imageUrls as string[] | undefined) ?? [];
    const body = (doc.body as string | undefined) ?? "";

    const nextImageUrls: string[] = [];
    let videoUrl: string | undefined = meta.videoUrl as string | undefined;
    let fileAttachment = meta.fileAttachment as
      | { fileName: string; mimeType: string; fileUrl: string; fileSize?: number }
      | undefined;

    for (const url of urls) {
      if (url.startsWith("/api/kakao/image/")) {
        nextImageUrls.push(url);
        continue;
      }
      const ext = extOf(url);
      if (IMAGE_EXTS.has(ext) || ext === "") {
        nextImageUrls.push(url);
      } else if (VIDEO_EXTS.has(ext)) {
        if (!videoUrl) videoUrl = url;
      } else {
        if (!fileAttachment) {
          fileAttachment = {
            fileName: body.trim() || fileNameFromUrl(url),
            mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
            fileUrl: url,
          };
        }
      }
    }

    const sameLength = nextImageUrls.length === urls.length;
    const sameVideo = videoUrl === (meta.videoUrl as string | undefined);
    const sameFile = fileAttachment === meta.fileAttachment;
    if (sameLength && sameVideo && sameFile) {
      skipped++;
      continue;
    }

    const set: Record<string, unknown> = { "metadata.imageUrls": nextImageUrls };
    const unset: Record<string, ""> = {};
    if (videoUrl && videoUrl !== meta.videoUrl) {
      set["metadata.videoUrl"] = videoUrl;
      videoCount++;
    }
    if (fileAttachment && fileAttachment !== meta.fileAttachment) {
      set["metadata.fileAttachment"] = fileAttachment;
      fileCount++;
    }

    console.log(
      `[${DRY_RUN ? "dry" : "apply"}] ${String(doc._id)} body=${JSON.stringify(body).slice(0, 40)} → imageUrls(${nextImageUrls.length})${videoUrl ? " +videoUrl" : ""}${fileAttachment ? " +fileAttachment" : ""}`,
    );

    if (!DRY_RUN) {
      const update: Record<string, unknown> = { $set: set };
      if (Object.keys(unset).length > 0) update.$unset = unset;
      await db.collection("feed_items").updateOne({ _id: doc._id }, update);
    }
  }

  console.log("");
  console.log(`Scanned: ${scanned}`);
  console.log(`Skipped (already clean): ${skipped}`);
  console.log(`Videos migrated: ${videoCount}`);
  console.log(`Files migrated: ${fileCount}`);
  if (DRY_RUN) console.log("(dry-run; pass without --dry-run to apply)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

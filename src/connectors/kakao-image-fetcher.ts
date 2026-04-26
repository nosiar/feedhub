import sharp from "sharp";
import { insertKakaoImage } from "../db/kakao-images-repo.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_DIM = 1280;
const WEBP_QUALITY = 78;

export interface FetchInput {
  url: string;
  feedItemId: string;
  chatId: string;
  pinned: boolean;
}

export async function fetchAndStoreImage(input: FetchInput): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(input.url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.warn(`[kakao-image] fetch ${res.status} for ${input.feedItemId}`);
      return null;
    }
    const srcBuf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(srcBuf, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    const id = await insertKakaoImage({
      feedItemId: input.feedItemId,
      chatId: input.chatId,
      originalUrl: input.url,
      data,
      mime: "image/webp",
      width: info.width,
      height: info.height,
      pinned: input.pinned,
    });
    return `/api/kakao/image/${id}`;
  } catch (err) {
    console.warn(`[kakao-image] error for ${input.feedItemId}: ${(err as Error).message}`);
    return null;
  }
}

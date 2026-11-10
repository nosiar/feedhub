import cron from "node-cron";
import { purgeDismissedFeedItems } from "./db/feed-repo.js";

export const DISMISSED_RETENTION_MONTHS = 1;

export async function runPurge(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - DISMISSED_RETENTION_MONTHS);
  return purgeDismissedFeedItems(cutoff);
}

async function purgeAndLog(): Promise<void> {
  try {
    const n = await runPurge();
    console.log(`[purge] Deleted ${n} dismissed items`);
  } catch (err) {
    console.error("[purge] failed:", err);
  }
}

export function startPurgeScheduler(): cron.ScheduledTask {
  void purgeAndLog();
  return cron.schedule("0 4 * * *", purgeAndLog);
}

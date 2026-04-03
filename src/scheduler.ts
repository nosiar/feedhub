// src/scheduler.ts
import cron from "node-cron";
import type { Connector, SourceType } from "./connectors/types.js";
import { runSync } from "./server/routes/sync.js";

export function startScheduler(
  connectors: Map<SourceType, Connector>,
  intervalMinutes: number
): cron.ScheduledTask {
  const expression = `*/${intervalMinutes} * * * *`;
  const task = cron.schedule(expression, async () => {
    console.log(`[scheduler] Starting sync at ${new Date().toISOString()}`);
    for (const [name, connector] of connectors) {
      try {
        const { count } = await runSync(connector);
        console.log(`[scheduler] ${name}: synced ${count} items`);
      } catch (err) {
        console.error(`[scheduler] ${name} sync failed:`, err);
      }
    }
  });
  console.log(`[scheduler] Running every ${intervalMinutes} minutes`);
  return task;
}

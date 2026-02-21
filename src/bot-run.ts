import { run } from "./kalshi/bot";
import { appendMonitorLogWithTimestamp } from "./core/monitor-logger";
import { validateRequiredEnvOrExit } from "./core/validate-env";

validateRequiredEnvOrExit();

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(err);
  appendMonitorLogWithTimestamp(`Fatal: ${msg}`);
  process.exit(1);
});

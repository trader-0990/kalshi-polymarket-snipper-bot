/**
 * Monitor entrypoint: dual price monitor (Kalshi + Polymarket) with arb.
 */
import { startDualPriceMonitor, formatDualPricesLine } from "./dual-monitor";
import { checkArbAndPlaceOrders } from "./arb";
import { warmPolymarketClient, getPolymarketBalanceUsd } from "../polymarket/order";
import { primePolymarketTokenCacheForCurrentSlot } from "../polymarket/prices";
import { warmKalshiOrdersApi, getKalshiBalanceCents } from "../kalshi/bot";
import { appendMonitorLog } from "../core/monitor-logger";
import { acquireMonitorLock, releaseMonitorLock } from "../core/monitor-lock";
import { validateRequiredEnvOrExit } from "../core/validate-env";
import { MIN_BALANCE_USD } from "../core/config";

async function checkBalancesOrExit(): Promise<void> {
  const minCents = Math.round(MIN_BALANCE_USD * 100);
  const [kalshiCents, polyUsd] = await Promise.all([
    getKalshiBalanceCents(),
    getPolymarketBalanceUsd(),
  ]);
  const kalshiOk = kalshiCents >= minCents;
  const polyConfigured = polyUsd !== null;
  const polyOk = !polyConfigured || (polyUsd >= MIN_BALANCE_USD);

  if (!kalshiOk || !polyOk) {
    const kalshiStr = `Kalshi $${(kalshiCents / 100).toFixed(2)}`;
    const polyStr = polyConfigured ? `Polymarket $${polyUsd.toFixed(2)}` : "Polymarket (not configured)";
    console.error(
      `[Balance] Below minimum $${MIN_BALANCE_USD}. ${kalshiStr}, ${polyStr}. Stopping.`
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateRequiredEnvOrExit();
  acquireMonitorLock();
  await checkBalancesOrExit();

  const intervalMs = parseInt(
    process.env.KALSHI_MONITOR_INTERVAL_MS ?? "200",
    10
  );
  const ticker = process.env.KALSHI_MONITOR_TICKER;
  const restartOnQuarterHour =
    process.env.KALSHI_MONITOR_NO_RESTART !== "true" && process.env.KALSHI_MONITOR_NO_RESTART !== "1";

  console.log(
    `Starting dual price monitor (Kalshi + Polymarket, poll every ${intervalMs}ms${ticker ? ` ticker=${ticker}` : ", first open BTC up/down market"}${restartOnQuarterHour && !ticker ? ", restart process at :00/:15/:30/:45" : ""})...`
  );

  warmPolymarketClient();
  warmKalshiOrdersApi();
  await primePolymarketTokenCacheForCurrentSlot("btc");

  const stop = await startDualPriceMonitor({
    kalshiTicker: ticker || undefined,
    intervalMs,
    restartProcessOnQuarterHour: restartOnQuarterHour,
    onPrices: (p) => {
      checkArbAndPlaceOrders(p).catch((err: unknown) => {
        console.error("Arb error:", err);
      });
      const line = formatDualPricesLine(p);
      if (line != null) {
        console.log(line);
        appendMonitorLog(line, p.fetchedAt);
      }
    },
    onError: (err) => {
      console.error("Monitor error:", err);
    },
  });

  process.on("SIGINT", () => {
    console.log("\nStopping monitor...");
    stop();
    releaseMonitorLock();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

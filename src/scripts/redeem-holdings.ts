#!/usr/bin/env node
/**
 * Redeem all resolved Polymarket markets from data/token-holding.json.
 * Usage: npm run redeem-holdings [--dry-run] [--clear]
 */
import "dotenv/config";
import { autoRedeemResolvedMarkets } from "../polymarket/redeem";
import { getAllHoldings } from "../polymarket/holdings";
import { POLYMARKET_PRIVATE_KEY } from "../core/config";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const clear = args.includes("--clear");

  if (!POLYMARKET_PRIVATE_KEY) {
    console.error("POLYMARKET_PRIVATE_KEY is required for redeem.");
    process.exit(1);
  }

  const holdings = getAllHoldings();
  const conditionIds = Object.keys(holdings);
  if (conditionIds.length === 0) {
    console.log("No holdings in data/token-holding.json. Buy Polymarket tokens first (arb or place-poly-down).");
    process.exit(0);
  }

  console.log(`Checking ${conditionIds.length} condition(s) from holdings...`);
  const result = await autoRedeemResolvedMarkets({
    dryRun,
    clearHoldingsAfterRedeem: clear,
  });

  console.log(`Total: ${result.total} resolved: ${result.resolved} redeemed: ${result.redeemed} failed: ${result.failed}`);
  if (result.results.some((r) => r.error)) {
    result.results.filter((r) => r.error).forEach((r) => console.error(`  ${r.conditionId}: ${r.error}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

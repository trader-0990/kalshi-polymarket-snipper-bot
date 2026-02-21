#!/usr/bin/env node
/**
 * Redeem one Polymarket condition (by condition ID).
 * Usage: npm run redeem -- <conditionId>
 * Requires: POLYMARKET_PRIVATE_KEY, RPC_URL (or uses public Polygon RPC).
 */
import "dotenv/config";
import { redeemMarket, checkConditionResolution } from "../polymarket/redeem";
import { getMarketHoldings, getAllHoldings } from "../polymarket/holdings";
import { POLYMARKET_PRIVATE_KEY } from "../core/config";

async function main(): Promise<void> {
  const conditionId = process.argv[2]?.trim();

  if (!POLYMARKET_PRIVATE_KEY) {
    console.error("POLYMARKET_PRIVATE_KEY is required for redeem.");
    process.exit(1);
  }

  if (!conditionId) {
    console.log("Usage: npm run redeem -- <conditionId>");
    console.log("Example: npm run redeem -- 0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1");
    const holdings = getAllHoldings();
    const ids = Object.keys(holdings);
    if (ids.length > 0) {
      console.log("\nCondition IDs in data/token-holding.json:");
      ids.forEach((id) => console.log(" ", id));
    }
    process.exit(1);
  }

  const marketHoldings = getMarketHoldings(conditionId);
  if (Object.keys(marketHoldings).length > 0) {
    console.log("Holdings for this market:", marketHoldings);
  }

  const resolution = await checkConditionResolution(conditionId);
  console.log("Resolution:", resolution.isResolved ? resolution.reason : "Not resolved");
  if (!resolution.isResolved) {
    process.exit(1);
  }

  console.log("Redeeming...");
  const receipt = await redeemMarket(conditionId);
  console.log("Redeemed. Block:", receipt.blockNumber);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

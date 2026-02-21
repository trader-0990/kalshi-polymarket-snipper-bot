#!/usr/bin/env node
/**
 * Test script: buy UP token on current Bitcoin 15m Polymarket, wait 5s, then sell.
 * Usage: npx ts-node src/scripts/test-buy-sell-poly.ts
 * Requires: POLYMARKET_PRIVATE_KEY, POLYMARKET_PROXY in .env.
 */
import "dotenv/config";
import { getPolymarketAskPrices } from "../polymarket/prices";
import { placePolymarketOrder, sellPolymarketOrder } from "../polymarket/order";
import { POLYMARKET_MIN_USD } from "../core/config";

const DELAY_MS = 5000;

async function main(): Promise<void> {
  const market = "btc";
  const prices = await getPolymarketAskPrices(market);
  if (!prices) {
    console.error("Could not fetch Polymarket prices for current 15m slot.");
    process.exit(1);
  }

  const upTokenId = prices.upTokenId;
  const conditionId = prices.conditionId;
  const upAsk = prices.upAsk;
  const price = upAsk >= 0.99 ? 0.99 : Math.max(0.01, upAsk + 0.01);
  const minSize = POLYMARKET_MIN_USD > 0 ? Math.ceil(POLYMARKET_MIN_USD / price) : 1;
  const size = Math.max(1, minSize);

  console.log(`[Test] Slug: ${prices.slug}`);
  console.log(`[Test] UP token: ${upTokenId.slice(0, 20)}...`);
  console.log(`[Test] Best ask: ${upAsk.toFixed(3)} → buy @ ${price.toFixed(3)} x ${size}`);
  console.log(`[Test] Placing BUY UP...`);

  const buyResult = await placePolymarketOrder(upTokenId, price, size, {
    forcePlace: true,
    conditionId,
  });

  if (buyResult === null) {
    console.error("[Test] Polymarket not configured (missing POLYMARKET_PRIVATE_KEY or POLYMARKET_PROXY).");
    process.exit(1);
  }
  if ("error" in buyResult) {
    console.error("[Test] Buy failed:", buyResult.error);
    process.exit(1);
  }
  console.log("[Test] Buy placed:", buyResult.orderId);

  console.log(`[Test] Waiting ${DELAY_MS / 1000}s...`);
  await new Promise((r) => setTimeout(r, DELAY_MS));

  console.log("[Test] Placing SELL...");
  const sellResult = await sellPolymarketOrder(upTokenId, size, {
    forcePlace: true,
    conditionId,
  });

  if (sellResult === null) {
    console.error("[Test] Polymarket not configured.");
    process.exit(1);
  }
  if ("error" in sellResult) {
    console.error("[Test] Sell failed:", sellResult.error);
    process.exit(1);
  }
  console.log("[Test] Sell placed:", sellResult.orderId);
  console.log("[Test] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

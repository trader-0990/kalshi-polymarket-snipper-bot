/**
 * Cross-venue arb: detect when sum of opposite sides (Kalshi + Polymarket) is in
 * [ARB_SUM_LOW, ARB_SUM_THRESHOLD), log the opportunity, and place orders on both venues.
 * After a fill, if sum drops below ARB_SUM_LOW we sell both sides to limit mismatch loss.
 */
import type { DualMarketPrices } from "./dual-monitor";
import {
  ARB_SUM_LOW,
  ARB_SUM_THRESHOLD,
  ARB_PRICE_BUFFER,
  ARB_SIZE,
  ARB_KALSHI_MIN,
  ARB_POLY_MIN,
  POLYMARKET_MIN_USD,
  ARB_DRY_RUN,
} from "../core/config";
import { placeOrder, placeSellOrder } from "../kalshi/bot";
import {
  placePolymarketOrder,
  sellPolymarketOrder,
  type PlacePolyResult,
  type PlacePolymarketOrderOptions,
} from "../polymarket/order";
import { getBestAskForToken } from "../polymarket/prices";
import { appendMonitorLogWithTimestamp } from "../core/monitor-logger";

const FOK_RETRY_DELAY_MS = 200;

function isFokNotFilledError(err: string): boolean {
  return /couldn't be fully filled|FOK|FAK|fill.or.kill|fill.and.kill/i.test(err);
}

/** After FAK/FOK failure: wait 200ms, then retry once with current best ask + buffer. */
async function retryPolymarketFokAfter200ms(
  tokenId: string,
  size: number,
  options: PlacePolymarketOrderOptions
): Promise<PlacePolyResult> {
  await new Promise((r) => setTimeout(r, FOK_RETRY_DELAY_MS));
  const currentAsk = await getBestAskForToken(tokenId);
  const retryPrice = currentAsk != null ? Math.min(1, currentAsk + ARB_PRICE_BUFFER) : 0.99;
  const msg = `[Arb] Polymarket FAK failed; retrying 200ms later with price ${retryPrice.toFixed(3)} (ask=${currentAsk?.toFixed(3) ?? "?"})`;
  console.log(msg);
  appendMonitorLogWithTimestamp(msg);
  return await placePolymarketOrder(tokenId, retryPrice, size, options);
}

const upArbDoneTickers = new Set<string>();
const downArbDoneTickers = new Set<string>();

interface OpenArbPosition {
  leg: "UP" | "DOWN";
  kalshiSide: "yes" | "no";
  kalshiCount: number;
  polyTokenId: string;
  polySize: number;
}

const openArbPositions = new Map<string, OpenArbPosition>();

function inRange(sum: number): boolean {
  return Number.isFinite(sum) && sum >= ARB_SUM_LOW && sum < ARB_SUM_THRESHOLD;
}

async function exitArbPosition(ticker: string, pos: OpenArbPosition): Promise<void> {
  openArbPositions.delete(ticker);
  const msg = `[Arb] Sum < ARB_SUM_LOW (${ARB_SUM_LOW}); exiting ${pos.leg} leg: selling Kalshi ${pos.kalshiSide} x${pos.kalshiCount}, Poly token x${pos.polySize}`;
  console.log(msg);
  appendMonitorLogWithTimestamp(msg);
  const [kRes, pRes] = await Promise.all([
    placeSellOrder(ticker, pos.kalshiSide, pos.kalshiCount, { arbLive: true }),
    sellPolymarketOrder(pos.polyTokenId, pos.polySize, { forcePlace: true }),
  ]);
  if (kRes && "error" in kRes) appendMonitorLogWithTimestamp(`[Arb] Exit Kalshi sell failed: ${kRes.error}`);
  if (pRes && "error" in pRes) appendMonitorLogWithTimestamp(`[Arb] Exit Polymarket sell failed: ${pRes.error}`);
}

/**
 * Check for arb opportunity and place orders if sum is in [ARB_SUM_LOW, ARB_SUM_THRESHOLD).
 * Polymarket order is fired immediately (no await before it) so it can be placed within ~50ms of detection;
 * token IDs are primed at monitor start (primePolymarketTokenCacheForCurrentSlot).
 * If Poly FAK fails, we retry once 200ms later with current best ask + buffer.
 * If we have an open position and its sum drops below ARB_SUM_LOW, sell both sides immediately.
 * Leg 1: Kalshi UP + Polymarket DOWN. Leg 2: Kalshi DOWN + Polymarket UP.
 */
export async function checkArbAndPlaceOrders(p: DualMarketPrices): Promise<void> {
  if (!p.kalshi || !p.polymarket) return;
  const kalshiTicker = p.kalshiTicker;

  const kUp = p.kalshi.upAskCents / 100;
  const kDown = p.kalshi.downAskCents / 100;
  const polyUp = p.polymarket.upAsk;
  const polyDown = p.polymarket.downAsk;

  const sumUp = kUp + polyDown;
  const sumDown = kDown + polyUp;

  const pos = openArbPositions.get(kalshiTicker);
  if (pos) {
    const sum = pos.leg === "UP" ? sumUp : sumDown;
    if (Number.isFinite(sum) && sum < ARB_SUM_LOW) {
      await exitArbPosition(kalshiTicker, pos);
      return;
    }
  }

  const kalshiContracts = Math.max(ARB_KALSHI_MIN, Math.round(ARB_SIZE));
  const minUsd = POLYMARKET_MIN_USD > 0 ? POLYMARKET_MIN_USD : 1;

  if (inRange(sumUp)) {
    if (upArbDoneTickers.has(kalshiTicker)) return;
    upArbDoneTickers.add(kalshiTicker);

    const kalshiPriceCents = Math.round((kUp + ARB_PRICE_BUFFER) * 100);
    const polyPrice = Math.min(1, polyDown + ARB_PRICE_BUFFER);
    const polySizeUp = Math.max(ARB_POLY_MIN, ARB_SIZE, Math.ceil(minUsd / polyPrice));

    const detectedAt = Date.now();
    const msg = `[Arb] Opportunity (UP leg): sum=${sumUp.toFixed(3)} (Kalshi UP ${kUp.toFixed(2)} + Poly DOWN ${polyDown.toFixed(2)}) — ${ARB_DRY_RUN ? "DRY RUN, would place" : "placing"} Kalshi YES @ ${(kalshiPriceCents / 100).toFixed(2)}, Poly DOWN @ ${polyPrice.toFixed(3)} x${polySizeUp}`;

    if (!ARB_DRY_RUN) {
      const kPromise = placeOrder(kalshiTicker, "yes", kalshiContracts, kalshiPriceCents, { arbLive: true });
      const pPromise = placePolymarketOrder(p.polymarket.downTokenId, polyPrice, polySizeUp, { conditionId: p.polymarket.conditionId });
      const sentAt = Date.now();
      setImmediate(() => {
        const ms = sentAt - detectedAt;
        console.log(msg + ` (orders sent in ${ms}ms)`);
        appendMonitorLogWithTimestamp(msg + ` (orders sent in ${ms}ms)`);
      });
      let [kalshiResult, polyResult] = await Promise.all([kPromise, pPromise]);
      if (polyResult && "error" in polyResult) {
        appendMonitorLogWithTimestamp(`[Arb] Polymarket order failed: ${polyResult.error}`);
        if (isFokNotFilledError(polyResult.error)) {
          polyResult = await retryPolymarketFokAfter200ms(p.polymarket.downTokenId, polySizeUp, { conditionId: p.polymarket.conditionId });
        }
      }
      if ("error" in kalshiResult) {
        appendMonitorLogWithTimestamp(`[Arb] Kalshi order failed: ${kalshiResult.error}`);
      }
      if (!("error" in kalshiResult) && polyResult && !("error" in polyResult)) {
        openArbPositions.set(kalshiTicker, {
          leg: "UP",
          kalshiSide: "yes",
          kalshiCount: kalshiContracts,
          polyTokenId: p.polymarket.downTokenId,
          polySize: polySizeUp,
        });
      }
    } else {
      console.log(msg);
      appendMonitorLogWithTimestamp(msg);
    }
    return;
  }

  if (inRange(sumDown)) {
    if (downArbDoneTickers.has(kalshiTicker)) return;
    downArbDoneTickers.add(kalshiTicker);

    const kalshiPriceCents = Math.round((kDown + ARB_PRICE_BUFFER) * 100);
    const polyPrice = Math.min(1, polyUp + ARB_PRICE_BUFFER);
    const polySizeDown = Math.max(ARB_POLY_MIN, ARB_SIZE, Math.ceil(minUsd / polyPrice));

    const detectedAt = Date.now();
    const msg = `[Arb] Opportunity (DOWN leg): sum=${sumDown.toFixed(3)} (Kalshi DOWN ${kDown.toFixed(2)} + Poly UP ${polyUp.toFixed(2)}) — ${ARB_DRY_RUN ? "DRY RUN, would place" : "placing"} Kalshi NO @ ${(kalshiPriceCents / 100).toFixed(2)}, Poly UP @ ${polyPrice.toFixed(3)} x${polySizeDown}`;

    if (!ARB_DRY_RUN) {
      const kPromise = placeOrder(kalshiTicker, "no", kalshiContracts, kalshiPriceCents, { arbLive: true });
      const pPromise = placePolymarketOrder(p.polymarket.upTokenId, polyPrice, polySizeDown, { conditionId: p.polymarket.conditionId });
      const sentAt = Date.now();
      setImmediate(() => {
        const ms = sentAt - detectedAt;
        console.log(msg + ` (orders sent in ${ms}ms)`);
        appendMonitorLogWithTimestamp(msg + ` (orders sent in ${ms}ms)`);
      });
      let [kalshiResult, polyResult] = await Promise.all([kPromise, pPromise]);
      if (polyResult && "error" in polyResult) {
        appendMonitorLogWithTimestamp(`[Arb] Polymarket order failed: ${polyResult.error}`);
        if (isFokNotFilledError(polyResult.error)) {
          polyResult = await retryPolymarketFokAfter200ms(p.polymarket.upTokenId, polySizeDown, { conditionId: p.polymarket.conditionId });
        }
      }
      if ("error" in kalshiResult) {
        appendMonitorLogWithTimestamp(`[Arb] Kalshi order failed: ${kalshiResult.error}`);
      }
      if (!("error" in kalshiResult) && polyResult && !("error" in polyResult)) {
        openArbPositions.set(kalshiTicker, {
          leg: "DOWN",
          kalshiSide: "no",
          kalshiCount: kalshiContracts,
          polyTokenId: p.polymarket.upTokenId,
          polySize: polySizeDown,
        });
      }
    } else {
      console.log(msg);
      appendMonitorLogWithTimestamp(msg);
    }
  }
}

# Strategy: Kalshi 1.00 → Buy Same Side on Polymarket

Reference doc for a **follow-Kalshi** strategy: when Kalshi shows a side at 1.00, buy the same side on Polymarket (with guards), then exit if that side’s Poly price drops below a threshold.

---

## 1. Idea

- **Signal:** Kalshi UP or DOWN price reaches **1.00** (market is pricing that outcome as certain).
- **Action:** Buy the **same side** on Polymarket (e.g. Kalshi UP = 1.00 → buy Poly UP).
- **Guards:** Only enter if Poly same-side price is above a minimum; exit (sell) if Poly same-side price falls below a sell threshold.

---

## 2. Rules (for implementation)

### Entry

1. **Trigger:** Kalshi UP **or** Kalshi DOWN = **1.00** (use `>= 1.00` if needed).
2. **Same side:** If Kalshi UP = 1.00 → trade **Poly UP**; if Kalshi DOWN = 1.00 → trade **Poly DOWN**.
3. **Entry filter:** Only buy on Polymarket if the **same-side Poly price > `polyBuyMin`** (e.g. 0.85 or 0.90).  
   - Avoids buying when Poly is already cheap and disagrees with Kalshi.

### Exit

4. **Stop-loss:** If the **bought token’s Polymarket price** drops **below `polySellBelow`** (e.g. 0.75 or 0.80), **sell all** of that position immediately.
5. **Otherwise:** Hold until resolution (or your normal exit logic).

### Profit (per contract, for backtests)

- **No sell:** profit = `1 - trigger_price` (resolution at $1).
- **Sold:** profit = `sold_price - trigger_price`.

---

## 3. Parameters

| Parameter        | Meaning                              | Example range |
|-----------------|--------------------------------------|---------------|
| **polyBuyMin**  | Min Poly same-side price to allow buy | 0.80 – 0.95   |
| **polySellBelow**| Sell when Poly same-side price &lt; this | 0.75 – 0.85   |

### Simulation comparison (kalshi-log, 128 files)

| polyBuyMin | polySellBelow | buys | sold | held | sum_profit |
|------------|---------------|------|------|------|------------|
| 0.90       | 0.85          | 101  | 7    | 94   | 1.35       |
| 0.90       | 0.80          | 101  | 5    | 96   | 1.53       |
| 0.85       | 0.80          | 102  | 7    | 95   | 1.76       |
| **0.80**   | **0.75**      | 102  | 5    | 97   | **1.88**   |
| 0.90       | 0.75          | 101  | 3    | 98   | 1.08       |
| 0.85       | 0.75          | 102  | 5    | 97   | 0.94       |

- **Best in this backtest:** `polyBuyMin = 0.80`, `polySellBelow = 0.75` → sum profit **1.88**.
- Tuning is data-dependent; re-run the simulation when you add more logs.

---

## 4. Simulation script

- **Path:** `scripts/simulate-kalshi-1-then-poly.ts`
- **Log dir:** `kalshi-log/` (override with `KALSHI_LOG_DIR`).

**Commands:**

```bash
# Single run (default params in script)
npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Custom params
POLY_BUY_MIN=0.85 POLY_SELL_BELOW=0.80 npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Compare the 6 pairs above
COMPARE=1 npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Optimize over a grid
OPTIMIZE=1 npx ts-node scripts/simulate-kalshi-1-then-poly.ts
```

---

## 5. Implementation

- **Run:** `npm run kalshi-1-poly` (or `npx ts-node src/monitor/run-kalshi-1-poly.ts`).
- **Config (env):** `POLY_BUY_MIN` (default 0.8), `POLY_SELL_BELOW` (default 0.7), `KALSHI_1_POLY_SIZE` (default 5), `KALSHI_1_POLY_DRY_RUN` (optional).
- **Logic:** `src/monitor/kalshi-1-poly-strategy.ts` — same dual price monitor; if position and Poly same-side &lt; polySellBelow → sell; else if no position and Kalshi side ≥ 1.00 and Poly same-side &gt; polyBuyMin → buy same side on Poly. One position per market.
- **Data:** Live Kalshi UP/DOWN and Polymarket UP/DOWN for the **same** event/slot.
- **Trigger:** Detect when Kalshi bid/ask or last for one side ≥ 1.00; decide which side (UP vs DOWN) and use that for “same side” on Poly.
- **Poly side:** Map Kalshi ticker/side to Polymarket market + outcome (UP token vs DOWN token); use existing CLOB/order flow for that market.
- **Position:** Track “we bought Poly UP (or DOWN) for this market at price X” so you only apply the exit rule to that position.
- **Exit:** On each price update, if current Poly price for the **bought** side &lt; `polySellBelow`, send a market (or aggressive limit) sell for the full size.
- **Config:** Add `POLY_BUY_MIN` and `POLY_SELL_BELOW` to config/env and wire them into this strategy only (separate from existing arb logic if needed).
- **Risk:** One position per market/side; no cross-market or arb mixing unless you explicitly design it.

---

## 6. Summary

- **Strategy name:** Kalshi 1.00 → buy same side on Polymarket.
- **Entry:** Kalshi side = 1.00 and Poly same-side price > `polyBuyMin`.
- **Exit:** Poly same-side price < `polySellBelow` → sell all; else hold to resolution.
- **Params:** Tune `polyBuyMin` and `polySellBelow` via `scripts/simulate-kalshi-1-then-poly.ts` (single run, COMPARE, or OPTIMIZE).
- **Ref:** This folder; run via `npm run kalshi-1-poly`; simulate via `scripts/simulate-kalshi-1-then-poly.ts`.

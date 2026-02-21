# Index: Kalshi 1.00 → Buy Same Side on Polymarket

Deep index of this strategy folder and its integration with the kalshi-trading-bot project.

---

## 1. Folder contents

| File | Purpose |
|------|--------|
| **README.md** | Strategy spec: idea, entry/exit rules, params, simulation comparison table, implementation notes. |
| **params.md** | Env/config parameter reference and suggested defaults from backtest. |
| **INDEX.md** | This file — project index and cross-references. |

---

## 2. Strategy summary

- **Name:** Kalshi 1.00 → buy same side on Polymarket.
- **Signal:** Kalshi UP or DOWN price reaches **1.00** (that outcome priced as certain).
- **Action:** Buy the **same** side on Polymarket (Kalshi UP = 1.00 → buy Poly UP; Kalshi DOWN = 1.00 → buy Poly DOWN).
- **Entry guard:** Only buy if Poly same-side price **>** `POLY_BUY_MIN` (e.g. 0.80–0.95).
- **Exit:** If Poly same-side price **<** `POLY_SELL_BELOW` → sell all; else hold to resolution.
- **Profit (per contract):** No sell → `1 - trigger_price`; Sold → `sold_price - trigger_price`.

---

## 3. Project integration

### 3.1 Simulation (implemented)

- **Script:** `scripts/simulate-kalshi-1-then-poly.ts`
- **Input:** Monitor log files from `kalshi-log/` (or `KALSHI_LOG_DIR`). Log line format must match:
  - `[ISO_TIMESTAMP] Kalshi UP kUp DOWN kDown  |  Polymarket UP pUp DOWN pDown`
- **Source of that format:** `src/monitor/dual-monitor.ts` → `formatDualPricesLine()`; written by `src/monitor/run.ts` via `appendMonitorLog(line, p.fetchedAt)`.
- **Logger:** `src/core/monitor-logger.ts` — files are `logs/monitor_{YYYY-MM-DD}_{HH}-{00|15|30|45}.log` (or custom dir). Simulation uses `kalshi-log/` by default.

### 3.2 Live trading (not implemented)

- **Monitor entry:** `src/monitor/run.ts` — runs dual price monitor and **only** calls `checkArbAndPlaceOrders(p)` (arb strategy). There is **no** call to any “Kalshi 1.00 → same side Poly” logic.
- **Arb (different strategy):** `src/monitor/arb.ts` — opposite-side arb (Kalshi UP + Poly DOWN, etc.). Uses `ARB_SUM_THRESHOLD`, `ARB_SUM_LOW`, etc. from `src/core/config.ts`. No `POLY_BUY_MIN` / `POLY_SELL_BELOW` in config yet.
- **Config:** `src/core/config.ts` — has Kalshi bot and arb params; **does not** export `POLY_BUY_MIN` or `POLY_SELL_BELOW`. README/params.md say to add these when implementing this strategy.

### 3.3 Polymarket / Kalshi order flow (for future impl)

- **Poly orders:** `src/polymarket/order.ts` — `placePolymarketOrder`, `sellPolymarketOrder`; used by arb.
- **Poly prices:** `src/polymarket/prices.ts` — e.g. `getBestAskForToken`.
- **Kalshi orders:** `src/kalshi/bot.ts` — `placeOrder`, `placeSellOrder` (used by arb). Same-side strategy would only trade on Poly.

---

## 4. Simulation script details

- **Default params in script:** `DEFAULT_POLY_BUY_MIN = 0.94`, `DEFAULT_POLY_SELL_BELOW = 0.77` (tuned on kalshi-log; comment says 0.94/0.77 → profit 1.08).
- **README comparison table:** Suggests best from an older 128-file run as `polyBuyMin = 0.80`, `polySellBelow = 0.75` → sum profit 1.88. So script defaults and README “best” differ; re-run COMPARE/OPTIMIZE when adding logs.
- **Modes:**
  - Default: single run with script defaults or `POLY_BUY_MIN` / `POLY_SELL_BELOW` env.
  - `COMPARE=1`: run the 6 fixed parameter pairs from the README table.
  - `OPTIMIZE=1`: grid search (coarse then fine) to choose `polyBuyMin` / `polySellBelow`.
- **Output:** Summary (buys, sold, held, sum profit), details table per trade, per-trade lines.

---

## 5. Parameter reference

| Env / config (for future impl) | Meaning | README/params suggested | Script default |
|--------------------------------|--------|--------------------------|----------------|
| `POLY_BUY_MIN` | Min Poly same-side price to enter | 0.80 | 0.94 |
| `POLY_SELL_BELOW` | Sell when same-side Poly price < this | 0.75 | 0.77 |

---

## 6. Implementation checklist (from README §5)

- [ ] Add `POLY_BUY_MIN` and `POLY_SELL_BELOW` to config/env; wire into this strategy only.
- [ ] In monitor (or a dedicated loop): consume live/streamed Kalshi UP/DOWN and Poly UP/DOWN for the same event/slot.
- [ ] Trigger: Kalshi bid/ask or last for one side ≥ 1.00 → choose side (UP vs DOWN) and trade **same side** on Poly.
- [ ] Map Kalshi ticker/side to Polymarket market + outcome (UP vs DOWN token); use existing CLOB/order flow.
- [ ] Track position: “bought Poly UP (or DOWN) at price X” per market; apply exit rule only to that position.
- [ ] Exit: on each price update, if current Poly price for the bought side < `POLY_SELL_BELOW`, send market (or aggressive limit) sell for full size.
- [ ] One position per market/side; no mixing with arb unless designed.

---

## 7. Quick commands

```bash
# Single run (script defaults)
npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Custom params
POLY_BUY_MIN=0.85 POLY_SELL_BELOW=0.80 npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Compare the 6 pairs from README
COMPARE=1 npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Optimize over grid
OPTIMIZE=1 npx ts-node scripts/simulate-kalshi-1-then-poly.ts

# Use a different log dir
KALSHI_LOG_DIR=./logs npx ts-node scripts/simulate-kalshi-1-then-poly.ts
```

---

## 8. Related files (paths from repo root)

| Path | Role |
|------|------|
| `strategy-kalshi-1-poly-same-side/README.md` | Strategy spec and rules |
| `strategy-kalshi-1-poly-same-side/params.md` | Params and suggested defaults |
| `scripts/simulate-kalshi-1-then-poly.ts` | Backtest / compare / optimize |
| `scripts/simulate-sum-exit.ts` | Other simulation (sum-exit logic) |
| `src/monitor/run.ts` | Monitor entry; only runs arb, not this strategy |
| `src/monitor/dual-monitor.ts` | Fetches Kalshi + Poly prices; `formatDualPricesLine` |
| `src/monitor/arb.ts` | Opposite-side arb (live); reference for order/exit flow |
| `src/core/config.ts` | Env/config; no same-side strategy params yet |
| `src/core/monitor-logger.ts` | Writes monitor logs (e.g. `logs/`) |
| `src/polymarket/order.ts` | Place/sell Poly orders |
| `src/polymarket/prices.ts` | Poly best ask etc. |
| `src/kalshi/bot.ts` | Kalshi place/sell (for arb; same-side is Poly-only) |

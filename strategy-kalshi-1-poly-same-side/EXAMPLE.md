# Example: How the bot works

Real walkthrough from **monitor_2026-02-04_18-15.log** (BTC 15m slot 18:15–18:30). Params: `polyBuyMin = 0.80`, `polySellBelow = 0.70`.

---

## 1. What the bot does every tick

Each time it gets new Kalshi + Polymarket prices (same event, same side = UP or DOWN), it:

1. **Check for BUY** (first condition that becomes true wins):
   - **Method 1:** Kalshi same-side has already reached **1.00** and Poly same-side **≥ polyBuyMin** → buy Poly same-side.
   - **Method 2:** Kalshi same-side **≥ 0.99** and Poly same-side **≥ 0.99** → buy Poly same-side.
2. **If we are holding a position:** if Poly same-side **< polySellBelow** → sell entire position immediately.
3. Otherwise keep monitoring (no new buy for that market/side until next slot or reset).

---

## 2. Example: UP leg in monitor_2026-02-04_18-15.log

### Before any trigger

| Time (UTC)     | Kalshi UP | Kalshi DOWN | Poly UP | Poly DOWN | Bot action |
|----------------|-----------|-------------|---------|-----------|------------|
| 18:28:10.529   | 0.98      | 0.03        | 0.98    | 0.03      | No buy (Kalshi UP not ≥ 0.99 with Poly UP ≥ 0.99; not 1.00 yet) |
| 18:28:12.332   | **0.99**  | 0.02        | 0.98    | 0.03      | No buy (Poly UP 0.98 < 0.99 → Method 2 not met) |
| 18:28:12.532   | 0.99      | 0.02        | 0.98    | 0.03      | Still watching … |
| 18:28:13.811   | **0.99**  | 0.02        | **0.99**| 0.03      | **BUY Poly UP at 0.99** (Method 2: Kalshi UP ≥ 0.99 and Poly UP ≥ 0.99) |

So the bot **buys Polymarket UP** at **18:28:13.811Z** at price **0.99**.

### After the buy

| Time (UTC)     | Poly UP | Bot action |
|----------------|---------|------------|
| 18:28:14 … 18:28:22 | 0.99 | Hold (0.99 ≥ polySellBelow 0.70) |
| 18:29:35.456  | 1.00    | Hold (market resolving; UP wins) |
| 18:29:39 …    | 1.00    | Slot ends / resolution. We never sold. |

Poly UP never goes below 0.70, so the bot **never sells** and **holds to resolution**.

### Outcome

- **Entry:** Poly UP @ **0.99** (1 contract).
- **Exit:** Resolution; UP wins → pays **1.00** per share.
- **Profit per contract:** `1.00 - 0.99 = **0.01**`.

If at some tick Poly UP had dropped to e.g. **0.65**, the bot would have **sold immediately** at 0.65 and locked in profit **0.65 - 0.99 = -0.34** (a loss).

---

## 3. Same slot: why no DOWN trade?

In this log, Kalshi DOWN never reaches 0.99 or 1.00 while Poly DOWN is also ≥ 0.99. So the bot never buys the DOWN side for this slot. It only trades **one side per 15m market** when that side’s conditions are met.

---

## 4. Summary flow

```
Every ~200 ms (or your poll interval):
  For this market/slot:
    If we don’t hold a position:
      If (Kalshi_side ≥ 0.99 and Poly_same_side ≥ 0.99)  → BUY Poly same-side (Method 2)
      Else if (we’ve seen Kalshi_side ≥ 1.00 and Poly_same_side ≥ polyBuyMin) → BUY (Method 1)
    If we hold a position:
      If Poly_same_side < polySellBelow  → SELL all
      Else  → Hold
```

One position per market per side (UP or DOWN); exit only by selling when price < polySellBelow or by holding to resolution.

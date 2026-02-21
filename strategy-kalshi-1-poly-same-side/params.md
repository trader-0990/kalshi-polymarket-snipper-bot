# Parameters reference

## Env / config (for implementation)

| Name             | Meaning                              | Example |
|------------------|--------------------------------------|---------|
| `POLY_BUY_MIN`  | Min Polymarket same-side price to enter | `0.80` or `0.85` |
| `POLY_SELL_BELOW` | Sell when same-side Poly price &lt; this | `0.75` or `0.80` |

## Suggested defaults (implementation)

- `POLY_BUY_MIN=0.8`
- `POLY_SELL_BELOW=0.7`
- `KALSHI_1_POLY_SIZE=5` (shares per buy)

Run: `npm run kalshi-1-poly`. Dry run: `KALSHI_1_POLY_DRY_RUN=true npm run kalshi-1-poly`.

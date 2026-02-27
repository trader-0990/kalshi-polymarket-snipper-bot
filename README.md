# Kalshi–Polymarket Snipper Bot

A real-time **cross-market snipper bot** that monitors **Kalshi** and **Polymarket** in parallel to decide **which token (direction) will win**. By watching both platforms’ order books and prices live, the bot identifies favorable sides (e.g. UP vs DOWN on Bitcoin 15m markets) and can place orders accordingly.

## What it does

- **Monitors cross markets in real time** – Kalshi and Polymarket feeds for the same or related events (e.g. Bitcoin 15-minute up/down).
- **Decides winning direction** – Uses dual best bid/ask and last-trade data from both venues to infer which side (token) is favored.
- **Trading** – Can place limit orders on Kalshi and/or Polymarket based on the monitored signals (e.g. buy UP when ask is below threshold).

## Setup

```bash
cp .env.sample .env
# Edit .env: set KALSHI_API_KEY and either KALSHI_PRIVATE_KEY_PATH or KALSHI_PRIVATE_KEY_PEM
npm install
```

## Scripts

- **`npm start`** – Run the main Kalshi + Polymarket monitor (dual price feed and direction logic).
- **`npm run auto-redeem`** – Run the auto-redeem/copytrade script.
- **`npm run build`** – Compile TypeScript to `dist/`.

## Environment

### Kalshi

| Variable | Description |
|----------|-------------|
| `KALSHI_API_KEY` | Your Kalshi API key id. |
| `KALSHI_PRIVATE_KEY_PATH` | Path to your RSA private key `.pem` file. |
| `KALSHI_PRIVATE_KEY_PEM` | Alternatively, the PEM string (e.g. from a secret manager). |
| `KALSHI_DEMO` | Set to `true` to use the demo API. |
| `KALSHI_BASE_PATH` | Optional override for API base URL. |

### Monitor (cross-market direction)

| Variable | Description |
|----------|-------------|
| `KALSHI_MONITOR_INTERVAL_MS` | Poll interval in ms (default 2000). |
| `KALSHI_MONITOR_TICKER` | Optional market ticker; if unset, uses first open KXBTC15M market. |

The monitor exposes **dual Kalshi + Polymarket** prices (`DualMarketPrices`); use `startDualPriceMonitor` and `formatDualPricesLine` from `./monitor` to build buy logic (e.g. buy UP when up ask &lt; threshold).

### Polymarket (orders)

| Variable | Description |
|----------|-------------|
| `POLYMARKET_PRIVATE_KEY` | Required to place orders. |
| `POLYMARKET_PROXY` | Proxy wallet / config. |
| `POLYMARKET_TICK_SIZE` / `COPYTRADE_TICK_SIZE` | Optional tick size. |
| `POLYMARKET_NEG_RISK` / `COPYTRADE_NEG_RISK` | Optional neg-risk flag. |
| `POLYMARKET_CLOB_URL` / `CLOB_API_URL`, `POLYMARKET_CHAIN_ID` / `CHAIN_ID` | Optional API overrides. |
| `POLYMARKET_CREDENTIAL_PATH` | Optional path to JSON with `key`, `secret`, `passphrase`. |

## Real-time cross-market monitor

Monitor best bid/ask for **UP (YES)** and **DOWN (NO)** on both Kalshi and Polymarket so the bot can decide which direction (token) will win.

**Example**

```bash
npm start
# [KXBTC15M-26FEB021130-30] UP   bid=0.54 ask=0.56  |  DOWN bid=0.44 ask=0.46  |  last=0.56  @ ...
```

In code: use the dual monitor for **cross-market** prices and implement logic that chooses UP or DOWN based on both venues.

## Order placement (Kalshi + Polymarket)

Both platforms support limit buy orders.

### Kalshi

- **Function:** `placeOrder(ticker, side, count, priceCents)` from `./bot`.
- **Parameters:** `ticker` (e.g. `KXBTC15M-24JAN15`), `side` (`"yes"` | `"no"`), `count` (contracts), `priceCents` (1–99).
- **Env:** `KALSHI_API_KEY`, `KALSHI_PRIVATE_KEY_PEM` or `KALSHI_PRIVATE_KEY_PATH`; for bot: `KALSHI_BOT_SIDE`, `KALSHI_BOT_PRICE_CENTS`, `KALSHI_BOT_CONTRACTS`, `KALSHI_BOT_DRY_RUN`.

### Polymarket

- **Function:** `placePolymarketOrder(tokenId, price, size, options?)` from `./polymarket-order`.
- **Parameters:** `tokenId` (CLOB token ID), `price` (0–1), `size` (shares). Optional `options`: `{ tickSize?, negRisk? }`.
- **Env:** `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_PROXY`; optional tick size, neg-risk, CLOB URL, chain ID, credential path.

The arb script places one Kalshi order and one Polymarket order in parallel when cross-market conditions are in range (`src/arb.ts`, env `ARB_*`, `ARB_POLY_SIZE`).

## Docs

- [Kalshi API](https://docs.kalshi.com/)
- [Kalshi TypeScript SDK](https://docs.kalshi.com/sdks/typescript/quickstart)
- [Kalshi WebSockets](https://docs.kalshi.com/websockets/websocket-connection)

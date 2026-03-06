# Trading Strategy Agent Gateway

Private agent gateway for crypto strategy discovery, submission, research, and x402-settled live signal access on OKX OnchainOS.

## What Changed

This project is no longer modeled as an open strategy marketplace.

The current product shape is:
- public read-only strategy feed
- private skill-gated premium routes
- template-based strategy submissions
- platform-managed backtests, pricing tiers, and live signal generation
- x402 used only for high-value outputs such as live signal batches and research candles

## Quick Start

```bash
# install deps
npm install

# seed a fresh local database
npm run db:seed

# start dev server
npm run dev
```

Open `http://localhost:3000`.

## Required Environment

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
OKX_API_KEY=your-key
OKX_SECRET_KEY=your-secret
OKX_PASSPHRASE=your-passphrase
OKX_PROJECT_ID=your-project-id
PLATFORM_WALLET_ADDRESS=0xYourPlatformWallet
PLATFORM_FEE_PCT=10
GATEWAY_SKILL_TOKEN=your-private-skill-bearer-token
INTERNAL_CONTROL_TOKEN=your-internal-control-bearer-token
RESEARCH_ALLOWED_INST_IDS=BTC-USDT,ETH-USDT,SOL-USDT,OKB-USDT,XRP-USDT,DOGE-USDT,ADA-USDT
RESEARCH_ALLOWED_BARS=1m,5m,15m,1H,4H,1D
RESEARCH_MIN_LIMIT=20
RESEARCH_MAX_LIMIT=500
RESEARCH_SMALL_CANDLES_MAX_LIMIT=120
RESEARCH_SMALL_CANDLES_PRICE_MICRO_USD=5000
RESEARCH_LARGE_CANDLES_PRICE_MICRO_USD=15000
```

## Pricing Model

- Public browse is free: `GET /api/strategies`, `GET /api/strategies/:id`, research supported assets, research spot price
- Strategy submission is free but requires the private skill bearer token plus wallet-auth
- Live strategy signals are billed through x402 only when a subscription has pending live signals
- Strategy pricing is platform-managed from backtest score:
  - `tier_1`: `$0.03 / signal`, 30-day cap `$1.49`
  - `tier_2`: `$0.06 / signal`, 30-day cap `$2.99`
  - `tier_3`: `$0.09 / signal`, 30-day cap `$5.99`
- Research candles are billed through x402:
  - `limit <= 120`: `$0.005`
  - `limit > 120`: `$0.015`
- Signal revenue split remains `90% provider / 10% platform`
- Research revenue remains `100% platform`

## Core Flows

### 1. Submit a candidate strategy

`POST /api/strategy-submissions`

Required:
- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>`
- wallet-auth headers

Body:

```json
{
  "providerAddress": "0xYourWalletAddress",
  "name": "ETH 4H Momentum",
  "description": "Fast/slow moving-average trend follower",
  "instId": "ETH-USDT",
  "timeframe": "4H",
  "templateKey": "sma_crossover",
  "params": {
    "fastPeriod": 20,
    "slowPeriod": 50
  }
}
```

Behavior:
- platform fetches candles
- runs unified backtest
- calculates score, tier, unit price, period cap
- approved submissions are materialized into public strategies

### 2. Subscribe to an approved strategy

`POST /api/strategies/:id/subscribe`

Required:
- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>`
- wallet-auth headers

### 3. Pull live signals with x402

`GET /api/subscriptions/:subscriptionId/signals`

Required:
- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>`
- x402 flow when billable signals exist

Behavior:
- no new live signals -> free `200`
- pending live signals -> `402 + paymentRequirements`
- after payment -> returns `signals`, `openclawMessages`, `receipt`
- billing is capped per 30-day subscription period

### 4. Pull research candles with x402

`GET /api/research/candles?instId=BTC-USDT&bar=1H&limit=120`

Required:
- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>`
- x402 flow

## Public API Surface

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/strategies` | Public |
| GET | `/api/strategies/:id` | Public |
| GET | `/api/research/supported-assets` | Public |
| GET | `/api/research/price?instId=...` | Public |
| POST | `/api/strategy-submissions` | Bearer + wallet-auth |
| GET | `/api/strategy-submissions/:id` | Bearer + wallet-auth |
| POST | `/api/strategies/:id/subscribe` | Bearer + wallet-auth |
| GET | `/api/strategies/:id/subscribe?subscriberAddress=...` | Bearer |
| GET | `/api/subscriptions/:subscriptionId/signals` | Bearer + x402 |
| GET | `/api/providers/:address` | Bearer + wallet-auth |
| GET | `/api/research/candles?instId=...&bar=...&limit=...` | Bearer + x402 |

## Internal Control Routes

These are for scheduled or operator-controlled runs and require:
- `Authorization: Bearer <INTERNAL_CONTROL_TOKEN>`

Routes:
- `POST /api/internal/strategy-sync`
- `POST /api/internal/strategy-rescore`

## OpenClaw Runtime Notes

The runtime must provide:
- a bearer token for private gateway access
- an X Layer wallet with USDT
- wallet-auth signing capability
- x402 retry capability for `402 -> X-Payment -> retry`

The helper runtime in this repo still supports:
- `createOpenClawX402Wallet(...).requestWithWalletAuth(...)`
- `createOpenClawX402Wallet(...).requestWithAutoPayment(...)`

## Verification

```bash
bun run typecheck
bun test
```

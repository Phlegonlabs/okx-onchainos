# Strategy Square - Architecture

> An AI-native on-chain strategy marketplace powered by OKX OnchainOS.
> Providers publish trading strategies, consumers purchase signals via x402.

## 1. Product Overview

Strategy Square is an agent-to-agent strategy marketplace:

- **Provider Agents** (OpenClaw) publish trading strategies and earn USDT-settled revenue credits
- **Consumer Agents** (OpenClaw) browse and purchase signals via x402
- **Platform** hosts strategies, facilitates x402 payments, tracks provider earnings

Fully API-driven. No human users. No client accounts stored. The web UI is a read-only showcase for demo purposes only.

### Revenue Model: Platform Custody (Mode A)

All x402 payments flow to the **platform wallet** (`payTo` = platform address). The platform:
1. Receives payment from consumer via x402 settle
2. Records the provider's earned amount in DB (minus platform fee)
3. Provider can view their balance via API / UI
4. Actual withdrawal is out of scope for hackathon demo

```
Consumer Agent --x402--> Platform Wallet (100%)
                            |
                     ┌──────┴──────┐
                     │  90% credit  │ --> Provider balance (DB)
                     │  10% fee     │ --> Platform revenue (DB)
                     └─────────────┘
```

- **Platform fee**: 10% (configurable via `PLATFORM_FEE_PCT` env var)
- **Platform wallet**: set via `PLATFORM_WALLET_ADDRESS` env var
- Provider earnings tracked in `provider_balances` table
- No on-chain payout mechanism (demo scope)
- Research API (`/api/research/candles`) is separately priced at `$0.001` per request and recorded in `research_payments` (100% platform revenue)

## 2. Core User Journeys

### Journey 1: Provider publishes a strategy

```
Provider Agent
  POST /api/strategies
    headers: X-Wallet-Address / X-Wallet-Timestamp / X-Wallet-Nonce / X-Wallet-Signature
    body: { name, description, asset, timeframe, pricePerSignal, providerAddress }
  <- 201 { strategyId }
```

Provider can later push new signals:

```
Provider Agent
  PUT /api/strategies/:id/signals
    headers: X-Wallet-Address / X-Wallet-Timestamp / X-Wallet-Nonce / X-Wallet-Signature
    body: { action: "buy"|"sell", token, entry, stopLoss, takeProfit, reasoning }
  <- 200 { signalId }
```

### Journey 2: Consumer subscribes and purchases pending signals

```
Consumer Agent
  POST /api/strategies/:id/subscribe
    headers: X-Wallet-Address / X-Wallet-Timestamp / X-Wallet-Nonce / X-Wallet-Signature
    body: { subscriberAddress, planDays }
  <- 201 { subscription }

Consumer Agent
  GET /api/subscriptions/:subscriptionId/signals
  <- 402 Payment Required
     X-Payment-Requirements: { scheme, maxAmountRequired, payTo, asset, resource }

Consumer Agent (retry with payment)
  GET /api/subscriptions/:subscriptionId/signals
    X-Payment: { x402Version, scheme, payload: { signature, authorization } }

Server:
  1. POST https://web3.okx.com/api/v6/x402/verify  -> isValid + payer
  2. payer must equal subscription.subscriberAddress
  3. POST https://web3.okx.com/api/v6/x402/settle   -> txHash
  <- 200 { signals[], receipt: { txHash } }
```

### Journey 3: Web showcase (read-only, demo only)

```
Browser -> / (strategy leaderboard, read-only)
Browser -> /strategies/:id (details + signal history)
```

## 3. Tech Stack

| Layer      | Choice              | Rationale                        |
|------------|---------------------|----------------------------------|
| Framework  | Next.js 15 (App Router) | Modern fullstack, API routes + SSR |
| Database   | Turso (libSQL)      | SQLite edge, Vercel-native       |
| ORM        | Drizzle ORM         | Lightweight, Turso support       |
| Styling    | TailwindCSS v4 + shadcn/ui | Fast UI development         |
| Payments   | OKX x402 Protocol   | Core payment layer               |
| Market Data| OKX Market API      | Token prices, charts             |
| Deploy     | Vercel              | One-click deploy                 |

## 4. Database Schema

```
strategies
  id            TEXT PRIMARY KEY (nanoid)
  name          TEXT NOT NULL
  description   TEXT NOT NULL
  asset         TEXT NOT NULL          -- e.g. "ETH/USDC"
  timeframe     TEXT NOT NULL          -- e.g. "4h", "1d"
  pricePerSignal INTEGER NOT NULL      -- cents (USD)
  providerAddress TEXT NOT NULL        -- wallet address
  totalSignals  INTEGER DEFAULT 0
  winRate       REAL DEFAULT 0
  avgReturn     REAL DEFAULT 0
  status        TEXT DEFAULT 'active'  -- 'active' | 'paused'
  createdAt     TEXT DEFAULT (datetime('now'))

signals
  id            TEXT PRIMARY KEY (nanoid)
  strategyId    TEXT NOT NULL REFERENCES strategies(id)
  action        TEXT NOT NULL          -- 'buy' | 'sell'
  token         TEXT NOT NULL          -- e.g. "ETH"
  entry         REAL NOT NULL
  stopLoss      REAL
  takeProfit    REAL
  reasoning     TEXT
  outcome       TEXT                   -- 'win' | 'loss' | 'pending'
  returnPct     REAL
  createdAt     TEXT DEFAULT (datetime('now'))
  settledAt     TEXT

payments
  id            TEXT PRIMARY KEY (nanoid)
  strategyId    TEXT NOT NULL REFERENCES strategies(id)
  amountCents   INTEGER NOT NULL
  providerCents INTEGER NOT NULL       -- amount credited to provider (after fee)
  platformCents INTEGER NOT NULL       -- platform fee amount
  txHash        TEXT                   -- on-chain tx hash (receipt)
  status        TEXT DEFAULT 'settled' -- 'settled' | 'failed'
  createdAt     TEXT DEFAULT (datetime('now'))

provider_balances
  providerAddress TEXT PRIMARY KEY     -- wallet address
  totalEarnedCents INTEGER DEFAULT 0   -- lifetime earnings
  pendingCents    INTEGER DEFAULT 0    -- not yet withdrawn (all, for demo)
  totalSignalsSold INTEGER DEFAULT 0
  updatedAt       TEXT DEFAULT (datetime('now'))

research_payments
  id            TEXT PRIMARY KEY (nanoid)
  payerAddress  TEXT NOT NULL
  resource      TEXT NOT NULL          -- e.g. /api/research/candles?...
  instId        TEXT NOT NULL          -- e.g. BTC-USDT
  bar           TEXT NOT NULL          -- e.g. 1H
  limit         INTEGER NOT NULL
  amountMicroUsd INTEGER NOT NULL      -- 1000 = $0.001
  amountBaseUnits TEXT NOT NULL        -- USDT 6-decimal units
  txHash        TEXT                   -- on-chain settlement tx hash
  status        TEXT DEFAULT 'settled'
  createdAt     TEXT DEFAULT (datetime('now'))
```

## 5. API Endpoints

| Method | Path                         | Auth    | Description              |
|--------|------------------------------|---------|--------------------------|
| GET    | `/api/strategies`            | None    | List strategies          |
| GET    | `/api/strategies/:id`        | None    | Strategy details         |
| POST   | `/api/strategies`            | Wallet  | Create strategy          |
| POST   | `/api/strategies/:id/subscribe` | Wallet | Create/reuse subscription |
| GET    | `/api/strategies/:id/subscribe` | None | Read subscription status |
| GET    | `/api/subscriptions/:subscriptionId/signals` | x402 + payer match | Poll pending subscription signals |
| GET    | `/api/strategies/:id/signals`| x402    | Get signals (paid)       |
| PUT    | `/api/strategies/:id/signals`| Wallet  | Push new signal          |
| GET    | `/api/providers/:address`    | None    | Provider balance/stats   |
| GET    | `/api/market/:token`         | None    | Token price (proxy OKX)  |
| GET    | `/api/research/supported-assets` | None | OnchainOS supported assets |
| GET    | `/api/research/price`        | None    | Spot price by `instId`   |
| GET    | `/api/research/candles`      | x402    | Paid candles for research |

## 6. x402 Payment Flow

```
                    Consumer Agent
                         |
                    GET /signals
                         |
                   ┌─────▼──────┐
                   │  Has x402   │──No──> 402 + paymentRequirements
                   │  header?    │
                   └─────┬──────┘
                        Yes
                         |
              ┌──────────▼──────────┐
              │   OKX /x402/verify   │
              └──────────┬──────────┘
                    isValid?
                    /      \
                  No       Yes
                  |         |
                 403  ┌─────▼──────┐
                      │OKX /settle │
                      └─────┬──────┘
                         success?
                         /     \
                       No      Yes
                       |        |
                      500  ┌──────▼──────────┐
                           │ Split payment:   │
                           │ 90% -> provider  │
                           │ 10% -> platform  │
                           │ (DB balances)    │
                           └──────┬──────────┘
                                  |
                           200 + signals + receipt
```

## 7. OKX OnchainOS Integration

### x402 Payments
- `GET /api/v6/payments/supported/` - check supported chains
- `POST /api/v6/x402/verify` - verify payment signature
- `POST /api/v6/x402/settle` - settle on-chain (HMAC-SHA256 auth)
- Network: X Layer (chainIndex: 196), zero gas
- Assets: USDC, USDT, USDG

### Market API
- Token prices and charts for strategy display
- Base URL: `https://web3.okx.com`
- Research routes:
  - `GET /api/research/supported-assets` (free)
  - `GET /api/research/price?instId=...` (free)
  - `GET /api/research/candles?instId=...&bar=...&limit=...` (x402, fixed `$0.001`)

### Auth Headers (for settle)
- `OK-ACCESS-KEY` - API key
- `OK-ACCESS-SIGN` - Base64(HMAC-SHA256(timestamp + method + path + body, secret))
- `OK-ACCESS-TIMESTAMP` - ISO 8601 UTC
- `OK-ACCESS-PASSPHRASE` - passphrase

## 8. Project Structure

```
okx-onchainos/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Homepage / leaderboard
│   │   ├── strategies/[id]/page.tsx    # Strategy detail
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── strategies/
│   │       │   ├── route.ts            # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET detail
│   │       │       ├── subscribe/
│   │       │       │   └── route.ts    # GET/POST subscription status + create
│   │       │       └── signals/
│   │       │           └── route.ts    # GET (x402), PUT (wallet-signed push)
│   │       ├── subscriptions/
│   │       │   └── [subscriptionId]/
│   │       │       └── signals/
│   │       │           └── route.ts    # GET pending signals (x402 + payer match)
│   │       ├── providers/
│   │       │   └── [address]/
│   │       │       └── route.ts        # GET provider balance
│   │       ├── research/
│   │       │   ├── supported-assets/
│   │       │   │   └── route.ts        # free list for chainIndex 196
│   │       │   ├── price/
│   │       │   │   └── route.ts        # free spot price by instId
│   │       │   └── candles/
│   │       │       └── route.ts        # x402-paid candles for research
│   │       └── market/
│   │           └── [token]/
│   │               └── route.ts        # proxy OKX Market API
│   ├── db/
│   │   ├── schema.ts                   # Drizzle schema
│   │   ├── client.ts                   # Turso connection
│   │   └── seed.ts                     # Demo strategies
│   ├── lib/
│   │   ├── x402.ts                     # x402 verify/settle helpers
│   │   ├── wallet-auth.ts              # wallet-signed request verification
│   │   ├── openclaw-x402-wallet.ts     # OpenClaw wallet helper runtime
│   │   ├── okx-auth.ts                 # OKX HMAC signing
│   │   ├── market.ts                   # OKX Market API client
│   │   └── research.ts                 # OnchainOS research data client
│   └── components/
│       ├── strategy-card.tsx
│       ├── signal-table.tsx
│       └── performance-chart.tsx
├── skills/
│   └── strategy-square/
│       └── SKILL.md                    # OpenClaw skill definition
├── docs/                               # Project documentation
├── tasks/                              # Task tracking
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.local                          # Secrets (not committed)
```

## 9. Seed Strategies

For demo purposes, 4 pre-built strategies with fake historical signals:

1. **Alpha Momentum** - SMA 20/50 crossover on ETH/USDC, 4h timeframe
2. **RSI Sniper** - RSI oversold bounce on BTC/USDC, 1d timeframe
3. **MACD Rider** - MACD golden/death cross on SOL/USDC, 4h timeframe
4. **Bollinger Bounce** - Bollinger band mean reversion on ETH/USDC, 1d timeframe

Each seeded with ~20 historical signals, realistic win rates (55-70%), and returns.

## 10. OpenClaw Skill Integration

### What agents need to use our platform

1. **Our skill installed** — `SKILL.md` teaches the agent our API endpoints
2. **A wallet with USDT on X Layer** — for x402 payments
3. **x402 payment capability** — built into OpenClaw natively, or via Claw402 MCP server
4. **Wallet-auth signing capability** — for provider writes and subscription creation

The skill itself does not provision or persist this wallet. In a pure skill-only runtime, paid and write flows cannot be fully automated.

### Our skill (SKILL.md)

```yaml
---
name: strategy-square
description: Browse, publish, purchase, and research on-chain trading data via x402
metadata: { "openclaw": { "emoji": "📊", "requires": { "env": ["STRATEGY_SQUARE_URL"] } } }
---
```

The skill instructs the agent to:
- `GET {STRATEGY_SQUARE_URL}/api/strategies` — list strategies
- `GET {STRATEGY_SQUARE_URL}/api/strategies/:id` — get details
- `POST {STRATEGY_SQUARE_URL}/api/strategies` — publish a strategy (provider, wallet-signed)
- `PUT {STRATEGY_SQUARE_URL}/api/strategies/:id/signals` — push signal (provider, wallet-signed)
- `POST {STRATEGY_SQUARE_URL}/api/strategies/:id/subscribe` — create/reuse subscription (wallet-signed)
- `GET {STRATEGY_SQUARE_URL}/api/subscriptions/:subscriptionId/signals` — buy pending signals (consumer, x402 gated)
- `GET {STRATEGY_SQUARE_URL}/api/providers/:address` — check earnings (provider)
- `GET {STRATEGY_SQUARE_URL}/api/research/supported-assets` — discover assets (free)
- `GET {STRATEGY_SQUARE_URL}/api/research/price?instId=BTC-USDT` — spot price (free)
- `GET {STRATEGY_SQUARE_URL}/api/research/candles?instId=BTC-USDT&bar=1H&limit=120` — candles (x402, $0.001/request)

### x402 payment flow (agent perspective)

```
Agent calls GET /api/subscriptions/:subscriptionId/signals
  <- 402 Payment Required
     Response body: {
       x402Version: "1",
       paymentRequirements: {
         scheme: "exact",
         maxAmountRequired: "5000",     // $0.05 in USDT 6-decimal base units
         payTo: "0xPlatformWallet",
         asset: "0x..USDT",
         resource: "/api/subscriptions/:subscriptionId/signals"
       }
     }

Agent's wallet (Claw402 / built-in) automatically:
  1. Reads payment requirements
  2. Signs EIP-3009 authorization (transferWithAuthorization)
  3. Retries request with X-Payment header containing signed payload

Server receives X-Payment:
  1. Calls OKX /x402/verify -> isValid
  2. Ensures payer == subscriberAddress
  3. Calls OKX /x402/settle -> txHash
  4. Credits provider balance (90%)
  5. Returns 200 + signals + receipt
```

### What the agent does NOT need

- No API key for our platform
- No account registration
- No stored identity — payment IS authentication

## 11. Non-Goals (Out of Scope)

- User authentication / accounts
- Storing consumer/client information
- Real-time WebSocket feeds
- Actual trade execution (just signals)
- On-chain provider withdrawal
- Multi-language UI
- Mobile app

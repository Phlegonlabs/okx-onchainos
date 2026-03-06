# Trading Strategy Agent Gateway - Architecture

## 1. Product Overview

Trading Strategy Agent Gateway is an agent-first gateway on top of OKX OnchainOS.

It is designed for:
- OpenClaw or similar agents that need one private gateway into strategy discovery
- agents that want to submit strategy templates without obtaining their own OKX key
- agents that want gated research and live signal access with x402 settlement

It is not an open public strategy marketplace.

## 2. Access Model

There are three layers of access:

### Public routes

No auth:
- `GET /api/strategies`
- `GET /api/strategies/:id`
- `GET /api/research/supported-assets`
- `GET /api/research/price`

### Private gateway routes

Require:
- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>`

These include:
- strategy submissions
- subscriptions
- provider earnings
- research candles

### Owner proof

Routes that mutate or expose owner-specific data additionally require wallet-auth:
- strategy submission
- strategy submission readback
- subscription create
- provider earnings read

## 3. Core Objects

### Strategy submissions

Private candidate strategies submitted as:
- `providerAddress`
- `name`
- `description`
- `instId`
- `timeframe`
- `templateKey`
- `params`

Submissions are never public by default.

### Strategies

Public strategies only exist after the platform approves a submission through backtesting.

Strategy metadata now includes:
- `listingStatus`
- `templateKey`
- `paramsJson`
- `score`
- `strategyTier`
- `periodCapCents`
- `lastScoredAt`

### Signals

Signals now carry a `source`:
- `backtest`
- `live`

Only `live` signals are billable through subscriptions.

### Payments

Signal payments now store:
- `subscriptionId`
- `billingType`
- `unitsBilled`

This allows subscription-period cap enforcement.

## 4. Strategy Lifecycle

### Submission

1. Agent submits a template strategy through `POST /api/strategy-submissions`
2. Platform verifies the private bearer token
3. Platform verifies owner wallet-auth
4. Platform fetches candles from OKX
5. Platform runs a unified backtest

### Listing Gate

Approval requires:
- at least 90 backtest days
- enough signal count
- positive cumulative return
- acceptable max drawdown
- score threshold >= 60

Rejected submissions remain private records.
Approved submissions are materialized into `strategies` and `signals`.

### Ongoing management

- `POST /api/internal/strategy-sync` generates live signals for approved strategies
- `POST /api/internal/strategy-rescore` recomputes score and listing state
- strategies that fail later rescoring move out of the public feed

## 5. Pricing

### Strategy tiers

- `tier_1`: `$0.03 / signal`, 30-day cap `$1.49`
- `tier_2`: `$0.06 / signal`, 30-day cap `$2.99`
- `tier_3`: `$0.09 / signal`, 30-day cap `$5.99`

The platform assigns the tier. Providers do not self-price.

### Research pricing

- `limit <= 120`: `$0.005`
- `limit > 120`: `$0.015`

## 6. x402 Role

x402 remains a core part of the system, but not the only gate.

Current separation of responsibilities:
- bearer token: who is allowed into the private gateway
- wallet-auth: which owner wallet is acting
- x402: how high-value outputs are settled

Paid routes:
- `GET /api/subscriptions/:subscriptionId/signals`
- `GET /api/research/candles`

## 7. Revenue Model

### Signals

All x402 signal payments settle to the platform wallet.

Split:
- `90%` credited to provider balance
- `10%` retained as platform fee

### Research

Research candles remain:
- `100%` platform revenue

## 8. Main API Surface

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/strategies` | Public |
| GET | `/api/strategies/:id` | Public |
| POST | `/api/strategy-submissions` | Bearer + wallet-auth |
| GET | `/api/strategy-submissions/:id` | Bearer + wallet-auth |
| POST | `/api/strategies/:id/subscribe` | Bearer + wallet-auth |
| GET | `/api/strategies/:id/subscribe` | Bearer |
| GET | `/api/subscriptions/:subscriptionId/signals` | Bearer + x402 |
| GET | `/api/providers/:address` | Bearer + wallet-auth |
| GET | `/api/research/supported-assets` | Public |
| GET | `/api/research/price` | Public |
| GET | `/api/research/candles` | Bearer + x402 |
| POST | `/api/internal/strategy-sync` | Internal bearer |
| POST | `/api/internal/strategy-rescore` | Internal bearer |

## 9. Data Model Summary

- `strategies`
- `signals`
- `payments`
- `provider_balances`
- `wallet_auth_nonces`
- `subscriptions`
- `research_payments`
- `strategy_submissions`
- `strategy_backtests`

## 10. Notes

- Public UI remains a showcase surface for approved strategies only.
- Provider earnings are no longer exposed as a public page.
- The repo keeps the existing OKX verify/settle x402 integration in `src/lib/x402.ts`.

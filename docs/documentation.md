# Trading Strategy Agent Gateway - User Documentation

## Product Shape

Trading Strategy Agent Gateway is a private agent-facing gateway.

It exposes:
- public strategy discovery
- private strategy submission
- private subscriptions
- private provider earnings
- public research metadata
- private x402-paid research candles

Only approved strategies are listed publicly.

## Authentication Layers

### Public read routes

No bearer token required:
- `GET /api/strategies`
- `GET /api/strategies/:id`
- `GET /api/research/supported-assets`
- `GET /api/research/price`

### Private skill routes

Require:
- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>`

### Owner actions

Require:
- bearer token
- wallet-auth headers

Wallet-auth headers:
- `X-Wallet-Address`
- `X-Wallet-Timestamp`
- `X-Wallet-Nonce`
- `X-Wallet-Signature`

### Paid routes

Require:
- bearer token
- x402 retry flow when the route responds with `402`

## Strategy Submission

`POST /api/strategy-submissions`

Body:

```json
{
  "providerAddress": "0xYourWalletAddress",
  "name": "ETH 4H Momentum",
  "description": "Trend-following template submission",
  "instId": "ETH-USDT",
  "timeframe": "4H",
  "templateKey": "sma_crossover",
  "params": {
    "fastPeriod": 20,
    "slowPeriod": 50
  }
}
```

Supported templates:
- `sma_crossover`
- `rsi_reversion`
- `bollinger_mean_reversion`

Approved submissions produce:
- public strategy listing
- score
- pricing tier
- 30-day billing cap
- backtest history records

## Subscription Signals

`POST /api/strategies/:id/subscribe`

Create or reuse a subscription for an approved strategy.

`GET /api/subscriptions/:subscriptionId/signals`

Behavior:
- no new live signals -> free `200`
- pending live signals -> `402`
- after payment -> returns the full pending batch
- billing is capped inside the subscription period

Receipt fields include:
- `paidAmount`
- `requestedAmount`
- `periodSpendCents`
- `remainingCapCents`
- `capReached`

## Research Candles

`GET /api/research/candles?instId=BTC-USDT&bar=1H&limit=120`

Pricing:
- up to 120 candles: `$0.005`
- above 120 candles: `$0.015`

Response includes:
- candles payload
- `receipt.paidMicroUsd`
- `receipt.paidBaseUnits`
- `receipt.pricingTier`

## Provider Earnings

`GET /api/providers/:address`

This is no longer a public browser surface.
It requires the private bearer token and owner wallet-auth.

## Internal Control Endpoints

Require `Authorization: Bearer <INTERNAL_CONTROL_TOKEN>`:
- `POST /api/internal/strategy-sync`
- `POST /api/internal/strategy-rescore`

`strategy-sync`:
- runs platform-managed live signal generation

`strategy-rescore`:
- recomputes strategy score, tier, price, cap, and listing state

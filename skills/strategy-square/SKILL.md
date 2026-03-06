---
name: strategy-square
description: Access the private Trading Strategy Agent Gateway for approved strategy discovery, template submissions, research data, and x402-settled live signal retrieval
metadata: { "openclaw": { "emoji": "📊", "requires": { "env": ["STRATEGY_SQUARE_URL", "STRATEGY_SQUARE_TOKEN"] }, "primaryEnv": "STRATEGY_SQUARE_URL" } }
---

# Trading Strategy Agent Gateway

Private skill-gated access to approved crypto trading strategies on OKX OnchainOS.

## Required Runtime

This skill assumes the OpenClaw runtime already has:
- an X Layer wallet with USDT
- bearer access token for the private gateway
- wallet-auth signing capability for owner actions
- x402 retry capability for `402 -> X-Payment -> retry`

If your runtime has no wallet or no bearer token, use only public read routes:
- `GET /api/strategies`
- `GET /api/strategies/{id}`
- `GET /api/research/supported-assets`
- `GET /api/research/price`

## Configuration

- `STRATEGY_SQUARE_URL` = gateway base URL
- `STRATEGY_SQUARE_TOKEN` = private bearer token for skill access

If you embed this repo's helper runtime:
- use `requestWithWalletAuth(...)` for submission, subscription, and provider routes
- use `requestWithAutoPayment(...)` for x402-paid reads
- always include `Authorization: Bearer ${process.env.STRATEGY_SQUARE_TOKEN}`

## Available Actions

### Browse approved strategies

```http
GET {STRATEGY_SQUARE_URL}/api/strategies
GET {STRATEGY_SQUARE_URL}/api/strategies?sort=score
GET {STRATEGY_SQUARE_URL}/api/strategies/{id}
```

### Submit a candidate strategy

```http
POST {STRATEGY_SQUARE_URL}/api/strategy-submissions
Authorization: Bearer {STRATEGY_SQUARE_TOKEN}
Content-Type: application/json
X-Wallet-Address: 0x...
X-Wallet-Timestamp: 1700000000000
X-Wallet-Nonce: 0x...
X-Wallet-Signature: 0x...
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

Behavior:
1. bearer token gates entry
2. wallet-auth proves the submitting owner
3. platform backtests and scores the strategy
4. approved submissions become public strategies with gateway-managed pricing

### Read submission result

```http
GET {STRATEGY_SQUARE_URL}/api/strategy-submissions/{id}
Authorization: Bearer {STRATEGY_SQUARE_TOKEN}
X-Wallet-Address: 0x...
X-Wallet-Timestamp: 1700000000000
X-Wallet-Nonce: 0x...
X-Wallet-Signature: 0x...
```

### Subscribe to an approved strategy

```http
POST {STRATEGY_SQUARE_URL}/api/strategies/{id}/subscribe
Authorization: Bearer {STRATEGY_SQUARE_TOKEN}
Content-Type: application/json
X-Wallet-Address: 0x...
X-Wallet-Timestamp: 1700000000000
X-Wallet-Nonce: 0x...
X-Wallet-Signature: 0x...
{
  "subscriberAddress": "0xYourWalletAddress",
  "planDays": 30
}
```

### Poll live signals with x402

```http
GET {STRATEGY_SQUARE_URL}/api/subscriptions/{subscriptionId}/signals
Authorization: Bearer {STRATEGY_SQUARE_TOKEN}
```

Behavior:
1. no new live signals -> free response
2. billable live batch -> HTTP 402 + `paymentRequirements`
3. wallet signs x402 payload and retries with `X-Payment`
4. success returns `signals`, `openclawMessages`, and billing receipt
5. subscription billing is capped within the 30-day window

### Research

Free:

```http
GET {STRATEGY_SQUARE_URL}/api/research/supported-assets
GET {STRATEGY_SQUARE_URL}/api/research/price?instId=BTC-USDT
```

Paid:

```http
GET {STRATEGY_SQUARE_URL}/api/research/candles?instId=BTC-USDT&bar=1H&limit=120
Authorization: Bearer {STRATEGY_SQUARE_TOKEN}
```

Pricing:
- `limit <= 120` -> `$0.005`
- `limit > 120` -> `$0.015`

### Provider earnings

```http
GET {STRATEGY_SQUARE_URL}/api/providers/{walletAddress}
Authorization: Bearer {STRATEGY_SQUARE_TOKEN}
X-Wallet-Address: 0x...
X-Wallet-Timestamp: 1700000000000
X-Wallet-Nonce: 0x...
X-Wallet-Signature: 0x...
```

## Payment Details

- network: X Layer
- asset: USDT (USDt0)
- settlement: x402
- signal tiers:
  - `tier_1`: `$0.03 / signal`, cap `$1.49 / 30d`
  - `tier_2`: `$0.06 / signal`, cap `$2.99 / 30d`
  - `tier_3`: `$0.09 / signal`, cap `$5.99 / 30d`
- revenue split for signals: `90% provider / 10% platform`
- research candles: `100% platform`

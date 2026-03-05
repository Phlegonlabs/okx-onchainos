---
name: strategy-square
description: Browse, publish, purchase, and research on-chain trading data via x402 on Strategy Square marketplace
metadata: { "openclaw": { "emoji": "📊", "requires": { "env": ["STRATEGY_SQUARE_URL"] }, "primaryEnv": "STRATEGY_SQUARE_URL" } }
---

# Strategy Square

An AI-native on-chain strategy marketplace powered by OKX OnchainOS.

## Prerequisites

This skill does **not** install or generate a wallet by itself.

To use paid or write routes, the OpenClaw runtime must already have:
- an X Layer wallet with USDT (USDt0)
- a signing capability for custom wallet-auth headers
- x402 payment capability for `402 -> X-Payment -> retry`

If your OpenClaw environment only supports pure skill text without a wallet runtime, use this skill in read-only mode:
- `GET /api/strategies`
- `GET /api/strategies/{id}`
- `GET /api/research/supported-assets`
- `GET /api/research/price`

## Configuration

Set `STRATEGY_SQUARE_URL` to the base URL of the Strategy Square instance.

If you embed this repo's helper runtime, use:
- `createOpenClawX402Wallet(...).requestWithWalletAuth(...)` for provider writes and subscription creation
- `createOpenClawX402Wallet(...).requestWithAutoPayment(...)` for x402-paid reads

## Available Actions

### Browse Strategies

List all active strategies:

```
GET {STRATEGY_SQUARE_URL}/api/strategies
GET {STRATEGY_SQUARE_URL}/api/strategies?sort=winRate
GET {STRATEGY_SQUARE_URL}/api/strategies?sort=avgReturn
```

Response: `{ strategies: [{ id, name, description, asset, timeframe, pricePerSignal, winRate, avgReturn, totalSignals }] }`

### Get Strategy Details

```
GET {STRATEGY_SQUARE_URL}/api/strategies/{id}
```

Response: `{ strategy: {...}, recentSignals: [...] }`

### Subscribe to a Strategy (wallet-signed)

```
POST {STRATEGY_SQUARE_URL}/api/strategies/{id}/subscribe
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

Behavior:
1. Request must be signed by the same wallet as `subscriberAddress`
2. Existing active subscription is reused
3. Success response returns `{ strategy, subscription, reused }`

### Poll Subscription Signals (x402 payment when pending signals exist)

```
GET {STRATEGY_SQUARE_URL}/api/subscriptions/{subscriptionId}/signals
```

Behavior:
1. If there are no new signals, response is free: `{ pendingCount: 0, signals: [] }`
2. If new signals exist, first response returns HTTP 402 + `paymentRequirements`
3. Your x402 wallet signs and retries with `X-Payment`
4. Success response returns `{ signals, openclawMessages, receipt }`
5. The x402 payer must match the original `subscriberAddress`

### Research Market Data (OpenClaw Analysis Flow)

#### 1) Discover supported assets (free)

```
GET {STRATEGY_SQUARE_URL}/api/research/supported-assets
```

#### 2) Check current price (free)

```
GET {STRATEGY_SQUARE_URL}/api/research/price?instId=BTC-USDT
```

#### 3) Pull candles for strategy analysis (x402 payment required)

```
GET {STRATEGY_SQUARE_URL}/api/research/candles?instId=BTC-USDT&bar=1H&limit=120
```

Behavior:
1. First request returns HTTP 402 + `paymentRequirements`
2. Your x402 wallet signs and retries with `X-Payment`
3. Success response returns `{ candles: [...], receipt: {...} }`

Use this route to run your own quantitative analysis and strategy research in OpenClaw.

### Publish a Strategy (wallet-signed provider write)

```
POST {STRATEGY_SQUARE_URL}/api/strategies
Content-Type: application/json
X-Wallet-Address: 0x...
X-Wallet-Timestamp: 1700000000000
X-Wallet-Nonce: 0x...
X-Wallet-Signature: 0x...
{
  "name": "My Strategy",
  "description": "Description of the strategy logic",
  "asset": "ETH/USDC",
  "timeframe": "4h",
  "pricePerSignal": 5,
  "providerAddress": "0xYourWalletAddress"
}
```

`pricePerSignal` is in cents (5 = $0.05). Response: `201 { id }`

The signing wallet must match `providerAddress`.

### Push a Signal (wallet-signed provider write)

```
PUT {STRATEGY_SQUARE_URL}/api/strategies/{id}/signals
Content-Type: application/json
X-Wallet-Address: 0x...
X-Wallet-Timestamp: 1700000000000
X-Wallet-Nonce: 0x...
X-Wallet-Signature: 0x...
{
  "action": "buy",
  "token": "ETH",
  "entry": 3250.50,
  "stopLoss": 3100.00,
  "takeProfit": 3500.00,
  "reasoning": "RSI crossed above 30, bullish divergence on 4h"
}
```

### Check Provider Earnings

```
GET {STRATEGY_SQUARE_URL}/api/providers/{walletAddress}
```

Response: `{ balance: { totalEarnedCents, pendingCents, totalSignalsSold }, strategies: [...] }`

### Legacy Direct Signal Purchase

```
GET {STRATEGY_SQUARE_URL}/api/strategies/{id}/signals
```

This direct-buy route still exists, but OpenClaw integrations should prefer the subscription flow above.

## Payment Details

- Network: X Layer (zero gas fees)
- Asset: USDT (USD₮0), contract `0x779ded0c9e1022225f8e0630b35a9b54be713736`
- Protocol: x402 v1
- Platform fee: 10% (90% goes to strategy provider)
- Research candles API price: `$0.001` per request (`/api/research/candles`)
- The skill itself does not provision wallets or keys

---
name: strategy-square
description: Browse, publish, purchase, and research on-chain trading data via x402 on Strategy Square marketplace
metadata: { "openclaw": { "emoji": "📊", "requires": { "env": ["STRATEGY_SQUARE_URL"] }, "primaryEnv": "STRATEGY_SQUARE_URL" } }
---

# Strategy Square

An AI-native on-chain strategy marketplace powered by OKX OnchainOS. Purchase trading signals via x402 payments on X Layer (zero gas).

## Configuration

Set `STRATEGY_SQUARE_URL` to the base URL of the Strategy Square instance (e.g., `https://strategy-square.vercel.app`).

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

### Purchase Signals (x402 Payment Required)

```
GET {STRATEGY_SQUARE_URL}/api/strategies/{id}/signals
```

First request returns HTTP 402 with payment requirements. Your x402 payment provider (Claw402 or built-in wallet) will automatically handle the payment flow:
1. Read payment requirements from the 402 response
2. Sign the USDT (USD₮0) transfer authorization on X Layer
3. Retry request with `X-Payment` header

After payment, response: `{ signals: [...], receipt: { txHash, paidAmount, providerCredited, platformFee } }`

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

### Publish a Strategy (Provider)

```
POST {STRATEGY_SQUARE_URL}/api/strategies
Content-Type: application/json
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

### Push a Signal (Provider)

```
PUT {STRATEGY_SQUARE_URL}/api/strategies/{id}/signals
Content-Type: application/json
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

## Payment Details

- Network: X Layer (zero gas fees)
- Asset: USDT (USD₮0), contract `0x779ded0c9e1022225f8e0630b35a9b54be713736`
- Protocol: x402 v1
- Platform fee: 10% (90% goes to strategy provider)
- Research candles API price: `$0.001` per request (`/api/research/candles`)
- No API key or account needed — payment is authentication

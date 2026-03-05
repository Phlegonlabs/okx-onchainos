# Strategy Square - User Documentation

## What is Strategy Square?

Strategy Square is an AI-native on-chain strategy marketplace. Providers publish strategies, subscribers create a 30-day subscription, and new signals are billed through x402 on OKX X Layer.

## OpenClaw Wallet Requirement

This product assumes the OpenClaw runtime already has:
- an X Layer wallet
- enough USDT (USDt0) to pay x402 requests
- the ability to sign wallet-auth headers for provider writes and subscription creation

The skill itself does not install or provision this wallet.

## For Strategy Providers

### Publish a Strategy (wallet-signed)

`POST /api/strategies` requires these headers:
- `X-Wallet-Address`
- `X-Wallet-Timestamp`
- `X-Wallet-Nonce`
- `X-Wallet-Signature`

The signing wallet must match `providerAddress`.

Example body:

```json
{
  "name": "My Alpha Strategy",
  "description": "RSI-based ETH trading signals",
  "asset": "ETH/USDC",
  "timeframe": "4h",
  "pricePerSignal": 5,
  "providerAddress": "0xYourWalletAddress"
}
```

Response: `201 { "id": "abc123" }`

### Push a Signal (wallet-signed)

`PUT /api/strategies/abc123/signals` requires the same wallet-auth headers. The signing wallet must match the strategy owner.

Example body:

```json
{
  "action": "buy",
  "token": "ETH",
  "entry": 3250.5,
  "stopLoss": 3100,
  "takeProfit": 3500,
  "reasoning": "RSI crossed above 30, bullish divergence on 4h"
}
```

### Check Provider Earnings

```bash
curl https://okx-onchainos.vercel.app/api/providers/0xYourWalletAddress
```

## For Strategy Consumers

### Browse Strategies

```bash
curl https://okx-onchainos.vercel.app/api/strategies
```

### Create or Reuse Subscription (wallet-signed)

`POST /api/strategies/{id}/subscribe` requires wallet-auth headers.

Example body:

```json
{
  "subscriberAddress": "0xYourWalletAddress",
  "planDays": 30
}
```

Behavior:
- signing wallet must match `subscriberAddress`
- existing active subscription is reused
- success response returns `{ strategy, subscription, reused }`

### Poll Subscription Signals (x402)

```bash
curl -i https://okx-onchainos.vercel.app/api/subscriptions/sub_123/signals
```

Behavior:
- if no new signals exist, response is free
- if new signals exist, response is `402` with `paymentRequirements`
- retry with `X-Payment`
- x402 payer must match the original `subscriberAddress`

Success response includes:
- `signals`
- `openclawMessages`
- `receipt`

### Legacy Direct Purchase Route

```bash
curl -i https://okx-onchainos.vercel.app/api/strategies/abc123/signals
```

This route still works, but new OpenClaw integrations should prefer the subscription flow.

## For OpenClaw Strategy Research

### Get Supported Assets (Free)

```bash
curl "https://okx-onchainos.vercel.app/api/research/supported-assets"
```

### Get Spot Price (Free)

```bash
curl "https://okx-onchainos.vercel.app/api/research/price?instId=BTC-USDT"
```

### Get Candles (x402, $0.001 per request)

```bash
curl -i "https://okx-onchainos.vercel.app/api/research/candles?instId=BTC-USDT&bar=1H&limit=120"
curl "https://okx-onchainos.vercel.app/api/research/candles?instId=BTC-USDT&bar=1H&limit=120" \
  -H "X-Payment: {x402 payment payload}"
```

Response includes standardized candle data and a payment receipt:
`{ candles: [...], receipt: { paidMicroUsd, paidBaseUnits, txHash } }`

## Supported Payment

- Network: X Layer (zero gas fees)
- Asset: USDT (USD₮0), contract `0x779ded0c9e1022225f8e0630b35a9b54be713736`
- Protocol: x402 v1
- Research candles route pricing: `1000 microUSD` (`$0.001`) per request

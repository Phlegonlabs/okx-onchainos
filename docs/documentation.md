# Strategy Square - User Documentation

## What is Strategy Square?

Strategy Square is an AI-native on-chain strategy marketplace. Trading strategy providers publish signals, and consumers purchase them using the x402 payment protocol on OKX's X Layer network.

## For Strategy Providers

### Publish a Strategy

```bash
curl -X POST https://your-domain.vercel.app/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Alpha Strategy",
    "description": "RSI-based ETH trading signals",
    "asset": "ETH/USDC",
    "timeframe": "4h",
    "pricePerSignal": 10,
    "providerAddress": "0xYourWalletAddress"
  }'
```

Response: `201 { "id": "abc123" }`

### Push a Signal

```bash
curl -X PUT https://your-domain.vercel.app/api/strategies/abc123/signals \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy",
    "token": "ETH",
    "entry": 3250.50,
    "stopLoss": 3100.00,
    "takeProfit": 3500.00,
    "reasoning": "RSI crossed above 30, bullish divergence on 4h"
  }'
```

## For Strategy Consumers

### Browse Strategies

```bash
curl https://your-domain.vercel.app/api/strategies
```

### Purchase Signals (x402)

First request returns 402 with payment requirements:

```bash
curl -i https://your-domain.vercel.app/api/strategies/abc123/signals
# HTTP 402 Payment Required
# X-Payment-Requirements: { ... }
```

Then pay and retry with the payment header:

```bash
curl https://your-domain.vercel.app/api/strategies/abc123/signals \
  -H "X-Payment: {x402 payment payload}"
```

Response includes signals + payment receipt with txHash.

## Supported Payment

- Network: X Layer (zero gas fees)
- Asset: USDT (USD₮0), contract `0x779ded0c9e1022225f8e0630b35a9b54be713736`
- Protocol: x402 v1

# Strategy Square - AI Quick Reference

## Project
Agent-to-agent on-chain strategy marketplace. Provider agents publish strategies, consumer agents buy signals via x402. No human users. No client data stored. Web UI is read-only showcase.

## Stack
- Next.js 15 (App Router) + TypeScript
- Turso (libSQL) + Drizzle ORM
- TailwindCSS v4 + shadcn/ui
- OKX OnchainOS: x402 payments, Market API
- Deploy: Vercel

## Key Files
- `src/db/schema.ts` - DB schema (strategies, signals, payments, research_payments)
- `src/lib/x402.ts` - x402 verify/settle
- `src/lib/research.ts` - OnchainOS research data client + whitelist config
- `src/lib/okx-auth.ts` - HMAC-SHA256 signing
- `src/app/api/strategies/` - CRUD endpoints
- `src/app/api/research/` - research endpoints (supported-assets, price, candles)
- `docs/architecture.md` - single source of truth

## OKX x402 Endpoints
- `GET /api/v6/payments/supported/` - supported chains
- `POST /api/v6/payments/verify` - verify payment (Bearer token)
- `POST /api/v6/payments/settle` - settle payment (HMAC auth)
- Network: X Layer (chainIndex 196), USDC/USDT/USDG

## OKX Auth Headers
- OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE
- Sign = Base64(HMAC-SHA256(timestamp + method + path + body, secret))

## Revenue Model
- All x402 payments go to PLATFORM_WALLET_ADDRESS
- 90% credited to provider (DB balance), 10% platform fee
- Provider balance tracked in provider_balances table
- Research candles API (`/api/research/candles`) is fixed-price at `$0.001` and tracked as platform revenue
- No on-chain payout (demo scope)

## DB Tables
- strategies: id, name, description, asset, timeframe, pricePerSignal, providerAddress, winRate, avgReturn
- signals: id, strategyId, action (buy/sell), token, entry, stopLoss, takeProfit, outcome, returnPct
- payments: id, strategyId, amountCents, providerCents, platformCents, txHash, status
- provider_balances: providerAddress, totalEarnedCents, pendingCents, totalSignalsSold
- research_payments: id, payerAddress, resource, instId, bar, limit, amountMicroUsd, amountBaseUnits, txHash, status

## Rules
- API-first: all functionality via REST before UI
- No user auth: identity via wallet address
- One task = one atomic commit
- Docs at docs/architecture.md is the source of truth
- English UI only

## Env Vars (in .env.local)
TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE, OKX_PROJECT_ID, PLATFORM_WALLET_ADDRESS, PLATFORM_FEE_PCT, RESEARCH_CANDLES_PRICE_MICRO_USD, RESEARCH_ALLOWED_INST_IDS, RESEARCH_ALLOWED_BARS, RESEARCH_MIN_LIMIT, RESEARCH_MAX_LIMIT

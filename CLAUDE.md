# Trading Strategy Agent Gateway - AI Quick Reference

## Product

Private agent gateway on top of OKX OnchainOS.

Primary behaviors:
- public browse of approved strategies
- private template-based strategy submissions
- private subscriptions for live signals
- x402-paid live signal batches
- x402-paid research candles

## Stack

- Next.js App Router + TypeScript
- Turso / libSQL + Drizzle
- TailwindCSS
- OKX OnchainOS verify/settle + market data

## Important Files

- `src/db/schema.ts`
- `src/lib/gateway-auth.ts`
- `src/lib/gateway-pricing.ts`
- `src/lib/strategy-templates.ts`
- `src/lib/strategy-engine.ts`
- `src/lib/x402.ts`
- `src/app/api/strategy-submissions/route.ts`
- `src/app/api/subscriptions/[subscriptionId]/signals/route.ts`
- `src/app/api/research/candles/route.ts`
- `docs/architecture.md`

## Product Rules

- `Authorization: Bearer <GATEWAY_SKILL_TOKEN>` gates premium skill routes
- wallet-auth proves owner identity
- x402 settles only high-value outputs
- providers do not self-price
- only approved strategies appear in the public feed
- live signals are platform-generated, not manually pushed

## Pricing

- `tier_1`: `3` cents / signal, `149` cent period cap
- `tier_2`: `6` cents / signal, `299` cent period cap
- `tier_3`: `9` cents / signal, `599` cent period cap
- research candles:
  - small tier: `5000` microUSD
  - large tier: `15000` microUSD

## Verification

```bash
bun run typecheck
bun test
```

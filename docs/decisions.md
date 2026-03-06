# Trading Strategy Agent Gateway - Architecture Decision Records

## ADR-001: Turso over Cloudflare D1

Use Turso / libSQL to stay SQLite-friendly while keeping Vercel deployment straightforward.

## ADR-002: Private gateway access over open public write access

The product is no longer an open write surface.

Decision:
- public routes stay read-only
- premium routes require `GATEWAY_SKILL_TOKEN`
- owner-sensitive routes also require wallet-auth

## ADR-003: x402 stays as the premium settlement layer

x402 remains mandatory for:
- live signal batches
- research candles

It is no longer treated as the only product gate.

## ADR-004: Submission-first supply model

Providers do not directly create public strategies.

Decision:
- providers submit template + params
- platform backtests first
- only approved submissions become public strategies

## ADR-005: Platform-managed pricing

Providers do not self-price.

Decision:
- score determines strategy tier
- strategy tier determines unit price and 30-day cap
- research candles use request-size tiers

## ADR-006: Platform-managed live signal generation

Manual provider signal pushes are retired.

Decision:
- approved strategies are synced by platform-controlled workflows
- public subscriptions consume only `live` signals

## ADR-007: Platform custody revenue model remains

Signal revenue still settles to the platform wallet first.

Decision:
- `90%` provider
- `10%` platform
- provider withdrawal remains out of scope

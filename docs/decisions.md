# Strategy Square - Architecture Decision Records

## ADR-001: Turso over Cloudflare D1

**Context**: User initially wanted D1, but D1 requires Cloudflare Workers runtime. Vercel deployment was preferred.

**Decision**: Use Turso (libSQL) which is SQLite-compatible and has native Vercel support via `@libsql/client`.

**Consequences**: Same SQLite developer experience, zero extra latency, works with Drizzle ORM.

## ADR-002: No user authentication

**Context**: Platform serves OpenClaw agents as primary consumers. Agents identify via wallet address in x402 payments.

**Decision**: No auth system. Provider identified by `providerAddress` in strategy creation. Consumer identified by `payer` in x402 payment.

**Consequences**: Simpler implementation. Anyone can create strategies (acceptable for demo). Payment verification via x402 provides implicit identity.

## ADR-003: x402 as sole payment method

**Context**: OKX OnchainOS hackathon requires using their capabilities. x402 is the native AI-agent payment protocol.

**Decision**: All signal purchases go through x402. No Stripe, no other payment methods.

**Consequences**: Agent-native. Zero gas on X Layer. Limited to USDC/USDT/USDG on X Layer for now.

## ADR-004: Pre-seeded strategies for demo

**Context**: Need to show a working marketplace on day one.

**Decision**: Seed 4 demo strategies with ~20 fake historical signals each. Real providers can also create strategies via API.

**Consequences**: Immediate visual impact for judges. Mix of demo + real data.

## ADR-005: API-first, UI-second

**Context**: Primary users are OpenClaw agents, not humans.

**Decision**: Build all API endpoints first (M2-M3), then UI (M4). UI is read-only showcase.

**Consequences**: Agents can use the platform before UI exists. UI is a nice-to-have for the demo.

## ADR-006: Platform custody revenue model (Mode A)

**Context**: Need to decide how x402 payments flow. Three options: A) platform collects all, tracks provider balances in DB; B) direct to provider wallet; C) two-step settle.

**Decision**: Mode A — all x402 payments go to platform wallet. 90% credited to provider balance in DB, 10% platform fee. No on-chain payout mechanism.

**Consequences**: Single wallet to manage. Platform can show revenue metrics. Provider "balance" is a DB number — withdrawal is out of scope for hackathon. Simple to implement and demo.

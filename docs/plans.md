# Strategy Square - Milestone Plan

## M1: Project Bootstrap

**Goal**: Working Next.js app with database schema and seed data.

### Tasks

#### M1-T1: Initialize Next.js 15 project
- `npx create-next-app@latest` with App Router, TypeScript, TailwindCSS
- Add dependencies: drizzle-orm, @libsql/client, nanoid, shadcn/ui
- Commit Boundary: exactly one atomic commit

#### M1-T2: Database schema + Drizzle config
- Define schema in `src/db/schema.ts` (strategies, signals, payments, provider_balances)
- Configure Turso connection in `src/db/client.ts`
- Create `drizzle.config.ts`
- Run initial migration
- Commit Boundary: exactly one atomic commit

#### M1-T3: Seed demo strategies
- Create `src/db/seed.ts` with 4 strategies + ~20 signals each
- Realistic win rates, returns, timestamps
- Add `npm run seed` script
- Commit Boundary: exactly one atomic commit

---

## M2: Strategy CRUD API

**Goal**: Full REST API for strategy listing, detail, creation, and signal management.

### Tasks

#### M2-T1: GET /api/strategies - list strategies
- Query all active strategies from DB
- Return: id, name, description, asset, timeframe, pricePerSignal, winRate, avgReturn, totalSignals
- Support query params: sort (winRate, avgReturn, newest)
- Commit Boundary: exactly one atomic commit

#### M2-T2: GET /api/strategies/:id - strategy detail
- Return full strategy info + recent signals summary
- 404 if not found
- Commit Boundary: exactly one atomic commit

#### M2-T3: POST /api/strategies - create strategy
- Validate body: name, description, asset, timeframe, pricePerSignal, providerAddress
- Insert into DB, return 201 + strategyId
- Commit Boundary: exactly one atomic commit

#### M2-T4: PUT /api/strategies/:id/signals - push signal
- Validate body: action, token, entry, stopLoss, takeProfit, reasoning
- Insert signal, update strategy stats (totalSignals)
- Commit Boundary: exactly one atomic commit

---

## M3: x402 Payment Integration

**Goal**: Consumer agents can pay for signals via x402 protocol.

### Tasks

#### M3-T1: OKX auth signing utility
- Implement HMAC-SHA256 signing in `src/lib/okx-auth.ts`
- Headers: OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE
- Commit Boundary: exactly one atomic commit

#### M3-T2: x402 verify + settle helpers
- Implement `verifyPayment()` calling POST /api/v6/x402/verify
- Implement `settlePayment()` calling POST /api/v6/x402/settle
- Build paymentRequirements object generator
- Commit Boundary: exactly one atomic commit

#### M3-T3: GET /api/strategies/:id/signals - x402 gated
- Check for X-Payment header
- If missing: return 402 + X-Payment-Requirements (payTo = platform wallet)
- If present: verify -> settle -> return signals + receipt
- Record payment in DB (split: 90% provider, 10% platform)
- Update provider_balances (totalEarnedCents, pendingCents, totalSignalsSold)
- Commit Boundary: exactly one atomic commit

#### M3-T4: GET /api/providers/:address - provider balance
- Return provider earnings, pending balance, total signals sold
- Commit Boundary: exactly one atomic commit

---

## M4: Web UI

**Goal**: Human-friendly pages to browse the marketplace.

### Tasks

#### M4-T1: Homepage / leaderboard
- Strategy cards grid with key metrics (winRate, avgReturn, price)
- Sort/filter controls
- Responsive layout, dark theme
- Commit Boundary: exactly one atomic commit

#### M4-T2: Strategy detail page
- Strategy info header
- Signal history table (action, token, entry, outcome, return)
- Simple performance chart (cumulative returns)
- Commit Boundary: exactly one atomic commit

#### M4-T3: Provider earnings dashboard
- Page showing provider balance, earnings history
- Query by provider wallet address
- Commit Boundary: exactly one atomic commit

---

## M5: OKX Market API Integration

**Goal**: Display real token prices on strategy pages.

### Tasks

#### M5-T1: OKX Market API client
- Implement `src/lib/market.ts`
- Fetch token price, 24h change
- Commit Boundary: exactly one atomic commit

#### M5-T2: GET /api/market/:token proxy endpoint
- Proxy to OKX Market API
- Cache response (60s)
- Commit Boundary: exactly one atomic commit

#### M5-T3: Integrate market data into UI
- Show current price on strategy detail page
- Show price context for signals
- Commit Boundary: exactly one atomic commit

---

## M6: OpenClaw Skill + API Docs

**Goal**: OpenClaw agents can discover and use the marketplace.

### Tasks

#### M6-T1: OpenClaw SKILL.md
- Create `skills/strategy-square/SKILL.md` with YAML frontmatter
- Document all API endpoints, x402 payment flow, example usage
- Include instructions for agent: how to browse, buy signals, publish strategies
- Commit Boundary: exactly one atomic commit

#### M6-T2: README + agent quickstart
- README.md with project overview
- Agent quickstart: install skill, configure wallet, example calls
- Commit Boundary: exactly one atomic commit

---

## M7: Production Readiness Gate

**Goal**: Deploy to Vercel, ensure everything works end-to-end.

### Tasks

#### M7-T1: Environment + Vercel config
- Configure env vars (OKX keys, Turso URL/token)
- vercel.json if needed
- Commit Boundary: exactly one atomic commit

#### M7-T2: End-to-end smoke test
- Test: list strategies, get detail, create strategy, push signal
- Test: x402 payment flow (with test credentials)
- Commit Boundary: exactly one atomic commit

#### M7-T3: Final polish
- Error handling on all endpoints
- Loading states on UI
- SEO meta tags
- Commit Boundary: exactly one atomic commit

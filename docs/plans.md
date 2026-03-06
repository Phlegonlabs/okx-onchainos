# Trading Strategy Agent Gateway - Milestone Plan

## Completed History

- `M1` Project bootstrap
- `M2` Strategy CRUD API
- `M3` x402 payment integration
- `M4` Web UI
- `M5` OKX market API integration
- `M6` OpenClaw skill + docs
- `M7` Production readiness gate
- `M8` OpenClaw research API

## M9: Agent Gateway Reframe

**Goal**: convert the product from an open strategy marketplace into a private Trading Strategy Agent Gateway.

### M9-T1: Private gateway bearer access
- Add bearer-token gating for premium skill routes
- Separate public browse routes from private premium routes
- Commit Boundary: exactly one atomic commit

### M9-T2: Submission-driven supply
- Replace direct public strategy creation with template-based strategy submissions
- Backtest each submission and only list approved strategies
- Commit Boundary: exactly one atomic commit

### M9-T3: Platform-managed pricing
- Assign signal tiers and subscription caps from strategy score
- Make research candle pricing tiered by request size
- Commit Boundary: exactly one atomic commit

### M9-T4: Platform-managed live signal rail
- Add internal sync/rescore control routes
- Generate live signals from approved template strategies
- Commit Boundary: exactly one atomic commit

### M9-T5: Gateway docs and skill refresh
- Rewrite README, architecture, user docs, secrets, and skill content for the new product model
- Commit Boundary: exactly one atomic commit

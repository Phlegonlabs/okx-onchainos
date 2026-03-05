# Strategy Square - Implementation Rules

## First-Principles Execution

- Solve root causes from requirements and architecture, not superficial patches.
- Always trace back to `docs/architecture.md` before implementing.
- If requirements are ambiguous, check architecture doc first, then ask.

## Atomic Task Execution

- `task` and `sub-task` are the same execution unit.
- One task -> one atomic commit.
- Finish the full task scope before commit: all affected code, tests, configs, scripts, and docs.

## Rewrite-First Policy

- If a module becomes hard to fix cleanly, delete and rewrite the module.
- Code is cheap. Clarity beats compatibility.

## No-Compatibility Rule

- Do not add compatibility code (adapter, shim, dual-path logic, deprecated aliases).
- If a rewrite changes interfaces, fix all impacted callers in the same task.
- Do not leave breakage for a follow-up task.

## Code Style

- TypeScript strict mode
- Prefer `const` over `let`
- Use async/await, no callbacks
- Keep files under 200 lines; split if larger
- No `any` types unless wrapping external API responses

## Commit Message Format

```
M{n}-T{m}: short description

- what changed
- why

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Testing

- No formal test framework required for hackathon
- Smoke test each API endpoint with curl after implementation
- Verify x402 flow end-to-end before marking M3 done

## Environment Variables

All secrets in `.env.local`, never committed. See `docs/secrets.md`.

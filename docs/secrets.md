# Trading Strategy Agent Gateway - Environment Variables

All secrets go in `.env.local` and must never be committed.

## Required

| Variable | Used By | Description |
|----------|---------|-------------|
| `OKX_API_KEY` | `src/lib/okx-auth.ts`, `src/lib/x402.ts`, `src/lib/research.ts` | OKX OnchainOS API key |
| `OKX_SECRET_KEY` | `src/lib/okx-auth.ts` | OKX HMAC secret |
| `OKX_PASSPHRASE` | `src/lib/okx-auth.ts` | OKX API passphrase |
| `OKX_PROJECT_ID` | `src/lib/okx-auth.ts` | OKX project identifier |
| `PLATFORM_WALLET_ADDRESS` | `src/lib/x402.ts` | Wallet receiving x402 payments |
| `GATEWAY_SKILL_TOKEN` | private gateway routes | Bearer token required for premium skill access |
| `INTERNAL_CONTROL_TOKEN` | internal control routes | Bearer token for sync/rescore routes |

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `TURSO_DATABASE_URL` | `file:local.db` | Turso or local libSQL URL |
| `TURSO_AUTH_TOKEN` | unset | Turso auth token |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Public app base URL |
| `PLATFORM_FEE_PCT` | `10` | Signal revenue share kept by platform |
| `RESEARCH_ALLOWED_INST_IDS` | built-in list | Research asset whitelist |
| `RESEARCH_ALLOWED_BARS` | built-in list | Research bar whitelist |
| `RESEARCH_MIN_LIMIT` | `20` | Minimum allowed candle limit |
| `RESEARCH_MAX_LIMIT` | `500` | Maximum allowed candle limit |
| `RESEARCH_SMALL_CANDLES_MAX_LIMIT` | `120` | Upper bound for small research pricing tier |
| `RESEARCH_SMALL_CANDLES_PRICE_MICRO_USD` | `5000` | Price for small candles requests |
| `RESEARCH_LARGE_CANDLES_PRICE_MICRO_USD` | `15000` | Price for large candles requests |
| `DEMO_AGENT_PRIVATE_KEY` | unset | Local demo agent wallet only |
| `DEMO_AGENT_ADDRESS` | unset | Local demo agent address only |

## Example

```env
TURSO_DATABASE_URL=file:local.db
OKX_API_KEY=your-api-key
OKX_SECRET_KEY=your-secret-key
OKX_PASSPHRASE=your-passphrase
OKX_PROJECT_ID=your-project-id
PLATFORM_WALLET_ADDRESS=0xYourPlatformWalletAddress
PLATFORM_FEE_PCT=10
GATEWAY_SKILL_TOKEN=your-private-skill-bearer-token
INTERNAL_CONTROL_TOKEN=your-internal-control-bearer-token
RESEARCH_ALLOWED_INST_IDS=BTC-USDT,ETH-USDT,SOL-USDT,OKB-USDT,XRP-USDT,DOGE-USDT,ADA-USDT
RESEARCH_ALLOWED_BARS=1m,5m,15m,1H,4H,1D
RESEARCH_MIN_LIMIT=20
RESEARCH_MAX_LIMIT=500
RESEARCH_SMALL_CANDLES_MAX_LIMIT=120
RESEARCH_SMALL_CANDLES_PRICE_MICRO_USD=5000
RESEARCH_LARGE_CANDLES_PRICE_MICRO_USD=15000
```

## Notes

- `GATEWAY_SKILL_TOKEN` is the main product gate. Without it, callers should only see public browse routes.
- `INTERNAL_CONTROL_TOKEN` should never be shared with external skill users.
- The current x402 settlement flow in this repo still follows the OKX verify/settle endpoints already integrated in `src/lib/x402.ts`.

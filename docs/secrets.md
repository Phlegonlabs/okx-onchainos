# Strategy Square - Environment Variables

All secrets go in `.env.local` (never committed).

```env
# ============================================================
# Turso Database
# ============================================================
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# ============================================================
# OKX OnchainOS API (for x402 payments + market data)
# ============================================================
OKX_API_KEY=your-api-key
OKX_SECRET_KEY=your-secret-key
OKX_PASSPHRASE=your-passphrase
OKX_PROJECT_ID=your-project-id

# ============================================================
# Platform Configuration
# ============================================================
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PLATFORM_WALLET_ADDRESS=0xYourPlatformWalletAddress
PLATFORM_FEE_PCT=10

# ============================================================
# Research API Configuration (/api/research/*)
# ============================================================
RESEARCH_CANDLES_PRICE_MICRO_USD=1000
RESEARCH_ALLOWED_INST_IDS=BTC-USDT,ETH-USDT,SOL-USDT,OKB-USDT,XRP-USDT,DOGE-USDT,ADA-USDT
RESEARCH_ALLOWED_BARS=1m,5m,15m,1H,4H,1D
RESEARCH_MIN_LIMIT=20
RESEARCH_MAX_LIMIT=500

# ============================================================
# Demo Agent (for scripts/demo-agent.ts only)
# ============================================================
DEMO_AGENT_PRIVATE_KEY=0xYourDemoAgentPrivateKey
DEMO_AGENT_ADDRESS=0xYourDemoAgentAddress
```

## Variable Reference

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `TURSO_DATABASE_URL` | Production only | `src/db/client.ts`, `src/db/seed.ts` | Turso database URL. Falls back to `file:local.db` for local dev. |
| `TURSO_AUTH_TOKEN` | Production only | `src/db/client.ts`, `src/db/seed.ts` | Turso auth token. Not needed for local dev. |
| `OKX_API_KEY` | Yes | `src/lib/okx-auth.ts`, `src/lib/x402.ts` | OKX API key. Used in `OK-ACCESS-KEY` header for x402 verify and settle. |
| `OKX_SECRET_KEY` | Yes | `src/lib/okx-auth.ts` | OKX secret key. Used for HMAC-SHA256 signature generation. |
| `OKX_PASSPHRASE` | Yes | `src/lib/okx-auth.ts` | OKX API passphrase. Set when creating the API key. |
| `OKX_PROJECT_ID` | Yes | `src/lib/okx-auth.ts` | OKX project ID from developer portal. |
| `NEXT_PUBLIC_BASE_URL` | No | Client-side | Base URL for the app. Defaults to `http://localhost:3000`. |
| `PLATFORM_WALLET_ADDRESS` | Yes | `src/lib/x402.ts` | The wallet address that receives all x402 payments. Must be a valid EVM address on X Layer. |
| `PLATFORM_FEE_PCT` | No | `src/app/api/strategies/[id]/signals/route.ts` | Platform fee percentage. Defaults to `10` (10%). |
| `RESEARCH_CANDLES_PRICE_MICRO_USD` | No | `src/lib/research.ts` | Price per candles request in micro USD units. Default `1000` = `$0.001`. |
| `RESEARCH_ALLOWED_INST_IDS` | No | `src/lib/research.ts`, `src/app/api/research/price/route.ts`, `src/app/api/research/candles/route.ts` | CSV whitelist of allowed instrument IDs for research APIs. |
| `RESEARCH_ALLOWED_BARS` | No | `src/lib/research.ts`, `src/app/api/research/candles/route.ts` | CSV whitelist of allowed candle bars. |
| `RESEARCH_MIN_LIMIT` | No | `src/lib/research.ts`, `src/app/api/research/candles/route.ts` | Minimum allowed `limit` for candles queries (default `20`). |
| `RESEARCH_MAX_LIMIT` | No | `src/lib/research.ts`, `src/app/api/research/candles/route.ts` | Maximum allowed `limit` for candles queries (default `500`). |
| `DEMO_AGENT_PRIVATE_KEY` | Demo only | `scripts/demo-agent.ts` | Private key for the demo consumer agent wallet. |
| `DEMO_AGENT_ADDRESS` | Demo only | `scripts/demo-agent.ts` | Address of the demo consumer agent wallet. |

## How to Obtain

### Turso Database

**Option A: CLI (macOS / Linux)**
```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create strategy-square
turso db show strategy-square --url          # → TURSO_DATABASE_URL
turso db tokens create strategy-square       # → TURSO_AUTH_TOKEN
```

**Option B: CLI (Windows)**
```powershell
winget install ChiselStrike.Turso
# restart terminal, then:
turso auth login
turso db create strategy-square
turso db show strategy-square --url
turso db tokens create strategy-square
```

**Option C: Web Dashboard**
1. Go to https://turso.tech and sign up / log in
2. Create a new database named `strategy-square`
3. Copy the Database URL → `TURSO_DATABASE_URL`
4. Create a token → `TURSO_AUTH_TOKEN`

### OKX OnchainOS API

1. Go to https://web3.okx.com/onchainos/dev-docs/home/developer-portal
2. Sign in with your OKX account
3. Create a new Project → copy the Project ID → `OKX_PROJECT_ID`
4. Inside the project, click "Create API Key"
5. Set a name and passphrase
6. Save the 3 values:
   - API Key → `OKX_API_KEY`
   - Secret Key → `OKX_SECRET_KEY`
   - Passphrase → `OKX_PASSPHRASE`

### Platform Wallet

Use any EVM wallet you control (OKX Wallet, MetaMask, etc.):
- Copy your wallet address on X Layer network → `PLATFORM_WALLET_ADDRESS`
- This wallet will receive all x402 payments from consumers

### Demo Agent Wallet

Generate a fresh wallet:
```bash
npx tsx scripts/generate-wallet.ts
```

Then fund it with a small amount of USDT (USD₮0) on X Layer:
- Token address: `0x779ded0c9e1022225f8e0630b35a9b54be713736`
- Open OKX Exchange → Withdraw → USDT → Network: **X Layer**
- Send to the generated address
- $1 is enough for many demo transactions

## Local Development (Minimum)

For local dev without Turso (uses SQLite file):

```env
OKX_API_KEY=your-api-key
OKX_SECRET_KEY=your-secret-key
OKX_PASSPHRASE=your-passphrase
OKX_PROJECT_ID=your-project-id
PLATFORM_WALLET_ADDRESS=0xYourWallet
DEMO_AGENT_PRIVATE_KEY=0xGeneratedKey
```

## Vercel Deployment

Set all variables (except `DEMO_AGENT_*`) in Vercel → Project Settings → Environment Variables.

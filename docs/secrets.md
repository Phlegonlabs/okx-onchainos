# Strategy Square - Environment Variables

All secrets go in `.env.local` (never committed).

```env
# Turso Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# OKX OnchainOS API (for x402 settle + market data)
OKX_API_KEY=your-api-key
OKX_SECRET_KEY=your-secret-key
OKX_PASSPHRASE=your-passphrase
OKX_PROJECT_ID=your-project-id

# Platform
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PLATFORM_WALLET_ADDRESS=0xYourPlatformWalletAddress
PLATFORM_FEE_PCT=10
```

## How to obtain

### Turso
1. `turso auth login`
2. `turso db create strategy-square`
3. `turso db tokens create strategy-square`

### OKX OnchainOS
1. Go to https://web3.okx.com/onchainos/dev-docs/home/developer-portal
2. Create a project
3. Create an API key (save key, secret, passphrase)
4. Note the project ID

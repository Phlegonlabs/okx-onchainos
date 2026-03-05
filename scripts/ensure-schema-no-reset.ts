import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log("Ensuring schema (no reset)...");

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      asset TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      price_per_signal INTEGER NOT NULL,
      provider_address TEXT NOT NULL,
      total_signals INTEGER DEFAULT 0,
      win_rate REAL DEFAULT 0,
      avg_return REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL REFERENCES strategies(id),
      action TEXT NOT NULL,
      token TEXT NOT NULL,
      entry REAL NOT NULL,
      stop_loss REAL,
      take_profit REAL,
      reasoning TEXT,
      outcome TEXT,
      return_pct REAL,
      created_at TEXT DEFAULT (datetime('now')),
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL REFERENCES strategies(id),
      amount_cents INTEGER NOT NULL,
      provider_cents INTEGER NOT NULL,
      platform_cents INTEGER NOT NULL,
      tx_hash TEXT,
      status TEXT DEFAULT 'settled',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS provider_balances (
      provider_address TEXT PRIMARY KEY,
      total_earned_cents INTEGER DEFAULT 0,
      pending_cents INTEGER DEFAULT 0,
      total_signals_sold INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallet_auth_nonces (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL REFERENCES strategies(id),
      subscriber_address TEXT NOT NULL,
      plan_days INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_paid_signal_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS research_payments (
      id TEXT PRIMARY KEY,
      payer_address TEXT NOT NULL,
      resource TEXT NOT NULL,
      inst_id TEXT NOT NULL,
      bar TEXT NOT NULL,
      "limit" INTEGER NOT NULL,
      amount_micro_usd INTEGER NOT NULL,
      amount_base_units TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'settled',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log("Schema ensured. No rows were deleted.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Ensure schema failed: ${message}`);
  process.exit(1);
});

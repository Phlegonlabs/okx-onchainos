import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

type ColumnSpec = {
  table: string;
  column: string;
  sql: string;
};

async function getExistingColumns(table: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return new Set(
    (result.rows as Array<Record<string, unknown>>).map((row) => String(row.name))
  );
}

async function ensureColumn(spec: ColumnSpec) {
  const columns = await getExistingColumns(spec.table);
  if (columns.has(spec.column)) return false;
  await client.execute(spec.sql);
  return true;
}

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

    CREATE TABLE IF NOT EXISTS strategy_submissions (
      id TEXT PRIMARY KEY,
      provider_address TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      inst_id TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      template_key TEXT NOT NULL,
      params_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      score INTEGER DEFAULT 0,
      rejection_reason TEXT,
      strategy_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategy_backtests (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES strategy_submissions(id),
      strategy_id TEXT,
      status TEXT NOT NULL,
      inst_id TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      template_key TEXT NOT NULL,
      score INTEGER NOT NULL,
      signal_count INTEGER NOT NULL,
      win_rate REAL NOT NULL,
      avg_return REAL NOT NULL,
      cumulative_return_pct REAL NOT NULL,
      max_drawdown_pct REAL NOT NULL,
      window_days INTEGER NOT NULL,
      params_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const additions: ColumnSpec[] = [
    {
      table: "strategies",
      column: "listing_status",
      sql: "ALTER TABLE strategies ADD COLUMN listing_status TEXT DEFAULT 'approved'",
    },
    {
      table: "strategies",
      column: "template_key",
      sql: "ALTER TABLE strategies ADD COLUMN template_key TEXT",
    },
    {
      table: "strategies",
      column: "params_json",
      sql: "ALTER TABLE strategies ADD COLUMN params_json TEXT",
    },
    {
      table: "strategies",
      column: "score",
      sql: "ALTER TABLE strategies ADD COLUMN score INTEGER DEFAULT 0",
    },
    {
      table: "strategies",
      column: "strategy_tier",
      sql: "ALTER TABLE strategies ADD COLUMN strategy_tier TEXT DEFAULT 'tier_1'",
    },
    {
      table: "strategies",
      column: "period_cap_cents",
      sql: "ALTER TABLE strategies ADD COLUMN period_cap_cents INTEGER DEFAULT 149",
    },
    {
      table: "strategies",
      column: "last_scored_at",
      sql: "ALTER TABLE strategies ADD COLUMN last_scored_at TEXT",
    },
    {
      table: "strategies",
      column: "manual_delisted_at",
      sql: "ALTER TABLE strategies ADD COLUMN manual_delisted_at TEXT",
    },
    {
      table: "signals",
      column: "source",
      sql: "ALTER TABLE signals ADD COLUMN source TEXT DEFAULT 'backtest'",
    },
    {
      table: "payments",
      column: "subscription_id",
      sql: "ALTER TABLE payments ADD COLUMN subscription_id TEXT",
    },
    {
      table: "payments",
      column: "billing_type",
      sql: "ALTER TABLE payments ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'signal_batch'",
    },
    {
      table: "payments",
      column: "units_billed",
      sql: "ALTER TABLE payments ADD COLUMN units_billed INTEGER NOT NULL DEFAULT 1",
    },
  ];

  let changed = 0;
  for (const addition of additions) {
    const didChange = await ensureColumn(addition);
    if (didChange) changed += 1;
  }

  console.log(`Schema ensured. Added ${changed} missing columns. No rows were deleted.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Ensure schema failed: ${message}`);
  process.exit(1);
});

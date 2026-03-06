import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { nanoid } from "nanoid";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

type SignalSeed = {
  action: "buy" | "sell";
  token: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  outcome: "win" | "loss";
  returnPct: number;
  reasoning: string;
  daysAgo: number;
};

function generateSignals(
  token: string,
  basePrice: number,
  count: number,
  winRateTarget: number
): SignalSeed[] {
  const signals: SignalSeed[] = [];
  for (let i = 0; i < count; i++) {
    const isWin = Math.random() < winRateTarget;
    const isBuy = Math.random() > 0.3;
    const entry = basePrice * randomBetween(0.85, 1.15);
    const sl = isBuy ? entry * 0.95 : entry * 1.05;
    const tp = isBuy ? entry * 1.08 : entry * 0.92;
    const returnPct = isWin
      ? randomBetween(2, 12)
      : -randomBetween(1, 6);

    signals.push({
      action: isBuy ? "buy" : "sell",
      token,
      entry: Math.round(entry * 100) / 100,
      stopLoss: Math.round(sl * 100) / 100,
      takeProfit: Math.round(tp * 100) / 100,
      outcome: isWin ? "win" : "loss",
      returnPct,
      reasoning: isWin
        ? `${isBuy ? "Bullish" : "Bearish"} signal confirmed by indicator confluence`
        : `Signal invalidated, stopped out`,
      daysAgo: count - i + Math.floor(Math.random() * 3),
    });
  }
  return signals;
}

const seedStrategies = [
  {
    name: "Alpha Momentum",
    description:
      "SMA 20/50 crossover strategy. Goes long when fast MA crosses above slow MA, short on death cross. Works best in trending markets.",
    asset: "ETH/USDC",
    timeframe: "4h",
    pricePerSignal: 5,
    providerAddress: "0xa111111111111111111111111111111111111111",
    token: "ETH",
    basePrice: 3200,
    signalCount: 22,
    winRateTarget: 0.63,
  },
  {
    name: "RSI Sniper",
    description:
      "RSI oversold/overbought reversal strategy. Enters on RSI < 30 (buy) or RSI > 70 (sell) with volume confirmation.",
    asset: "BTC/USDC",
    timeframe: "1d",
    pricePerSignal: 8,
    providerAddress: "0xb222222222222222222222222222222222222222",
    token: "BTC",
    basePrice: 95000,
    signalCount: 18,
    winRateTarget: 0.67,
  },
  {
    name: "MACD Rider",
    description:
      "MACD histogram momentum strategy. Enters on golden cross, exits on death cross. Optimized for SOL volatility.",
    asset: "SOL/USDC",
    timeframe: "4h",
    pricePerSignal: 6,
    providerAddress: "0xc333333333333333333333333333333333333333",
    token: "SOL",
    basePrice: 180,
    signalCount: 25,
    winRateTarget: 0.58,
  },
  {
    name: "Bollinger Bounce",
    description:
      "Mean reversion strategy using Bollinger Bands. Buys at lower band, sells at upper band. Best in ranging markets.",
    asset: "ETH/USDC",
    timeframe: "1d",
    pricePerSignal: 7,
    providerAddress: "0xd444444444444444444444444444444444444444",
    token: "ETH",
    basePrice: 3200,
    signalCount: 20,
    winRateTarget: 0.7,
  },
];

async function seed() {
  console.log("Seeding database...");

  await client.executeMultiple(`
    DROP TABLE IF EXISTS strategy_backtests;
    DROP TABLE IF EXISTS strategy_submissions;
    DROP TABLE IF EXISTS research_payments;
    DROP TABLE IF EXISTS subscriptions;
    DROP TABLE IF EXISTS wallet_auth_nonces;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS signals;
    DROP TABLE IF EXISTS provider_balances;
    DROP TABLE IF EXISTS strategies;

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
      listing_status TEXT DEFAULT 'approved',
      template_key TEXT,
      params_json TEXT,
      score INTEGER DEFAULT 0,
      strategy_tier TEXT DEFAULT 'tier_1',
      period_cap_cents INTEGER DEFAULT 149,
      last_scored_at TEXT,
      manual_delisted_at TEXT,
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
      source TEXT DEFAULT 'backtest',
      created_at TEXT DEFAULT (datetime('now')),
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL REFERENCES strategies(id),
      subscription_id TEXT,
      amount_cents INTEGER NOT NULL,
      provider_cents INTEGER NOT NULL,
      platform_cents INTEGER NOT NULL,
      billing_type TEXT NOT NULL DEFAULT 'signal_batch',
      units_billed INTEGER NOT NULL DEFAULT 1,
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

  for (const s of seedStrategies) {
    const strategyId = nanoid(12);
    const sigs = generateSignals(s.token, s.basePrice, s.signalCount, s.winRateTarget);

    const wins = sigs.filter((sig) => sig.outcome === "win").length;
    const winRate = Math.round((wins / sigs.length) * 100) / 100;
    const avgReturn =
      Math.round(
        (sigs.reduce((sum, sig) => sum + sig.returnPct, 0) / sigs.length) * 100
      ) / 100;

    await db.insert(schema.strategies).values({
      id: strategyId,
      name: s.name,
      description: s.description,
      asset: s.asset,
      timeframe: s.timeframe,
      pricePerSignal: s.pricePerSignal,
      providerAddress: s.providerAddress,
      totalSignals: sigs.length,
      winRate,
      avgReturn,
      status: "active",
    });

    for (const sig of sigs) {
      await db.insert(schema.signals).values({
        id: nanoid(12),
        strategyId,
        action: sig.action,
        token: sig.token,
        entry: sig.entry,
        stopLoss: sig.stopLoss,
        takeProfit: sig.takeProfit,
        reasoning: sig.reasoning,
        outcome: sig.outcome,
        returnPct: sig.returnPct,
        createdAt: daysAgo(sig.daysAgo),
        settledAt: daysAgo(sig.daysAgo - 1),
      });
    }

    await db
      .insert(schema.providerBalances)
      .values({
        providerAddress: s.providerAddress,
        totalEarnedCents: 0,
        pendingCents: 0,
        totalSignalsSold: 0,
      })
      .onConflictDoNothing();

    console.log(`  Seeded: ${s.name} (${sigs.length} signals, ${winRate * 100}% win rate)`);
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

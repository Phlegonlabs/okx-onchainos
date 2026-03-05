import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const strategies = sqliteTable("strategies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  asset: text("asset").notNull(),
  timeframe: text("timeframe").notNull(),
  pricePerSignal: integer("price_per_signal").notNull(),
  providerAddress: text("provider_address").notNull(),
  totalSignals: integer("total_signals").default(0),
  winRate: real("win_rate").default(0),
  avgReturn: real("avg_return").default(0),
  status: text("status").default("active"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const signals = sqliteTable("signals", {
  id: text("id").primaryKey(),
  strategyId: text("strategy_id")
    .notNull()
    .references(() => strategies.id),
  action: text("action").notNull(),
  token: text("token").notNull(),
  entry: real("entry").notNull(),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  reasoning: text("reasoning"),
  outcome: text("outcome"),
  returnPct: real("return_pct"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  settledAt: text("settled_at"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  strategyId: text("strategy_id")
    .notNull()
    .references(() => strategies.id),
  amountCents: integer("amount_cents").notNull(),
  providerCents: integer("provider_cents").notNull(),
  platformCents: integer("platform_cents").notNull(),
  txHash: text("tx_hash"),
  status: text("status").default("settled"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const providerBalances = sqliteTable("provider_balances", {
  providerAddress: text("provider_address").primaryKey(),
  totalEarnedCents: integer("total_earned_cents").default(0),
  pendingCents: integer("pending_cents").default(0),
  totalSignalsSold: integer("total_signals_sold").default(0),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

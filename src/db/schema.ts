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
  listingStatus: text("listing_status").default("approved"),
  templateKey: text("template_key"),
  paramsJson: text("params_json"),
  score: integer("score").default(0),
  strategyTier: text("strategy_tier").default("tier_1"),
  periodCapCents: integer("period_cap_cents").default(149),
  lastScoredAt: text("last_scored_at"),
  manualDelistedAt: text("manual_delisted_at"),
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
  source: text("source").default("backtest"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  settledAt: text("settled_at"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  strategyId: text("strategy_id")
    .notNull()
    .references(() => strategies.id),
  subscriptionId: text("subscription_id"),
  amountCents: integer("amount_cents").notNull(),
  providerCents: integer("provider_cents").notNull(),
  platformCents: integer("platform_cents").notNull(),
  billingType: text("billing_type").notNull().default("signal_batch"),
  unitsBilled: integer("units_billed").notNull().default(1),
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

export const walletAuthNonces = sqliteTable("wallet_auth_nonces", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  nonce: text("nonce").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  strategyId: text("strategy_id")
    .notNull()
    .references(() => strategies.id),
  subscriberAddress: text("subscriber_address").notNull(),
  planDays: integer("plan_days").notNull().default(30),
  status: text("status").notNull().default("active"), // active | expired | canceled
  startedAt: text("started_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastPaidSignalAt: text("last_paid_signal_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const researchPayments = sqliteTable("research_payments", {
  id: text("id").primaryKey(),
  payerAddress: text("payer_address").notNull(),
  resource: text("resource").notNull(),
  instId: text("inst_id").notNull(),
  bar: text("bar").notNull(),
  limit: integer("limit").notNull(),
  amountMicroUsd: integer("amount_micro_usd").notNull(),
  amountBaseUnits: text("amount_base_units").notNull(),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("settled"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const strategySubmissions = sqliteTable("strategy_submissions", {
  id: text("id").primaryKey(),
  providerAddress: text("provider_address").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  instId: text("inst_id").notNull(),
  timeframe: text("timeframe").notNull(),
  templateKey: text("template_key").notNull(),
  paramsJson: text("params_json").notNull(),
  status: text("status").notNull().default("pending"),
  score: integer("score").default(0),
  rejectionReason: text("rejection_reason"),
  strategyId: text("strategy_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const strategyBacktests = sqliteTable("strategy_backtests", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => strategySubmissions.id),
  strategyId: text("strategy_id"),
  status: text("status").notNull(),
  instId: text("inst_id").notNull(),
  timeframe: text("timeframe").notNull(),
  templateKey: text("template_key").notNull(),
  score: integer("score").notNull(),
  signalCount: integer("signal_count").notNull(),
  winRate: real("win_rate").notNull(),
  avgReturn: real("avg_return").notNull(),
  cumulativeReturnPct: real("cumulative_return_pct").notNull(),
  maxDrawdownPct: real("max_drawdown_pct").notNull(),
  windowDays: integer("window_days").notNull(),
  paramsJson: text("params_json").notNull(),
  metricsJson: text("metrics_json").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

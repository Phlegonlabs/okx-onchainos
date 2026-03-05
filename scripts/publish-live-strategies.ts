/**
 * Create "Live Backtest" strategies from real OKX candles and persist to DB.
 *
 * Usage:
 *   bun run strategy:publish-live
 *
 * Optional env:
 *   LIVE_PUBLISH_BAR=1D
 *   LIVE_PUBLISH_LIMIT=240
 *   LIVE_PUBLISH_MIN_DAYS=90
 *   LIVE_PUBLISH_INST_IDS=BTC-USDT,ETH-USDT,SOL-USDT
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nanoid } from "nanoid";
import { db } from "../src/db/client";
import {
  payments,
  providerBalances,
  signals,
  strategies,
} from "../src/db/schema";
import { eq, inArray, like, or, sql } from "drizzle-orm";

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SignalValue = -1 | 0 | 1;

type StrategyDef = {
  key: "alpha" | "rsi" | "bollinger";
  label: string;
  description: string;
  providerAddress: string;
  pricePerSignal: number;
  minLookback: number;
  signalAt: (candles: Candle[], index: number) => SignalValue;
};

type TradeSignal = {
  candleIndex: number;
  action: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  outcome: "win" | "loss";
  returnPct: number;
  createdAt: string;
  settledAt: string;
};

const OKX_BASE = "https://www.okx.com";
const LEGACY_LIVE_NAME_PREFIX = "Live Backtest |";
const GENERATED_PROVIDER_ADDRESSES = [
  "0xa111111111111111111111111111111111111111",
  "0xb222222222222222222222222222222222222222",
  "0xc333333333333333333333333333333333333333",
] as const;

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i <= 0) continue;
      const key = trimmed.slice(0, i);
      const value = trimmed.slice(i + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function sma(values: number[], endIndex: number, period: number): number | null {
  const start = endIndex - period + 1;
  if (start < 0) return null;
  return mean(values.slice(start, endIndex + 1));
}

function stdev(values: number[], endIndex: number, period: number): number | null {
  const start = endIndex - period + 1;
  if (start < 0) return null;
  const window = values.slice(start, endIndex + 1);
  const m = mean(window);
  return Math.sqrt(mean(window.map((v) => (v - m) ** 2)));
}

function rsi(values: number[], endIndex: number, period: number): number | null {
  if (endIndex < period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gains += diff;
    if (diff < 0) losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function toSqlDatetime(ts: number) {
  return new Date(ts).toISOString().slice(0, 19).replace("T", " ");
}

async function fetchCandles(instId: string, bar: string, limit: number): Promise<Candle[]> {
  const url = `${OKX_BASE}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: string[][];
  };
  if (!res.ok || json.code !== "0" || !Array.isArray(json.data)) {
    throw new Error(`fetch ${instId} failed: ${json.msg ?? `${res.status} ${res.statusText}`}`);
  }
  return json.data
    .map((x) => ({
      ts: Number(x[0]),
      open: Number(x[1]),
      high: Number(x[2]),
      low: Number(x[3]),
      close: Number(x[4]),
    }))
    .filter((x) => Number.isFinite(x.ts) && Number.isFinite(x.close) && x.close > 0)
    .sort((a, b) => a.ts - b.ts);
}

function buildTrades(candles: Candle[], def: StrategyDef): TradeSignal[] {
  const trades: TradeSignal[] = [];
  for (let i = def.minLookback; i < candles.length - 1; i++) {
    const signal = def.signalAt(candles, i);
    if (signal === 0) continue;
    const entry = candles[i].close;
    const exit = candles[i + 1].close;
    if (entry <= 0 || exit <= 0) continue;
    const rawMove = (exit - entry) / entry;
    const signedMove = rawMove * signal;
    const isBuy = signal > 0;
    trades.push({
      candleIndex: i,
      action: isBuy ? "buy" : "sell",
      entry: round(entry, 2),
      stopLoss: round(entry * (isBuy ? 0.97 : 1.03), 2),
      takeProfit: round(entry * (isBuy ? 1.05 : 0.95), 2),
      outcome: signedMove > 0 ? "win" : "loss",
      returnPct: round(signedMove * 100, 2),
      createdAt: toSqlDatetime(candles[i].ts),
      settledAt: toSqlDatetime(candles[i + 1].ts),
    });
  }
  return trades;
}

async function clearPreviousLiveStrategies() {
  const rows = await db
    .select({ id: strategies.id })
    .from(strategies)
    .where(
      or(
        like(strategies.name, `${LEGACY_LIVE_NAME_PREFIX}%`),
        inArray(strategies.providerAddress, [...GENERATED_PROVIDER_ADDRESSES])
      )
    );

  const ids = rows.map((x) => x.id);
  if (ids.length === 0) return 0;

  await db.delete(signals).where(inArray(signals.strategyId, ids));
  await db.delete(payments).where(inArray(payments.strategyId, ids));
  await db.delete(strategies).where(inArray(strategies.id, ids));
  return ids.length;
}

async function main() {
  loadEnvLocal();

  const bar = (process.env.LIVE_PUBLISH_BAR ?? "1D").trim();
  const limit = Math.max(120, Math.min(1000, Number(process.env.LIVE_PUBLISH_LIMIT ?? 240)));
  const minDays = Math.max(90, Number(process.env.LIVE_PUBLISH_MIN_DAYS ?? 90));
  const instIds = (process.env.LIVE_PUBLISH_INST_IDS ?? "BTC-USDT,ETH-USDT,SOL-USDT")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  const defs: StrategyDef[] = [
    {
      key: "alpha",
      label: "Alpha Momentum",
      description: "SMA 20/50 crossover backtest from real OKX candles.",
      providerAddress: "0xa111111111111111111111111111111111111111",
      pricePerSignal: 8,
      minLookback: 50,
      signalAt: (candles, i) => {
        const closes = candles.map((c) => c.close);
        const fastPrev = sma(closes, i - 1, 20);
        const slowPrev = sma(closes, i - 1, 50);
        const fastNow = sma(closes, i, 20);
        const slowNow = sma(closes, i, 50);
        if (fastPrev === null || slowPrev === null || fastNow === null || slowNow === null) return 0;
        if (fastPrev <= slowPrev && fastNow > slowNow) return 1;
        if (fastPrev >= slowPrev && fastNow < slowNow) return -1;
        return 0;
      },
    },
    {
      key: "rsi",
      label: "RSI Sniper",
      description: "RSI(14) mean-reversion backtest from real OKX candles.",
      providerAddress: "0xb222222222222222222222222222222222222222",
      pricePerSignal: 9,
      minLookback: 16,
      signalAt: (candles, i) => {
        const closes = candles.map((c) => c.close);
        const r = rsi(closes, i, 14);
        if (r === null) return 0;
        if (r < 30) return 1;
        if (r > 70) return -1;
        return 0;
      },
    },
    {
      key: "bollinger",
      label: "Bollinger Bounce",
      description: "Bollinger Band(20,2) mean-reversion backtest from real OKX candles.",
      providerAddress: "0xc333333333333333333333333333333333333333",
      pricePerSignal: 7,
      minLookback: 20,
      signalAt: (candles, i) => {
        const closes = candles.map((c) => c.close);
        const mid = sma(closes, i, 20);
        const sd = stdev(closes, i, 20);
        if (mid === null || sd === null) return 0;
        const upper = mid + 2 * sd;
        const lower = mid - 2 * sd;
        if (closes[i] < lower) return 1;
        if (closes[i] > upper) return -1;
        return 0;
      },
    },
  ];

  console.log("Publishing live backtest strategies...");
  console.log(`bar=${bar}, limit=${limit}, minDays=${minDays}, inst=${instIds.join(",")}`);

  const deleted = await clearPreviousLiveStrategies();
  console.log(`Removed previous live strategies: ${deleted}`);

  let created = 0;
  for (const instId of instIds) {
    const candles = await fetchCandles(instId, bar, limit);
    const days = (candles[candles.length - 1].ts - candles[0].ts) / (24 * 60 * 60 * 1000);
    if (days < minDays) {
      throw new Error(`${instId} only has ${round(days, 1)} days, required >= ${minDays}`);
    }

    const token = instId.split("-")[0];
    for (const def of defs) {
      const trades = buildTrades(candles, def);
      if (trades.length === 0) continue;

      const wins = trades.filter((t) => t.outcome === "win").length;
      const winRate = wins / trades.length;
      const avgReturn = trades.reduce((sum, t) => sum + t.returnPct, 0) / trades.length;
      const strategyId = nanoid(12);

      await db.insert(strategies).values({
        id: strategyId,
        name: `${def.label} | ${instId}`,
        description: `${def.description} Window: ${round(days, 1)} days, ${trades.length} signals.`,
        asset: `${token}/USDC`,
        timeframe: bar.toLowerCase(),
        pricePerSignal: def.pricePerSignal,
        providerAddress: def.providerAddress,
        totalSignals: trades.length,
        winRate: round(winRate, 4),
        avgReturn: round(avgReturn, 2),
        status: "active",
      });

      await db.insert(signals).values(
        trades.map((t) => ({
          id: nanoid(12),
          strategyId,
          action: t.action,
          token,
          entry: t.entry,
          stopLoss: t.stopLoss,
          takeProfit: t.takeProfit,
          reasoning: `${def.label} generated ${t.action.toUpperCase()} on ${instId} (${bar}).`,
          outcome: t.outcome,
          returnPct: t.returnPct,
          createdAt: t.createdAt,
          settledAt: t.settledAt,
        }))
      );

      await db
        .insert(providerBalances)
        .values({
          providerAddress: def.providerAddress,
          totalEarnedCents: 0,
          pendingCents: 0,
          totalSignalsSold: 0,
        })
        .onConflictDoNothing();

      await db
        .update(providerBalances)
        .set({
          totalSignalsSold: sql`${providerBalances.totalSignalsSold} + ${trades.length}`,
          updatedAt: sql`datetime('now')`,
        })
        .where(eq(providerBalances.providerAddress, def.providerAddress));

      created += 1;
      console.log(
        `+ ${def.label} ${instId}: signals=${trades.length}, win=${round(winRate * 100, 2)}%, avg=${round(avgReturn, 2)}%`
      );
    }
  }

  console.log(`Done. Created live strategies: ${created}`);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Publish failed: ${msg}`);
  process.exit(1);
});

/**
 * Pull live candles from OKX and run common public strategies.
 *
 * Usage:
 *   bun run strategy:live
 *
 * Optional env:
 *   LIVE_STRATEGY_INST_IDS=BTC-USDT,ETH-USDT,SOL-USDT
 *   LIVE_STRATEGY_BAR=1H
 *   LIVE_STRATEGY_LIMIT=300
 */

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type StrategySignal = -1 | 0 | 1;
type StrategyLabel = "BUY" | "SELL" | "HOLD";

type StrategyResult = {
  name: string;
  signal: StrategyLabel;
  detail: string;
  trades: number;
  winRatePct: number;
  avgReturnPct: number;
  cumulativeReturnPct: number;
};

const ONCHAIN_OS_BASE = "https://web3.okx.com";
const MARKET_BASE = "https://www.okx.com";

type OkxJson = {
  code?: string;
  msg?: string;
  data?: Array<Record<string, unknown>>;
};

type OnchainProbe = {
  url: string;
  status: number;
  payload: OkxJson | null;
  rawPreview: string;
};

function toLabel(signal: StrategySignal): StrategyLabel {
  if (signal > 0) return "BUY";
  if (signal < 0) return "SELL";
  return "HOLD";
}

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function windowSlice(values: number[], endIndex: number, period: number): number[] {
  const start = endIndex - period + 1;
  if (start < 0) return [];
  return values.slice(start, endIndex + 1);
}

function sma(values: number[], endIndex: number, period: number): number | null {
  const window = windowSlice(values, endIndex, period);
  if (window.length < period) return null;
  return mean(window);
}

function highest(values: number[], endIndex: number, period: number): number | null {
  const window = windowSlice(values, endIndex, period);
  if (window.length < period) return null;
  return Math.max(...window);
}

function lowest(values: number[], endIndex: number, period: number): number | null {
  const window = windowSlice(values, endIndex, period);
  if (window.length < period) return null;
  return Math.min(...window);
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

function backtest(
  candles: Candle[],
  minLookback: number,
  signalFn: (index: number) => StrategySignal
): Omit<StrategyResult, "name" | "signal" | "detail"> {
  let trades = 0;
  let wins = 0;
  let returnSum = 0;
  let compounded = 1;

  for (let i = minLookback; i < candles.length - 1; i++) {
    const signal = signalFn(i);
    if (signal === 0) continue;

    const current = candles[i].close;
    const next = candles[i + 1].close;
    if (current <= 0 || next <= 0) continue;

    const rawMove = (next - current) / current;
    const tradeReturn = rawMove * signal;
    trades += 1;
    returnSum += tradeReturn;
    compounded *= 1 + tradeReturn;
    if (tradeReturn > 0) wins += 1;
  }

  const avgReturnPct = trades > 0 ? (returnSum / trades) * 100 : 0;
  const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;
  const cumulativeReturnPct = (compounded - 1) * 100;

  return {
    trades,
    winRatePct: round(winRatePct, 2),
    avgReturnPct: round(avgReturnPct, 3),
    cumulativeReturnPct: round(cumulativeReturnPct, 2),
  };
}

function runStrategies(candles: Candle[]): StrategyResult[] {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const last = candles.length - 1;

  const results: StrategyResult[] = [];

  {
    const fast = 20;
    const slow = 50;
    const minLookback = slow;
    const signalFn = (index: number): StrategySignal => {
      const fastNow = sma(closes, index, fast);
      const slowNow = sma(closes, index, slow);
      const fastPrev = sma(closes, index - 1, fast);
      const slowPrev = sma(closes, index - 1, slow);
      if (
        fastNow === null ||
        slowNow === null ||
        fastPrev === null ||
        slowPrev === null
      ) {
        return 0;
      }
      if (fastPrev <= slowPrev && fastNow > slowNow) return 1;
      if (fastPrev >= slowPrev && fastNow < slowNow) return -1;
      return 0;
    };
    const fastNow = sma(closes, last, fast);
    const slowNow = sma(closes, last, slow);
    const signal = signalFn(last);
    const perf = backtest(candles, minLookback, signalFn);
    results.push({
      name: "SMA Crossover (20/50)",
      signal: toLabel(signal),
      detail:
        fastNow !== null && slowNow !== null
          ? `SMA20=${round(fastNow, 2)} | SMA50=${round(slowNow, 2)}`
          : "insufficient candles",
      ...perf,
    });
  }

  {
    const period = 14;
    const minLookback = period + 1;
    const signalFn = (index: number): StrategySignal => {
      const rsiNow = rsi(closes, index, period);
      if (rsiNow === null) return 0;
      if (rsiNow < 30) return 1;
      if (rsiNow > 70) return -1;
      return 0;
    };
    const rsiNow = rsi(closes, last, period);
    const signal = signalFn(last);
    const perf = backtest(candles, minLookback, signalFn);
    results.push({
      name: "RSI Reversion (14, 30/70)",
      signal: toLabel(signal),
      detail: rsiNow !== null ? `RSI=${round(rsiNow, 2)}` : "insufficient candles",
      ...perf,
    });
  }

  {
    const period = 20;
    const stdevK = 2;
    const minLookback = period;
    const signalFn = (index: number): StrategySignal => {
      const window = windowSlice(closes, index, period);
      if (window.length < period) return 0;
      const mid = mean(window);
      const sd = stddev(window);
      const upper = mid + stdevK * sd;
      const lower = mid - stdevK * sd;
      const close = closes[index];
      if (close < lower) return 1;
      if (close > upper) return -1;
      return 0;
    };
    const window = windowSlice(closes, last, period);
    const signal = signalFn(last);
    const detail =
      window.length < period
        ? "insufficient candles"
        : (() => {
            const mid = mean(window);
            const sd = stddev(window);
            const upper = mid + stdevK * sd;
            const lower = mid - stdevK * sd;
            return `Close=${round(closes[last], 2)} | BB[${round(lower, 2)}, ${round(upper, 2)}]`;
          })();
    const perf = backtest(candles, minLookback, signalFn);
    results.push({
      name: "Bollinger Reversion (20, 2)",
      signal: toLabel(signal),
      detail,
      ...perf,
    });
  }

  {
    const period = 20;
    const minLookback = period;
    const signalFn = (index: number): StrategySignal => {
      const hh = highest(highs, index - 1, period);
      const ll = lowest(lows, index - 1, period);
      if (hh === null || ll === null) return 0;
      const close = closes[index];
      if (close > hh) return 1;
      if (close < ll) return -1;
      return 0;
    };
    const hh = highest(highs, last - 1, period);
    const ll = lowest(lows, last - 1, period);
    const signal = signalFn(last);
    const perf = backtest(candles, minLookback, signalFn);
    results.push({
      name: "Donchian Breakout (20)",
      signal: toLabel(signal),
      detail:
        hh !== null && ll !== null
          ? `Close=${round(closes[last], 2)} | HH20=${round(hh, 2)} | LL20=${round(ll, 2)}`
          : "insufficient candles",
      ...perf,
    });
  }

  return results;
}

async function probeOnchainEndpoint(url: string): Promise<OnchainProbe> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Strategy-Square-LiveRunner/1.0",
    },
  });
  const raw = await res.text();
  let payload: OkxJson | null = null;
  try {
    payload = JSON.parse(raw) as OkxJson;
  } catch {}

  return {
    url,
    status: res.status,
    payload,
    rawPreview: raw.slice(0, 160).replace(/\s+/g, " "),
  };
}

async function fetchOnchainSupported(): Promise<void> {
  const candidates = [
    `${ONCHAIN_OS_BASE}/api/v6/payments/supported/`,
    `${ONCHAIN_OS_BASE}/api/v6/wallet/payments/supported`,
    `${MARKET_BASE}/api/v6/payments/supported/`,
    `${MARKET_BASE}/api/v6/wallet/payments/supported`,
  ];

  const probes: OnchainProbe[] = [];
  for (const url of candidates) {
    try {
      probes.push(await probeOnchainEndpoint(url));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      probes.push({
        url,
        status: 0,
        payload: null,
        rawPreview: msg,
      });
    }
  }

  const success = probes.find(
    (p) => p.payload?.code === "0" && Array.isArray(p.payload.data)
  );

  if (!success) {
    console.log("OnchainOS supported query: unavailable");
    for (const p of probes) {
      console.log(`  - ${p.url} -> status=${p.status}, preview=${p.rawPreview}`);
    }
    return;
  }

  const rows = success.payload?.data ?? [];
  const xLayerAssets = rows.filter(
    (x) => String(x.chainIndex ?? "") === "196"
  );

  console.log(`OnchainOS supported query: OK (${success.url})`);
  if (xLayerAssets.length === 0) {
    console.log("  no chainIndex=196 assets returned");
    return;
  }

  console.log("OnchainOS supported assets (chainIndex=196):");
  for (const asset of xLayerAssets.slice(0, 10)) {
    const symbol = String(asset.symbol ?? "UNKNOWN");
    const tokenAddress = String(asset.tokenAddress ?? "N/A");
    console.log(`  - ${symbol} (${tokenAddress})`);
  }
}

async function fetchCandles(
  instId: string,
  bar: string,
  limit: number
): Promise<Candle[]> {
  const url = `${MARKET_BASE}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: string[][];
  };

  if (!res.ok || json.code !== "0" || !Array.isArray(json.data)) {
    throw new Error(
      `fetch ${instId} failed: ${json.msg ?? `${res.status} ${res.statusText}`}`
    );
  }

  const candles = json.data
    .map((row) => ({
      ts: parseNumber(row[0]),
      open: parseNumber(row[1]),
      high: parseNumber(row[2]),
      low: parseNumber(row[3]),
      close: parseNumber(row[4]),
      volume: parseNumber(row[5]),
    }))
    .filter((c) => c.ts > 0 && c.close > 0)
    .sort((a, b) => a.ts - b.ts);

  if (candles.length < 60) {
    throw new Error(`insufficient candles for ${instId}: ${candles.length}`);
  }

  return candles;
}

async function main() {
  const instIds = (process.env.LIVE_STRATEGY_INST_IDS ?? "BTC-USDT,ETH-USDT,SOL-USDT")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  const bar = (process.env.LIVE_STRATEGY_BAR ?? "1H").trim();
  const limit = Math.max(100, Math.min(1000, parseNumber(process.env.LIVE_STRATEGY_LIMIT ?? "300")));

  console.log("=== Live Strategy Runner (OKX) ===");
  console.log(`Instruments: ${instIds.join(", ")}`);
  console.log(`Bar: ${bar} | Limit: ${limit}`);
  console.log("");

  await fetchOnchainSupported();
  console.log("");

  for (const instId of instIds) {
    try {
      const candles = await fetchCandles(instId, bar, limit);
      const last = candles[candles.length - 1];
      const results = runStrategies(candles);

      console.log(`--- ${instId} ---`);
      console.log(
        `Last close: ${round(last.close, 2)} | Last candle: ${new Date(last.ts).toISOString()}`
      );
      for (const r of results) {
        const perf = `trades=${r.trades}, win=${r.winRatePct}%, avg=${r.avgReturnPct}%, cum=${r.cumulativeReturnPct}%`;
        console.log(`- ${r.name}`);
        console.log(`  signal=${r.signal} | ${r.detail}`);
        console.log(`  backtest(${bar}, next-candle) => ${perf}`);
      }
      console.log("");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`--- ${instId} ---`);
      console.log(`failed: ${msg}`);
      console.log("");
    }
  }

  console.log("=== Done ===");
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Runner failed: ${msg}`);
  process.exit(1);
});

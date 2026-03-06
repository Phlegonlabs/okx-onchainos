import { getStrategyPricing } from "./gateway-pricing";
import {
  type Candle,
  type StrategyTemplateKey,
  type StrategyTemplateParams,
  getBacktestLimitForBar,
  getTemplateLabel,
  getTemplateMinLookback,
  getTemplateSignal,
  validateTemplateParams,
} from "./strategy-templates";

const MIN_BACKTEST_DAYS = 90;
const MIN_SIGNAL_COUNT = 12;
const MAX_DRAWDOWN_PCT = 25;

export type BacktestTrade = {
  action: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  outcome: "win" | "loss";
  returnPct: number;
  createdAt: string;
  settledAt: string;
};

export type StrategyEvaluation = {
  approved: boolean;
  score: number;
  rejectionReason: string | null;
  signalCount: number;
  winRate: number;
  avgReturn: number;
  cumulativeReturnPct: number;
  maxDrawdownPct: number;
  windowDays: number;
  strategyTier: "tier_1" | "tier_2" | "tier_3";
  pricePerSignal: number;
  periodCapCents: number;
  params: StrategyTemplateParams;
  trades: BacktestTrade[];
};

export type LiveSignal = {
  action: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  createdAt: string;
};

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function toSqlDatetime(ts: number): string {
  return new Date(ts).toISOString().slice(0, 19).replace("T", " ");
}

function buildTrades(
  candles: Candle[],
  templateKey: StrategyTemplateKey,
  params: StrategyTemplateParams
) {
  const trades: BacktestTrade[] = [];
  const minLookback = getTemplateMinLookback(templateKey, params);

  for (let index = minLookback; index < candles.length - 1; index += 1) {
    const signal = getTemplateSignal(templateKey, candles, index, params);
    if (signal === 0) continue;

    const entry = candles[index].close;
    const exit = candles[index + 1].close;
    const rawMove = (exit - entry) / entry;
    const signedMove = rawMove * signal;
    const isBuy = signal > 0;

    trades.push({
      action: isBuy ? "buy" : "sell",
      entry: round(entry, 2),
      stopLoss: round(entry * (isBuy ? 0.97 : 1.03), 2),
      takeProfit: round(entry * (isBuy ? 1.05 : 0.95), 2),
      outcome: signedMove > 0 ? "win" : "loss",
      returnPct: round(signedMove * 100, 2),
      createdAt: toSqlDatetime(candles[index].ts),
      settledAt: toSqlDatetime(candles[index + 1].ts),
    });
  }

  return trades;
}

function calculateMaxDrawdownPct(returns: number[]) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const value of returns) {
    equity *= 1 + value / 100;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
  }

  return round(maxDrawdown, 2);
}

function calculateScore(params: {
  signalCount: number;
  winRate: number;
  avgReturn: number;
  cumulativeReturnPct: number;
  maxDrawdownPct: number;
}) {
  const winScore = Math.max(0, Math.min(35, ((params.winRate - 0.45) / 0.25) * 35));
  const avgScore = Math.max(0, Math.min(20, (params.avgReturn / 5) * 20));
  const cumulativeScore = Math.max(
    0,
    Math.min(20, (params.cumulativeReturnPct / 25) * 20)
  );
  const volumeScore = Math.max(0, Math.min(15, (params.signalCount / 30) * 15));
  const drawdownPenalty = Math.max(
    0,
    Math.min(20, (params.maxDrawdownPct / MAX_DRAWDOWN_PCT) * 20)
  );
  return Math.max(
    0,
    Math.min(100, Math.round(winScore + avgScore + cumulativeScore + volumeScore - drawdownPenalty))
  );
}

export function evaluateSubmission(params: {
  candles: Candle[];
  templateKey: StrategyTemplateKey;
  rawParams: unknown;
}) {
  const normalizedParams = validateTemplateParams(params.templateKey, params.rawParams);
  const trades = buildTrades(params.candles, params.templateKey, normalizedParams);
  const wins = trades.filter((trade) => trade.outcome === "win").length;
  const signalCount = trades.length;
  const winRate = signalCount > 0 ? wins / signalCount : 0;
  const avgReturn =
    signalCount > 0
      ? trades.reduce((sum, trade) => sum + trade.returnPct, 0) / signalCount
      : 0;
  const cumulativeReturnPct = round(
    trades.reduce((equity, trade) => equity * (1 + trade.returnPct / 100), 1) * 100 - 100,
    2
  );
  const maxDrawdownPct = calculateMaxDrawdownPct(trades.map((trade) => trade.returnPct));
  const windowDays =
    params.candles.length > 1
      ? Math.round(
          (params.candles[params.candles.length - 1].ts - params.candles[0].ts) /
            (24 * 60 * 60 * 1000)
        )
      : 0;
  const score = calculateScore({
    signalCount,
    winRate,
    avgReturn,
    cumulativeReturnPct,
    maxDrawdownPct,
  });

  let rejectionReason: string | null = null;
  if (windowDays < MIN_BACKTEST_DAYS) rejectionReason = `Requires at least ${MIN_BACKTEST_DAYS} days of candles`;
  else if (signalCount < MIN_SIGNAL_COUNT) rejectionReason = `Requires at least ${MIN_SIGNAL_COUNT} signals`;
  else if (cumulativeReturnPct <= 0) rejectionReason = "Backtest cumulative return must stay positive";
  else if (maxDrawdownPct > MAX_DRAWDOWN_PCT) rejectionReason = `Max drawdown exceeds ${MAX_DRAWDOWN_PCT}%`;
  else if (score < 60) rejectionReason = "Backtest score did not reach the listing threshold";

  const pricing = getStrategyPricing(score);

  return {
    approved: rejectionReason === null,
    score,
    rejectionReason,
    signalCount,
    winRate: round(winRate, 4),
    avgReturn: round(avgReturn, 2),
    cumulativeReturnPct,
    maxDrawdownPct,
    windowDays,
    strategyTier: pricing.strategyTier,
    pricePerSignal: pricing.pricePerSignal,
    periodCapCents: pricing.periodCapCents,
    params: normalizedParams,
    trades,
  } satisfies StrategyEvaluation;
}

export function buildLiveSignal(params: {
  candles: Candle[];
  token: string;
  templateKey: StrategyTemplateKey;
  templateParams: StrategyTemplateParams;
}) {
  if (params.candles.length < 3) return null;

  const signalIndex = params.candles.length - 2;
  const signal = getTemplateSignal(
    params.templateKey,
    params.candles,
    signalIndex,
    params.templateParams
  );
  if (signal === 0) return null;

  const entry = params.candles[signalIndex].close;
  const action = signal > 0 ? "buy" : "sell";
  const label = getTemplateLabel(params.templateKey);

  return {
    action,
    entry: round(entry, 2),
    stopLoss: round(entry * (action === "buy" ? 0.97 : 1.03), 2),
    takeProfit: round(entry * (action === "buy" ? 1.05 : 0.95), 2),
    reasoning: `${label} emitted a ${action.toUpperCase()} signal for ${params.token} on the latest closed candle.`,
    createdAt: toSqlDatetime(params.candles[signalIndex].ts),
  } satisfies LiveSignal;
}

export function resolveSubmissionBacktestLimit(bar: string) {
  return getBacktestLimitForBar(bar);
}

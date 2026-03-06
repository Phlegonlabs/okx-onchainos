export type StrategySignal = -1 | 0 | 1;

export type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SmaCrossoverParams = {
  fastPeriod: number;
  slowPeriod: number;
};

export type RsiReversionParams = {
  period: number;
  oversold: number;
  overbought: number;
};

export type BollingerMeanReversionParams = {
  period: number;
  stdDev: number;
};

export type StrategyTemplateParams =
  | SmaCrossoverParams
  | RsiReversionParams
  | BollingerMeanReversionParams;

export type StrategyTemplateKey =
  | "sma_crossover"
  | "rsi_reversion"
  | "bollinger_mean_reversion";

type StrategyTemplateDefinition<TParams extends StrategyTemplateParams> = {
  key: StrategyTemplateKey;
  label: string;
  minLookback: (params: TParams) => number;
  validate: (raw: unknown) => TParams;
  signalAt: (candles: Candle[], index: number, params: TParams) => StrategySignal;
};

export const SUBMISSION_ALLOWED_BARS = new Set(["4H", "1D"]);

const BACKTEST_LIMIT_BY_BAR: Record<string, number> = {
  "4H": 600,
  "1D": 180,
};

function ensureNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a finite number`);
  }
  return parsed;
}

function clampInt(value: number, min: number, max: number, field: string): number {
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return rounded;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  const average = mean(window);
  return Math.sqrt(mean(window.map((value) => (value - average) ** 2)));
}

function rsi(values: number[], endIndex: number, period: number): number | null {
  if (endIndex < period) return null;
  let gains = 0;
  let losses = 0;

  for (let index = endIndex - period + 1; index <= endIndex; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff > 0) gains += diff;
    if (diff < 0) losses += Math.abs(diff);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

const smaTemplate: StrategyTemplateDefinition<SmaCrossoverParams> = {
  key: "sma_crossover",
  label: "SMA Crossover",
  minLookback: (params) => params.slowPeriod,
  validate: (raw) => {
    const params = (raw ?? {}) as Record<string, unknown>;
    const fastPeriod = clampInt(
      ensureNumber(params.fastPeriod, "fastPeriod"),
      5,
      100,
      "fastPeriod"
    );
    const slowPeriod = clampInt(
      ensureNumber(params.slowPeriod, "slowPeriod"),
      fastPeriod + 1,
      200,
      "slowPeriod"
    );
    return { fastPeriod, slowPeriod };
  },
  signalAt: (candles, index, params) => {
    const closes = candles.map((candle) => candle.close);
    const fastPrev = sma(closes, index - 1, params.fastPeriod);
    const slowPrev = sma(closes, index - 1, params.slowPeriod);
    const fastNow = sma(closes, index, params.fastPeriod);
    const slowNow = sma(closes, index, params.slowPeriod);
    if ([fastPrev, slowPrev, fastNow, slowNow].some((value) => value === null)) {
      return 0;
    }
    if (fastPrev! <= slowPrev! && fastNow! > slowNow!) return 1;
    if (fastPrev! >= slowPrev! && fastNow! < slowNow!) return -1;
    return 0;
  },
};

const rsiTemplate: StrategyTemplateDefinition<RsiReversionParams> = {
  key: "rsi_reversion",
  label: "RSI Reversion",
  minLookback: (params) => params.period + 2,
  validate: (raw) => {
    const params = (raw ?? {}) as Record<string, unknown>;
    const period = clampInt(ensureNumber(params.period, "period"), 5, 50, "period");
    const oversold = ensureNumber(params.oversold, "oversold");
    const overbought = ensureNumber(params.overbought, "overbought");
    if (oversold < 5 || oversold > 45) throw new Error("oversold must be between 5 and 45");
    if (overbought < 55 || overbought > 95) throw new Error("overbought must be between 55 and 95");
    if (oversold >= overbought) throw new Error("oversold must be lower than overbought");
    return { period, oversold, overbought };
  },
  signalAt: (candles, index, params) => {
    const closes = candles.map((candle) => candle.close);
    const value = rsi(closes, index, params.period);
    if (value === null) return 0;
    if (value < params.oversold) return 1;
    if (value > params.overbought) return -1;
    return 0;
  },
};

const bollingerTemplate: StrategyTemplateDefinition<BollingerMeanReversionParams> = {
  key: "bollinger_mean_reversion",
  label: "Bollinger Mean Reversion",
  minLookback: (params) => params.period,
  validate: (raw) => {
    const params = (raw ?? {}) as Record<string, unknown>;
    const period = clampInt(ensureNumber(params.period, "period"), 10, 80, "period");
    const stdDev = ensureNumber(params.stdDev, "stdDev");
    if (stdDev < 1 || stdDev > 4) throw new Error("stdDev must be between 1 and 4");
    return { period, stdDev };
  },
  signalAt: (candles, index, params) => {
    const closes = candles.map((candle) => candle.close);
    const middle = sma(closes, index, params.period);
    const deviation = stdev(closes, index, params.period);
    if (middle === null || deviation === null) return 0;
    const upper = middle + params.stdDev * deviation;
    const lower = middle - params.stdDev * deviation;
    if (closes[index] < lower) return 1;
    if (closes[index] > upper) return -1;
    return 0;
  },
};

export function getBacktestLimitForBar(bar: string): number {
  const limit = BACKTEST_LIMIT_BY_BAR[bar];
  if (!limit) throw new Error(`Unsupported submission timeframe: ${bar}`);
  return limit;
}

export function validateTemplateParams(
  templateKey: StrategyTemplateKey,
  params: unknown
): StrategyTemplateParams {
  switch (templateKey) {
    case "sma_crossover":
      return smaTemplate.validate(params);
    case "rsi_reversion":
      return rsiTemplate.validate(params);
    case "bollinger_mean_reversion":
      return bollingerTemplate.validate(params);
  }
}

export function getTemplateLabel(templateKey: StrategyTemplateKey): string {
  switch (templateKey) {
    case "sma_crossover":
      return smaTemplate.label;
    case "rsi_reversion":
      return rsiTemplate.label;
    case "bollinger_mean_reversion":
      return bollingerTemplate.label;
  }
}

export function getTemplateMinLookback(
  templateKey: StrategyTemplateKey,
  params: StrategyTemplateParams
): number {
  switch (templateKey) {
    case "sma_crossover":
      return smaTemplate.minLookback(params as SmaCrossoverParams);
    case "rsi_reversion":
      return rsiTemplate.minLookback(params as RsiReversionParams);
    case "bollinger_mean_reversion":
      return bollingerTemplate.minLookback(params as BollingerMeanReversionParams);
  }
}

export function getTemplateSignal(
  templateKey: StrategyTemplateKey,
  candles: Candle[],
  index: number,
  params: StrategyTemplateParams
): StrategySignal {
  switch (templateKey) {
    case "sma_crossover":
      return smaTemplate.signalAt(candles, index, params as SmaCrossoverParams);
    case "rsi_reversion":
      return rsiTemplate.signalAt(candles, index, params as RsiReversionParams);
    case "bollinger_mean_reversion":
      return bollingerTemplate.signalAt(
        candles,
        index,
        params as BollingerMeanReversionParams
      );
  }
}

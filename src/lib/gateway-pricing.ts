const DEFAULT_RESEARCH_SMALL_CANDLES_MAX_LIMIT = 120;
const DEFAULT_RESEARCH_SMALL_CANDLES_PRICE_MICRO_USD = 5_000;
const DEFAULT_RESEARCH_LARGE_CANDLES_PRICE_MICRO_USD = 15_000;

export type StrategyTier = "tier_1" | "tier_2" | "tier_3";

export type StrategyPricing = {
  strategyTier: StrategyTier;
  pricePerSignal: number;
  periodCapCents: number;
};

export type ResearchPricing = {
  limit: number;
  amountMicroUsd: number;
  tier: "small" | "large";
};

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
}

export function getResearchPricing(limit: number): ResearchPricing {
  const smallTierMaxLimit = toPositiveInt(
    process.env.RESEARCH_SMALL_CANDLES_MAX_LIMIT,
    DEFAULT_RESEARCH_SMALL_CANDLES_MAX_LIMIT
  );
  const smallTierPrice = toPositiveInt(
    process.env.RESEARCH_SMALL_CANDLES_PRICE_MICRO_USD,
    DEFAULT_RESEARCH_SMALL_CANDLES_PRICE_MICRO_USD
  );
  const largeTierPrice = toPositiveInt(
    process.env.RESEARCH_LARGE_CANDLES_PRICE_MICRO_USD,
    DEFAULT_RESEARCH_LARGE_CANDLES_PRICE_MICRO_USD
  );

  if (limit <= smallTierMaxLimit) {
    return {
      limit,
      amountMicroUsd: smallTierPrice,
      tier: "small",
    };
  }

  return {
    limit,
    amountMicroUsd: largeTierPrice,
    tier: "large",
  };
}

export function getStrategyPricing(score: number): StrategyPricing {
  if (score >= 85) {
    return {
      strategyTier: "tier_3",
      pricePerSignal: 9,
      periodCapCents: 599,
    };
  }

  if (score >= 75) {
    return {
      strategyTier: "tier_2",
      pricePerSignal: 6,
      periodCapCents: 299,
    };
  }

  return {
    strategyTier: "tier_1",
    pricePerSignal: 3,
    periodCapCents: 149,
  };
}

export function clampSignalCharge(params: {
  periodCapCents: number;
  pricePerSignal: number;
  pendingSignalCount: number;
  alreadySpentCents: number;
}) {
  const requestedCents = Math.max(
    0,
    params.pricePerSignal * Math.max(0, params.pendingSignalCount)
  );
  const remainingCapCents = Math.max(
    0,
    params.periodCapCents - Math.max(0, params.alreadySpentCents)
  );
  const chargedCents = Math.min(requestedCents, remainingCapCents);

  return {
    requestedCents,
    chargedCents,
    remainingCapCents,
    capReached: remainingCapCents <= 0 || chargedCents < requestedCents,
  };
}

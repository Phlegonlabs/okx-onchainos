import { describe, expect, it } from "bun:test";
import {
  clampSignalCharge,
  getResearchPricing,
  getStrategyPricing,
} from "./gateway-pricing";

describe("gateway pricing", () => {
  it("assigns signal tiers from score bands", () => {
    expect(getStrategyPricing(61)).toEqual({
      strategyTier: "tier_1",
      pricePerSignal: 3,
      periodCapCents: 149,
    });
    expect(getStrategyPricing(79)).toEqual({
      strategyTier: "tier_2",
      pricePerSignal: 6,
      periodCapCents: 299,
    });
    expect(getStrategyPricing(92)).toEqual({
      strategyTier: "tier_3",
      pricePerSignal: 9,
      periodCapCents: 599,
    });
  });

  it("enforces subscription caps when charging pending signals", () => {
    expect(
      clampSignalCharge({
        periodCapCents: 299,
        pricePerSignal: 6,
        pendingSignalCount: 4,
        alreadySpentCents: 290,
      })
    ).toEqual({
      requestedCents: 24,
      chargedCents: 9,
      remainingCapCents: 9,
      capReached: true,
    });
  });

  it("uses tiered research pricing by candle limit", () => {
    expect(getResearchPricing(120)).toEqual({
      limit: 120,
      amountMicroUsd: 5000,
      tier: "small",
    });
    expect(getResearchPricing(121)).toEqual({
      limit: 121,
      amountMicroUsd: 15000,
      tier: "large",
    });
  });
});

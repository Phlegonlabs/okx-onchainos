import { describe, expect, it } from "bun:test";
import { evaluateSubmission } from "./strategy-engine";

function buildTrendingCandles(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const close = 100 + index * 1.5;
    return {
      ts: Date.UTC(2025, 0, index + 1),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000 + index,
    };
  });
}

describe("strategy engine", () => {
  it("rejects strategies without enough signal history", () => {
    const candles = buildTrendingCandles(40);
    const result = evaluateSubmission({
      candles,
      templateKey: "sma_crossover",
      rawParams: {
        fastPeriod: 10,
        slowPeriod: 20,
      },
    });

    expect(result.approved).toBe(false);
    expect(result.rejectionReason).toContain("Requires at least 90 days");
  });

  it("validates strategy template params", () => {
    expect(() =>
      evaluateSubmission({
        candles: buildTrendingCandles(120),
        templateKey: "rsi_reversion",
        rawParams: {
          period: 14,
          oversold: 46,
          overbought: 70,
        },
      })
    ).toThrow("oversold must be between 5 and 45");
  });
});

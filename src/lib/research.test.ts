import { afterEach, describe, expect, it } from "bun:test";
import {
  getResearchConfig,
  normalizeBar,
  normalizeInstId,
  parseLimit,
} from "./research";

const originalEnv = {
  RESEARCH_ALLOWED_INST_IDS: process.env.RESEARCH_ALLOWED_INST_IDS,
  RESEARCH_ALLOWED_BARS: process.env.RESEARCH_ALLOWED_BARS,
  RESEARCH_MIN_LIMIT: process.env.RESEARCH_MIN_LIMIT,
  RESEARCH_MAX_LIMIT: process.env.RESEARCH_MAX_LIMIT,
  RESEARCH_CANDLES_PRICE_MICRO_USD: process.env.RESEARCH_CANDLES_PRICE_MICRO_USD,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("research helpers", () => {
  it("normalizes query parameters", () => {
    expect(normalizeInstId(" btc-usdt ")).toBe("BTC-USDT");
    expect(normalizeBar(" 1h ")).toBe("1H");
    expect(parseLimit("120")).toBe(120);
    expect(parseLimit("abc")).toBeNull();
  });

  it("loads config defaults", () => {
    delete process.env.RESEARCH_ALLOWED_INST_IDS;
    delete process.env.RESEARCH_ALLOWED_BARS;
    delete process.env.RESEARCH_MIN_LIMIT;
    delete process.env.RESEARCH_MAX_LIMIT;
    delete process.env.RESEARCH_CANDLES_PRICE_MICRO_USD;

    const config = getResearchConfig();
    expect(config.allowedInstIds.has("BTC-USDT")).toBe(true);
    expect(config.allowedBars.has("1H")).toBe(true);
    expect(config.minLimit).toBe(20);
    expect(config.maxLimit).toBe(500);
    expect(config.candlesPriceMicroUsd).toBe(1000);
  });

  it("respects env overrides", () => {
    process.env.RESEARCH_ALLOWED_INST_IDS = "ARB-USDT,OP-USDT";
    process.env.RESEARCH_ALLOWED_BARS = "5m,15m,1H";
    process.env.RESEARCH_MIN_LIMIT = "30";
    process.env.RESEARCH_MAX_LIMIT = "180";
    process.env.RESEARCH_CANDLES_PRICE_MICRO_USD = "1500";

    const config = getResearchConfig();
    expect(config.allowedInstIds.has("ARB-USDT")).toBe(true);
    expect(config.allowedInstIds.has("BTC-USDT")).toBe(false);
    expect(config.allowedBars.has("5m")).toBe(true);
    expect(config.minLimit).toBe(30);
    expect(config.maxLimit).toBe(180);
    expect(config.candlesPriceMicroUsd).toBe(1500);
  });
});

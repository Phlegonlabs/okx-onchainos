import { afterEach, describe, expect, it } from "bun:test";
import {
  buildPaymentRequirementsForAmount,
  buildPaymentRequirementsForMicroUsd,
} from "./x402";

const originalWallet = process.env.PLATFORM_WALLET_ADDRESS;

afterEach(() => {
  if (originalWallet === undefined) {
    delete process.env.PLATFORM_WALLET_ADDRESS;
  } else {
    process.env.PLATFORM_WALLET_ADDRESS = originalWallet;
  }
});

describe("x402 payment requirement builders", () => {
  it("converts cents to USDT base units", () => {
    process.env.PLATFORM_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";

    const req = buildPaymentRequirementsForAmount({
      amountCents: 1,
      resource: "/api/subscriptions/sub_123/signals",
      description: "1 cent payment",
    });

    expect(req.maxAmountRequired).toBe("10000");
    expect(req.scheme).toBe("exact");
    expect(req.payTo).toBe("0x1111111111111111111111111111111111111111");
  });

  it("supports arbitrary resource pricing for gateway routes", () => {
    process.env.PLATFORM_WALLET_ADDRESS = "0x2222222222222222222222222222222222222222";

    const req = buildPaymentRequirementsForAmount({
      amountCents: 25,
      resource: "/api/subscriptions/sub_123/signals",
      description: "subscription batch",
    });
    expect(req.resource).toBe("/api/subscriptions/sub_123/signals");
    expect(req.maxAmountRequired).toBe("250000");
    expect(req.payTo).toBe("0x2222222222222222222222222222222222222222");
  });

  it("supports microUSD pricing for low-cost research routes", () => {
    process.env.PLATFORM_WALLET_ADDRESS = "0x3333333333333333333333333333333333333333";

    const req = buildPaymentRequirementsForMicroUsd({
      amountMicroUsd: 1000,
      resource: "/api/research/candles?instId=BTC-USDT&bar=1H&limit=120",
      description: "Research candles request",
    });

    expect(req.maxAmountRequired).toBe("1000");
    expect(req.resource).toContain("/api/research/candles");
    expect(req.payTo).toBe("0x3333333333333333333333333333333333333333");
  });
});

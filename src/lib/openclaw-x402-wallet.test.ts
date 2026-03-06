import { describe, expect, test } from "bun:test";
import { createOpenClawX402Wallet } from "./openclaw-x402-wallet";
import type { PaymentRequirements } from "./x402";

const STATIC_NONCE =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

function createPaymentRequirements(): PaymentRequirements {
  return {
    x402Version: "1",
    chainIndex: "196",
    scheme: "exact",
    maxAmountRequired: "5000",
    payTo: "0x2222222222222222222222222222222222222222",
    asset: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    resource: "/api/subscriptions/sub_1/signals",
    description: "test payment",
    mimeType: "application/json",
  };
}

describe("openclaw x402 wallet client", () => {
  test("returns normal response when endpoint is not 402", async () => {
    const calls: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      calls.push(req);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const wallet = createOpenClawX402Wallet({
      signer: {
        address: "0x1111111111111111111111111111111111111111",
        signMessage: async () => {
          throw new Error("should not sign message for non-auth requests");
        },
        signTypedData: async () => {
          throw new Error("should not sign for non-402 responses");
        },
      },
      fetchImpl,
      resolveTokenMetadata: async () => ({ name: "USDT", version: "1" }),
    });

    const result = await wallet.requestWithAutoPayment("https://example.com/api");
    expect(result.paid).toBe(false);
    expect(result.response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("X-Payment")).toBeNull();
  });

  test("auto signs and retries when server returns 402", async () => {
    const requirements = createPaymentRequirements();
    const calls: Request[] = [];
    let callCount = 0;
    let signed = false;

    const fetchImpl: typeof fetch = async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      calls.push(req);
      callCount += 1;

      if (callCount === 1) {
        return new Response(
          JSON.stringify({ paymentRequirements: requirements }),
          {
            status: 402,
            headers: {
              "X-Payment-Requirements": JSON.stringify(requirements),
            },
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    const wallet = createOpenClawX402Wallet({
      signer: {
        address: "0x1111111111111111111111111111111111111111",
        signMessage: async () =>
          "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        signTypedData: async (args) => {
          signed = true;
          expect(args.domain.chainId).toBe(196n);
          expect(args.message.value).toBe(5000n);
          expect(args.message.from).toBe(
            "0x1111111111111111111111111111111111111111"
          );
          return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        },
      },
      fetchImpl,
      nowSeconds: () => 1_700_000_000,
      nonceFactory: () => STATIC_NONCE,
      resolveTokenMetadata: async () => ({ name: "USD Tether", version: "2" }),
    });

    const result = await wallet.requestWithAutoPayment(
      "https://example.com/api/subscriptions/sub_1/signals"
    );

    expect(signed).toBe(true);
    expect(calls).toHaveLength(2);
    expect(result.paid).toBe(true);
    expect(result.response.status).toBe(200);
    expect(result.paymentRequirements?.payTo).toBe(requirements.payTo);

    const paymentHeader = calls[1].headers.get("X-Payment");
    expect(paymentHeader).not.toBeNull();
    const paymentPayload = JSON.parse(paymentHeader || "{}");
    expect(paymentPayload.payload.authorization.from).toBe(
      "0x1111111111111111111111111111111111111111"
    );
    expect(paymentPayload.payload.authorization.to).toBe(requirements.payTo);
    expect(paymentPayload.payload.authorization.value).toBe(
      requirements.maxAmountRequired
    );
    expect(paymentPayload.payload.authorization.nonce).toBe(STATIC_NONCE);
  });

  test("throws clear error when 402 has no payment requirements", async () => {
    const fetchImpl: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
      });
    };

    const wallet = createOpenClawX402Wallet({
      signer: {
        address: "0x1111111111111111111111111111111111111111",
        signMessage: async () =>
          "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        signTypedData: async () =>
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      fetchImpl,
      resolveTokenMetadata: async () => ({ name: "USDT", version: "1" }),
    });

    await expect(
      wallet.requestWithAutoPayment("https://example.com/api")
    ).rejects.toThrow("HTTP 402 received but no paymentRequirements were found");
  });

  test("builds wallet auth headers for provider writes", async () => {
    const wallet = createOpenClawX402Wallet({
      signer: {
        address: "0x1111111111111111111111111111111111111111",
        signMessage: async ({ message }) => {
          expect(typeof message).toBe("string");
          expect(String(message)).toContain("Trading Strategy Agent Gateway Wallet Auth");
          expect(String(message)).toContain("Path: /api/strategies");
          return "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        },
        signTypedData: async () =>
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      nowSeconds: () => 1_700_000_000,
      nonceFactory: () => STATIC_NONCE,
      resolveTokenMetadata: async () => ({ name: "USDT", version: "1" }),
    });

    const signed = await wallet.buildWalletAuthHeaders(
      "https://example.com/api/strategies",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerAddress: "0x1111111111111111111111111111111111111111",
        }),
      }
    );

    expect(signed.auth.address).toBe(
      "0x1111111111111111111111111111111111111111"
    );
    expect(signed.auth.timestamp).toBe("1700000000000");
    expect(signed.auth.nonce).toBe(STATIC_NONCE);
    expect(signed.headers.get("x-wallet-address")).toBe(
      "0x1111111111111111111111111111111111111111"
    );
    expect(signed.headers.get("x-wallet-signature")).toContain("0xeeee");
  });
});

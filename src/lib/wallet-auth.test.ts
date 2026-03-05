import { describe, expect, test } from "bun:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  WALLET_AUTH_ADDRESS_HEADER,
  WALLET_AUTH_NONCE_HEADER,
  WALLET_AUTH_SIGNATURE_HEADER,
  WALLET_AUTH_TIMESTAMP_HEADER,
  WalletAuthError,
  buildWalletAuthBodyHash,
  buildWalletAuthMessage,
  resolvePaymentPayer,
  verifyWalletAuthRequest,
} from "./wallet-auth";
import type { PaymentPayload } from "./x402";

const account = privateKeyToAccount(
  "0x59c6995e998f97a5a0044976f7d83b2fae6f6f0b46d84c9aaf5b5d7f3c2d5f90"
);

async function buildHeaders(params?: {
  timestamp?: string;
  nonce?: string;
  method?: string;
  path?: string;
  rawBody?: string;
}) {
  const timestamp = params?.timestamp || "1700000000000";
  const nonce =
    params?.nonce ||
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const method = params?.method || "POST";
  const path = params?.path || "/api/strategies";
  const rawBody =
    params?.rawBody ||
    JSON.stringify({
      name: "Wallet Auth Strategy",
      providerAddress: account.address,
    });

  const message = buildWalletAuthMessage({
    address: account.address,
    method,
    path,
    timestamp,
    nonce,
    bodySha256: buildWalletAuthBodyHash(rawBody),
  });

  const signature = await account.signMessage({ message });
  const headers = new Headers({
    [WALLET_AUTH_ADDRESS_HEADER]: account.address,
    [WALLET_AUTH_TIMESTAMP_HEADER]: timestamp,
    [WALLET_AUTH_NONCE_HEADER]: nonce,
    [WALLET_AUTH_SIGNATURE_HEADER]: signature,
  });

  return { headers, rawBody };
}

describe("wallet auth", () => {
  test("verifies a signed provider request", async () => {
    const { headers, rawBody } = await buildHeaders();

    const resolved = await verifyWalletAuthRequest({
      headers,
      method: "POST",
      path: "/api/strategies",
      rawBody,
      expectedAddress: account.address,
      nowMs: 1700000000000,
      consumeNonce: async () => true,
    });

    expect(resolved).toBe(account.address.toLowerCase());
  });

  test("rejects stale timestamps", async () => {
    const { headers, rawBody } = await buildHeaders({ timestamp: "1699999000000" });

    await expect(
      verifyWalletAuthRequest({
        headers,
        method: "POST",
        path: "/api/strategies",
        rawBody,
        expectedAddress: account.address,
        nowMs: 1700000000000,
        consumeNonce: async () => true,
      })
    ).rejects.toBeInstanceOf(WalletAuthError);
  });

  test("rejects when nonce is reused", async () => {
    const { headers, rawBody } = await buildHeaders();

    await expect(
      verifyWalletAuthRequest({
        headers,
        method: "POST",
        path: "/api/strategies",
        rawBody,
        expectedAddress: account.address,
        nowMs: 1700000000000,
        consumeNonce: async () => false,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("prefers verified payer and falls back to authorization.from", () => {
    const payload: PaymentPayload = {
      x402Version: "1",
      chainIndex: 196,
      scheme: "exact",
      payload: {
        signature:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        authorization: {
          from: account.address,
          to: "0x2222222222222222222222222222222222222222",
          value: "5000",
          validAfter: "1700000000",
          validBefore: "1700003600",
          nonce:
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        },
      },
    };

    expect(resolvePaymentPayer("0x3333333333333333333333333333333333333333", payload)).toBe(
      "0x3333333333333333333333333333333333333333"
    );
    expect(resolvePaymentPayer("", payload)).toBe(account.address.toLowerCase());
  });
});


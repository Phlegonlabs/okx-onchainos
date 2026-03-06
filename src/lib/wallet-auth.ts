import { createHash } from "crypto";
import { recoverMessageAddress } from "viem";
import { db } from "@/db/client";
import { walletAuthNonces } from "@/db/schema";
import type { PaymentPayload } from "./x402";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MAX_WALLET_AUTH_AGE_MS = 5 * 60 * 1000;

export const WALLET_AUTH_ADDRESS_HEADER = "x-wallet-address";
export const WALLET_AUTH_TIMESTAMP_HEADER = "x-wallet-timestamp";
export const WALLET_AUTH_NONCE_HEADER = "x-wallet-nonce";
export const WALLET_AUTH_SIGNATURE_HEADER = "x-wallet-signature";

type WalletAuthMessageParams = {
  address: string;
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  bodySha256: string;
};

type ParsedWalletAuthHeaders = {
  address: `0x${string}`;
  timestamp: string;
  nonce: string;
  signature: `0x${string}`;
};

type VerifyWalletAuthRequestParams = {
  headers: Headers;
  method: string;
  path: string;
  rawBody: string;
  expectedAddress?: string;
  nowMs?: number;
  consumeNonce?: (address: `0x${string}`, nonce: string) => Promise<boolean>;
};

export class WalletAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "WalletAuthError";
    this.statusCode = statusCode;
  }
}

function normalizeAddress(address: string): `0x${string}` {
  if (!ADDRESS_REGEX.test(address)) {
    throw new WalletAuthError("Wallet address must be a valid EVM address", 400);
  }

  return address.toLowerCase() as `0x${string}`;
}

function parseTimestamp(timestamp: string, nowMs: number): number {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new WalletAuthError("Wallet timestamp must be a valid unix millisecond value", 400);
  }

  if (Math.abs(nowMs - parsed) > MAX_WALLET_AUTH_AGE_MS) {
    throw new WalletAuthError("Wallet signature timestamp is too old or too far in the future", 401);
  }

  return parsed;
}

function parseWalletAuthHeaders(headers: Headers): ParsedWalletAuthHeaders {
  const address = headers.get(WALLET_AUTH_ADDRESS_HEADER) || "";
  const timestamp = headers.get(WALLET_AUTH_TIMESTAMP_HEADER) || "";
  const nonce = headers.get(WALLET_AUTH_NONCE_HEADER) || "";
  const signature = headers.get(WALLET_AUTH_SIGNATURE_HEADER) || "";

  if (!address || !timestamp || !nonce || !signature) {
    throw new WalletAuthError(
      `Missing wallet auth headers. Required: ${WALLET_AUTH_ADDRESS_HEADER}, ${WALLET_AUTH_TIMESTAMP_HEADER}, ${WALLET_AUTH_NONCE_HEADER}, ${WALLET_AUTH_SIGNATURE_HEADER}`,
      401
    );
  }

  if (nonce.length > 200) {
    throw new WalletAuthError("Wallet nonce is too long", 400);
  }

  return {
    address: normalizeAddress(address),
    timestamp,
    nonce,
    signature: signature as `0x${string}`,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("unique") ||
    message.includes("constraint failed") ||
    message.includes("already exists")
  );
}

async function consumeWalletAuthNonce(
  address: `0x${string}`,
  nonce: string
): Promise<boolean> {
  try {
    await db.insert(walletAuthNonces).values({
      id: `${address}:${nonce}`,
      address,
      nonce,
    });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return false;
    }
    throw error;
  }
}

export function buildWalletAuthBodyHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export function buildWalletAuthMessage(
  params: WalletAuthMessageParams
): string {
  return [
    "Trading Strategy Agent Gateway Wallet Auth",
    `Address: ${normalizeAddress(params.address)}`,
    `Method: ${params.method.toUpperCase()}`,
    `Path: ${params.path}`,
    `Timestamp: ${params.timestamp}`,
    `Nonce: ${params.nonce}`,
    `Body-SHA256: ${params.bodySha256}`,
  ].join("\n");
}

export async function verifyWalletAuthRequest(
  params: VerifyWalletAuthRequestParams
): Promise<`0x${string}`> {
  const parsed = parseWalletAuthHeaders(params.headers);
  const expectedAddress = params.expectedAddress
    ? normalizeAddress(params.expectedAddress)
    : null;
  const nowMs = params.nowMs ?? Date.now();

  parseTimestamp(parsed.timestamp, nowMs);

  if (expectedAddress && parsed.address !== expectedAddress) {
    throw new WalletAuthError("Wallet address does not match the expected owner", 403);
  }

  const message = buildWalletAuthMessage({
    address: parsed.address,
    method: params.method,
    path: params.path,
    timestamp: parsed.timestamp,
    nonce: parsed.nonce,
    bodySha256: buildWalletAuthBodyHash(params.rawBody),
  });

  let recoveredAddress: `0x${string}`;
  try {
    recoveredAddress = normalizeAddress(
      await recoverMessageAddress({
        message,
        signature: parsed.signature,
      })
    );
  } catch {
    throw new WalletAuthError("Wallet signature could not be recovered", 401);
  }

  if (recoveredAddress !== parsed.address) {
    throw new WalletAuthError("Wallet signature does not match wallet address", 401);
  }

  const nonceAccepted = await (params.consumeNonce || consumeWalletAuthNonce)(
    parsed.address,
    parsed.nonce
  );
  if (!nonceAccepted) {
    throw new WalletAuthError("Wallet nonce has already been used", 409);
  }

  return parsed.address;
}

export function resolvePaymentPayer(
  payer: string | null | undefined,
  paymentPayload: PaymentPayload
): `0x${string}` {
  const resolved =
    payer?.trim() || paymentPayload.payload.authorization.from || "";
  return normalizeAddress(resolved);
}

import { createOkxHeaders } from "./okx-auth";

const OKX_BASE = "https://web3.okx.com";
const VERIFY_PATH = "/api/v6/x402/verify";
const SETTLE_PATH = "/api/v6/x402/settle";
export const XLAYER_CHAIN_INDEX = "196";
export const XLAYER_USDT_ADDRESS =
  "0x779ded0c9e1022225f8e0630b35a9b54be713736";

type PaymentRequirementBuildParams = {
  amountCents: number;
  resource: string;
  description: string;
  mimeType?: string;
};

type PaymentRequirementBuildMicroUsdParams = {
  amountMicroUsd: number;
  resource: string;
  description: string;
  mimeType?: string;
};

export interface PaymentRequirements {
  x402Version: string;
  chainIndex: string | number;
  scheme: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  resource: string;
  description: string;
  mimeType: string;
}

export interface PaymentPayload {
  x402Version: string;
  chainIndex: string | number;
  scheme: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

interface VerifyResult {
  isValid: boolean;
  invalidReason: string | null;
  payer: string;
}

interface SettleResult {
  success: boolean;
  txHash: string;
  errorMsg: string | null;
}

interface OkxApiResponse {
  code?: string;
  msg?: string;
  data?: unknown[];
}

function normalizeChainIndex(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): string {
  const fromPayload = String(paymentPayload.chainIndex ?? "").trim();
  if (fromPayload) return fromPayload;

  const fromRequirements = String(paymentRequirements.chainIndex ?? "").trim();
  if (fromRequirements) return fromRequirements;

  return XLAYER_CHAIN_INDEX;
}

async function parseOkxResponse(
  res: Response
): Promise<OkxApiResponse & { fallbackMsg?: string }> {
  const text = await res.text();
  if (!text) {
    return {
      fallbackMsg: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
    };
  }

  try {
    return JSON.parse(text) as OkxApiResponse;
  } catch {
    return {
      fallbackMsg: `HTTP ${res.status} ${res.statusText || ""}: ${text}`.trim(),
    };
  }
}

export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResult> {
  const chainIndex = normalizeChainIndex(paymentPayload, paymentRequirements);
  const body = JSON.stringify({
    x402Version: paymentPayload.x402Version,
    chainIndex,
    paymentPayload: {
      ...paymentPayload,
      chainIndex,
    },
    paymentRequirements: {
      ...paymentRequirements,
      chainIndex,
    },
  });

  try {
    const headers = createOkxHeaders("POST", VERIFY_PATH, body);
    const res = await fetch(`${OKX_BASE}${VERIFY_PATH}`, {
      method: "POST",
      headers,
      body,
    });
    const json = await parseOkxResponse(res);

    if (!res.ok || json.code !== "0" || !json.data?.[0]) {
      return {
        isValid: false,
        invalidReason: json.msg || json.fallbackMsg || "Verification failed",
        payer: "",
      };
    }

    return json.data[0] as VerifyResult;
  } catch (error) {
    return {
      isValid: false,
      invalidReason: error instanceof Error ? error.message : "Verification failed",
      payer: "",
    };
  }
}

export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResult> {
  const chainIndex = normalizeChainIndex(paymentPayload, paymentRequirements);
  const body = JSON.stringify({
    x402Version: paymentPayload.x402Version,
    chainIndex,
    paymentPayload: {
      ...paymentPayload,
      chainIndex,
    },
    paymentRequirements: {
      ...paymentRequirements,
      chainIndex,
    },
  });

  try {
    const headers = createOkxHeaders("POST", SETTLE_PATH, body);
    const res = await fetch(`${OKX_BASE}${SETTLE_PATH}`, {
      method: "POST",
      headers,
      body,
    });
    const json = await parseOkxResponse(res);

    if (!res.ok || json.code !== "0" || !json.data?.[0]) {
      return {
        success: false,
        txHash: "",
        errorMsg: json.msg || json.fallbackMsg || "Settlement failed",
      };
    }

    const settleData = json.data[0] as {
      success?: boolean;
      txHash?: string | null;
      errorMsg?: string | null;
      errorReason?: string | null;
    };
    const success = Boolean(settleData.success);
    const reason = settleData.errorMsg || settleData.errorReason || null;

    if (!success) {
      return {
        success: false,
        txHash: "",
        errorMsg: reason || "Settlement rejected by OKX (no reason provided)",
      };
    }

    return {
      success: true,
      txHash: String(settleData.txHash || ""),
      errorMsg: null,
    };
  } catch (error) {
    return {
      success: false,
      txHash: "",
      errorMsg: error instanceof Error ? error.message : "Settlement failed",
    };
  }
}

export function buildPaymentRequirementsForAmount(
  params: PaymentRequirementBuildParams
): PaymentRequirements {
  const normalizedCents = Number.isFinite(params.amountCents)
    ? Math.max(0, Math.round(params.amountCents))
    : 0;

  return {
    x402Version: "1",
    chainIndex: XLAYER_CHAIN_INDEX,
    scheme: "exact",
    maxAmountRequired: String(normalizedCents * 10000),
    payTo: process.env.PLATFORM_WALLET_ADDRESS || "",
    asset: XLAYER_USDT_ADDRESS, // USDT on X Layer
    resource: params.resource,
    description: params.description,
    mimeType: params.mimeType || "application/json",
  };
}

export function buildPaymentRequirementsForMicroUsd(
  params: PaymentRequirementBuildMicroUsdParams
): PaymentRequirements {
  const normalizedMicroUsd = Number.isFinite(params.amountMicroUsd)
    ? Math.max(0, Math.round(params.amountMicroUsd))
    : 0;

  // USDT has 6 decimals, so 1 microUSD maps to 1 base unit.
  return {
    x402Version: "1",
    chainIndex: XLAYER_CHAIN_INDEX,
    scheme: "exact",
    maxAmountRequired: String(normalizedMicroUsd),
    payTo: process.env.PLATFORM_WALLET_ADDRESS || "",
    asset: XLAYER_USDT_ADDRESS,
    resource: params.resource,
    description: params.description,
    mimeType: params.mimeType || "application/json",
  };
}

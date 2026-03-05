import { createOkxHeaders } from "./okx-auth";

const OKX_BASE = "https://web3.okx.com";

export interface PaymentRequirements {
  x402Version: string;
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

export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResult> {
  const body = JSON.stringify({
    x402Version: paymentPayload.x402Version,
    paymentPayload,
    paymentRequirements,
  });

  const res = await fetch(`${OKX_BASE}/api/v6/payments/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OKX_API_KEY}`,
    },
    body,
  });

  const json = await res.json();

  if (json.code !== "0" || !json.data?.[0]) {
    return {
      isValid: false,
      invalidReason: json.msg || "Verification failed",
      payer: "",
    };
  }

  return json.data[0] as VerifyResult;
}

export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResult> {
  const requestPath = "/api/v6/payments/settle";
  const body = JSON.stringify({
    x402Version: paymentPayload.x402Version,
    paymentPayload,
    paymentRequirements,
  });

  const headers = createOkxHeaders("POST", requestPath, body);

  const res = await fetch(`${OKX_BASE}${requestPath}`, {
    method: "POST",
    headers,
    body,
  });

  const json = await res.json();

  if (json.code !== "0" || !json.data?.[0]) {
    return {
      success: false,
      txHash: "",
      errorMsg: json.msg || "Settlement failed",
    };
  }

  return {
    success: json.data[0].success,
    txHash: json.data[0].txHash || "",
    errorMsg: json.data[0].errorMsg || null,
  };
}

export function buildPaymentRequirements(
  strategyId: string,
  strategyName: string,
  pricePerSignalCents: number
): PaymentRequirements {
  return {
    x402Version: "1",
    scheme: "exact",
    maxAmountRequired: String(pricePerSignalCents * 10000),
    payTo: process.env.PLATFORM_WALLET_ADDRESS || "",
    asset: "0x74b7f16337b8972027f6196a17a631ac6de26d22", // USDC on X Layer
    resource: `/api/strategies/${strategyId}/signals`,
    description: `Access signals for strategy: ${strategyName}`,
    mimeType: "application/json",
  };
}

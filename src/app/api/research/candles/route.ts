import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { researchPayments } from "@/db/schema";
import { GatewayAuthError, requireGatewayAccess } from "@/lib/gateway-auth";
import { getResearchPricing } from "@/lib/gateway-pricing";
import {
  fetchCandles,
  getResearchConfig,
  normalizeBar,
  normalizeInstId,
  parseLimit,
  ResearchUpstreamError,
} from "@/lib/research";
import {
  buildPaymentRequirementsForMicroUsd,
  settlePayment,
  type PaymentPayload,
  verifyPayment,
} from "@/lib/x402";
import { resolvePaymentPayer } from "@/lib/wallet-auth";

const DEFAULT_LIMIT = 120;

function resolveBar(input: string, allowedBars: Set<string>): string | null {
  const map = new Map<string, string>();
  for (const bar of allowedBars) {
    map.set(bar.toLowerCase(), bar);
  }
  return map.get(input.toLowerCase()) || null;
}

export async function GET(req: NextRequest) {
  try {
    requireGatewayAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const config = getResearchConfig();
  const instId = normalizeInstId(req.nextUrl.searchParams.get("instId"));
  const barInput = normalizeBar(req.nextUrl.searchParams.get("bar"));
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limitInput = parseLimit(limitRaw);
  const limit = limitInput ?? DEFAULT_LIMIT;

  if (!instId) {
    return NextResponse.json({ error: "instId is required" }, { status: 400 });
  }

  if (!config.allowedInstIds.has(instId)) {
    return NextResponse.json(
      {
        error: "instId is not allowed",
        allowedInstIds: [...config.allowedInstIds],
      },
      { status: 400 }
    );
  }

  if (!barInput) {
    return NextResponse.json({ error: "bar is required" }, { status: 400 });
  }

  const bar = resolveBar(barInput, config.allowedBars);
  if (!bar) {
    return NextResponse.json(
      {
        error: "bar is not allowed",
        allowedBars: [...config.allowedBars],
      },
      { status: 400 }
    );
  }

  if (limitRaw !== null && limitInput === null) {
    return NextResponse.json({ error: "limit must be an integer" }, { status: 400 });
  }

  if (!Number.isInteger(limit)) {
    return NextResponse.json({ error: "limit must be an integer" }, { status: 400 });
  }

  if (limit < config.minLimit || limit > config.maxLimit) {
    return NextResponse.json(
      {
        error: `limit must be between ${config.minLimit} and ${config.maxLimit}`,
      },
      { status: 400 }
    );
  }

  const pricing = getResearchPricing(limit);
  const resource = `/api/research/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const paymentReqs = buildPaymentRequirementsForMicroUsd({
    amountMicroUsd: pricing.amountMicroUsd,
    resource,
    description: `Research candles for ${instId} (${bar}, ${limit})`,
  });

  const paymentHeader = req.headers.get("x-payment");
  if (!paymentHeader) {
    return NextResponse.json(
      {
        paymentRequirements: paymentReqs,
        request: {
          instId,
          bar,
          limit,
          priceMicroUsd: pricing.amountMicroUsd,
          pricingTier: pricing.tier,
        },
      },
      {
        status: 402,
        headers: {
          "X-Payment-Requirements": JSON.stringify(paymentReqs),
        },
      }
    );
  }

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = JSON.parse(paymentHeader) as PaymentPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid X-Payment header: must be valid JSON" },
      { status: 400 }
    );
  }

  const verifyResult = await verifyPayment(paymentPayload, paymentReqs);
  if (!verifyResult.isValid) {
    return NextResponse.json(
      { error: "Payment verification failed", reason: verifyResult.invalidReason },
      { status: 403 }
    );
  }

  let candlesData;
  try {
    candlesData = await fetchCandles(instId, bar, limit);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load candles";
    const status =
      error instanceof ResearchUpstreamError ? error.statusCode : 502;
    return NextResponse.json({ error: message }, { status });
  }

  const settleResult = await settlePayment(paymentPayload, paymentReqs);
  if (!settleResult.success) {
    return NextResponse.json(
      { error: "Payment settlement failed", reason: settleResult.errorMsg },
      { status: 500 }
    );
  }

  const payerAddress = resolvePaymentPayer(verifyResult.payer, paymentPayload);

  await db.insert(researchPayments).values({
    id: nanoid(12),
    payerAddress,
    resource,
    instId,
    bar,
    limit,
    amountMicroUsd: pricing.amountMicroUsd,
    amountBaseUnits: paymentReqs.maxAmountRequired,
    txHash: settleResult.txHash,
    status: "settled",
  });

  return NextResponse.json({
    ...candlesData,
    receipt: {
      resource,
      paidMicroUsd: pricing.amountMicroUsd,
      paidBaseUnits: paymentReqs.maxAmountRequired,
      pricingTier: pricing.tier,
      payerAddress,
      txHash: settleResult.txHash,
    },
  });
}

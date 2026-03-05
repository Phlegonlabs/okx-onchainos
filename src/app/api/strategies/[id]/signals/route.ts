import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategies, signals, payments, providerBalances } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  verifyPayment,
  settlePayment,
  buildPaymentRequirements,
  type PaymentPayload,
} from "@/lib/x402";

const PLATFORM_FEE_PCT = parseInt(process.env.PLATFORM_FEE_PCT || "10", 10);

// GET - x402 gated: returns signals after payment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const strategy = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, id))
    .get();

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  // Check for x402 payment header
  const paymentHeader = req.headers.get("x-payment");

  if (!paymentHeader) {
    const paymentReqs = buildPaymentRequirements(
      id,
      strategy.name,
      strategy.pricePerSignal
    );

    return NextResponse.json(
      { paymentRequirements: paymentReqs },
      {
        status: 402,
        headers: {
          "X-Payment-Requirements": JSON.stringify(paymentReqs),
        },
      }
    );
  }

  // Parse payment payload
  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = JSON.parse(paymentHeader);
  } catch {
    return NextResponse.json(
      { error: "Invalid X-Payment header: must be valid JSON" },
      { status: 400 }
    );
  }

  const paymentReqs = buildPaymentRequirements(
    id,
    strategy.name,
    strategy.pricePerSignal
  );

  // Step 1: Verify payment
  const verifyResult = await verifyPayment(paymentPayload, paymentReqs);
  if (!verifyResult.isValid) {
    return NextResponse.json(
      { error: "Payment verification failed", reason: verifyResult.invalidReason },
      { status: 403 }
    );
  }

  // Step 2: Settle payment
  const settleResult = await settlePayment(paymentPayload, paymentReqs);
  if (!settleResult.success) {
    return NextResponse.json(
      { error: "Payment settlement failed", reason: settleResult.errorMsg },
      { status: 500 }
    );
  }

  // Step 3: Record payment + update provider balance
  const amountCents = strategy.pricePerSignal;
  const platformCents = Math.round(amountCents * PLATFORM_FEE_PCT / 100);
  const providerCents = amountCents - platformCents;

  await db.insert(payments).values({
    id: nanoid(12),
    strategyId: id,
    amountCents,
    providerCents,
    platformCents,
    txHash: settleResult.txHash,
    status: "settled",
  });

  await db
    .update(providerBalances)
    .set({
      totalEarnedCents: sql`${providerBalances.totalEarnedCents} + ${providerCents}`,
      pendingCents: sql`${providerBalances.pendingCents} + ${providerCents}`,
      totalSignalsSold: sql`${providerBalances.totalSignalsSold} + 1`,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(providerBalances.providerAddress, strategy.providerAddress));

  // Step 4: Return signals
  const allSignals = await db
    .select()
    .from(signals)
    .where(eq(signals.strategyId, id))
    .orderBy(desc(signals.createdAt));

  return NextResponse.json({
    signals: allSignals,
    receipt: {
      strategyId: id,
      strategyName: strategy.name,
      paidAmount: amountCents,
      providerCredited: providerCents,
      platformFee: platformCents,
      txHash: settleResult.txHash,
    },
  });
}

// PUT - push a new signal (for providers)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const strategy = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, id))
    .get();

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action, token, entry, stopLoss, takeProfit, reasoning } = body;

  if (!action || !token || entry == null) {
    return NextResponse.json(
      { error: "Missing required fields: action, token, entry" },
      { status: 400 }
    );
  }

  if (action !== "buy" && action !== "sell") {
    return NextResponse.json(
      { error: "action must be 'buy' or 'sell'" },
      { status: 400 }
    );
  }

  const signalId = nanoid(12);
  await db.insert(signals).values({
    id: signalId,
    strategyId: id,
    action,
    token,
    entry,
    stopLoss,
    takeProfit,
    reasoning,
    outcome: "pending",
  });

  // Update strategy signal count
  await db
    .update(strategies)
    .set({ totalSignals: sql`${strategies.totalSignals} + 1` })
    .where(eq(strategies.id, id));

  return NextResponse.json({ id: signalId });
}

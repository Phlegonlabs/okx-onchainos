import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  payments,
  providerBalances,
  signals,
  strategies,
  subscriptions,
} from "@/db/schema";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  buildPaymentRequirementsForAmount,
  settlePayment,
  type PaymentPayload,
  verifyPayment,
} from "@/lib/x402";

const PLATFORM_FEE_PCT = parseInt(process.env.PLATFORM_FEE_PCT || "10", 10);

function toSqlDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function buildOpenClawMessages(
  strategyName: string,
  rows: Array<{
    action: string;
    token: string;
    entry: number;
    stopLoss: number | null;
    takeProfit: number | null;
    createdAt: string | null;
  }>
): string[] {
  return rows.map((row) => {
    const action = row.action.toUpperCase();
    const entry = Number(row.entry).toFixed(2);
    const sl = row.stopLoss == null ? "-" : Number(row.stopLoss).toFixed(2);
    const tp = row.takeProfit == null ? "-" : Number(row.takeProfit).toFixed(2);
    const ts = row.createdAt || "unknown-time";
    return `[${strategyName}] ${action} ${row.token} @ ${entry} | SL ${sl} | TP ${tp} | ${ts}`;
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  const { subscriptionId } = await params;

  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .get();

  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  const strategy = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, subscription.strategyId))
    .get();

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found for subscription" }, { status: 404 });
  }

  const now = toSqlDatetime(new Date());
  if (subscription.expiresAt <= now || subscription.status !== "active") {
    if (subscription.status === "active" && subscription.expiresAt <= now) {
      await db
        .update(subscriptions)
        .set({
          status: "expired",
          updatedAt: sql`datetime('now')`,
        })
        .where(eq(subscriptions.id, subscription.id));
    }
    return NextResponse.json(
      {
        error: "Subscription expired or inactive",
        subscription: {
          ...subscription,
          status: subscription.expiresAt <= now ? "expired" : subscription.status,
        },
      },
      { status: 410 }
    );
  }

  const anchor = subscription.lastPaidSignalAt || subscription.startedAt;
  const pendingSignals = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.strategyId, subscription.strategyId),
        gt(signals.createdAt, anchor)
      )
    )
    .orderBy(asc(signals.createdAt));

  if (pendingSignals.length === 0) {
    return NextResponse.json({
      subscription,
      pendingCount: 0,
      signals: [],
      openclawMessages: [],
      message: "No new signals yet",
    });
  }

  const amountCents = strategy.pricePerSignal * pendingSignals.length;
  const paymentReqs = buildPaymentRequirementsForAmount({
    amountCents,
    resource: `/api/subscriptions/${subscriptionId}/signals`,
    description: `Subscription signals for ${strategy.name} (${pendingSignals.length} new)`,
  });

  const paymentHeader = req.headers.get("x-payment");
  if (!paymentHeader) {
    return NextResponse.json(
      {
        pendingCount: pendingSignals.length,
        paymentRequirements: paymentReqs,
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
    paymentPayload = JSON.parse(paymentHeader);
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

  const settleResult = await settlePayment(paymentPayload, paymentReqs);
  if (!settleResult.success) {
    return NextResponse.json(
      { error: "Payment settlement failed", reason: settleResult.errorMsg },
      { status: 500 }
    );
  }

  const platformCents = Math.round(amountCents * PLATFORM_FEE_PCT / 100);
  const providerCents = amountCents - platformCents;

  await db.insert(payments).values({
    id: nanoid(12),
    strategyId: strategy.id,
    amountCents,
    providerCents,
    platformCents,
    txHash: settleResult.txHash,
    status: "settled",
  });

  await db
    .insert(providerBalances)
    .values({
      providerAddress: strategy.providerAddress,
      totalEarnedCents: 0,
      pendingCents: 0,
      totalSignalsSold: 0,
    })
    .onConflictDoNothing();

  await db
    .update(providerBalances)
    .set({
      totalEarnedCents: sql`${providerBalances.totalEarnedCents} + ${providerCents}`,
      pendingCents: sql`${providerBalances.pendingCents} + ${providerCents}`,
      totalSignalsSold: sql`${providerBalances.totalSignalsSold} + ${pendingSignals.length}`,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(providerBalances.providerAddress, strategy.providerAddress));

  const latestSignal = pendingSignals[pendingSignals.length - 1];
  await db
    .update(subscriptions)
    .set({
      lastPaidSignalAt: latestSignal.createdAt || anchor,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(subscriptions.id, subscription.id));

  const openclawMessages = buildOpenClawMessages(strategy.name, pendingSignals);

  return NextResponse.json({
    signals: pendingSignals,
    pendingCount: pendingSignals.length,
    openclawMessages,
    receipt: {
      subscriptionId: subscription.id,
      strategyId: strategy.id,
      strategyName: strategy.name,
      paidAmount: amountCents,
      providerCredited: providerCents,
      platformFee: platformCents,
      txHash: settleResult.txHash,
    },
  });
}

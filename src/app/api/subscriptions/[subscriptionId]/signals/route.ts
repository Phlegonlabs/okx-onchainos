import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  payments,
  providerBalances,
  signals,
  strategies,
  subscriptions,
} from "@/db/schema";
import { GatewayAuthError, requireGatewayAccess } from "@/lib/gateway-auth";
import { clampSignalCharge } from "@/lib/gateway-pricing";
import {
  buildPaymentRequirementsForAmount,
  settlePayment,
  type PaymentPayload,
  verifyPayment,
} from "@/lib/x402";
import { resolvePaymentPayer } from "@/lib/wallet-auth";

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
) {
  return rows.map((row) => {
    const action = row.action.toUpperCase();
    const entry = Number(row.entry).toFixed(2);
    const stopLoss = row.stopLoss == null ? "-" : Number(row.stopLoss).toFixed(2);
    const takeProfit = row.takeProfit == null ? "-" : Number(row.takeProfit).toFixed(2);
    return `[${strategyName}] ${action} ${row.token} @ ${entry} | SL ${stopLoss} | TP ${takeProfit} | ${row.createdAt || "unknown-time"}`;
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    requireGatewayAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

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

  if (!strategy || strategy.listingStatus !== "approved" || strategy.status !== "active") {
    return NextResponse.json({ error: "Strategy not found for subscription" }, { status: 404 });
  }

  const now = toSqlDatetime(new Date());
  if (subscription.expiresAt <= now || subscription.status !== "active") {
    if (subscription.status === "active" && subscription.expiresAt <= now) {
      await db
        .update(subscriptions)
        .set({ status: "expired", updatedAt: sql`datetime('now')` })
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
        eq(signals.source, "live"),
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
      message: "No new live signals yet",
    });
  }

  const spendRow = await db
    .select({
      total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.subscriptionId, subscription.id),
        eq(payments.status, "settled"),
        eq(payments.billingType, "signal_batch")
      )
    )
    .get();

  const alreadySpentCents = Number(spendRow?.total ?? 0);
  const charge = clampSignalCharge({
    periodCapCents: strategy.periodCapCents ?? 149,
    pricePerSignal: strategy.pricePerSignal,
    pendingSignalCount: pendingSignals.length,
    alreadySpentCents,
  });
  const openclawMessages = buildOpenClawMessages(strategy.name, pendingSignals);

  if (charge.chargedCents <= 0) {
    const latestSignal = pendingSignals[pendingSignals.length - 1];
    await db
      .update(subscriptions)
      .set({
        lastPaidSignalAt: latestSignal.createdAt || anchor,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(subscriptions.id, subscription.id));

    return NextResponse.json({
      signals: pendingSignals,
      pendingCount: pendingSignals.length,
      openclawMessages,
      receipt: {
        subscriptionId: subscription.id,
        strategyId: strategy.id,
        strategyName: strategy.name,
        paidAmount: 0,
        periodSpendCents: alreadySpentCents,
        remainingCapCents: charge.remainingCapCents,
        capReached: true,
      },
    });
  }

  const paymentReqs = buildPaymentRequirementsForAmount({
    amountCents: charge.chargedCents,
    resource: `/api/subscriptions/${subscriptionId}/signals`,
    description: `Live signals for ${strategy.name} (${pendingSignals.length} pending, capped billing)`,
  });

  const paymentHeader = req.headers.get("x-payment");
  if (!paymentHeader) {
    return NextResponse.json(
      {
        pendingCount: pendingSignals.length,
        paymentRequirements: paymentReqs,
        billing: {
          requestedCents: charge.requestedCents,
          chargedCents: charge.chargedCents,
          periodSpendCents: alreadySpentCents,
          remainingCapCents: charge.remainingCapCents,
          periodCapCents: strategy.periodCapCents,
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

  const payerAddress = resolvePaymentPayer(verifyResult.payer, paymentPayload);
  if (payerAddress !== subscription.subscriberAddress.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Payment wallet does not match subscription owner",
        expectedSubscriberAddress: subscription.subscriberAddress,
        payerAddress,
      },
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

  const platformCents = Math.round((charge.chargedCents * PLATFORM_FEE_PCT) / 100);
  const providerCents = charge.chargedCents - platformCents;

  await db.insert(payments).values({
    id: nanoid(12),
    strategyId: strategy.id,
    subscriptionId: subscription.id,
    amountCents: charge.chargedCents,
    providerCents,
    platformCents,
    billingType: "signal_batch",
    unitsBilled: pendingSignals.length,
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

  return NextResponse.json({
    signals: pendingSignals,
    pendingCount: pendingSignals.length,
    openclawMessages,
    receipt: {
      subscriptionId: subscription.id,
      strategyId: strategy.id,
      strategyName: strategy.name,
      paidAmount: charge.chargedCents,
      requestedAmount: charge.requestedCents,
      payerAddress,
      providerCredited: providerCents,
      platformFee: platformCents,
      periodSpendCents: alreadySpentCents + charge.chargedCents,
      remainingCapCents: Math.max(
        0,
        (strategy.periodCapCents ?? 149) - alreadySpentCents - charge.chargedCents
      ),
      capReached: charge.capReached,
      txHash: settleResult.txHash,
    },
  });
}

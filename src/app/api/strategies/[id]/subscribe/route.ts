import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategies, subscriptions } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { GatewayAuthError, requireGatewayAccess } from "@/lib/gateway-auth";
import {
  verifyWalletAuthRequest,
  WalletAuthError,
} from "@/lib/wallet-auth";

const DEFAULT_PLAN_DAYS = 30;
const MIN_PLAN_DAYS = 1;
const MAX_PLAN_DAYS = 365;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type SubscribeBody = {
  subscriberAddress?: string;
  planDays?: number;
};

function toSqlDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizePlanDays(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_PLAN_DAYS;
  const rounded = Math.round(value as number);
  return Math.max(MIN_PLAN_DAYS, Math.min(MAX_PLAN_DAYS, rounded));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireGatewayAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const { id } = await params;
  const subscriberAddress = (
    req.nextUrl.searchParams.get("subscriberAddress") || ""
  )
    .trim()
    .toLowerCase();

  if (!subscriberAddress || !ADDRESS_REGEX.test(subscriberAddress)) {
    return NextResponse.json(
      { error: "subscriberAddress is required and must be a valid EVM address" },
      { status: 400 }
    );
  }

  const strategy = await db
    .select({
      id: strategies.id,
      name: strategies.name,
      pricePerSignal: strategies.pricePerSignal,
      status: strategies.status,
      listingStatus: strategies.listingStatus,
      strategyTier: strategies.strategyTier,
      periodCapCents: strategies.periodCapCents,
    })
    .from(strategies)
    .where(eq(strategies.id, id))
    .get();

  if (!strategy || strategy.listingStatus !== "approved" || strategy.status !== "active") {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const subscription = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.strategyId, id),
        eq(subscriptions.subscriberAddress, subscriberAddress),
        eq(subscriptions.status, "active"),
        sql`${subscriptions.expiresAt} > datetime('now')`
      )
    )
    .orderBy(desc(subscriptions.expiresAt))
    .get();

  return NextResponse.json({
    strategy,
    subscription: subscription || null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireGatewayAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const { id } = await params;

  const strategy = await db
    .select({
      id: strategies.id,
      name: strategies.name,
      pricePerSignal: strategies.pricePerSignal,
      providerAddress: strategies.providerAddress,
      status: strategies.status,
      listingStatus: strategies.listingStatus,
      strategyTier: strategies.strategyTier,
      periodCapCents: strategies.periodCapCents,
    })
    .from(strategies)
    .where(eq(strategies.id, id))
    .get();

  if (!strategy || strategy.status !== "active" || strategy.listingStatus !== "approved") {
    return NextResponse.json({ error: "Active strategy not found" }, { status: 404 });
  }

  const rawBody = await req.text();
  let body: SubscribeBody = {};
  try {
    body = (JSON.parse(rawBody || "{}")) as SubscribeBody;
  } catch {}

  const subscriberAddress = (body.subscriberAddress || "").trim().toLowerCase();
  if (!subscriberAddress || !ADDRESS_REGEX.test(subscriberAddress)) {
    return NextResponse.json(
      { error: "subscriberAddress is required and must be a valid EVM address" },
      { status: 400 }
    );
  }

  let authAddress;
  try {
    authAddress = await verifyWalletAuthRequest({
      headers: req.headers,
      method: req.method,
      path: req.nextUrl.pathname,
      rawBody,
      expectedAddress: subscriberAddress,
    });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const planDays = normalizePlanDays(body.planDays);

  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.strategyId, id),
        eq(subscriptions.subscriberAddress, authAddress),
        eq(subscriptions.status, "active"),
        sql`${subscriptions.expiresAt} > datetime('now')`
      )
    )
    .orderBy(desc(subscriptions.expiresAt))
    .get();

  if (existing) {
    return NextResponse.json(
      {
        strategy,
        subscription: existing,
        reused: true,
      },
      { status: 200 }
    );
  }

  const now = new Date();
  const expires = new Date(now.getTime() + planDays * 24 * 60 * 60 * 1000);
  const subscriptionId = nanoid(12);

  const startedAt = toSqlDatetime(now);
  const expiresAt = toSqlDatetime(expires);

  await db.insert(subscriptions).values({
    id: subscriptionId,
    strategyId: id,
    subscriberAddress: authAddress,
    planDays,
    status: "active",
    startedAt,
    expiresAt,
    lastPaidSignalAt: null,
  });

  const created = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .get();

  return NextResponse.json(
    {
      strategy,
      subscription: created,
      reused: false,
    },
    { status: 201 }
  );
}

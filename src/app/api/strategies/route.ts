import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategies, providerBalances } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  verifyWalletAuthRequest,
  WalletAuthError,
} from "@/lib/wallet-auth";

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") || "newest";

  let orderBy;
  switch (sort) {
    case "winRate":
      orderBy = desc(strategies.winRate);
      break;
    case "avgReturn":
      orderBy = desc(strategies.avgReturn);
      break;
    default:
      orderBy = desc(strategies.createdAt);
  }

  const rows = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "active"))
    .orderBy(orderBy);

  return NextResponse.json({ strategies: rows });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const { name, description, asset, timeframe, pricePerSignal, providerAddress } = body;

  if (!name || !description || !asset || !timeframe || !pricePerSignal || !providerAddress) {
    return NextResponse.json(
      { error: "Missing required fields: name, description, asset, timeframe, pricePerSignal, providerAddress" },
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
      expectedAddress: providerAddress,
    });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const id = nanoid(12);
  await db.insert(strategies).values({
    id,
    name,
    description,
    asset,
    timeframe,
    pricePerSignal,
    providerAddress: authAddress,
  });

  // Ensure provider balance row exists
  await db
    .insert(providerBalances)
    .values({ providerAddress: authAddress, totalEarnedCents: 0, pendingCents: 0, totalSignalsSold: 0 })
    .onConflictDoNothing();

  return NextResponse.json({ id }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategies, providerBalances } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

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
  const body = await req.json();
  const { name, description, asset, timeframe, pricePerSignal, providerAddress } = body;

  if (!name || !description || !asset || !timeframe || !pricePerSignal || !providerAddress) {
    return NextResponse.json(
      { error: "Missing required fields: name, description, asset, timeframe, pricePerSignal, providerAddress" },
      { status: 400 }
    );
  }

  const id = nanoid(12);
  await db.insert(strategies).values({
    id,
    name,
    description,
    asset,
    timeframe,
    pricePerSignal,
    providerAddress,
  });

  // Ensure provider balance row exists
  await db
    .insert(providerBalances)
    .values({ providerAddress, totalEarnedCents: 0, pendingCents: 0, totalSignalsSold: 0 })
    .onConflictDoNothing();

  return NextResponse.json({ id }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { providerBalances, strategies } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  const balance = await db
    .select()
    .from(providerBalances)
    .where(eq(providerBalances.providerAddress, address))
    .get();

  if (!balance) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const providerStrategies = await db
    .select({
      id: strategies.id,
      name: strategies.name,
      asset: strategies.asset,
      winRate: strategies.winRate,
      totalSignals: strategies.totalSignals,
    })
    .from(strategies)
    .where(eq(strategies.providerAddress, address));

  return NextResponse.json({ balance, strategies: providerStrategies });
}

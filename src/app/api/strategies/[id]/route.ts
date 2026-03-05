import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategies, signals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
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

  const recentSignals = await db
    .select({
      id: signals.id,
      action: signals.action,
      token: signals.token,
      entry: signals.entry,
      outcome: signals.outcome,
      returnPct: signals.returnPct,
      createdAt: signals.createdAt,
    })
    .from(signals)
    .where(eq(signals.strategyId, id))
    .orderBy(desc(signals.createdAt))
    .limit(5);

  return NextResponse.json({ strategy, recentSignals });
}

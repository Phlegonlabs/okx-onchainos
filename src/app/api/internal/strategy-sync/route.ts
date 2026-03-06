import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { signals, strategies } from "@/db/schema";
import { GatewayAuthError, requireInternalAccess } from "@/lib/gateway-auth";
import { buildLiveSignal, resolveSubmissionBacktestLimit } from "@/lib/strategy-engine";
import { fetchCandles } from "@/lib/research";
import { type StrategyTemplateKey, type StrategyTemplateParams } from "@/lib/strategy-templates";

export async function POST(req: NextRequest) {
  try {
    requireInternalAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const activeStrategies = await db
    .select()
    .from(strategies)
    .where(
      and(
        eq(strategies.status, "active"),
        eq(strategies.listingStatus, "approved"),
        isNotNull(strategies.templateKey),
        isNotNull(strategies.paramsJson)
      )
    );

  let created = 0;
  const skipped: string[] = [];

  for (const strategy of activeStrategies) {
    try {
      const candles = await fetchCandles(
        strategy.asset,
        strategy.timeframe,
        resolveSubmissionBacktestLimit(strategy.timeframe)
      );
      const liveSignal = buildLiveSignal({
        candles: candles.candles,
        token: strategy.asset.split("-")[0],
        templateKey: strategy.templateKey as StrategyTemplateKey,
        templateParams: JSON.parse(strategy.paramsJson || "{}") as StrategyTemplateParams,
      });

      if (!liveSignal) {
        skipped.push(`${strategy.id}:no-signal`);
        continue;
      }

      const existing = await db
        .select({ id: signals.id })
        .from(signals)
        .where(
          and(
            eq(signals.strategyId, strategy.id),
            eq(signals.source, "live"),
            eq(signals.createdAt, liveSignal.createdAt)
          )
        )
        .get();

      if (existing) {
        skipped.push(`${strategy.id}:duplicate`);
        continue;
      }

      await db.insert(signals).values({
        id: nanoid(12),
        strategyId: strategy.id,
        action: liveSignal.action,
        token: strategy.asset.split("-")[0],
        entry: liveSignal.entry,
        stopLoss: liveSignal.stopLoss,
        takeProfit: liveSignal.takeProfit,
        reasoning: liveSignal.reasoning,
        outcome: "pending",
        source: "live",
        createdAt: liveSignal.createdAt,
      });

      await db
        .update(strategies)
        .set({
          totalSignals: (strategy.totalSignals ?? 0) + 1,
        })
        .where(eq(strategies.id, strategy.id));

      created += 1;
    } catch (error) {
      skipped.push(
        `${strategy.id}:${error instanceof Error ? error.message : "unknown-error"}`
      );
    }
  }

  return NextResponse.json({
    scanned: activeStrategies.length,
    created,
    skipped,
  });
}

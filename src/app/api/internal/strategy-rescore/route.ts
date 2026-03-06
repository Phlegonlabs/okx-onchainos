import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { strategies, strategyBacktests, strategySubmissions } from "@/db/schema";
import { GatewayAuthError, requireInternalAccess } from "@/lib/gateway-auth";
import { evaluateSubmission, resolveSubmissionBacktestLimit } from "@/lib/strategy-engine";
import { fetchCandles } from "@/lib/research";
import { type StrategyTemplateKey } from "@/lib/strategy-templates";

function toSqlDatetime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function POST(req: NextRequest) {
  try {
    requireInternalAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const trackedStrategies = await db
    .select()
    .from(strategies)
    .where(and(isNotNull(strategies.templateKey), isNotNull(strategies.paramsJson)));

  let rescored = 0;
  const failures: string[] = [];

  for (const strategy of trackedStrategies) {
    try {
      const submission = await db
        .select()
        .from(strategySubmissions)
        .where(eq(strategySubmissions.strategyId, strategy.id))
        .orderBy(desc(strategySubmissions.createdAt))
        .get();

      if (!submission) {
        failures.push(`${strategy.id}:missing-submission`);
        continue;
      }

      const candles = await fetchCandles(
        strategy.asset,
        strategy.timeframe,
        resolveSubmissionBacktestLimit(strategy.timeframe)
      );
      const evaluation = evaluateSubmission({
        candles: candles.candles,
        templateKey: strategy.templateKey as StrategyTemplateKey,
        rawParams: JSON.parse(strategy.paramsJson || "{}"),
      });
      const nextStatus = evaluation.approved ? "active" : "paused";
      const nextListingStatus = evaluation.approved ? "approved" : "auto_delisted";
      const now = toSqlDatetime(new Date());

      await db
        .update(strategies)
        .set({
          winRate: evaluation.winRate,
          avgReturn: evaluation.avgReturn,
          pricePerSignal: evaluation.pricePerSignal,
          score: evaluation.score,
          strategyTier: evaluation.strategyTier,
          periodCapCents: evaluation.periodCapCents,
          status: nextStatus,
          listingStatus: nextListingStatus,
          lastScoredAt: now,
        })
        .where(eq(strategies.id, strategy.id));

      await db
        .update(strategySubmissions)
        .set({
          status: evaluation.approved ? "approved" : "rejected",
          score: evaluation.score,
          rejectionReason: evaluation.rejectionReason,
          updatedAt: now,
        })
        .where(eq(strategySubmissions.id, submission.id));

      await db.insert(strategyBacktests).values({
        id: nanoid(12),
        submissionId: submission.id,
        strategyId: strategy.id,
        status: evaluation.approved ? "approved" : "rejected",
        instId: strategy.asset,
        timeframe: strategy.timeframe,
        templateKey: strategy.templateKey || "sma_crossover",
        score: evaluation.score,
        signalCount: evaluation.signalCount,
        winRate: evaluation.winRate,
        avgReturn: evaluation.avgReturn,
        cumulativeReturnPct: evaluation.cumulativeReturnPct,
        maxDrawdownPct: evaluation.maxDrawdownPct,
        windowDays: evaluation.windowDays,
        paramsJson: JSON.stringify(evaluation.params),
        metricsJson: JSON.stringify({
          rejectionReason: evaluation.rejectionReason,
          strategyTier: evaluation.strategyTier,
          pricePerSignal: evaluation.pricePerSignal,
          periodCapCents: evaluation.periodCapCents,
        }),
      });

      rescored += 1;
    } catch (error) {
      failures.push(`${strategy.id}:${error instanceof Error ? error.message : "unknown-error"}`);
    }
  }

  return NextResponse.json({
    scanned: trackedStrategies.length,
    rescored,
    failures,
  });
}

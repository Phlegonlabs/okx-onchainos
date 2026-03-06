import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import {
  providerBalances,
  signals,
  strategies,
  strategyBacktests,
  strategySubmissions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { GatewayAuthError, requireGatewayAccess } from "@/lib/gateway-auth";
import { evaluateSubmission, resolveSubmissionBacktestLimit } from "@/lib/strategy-engine";
import { fetchCandles, getResearchConfig, normalizeInstId, ResearchUpstreamError } from "@/lib/research";
import { type StrategyTemplateKey, SUBMISSION_ALLOWED_BARS } from "@/lib/strategy-templates";
import { verifyWalletAuthRequest, WalletAuthError } from "@/lib/wallet-auth";

type SubmissionBody = {
  providerAddress?: string;
  name?: string;
  description?: string;
  instId?: string;
  timeframe?: string;
  templateKey?: StrategyTemplateKey;
  params?: unknown;
};

function normalizeTimeframe(input: string | undefined) {
  return (input || "").trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    requireGatewayAccess(req.headers);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const rawBody = await req.text();
  let body: SubmissionBody;
  try {
    body = JSON.parse(rawBody) as SubmissionBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const providerAddress = (body.providerAddress || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const description = (body.description || "").trim();
  const instId = normalizeInstId(body.instId || "");
  const timeframe = normalizeTimeframe(body.timeframe);
  const templateKey = body.templateKey;

  if (!providerAddress || !name || !description || !instId || !timeframe || !templateKey) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: providerAddress, name, description, instId, timeframe, templateKey",
      },
      { status: 400 }
    );
  }

  const researchConfig = getResearchConfig();
  if (!researchConfig.allowedInstIds.has(instId)) {
    return NextResponse.json(
      { error: "instId is not allowed", allowedInstIds: [...researchConfig.allowedInstIds] },
      { status: 400 }
    );
  }

  if (!SUBMISSION_ALLOWED_BARS.has(timeframe)) {
    return NextResponse.json(
      { error: "timeframe is not allowed", allowedBars: [...SUBMISSION_ALLOWED_BARS] },
      { status: 400 }
    );
  }

  try {
    await verifyWalletAuthRequest({
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

  const submissionId = nanoid(12);
  const paramsJson = JSON.stringify(body.params ?? {});

  let candles;
  try {
    candles = await fetchCandles(instId, timeframe, resolveSubmissionBacktestLimit(timeframe));
  } catch (error) {
    const status = error instanceof ResearchUpstreamError ? error.statusCode : 502;
    const message =
      error instanceof Error ? error.message : "Failed to load candles for submission";
    return NextResponse.json({ error: message }, { status });
  }

  let evaluation;
  try {
    evaluation = evaluateSubmission({
      candles: candles.candles,
      templateKey,
      rawParams: body.params,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid strategy template parameters";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await db.insert(strategySubmissions).values({
    id: submissionId,
    providerAddress,
    name,
    description,
    instId,
    timeframe,
    templateKey,
    paramsJson,
    status: evaluation.approved ? "approved" : "rejected",
    score: evaluation.score,
    rejectionReason: evaluation.rejectionReason,
  });

  await db
    .insert(providerBalances)
    .values({
      providerAddress,
      totalEarnedCents: 0,
      pendingCents: 0,
      totalSignalsSold: 0,
    })
    .onConflictDoNothing();

  let strategyId: string | null = null;
  if (evaluation.approved) {
    const approvedStrategyId = nanoid(12);
    strategyId = approvedStrategyId;
    await db.insert(strategies).values({
      id: approvedStrategyId,
      name,
      description,
      asset: instId,
      timeframe,
      pricePerSignal: evaluation.pricePerSignal,
      providerAddress,
      totalSignals: evaluation.trades.length,
      winRate: evaluation.winRate,
      avgReturn: evaluation.avgReturn,
      status: "active",
      listingStatus: "approved",
      templateKey,
      paramsJson: JSON.stringify(evaluation.params),
      score: evaluation.score,
      strategyTier: evaluation.strategyTier,
      periodCapCents: evaluation.periodCapCents,
      lastScoredAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    });

    const token = instId.split("-")[0];
    if (evaluation.trades.length > 0) {
      await db.insert(signals).values(
        evaluation.trades.map((trade) => ({
          id: nanoid(12),
          strategyId: approvedStrategyId,
          action: trade.action,
          token,
          entry: trade.entry,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          reasoning: `${name} backtest signal generated by ${templateKey}.`,
          outcome: trade.outcome,
          returnPct: trade.returnPct,
          source: "backtest",
          createdAt: trade.createdAt,
          settledAt: trade.settledAt,
        }))
      );
    }

    await db
      .update(strategySubmissions)
      .set({
        strategyId,
        updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      .where(eq(strategySubmissions.id, submissionId));
  }

  await db.insert(strategyBacktests).values({
    id: nanoid(12),
    submissionId,
    strategyId,
    status: evaluation.approved ? "approved" : "rejected",
    instId,
    timeframe,
    templateKey,
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

  return NextResponse.json(
    {
      submission: {
        id: submissionId,
        status: evaluation.approved ? "approved" : "rejected",
        score: evaluation.score,
        rejectionReason: evaluation.rejectionReason,
        strategyId,
      },
      backtest: {
        signalCount: evaluation.signalCount,
        winRate: evaluation.winRate,
        avgReturn: evaluation.avgReturn,
        cumulativeReturnPct: evaluation.cumulativeReturnPct,
        maxDrawdownPct: evaluation.maxDrawdownPct,
        windowDays: evaluation.windowDays,
      },
      pricing: evaluation.approved
        ? {
            strategyTier: evaluation.strategyTier,
            pricePerSignal: evaluation.pricePerSignal,
            periodCapCents: evaluation.periodCapCents,
          }
        : null,
    },
    { status: 201 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategyBacktests, strategySubmissions } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { GatewayAuthError, requireGatewayAccess } from "@/lib/gateway-auth";
import { verifyWalletAuthRequest, WalletAuthError } from "@/lib/wallet-auth";

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
  const submission = await db
    .select()
    .from(strategySubmissions)
    .where(eq(strategySubmissions.id, id))
    .get();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  try {
    await verifyWalletAuthRequest({
      headers: req.headers,
      method: req.method,
      path: req.nextUrl.pathname,
      rawBody: "",
      expectedAddress: submission.providerAddress,
    });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const backtest = await db
    .select()
    .from(strategyBacktests)
    .where(
      and(
        eq(strategyBacktests.submissionId, submission.id),
        eq(strategyBacktests.status, submission.status)
      )
    )
    .orderBy(desc(strategyBacktests.createdAt))
    .get();

  return NextResponse.json({ submission, backtest });
}

import { NextRequest, NextResponse } from "next/server";
import {
  fetchPrice,
  getResearchConfig,
  normalizeInstId,
  ResearchUpstreamError,
} from "@/lib/research";

export async function GET(req: NextRequest) {
  const config = getResearchConfig();
  const instId = normalizeInstId(req.nextUrl.searchParams.get("instId"));

  if (!instId) {
    return NextResponse.json(
      { error: "instId is required" },
      { status: 400 }
    );
  }

  if (!config.allowedInstIds.has(instId)) {
    return NextResponse.json(
      {
        error: "instId is not allowed",
        allowedInstIds: [...config.allowedInstIds],
      },
      { status: 400 }
    );
  }

  try {
    const data = await fetchPrice(instId);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Failed to load price for ${instId}`;
    const status =
      error instanceof ResearchUpstreamError ? error.statusCode : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

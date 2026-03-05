import { NextResponse } from "next/server";
import { fetchSupportedAssets, ResearchUpstreamError } from "@/lib/research";

export async function GET() {
  try {
    const data = await fetchSupportedAssets();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load supported assets";
    const status =
      error instanceof ResearchUpstreamError ? error.statusCode : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

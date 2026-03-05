import { NextRequest, NextResponse } from "next/server";
import { getTokenPrice } from "@/lib/market";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const price = await getTokenPrice(token.toUpperCase());

  if (!price) {
    return NextResponse.json(
      { error: `Price data not available for ${token}` },
      { status: 404 }
    );
  }

  return NextResponse.json(price);
}

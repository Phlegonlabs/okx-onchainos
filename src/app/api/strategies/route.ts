import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { strategies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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
    case "score":
      orderBy = desc(strategies.score);
      break;
    default:
      orderBy = desc(strategies.createdAt);
  }

  const rows = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "active"))
    .orderBy(orderBy);

  return NextResponse.json({
    strategies: rows.filter((row) => row.listingStatus === "approved"),
  });
}

export async function POST(req: NextRequest) {
  void req;
  return NextResponse.json(
    {
      error: "Direct strategy creation has been replaced by POST /api/strategy-submissions",
    },
    { status: 410 }
  );
}

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(
    {
      error: `Direct signal purchase for ${id} has been retired. Use /api/strategies/:id/subscribe and /api/subscriptions/:subscriptionId/signals.`,
    },
    { status: 410 }
  );
}

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(
    {
      error: `Manual signal pushes for ${id} have been retired. Live signals are produced by the platform sync workflow.`,
    },
    { status: 410 }
  );
}

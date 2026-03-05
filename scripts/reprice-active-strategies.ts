import { db } from "../src/db/client";
import { strategies } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

type PriceBand = {
  min: number;
  next: number;
};

const PRICE_BANDS: PriceBand[] = [
  { min: 20, next: 9 },
  { min: 12, next: 7 },
  { min: 8, next: 5 },
];

async function countActive() {
  const row = await db
    .select({
      count: sql<number>`count(*)`,
      min: sql<number>`coalesce(min(${strategies.pricePerSignal}), 0)`,
      max: sql<number>`coalesce(max(${strategies.pricePerSignal}), 0)`,
      avg: sql<number>`coalesce(avg(${strategies.pricePerSignal}), 0)`,
    })
    .from(strategies)
    .where(eq(strategies.status, "active"))
    .get();

  return {
    count: Number(row?.count ?? 0),
    min: Number(row?.min ?? 0),
    max: Number(row?.max ?? 0),
    avg: Number(row?.avg ?? 0),
  };
}

async function main() {
  console.log("=== Reprice Active Strategies ===");

  const before = await countActive();
  console.log(
    `Before: active=${before.count}, min=${before.min}, max=${before.max}, avg=${before.avg.toFixed(
      2
    )} cents`
  );

  await db.run(
    sql`UPDATE strategies
        SET price_per_signal = CASE
          WHEN status = 'active' AND price_per_signal >= ${PRICE_BANDS[0].min} THEN ${PRICE_BANDS[0].next}
          WHEN status = 'active' AND price_per_signal >= ${PRICE_BANDS[1].min} THEN ${PRICE_BANDS[1].next}
          WHEN status = 'active' AND price_per_signal >= ${PRICE_BANDS[2].min} THEN ${PRICE_BANDS[2].next}
          ELSE price_per_signal
        END
        WHERE status = 'active'`
  );

  const after = await countActive();
  console.log(
    `After: active=${after.count}, min=${after.min}, max=${after.max}, avg=${after.avg.toFixed(
      2
    )} cents`
  );
  console.log("Done.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Reprice failed: ${message}`);
  if (error && typeof error === "object" && "cause" in error) {
    console.error(`Cause: ${String((error as { cause?: unknown }).cause)}`);
  }
  process.exit(1);
});

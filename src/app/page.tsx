import { db } from "@/db/client";
import { strategies } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { StrategyCard } from "@/components/strategy-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const allStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "active"))
    .orderBy(desc(strategies.winRate));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-50">
          Strategy Marketplace
        </h1>
        <p className="mt-2 text-zinc-400">
          AI-native trading strategies. Purchase signals via x402. Powered by
          OKX OnchainOS.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-green-500"></span>
          <span className="text-sm text-zinc-400">
            {allStrategies.length} active strategies
          </span>
        </div>
        <div className="rounded-lg bg-zinc-900 px-4 py-2">
          <span className="text-sm text-zinc-400">
            X Layer &middot; Zero gas fees
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {allStrategies.map((s) => (
          <StrategyCard
            key={s.id}
            strategy={{
              ...s,
              totalSignals: s.totalSignals ?? 0,
              winRate: s.winRate ?? 0,
              avgReturn: s.avgReturn ?? 0,
            }}
          />
        ))}
      </div>

      {allStrategies.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-500">No strategies available yet.</p>
          <p className="mt-1 text-sm text-zinc-600">
            Use POST /api/strategies to publish one.
          </p>
        </div>
      )}
    </div>
  );
}

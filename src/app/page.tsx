import { db } from "@/db/client";
import { strategies, payments } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { StrategyCard } from "@/components/strategy-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const allStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "active"))
    .orderBy(desc(strategies.winRate));

  const totalSignals = allStrategies.reduce(
    (sum, s) => sum + (s.totalSignals ?? 0),
    0
  );

  const paymentStats = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(amount_cents), 0)`,
    })
    .from(payments)
    .where(eq(payments.status, "settled"))
    .get();

  return (
    <div>
      {/* Hero */}
      <div className="mb-10 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-blue-950/30 p-8">
        <div className="flex items-center gap-2 text-sm text-blue-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
          Agent-to-Agent Marketplace
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-50">
          On-Chain Strategy
          <br />
          <span className="text-blue-500">Marketplace</span>
        </h1>
        <p className="mt-4 max-w-lg text-zinc-400">
          AI agents publish trading strategies and sell signals via x402 payments
          on X Layer. Zero gas fees. No accounts needed &mdash; payment is
          authentication.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2">
            <p className="text-xs text-zinc-500">Active Strategies</p>
            <p className="font-mono text-lg font-semibold text-zinc-100">
              {allStrategies.length}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2">
            <p className="text-xs text-zinc-500">Total Signals</p>
            <p className="font-mono text-lg font-semibold text-zinc-100">
              {totalSignals}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2">
            <p className="text-xs text-zinc-500">Transactions</p>
            <p className="font-mono text-lg font-semibold text-zinc-100">
              {paymentStats?.count ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2">
            <p className="text-xs text-zinc-500">Volume</p>
            <p className="font-mono text-lg font-semibold text-green-500">
              ${((paymentStats?.total ?? 0) / 100).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href="#strategies"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Browse Strategies
          </a>
          <a
            href="https://github.com/Phlegonlabs/okx-onchainos#for-openclaw-agents"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Agent Quickstart
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <h3 className="font-medium text-zinc-100">1. Publish</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Provider agents publish strategies with signals via REST API.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 9V7a5 5 0 00-10 0v2M5 12h14l1 9H4l1-9z"
              />
            </svg>
          </div>
          <h3 className="font-medium text-zinc-100">2. Purchase</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Consumer agents pay via x402. HTTP 402 → sign → access.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2"
              />
            </svg>
          </div>
          <h3 className="font-medium text-zinc-100">3. Earn</h3>
          <p className="mt-1 text-sm text-zinc-500">
            90% goes to the provider. Settled on X Layer with zero gas.
          </p>
        </div>
      </div>

      {/* Strategies */}
      <div id="strategies">
        <h2 className="mb-4 text-xl font-semibold text-zinc-50">
          Active Strategies
        </h2>
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
    </div>
  );
}

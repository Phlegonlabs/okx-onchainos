import { db } from "@/db/client";
import { strategies, signals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SignalTable } from "@/components/signal-table";
import { MarketPrice } from "@/components/market-price";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StrategyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const strategy = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, id))
    .get();

  if (!strategy) notFound();

  const allSignals = await db
    .select()
    .from(signals)
    .where(eq(signals.strategyId, id))
    .orderBy(desc(signals.createdAt));

  const wins = allSignals.filter((s) => s.outcome === "win").length;
  const losses = allSignals.filter((s) => s.outcome === "loss").length;
  const totalReturn = allSignals.reduce(
    (sum, s) => sum + (s.returnPct || 0),
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="mono-font inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        &larr; Back to marketplace
      </Link>

      <section className="surface-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="mono-font text-xs uppercase tracking-[0.2em] text-zinc-500">
              Strategy Profile
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              {strategy.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                {strategy.asset}
              </span>
              <span className="mono-font text-xs text-zinc-500">
                {strategy.timeframe}
              </span>
              <span className="text-xs text-zinc-600">&middot;</span>
              <span className="mono-font text-xs text-zinc-300">
                ${((strategy.pricePerSignal || 0) / 100).toFixed(2)} per signal
              </span>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-zinc-400">
              {strategy.description}
            </p>

            <div className="mt-5">
              <Link
                href={`/providers/${strategy.providerAddress}`}
                className="mono-font inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Provider {strategy.providerAddress?.slice(0, 8)}...
                {strategy.providerAddress?.slice(-6)}
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <MarketPrice token={strategy.asset.split("/")[0]} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <StatBox
                label="Win Rate"
                value={`${((strategy.winRate || 0) * 100).toFixed(0)}%`}
                color={(strategy.winRate || 0) >= 0.6 ? "green" : "yellow"}
              />
              <StatBox
                label="Avg Return"
                value={`${(strategy.avgReturn || 0) > 0 ? "+" : ""}${(strategy.avgReturn || 0).toFixed(1)}%`}
                color={(strategy.avgReturn || 0) > 0 ? "green" : "red"}
              />
              <StatBox
                label="Signals"
                value={String(strategy.totalSignals || 0)}
                color="blue"
              />
              <StatBox label="W / L" value={`${wins} / ${losses}`} color="zinc" />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Cumulative Return
          </p>
          <p
            className={`mono-font mt-1 text-2xl font-semibold ${totalReturn > 0 ? "text-zinc-100" : "text-rose-400"}`}
          >
            {totalReturn > 0 ? "+" : ""}
            {totalReturn.toFixed(1)}%
          </p>
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="display-font text-2xl font-semibold text-zinc-50">
            Signal History
          </h2>
          <span className="mono-font rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
            {allSignals.length} entries
          </span>
        </div>
        {allSignals.length > 0 ? (
          <SignalTable signals={allSignals} />
        ) : (
          <p className="text-sm text-zinc-400">No signals yet.</p>
        )}
      </section>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green: "text-zinc-100",
    red: "text-rose-400",
    yellow: "text-zinc-200",
    blue: "text-zinc-300",
    zinc: "text-zinc-100",
  };

  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mono-font mt-1 text-xl font-semibold ${colorMap[color]}`}>
        {value}
      </p>
    </div>
  );
}

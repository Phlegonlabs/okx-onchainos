import { db } from "@/db/client";
import { strategies, signals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SignalTable } from "@/components/signal-table";
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
    <div>
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        &larr; Back to marketplace
      </Link>

      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-50">
              {strategy.name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                {strategy.asset}
              </span>
              <span className="text-xs text-zinc-500">
                {strategy.timeframe}
              </span>
              <span className="text-xs text-zinc-600">&middot;</span>
              <span className="font-mono text-xs text-zinc-400">
                ${((strategy.pricePerSignal || 0) / 100).toFixed(2)} per signal
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-400">{strategy.description}</p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            label="Total Signals"
            value={String(strategy.totalSignals || 0)}
            color="blue"
          />
          <StatBox
            label="W / L"
            value={`${wins} / ${losses}`}
            color="zinc"
          />
        </div>

        <div className="mt-4 rounded-lg bg-zinc-800/50 p-3">
          <p className="text-xs text-zinc-500">
            Cumulative Return:{" "}
            <span
              className={`font-mono font-medium ${totalReturn > 0 ? "text-green-500" : "text-red-500"}`}
            >
              {totalReturn > 0 ? "+" : ""}
              {totalReturn.toFixed(1)}%
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-600">
            Provider: {strategy.providerAddress?.slice(0, 10)}...
            {strategy.providerAddress?.slice(-8)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-zinc-50">
          Signal History
        </h2>
        {allSignals.length > 0 ? (
          <SignalTable signals={allSignals} />
        ) : (
          <p className="text-sm text-zinc-500">No signals yet.</p>
        )}
      </div>
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
    green: "text-green-500",
    red: "text-red-500",
    yellow: "text-yellow-500",
    blue: "text-blue-400",
    zinc: "text-zinc-300",
  };

  return (
    <div className="rounded-lg bg-zinc-800/50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-medium ${colorMap[color]}`}>
        {value}
      </p>
    </div>
  );
}

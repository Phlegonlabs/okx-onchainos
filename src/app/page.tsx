import { db } from "@/db/client";
import { strategies, payments } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { StrategyCard } from "@/components/strategy-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const strategyRows = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "active"))
    .orderBy(desc(strategies.winRate));
  const allStrategies = strategyRows.filter((strategy) => strategy.listingStatus === "approved");

  const totalSignals = allStrategies.reduce(
    (sum, s) => sum + (s.totalSignals ?? 0),
    0
  );
  const providers = new Set(allStrategies.map((s) => s.providerAddress)).size;
  const avgWinRate =
    allStrategies.length > 0
      ? allStrategies.reduce((sum, s) => sum + (s.winRate ?? 0), 0) /
        allStrategies.length
      : 0;

  const paymentStats = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(amount_cents), 0)`,
    })
    .from(payments)
    .where(eq(payments.status, "settled"))
    .get();

  return (
    <div className="space-y-10">
      <section className="surface-card relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mono-font text-xs uppercase tracking-[0.24em] text-zinc-500">
              Trading Strategy Agent Gateway
            </p>
            <h1 className="display-font mt-4 text-4xl font-semibold leading-[1.02] text-zinc-50 sm:text-5xl">
              Private skill access
              <br />
              to priced crypto strategy rails.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              OpenClaw agents enter through one private gateway, discover only
              approved strategies, pay through x402 when they need live signal
              batches or research candles, and can submit new templates for
              platform backtesting.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#strategies"
                className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold !text-black shadow-[0_1px_0_rgba(0,0,0,0.35)] transition-colors hover:bg-zinc-100"
              >
                Explore Approved Strategies
              </a>
              <a
                href="https://github.com/Phlegonlabs/okx-onchainos#for-openclaw-agents"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-zinc-700 bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                Agent Quickstart
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MetricCard label="Approved Strategies" value={String(allStrategies.length)} />
            <MetricCard label="Approved Providers" value={String(providers)} />
            <MetricCard label="Average Win Rate" value={`${(avgWinRate * 100).toFixed(0)}%`} />
            <MetricCard valueClassName="text-zinc-50" label="Settled Volume" value={`$${((paymentStats?.total ?? 0) / 100).toFixed(2)}`} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FlowStep step="01" title="Submit Templates" description="Agents submit template + params, then the platform backtests and scores them." />
        <FlowStep step="02" title="Pay Per Value" description="Live signals and candles trigger x402 only when the skill requests premium output." />
        <FlowStep step="03" title="Auto-Run Live" description="Approved strategies stay on a platform-managed signal rail with capped subscription billing." />
      </section>

      <section id="strategies" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-font text-xs uppercase tracking-[0.22em] text-zinc-500">
              Gateway Feed
            </p>
            <h2 className="display-font text-2xl font-semibold text-zinc-50 sm:text-3xl">
              Approved Strategies
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Signals: {totalSignals}
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Settlements: {paymentStats?.count ?? 0}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
          <div className="surface-card rounded-2xl p-12 text-center">
            <p className="text-zinc-300">No strategies available yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Use POST /api/strategy-submissions through the private skill gateway.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueClassName = "text-zinc-50",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="metric-tile rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className={`mono-font mt-1 text-2xl font-medium ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function FlowStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <article className="surface-card rounded-2xl p-5">
      <p className="mono-font text-xs tracking-[0.22em] text-zinc-500">{step}</p>
      <h3 className="display-font mt-2 text-lg font-semibold text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
    </article>
  );
}

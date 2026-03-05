import { db } from "@/db/client";
import { providerBalances, strategies, payments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProviderDashboard({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const normalizedAddress = address.toLowerCase();

  const balance = await db
    .select()
    .from(providerBalances)
    .where(eq(providerBalances.providerAddress, normalizedAddress))
    .get();

  if (!balance) notFound();

  const providerStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.providerAddress, normalizedAddress));

  const strategyIds = providerStrategies.map((s) => s.id);
  const recentPayments =
    strategyIds.length > 0
      ? await db
          .select()
          .from(payments)
          .where(eq(payments.status, "settled"))
          .orderBy(desc(payments.createdAt))
          .limit(20)
      : [];

  const filteredPayments = recentPayments.filter((p) =>
    strategyIds.includes(p.strategyId)
  );

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="mono-font inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        &larr; Back to marketplace
      </Link>

      <section className="surface-card rounded-3xl p-6 sm:p-8">
        <p className="mono-font text-xs uppercase tracking-[0.2em] text-zinc-500">
          Provider Wallet
        </p>
        <h1 className="display-font mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
          Earnings Dashboard
        </h1>
        <p className="mono-font mt-3 text-sm text-zinc-400">
          {address.slice(0, 12)}...{address.slice(-8)}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Total Earned"
            value={`$${((balance.totalEarnedCents ?? 0) / 100).toFixed(2)}`}
            valueClassName="text-zinc-100"
          />
          <StatTile
            label="Pending Balance"
            value={`$${((balance.pendingCents ?? 0) / 100).toFixed(2)}`}
            valueClassName="text-zinc-100"
          />
          <StatTile
            label="Signals Sold"
            value={String(balance.totalSignalsSold ?? 0)}
            valueClassName="text-zinc-100"
          />
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="display-font text-2xl font-semibold text-zinc-50">
            Your Strategies
          </h2>
          <span className="mono-font rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
            {providerStrategies.length} listed
          </span>
        </div>

        {providerStrategies.length > 0 ? (
          <div className="space-y-3">
            {providerStrategies.map((s) => (
              <Link key={s.id} href={`/strategies/${s.id}`}>
                <div className="metric-tile flex items-center justify-between gap-4 rounded-2xl p-4 transition-colors hover:bg-zinc-900">
                  <div>
                    <p className="display-font text-lg font-semibold text-zinc-100">
                      {s.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {s.asset} &middot; {s.timeframe}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mono-font text-sm font-semibold text-zinc-100">
                      {((s.winRate ?? 0) * 100).toFixed(0)}% win
                    </p>
                    <p className="mono-font text-xs text-zinc-400">
                      {s.totalSignals ?? 0} signals
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No strategies published yet.</p>
        )}
      </section>

      {filteredPayments.length > 0 && (
        <section className="surface-card rounded-3xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="display-font text-2xl font-semibold text-zinc-50">
              Recent Payments
            </h2>
            <span className="mono-font rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              {filteredPayments.length} records
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/70">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Your Share</th>
                  <th className="px-4 py-3 text-right">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/70">
                    <td className="mono-font px-4 py-3 text-xs text-zinc-400">
                      {p.createdAt?.slice(0, 10)}
                    </td>
                    <td className="mono-font px-4 py-3 text-right text-zinc-200">
                      ${(p.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="mono-font px-4 py-3 text-right text-zinc-100">
                      ${(p.providerCents / 100).toFixed(2)}
                    </td>
                    <td className="mono-font px-4 py-3 text-right text-xs text-zinc-500">
                      {p.txHash ? `${p.txHash.slice(0, 10)}...` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="metric-tile rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className={`mono-font mt-1 text-2xl font-semibold ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

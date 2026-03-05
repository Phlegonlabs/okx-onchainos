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

  const balance = await db
    .select()
    .from(providerBalances)
    .where(eq(providerBalances.providerAddress, address))
    .get();

  if (!balance) notFound();

  const providerStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.providerAddress, address));

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
    <div>
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        &larr; Back to marketplace
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-50">
        Provider Dashboard
      </h1>
      <p className="mt-1 font-mono text-sm text-zinc-500">
        {address.slice(0, 10)}...{address.slice(-8)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Total Earned</p>
          <p className="mt-1 font-mono text-2xl font-medium text-green-500">
            ${((balance.totalEarnedCents ?? 0) / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Pending Balance</p>
          <p className="mt-1 font-mono text-2xl font-medium text-yellow-500">
            ${((balance.pendingCents ?? 0) / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Signals Sold</p>
          <p className="mt-1 font-mono text-2xl font-medium text-blue-400">
            {balance.totalSignalsSold ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-50">
          Your Strategies
        </h2>
        {providerStrategies.length > 0 ? (
          <div className="space-y-3">
            {providerStrategies.map((s) => (
              <Link key={s.id} href={`/strategies/${s.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50">
                  <div>
                    <p className="font-medium text-zinc-50">{s.name}</p>
                    <p className="text-xs text-zinc-500">
                      {s.asset} &middot; {s.timeframe}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-green-500">
                      {((s.winRate ?? 0) * 100).toFixed(0)}% win
                    </p>
                    <p className="font-mono text-xs text-zinc-500">
                      {s.totalSignals ?? 0} signals
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No strategies published yet.</p>
        )}
      </div>

      {filteredPayments.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-50">
            Recent Payments
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Your Share</th>
                  <th className="pb-3 text-right">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-800/50"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-400">
                      {p.createdAt?.slice(0, 10)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-zinc-300">
                      ${(p.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-green-500">
                      ${(p.providerCents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono text-xs text-zinc-600">
                      {p.txHash
                        ? `${p.txHash.slice(0, 8)}...`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

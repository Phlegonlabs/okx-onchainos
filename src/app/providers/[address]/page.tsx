import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProviderDashboard({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="mono-font inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        &larr; Back to gateway
      </Link>

      <section className="surface-card rounded-3xl p-6 sm:p-8">
        <p className="mono-font text-xs uppercase tracking-[0.2em] text-zinc-500">
          Provider Access
        </p>
        <h1 className="display-font mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
          Private earnings surface
        </h1>
        <p className="mono-font mt-3 text-sm text-zinc-400">
          {address.slice(0, 12)}...{address.slice(-8)}
        </p>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Provider balances and payout telemetry now live behind the private
          skill gateway. Use the authenticated `GET /api/providers/:address`
          route from your skill runtime with both bearer access and wallet auth.
        </p>
      </section>
    </div>
  );
}

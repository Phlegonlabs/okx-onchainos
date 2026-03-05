import Link from "next/link";

interface Strategy {
  id: string;
  name: string;
  description: string;
  asset: string;
  timeframe: string;
  pricePerSignal: number;
  winRate: number;
  avgReturn: number;
  totalSignals: number;
}

export function StrategyCard({ strategy }: { strategy: Strategy }) {
  const winRateColor =
    strategy.winRate >= 0.6
      ? "text-zinc-100"
      : strategy.winRate >= 0.5
        ? "text-zinc-200"
        : "text-rose-400";
  const returnColor =
    strategy.avgReturn > 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <Link href={`/strategies/${strategy.id}`} className="group block h-full">
      <article className="surface-card relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-transform duration-300 group-hover:-translate-y-1">
        <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-white/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="display-font text-xl font-semibold leading-tight text-zinc-50">
              {strategy.name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-xs text-zinc-300">
                {strategy.asset}
              </span>
              <span className="mono-font text-xs text-zinc-500">
                {strategy.timeframe}
              </span>
            </div>
          </div>
          <span className="mono-font rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200">
            ${(strategy.pricePerSignal / 100).toFixed(2)}
          </span>
        </div>

        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-400">
          {strategy.description}
        </p>

        <div className="mt-auto pt-5">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Win Rate" value={`${(strategy.winRate * 100).toFixed(0)}%`} valueClassName={winRateColor} />
            <Metric
              label="Avg Return"
              value={`${strategy.avgReturn > 0 ? "+" : ""}${strategy.avgReturn.toFixed(1)}%`}
              valueClassName={returnColor}
            />
            <Metric
              label="Signals"
              value={String(strategy.totalSignals)}
              valueClassName="text-zinc-100"
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="metric-tile rounded-xl p-2.5">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mono-font mt-1 text-sm font-semibold ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

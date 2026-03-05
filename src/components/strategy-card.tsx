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
      ? "text-green-500"
      : strategy.winRate >= 0.5
        ? "text-yellow-500"
        : "text-red-500";
  const returnColor =
    strategy.avgReturn > 0 ? "text-green-500" : "text-red-500";

  return (
    <Link href={`/strategies/${strategy.id}`}>
      <div className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-600 hover:bg-zinc-800/50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-zinc-50">{strategy.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                {strategy.asset}
              </span>
              <span className="text-xs text-zinc-500">{strategy.timeframe}</span>
            </div>
          </div>
          <span className="font-mono text-sm text-zinc-400">
            ${(strategy.pricePerSignal / 100).toFixed(2)}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-zinc-400">
          {strategy.description}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-zinc-500">Win Rate</p>
            <p className={`font-mono text-sm font-medium ${winRateColor}`}>
              {(strategy.winRate * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Avg Return</p>
            <p className={`font-mono text-sm font-medium ${returnColor}`}>
              {strategy.avgReturn > 0 ? "+" : ""}
              {strategy.avgReturn.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Signals</p>
            <p className="font-mono text-sm font-medium text-zinc-300">
              {strategy.totalSignals}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

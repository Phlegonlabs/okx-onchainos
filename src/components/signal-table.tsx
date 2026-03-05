interface Signal {
  id: string;
  action: string;
  token: string;
  entry: number;
  stopLoss: number | null;
  takeProfit: number | null;
  outcome: string | null;
  returnPct: number | null;
  createdAt: string | null;
}

export function SignalTable({ signals }: { signals: Signal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
            <th className="pb-3 pr-4">Date</th>
            <th className="pb-3 pr-4">Action</th>
            <th className="pb-3 pr-4">Token</th>
            <th className="pb-3 pr-4 text-right">Entry</th>
            <th className="pb-3 pr-4 text-right">SL</th>
            <th className="pb-3 pr-4 text-right">TP</th>
            <th className="pb-3 pr-4 text-right">Outcome</th>
            <th className="pb-3 text-right">Return</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr
              key={signal.id}
              className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
            >
              <td className="py-3 pr-4 font-mono text-xs text-zinc-400">
                {signal.createdAt?.slice(0, 10)}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    signal.action === "buy"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {signal.action.toUpperCase()}
                </span>
              </td>
              <td className="py-3 pr-4 text-zinc-300">{signal.token}</td>
              <td className="py-3 pr-4 text-right font-mono text-zinc-300">
                ${signal.entry.toLocaleString()}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-zinc-500">
                {signal.stopLoss ? `$${signal.stopLoss.toLocaleString()}` : "-"}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-zinc-500">
                {signal.takeProfit
                  ? `$${signal.takeProfit.toLocaleString()}`
                  : "-"}
              </td>
              <td className="py-3 pr-4 text-right">
                {signal.outcome && (
                  <span
                    className={`text-xs font-medium ${
                      signal.outcome === "win"
                        ? "text-green-500"
                        : signal.outcome === "loss"
                          ? "text-red-500"
                          : "text-zinc-500"
                    }`}
                  >
                    {signal.outcome.toUpperCase()}
                  </span>
                )}
              </td>
              <td className="py-3 text-right">
                {signal.returnPct != null && (
                  <span
                    className={`font-mono text-sm font-medium ${
                      signal.returnPct > 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {signal.returnPct > 0 ? "+" : ""}
                    {signal.returnPct.toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

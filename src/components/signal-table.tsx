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
  const formatNumber = (value: number | null) =>
    value == null ? "-" : `$${value.toLocaleString()}`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/70">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Token</th>
            <th className="px-4 py-3 text-right">Entry</th>
            <th className="px-4 py-3 text-right">SL</th>
            <th className="px-4 py-3 text-right">TP</th>
            <th className="px-4 py-3 text-right">Outcome</th>
            <th className="px-4 py-3 text-right">Return</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr
              key={signal.id}
              className="border-b border-zinc-800/70 transition-colors hover:bg-zinc-900/60"
            >
              <td className="mono-font px-4 py-3 text-xs text-zinc-400">
                {signal.createdAt?.slice(0, 10)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    signal.action === "buy"
                      ? "bg-zinc-700/35 text-zinc-200"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {signal.action.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-200">{signal.token}</td>
              <td className="mono-font px-4 py-3 text-right text-zinc-200">
                ${signal.entry.toLocaleString()}
              </td>
              <td className="mono-font px-4 py-3 text-right text-zinc-400">
                {formatNumber(signal.stopLoss)}
              </td>
              <td className="mono-font px-4 py-3 text-right text-zinc-400">
                {formatNumber(signal.takeProfit)}
              </td>
              <td className="px-4 py-3 text-right">
                {signal.outcome && (
                  <span
                    className={`text-xs font-semibold ${
                      signal.outcome === "win"
                        ? "text-zinc-100"
                        : signal.outcome === "loss"
                          ? "text-rose-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {signal.outcome.toUpperCase()}
                  </span>
                )}
                {!signal.outcome && <span className="text-xs text-zinc-500">-</span>}
              </td>
              <td className="px-4 py-3 text-right">
                {signal.returnPct != null && (
                  <span
                    className={`mono-font text-sm font-semibold ${
                      signal.returnPct > 0 ? "text-zinc-100" : "text-rose-400"
                    }`}
                  >
                    {signal.returnPct > 0 ? "+" : ""}
                    {signal.returnPct.toFixed(1)}%
                  </span>
                )}
                {signal.returnPct == null && (
                  <span className="text-xs text-zinc-500">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
